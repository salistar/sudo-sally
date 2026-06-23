/**
 * Challenge Game Screen - Dual Sudoku View
 * Shows both players' grids side by side in real-time
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Modal,
  Dimensions, ScrollView, ActivityIndicator, Platform, TextInput, Linking
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { socketService } from '../utils/socket';
import { API_URL, RELAY_WSS } from '../utils/api';
import { LIVE_PURPLE, rrect, drawOwl, fmt, drawSudokuBoard, drawCamTile } from '../utils/liveCompositor';
import { useLang } from '../utils/LanguageContext';
import { useBoardKeyboard } from '../utils/useBoardKeyboard';
import AppModal, { PopupData } from '../components/AppModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import fixWebmDuration from 'fix-webm-duration';

// ─── Native WebRTC + audio recording (Android/iOS APK) ─────────────────────
// On the web build these `require()` calls don't run, so Metro never tries to
// bundle the native modules for web. On native we lazy-load them and expose
// the same handful of constructors the rest of the file already uses.
let NativeWebRTC: any = null;
let NativeAudio: any = null;
let NativeFS: any = null;
let NativeSharing: any = null;
if (Platform.OS !== 'web') {
  try { NativeWebRTC = require('react-native-webrtc'); } catch (e) { console.log('[webrtc] native module missing', e); }
  try { NativeAudio  = require('expo-av').Audio;       } catch (e) { console.log('[expo-av] missing',         e); }
  try { NativeFS     = require('expo-file-system');    } catch {}
  try { NativeSharing = require('expo-sharing');       } catch {}
}
const RTCView: any = NativeWebRTC?.RTCView ?? null;

/** Picks `window.X` on the web build and `NativeWebRTC.X` on the APK. */
function getRTC() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const W: any = window;
    return {
      RTCPeerConnection:    W.RTCPeerConnection,
      RTCSessionDescription: W.RTCSessionDescription,
      RTCIceCandidate:       W.RTCIceCandidate,
      mediaDevices:          (typeof navigator !== 'undefined' && navigator.mediaDevices) || null,
    };
  }
  return NativeWebRTC ? {
    RTCPeerConnection:     NativeWebRTC.RTCPeerConnection,
    RTCSessionDescription: NativeWebRTC.RTCSessionDescription,
    RTCIceCandidate:       NativeWebRTC.RTCIceCandidate,
    mediaDevices:          NativeWebRTC.mediaDevices,
  } : { RTCPeerConnection: null, RTCSessionDescription: null, RTCIceCandidate: null, mediaDevices: null };
}

const { width } = Dimensions.get('window');
// This screen needs more horizontal room than the rest of the app: on web,
// we override #root max-width to 1100px in a useEffect below; on native we
// already have the device's full width. Cells stay readable on phones.
const IS_WEB = Platform.OS === 'web';
// Cells sized so BOTH boards + the bottom deck + top call bar all fit on
// a typical desktop viewport without the deck "eating" the boards.
// On mobile, keep the grid compact so the WHOLE board + the number pad are
// visible together in one view (no scrolling needed to place a number).
const CELL_SIZE = IS_WEB ? 42 : Math.max(20, Math.floor((Math.min(width, 360) - 84) / 9));

type Board = (number | null)[][];

interface Challenge {
  _id: string;
  puzzle: string;
  solution: string;
  difficulty: string;
  status: string;
  challenger: { _id: string; username: string; avatar: string };
  challenged: { _id: string; username: string; avatar: string };
  challengerProgress: { board: string; completed: boolean; errors: number; timeSpent: number; abandoned: boolean };
  challengedProgress: { board: string; completed: boolean; errors: number; timeSpent: number; abandoned: boolean };
  winner?: { _id: string; username: string };
}

// API_URL is imported from utils/api (single source of truth for the host).

// ============ SOCIAL BRAND BUTTON — real SVG icons + brand colors ============
import Svg, { Path, Circle, Rect, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

// Uniform 28x28 SVG icons — all use viewBox 0 0 24 24 with paths that fill the box similarly
const ICON_SZ = 30;
function FacebookIcon()  { return (<Svg viewBox="0 0 24 24" width={ICON_SZ} height={ICON_SZ}><Path fill="#fff" d="M13.5 21v-7.5h2.55l.38-2.97H13.5V8.75c0-.86.24-1.45 1.47-1.45H16.5V4.65c-.27-.04-1.18-.12-2.24-.12-2.21 0-3.72 1.35-3.72 3.83v2.17H8v2.97h2.54V21h2.96z"/></Svg>); }
function InstagramIcon() {
  // The official simple-icons IG path — a SINGLE filled glyph (rounded frame +
  // camera lens + corner dot) with the SAME visual weight as the other solid
  // brand icons (FB / YT / X / LinkedIn). Painted in white on the IG gradient
  // background, no strokes, no thin lines.
  return (
    <Svg viewBox="0 0 24 24" width={ICON_SZ} height={ICON_SZ}>
      <Defs>
        <SvgLinearGradient id="ig" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0"   stopColor="#feda75"/>
          <Stop offset=".25" stopColor="#fa7e1e"/>
          <Stop offset=".55" stopColor="#d62976"/>
          <Stop offset=".85" stopColor="#962fbf"/>
          <Stop offset="1"   stopColor="#4f5bd5"/>
        </SvgLinearGradient>
      </Defs>
      <Rect x="0" y="0" width="24" height="24" rx="6" fill="url(#ig)"/>
      <Path
        fill="#fff"
        d="M12 2.16c3.2 0 3.58.02 4.85.07 1.17.06 1.8.25 2.23.42.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.05.41 2.23.06 1.26.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.06 1.17-.26 1.8-.42 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.24.41-1.27.06-1.65.07-4.86.07-3.21 0-3.59-.02-4.86-.07-1.17-.06-1.82-.26-2.24-.42-.57-.22-.96-.48-1.38-.9-.42-.42-.69-.82-.9-1.38-.16-.42-.36-1.07-.42-2.24C2.07 15.58 2.06 15.2 2.06 12s.02-3.59.07-4.86c.06-1.17.26-1.81.42-2.24.21-.57.48-.96.9-1.38.42-.42.81-.69 1.38-.9.42-.17 1.05-.36 2.22-.42 1.28-.05 1.65-.06 4.86-.06zM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.31-1.46.72-2.13 1.38C1.34 2.68.94 3.35.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12c0 3.26.01 3.67.07 4.95.06 1.27.26 2.15.56 2.91.31.79.72 1.46 1.38 2.13.67.67 1.34 1.08 2.13 1.38.77.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24c3.26 0 3.67-.01 4.95-.07 1.28-.06 2.15-.26 2.91-.56.79-.31 1.46-.72 2.13-1.38.67-.67 1.08-1.34 1.38-2.13.3-.77.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91-.31-.79-.72-1.46-1.38-2.13C21.32 1.35 20.65.94 19.86.63 19.1.33 18.23.13 16.95.07 15.67.01 15.26 0 12 0zm0 5.84c-3.4 0-6.16 2.76-6.16 6.16 0 3.4 2.76 6.16 6.16 6.16 3.4 0 6.16-2.76 6.16-6.16 0-3.4-2.76-6.16-6.16-6.16zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm6.4-11.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z"
      />
    </Svg>
  );
}
function TiktokIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={ICON_SZ} height={ICON_SZ}>
      <Path fill="#25F4EE" d="M16.6 5.82A4.83 4.83 0 0 1 15.43 3h-2.74v11.93a2.42 2.42 0 1 1-2.42-2.42c.13 0 .26.02.38.04V9.79a5.27 5.27 0 0 0-.38-.02 5.16 5.16 0 1 0 5.16 5.16V8.94a7.55 7.55 0 0 0 4.4 1.41V7.6a4.54 4.54 0 0 1-3.23-1.78z"/>
      <Path fill="#FE2C55" d="M17.85 7.13A4.83 4.83 0 0 1 16.6 4.4h-1.17a4.54 4.54 0 0 0 3.23 3.97V7.13z" opacity=".9"/>
    </Svg>
  );
}
function YoutubeIcon()  { return (<Svg viewBox="0 0 24 24" width={ICON_SZ} height={ICON_SZ}><Path fill="#fff" d="M21.6 7.2s-.19-1.35-.78-1.94c-.74-.77-1.57-.78-1.95-.82C16.13 4.2 12 4.2 12 4.2h-.01s-4.12 0-6.86.24c-.38.05-1.21.05-1.95.82C2.59 5.85 2.4 7.2 2.4 7.2S2.2 8.79 2.2 10.39v1.49c0 1.59.2 3.19.2 3.19s.19 1.35.78 1.94c.74.77 1.71.74 2.14.82 1.56.15 6.6.2 6.6.2s4.13-.01 6.87-.25c.38-.05 1.21-.05 1.95-.82.59-.59.78-1.94.78-1.94s.2-1.59.2-3.19v-1.49c0-1.59-.2-3.19-.2-3.19zM9.93 13.58V8.13l5.31 2.74-5.31 2.71z"/></Svg>); }
function LinkedinIcon() { return (<Svg viewBox="0 0 24 24" width={ICON_SZ} height={ICON_SZ}><Path fill="#fff" d="M6.94 5a1.94 1.94 0 1 1-3.88 0 1.94 1.94 0 0 1 3.88 0zM7 8.48H3V21h4V8.48zM13.32 8.48H9.34V21h3.94v-6.57c0-3.66 4.78-4 4.78 0V21H22v-7.93c0-6.17-7.06-5.94-8.68-2.91v-1.68z"/></Svg>); }
function XIcon()        { return (<Svg viewBox="0 0 24 24" width={ICON_SZ} height={ICON_SZ}><Path fill="#fff" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></Svg>); }

const BRANDS: Record<string, { color: string; bg?: string; Icon: React.FC; name: string; grad?: [string, string] }> = {
  facebook:  { color: '#1877F2', Icon: FacebookIcon,  name: 'Facebook' },
  instagram: { color: '#E1306C', Icon: InstagramIcon, name: 'Instagram', bg: 'transparent' },
  tiktok:    { color: '#010101', Icon: TiktokIcon,    name: 'TikTok' },
  youtube:   { color: '#FF0000', Icon: YoutubeIcon,   name: 'YouTube' },
  linkedin:  { color: '#0A66C2', Icon: LinkedinIcon,  name: 'LinkedIn' },
  twitter:   { color: '#000000', Icon: XIcon,         name: 'X' },
};

// ============ LIVE COMPOSITOR (web only) ============
// Paints BOTH boards + BOTH call cameras + the live chat onto a 1280×720 canvas
// and (with the mixed call audio) streams it to the relay → YouTube. This is the
// ONLY place the cameras/chat can be composited into the broadcast, because they
// live as DOM <video> elements + React state here; the native phone can't bridge
// its WebRTC video into an encoder, so the connected *web* player is the streamer.
// Shared owl/board/cam/clock primitives come from utils/liveCompositor; only the
// landscape *layout* (boards + cameras + chat) is specific to this screen.
function liveDrawFrame(ctx: any, W: number, H: number, d: any, localVideo: any, remoteVideo: any) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0a0a1a'); g.addColorStop(.5, '#1a1a3a'); g.addColorStop(1, '#0f0f2a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // header: owl + wordmark + LIVE
  drawOwl(ctx, W / 2 - 120, 36, 18);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx) try { ctx.letterSpacing = '2px'; } catch (e) {}
  ctx.fillStyle = '#fff'; ctx.font = '900 30px Arial, sans-serif'; ctx.fillText('SallySudo', W / 2 + 8, 38);
  if ('letterSpacing' in ctx) try { ctx.letterSpacing = '0px'; } catch (e) {}
  if (!d.winner) { ctx.fillStyle = '#FF3B3B'; ctx.beginPath(); ctx.arc(W / 2 + 108, 33, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fca5a5'; ctx.font = '800 14px Arial, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('LIVE', W / 2 + 120, 38); }
  // boards
  const S = 360, by = 122, bxMe = 120, bxOpp = 560;
  ctx.textAlign = 'center';
  const meWin = d.winner && d.winner === d.myName, oppWin = d.winner && d.winner === d.oppName;
  ctx.fillStyle = meWin ? '#fbbf24' : '#fff'; ctx.font = '900 22px Arial, sans-serif'; ctx.fillText((meWin ? '🏆 ' : '') + d.myName, bxMe + S / 2, by - 44);
  ctx.fillStyle = '#fbbf24'; ctx.font = '700 17px Arial, sans-serif'; ctx.fillText('⏱ ' + fmt(d.myTime) + '   ❌ ' + d.myErr, bxMe + S / 2, by - 20);
  drawSudokuBoard(ctx, bxMe, by, S, (r, c) => (d.myBoard && d.myBoard[r] ? d.myBoard[r][c] : null), (r, c) => !!(d.initial && d.initial[r] && d.initial[r][c]));
  ctx.fillStyle = oppWin ? '#fbbf24' : '#fff'; ctx.font = '900 22px Arial, sans-serif'; ctx.fillText((oppWin ? '🏆 ' : '') + d.oppName, bxOpp + S / 2, by - 44);
  ctx.fillStyle = '#fbbf24'; ctx.font = '700 17px Arial, sans-serif'; ctx.fillText('⏱ ' + fmt(d.oppTime) + '   ❌ ' + d.oppErr, bxOpp + S / 2, by - 20);
  drawSudokuBoard(ctx, bxOpp, by, S, (r, c) => (d.oppBoard && d.oppBoard[r] ? d.oppBoard[r][c] : null), (r, c) => !!(d.initial && d.initial[r] && d.initial[r][c]));
  // VS chip
  const vx = (bxMe + S + bxOpp) / 2, vy = by + S / 2;
  ctx.fillStyle = LIVE_PURPLE; ctx.beginPath(); ctx.arc(vx, vy, 22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '900 18px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('VS', vx, vy + 1);
  // cameras below each board
  const camW = 200, camH = 150, camY = by + S + 24;
  drawCamTile(ctx, bxMe + (S - camW) / 2, camY, camW, camH, localVideo, d.myName);
  drawCamTile(ctx, bxOpp + (S - camW) / 2, camY, camW, camH, remoteVideo, d.oppName);
  // chat panel (right column)
  const cx0 = 952, cy0 = 96, cw = 296, chH = 548;
  ctx.fillStyle = 'rgba(124,92,255,0.06)'; rrect(ctx, cx0, cy0, cw, chH, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(124,92,255,0.3)'; ctx.lineWidth = 1.5; rrect(ctx, cx0, cy0, cw, chH, 14); ctx.stroke();
  ctx.fillStyle = '#c4b5fd'; ctx.font = '800 16px Arial, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('💬 Chat', cx0 + 16, cy0 + 24);
  const msgs = (d.chat || []).slice(-10); let ty = cy0 + 54;
  for (const m of msgs) {
    if (ty > cy0 + chH - 20) break;
    ctx.fillStyle = '#a78bfa'; ctx.font = '700 12px Arial, sans-serif'; ctx.fillText(String(m.from || '').slice(0, 18), cx0 + 16, ty); ty += 16;
    ctx.fillStyle = '#e2e8f0'; ctx.font = '400 13px Arial, sans-serif';
    const text = String(m.text || (m.img ? '📷 image' : '')).slice(0, 90);
    let line = ''; for (const w of text.split(' ')) { const test = line ? line + ' ' + w : w; if (ctx.measureText(test).width > cw - 32) { ctx.fillText(line, cx0 + 16, ty); ty += 15; line = w; } else line = test; }
    if (line) { ctx.fillText(line, cx0 + 16, ty); ty += 15; }
    ty += 9;
  }
  if (!msgs.length) { ctx.fillStyle = '#475569'; ctx.font = '400 13px Arial, sans-serif'; ctx.fillText('No messages yet…', cx0 + 16, cy0 + 54); }
}

function SocialBtn({ brand, label, onPress, compact }: { brand: keyof typeof BRANDS; label?: string; onPress: () => void; compact?: boolean }) {
  const b = BRANDS[brand];
  const Icon = b.Icon;
  if (compact) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[socStyles.iconBox, socStyles.compactBox, { backgroundColor: b.bg || b.color }]}>
        <Icon />
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={socStyles.btn}>
      <View style={[socStyles.iconBox, { backgroundColor: b.bg || b.color }]}>
        <Icon />
      </View>
      <Text style={socStyles.label}>{label || b.name}</Text>
    </TouchableOpacity>
  );
}
const socStyles = StyleSheet.create({
  btn: { alignItems: 'center', width: 78, gap: 6 },
  iconBox: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  compactBox: { width: 38, height: 38, borderRadius: 10, shadowOpacity: 0.25, shadowRadius: 4 },
  label: { color: '#cbd5e1', fontSize: 11, fontWeight: '600', textAlign: 'center' },
});

