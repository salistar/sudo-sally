const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // ============ BASIC INFO ============
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  avatar: { type: String, default: '🎮' },
  role: { type: String, enum: ['user', 'premium', 'admin'], default: 'user' },

  // ============ AUTH PROVIDERS ============
  // Set when the user signs in with Google. Either platform (mobile native /
  // web Identity Services) sends us the verified Google `sub` claim.
  googleId: { type: String, index: true, sparse: true, unique: true },
  picture: { type: String },          // Google profile picture URL (optional)
  emailVerified: { type: Boolean, default: false },

  // ============ YOUTUBE LIVE (per-user OAuth, control-plane) ============
  // Set when the user connects their YouTube channel. refreshToken is stored
  // ENCRYPTED (AES-256-GCM, see services/youtubeService.js) — never plaintext,
  // and `select:false` so it never leaks via a default User query.
  youtube: {
    connected: { type: Boolean, default: false },
    channelId: { type: String },
    channelTitle: { type: String },
    refreshToken: { type: String, select: false },
    scope: { type: String },
    connectedAt: { type: Date },
  },

  // ============ PROGRESSION ============
  level: { type: Number, default: 1 },
  xp: { type: Number, default: 0 },
  coins: { type: Number, default: 100 },
  stars: { type: Number, default: 0 },
  completedLevels: [{ type: Number }],
  currentLevel: { type: Number, default: 1 },
  
  // ============ SHOP & CUSTOMIZATION ============
  unlockedThemes: [String],
  powerups: {
    hint: { type: Number, default: 3 },
    freeze: { type: Number, default: 1 },
    check: { type: Number, default: 1 }
  },
  
  // ============ GAME STATISTICS ============
  stats: {
    gamesPlayed: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    totalTime: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    bestStreak: { type: Number, default: 0 },
    perfectGames: { type: Number, default: 0 },
    hintsUsed: { type: Number, default: 0 },
    // Challenge stats
    challengesWon: { type: Number, default: 0 },
    challengesLost: { type: Number, default: 0 },
    challengesPlayed: { type: Number, default: 0 }
  },
  
  // ============ DAILY CHALLENGE ============
  dailyChallenge: {
    lastPlayed: { type: Date },
    streak: { type: Number, default: 0 },
    bestStreak: { type: Number, default: 0 }
  },
  
  // ============ ACHIEVEMENTS ============
  achievements: [{
    achievementId: String,
    unlockedAt: { type: Date, default: Date.now }
  }],
  
  // ============ SETTINGS ============
  settings: {
    language: { type: String, default: 'en' },
    sound: { type: Boolean, default: true },
    music: { type: Boolean, default: true },
    vibration: { type: Boolean, default: true },
    notifications: { type: Boolean, default: true },
    theme: { type: String, default: 'default' }
  },
  
  // ============ ONLINE STATUS (for Challenges) ============
  isOnline: { type: Boolean, default: false },
  lastActive: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now }
  
}, { timestamps: true });

// ============ MIDDLEWARE ============

// Hash password before save
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// ============ METHODS ============

// Compare password
userSchema.methods.comparePassword = function(password) {
  return bcrypt.compare(password, this.password);
};

// Calculate level from XP
userSchema.methods.calculateLevel = function() {
  return Math.floor(this.xp / 100) + 1;
};

// Set online status
userSchema.methods.setOnline = function(status) {
  this.isOnline = status;
  this.lastActive = new Date();
  return this.save();
};

// Add XP and update level
userSchema.methods.addXP = function(amount) {
  this.xp += amount;
  this.level = this.calculateLevel();
  return this.save();
};

// ============ INDEXES ============
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ stars: -1 });
userSchema.index({ isOnline: 1, lastActive: -1 });
userSchema.index({ 'stats.challengesWon': -1 });

module.exports = mongoose.model('User', userSchema);