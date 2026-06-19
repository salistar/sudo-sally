const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'secret', {
    expiresIn: process.env.JWT_EXPIRE || '30d'
  });
};

// Audience whitelist for Google ID tokens. The mobile native SDK mints tokens
// whose `aud` claim is the WEB OAuth client ID (this is by design for Android
// — Google docs: "If you use Sign In With Google, set the audience to your
// server's web client ID"). The web build uses Google Identity Services which
// also gives a token with the web client ID as `aud`. So one allowed aud value
// covers both surfaces. Extra IDs are accepted for forward-compatibility.
const GOOGLE_ALLOWED_AUDS = (process.env.GOOGLE_ALLOWED_AUDS ||
  '106972968307-o1m39edcftpo3r77q856o87o29b1ai4u.apps.googleusercontent.com,' +
  '106972968307-2d38675a5rkl8vgkppll7f9ab5fe96oe.apps.googleusercontent.com'
).split(',').map(s => s.trim()).filter(Boolean);

/** Verify a Google ID token without pulling a heavyweight library.
 *  We hit Google's free tokeninfo endpoint — it validates signature, exp, iss
 *  and returns the claims. ~50 ms p95. For >1k logins/s switch to local JWK
 *  validation, but that's a future-us problem.
 */
async function verifyGoogleIdToken(idToken) {
  if (!idToken || typeof idToken !== 'string') throw new Error('idToken missing');
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`tokeninfo HTTP ${res.status}`);
  const data = await res.json();
  if (data.error || data.error_description) throw new Error(data.error_description || data.error);
  // iss = https://accounts.google.com  or  accounts.google.com
  if (!/(^https:\/\/)?accounts\.google\.com$/.test(data.iss || '')) {
    throw new Error(`bad iss: ${data.iss}`);
  }
  if (!GOOGLE_ALLOWED_AUDS.includes(data.aud)) {
    throw new Error(`bad aud: ${data.aud}`);
  }
  if (data.exp && Number(data.exp) * 1000 < Date.now()) throw new Error('token expired');
  if (!data.sub) throw new Error('no sub claim');
  return data; // { sub, email, email_verified, name, picture, given_name, family_name, ... }
}

// Register new user
exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Create user — auto-unlock the "welcome" achievement so the
    // Achievements screen reads 1/N instead of a depressing 0/N for a
    // brand-new account.
    const user = await User.create({
      username, email, password,
      achievements: [{ achievementId: 'welcome', unlockedAt: new Date() }],
    });
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
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
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
    
    // Update last login + lastActive so the lobby's /users/recent surfaces
    // anyone who has logged in lately, even without a live WebSocket session.
    user.lastLogin = new Date();
    user.lastActive = new Date();
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
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
  }
};

// Get current user
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -googleId');
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
  }
};

/**
 * Google sign-in. Body: { idToken: string }
 *  - Native client (react-native-google-signin) sends GoogleSignin.signIn().idToken
 *  - Web client (Google Identity Services button) sends credentialResponse.credential
 * Both are Google ID tokens (JWS signed by Google). We verify, then upsert a
 * user keyed by the Google `sub` (stable account ID), and respond with our
 * own JWT so the rest of the app keeps using the same auth header.
 */
exports.googleAuth = async (req, res) => {
  try {
    const idToken = req.body?.idToken || req.body?.credential;
    if (!idToken) return res.status(400).json({ error: 'idToken required' });

    const claims = await verifyGoogleIdToken(idToken);
    const { sub, email, email_verified, name, picture, given_name } = claims;

    // 1) Find by Google sub (most reliable — same Google account always wins)
    let user = await User.findOne({ googleId: sub });

    // 2) If no Google-linked account yet but an account already uses that
    //    email, link them. Avoids creating duplicate accounts when the user
    //    had registered with email/password and now clicks "Sign in with Google".
    if (!user && email) user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      // Link Google to existing account if it wasn't already
      if (!user.googleId) {
        user.googleId = sub;
        user.picture = picture || user.picture;
        user.emailVerified = email_verified === true || user.emailVerified;
        user.lastLogin = new Date();
        await user.save();
      } else {
        user.lastLogin = new Date();
        await user.save();
      }
    } else {
      // Create a fresh account. Pick a unique username from the Google name.
      const base = (given_name || (name || '').split(' ')[0] || (email || 'player').split('@')[0])
        .toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16) || 'player';
      let username = base;
      let attempt = 0;
      while (await User.findOne({ username })) {
        attempt++;
        username = `${base}${attempt}`;
        if (attempt > 50) { username = `${base}${crypto.randomBytes(3).toString('hex')}`; break; }
      }
      // Password is required by the schema but never used for Google accounts.
      const randomPwd = crypto.randomBytes(24).toString('hex');
      user = await User.create({
        username,
        email: (email || `${sub}@google.local`).toLowerCase(),
        password: randomPwd,
        achievements: [{ achievementId: 'welcome', unlockedAt: new Date() }],
        googleId: sub,
        picture,
        emailVerified: email_verified === true,
        avatar: '🎮',
        lastLogin: new Date(),
      });
    }

    const token = generateToken(user._id);
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        picture: user.picture,
        level: user.level, xp: user.xp, coins: user.coins, stars: user.stars,
        stats: user.stats, settings: user.settings,
        completedLevels: user.completedLevels,
        unlockedThemes: user.unlockedThemes,
        achievements: user.achievements,
      },
      provider: 'google',
    });
  } catch (e) {
    console.log('[auth/google] failed:', e?.message || e);
    res.status(401).json({ error: 'Google sign-in failed', detail: String(e?.message || e) });
  }
};

// Guest login
exports.guestLogin = async (req, res) => {
  try {
    // Crypto-strong: Math.random() guest passwords were predictable. The
    // password must be unguessable since a guest account holds progress/coins.
    const suffix = crypto.randomBytes(6).toString('hex');
    const user = await User.create({
      username: 'Guest_' + suffix,
      email: 'guest_' + suffix + '@guest.local',
      password: crypto.randomBytes(24).toString('hex'),
      role: 'user',
      coins: 50,
      achievements: [{ achievementId: 'welcome', unlockedAt: new Date() }],
    });
    
    const token = generateToken(user._id);
    const { password, googleId, ...safe } = user.toObject();
    res.status(201).json({ success: true, token, user: safe, isGuest: true });
  } catch (error) {
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message });
  }
};
