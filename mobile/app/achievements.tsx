import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { storage, Achievement } from '../utils/storage';
import { useLang } from '../utils/LanguageContext';
import BottomNav from '../components/BottomNav';
import AchievementsCategoryGrid from '../components/AchievementsCategoryGrid';

const FILE_NAME = '📁 [Achievements.tsx]';

export default function Achievements() {
  console.log(`${FILE_NAME} 🚀 Component mounting...`);
  
  const router = useRouter();
  const { t, lang } = useLang();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  // v3.8.0 — Desktop web grid (2 cols).
  const { width: winW } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && winW >= 1024;
  const webGridStyle = { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 12, justifyContent: 'space-between' as const };

  console.log(`${FILE_NAME} 📊 Initial state - achievements: ${achievements.length}, loading: ${loading}`);

  const loadAchievements = useCallback(async () => {
    console.log(`${FILE_NAME} ⏳ loadAchievements() - Starting to fetch achievements...`);
    
    try {
      setLoading(true);
      console.log(`${FILE_NAME} 🔄 loadAchievements() - Loading state set to true`);
      
      const data = await storage.getAchievements();
      console.log(`${FILE_NAME} ✅ loadAchievements() - Fetched ${data.length} achievements`);
      
      data.forEach((achievement, index) => {
        console.log(`${FILE_NAME} 📌 Achievement[${index}]: id=${achievement.id}, title="${achievement.title.en}", progress=${achievement.progress}/${achievement.target}, unlocked=${achievement.unlocked}`);
      });
      
      setAchievements(data);
      console.log(`${FILE_NAME} 💾 loadAchievements() - State updated with achievements`);
      
    } catch (error) {
      console.error(`${FILE_NAME} ❌ loadAchievements() - Error:`, error);
    } finally {
      setLoading(false);
      console.log(`${FILE_NAME} 🏁 loadAchievements() - Loading complete, loading state set to false`);
    }
  }, []);

  useEffect(() => {
    console.log(`${FILE_NAME} 🔧 useEffect() - Component mounted, triggering loadAchievements()`);
    loadAchievements();
    
    return () => {
      console.log(`${FILE_NAME} 🧹 useEffect() cleanup - Component unmounting...`);
    };
  }, [loadAchievements]);

  const handleBack = () => {
    console.log(`${FILE_NAME} 🔙 handleBack() - Navigating back...`);
    router.back();
  };

  const getProgressPercentage = (progress: number, target: number): number => {
    const percentage = Math.min(100, (progress / target) * 100);
    console.log(`${FILE_NAME} 📈 getProgressPercentage() - progress: ${progress}, target: ${target}, result: ${percentage.toFixed(1)}%`);
    return percentage;
  };

  const getProgressColor = (progress: number, target: number, unlocked: boolean): readonly [string, string] => {
    if (unlocked) {
      console.log(`${FILE_NAME} 🎨 getProgressColor() - Achievement unlocked, using gold gradient`);
      return ['#fbbf24', '#f59e0b'] as const;
    }
    const percentage = (progress / target) * 100;
    if (percentage >= 75) {
      console.log(`${FILE_NAME} 🎨 getProgressColor() - ${percentage.toFixed(0)}% complete, using green gradient`);
      return ['#4ade80', '#22c55e'] as const;
    }
    if (percentage >= 50) {
      console.log(`${FILE_NAME} 🎨 getProgressColor() - ${percentage.toFixed(0)}% complete, using blue gradient`);
      return ['#60a5fa', '#3b82f6'] as const;
    }
    console.log(`${FILE_NAME} 🎨 getProgressColor() - ${percentage.toFixed(0)}% complete, using purple gradient`);
    return ['#a78bfa', '#8b5cf6'] as const;
  };

  const renderAchievementCard = (achievement: Achievement, index: number) => {
    console.log(`${FILE_NAME} 🎴 renderAchievementCard() - Rendering card for: "${achievement.title.en}" (index: ${index})`);
    
    const progressPercentage = getProgressPercentage(achievement.progress, achievement.target);
    const progressColors = getProgressColor(achievement.progress, achievement.target, achievement.unlocked);
    
    return (
      <View 
        key={achievement.id} 
        style={[
          styles.card, 
          achievement.unlocked && styles.cardUnlocked,
          !achievement.unlocked && styles.cardLocked
        ]}
      >
        {/* Glow effect for unlocked */}
        {achievement.unlocked && (
          <LinearGradient
            colors={['rgba(251, 191, 36, 0.15)', 'rgba(251, 191, 36, 0)']}
            style={styles.glowEffect}
          />
        )}
        
        {/* Icon container */}
        <View style={[styles.iconContainer, achievement.unlocked && styles.iconContainerUnlocked]}>
          <Text style={styles.icon}>{achievement.icon}</Text>
          {achievement.unlocked && <View style={styles.iconGlow} />}
        </View>
        
        {/* Info section */}
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text style={[styles.name, achievement.unlocked && styles.nameUnlocked]}>
              {achievement.title[lang]}
            </Text>
            {achievement.unlocked && (
              <View style={styles.unlockedBadge}>
                <Text style={styles.unlockedBadgeText}>✨ {t('unlockedBadge')}</Text>
              </View>
            )}
          </View>

          <Text style={styles.desc}>{achievement.description[lang]}</Text>
          
          {/* Progress section */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBackground}>
              <LinearGradient
                colors={progressColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressBar, { width: `${progressPercentage}%` }]}
              />
            </View>
            <Text style={[styles.progressText, achievement.unlocked && styles.progressTextUnlocked]}>
              {achievement.progress}/{achievement.target}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length;
  
  console.log(`${FILE_NAME} 📊 Render stats - Unlocked: ${unlockedCount}/${totalCount}`);

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
          <Text style={styles.title}>{t('achievements')}</Text>
        </View>

        <View style={styles.statsContainer}>
          <Text style={styles.statsNumber}>{unlockedCount}/{totalCount}</Text>
          <Text style={styles.statsLabel}>{t('complete')}</Text>
        </View>
      </View>

      {/* Progress Overview */}
      <View style={styles.overviewContainer}>
        <LinearGradient
          colors={['rgba(251, 191, 36, 0.1)', 'rgba(251, 191, 36, 0.02)']}
          style={styles.overviewGradient}
        >
          <View style={styles.overviewContent}>
            <Text style={styles.overviewTitle}>{t('overallProgress')}</Text>
            <View style={styles.overviewProgressContainer}>
              <View style={styles.overviewProgressBackground}>
                <LinearGradient
                  colors={['#fbbf24', '#f59e0b']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.overviewProgressBar, 
                    { width: `${totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0}%` }
                  ]}
                />
              </View>
              <Text style={styles.overviewPercentage}>
                {totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0}%
              </Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Achievements List */}
      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>⏳ {t('loadingAchievements')}</Text>
          </View>
        ) : achievements.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🎯</Text>
            <Text style={styles.emptyText}>{t('noAchievementsYet')}</Text>
            <Text style={styles.emptySubtext}>{t('noAchievementsText')}</Text>
          </View>
        ) : (
          <>
            {/* v3.11.5 sprint-8 — category-bucketed Steam-style grid on
                desktop. Replaces the unlocked/in-progress split with 4
                themed sections (Combat / Régularité / Maîtrise / Découverte)
                so the desktop user can scan by interest. The legacy split
                remains underneath for completeness. */}
            {isDesktopWeb && (
              <AchievementsCategoryGrid achievements={achievements} />
            )}
            {/* Unlocked Section */}
            {unlockedCount > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🌟 {t('unlockedSection')} ({unlockedCount})</Text>
                <View style={isDesktopWeb ? webGridStyle : undefined}>
                  {achievements.filter(a => a.unlocked).map((a, i) => (
                    <View key={a.id} style={isDesktopWeb ? { width: '48%' } : undefined}>
                      {renderAchievementCard(a, i)}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* In Progress Section */}
            {achievements.filter(a => !a.unlocked).length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🔒 {t('inProgress')} ({totalCount - unlockedCount})</Text>
                <View style={isDesktopWeb ? webGridStyle : undefined}>
                  {achievements.filter(a => !a.unlocked).map((a, i) => (
                    <View key={a.id} style={isDesktopWeb ? { width: '48%' } : undefined}>
                      {renderAchievementCard(a, i)}
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
        
        {/* Bottom spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>
          <BottomNav active="profile" />
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
    fontSize: 28,
  },
  title: { 
    color: '#fff', 
    fontSize: 24, 
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statsContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.2)',
  },
  statsNumber: {
    color: '#fbbf24',
    fontSize: 16,
    fontWeight: '700',
  },
  statsLabel: {
    color: '#94a3b8',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Overview
  overviewContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  overviewGradient: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.2)',
  },
  overviewContent: {
    padding: 16,
  },
  overviewTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  overviewProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  overviewProgressBackground: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  overviewProgressBar: {
    height: '100%',
    borderRadius: 4,
  },
  overviewPercentage: {
    color: '#fbbf24',
    fontSize: 18,
    fontWeight: '700',
    minWidth: 50,
    textAlign: 'right',
  },

  // Content
  content: { 
    paddingHorizontal: 20, 
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Card
  card: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.03)', 
    padding: 16, 
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
    position: 'relative',
  },
  cardUnlocked: {
    backgroundColor: 'rgba(251, 191, 36, 0.05)',
    borderColor: 'rgba(251, 191, 36, 0.2)',
  },
  cardLocked: { 
    opacity: 0.7,
  },
  glowEffect: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  
  // Icon
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    position: 'relative',
  },
  iconContainerUnlocked: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
  },
  icon: { 
    fontSize: 32,
  },
  iconGlow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(251, 191, 36, 0.3)',
    opacity: 0.5,
  },
  
  // Info
  info: { 
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  name: { 
    color: '#e2e8f0', 
    fontSize: 16, 
    fontWeight: '700',
    flex: 1,
  },
  nameUnlocked: {
    color: '#fbbf24',
  },
  unlockedBadge: {
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  unlockedBadgeText: {
    color: '#fbbf24',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  desc: { 
    color: '#64748b', 
    fontSize: 13, 
    marginBottom: 12,
    lineHeight: 18,
  },
  
  // Progress
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBackground: { 
    flex: 1,
    height: 6, 
    backgroundColor: 'rgba(255,255,255,0.08)', 
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: { 
    height: '100%', 
    borderRadius: 3,
  },
  progressText: { 
    color: '#64748b', 
    fontSize: 12,
    fontWeight: '600',
    minWidth: 45,
    textAlign: 'right',
  },
  progressTextUnlocked: {
    color: '#fbbf24',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: '#64748b',
    fontSize: 16,
  },

  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    color: '#e2e8f0',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#64748b',
    fontSize: 14,
  },
});