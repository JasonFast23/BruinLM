const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../db');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;

  try {
    // Validate UCLA email
    if (!email.endsWith('@ucla.edu') && !email.endsWith('@g.ucla.edu')) {
      return res.status(400).json({ error: 'Please use a valid UCLA email' });
    }

    // Check if user exists
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const newUser = await pool.query(
      'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, hashedPassword, name]
    );

  // Create user status (set online true and last_seen now)
  await pool.query('INSERT INTO user_status (user_id, is_online, last_seen) VALUES ($1, $2, NOW())', [newUser.rows[0].id, true]);

    // Create token
    const token = jwt.sign({ id: newUser.rows[0].id, email }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user: newUser.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if user exists
    const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (user.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Validate password
    const validPassword = await bcrypt.compare(password, user.rows[0].password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

  // Update online status
  await pool.query('UPDATE user_status SET is_online = $1, last_seen = NOW() WHERE user_id = $2', [true, user.rows[0].id]);

    // Create token
    const token = jwt.sign({ id: user.rows[0].id, email }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ 
      token, 
      user: { 
        id: user.rows[0].id, 
        email: user.rows[0].email, 
        name: user.rows[0].name 
      } 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;