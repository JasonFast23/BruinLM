const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../db');
const { generateToken } = require('../../middleware/csrf');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();

// Constants
const TOKEN_EXPIRATION_DAYS = 7;
const TOKEN_EXPIRATION_MS = TOKEN_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;
const BCRYPT_SALT_ROUNDS = 10;

/**
 * Helper function to set secure JWT cookie in HTTP response
 *
 * @param {Object} response - Express response object
 * @param {string} token - JWT token to set in cookie
 */
const setAuthCookie = (response, token) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isHttps = process.env.HTTPS_ENABLED === 'true' || isProduction;

  response.cookie('token', token, {
    httpOnly: true,
    secure: isHttps, // Only send over HTTPS in production
    sameSite: 'strict',
    maxAge: TOKEN_EXPIRATION_MS,
  });
};

// Get CSRF token endpoint
router.get('/csrf-token', (req, res) => {
  const token = generateToken(req, res);
  res.json({ csrfToken: token });
});

/**
 * Register a new user with UCLA email validation
 */
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;

  try {
    // Validate UCLA email domain
    if (!email.endsWith('@ucla.edu') && !email.endsWith('@g.ucla.edu')) {
      return res.status(400).json({ error: 'Please use a valid UCLA email' });
    }

    // Check if user already exists
    const existingUserQuery = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (existingUserQuery.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password with bcrypt
    const passwordSalt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, passwordSalt);

    // Create new user in database
    const newUserQuery = await pool.query(
      'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, hashedPassword, name]
    );

    const newUser = newUserQuery.rows[0];

    // Initialize user status as online
    await pool.query(
      'INSERT INTO user_status (user_id, is_online, last_seen) VALUES ($1, $2, NOW())',
      [newUser.id, true]
    );

    // Generate JWT token
    const authToken = jwt.sign(
      { id: newUser.id, email },
      process.env.JWT_SECRET,
      { expiresIn: `${TOKEN_EXPIRATION_DAYS}d` }
    );

    // Set secure cookie
    setAuthCookie(res, authToken);

    // Return token in response body for backward compatibility
    res.json({ token: authToken, user: newUser });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * Authenticate and log in an existing user
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Query for user by email
    const userQuery = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (userQuery.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const user = userQuery.rows[0];

    // Verify password matches stored hash
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Update user status to online
    await pool.query(
      'UPDATE user_status SET is_online = $1, last_seen = NOW() WHERE user_id = $2',
      [true, user.id]
    );

    // Generate JWT token
    const authToken = jwt.sign(
      { id: user.id, email },
      process.env.JWT_SECRET,
      { expiresIn: `${TOKEN_EXPIRATION_DAYS}d` }
    );

    // Set secure cookie
    setAuthCookie(res, authToken);

    // Return token and user info in response body for backward compatibility
    res.json({
      token: authToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
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