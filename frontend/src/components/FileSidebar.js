/**
 * FileSidebar component
 * Displays file list with upload and delete functionality
 */

import React, { useRef } from 'react';
import { Upload, FileText, Trash2, Loader } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

/**
 * FileSidebar component
 *
 * @param {Array} files - Array of file objects
 * @param {boolean} isUploading - Whether a file is currently uploading
 * @param {Function} onFileUpload - File upload handler
 * @param {Function} onFileDelete - File delete handler
 * @param {Function} onFileView - File view handler
 * @returns {JSX.Element} FileSidebar component
 */
function FileSidebar({
  files,
  isUploading,
  onFileUpload,
  onFileDelete,
  onFileView
}) {
  const { colors } = useTheme();
  const fileInputRef = useRef(null);

  return (
    <aside style={{
      width: '300px',
      background: colors.sidebar.background,
      borderRight: `1px solid ${colors.border.primary}`,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header with upload button */}
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
          onChange={onFileUpload}
          accept=".pdf,.doc,.docx,.txt"
          style={{ display: 'none' }}
        />
      </div>

      {/* File list */}
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
              onClick={() => onFileView(file)}
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
                onClick={(e) => {
                  e.stopPropagation();
                  onFileDelete(file.id);
                }}
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
  );
}

export default FileSidebar;
