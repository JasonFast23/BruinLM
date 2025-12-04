const express = require('express');
const pool = require('../../db');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();

// Search endpoint - GET /api/search?q=query
router.get('/', authenticate, async (req, res) => {
  const { q } = req.query;
  
  // If query is missing or empty, return empty results
  if (!q || q.trim().length === 0) {
    return res.json({ classes: [], documents: [], documentContent: [], chatMessages: [] });
  }
  
  try {
    const searchQuery = q.trim();
    const searchPattern = `%${searchQuery}%`;
    const userId = req.user.id;
    
    // Find matching classes - include ALL classes (both member and non-member)
    // This allows users to discover classes they can join
    const classesResult = await pool.query(
      `SELECT c.id, c.code, c.name, c.description,
              EXISTS(SELECT 1 FROM class_members cm WHERE cm.class_id = c.id AND cm.user_id = $1) as is_member
       FROM classes c
       WHERE c.name ILIKE $2 OR c.code ILIKE $2 OR c.description ILIKE $2
       ORDER BY is_member DESC, c.code ASC
       LIMIT 20`,
      [userId, searchPattern]
    );
    
    // Find matching documents by filename in the user's classes
    const documentsResult = await pool.query(
      `SELECT DISTINCT d.id, d.filename, d.class_id, c.code as class_code, c.name as class_name,
              d.uploaded_at, u.name as uploader_name
       FROM documents d
       INNER JOIN class_members cm ON d.class_id = cm.class_id
       INNER JOIN classes c ON d.class_id = c.id
       LEFT JOIN users u ON d.uploaded_by = u.id
       WHERE cm.user_id = $1
         AND d.filename ILIKE $2
       ORDER BY d.uploaded_at DESC
       LIMIT 20`,
      [userId, searchPattern]
    );
    
    // Find matching document content (search within PDF/document text)
    const documentContentResult = await pool.query(
      `SELECT DISTINCT d.id, d.filename, d.class_id, c.code as class_code, c.name as class_name,
              d.uploaded_at, u.name as uploader_name,
              SUBSTRING(d.content FROM GREATEST(1, POSITION(LOWER($3) IN LOWER(d.content)) - 50) FOR 200) as content_preview
       FROM documents d
       INNER JOIN class_members cm ON d.class_id = cm.class_id
       INNER JOIN classes c ON d.class_id = c.id
       LEFT JOIN users u ON d.uploaded_by = u.id
       WHERE cm.user_id = $1
         AND d.content ILIKE $2
         AND d.content IS NOT NULL
         AND LENGTH(d.content) > 0
       ORDER BY d.uploaded_at DESC
       LIMIT 15`,
      [userId, searchPattern, searchQuery]
    );
    
    // Find matching chat messages in user's private chat rooms
    const chatMessagesResult = await pool.query(
      `SELECT DISTINCT cm.id, cm.message, cm.class_id, cm.is_ai, cm.created_at,
              c.code as class_code, c.name as class_name,
              u.name as user_name,
              SUBSTRING(cm.message FROM GREATEST(1, POSITION(LOWER($3) IN LOWER(cm.message)) - 30) FOR 150) as message_preview
       FROM chat_messages cm
       INNER JOIN classes c ON cm.class_id = c.id
       LEFT JOIN users u ON cm.user_id = u.id
       WHERE cm.chat_owner_id = $1
         AND cm.message ILIKE $2
         AND cm.status = 'active'
       ORDER BY cm.created_at DESC
       LIMIT 20`,
      [userId, searchPattern, searchQuery]
    );
    
    res.json({
      classes: classesResult.rows,
      documents: documentsResult.rows,
      documentContent: documentContentResult.rows,
      chatMessages: chatMessagesResult.rows
    });
  } catch (err) {
    console.error('Error performing search:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

