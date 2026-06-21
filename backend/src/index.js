/**
 * ============================================================================
 * SALLYSUDO V3 - MAIN SERVER
 * ============================================================================
 * Express + Socket.io pour les défis en temps réel
 * ============================================================================
 */

require('dotenv').config();

// SECURITY: never run in production with the weak fallback JWT secret. The
// codebase uses `process.env.JWT_SECRET || 'secret'` in several places so local
// dev still works; this guard makes sure a real, strong secret is configured
// before the server accepts a single request in prod (otherwise anyone could
// forge a token for any user). Docker compose already marks JWT_SECRET required.
if (process.env.NODE_ENV === 'production' &&
    (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'secret')) {
  console.error('FATAL: JWT_SECRET must be set to a strong value in production.');
  process.exit(1);
}

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

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
const turnRoutes = require('./routes/turn');
const youtubeRoutes = require('./routes/youtube');

const app = express();

// Behind Caddy (one proxy hop) — needed so express-rate-limit and req.ip read
// the real client IP from X-Forwarded-For instead of the proxy's address.
app.set('trust proxy', 1);

// ============================================================================
// MIDDLEWARE
// ============================================================================

app.use(helmet());

// CORS — in production, restrict to an explicit allowlist instead of '*'.
// Native apps send no Origin header (allowed); browsers must be allowlisted.
// Dev (NODE_ENV !== production) stays fully permissive.
const allowedOrigins = (process.env.CORS_ORIGIN || 'https://app.sallysudo.com,https://sallysudo.com')
  .split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin(origin, cb) {
    if (process.env.NODE_ENV !== 'production') return cb(null, true);
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
}));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
// Strip MongoDB operator keys ($, .) from user input → blocks NoSQL operator
// injection (e.g. login with email:{"$ne":null}).
app.use(mongoSanitize());

// Throttle auth endpoints (login/register/guest/google) against brute force
// and mass guest-account creation. Generous enough for real users.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many attempts, please try again later.' },
});

// ============================================================================
// ROUTES
// ============================================================================

// Existing routes
app.use('/api/auth', authLimiter, authRoutes);
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
app.use('/api', turnRoutes);
// YouTube Live control-plane (per-user OAuth)
app.use('/api/youtube', youtubeRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date(), 
    version: '3.11.4',
    uptime: process.uptime()
  });
});

// API Documentation
app.get('/api', (req, res) => {
  res.json({
    name: 'SallySudo API',
    version: '3.11.4',
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
    // Browsers reject `Access-Control-Allow-Origin: *` combined with
    // `Allow-Credentials: true`, which silently broke the web socket
    // (handshake failed → no realtime, no WebRTC signaling). Reflect the
    // specific allowlisted origin instead. Native apps send no Origin and
    // are allowed through (they don't enforce CORS).
    origin(origin, cb) {
      if (process.env.NODE_ENV !== 'production') return cb(null, true);
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT) || 60000,
  pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL) || 25000
});

// Initialize Socket.io for real-time challenges
initializeSocket(io);

// Media relay (data-plane): WebSocket → ffmpeg → YouTube RTMP. Attaches to the
// same HTTP server on /api/youtube/ingest. No-op if ffmpeg/ws missing.
try {
  const { initRelay } = require('./services/relayService');
  initRelay(server);
} catch (e) {
  console.warn('Media relay not started:', e.message);
}

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
      console.log('  🎮 SALLYSUDO V3 - Server Started');
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