/**
 * ChatInput component
 * Handles chat input with auto-resize, send/stop functionality
 */

import React, { useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';

/**
 * ChatInput component
 *
 * @param {string} inputMessage - Current input message value
 * @param {Function} setInputMessage - Function to update input message
 * @param {boolean} isSending - Whether message is being sent
 * @param {boolean} isAIResponding - Whether AI is currently responding
 * @param {Function} onSubmit - Submit handler
 * @param {Function} onStop - Stop generation handler
 * @returns {JSX.Element} ChatInput component
 */
function ChatInput({
  inputMessage,
  setInputMessage,
  isSending,
  isAIResponding,
  onSubmit,
  onStop
}) {
  const { colors, isDarkMode } = useTheme();
  const textareaRef = useRef(null);

  /**
   * Auto-resize textarea based on content
   */
  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 200; // Max height before scrolling
      textareaRef.current.style.height = Math.min(scrollHeight, maxHeight) + 'px';
    }
  };

  // Adjust height when input changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [inputMessage]);

  /**
   * Handle form submission
   */
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isSending) return;
    onSubmit(e);
  };

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputMessage.trim() && !isSending) {
        handleSubmit(e);
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
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
          alignItems: 'flex-end',
          paddingRight: '8px',
          paddingBottom: '6px',
          boxShadow: isDarkMode
            ? '0 1px 3px rgba(0, 0, 0, 0.3)'
            : '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <textarea
            ref={textareaRef}
            value={inputMessage}
            onChange={(e) => {
              setInputMessage(e.target.value);
              adjustTextareaHeight();
            }}
            placeholder="Ask me anything about your course materials..."
            disabled={isSending}
            rows={1}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: colors.text.primary,
              fontSize: '16px',
              fontFamily: 'inherit',
              lineHeight: '1.5',
              resize: 'none',
              minHeight: '44px',
              maxHeight: '200px',
              overflowY: 'auto'
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
            onKeyDown={handleKeyDown}
          />
          <button
            type={isAIResponding || isSending ? "button" : "submit"}
            onClick={isAIResponding || isSending ? onStop : undefined}
            disabled={!inputMessage.trim() && !isAIResponding && !isSending}
            style={{
              width: '32px',
              height: '32px',
              background: (isAIResponding || isSending) ? '#ef4444' :
                         (!inputMessage.trim() ? '#d1d5db' : '#2563eb'),
              color: 'white',
              border: 'none',
              borderRadius: (isAIResponding || isSending) ? '6px' : '50%',
              cursor: (!inputMessage.trim() && !isAIResponding && !isSending) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              flexShrink: 0,
              marginLeft: '8px',
              marginBottom: '6px'
            }}
            onMouseEnter={(e) => {
              if (!isSending && !isAIResponding && inputMessage.trim()) {
                e.currentTarget.style.background = '#1d4ed8';
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(37, 99, 235, 0.4)';
              } else if (isAIResponding || isSending) {
                e.currentTarget.style.background = '#dc2626';
                e.currentTarget.style.transform = 'scale(1.05)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSending && !isAIResponding && inputMessage.trim()) {
                e.currentTarget.style.background = '#2563eb';
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'none';
              } else if (isAIResponding || isSending) {
                e.currentTarget.style.background = '#ef4444';
                e.currentTarget.style.transform = 'scale(1)';
              }
            }}
          >
            {(isSending || isAIResponding) ? (
              // Square stop button
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <rect x="6" y="6" width="12" height="12" />
              </svg>
            ) : (
              // Send arrow
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
  );
}

export default ChatInput;
