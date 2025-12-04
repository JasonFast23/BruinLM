/**
 * Custom hook for managing chat state and persistence
 * Handles messages, AI state, and cleanup of stale messages
 */

import { useState, useCallback } from 'react';

const STALE_MESSAGE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Custom hook for managing chat state
 *
 * @param {string} classId - ID of the current class
 * @returns {Object} Chat state and helper functions
 */
export function useChatState(classId) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  /**
   * Persist AI responding state to localStorage
   */
  const persistAIState = useCallback((responding) => {
    const storageKey = `ai_responding_${classId}`;
    if (responding) {
      localStorage.setItem(storageKey, 'true');
    } else {
      localStorage.removeItem(storageKey);
    }
  }, [classId]);

  /**
   * Get persisted AI state from localStorage
   */
  const getPersistedAIState = useCallback(() => {
    const storageKey = `ai_responding_${classId}`;
    return localStorage.getItem(storageKey) === 'true';
  }, [classId]);

  /**
   * Clean up a stale generating message
   */
  const cleanupStaleMessage = useCallback(async (messageId) => {
    try {
      const response = await fetch(`/api/chat/cancel/${messageId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        console.log('🧹 Successfully cleaned up stale message:', messageId);
      } else {
        console.warn('⚠️ Failed to clean up stale message:', messageId);
      }
    } catch (error) {
      console.warn('⚠️ Error cleaning up stale message:', messageId, error);
    }
  }, []);

  /**
   * Process chat history and clean up stale messages
   */
  const processMessages = useCallback((chatHistory) => {
    const fiveMinutesAgo = new Date(Date.now() - STALE_MESSAGE_THRESHOLD_MS);

    const processedMessages = chatHistory.map(msg => {
      if (msg.status === 'generating' && msg.is_ai) {
        const messageDate = new Date(msg.created_at);

        // If generating message is older than 5 minutes, it's likely stale
        if (messageDate < fiveMinutesAgo) {
          console.log('🧹 Found stale generating message, cleaning up:', msg.id, messageDate);
          cleanupStaleMessage(msg.id);
          return { ...msg, status: 'cancelled' };
        } else {
          console.log('🔄 Found recent generating message on load:', msg.id);
          return { ...msg, streaming: true };
        }
      }
      return msg;
    });

    setMessages(processedMessages);

    // Check if there are active generating messages
    const hasActiveGeneratingMessages = processedMessages.some(msg => msg.streaming === true);

    return hasActiveGeneratingMessages;
  }, [cleanupStaleMessage]);

  /**
   * Add a user message to the chat
   */
  const addUserMessage = useCallback((messageText) => {
    const userMessageObj = {
      id: Date.now(),
      message: messageText,
      is_ai: false,
      user_name: 'You',
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessageObj]);
    return userMessageObj;
  }, []);

  /**
   * Update a message by ID
   */
  const updateMessage = useCallback((messageId, updateFn) => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? updateFn(msg) : msg
    ));
  }, []);

  /**
   * Add a processing message (for file uploads)
   */
  const addProcessingMessage = useCallback((filename) => {
    const processingMessage = {
      id: Date.now(),
      message: `Processing "${filename}"`,
      is_ai: true,
      created_at: new Date().toISOString(),
      isProcessing: true
    };

    setMessages(prev => [...prev, processingMessage]);
    return processingMessage;
  }, []);

  /**
   * Remove a message by ID
   */
  const removeMessage = useCallback((messageId) => {
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  }, []);

  /**
   * Add a summary message
   */
  const addSummaryMessage = useCallback((filename, summary) => {
    const summaryMessage = {
      id: Date.now() + 1,
      message: `📋 **Summary of "${filename}"**\n\n${summary}`,
      is_ai: true,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, summaryMessage]);
  }, []);

  return {
    messages,
    setMessages,
    inputMessage,
    setInputMessage,
    isSending,
    setIsSending,
    persistAIState,
    getPersistedAIState,
    processMessages,
    addUserMessage,
    updateMessage,
    addProcessingMessage,
    removeMessage,
    addSummaryMessage
  };
}
