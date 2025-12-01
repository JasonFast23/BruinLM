const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

/**
 * Authentication middleware that supports both Bearer tokens and httpOnly cookies
 * Maintains backward compatibility with existing frontend
 */
const authenticate = (req, res, next) => {
  let token = null;

  // Try to get token from Authorization header (Bearer token)
  const auth = req.headers.authorization;
  if (auth) {
    const parts = auth.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  // If no Bearer token, try to get from cookie
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = { authenticate };

