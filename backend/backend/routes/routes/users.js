const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const pool = require('../../db');

// Simple auth middleware for this router
function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(parts[1], process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Return list of users with their online status
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email,
              CASE
                WHEN us.last_seen IS NOT NULL AND us.is_online = true AND (NOW() - us.last_seen) < interval '20 seconds'
                  THEN true
                ELSE false
              END AS is_online,
              us.last_seen
       FROM users u
       LEFT JOIN user_status us ON us.user_id = u.id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch users', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Optional: check online logic threshold
router.get('/heartbeat', async (_req, res) => {
  res.json({ ok: true, serverTime: new Date().toISOString() });
});

// Get current user from token
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to fetch current user', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update online status (heartbeat)
router.post('/status', authenticate, async (req, res) => {
  const { isOnline } = req.body;
  try {
    // Try update first
    const updateRes = await pool.query(
      'UPDATE user_status SET is_online = $1, last_seen = NOW() WHERE user_id = $2',
      [!!isOnline, req.user.id]
    );
    if (updateRes.rowCount === 0) {
      // Fallback insert
      await pool.query(
        'INSERT INTO user_status (user_id, is_online, last_seen) VALUES ($1, $2, NOW())',
        [req.user.id, !!isOnline]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to update user status', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
