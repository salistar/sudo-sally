/**
 * Socket Service for Real-time Challenge Communication
 * Uses socket.io-client for React Native/Expo
 */

import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import Constants from 'expo-constants';   // re-enable only for the dev block below

// Socket.io endpoint — Caddy on the VPS proxies WebSocket upgrades to sudoku-api.
// The release APK is locked to production; the localhost path below is kept as
// documentation for contributors and is unreachable in shipped builds.
const SOCKET_URL = 'https://api.sallysudo.com';

// ── Dev-only override (kept for reference, NEVER reached in release APK) ──
// const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
// const USE_LOCAL_BACKEND = __DEV__ && false;
// if (USE_LOCAL_BACKEND && devHost) SOCKET_URL = `http://${devHost}:3101`;

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  // Challenge rooms we belong to — re-joined automatically on every (re)connect
  // so realtime + WebRTC signaling survive a dropped socket (sleep, reload, network blip).
  private joinedChallenges: Set<string> = new Set();

  // ============ CONNECTION ============
  
  async connect(): Promise<boolean> {
    try {
      let token = await AsyncStorage.getItem('sudoku_token');

      // No token yet → get a guest token from the backend so realtime works.
      if (!token) {
        try {
          console.log('🆕 No token — requesting a guest token from backend...');
          const res = await fetch(`${SOCKET_URL}/api/auth/guest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          const data = await res.json();
          if (data?.token) {
            token = data.token as string;
            await AsyncStorage.setItem('sudoku_token', token);
            console.log('✅ Guest token obtained and stored');
          }
        } catch (e) {
          console.log('⚠️ Failed to fetch guest token:', e);
        }
      }

      if (!token) {
        console.log('❌ No token available for socket connection');
        return false;
      }

      // Disconnect existing
      if (this.socket) {
        this.disconnect();
      }

      this.socket = io(SOCKET_URL, {
        auth: { token: token as string },
        // Keep websocket first (native + most browsers), but fall back to
        // long-polling so the web client still connects if the websocket
        // upgrade is blocked (proxy / CORS) instead of erroring out forever.
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });

      return new Promise((resolve) => {
        this.socket!.on('connect', () => {
          console.log('🟢 Socket connected:', this.socket?.id);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          // Re-join every challenge room we belong to. Covers reconnects AND the
          // race where joinChallenge() ran before the socket finished connecting.
          this.joinedChallenges.forEach(id => this.socket?.emit('challenge:join', id));
          resolve(true);
        });

        this.socket!.on('disconnect', (reason) => {
          console.log('🔴 Socket disconnected:', reason);
          this.isConnected = false;
          this.stopHeartbeat();
        });

        this.socket!.on('connect_error', (error) => {
          console.error('❌ Socket connection error:', error.message);
          this.reconnectAttempts++;
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            resolve(false);
          }
        });

        // Setup event listeners
        this.setupEventListeners();

        // Timeout
        setTimeout(() => {
          if (!this.isConnected) {
            resolve(false);
          }
        }, 10000);
      });
    } catch (error) {
      console.error('❌ Socket connection failed:', error);
      return false;
    }
  }

  private setupEventListeners() {
    if (!this.socket) return;

    const events = [
      'user:online',
      'user:offline', 
      'users:online',
      'challenge:received',
      'challenge:accepted',
      'challenge:declined',
      'challenge:status',
      'challenge:started',
      'challenge:result',
      'opponent:progress',
      'player:completed',
      'player:abandoned',
      // ── Global activity feed broadcast (fired when any 1v1 match finishes) ──
      'activity:completed',
      // ── NEW: chat + WebRTC signaling ──
      'chat:message',
      'webrtc:offer',
      'webrtc:answer',
      'webrtc:ice',
      'call:end',
      // ── Live-stream handshake (request → opponent accepts → go live) ──
      'live:request',
      'live:accept',
      'live:decline',
      'live:end',
    ];

    events.forEach(event => {
      this.socket!.on(event, (data) => this.emit(event, data));
    });
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.listeners.clear();
  }

  getIsConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  // ============ HEARTBEAT ============

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('heartbeat');
      }
    }, 30000); // Every 30 seconds
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // ============ EMIT METHODS ============

  joinChallenge(challengeId: string) {
    // Remember the room so we re-join after any reconnect, and emit now if we
    // already have a live socket (the 'connect' handler covers the not-yet-connected case).
    this.joinedChallenges.add(challengeId);
    this.socket?.emit('challenge:join', challengeId);
  }

  leaveChallenge(challengeId: string) {
    this.joinedChallenges.delete(challengeId);
    this.socket?.emit('challenge:leave', challengeId);
  }

  // Join a challenge room READ-ONLY (broadcast/spectator view). Not added to
  // joinedChallenges (that set re-emits participant 'challenge:join' on
  // reconnect); the /spectate view re-emits this itself on the 'connect' event.
  spectateChallenge(challengeId: string) {
    this.socket?.emit('challenge:spectate', challengeId);
  }

  sendChallenge(targetUserId: string, difficulty: string) {
    this.socket?.emit('challenge:send', { targetUserId, difficulty });
  }

  /** Emit a chat message in the challenge room (handled by backend → broadcast as 'chat:message'). */
  sendChat(challengeId: string, payload: { text?: string; img?: string }) {
    this.socket?.emit('challenge:chat', { challengeId, ...payload });
  }

  /** WebRTC signaling — relayed within the challenge room by the backend. */
  emitWebRTCOffer(challengeId: string, sdp: any)        { this.socket?.emit('webrtc:offer',  { challengeId, sdp }); }
  emitWebRTCAnswer(challengeId: string, sdp: any)       { this.socket?.emit('webrtc:answer', { challengeId, sdp }); }
  emitWebRTCIce(challengeId: string, candidate: any)    { this.socket?.emit('webrtc:ice',    { challengeId, candidate }); }
  emitCallEnd(challengeId: string)                      { this.socket?.emit('call:end',      { challengeId }); }

  // ── Live-stream handshake ──
  emitLiveRequest(challengeId: string, platform = 'youtube') { this.socket?.emit('live:request', { challengeId, platform }); }
  emitLiveAccept(challengeId: string)                        { this.socket?.emit('live:accept',  { challengeId }); }
  emitLiveDecline(challengeId: string)                       { this.socket?.emit('live:decline', { challengeId }); }
  emitLiveEnd(challengeId: string)                           { this.socket?.emit('live:end',     { challengeId }); }

  notifyAccepted(challengeId: string) {
    this.socket?.emit('challenge:accepted', { challengeId });
  }

  notifyDeclined(challengeId: string) {
    this.socket?.emit('challenge:declined', { challengeId });
  }

  startGame(challengeId: string) {
    this.socket?.emit('challenge:start', { challengeId });
  }

  sendProgress(
    challengeId: string, 
    board: string, 
    timeSpent: number, 
    errors: number, 
    cellUpdated?: { row: number; col: number; value: number }
  ) {
    this.socket?.emit('challenge:progress', { 
      challengeId, 
      board, 
      timeSpent, 
      errors, 
      cellUpdated 
    });
  }

  notifyCompleted(challengeId: string, timeSpent: number, errors: number) {
    this.socket?.emit('challenge:completed', { challengeId, timeSpent, errors });
  }

  notifyAbandoned(challengeId: string) {
    this.socket?.emit('challenge:abandoned', { challengeId });
  }

  requestOnlineUsers() {
    this.socket?.emit('users:list');
  }

  // ============ LISTENER METHODS ============

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
  }

  off(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback);
  }

  removeAllListeners(event: string) {
    this.listeners.delete(event);
  }

  private emit(event: string, data: any) {
    this.listeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in listener for ${event}:`, error);
      }
    });
  }
}

// Export singleton instance
export const socketService = new SocketService();
export default socketService;