const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'secret', {
    expiresIn: process.env.JWT_EXPIRE || '30d'
  });
};

// Register new user
exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Create user
    const user = await User.create({ username, email, password });
    const token = generateToken(user._id);
    
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        level: user.level,
        xp: user.xp,
        coins: user.coins,
        stars: user.stars,
        stats: user.stats,
        settings: user.settings
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    
    const token = generateToken(user._id);
    
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        level: user.level,
        xp: user.xp,
        coins: user.coins,
        stars: user.stars,
        stats: user.stats,
        settings: user.settings,
        completedLevels: user.completedLevels,
        unlockedThemes: user.unlockedThemes,
        ownedPowerups: user.ownedPowerups,
        achievements: user.achievements
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get current user
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Guest login
exports.guestLogin = async (req, res) => {
  try {
    const guestId = 'guest_' + Math.random().toString(36).substr(2, 9);
    const user = await User.create({
      username: 'Guest_' + guestId.substr(6),
      email: guestId + '@guest.local',
      password: guestId,
      role: 'user',
      coins: 50
    });
    
    const token = generateToken(user._id);
    res.status(201).json({ success: true, token, user, isGuest: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
