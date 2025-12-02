const express = require('express');
const pool = require('../../db');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();

// Search endpoint - GET /api/search?q=query
router.get('/', authenticate, async (req, res) => {
  const { q } = req.query;
  
  // If query is missing or empty, return empty results
  if (!q || q.trim().length === 0) {
    return res.json({ classes: [], documents: [] });
  }
  
  try {
    const searchPattern = `%${q.trim()}%`;
    const userId = req.user.id;
    
    // Find matching classes that the user is a member of
    const classesResult = await pool.query(
      `SELECT c.id, c.code, c.name, c.description
       FROM classes c
       INNER JOIN class_members cm ON c.id = cm.class_id
       WHERE cm.user_id = $1
         AND (c.name ILIKE $2 OR c.code ILIKE $2)
       ORDER BY c.code ASC`,
      [userId, searchPattern]
    );
    
    // Find matching documents in the user's classes
    const documentsResult = await pool.query(
      `SELECT d.id, d.filename, d.class_id, c.code as class_code, c.name as class_name
       FROM documents d
       INNER JOIN class_members cm ON d.class_id = cm.class_id
       INNER JOIN classes c ON d.class_id = c.id
       WHERE cm.user_id = $1
         AND d.filename ILIKE $2
       ORDER BY d.filename ASC`,
      [userId, searchPattern]
    );
    
    res.json({
      classes: classesResult.rows,
      documents: documentsResult.rows
    });
  } catch (err) {
    console.error('Error performing search:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

