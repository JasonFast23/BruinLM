const Tokens = require('csrf');

const tokens = new Tokens();

// Generate CSRF token
const generateToken = (req, res) => {
  // Get or create secret from cookie
  let secret = req.cookies.csrfSecret;
  
  if (!secret) {
    secret = tokens.secretSync();
    // Store secret in httpOnly cookie
    const isProduction = process.env.NODE_ENV === 'production';
    const isHttps = process.env.HTTPS_ENABLED === 'true' || isProduction;
    
    res.cookie('csrfSecret', secret, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }
  
  const token = tokens.create(secret);
  return token;
};

// Verify CSRF token
const verifyToken = (req, res, next) => {
  // Skip CSRF for GET requests
  if (req.method === 'GET') {
    return next();
  }

  // Skip CSRF for WebSocket upgrade requests
  if (req.headers.upgrade === 'websocket') {
    return next();
  }

  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const secret = req.cookies.csrfSecret;

  if (!token || !secret) {
    return res.status(403).json({ error: 'CSRF token missing' });
  }

  if (!tokens.verify(secret, token)) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  next();
};

module.exports = {
  generateToken,
  verifyToken,
};

