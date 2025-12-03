const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const pool = require('./db');

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });
  
  // Store active connections and AI generation streams
  const connections = new Map();
  const activeStreams = new Map(); // messageId -> { abortController, classId }
  const cancelledMessages = new Set(); // Track cancelled message IDs for extra safety
  
  wss.on('connection', async (ws, req) => {
    let userId = null;
    let classId = null;

    // Handle authentication and class joining
    ws.on('message', async (message) => {
      const data = JSON.parse(message);
      
      if (data.type === 'auth') {
        try {
          const payload = jwt.verify(data.token, process.env.JWT_SECRET);
          userId = payload.id;
          
          // Store connection
          if (!connections.has(userId)) {
            connections.set(userId, new Set());
          }
          connections.get(userId).add(ws);
          
          // Update user status to online
          await pool.query(
            'INSERT INTO user_status (user_id, is_online) VALUES ($1, true) ON CONFLICT (user_id) DO UPDATE SET is_online = true, last_seen = CURRENT_TIMESTAMP',
            [userId]
          );
          
          // Broadcast online status change
          broadcastUserStatus(userId, true);
        } catch (err) {
          ws.close();
        }
      }
      
      if (data.type === 'join_class') {
        classId = data.classId;
        ws.classId = classId;
      }
      
      if (data.type === 'stop_generation' && userId && classId) {
        // CRITICAL: Abort IMMEDIATELY and SYNCHRONOUSLY - no async operations first
        let abortedStreams = 0;
        const streamIds = [];
        
        // Step 1: Immediate abort of all OpenAI requests for this user's chat room in this class
        for (const [messageId, streamInfo] of activeStreams.entries()) {
          if (streamInfo.classId === classId && streamInfo.userId === userId) {
            // Mark as cancelled BEFORE aborting (prevents race conditions)
            cancelledMessages.add(messageId);
            
            // Save partial response before aborting
            const partialResponse = streamInfo.fullResponse || '';
            if (partialResponse) {
              try {
                await pool.query(
                  'UPDATE chat_messages SET message = $1, status = $2 WHERE id = $3',
                  [partialResponse, 'cancelled', messageId]
                );
                console.log(`💾 Saved partial response for cancelled message ${messageId}: "${partialResponse.substring(0, 50)}..."`);
              } catch (saveError) {
                console.error('Error saving partial response:', saveError);
              }
            }
            
            // Abort the OpenAI stream immediately
            streamInfo.abortController.abort();
            streamIds.push(messageId);
            abortedStreams++;
          }
        }
        
        // Step 2: Clean up tracking (after abort to prevent timing issues)
        for (const messageId of streamIds) {
          activeStreams.delete(messageId);
        }
        
        // Step 3: Only log/broadcast after critical abort operations are complete
        console.log(`🛑 IMMEDIATE ABORT: Cancelled ${abortedStreams} OpenAI streams for user ${userId} in class ${classId}`);
        
        // Send stop signal only to this user (their private chat room)
        ws.send(JSON.stringify({
          type: 'generation_stopped',
          userId: userId,
          abortedCount: abortedStreams
        }));
      }
      
      if (data.type === 'chat_message' && userId && classId) {
        const { message } = data;
        
        console.log('🚨 WEBSOCKET: Chat message received!', { message, userId, classId });
        
        try {
          // Store message in database in the user's private chat room
          const result = await pool.query(
            'INSERT INTO chat_messages (class_id, user_id, message, chat_owner_id) VALUES ($1, $2, $3, $4) RETURNING *',
            [classId, userId, message, userId]
          );
          
          // Get user info
          const userResult = await pool.query(
            'SELECT name FROM users WHERE id = $1',
            [userId]
          );
          
          const chatMessage = {
            ...result.rows[0],
            user_name: userResult.rows[0].name
          };
          
          // Generate AI response for every message (like ChatGPT) - with streaming!
          try {
            console.log('🌊 Generating streaming AI response for message:', message);
            console.log('🌊 About to import generateAIResponseStream...');
            
            // Import AI service
            const { generateAIResponseStream } = require('./aiService');
            console.log('🌊 generateAIResponseStream imported successfully');
            
            // Get class info for AI name
            const classResult = await pool.query(
              'SELECT ai_name FROM classes WHERE id = $1',
              [classId]
            );
            
            const aiName = classResult.rows[0]?.ai_name || 'Assistant';
            
            // Create placeholder AI message in the user's private chat room
            const aiMessageResult = await pool.query(
              'INSERT INTO chat_messages (class_id, user_id, message, is_ai, status, chat_owner_id) VALUES ($1, $2, $3, true, $4, $5) RETURNING *',
              [classId, null, '', 'generating', userId]
            );
            
            const aiMessageId = aiMessageResult.rows[0].id;
            let fullResponse = '';
            
            // Create AbortController for this AI generation
            const abortController = new AbortController();
            const streamInfo = { abortController, classId, userId, fullResponse: '' };
            activeStreams.set(aiMessageId, streamInfo);
            
            // Send initial AI message with placeholder only to this user
            ws.send(JSON.stringify({
              type: 'ai_message_start',
              id: aiMessageId,
              user_name: aiName,
              is_ai: true,
              message: '',
              created_at: aiMessageResult.rows[0].created_at
            }));
            
            // Generate streaming AI response with AbortController and cancellation callback
            const isCancelledCallback = (msgId) => cancelledMessages.has(msgId);
            const streamGenerator = generateAIResponseStream(classId, message, aiName, abortController, aiMessageId, isCancelledCallback);
            
            const processStream = async () => {
              try {
                console.log('🌊 Starting to process stream generator...');
                for await (const chunk of streamGenerator) {
                  // AGGRESSIVE cancellation check at start of each iteration
                  if (cancelledMessages.has(aiMessageId) || !activeStreams.has(aiMessageId)) {
                    console.log('🛑 Message cancelled, stopping stream processing immediately');
                    break;
                  }
                  
                  console.log('🌊 Received chunk:', chunk);
                  if (chunk.success && chunk.content) {
                    // Double-check cancellation before processing content
                    if (cancelledMessages.has(aiMessageId)) {
                      console.log('🛑 Message cancelled before processing chunk content');
                      break;
                    }
                    
                    fullResponse += chunk.content;
                    // Also update the activeStreams reference
                    if (activeStreams.has(aiMessageId)) {
                      activeStreams.get(aiMessageId).fullResponse = fullResponse;
                    }
                    console.log('🌊 Broadcasting chunk with content:', chunk.content);
                    
                    // Send each character chunk only to this user
                    ws.send(JSON.stringify({
                      type: 'ai_message_chunk',
                      id: aiMessageId,
                      content: chunk.content,
                      finished: chunk.finished
                    }));
                  }
                  
                  if (chunk.finished) {
                    // Final cancellation check before completion
                    if (cancelledMessages.has(aiMessageId)) {
                      console.log('🛑 Message cancelled before completion');
                      break;
                    }
                    
                    // Update database with complete response
                    await pool.query(
                      'UPDATE chat_messages SET message = $1, status = $2 WHERE id = $3',
                      [fullResponse, 'active', aiMessageId]
                    );
                    
                    // Send completion signal only to this user
                    ws.send(JSON.stringify({
                      type: 'ai_message_complete',
                      id: aiMessageId,
                      documentsUsed: chunk.documentsUsed
                    }));
                    
                    // Clean up the active stream and cancellation tracking
                    activeStreams.delete(aiMessageId);
                    cancelledMessages.delete(aiMessageId);
                    
                    break;
                  }
                }
              } catch (streamError) {
                console.error('Streaming error:', streamError);
                
                // Clean up the active stream and cancellation tracking
                activeStreams.delete(aiMessageId);
                cancelledMessages.delete(aiMessageId);
                
                // Enhanced abort detection
                if (streamError.name === 'AbortError' || 
                    streamError.message?.includes('aborted') ||
                    cancelledMessages.has(aiMessageId)) {
                  console.log('🛑 AI stream was properly aborted (enhanced detection)');
                  // Save partial response and mark as cancelled in database
                  await pool.query(
                    'UPDATE chat_messages SET message = $1, status = $2 WHERE id = $3',
                    [fullResponse || '', 'cancelled', aiMessageId]
                  );
                  
                  // Broadcast cancellation to frontend (only to this user)
                  ws.send(JSON.stringify({
                    type: 'ai_message_cancelled',
                    id: aiMessageId
                  }));
                  return; // Don't send fallback response for cancelled requests
                }
                
                // Fall back to non-streaming if streaming fails for other reasons
                const { generateAIResponse } = require('./aiService');
                const aiResult = await generateAIResponse(classId, message, aiName);
                
                if (aiResult.success) {
                  await pool.query(
                    'UPDATE chat_messages SET message = $1, status = $2 WHERE id = $3',
                    [aiResult.response, 'active', aiMessageId]
                  );
                  
                  ws.send(JSON.stringify({
                    type: 'ai_message_complete',
                    id: aiMessageId,
                    documentsUsed: aiResult.documentsUsed,
                    content: aiResult.response,
                    fallback: true
                  }));
                }
              }
            };
            
            // Process streaming asynchronously
            processStream();
          } catch (aiError) {
            console.error('Error generating streaming AI response:', aiError);
          }
          
          console.log('🚨 WEBSOCKET: About to broadcast user message and start AI streaming');
          
          // Send message only to this user (private chat room)
          ws.send(JSON.stringify({
            type: 'chat_message',
            ...chatMessage
          }));
        } catch (err) {
          console.error('Error handling message:', err);
        }
      }
    });
    
    // Handle disconnection
    ws.on('close', async () => {
      if (userId) {
        // Remove connection
        connections.get(userId)?.delete(ws);
        if (connections.get(userId)?.size === 0) {
          connections.delete(userId);
          
          // Update user status to offline
          await pool.query(
            'UPDATE user_status SET is_online = false, last_seen = CURRENT_TIMESTAMP WHERE user_id = $1',
            [userId]
          );
          
          // Broadcast offline status
          broadcastUserStatus(userId, false);
        }
      }
    });
  });
  
  function broadcastToClass(classId, message) {
    wss.clients.forEach((client) => {
      if (client.classId === classId && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }
  
  function broadcastUserStatus(userId, isOnline) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'user_status',
          userId,
          isOnline
        }));
      }
    });
  }
  
  return wss;
}

module.exports = setupWebSocket;