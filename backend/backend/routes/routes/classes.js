const express = require('express');
const pool = require('../../db');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();

// Get user's classes
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.code, c.name, c.description, c.ai_name
       FROM classes c
       INNER JOIN class_members cm ON c.id = cm.class_id
       WHERE cm.user_id = $1`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch classes', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create class
router.post('/', authenticate, async (req, res) => {
  const { code, name, description } = req.body;
  if (!code || !name) return res.status(400).json({ error: 'Missing fields' });
  try {
    // Start a transaction
    await pool.query('BEGIN');

    // Create the class
    const classResult = await pool.query(
      'INSERT INTO classes (code, name, description, owner_id) VALUES ($1, $2, $3, $4) RETURNING id, code, name, description',
      [code, name, description || '', req.user.id]
    );
    
    // Add creator as a member
    await pool.query(
      'INSERT INTO class_members (class_id, user_id) VALUES ($1, $2)',
      [classResult.rows[0].id, req.user.id]
    );

    // Commit the transaction
    await pool.query('COMMIT');
    
    res.json(classResult.rows[0]);
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Failed to create class', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get available classes (classes user is not a member of)
router.get('/available', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.code, c.name, c.description 
       FROM classes c
       WHERE NOT EXISTS (
         SELECT 1 FROM class_members cm 
         WHERE cm.class_id = c.id AND cm.user_id = $1
       )`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch available classes', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get class details by ID
router.get('/:id', authenticate, async (req, res) => {
  const classId = req.params.id;
  try {
    const result = await pool.query(
      'SELECT id, code, name, description, ai_name, owner_id FROM classes WHERE id = $1',
      [classId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to fetch class details', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update AI settings for a class
router.patch('/:id/ai-settings', authenticate, async (req, res) => {
  const classId = req.params.id;
  const { ai_name } = req.body;
  
  try {
    // Check if user is the owner
    const classCheck = await pool.query(
      'SELECT owner_id FROM classes WHERE id = $1',
      [classId]
    );
    
    if (classCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    if (classCheck.rows[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the class owner can update AI settings' });
    }
    
    // Update the AI name
    const result = await pool.query(
      'UPDATE classes SET ai_name = $1 WHERE id = $2 RETURNING id, code, name, description, ai_name',
      [ai_name || 'Andy', classId]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to update AI settings:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Join a class
router.post('/:id/join', authenticate, async (req, res) => {
  const classId = req.params.id;
  try {
    // First check if the class exists
    const classCheck = await pool.query('SELECT id FROM classes WHERE id = $1', [classId]);
    if (classCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // Add user as a member
    await pool.query(
      'INSERT INTO class_members (class_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [classId, req.user.id]
    );

    // Return the class details
    const result = await pool.query(
      'SELECT id, code, name, description FROM classes WHERE id = $1',
      [classId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to join class', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;