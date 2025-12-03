const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../db');
const { generateToken } = require('../../middleware/csrf');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();

// Helper function to set secure JWT cookie
const setAuthCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isHttps = process.env.HTTPS_ENABLED === 'true' || isProduction;
  
  res.cookie('token', token, {
    httpOnly: true,
    secure: isHttps, // Only send over HTTPS in production
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

// Get CSRF token endpoint
router.get('/csrf-token', (req, res) => {
  const token = generateToken(req, res);
  res.json({ csrfToken: token });
});

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

    // Set secure cookie
    setAuthCookie(res, token);

    // Return token in response body for backward compatibility
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

    // Set secure cookie
    setAuthCookie(res, token);

    // Return token in response body for backward compatibility
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

// Logout
router.post('/logout', async (req, res) => {
  try {
    // Try to get user ID from token if available
    let token = null;
    const auth = req.headers.authorization;
    if (auth) {
      const parts = auth.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }
    
    // If token exists and is valid, mark user as offline
    if (token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        await pool.query('UPDATE user_status SET is_online = $1, last_seen = NOW() WHERE user_id = $2', [false, payload.id]);
      } catch (err) {
        // Invalid token is okay, we're logging out anyway
        console.log('Token validation failed during logout (expected):', err.message);
      }
    }
    
    // Clear the auth cookie regardless
    res.clearCookie('token');
    
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    // Even if there's an error, allow logout
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
  }
});

module.exports = router;