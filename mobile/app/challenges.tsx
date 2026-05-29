/**
 * Challenge Ouvert - Lobby Screen
 * Shows online users, received/sent challenges, active games, and history
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  RefreshControl, ActivityIndicator, Modal, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { socketService } from '../utils/socket';
import { useLang } from '../utils/LanguageContext';
import AppModal, { PopupData } from '../components/AppModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';

// ============ TYPES ============
interface User {
  _id: string;
  username: string;
  avatar: string;
  level: number;
  stars: number;
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

// Release builds always hit the production API. The dev override below is
// kept as documentation only and is unreachable in shipped APKs.
const API_URL = 'https://api.sudoku.gowithsally.com/api';
// const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
// const USE_LOCAL_BACKEND = __DEV__ && false;
// if (USE_LOCAL_BACKEND && devHost) API_URL = `http://${devHost}:3101/api`;

export default function Challenges() {
  const router = useRouter();
  const { t } = useLang();

  // ============ STATE ============
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState<PopupData | null>(null);
  const [pendingNav, setPendingNav] = useState<string | null>(null);
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

      // Challenge accepted
      socketService.on('challenge:accepted', (data: any) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setPendingNav(`/challenge-game?id=${data.challengeId}`);
        setPopup({ type: 'success', title: t('challengeAccepted'), message: t('opponentReady') });
        loadMyChallenges();
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

  const closePopup = () => {
    setPopup(null);
    if (pendingNav) {
      const target = pendingNav;
      setPendingNav(null);
      router.push(target as any);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ============ LOADING STATE ============
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
          <Text style={[styles.statNum, { color: '#4ade80' }]}>{stats.winRate}%</Text>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4ade80" />}
      >
        {/* Online Users */}
        {selectedTab === 'online' && (
          onlineUsers.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyText}>{t('noUsersOnline')}</Text>
              <Text style={styles.emptySubtext}>{t('pullToRefresh')}</Text>
            </View>
          ) : (
            onlineUsers.map(user => (
              <TouchableOpacity key={user._id} style={styles.card} onPress={() => openChallenge(user)}>
                <View style={styles.onlineIndicator} />
                <Text style={styles.avatar}>{user.avatar || '👤'}</Text>
                <View style={styles.info}>
                  <Text style={styles.name}>{user.username}</Text>
                  <Text style={styles.stats}>⭐ {user.stars} • Lvl {user.level}</Text>
                </View>
                <View style={styles.challengeBtn}>
                  <Text style={styles.btnText}>⚔️ {t('challengeBtn')}</Text>
                </View>
              </TouchableOpacity>
            ))
          )
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
                  <View style={styles.playBtn}>
                    <Text style={styles.playText}>▶️</Text>
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
              { key: 'easy', emoji: '😊', label: t('easy'), desc: `35 ${t('cellsRemoved')}`, color: '#4ade80' },
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
    </LinearGradient>
  );
}

// ============ STYLES ============
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60 },
  back: { color: '#64748b', fontSize: 16 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  onlineCount: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(74,222,128,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ade80', marginRight: 5 },
  onlineText: { color: '#4ade80', fontWeight: '600' },
  
  statsBar: { flexDirection: 'row', justifyContent: 'space-around', padding: 15, marginHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12 },
  statItem: { alignItems: 'center' },
  statNum: { color: '#fff', fontSize: 18, fontWeight: '700' },
  statLabel: { color: '#64748b', fontSize: 11, marginTop: 2 },
  
  tabsScroll: { maxHeight: 52, marginTop: 10 },
  tabsScrollContent: { paddingHorizontal: 15, paddingRight: 30, alignItems: 'center', gap: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)' },
  tabActive: { backgroundColor: '#4ade80' },
  tabText: { color: '#94a3b8', fontWeight: '600' },
  tabTextActive: { color: '#000' },
  
  content: { padding: 20, paddingBottom: 40 },
  empty: { alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 50, marginBottom: 10 },
  emptyText: { color: '#64748b', fontSize: 16 },
  emptySubtext: { color: '#475569', fontSize: 13, marginTop: 5 },
  
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 15, borderRadius: 14, marginBottom: 10 },
  activeCard: { borderWidth: 1, borderColor: '#4ade80' },
  onlineIndicator: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4ade80', marginRight: 10 },
  avatar: { fontSize: 32, marginRight: 12 },
  info: { flex: 1 },
  name: { color: '#fff', fontSize: 16, fontWeight: '600' },
  stats: { color: '#64748b', fontSize: 12, marginTop: 2 },
  
  challengeBtn: { backgroundColor: '#4ade80', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 15 },
  btnText: { color: '#000', fontWeight: '700' },
  btn: { padding: 10, borderRadius: 10, marginLeft: 8 },
  acceptBtn: { backgroundColor: 'rgba(74,222,128,0.2)' },
  declineBtn: { backgroundColor: 'rgba(239,68,68,0.2)' },
  cancelBtn: { backgroundColor: 'rgba(100,116,139,0.2)', paddingHorizontal: 12 },
  cancelText: { color: '#94a3b8', fontWeight: '600' },
  playBtn: { backgroundColor: '#4ade80', padding: 10, borderRadius: 20 },
  playText: { fontSize: 18 },
  
  resultBadge: { padding: 10, borderRadius: 12 },
  winBadge: { backgroundColor: 'rgba(74,222,128,0.2)' },
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