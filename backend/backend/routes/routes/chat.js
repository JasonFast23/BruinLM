const express = require('express');
const pool = require('../../db');
const { authenticate } = require('../../middleware/auth');
const { generateAIResponse, generateAIResponseStream } = require('../../aiService');

const router = express.Router();

// Get chat history for a class (private to each user)
router.get('/history/:classId', authenticate, async (req, res) => {
  const { classId } = req.params;
  const userId = req.user.id;
  try {
    // Get regular chat messages for THIS USER's private chat room
    const chatResult = await pool.query(
      `SELECT cm.*, u.name as user_name 
       FROM chat_messages cm 
       LEFT JOIN users u ON cm.user_id = u.id 
       WHERE cm.class_id = $1 
         AND cm.chat_owner_id = $2 
         AND cm.status != 'cancelled' 
         AND cm.status != 'generating'
       ORDER BY cm.created_at ASC 
       LIMIT 100`,
      [classId, userId]
    );
    
    // Get document summaries for this class
    const summariesResult = await pool.query(
      `SELECT ds.summary, d.filename, ds.created_at 
       FROM document_summaries ds 
       JOIN documents d ON ds.document_id = d.id 
       WHERE d.class_id = $1 
       ORDER BY ds.created_at ASC`,
      [classId]
    );
    
    // Convert summaries to chat message format
    const summaryMessages = summariesResult.rows.map(row => ({
      id: `summary_${row.filename}_${Date.now()}`,
      message: `📋 **Summary of "${row.filename}"**\n\n${row.summary}`,
      is_ai: true,
      created_at: row.created_at,
      user_name: null
    }));
    
    // Combine and sort all messages by timestamp
    const allMessages = [...chatResult.rows, ...summaryMessages].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );
    
    res.json(allMessages);
  } catch (err) {
    console.error('Failed to fetch chat history:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send a message (this will mainly be handled by WebSocket, but keeping REST endpoint as fallback)
router.post('/message/:classId', authenticate, async (req, res) => {
  const { classId } = req.params;
  const { message, isAI } = req.body;
  const userId = req.user.id;
  
  console.log('📝 Message received:', { classId, message, isAI, userId });
  
  try {
    // Store the user's message in their private chat room
    const result = await pool.query(
      'INSERT INTO chat_messages (class_id, user_id, message, is_ai, chat_owner_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [classId, isAI ? null : userId, message, isAI || false, userId]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to send message:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI chat endpoint - handles AI questions
router.post('/ai/:classId', authenticate, async (req, res) => {
  const { classId } = req.params;
  const { question } = req.body;
  
  console.log('🤖 AI request received:', { classId, question });
  
  try {
    // Get class info including AI name
    const classResult = await pool.query(
      'SELECT ai_name FROM classes WHERE id = $1',
      [classId]
    );
    
    if (classResult.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    const aiName = classResult.rows[0].ai_name || 'Andy';
    
    console.log('🤖 Generating AI response with name:', aiName);
    
    // Create a placeholder message with 'generating' status first in the user's private chat room
    const placeholderResult = await pool.query(
      'INSERT INTO chat_messages (class_id, user_id, message, is_ai, status, chat_owner_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [classId, null, 'Generating response...', true, 'generating', req.user.id]
    );
    
    const messageId = placeholderResult.rows[0].id;
    
    // Generate AI response using RAG
    const aiResult = await generateAIResponse(classId, question, aiName);
    
    console.log('🤖 AI result:', { success: aiResult.success, hasResponse: !!aiResult.response });
    
    if (!aiResult.success) {
      // Update the placeholder with error message
      await pool.query(
        'UPDATE chat_messages SET message = $1, status = $2 WHERE id = $3',
        [aiResult.response, 'active', messageId]
      );
      
      return res.status(500).json({ 
        success: false, 
        response: aiResult.response 
      });
    }
    
    // Update the placeholder with the actual response
    await pool.query(
      'UPDATE chat_messages SET message = $1, status = $2 WHERE id = $3',
      [aiResult.response, 'active', messageId]
    );
    
    console.log('🤖 AI response stored successfully');
    
    res.json({
      success: true,
      response: aiResult.response,
      messageId: messageId,
      documentsUsed: aiResult.documentsUsed
    });
  } catch (err) {
    console.error('Failed to process AI request:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Streaming AI chat endpoint - handles AI questions with character-by-character response
router.get('/ai-stream/:classId', authenticate, async (req, res) => {
  const { classId } = req.params;
  const { question } = req.query;
  
  console.log('🌊 Streaming AI request received:', { classId, question });
  
  // Set up Server-Sent Events headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });
  
  try {
    // Get class info including AI name
    const classResult = await pool.query(
      'SELECT ai_name FROM classes WHERE id = $1',
      [classId]
    );
    
    if (classResult.rows.length === 0) {
      res.write(`data: ${JSON.stringify({ error: 'Class not found' })}\n\n`);
      res.end();
      return;
    }
    
    const aiName = classResult.rows[0].ai_name || 'Andy';
    
    console.log('🌊 Generating streaming AI response with name:', aiName);
    
    // Create a placeholder message with 'generating' status first in the user's private chat room
    const placeholderResult = await pool.query(
      'INSERT INTO chat_messages (class_id, user_id, message, is_ai, status, chat_owner_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [classId, null, '', true, 'generating', req.user.id]
    );
    
    const messageId = placeholderResult.rows[0].id;
    let fullResponse = '';
    
    // Send message ID to client
    res.write(`data: ${JSON.stringify({ messageId, type: 'start' })}\n\n`);
    
    // Generate streaming AI response
    for await (const chunk of generateAIResponseStream(classId, question, aiName)) {
      if (chunk.success && chunk.content) {
        fullResponse += chunk.content;
        
        // Send the chunk to client
        res.write(`data: ${JSON.stringify({ 
          content: chunk.content, 
          type: 'chunk',
          finished: chunk.finished 
        })}\n\n`);
      }
      
      if (chunk.finished) {
        // Update the database with the complete response
        await pool.query(
          'UPDATE chat_messages SET message = $1, status = $2 WHERE id = $3',
          [fullResponse, 'active', messageId]
        );
        
        // Send final message with document info
        res.write(`data: ${JSON.stringify({ 
          type: 'complete',
          documentsUsed: chunk.documentsUsed,
          messageId: messageId
        })}\n\n`);
        
        break;
      }
    }
    
    console.log('🌊 Streaming AI response completed');
    res.end();
    
  } catch (err) {
    console.error('Failed to process streaming AI request:', err);
    res.write(`data: ${JSON.stringify({ error: 'Server error' })}\n\n`);
    res.end();
  }
});

// Cancel a message (mark as cancelled)
router.post('/cancel/:messageId', authenticate, async (req, res) => {
  const { messageId } = req.params;
  
  console.log('❌ Cancelling message:', messageId);
  
  try {
    // Update message status to cancelled
    const result = await pool.query(
      'UPDATE chat_messages SET status = $1 WHERE id = $2 AND is_ai = true RETURNING *',
      ['cancelled', messageId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found or not cancellable' });
    }
    
    console.log('✅ Message cancelled successfully');
    
    res.json({
      success: true,
      message: 'Message cancelled successfully'
    });
  } catch (err) {
    console.error('Failed to cancel message:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;