import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { storage } from '../utils/storage';
import { socketService } from '../utils/socket';
import { useLang } from '../utils/LanguageContext';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppModal, { PopupData } from '../components/AppModal';
import SallyMascot from '../components/SallyMascot';
import DailyChest from '../components/DailyChest';
import LiveCommunityWidget from '../components/LiveCommunityWidget';
import ActiveDuelsWidget from '../components/ActiveDuelsWidget';
import DailyQuestsPanel from '../components/DailyQuestsPanel';
import BottomNav from '../components/BottomNav';

// Pulled from app.json at build time so the badge always matches the
// shipped build (previously: hardcoded "v3.10 · Premium web" drifted from
// the real semver as we bumped through 3.11.x).
const APP_VERSION = Constants.expoConfig?.version ?? '?';
const VERSION_LABEL = Platform.OS === 'web' ? `v${APP_VERSION} · Web` : `v${APP_VERSION}`;

// Production API (matches utils/api.ts / utils/socket.ts).
const API_URL = 'https://api.sallysudo.com/api';

const FILE_NAME = '📁 [Home.tsx]';

// v3.10.2 — CARD_W is now computed inside the component from useWindowDimensions
// so the home grid actually reflows when the window resizes (and so the
// numbers below are based on the CURRENT viewport, not whatever it was at
// JS-load time). The module-level constant below is the phone fallback.
const GRID_GAP = 10;
const GRID_H_PADDING = 20;

