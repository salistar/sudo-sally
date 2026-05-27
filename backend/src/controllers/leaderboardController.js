const User = require('../models/User');
const LeaderboardEntry = require('../models/Leaderboard');

// Get global leaderboard
exports.getGlobal = async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const leaderboard = await User.find()
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
    res.status(500).json({ error: error.message });
  }
};

// Get weekly leaderboard
exports.getWeekly = async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    // Get current week key
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
    const periodKey = `${now.getFullYear()}-W${weekNumber}`;
    
    const entries = await LeaderboardEntry.find({ period: 'weekly', periodKey })
      .populate('user', 'username avatar')
      .sort({ stars: -1 })
      .limit(parseInt(limit));
    
    res.json({ success: true, leaderboard: entries, period: periodKey });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get user rank
exports.getUserRank = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const higherRanked = await User.countDocuments({ stars: { $gt: user.stars } });
    
    res.json({
      success: true,
      rank: higherRanked + 1,
      stars: user.stars,
      gamesWon: user.stats.gamesWon
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
