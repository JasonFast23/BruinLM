/**
 * ChatMessages component
 * Displays chat messages with streaming animation and scroll management
 */

import React, { useRef, useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { renderMarkdown } from '../utils/markdownRenderer';

/**
 * ChatMessages component
 *
 * @param {Array} messages - Array of chat messages
 * @param {boolean} isAIResponding - Whether AI is currently responding
 * @param {Object} classInfo - Class information object
 * @returns {JSX.Element} ChatMessages component
 */
function ChatMessages({ messages, isAIResponding, classInfo }) {
  const { colors } = useTheme();
  const [showScrollButton, setShowScrollButton] = useState(false);
  const chatEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  /**
   * Scroll to the bottom of chat
   */
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  /**
   * Jump to the most recent message
   */
  const jumpToPresent = () => {
    scrollToBottom();
    setShowScrollButton(false);
  };

  // Auto-scroll when messages change (only if near bottom)
  useEffect(() => {
    const hasStreamingMessage = messages.some(msg => msg.streaming);

    if (!hasStreamingMessage) {
      const chatContainer = chatContainerRef.current;
      if (chatContainer) {
        const { scrollTop, scrollHeight, clientHeight } = chatContainer;
        const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;
        if (isNearBottom) {
          scrollToBottom();
        }
      } else {
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
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 50;
      setShowScrollButton(!isNearBottom);
    };

    handleScroll();
    chatContainer.addEventListener('scroll', handleScroll);
    return () => chatContainer.removeEventListener('scroll', handleScroll);
  }, [messages]);

  return (
    <div
      ref={chatContainerRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '1rem 1.5rem 0 1.5rem',
        background: colors.primary,
        position: 'relative'
      }}
    >
      {messages.length === 0 ? (
        <div style={{
          textAlign: 'center',
          color: colors.text.secondary,
          marginTop: '3rem'
        }}>
          <p style={{ fontSize: '1.125rem', fontWeight: '500', marginBottom: '0.5rem', color: colors.text.primary }}>
            AI Assistant for {classInfo?.code}
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
                {/* Avatar */}
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
                      // OpenAI-style logo
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
                      color: msg.status === 'cancelled' ? colors.text.secondary : colors.text.primary,
                      fontSize: '1rem',
                      lineHeight: '1.5',
                      wordWrap: 'break-word',
                      whiteSpace: 'pre-wrap',
                      opacity: msg.status === 'cancelled' ? 0.7 : 1
                    }}
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdown(msg.message) +
                        (msg.streaming ? '<span style="animation: blink 1s infinite;">|</span>' : '') +
                        (msg.status === 'cancelled' ? '<div style="font-size: 0.75rem; color: #666; margin-top: 0.5rem; font-style: italic;">Response was cancelled</div>' : '')
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* AI Loading Indicator */}
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

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <div style={{
          position: 'fixed',
          bottom: '140px',
          left: 'calc(50% + 150px)',
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
  );
}

export default ChatMessages;
