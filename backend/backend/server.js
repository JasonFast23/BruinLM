require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/routes/auth');
const classRoutes = require('./routes/routes/classes');
const fileRoutes = require('./routes/routes/files');
const chatRoutes = require('./routes/routes/chat');
const userRoutes = require('./routes/routes/users');
const searchRoutes = require('./routes/routes/search');

const app = express();

// Middleware
app.use(cors({
  credentials: true, // Allow cookies to be sent
  origin: process.env.FRONTEND_URL || 'http://localhost:3000'
}));
app.use(cookieParser());
app.use(express.json({ limit: '50mb' })); // Increase JSON payload limit
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// HTTPS enforcement in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
  
  // Security headers
  app.use((req, res, next) => {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });
}

// Increase timeout for AI requests
app.use('/api/chat', (req, res, next) => {
  // Set timeout to 5 minutes for AI chat requests
  req.setTimeout(300000); // 5 minutes
  res.setTimeout(300000); // 5 minutes
  next();
});

// Simple request logger for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - Origin: ${req.headers.origin || 'unknown'}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/users', userRoutes);
app.use('/api/search', searchRoutes);

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 5001;
const server = require('http').createServer(app);
const setupWebSocket = require('./websocket');

// Set up WebSocket server
setupWebSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});