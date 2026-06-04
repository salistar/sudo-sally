import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, useWindowDimensions } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { storage, LevelData } from '../utils/storage';
import BottomNav from '../components/BottomNav';
import * as Haptics from 'expo-haptics';

const FILE_NAME = '📁 [Levels.tsx]';

export default function Levels() {
  console.log(`${FILE_NAME} 🚀 Component mounting...`);
  
  const router = useRouter();
  const [levels, setLevels] = useState<LevelData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  // v3.8.0 — On desktop web, surface 6 levels per row instead of 3 so the
  // wider canvas is actually used and the cards stop looking like phone
  // tiles inside a sidebar wrapper.
  const { width: winW } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && winW >= 1024;

  console.log(`${FILE_NAME} 📊 Initial state - levels: ${levels.length}, loading: ${loading}, filter: ${selectedDifficulty}`);

  const difficulties = [
    { key: 'beginner', label: 'Beginner', range: '1-5', color: '#4ade80' },
    { key: 'easy', label: 'Easy', range: '6-10', color: '#22c55e' },
    { key: 'medium', label: 'Medium', range: '11-15', color: '#fbbf24' },
    { key: 'hard', label: 'Hard', range: '16-20', color: '#f97316' },
    { key: 'expert', label: 'Expert', range: '21-25', color: '#ef4444' },
    { key: 'master', label: 'Master', range: '26-30', color: '#8b5cf6' },
  ];

  const loadLevels = useCallback(async () => {
    console.log(`${FILE_NAME} ⏳ loadLevels() - Starting to fetch levels...`);
    
    try {
      setLoading(true);
      const data = await storage.getLevels();
      
      console.log(`${FILE_NAME} ✅ loadLevels() - Fetched ${data.length} levels`);
      
      const completed = data.filter(l => l.completed).length;
      const locked = data.filter(l => l.locked).length;
      const totalStars = data.reduce((sum, l) => sum + l.stars, 0);
      
      console.log(`${FILE_NAME} 📈 loadLevels() - Stats: completed=${completed}, locked=${locked}, totalStars=${totalStars}`);
      
      setLevels(data);
    } catch (error) {
      console.error(`${FILE_NAME} ❌ loadLevels() - Error:`, error);
    } finally {
      setLoading(false);
      console.log(`${FILE_NAME} 🏁 loadLevels() - Loading complete`);
    }
  }, []);

  // Reload every time the screen is focused so newly unlocked levels show up.
  useFocusEffect(
    useCallback(() => {
      console.log(`${FILE_NAME} 🔧 useFocusEffect() - Screen focused, reloading levels`);
      loadLevels();
    }, [loadLevels]),
  );

  const handleBack = useCallback(() => {
    console.log(`${FILE_NAME} 🔙 handleBack() - Navigating back...`);
    router.back();
  }, [router]);

  const getDifficultyColor = useCallback((diff: string): string => {
    const colors: Record<string, string> = { 
      beginner: '#4ade80', 
      easy: '#22c55e', 
      medium: '#fbbf24', 
      hard: '#f97316', 
      expert: '#ef4444', 
      master: '#8b5cf6' 
    };
    const color = colors[diff] || '#64748b';
    console.log(`${FILE_NAME} 🎨 getDifficultyColor() - ${diff} -> ${color}`);
    return color;
  }, []);

  const getDifficultyGradient = useCallback((diff: string, locked: boolean): readonly [string, string] => {
    if (locked) {
      return ['#1e293b', '#0f172a'] as const;
    }
    const color = getDifficultyColor(diff);
    return [`${color}30`, `${color}10`] as const;
  }, [getDifficultyColor]);

  const handleLevel = useCallback(async (level: LevelData) => {
    console.log(`${FILE_NAME} 🎮 handleLevel() - Level ${level.id} tapped (locked: ${level.locked}, difficulty: ${level.difficulty})`);
    
    if (level.locked) {
      console.log(`${FILE_NAME} 🔒 handleLevel() - Level is locked, showing warning`);
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch (error) {
        console.log(`${FILE_NAME} ⚠️ handleLevel() - Haptics not available`);
      }
      return;
    }
    
    console.log(`${FILE_NAME} ✅ handleLevel() - Navigating to game with level ${level.id}`);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.log(`${FILE_NAME} ⚠️ handleLevel() - Haptics not available`);
    }
    
    router.push(`/game?level=${level.id}`);
  }, [router]);

  const handleDifficultyFilter = useCallback((diffKey: string | null) => {
    console.log(`${FILE_NAME} 🔍 handleDifficultyFilter() - Filter: ${diffKey || 'all'}`);
    setSelectedDifficulty(prev => prev === diffKey ? null : diffKey);
  }, []);

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const filteredLevels = selectedDifficulty 
    ? levels.filter(l => l.difficulty === selectedDifficulty)
    : levels;

  const completedCount = levels.filter(l => l.completed).length;
  const totalStars = levels.reduce((sum, l) => sum + l.stars, 0);
  const maxStars = levels.length * 3;

  console.log(`${FILE_NAME} 🖼️ Rendering - filteredLevels: ${filteredLevels.length}`);

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
          <Text style={styles.titleIcon}>🎮</Text>
          <Text style={styles.title}>Levels</Text>
        </View>
        
        <View style={styles.headerStats}>
          <Text style={styles.headerStatsText}>⭐ {totalStars}/{maxStars}</Text>
        </View>
      </View>

      {/* Progress Overview */}
      <View style={styles.progressCard}>
        <LinearGradient
          colors={['rgba(74,222,128,0.1)', 'rgba(74,222,128,0.02)']}
          style={styles.progressGradient}
        >
          <View style={styles.progressStats}>
            <View style={styles.progressStatItem}>
              <Text style={styles.progressStatValue}>{completedCount}</Text>
              <Text style={styles.progressStatLabel}>Completed</Text>
            </View>
            <View style={styles.progressDivider} />
            <View style={styles.progressStatItem}>
              <Text style={styles.progressStatValue}>{levels.length - completedCount}</Text>
              <Text style={styles.progressStatLabel}>Remaining</Text>
            </View>
            <View style={styles.progressDivider} />
            <View style={styles.progressStatItem}>
              <Text style={[styles.progressStatValue, styles.progressStatValueStars]}>
                {totalStars}
              </Text>
              <Text style={styles.progressStatLabel}>Stars</Text>
            </View>
          </View>
          <View style={styles.progressBarContainer}>
            <LinearGradient
              colors={['#4ade80', '#22c55e']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressBar, { width: `${levels.length > 0 ? (completedCount / levels.length) * 100 : 0}%` }]}
            />
          </View>
          <Text style={styles.progressPercent}>
            {levels.length > 0 ? Math.round((completedCount / levels.length) * 100) : 0}% Complete
          </Text>
        </LinearGradient>
      </View>

      {/* Difficulty Filter — explicit height on the horizontal ScrollView so
          web doesn't collapse it to ~16 px (which was clipping the chips on
          desktop captures). */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, maxHeight: 56 }}
        contentContainerStyle={styles.filterContainer}
      >
        <TouchableOpacity
          style={[styles.filterChip, !selectedDifficulty && styles.filterChipActive]}
          onPress={() => handleDifficultyFilter(null)}
        >
          <Text style={[styles.filterChipText, !selectedDifficulty && styles.filterChipTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        {difficulties.map((diff) => (
          <TouchableOpacity
            key={diff.key}
            style={[
              styles.filterChip,
              selectedDifficulty === diff.key && styles.filterChipActive,
              selectedDifficulty === diff.key && { borderColor: diff.color },
            ]}
            onPress={() => handleDifficultyFilter(diff.key)}
          >
            <View style={[styles.filterDot, { backgroundColor: diff.color }]} />
            <Text style={[
              styles.filterChipText,
              selectedDifficulty === diff.key && { color: diff.color },
            ]}>
              {diff.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Levels Grid — v3.10.1: on desktop web the WebShell wrapper already
          handles the page scroll. A nested ScrollView captures the wheel
          and the outer page can't scroll. Use a plain View on desktop web. */}
      {(() => {
        const Wrapper: any = isDesktopWeb ? View : ScrollView;
        const wrapperProps: any = isDesktopWeb
          ? { style: styles.grid }
          : { contentContainerStyle: styles.grid, showsVerticalScrollIndicator: false };
        return (
      <Wrapper {...wrapperProps}>
        {filteredLevels.map((level) => {
          const color = getDifficultyColor(level.difficulty);
          const gradientColors = getDifficultyGradient(level.difficulty, level.locked);
          
          return (
            <TouchableOpacity 
              key={level.id} 
              style={[styles.levelCard, isDesktopWeb && { width: '15%' }]} 
              onPress={() => handleLevel(level)}
              activeOpacity={level.locked ? 0.5 : 0.8}
            >
              <LinearGradient 
                colors={gradientColors} 
                style={[
                  styles.levelGrad,
                  level.locked && styles.levelGradLocked,
                  level.completed && { borderColor: `${color}50` },
                ]}
              >
                {level.locked ? (
                  <View style={styles.lockedContent}>
                    <Text style={styles.lockIcon}>🔒</Text>
                    <Text style={styles.lockText}>Locked</Text>
                  </View>
                ) : (
                  <>
                    {/* Difficulty indicator */}
                    <View style={[styles.difficultyDot, { backgroundColor: color }]} />
                    
                    {/* Level number */}
                    <Text style={[styles.levelNum, { color }]}>{level.id}</Text>
                    
                    {/* Stars */}
                    <View style={styles.starsContainer}>
                      {[1, 2, 3].map(s => (
                        <Text 
                          key={s} 
                          style={[
                            styles.star,
                            s <= level.stars ? styles.starFilled : styles.starEmpty,
                          ]}
                        >
                          {s <= level.stars ? '⭐' : '☆'}
                        </Text>
                      ))}
                    </View>
                    
                    {/* Best time */}
                    {level.bestTime ? (
                      <View style={styles.timeContainer}>
                        <Text style={styles.timeIcon}>⏱️</Text>
                        <Text style={styles.timeText}>{formatTime(level.bestTime)}</Text>
                      </View>
                    ) : level.completed ? (
                      <Text style={styles.completedBadge}>✓</Text>
                    ) : (
                      <Text style={styles.newBadge}>NEW</Text>
                    )}
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
        
        {/* Bottom spacing */}
        <View style={{ height: 40, width: '100%' }} />
      </Wrapper>
        );
      })()}
          <BottomNav active="play" />
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
  headerStats: {
    backgroundColor: 'rgba(251,191,36,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
  },
  headerStatsText: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '700',
  },
  
  // Progress Card
  progressCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  progressGradient: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.2)',
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  progressStatItem: {
    alignItems: 'center',
  },
  progressStatValue: {
    color: '#4ade80',
    fontSize: 24,
    fontWeight: '800',
  },
  progressStatValueStars: {
    color: '#fbbf24',
  },
  progressStatLabel: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
  },
  progressDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  progressPercent: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
    fontWeight: '600',
  },
  
  // Filter
  filterContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginRight: 8,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: 'rgba(74,222,128,0.15)',
    borderColor: 'rgba(74,222,128,0.4)',
  },
  filterChipText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#4ade80',
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  
  // Grid
  grid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    paddingHorizontal: 16,
    gap: 12,
    justifyContent: 'flex-start',
  },
  
  // Level Card
  levelCard: { 
    width: '30%',
    aspectRatio: 1, 
    borderRadius: 20, 
    overflow: 'hidden',
  },
  levelGrad: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  levelGradLocked: {
    opacity: 0.6,
  },
  
  // Difficulty dot
  difficultyDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  
  // Lock
  lockedContent: {
    alignItems: 'center',
  },
  lockIcon: { 
    fontSize: 28,
    marginBottom: 4,
  },
  lockText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600',
  },
  
  // Level number
  levelNum: { 
    fontSize: 32, 
    fontWeight: '900',
    marginBottom: 6,
  },
  
  // Stars
  starsContainer: { 
    flexDirection: 'row',
    gap: 2,
  },
  star: { 
    fontSize: 14,
  },
  starFilled: {
    opacity: 1,
  },
  starEmpty: {
    opacity: 0.3,
  },
  
  // Time
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 3,
  },
  timeIcon: {
    fontSize: 10,
  },
  timeText: { 
    color: '#64748b', 
    fontSize: 11,
    fontWeight: '600',
  },
  
  // Badges
  completedBadge: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  newBadge: {
    color: '#60a5fa',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 6,
    letterSpacing: 1,
    backgroundColor: 'rgba(96,165,250,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
});