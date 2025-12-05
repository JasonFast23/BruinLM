/**
 * ClassRoom page component
 * Main classroom interface with chat, file management, and PDF viewing
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getClassDetails,
  getClassFiles,
  uploadFile,
  deleteFile,
  getChatHistory
} from '../services/api';
import { ArrowLeft, Loader } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';
import ChatMessages from '../components/ChatMessages';
import ChatInput from '../components/ChatInput';
import FileSidebar from '../components/FileSidebar';
import PDFViewer from '../components/PDFViewer';
import { useWebSocket } from '../hooks/useWebSocket';
import { useChatState } from '../hooks/useChatState';

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
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

/**
 * ClassRoom component - Main classroom interface
 */
function ClassRoom() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { colors } = useTheme();

  // State management
  const [classInfo, setClassInfo] = useState(null);
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [viewingFile, setViewingFile] = useState(null);

  // Chat state from custom hook
  const {
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
  } = useChatState(classId);

  // WebSocket handlers - wrapped in useCallback to prevent unnecessary reconnections
  const handleWSMessage = useCallback((data) => {
    if (data.is_ai) {
      setMessages(prev => [...prev, data]);
    }
  }, [setMessages]);

  const handleAIStart = useCallback((data) => {
    const newMessage = {
      id: data.id,
      message: '',
      is_ai: true,
      user_name: data.user_name,
      created_at: data.created_at,
      streaming: true
    };
    setMessages(prev => [...prev, newMessage]);
  }, [setMessages]);

  const handleAIChunk = useCallback((messageId, char) => {
    updateMessage(messageId, (msg) => ({
      ...msg,
      message: msg.message + char
    }));
  }, [updateMessage]);

  const handleAIComplete = useCallback((data) => {
    updateMessage(data.id, (msg) => ({
      ...msg,
      streaming: false,
      message: data.fallback ? data.content : msg.message
    }));
  }, [updateMessage]);

  const handleGenerationStopped = useCallback(() => {
    setMessages(prev => prev.map(msg => {
      if (msg.streaming) {
        return {
          ...msg,
          streaming: false,
          status: 'cancelled'
        };
      }
      return msg;
    }));
  }, [setMessages]);

  // WebSocket hook
  const {
    socket,
    isAIResponding,
    setIsAIResponding,
    sendMessage,
    stopGeneration
  } = useWebSocket(
    classId,
    handleWSMessage,
    handleAIStart,
    handleAIChunk,
    handleAIComplete,
    handleGenerationStopped,
    persistAIState
  );

  /**
   * Load class information, files, and chat history
   */
  const loadClassData = useCallback(async () => {
    try {
      const [classRes, filesRes, historyRes] = await Promise.all([
        getClassDetails(classId),
        getClassFiles(classId),
        getChatHistory(classId)
      ]);

      setClassInfo(classRes.data);
      setFiles(filesRes.data || []);

      const chatHistory = historyRes.data || [];
      const hasActiveGenerating = processMessages(chatHistory);

      if (hasActiveGenerating) {
        console.log('🔄 Found active generating messages on load, setting AI responding state');
        setIsAIResponding(true);
      } else {
        console.log('🧹 No active generating messages, clearing AI responding state');
        setIsAIResponding(false);
        persistAIState(false);
      }
    } catch (error) {
      console.error('Error loading class data:', error);
      setFiles([]);
      setMessages([]);
    }
  }, [classId, processMessages, setIsAIResponding, persistAIState, setMessages]);

  // Load class data on mount
  useEffect(() => {
    loadClassData();
    // Check persisted AI state
    const persistedState = getPersistedAIState();
    if (persistedState) {
      console.log('🔄 Found persisted AI state, will verify with actual messages');
    }
  }, [classId, getPersistedAIState, loadClassData]);

  /**
   * Handle file upload
   */
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Show processing message
      const processingMsg = addProcessingMessage(file.name);

      const response = await uploadFile(classId, formData);

      // Remove processing message
      removeMessage(processingMsg.id);

      // Add summary if available
      if (response.data && response.data.summary) {
        addSummaryMessage(file.name, response.data.summary);
      }

      // Reload files list
      try {
        const filesRes = await getClassFiles(classId);
        setFiles(filesRes.data || []);
      } catch (err) {
        console.error('Error reloading files:', err);
      }

      // Clear file input
      e.target.value = '';
    } catch (error) {
      alert(error.response?.data?.error || 'Error uploading file');
      setMessages(prev => prev.filter(msg => !msg.message.includes('Processing')));
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Handle file deletion
   */
  const handleDeleteFile = async (fileId) => {
    if (!window.confirm('Are you sure you want to delete this file?')) return;

    try {
      await deleteFile(fileId);
      loadClassData();
    } catch (error) {
      alert(error.response?.data?.error || 'Error deleting file');
    }
  };

  /**
   * Handle send message
   */
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isSending || !socket) return;

    const userMessage = inputMessage;
    setInputMessage('');
    setIsSending(true);
    setIsAIResponding(true);

    // Add user message immediately
    addUserMessage(userMessage);

    try {
      // Send through WebSocket
      console.log('🚨 FRONTEND: Sending WebSocket message:', userMessage);
      const success = sendMessage(userMessage);

      if (!success) {
        throw new Error('WebSocket not ready');
      }

      console.log('🚨 FRONTEND: Message sent successfully');
    } catch (error) {
      alert('Error sending message');
      setIsAIResponding(false);
      // Remove the message we just added since it failed
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsSending(false);
    }
  };

  /**
   * Handle stop generation
   */
  const handleStopGeneration = async () => {
    console.log('🛑 Stopping AI generation...');

    // Stop via WebSocket hook
    stopGeneration();

    // Update UI state
    setMessages(prev => prev.map(msg => {
      if (msg.streaming || msg.status === 'generating') {
        return {
          ...msg,
          streaming: false,
          status: 'cancelled'
        };
      }
      return msg;
    }));

    // Cancel generating messages on server (backup)
    const generatingMessages = messages.filter(msg => msg.streaming || msg.status === 'generating');
    for (const msg of generatingMessages) {
      if (msg.id) {
        try {
          await fetch(`/api/chat/cancel/${msg.id}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
        } catch (error) {
          console.warn('⚠️ Error cancelling message:', msg.id, error);
        }
      }
    }

    if (isSending) {
      setIsSending(false);
      setIsUploading(false);
    }

    console.log('🛑 AI generation stopped completely');
  };

  // Loading state
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
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: colors.text.primary }}>
              {classInfo.code}
            </h1>
            <p style={{ fontSize: '0.875rem', color: colors.text.secondary }}>
              {classInfo.name}
            </p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Files Sidebar */}
        <FileSidebar
          files={files}
          isUploading={isUploading}
          onFileUpload={handleFileUpload}
          onFileDelete={handleDeleteFile}
          onFileView={setViewingFile}
        />

        {/* Chat Interface */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', background: colors.primary }}>
          {/* Chat Messages */}
          <ChatMessages
            messages={messages}
            isAIResponding={isAIResponding}
            classInfo={classInfo}
          />

          {/* Input Area */}
          <ChatInput
            inputMessage={inputMessage}
            setInputMessage={setInputMessage}
            isSending={isSending}
            isAIResponding={isAIResponding}
            onSubmit={handleSendMessage}
            onStop={handleStopGeneration}
          />
        </main>
      </div>

      {/* PDF Viewer Modal */}
      <PDFViewer
        file={viewingFile}
        onClose={() => setViewingFile(null)}
      />
    </div>
  );
}

export default ClassRoom;
