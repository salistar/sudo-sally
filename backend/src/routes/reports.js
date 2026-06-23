const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const auth = require('../middleware/auth');

// Submit a moderation report (UGC policy). Any authenticated user can report a
// player / a match's chat or call. Stored for review; never reveals reporter.
router.post('/', auth, async (req, res) => {
  try {
    const { reportedUser, challengeId, reason, detail, context } = req.body;
    const report = await Report.create({
      reporter: req.user.id,
      reportedUser: reportedUser || undefined,
      challengeId: challengeId || undefined,
      reason: ['harassment', 'hate', 'spam', 'inappropriate', 'cheating', 'other'].includes(reason) ? reason : 'other',
      detail: typeof detail === 'string' ? detail.slice(0, 1000) : undefined,
      context: typeof context === 'string' ? context.slice(0, 20) : undefined,
    });
    res.status(201).json({ success: true, reportId: report._id });
  } catch (error) {
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
  }
});

module.exports = router;
