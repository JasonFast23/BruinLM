const express = require('express');
const pool = require('../../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../../middleware/auth');
const { 
  processDocument, 
  generateAIResponse, 
  generateIsolatedDocumentSummary,
  extractTextFromFile 
} = require('../../aiService');

const router = express.Router();

// Set up multer for file uploads
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Get files for a class
router.get('/class/:classId', authenticate, async (req, res) => {
  const { classId } = req.params;
  try {
    const result = await pool.query(
      `SELECT d.*, u.name as uploader_name 
       FROM documents d
       JOIN users u ON d.uploaded_by = u.id
       WHERE d.class_id = $1
       ORDER BY d.uploaded_at DESC`,
      [classId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch files:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get indexing status summary for a class
router.get('/class/:classId/status', authenticate, async (req, res) => {
  const { classId } = req.params;
  try {
    const agg = await pool.query(
      `SELECT 
         COUNT(*) FILTER (WHERE processing_status = 'pending') as pending,
         COUNT(*) FILTER (WHERE processing_status = 'processing') as processing,
         COUNT(*) FILTER (WHERE processing_status = 'extracted') as extracted,
         COUNT(*) FILTER (WHERE processing_status = 'processed') as processed,
         COUNT(*) FILTER (WHERE processing_status = 'failed') as failed
       FROM documents
       WHERE class_id = $1`,
      [classId]
    );
    res.json(agg.rows[0]);
  } catch (err) {
    console.error('Failed to fetch indexing status:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Upload a file
router.post('/upload/:classId', authenticate, upload.single('file'), async (req, res) => {
  const { classId } = req.params;
  
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    // 🚀 INSTANT PROCESSING - NotebookLM Style!
    // Extract text content immediately during upload (synchronous)
    console.log(`📄 Instantly processing: ${req.file.originalname}`);
    
    let extractedText = '';
    try {
      console.log(`🔍 Attempting to extract text from: ${req.file.path}`);
      extractedText = await extractTextFromFile(req.file.path);
      console.log(`✅ Text extracted instantly: ${extractedText.length} characters`);
      
      if (extractedText.length > 100) {
        console.log(`📝 Preview: ${extractedText.substring(0, 200)}...`);
      }
    } catch (err) {
      console.error('❌ Text extraction failed:', err);
      console.error('File details:', {
        path: req.file.path,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });
      extractedText = ''; // Fallback to empty but don't fail the upload
    }

    // Clean the text for database storage
    if (extractedText) {
      extractedText = extractedText.replace(/\0/g, '').replace(/\u0000/g, '');
    }

    // Insert document with content immediately available (using basic columns for compatibility)
    console.log(`💾 Inserting document into database...`);
    const result = await pool.query(
      'INSERT INTO documents (class_id, filename, filepath, uploaded_by, content) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [classId, req.file.originalname, req.file.path, req.user.id, extractedText]
    );
    
    const document = result.rows[0];
    console.log(`🎉 Document ${document.id} instantly available for queries!`);

    // Generate immediate AI summary (ISOLATED - no classroom context contamination)
    let summary = '';
    try {
      if (extractedText && extractedText.length > 100) {
        console.log(`🤖 Generating ISOLATED summary for ${document.filename}...`);
        console.log(`📄 Text length: ${extractedText.length} characters`);
        console.log(`📄 Text preview: ${extractedText.substring(0, 200)}...`);
        
        // 🔒 FIXED: Use isolated summary generation to prevent context contamination
        // This ensures identical summaries regardless of other documents in the classroom
        summary = await generateIsolatedDocumentSummary(extractedText, document.filename);
        
        if (summary && summary.length > 0) {
          console.log(`📝 Generated isolated summary for ${document.filename}: ${summary.substring(0, 100)}...`);
          
          // Save summary to document_summaries table
          try {
            await pool.query(
              `INSERT INTO document_summaries (document_id, summary) 
               VALUES ($1, $2)`,
              [document.id, summary]
            );
            console.log(`💾 Summary saved to database for document ${document.id}`);
          } catch (summaryErr) {
            console.error('❌ Error saving summary to database:', summaryErr);
          }
        } else {
          console.log(`❌ Isolated summary generation failed`);
        }
      } else {
        console.log(`⚠️ Insufficient text for summary generation. Length: ${extractedText?.length || 0}`);
      }
    } catch (e) {
      console.error('❌ Error generating isolated summary:', e);
      console.error('Error details:', e.message, e.stack);
    }

    // Background optimization: Generate embeddings and summaries (non-blocking)
    setImmediate(() => {
      processDocument(document.id).catch(err => {
        console.log(`Background optimization for ${document.filename} failed:`, err.message);
      });
    });

    res.json({ ...document, indexed: false, summary });
  } catch (err) {
    console.error('❌ File upload failed:', err);
    console.error('Error details:', {
      message: err.message,
      code: err.code,
      detail: err.detail
    });
    res.status(500).json({ 
      error: 'File upload failed', 
      details: err.message,
      code: err.code 
    });
  }
});

// Delete a file
router.delete('/:fileId', authenticate, async (req, res) => {
  const { fileId } = req.params;
  const userId = req.user.id;
  
  try {
    // Get file info with class owner info
    const fileResult = await pool.query(
      `SELECT d.*, c.owner_id as class_owner_id
       FROM documents d
       JOIN classes c ON d.class_id = c.id
       WHERE d.id = $1`,
      [fileId]
    );
    
    if (fileResult.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = fileResult.rows[0];

    // Check if user is the uploader or class owner
    const isDocumentOwner = file.uploaded_by === userId;
    const isClassOwner = file.class_owner_id === userId;
    
    if (!isDocumentOwner && !isClassOwner) {
      return res.status(403).json({ error: 'Only the document owner or class owner can delete this file' });
    }
    
    // Delete file from filesystem
    if (fs.existsSync(file.filepath)) {
      fs.unlinkSync(file.filepath);
    }

    // Delete from database
    await pool.query('DELETE FROM documents WHERE id = $1', [fileId]);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete file:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;