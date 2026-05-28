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
import { useLang } from '../utils/LanguageContext';
import AppModal, { PopupData } from '../components/AppModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';

const { width } = Dimensions.get('window');
// This screen needs more horizontal room than the rest of the app: on web,
// we override #root max-width to 1100px in a useEffect below; on native we
// already have the device's full width. Cells stay readable on phones.
const IS_WEB = Platform.OS === 'web';
// Cells sized so BOTH boards + the bottom deck + top call bar all fit on
// a typical desktop viewport without the deck "eating" the boards.
const CELL_SIZE = IS_WEB ? 42 : Math.max(22, Math.floor((Math.min(width, 480) - 24) / 9));

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

// PRODUCTION API by default (works on any network, incl. 4G). Flip to local for dev.
const USE_LOCAL_BACKEND = false;
const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
const API_URL =
  (USE_LOCAL_BACKEND && devHost ? `http://${devHost}:3101` : 'https://api.sudoku.gowithsally.com') + '/api';

// ============ SOCIAL BRAND BUTTON — real SVG icons + brand colors ============
import Svg, { Path, Circle, Rect, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

function FacebookIcon()  { return (<Svg viewBox="0 0 24 24" width={28} height={28}><Path fill="#fff" d="M13.5 21v-7.5h2.55l.38-2.97H13.5V8.75c0-.86.24-1.45 1.47-1.45H16.5V4.65c-.27-.04-1.18-.12-2.24-.12-2.21 0-3.72 1.35-3.72 3.83v2.17H8v2.97h2.54V21h2.96z"/></Svg>); }
function InstagramIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={28} height={28}>
      <Defs>
        <SvgLinearGradient id="ig" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#feda75"/><Stop offset=".25" stopColor="#fa7e1e"/><Stop offset=".55" stopColor="#d62976"/><Stop offset=".85" stopColor="#962fbf"/><Stop offset="1" stopColor="#4f5bd5"/>
        </SvgLinearGradient>
      </Defs>
      <Rect x="2" y="2" width="20" height="20" rx="5" fill="url(#ig)"/>
      <Rect x="5.5" y="5.5" width="13" height="13" rx="4" stroke="#fff" strokeWidth="1.6" fill="none"/>
      <Circle cx="12" cy="12" r="3.4" stroke="#fff" strokeWidth="1.6" fill="none"/>
      <Circle cx="17.2" cy="6.8" r="1" fill="#fff"/>
    </Svg>
  );
}
function TiktokIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={28} height={28}>
      <Path fill="#25F4EE" d="M16.6 5.82A4.83 4.83 0 0 1 15.43 3h-2.74v11.93a2.42 2.42 0 1 1-2.42-2.42c.13 0 .26.02.38.04V9.79a5.27 5.27 0 0 0-.38-.02 5.16 5.16 0 1 0 5.16 5.16V8.94a7.55 7.55 0 0 0 4.4 1.41V7.6a4.54 4.54 0 0 1-3.23-1.78z"/>
      <Path fill="#FE2C55" d="M17.85 7.13A4.83 4.83 0 0 1 16.6 4.4h-1.17a4.54 4.54 0 0 0 3.23 3.97V7.13z" opacity=".9"/>
    </Svg>
  );
}
function YoutubeIcon()  { return (<Svg viewBox="0 0 24 24" width={28} height={28}><Path fill="#fff" d="M21.6 7.2s-.19-1.35-.78-1.94c-.74-.77-1.57-.78-1.95-.82C16.13 4.2 12 4.2 12 4.2h-.01s-4.12 0-6.86.24c-.38.05-1.21.05-1.95.82C2.59 5.85 2.4 7.2 2.4 7.2S2.2 8.79 2.2 10.39v1.49c0 1.59.2 3.19.2 3.19s.19 1.35.78 1.94c.74.77 1.71.74 2.14.82 1.56.15 6.6.2 6.6.2s4.13-.01 6.87-.25c.38-.05 1.21-.05 1.95-.82.59-.59.78-1.94.78-1.94s.2-1.59.2-3.19v-1.49c0-1.59-.2-3.19-.2-3.19zM9.93 13.58V8.13l5.31 2.74-5.31 2.71z"/></Svg>); }
function LinkedinIcon() { return (<Svg viewBox="0 0 24 24" width={28} height={28}><Path fill="#fff" d="M6.94 5a1.94 1.94 0 1 1-3.88 0 1.94 1.94 0 0 1 3.88 0zM7 8.48H3V21h4V8.48zM13.32 8.48H9.34V21h3.94v-6.57c0-3.66 4.78-4 4.78 0V21H22v-7.93c0-6.17-7.06-5.94-8.68-2.91v-1.68z"/></Svg>); }
function XIcon()        { return (<Svg viewBox="0 0 24 24" width={28} height={28}><Path fill="#fff" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></Svg>); }

