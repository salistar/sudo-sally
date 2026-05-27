// Stats Screen - Feature #24
import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { TouchableOpacity } from 'react-native';
import { storage, GameStats, formatTime } from '../utils/storage';
import { useLang } from '../utils/LanguageContext';

const FILE_NAME = '[Stats.tsx]';
const { width } = Dimensions.get('window');

export default function Stats() {
  console.log(`${FILE_NAME} 📊 Component rendering...`);
  
  const router = useRouter();
  const { t } = useLang();
  const [stats, setStats] = useState<GameStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  console.log(`${FILE_NAME} 📊 Initial state - stats: ${stats ? 'loaded' : 'null'}, isLoading: ${isLoading}`);

  useEffect(() => {
    console.log(`${FILE_NAME} 🔄 useEffect triggered - Loading stats data...`);
    
    const loadStats = async () => {
      console.log(`${FILE_NAME} ⏳ Fetching stats from storage...`);
      try {
        const loadedStats = await storage.getStats();
        console.log(`${FILE_NAME} ✅ Stats loaded:`, loadedStats ? {
          gamesPlayed: loadedStats.gamesPlayed,
          gamesWon: loadedStats.gamesWon,
          currentStreak: loadedStats.currentStreak,
          bestStreak: loadedStats.bestStreak,
        } : 'No stats found');
        
        setStats(loadedStats);
        setIsLoading(false);
        
        // Start animations
        console.log(`${FILE_NAME} 🎬 Starting entrance animations...`);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]).start(() => {
          console.log(`${FILE_NAME} ✅ Entrance animations completed`);
        });
      } catch (error) {
        console.error(`${FILE_NAME} ❌ Error loading stats:`, error);
        setIsLoading(false);
      }
    };
    
    loadStats();
  }, []);

  const handleBack = () => {
    console.log(`${FILE_NAME} 🔙 Back button pressed, navigating back...`);
    router.back();
  };

  // Calculate win rate
  const winRate = stats && stats.gamesPlayed > 0 
    ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) 
    : 0;
  console.log(`${FILE_NAME} 📈 Calculated win rate: ${winRate}%`);

  // Calculate average time
  const avgTime = stats && stats.gamesWon > 0 
    ? Math.round(stats.totalTime / stats.gamesWon) 
    : 0;
  console.log(`${FILE_NAME} ⏱️ Calculated average time: ${avgTime}s`);

  const statItems = stats ? [
    { key: 'gamesPlayed', icon: '🎮', label: t('gamesPlayed'), value: stats.gamesPlayed, color: '#60a5fa', category: 'games' },
    { key: 'gamesWon', icon: '🏆', label: t('gamesWon'), value: stats.gamesWon, color: '#fbbf24', category: 'games' },
    { key: 'winRate', icon: '📈', label: t('winRate'), value: `${winRate}%`, color: '#4ade80', category: 'games' },
    { key: 'totalTime', icon: '⏱️', label: t('totalTime'), value: formatTime(stats.totalTime), color: '#f472b6', category: 'time' },
    { key: 'avgTime', icon: '⚡', label: t('avgTimeShort'), value: stats.gamesWon ? formatTime(avgTime) : '--:--', color: '#c084fc', category: 'time' },
    { key: 'currentStreak', icon: '🔥', label: t('currentStreak'), value: stats.currentStreak, color: '#fb923c', category: 'streak' },
    { key: 'bestStreak', icon: '🏅', label: t('bestStreak'), value: stats.bestStreak, color: '#facc15', category: 'streak' },
    { key: 'perfectGames', icon: '💎', label: t('perfectGames'), value: stats.perfectGames, color: '#22d3d1', category: 'achievements' },
    { key: 'hintsUsed', icon: '💡', label: t('hintsUsed'), value: stats.hintsUsed, color: '#a78bfa', category: 'achievements' },
  ] : [];

  console.log(`${FILE_NAME} 📋 Stat items prepared: ${statItems.length} items`);
  console.log(`${FILE_NAME} 🖼️ Rendering UI - isLoading: ${isLoading}`);

  return (
    <LinearGradient colors={['#0a0a1a', '#12122a', '#1a1a3a', '#0f0f2a']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <LinearGradient colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']} style={styles.backButtonGradient}>
            <Text style={styles.back}>←</Text>
          </LinearGradient>
        </TouchableOpacity>
        
        <View style={styles.titleContainer}>
          <Text style={styles.titleIcon}>📊</Text>
          <Text style={styles.title}>{t('stats')}</Text>
        </View>
        
        <View style={{ width: 44 }} />
      </View>

      {/* Summary Cards */}
      {stats && (
        <Animated.View style={[styles.summaryContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.summaryRow}>
            <LinearGradient colors={['rgba(74,222,128,0.2)', 'rgba(74,222,128,0.05)']} style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{winRate}%</Text>
              <Text style={styles.summaryLabel}>{t('winRate')}</Text>
              <View style={[styles.summaryIndicator, { backgroundColor: '#4ade80' }]} />
            </LinearGradient>
            
            <LinearGradient colors={['rgba(251,191,36,0.2)', 'rgba(251,191,36,0.05)']} style={styles.summaryCard}>
              <Text style={[styles.summaryValue, { color: '#fbbf24' }]}>{stats.bestStreak}</Text>
              <Text style={styles.summaryLabel}>{t('bestStreak')}</Text>
              <View style={[styles.summaryIndicator, { backgroundColor: '#fbbf24' }]} />
            </LinearGradient>
            
            <LinearGradient colors={['rgba(34,211,209,0.2)', 'rgba(34,211,209,0.05)']} style={styles.summaryCard}>
              <Text style={[styles.summaryValue, { color: '#22d3d1' }]}>{stats.perfectGames}</Text>
              <Text style={styles.summaryLabel}>{t('perfect')}</Text>
              <View style={[styles.summaryIndicator, { backgroundColor: '#22d3d1' }]} />
            </LinearGradient>
          </View>
        </Animated.View>
      )}

      {/* Stats List */}
      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {/* Games Section */}
          <Text style={styles.sectionTitle}>🎯 {t('gamePerformance')}</Text>
          {statItems.filter(item => item.category === 'games').map((item, i) => {
            console.log(`${FILE_NAME} 🎮 Rendering stat card: ${item.label} = ${item.value}`);
            return (
              <View key={i} style={styles.statCard}>
                <LinearGradient 
                  colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']} 
                  style={styles.statCardGradient}
                >
                  <View style={[styles.iconContainer, { backgroundColor: `${item.color}20` }]}>
                    <Text style={styles.statIcon}>{item.icon}</Text>
                  </View>
                  <View style={styles.statInfo}>
                    <Text style={styles.statLabel}>{item.label}</Text>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: item.category === 'games' ? `${Math.min(100, Number(String(item.value).replace('%', '')))}%` : '0%', backgroundColor: item.color }]} />
                    </View>
                  </View>
                  <Text style={[styles.statValue, { color: item.color }]}>{item.value}</Text>
                </LinearGradient>
              </View>
            );
          })}

          {/* Time Section */}
          <Text style={styles.sectionTitle}>⏰ {t('timeStats')}</Text>
          {statItems.filter(item => item.category === 'time').map((item, i) => {
            console.log(`${FILE_NAME} ⏱️ Rendering stat card: ${item.label} = ${item.value}`);
            return (
              <View key={i} style={styles.statCard}>
                <LinearGradient 
                  colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']} 
                  style={styles.statCardGradient}
                >
                  <View style={[styles.iconContainer, { backgroundColor: `${item.color}20` }]}>
                    <Text style={styles.statIcon}>{item.icon}</Text>
                  </View>
                  <View style={styles.statInfo}>
                    <Text style={styles.statLabel}>{item.label}</Text>
                  </View>
                  <Text style={[styles.statValue, { color: item.color }]}>{item.value}</Text>
                </LinearGradient>
              </View>
            );
          })}

          {/* Streak Section */}
          <Text style={styles.sectionTitle}>🔥 {t('streaks')}</Text>
          {statItems.filter(item => item.category === 'streak').map((item, i) => {
            console.log(`${FILE_NAME} 🔥 Rendering stat card: ${item.label} = ${item.value}`);
            return (
              <View key={i} style={styles.statCard}>
                <LinearGradient 
                  colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']} 
                  style={styles.statCardGradient}
                >
                  <View style={[styles.iconContainer, { backgroundColor: `${item.color}20` }]}>
                    <Text style={styles.statIcon}>{item.icon}</Text>
                  </View>
                  <View style={styles.statInfo}>
                    <Text style={styles.statLabel}>{item.label}</Text>
                    {item.key === 'currentStreak' && stats && (
                      <View style={styles.streakIndicator}>
                        {[...Array(Math.min(5, stats.currentStreak))].map((_, idx) => (
                          <View key={idx} style={[styles.streakDot, { backgroundColor: item.color }]} />
                        ))}
                        {stats.currentStreak > 5 && <Text style={styles.streakMore}>+{stats.currentStreak - 5}</Text>}
                      </View>
                    )}
                  </View>
                  <Text style={[styles.statValue, { color: item.color }]}>{item.value}</Text>
                </LinearGradient>
              </View>
            );
          })}

          {/* Achievements Section */}
          <Text style={styles.sectionTitle}>🏆 {t('achievements')}</Text>
          {statItems.filter(item => item.category === 'achievements').map((item, i) => {
            console.log(`${FILE_NAME} 🏆 Rendering stat card: ${item.label} = ${item.value}`);
            return (
              <View key={i} style={styles.statCard}>
                <LinearGradient 
                  colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']} 
                  style={styles.statCardGradient}
                >
                  <View style={[styles.iconContainer, { backgroundColor: `${item.color}20` }]}>
                    <Text style={styles.statIcon}>{item.icon}</Text>
                  </View>
                  <View style={styles.statInfo}>
                    <Text style={styles.statLabel}>{item.label}</Text>
                  </View>
                  <Text style={[styles.statValue, { color: item.color }]}>{item.value}</Text>
                </LinearGradient>
              </View>
            );
          })}

          {/* Empty State */}
          {!stats && !isLoading && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyTitle}>{t('noStatsYet')}</Text>
              <Text style={styles.emptyText}>{t('noStatsText')}</Text>
            </View>
          )}

          {/* Bottom Spacer */}
          <View style={styles.bottomSpacer} />
        </Animated.View>
      </ScrollView>
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
    paddingBottom: 20,
  },
  backButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  backButtonGradient: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  back: { 
    color: '#fff', 
    fontSize: 20,
    fontWeight: '600',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleIcon: {
    fontSize: 28,
  },
  title: { 
    color: '#fff', 
    fontSize: 28, 
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  
  // Summary Cards
  summaryContainer: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
    overflow: 'hidden',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#4ade80',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  summaryIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  
  // Content
  content: { 
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  
  // Section Title
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 12,
  },
  
  // Stat Card
  statCard: { 
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  statCardGradient: {
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  statIcon: { 
    fontSize: 26,
  },
  statInfo: {
    flex: 1,
  },
  statLabel: { 
    color: '#94a3b8', 
    fontSize: 15,
    fontWeight: '500',
  },
  statValue: { 
    color: '#4ade80', 
    fontSize: 24, 
    fontWeight: '800',
  },
  
  // Progress Bar
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  
  // Streak Indicator
  streakIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  streakDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  streakMore: {
    color: '#64748b',
    fontSize: 12,
    marginLeft: 4,
  },
  
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 15,
    textAlign: 'center',
  },
  
  // Bottom Spacer
  bottomSpacer: {
    height: 40,
  },
});