// v3.11.16 sprint-22 — Chess.com-style quick taunts
const TAUNTS = ['GG', 'GL', '🔥', '😎', '🤔', '😅', '💩'];
function QuickTaunts({ onSend }: { onSend: (s: string) => void }) {
  return (
    <View style={tauntStyles.row}>
      {TAUNTS.map((tt) => (
        <TouchableOpacity key={tt} onPress={() => onSend(tt)} activeOpacity={0.8} style={tauntStyles.chip}>
          <Text style={tauntStyles.chipText}>{tt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
const tauntStyles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 4 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(124,92,255,0.12)', borderWidth: 1, borderColor: 'rgba(124,92,255,0.35)' },
  chipText: { color: '#cbd5e1', fontSize: 13, fontWeight: '700' },
});

export default function ChallengeGame() {
  const { id, stream } = useLocalSearchParams<{ id: string; stream?: string }>();
  const router = useRouter();
  const { t } = useLang();
  const challengeId = id as string;
  // STREAM MODE (?stream=1): a broadcast-friendly view that shows BOTH boards
  // side-by-side with each player's name + time, and nothing else. Reuses all
  // the existing socket state — the normal gameplay screen is untouched.
  const streamMode = stream === '1' || stream === 'true';

  // ============ STATE ============
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState<PopupData | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [solution, setSolution] = useState<Board>([]);
  const [myBoard, setMyBoard] = useState<Board>([]);
  const [opponentBoard, setOpponentBoard] = useState<Board>([]);
  const [initial, setInitial] = useState<boolean[][]>([]);
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [myErrors, setMyErrors] = useState(0);
  const [opponentErrors, setOpponentErrors] = useState(0);
  const [myTime, setMyTime] = useState(0);
  const [opponentTime, setOpponentTime] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isChallenger, setIsChallenger] = useState(false);
  const [opponentCompleted, setOpponentCompleted] = useState(false);
  const [myCompleted, setMyCompleted] = useState(false);
  const [showResult, setShowResult] = useState(false);
  // ── WebRTC call ──
  const [callActive, setCallActive] = useState(false);
  const [callKind, setCallKind] = useState<'audio' | 'video'>('audio');
  const [callError, setCallError] = useState<string | null>(null);
  const pcRef = useRef<any>(null);
  const localStreamRef = useRef<any>(null);
  const remoteStreamRef = useRef<any>(null);
  const localVidRef = useRef<any>(null);
  const remoteVidRef = useRef<any>(null);
  const pendingIceRef = useRef<any[]>([]);
  // Native (react-native-webrtc) needs a `streamURL` to feed into <RTCView>;
  // web binds streams directly via DOM `.srcObject` so these stay null there.
  const [localStreamUrl, setLocalStreamUrl] = useState<string | null>(null);
  const [remoteStreamUrl, setRemoteStreamUrl] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout>();

  // Always-current snapshot of the game state. Socket listeners are registered
  // ONCE and would otherwise read stale closure values — that bug made the
  // result modal never appear for the player who finished FIRST and waited.
  // Updated on every render so handlers always see live values.
  const liveRef = useRef<any>({});
  liveRef.current = { myCompleted, myTime, myErrors, opponentCompleted, opponentTime, opponentErrors, currentUser, isChallenger, challenge };

  // Snapshot consumed by the live compositor draw loop (see startLiveBroadcast).
  // Always-current (refs, not stale closures) so the 15fps loop sees live values.
  // NB: the `.current = {…}` assignment lives BELOW the chat-state declarations
  // because it reads `chatMessages`. Assigning here referenced that state before
  // its `useState` line — a use-before-declaration (TDZ) that threw
  // "Cannot access '$e' before initialization" and blanked the entire screen on
  // the web build (Hermes/native tolerated it; the web minifier did not).
  const bcDataRef = useRef<any>({});

  // ============ CHAT / SHARE / CALL / RECORD UI STATE ============
  const [panelTab, setPanelTab] = useState<'chat' | 'call' | 'record' | 'share' | 'live'>('chat');
  const [panelOpen, setPanelOpen] = useState(false);
  const [deckOpen, setDeckOpen] = useState(true);  // collapse/expand the right sidebar
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; from: string; text?: string; img?: string; ts: number }>>([]);
  const [chatInput, setChatInput] = useState('');

  // Now that every snapshotted state exists, build the live-compositor frame data.
  const oppNameSnap = (isChallenger ? challenge?.challenged?.username : challenge?.challenger?.username) || 'Opponent';
  bcDataRef.current = {
    myBoard, oppBoard: opponentBoard, initial,
    myName: currentUser?.username || 'You', oppName: oppNameSnap,
    myTime, oppTime: opponentTime, myErr: myErrors, oppErr: opponentErrors,
    chat: chatMessages, winner: winner ? (winner === currentUser?.id ? (currentUser?.username || 'You') : oppNameSnap) : null,
  };
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<any>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef<number>(0);
  const [recordingDurMs, setRecordingDurMs] = useState<number>(0);
  const fileInputRef = useRef<any>(null);

  // ── Live-stream handshake: one player asks to go live, the broadcast only
  //    starts once the OPPONENT accepts. ──
  // 'connecting' = opponent accepted but the relay hasn't confirmed the YouTube
  // broadcast yet; we only show "LIVE" once the relay replies `ready`, so the UI
  // never claims to be live before frames can actually flow.
  const [liveStatus, setLiveStatus] = useState<'off' | 'requesting' | 'connecting' | 'live'>('off');
  const [liveStreamer, setLiveStreamer] = useState<string | null>(null); // who is broadcasting (username)
  const [incomingLive, setIncomingLive] = useState<{ fromName: string; platform: string } | null>(null);
  const [liveWatchUrl, setLiveWatchUrl] = useState<string | null>(null);
  // Count of encoded segments actually pushed to the relay — a non-zero, rising
  // value is the honest proof that video frames are really reaching YouTube.
  const [liveFrames, setLiveFrames] = useState(0);
  // Styled forfeit confirmation (replaces the bare window.confirm/Alert.alert
  // that looked unbranded). Works identically on web + native.
  const [showAbandon, setShowAbandon] = useState(false);
  // Compositor handle (web broadcaster only): relay socket, recorder, draw loop.
  const liveBcRef = useRef<any>({ ws: null, mr: null, raf: null, canvas: null, ac: null, flush: null, ready: false, watchdog: null });

  // ============ WEB — widen the #root for the dual-board layout ============
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const root = document.getElementById('root');
    if (!root) return;
    const prev = root.style.maxWidth;
    root.style.maxWidth = 'none';
    root.style.width = '100%';
    return () => { if (root) { root.style.maxWidth = prev || ''; root.style.width = ''; } };
  }, []);

  // ============ INIT ============
  useEffect(() => {
    loadChallenge();
    setupSocketListeners();

    return () => {
      clearInterval(timerRef.current);
      socketService.leaveChallenge(challengeId);
      socketService.removeAllListeners('opponent:progress');
      socketService.removeAllListeners('player:completed');
      socketService.removeAllListeners('player:abandoned');
      socketService.removeAllListeners('challenge:result');
      socketService.removeAllListeners('chat:message');
      socketService.removeAllListeners('webrtc:offer');
      socketService.removeAllListeners('webrtc:answer');
      socketService.removeAllListeners('webrtc:ice');
      socketService.removeAllListeners('call:end');
      socketService.removeAllListeners('live:request');
      socketService.removeAllListeners('live:accept');
      socketService.removeAllListeners('live:decline');
      socketService.removeAllListeners('live:end');
      try { hangup(true); } catch {}
      try { stopLiveBroadcast(); } catch {}
      stopRing();
    };
  }, [challengeId]);

  // Timer — ticks BOTH my clock and the opponent's while the match is live.
  // The opponent's clock is snapped to the authoritative value whenever an
  // `opponent:progress` event arrives; between events it advances locally so it
  // never looks frozen. Each side freezes as soon as that player finishes, and
  // everything stops on game over.
  useEffect(() => {
    if (gameOver || challenge?.status !== 'playing') {
      clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      if (!myCompleted) setMyTime(t => t + 1);
      if (!opponentCompleted) setOpponentTime(t => t + 1);
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [gameOver, myCompleted, opponentCompleted, challenge?.status]);

  // ============ SOCKET LISTENERS ============
  const setupSocketListeners = () => {
    socketService.joinChallenge(challengeId);

    // ── WebRTC signaling ──
    socketService.on('webrtc:offer',  (d: any) => handleOffer(d));
    socketService.on('webrtc:answer', (d: any) => handleAnswer(d));
    socketService.on('webrtc:ice',    (d: any) => handleIce(d));
    socketService.on('call:end',      () => hangup(false));

    // ── Live-stream handshake ──
    // Opponent asks to go live → show an Accept/Decline modal.
    socketService.on('live:request', (d: any) => {
      setIncomingLive({ fromName: d?.fromName || 'opponent', platform: d?.platform || 'youtube' });
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch {}
    });
    // Opponent accepted MY request → I'm the broadcaster. On web, start the real
    // compositor stream (boards + cameras + chat + audio) to YouTube via the relay.
    socketService.on('live:accept', (d: any) => {
      setLiveStreamer(liveRef.current.currentUser?.username || 'you');
      if (IS_WEB) {
        // Don't claim "LIVE" yet — only after the relay confirms `ready`
        // (startLiveBroadcast flips it to 'live'). Until then it's 'connecting'.
        setLiveStatus('connecting');
        setPopup({ type: 'success', title: '🔴 Connexion live', message: 'Opponent accepted — connecting your YouTube stream (boards + cam + chat)…' });
        try { startLiveBroadcast(); } catch (e) { console.log('[live] start err', e); }
      } else {
        setLiveStatus('live');
        setPopup({ type: 'info', title: '🔴 Live', message: 'The web player composites the full stream — keep playing here; your board + camera are in the broadcast.' });
      }
    });
    // Opponent declined my request.
    socketService.on('live:decline', (d: any) => {
      setLiveStatus('off');
      setPopup({ type: 'error', title: 'Live declined', message: 'Your opponent declined the live request.' });
    });
    // Stream ended by the broadcaster.
    socketService.on('live:end', () => {
      setLiveStatus('off'); setLiveStreamer(null); setIncomingLive(null);
    });

    // Chat messages from opponent (text + optional base64 image)
    socketService.on('chat:message', (data: any) => {
      setChatMessages(prev => [...prev, {
        id: 'm_' + Math.random().toString(36).slice(2, 8),
        from: data?.from || 'Opponent',
        text: data?.text,
        img: data?.img,
        ts: data?.ts || Date.now(),
      }]);
    });

    // Opponent progress
    socketService.on('opponent:progress', (data: any) => {
      if (data.board) {
        try {
          const board = typeof data.board === 'string' ? JSON.parse(data.board) : data.board;
          setOpponentBoard(board);
        } catch (e) {
          console.error('Error parsing opponent board:', e);
        }
      }
      if (data.errors !== undefined) setOpponentErrors(data.errors);
      if (data.timeSpent !== undefined) setOpponentTime(data.timeSpent);
    });

    // Opponent completed. Read live state (not the stale closure) so the
    // result modal fires for the player who already finished and is waiting.
    socketService.on('player:completed', (data: any) => {
      if (data.odcUserId !== liveRef.current.currentUser?.id) {
        setOpponentCompleted(true);
        setOpponentTime(data.timeSpent);
        setOpponentErrors(data.errors);
        if (liveRef.current.myCompleted) determineWinner(data.timeSpent, data.errors);
      }
    });

    // Opponent abandoned → I win. Read live currentUser; freeze clocks + show modal.
    socketService.on('player:abandoned', (data: any) => {
      if (data.odcUserId !== liveRef.current.currentUser?.id) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        clearInterval(timerRef.current);
        setWinner(liveRef.current.currentUser?.id ?? null);
        setPopup(null);
        setGameOver(true);
        setShowResult(true);
      }
    });

    // Final result (authoritative from server)
    socketService.on('challenge:result', (data: any) => {
      clearInterval(timerRef.current);
      setWinner(data.winner ?? null);
      setPopup(null);
      setGameOver(true);
      setShowResult(true);
    });
  };

  // ============ LOAD CHALLENGE ============
  const loadChallenge = async () => {
    try {
      const userData = await AsyncStorage.getItem('sudoku_user');
      const user = userData ? JSON.parse(userData) : null;
      setCurrentUser(user);

      const token = await AsyncStorage.getItem('sudoku_token');
      const response = await fetch(`${API_URL}/challenges/${challengeId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.success) {
        const ch = data.challenge;
        setChallenge(ch);
        setIsChallenger(ch.challenger._id === user?.id);

        const puzzleBoard = JSON.parse(ch.puzzle);
        const solutionBoard = JSON.parse(ch.solution);
        
        setSolution(solutionBoard);
        setInitial(puzzleBoard.map((row: any[]) => row.map(cell => cell !== 0 && cell !== null)));

        const myProgress = ch.challenger._id === user?.id ? ch.challengerProgress : ch.challengedProgress;
        const oppProgress = ch.challenger._id === user?.id ? ch.challengedProgress : ch.challengerProgress;

        setMyBoard(myProgress?.board ? JSON.parse(myProgress.board) : puzzleBoard.map((r: any[]) => [...r]));
        setOpponentBoard(oppProgress?.board ? JSON.parse(oppProgress.board) : puzzleBoard.map((r: any[]) => [...r]));
        setMyErrors(myProgress?.errors || 0);
        setOpponentErrors(oppProgress?.errors || 0);
        setMyTime(myProgress?.timeSpent || 0);
        setOpponentTime(oppProgress?.timeSpent || 0);

        // Start if accepted
        if (ch.status === 'accepted') await startChallenge();
      } else {
        // Challenge not found / not a participant / expired (backend returned
        // { error }). DON'T strand the player on an empty board — explain and
        // send them back to the lobby instead of an endless "loading" grid.
        console.warn('[challenge] load failed:', data?.error);
        setPopup({ type: 'error', title: t('error'), message: data?.error || t('failedLoadChallenge') });
        setTimeout(() => { try { router.replace('/challenges'); } catch {} }, 1600);
      }
    } catch (error) {
      console.error('Error loading challenge:', error);
      setPopup({ type: 'error', title: t('error'), message: t('failedLoadChallenge') });
      setTimeout(() => { try { router.replace('/challenges'); } catch {} }, 1600);
    } finally {
      setLoading(false);
    }
  };

  const startChallenge = async () => {
    try {
      const token = await AsyncStorage.getItem('sudoku_token');
      await fetch(`${API_URL}/challenges/${challengeId}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      socketService.startGame(challengeId);
      // The accepting client loads the challenge while it is still `accepted`
      // and starts it here — flip the local status to `playing` so the clocks
      // actually start ticking (otherwise the timer effect never runs for the
      // player who accepted the duel).
      setChallenge((prev: any) => prev ? { ...prev, status: 'playing' } : prev);
    } catch (error) {
      console.error('Error starting challenge:', error);
    }
  };

  // ============ GAME LOGIC ============
  const handleCellPress = (row: number, col: number) => {
    if (gameOver || myCompleted || initial[row]?.[col]) return;
    setSelected({ row, col });
    Haptics.selectionAsync();
  };

  const handleNumber = async (num: number) => {
    if (!selected || gameOver || myCompleted) return;
    const { row, col } = selected;
    if (initial[row][col]) return;

    const newBoard = myBoard.map(r => [...r]);
    newBoard[row][col] = num;
    setMyBoard(newBoard);

    // Check if correct
    if (num !== solution[row][col]) {
      const newErrors = myErrors + 1;
      setMyErrors(newErrors);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      // 3 errors = auto lose
      if (newErrors >= 3) {
        handleAbandon(true);
        return;
      }
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // Send progress to opponent
    socketService.sendProgress(
      challengeId,
      JSON.stringify(newBoard),
      myTime,
      myErrors,
      { row, col, value: num }
    );

    // Save to server
    await saveProgress(newBoard);

    // Check if completed
    if (isBoardComplete(newBoard)) {
      await handleComplete(newBoard);
    }
  };

  const handleErase = () => {
    if (!selected || initial[selected.row][selected.col] || gameOver || myCompleted) return;
    const newBoard = myBoard.map(r => [...r]);
    newBoard[selected.row][selected.col] = null;
    setMyBoard(newBoard);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Web-only keyboard shortcuts (no-op on native). Arrows move the selection,
  // 1-9 place a number, Backspace/Delete/0 erase. No hint/undo/notes in the
  // challenge mode, so those keys are omitted. Ignored once the game is over
  // or this player has completed their board.
  useBoardKeyboard({
    selected,
    setSelected,
    onNumber: handleNumber,
    onErase: handleErase,
    enabled: !gameOver && !myCompleted,
  });

  const isBoardComplete = (board: Board): boolean => {
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        if (board[i][j] !== solution[i][j]) return false;
      }
    }
    return true;
  };

  const saveProgress = async (board: Board) => {
    try {
      const token = await AsyncStorage.getItem('sudoku_token');
      await fetch(`${API_URL}/challenges/${challengeId}/progress`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          board: JSON.stringify(board),
          timeSpent: myTime,
          errors: myErrors
        })
      });
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  const handleComplete = async (board: Board) => {
    setMyCompleted(true);
    clearInterval(timerRef.current);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const token = await AsyncStorage.getItem('sudoku_token');
      await fetch(`${API_URL}/challenges/${challengeId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          board: JSON.stringify(board),
          timeSpent: myTime,
          errors: myErrors
        })
      });

      socketService.notifyCompleted(challengeId, myTime, myErrors);

      if (opponentCompleted) {
        determineWinner();
      } else {
        // First to complete a valid board wins the speed duel immediately.
        // Tell the opponent authoritatively (backend relays this as
        // 'challenge:result', so THEIR client resolves to "defeated" too),
        // then reveal MY victory modal. errors are already < 3 here (3 errors
        // auto-abandons earlier), so the board is a legitimate win.
        const L = liveRef.current;
        const opponentId = L.isChallenger ? L.challenge?.challenged?._id : L.challenge?.challenger?._id;
        socketService.notifyFinished(challengeId, L.currentUser?.id ?? null, opponentId ?? null, false);
        clearInterval(timerRef.current);
        setPopup(null);
        setWinner(L.currentUser?.id ?? null);
        setGameOver(true);
        setShowResult(true);
      }
    } catch (error) {
      console.error('Error completing challenge:', error);
    }
  };

  // Decide + reveal the result modal. Reads the LIVE snapshot (not stale
  // closure values) and accepts the opponent's real finishing time/errors so
  // both the winner and loser show correct times. Freezes both clocks.
  const determineWinner = (oppTimeArg?: number, oppErrorsArg?: number) => {
    const L = liveRef.current;
    const oppT = oppTimeArg ?? L.opponentTime ?? 0;
    const oppE = oppErrorsArg ?? L.opponentErrors ?? 0;

    clearInterval(timerRef.current);          // stop both clocks
    setOpponentTime(oppT);                     // freeze opponent clock to its real finish time
    setOpponentErrors(oppE);

    const myScore = (L.myTime ?? 0) + ((L.myErrors ?? 0) * 30);
    const oppScore = oppT + (oppE * 30);

    if (myScore < oppScore) {
      setWinner(L.currentUser?.id ?? null);
    } else if (oppScore < myScore) {
      const opponentId = L.isChallenger ? L.challenge?.challenged?._id : L.challenge?.challenger?._id;
      setWinner(opponentId ?? null);
    } else {
      setWinner(null); // Draw
    }

    setPopup(null);          // dismiss the "waiting for opponent" popup
    setGameOver(true);
    setShowResult(true);
  };

  // ============ LIVE-STREAM handshake actions ============
  // I ask my opponent to allow me to go live; the broadcast only starts once
  // they accept (handled by the live:accept listener above).
  const requestGoLive = () => {
    if (liveStatus !== 'off') return;
    setLiveStatus('requesting');
    socketService.emitLiveRequest(challengeId, 'youtube');
    setPopup({ type: 'info', title: '🔴 Go Live', message: 'Live request sent — waiting for your opponent to accept…' });
  };
  // Opponent (me) accepts the incoming live request → they go live.
  const acceptIncomingLive = () => {
    if (!incomingLive) return;
    socketService.emitLiveAccept(challengeId);
    setLiveStatus('live');
    setLiveStreamer(incomingLive.fromName);
    setIncomingLive(null);
  };
  const declineIncomingLive = () => {
    socketService.emitLiveDecline(challengeId);
    setIncomingLive(null);
  };
  const endLive = () => {
    socketService.emitLiveEnd(challengeId);
    stopLiveBroadcast();
    setLiveStatus('off'); setLiveStreamer(null); setLiveWatchUrl(null);
  };

  // ── Real YouTube broadcast from the WEB: composite boards + both cameras +
  //    chat onto a canvas, mix the call audio, and stream it to the relay
  //    (→ ffmpeg → RTMP → YouTube). Only the connected web player can do this.
  const startLiveBroadcast = async () => {
    if (!IS_WEB || typeof document === 'undefined') return;
    // Double-fire guard: the `ws` check alone is insufficient because an `await`
    // (token read) runs before `ws` is assigned, so two `live:accept` events
    // (Accept tapped twice / relay re-emit on reconnect) both pass it → two
    // broadcasts + two ffmpeg, one leaked. `starting` is set SYNCHRONOUSLY here.
    if (liveBcRef.current.ws || liveBcRef.current.starting) { console.log('[live] already broadcasting'); return; }
    liveBcRef.current.starting = true;
    try {
      console.log('[live] starting broadcast…');
      setLiveFrames(0);
      liveBcRef.current.ready = false;
      const token = await AsyncStorage.getItem('sudoku_token');
      console.log('[live] token present:', !!token);
      if (!token) { setPopup({ type: 'error', title: 'Live', message: 'Not signed in.' }); setLiveStatus('off'); return; }
      const W = 1280, H = 720;
      const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      liveBcRef.current.canvas = canvas;
      const vstream: any = (canvas as any).captureStream(15);
      // Mix local + remote call audio (best effort); fall back to a silent track.
      let audioTracks: any[] = [];
      try {
        const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AC) {
          const ac = new AC(); liveBcRef.current.ac = ac;
          // A backgrounded tab opens the AudioContext suspended — resume it so the
          // mixed audio track produces samples (YouTube needs a live audio track).
          try { if (ac.state === 'suspended' && ac.resume) ac.resume(); } catch (e) {}
          const dest = ac.createMediaStreamDestination();
          let added = false;
          [localStreamRef.current, remoteStreamRef.current].forEach((st: any) => {
            try { if (st && st.getAudioTracks && st.getAudioTracks().length) { ac.createMediaStreamSource(st).connect(dest); added = true; } } catch (e) {}
          });
          if (!added) { const osc = ac.createOscillator(); const gn = ac.createGain(); gn.gain.value = 0.0001; osc.connect(gn); gn.connect(dest); osc.start(); }
          audioTracks = dest.stream.getAudioTracks();
        }
      } catch (e) {}
      const mixed: any = new MediaStream([...vstream.getVideoTracks(), ...audioTracks]);
      const draw = () => { try { liveDrawFrame(ctx, W, H, bcDataRef.current, localVidRef.current, remoteVidRef.current); } catch (e) {} };
      liveBcRef.current.raf = setInterval(draw, 1000 / 15); draw();
      console.log('[live] opening relay WS…');
      const ws = new WebSocket(`${RELAY_WSS}?token=${encodeURIComponent(token)}&challengeId=${encodeURIComponent(challengeId)}&privacy=unlisted`);
      (ws as any).binaryType = 'arraybuffer'; liveBcRef.current.ws = ws;
      ws.onopen = () => console.log('[live] relay WS OPEN — awaiting broadcast…');
      // If the relay never confirms `ready` in 15s, fail honestly instead of
      // sitting forever on a "connecting" state.
      liveBcRef.current.watchdog = setTimeout(() => {
        if (!liveBcRef.current.ready) {
          console.log('[live] relay timeout — no ready');
          setPopup({ type: 'error', title: 'Live', message: 'Le flux n’a pas pu démarrer (relais YouTube injoignable). Réessaie.' });
          stopLiveBroadcast(); setLiveStatus('off');
        }
      }, 15000);
      ws.onmessage = (ev: any) => {
        let m: any = {}; try { m = JSON.parse(ev.data); } catch (e) {}
        if (m.type === 'ready') {
          console.log('[live] relay READY →', m.watchUrl);
          liveBcRef.current.ready = true;
          if (liveBcRef.current.watchdog) { clearTimeout(liveBcRef.current.watchdog); liveBcRef.current.watchdog = null; }
          if (m.watchUrl) setLiveWatchUrl(m.watchUrl);
          setLiveStatus('live');   // ← only NOW do we claim LIVE
          const Wn: any = window;
          const cands = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm'];
          let mime = ''; for (const c of cands) { if (Wn.MediaRecorder && Wn.MediaRecorder.isTypeSupported(c)) { mime = c; break; } }
          const mr = new Wn.MediaRecorder(mixed, mime ? { mimeType: mime, videoBitsPerSecond: 2500000 } : undefined);
          mr.ondataavailable = (e: any) => {
            if (e.data && e.data.size && ws.readyState === 1) {
              setLiveFrames((f) => f + 1);   // honest "frames flowing" counter
              e.data.arrayBuffer().then((b: ArrayBuffer) => { try { ws.send(b); } catch (_) {} });
            }
          };
          mr.start(1000); liveBcRef.current.mr = mr;
          // Force a flush twice a second so encoded chunks keep reaching the relay
          // even when the tab is backgrounded (browsers throttle the timeslice timer).
          liveBcRef.current.flush = setInterval(() => { try { if (mr.state === 'recording') mr.requestData(); } catch (e) {} }, 500);
        } else if (m.type === 'error') {
          console.log('[live] relay ERROR:', m.error);
          setPopup({ type: 'error', title: 'Live error', message: m.error || 'Could not start the YouTube stream (is this account’s channel connected?)' });
          stopLiveBroadcast(); setLiveStatus('off');
        }
      };
      ws.onerror = () => { console.log('[live] relay WS error event'); };
      ws.onclose = () => {
        console.log('[live] relay WS closed (ready=' + liveBcRef.current.ready + ')');
        // Closed before we ever went live → surface the failure, don't hang.
        if (!liveBcRef.current.ready) { stopLiveBroadcast(); setLiveStatus('off'); }
      };
    } catch (e: any) {
      console.log('[live] exception:', e);
      setPopup({ type: 'error', title: 'Live', message: String(e?.message || e) });
      setLiveStatus('off');
    } finally {
      // Setup finished (ws registered or failed) — release the synchronous
      // guard; re-entry is now governed by liveBcRef.current.ws.
      liveBcRef.current.starting = false;
    }
  };
  const stopLiveBroadcast = () => {
    const b = liveBcRef.current;
    try { b.watchdog && clearTimeout(b.watchdog); } catch (e) {}
    try { b.flush && clearInterval(b.flush); } catch (e) {}
    try { b.mr && b.mr.stop(); } catch (e) {}
    try { b.ws && b.ws.readyState === 1 && b.ws.send(JSON.stringify({ type: 'stop' })); } catch (e) {}
    try { b.ws && b.ws.close(); } catch (e) {}
    try { b.raf && clearInterval(b.raf); } catch (e) {}
    try { b.ac && b.ac.close && b.ac.close(); } catch (e) {}
    liveBcRef.current = { ws: null, mr: null, raf: null, canvas: null, ac: null, flush: null, ready: false, watchdog: null, starting: false };
  };

  // ============ END-OF-MATCH CINEMA : replay interne + publication YouTube ============
  // Re-watch the finished match move-by-move inside the app (web + mobile),
  // no Google / no YouTube needed — drives the existing /replay viewer.
  const watchReplay = () => { router.push(`/replay/${challengeId}` as any); };

  // One tap on web → record the WHOLE match (screen) so it can be published to
  // YouTube at the end. Browsers require a user gesture for getDisplayMedia, so
  // this is a single tap rather than a silent auto-start; it auto-stops on game over.
  const filmMatch = () => { if (IS_WEB && !isRecording) startRecording('screen'); };

  // Publish the match to YouTube. We never upload on the user's behalf (that needs
  // their own Google sign-in) — we hand the recorded clip to YouTube's upload page
  // and let them sign in + publish. On web we first download the .webm so it is
  // ready to drop into the uploader.
  const publishMatchToYouTube = async () => {
    if (IS_WEB && recordedUrl) {
      try { await downloadRecording(); } catch {}
      setPopup({ type: 'success', title: '📤 YouTube', message: 'Your match clip was downloaded. Sign in to YouTube and drop the file in to publish — then the match is watchable for everyone.' });
    } else {
      setPopup({ type: 'info', title: '📤 Publish to YouTube', message: IS_WEB
        ? 'Tip: tap "🔴 Film this match" at the start so the whole game is captured, then publish here. Opening YouTube upload…'
        : "Record the match with your phone's screen recorder, then upload it here. Opening YouTube upload…" });
    }
    openExt('https://www.youtube.com/upload');
  };

  // Auto-stop the match recording the moment the result modal appears, so the
  // clip is finalized and ready to publish without the user stopping it manually.
  useEffect(() => {
    if (showResult && isRecording) { try { stopRecording(); } catch {} }
  }, [showResult]);

  const handleAbandon = async (autoLoss: boolean = false) => {
    if (autoLoss) { confirmAbandon(); return; }
    // Branded confirmation modal (same on web + native). Replaces the old
    // window.confirm/Alert.alert which were unstyled (and Alert.alert was a
    // silent no-op on react-native-web).
    setShowAbandon(true);
  };

  const confirmAbandon = async () => {
    try {
      clearInterval(timerRef.current);
      setGameOver(true);
      setMyBoard(solution); // Show corrected board

      const token = await AsyncStorage.getItem('sudoku_token');
      await fetch(`${API_URL}/challenges/${challengeId}/abandon`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      socketService.notifyAbandoned(challengeId);

      // ✅ FIX: Use ?? null for potentially undefined values
      const opponentId = isChallenger ? challenge?.challenged._id : challenge?.challenger._id;
      setWinner(opponentId ?? null);
      setShowResult(true);
    } catch (error) {
      console.error('Error abandoning:', error);
    }
  };

  // ============ CHAT / RECORD / SHARE / LIVE HELPERS ============
  const sendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    const msg = { id: 'm_'+Math.random().toString(36).slice(2,8), from: currentUser?.username || 'You', text, ts: Date.now() };
    setChatMessages(prev => [...prev, msg]);
    setChatInput('');
    try { socketService.sendChat(challengeId, { text }); } catch {}
  };

  const sendChatQuick = (text: string) => {
    const msg = { id: 'm_'+Math.random().toString(36).slice(2,8), from: currentUser?.username || 'You', text, ts: Date.now() };
    setChatMessages(prev => [...prev, msg]);
    try { socketService.sendChat(challengeId, { text }); } catch {}
  };

  const sendChatImage = () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      setPopup({ type: 'info', title: 'Image upload', message: 'Image attachments are available in the web build (browser file picker).' });
      return;
    }
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = String(reader.result || '');
        const msg = { id:'m_'+Math.random().toString(36).slice(2,8), from: currentUser?.username || 'You', img, ts: Date.now() };
        setChatMessages(prev => [...prev, msg]);
        try { socketService.sendChat(challengeId, { img }); } catch {}
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  /**
   * Record the match. `mode` = 'audio' (mic-only, default) or 'cam' (mic + webcam).
   * Bug-fix vs previous version:
   *  - mr.start(1000) timeslice → ondataavailable fires every 1 s instead of only
   *    on stop, so we don't end up with a 0-byte file when stop() races.
   *  - MediaRecorder.isTypeSupported() probe → pick the first codec the browser
   *    actually supports (webm/opus, webm, mp4) instead of forcing audio/webm
   *    which Safari/Firefox sometimes reject silently.
   */
  const recordModeRef = useRef<'audio' | 'cam' | 'screen'>('audio');
  const nativeRecRef = useRef<any>(null);   // expo-av Audio.Recording instance
  const startRecording = async (mode: 'audio' | 'cam' | 'screen' = 'audio') => {
    // ── Native (Android/iOS): expo-av Audio.Recording for mic, others = N/A. ──
    if (Platform.OS !== 'web') {
      if (mode !== 'audio') {
        setPopup({ type: 'info', title: 'Recording', message: mode === 'cam'
          ? 'Camera+mic recording is only available in the web build for now.'
          : 'Screen recording is only available in the web build.' });
        return;
      }
      if (!NativeAudio) { setPopup({ type:'error', title:'Recording', message:'expo-av is not installed in this build.' }); return; }
      try {
        recordModeRef.current = 'audio';
        const perm = await NativeAudio.requestPermissionsAsync();
        if (!perm?.granted) { setPopup({ type:'error', title:'Mic blocked', message:'Microphone permission denied.' }); return; }
        await NativeAudio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const rec = new NativeAudio.Recording();
        await rec.prepareToRecordAsync(NativeAudio.RecordingOptionsPresets.HIGH_QUALITY);
        await rec.startAsync();
        nativeRecRef.current = rec;
        recordStartRef.current = Date.now();
        setIsRecording(true);
        console.log('[record native] started');
      } catch (e: any) {
        console.log('[record native] start err', e);
        setPopup({ type:'error', title:'Recording', message: String(e?.message || e) });
      }
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setPopup({ type:'info', title:'Recording', message:'Browser MediaRecorder API not available here.' });
      return;
    }
    try {
      recordModeRef.current = mode;
      let stream: MediaStream;

      if (mode === 'screen') {
        // Capture screen (the user picks a tab/window/screen). On Chrome, the
        // "Share tab audio" checkbox brings in tab audio. Mix the mic on top
        // via WebAudio so your commentary is in the recording too.
        const dm: any = (navigator.mediaDevices as any).getDisplayMedia;
        if (!dm) { setPopup({ type:'info', title:'Screen recording', message:'Your browser does not expose getDisplayMedia.' }); return; }
        const display: MediaStream = await dm.call(navigator.mediaDevices, { video: { frameRate: 24 }, audio: true });
        let combined = display;
        try {
          const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
          const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
          if (AC) {
            const ctx = new AC();
            const dest = ctx.createMediaStreamDestination();
            if (display.getAudioTracks().length) ctx.createMediaStreamSource(display).connect(dest);
            ctx.createMediaStreamSource(mic).connect(dest);
            combined = new MediaStream([
              ...display.getVideoTracks(),
              ...dest.stream.getAudioTracks(),
            ]);
          }
          // When the user clicks "Stop sharing" in the browser bar, end the recording too
          display.getVideoTracks()[0].addEventListener('ended', () => stopRecording());
        } catch (e) { console.log('[record] mic-with-screen unavailable:', e); }
        stream = combined;
      } else {
        const constraints: any = mode === 'cam'
          ? { audio: true, video: { width: 640, height: 480 } }
          : { audio: true };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      }
      recordedChunksRef.current = [];

      // Pick the first mime type the browser actually supports
      const W: any = window;
      const candidates = (mode === 'cam' || mode === 'screen')
        ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
        : ['audio/webm;codecs=opus',     'audio/webm',                  'audio/mp4',  'audio/ogg;codecs=opus'];
      const mime = candidates.find(m => W.MediaRecorder && W.MediaRecorder.isTypeSupported(m)) || '';
      console.log('[record] mode:', mode, 'mime:', mime || '(default)', 'tracks:', stream.getTracks().map(t => `${t.kind}:${(t as any).readyState}`));

      const mr = new W.MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mr.ondataavailable = (e: any) => { if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const durMs = Date.now() - recordStartRef.current;
        const type = mime || (mode === 'audio' ? 'audio/webm' : 'video/webm');
        const rawBlob = new Blob(recordedChunksRef.current, { type });
        console.log('[record] stop — chunks:', recordedChunksRef.current.length, 'raw size:', rawBlob.size, 'duration:', durMs, 'ms');

        // fix-webm-duration uses a *callback* API. Wrapping it in a Promise
        // so the await actually waits for the patched blob (previous bug:
        // await returned undefined synchronously → the unpatched blob was
        // served and players showed the wrong duration / no progress bar).
        let finalBlob = rawBlob;
        if (type.startsWith('video/webm') || type.startsWith('audio/webm')) {
          try {
            finalBlob = await new Promise<Blob>((resolve) => {
              const t = setTimeout(() => { console.log('[record] fix timed out — using raw'); resolve(rawBlob); }, 4000);
              try {
                (fixWebmDuration as any)(rawBlob, durMs, (fixed: Blob) => {
                  clearTimeout(t);
                  console.log('[record] patched size:', (fixed || rawBlob).size);
                  resolve(fixed || rawBlob);
                });
              } catch (e) {
                clearTimeout(t);
                console.log('[record] fix sync threw:', e);
                resolve(rawBlob);
              }
            });
          } catch (e) { console.log('[record] fix wrap failed:', e); }
        }

        setRecordingDurMs(durMs);
        setRecordedUrl(URL.createObjectURL(finalBlob));
        stream.getTracks().forEach((t: any) => t.stop());
      };
      mr.onerror = (e: any) => console.log('[record] error', e);
      mediaRecorderRef.current = mr;
      recordStartRef.current = Date.now();
      mr.start(1000);          // timeslice so chunks are emitted every 1s
      setIsRecording(true);
    } catch (e: any) {
      setPopup({ type:'error', title:'Recording blocked', message: String(e?.message || e) });
    }
  };

  const stopRecording = async () => {
    if (Platform.OS !== 'web') {
      const rec = nativeRecRef.current;
      if (!rec) { setIsRecording(false); return; }
      try {
        await rec.stopAndUnloadAsync();
        const uri: string | null = rec.getURI?.() ?? null;
        nativeRecRef.current = null;
        setRecordingDurMs(Date.now() - recordStartRef.current);
        setRecordedUrl(uri);
        console.log('[record native] stopped, uri=', uri);
      } catch (e) { console.log('[record native] stop err', e); }
      setIsRecording(false);
      return;
    }
    try { mediaRecorderRef.current?.stop(); } catch {}
    setIsRecording(false);
  };

  const downloadRecording = async () => {
    if (!recordedUrl) return;
    // Native: share the file (Files app / WhatsApp / Drive…). Web: trigger DOM download.
    if (Platform.OS !== 'web') {
      try {
        if (NativeSharing && (await NativeSharing.isAvailableAsync())) {
          await NativeSharing.shareAsync(recordedUrl, { dialogTitle: 'Save recording', mimeType: 'audio/m4a', UTI: 'public.audio' });
        } else {
          setPopup({ type:'info', title:'Saved', message:`Recording saved to:\n${recordedUrl}` });
        }
      } catch (e: any) {
        setPopup({ type:'error', title:'Share failed', message: String(e?.message || e) });
      }
      return;
    }
    if (typeof document === 'undefined') return;
    const ext = recordModeRef.current === 'cam' ? 'webm' : 'webm'; // webm container, audio or video
    const kind = recordModeRef.current === 'cam' ? 'video' : 'audio';
    const a = document.createElement('a');
    a.href = recordedUrl;
    a.download = `sudoku-sally-${kind}-${challengeId}.${ext}`;
    a.click();
  };

  // ─────────── REAL WebRTC AUDIO/VIDEO CALL ───────────
  // ICE servers are fetched at runtime from /api/turn-creds (STUN + time-limited
  // TURN credentials on turn.salistar.com, our own coturn). OpenRelay removed.
  const [iceServers, setIceServers] = useState<any[]>([
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]);
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_URL}/turn-creds`);
        if (r.ok) {
          const d = await r.json();
          if (Array.isArray(d?.iceServers) && d.iceServers.length) {
            setIceServers(d.iceServers);
            console.log('[webrtc] ICE servers loaded:', d.iceServers.map((s: any) => s.urls));
          }
        }
      } catch (e) { console.log('[webrtc] turn-creds fetch failed', e); }
    })();
  }, []);
  const [callStatus, setCallStatus] = useState<'idle'|'calling'|'incoming'|'connecting'|'connected'|'failed'>('idle');

  // Attach the latest stream to a <video>/<audio> whenever EITHER the ref or
  // the stream changes (React refs attach AFTER render, so we can't rely on
  // ref being non-null when onTrack fires).
  function attachLocal(el: any) {
    localVidRef.current = el;
    if (el && localStreamRef.current && el.srcObject !== localStreamRef.current) el.srcObject = localStreamRef.current;
  }
  function attachRemote(el: any) {
    remoteVidRef.current = el;
    if (el && remoteStreamRef.current && el.srcObject !== remoteStreamRef.current) el.srcObject = remoteStreamRef.current;
  }

  function createPeer() {
    const { RTCPeerConnection } = getRTC();
    if (!RTCPeerConnection) return null;
    const pc: any = new RTCPeerConnection({ iceServers });
    pc.onicecandidate = (e: any) => {
      if (e.candidate) socketService.emitWebRTCIce(challengeId, e.candidate);
    };
    pc.ontrack = (e: any) => {
      remoteStreamRef.current = e.streams[0];
      // Web: attach via DOM srcObject. Native: rerender so RTCView picks it up.
      if (Platform.OS === 'web' && remoteVidRef.current) remoteVidRef.current.srcObject = e.streams[0];
      setRemoteStreamUrl(e.streams[0]?.toURL ? e.streams[0].toURL() : null);
      console.log('[webrtc] remote stream attached, tracks=', e.streams[0].getTracks().map((t: any) => t.kind));
    };
    pc.oniceconnectionstatechange = () => {
      console.log('[webrtc] iceConnectionState =', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') setCallStatus('connected');
      if (pc.iceConnectionState === 'failed') setCallStatus('failed');
    };
    pc.onconnectionstatechange = () => {
      console.log('[webrtc] connectionState =', pc.connectionState);
      if (pc.connectionState === 'connected') setCallStatus('connected');
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) hangup(false);
    };
    return pc;
  }

  async function ensureLocalMedia(video: boolean) {
    if (localStreamRef.current) return localStreamRef.current;
    const { mediaDevices } = getRTC();
    if (!mediaDevices?.getUserMedia) throw new Error('No mediaDevices available');
    // Native (react-native-webrtc) expects { video: { facingMode: 'user' } } for cam.
    const constraints =
      Platform.OS === 'web'
        ? { audio: true, video }
        : { audio: true, video: video ? { facingMode: 'user', width: 640, height: 480 } : false };
    const stream: any = await mediaDevices.getUserMedia(constraints);
    localStreamRef.current = stream;
    setLocalStreamUrl(stream?.toURL ? stream.toURL() : null);
    if (Platform.OS === 'web') setTimeout(() => { if (localVidRef.current) localVidRef.current.srcObject = stream; }, 0);
    return stream;
  }

  const startCall = useCallback(async (video: boolean) => {
    const { RTCPeerConnection } = getRTC();
    if (!RTCPeerConnection) {
      setPopup({ type: 'info', title: 'Calls', message: 'WebRTC is not available in this build.' });
      return;
    }
    try {
      setCallKind(video ? 'video' : 'audio');
      setCallActive(true);
      setCallStatus('calling');
      setCallError(null);
      const pc = createPeer();
      if (!pc) return;
      pcRef.current = pc;
      const stream = await ensureLocalMedia(video);
      stream.getTracks().forEach((t: any) => pc.addTrack(t, stream));
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: video });
      await pc.setLocalDescription(offer);
      socketService.emitWebRTCOffer(challengeId, offer);
      console.log('[webrtc] offer sent for challenge', challengeId, 'video=', video);
    } catch (e: any) {
      console.log('[webrtc] startCall error:', e?.message || e);
      setCallError(String(e?.message || e));
      setPopup({ type: 'error', title: 'Call failed', message: String(e?.message || e) });
      hangup(false);
    }
  }, [challengeId]);

  function hangup(notify: boolean = true) {
    try { localStreamRef.current?.getTracks?.().forEach((t: any) => t.stop()); } catch {}
    try { localStreamRef.current?.release?.(); } catch {}   // react-native-webrtc
    try { remoteStreamRef.current?.release?.(); } catch {}
    try { pcRef.current?.close?.(); } catch {}
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    pcRef.current = null;
    pendingIceRef.current = [];
    setLocalStreamUrl(null);
    setRemoteStreamUrl(null);
    if (notify) socketService.emitCallEnd(challengeId);
    setCallActive(false);
    setCallStatus('idle');
    setCallError(null);
  }

  // ── Incoming-call "ring" state ──
  const [incomingOffer, setIncomingOffer] = useState<{ sdp: any; video: boolean } | null>(null);
  const ringIntervalRef = useRef<any>(null);
  const ringCtxRef = useRef<any>(null);
  function startRing() {
    if (typeof window === 'undefined') return;
    try {
      const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      stopRing();
      ringCtxRef.current = new AC();
      const playBeep = () => {
        const ctx = ringCtxRef.current; if (!ctx) return;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 880;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
        gain.gain.setValueAtTime(0.15, t + 0.5); gain.gain.linearRampToValueAtTime(0, t + 0.6);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.7);
      };
      playBeep();
      ringIntervalRef.current = setInterval(playBeep, 1400);
    } catch (e) { console.log('[ring] failed', e); }
  }
  function stopRing() {
    if (ringIntervalRef.current) clearInterval(ringIntervalRef.current);
    ringIntervalRef.current = null;
    try { ringCtxRef.current?.close?.(); } catch {}
    ringCtxRef.current = null;
  }

  // Incoming offer → DON'T auto-accept. Show ringing UI; user clicks Accept/Reject.
  async function handleOffer(data: any) {
    if (typeof window === 'undefined') return;
    const video = !!data?.sdp?.sdp?.includes('m=video');
    console.log('[webrtc] incoming offer (video=', video, ') — ringing');
    setIncomingOffer({ sdp: data.sdp, video });
    setCallKind(video ? 'video' : 'audio');
    startRing();
    try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch {}
  }

  async function acceptIncomingCall() {
    if (!incomingOffer) return;
    const { RTCSessionDescription, RTCIceCandidate } = getRTC();
    if (!RTCSessionDescription) return;
    stopRing();
    const { sdp, video } = incomingOffer;
    setIncomingOffer(null);
    try {
      setCallActive(true);
      setCallStatus('connecting');
      const pc = createPeer();
      if (!pc) return;
      pcRef.current = pc;
      const stream = await ensureLocalMedia(video);
      stream.getTracks().forEach((t: any) => pc.addTrack(t, stream));
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      for (const cand of pendingIceRef.current) {
        try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch {}
      }
      pendingIceRef.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketService.emitWebRTCAnswer(challengeId, answer);
      console.log('[webrtc] answer sent (accepted)');
    } catch (e: any) {
      setCallError(String(e?.message || e));
      hangup(false);
    }
  }
  function rejectIncomingCall() {
    stopRing();
    setIncomingOffer(null);
    socketService.emitCallEnd(challengeId);
  }
  async function handleAnswer(data: any) {
    try {
      const { RTCSessionDescription } = getRTC();
      if (!pcRef.current || !RTCSessionDescription) return;
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
    } catch (e) { console.log('answer err', e); }
  }
  async function handleIce(data: any) {
    try {
      const { RTCIceCandidate } = getRTC();
      if (!RTCIceCandidate) return;
      if (!pcRef.current?.remoteDescription) { pendingIceRef.current.push(data.candidate); return; }
      await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (e) { console.log('ice err', e); }
  }

  const shareUrl = `https://sallysudo.com`;
  const shareText = `I'm playing a real-time 1v1 Sudoku duel on SallySudo!`;
  const openExt = (url: string) => Linking.openURL(url).catch(() => {});

  // ── DECK (chat + record) — rendered as the right sidebar on web, INSIDE the
  //    ScrollView under the boards on native. Factored out so layout is shared.
  function renderDeck() {
    return (
      <>
        {/* CHAT */}
        <View style={[styles.deckCol, styles.deckChat]}>
          <Text style={styles.deckTitle}>💬 {t('chatRoomTag')}</Text>
          <ScrollView style={styles.deckChatList} contentContainerStyle={{ padding: 10, gap: 6 }}>
            {chatMessages.length === 0 && <Text style={styles.deckEmpty}>{t('chatSayHi')} {opponent?.username || '…'}</Text>}
            {chatMessages.map((m) => {
              const mine = m.from === (currentUser?.username || 'You');
              return (
                <View key={m.id} style={[styles.chatBubble, mine ? styles.chatMine : styles.chatTheirs]}>
                  <Text style={styles.chatFrom}>{mine ? t('chatYou') : m.from}</Text>
                  {!!m.text && <Text style={styles.chatText}>{m.text}</Text>}
                  {!!m.img && <Text style={[styles.chatText, { fontStyle: 'italic', opacity: 0.7 }]}>📷 image</Text>}
                </View>
              );
            })}
          </ScrollView>
          <QuickTaunts onSend={sendChatQuick} />
          <View style={styles.chatInputRow}>
            <TouchableOpacity style={styles.chatAttach} onPress={sendChatImage}><Text style={styles.chatAttachIcon}>📎</Text></TouchableOpacity>
            <TextInput
              value={chatInput}
              onChangeText={setChatInput}
              placeholder={t('chatPlaceholder')}
              placeholderTextColor="#475569"
              style={styles.chatInput}
              onSubmitEditing={sendChat}
              returnKeyType="send"
            />
            <TouchableOpacity style={styles.chatSend} onPress={sendChat}>
              <Text style={styles.chatSendText}>{t('chatSend')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* RECORD */}
        <View style={[styles.deckCol, styles.deckRec]}>
          <Text style={styles.deckTitle}>🎙️ Record</Text>
          <Text style={styles.deckHint}>
            {IS_WEB
              ? 'Capture mic, cam+mic, or the whole screen+mic. Saves as .webm.'
              : 'Capture mic to .m4a. Cam/screen recording is available in the web build.'}
          </Text>
          <View style={styles.recRow}>
            {!isRecording ? (
              <>
                <TouchableOpacity style={[styles.recBtn, { backgroundColor: '#ef4444' }]} onPress={() => startRecording('audio')}>
                  <Text style={styles.recIcon}>🎙️</Text><Text style={styles.recText}>Mic</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.recBtn, { backgroundColor: '#a855f7' }]} onPress={() => startRecording('cam')}>
                  <Text style={styles.recIcon}>📹</Text><Text style={styles.recText}>Cam</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.recBtn, { backgroundColor: '#0ea5e9' }]} onPress={() => startRecording('screen')}>
                  <Text style={styles.recIcon}>🖥️</Text><Text style={styles.recText}>Screen</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={[styles.recBtn, { backgroundColor: '#fbbf24', flexBasis: '100%' }]} onPress={stopRecording}>
                <Text style={styles.recIcon}>⏹️</Text><Text style={styles.recText}>Stop ({recordModeRef.current})</Text>
              </TouchableOpacity>
            )}
          </View>
          {recordedUrl && !isRecording && (
            <TouchableOpacity style={[styles.recBtn, { backgroundColor: '#7c5cff', flexBasis: '100%' }]} onPress={downloadRecording}>
              <Text style={styles.recIcon}>⬇️</Text>
              <Text style={styles.recText}>
                {IS_WEB ? 'Download' : 'Save / Share'} ({Math.floor(recordingDurMs / 60000)}:{String(Math.floor((recordingDurMs % 60000) / 1000)).padStart(2, '0')})
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* LIVE — request-to-go-live handshake (opponent must ACCEPT first) */}
        <View style={[styles.deckCol, styles.deckRec]}>
          <Text style={styles.deckTitle}>🔴 Go Live</Text>
          <Text style={styles.deckHint}>Go live on YouTube — your opponent must ACCEPT before the broadcast starts.</Text>
          {liveStatus === 'live' ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#ef4444' }} />
                <Text style={{ color: '#fff', fontWeight: '700' }}>🔴 {liveStreamer ? `${liveStreamer} is LIVE` : 'LIVE'} on YouTube</Text>
              </View>
              {/* Honest signal: only green once real encoded segments are leaving the browser. */}
              <Text style={{ color: liveFrames > 0 ? '#34d399' : '#fbbf24', fontSize: 12, fontWeight: '700', marginBottom: 6 }}>
                {liveFrames > 0 ? `📡 ${liveFrames} segments envoyés — le flux monte` : '⏳ en attente des premières frames…'}
              </Text>
              {!!liveWatchUrl && (
                <TouchableOpacity style={[styles.recBtn, { backgroundColor: '#7c5cff', flexBasis: '100%', marginBottom: 8 }]} onPress={() => openExt(liveWatchUrl)}>
                  <Text style={styles.recIcon}>▶️</Text><Text style={styles.recText}>Ouvrir le live YouTube</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.recBtn, { backgroundColor: '#ef4444', flexBasis: '100%' }]} onPress={endLive}>
                <Text style={styles.recIcon}>⏹️</Text><Text style={styles.recText}>End live</Text>
              </TouchableOpacity>
            </>
          ) : liveStatus === 'connecting' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 10 }}>
              <ActivityIndicator color="#fbbf24" />
              <Text style={{ color: '#fbbf24', fontWeight: '700' }}>Connexion au flux YouTube…</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.recBtn, { backgroundColor: liveStatus === 'requesting' ? '#64748b' : '#FF0000', flexBasis: '100%' }]}
              disabled={liveStatus === 'requesting'}
              onPress={requestGoLive}>
              <Text style={styles.recIcon}>🔴</Text>
              <Text style={styles.recText}>{liveStatus === 'requesting' ? 'Waiting for opponent…' : 'Ask opponent → Go Live'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </>
    );
  }

  const SHARE_LINKS: Record<string, string> = {
    facebook:  `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`,
    twitter:   `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
    linkedin:  `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    instagram: `https://www.instagram.com/`,   // IG has no web share intent → open IG
    tiktok:    `https://www.tiktok.com/upload?lang=en`, // upload page
    youtube:   `https://www.youtube.com/upload`,
  };
  const LIVE_LINKS: Record<string, string> = {
    youtube:   `https://studio.youtube.com/channel/UC/livestreaming`,
    facebook:  `https://www.facebook.com/live/create`,
    tiktok:    `https://www.tiktok.com/live/creator-center`,
    instagram: `https://www.instagram.com/`,
    linkedin:  `https://www.linkedin.com/video/live/`,
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ============ RENDER BOARD ============
  const renderBoard = (board: Board, isOpponent: boolean = false) => {
    const size = isOpponent ? CELL_SIZE - 2 : CELL_SIZE;

    return (
      <View style={[styles.board, isOpponent && styles.opponentBoard]}>
        {board.map((row, i) => (
          <View key={i} style={styles.row}>
            {row.map((cell, j) => {
              const isSelected = !isOpponent && selected?.row === i && selected?.col === j;
              const isInitialCell = initial[i]?.[j];
              const isError = cell !== null && cell !== 0 && cell !== solution[i][j];

              return (
                <TouchableOpacity
                  key={j}
                  style={[
                    styles.cell,
                    { width: size, height: size },
                    isSelected && styles.selected,
                    isError && styles.errorCell,
                    j % 3 === 2 && j !== 8 && styles.borderRight,
                    i % 3 === 2 && i !== 8 && styles.borderBottom,
                  ]}
                  onPress={() => !isOpponent && handleCellPress(i, j)}
                  disabled={isOpponent || gameOver || myCompleted}
                >
                  {cell !== null && cell !== 0 && (
                    <Text style={[
                      styles.cellText,
                      { fontSize: size * 0.5 },
                      isInitialCell && styles.initialText,
                      isError && styles.errorText
                    ]}>
                      {cell}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  const opponent = challenge
    ? (isChallenger ? challenge.challenged : challenge.challenger)
    : { username: t('versus'), avatar: '👤' };

  // ============ LOADING ============
  if (loading) {
    return (
      <LinearGradient colors={['#0a0a1a', '#1a1a3a', '#0f0f2a']} style={styles.container}>
        <ActivityIndicator size="large" color="#7c5cff" style={{ flex: 1 }} />
      </LinearGradient>
    );
  }

  // ============ STREAM MODE — broadcast view: BOTH boards side-by-side ============
  // Opened as ...challenge-game?id=<id>&stream=1 (e.g. on the phone we capture).
  // Shows each player's name + time + live board, nothing else. Pure read of the
  // existing socket state; the normal gameplay screen is unchanged.
  if (streamMode) {
    const sz = Math.min(Math.floor((width - 52) / 2), 330);
    const cell = sz / 9;
    const StreamBoard = ({ board, name, time, errors, win }: { board: Board; name: string; time: number; errors: number; win: boolean }) => (
      <View style={{ alignItems: 'center', flex: 1 }}>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }} numberOfLines={1}>{win ? '🏆 ' : ''}{name}</Text>
        <Text style={{ color: '#fbbf24', fontSize: 14, fontWeight: '700', marginTop: 2, marginBottom: 8, fontVariant: ['tabular-nums'] }}>⏱️ {formatTime(time)} · ❌ {errors}</Text>
        <View style={{ width: sz, height: sz, backgroundColor: '#0a0a1a', borderWidth: 2, borderColor: '#4a4a6a', borderRadius: 6 }}>
          {Array.from({ length: 9 }).map((_, r) => (
            <View key={r} style={{ flexDirection: 'row', height: cell }}>
              {Array.from({ length: 9 }).map((_, c) => {
                const v = board?.[r]?.[c];
                const given = initial?.[r]?.[c];
                return (
                  <View key={c} style={{ width: cell, height: cell, alignItems: 'center', justifyContent: 'center',
                    borderRightWidth: (c + 1) % 3 === 0 && c < 8 ? 1.5 : StyleSheet.hairlineWidth, borderRightColor: '#4a4a6a',
                    borderBottomWidth: (r + 1) % 3 === 0 && r < 8 ? 1.5 : StyleSheet.hairlineWidth, borderBottomColor: '#4a4a6a' }}>
                    {!!v && v !== 0 && <Text style={{ color: given ? '#fff' : '#2dd4db', fontSize: cell * 0.55, fontWeight: given ? '800' : '700' }}>{v}</Text>}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    );
    const meName = currentUser?.username || 'You';
    const meWin = !!winner && winner === currentUser?.id;
    const oppWin = !!winner && winner !== currentUser?.id;
    return (
      <LinearGradient colors={['#0a0a1a', '#1a1a3a', '#0f0f2a']} style={styles.container}>
        <View style={{ flex: 1, paddingTop: 44, paddingHorizontal: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
            <Text style={{ color: '#fff', fontSize: 19, fontWeight: '900', letterSpacing: 0.5 }}>⚔️ SallySudo 1v1</Text>
            {liveStatus === 'live' && <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveBadgeText}>LIVE</Text></View>}
          </View>
          <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center', alignItems: 'flex-start' }}>
            <StreamBoard board={myBoard} name={meName} time={myTime} errors={myErrors} win={meWin} />
            <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '900', alignSelf: 'center' }}>VS</Text>
            <StreamBoard board={opponentBoard} name={opponent?.username || 'Opponent'} time={opponentTime} errors={opponentErrors} win={oppWin} />
          </View>
          {gameOver && !!winner && (
            <Text style={{ color: '#fbbf24', fontSize: 18, fontWeight: '900', textAlign: 'center', marginTop: 18 }}>
              🏆 {winner === currentUser?.id ? meName : opponent?.username} {t('wonLabel') || 'wins'}!
            </Text>
          )}
        </View>
      </LinearGradient>
    );
  }

  // ============ RENDER ============
  return (
    <LinearGradient colors={['#0a0a1a', '#1a1a3a', '#0f0f2a']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← {t('back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>⚔️ {t('challenge')}</Text>
        {liveStatus === 'live' ? (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        ) : (
          <Text style={styles.diff}>{challenge?.difficulty?.toUpperCase()}</Text>
        )}
      </View>

      {/* ============ TOP CALL BAR — always visible ============ */}
      <View style={styles.topCallBar}>
        <View style={styles.topCallBtns}>
          {!callActive ? (
            <>
              {IS_WEB && <Text style={styles.topCallLabel}>📞 Call your opponent — STUN + free TURN relay:</Text>}
              <TouchableOpacity style={[styles.callBtnSm, { backgroundColor:'#2dd4db' }]} onPress={() => startCall(false)}><Text style={styles.callIcon}>📞</Text><Text style={styles.callText}>Audio</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.callBtnSm, { backgroundColor:'#3b82f6' }]} onPress={() => startCall(true)}><Text style={styles.callIcon}>📹</Text><Text style={styles.callText}>Video</Text></TouchableOpacity>
            </>
          ) : (
            <>
              <View style={[styles.callStatusDot, callStatus === 'connected' && { backgroundColor: '#7c5cff' }, callStatus === 'calling' && { backgroundColor: '#fbbf24' }, callStatus === 'failed' && { backgroundColor: '#ef4444' }]} />
              <Text style={[styles.callText, { color:'#fff', marginRight: 12 }]}>
                {callKind === 'video' ? '📹 Video' : '📞 Audio'} —{' '}
                {callStatus === 'calling' ? 'ringing opponent…' :
                 callStatus === 'connecting' ? 'connecting…' :
                 callStatus === 'connected' ? 'connected ✓' :
                 callStatus === 'failed' ? 'failed' : 'active'}
              </Text>
              <TouchableOpacity style={[styles.callBtnSm, { backgroundColor:'#ef4444' }]} onPress={() => hangup(true)}><Text style={styles.callIcon}>📵</Text><Text style={styles.callText}>Hang up</Text></TouchableOpacity>
            </>
          )}
        </View>
        {/* Live / Share — web only; hidden on mobile so the board + number pad
            fit together in a single, playable view. */}
        {IS_WEB && (
        <View style={styles.topSocialBlock}>
          {/* Film the WHOLE match (one tap) so it can be published to YouTube at the end. */}
          <TouchableOpacity style={styles.filmBtn} onPress={isRecording ? stopRecording : filmMatch}>
            <Text style={styles.filmBtnText}>{isRecording ? '⏹️ Filming… stop' : '🔴 Film this match'}</Text>
          </TouchableOpacity>
          <Text style={styles.topSocialLabel}>🔴 Live · ↗️ Share</Text>
          <View style={styles.topSocialRow}>
            <SocialBtn brand="youtube"   compact onPress={() => openExt(LIVE_LINKS.youtube)} />
            <SocialBtn brand="facebook"  compact onPress={() => openExt(LIVE_LINKS.facebook)} />
            <SocialBtn brand="tiktok"    compact onPress={() => openExt(LIVE_LINKS.tiktok)} />
            <SocialBtn brand="instagram" compact onPress={() => openExt(LIVE_LINKS.instagram)} />
            <SocialBtn brand="linkedin"  compact onPress={() => openExt(LIVE_LINKS.linkedin)} />
            <SocialBtn brand="twitter"   compact onPress={() => openExt(SHARE_LINKS.twitter)} />
          </View>
        </View>
        )}

        {callActive && Platform.OS === 'web' && (
          <View style={styles.topCallVideos}>
            {/* Local video (or hidden for audio-only). Muted to avoid echo. */}
            {React.createElement('video', { ref: attachLocal, autoPlay: true, playsInline: true, muted: true,
              style: { width: callKind === 'video' ? 180 : 0, height: callKind === 'video' ? 120 : 0, borderRadius: 10, background: '#000', objectFit: 'cover', display: callKind === 'video' ? 'block' : 'none' } })}
            {/* Remote: always rendered. As <video> for video, as visible avatar+<audio> for audio. */}
            {callKind === 'video'
              ? React.createElement('video', { ref: attachRemote, autoPlay: true, playsInline: true,
                  style: { width: 180, height: 120, borderRadius: 10, background: '#000', objectFit: 'cover' } })
              : (<View style={styles.audioRemoteWrap}>
                  <Text style={styles.audioRemoteIcon}>🔊</Text>
                  <Text style={styles.audioRemoteName}>{opponent?.username || 'opponent'}</Text>
                  {React.createElement('audio', { ref: attachRemote, autoPlay: true, style: { display: 'none' } })}
                </View>)
            }
          </View>
        )}

        {/* Native call surface — RTCView for video, talking-head avatar for audio (mic captured, plays through earpiece by default) */}
        {callActive && Platform.OS !== 'web' && (
          <View style={styles.topCallVideos}>
            {callKind === 'video' && RTCView && localStreamUrl && (
              <RTCView streamURL={localStreamUrl} style={{ width: 160, height: 120, borderRadius: 10, backgroundColor: '#000' }} objectFit="cover" mirror />
            )}
            {callKind === 'video'
              ? (RTCView && remoteStreamUrl
                  ? <RTCView streamURL={remoteStreamUrl} style={{ width: 160, height: 120, borderRadius: 10, backgroundColor: '#000' }} objectFit="cover" />
                  : <View style={{ width: 160, height: 120, borderRadius: 10, backgroundColor: '#0008', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff' }}>📹 waiting…</Text></View>)
              : (<View style={styles.audioRemoteWrap}>
                  <Text style={styles.audioRemoteIcon}>🔊</Text>
                  <Text style={styles.audioRemoteName}>{opponent?.username || 'opponent'}</Text>
                </View>)
            }
          </View>
        )}
      </View>

      <View style={styles.bodyRow}>
      <ScrollView style={styles.scrollFlex} contentContainerStyle={styles.scroll}>
        {/* VS Banner */}
        <View style={styles.vs}>
          <View style={styles.player}>
            <Text style={styles.playerAvatar}>{currentUser?.avatar || '👤'}</Text>
            <Text style={styles.playerName}>{t('you')}</Text>
            <Text style={styles.playerStats}>⏱️ {formatTime(myTime)} • ❌ {myErrors}</Text>
            {myCompleted && <Text style={styles.done}>✅ {t('completedExcl')}</Text>}
          </View>
          
          <Text style={styles.vsText}>VS</Text>
          
          <View style={styles.player}>
            <Text style={styles.playerAvatar}>{opponent.avatar}</Text>
            <Text style={styles.playerName}>{opponent.username}</Text>
            <Text style={styles.playerStats}>⏱️ {formatTime(opponentTime)} • ❌ {opponentErrors}</Text>
            {opponentCompleted && <Text style={styles.done}>✅ {t('completedExcl')}</Text>}
          </View>
        </View>

        {/* Boards stacked vertically with the numpad SANDWICHED between them */}
        <View style={styles.boards}>
          {/* YOUR board */}
          <View style={styles.boardWrap}>
            <Text style={styles.boardLabel}>{t('yourGrid')}</Text>
            {myBoard.length > 0 ? renderBoard(myBoard, false) : (
              <View style={styles.boardLoading}>
                <ActivityIndicator color="#7c5cff" />
                <Text style={styles.boardLoadingText}>{t('loadingBoard') !== 'loadingBoard' ? t('loadingBoard') : 'Chargement du plateau…'}</Text>
              </View>
            )}
          </View>

          {/* Numpad + tools (between the two boards so input is fast) */}
          {!gameOver && !myCompleted && (
            <View style={styles.midControls}>
              <View style={styles.numpad}>
                {[1,2,3,4,5,6,7,8,9].map(num => (
                  <TouchableOpacity key={num} style={styles.numBtn} onPress={() => handleNumber(num)}>
                    <Text style={styles.numText}>{num}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.tools}>
                <TouchableOpacity style={styles.tool} onPress={handleErase}>
                  <Text style={styles.toolIcon}>🧹</Text>
                  <Text style={styles.toolLabel}>{t('erase')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tool, styles.abandonTool]} onPress={() => handleAbandon()}>
                  <Text style={styles.toolIcon}>🏳️</Text>
                  <Text style={styles.toolLabel}>{t('abandon')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* OPPONENT board */}
          <View style={styles.boardWrap}>
            <Text style={styles.boardLabel}>{opponent.username}</Text>
            {opponentBoard.length > 0 ? renderBoard(opponentBoard, true) : (
              <View style={styles.boardLoading}>
                <ActivityIndicator color="#7c5cff" />
                <Text style={styles.boardLoadingText}>{t('loadingBoard') !== 'loadingBoard' ? t('loadingBoard') : 'Chargement du plateau…'}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Waiting */}
        {myCompleted && !gameOver && (
          <View style={styles.waiting}>
            <ActivityIndicator color="#7c5cff" />
            <Text style={styles.waitingText}>{t('waitingForOpponent')} {opponent.username}...</Text>
          </View>
        )}

        {/* On NATIVE, the chat + record cards live INSIDE the scroll so they
            never hide the boards. On web the same content renders as the
            right sidebar (below). */}
        {!IS_WEB && (
          <View style={styles.deckInline}>
            {renderDeck()}
          </View>
        )}
      </ScrollView>

      {/* Result Modal */}
      <Modal visible={showResult} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.resultModal}>
            <Text style={styles.resultEmoji}>
              {winner === currentUser?.id ? '🏆' : winner === null ? '🤝' : '😔'}
            </Text>
            <Text style={styles.resultTitle}>
              {winner === currentUser?.id ? t('victory') : winner === null ? t('draw') : t('defeated')}
            </Text>
            <Text style={styles.resultSub}>
              {winner === currentUser?.id
                ? t('youWonChallenge')
                : winner === null
                  ? t('itsATie')
                  : `${opponent.username} ${t('wonLabel')}`}
            </Text>

            <View style={styles.resultStats}>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>{t('yourTimeLabel')}:</Text>
                <Text style={styles.resultValue}>{formatTime(myTime)}</Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>{t('yourErrors')}:</Text>
                <Text style={styles.resultValue}>{myErrors}</Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>{t('opponentTime')}:</Text>
                <Text style={styles.resultValue}>{formatTime(opponentTime)}</Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>{t('opponentErrors')}:</Text>
                <Text style={styles.resultValue}>{opponentErrors}</Text>
              </View>
            </View>

            {winner === currentUser?.id && (
              <View style={styles.rewards}>
                <Text style={styles.rewardsTitle}>{t('rewards')}:</Text>
                <Text style={styles.rewardsText}>+100 XP • +50 🪙 • +3 ⭐</Text>
              </View>
            )}

            {/* ── Watch the match: in-app replay (no Google) + publish to YouTube ── */}
            <View style={styles.cineRow}>
              <TouchableOpacity style={[styles.cineBtn, { backgroundColor: '#7c5cff' }]} onPress={watchReplay}>
                <Text style={styles.cineBtnText}>🎬 {t('watchReplay') !== 'watchReplay' ? t('watchReplay') : 'Revoir le match'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.cineBtn, { backgroundColor: '#FF0000' }]} onPress={publishMatchToYouTube}>
                <Text style={styles.cineBtnText}>📤 {t('publishYouTube') !== 'publishYouTube' ? t('publishYouTube') : 'Publier sur YouTube'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/challenges')}>
              <Text style={styles.backBtnText}>{t('backToLobby')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ============ COLLAPSE TOGGLE (only on web) ============ */}
      {IS_WEB && (
        <TouchableOpacity style={[styles.deckToggle, !deckOpen && styles.deckToggleCollapsed]} onPress={() => setDeckOpen(d => !d)} activeOpacity={0.85}>
          <Text style={styles.deckToggleText}>{deckOpen ? '▶' : '◀'}</Text>
        </TouchableOpacity>
      )}

      {/* ============ DECK — web: right sidebar; native: it's already rendered INSIDE the ScrollView above ============ */}
      {IS_WEB && deckOpen && (
        <View style={styles.deck}>
          {renderDeck()}
        </View>
      )}
      </View>{/* bodyRow */}

      <AppModal popup={popup} onClose={() => setPopup(null)} buttonLabel={t('gotIt')} />

      {/* ============ ABANDON — branded forfeit confirmation (web + native) ============ */}
      <Modal visible={showAbandon} transparent animationType="fade" onRequestClose={() => setShowAbandon(false)}>
        <View style={styles.ringOverlay}>
          <View style={[styles.ringCard, { borderColor: 'rgba(239,68,68,0.35)' }]}>
            <View style={styles.abandonBadge}><Text style={styles.abandonBadgeIcon}>🏳️</Text></View>
            <Text style={styles.ringTitle}>{t('abandonTitle')}</Text>
            <Text style={styles.ringSub}>{t('abandonConfirm')}</Text>
            <View style={styles.ringBtns}>
              <TouchableOpacity style={[styles.ringBtn, styles.abandonCancelBtn]} onPress={() => setShowAbandon(false)} activeOpacity={0.85}>
                <Text style={styles.ringBtnIcon}>↩️</Text>
                <Text style={styles.ringBtnText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.ringBtn, { backgroundColor: '#ef4444' }]} onPress={() => { setShowAbandon(false); confirmAbandon(); }} activeOpacity={0.85}>
                <Text style={styles.ringBtnIcon}>🏳️</Text>
                <Text style={styles.ringBtnText}>{t('abandon')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============ INCOMING CALL — ringing modal ============ */}
      <Modal visible={!!incomingOffer} transparent animationType="fade" onRequestClose={rejectIncomingCall}>
        <View style={styles.ringOverlay}>
          <View style={styles.ringCard}>
            <Text style={styles.ringPulse}>📞</Text>
            <Text style={styles.ringTitle}>{incomingOffer?.video ? 'Video call' : 'Audio call'}</Text>
            <Text style={styles.ringSub}>{opponent?.username || 'opponent'} is calling you…</Text>
            <View style={styles.ringBtns}>
              <TouchableOpacity style={[styles.ringBtn, { backgroundColor: '#ef4444' }]} onPress={rejectIncomingCall}>
                <Text style={styles.ringBtnIcon}>📵</Text>
                <Text style={styles.ringBtnText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.ringBtn, { backgroundColor: '#2dd4db' }]} onPress={acceptIncomingCall}>
                <Text style={styles.ringBtnIcon}>📞</Text>
                <Text style={styles.ringBtnText}>Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============ INCOMING LIVE — opponent asks to go live; we accept/decline ============ */}
      <Modal visible={!!incomingLive} transparent animationType="fade" onRequestClose={declineIncomingLive}>
        <View style={styles.ringOverlay}>
          <View style={styles.ringCard}>
            <Text style={styles.ringPulse}>🔴</Text>
            <Text style={styles.ringTitle}>Live request</Text>
            <Text style={styles.ringSub}>
              {(incomingLive?.fromName || opponent?.username || 'opponent')} wants to go live on{' '}
              {incomingLive?.platform === 'youtube' ? 'YouTube' : (incomingLive?.platform || 'YouTube')}.{'\n'}
              The stream starts only if you accept.
            </Text>
            <View style={styles.ringBtns}>
              <TouchableOpacity style={[styles.ringBtn, { backgroundColor: '#ef4444' }]} onPress={declineIncomingLive}>
                <Text style={styles.ringBtnIcon}>✖️</Text>
                <Text style={styles.ringBtnText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.ringBtn, { backgroundColor: '#22c55e' }]} onPress={acceptIncomingLive}>
                <Text style={styles.ringBtnIcon}>🔴</Text>
                <Text style={styles.ringBtnText}>Accept &amp; go live</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ============ CHAT / CALL / RECORD / SHARE / LIVE PANEL (legacy — kept hidden) ============ */}
      <Modal visible={false} transparent animationType="slide" onRequestClose={() => setPanelOpen(false)}>
        <View style={styles.panelOverlay}>
          <View style={styles.panelCard}>
            {/* tabs */}
            <View style={styles.panelTabs}>
              {(['chat','call','record','share','live'] as const).map(k => (
                <TouchableOpacity key={k} style={[styles.panelTab, panelTab===k && styles.panelTabActive]} onPress={() => setPanelTab(k)}>
                  <Text style={[styles.panelTabText, panelTab===k && styles.panelTabTextActive]}>
                    {k === 'chat' ? '💬 Chat' : k === 'call' ? '📞 Call' : k === 'record' ? '🎙️ Record' : k === 'share' ? '↗️ Share' : '🔴 Go Live'}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.panelClose} onPress={() => setPanelOpen(false)}>
                <Text style={styles.panelCloseX}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* tab content */}
            {panelTab === 'chat' && (
              <View style={styles.tabContent}>
                <ScrollView style={styles.chatList} contentContainerStyle={{ padding: 12, gap: 8 }}>
                  {chatMessages.length === 0 && <Text style={styles.chatEmpty}>{t('chatNoMessages')} {opponent?.username || '…'}</Text>}
                  {chatMessages.map(m => {
                    const mine = m.from === (currentUser?.username || 'You');
                    return (
                      <View key={m.id} style={[styles.chatBubble, mine ? styles.chatMine : styles.chatTheirs]}>
                        <Text style={styles.chatFrom}>{mine ? t('chatYou') : m.from}</Text>
                        {!!m.text && <Text style={styles.chatText}>{m.text}</Text>}
                        {!!m.img && Platform.OS === 'web' && (<Text style={[styles.chatText, { fontStyle:'italic', opacity:0.7 }]}>📷 image — open the web build to see it inline</Text>)}
                      </View>
                    );
                  })}
                </ScrollView>
                <QuickTaunts onSend={sendChatQuick} />
                <View style={styles.chatInputRow}>
                  <TouchableOpacity style={styles.chatAttach} onPress={sendChatImage}><Text style={{ fontSize: 18 }}>📎</Text></TouchableOpacity>
                  <TextInput value={chatInput} onChangeText={setChatInput} placeholder={t('chatPlaceholder')} placeholderTextColor="#475569" style={styles.chatInput} onSubmitEditing={sendChat} returnKeyType="send" />
                  <TouchableOpacity style={styles.chatSend} onPress={sendChat}><Text style={{ color:'#000', fontWeight:'700' }}>{t('chatSend')}</Text></TouchableOpacity>
                </View>
              </View>
            )}

            {panelTab === 'call' && (
              <View style={[styles.tabContent, styles.tabPad]}>
                {!callActive ? (
                  <>
                    <Text style={styles.tabHint}>Real WebRTC call with your opponent — peer-to-peer, signaled via the socket, STUN servers from Google. Allow the browser to use your microphone (and camera for video).</Text>
                    <View style={styles.callRow}>
                      <TouchableOpacity style={[styles.callBtn, { backgroundColor:'#2dd4db' }]} onPress={() => startCall(false)}><Text style={styles.callIcon}>📞</Text><Text style={styles.callText}>Audio call</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.callBtn, { backgroundColor:'#3b82f6' }]} onPress={() => startCall(true)}><Text style={styles.callIcon}>📹</Text><Text style={styles.callText}>Video call</Text></TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={[styles.tabHint, { color: '#7c5cff' }]}>● {callKind === 'video' ? 'Video' : 'Audio'} call active{callError ? ` — ${callError}` : ''}</Text>
                    {callKind === 'video' && Platform.OS === 'web' && (
                      <View style={styles.videoRow}>
                        {React.createElement('video', { ref: localVidRef, autoPlay: true, playsInline: true, muted: true, style: { width: 220, height: 165, borderRadius: 12, background: '#000', objectFit: 'cover' } })}
                        {React.createElement('video', { ref: remoteVidRef, autoPlay: true, playsInline: true, style: { width: 220, height: 165, borderRadius: 12, background: '#000', objectFit: 'cover' } })}
                      </View>
                    )}
                    {callKind === 'audio' && Platform.OS === 'web' && (
                      // Hidden audio element so the remote audio actually plays
                      <View>{React.createElement('audio', { ref: remoteVidRef, autoPlay: true, style: { display: 'none' } })}</View>
                    )}
                    <View style={styles.callRow}>
                      <TouchableOpacity style={[styles.callBtn, { backgroundColor:'#ef4444' }]} onPress={() => hangup(true)}><Text style={styles.callIcon}>📵</Text><Text style={styles.callText}>Hang up</Text></TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            )}

            {panelTab === 'record' && (
              <View style={[styles.tabContent, styles.tabPad]}>
                <Text style={styles.tabHint}>Record the audio of your match (your microphone). The file downloads as <Text style={{ color:'#7c5cff' }}>.webm</Text>.</Text>
                <View style={styles.callRow}>
                  {!isRecording ? (
                    <TouchableOpacity style={[styles.callBtn, { backgroundColor:'#ef4444' }]} onPress={() => startRecording('audio')}><Text style={styles.callIcon}>🔴</Text><Text style={styles.callText}>Start</Text></TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={[styles.callBtn, { backgroundColor:'#fbbf24' }]} onPress={stopRecording}><Text style={styles.callIcon}>⏹️</Text><Text style={styles.callText}>Stop</Text></TouchableOpacity>
                  )}
                  {recordedUrl && (
                    <TouchableOpacity style={[styles.callBtn, { backgroundColor:'#7c5cff' }]} onPress={downloadRecording}><Text style={styles.callIcon}>⬇️</Text><Text style={styles.callText}>Download</Text></TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {panelTab === 'share' && (
              <View style={[styles.tabContent, styles.tabPad]}>
                <Text style={styles.tabHint}>Share your duel on social media. Real brand colors • each opens the platform's share/upload page.</Text>
                <View style={styles.socialGrid}>
                  <SocialBtn brand="facebook" onPress={() => openExt(SHARE_LINKS.facebook)} />
                  <SocialBtn brand="instagram" onPress={() => openExt(SHARE_LINKS.instagram)} />
                  <SocialBtn brand="tiktok" onPress={() => openExt(SHARE_LINKS.tiktok)} />
                  <SocialBtn brand="youtube" onPress={() => openExt(SHARE_LINKS.youtube)} />
                  <SocialBtn brand="linkedin" onPress={() => openExt(SHARE_LINKS.linkedin)} />
                  <SocialBtn brand="twitter" onPress={() => openExt(SHARE_LINKS.twitter)} />
                </View>
              </View>
            )}

            {panelTab === 'live' && (
              <View style={[styles.tabContent, styles.tabPad]}>
                <Text style={styles.tabHint}>Go live on YouTube — your opponent must ACCEPT before the broadcast starts.</Text>

                {liveStatus === 'live' ? (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 10 }}>
                      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#ef4444' }} />
                      <Text style={{ color: '#fff', fontWeight: '700' }}>🔴 {liveStreamer ? `${liveStreamer} is LIVE` : 'LIVE'} on YouTube</Text>
                    </View>
                    <TouchableOpacity style={[styles.callBtn, { backgroundColor: '#ef4444' }]} onPress={endLive}>
                      <Text style={styles.callText}>⏹️ End live</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={[styles.callBtn, { backgroundColor: liveStatus === 'requesting' ? '#64748b' : '#FF0000', marginBottom: 12 }]}
                    disabled={liveStatus === 'requesting'}
                    onPress={requestGoLive}>
                    <Text style={styles.callText}>{liveStatus === 'requesting' ? '⏳ Waiting for opponent to accept…' : '🔴 Ask opponent → Go Live (YouTube)'}</Text>
                  </TouchableOpacity>
                )}

                <Text style={[styles.tabHint, { marginTop: 10 }]}>Or open a platform's “create live” page directly:</Text>
                <View style={styles.socialGrid}>
                  <SocialBtn brand="youtube" label="YouTube Live" onPress={() => openExt(LIVE_LINKS.youtube)} />
                  <SocialBtn brand="facebook" label="FB Live" onPress={() => openExt(LIVE_LINKS.facebook)} />
                  <SocialBtn brand="tiktok" label="TikTok Live" onPress={() => openExt(LIVE_LINKS.tiktok)} />
                  <SocialBtn brand="instagram" label="IG Live" onPress={() => openExt(LIVE_LINKS.instagram)} />
                  <SocialBtn brand="linkedin" label="LinkedIn Live" onPress={() => openExt(LIVE_LINKS.linkedin)} />
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

// ============ STYLES ============
const styles = StyleSheet.create({
  // NOTE: do NOT pin height:100vh + overflow:hidden here — it makes the game
  // page un-scrollable on web (the two stacked boards extend below the fold and
  // could no longer be reached). Keep the page free to grow + scroll like before.
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, paddingTop: 50 },
  back: { color: '#64748b', fontSize: 16 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  diff: { color: '#fbbf24', fontSize: 11, backgroundColor: 'rgba(251,191,36,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF0000', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, gap: 5 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  liveBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },

  // Native: ScrollView fills the screen and scrolls internally.
  // Web: do NOT clamp to flex:1 — that bounds it to the leftover height of the
  // fixed-height DesktopShell box and clips the 2nd board + numpad below the
  // fold. Let it grow to natural height so the OUTER shell scroller (overflowY)
  // scrolls the whole page and BOTH boards + numpad are fully visible.
  scrollFlex: IS_WEB ? {} : { flex: 1 },
  scroll: { padding: 10, paddingBottom: 20, alignItems: 'center' },

  vs: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 14, marginBottom: 12 },
  player: { alignItems: 'center', flex: 1 },
  playerAvatar: { fontSize: 28 },
  playerName: { color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 3 },
  playerStats: { color: '#64748b', fontSize: 10, marginTop: 2 },
  done: { color: '#7c5cff', fontSize: 11, marginTop: 3, fontWeight: '600' },
  vsText: { color: '#ef4444', fontWeight: '800', fontSize: 14 },

  // Stacked layout: ONE board after the other (vertical column), centered horizontally,
  // with the numpad SANDWICHED between them.
  boards: { flexDirection: 'column', alignItems: 'center', gap: 16, marginBottom: 20 },
  boardWrap: { alignItems: 'center' },
  midControls: { alignItems: 'center', gap: 10 },
  boardLabel: { color: '#64748b', fontSize: 11, marginBottom: 6 },
  board: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: 2 },
  opponentBoard: { opacity: 0.8 },
  row: { flexDirection: 'row' },
  cell: { justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: '#334155' },
  selected: { backgroundColor: 'rgba(59,130,246,0.4)' },
  errorCell: { backgroundColor: 'rgba(239,68,68,0.2)' },
  borderRight: { borderRightWidth: 2, borderRightColor: '#7c5cff' },
  borderBottom: { borderBottomWidth: 2, borderBottomColor: '#7c5cff' },
  cellText: { color: '#fff', fontWeight: '600' },
  initialText: { color: '#94a3b8' },
  errorText: { color: '#ef4444' },

  numpad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 5, marginBottom: 12 },
  numBtn: { width: 45, height: 45, backgroundColor: 'rgba(124,92,255,0.2)', borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#7c5cff' },
  numText: { color: '#7c5cff', fontSize: 20, fontWeight: '700' },

  tools: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  tool: { alignItems: 'center', padding: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, minWidth: 70 },
  abandonTool: { backgroundColor: 'rgba(239,68,68,0.2)' },
  toolIcon: { fontSize: 20 },
  toolLabel: { color: '#64748b', fontSize: 10, marginTop: 3 },

  waiting: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 15, backgroundColor: 'rgba(124,92,255,0.1)', borderRadius: 10, marginTop: 15 },
  waitingText: { color: '#7c5cff', fontSize: 13 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  resultModal: { backgroundColor: '#1a1a3a', padding: 25, borderRadius: 20, alignItems: 'center', width: '85%' },
  resultEmoji: { fontSize: 60, marginBottom: 10 },
  resultTitle: { color: '#fff', fontSize: 26, fontWeight: '800' },
  resultSub: { color: '#94a3b8', fontSize: 14, marginTop: 5 },
  resultStats: { width: '100%', marginTop: 20, backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 10 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  resultLabel: { color: '#64748b', fontSize: 13 },
  resultValue: { color: '#fff', fontSize: 13, fontWeight: '600' },
  rewards: { marginTop: 15, backgroundColor: 'rgba(124,92,255,0.1)', padding: 12, borderRadius: 10, alignItems: 'center' },
  rewardsTitle: { color: '#7c5cff', fontSize: 12 },
  rewardsText: { color: '#7c5cff', fontSize: 16, fontWeight: '700', marginTop: 3 },
  backBtn: { marginTop: 20, backgroundColor: '#7c5cff', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 10 },
  backBtnText: { color: '#000', fontSize: 14, fontWeight: '700' },
  cineRow: { flexDirection: 'row', gap: 10, marginTop: 18, width: '100%', justifyContent: 'center', flexWrap: 'wrap' },
  cineBtn: { paddingVertical: 11, paddingHorizontal: 16, borderRadius: 10, minWidth: 150, alignItems: 'center' },
  cineBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  filmBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,0,0,0.14)', borderWidth: 1, borderColor: '#FF0000', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  filmBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  // ============ FLOATING TOOLS BUTTON ============
  fab: { position: 'absolute', right: 16, bottom: 22, width: 58, height: 58, borderRadius: 29, backgroundColor: '#7c5cff',
    alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  fabIcon: { fontSize: 26 },
  fabBadge: { position: 'absolute', top: -2, right: -2, minWidth: 22, height: 22, paddingHorizontal: 5, backgroundColor: '#ef4444', borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0a0a1a' },
  fabBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  // ============ PANEL ============
  panelOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  panelCard: { backgroundColor: '#13132c', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 12, maxHeight: '80%', borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  panelTabs: { flexDirection: 'row', gap: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', alignItems: 'center' },
  panelTab: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.05)' },
  panelTabActive: { backgroundColor: '#7c5cff' },
  panelTabText: { color: '#94a3b8', fontSize: 13, fontWeight: '700' },
  panelTabTextActive: { color: '#000' },
  panelClose: { marginLeft: 'auto', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  panelCloseX: { color: '#94a3b8', fontSize: 16, fontWeight: '700' },
  tabContent: { paddingTop: 12 },
  tabPad: { padding: 16, gap: 14 },
  tabHint: { color: '#94a3b8', fontSize: 13, lineHeight: 19 },

  // ============ CHAT ============
  chatList: { maxHeight: 360, minHeight: 200, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12 },
  chatEmpty: { color: '#64748b', fontSize: 13, textAlign: 'center', padding: 20 },
  chatBubble: { padding: 10, borderRadius: 12, maxWidth: '85%' },
  chatMine: { alignSelf: 'flex-end', backgroundColor: 'rgba(124,92,255,0.15)', borderColor: 'rgba(124,92,255,0.35)', borderWidth: 1 },
  chatTheirs: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.06)' },
  chatFrom: { color: '#94a3b8', fontSize: 10, fontWeight: '700', marginBottom: 4 },
  chatText: { color: '#fff', fontSize: 14 },
  chatInputRow: IS_WEB
    ? { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10 }
    : { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10 },
  chatAttach: IS_WEB
    ? { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' }
    : { width: 38, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  chatAttachIcon: { fontSize: 18 },
  chatInput: IS_WEB
    ? { flex: 1, minWidth: 0, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, color: '#fff', fontSize: 14 }
    : { flex: 1, minWidth: 0, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 22, paddingHorizontal: 14, paddingVertical: 11, color: '#fff', fontSize: 15, minHeight: 44 },
  chatSend: IS_WEB
    ? { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#7c5cff' }
    : { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 22, backgroundColor: '#7c5cff', minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  chatSendText: { color: '#000', fontWeight: '800', fontSize: 13 },

  // ============ CALL / RECORD ============
  callRow: { flexDirection: 'row', gap: 12, justifyContent: 'center', flexWrap: 'wrap' },
  callBtn: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: 14, alignItems: 'center', gap: 6, minWidth: 130 },
  callIcon: { fontSize: 26 },
  callText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  videoRow: { flexDirection: 'row', gap: 12, justifyContent: 'center', flexWrap: 'wrap' },

  // ============ TOP CALL BAR ============
  topCallBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, paddingHorizontal: 20, backgroundColor: 'rgba(17,17,40,0.6)', borderBottomWidth: 1, borderBottomColor: 'rgba(124,92,255,0.15)', gap: 12, flexWrap: 'wrap' },
  topCallBtns: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  topCallVideos: { flexDirection: 'row', gap: 10 },
  topCallLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginRight: 6 },
  callBtnSm: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  callStatusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fbbf24', marginRight: 6 },
  audioRemoteWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: 'rgba(124,92,255,0.12)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(124,92,255,0.35)' },
  audioRemoteIcon: { fontSize: 20 },
  audioRemoteName: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // ============ TOP SOCIAL (Live + Share inside the top call bar) ============
  topSocialBlock: { alignItems: 'center', gap: 4 },
  topSocialLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  topSocialRow: { flexDirection: 'row', gap: 8 },

  // ============ BODY ROW — web: ScrollView (main) | deck (right sidebar) ============
  bodyRow: IS_WEB
    ? { flexDirection: 'row', alignItems: 'flex-start' }
    : { flex: 1, flexDirection: 'column' },

  // ============ DECK — web: right sidebar block; native: inline INSIDE scroll ============
  deck: { width: 360, flexDirection: 'column', gap: 16, padding: 14, backgroundColor: 'rgba(0,0,0,0.35)', borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.08)' },
  // Inline deck under the boards on native — column stack, full width, gap.
  deckInline: { flexDirection: 'column', gap: 14, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 24, width: '100%' },
  deckCol: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14, gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' },
  // Web sidebar chat grows; record stays compact. Native: both natural height.
  deckChat: IS_WEB ? { flex: 1, minHeight: 280 } : { width: '100%' },
  deckRec: IS_WEB ? { flexShrink: 0 } : { width: '100%' },
  deckLive: { },
  deckFootnote: { color: '#64748b', fontSize: 10, lineHeight: 14, fontStyle: 'italic', marginTop: 6 },

  // ============ DECK TOGGLE (collapse the right sidebar on web) ============
  deckToggle: { position: 'absolute', right: 360, top: '50%', width: 22, height: 50, marginTop: -25, backgroundColor: 'rgba(124,92,255,0.85)', borderTopLeftRadius: 10, borderBottomLeftRadius: 10, alignItems: 'center', justifyContent: 'center', zIndex: 10, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { width: -2, height: 0 }, elevation: 5 },
  deckToggleCollapsed: { right: 0 },
  deckToggleText: { color: '#000', fontSize: 14, fontWeight: '900' },

  // ============ RECORD BUTTONS ============
  // Web: 3 buttons in a row.   Native: grid (flexWrap) so each button is wide
  // enough to read instead of being squeezed into a vertical "stick".
  recRow: IS_WEB
    ? { flexDirection: 'row', gap: 8 }
    : { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recBtn: IS_WEB
    ? { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 11, borderRadius: 12 }
    : { flexBasis: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 14, borderRadius: 14, minHeight: 52 },
  recIcon: IS_WEB ? { fontSize: 18 } : { fontSize: 20 },
  recText: IS_WEB ? { color: '#fff', fontSize: 12, fontWeight: '700' } : { color: '#fff', fontSize: 14, fontWeight: '800' },

  // ============ RINGING MODAL ============
  ringOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  ringCard: { backgroundColor: '#13132c', padding: 32, borderRadius: 22, alignItems: 'center', gap: 12, maxWidth: 360, width: '85%', borderWidth: 1, borderColor: 'rgba(124,92,255,0.3)', shadowColor: '#7c5cff', shadowOpacity: 0.4, shadowRadius: 30 },
  ringPulse: { fontSize: 64 },
  ringTitle: { color: '#7c5cff', fontSize: 18, fontWeight: '800', letterSpacing: 1 },
  ringSub: { color: '#cbd5e1', fontSize: 15, marginBottom: 14, textAlign: 'center' },
  ringBtns: { flexDirection: 'row', gap: 14, width: '100%', justifyContent: 'center' },
  ringBtn: { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16, minWidth: 110 },
  ringBtnIcon: { fontSize: 28 },
  ringBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  // Branded forfeit modal accents
  abandonBadge: { width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(239,68,68,0.14)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.5)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  abandonBadgeIcon: { fontSize: 40 },
  abandonCancelBtn: { backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  // Shown instead of a blank grid while the challenge data is still loading
  // (e.g. slow network) — avoids the "boards disappeared" look.
  boardLoading: { width: IS_WEB ? 396 : Math.min(width, 360) - 84, height: IS_WEB ? 396 : Math.min(width, 360) - 84, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: 'rgba(124,92,255,0.05)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(124,92,255,0.18)' },
  boardLoadingText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  deckTitle: { color: '#7c5cff', fontSize: 13, fontWeight: '800', letterSpacing: 0.8 },
  deckHint: { color: '#94a3b8', fontSize: 11, lineHeight: 16 },
  // Web: chat card grows, list fills it. Native: chat is in the scrollview so
  // the list can have a generous fixed height; the outer page scrolls beyond.
  deckChatList: IS_WEB
    ? { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 10, flex: 1, minHeight: 120 }
    : { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 10, height: 220 },
  deckEmpty: { color: '#64748b', fontSize: 12, textAlign: 'center', padding: 12 },

  // ============ SOCIAL GRID ============
  socialGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center', paddingVertical: 10 },
});