/**
 * Challenge Ouvert - Lobby Screen
 * Shows online users, received/sent challenges, active games, and history
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  RefreshControl, ActivityIndicator, Modal, Platform, TextInput
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { socketService } from '../utils/socket';
import { API_URL } from '../utils/api';
import { useLang } from '../utils/LanguageContext';
import AppModal, { PopupData } from '../components/AppModal';
import BottomNav from '../components/BottomNav';
import LobbyDesktopLayout from '../components/LobbyDesktopLayout';
import { SkeletonList } from '../components/Skeleton';
import { useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { formatClock } from '../utils/format';

// ============ TYPES ============
interface User {
  _id: string;
  username: string;
  avatar: string;
  level: number;
  stars: number;
  isOnline?: boolean;        // populated by search/recent endpoints
  lastActive?: string;
}

interface Challenge {
  _id: string;
  challenger: User;
  challenged: User;
  difficulty: string;
  status: string;
  createdAt: string;
  winner?: User;
  challengerProgress?: { timeSpent: number; errors: number };
  challengedProgress?: { timeSpent: number; errors: number };
}

// API_URL is imported from utils/api (single source of truth for the host).

export default function Challenges() {
  const router = useRouter();
  const { t } = useLang();
  const { width: winW } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && winW >= 1024;

  // ============ STATE ============
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState<PopupData | null>(null);
  const [pendingNav, setPendingNav] = useState<string | null>(null);
  // Navigating into the match must wait for the popup's fade-out to finish:
  // pushing a route while the transparent <Modal animationType="fade"> is still
  // closing leaves a stuck black overlay (same class as the old logout bug).
  const navLockRef = useRef(false);
  const navTimerRef = useRef<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [sentChallenges, setSentChallenges] = useState<Challenge[]>([]);
  const [receivedChallenges, setReceivedChallenges] = useState<Challenge[]>([]);
  const [activeChallenges, setActiveChallenges] = useState<Challenge[]>([]);
  const [history, setHistory] = useState<Challenge[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedTab, setSelectedTab] = useState<'online' | 'received' | 'sent' | 'active' | 'history'>('online');
  const [difficultyModal, setDifficultyModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  // v3.3.0 — search bar + recent users so "No users online" is no longer a dead end.
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [stats, setStats] = useState({ 
    challengesWon: 0, 
    challengesLost: 0, 
    totalChallenges: 0, 
    winRate: 0 
  });

  // ============ WEB — widen the #root so all tabs (Online/Received/Sent/Active/History) fit ============
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
    initializeSocket();
    loadData();
    
    return () => {
      if (navTimerRef.current) clearTimeout(navTimerRef.current);
      socketService.removeAllListeners('challenge:received');
      socketService.removeAllListeners('challenge:accepted');
      socketService.removeAllListeners('challenge:declined');
      socketService.removeAllListeners('users:online');
      socketService.removeAllListeners('user:online');
      socketService.removeAllListeners('user:offline');
    };
  }, []);

  // ============ SOCKET SETUP ============
  const initializeSocket = async () => {
    const connected = await socketService.connect();
    
    if (connected) {
      // Challenge received
      socketService.on('challenge:received', (data: any) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setPopup({ type: 'info', title: `⚔️ ${t('newChallenge')}`, message: `${data.challengerName} ${t('wantsToChallenge')}` });
        loadMyChallenges();
      });

      // Challenge accepted → switch the challenger straight into the match.
      // Show a brief "opponent ready" confirmation, then auto-navigate so the
      // player doesn't have to tap "Got it" (and never sees a stuck modal).
      socketService.on('challenge:accepted', (data: any) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const target = `/challenge-game?id=${data.challengeId}`;
        setPendingNav(target);
        setPopup({ type: 'success', title: t('challengeAccepted'), message: t('opponentReady') });
        loadMyChallenges();
        if (navTimerRef.current) clearTimeout(navTimerRef.current);
        navTimerRef.current = setTimeout(() => goToGame(target), 900);
      });

      // Challenge declined
      socketService.on('challenge:declined', () => {
        setPopup({ type: 'error', title: t('challengeDeclined'), message: t('challengeWasDeclined') });
        loadMyChallenges();
      });

      // Online users list
      socketService.on('users:online', (users: User[]) => {
        setOnlineUsers(users);
      });

      // User came online
      socketService.on('user:online', (user: any) => {
        setOnlineUsers(prev => {
          if (!prev.find(u => u._id === user.odcUserId)) {
            return [...prev, { 
              _id: user.odcUserId, 
              username: user.username, 
              avatar: user.avatar, 
              level: user.level, 
              stars: user.stars 
            }];
          }
          return prev;
        });
      });

      // User went offline
      socketService.on('user:offline', (data: any) => {
        setOnlineUsers(prev => prev.filter(u => u._id !== data.odcUserId));
      });

      // Request initial online users
      socketService.requestOnlineUsers();
    }
  };

  // ============ DATA LOADING ============
  const loadData = async () => {
    try {
      setLoading(true);
      const userData = await AsyncStorage.getItem('sudoku_user');
      if (userData) setCurrentUser(JSON.parse(userData));
      
      await Promise.all([
        loadOnlineUsers(),
        loadRecentUsers(),
        loadMyChallenges(),
        loadChallengeStats()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOnlineUsers = async () => {
    try {
      const token = await AsyncStorage.getItem('sudoku_token');
      const response = await fetch(`${API_URL}/challenges/users/online`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) setOnlineUsers(data.users);
    } catch (error) {
      console.error('Error loading online users:', error);
    }
  };

  // v3.3.0 — recent users (active in last 24h, even if not socket-connected now).
  // Closes the "No users online" dead-end UX: there's almost always SOMEONE
  // recently active to challenge.
  const loadRecentUsers = async () => {
    try {
      const token = await AsyncStorage.getItem('sudoku_token');
      const response = await fetch(`${API_URL}/users/recent`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) setRecentUsers(data.users);
    } catch (error) {
      console.error('Error loading recent users:', error);
    }
  };

  // v3.3.0 — debounced search by username prefix.
  const runSearch = useCallback(async (q: string) => {
    setSearchQ(q);
    if (!q.trim() || q.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const token = await AsyncStorage.getItem('sudoku_token');
      const response = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(q.trim())}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) setSearchResults(data.users);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearching(false);
    }
  }, []);

  const loadMyChallenges = async () => {
    try {
      const token = await AsyncStorage.getItem('sudoku_token');
      const response = await fetch(`${API_URL}/challenges/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setSentChallenges(data.sent);
        setReceivedChallenges(data.received);
        setActiveChallenges(data.active);
        setHistory(data.history);
      }
    } catch (error) {
      console.error('Error loading challenges:', error);
    }
  };

  const loadChallengeStats = async () => {
    try {
      const token = await AsyncStorage.getItem('sudoku_token');
      const response = await fetch(`${API_URL}/challenges/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) setStats(data.stats);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  // ============ CHALLENGE ACTIONS ============
  const openChallenge = (user: User) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedUser(user);
    setDifficultyModal(true);
  };

  const sendChallenge = async (difficulty: string) => {
    if (!selectedUser) return;
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const token = await AsyncStorage.getItem('sudoku_token');
      
      const response = await fetch(`${API_URL}/challenges/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          targetUserId: selectedUser._id,
          difficulty
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setPopup({ type: 'success', title: t('challengeSent'), message: `${selectedUser.username} ${t('waitingToAccept')}` });
        socketService.sendChallenge(selectedUser._id, difficulty);
        loadMyChallenges();
      } else {
        setPopup({ type: 'error', title: t('error'), message: data.error });
      }
    } catch (error) {
      setPopup({ type: 'error', title: t('error'), message: t('failedSendChallenge') });
    } finally {
      setDifficultyModal(false);
      setSelectedUser(null);
    }
  };

  const acceptChallenge = async (challengeId: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const token = await AsyncStorage.getItem('sudoku_token');
      
      const response = await fetch(`${API_URL}/challenges/${challengeId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await response.json();
      
      if (data.success) {
        socketService.notifyAccepted(challengeId);
        router.push(`/challenge-game?id=${challengeId}`);
      } else {
        setPopup({ type: 'error', title: t('error'), message: data.error });
      }
    } catch (error) {
      setPopup({ type: 'error', title: t('error'), message: t('failedAcceptChallenge') });
    }
  };

  const declineChallenge = async (challengeId: string) => {
    try {
      const token = await AsyncStorage.getItem('sudoku_token');
      
      await fetch(`${API_URL}/challenges/${challengeId}/decline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      socketService.notifyDeclined(challengeId);
      loadMyChallenges();
    } catch (error) {
      setPopup({ type: 'error', title: t('error'), message: t('failedDeclineChallenge') });
    }
  };

  const cancelChallenge = async (challengeId: string) => {
    try {
      const token = await AsyncStorage.getItem('sudoku_token');
      
      await fetch(`${API_URL}/challenges/${challengeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      loadMyChallenges();
    } catch (error) {
      setPopup({ type: 'error', title: t('error'), message: t('failedCancel') });
    }
  };

  // Close the popup, THEN (after its fade-out) navigate — never push a route
  // while the transparent Modal is still animating closed, or it leaves a black
  // overlay. Idempotent so the auto-nav timer and a manual tap can't double-fire.
  const goToGame = (target: string) => {
    if (!target || navLockRef.current) return;
    navLockRef.current = true;
    if (navTimerRef.current) clearTimeout(navTimerRef.current);
    setPopup(null);
    setPendingNav(null);
    navTimerRef.current = setTimeout(() => {
      navTimerRef.current = null;
      navLockRef.current = false;
      try { router.push(target as any); } catch {}
    }, 320);
  };

  const closePopup = () => {
    if (pendingNav) goToGame(pendingNav);
    else setPopup(null);
  };

  // m:SS (unpadded minutes) — shared util. Behaviour unchanged.
  const formatTime = formatClock;

  // ============ LOADING STATE ============
  if (loading) {
    return (
      <LinearGradient colors={['#0a0a1a', '#1a1a3a', '#0f0f2a']} style={styles.container}>
        <View style={styles.content}>
          <SkeletonList rows={6} />
        </View>
      </LinearGradient>
    );
  }

  // ============ RENDER ============
  // v3.11.11 sprint-16 — desktop takeover: hero banner + tab pills +
  // online player grid using Midnight Atlas tokens. Phone keeps the
  // original tabs+vertical list below.
  if (isDesktopWeb) {
    return (
      <LinearGradient colors={['#0a0a1a', '#1a1a3a', '#0f0f2a']} style={styles.container}>
        <LobbyDesktopLayout
          currentUser={currentUser}
          onlineUsers={onlineUsers}
          receivedChallenges={receivedChallenges}
          sentChallenges={sentChallenges}
          activeChallenges={activeChallenges}
          history={history}
          stats={stats}
          selectedTab={selectedTab}
          onTab={setSelectedTab}
          onChallenge={openChallenge}
          onAccept={acceptChallenge}
          onDecline={declineChallenge}
          onResume={(id) => router.push(`/challenge-game?id=${id}` as any)}
        />
        {/* Difficulty modal — reuses the same styles + diff config as mobile. */}
        <Modal visible={difficultyModal} transparent animationType="fade" onRequestClose={() => setDifficultyModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>⚔️ {t('challengeBtn')} {selectedUser?.username}</Text>
              <Text style={styles.modalSubtitle}>{t('selectDifficulty')}</Text>
              {[
                { key: 'easy', emoji: '😊', label: t('easy'), color: '#7c5cff' },
                { key: 'medium', emoji: '😐', label: t('medium'), color: '#fbbf24' },
                { key: 'hard', emoji: '😈', label: t('hard'), color: '#ef4444' },
              ].map(diff => (
                <TouchableOpacity
                  key={diff.key}
                  style={[styles.diffBtn, { borderColor: diff.color, backgroundColor: `${diff.color}20` }]}
                  onPress={() => sendChallenge(diff.key)}
                >
                  <Text style={styles.diffText}>{diff.emoji} {diff.label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setDifficultyModal(false)}>
                <Text style={styles.cancelModalText}>{t('cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        <AppModal popup={popup} onClose={closePopup} buttonLabel={t('gotIt')} />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0a0a1a', '#1a1a3a', '#0f0f2a']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← {t('back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>⚔️ {t('challengeOpenTitle')}</Text>
        <View style={styles.onlineCount}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>{onlineUsers.length}</Text>
        </View>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{stats.challengesWon}</Text>
          <Text style={styles.statLabel}>{t('won')}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{stats.challengesLost}</Text>
          <Text style={styles.statLabel}>{t('lost')}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: '#7c5cff' }]}>{stats.winRate}%</Text>
          <Text style={styles.statLabel}>{t('winRate')}</Text>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabsScrollContent}
      >
        {[
          { key: 'online', label: `👥 ${t('online')}`, count: onlineUsers.length },
          { key: 'received', label: `📩 ${t('received')}`, count: receivedChallenges.length },
          { key: 'sent', label: `📤 ${t('sent')}`, count: sentChallenges.length },
          { key: 'active', label: `🎮 ${t('active')}`, count: activeChallenges.length },
          { key: 'history', label: `📜 ${t('history')}`, count: history.length },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, selectedTab === tab.key && styles.tabActive]}
            onPress={() => setSelectedTab(tab.key as any)}
          >
            <Text style={[styles.tabText, selectedTab === tab.key && styles.tabTextActive]}>
              {tab.label} {tab.count > 0 && `(${tab.count})`}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7c5cff" />}
      >
        {/* Online + Recent + Search */}
        {selectedTab === 'online' && (
          <>
            {/* SEARCH BAR — always visible. Search any registered player by name. */}
            <View style={styles.searchRow}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                value={searchQ}
                onChangeText={runSearch}
                placeholder={t('searchPlayerPlaceholder')}
                placeholderTextColor="#64748b"
                autoCapitalize="none"
              />
              {searchQ.length > 0 && (
                <TouchableOpacity onPress={() => runSearch('')} style={styles.searchClear}>
                  <Text style={styles.searchClearText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* If actively searching, show ONLY the search results */}
            {searchQ.trim().length >= 2 ? (
              searching ? (
                <View style={styles.empty}><ActivityIndicator color="#7c5cff" /></View>
              ) : searchResults.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyIcon}>🤷</Text>
                  <Text style={styles.emptyText}>{t('noPlayerMatches')} "{searchQ}"</Text>
                  <Text style={styles.emptySubtext}>{t('tryStartUsername')}</Text>
                </View>
              ) : (
                searchResults.map(user => (
                  <TouchableOpacity key={user._id} style={styles.card} onPress={() => openChallenge(user)}>
                    {user.isOnline && <View style={styles.onlineIndicator} />}
                    <Text style={styles.avatar}>{user.avatar || '👤'}</Text>
                    <View style={styles.info}>
                      <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">{user.username}</Text>
                      <Text style={styles.stats}>{user.isOnline ? `🟢 ${t('online')}` : `⚪ ${t('offline')}`} · ⭐ {user.stars} • Lvl {user.level}</Text>
                    </View>
                    <View style={styles.challengeBtn}>
                      <Text style={styles.btnText}>⚔️ {t('challengeBtn')}</Text>
                    </View>
                  </TouchableOpacity>
                ))
              )
            ) : (
              <>
                {/* Section 1 — currently online (real-time) */}
                {onlineUsers.length > 0 && (
                  <Text style={styles.sectionHead}>{t('onlineNowSection')} ({onlineUsers.length})</Text>
                )}
                {onlineUsers.map(user => (
                  <TouchableOpacity key={user._id} style={styles.card} onPress={() => openChallenge(user)}>
                    <View style={styles.onlineIndicator} />
                    <Text style={styles.avatar}>{user.avatar || '👤'}</Text>
                    <View style={styles.info}>
                      <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">{user.username}</Text>
                      <Text style={styles.stats}>⭐ {user.stars} • Lvl {user.level}</Text>
                    </View>
                    <View style={styles.challengeBtn}>
                      <Text style={styles.btnText}>⚔️ {t('challengeBtn')}</Text>
                    </View>
                  </TouchableOpacity>
                ))}

                {/* Section 2 — recently active (last 24h) so the lobby is never empty */}
                {recentUsers.filter(u => !onlineUsers.find(o => o._id === u._id)).length > 0 && (
                  <Text style={styles.sectionHead}>{t('activeLast24h')}</Text>
                )}
                {recentUsers
                  .filter(u => !onlineUsers.find(o => o._id === u._id))
                  .slice(0, 20)
                  .map(user => (
                    <TouchableOpacity key={user._id} style={styles.card} onPress={() => openChallenge(user)}>
                      <Text style={styles.avatar}>{user.avatar || '👤'}</Text>
                      <View style={styles.info}>
                        <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">{user.username}</Text>
                        <Text style={styles.stats}>⭐ {user.stars} • Lvl {user.level}</Text>
                      </View>
                      <View style={[styles.challengeBtn, { backgroundColor: 'rgba(124,92,255,0.15)' }]}>
                        <Text style={[styles.btnText, { color: '#7c5cff' }]}>⚔️ {t('challengeBtn')}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}

                {onlineUsers.length === 0 && recentUsers.length === 0 && !currentUser && (
                  <View style={styles.empty}>
                    <Text style={styles.emptyIcon}>🔑</Text>
                    <Text style={styles.emptyText}>{t('signInToPlay')}</Text>
                    <Text style={styles.emptySubtext}>{t('signInToPlayHint')}</Text>
                    <TouchableOpacity onPress={() => router.replace('/login' as any)} style={[styles.challengeBtn, { marginTop: 16, paddingHorizontal: 28 }]}>
                      <Text style={styles.btnText}>{t('signInCta')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {onlineUsers.length === 0 && recentUsers.length === 0 && currentUser && (
                  <View style={styles.empty}>
                    <Text style={styles.emptyIcon}>👥</Text>
                    <Text style={styles.emptyText}>{t('noUsersOnline')}</Text>
                    <Text style={styles.emptySubtext}>{t('inviteFriendHint')}</Text>
                    <Text style={styles.inviteLink}>https://sallysudo.com</Text>
                  </View>
                )}
              </>
            )}
          </>
        )}

        {/* Received Challenges */}
        {selectedTab === 'received' && (
          receivedChallenges.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>{t('noChallengesReceived')}</Text>
            </View>
          ) : (
            receivedChallenges.map(ch => (
              <View key={ch._id} style={styles.card}>
                <Text style={styles.avatar}>{ch.challenger.avatar}</Text>
                <View style={styles.info}>
                  <Text style={styles.name}>{ch.challenger.username}</Text>
                  <Text style={styles.stats}>{ch.difficulty.toUpperCase()}</Text>
                </View>
                <TouchableOpacity style={[styles.btn, styles.acceptBtn]} onPress={() => acceptChallenge(ch._id)}>
                  <Text style={styles.btnText}>✅</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.declineBtn]} onPress={() => declineChallenge(ch._id)}>
                  <Text style={styles.btnText}>❌</Text>
                </TouchableOpacity>
              </View>
            ))
          )
        )}

        {/* Sent Challenges */}
        {selectedTab === 'sent' && (
          sentChallenges.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📤</Text>
              <Text style={styles.emptyText}>{t('noPendingChallenges')}</Text>
            </View>
          ) : (
            sentChallenges.map(ch => (
              <View key={ch._id} style={styles.card}>
                <Text style={styles.avatar}>{ch.challenged.avatar}</Text>
                <View style={styles.info}>
                  <Text style={styles.name}>{ch.challenged.username}</Text>
                  <Text style={styles.stats}>⏳ {t('waiting')}</Text>
                </View>
                <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={() => cancelChallenge(ch._id)}>
                  <Text style={styles.cancelText}>{t('cancel')}</Text>
                </TouchableOpacity>
              </View>
            ))
          )
        )}

        {/* Active Challenges */}
        {selectedTab === 'active' && (
          activeChallenges.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🎮</Text>
              <Text style={styles.emptyText}>{t('noActiveGames')}</Text>
            </View>
          ) : (
            activeChallenges.map(ch => {
              const opponent = ch.challenger._id === currentUser?.id ? ch.challenged : ch.challenger;
              return (
                <TouchableOpacity 
                  key={ch._id} 
                  style={[styles.card, styles.activeCard]}
                  onPress={() => router.push(`/challenge-game?id=${ch._id}`)}
                >
                  <Text style={styles.avatar}>{opponent.avatar}</Text>
                  <View style={styles.info}>
                    <Text style={styles.name}>vs {opponent.username}</Text>
                    <Text style={styles.stats}>🎮 {t('inProgressLabel')}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {/* 📺 Spectate view: both boards side-by-side, live */}
                    <TouchableOpacity
                      style={styles.spectateBtn}
                      onPress={() => router.push(`/spectate/${ch._id}` as any)}
                    >
                      <Text style={styles.spectateText}>📺</Text>
                    </TouchableOpacity>
                    {/* 🔴 Broadcast this match to YouTube (composes both boards → relay) */}
                    <TouchableOpacity
                      style={styles.broadcastBtn}
                      onPress={() => router.push(`/broadcast/${ch._id}` as any)}
                    >
                      <Text style={styles.spectateText}>🔴</Text>
                    </TouchableOpacity>
                    <View style={styles.playBtn}>
                      <Text style={styles.playText}>▶️</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )
        )}

        {/* History */}
        {selectedTab === 'history' && (
          history.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📜</Text>
              <Text style={styles.emptyText}>{t('noChallengeHistory')}</Text>
            </View>
          ) : (
            history.map(ch => {
              const opponent = ch.challenger._id === currentUser?.id ? ch.challenged : ch.challenger;
              const isWinner = ch.winner?._id === currentUser?.id;
              const myProgress = ch.challenger._id === currentUser?.id 
                ? ch.challengerProgress 
                : ch.challengedProgress;
              
              return (
                <View key={ch._id} style={styles.card}>
                  <Text style={styles.avatar}>{opponent.avatar}</Text>
                  <View style={styles.info}>
                    <Text style={styles.name}>vs {opponent.username}</Text>
                    <Text style={styles.stats}>⏱️ {formatTime(myProgress?.timeSpent || 0)}</Text>
                  </View>
                  <View style={[styles.resultBadge, isWinner ? styles.winBadge : styles.loseBadge]}>
                    <Text style={styles.resultText}>{isWinner ? '🏆' : '❌'}</Text>
                  </View>
                </View>
              );
            })
          )
        )}
      </ScrollView>

      {/* Difficulty Selection Modal */}
      <Modal visible={difficultyModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>⚔️ {t('challengeBtn')} {selectedUser?.username}</Text>
            <Text style={styles.modalSubtitle}>{t('selectDifficulty')}</Text>

            {[
              { key: 'easy', emoji: '😊', label: t('easy'), desc: `35 ${t('cellsRemoved')}`, color: '#7c5cff' },
              { key: 'medium', emoji: '😐', label: t('medium'), desc: `45 ${t('cellsRemoved')}`, color: '#fbbf24' },
              { key: 'hard', emoji: '😈', label: t('hard'), desc: `55 ${t('cellsRemoved')}`, color: '#ef4444' },
            ].map(diff => (
              <TouchableOpacity
                key={diff.key}
                style={[styles.diffBtn, { borderColor: diff.color, backgroundColor: `${diff.color}20` }]}
                onPress={() => sendChallenge(diff.key)}
              >
                <Text style={styles.diffText}>{diff.emoji} {diff.label}</Text>
                <Text style={styles.diffDesc}>{diff.desc}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setDifficultyModal(false)}>
              <Text style={styles.cancelModalText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <AppModal popup={popup} onClose={closePopup} buttonLabel={t('gotIt')} />
          <BottomNav active="lobby" />
      </LinearGradient>
  );
}

// ============ STYLES ============
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60 },
  back: { color: '#64748b', fontSize: 16 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  onlineCount: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(124,92,255,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7c5cff', marginRight: 5 },
  onlineText: { color: '#7c5cff', fontWeight: '600' },
  
  statsBar: { flexDirection: 'row', justifyContent: 'space-around', padding: 15, marginHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12 },
  statItem: { alignItems: 'center' },
  statNum: { color: '#fff', fontSize: 18, fontWeight: '700' },
  statLabel: { color: '#64748b', fontSize: 11, marginTop: 2 },
  
  // v3.10.0 — bigger pill tabs so the segmented control is readable on web.
  // Pre-3.10 tabs were 14×10 px padding + default 14 px font = the labels
  // ("Received", "Active", "History" with their counts) felt cramped and
  // were hard to tap. Bumped padding, font weight, font size, and explicit
  // minHeight on the scroll row so it doesn't collapse on RNW.
  tabsScroll: { minHeight: 56, maxHeight: 64, marginTop: 12, flexGrow: 0 },
  tabsScrollContent: { paddingHorizontal: 16, paddingRight: 32, paddingVertical: 6, alignItems: 'center', gap: 10 },
  tab: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  tabActive: { backgroundColor: '#7c5cff', borderColor: '#7c5cff' },
  tabText: { color: '#cbd5e1', fontWeight: '700', fontSize: 14, letterSpacing: 0.2 },
  tabTextActive: { color: '#0a0a1a' },
  
  content: { padding: 20, paddingBottom: 40 },
  empty: { alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 50, marginBottom: 10 },
  emptyText: { color: '#64748b', fontSize: 16, textAlign: 'center' },
  emptySubtext: { color: '#475569', fontSize: 13, marginTop: 5, textAlign: 'center' },
  inviteLink: { color: '#7c5cff', fontSize: 14, marginTop: 10, fontWeight: '700' },

  // v3.3.0 — Player search row
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24, paddingHorizontal: 14, paddingVertical: 4,
    marginBottom: 14,
  },
  searchIcon: { fontSize: 16, color: '#94a3b8' },
  searchInput: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 10 },
  searchClear: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  searchClearText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Section heads inside the lobby list
  sectionHead: { color: '#94a3b8', fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginTop: 6, marginBottom: 8, textTransform: 'uppercase' },
  
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 15, borderRadius: 14, marginBottom: 10 },
  activeCard: { borderWidth: 1, borderColor: '#7c5cff' },
  onlineIndicator: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#7c5cff', marginRight: 10 },
  avatar: { fontSize: 32, marginRight: 12 },
  info: { flex: 1 },
  name: { color: '#fff', fontSize: 16, fontWeight: '600' } as any,
  // v3.6 — name rows that DO use numberOfLines to avoid the 2-line wrap of
  // long Guest_xxxxxxxx usernames seen in v3.5 audit screenshots.
  stats: { color: '#64748b', fontSize: 12, marginTop: 2 },
  
  challengeBtn: { backgroundColor: '#7c5cff', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 15 },
  btnText: { color: '#000', fontWeight: '700' },
  btn: { padding: 10, borderRadius: 10, marginLeft: 8 },
  acceptBtn: { backgroundColor: 'rgba(124,92,255,0.2)' },
  declineBtn: { backgroundColor: 'rgba(239,68,68,0.2)' },
  cancelBtn: { backgroundColor: 'rgba(100,116,139,0.2)', paddingHorizontal: 12 },
  cancelText: { color: '#94a3b8', fontWeight: '600' },
  playBtn: { backgroundColor: '#7c5cff', padding: 10, borderRadius: 20 },
  playText: { fontSize: 18 },
  spectateBtn: { backgroundColor: 'rgba(255,0,0,0.14)', borderWidth: 1, borderColor: '#FF0000', padding: 9, borderRadius: 20 },
  broadcastBtn: { backgroundColor: 'rgba(255,0,0,0.22)', borderWidth: 1, borderColor: '#FF0000', padding: 9, borderRadius: 20 },
  spectateText: { fontSize: 16 },
  
  resultBadge: { padding: 10, borderRadius: 12 },
  winBadge: { backgroundColor: 'rgba(124,92,255,0.2)' },
  loseBadge: { backgroundColor: 'rgba(239,68,68,0.2)' },
  resultText: { fontSize: 20 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#1a1a3a', padding: 25, borderRadius: 20, width: '85%' },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  modalSubtitle: { color: '#64748b', fontSize: 13, textAlign: 'center', marginTop: 5, marginBottom: 20 },
  diffBtn: { padding: 18, borderRadius: 12, marginBottom: 10, borderWidth: 2 },
  diffText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  diffDesc: { color: '#94a3b8', fontSize: 11, textAlign: 'center', marginTop: 3 },
  cancelModalBtn: { marginTop: 10, padding: 15, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  cancelModalText: { color: '#94a3b8', textAlign: 'center', fontWeight: '600' },
});