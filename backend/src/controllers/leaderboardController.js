const mongoose = require('mongoose');
const User = require('../models/User');
const Game = require('../models/Game');
const Challenge = require('../models/Challenge');

// Guests are throwaway accounts (trivially farmable) — keep them OFF the public
// rankings. They can still play; they just don't pollute the boards.
const NON_GUEST = { username: { $not: /^Guest_/i } };

// Monday 00:00 of the current week (local) — the weekly reset boundary.
function startOfWeek(now = new Date()) {
  const day = now.getDay();               // 0=Sun..6=Sat
  const sinceMonday = day === 0 ? 6 : day - 1;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - sinceMonday);
}

// Get global leaderboard
exports.getGlobal = async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const leaderboard = await User.find(NON_GUEST)
      .select('username avatar stars stats.gamesWon level')
      .sort({ stars: -1, 'stats.gamesWon': -1 })
      .limit(parseInt(limit));
    
    const ranked = leaderboard.map((user, index) => ({
      rank: index + 1,
      userId: user._id,
      username: user.username,
      avatar: user.avatar,
      stars: user.stars,
      gamesWon: user.stats.gamesWon,
      level: user.level
    }));
    
    res.json({ success: true, leaderboard: ranked });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
  }
};

// Get weekly leaderboard — REAL aggregation of stars earned THIS week from
// actual solo wins (Game) + duel wins (Challenge). Was a dead stub reading a
// LeaderboardEntry collection that nothing ever wrote → always empty.
exports.getWeekly = async (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const weekStart = startOfWeek();
    const periodKey = weekStart.toISOString().slice(0, 10);

    // Solo wins this week → sum of stars + win count, per user.
    const soloAgg = await Game.aggregate([
      { $match: { status: 'won', completedAt: { $gte: weekStart } } },
      { $group: { _id: '$user', stars: { $sum: { $ifNull: ['$stars', 0] } }, wins: { $sum: 1 } } },
    ]);
    // Duel wins this week → 3 stars each (matches updateUserStats), per winner.
    const duelAgg = await Challenge.aggregate([
      { $match: { status: 'completed', completedAt: { $gte: weekStart }, winner: { $ne: null } } },
      { $group: { _id: '$winner', stars: { $sum: 3 }, wins: { $sum: 1 } } },
    ]);

    // Merge the two sources by user.
    const byUser = new Map();
    for (const r of [...soloAgg, ...duelAgg]) {
      if (!r._id) continue;
      const k = String(r._id);
      const cur = byUser.get(k) || { stars: 0, wins: 0 };
      cur.stars += r.stars || 0; cur.wins += r.wins || 0;
      byUser.set(k, cur);
    }

    const ids = [...byUser.keys()].map((id) => new mongoose.Types.ObjectId(id));
    const users = await User.find({ _id: { $in: ids }, ...NON_GUEST }).select('username avatar level');
    const board = users
      .map((u) => ({
        userId: u._id,
        username: u.username,
        avatar: u.avatar,
        level: u.level,
        weeklyStars: byUser.get(String(u._id)).stars,
        weeklyWins: byUser.get(String(u._id)).wins,
      }))
      .sort((a, b) => b.weeklyStars - a.weeklyStars || b.weeklyWins - a.weeklyWins)
      .slice(0, limit)
      .map((e, i) => ({ rank: i + 1, ...e }));

    res.json({ success: true, leaderboard: board, period: periodKey, weekStart });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
  }
};

// Get user rank
exports.getUserRank = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    // Rank must use the SAME ordering as GET /leaderboard (stars desc, then
    // stats.gamesWon desc) — otherwise everyone tied on stars gets the same
    // rank, which doesn't match their actual row in the board.
    const higherRanked = await User.countDocuments({
      ...NON_GUEST,
      $or: [
        { stars: { $gt: user.stars } },
        { stars: user.stars, 'stats.gamesWon': { $gt: user.stats?.gamesWon || 0 } },
      ],
    });

    res.json({
      success: true,
      rank: higherRanked + 1,
      stars: user.stars,
      gamesWon: user.stats.gamesWon
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
  }
};
