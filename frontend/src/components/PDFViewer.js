/**
 * PDFViewer component
 * Modal for viewing PDF and document files
 */

import React, { useEffect } from 'react';
import { FileText } from 'lucide-react';

/**
 * PDFViewer component
 *
 * @param {Object} file - File object to view
 * @param {Function} onClose - Close handler
 * @returns {JSX.Element|null} PDFViewer component or null if no file
 */
function PDFViewer({ file, onClose }) {
  // Handle Escape key to close viewer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && file) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [file, onClose]);

  if (!file) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9999,
        animation: 'fadeIn 0.2s ease-in-out'
      }}
      onClick={onClose}
    >
      {/* Header */}
      <div
        style={{
          padding: '1rem 2rem',
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <FileText size={20} color="#3b82f6" />
          <div>
            <h3 style={{ color: 'white', margin: 0, fontSize: '1rem', fontWeight: '600' }}>
              {file.filename}
            </h3>
            <p style={{ color: 'rgba(255, 255, 255, 0.6)', margin: 0, fontSize: '0.75rem' }}>
              Uploaded by {file.uploader_name}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            color: 'white',
            padding: '0.5rem',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '1.25rem',
            fontWeight: '300',
            width: '2.5rem',
            height: '2.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          }}
        >
          ×
        </button>
      </div>

      {/* Document Viewer */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '2rem',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <iframe
          src={`http://localhost:5001/api/files/${file.id}/view?token=${localStorage.getItem('token')}#toolbar=0`}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            borderRadius: '8px',
            backgroundColor: 'white',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
          }}
          title={file.filename}
        />
      </div>
    </div>
  );
}

export default PDFViewer;
