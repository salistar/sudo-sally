/**
 * ============================================================================
 * SUDOKU SALLY V3 - MAIN SERVER
 * ============================================================================
 * Express + Socket.io pour les défis en temps réel
 * ============================================================================
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');

// Import Socket Service
const { initializeSocket } = require('./services/socketService');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const levelRoutes = require('./routes/levels');
const gameRoutes = require('./routes/games');
const leaderboardRoutes = require('./routes/leaderboard');
const achievementRoutes = require('./routes/achievements');
const dailyRoutes = require('./routes/daily');
const shopRoutes = require('./routes/shop');
const statsRoutes = require('./routes/stats');
const challengeRoutes = require('./routes/challenges');

const app = express();

// ============================================================================
// MIDDLEWARE
// ============================================================================

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================================
// ROUTES
// ============================================================================

// Existing routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/levels', levelRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/daily', dailyRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/stats', statsRoutes);

// NEW: Challenge routes
app.use('/api/challenges', challengeRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date(), 
    version: '3.1.0',
    uptime: process.uptime()
  });
});

// API Documentation
app.get('/api', (req, res) => {
  res.json({
    name: 'Sudoku Sally API',
    version: '3.1.0',
    endpoints: {
      auth: { 
        login: 'POST /api/auth/login', 
        register: 'POST /api/auth/register', 
        me: 'GET /api/auth/me' 
      },
      users: { 
        getAll: 'GET /api/users', 
        getOne: 'GET /api/users/:id', 
        update: 'PUT /api/users/:id', 
        delete: 'DELETE /api/users/:id' 
      },
      levels: { 
        getAll: 'GET /api/levels', 
        getOne: 'GET /api/levels/:id', 
        complete: 'POST /api/levels/:id/complete' 
      },
      games: { 
        start: 'POST /api/games/start', 
        save: 'POST /api/games/save', 
        history: 'GET /api/games/history' 
      },
      leaderboard: { 
        global: 'GET /api/leaderboard', 
        weekly: 'GET /api/leaderboard/weekly' 
      },
      achievements: { 
        getAll: 'GET /api/achievements', 
        unlock: 'POST /api/achievements/:id/unlock' 
      },
      daily: { 
        get: 'GET /api/daily', 
        complete: 'POST /api/daily/complete' 
      },
      shop: { 
        items: 'GET /api/shop', 
        buy: 'POST /api/shop/buy' 
      },
      stats: { 
        global: 'GET /api/stats', 
        user: 'GET /api/stats/user' 
      },
      // NEW: Challenge endpoints
      challenges: {
        onlineUsers: 'GET /api/challenges/online-users',
        send: 'POST /api/challenges',
        accept: 'PUT /api/challenges/:id/accept',
        decline: 'PUT /api/challenges/:id/decline',
        start: 'PUT /api/challenges/:id/start',
        progress: 'PUT /api/challenges/:id/progress',
        complete: 'PUT /api/challenges/:id/complete',
        abandon: 'PUT /api/challenges/:id/abandon',
        pending: 'GET /api/challenges/pending',
        sent: 'GET /api/challenges/sent',
        active: 'GET /api/challenges/active',
        history: 'GET /api/challenges/history',
        getOne: 'GET /api/challenges/:id'
      }
    },
    socket: {
      url: 'ws://localhost:' + (process.env.PORT || 3001),
      events: {
        client: [
          'challenge:join',
          'challenge:leave',
          'challenge:send',
          'challenge:accepted',
          'challenge:progress',
          'challenge:completed',
          'challenge:abandoned',
          'challenge:declined'
        ],
        server: [
          'user:online',
          'user:offline',
          'challenge:received',
          'challenge:started',
          'opponent:progress',
          'player:completed',
          'player:abandoned',
          'player:disconnected',
          'challenge:declined'
        ]
      }
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack);
  res.status(err.status || 500).json({ 
    success: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong!' 
  });
});

// ============================================================================
// HTTP SERVER + SOCKET.IO
// ============================================================================

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT) || 60000,
  pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL) || 25000
});

// Initialize Socket.io for real-time challenges
initializeSocket(io);

// ============================================================================
// DATABASE CONNECTION & SERVER START
// ============================================================================

const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sudoku_sally';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    
    // Use server.listen instead of app.listen for Socket.io
    server.listen(PORT, () => {
      console.log('============================================');
      console.log('  🎮 SUDOKU SALLY V3 - Server Started');
      console.log('============================================');
      console.log(`  📡 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`  🚀 HTTP Server: http://localhost:${PORT}`);
      console.log(`  🔌 Socket.io: ws://localhost:${PORT}`);
      console.log(`  📚 API Docs: http://localhost:${PORT}/api`);
      console.log(`  💚 Health: http://localhost:${PORT}/health`);
      console.log('============================================');
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[SERVER] SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('[SERVER] HTTP server closed');
  });
  await mongoose.connection.close();
  console.log('[DATABASE] MongoDB connection closed');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[SERVER] SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('[SERVER] HTTP server closed');
  });
  await mongoose.connection.close();
  console.log('[DATABASE] MongoDB connection closed');
  process.exit(0);
});

module.exports = { app, server, io };