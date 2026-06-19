/**
 * Socket.io Service for Real-time Challenge Updates
 * Handles live game state synchronization between players
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Challenge = require('../models/Challenge');

// Store connected users
const connectedUsers = new Map(); // socketId -> { odcUserId, username }
const userSockets = new Map();    // odcUserId -> socketId

// Module-scoped reference to the io instance set once at initializeSocket().
// Exposed via notifyUser() so REST controllers can push events to a user.
let _io = null;

function initializeSocket(io) {
  _io = io;
  
  // ============ AUTHENTICATION MIDDLEWARE ============
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      const user = await User.findById(decoded.id).select('username avatar level stars');
      
      if (!user) {
        return next(new Error('User not found'));
      }
      
      socket.user = user;
      next();
    } catch (error) {
      console.error('Socket auth error:', error.message);
      next(new Error('Invalid token'));
    }
  });

  // ============ CONNECTION HANDLER ============
  io.on('connection', async (socket) => {
    const odcUserId = socket.user._id.toString();
    const username = socket.user.username;
    
    console.log(`🟢 User connected: ${username} (${odcUserId})`);
    
    // Store connection
    connectedUsers.set(socket.id, { odcUserId, username });
    userSockets.set(odcUserId, socket.id);
    
    // Update user online status in DB
    await User.findByIdAndUpdate(odcUserId, { 
      isOnline: true, 
      lastActive: new Date() 
    });
    
    // Broadcast to all users that this user is online
    io.emit('user:online', { 
      odcUserId, 
      username,
      avatar: socket.user.avatar,
      level: socket.user.level,
      stars: socket.user.stars
    });

    // ============ CHALLENGE ROOM EVENTS ============

    // Join a challenge room
    socket.on('challenge:join', async (challengeId) => {
      try {
        const challenge = await Challenge.findById(challengeId);
        if (challenge && 
            (challenge.challenger.toString() === odcUserId || 
             challenge.challenged.toString() === odcUserId)) {
          socket.join(`challenge:${challengeId}`);
          console.log(`📝 ${username} joined challenge room: ${challengeId}`);
        }
      } catch (error) {
        console.error('Error joining challenge:', error);
      }
    });

    // Leave challenge room
    socket.on('challenge:leave', (challengeId) => {
      socket.leave(`challenge:${challengeId}`);
      console.log(`📤 ${username} left challenge room: ${challengeId}`);
    });

    // ============ CHALLENGE FLOW EVENTS ============

    // Send challenge notification
    socket.on('challenge:send', async ({ targetUserId, difficulty }) => {
      const targetSocketId = userSockets.get(targetUserId);
      
      if (targetSocketId) {
        io.to(targetSocketId).emit('challenge:received', {
          odcChallengerId: odcUserId,
          challengerName: username,
          challengerAvatar: socket.user.avatar,
          challengerLevel: socket.user.level,
          difficulty
        });
        console.log(`⚔️ Challenge sent from ${username} to ${targetUserId}`);
      }
    });

    // Challenge accepted notification
    socket.on('challenge:accepted', async ({ challengeId }) => {
      try {
        const challenge = await Challenge.findById(challengeId)
          .populate('challenger', 'username avatar')
          .populate('challenged', 'username avatar');
        
        if (challenge) {
          // Notify everyone in the room
          io.to(`challenge:${challengeId}`).emit('challenge:status', {
            challengeId,
            status: 'accepted',
            challenge
          });
          
          // Also notify challenger directly
          const challengerSocketId = userSockets.get(challenge.challenger._id.toString());
          if (challengerSocketId) {
            io.to(challengerSocketId).emit('challenge:accepted', { challengeId, challenge });
          }
          console.log(`✅ Challenge ${challengeId} accepted`);
        }
      } catch (error) {
        console.error('Error accepting challenge:', error);
      }
    });

    // Challenge declined notification
    socket.on('challenge:declined', async ({ challengeId }) => {
      try {
        const challenge = await Challenge.findById(challengeId);
        if (challenge) {
          const challengerSocketId = userSockets.get(challenge.challenger.toString());
          if (challengerSocketId) {
            io.to(challengerSocketId).emit('challenge:declined', { challengeId });
          }
          console.log(`❌ Challenge ${challengeId} declined`);
        }
      } catch (error) {
        console.error('Error declining challenge:', error);
      }
    });

    // Game started
    socket.on('challenge:start', async ({ challengeId }) => {
      io.to(`challenge:${challengeId}`).emit('challenge:started', { 
        challengeId,
        startedAt: new Date()
      });
      console.log(`🎮 Challenge ${challengeId} started`);
    });

    // ============ GAME PROGRESS EVENTS ============

    // Real-time progress update (board state)
    socket.on('challenge:progress', async ({ challengeId, board, timeSpent, errors, cellUpdated }) => {
      // Broadcast to opponent only (not back to sender)
      socket.to(`challenge:${challengeId}`).emit('opponent:progress', {
        odcUserId,
        board,
        timeSpent,
        errors,
        cellUpdated // { row, col, value }
      });
    });

    // Player completed puzzle
    socket.on('challenge:completed', async ({ challengeId, timeSpent, errors }) => {
      io.to(`challenge:${challengeId}`).emit('player:completed', {
        odcUserId,
        username,
        timeSpent,
        errors,
        completedAt: new Date()
      });
      console.log(`🏁 ${username} completed challenge ${challengeId}`);
    });

    // Player abandoned
    socket.on('challenge:abandoned', async ({ challengeId }) => {
      io.to(`challenge:${challengeId}`).emit('player:abandoned', {
        odcUserId,
        username,
        abandonedAt: new Date()
      });
      console.log(`🏳️ ${username} abandoned challenge ${challengeId}`);
    });

    // Final game result
    socket.on('challenge:finished', async ({ challengeId, winner, loser, isDraw }) => {
      io.to(`challenge:${challengeId}`).emit('challenge:result', {
        challengeId,
        winner,
        loser,
        isDraw,
        finishedAt: new Date()
      });
    });

    // Only sockets that actually joined a challenge room (challenge:join
    // already enforces participation, lines ~74-86) may emit into it. Blocks
    // a user from injecting chat / WebRTC signaling into a room they aren't in.
    const inRoom = (challengeId) =>
      typeof challengeId === 'string' && socket.rooms.has(`challenge:${challengeId}`);

    // ============ CHAT (text + base64 image, scoped to a challenge room) ============
    socket.on('challenge:chat', ({ challengeId, text, img }) => {
      if (!inRoom(challengeId)) return;
      // Sanitize: cap text length, and only relay a bounded image data-URI.
      // The web/native client must still render `text` as PLAIN TEXT (never
      // innerHTML) — this is server-side defense in depth, not a DOM escape.
      const safeText = typeof text === 'string' ? text.slice(0, 1000) : '';
      const safeImg = (typeof img === 'string'
        && /^data:image\/(png|jpe?g|webp|gif);base64,/.test(img)
        && img.length < 350000) ? img : undefined;
      if (!safeText && !safeImg) return;
      socket.to(`challenge:${challengeId}`).emit('chat:message', {
        odcUserId, from: username, text: safeText, img: safeImg, ts: Date.now()
      });
    });

    // ============ WebRTC signaling (audio/video calls within a challenge) ============
    socket.on('webrtc:offer', ({ challengeId, sdp }) => {
      if (!inRoom(challengeId)) return;
      socket.to(`challenge:${challengeId}`).emit('webrtc:offer', { from: odcUserId, sdp });
    });
    socket.on('webrtc:answer', ({ challengeId, sdp }) => {
      if (!inRoom(challengeId)) return;
      socket.to(`challenge:${challengeId}`).emit('webrtc:answer', { from: odcUserId, sdp });
    });
    socket.on('webrtc:ice', ({ challengeId, candidate }) => {
      if (!inRoom(challengeId)) return;
      socket.to(`challenge:${challengeId}`).emit('webrtc:ice', { from: odcUserId, candidate });
    });
    socket.on('call:end', ({ challengeId }) => {
      if (!inRoom(challengeId)) return;
      socket.to(`challenge:${challengeId}`).emit('call:end', { from: odcUserId });
    });

    // ============ PRESENCE EVENTS ============

    // Heartbeat to keep user active
    socket.on('heartbeat', async () => {
      await User.findByIdAndUpdate(odcUserId, { lastActive: new Date() });
    });

    // Get online users list
    socket.on('users:list', async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const onlineUsers = await User.find({
        _id: { $ne: odcUserId },
        isOnline: true,
        lastActive: { $gte: fiveMinutesAgo }
      }).select('username avatar level stars');
      
      socket.emit('users:online', onlineUsers);
    });

    // ============ DISCONNECT HANDLER ============
    socket.on('disconnect', async () => {
      console.log(`🔴 User disconnected: ${username} (${odcUserId})`);
      
      // Remove from connected lists
      connectedUsers.delete(socket.id);
      userSockets.delete(odcUserId);
      
      // Update user offline status
      await User.findByIdAndUpdate(odcUserId, { 
        isOnline: false,
        lastActive: new Date()
      });
      
      // Broadcast offline status
      io.emit('user:offline', { odcUserId, username });
    });
  });

  // ============ CLEANUP STALE CONNECTIONS ============
  setInterval(async () => {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      await User.updateMany(
        { lastActive: { $lt: fiveMinutesAgo }, isOnline: true },
        { isOnline: false }
      );
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }, 60000); // Every minute

  return io;
}

// ============ HELPER FUNCTIONS ============

function getSocketForUser(odcUserId) {
  return userSockets.get(odcUserId);
}

function isUserOnline(odcUserId) {
  return userSockets.has(odcUserId);
}

function getOnlineUsersCount() {
  return userSockets.size;
}

// Push a socket event to a specific user from anywhere (REST controllers etc.).
// Returns true if the user had at least one active socket. Safely no-op'd if io
// hasn't been initialized yet (e.g. when controllers are required before
// initializeSocket runs).
function notifyUser(odcUserId, event, payload) {
  if (!_io) return false;
  const sid = userSockets.get(String(odcUserId));
  if (!sid) return false;
  _io.to(sid).emit(event, payload);
  return true;
}

module.exports = {
  initializeSocket,
  getSocketForUser,
  isUserOnline,
  getOnlineUsersCount,
  notifyUser,
  connectedUsers,
  userSockets
};