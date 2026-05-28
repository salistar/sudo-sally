/**
 * GET /api/turn-creds
 * Returns short-lived ICE servers config (STUN + TURN time-limited credentials)
 * for the Sudoku Sally WebRTC calls.
 *
 * Uses coturn's "use-auth-secret" pattern: username = "<expiry-unix>:<userid>",
 * password = base64(HMAC-SHA1(secret, username)).
 *
 * Set TURN_SHARED_SECRET in deploy/.env.prod for this to work; otherwise the
 * endpoint returns STUN-only and the call falls back to direct/STUN.
 */
const express = require('express');
const crypto = require('crypto');
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
    const ttlSec = 6 * 3600;                                  // 6h credentials
    const expiry = Math.floor(Date.now() / 1000) + ttlSec;
    const userId = (req.headers['x-user-id'] || 'sudoku').toString().replace(/[^\w-]/g, '');
    const username = `${expiry}:${userId}`;
    const password = crypto.createHmac('sha1', secret).update(username).digest('base64');
    iceServers.push(
      { urls: `turn:${host}:3478?transport=udp`, username, credential: password },
      { urls: `turn:${host}:3478?transport=tcp`, username, credential: password },
    );
  }

  res.json({ iceServers, ttlSec: 6 * 3600, realm });
});

module.exports = router;
