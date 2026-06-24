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

// ── Live-broadcast consent (privacy) ─────────────────────────────────────────
// A duel is only spectatable / publicly streamable once BOTH participants have
// opted in. The initiator opts in via live:request, the opponent via live:accept.
async function recordBroadcastOptIn(challengeId, userId) {
  try {
    const c = await Challenge.findById(challengeId).select('challenger challenged broadcast');
    if (!c) return false;
    const isChallenger = c.challenger.toString() === String(userId);
    const isChallenged = c.challenged.toString() === String(userId);
    if (!isChallenger && !isChallenged) return false;  // only participants set consent
    const set = { [isChallenger ? 'broadcast.challengerOptIn' : 'broadcast.challengedOptIn']: true };
    const otherAlreadyIn = isChallenger ? c.broadcast?.challengedOptIn : c.broadcast?.challengerOptIn;
    if (otherAlreadyIn) { set['broadcast.consented'] = true; set['broadcast.startedAt'] = new Date(); }
    await Challenge.updateOne({ _id: challengeId }, { $set: set });
    return true;
  } catch (e) { console.error('broadcast opt-in failed:', e?.message); return false; }
}
async function clearBroadcastConsent(challengeId) {
  try {
    await Challenge.updateOne({ _id: challengeId }, { $set: {
      'broadcast.consented': false, 'broadcast.challengerOptIn': false, 'broadcast.challengedOptIn': false,
    } });
  } catch (e) { console.error('broadcast consent clear failed:', e?.message); }
}
// Moderation parity for the socket notification path: don't relay if either
// user has blocked the other (the REST sendChallenge already enforces this).
async function isBlockedBetween(aId, bId) {
  try {
    const [a, b] = await Promise.all([
      User.findById(aId).select('blockedUsers'),
      User.findById(bId).select('blockedUsers'),
    ]);
    const aBlocks = (a?.blockedUsers || []).some((x) => String(x) === String(bId));
    const bBlocks = (b?.blockedUsers || []).some((x) => String(x) === String(aId));
    return aBlocks || bBlocks;
  } catch { return false; }
}

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
    // Rooms this socket is an actual PARTICIPANT of (set by challenge:join after
    // the challenger/challenged check). Distinct from socket.io rooms — a
    // spectator joins the io room to WATCH but is NOT a participant, so it can
    // never inject chat / WebRTC / live signaling (see inRoom()).
    socket.data.participantRooms = new Set();

    console.log(`🟢 User connected: ${username} (${odcUserId})`);
    
    // Store connection
    connectedUsers.set(socket.id, { odcUserId, username });
    userSockets.set(odcUserId, socket.id);
    
    // Update user online status in DB (guarded — a rejected DB op in an async
    // socket handler is an unhandledRejection that can crash the worker).
    try {
      await User.findByIdAndUpdate(odcUserId, { isOnline: true, lastActive: new Date() });
    } catch (e) { console.error('socket connect status update failed:', e?.message); }
    
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
          socket.data.participantRooms.add(String(challengeId));   // mark as participant
          console.log(`📝 ${username} joined challenge room: ${challengeId}`);
        }
      } catch (error) {
        console.error('Error joining challenge:', error);
      }
    });

    // Leave challenge room
    socket.on('challenge:leave', (challengeId) => {
      socket.leave(`challenge:${challengeId}`);
      socket.data.participantRooms.delete(String(challengeId));
      console.log(`📤 ${username} left challenge room: ${challengeId}`);
    });

    // Spectate a challenge room (READ-ONLY). Only allowed when BOTH players have
    // consented to a public broadcast (privacy gate) — otherwise a stranger
    // could watch any duel's live boards + identities. A spectator joins the io
    // room to receive 'opponent:progress' but is NOT a participant, so it can
    // never inject chat / WebRTC / live signaling (inRoom() checks participation).
    socket.on('challenge:spectate', async (challengeId) => {
      try {
        if (typeof challengeId !== 'string') return;
        const challenge = await Challenge.findById(challengeId).select('broadcast');
        if (challenge && challenge.broadcast?.consented) {
          socket.join(`challenge:${challengeId}`);
          console.log(`👁️ ${username} spectating challenge room: ${challengeId}`);
        } else {
          socket.emit('spectate:denied', { challengeId, reason: 'not_consented' });
        }
      } catch (error) {
        console.error('Error spectating challenge:', error);
      }
    });

    // ============ CHALLENGE FLOW EVENTS ============

    // Send challenge notification
    socket.on('challenge:send', async ({ targetUserId, difficulty }) => {
      if (!targetUserId || String(targetUserId) === odcUserId) return;   // no self-challenge
      if (await isBlockedBetween(odcUserId, targetUserId)) return;        // moderation parity
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

    // Only sockets that joined as a PARTICIPANT (challenge:join enforced the
    // challenger/challenged check) may emit into a room. A spectator is in the
    // io room but NOT in participantRooms → it can watch but never inject chat /
    // WebRTC / live signaling into a stranger's duel.
    const inRoom = (challengeId) =>
      typeof challengeId === 'string' && socket.data.participantRooms.has(String(challengeId));

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
    // Bound the relayed payloads — a real SDP is < ~10 KB and an ICE candidate
    // < ~1 KB. Rejecting oversized blobs blocks a memory-amplification flood.
    const okSdp = (sdp) => typeof sdp === 'string' && sdp.length > 0 && sdp.length < 20000;
    const okCandidate = (c) => { try { return JSON.stringify(c).length < 4000; } catch { return false; } };
    socket.on('webrtc:offer', ({ challengeId, sdp }) => {
      if (!inRoom(challengeId) || !okSdp(sdp)) return;
      socket.to(`challenge:${challengeId}`).emit('webrtc:offer', { from: odcUserId, sdp });
    });
    socket.on('webrtc:answer', ({ challengeId, sdp }) => {
      if (!inRoom(challengeId) || !okSdp(sdp)) return;
      socket.to(`challenge:${challengeId}`).emit('webrtc:answer', { from: odcUserId, sdp });
    });
    socket.on('webrtc:ice', ({ challengeId, candidate }) => {
      if (!inRoom(challengeId) || !okCandidate(candidate)) return;
      socket.to(`challenge:${challengeId}`).emit('webrtc:ice', { from: odcUserId, candidate });
    });
    socket.on('call:end', ({ challengeId }) => {
      if (!inRoom(challengeId)) return;
      socket.to(`challenge:${challengeId}`).emit('call:end', { from: odcUserId });
    });

    // ============ LIVE-STREAM handshake ============
    // One player asks to go live on a platform (e.g. YouTube); the broadcast
    // only starts once the OPPONENT accepts. Pure relay within the room.
    // The INITIATOR opts in by requesting (they will broadcast). Persist consent
    // BEFORE relaying so the opponent's accept (which flips consented=true) and
    // the relay's consent check never race ahead of the DB write.
    socket.on('live:request', async ({ challengeId, platform }) => {
      if (!inRoom(challengeId)) return;
      await recordBroadcastOptIn(challengeId, odcUserId);
      socket.to(`challenge:${challengeId}`).emit('live:request', { from: odcUserId, fromName: username, platform: platform || 'youtube' });
    });
    // The OPPONENT opts in by accepting → both opted in → consented=true. Await
    // the persist before relaying live:accept (which triggers the broadcaster to
    // open the relay, which checks broadcast.consented).
    socket.on('live:accept', async ({ challengeId }) => {
      if (!inRoom(challengeId)) return;
      await recordBroadcastOptIn(challengeId, odcUserId);
      socket.to(`challenge:${challengeId}`).emit('live:accept', { from: odcUserId, fromName: username });
    });
    socket.on('live:decline', ({ challengeId }) => {
      if (!inRoom(challengeId)) return;
      socket.to(`challenge:${challengeId}`).emit('live:decline', { from: odcUserId, fromName: username });
    });
    socket.on('live:end', async ({ challengeId }) => {
      if (!inRoom(challengeId)) return;
      await clearBroadcastConsent(challengeId);   // broadcast over → spectate/stream closes
      socket.to(`challenge:${challengeId}`).emit('live:end', { from: odcUserId });
    });

    // ============ PRESENCE EVENTS ============

    // Heartbeat to keep user active
    socket.on('heartbeat', async () => {
      try { await User.findByIdAndUpdate(odcUserId, { lastActive: new Date() }); } catch (e) {}
    });

    // Get online users list
    socket.on('users:list', async () => {
      try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const onlineUsers = await User.find({
          _id: { $ne: odcUserId },
          isOnline: true,
          lastActive: { $gte: fiveMinutesAgo }
        }).select('username avatar level stars');
        socket.emit('users:online', onlineUsers);
      } catch (e) { console.error('users:list failed:', e?.message); }
    });

    // ============ DISCONNECT HANDLER ============
    socket.on('disconnect', async () => {
      console.log(`🔴 User disconnected: ${username} (${odcUserId})`);

      // Remove from connected lists. Only clear the user→socket mapping if THIS
      // socket still owns it (L2: with a 2nd device the later socket overwrote
      // the map; the first one disconnecting must NOT drop the live one).
      connectedUsers.delete(socket.id);
      if (userSockets.get(odcUserId) === socket.id) userSockets.delete(odcUserId);

      // Update user offline status (guarded — see connect handler).
      try {
        await User.findByIdAndUpdate(odcUserId, { isOnline: false, lastActive: new Date() });
      } catch (e) { console.error('socket disconnect status update failed:', e?.message); }

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

// Broadcast an event to EVERY connected socket (global activity feed etc.).
// Safe no-op before initializeSocket runs.
function broadcast(event, payload) {
  if (!_io) return false;
  _io.emit(event, payload);
  return true;
}

module.exports = {
  initializeSocket,
  getSocketForUser,
  isUserOnline,
  getOnlineUsersCount,
  notifyUser,
  broadcast,
  connectedUsers,
  userSockets
};