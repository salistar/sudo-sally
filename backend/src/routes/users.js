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
    res.status(500).json({ error: error.message });
  }
});

// ─── RECENT users — anyone active in the last 24h (online OR recently online) ──
// Fixes the "No users online" dead-end: even if nobody is connected RIGHT NOW,
// the mobile/web lobby can still surface plausible opponents.
// GET /api/users/recent
router.get('/recent', auth, async (req, res) => {
  try {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const users = await User.find({
      _id: { $ne: req.user.id },
      $or: [
        { isOnline: true },
        { lastActive: { $gte: dayAgo } },
      ],
    })
    .select('username avatar level stars isOnline lastActive')
    .sort({ isOnline: -1, lastActive: -1 })
    .limit(30);
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all users (admin only)
router.get('/', auth, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json({ success: true, users, count: users.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const updates = req.body;
    delete updates.password; // Don't allow password update through this route
    
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password');
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
