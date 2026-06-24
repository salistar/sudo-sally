/**
 * GET /api/turn-creds
 * Returns short-lived ICE servers config (STUN + TURN time-limited credentials)
 * for the SallySudo WebRTC calls.
 *
 * Uses coturn's "use-auth-secret" pattern: username = "<expiry-unix>:<userid>",
 * password = base64(HMAC-SHA1(secret, username)).
 *
 * Set TURN_SHARED_SECRET in deploy/.env.prod for this to work; otherwise the
 * endpoint returns STUN-only and the call falls back to direct/STUN.
 */
const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const router = express.Router();

router.get('/turn-creds', (req, res) => {
  const secret = process.env.TURN_SHARED_SECRET;
  const realm  = process.env.TURN_REALM  || 'turn.salistar.com';
  const host   = process.env.TURN_HOST   || 'turn.salistar.com';
  // STUN is always safe to publish
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  if (secret) {
    const ttlSec = 3600;                                     // 1h credentials (was 6h)
    const expiry = Math.floor(Date.now() / 1000) + ttlSec;
    // Derive the TURN username from the AUTHENTICATED user when a token is
    // present (Authorization header or ?token=), NOT a client-supplied
    // x-user-id header (which was spoofable). Fall back to a random, non-
    // guessable id so the endpoint still works for the current unauthenticated
    // client without letting the caller pick its own attribution string.
    let userId = crypto.randomBytes(8).toString('hex');
    try {
      const raw = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.query.token;
      if (raw) {
        const decoded = jwt.verify(String(raw), process.env.JWT_SECRET || 'secret');
        if (decoded?.id) userId = String(decoded.id).replace(/[^\w-]/g, '');
      }
    } catch { /* invalid/absent token → keep the random id */ }
    const username = `${expiry}:${userId}`;
    const password = crypto.createHmac('sha1', secret).update(username).digest('base64');
    iceServers.push(
      { urls: `turn:${host}:3478?transport=udp`, username, credential: password },
      { urls: `turn:${host}:3478?transport=tcp`, username, credential: password },
    );
  }

  res.json({ iceServers, ttlSec: 3600, realm });
});

module.exports = router;
