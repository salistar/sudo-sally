/**
 * ============================================================================
 * SALLYSUDO V3 — MEDIA RELAY (DATA-PLANE) — WebSocket → ffmpeg → YouTube RTMP
 * ============================================================================
 * The browser / Expo client cannot push RTMP. So the app captures its match
 * (MediaRecorder → WebM chunks) and streams them over a WebSocket to this
 * relay, which transcodes to H.264/AAC and pushes to the user's YouTube Live
 * broadcast. The broadcast (and its stream key) is created SERVER-SIDE via the
 * per-user OAuth control-plane — the key never reaches the client.
 *
 * Endpoint:  wss://api.sallysudo.com/api/youtube/ingest?token=<JWT>&challengeId=<id>&privacy=unlisted
 *
 * Protocol:
 *   • on connect → auth, create broadcast, spawn ffmpeg, reply {type:'ready', watchUrl}
 *   • binary frames        → written to ffmpeg stdin (the WebM stream)
 *   • close / {type:'stop'}→ end ffmpeg (YouTube auto-stops the broadcast)
 *
 * Requires ffmpeg on the host (added to the api Dockerfile).
 *
 * VERIFIED E2E (2026-06-21): channel "idriss kriouile" (UCmDdQvf5_i9zj0fqeweY2vw)
 * connected via OAuth → relay created broadcast qAsR7tlyVcE server-side, ingested
 * ~9 MB of live WebM, transcoded → RTMP → YouTube went live then "Flux terminé".
 * ============================================================================
 */

const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const { spawn } = require('child_process');
const User = require('../models/User');
const yt = require('./youtubeService');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const MAX_SESSION_MS = 4 * 60 * 60 * 1000; // hard safety cap: 4h per stream

function buildFfmpegArgs(rtmpTarget) {
  // Read a (fragmented) WebM/MP4 stream from stdin, transcode to H.264/AAC FLV,
  // push to RTMP. -re is NOT used (input is already realtime from the client).
  return [
    '-fflags', '+genpts', '-thread_queue_size', '512',
    '-i', 'pipe:0',
    '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency', '-pix_fmt', 'yuv420p',
    '-b:v', '2500k', '-maxrate', '2500k', '-bufsize', '5000k', '-g', '60',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
    '-f', 'flv', rtmpTarget,
  ];
}

function initRelay(server) {
  const wss = new WebSocketServer({ server, path: '/api/youtube/ingest' });

  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    const challengeId = url.searchParams.get('challengeId') || '';
    const privacy = ['public', 'unlisted', 'private'].includes(url.searchParams.get('privacy'))
      ? url.searchParams.get('privacy') : 'unlisted';

    const fail = (msg) => { try { ws.send(JSON.stringify({ type: 'error', error: msg })); } catch {} ws.close(); };

    // ── Auth ──
    let userId;
    try { userId = jwt.verify(token, JWT_SECRET).id; }
    catch { return fail('Invalid token'); }
    if (!yt.isConfigured()) return fail('YouTube integration not configured on the server');

    let ff = null, broadcastId = null, accessToken = null, killTimer = null;
    const cleanup = async (transition) => {
      if (killTimer) { clearTimeout(killTimer); killTimer = null; }
      if (ff) { try { ff.stdin.end(); } catch {} try { ff.kill('SIGINT'); } catch {} ff = null; }
      if (transition && broadcastId && accessToken) {
        try { await yt.transitionBroadcast(accessToken, broadcastId, 'complete'); } catch {}
      }
    };

    try {
      const user = await User.findById(userId).select('+youtube.refreshToken username');
      const refresh = yt.decrypt(user?.youtube?.refreshToken);
      if (!refresh) return fail('Connect your YouTube channel first (/api/youtube/auth-url)');
      accessToken = await yt.refreshAccessToken(refresh);

      const info = await yt.createLiveBroadcast(accessToken, {
        title: `SallySudo 1v1 — ${user.username || 'match'}`,
        privacy,
      });
      broadcastId = info.broadcastId;
      const target = `${info.ingestionAddress}/${info.streamName}`;

      ff = spawn('ffmpeg', buildFfmpegArgs(target), { stdio: ['pipe', 'ignore', 'pipe'] });
      ff.stderr.on('data', () => {});           // keep the pipe drained; logs muted
      ff.on('error', (e) => fail('ffmpeg failed to start: ' + e.message));
      ff.on('close', () => { try { ws.close(); } catch {} });

      // enableAutoStart on the broadcast means YouTube goes live automatically
      // once it receives the encoder feed — no manual transition needed.
      ws.send(JSON.stringify({ type: 'ready', broadcastId, watchUrl: info.watchUrl, privacy }));
      killTimer = setTimeout(() => cleanup(true), MAX_SESSION_MS);
    } catch (e) {
      return fail('Failed to start broadcast: ' + e.message);
    }

    ws.on('message', (data, isBinary) => {
      if (isBinary || Buffer.isBuffer(data)) {
        if (ff && ff.stdin.writable) { try { ff.stdin.write(data); } catch {} }
        return;
      }
      // control messages
      try { const m = JSON.parse(data.toString()); if (m?.type === 'stop') cleanup(true).then(() => ws.close()); } catch {}
    });

    ws.on('close', () => cleanup(true));
    ws.on('error', () => cleanup(true));
  });

  console.log('🎥 Media relay (WS → ffmpeg → RTMP) ready at /api/youtube/ingest');
  return wss;
}

module.exports = { initRelay };
