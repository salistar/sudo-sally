/**
 * ============================================================================
 * SALLYSUDO V3 — YOUTUBE LIVE CONTROL-PLANE SERVICE
 * ============================================================================
 * Per-user YouTube Live integration (OAuth 2.0 + Live Streaming API).
 *
 * This is the CONTROL plane only: it authorizes a user's channel, then creates
 * / transitions / ends a live broadcast and hands back the RTMP ingestion URL
 * and stream key. The DATA plane (pushing the actual video to that RTMP URL)
 * is done by an encoder (the desktop ffmpeg bridge today, a media-relay later)
 * — never by this service.
 *
 * Secrets: the user's long-lived refresh token is encrypted at rest
 * (AES-256-GCM) with TOKEN_ENC_KEY. The Google client secret lives ONLY in the
 * backend env, never reaches any client.
 *
 * Node 18+ provides global fetch — no extra dependency needed.
 * ============================================================================
 */

const crypto = require('crypto');

const GOOGLE_AUTH_URL  = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const YT_API = 'https://www.googleapis.com/youtube/v3';

// Scope needed to create + manage live broadcasts on the user's channel.
const SCOPES = ['https://www.googleapis.com/auth/youtube.force-ssl'];
const { JWT_SECRET } = require('../config/jwt');

function cfg() {
  return {
    clientId:     process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri:  process.env.GOOGLE_REDIRECT_URI || 'https://api.sallysudo.com/api/youtube/callback',
  };
}

function isConfigured() {
  const c = cfg();
  return !!(c.clientId && c.clientSecret);
}

// ── Refresh-token encryption (AES-256-GCM) ──────────────────────────────────
// Key: 32 bytes. From TOKEN_ENC_KEY (64-hex) if present, else derived from
// JWT_SECRET so the feature still works in dev without extra config.
let _warnedNoEncKey = false;
function encKey() {
  const raw = process.env.TOKEN_ENC_KEY;
  if (raw && /^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  // Fallback (kept so the existing encrypted refresh token still decrypts):
  // derive from JWT_SECRET. In production, warn ONCE that a dedicated key is
  // safer — but never throw, so rotating to a real TOKEN_ENC_KEY stays a
  // deliberate op (it would require re-connecting YouTube) rather than a crash.
  if (process.env.NODE_ENV === 'production' && !_warnedNoEncKey) {
    _warnedNoEncKey = true;
    console.warn('[youtube] TOKEN_ENC_KEY not set — deriving token-encryption key from JWT_SECRET. Set a dedicated 64-hex TOKEN_ENC_KEY so rotating JWT_SECRET cannot orphan stored refresh tokens.');
  }
  return crypto.scryptSync(JWT_SECRET, 'yt-token-enc', 32);
}

function encrypt(plain) {
  if (plain == null) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

function decrypt(blob) {
  if (!blob || typeof blob !== 'string' || !blob.includes(':')) return null;
  try {
    const [ivHex, tagHex, dataHex] = blob.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', encKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

// ── OAuth flow ──────────────────────────────────────────────────────────────
// `state` ties the consent redirect back to the requesting user (a short-lived
// signed value the route layer builds with the JWT secret).
function buildConsentUrl(state) {
  const c = cfg();
  const p = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: c.redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',     // → we receive a refresh_token
    prompt: 'consent',          // force refresh_token even on re-auth
    include_granted_scopes: 'true',
    state,
  });
  return `${GOOGLE_AUTH_URL}?${p.toString()}`;
}

async function exchangeCodeForTokens(code) {
  const c = cfg();
  const body = new URLSearchParams({
    code,
    client_id: c.clientId,
    client_secret: c.clientSecret,
    redirect_uri: c.redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`token exchange failed: ${data.error || res.status} ${data.error_description || ''}`);
  return data; // { access_token, refresh_token, expires_in, scope, token_type }
}

async function refreshAccessToken(refreshToken) {
  const c = cfg();
  const body = new URLSearchParams({
    client_id: c.clientId,
    client_secret: c.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`token refresh failed: ${data.error || res.status}`);
  return data.access_token;
}

// ── YouTube Data / Live API ─────────────────────────────────────────────────
async function ytFetch(accessToken, path, { method = 'GET', query, body } = {}) {
  const url = new URL(`${YT_API}/${path}`);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`YouTube API ${path} → ${res.status} ${data?.error?.message || ''}`);
  return data;
}

async function getMyChannel(accessToken) {
  const data = await ytFetch(accessToken, 'channels', { query: { part: 'snippet', mine: 'true' } });
  const ch = data.items?.[0];
  return ch ? { channelId: ch.id, channelTitle: ch.snippet?.title } : null;
}

/**
 * Create a live broadcast + bound stream and return the RTMP ingestion info.
 * The caller (encoder) pushes video to `${ingestionAddress}/${streamName}`.
 */
async function createLiveBroadcast(accessToken, { title, description = '', privacy = 'unlisted', selfDeclaredMadeForKids = false } = {}) {
  const startTime = new Date(Date.now() + 5000).toISOString();
  const broadcast = await ytFetch(accessToken, 'liveBroadcasts', {
    method: 'POST',
    query: { part: 'snippet,status,contentDetails' },
    body: {
      snippet: { title: title || 'SallySudo 1v1 — Live', description, scheduledStartTime: startTime },
      status: { privacyStatus: privacy, selfDeclaredMadeForKids },
      contentDetails: { enableAutoStart: true, enableAutoStop: true, latencyPreference: 'low' },
    },
  });
  const stream = await ytFetch(accessToken, 'liveStreams', {
    method: 'POST',
    query: { part: 'snippet,cdn,contentDetails' },
    body: {
      snippet: { title: title || 'SallySudo 1v1 — Stream' },
      cdn: { frameRate: 'variable', ingestionType: 'rtmp', resolution: 'variable' },
      contentDetails: { isReusable: false },
    },
  });
  // Bind the stream to the broadcast.
  await ytFetch(accessToken, 'liveBroadcasts/bind', {
    method: 'POST',
    query: { id: broadcast.id, part: 'id,contentDetails', streamId: stream.id },
  });
  const ing = stream.cdn?.ingestionInfo || {};
  return {
    broadcastId: broadcast.id,
    streamId: stream.id,
    ingestionAddress: ing.ingestionAddress,   // rtmp://a.rtmp.youtube.com/live2
    streamName: ing.streamName,               // the per-broadcast stream key
    watchUrl: `https://www.youtube.com/watch?v=${broadcast.id}`,
    privacy,
  };
}

async function transitionBroadcast(accessToken, broadcastId, status /* 'testing'|'live'|'complete' */) {
  return ytFetch(accessToken, 'liveBroadcasts/transition', {
    method: 'POST',
    query: { id: broadcastId, broadcastStatus: status, part: 'id,status' },
  });
}

module.exports = {
  isConfigured,
  SCOPES,
  encrypt,
  decrypt,
  buildConsentUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  getMyChannel,
  createLiveBroadcast,
  transitionBroadcast,
};
