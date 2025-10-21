require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/routes/auth');
const classRoutes = require('./routes/routes/classes');
const fileRoutes = require('./routes/routes/files');
const chatRoutes = require('./routes/routes/chat');
const userRoutes = require('./routes/routes/users');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase JSON payload limit
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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