const BRANDS: Record<string, { color: string; bg?: string; Icon: React.FC; name: string; grad?: [string, string] }> = {
  facebook:  { color: '#1877F2', Icon: FacebookIcon,  name: 'Facebook' },
  instagram: { color: '#E1306C', Icon: InstagramIcon, name: 'Instagram', bg: 'transparent' },
  tiktok:    { color: '#010101', Icon: TiktokIcon,    name: 'TikTok' },
  youtube:   { color: '#FF0000', Icon: YoutubeIcon,   name: 'YouTube' },
  linkedin:  { color: '#0A66C2', Icon: LinkedinIcon,  name: 'LinkedIn' },
  twitter:   { color: '#000000', Icon: XIcon,         name: 'X' },
};
function SocialBtn({ brand, label, onPress }: { brand: keyof typeof BRANDS; label?: string; onPress: () => void }) {
  const b = BRANDS[brand];
  const Icon = b.Icon;
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
  label: { color: '#cbd5e1', fontSize: 11, fontWeight: '600', textAlign: 'center' },
});

export default function ChallengeGame() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLang();
  const challengeId = id as string;

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

  const timerRef = useRef<NodeJS.Timeout>();

  // ============ CHAT / SHARE / CALL / RECORD UI STATE ============
  const [panelTab, setPanelTab] = useState<'chat' | 'call' | 'record' | 'share' | 'live'>('chat');
  const [panelOpen, setPanelOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; from: string; text?: string; img?: string; ts: number }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<any>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<any>(null);

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
      try { hangup(true); } catch {}
    };
  }, [challengeId]);

  // Timer
  useEffect(() => {
    if (!gameOver && !myCompleted && challenge?.status === 'playing') {
      timerRef.current = setInterval(() => setMyTime(t => t + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [gameOver, myCompleted, challenge?.status]);

  // ============ SOCKET LISTENERS ============
  const setupSocketListeners = () => {
    socketService.joinChallenge(challengeId);

    // ── WebRTC signaling ──
    socketService.on('webrtc:offer',  (d: any) => handleOffer(d));
    socketService.on('webrtc:answer', (d: any) => handleAnswer(d));
    socketService.on('webrtc:ice',    (d: any) => handleIce(d));
    socketService.on('call:end',      () => hangup(false));

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

    // Opponent completed
    socketService.on('player:completed', (data: any) => {
      if (data.odcUserId !== currentUser?.id) {
        setOpponentCompleted(true);
        setOpponentTime(data.timeSpent);
        setOpponentErrors(data.errors);
        if (myCompleted) determineWinner();
      }
    });

    // Opponent abandoned
    socketService.on('player:abandoned', (data: any) => {
      if (data.odcUserId !== currentUser?.id) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setGameOver(true);
        setWinner(currentUser?.id ?? null); // ✅ FIX: Use ?? null
        setShowResult(true);
      }
    });

    // Final result
    socketService.on('challenge:result', (data: any) => {
      setGameOver(true);
      setWinner(data.winner ?? null); // ✅ FIX: Use ?? null
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
      }
    } catch (error) {
      console.error('Error loading challenge:', error);
      setPopup({ type: 'error', title: t('error'), message: t('failedLoadChallenge') });
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
        setPopup({ type: 'success', title: t('completedExcl'), message: t('waitingOpponentFinish') });
      }
    } catch (error) {
      console.error('Error completing challenge:', error);
    }
  };

  const determineWinner = () => {
    const myScore = myTime + (myErrors * 30);
    const oppScore = opponentTime + (opponentErrors * 30);

    if (myScore < oppScore) {
      setWinner(currentUser?.id ?? null); // ✅ FIX: Use ?? null
    } else if (oppScore < myScore) {
      // ✅ FIX: Use ?? null for potentially undefined values
      const opponentId = isChallenger ? challenge?.challenged._id : challenge?.challenger._id;
      setWinner(opponentId ?? null);
    } else {
      setWinner(null); // Draw
    }

    setGameOver(true);
    setShowResult(true);
  };

  const handleAbandon = async (autoLoss: boolean = false) => {
    if (!autoLoss) {
      Alert.alert(
        `🏳️ ${t('abandonTitle')}`,
        t('abandonConfirm'),
        [
          { text: t('cancel'), style: 'cancel' },
          { text: t('abandon'), style: 'destructive', onPress: confirmAbandon }
        ]
      );
    } else {
      confirmAbandon();
    }
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

  const startRecording = async () => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setPopup({ type:'info', title:'Recording', message:'Audio recording uses the browser MediaRecorder API and is available in the web build.' });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunksRef.current = [];
      const mr = new (window as any).MediaRecorder(stream, { mimeType: 'audio/webm' });
      mr.ondataavailable = (e: any) => { if (e.data?.size > 0) recordedChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        setRecordedUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t: any) => t.stop());
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setIsRecording(true);
    } catch (e: any) {
      setPopup({ type:'error', title:'Mic blocked', message: String(e?.message || e) });
    }
  };

  const stopRecording = () => {
    try { mediaRecorderRef.current?.stop(); } catch {}
    setIsRecording(false);
  };

  const downloadRecording = () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || !recordedUrl) return;
    const a = document.createElement('a');
    a.href = recordedUrl;
    a.download = `sudoku-sally-${challengeId}.webm`;
    a.click();
  };

  // ─────────── REAL WebRTC AUDIO/VIDEO CALL ───────────
  // STUN to discover public IPs + free TURN relay (OpenRelay by Metered) for
  // cross-NAT cases where STUN alone isn't enough.
  const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80',  username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ];
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
    if (typeof window === 'undefined') return null;
    const pc = new (window as any).RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (e: any) => {
      if (e.candidate) socketService.emitWebRTCIce(challengeId, e.candidate);
    };
    pc.ontrack = (e: any) => {
      remoteStreamRef.current = e.streams[0];
      if (remoteVidRef.current) remoteVidRef.current.srcObject = e.streams[0];
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
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
    localStreamRef.current = stream;
    setTimeout(() => { if (localVidRef.current) localVidRef.current.srcObject = stream; }, 0);
    return stream;
  }

  const startCall = useCallback(async (video: boolean) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !(window as any).RTCPeerConnection) {
      setPopup({ type: 'info', title: 'Calls', message: 'WebRTC calls work in the web build of the app.' });
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
    try { pcRef.current?.close?.(); } catch {}
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    pcRef.current = null;
    pendingIceRef.current = [];
    if (notify) socketService.emitCallEnd(challengeId);
    setCallActive(false);
    setCallStatus('idle');
    setCallError(null);
  }

  // Incoming offer → answer
  async function handleOffer(data: any) {
    if (typeof window === 'undefined') return;
    try {
      const video = !!data?.sdp?.sdp?.includes('m=video');
      console.log('[webrtc] incoming offer (video=', video, ')');
      setCallKind(video ? 'video' : 'audio');
      setCallActive(true);
      setCallStatus('connecting');
      const pc = createPeer();
      if (!pc) return;
      pcRef.current = pc;
      const stream = await ensureLocalMedia(video);
      stream.getTracks().forEach((t: any) => pc.addTrack(t, stream));
      await pc.setRemoteDescription(new (window as any).RTCSessionDescription(data.sdp));
      for (const cand of pendingIceRef.current) {
        try { await pc.addIceCandidate(new (window as any).RTCIceCandidate(cand)); } catch {}
      }
      pendingIceRef.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketService.emitWebRTCAnswer(challengeId, answer);
      console.log('[webrtc] answer sent');
    } catch (e: any) {
      console.log('[webrtc] handleOffer error:', e?.message || e);
      setCallError(String(e?.message || e));
      hangup(false);
    }
  }
  async function handleAnswer(data: any) {
    try {
      if (!pcRef.current) return;
      await pcRef.current.setRemoteDescription(new (window as any).RTCSessionDescription(data.sdp));
    } catch (e) { console.log('answer err', e); }
  }
  async function handleIce(data: any) {
    try {
      if (!pcRef.current?.remoteDescription) { pendingIceRef.current.push(data.candidate); return; }
      await pcRef.current.addIceCandidate(new (window as any).RTCIceCandidate(data.candidate));
    } catch (e) { console.log('ice err', e); }
  }

  const shareUrl = `https://sudoku.gowithsally.com`;
  const shareText = `I'm playing a real-time 1v1 Sudoku duel on Sudoku Sally!`;
  const openExt = (url: string) => Linking.openURL(url).catch(() => {});

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
        <ActivityIndicator size="large" color="#4ade80" style={{ flex: 1 }} />
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
        <Text style={styles.diff}>{challenge?.difficulty?.toUpperCase()}</Text>
      </View>

      {/* ============ TOP CALL BAR — always visible ============ */}
      <View style={styles.topCallBar}>
        <View style={styles.topCallBtns}>
          {!callActive ? (
            <>
              <Text style={styles.topCallLabel}>📞 Call your opponent — STUN + free TURN relay:</Text>
              <TouchableOpacity style={[styles.callBtnSm, { backgroundColor:'#22c55e' }]} onPress={() => startCall(false)}><Text style={styles.callIcon}>📞</Text><Text style={styles.callText}>Audio</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.callBtnSm, { backgroundColor:'#3b82f6' }]} onPress={() => startCall(true)}><Text style={styles.callIcon}>📹</Text><Text style={styles.callText}>Video</Text></TouchableOpacity>
            </>
          ) : (
            <>
              <View style={[styles.callStatusDot, callStatus === 'connected' && { backgroundColor: '#4ade80' }, callStatus === 'calling' && { backgroundColor: '#fbbf24' }, callStatus === 'failed' && { backgroundColor: '#ef4444' }]} />
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
      </View>

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

        {/* Dual Boards */}
        <View style={styles.boards}>
          <View style={styles.boardWrap}>
            <Text style={styles.boardLabel}>{t('yourGrid')}</Text>
            {renderBoard(myBoard, false)}
          </View>
          <View style={styles.boardWrap}>
            <Text style={styles.boardLabel}>{opponent.username}</Text>
            {renderBoard(opponentBoard, true)}
          </View>
        </View>

        {/* Numpad */}
        {!gameOver && !myCompleted && (
          <View style={styles.numpad}>
            {[1,2,3,4,5,6,7,8,9].map(num => (
              <TouchableOpacity key={num} style={styles.numBtn} onPress={() => handleNumber(num)}>
                <Text style={styles.numText}>{num}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Tools */}
        {!gameOver && !myCompleted && (
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
        )}

        {/* Waiting */}
        {myCompleted && !gameOver && (
          <View style={styles.waiting}>
            <ActivityIndicator color="#4ade80" />
            <Text style={styles.waitingText}>{t('waitingForOpponent')} {opponent.username}...</Text>
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

            <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/challenges')}>
              <Text style={styles.backBtnText}>{t('backToLobby')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <AppModal popup={popup} onClose={() => setPopup(null)} buttonLabel={t('gotIt')} />

      {/* ============ PERMANENT BOTTOM DECK — chat | record | go-live (all visible at once) ============ */}
      <View style={styles.deck}>
        {/* CHAT — left */}
        <View style={[styles.deckCol, styles.deckChat]}>
          <Text style={styles.deckTitle}>💬 Chat</Text>
          <ScrollView style={styles.deckChatList} contentContainerStyle={{ padding: 10, gap: 6 }}>
            {chatMessages.length === 0 && <Text style={styles.deckEmpty}>Say hi to {opponent?.username || 'your opponent'}…</Text>}
            {chatMessages.map(m => {
              const mine = m.from === (currentUser?.username || 'You');
              return (
                <View key={m.id} style={[styles.chatBubble, mine ? styles.chatMine : styles.chatTheirs]}>
                  <Text style={styles.chatFrom}>{m.from}</Text>
                  {!!m.text && <Text style={styles.chatText}>{m.text}</Text>}
                  {!!m.img && <Text style={[styles.chatText, { fontStyle:'italic', opacity:0.7 }]}>📷 image</Text>}
                </View>
              );
            })}
          </ScrollView>
          <View style={styles.chatInputRow}>
            <TouchableOpacity style={styles.chatAttach} onPress={sendChatImage}><Text style={{ fontSize: 16 }}>📎</Text></TouchableOpacity>
            <TextInput value={chatInput} onChangeText={setChatInput} placeholder="Type a message…" placeholderTextColor="#475569" style={styles.chatInput} onSubmitEditing={sendChat} returnKeyType="send" />
            <TouchableOpacity style={styles.chatSend} onPress={sendChat}><Text style={{ color:'#000', fontWeight:'700', fontSize:12 }}>Send</Text></TouchableOpacity>
          </View>
        </View>

        {/* RECORD — middle */}
        <View style={[styles.deckCol, styles.deckRec]}>
          <Text style={styles.deckTitle}>🎙️ Record</Text>
          <Text style={styles.deckHint}>Capture your microphone during the match. Download as .webm.</Text>
          <View style={styles.callRow}>
            {!isRecording ? (
              <TouchableOpacity style={[styles.callBtn, { backgroundColor:'#ef4444' }]} onPress={startRecording}><Text style={styles.callIcon}>🔴</Text><Text style={styles.callText}>Start</Text></TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.callBtn, { backgroundColor:'#fbbf24' }]} onPress={stopRecording}><Text style={styles.callIcon}>⏹️</Text><Text style={styles.callText}>Stop</Text></TouchableOpacity>
            )}
            {recordedUrl && (
              <TouchableOpacity style={[styles.callBtn, { backgroundColor:'#4ade80' }]} onPress={downloadRecording}><Text style={styles.callIcon}>⬇️</Text><Text style={styles.callText}>Download</Text></TouchableOpacity>
            )}
          </View>
        </View>

        {/* GO LIVE / SHARE — right */}
        <View style={[styles.deckCol, styles.deckLive]}>
          <Text style={styles.deckTitle}>🔴 Go Live · ↗️ Share</Text>
          <Text style={styles.deckHint}>Each button opens the platform's "create live" or "share" page.</Text>
          <View style={styles.socialGrid}>
            <SocialBtn brand="youtube" label="YouTube" onPress={() => openExt(LIVE_LINKS.youtube)} />
            <SocialBtn brand="facebook" label="Facebook" onPress={() => openExt(LIVE_LINKS.facebook)} />
            <SocialBtn brand="tiktok" label="TikTok" onPress={() => openExt(LIVE_LINKS.tiktok)} />
            <SocialBtn brand="instagram" label="Instagram" onPress={() => openExt(LIVE_LINKS.instagram)} />
            <SocialBtn brand="linkedin" label="LinkedIn" onPress={() => openExt(LIVE_LINKS.linkedin)} />
            <SocialBtn brand="twitter" label="Share on X" onPress={() => openExt(SHARE_LINKS.twitter)} />
          </View>
        </View>
      </View>

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
                  {chatMessages.length === 0 && <Text style={styles.chatEmpty}>No messages yet — say hi to {opponent.username || 'your opponent'}.</Text>}
                  {chatMessages.map(m => {
                    const mine = m.from === (currentUser?.username || 'You');
                    return (
                      <View key={m.id} style={[styles.chatBubble, mine ? styles.chatMine : styles.chatTheirs]}>
                        <Text style={styles.chatFrom}>{m.from}</Text>
                        {!!m.text && <Text style={styles.chatText}>{m.text}</Text>}
                        {!!m.img && Platform.OS === 'web' && (<Text style={[styles.chatText, { fontStyle:'italic', opacity:0.7 }]}>📷 image — open the web build to see it inline</Text>)}
                      </View>
                    );
                  })}
                </ScrollView>
                <View style={styles.chatInputRow}>
                  <TouchableOpacity style={styles.chatAttach} onPress={sendChatImage}><Text style={{ fontSize: 18 }}>📎</Text></TouchableOpacity>
                  <TextInput value={chatInput} onChangeText={setChatInput} placeholder="Type a message…" placeholderTextColor="#475569" style={styles.chatInput} onSubmitEditing={sendChat} returnKeyType="send" />
                  <TouchableOpacity style={styles.chatSend} onPress={sendChat}><Text style={{ color:'#000', fontWeight:'700' }}>Send</Text></TouchableOpacity>
                </View>
              </View>
            )}

            {panelTab === 'call' && (
              <View style={[styles.tabContent, styles.tabPad]}>
                {!callActive ? (
                  <>
                    <Text style={styles.tabHint}>Real WebRTC call with your opponent — peer-to-peer, signaled via the socket, STUN servers from Google. Allow the browser to use your microphone (and camera for video).</Text>
                    <View style={styles.callRow}>
                      <TouchableOpacity style={[styles.callBtn, { backgroundColor:'#22c55e' }]} onPress={() => startCall(false)}><Text style={styles.callIcon}>📞</Text><Text style={styles.callText}>Audio call</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.callBtn, { backgroundColor:'#3b82f6' }]} onPress={() => startCall(true)}><Text style={styles.callIcon}>📹</Text><Text style={styles.callText}>Video call</Text></TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={[styles.tabHint, { color: '#4ade80' }]}>● {callKind === 'video' ? 'Video' : 'Audio'} call active{callError ? ` — ${callError}` : ''}</Text>
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
                <Text style={styles.tabHint}>Record the audio of your match (your microphone). The file downloads as <Text style={{ color:'#4ade80' }}>.webm</Text>.</Text>
                <View style={styles.callRow}>
                  {!isRecording ? (
                    <TouchableOpacity style={[styles.callBtn, { backgroundColor:'#ef4444' }]} onPress={startRecording}><Text style={styles.callIcon}>🔴</Text><Text style={styles.callText}>Start</Text></TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={[styles.callBtn, { backgroundColor:'#fbbf24' }]} onPress={stopRecording}><Text style={styles.callIcon}>⏹️</Text><Text style={styles.callText}>Stop</Text></TouchableOpacity>
                  )}
                  {recordedUrl && (
                    <TouchableOpacity style={[styles.callBtn, { backgroundColor:'#4ade80' }]} onPress={downloadRecording}><Text style={styles.callIcon}>⬇️</Text><Text style={styles.callText}>Download</Text></TouchableOpacity>
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
                <Text style={styles.tabHint}>Go live and stream your match. Each button opens the platform's "create live" page. (Direct broadcasting requires the platform's RTMP key + an OBS-like setup.)</Text>
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
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, paddingTop: 50 },
  back: { color: '#64748b', fontSize: 16 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  diff: { color: '#fbbf24', fontSize: 11, backgroundColor: 'rgba(251,191,36,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },

  scrollFlex: { flex: 1 },
  scroll: { padding: 10, paddingBottom: 20, alignItems: 'center' },

  vs: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 14, marginBottom: 12 },
  player: { alignItems: 'center', flex: 1 },
  playerAvatar: { fontSize: 28 },
  playerName: { color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 3 },
  playerStats: { color: '#64748b', fontSize: 10, marginTop: 2 },
  done: { color: '#4ade80', fontSize: 11, marginTop: 3, fontWeight: '600' },
  vsText: { color: '#ef4444', fontWeight: '800', fontSize: 14 },

  // Stacked layout: ONE board after the other (vertical column), centered horizontally.
  boards: { flexDirection: 'column', alignItems: 'center', gap: 24, marginBottom: 20 },
  boardWrap: { alignItems: 'center' },
  boardLabel: { color: '#64748b', fontSize: 11, marginBottom: 6 },
  board: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: 2 },
  opponentBoard: { opacity: 0.8 },
  row: { flexDirection: 'row' },
  cell: { justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: '#334155' },
  selected: { backgroundColor: 'rgba(59,130,246,0.4)' },
  errorCell: { backgroundColor: 'rgba(239,68,68,0.2)' },
  borderRight: { borderRightWidth: 2, borderRightColor: '#4ade80' },
  borderBottom: { borderBottomWidth: 2, borderBottomColor: '#4ade80' },
  cellText: { color: '#fff', fontWeight: '600' },
  initialText: { color: '#94a3b8' },
  errorText: { color: '#ef4444' },

  numpad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 5, marginBottom: 12 },
  numBtn: { width: 45, height: 45, backgroundColor: 'rgba(74,222,128,0.2)', borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#4ade80' },
  numText: { color: '#4ade80', fontSize: 20, fontWeight: '700' },

  tools: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  tool: { alignItems: 'center', padding: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, minWidth: 70 },
  abandonTool: { backgroundColor: 'rgba(239,68,68,0.2)' },
  toolIcon: { fontSize: 20 },
  toolLabel: { color: '#64748b', fontSize: 10, marginTop: 3 },

  waiting: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 15, backgroundColor: 'rgba(74,222,128,0.1)', borderRadius: 10, marginTop: 15 },
  waitingText: { color: '#4ade80', fontSize: 13 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  resultModal: { backgroundColor: '#1a1a3a', padding: 25, borderRadius: 20, alignItems: 'center', width: '85%' },
  resultEmoji: { fontSize: 60, marginBottom: 10 },
  resultTitle: { color: '#fff', fontSize: 26, fontWeight: '800' },
  resultSub: { color: '#94a3b8', fontSize: 14, marginTop: 5 },
  resultStats: { width: '100%', marginTop: 20, backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 10 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  resultLabel: { color: '#64748b', fontSize: 13 },
  resultValue: { color: '#fff', fontSize: 13, fontWeight: '600' },
  rewards: { marginTop: 15, backgroundColor: 'rgba(74,222,128,0.1)', padding: 12, borderRadius: 10, alignItems: 'center' },
  rewardsTitle: { color: '#4ade80', fontSize: 12 },
  rewardsText: { color: '#4ade80', fontSize: 16, fontWeight: '700', marginTop: 3 },
  backBtn: { marginTop: 20, backgroundColor: '#4ade80', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 10 },
  backBtnText: { color: '#000', fontSize: 14, fontWeight: '700' },

  // ============ FLOATING TOOLS BUTTON ============
  fab: { position: 'absolute', right: 16, bottom: 22, width: 58, height: 58, borderRadius: 29, backgroundColor: '#4ade80',
    alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  fabIcon: { fontSize: 26 },
  fabBadge: { position: 'absolute', top: -2, right: -2, minWidth: 22, height: 22, paddingHorizontal: 5, backgroundColor: '#ef4444', borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0a0a1a' },
  fabBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  // ============ PANEL ============
  panelOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  panelCard: { backgroundColor: '#13132c', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 12, maxHeight: '80%', borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  panelTabs: { flexDirection: 'row', gap: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', alignItems: 'center' },
  panelTab: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.05)' },
  panelTabActive: { backgroundColor: '#4ade80' },
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
  chatMine: { alignSelf: 'flex-end', backgroundColor: 'rgba(74,222,128,0.15)', borderColor: 'rgba(74,222,128,0.35)', borderWidth: 1 },
  chatTheirs: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.06)' },
  chatFrom: { color: '#94a3b8', fontSize: 10, fontWeight: '700', marginBottom: 4 },
  chatText: { color: '#fff', fontSize: 14 },
  chatInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10 },
  chatAttach: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  chatInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, color: '#fff', fontSize: 14 },
  chatSend: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#4ade80' },

  // ============ CALL / RECORD ============
  callRow: { flexDirection: 'row', gap: 12, justifyContent: 'center', flexWrap: 'wrap' },
  callBtn: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: 14, alignItems: 'center', gap: 6, minWidth: 130 },
  callIcon: { fontSize: 26 },
  callText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  videoRow: { flexDirection: 'row', gap: 12, justifyContent: 'center', flexWrap: 'wrap' },

  // ============ TOP CALL BAR ============
  topCallBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, paddingHorizontal: 20, backgroundColor: 'rgba(17,17,40,0.6)', borderBottomWidth: 1, borderBottomColor: 'rgba(74,222,128,0.15)', gap: 12, flexWrap: 'wrap' },
  topCallBtns: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  topCallVideos: { flexDirection: 'row', gap: 10 },
  topCallLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginRight: 6 },
  callBtnSm: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  callStatusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fbbf24', marginRight: 6 },
  audioRemoteWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: 'rgba(74,222,128,0.12)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(74,222,128,0.35)' },
  audioRemoteIcon: { fontSize: 20 },
  audioRemoteName: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // ============ BOTTOM DECK (always visible: Chat | Record | Go Live) ============
  deck: { flexDirection: 'row', gap: 10, padding: 10, backgroundColor: 'rgba(0,0,0,0.35)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', minHeight: 220 },
  deckCol: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 10, gap: 8 },
  deckChat: { flex: 2 },
  deckRec: { flex: 1 },
  deckLive: { flex: 2 },
  deckTitle: { color: '#4ade80', fontSize: 13, fontWeight: '800', letterSpacing: 0.8 },
  deckHint: { color: '#94a3b8', fontSize: 11, lineHeight: 16 },
  deckChatList: { backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 10, maxHeight: 130, minHeight: 80 },
  deckEmpty: { color: '#64748b', fontSize: 12, textAlign: 'center', padding: 12 },

  // ============ SOCIAL GRID ============
  socialGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center', paddingVertical: 10 },
});