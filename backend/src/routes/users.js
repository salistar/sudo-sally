const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

// ─── SEARCH users by username (prefix match) — public to authed players ──
// Lets the mobile lobby find anyone, not just users currently in a socket.
// GET /api/users/search?q=foo  → up to 20 users whose username starts with foo
router.get('/search', auth, async (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim();
    if (!q || q.length < 2) return res.json({ success: true, users: [] });
    // Escape regex metachars so users can't break the query with weird input
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const users = await User.find({
      _id: { $ne: req.user.id },                       // not myself
      username: { $regex: '^' + safe, $options: 'i' }, // prefix match, case-insensitive
    })
    .select('username avatar level stars isOnline lastActive')
    .sort({ isOnline: -1, lastActive: -1, stars: -1 })
    .limit(20);
    res.json({ success: true, users });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
  }
});

// ─── RECENT users — anyone active in the last 7 days (online OR recently online) ──
// Fixes the "No users online" dead-end: even if nobody is connected RIGHT NOW,
// the mobile/web lobby can still surface plausible opponents to challenge.
// Window is generous (7 days) while the user base is small; tighten to 24h
// when the app reaches enough daily-actives that a 7-day list is too long.
// GET /api/users/recent
router.get('/recent', auth, async (req, res) => {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    // Use req.user._id (ObjectId) — req.user.id is a Mongoose virtual that
    // can drift in $ne comparisons against the ObjectId stored on disk.
    const selfId = req.user._id;
    let users = await User.find({
      _id: { $ne: selfId },
      $or: [
        { isOnline: true },
        { lastActive: { $gte: weekAgo } },
        { lastLogin:  { $gte: weekAgo } },     // also fall back on lastLogin
      ],
    })
    .select('username avatar level stars isOnline lastActive lastLogin')
    .sort({ isOnline: -1, lastActive: -1, lastLogin: -1 })
    .limit(30);
    // Belt-and-suspenders: string-compare self _id post-fetch so a Mongoose
    // cast quirk never leaks self into the lobby ("can challenge yourself" bug).
    const selfStr = String(selfId);
    users = users.filter(u => String(u._id) !== selfStr);
    res.json({ success: true, users });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
  }
});

// ─── PUBLIC profile lookup by username — v3.11.14 sprint-19 ──
// Powers /u/<username> pages: anyone can view another player's profile,
// authed or not, with sanitized fields only (no email/password/settings).
// Username match is case-insensitive so URLs are forgiving.
// IMPORTANT: this route MUST stay above the `/:id` route below — Express
// matches routes in declaration order, and "/:id" would otherwise eat it.
router.get('/by-username/:username', async (req, res) => {
  try {
    const raw = (req.params.username || '').toString().trim();
    if (!raw) return res.status(400).json({ error: 'Missing username' });
    const safe = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const user = await User.findOne({
      username: { $regex: '^' + safe + '$', $options: 'i' },
    }).select('username avatar level stars createdAt isOnline lastActive stats');
    if (!user) return res.status(404).json({ error: 'User not found' });

    // sprint-31 — public recent-matches for the profile page. The viewed user's
    // last completed duels, from THEIR perspective (win/loss/draw vs opponent).
    // Public-safe: no board/solution, only outcome + opponent + time/errors.
    const Challenge = require('../models/Challenge');
    const matches = await Challenge.find({
      status: 'completed',
      $or: [{ challenger: user._id }, { challenged: user._id }],
    })
      .populate('challenger', 'username avatar')
      .populate('challenged', 'username avatar')
      .populate('winner', 'username avatar')
      .sort({ completedAt: -1 })
      .limit(8);
    const recentMatches = matches.map((c) => {
      const meIsChallenger = String(c.challenger?._id) === String(user._id);
      const me = meIsChallenger ? c.challengerProgress : c.challengedProgress;
      const opp = meIsChallenger ? c.challenged : c.challenger;
      const outcome = c.isDraw ? 'draw'
        : (c.winner && String(c.winner._id) === String(user._id)) ? 'win' : 'loss';
      return {
        outcome,
        opponent: opp?.username || '—',
        opponentAvatar: opp?.avatar || '🎮',
        timeSpent: me?.timeSpent || 0,
        errors: me?.errors || 0,
        difficulty: c.difficulty,
        at: c.completedAt,
      };
    });

    res.json({
      success: true,
      user: {
        username: user.username,
        avatar: user.avatar || '🎮',
        level: user.level || 1,
        stars: user.stars || 0,
        joinedAt: user.createdAt,
        isOnline: !!user.isOnline,
        lastActive: user.lastActive,
        // Public-safe stats subset only.
        gamesPlayed: user.stats?.gamesPlayed || 0,
        gamesWon: user.stats?.gamesWon || 0,
        bestStreak: user.stats?.bestStreak || 0,
        currentStreak: user.stats?.currentStreak || 0,
        recentMatches,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
  }
});

// Get all users (admin only)
router.get('/', auth, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json({ success: true, users, count: users.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
  }
});

// Get user by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
  }
});

// Update user
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    // Strip fields a client must never be able to self-assign through this
    // route. Without this, a user updating their own record could set
    // role:'admin' (privilege escalation) or inflate coins/stars/xp/stats
    // (economy cheat) or overwrite identity fields. Cosmetic/profile fields
    // (username, avatar, settings, …) still pass through.
    const updates = { ...req.body };
    const FORBIDDEN = [
      'password', 'role', 'isAdmin', '_id', 'email', 'googleId',
      'coins', 'stars', 'xp', 'level',
      'gamesPlayed', 'gamesWon', 'bestStreak', 'currentStreak', 'achievements', 'stats',
    ];
    for (const f of FORBIDDEN) delete updates[f];

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password');
    res.json({ success: true, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
  }
});

// Delete user
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
  }
});

// Update settings
router.put('/:id/settings', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    user.settings = { ...user.settings, ...req.body };
    await user.save();
    res.json({ success: true, settings: user.settings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
  }
});

module.exports = router;
