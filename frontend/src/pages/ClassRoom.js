import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  getClassDetails, 
  getClassFiles, 
  uploadFile, 
  deleteFile,
  getChatHistory 
} from '../services/api';
import { ArrowLeft, Upload, FileText, Trash2, Loader } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';

// Add CSS for animations
if (!document.getElementById('streaming-animations-css')) {
  const style = document.createElement('style');
  style.id = 'streaming-animations-css';
  style.textContent = `
    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0; }
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.3; transform: scale(0.8); }
      50% { opacity: 1; transform: scale(1.2); }
    }
  `;
  document.head.appendChild(style);
}

// Helper function to render markdown safely
const renderMarkdown = (text) => {
  if (!text) return '';
  
  // Basic markdown rendering for bold, italic, and line breaks
  let html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // **bold**
    .replace(/\*(.*?)\*/g, '<em>$1</em>') // *italic*
    .replace(/\n/g, '<br>'); // line breaks
  
  return html;
};

function ClassRoom() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { colors, isDarkMode } = useTheme();
  const [classInfo, setClassInfo] = useState(null);
  const [files, setFiles] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isAIResponding, setIsAIResponding] = useState(false);
  
  // Add a ref to track if we should be responding (for debugging)
  const shouldBeResponding = useRef(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const fileInputRef = useRef(null);
  
  // For managing letter-by-letter streaming
  const streamingQueues = useRef(new Map()); // messageId -> queue of characters
  const chatEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  
  // Persist AI responding state across page refreshes
  const persistAIState = useCallback((responding) => {
    const key = `ai_responding_${classId}`;
    if (responding) {
      localStorage.setItem(key, 'true');
    } else {
      localStorage.removeItem(key);
    }
  }, [classId]);
  
  const getPersistedAIState = useCallback(() => {
    const key = `ai_responding_${classId}`;
    return localStorage.getItem(key) === 'true';
  }, [classId]);

  useEffect(() => {
    loadClassData();
    
    // Restore AI responding state from localStorage
    const persistedState = getPersistedAIState();
    if (persistedState) {
      console.log('🔄 Restoring AI responding state from localStorage');
      setIsAIResponding(true);
    }
  }, [classId, getPersistedAIState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check for streaming messages when messages change and restore AI responding state
  useEffect(() => {
    const hasStreamingMessages = messages.some(msg => msg.streaming === true);
    if (hasStreamingMessages && !isAIResponding) {
      console.log('🔄 Restoring AI responding state - found streaming messages');
      setIsAIResponding(true);
    }
    // Don't automatically reset isAIResponding here - let the WebSocket handlers control it
    // This prevents premature clearing of the stop button
  }, [messages, isAIResponding]);

  // Persist AI responding state changes
  useEffect(() => {
    persistAIState(isAIResponding);
  }, [isAIResponding, classId, persistAIState]);

  // Add periodic check to ensure stop button stays visible during streaming
  useEffect(() => {
    const interval = setInterval(() => {
      const hasStreamingMessages = messages.some(msg => msg.streaming === true);
      const hasActiveQueues = streamingQueues.current.size > 0;
      const hasQueuedCharacters = Array.from(streamingQueues.current.values())
        .some(queue => queue.queue && queue.queue.length > 0);
      const hasProcessingQueues = Array.from(streamingQueues.current.values())
        .some(queue => queue.isProcessing === true);
      
      const shouldShowButton = hasStreamingMessages || hasActiveQueues || hasQueuedCharacters || 
                              hasProcessingQueues || shouldBeResponding.current;
      
      if (shouldShowButton && !isAIResponding) {
        console.log('🛑 STOP BUTTON: Restoring AI responding state (periodic check)', {
          hasStreamingMessages,
          hasActiveQueues,
          hasQueuedCharacters,
          hasProcessingQueues,
          shouldBeResponding: shouldBeResponding.current
        });
        setIsAIResponding(true);
      }
    }, 200); // Check every 200ms for more responsiveness

    return () => clearInterval(interval);
  }, [messages, isAIResponding]);

  useEffect(() => {
    // Only auto-scroll if user is already near the bottom and not during active streaming
    const hasStreamingMessage = messages.some(msg => msg.streaming);
    
    if (!hasStreamingMessage) {
      // Only auto-scroll when streaming is complete
      const chatContainer = chatContainerRef.current;
      if (chatContainer) {
        const { scrollTop, scrollHeight, clientHeight } = chatContainer;
        const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;
        if (isNearBottom) {
          scrollToBottom();
        }
      } else {
        // If no container yet, scroll to bottom (initial load)
        scrollToBottom();
      }
    }
  }, [messages]);

  // Handle scroll detection for "jump to present" button
  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    if (!chatContainer) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = chatContainer;
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 50; // Reduced threshold to 50px
      console.log('Scroll debug:', { scrollTop, scrollHeight, clientHeight, isNearBottom });
      setShowScrollButton(!isNearBottom);
    };

    // Initial check
    handleScroll();

    chatContainer.addEventListener('scroll', handleScroll);
    return () => chatContainer.removeEventListener('scroll', handleScroll);
  }, [messages]); // Added messages dependency to recheck when messages change

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const jumpToPresent = () => {
    scrollToBottom();
    setShowScrollButton(false);
  };

  const loadClassData = async () => {
    try {
      const [classRes, filesRes, historyRes] = await Promise.all([
        getClassDetails(classId),
        getClassFiles(classId),
        getChatHistory(classId)
      ]);
      setClassInfo(classRes.data);
      setFiles(filesRes.data || []);
      
      const chatHistory = historyRes.data || [];
      
      // Check for any messages that are still in "generating" status
      const processedMessages = chatHistory.map(msg => {
        if (msg.status === 'generating' && msg.is_ai) {
          console.log('🔄 Found generating message on load:', msg.id);
          return { ...msg, streaming: true };
        }
        return msg;
      });
      
      setMessages(processedMessages);
      
      // If we found any generating messages, set AI responding state
      const hasGeneratingMessages = processedMessages.some(msg => msg.streaming === true);
      if (hasGeneratingMessages) {
        console.log('🔄 Found generating messages on load, setting AI responding state');
        setIsAIResponding(true);
      }
    } catch (err) {
      console.error('Error loading class data:', err);
      setFiles([]);
      setMessages([]);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      // Show processing message with minimalist design
      const processingMessage = {
        id: Date.now(),
        message: `Processing "${file.name}"`,
        is_ai: true,
        created_at: new Date().toISOString(),
        isProcessing: true // Special flag for processing messages
      };
      setMessages(prev => [...prev, processingMessage]);
      
      const response = await uploadFile(classId, formData);
      
      // Debug logging to see what we get back
      console.log('Upload response:', response);
      console.log('Response data:', response.data);
      console.log('Summary in response:', response.data?.summary);
      
      // Remove processing message and add summary if available
      setMessages(prev => prev.filter(msg => msg.id !== processingMessage.id));
      
      if (response.data && response.data.summary) {
        const summaryMessage = {
          id: Date.now() + 1,
          message: `📋 **Summary of "${file.name}"**\n\n${response.data.summary}`,
          is_ai: true,
          created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, summaryMessage]);
      } else {
        console.log('No summary found in response');
      }
      
      // Only reload files list, not the chat history (to preserve the summary message)
      try {
        const filesRes = await getClassFiles(classId);
        setFiles(filesRes.data || []);
      } catch (err) {
        console.error('Error reloading files:', err);
      }
      
      fileInputRef.current.value = '';
    } catch (err) {
      alert(err.response?.data?.error || 'Error uploading file');
      // Remove processing message on error
      setMessages(prev => prev.filter(msg => !msg.message.includes('Processing')));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFile = async (fileId) => {
    if (!window.confirm('Are you sure you want to delete this file?')) return;
    
    try {
      await deleteFile(fileId);
      loadClassData();
    } catch (err) {
      alert(err.response?.data?.error || 'Error deleting file');
    }
  };

  const [socket, setSocket] = useState(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const token = localStorage.getItem('token');
    const ws = new WebSocket('ws://localhost:5001');
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      // Authenticate
      ws.send(JSON.stringify({ type: 'auth', token }));
      // Join class room
      ws.send(JSON.stringify({ type: 'join_class', classId }));
    };
    
    ws.onmessage = (event) => {
      console.log('🚨 FRONTEND: WebSocket message received:', event.data);
      const data = JSON.parse(event.data);
      console.log('🚨 FRONTEND: Parsed data:', data);
      
      if (data.type === 'chat_message') {
        // Only add AI messages from WebSocket (user messages are added immediately)
        if (data.is_ai) {
          setMessages(prev => [...prev, data]);
          // Don't set isAIResponding to false here - let ai_message_complete handle it
        }
        // Ignore user messages from WebSocket since we add them immediately
      } else if (data.type === 'ai_message_start') {
        // Start of streaming AI message
        console.log('🌊 Frontend: AI message start received', data);
        shouldBeResponding.current = true;
        const newMessage = {
          id: data.id,
          message: '',
          is_ai: true,
          user_name: data.user_name,
          created_at: data.created_at,
          streaming: true
        };
        setMessages(prev => [...prev, newMessage]);
        setIsAIResponding(true);
        console.log('🛑 STOP BUTTON: Should be visible now (ai_message_start)');
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
            if (messageQueue.queue.length > 0) {
              const char = messageQueue.queue.shift();
              
              // Use requestAnimationFrame for smoother rendering that doesn't block scrolling
              requestAnimationFrame(() => {
                setMessages(prev => prev.map(msg => 
                  msg.id === messageId 
                    ? { ...msg, message: msg.message + char }
                    : msg
                ));
              });
              
              // Claude-like speed - 25ms per character (~40 chars/second)
              setTimeout(processQueue, 25);
            } else {
              messageQueue.isProcessing = false;
              
              // Check if all streaming is truly complete after this queue finishes
              const checkAllQueuesComplete = () => {
                const allQueuesIdle = Array.from(streamingQueues.current.values())
                  .every(queue => !queue.isProcessing && queue.queue.length === 0);
                
                if (allQueuesIdle && !shouldBeResponding.current) {
                  console.log('🛑 STOP BUTTON: All character queues complete, hiding button');
                  setIsAIResponding(false);
                }
              };
              
              // Small delay to ensure all queues are checked
              setTimeout(checkAllQueuesComplete, 100);
            }
          };
          
          processQueue();
        }
      } else if (data.type === 'ai_message_complete') {
        // Streaming complete from backend, but keep stop button until all characters are processed
        setMessages(prev => prev.map(msg => 
          msg.id === data.id 
            ? { 
                ...msg, 
                streaming: false,
                // Handle fallback case where full content is sent at once
                message: data.fallback ? data.content : msg.message
              }
            : msg
        ));
        
        // Don't immediately hide stop button - wait for all character processing to complete
        const checkIfFullyComplete = () => {
          const hasActiveQueues = streamingQueues.current.size > 0;
          const hasQueuedCharacters = Array.from(streamingQueues.current.values())
            .some(queue => queue.queue && queue.queue.length > 0);
          
          if (!hasActiveQueues && !hasQueuedCharacters) {
            // All processing truly complete
            shouldBeResponding.current = false;
            setIsAIResponding(false);
            console.log('🛑 STOP BUTTON: Hidden after all characters processed');
            
            // Clean up the streaming queue for this message
            if (streamingQueues.current.has(data.id)) {
              streamingQueues.current.delete(data.id);
            }
          } else {
            // Still processing characters, check again soon
            console.log('🛑 STOP BUTTON: Still processing characters, keeping button visible');
            setTimeout(checkIfFullyComplete, 100);
          }
        };
        
        // Give a small delay to ensure queues are set up, then check
        setTimeout(checkIfFullyComplete, 50);
      } else if (data.type === 'generation_stopped') {
        console.log('🛑 Generation stopped by user:', data.userId);
        
        // Force stop AI response state
        setIsAIResponding(false);
        
        // Clear all streaming queues
        streamingQueues.current.clear();
        
        // Remove any messages that are currently streaming
        setMessages(prev => prev.filter(msg => !msg.streaming));
      } else if (data.type === 'user_status') {
        // Handle user status updates if needed
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    setSocket(ws);
    
    return () => {
      if (ws) ws.close();
    };
  }, [classId]);

  const handleStopGeneration = () => {
    console.log('🛑 Stopping AI generation...');
    
    // Stop AI response streaming
    if (isAIResponding) {
      setIsAIResponding(false);
      
      // Clear any streaming queues
      streamingQueues.current.clear();
      
      // Remove any messages that are currently streaming
      setMessages(prev => prev.filter(msg => !msg.streaming));
      
      // TODO: Could also send a WebSocket message to stop server-side processing
      if (socket) {
        socket.send(JSON.stringify({
          type: 'stop_generation'
        }));
      }
    }
    
    // Stop file upload processing (if applicable)
    if (isSending) {
      setIsSending(false);
      setIsUploading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isSending || !socket) return;

    const userMessage = inputMessage;
    setInputMessage('');
    setIsSending(true);
    setIsAIResponding(true); // Set AI responding state

    // Immediately add user message to chat (like Discord/ChatGPT)
    const userMessageObj = {
      id: Date.now(), // Temporary ID
      message: userMessage,
      is_ai: false,
      user_name: 'You', // We'll get the real name from the auth context if needed
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessageObj]);

    try {
      // Send through WebSocket
      console.log('🚨 FRONTEND: Sending WebSocket message:', userMessage);
      socket.send(JSON.stringify({
        type: 'chat_message',
        message: userMessage
      }));
      console.log('🚨 FRONTEND: Message sent successfully');
    } catch (err) {
      alert('Error sending message');
      setIsAIResponding(false);
      // Remove the message we just added since it failed
      setMessages(prev => prev.filter(msg => msg.id !== userMessageObj.id));
    } finally {
      setIsSending(false);
    }
  };

  if (!classInfo) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <Loader className="animate-spin" size={32} color="#2563eb" />
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        background: colors.secondary,
        borderBottom: `1px solid ${colors.border.primary}`,
        padding: '1rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => navigate('/hub')}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0.5rem',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#2563eb',
              borderRadius: '8px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.interactive.hover;
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: colors.text.primary }}>{classInfo.code}</h1>
            <p style={{ fontSize: '0.875rem', color: colors.text.secondary }}>{classInfo.name}</p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Files Sidebar */}
        <aside style={{
          width: '300px',
          background: colors.sidebar.background,
          borderRight: `1px solid ${colors.border.primary}`,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ padding: '1.5rem', borderBottom: `1px solid ${colors.border.primary}` }}>
            <h2 style={{ 
              fontSize: '1.125rem', 
              fontWeight: '600', 
              marginBottom: '1rem',
              color: colors.text.primary
            }}>
              Course Materials
            </h2>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                width: '100%',
                padding: '0.75rem',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: isUploading ? 'not-allowed' : 'pointer',
                opacity: isUploading ? 0.5 : 1,
                fontWeight: '500',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!isUploading) {
                  e.currentTarget.style.background = '#1d4ed8';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isUploading) {
                  e.currentTarget.style.background = '#2563eb';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              {isUploading ? (
                <>
                  <Loader className="animate-spin" size={16} />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Upload File
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              accept=".pdf,.doc,.docx,.txt"
              style={{ display: 'none' }}
            />
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
            {files.length === 0 ? (
              <p style={{ 
                textAlign: 'center', 
                color: '#6b7280', 
                fontSize: '0.875rem'
              }}>
                No files uploaded yet
              </p>
            ) : (
              files.map(file => (
                <div
                  key={file.id}
                  style={{
                    padding: '0.75rem',
                    background: colors.secondary,
                    borderRadius: '8px',
                    marginBottom: '0.5rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: `1px solid ${colors.border.primary}`,
                    transition: 'all 0.2s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.tertiary;
                    e.currentTarget.style.borderColor = colors.border.secondary;
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = colors.secondary;
                    e.currentTarget.style.borderColor = colors.border.primary;
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                    <FileText size={16} color="#2563eb" />
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <p style={{ 
                        fontSize: '0.875rem', 
                        fontWeight: '500',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: colors.text.primary
                      }}>
                        {file.filename}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: colors.text.secondary }}>
                        by {file.uploader_name}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteFile(file.id)}
                    style={{
                      padding: '0.5rem',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#ef4444',
                      borderRadius: '6px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                      e.currentTarget.style.transform = 'scale(1.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Chat Interface */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', background: colors.primary }}>
          {/* Chat Messages */}
          <div 
            ref={chatContainerRef}
            style={{ 
              flex: 1, 
              overflowY: 'auto', 
              padding: '1rem 1.5rem 0 1.5rem',
              background: colors.primary,
              position: 'relative'
            }}>
            {messages.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                color: colors.text.secondary, 
                marginTop: '3rem' 
              }}>
                <p style={{ fontSize: '1.125rem', fontWeight: '500', marginBottom: '0.5rem', color: colors.text.primary }}>
                  AI Assistant for {classInfo.code}
                </p>
                <p style={{ fontSize: '0.875rem' }}>
                  Ask me anything - course questions, general knowledge, or academic help.
                </p>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isAI = msg.is_ai;
                const timestamp = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                return (
                  <div key={msg.id || idx} style={{ marginBottom: '1.5rem' }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'flex-start',
                      gap: '1rem',
                      padding: '0.75rem 0',
                      transition: 'all 0.2s ease'
                    }}>
                      {/* Avatar - Special handling for processing messages */}
                      {msg.isProcessing ? (
                        // Minimalist pulsing circle for processing messages
                        <div style={{
                          width: '32px',
                          height: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: colors.text.secondary,
                            animation: 'pulse 1.5s ease-in-out infinite'
                          }}></div>
                        </div>
                      ) : (
                        // Regular avatar for normal messages
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '4px',
                          background: isAI 
                            ? '#10a37f'  // OpenAI green
                            : 'linear-gradient(135deg, #2563eb, #3b82f6)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: '600',
                          fontSize: '0.75rem',
                          flexShrink: 0
                        }}>
                          {isAI ? (
                            // OpenAI-style logo (simplified)
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zm-2.4107-16.0259a4.4748 4.4748 0 0 1 2.3655-1.9728V9.0198a.7708.7708 0 0 0 .3927.6813l5.8428 3.3685-2.02 1.1686a.0804.0804 0 0 1-.071 0L2.33 11.4366a4.503 4.503 0 0 1-.8077-5.1169z"/>
                            </svg>
                          ) : (
                            msg.user_name ? msg.user_name.charAt(0).toUpperCase() : 'U'
                          )}
                        </div>
                      )}
                      
                      {/* Message Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.75rem',
                          marginBottom: '0.5rem'
                        }}>
                          {!isAI && (
                            <>
                              <span style={{ 
                                fontWeight: '600', 
                                color: colors.text.primary,
                                fontSize: '1rem'
                              }}>
                                {msg.user_name || 'You'}
                              </span>
                              <span style={{ 
                                fontSize: '0.75rem', 
                                color: colors.text.secondary
                              }}>
                                {timestamp}
                              </span>
                            </>
                          )}
                        </div>
                        <div 
                          style={{
                            color: colors.text.primary,
                            fontSize: '1rem',
                            lineHeight: '1.5',
                            wordWrap: 'break-word',
                            whiteSpace: 'pre-wrap'
                          }}
                          dangerouslySetInnerHTML={{
                            __html: renderMarkdown(msg.message) + 
                              (msg.streaming ? '<span style="animation: blink 1s infinite;">|</span>' : '')
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            
            {/* AI Loading Indicator - Minimalist pulsing circle */}
            {isAIResponding && (
              <div style={{ 
                display: 'flex',
                justifyContent: 'flex-start',
                marginBottom: '1.5rem',
                paddingLeft: '1rem'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: colors.text.secondary,
                  animation: 'pulse 1.5s ease-in-out infinite'
                }}></div>
              </div>
            )}
            
            <div ref={chatEndRef} />

            {/* Scroll to bottom button - positioned to follow viewport */}
            {showScrollButton && (
              <div style={{
                position: 'fixed',
                bottom: '140px', // Above the input area
                left: 'calc(50% + 150px)', // Center of remaining space after 300px sidebar
                transform: 'translateX(-50%)',
                zIndex: 100
              }}>
                <button
                  onClick={jumpToPresent}
                  style={{
                    width: '40px',
                    height: '40px',
                    background: '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                    transition: 'all 0.2s ease',
                    animation: 'slideUp 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#1d4ed8';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#2563eb';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.3)';
                  }}
                >
                  {/* Down arrow - same style as send button but flipped */}
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.5"
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M12 5v14M19 12l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Input Area */}
          <form 
            onSubmit={handleSendMessage}
            style={{
              padding: '1.5rem',
              background: colors.primary
            }}
          >
            <div style={{ 
              maxWidth: '800px',
              margin: '0 auto'
            }}>
              <div style={{
                background: colors.secondary,
                borderRadius: '24px',
                border: `1px solid ${colors.border.primary}`,
                position: 'relative',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                paddingRight: '8px',
                boxShadow: isDarkMode 
                  ? '0 1px 3px rgba(0, 0, 0, 0.3)' 
                  : '0 1px 3px rgba(0, 0, 0, 0.1)'
              }}>
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Ask me anything about your course materials..."
                  disabled={isSending}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    paddingRight: '52px',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: colors.text.primary,
                    fontSize: '16px',
                    fontFamily: 'inherit',
                    lineHeight: '1.5'
                  }}
                  onFocus={(e) => {
                    e.target.parentElement.style.borderColor = '#2563eb';
                    e.target.parentElement.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.parentElement.style.borderColor = colors.border.primary;
                    e.target.parentElement.style.boxShadow = isDarkMode 
                      ? '0 1px 3px rgba(0, 0, 0, 0.3)' 
                      : '0 1px 3px rgba(0, 0, 0, 0.1)';
                  }}
                />
                <button
                  type={isAIResponding || isSending ? "button" : "submit"}
                  onClick={isAIResponding || isSending ? handleStopGeneration : undefined}
                  disabled={!inputMessage.trim() && !isAIResponding && !isSending}
                  style={{
                    width: '32px',
                    height: '32px',
                    background: (isAIResponding || isSending) ? '#ef4444' : 
                               (!inputMessage.trim() ? '#d1d5db' : '#2563eb'),
                    color: 'white',
                    border: 'none',
                    borderRadius: (isAIResponding || isSending) ? '6px' : '50%', // Square when stopping
                    cursor: (!inputMessage.trim() && !isAIResponding && !isSending) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    flexShrink: 0,
                    position: 'absolute',
                    right: '8px'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSending && !isAIResponding && inputMessage.trim()) {
                      e.currentTarget.style.background = '#1d4ed8';
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(37, 99, 235, 0.4)';
                    } else if (isAIResponding || isSending) {
                      // Add subtle hover effect for stop button
                      e.currentTarget.style.background = '#dc2626'; // Darker red
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSending && !isAIResponding && inputMessage.trim()) {
                      e.currentTarget.style.background = '#2563eb';
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                    } else if (isAIResponding || isSending) {
                      // Reset stop button to normal red
                      e.currentTarget.style.background = '#ef4444';
                      e.currentTarget.style.transform = 'scale(1)';
                    }
                  }}
                >
                  {(isSending || isAIResponding) ? (
                    // Square stop button like ChatGPT
                    <svg 
                      width="14" 
                      height="14" 
                      viewBox="0 0 24 24" 
                      fill="currentColor"
                    >
                      <rect x="6" y="6" width="12" height="12" />
                    </svg>
                  ) : (
                    <svg 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2.5"
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <path d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}

export default ClassRoom;