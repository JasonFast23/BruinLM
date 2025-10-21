const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const pool = require('./db');

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });
  
  // Store active connections
  const connections = new Map();
  
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
        console.log('🛑 Stop generation request received from user', userId);
        
        // Broadcast stop signal to all class members
        broadcastToClass(classId, {
          type: 'generation_stopped',
          userId: userId
        });
        
        // TODO: If needed, could also cancel any ongoing AI processing here
        // For now, the frontend will handle stopping the streaming display
      }
      
      if (data.type === 'chat_message' && userId && classId) {
        const { message } = data;
        
        console.log('🚨 WEBSOCKET: Chat message received!', { message, userId, classId });
        
        try {
          // Store message in database
          const result = await pool.query(
            'INSERT INTO chat_messages (class_id, user_id, message) VALUES ($1, $2, $3) RETURNING *',
            [classId, userId, message]
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
            
            // Create placeholder AI message
            const aiMessageResult = await pool.query(
              'INSERT INTO chat_messages (class_id, user_id, message, is_ai, status) VALUES ($1, $2, $3, true, $4) RETURNING *',
              [classId, null, '', 'generating']
            );
            
            const aiMessageId = aiMessageResult.rows[0].id;
            let fullResponse = '';
            
            // Send initial AI message with placeholder
            broadcastToClass(classId, {
              type: 'ai_message_start',
              id: aiMessageId,
              user_name: aiName,
              is_ai: true,
              message: '',
              created_at: aiMessageResult.rows[0].created_at
            });
            
            // Generate streaming AI response
            const streamGenerator = generateAIResponseStream(classId, message, aiName);
            
            const processStream = async () => {
              try {
                console.log('🌊 Starting to process stream generator...');
                for await (const chunk of streamGenerator) {
                  console.log('🌊 Received chunk:', chunk);
                  if (chunk.success && chunk.content) {
                    fullResponse += chunk.content;
                    console.log('🌊 Broadcasting chunk with content:', chunk.content);
                    
                    // Broadcast each character chunk
                    broadcastToClass(classId, {
                      type: 'ai_message_chunk',
                      id: aiMessageId,
                      content: chunk.content,
                      finished: chunk.finished
                    });
                  }
                  
                  if (chunk.finished) {
                    // Update database with complete response
                    await pool.query(
                      'UPDATE chat_messages SET message = $1, status = $2 WHERE id = $3',
                      [fullResponse, 'active', aiMessageId]
                    );
                    
                    // Send completion signal
                    broadcastToClass(classId, {
                      type: 'ai_message_complete',
                      id: aiMessageId,
                      documentsUsed: chunk.documentsUsed
                    });
                    
                    break;
                  }
                }
              } catch (streamError) {
                console.error('Streaming error:', streamError);
                // Fall back to non-streaming if streaming fails
                const { generateAIResponse } = require('./aiService');
                const aiResult = await generateAIResponse(classId, message, aiName);
                
                if (aiResult.success) {
                  await pool.query(
                    'UPDATE chat_messages SET message = $1, status = $2 WHERE id = $3',
                    [aiResult.response, 'active', aiMessageId]
                  );
                  
                  broadcastToClass(classId, {
                    type: 'ai_message_complete',
                    id: aiMessageId,
                    documentsUsed: aiResult.documentsUsed,
                    content: aiResult.response,
                    fallback: true
                  });
                }
              }
            };
            
            // Process streaming asynchronously
            processStream();
          } catch (aiError) {
            console.error('Error generating streaming AI response:', aiError);
          }
          
          console.log('🚨 WEBSOCKET: About to broadcast user message and start AI streaming');
          
          // Broadcast message to class
          broadcastToClass(classId, {
            type: 'chat_message',
            ...chatMessage
          });
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