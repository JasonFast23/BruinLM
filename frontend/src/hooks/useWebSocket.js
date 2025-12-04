/**
 * WebSocket custom hook for real-time chat communication
 * Manages WebSocket connection, message handling, and streaming state
 */

import { useState, useEffect, useRef } from 'react';

const WEBSOCKET_URL = 'ws://localhost:5001';
const CHARACTER_ANIMATION_DELAY_MS = 25; // ~40 chars/second (Claude-like speed)

/**
 * Custom hook for managing WebSocket connection and chat streaming
 *
 * @param {string} classId - ID of the class to connect to
 * @param {Function} onMessage - Callback when user message is received
 * @param {Function} onAIStart - Callback when AI starts responding
 * @param {Function} onAIChunk - Callback when AI sends a content chunk
 * @param {Function} onAIComplete - Callback when AI finishes responding
 * @param {Function} onGenerationStopped - Callback when generation is stopped
 * @param {Function} persistAIState - Callback to persist AI responding state
 * @returns {Object} WebSocket state and functions
 */
export function useWebSocket(
  classId,
  onMessage,
  onAIStart,
  onAIChunk,
  onAIComplete,
  onGenerationStopped,
  persistAIState
) {
  const [socket, setSocket] = useState(null);
  const [isAIResponding, setIsAIResponding] = useState(false);
  const streamingQueues = useRef(new Map());
  const shouldBeResponding = useRef(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const websocket = new WebSocket(WEBSOCKET_URL);

    websocket.onopen = () => {
      console.log('WebSocket connected');
      // Authenticate
      websocket.send(JSON.stringify({ type: 'auth', token }));
      // Join class room
      websocket.send(JSON.stringify({ type: 'join_class', classId }));
    };

    websocket.onmessage = (event) => {
      console.log('🚨 FRONTEND: WebSocket message received:', event.data);
      const data = JSON.parse(event.data);
      console.log('🚨 FRONTEND: Parsed data:', data);

      if (data.type === 'chat_message') {
        // Only add AI messages from WebSocket (user messages are added immediately)
        if (data.is_ai && onMessage) {
          onMessage(data);
        }
      } else if (data.type === 'ai_message_start') {
        // Start of streaming AI message
        console.log('🌊 Frontend: AI message start received', data);
        shouldBeResponding.current = true;
        setIsAIResponding(true);
        console.log('🛑 STOP BUTTON: Should be visible now (ai_message_start)');

        if (onAIStart) {
          onAIStart(data);
        }
      } else if (data.type === 'ai_message_chunk') {
        // Streaming content chunk with proper letter-by-letter animation
        console.log('🌊 Frontend: Received chunk:', data.content);

        const messageId = data.id;
        const chunk = data.content;

        // Initialize queue for this message if it doesn't exist
        if (!streamingQueues.current.has(messageId)) {
          streamingQueues.current.set(messageId, {
            queue: [],
            isProcessing: false
          });
        }

        const messageQueue = streamingQueues.current.get(messageId);

        // Add each character from the chunk to the queue
        for (let char of chunk) {
          messageQueue.queue.push(char);
        }

        // Start processing if not already processing
        if (!messageQueue.isProcessing) {
          messageQueue.isProcessing = true;

          const processQueue = () => {
            // CRITICAL FIX: Check if this queue was cancelled
            if (!messageQueue.isProcessing || messageQueue.queue.length === 0) {
              messageQueue.isProcessing = false;
              return;
            }

            // Check if AI generation was stopped globally
            if (!shouldBeResponding.current) {
              console.log('🛑 Character animation stopped due to cancellation');
              messageQueue.isProcessing = false;
              messageQueue.queue = []; // Clear remaining characters
              return;
            }

            if (messageQueue.queue.length > 0) {
              const char = messageQueue.queue.shift();

              // Use requestAnimationFrame for smoother rendering
              requestAnimationFrame(() => {
                if (onAIChunk) {
                  onAIChunk(messageId, char);
                }
              });

              // Claude-like speed
              setTimeout(processQueue, CHARACTER_ANIMATION_DELAY_MS);
            } else {
              messageQueue.isProcessing = false;
            }
          };

          processQueue();
        }
      } else if (data.type === 'ai_message_complete') {
        // Streaming complete from backend
        const messageQueue = streamingQueues.current.get(data.id);

        const finishResponse = () => {
          shouldBeResponding.current = false;
          setIsAIResponding(false);
          console.log('🛑 STOP BUTTON: Hidden - AI response complete');

          // Clean up the streaming queue for this message
          if (streamingQueues.current.has(data.id)) {
            streamingQueues.current.delete(data.id);
          }

          if (onAIComplete) {
            onAIComplete(data);
          }
        };

        if (messageQueue && messageQueue.isProcessing && messageQueue.queue.length > 0) {
          // Still processing characters, wait for completion
          console.log('🛑 STOP BUTTON: Waiting for remaining characters to be processed');

          const checkQueue = () => {
            const currentQueue = streamingQueues.current.get(data.id);
            if (!currentQueue || (!currentQueue.isProcessing && currentQueue.queue.length === 0)) {
              finishResponse();
            } else {
              setTimeout(checkQueue, 50);
            }
          };

          setTimeout(checkQueue, 50);
        } else {
          // No active character processing, finish immediately
          finishResponse();
        }
      } else if (data.type === 'generation_stopped') {
        console.log('🛑 Generation stopped by user:', data.userId);

        // Force stop AI response state
        setIsAIResponding(false);

        // Clear all streaming queues
        streamingQueues.current.clear();

        if (onGenerationStopped) {
          onGenerationStopped(data);
        }
      } else if (data.type === 'ai_message_cancelled') {
        console.log('🛑 AI message cancelled by backend:', data.id);

        if (onAIComplete) {
          onAIComplete({ ...data, cancelled: true });
        }
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    setSocket(websocket);

    // Cleanup
    const currentQueues = streamingQueues.current;
    const currentShouldBeResponding = shouldBeResponding;

    return () => {
      if (websocket) websocket.close();

      // Clean up state when component unmounts or class changes
      console.log('🧹 Cleaning up WebSocket state');
      setIsAIResponding(false);
      currentQueues.clear();
      currentShouldBeResponding.current = false;
      if (persistAIState) persistAIState(false);
    };
  }, [classId, onMessage, onAIStart, onAIChunk, onAIComplete, onGenerationStopped, persistAIState]);

  // Persist AI responding state changes
  useEffect(() => {
    if (persistAIState) {
      persistAIState(isAIResponding);
    }
  }, [isAIResponding, persistAIState]);

  /**
   * Send a chat message through WebSocket
   */
  const sendMessage = (message) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      console.log('🚨 FRONTEND: Sending WebSocket message:', message);
      socket.send(JSON.stringify({
        type: 'chat_message',
        message: message
      }));
      console.log('🚨 FRONTEND: Message sent successfully');
      return true;
    }
    return false;
  };

  /**
   * Stop AI generation
   */
  const stopGeneration = () => {
    console.log('🛑 Stopping AI generation...');

    // Immediate UI cleanup
    setIsAIResponding(false);
    shouldBeResponding.current = false;

    // Stop all character animation timers
    const activeQueues = Array.from(streamingQueues.current.values());
    activeQueues.forEach(queue => {
      queue.isProcessing = false;
      queue.queue = [];
    });
    streamingQueues.current.clear();

    // Send stop signal to backend via WebSocket
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'stop_generation'
      }));
    }
  };

  return {
    socket,
    isAIResponding,
    setIsAIResponding,
    sendMessage,
    stopGeneration,
    shouldBeResponding,
    streamingQueues
  };
}
