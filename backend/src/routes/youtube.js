/**
 * ============================================================================
 * SALLYSUDO V3 — YOUTUBE LIVE ROUTES (/api/youtube)
 * ============================================================================
 * Control-plane for per-user YouTube Live:
 *   GET  /auth-url          (auth)   → Google consent URL for this user
 *   GET  /callback          (public) → Google redirects here with ?code
 *   GET  /status            (auth)   → { connected, channelTitle }
 *   POST /live/create       (auth)   → create broadcast+stream → RTMP url+key
 *   POST /live/transition   (auth)   → go live / complete a broadcast
 *   POST /disconnect        (auth)   → revoke stored token
 *
 * The user pushes video to the returned RTMP url+key with an encoder. This
 * service never touches the media stream itself.
 * ============================================================================
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const yt = require('../services/youtubeService');

const { JWT_SECRET } = require('../config/jwt');
// Where to send the browser after the OAuth dance finishes.
const WEB_RETURN = process.env.YT_RETURN_URL || 'https://app.sallysudo.com/challenges';

function notConfigured(res) {
  return res.status(503).json({
    success: false,
    error: 'YouTube integration not configured on the server (missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).',
  });
}

// Resolve a fresh access token for a user from their stored refresh token.
// refreshToken is select:false, so re-fetch it explicitly here.
async function accessTokenFor(user) {
  const full = await User.findById(user._id).select('+youtube.refreshToken');
  const refresh = yt.decrypt(full?.youtube?.refreshToken);
  if (!refresh) throw new Error('YouTube not connected for this account');
  return yt.refreshAccessToken(refresh);
}

// ── GET /api/youtube/auth-url ───────────────────────────────────────────────
router.get('/auth-url', auth, async (req, res) => {
  if (!yt.isConfigured()) return notConfigured(res);
  // Short-lived signed state ties the callback back to this user. `platform`
  // lets the callback redirect to the web app or a native deep link.
  const platform = req.query.platform === 'mobile' ? 'mobile' : 'web';
  const state = jwt.sign({ uid: req.user._id.toString(), platform }, JWT_SECRET, { expiresIn: '15m' });
  res.json({ success: true, url: yt.buildConsentUrl(state) });
});

// ── GET /api/youtube/callback (Google redirect, no auth header) ─────────────
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  // HTML-escape everything reflected into this PUBLIC, no-auth page (was a
  // reflected XSS: ?error=<script>… executed on api.sallysudo.com).
  const esc = (s) => String(s == null ? '' : s).replace(/[<>&"']/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
  const fail = (msg) => res
    .status(400)
    .send(`<html><body style="font-family:sans-serif;background:#0a0a1a;color:#fff;text-align:center;padding-top:80px">
      <h2>❌ YouTube connection failed</h2><p>${esc(msg)}</p></body></html>`);
  if (error) return fail('Authorization was denied or cancelled.');
  if (!code || !state) return fail('Missing code/state');
  if (!yt.isConfigured()) return fail('Server not configured');

  let decoded;
  try { decoded = jwt.verify(String(state), JWT_SECRET); }
  catch { return fail('Invalid or expired state'); }

  try {
    const tokens = await yt.exchangeCodeForTokens(String(code));
    const accessToken = tokens.access_token;
    const channel = await yt.getMyChannel(accessToken).catch(() => null);

    const update = {
      'youtube.connected': true,
      'youtube.scope': tokens.scope || yt.SCOPES.join(' '),
      'youtube.connectedAt': new Date(),
      'youtube.channelId': channel?.channelId,
      'youtube.channelTitle': channel?.channelTitle,
    };
    // Google only returns refresh_token on first consent (we force prompt=consent
    // so it should be present); keep the existing one otherwise.
    if (tokens.refresh_token) update['youtube.refreshToken'] = yt.encrypt(tokens.refresh_token);

    await User.findByIdAndUpdate(decoded.uid, { $set: update });

    if (decoded.platform === 'mobile') {
      // Bounce into the app via deep link.
      return res.redirect(`sudokusallyv3://youtube?connected=1`);
    }
    return res.redirect(`${WEB_RETURN}?youtube=connected`);
  } catch (e) {
    console.error('YouTube callback error:', e.message);
    return fail(process.env.NODE_ENV === 'production' ? 'Connection failed, please retry.' : e.message);
  }
});

// ── GET /api/youtube/status ─────────────────────────────────────────────────
router.get('/status', auth, async (req, res) => {
  const y = req.user.youtube || {};
  res.json({
    success: true,
    configured: yt.isConfigured(),
    connected: !!y.connected,
    channelTitle: y.channelTitle || null,
    channelId: y.channelId || null,
  });
});

// ── POST /api/youtube/live/create ───────────────────────────────────────────
// body: { title?, privacy?: 'public'|'unlisted'|'private' }
router.post('/live/create', auth, async (req, res) => {
  if (!yt.isConfigured()) return notConfigured(res);
  try {
    const accessToken = await accessTokenFor(req.user);
    const { title, privacy } = req.body || {};
    const info = await yt.createLiveBroadcast(accessToken, {
      title: title || `SallySudo 1v1 — ${req.user.username}`,
      privacy: ['public', 'unlisted', 'private'].includes(privacy) ? privacy : 'unlisted',
    });
    // info contains the stream key — only returned to the authenticated owner.
    res.json({ success: true, ...info });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// ── POST /api/youtube/live/transition ───────────────────────────────────────
// body: { broadcastId, status: 'live'|'complete'|'testing' }
router.post('/live/transition', auth, async (req, res) => {
  if (!yt.isConfigured()) return notConfigured(res);
  const { broadcastId, status } = req.body || {};
  if (!broadcastId || !['live', 'complete', 'testing'].includes(status)) {
    return res.status(400).json({ success: false, error: 'broadcastId + valid status required' });
  }
  try {
    const accessToken = await accessTokenFor(req.user);
    const out = await yt.transitionBroadcast(accessToken, broadcastId, status);
    res.json({ success: true, status: out?.status });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// ── POST /api/youtube/disconnect ────────────────────────────────────────────
router.post('/disconnect', auth, async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    $set: { youtube: { connected: false } },
  });
  res.json({ success: true });
});

module.exports = router;
