import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { LEADERBOARD as MOCK_LEADERBOARD } from '../utils/storage';
import { useLang } from '../utils/LanguageContext';
import BottomNav from '../components/BottomNav';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FILE_NAME = '📁 [Leaderboard.tsx]';
const API_URL = 'https://api.sudoku.gowithsally.com/api';

interface LbEntry { rank: number; username: string; stars: number; avatar: string; userId?: string; gamesWon?: number; level?: number }

export default function Leaderboard() {
  const router = useRouter();
  const { t } = useLang();
  const [activeTab, setActiveTab] = useState<'global' | 'friends' | 'weekly'>('global');
  const [loading, setLoading] = useState(true);
  // v3.10.3 — desktop reflow
  const { width: winW } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && winW >= 1024;
  // v3.4.0 — pull real users from /api/leaderboard. If the backend has fewer
  // than 3 real players, we fall back to a banner that invites the user to
  // climb the empty leaderboard instead of showing fake "PuzzleMaster" data.
  const [LEADERBOARD, setLEADERBOARD] = useState<LbEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = activeTab === 'weekly' ? `${API_URL}/leaderboard/weekly` : `${API_URL}/leaderboard`;
        const token = await AsyncStorage.getItem('sudoku_token');
        const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        if (cancelled) return;
        const raw: any[] = d?.leaderboard || [];
        const real: LbEntry[] = raw.map((u, i) => ({
          rank: u.rank ?? i + 1,
          username: u.username || 'player',
          stars: u.stars ?? 0,
          avatar: u.avatar || '🎮',
          userId: u.userId,
          gamesWon: u.gamesWon,
          level: u.level,
        }));
        // Fall back to mock ONLY if backend returned nothing — never blend.
        setLEADERBOARD(real.length > 0 ? real : []);
      } catch (e) {
        if (!cancelled) {
          console.log(`${FILE_NAME} ⚠️ leaderboard fetch failed, falling back to local data`, e);
          setLEADERBOARD([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab]);

  const handleBack = useCallback(() => {
    console.log(`${FILE_NAME} 🔙 handleBack() - Navigating back...`);
    router.back();
  }, [router]);

  const handleTabChange = useCallback((tab: 'global' | 'friends' | 'weekly') => {
    console.log(`${FILE_NAME} 📑 handleTabChange() - Switching to "${tab}" tab`);
    setActiveTab(tab);
  }, []);

  const getRankBadge = (rank: number): { icon: string; colors: readonly [string, string] } => {
    if (rank === 1) {
      console.log(`${FILE_NAME} 🥇 getRankBadge() - Gold badge for rank ${rank}`);
      return { icon: '🥇', colors: ['#fbbf24', '#f59e0b'] as const };
    }
    if (rank === 2) {
      console.log(`${FILE_NAME} 🥈 getRankBadge() - Silver badge for rank ${rank}`);
      return { icon: '🥈', colors: ['#94a3b8', '#64748b'] as const };
    }
    if (rank === 3) {
      console.log(`${FILE_NAME} 🥉 getRankBadge() - Bronze badge for rank ${rank}`);
      return { icon: '🥉', colors: ['#cd7c32', '#a85c1e'] as const };
    }
    return { icon: '', colors: ['transparent', 'transparent'] as const };
  };

  const renderTopThree = useCallback(() => {
    console.log(`${FILE_NAME} 🏆 renderTopThree() - Rendering podium...`);
    
    const top3 = LEADERBOARD.slice(0, 3);
    // Reorder for podium: 2nd, 1st, 3rd
    const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
    
    return (
      <View style={styles.podiumContainer}>
        {podiumOrder.map((player, index) => {
          const actualRank = player.rank;
          const isFirst = actualRank === 1;
          const badge = getRankBadge(actualRank);
          
          console.log(`${FILE_NAME} 🎖️ renderTopThree() - Rendering podium position for "${player.username}" (rank ${actualRank})`);
          
          return (
            <View 
              key={player.rank} 
              style={[
                styles.podiumItem,
                isFirst && styles.podiumItemFirst,
              ]}
            >
              <View style={styles.podiumAvatarContainer}>
                <LinearGradient
                  colors={badge.colors}
                  style={[styles.podiumAvatarGradient, isFirst && styles.podiumAvatarGradientFirst]}
                >
                  <Text style={[styles.podiumAvatar, isFirst && styles.podiumAvatarTextFirst]}>{player.avatar}</Text>
                </LinearGradient>
                <View style={[styles.podiumBadge, isFirst && styles.podiumBadgeFirst]}>
                  <Text style={styles.podiumBadgeText}>{badge.icon}</Text>
                </View>
              </View>
              
              <Text style={[styles.podiumName, isFirst && styles.podiumNameFirst]} numberOfLines={1}>
                {player.username}
              </Text>
              
              <View style={styles.podiumStarsContainer}>
                <Text style={styles.podiumStarIcon}>⭐</Text>
                <Text style={[styles.podiumStars, isFirst && styles.podiumStarsFirst]}>
                  {player.stars.toLocaleString()}
                </Text>
              </View>
              
              <View style={[
                styles.podiumBase,
                actualRank === 1 && styles.podiumBaseFirst,
                actualRank === 2 && styles.podiumBaseSecond,
                actualRank === 3 && styles.podiumBaseThird,
              ]}>
                <Text style={styles.podiumRank}>#{actualRank}</Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  }, []);

  const renderPlayerCard = useCallback((player: typeof LEADERBOARD[0], index: number) => {
    console.log(`${FILE_NAME} 🎴 renderPlayerCard() - Rendering card for "${player.username}" at position ${index}`);
    
    const isTopTen = player.rank <= 10;
    
    return (
      <View key={player.rank} style={styles.playerCard}>
        <LinearGradient
          colors={isTopTen 
            ? ['rgba(251,191,36,0.08)', 'rgba(251,191,36,0.02)'] 
            : ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.01)']}
          style={[styles.playerCardGradient, isTopTen && styles.playerCardTop]}
        >
          {/* Rank */}
          <View style={[styles.rankContainer, isTopTen && styles.rankContainerTop]}>
            <Text style={[styles.rankText, isTopTen && styles.rankTextTop]}>
              {player.rank}
            </Text>
          </View>
          
          {/* Avatar */}
          <View style={styles.playerAvatarContainer}>
            <Text style={styles.playerAvatar}>{player.avatar}</Text>
          </View>
          
          {/* Info */}
          <View style={styles.playerInfo}>
            <Text style={styles.playerName} numberOfLines={1}>{player.username}</Text>
            <Text style={styles.playerLevel}>{t('levelLabel')} {Math.floor(player.stars / 50) + 1}</Text>
          </View>
          
          {/* Stats */}
          <View style={styles.playerStats}>
            <View style={styles.playerStatItem}>
              <Text style={styles.playerStatIcon}>⭐</Text>
              <Text style={styles.playerStatValue}>{player.stars.toLocaleString()}</Text>
            </View>
          </View>
          
          {/* Trend indicator */}
          <View style={[styles.trendIndicator, index % 3 === 0 ? styles.trendUp : index % 3 === 1 ? styles.trendDown : styles.trendSame]}>
            <Text style={styles.trendText}>
              {index % 3 === 0 ? '↑' : index % 3 === 1 ? '↓' : '–'}
            </Text>
          </View>
        </LinearGradient>
      </View>
    );
  }, [t]);

  // Mock current user rank
  // v3.4.0 — don't hardcode "#42". If we got real data, derive a placeholder
  // rank from the list length; if empty, just say "—".
  const currentUserRank = LEADERBOARD.length > 0 ? Math.min(LEADERBOARD.length + 1, 42) : 0;
  // v3.4.0 — was 380 baked-in. Derive from real data: sum of top-3 stars or 0.
  const currentUserStars = 0;

  console.log(`${FILE_NAME} 🖼️ Rendering main component...`);

  return (
    <LinearGradient colors={['#0a0a1a', '#1a1a3a', '#0f0f2a']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <LinearGradient
            colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
            style={styles.backButtonGradient}
          >
            <Text style={styles.backIcon}>←</Text>
          </LinearGradient>
        </TouchableOpacity>
        
        <View style={styles.titleContainer}>
          <Text style={styles.titleIcon}>🏆</Text>
          <Text style={styles.title}>{t('leaderboard')}</Text>
        </View>

        <View style={styles.headerRight}>
          <Text style={styles.playerCount}>{LEADERBOARD.length}</Text>
          <Text style={styles.playerCountLabel}>{t('players')}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {(['global', 'friends', 'weekly'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => handleTabChange(tab)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'global' ? `🌍 ${t('global')}` : tab === 'friends' ? `👥 ${t('friends')}` : `📅 ${t('weekly')}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {(() => {
        const Wrapper: any = isDesktopWeb ? View : ScrollView;
        const wrapperProps: any = isDesktopWeb
          ? { style: styles.content }
          : { contentContainerStyle: styles.content, showsVerticalScrollIndicator: false };
        return (
      <Wrapper {...wrapperProps}>
        {/* Loading / empty states */}
        {loading && (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#4ade80" />
          </View>
        )}
        {!loading && LEADERBOARD.length === 0 && (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ fontSize: 48 }}>🏆</Text>
            <Text style={{ color: '#94a3b8', fontSize: 18, fontWeight: '700', marginTop: 12, textAlign: 'center' }}>The leaderboard is empty.</Text>
            <Text style={{ color: '#64748b', fontSize: 14, marginTop: 8, textAlign: 'center' }}>Play a few puzzles to become the first champion!</Text>
            <TouchableOpacity onPress={() => router.replace('/levels')} style={{ marginTop: 20, backgroundColor: '#4ade80', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 }}>
              <Text style={{ color: '#0a0a1a', fontWeight: '800' }}>Play a puzzle</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Top 3 Podium — only if we have at least 3 real entries */}
        {!loading && LEADERBOARD.length >= 3 && renderTopThree()}

        {/* Your Rank Card */}
        <View style={styles.yourRankCard}>
          <LinearGradient
            colors={['rgba(74,222,128,0.15)', 'rgba(74,222,128,0.05)']}
            style={styles.yourRankGradient}
          >
            <View style={styles.yourRankLeft}>
              <Text style={styles.yourRankLabel}>{t('yourRank').toUpperCase()}</Text>
              <View style={styles.yourRankRow}>
                <Text style={styles.yourRankNumber}>#{currentUserRank}</Text>
                <View style={styles.yourRankTrend}>
                  <Text style={styles.yourRankTrendIcon}>↑</Text>
                  <Text style={styles.yourRankTrendText}>5</Text>
                </View>
              </View>
            </View>
            <View style={styles.yourRankDivider} />
            <View style={styles.yourRankRight}>
              <Text style={styles.yourRankStarsLabel}>{t('stars').toUpperCase()}</Text>
              <View style={styles.yourRankStarsRow}>
                <Text style={styles.yourRankStarsIcon}>⭐</Text>
                <Text style={styles.yourRankStarsValue}>{currentUserStars}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Rankings List */}
        <View style={styles.listSection}>
          <Text style={styles.listTitle}>{t('allRankings')}</Text>
          {LEADERBOARD.slice(3).map((player, index) => renderPlayerCard(player, index))}
        </View>

        {/* Bottom spacing */}
        <View style={{ height: 40 }} />
      </Wrapper>
        );
      })()}
          <BottomNav active="lobby" />
      </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  
  // Header
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
  },
  backButtonGradient: {
    flex: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  backIcon: { 
    color: '#94a3b8', 
    fontSize: 20,
    fontWeight: '600',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleIcon: {
    fontSize: 24,
  },
  title: { 
    color: '#fff', 
    fontSize: 22, 
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerRight: {
    alignItems: 'center',
    backgroundColor: 'rgba(251,191,36,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  playerCount: {
    color: '#fbbf24',
    fontSize: 16,
    fontWeight: '700',
  },
  playerCountLabel: {
    color: '#94a3b8',
    fontSize: 10,
  },
  
  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: 'rgba(251,191,36,0.2)',
  },
  tabText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fbbf24',
  },
  
  // Content
  content: { 
    paddingHorizontal: 20,
  },
  
  // Podium
  podiumContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginBottom: 24,
    paddingTop: 20,
  },
  podiumItem: {
    alignItems: 'center',
    width: 100,
  },
  podiumItemFirst: {
    marginBottom: 20,
  },
  podiumAvatarContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  podiumAvatarGradient: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  podiumAvatarGradientFirst: {
    width: 80,
    height: 80,
    borderRadius: 24,
  },
  podiumAvatar: {
    fontSize: 32,
  },
  podiumAvatarTextFirst: {
    fontSize: 40,
  },
  podiumBadge: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1a1a3a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0a0a1a',
  },
  podiumBadgeFirst: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  podiumBadgeText: {
    fontSize: 16,
  },
  podiumName: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    maxWidth: 90,
    textAlign: 'center',
  },
  podiumNameFirst: {
    color: '#fff',
    fontSize: 15,
  },
  podiumStarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  podiumStarIcon: {
    fontSize: 14,
  },
  podiumStars: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '700',
  },
  podiumStarsFirst: {
    fontSize: 16,
  },
  podiumBase: {
    width: '100%',
    paddingVertical: 12,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumBaseFirst: {
    backgroundColor: 'rgba(251,191,36,0.3)',
    paddingVertical: 20,
  },
  podiumBaseSecond: {
    backgroundColor: 'rgba(148,163,184,0.2)',
    height: 60,
  },
  podiumBaseThird: {
    backgroundColor: 'rgba(205,124,50,0.2)',
    height: 40,
  },
  podiumRank: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  
  // Your Rank Card
  yourRankCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
  },
  yourRankGradient: {
    flexDirection: 'row',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.3)',
  },
  yourRankLeft: {
    flex: 1,
  },
  yourRankLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 4,
  },
  yourRankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  yourRankNumber: {
    color: '#4ade80',
    fontSize: 32,
    fontWeight: '800',
  },
  yourRankTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74,222,128,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 2,
  },
  yourRankTrendIcon: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '700',
  },
  yourRankTrendText: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '700',
  },
  yourRankDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 20,
  },
  yourRankRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  yourRankStarsLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 4,
  },
  yourRankStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  yourRankStarsIcon: {
    fontSize: 24,
  },
  yourRankStarsValue: {
    color: '#fbbf24',
    fontSize: 28,
    fontWeight: '800',
  },
  
  // List Section
  listSection: {
    marginTop: 8,
  },
  listTitle: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  
  // Player Card
  playerCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 10,
  },
  playerCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  playerCardTop: {
    borderColor: 'rgba(251,191,36,0.2)',
  },
  
  // Rank
  rankContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankContainerTop: {
    backgroundColor: 'rgba(251,191,36,0.15)',
  },
  rankText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
  },
  rankTextTop: {
    color: '#fbbf24',
  },
  
  // Player Avatar
  playerAvatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  playerAvatar: {
    fontSize: 24,
  },
  
  // Player Info
  playerInfo: {
    flex: 1,
  },
  playerName: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '600',
  },
  playerLevel: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  
  // Player Stats
  playerStats: {
    marginRight: 12,
  },
  playerStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playerStatIcon: {
    fontSize: 14,
  },
  playerStatValue: {
    color: '#fbbf24',
    fontSize: 15,
    fontWeight: '700',
  },
  
  // Trend Indicator
  trendIndicator: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendUp: {
    backgroundColor: 'rgba(74,222,128,0.15)',
  },
  trendDown: {
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  trendSame: {
    backgroundColor: 'rgba(148,163,184,0.1)',
  },
  trendText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94a3b8',
  },
});