export default function Home() {
  console.log(`${FILE_NAME} 🚀 Component mounting...`);
  
  const router = useRouter();
  const { t } = useLang();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);

  // v3.10.2 — responsive sizing. The old `const { width: SCREEN_W } =
  // Dimensions.get('window')` at module scope captured the phone width once
  // at boot. Inside WebShell at 1440 px the menu cards stayed phone-sized
  // and stacked 3-per-row with miles of empty space.
  const { width: winW } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && winW >= 1024;
  // Available horizontal space inside WebShell (sidebar 260 + paddings ~96).
  const innerW = isDesktopWeb ? Math.min(winW - 260 - 96, 1180) : winW;
  // Grid cols: 5 on desktop (so 10 menu cards fit on 2 rows), 3 on phone.
  const GRID_COLS = isDesktopWeb ? 5 : 3;
  const CARD_W = Math.floor((innerW - GRID_H_PADDING * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS);
  // Top stats row keeps its existing 3-up layout — share the CARD_W formula
  // but with 3 cols regardless of desktop mode so the row stays balanced.
  const STAT_W = Math.floor((innerW - GRID_H_PADDING * 2 - GRID_GAP * 2) / 3);
  // ── incoming-challenge notification (popup with Accept / Decline) ──
  const [popup, setPopup] = useState<PopupData | null>(null);
  const pendingChallengeId = useRef<string | null>(null);
  const handledRef = useRef(false);

  console.log(`${FILE_NAME} 📊 Initial state - user: ${user ? 'loaded' : 'null'}, stats: ${stats ? 'loaded' : 'null'}, loading: ${loading}`);

  const loadData = useCallback(async () => {
    console.log(`${FILE_NAME} ⏳ loadData() - Starting to fetch user and stats...`);
    
    try {
      setLoading(true);
      
      console.log(`${FILE_NAME} 👤 loadData() - Fetching user data...`);
      const userData = await storage.getUser();
      console.log(`${FILE_NAME} ✅ loadData() - User loaded:`, {
        username: userData?.username,
        coins: userData?.coins,
        stars: userData?.stars,
        xp: userData?.xp,
        avatar: userData?.avatar,
      });
      setUser(userData);
      
      console.log(`${FILE_NAME} 📈 loadData() - Fetching stats...`);
      const statsData = await storage.getStats();
      console.log(`${FILE_NAME} ✅ loadData() - Stats loaded:`, {
        gamesPlayed: statsData?.gamesPlayed,
        gamesWon: statsData?.gamesWon,
        currentStreak: statsData?.currentStreak,
        bestStreak: statsData?.bestStreak,
      });
      setStats(statsData);
      
    } catch (error) {
      console.error(`${FILE_NAME} ❌ loadData() - Error:`, error);
    } finally {
      setLoading(false);
      console.log(`${FILE_NAME} 🏁 loadData() - Loading complete`);
    }
  }, []);

  // Connect to socket for online status + listen for incoming challenges
  const connectSocket = useCallback(async () => {
    console.log(`${FILE_NAME} 🔌 connectSocket() - Connecting to socket...`);
    try {
      const connected = await socketService.connect();
      setIsOnline(connected);
      if (connected) {
        socketService.removeAllListeners('challenge:received');
        socketService.on('challenge:received', async (data: any) => {
          console.log(`${FILE_NAME} ⚔️ challenge:received from ${data?.challengerName}`);
          try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
          try {
            // Fetch the latest received challenge to get its id (backend doesn't include it in the socket event)
            const token = await AsyncStorage.getItem('sudoku_token');
            const r = await fetch(`${API_URL}/challenges/my`, { headers: { Authorization: `Bearer ${token}` } });
            const d = await r.json();
            const latest = (d?.received || [])[0];
            if (!latest) return;
            pendingChallengeId.current = latest._id;
            handledRef.current = false;
            setPopup({
              type: 'info',
              title: `⚔️ Challenge from ${data?.challengerName || latest.challenger?.username}`,
              message: `${data?.challengerName || latest.challenger?.username} wants to play a ${latest.difficulty?.toUpperCase()} 1v1 match.\nAccept to start the duel.`,
              confirmLabel: 'Accept',
              onConfirm: () => {
                handledRef.current = true;
                const id = pendingChallengeId.current;
                if (id) acceptIncomingChallenge(id);
              },
            });
          } catch (e) { console.log('[home] could not fetch incoming challenge', e); }
        });
      }
    } catch (error) {
      console.error(`${FILE_NAME} ❌ connectSocket() - Error:`, error);
      setIsOnline(false);
    }
  }, []);

  const acceptIncomingChallenge = useCallback(async (challengeId: string) => {
    try {
      const token = await AsyncStorage.getItem('sudoku_token');
      const r = await fetch(`${API_URL}/challenges/${challengeId}/accept`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        try { socketService.notifyAccepted?.(challengeId); } catch {}
        router.push(`/challenge-game?id=${challengeId}` as any);
      }
    } catch (e) { console.log('[home] accept failed', e); }
  }, [router]);

  const declineIncomingChallenge = useCallback(async (challengeId: string) => {
    try {
      const token = await AsyncStorage.getItem('sudoku_token');
      await fetch(`${API_URL}/challenges/${challengeId}/decline`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      try { socketService.notifyDeclined?.(challengeId); } catch {}
    } catch (e) { console.log('[home] decline failed', e); }
  }, []);

  const closeChallengePopup = useCallback(() => {
    if (!handledRef.current && pendingChallengeId.current) {
      declineIncomingChallenge(pendingChallengeId.current);
    }
    pendingChallengeId.current = null;
    handledRef.current = false;
    setPopup(null);
  }, [declineIncomingChallenge]);

  useEffect(() => {
    console.log(`${FILE_NAME} 🔧 useEffect() - Component mounted, triggering loadData()`);
    loadData();
    connectSocket();
    
    return () => {
      console.log(`${FILE_NAME} 🧹 useEffect() cleanup - Component unmounting...`);
    };
  }, [loadData, connectSocket]);

  const handleMenuPress = async (route: string, label: string) => {
    console.log(`${FILE_NAME} 🎯 handleMenuPress() - Menu item pressed: "${label}" -> ${route}`);
    
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      console.log(`${FILE_NAME} 📳 handleMenuPress() - Haptic feedback triggered`);
    } catch (error) {
      console.log(`${FILE_NAME} ⚠️ handleMenuPress() - Haptics not available`);
    }
    
    console.log(`${FILE_NAME} 🚀 handleMenuPress() - Navigating to ${route}`);
    router.push(route as any);
  };

  const handleProfilePress = () => {
    console.log(`${FILE_NAME} 👤 handleProfilePress() - Opening profile...`);
    router.push('/profile');
  };

  const menu = [
    { icon: '🎮', label: t('play'), desc: t('startGame'), route: '/levels', colors: ['#4ade80', '#22c55e'] as const },
    { icon: '⏱️', label: t('dailyChallenge'), desc: t('challenge'), route: '/daily', colors: ['#f59e0b', '#d97706'] as const },
    // Single multiplayer entry — both cards used to point to two different
    // screens (one real, one fake "coming soon"). Unified for v3.3.0.
    { icon: '⚔️', label: t('challenge'), desc: t('pvp'), route: '/challenges', colors: ['#ef4444', '#dc2626'] as const, badge: 'LIVE' },
    { icon: '🏆', label: t('versus'), desc: t('multiplayer'), route: '/leaderboard', colors: ['#ec4899', '#db2777'] as const },
    { icon: '🛒', label: t('shop'), desc: t('items'), route: '/shop', colors: ['#8b5cf6', '#7c3aed'] as const },
    { icon: '📊', label: t('stats'), desc: t('progress'), route: '/stats', colors: ['#14b8a6', '#0d9488'] as const },
    { icon: '🏆', label: t('ranking'), desc: t('leaderboard'), route: '/leaderboard', colors: ['#eab308', '#ca8a04'] as const },
    { icon: '🎯', label: t('achievements'), desc: t('trophies'), route: '/achievements', colors: ['#f97316', '#ea580c'] as const },
    { icon: '📖', label: t('tutorial'), desc: t('learn'), route: '/howtoplay', colors: ['#3b82f6', '#2563eb'] as const },
    { icon: '⚙️', label: t('settings'), desc: t('options'), route: '/settings', colors: ['#64748b', '#475569'] as const },
  ];

  console.log(`${FILE_NAME} 🖼️ Rendering main component...`);

  // v3.10.2 — on desktop web the WebShell wrapper owns the page scroll.
  // Nest a ScrollView and you get the wheel-trap bug. Render a plain View
  // on desktop, ScrollView on phone/native.
  const ContentWrapper: any = isDesktopWeb ? View : ScrollView;
  const contentWrapperProps: any = isDesktopWeb
    ? { style: [styles.scroll, { paddingTop: 0 }] }
    : { contentContainerStyle: styles.scroll, showsVerticalScrollIndicator: false };

  return (
    <LinearGradient colors={['#0a0a1a', '#1a1a3a', '#0f0f2a']} style={styles.container}>
      <ContentWrapper {...contentWrapperProps}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.avatarContainer} onPress={handleProfilePress} activeOpacity={0.8}>
            <LinearGradient
              colors={['rgba(74,222,128,0.3)', 'rgba(74,222,128,0.1)']}
              style={styles.avatarGradient}
            >
              <Text style={styles.avatarText}>{user?.avatar || '👤'}</Text>
            </LinearGradient>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>{Math.floor((user?.xp || 0) / 100) + 1}</Text>
            </View>
            {/* Online Indicator */}
            <View style={[styles.onlineIndicator, { backgroundColor: isOnline ? '#4ade80' : '#64748b' }]} />
          </TouchableOpacity>
          
          <View style={styles.userInfo}>
            <Text style={styles.welcome}>{t('welcomeBack')}</Text>
            <Text style={styles.username}>{user?.username || 'Player'}</Text>
          </View>
          
          <View style={styles.currencyContainer}>
            <View style={styles.coinBox}>
              <Text style={styles.coinIcon}>🪙</Text>
              <Text style={styles.coinText}>{user?.coins?.toLocaleString() || 0}</Text>
            </View>
          </View>
        </View>

        {/* Logo Section */}
        <View style={styles.logoSection}>
          <LinearGradient
            colors={['rgba(74,222,128,0.1)', 'rgba(74,222,128,0.02)']}
            style={styles.logoGradient}
          >
            <View style={styles.logoIconContainer}>
              <SallyMascot size={110} mode="wink" />
              <View style={styles.logoGlow} />
            </View>
            <Text style={styles.logoText}>SallySudo</Text>
            <View style={styles.versionBadge}>
              <Text style={styles.versionText}>{VERSION_LABEL}</Text>
            </View>
            <Text style={styles.tagline}>{t('trainBrainDaily')}</Text>
          </LinearGradient>
        </View>

        {/* v3.5 — Daily chest: claimable once per day, doubles with streak */}
        <DailyChest user={user} onClaimed={() => loadData?.()} />

        {/* v3.11.5 sprint-3 — live community pulse (desktop web only).
            3-card row showing online users + active matches + freshness,
            refreshes every 15s, gives the home a "the lobby is alive" feel
            instead of looking static. Mobile already has the lobby tab
            badge for this and phone width can't afford a 3-card row. */}
        {isDesktopWeb && <DailyQuestsPanel />}
        {isDesktopWeb && <ActiveDuelsWidget />}
        {isDesktopWeb && <LiveCommunityWidget />}

        {/* v3.4 — Cold-start hero CTA: when the user has 0 wins / 0 stars
            we replace the "0/0/0 stats" sadness with a warm invitation to
            their first puzzle. As soon as they win once, this hides and
            the stats appear instead. */}
        {(!stats?.gamesWon && !user?.stars) && (
          <TouchableOpacity
            onPress={() => router.push('/game?level=1' as any)}
            activeOpacity={0.85}
            style={{ marginHorizontal: 0, marginBottom: 18 }}
          >
            <LinearGradient
              colors={['#4ade80', '#22c55e']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ borderRadius: 22, padding: 22, alignItems: 'center', shadowColor: '#4ade80', shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}
            >
              <Text style={{ fontSize: 38, marginBottom: 6 }}>🚀</Text>
              <Text style={{ color: '#0a0a1a', fontSize: 20, fontWeight: '900', letterSpacing: 0.3 }}>Play your first puzzle</Text>
              <Text style={{ color: '#0a0a1a', opacity: 0.7, fontSize: 13, marginTop: 4, textAlign: 'center' }}>Win in under 5 minutes — earn your first ⭐</Text>
              <View style={{ marginTop: 12, backgroundColor: '#0a0a1a', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 16 }}>
                <Text style={{ color: '#4ade80', fontSize: 13, fontWeight: '800', letterSpacing: 1 }}>START NOW →</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Quick Stats */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>📊 {t('yourProgress')}</Text>
          <View style={styles.statsRow}>
            <View style={[styles.statBox, { width: STAT_W }]}>
              <LinearGradient
                colors={['rgba(74,222,128,0.15)', 'rgba(74,222,128,0.05)']}
                style={styles.statGradient}
              >
                <Text style={styles.statIcon}>🏆</Text>
                <Text style={styles.statNum}>{stats?.gamesWon || 0}</Text>
                <Text style={styles.statLabel}>{t('gamesWon')}</Text>
              </LinearGradient>
            </View>
            
            <View style={[styles.statBox, { width: STAT_W }]}>
              <LinearGradient
                colors={['rgba(239,68,68,0.15)', 'rgba(239,68,68,0.05)']}
                style={styles.statGradient}
              >
                <Text style={styles.statIcon}>🔥</Text>
                <Text style={[styles.statNum, styles.statNumStreak]}>{stats?.currentStreak || 0}</Text>
                <Text style={styles.statLabel}>{t('dayStreak')}</Text>
              </LinearGradient>
            </View>
            
            <View style={[styles.statBox, { width: STAT_W }]}>
              <LinearGradient
                colors={['rgba(251,191,36,0.15)', 'rgba(251,191,36,0.05)']}
                style={styles.statGradient}
              >
                <Text style={styles.statIcon}>⭐</Text>
                <Text style={[styles.statNum, styles.statNumStars]}>{user?.stars || 0}</Text>
                <Text style={styles.statLabel}>{t('totalStars')}</Text>
              </LinearGradient>
            </View>
          </View>
        </View>

        {/* Challenge Stats Row - NEW */}
        <View style={styles.challengeStatsRow}>
          <LinearGradient
            colors={['rgba(239,68,68,0.15)', 'rgba(239,68,68,0.05)']}
            style={styles.challengeStatGradient}
          >
            <View style={styles.challengeStatItem}>
              <Text style={styles.challengeStatIcon}>⚔️</Text>
              <Text style={styles.challengeStatNum}>{stats?.challengesWon || 0}</Text>
              <Text style={styles.challengeStatLabel}>{t('challengesWon')}</Text>
            </View>
            <View style={styles.challengeStatDivider} />
            <View style={styles.challengeStatItem}>
              <Text style={styles.challengeStatIcon}>📊</Text>
              <Text style={styles.challengeStatNum}>
                {stats?.challengesPlayed > 0 
                  ? Math.round((stats?.challengesWon / stats?.challengesPlayed) * 100) 
                  : 0}%
              </Text>
              <Text style={styles.challengeStatLabel}>{t('winRate')}</Text>
            </View>
            <View style={styles.challengeStatDivider} />
            <View style={styles.challengeStatItem}>
              <View style={[styles.onlineDot, { backgroundColor: isOnline ? '#4ade80' : '#64748b' }]} />
              <Text style={[styles.challengeStatNum, { color: isOnline ? '#4ade80' : '#64748b' }]}>
                {isOnline ? t('online') : t('offline')}
              </Text>
              <Text style={styles.challengeStatLabel}>{t('statusLabel')}</Text>
            </View>
          </LinearGradient>
        </View>

        {/* XP Progress Bar */}
        <View style={styles.xpSection}>
          <View style={styles.xpHeader}>
            <Text style={styles.xpLevel}>{t('level')} {Math.floor((user?.xp || 0) / 100) + 1}</Text>
            <Text style={styles.xpText}>{(user?.xp || 0) % 100}/100 XP</Text>
          </View>
          <View style={styles.xpBarContainer}>
            <LinearGradient
              colors={['#4ade80', '#22c55e']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.xpBar, { width: `${((user?.xp || 0) % 100)}%` }]}
            />
          </View>
        </View>

        {/* Main Menu */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>🎮 {t('mainMenu')}</Text>
          <View style={styles.menu}>
            {menu.map((item, i) => {
              console.log(`${FILE_NAME} 🎨 Rendering menu item [${i}]: ${item.label}`);
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.menuItem, { width: CARD_W }]}
                  onPress={() => handleMenuPress(item.route, item.label)}
                  activeOpacity={0.8}
                >
                  <LinearGradient 
                    colors={item.colors} 
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.menuGrad}
                  >
                    {/* NEW Badge */}
                    {'badge' in item && item.badge && (
                      <View style={styles.newBadge}>
                        <Text style={styles.newBadgeText}>{item.badge}</Text>
                      </View>
                    )}
                    <View style={styles.menuIconContainer}>
                      <Text style={styles.menuIcon}>{item.icon}</Text>
                    </View>
                    <Text style={styles.menuLabel} numberOfLines={1} adjustsFontSizeToFit>{item.label}</Text>
                    <Text style={styles.menuDesc} numberOfLines={1}>{item.desc}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Challenge Quick Button - NEW */}
        <TouchableOpacity 
          style={styles.challengeQuickBtn}
          onPress={() => handleMenuPress('/challenges', 'Challenge')}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={['#ef4444', '#dc2626']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.challengeQuickGradient}
          >
            <Text style={styles.challengeQuickIcon}>⚔️</Text>
            <View style={styles.challengeQuickInfo}>
              <Text style={styles.challengeQuickText}>{t('challengeOpen')}</Text>
              <Text style={styles.challengeQuickSubtext}>{t('challengeOpenDesc')}</Text>
            </View>
            <View style={styles.challengeQuickArrow}>
              <Text style={styles.challengeQuickArrowText}>→</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Quick Play Button */}
        <TouchableOpacity 
          style={styles.quickPlayBtn}
          onPress={() => handleMenuPress('/levels', 'Quick Play')}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={['#4ade80', '#22c55e']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.quickPlayGradient}
          >
            <Text style={styles.quickPlayIcon}>▶️</Text>
            <View>
              <Text style={styles.quickPlayText}>{t('quickPlay')}</Text>
              <Text style={styles.quickPlaySubtext}>{t('continueWhereLeft')}</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Bottom spacing — generous so the floating BottomNav doesn't hide content */}
        <View style={{ height: isDesktopWeb ? 40 : 110 }} />
      </ContentWrapper>

      {/* Incoming challenge notification (Accept / Decline) */}
      <AppModal popup={popup} onClose={closeChallengePopup} buttonLabel="Decline" />

      {/* v3.5 — Persistent bottom nav */}
      <BottomNav active="home" />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  scroll: { 
    padding: 20, 
    paddingTop: 60,
  },
  
  // Header
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 24,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarGradient: { 
    width: 56, 
    height: 56, 
    borderRadius: 18, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 2, 
    borderColor: 'rgba(74,222,128,0.5)',
  },
  avatarText: { 
    fontSize: 28,
  },
  levelBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#4ade80',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0a0a1a',
  },
  levelBadgeText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '800',
  },
  onlineIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#0a0a1a',
  },
  userInfo: {
    flex: 1,
    marginLeft: 14,
  },
  welcome: { 
    color: '#64748b', 
    fontSize: 13,
  },
  username: { 
    color: '#fff', 
    fontSize: 20, 
    fontWeight: '700',
  },
  currencyContainer: {
    alignItems: 'flex-end',
  },
  coinBox: { 
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251,191,36,0.15)', 
    paddingHorizontal: 14, 
    paddingVertical: 8, 
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
    gap: 6,
  },
  coinIcon: {
    fontSize: 16,
  },
  coinText: { 
    color: '#fbbf24', 
    fontWeight: '700',
    fontSize: 15,
  },
  
  // Logo Section
  logoSection: {
    marginBottom: 24,
    borderRadius: 24,
    overflow: 'hidden',
  },
  logoGradient: { 
    alignItems: 'center',
    padding: 28,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.2)',
  },
  logoIconContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  logoIcon: { 
    fontSize: 64,
  },
  logoGlow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(74,222,128,0.2)',
    top: -8,
    left: -8,
  },
  logoText: { 
    fontSize: 28, 
    fontWeight: '900', 
    color: '#fff', 
    letterSpacing: 3,
  },
  versionBadge: {
    backgroundColor: 'rgba(74,222,128,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 8,
  },
  versionText: { 
    color: '#4ade80', 
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  tagline: {
    color: '#64748b',
    fontSize: 14,
    marginTop: 10,
  },
  
  // Section Title
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  
  // Stats Section
  statsSection: {
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  statBox: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  statGradient: {
    alignItems: 'center', 
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  statNum: { 
    color: '#4ade80', 
    fontSize: 24, 
    fontWeight: '800',
  },
  statNumStreak: {
    color: '#ef4444',
  },
  statNumStars: {
    color: '#fbbf24',
  },
  statLabel: { 
    color: '#64748b', 
    fontSize: 11, 
    marginTop: 4,
    fontWeight: '500',
  },

  // Challenge Stats Row - NEW
  challengeStatsRow: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  challengeStatGradient: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  challengeStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  challengeStatIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  challengeStatNum: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: '800',
  },
  challengeStatLabel: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2,
  },
  challengeStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  onlineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  
  // XP Section
  xpSection: {
    marginBottom: 24,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  xpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  xpLevel: {
    color: '#4ade80',
    fontSize: 16,
    fontWeight: '700',
  },
  xpText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  xpBarContainer: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  xpBar: {
    height: '100%',
    borderRadius: 4,
  },
  
  // Menu Section
  menuSection: {
    marginBottom: 20,
  },
  menu: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  menuItem: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  menuGrad: {
    padding: 12,
    alignItems: 'center',
    borderRadius: 18,
    height: 112,
    justifyContent: 'center',
    position: 'relative',
  },
  menuIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  menuIcon: { 
    fontSize: 24,
  },
  menuLabel: { 
    color: '#fff', 
    fontSize: 13, 
    fontWeight: '700',
    textAlign: 'center',
  },
  menuDesc: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    marginTop: 2,
  },
  
  // NEW Badge
  newBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#fbbf24',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  newBadgeText: {
    color: '#000',
    fontSize: 8,
    fontWeight: '800',
  },

  // Challenge Quick Button - NEW
  challengeQuickBtn: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  challengeQuickGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 14,
  },
  challengeQuickIcon: {
    fontSize: 32,
  },
  challengeQuickInfo: {
    flex: 1,
  },
  challengeQuickText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  challengeQuickSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  challengeQuickArrow: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  challengeQuickArrowText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  
  // Quick Play Button
  quickPlayBtn: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#4ade80',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  quickPlayGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  quickPlayIcon: {
    fontSize: 32,
  },
  quickPlayText: {
    color: '#000',
    fontSize: 20,
    fontWeight: '800',
  },
  quickPlaySubtext: {
    color: 'rgba(0,0,0,0.6)',
    fontSize: 13,
    marginTop: 2,
  },
});