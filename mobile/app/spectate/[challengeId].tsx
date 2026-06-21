/**
 * LIVE SPECTATOR / BROADCAST VIEW — /spectate/<challengeId>
 *
 * Shows BOTH players' boards side-by-side, live, with names + times + errors.
 * Built to be CAPTURED for a YouTube live of a 1v1 — open it on the device we
 * stream (e.g. the phone). It is a pure spectator: it never plays, so it does
 * not touch the normal gameplay screens at all.
 *
 * Data: GET /api/challenges/<id>/spectate (puzzle, names, ids, current boards,
 * times) for the initial frame, then realtime `opponent:progress` socket events
 * — a spectator receives BOTH players' progress because it never sends any.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Dimensions, Platform, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../../utils/api';
import socketService from '../../utils/socket';

const { width } = Dimensions.get('window');
const IS_WEB = Platform.OS === 'web';

// Accept a 9x9 JSON array string, a nested array, or a flat 81-char string.
function parseBoard(s: any): number[] {
  if (!s) return new Array(81).fill(0);
  if (Array.isArray(s)) return s.flat().map((n: any) => parseInt(n, 10) || 0).slice(0, 81);
  if (typeof s === 'string') {
    const t = s.trim();
    if (t.startsWith('[')) { try { return (JSON.parse(t) as any[]).flat().map((n: any) => parseInt(n, 10) || 0).slice(0, 81); } catch {} }
    return t.split('').map((ch) => parseInt(ch, 10) || 0).slice(0, 81);
  }
  return new Array(81).fill(0);
}

const fmt = (s: number) => `${String(Math.floor((s || 0) / 60)).padStart(2, '0')}:${String((s || 0) % 60).padStart(2, '0')}`;

// ── Canvas compositor (web only) ───────────────────────────────────────────
// Draws BOTH live boards onto a 1280×720 canvas so the broadcast captures the
// composed match view directly (canvas.captureStream) instead of the screen —
// no getDisplayMedia dialog, and it works headlessly + inside a mobile WebView.
type Frame = {
  lName: string; rName: string; lTime: number; rTime: number; lErr: number; rErr: number;
  lBoard: number[]; rBoard: number[]; givens: number[]; winnerName: string | null; live: boolean;
};
// Brand: SallySudo uses #7c5cff (purple) as the primary accent, #0a0a1a→#1a1a3a
// gradient bg, gold #fbbf24, cyan #2dd4db for player digits — matched here so the
// broadcast looks like the rest of the app.
const PURPLE = '#7c5cff';
function rrect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  else { ctx.beginPath(); ctx.rect(x, y, w, h); }
}
// Sally the owl — the app's mascot/logo, drawn to match SallyMascot.tsx
// (gradient body #5eead4→#7c5cff→#2dd4db, lilac belly, yellow beak).
function drawOwl(ctx: any, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.fillStyle = '#7c5cff';
  ctx.beginPath(); ctx.moveTo(cx - r * 0.7, cy - r * 0.55); ctx.lineTo(cx - r * 0.32, cy - r * 1.12); ctx.lineTo(cx - r * 0.05, cy - r * 0.5); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx + r * 0.7, cy - r * 0.55); ctx.lineTo(cx + r * 0.32, cy - r * 1.12); ctx.lineTo(cx + r * 0.05, cy - r * 0.5); ctx.closePath(); ctx.fill();
  const bg = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  bg.addColorStop(0, '#5eead4'); bg.addColorStop(0.6, '#7c5cff'); bg.addColorStop(1, '#2dd4db');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.92, r, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ede9ff'; ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.2, r * 0.54, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx - r * 0.38, cy - r * 0.16, r * 0.33, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + r * 0.38, cy - r * 0.16, r * 0.33, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0a0a1a';
  ctx.beginPath(); ctx.arc(cx - r * 0.38, cy - r * 0.16, r * 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + r * 0.38, cy - r * 0.16, r * 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.moveTo(cx, cy + r * 0.06); ctx.lineTo(cx - r * 0.14, cy + r * 0.3); ctx.lineTo(cx + r * 0.14, cy + r * 0.3); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function drawBoardC(ctx: any, x: number, y: number, size: number, board: number[], givens: number[]) {
  const cell = size / 9;
  // soft purple panel behind the board (echoes the app's logo card)
  ctx.fillStyle = 'rgba(124,92,255,0.06)'; rrect(ctx, x - 12, y - 12, size + 24, size + 24, 16); ctx.fill();
  ctx.fillStyle = '#0a0a1a'; ctx.fillRect(x, y, size, size);
  for (let i = 0; i <= 9; i++) {
    const major = i % 3 === 0;
    ctx.strokeStyle = major ? 'rgba(124,92,255,0.55)' : '#262640'; ctx.lineWidth = major ? 2.5 : 1;
    ctx.beginPath(); ctx.moveTo(x + i * cell, y); ctx.lineTo(x + i * cell, y + size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + i * cell); ctx.lineTo(x + size, y + i * cell); ctx.stroke();
  }
  ctx.strokeStyle = PURPLE; ctx.lineWidth = 3; ctx.strokeRect(x, y, size, size);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let idx = 0; idx < 81; idx++) {
    const v = board[idx] || 0; if (!v) continue;
    const given = (givens[idx] || 0) > 0;
    const r = Math.floor(idx / 9), c = idx % 9;
    ctx.fillStyle = given ? '#ffffff' : '#2dd4db';
    ctx.font = `${given ? '800' : '700'} ${Math.floor(cell * 0.55)}px Arial, sans-serif`;
    ctx.fillText(String(v), x + c * cell + cell / 2, y + r * cell + cell / 2 + 1);
  }
}
function drawBroadcastFrame(ctx: any, W: number, H: number, f: Frame) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0a0a1a'); g.addColorStop(0.5, '#1a1a3a'); g.addColorStop(1, '#0f0f2a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // purple glow behind the wordmark (like the home logo's glow)
  const glow = ctx.createRadialGradient(W / 2, 52, 8, W / 2, 52, 240);
  glow.addColorStop(0, 'rgba(124,92,255,0.28)'); glow.addColorStop(1, 'rgba(124,92,255,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, 130);
  // SallySudo logo — owl mascot + wordmark, same lockup as the app header
  drawOwl(ctx, W / 2 - 188, 42, 26);
  if ('letterSpacing' in ctx) try { ctx.letterSpacing = '3px'; } catch {}
  ctx.fillStyle = '#ffffff'; ctx.font = '900 42px Arial, sans-serif';
  ctx.fillText('SallySudo', W / 2 + 18, 46);
  if ('letterSpacing' in ctx) try { ctx.letterSpacing = '0px'; } catch {}
  // subtitle pill: ⚔️ 1v1  ·  ● LIVE
  const pillW = 200, pillX = W / 2 - pillW / 2, pillY = 78, pillH = 30;
  ctx.fillStyle = 'rgba(124,92,255,0.18)'; rrect(ctx, pillX, pillY, pillW, pillH, 15); ctx.fill();
  ctx.fillStyle = '#c4b5fd'; ctx.font = '800 15px Arial, sans-serif';
  ctx.fillText('⚔️ 1v1', pillX + 52, pillY + 16);
  if (f.live && !f.winnerName) {
    ctx.fillStyle = '#FF3B3B'; ctx.beginPath(); ctx.arc(pillX + 120, pillY + 15, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fca5a5'; ctx.font = '800 14px Arial, sans-serif'; ctx.fillText('LIVE', pillX + 152, pillY + 16);
  }
  const size = 432, gap = 130, totalW = size * 2 + gap, x0 = (W - totalW) / 2, boardY = 208;
  const sides = [
    { x: x0, name: f.lName, t: f.lTime, e: f.lErr, b: f.lBoard, win: f.winnerName === f.lName },
    { x: x0 + size + gap, name: f.rName, t: f.rTime, e: f.rErr, b: f.rBoard, win: f.winnerName === f.rName },
  ];
  for (const s of sides) {
    ctx.textAlign = 'center';
    ctx.fillStyle = s.win ? '#fbbf24' : '#ffffff'; ctx.font = '900 26px Arial, sans-serif';
    ctx.fillText(`${s.win ? '🏆 ' : ''}${s.name}`, s.x + size / 2, boardY - 54);
    ctx.fillStyle = '#fbbf24'; ctx.font = '700 20px Arial, sans-serif';
    ctx.fillText(`⏱️ ${fmt(s.t)}   ❌ ${s.e}`, s.x + size / 2, boardY - 24);
    drawBoardC(ctx, s.x, boardY, size, s.b, f.givens);
  }
  // VS in a purple chip at center
  const cy = boardY + size / 2;
  ctx.fillStyle = PURPLE; ctx.beginPath(); ctx.arc(W / 2, cy, 27, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.font = '900 22px Arial, sans-serif'; ctx.fillText('VS', W / 2, cy + 1);
  if (f.winnerName) {
    ctx.fillStyle = '#fbbf24'; ctx.font = '900 30px Arial, sans-serif';
    ctx.fillText(`🏆 ${f.winnerName} wins!`, W / 2, boardY + size + 42);
  }
}

function SBoard({ board, givens, size }: { board: number[]; givens: number[]; size: number }) {
  const cell = size / 9;
  return (
    <View style={{ width: size, height: size, backgroundColor: '#0a0a1a', borderWidth: 2, borderColor: '#4a4a6a', borderRadius: 6 }}>
      {Array.from({ length: 9 }).map((_, r) => (
        <View key={r} style={{ flexDirection: 'row', height: cell }}>
          {Array.from({ length: 9 }).map((_, c) => {
            const idx = r * 9 + c;
            const v = board[idx] || 0;
            const given = (givens[idx] || 0) > 0;
            return (
              <View key={c} style={{
                width: cell, height: cell, alignItems: 'center', justifyContent: 'center',
                borderRightWidth: (c + 1) % 3 === 0 && c < 8 ? 1.5 : 0.5, borderRightColor: '#4a4a6a',
                borderBottomWidth: (r + 1) % 3 === 0 && r < 8 ? 1.5 : 0.5, borderBottomColor: '#4a4a6a',
              }}>
                {v > 0 && <Text style={{ color: given ? '#fff' : '#2dd4db', fontSize: cell * 0.55, fontWeight: given ? '800' : '700' }}>{v}</Text>}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export default function SpectatePage() {
  const { challengeId, autobroadcast } = useLocalSearchParams<{ challengeId: string; autobroadcast?: string }>();
  const [spec, setSpec] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [lBoard, setLBoard] = useState<number[]>([]);
  const [rBoard, setRBoard] = useState<number[]>([]);
  const [lTime, setLTime] = useState(0);
  const [rTime, setRTime] = useState(0);
  const [lErr, setLErr] = useState(0);
  const [rErr, setRErr] = useState(0);
  const [winnerName, setWinnerName] = useState<string | null>(null);
  // Server-relay broadcast (web only): capture this view → WebSocket → ffmpeg → YouTube.
  const [broadcast, setBroadcast] = useState<'off' | 'starting' | 'live'>('off');
  const [watchUrl, setWatchUrl] = useState<string | null>(null);
  const relayRef = useRef<{ ws?: any; mr?: any; stream?: any; canvas?: any; raf?: any }>({});
  // latest display values for the canvas compositor loop (runs outside React).
  const frameRef = useRef<Frame>({ lName: 'Player 1', rName: 'Player 2', lTime: 0, rTime: 0, lErr: 0, rErr: 0, lBoard: [], rBoard: [], givens: [], winnerName: null, live: true });

  // keep ids in a ref so the socket listener (registered once) routes events.
  const ids = useRef<{ challengerId: string; challengedId: string }>({ challengerId: '', challengedId: '' });
  const playing = useRef(true);

  useEffect(() => {
    if (!challengeId) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await AsyncStorage.getItem('sudoku_token');
        const r = await fetch(`${API_URL}/challenges/${challengeId}/spectate`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const j = await r.json();
        if (cancelled) return;
        if (!j?.spectate) { setError(j?.error || 'Not found'); return; }
        const s = j.spectate;
        setSpec(s);
        ids.current = { challengerId: s.challengerId, challengedId: s.challengedId };
        setLBoard(parseBoard(s.challengerBoard));
        setRBoard(parseBoard(s.challengedBoard));
        setLTime(s.challengerTime); setRTime(s.challengedTime);
        setLErr(s.challengerErrors); setRErr(s.challengedErrors);
        if (s.winner?.username) { setWinnerName(s.winner.username); playing.current = false; }
        else if (s.status !== 'playing') playing.current = false;

        // Connect + spectate the room for realtime updates.
        await socketService.connect();
        socketService.spectateChallenge(challengeId);

        socketService.on('opponent:progress', (d: any) => {
          const board = parseBoard(d?.board);
          if (d?.odcUserId === ids.current.challengerId) { setLBoard(board); if (d.timeSpent != null) setLTime(d.timeSpent); if (d.errors != null) setLErr(d.errors); }
          else if (d?.odcUserId === ids.current.challengedId) { setRBoard(board); if (d.timeSpent != null) setRTime(d.timeSpent); if (d.errors != null) setRErr(d.errors); }
        });
        const onEnd = (d: any) => {
          playing.current = false;
          const wn = d?.username || d?.winner?.username || d?.winnerName;
          if (wn) setWinnerName(wn);
        };
        socketService.on('player:completed', onEnd);
        socketService.on('challenge:result', onEnd);
        socketService.on('player:abandoned', () => { /* the other player wins; result event carries the name */ });
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message || e));
      }
    })();
    return () => {
      cancelled = true;
      socketService.removeAllListeners('opponent:progress');
      socketService.removeAllListeners('player:completed');
      socketService.removeAllListeners('challenge:result');
      socketService.removeAllListeners('player:abandoned');
    };
  }, [challengeId]);

  // Local 1s tick so the clocks move between progress events (corrected by them).
  useEffect(() => {
    const iv = setInterval(() => {
      if (!playing.current) return;
      setLTime((t) => t + 1); setRTime((t) => t + 1);
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // ── Server-relay broadcast: COMPOSE the 2 boards on a canvas → captureStream
  //    → WS → ffmpeg → YouTube (web only). No getDisplayMedia dialog, so it runs
  //    headlessly and inside a mobile WebView (the phone broadcasts by loading
  //    this page with ?autobroadcast=1). ──
  const stopBroadcast = () => {
    const { ws, mr, stream, raf } = relayRef.current || {};
    if (raf) { try { clearInterval(raf); } catch {} }
    try { mr?.stop?.(); } catch {}
    try { stream?.getTracks?.().forEach((t: any) => t.stop()); } catch {}
    try { ws?.send?.(JSON.stringify({ type: 'stop' })); } catch {}
    try { ws?.close?.(); } catch {}
    relayRef.current = {};
    setBroadcast('off');
  };
  const startBroadcast = async () => {
    if (!IS_WEB || broadcast !== 'off') return;
    try {
      setBroadcast('starting');
      const token = await AsyncStorage.getItem('sudoku_token');
      const W = 1280, H = 720;
      const canvas = (window as any).document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      // paint loop @15fps from the latest frameRef
      const raf = setInterval(() => { try { drawBroadcastFrame(ctx, W, H, frameRef.current); } catch {} }, 1000 / 15);
      drawBroadcastFrame(ctx, W, H, frameRef.current);
      const stream = canvas.captureStream(15);
      // add a silent audio track so the WebM has audio (the relay's ffmpeg maps aac).
      try {
        const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AC) {
          const ac = new AC(); const osc = ac.createOscillator(); const gain = ac.createGain();
          gain.gain.value = 0.0001; osc.connect(gain); const dst = ac.createMediaStreamDestination();
          gain.connect(dst); osc.start();
          dst.stream.getAudioTracks().forEach((t: any) => stream.addTrack(t));
        }
      } catch {}
      const ws = new WebSocket(`wss://api.sallysudo.com/api/youtube/ingest?token=${encodeURIComponent(token || '')}&challengeId=${challengeId}&privacy=unlisted`);
      ws.binaryType = 'arraybuffer';
      relayRef.current = { ws, stream, canvas, raf };
      ws.onmessage = (ev: any) => {
        let m: any = {}; try { m = JSON.parse(ev.data); } catch {}
        if (m.type === 'ready') {
          setWatchUrl(m.watchUrl); setBroadcast('live');
          const cands = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm'];
          const mime = cands.find((c) => (window as any).MediaRecorder?.isTypeSupported?.(c)) || '';
          const mr = new (window as any).MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 2500000 } : undefined);
          mr.ondataavailable = (e: any) => { if (e.data && e.data.size && ws.readyState === 1) e.data.arrayBuffer().then((b: ArrayBuffer) => { try { ws.send(b); } catch {} }); };
          mr.start(1000);
          relayRef.current.mr = mr;
        } else if (m.type === 'error') { (window as any).alert('Broadcast error: ' + m.error); stopBroadcast(); }
      };
      ws.onclose = () => { if (relayRef.current.ws) stopBroadcast(); };
    } catch (e: any) {
      setBroadcast('off');
      if (e?.name !== 'NotAllowedError') (window as any).alert('Could not start broadcast: ' + (e?.message || e));
    }
  };

  // keep the compositor's frame data fresh from React state (web only).
  useEffect(() => {
    frameRef.current = {
      lName: spec?.challenger?.username || 'Player 1', rName: spec?.challenged?.username || 'Player 2',
      lTime, rTime, lErr, rErr, lBoard, rBoard, givens: parseBoard(spec?.puzzle),
      winnerName, live: playing.current && !winnerName,
    };
  }, [spec, lBoard, rBoard, lTime, rTime, lErr, rErr, winnerName]);

  // auto-start the broadcast when ?autobroadcast=1 (mobile WebView / headless).
  useEffect(() => {
    if (!IS_WEB || autobroadcast !== '1' || !spec) return;
    const id = setTimeout(() => { startBroadcast(); }, 800);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, autobroadcast]);

  const givens = useMemo(() => parseBoard(spec?.puzzle), [spec]);
  const lName = spec?.challenger?.username || 'Player 1';
  const rName = spec?.challenged?.username || 'Player 2';
  const size = Math.min(Math.floor((width - (IS_WEB ? 120 : 44)) / 2), IS_WEB ? 360 : 330);

  if (error) {
    return (
      <LinearGradient colors={['#0a0a1a', '#1a1a3a', '#0f0f2a']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 36 }}>📺</Text>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 8 }}>Live not available</Text>
        <Text style={{ color: '#94a3b8', marginTop: 4 }}>{error}</Text>
      </LinearGradient>
    );
  }

  const Side = ({ name, time, err, board, win }: { name: string; time: number; err: number; board: number[]; win: boolean }) => (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900' }} numberOfLines={1}>{win ? '🏆 ' : ''}{name}</Text>
      <Text style={{ color: '#fbbf24', fontSize: 14, fontWeight: '700', marginTop: 2, marginBottom: 8 }}>⏱️ {fmt(time)} · ❌ {err}</Text>
      <SBoard board={board} givens={givens} size={size} />
    </View>
  );

  return (
    <LinearGradient colors={['#0a0a1a', '#1a1a3a', '#0f0f2a']} style={{ flex: 1 }}>
      <View style={{ flex: 1, paddingTop: 44, paddingHorizontal: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
          <Text style={{ color: '#fff', fontSize: 19, fontWeight: '900', letterSpacing: 0.5 }}>⚔️ SallySudo 1v1</Text>
          {playing.current && !winnerName && (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF0000', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, gap: 5 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 }}>LIVE</Text>
            </View>
          )}
        </View>
        {IS_WEB && (
          <View style={{ alignItems: 'center', marginBottom: 14, gap: 6 }}>
            <TouchableOpacity
              onPress={broadcast === 'off' ? startBroadcast : stopBroadcast}
              disabled={broadcast === 'starting'}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: broadcast === 'off' ? '#FF0000' : broadcast === 'starting' ? '#64748b' : '#22c55e', paddingVertical: 9, paddingHorizontal: 16, borderRadius: 10 }}
            >
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>
                {broadcast === 'off' ? '🔴 Diffuser sur YouTube' : broadcast === 'starting' ? '⏳ Démarrage…' : '⏹️ Arrêter le live'}
              </Text>
            </TouchableOpacity>
            {!!watchUrl && (
              <Text style={{ color: '#2dd4db', fontSize: 11 }} onPress={() => { try { (window as any).open(watchUrl, '_blank'); } catch {} }}>
                🔗 {watchUrl}
              </Text>
            )}
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center', alignItems: 'flex-start' }}>
          <Side name={lName} time={lTime} err={lErr} board={lBoard} win={winnerName === lName} />
          <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '900', alignSelf: 'center' }}>VS</Text>
          <Side name={rName} time={rTime} err={rErr} board={rBoard} win={winnerName === rName} />
        </View>
        {!!winnerName && (
          <Text style={{ color: '#fbbf24', fontSize: 18, fontWeight: '900', textAlign: 'center', marginTop: 18 }}>🏆 {winnerName} wins!</Text>
        )}
      </View>
    </LinearGradient>
  );
}
