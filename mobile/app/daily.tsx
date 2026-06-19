// Daily Challenge Screen - Feature #26
import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { getDailyChallenge, DailyChallenge } from '../utils/daily';
import { useLang } from '../utils/LanguageContext';
import BottomNav from '../components/BottomNav';
import DailyDesktopLayout from '../components/DailyDesktopLayout';
import * as Haptics from 'expo-haptics';

const FILE_NAME = '📁 [Daily.tsx]';

export default function Daily() {
  console.log(`${FILE_NAME} 🚀 Component mounting...`);
  
  const router = useRouter();
  const { t } = useLang();
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState('');
  const [loading, setLoading] = useState(true);
  // v3.10.3 — desktop reflow
  const { width: winW } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && winW >= 1024;

  console.log(`${FILE_NAME} 📊 Initial state - challenge: ${challenge ? 'loaded' : 'null'}, streak: ${streak}, timeLeft: "${timeLeft}"`);

  const calculateTimeLeft = useCallback(() => {
    console.log(`${FILE_NAME} ⏰ calculateTimeLeft() - Calculating time until midnight...`);
    
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const diff = tomorrow.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    
    const timeString = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    console.log(`${FILE_NAME} ⏰ calculateTimeLeft() - Time remaining: ${timeString}`);
    
    return { hours, mins, secs, timeString };
  }, []);

  const loadChallenge = useCallback(async () => {
    console.log(`${FILE_NAME} ⏳ loadChallenge() - Starting to fetch daily challenge...`);
    
    try {
      setLoading(true);
      const dailyChallenge = getDailyChallenge();
      
      console.log(`${FILE_NAME} ✅ loadChallenge() - Challenge loaded:`, {
        difficulty: dailyChallenge?.difficulty,
        completed: dailyChallenge?.completed,
        stars: dailyChallenge?.stars,
      });
      
      setChallenge(dailyChallenge);
      
      // TODO: Load actual streak from storage
      const mockStreak = 7;
      console.log(`${FILE_NAME} 🔥 loadChallenge() - Current streak: ${mockStreak} days`);
      setStreak(mockStreak);
      
    } catch (error) {
      console.error(`${FILE_NAME} ❌ loadChallenge() - Error:`, error);
    } finally {
      setLoading(false);
      console.log(`${FILE_NAME} 🏁 loadChallenge() - Loading complete`);
    }
  }, []);

  useEffect(() => {
    console.log(`${FILE_NAME} 🔧 useEffect() - Component mounted, initializing...`);
    
    loadChallenge();
    
    // Initial timer update
    const { timeString } = calculateTimeLeft();
    setTimeLeft(timeString);
    
    // Update timer every second for smooth countdown
    console.log(`${FILE_NAME} ⏱️ useEffect() - Starting timer interval (1s)`);
    const interval = setInterval(() => {
      const { timeString } = calculateTimeLeft();
      setTimeLeft(timeString);
    }, 1000);
    
    return () => {
      console.log(`${FILE_NAME} 🧹 useEffect() cleanup - Clearing timer interval`);
      clearInterval(interval);
    };
  }, [loadChallenge, calculateTimeLeft]);

  const handleBack = () => {
    console.log(`${FILE_NAME} 🔙 handleBack() - Navigating back...`);
    router.back();
  };

  const startChallenge = async () => {
    console.log(`${FILE_NAME} 🎮 startChallenge() - Starting daily challenge...`);
    console.log(`${FILE_NAME} 🎮 startChallenge() - Challenge difficulty: ${challenge?.difficulty}`);
    
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      console.log(`${FILE_NAME} 📳 startChallenge() - Haptic feedback triggered`);
    } catch (error) {
      console.log(`${FILE_NAME} ⚠️ startChallenge() - Haptics not available:`, error);
    }
    
    console.log(`${FILE_NAME} 🚀 startChallenge() - Navigating to game screen with daily=true`);
    router.push('/game?level=0&daily=true');
  };

  const getDifficultyStars = (difficulty: string | undefined): number => {
    const stars = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : difficulty === 'hard' ? 3 : 2;
    console.log(`${FILE_NAME} ⭐ getDifficultyStars() - Difficulty: ${difficulty}, Stars: ${stars}`);
    return stars;
  };

  const getDifficultyColor = (difficulty: string | undefined): readonly [string, string] => {
    if (difficulty === 'easy') {
      console.log(`${FILE_NAME} 🎨 getDifficultyColor() - Easy difficulty, using green`);
      return ['#4ade80', '#22c55e'] as const;
    }
    if (difficulty === 'hard') {
      console.log(`${FILE_NAME} 🎨 getDifficultyColor() - Hard difficulty, using red`);
      return ['#f87171', '#ef4444'] as const;
    }
    console.log(`${FILE_NAME} 🎨 getDifficultyColor() - Medium difficulty, using orange`);
    return ['#fbbf24', '#f59e0b'] as const;
  };

  const formatDate = (): string => {
    const date = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
    console.log(`${FILE_NAME} 📅 formatDate() - Today's date: ${date}`);
    return date;
  };

  console.log(`${FILE_NAME} 🖼️ Rendering main component...`);

  const difficultyStars = getDifficultyStars(challenge?.difficulty);
  const difficultyColors = getDifficultyColor(challenge?.difficulty);

  // v3.11.13 sprint-18 — desktop hero takeover. Phone keeps the original
  // card layout below.
  if (isDesktopWeb) {
    return (
      <LinearGradient colors={['#0a0a1a', '#1a1a3a', '#0f0f2a']} style={styles.container}>
        <ScrollView contentContainerStyle={{ padding: 32, maxWidth: 1240, alignSelf: 'center', width: '100%' }}>
          <DailyDesktopLayout
            challenge={challenge}
            streak={streak}
            timeLeft={timeLeft}
            onPlay={startChallenge}
          />
        </ScrollView>
      </LinearGradient>
    );
  }

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
          <Text style={styles.titleIcon}>⏱️</Text>
          <Text style={styles.title}>{t('dailyChallenge')}</Text>
        </View>
        
        <View style={styles.streakBadge}>
          <Text style={styles.streakBadgeIcon}>🔥</Text>
          <Text style={styles.streakBadgeNum}>{streak}</Text>
        </View>
      </View>

      {(() => {
        const Wrapper: any = isDesktopWeb ? View : ScrollView;
        const wrapperProps: any = isDesktopWeb
          ? { style: styles.content }
          : { contentContainerStyle: styles.content, showsVerticalScrollIndicator: false };
        return (
      <Wrapper {...wrapperProps}>
        {/* Date Card */}
        <View style={styles.dateCard}>
          <LinearGradient
            colors={['rgba(139, 92, 246, 0.15)', 'rgba(139, 92, 246, 0.05)']}
            style={styles.dateCardGradient}
          >
            <Text style={styles.calendarEmoji}>📅</Text>
            <Text style={styles.date}>{formatDate()}</Text>
            <Text style={styles.dateSubtext}>{t('newChallengeAvailable')}</Text>
          </LinearGradient>
        </View>

        {/* Challenge Card */}
        <View style={styles.challengeCard}>
          <LinearGradient
            colors={[`${difficultyColors[0]}15`, `${difficultyColors[1]}05`]}
            style={styles.challengeCardGradient}
          >
            {/* Glow effect */}
            <View style={[styles.challengeGlow, { backgroundColor: difficultyColors[0] }]} />
            
            <Text style={styles.diffLabel}>{t('todaysDifficulty')}</Text>

            <LinearGradient
              colors={difficultyColors}
              style={styles.difficultyBadge}
            >
              <Text style={styles.difficulty}>
                {challenge?.difficulty
                  ? t(challenge.difficulty as 'easy' | 'medium' | 'hard').toUpperCase()
                  : t('loading').toUpperCase()}
              </Text>
            </LinearGradient>
            
            <View style={styles.diffStars}>
              {[1, 2, 3].map(i => (
                <Text key={i} style={[styles.star, i <= difficultyStars && styles.starActive]}>
                  {i <= difficultyStars ? '⭐' : '☆'}
                </Text>
              ))}
            </View>
            
            {/* v3.6 — Was "15 PUZZLES / 10m / 300 MAX XP" — confusing grind framing
                for a "daily". Top puzzle apps (Sudoku.com, Wordscapes) ship a
                single rich puzzle per day. We now show: ONE puzzle, free time,
                fair payoff. */}
            <View style={styles.challengeStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>1</Text>
                <Text style={styles.statLabel}>{t('puzzles')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>∞</Text>
                <Text style={styles.statLabel}>{t('estTime')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>50</Text>
                <Text style={styles.statLabel}>{t('maxXP')}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Streak Card */}
        <View style={styles.streakCard}>
          <LinearGradient
            colors={['rgba(239, 68, 68, 0.15)', 'rgba(239, 68, 68, 0.05)']}
            style={styles.streakCardGradient}
          >
            <View style={styles.streakIconContainer}>
              <Text style={styles.streakIcon}>🔥</Text>
              <View style={styles.streakGlow} />
            </View>
            <View style={styles.streakInfo}>
              <Text style={styles.streakNum}>{streak}</Text>
              <Text style={styles.streakLabel}>{t('dayStreak')}</Text>
            </View>
            <View style={styles.streakProgress}>
              <Text style={styles.streakProgressText}>
                {7 - (streak % 7)} {t('daysToBonus')}
              </Text>
              <View style={styles.streakProgressBar}>
                <LinearGradient
                  colors={['#ef4444', '#f87171']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.streakProgressFill, { width: `${((streak % 7) / 7) * 100}%` }]}
                />
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Timer Card */}
        <View style={styles.timerCard}>
          <LinearGradient
            colors={['rgba(96, 165, 250, 0.1)', 'rgba(96, 165, 250, 0.02)']}
            style={styles.timerCardGradient}
          >
            <Text style={styles.timerLabel}>{t('nextChallengeIn')}</Text>
            <View style={styles.timerDisplay}>
              {timeLeft.split(':').map((unit, index) => (
                <View key={index} style={styles.timerUnit}>
                  {index > 0 && <Text style={styles.timerSeparator}>:</Text>}
                  <View style={styles.timerBox}>
                    <Text style={styles.timerValue}>{unit}</Text>
                  </View>
                  <Text style={styles.timerUnitLabel}>
                    {index === 0 ? t('hrs') : index === 1 ? t('min') : t('sec')}
                  </Text>
                </View>
              ))}
            </View>
          </LinearGradient>
        </View>

        {/* Action Button */}
        {challenge?.completed ? (
          <View style={styles.completedCard}>
            <LinearGradient
              colors={['rgba(74, 222, 128, 0.15)', 'rgba(74, 222, 128, 0.05)']}
              style={styles.completedCardGradient}
            >
              <View style={styles.completedBadge}>
                <Text style={styles.completedIcon}>✅</Text>
                <Text style={styles.completedText}>{t('completedToday')}</Text>
              </View>
              <View style={styles.completedStars}>
                {[1, 2, 3].map(i => (
                  <Text key={i} style={styles.completedStar}>
                    {i <= (challenge.stars || 0) ? '⭐' : '☆'}
                  </Text>
                ))}
              </View>
              <Text style={styles.completedSubtext}>{t('comeBackTomorrow')}</Text>
            </LinearGradient>
          </View>
        ) : (
          <TouchableOpacity style={styles.playBtn} onPress={startChallenge} activeOpacity={0.8}>
            <LinearGradient 
              colors={['#f59e0b', '#d97706']} 
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.playGrad}
            >
              <Text style={styles.playIcon}>🎮</Text>
              <Text style={styles.playText}>{t('startGame')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Rewards Card */}
        <View style={styles.rewardsCard}>
          <LinearGradient
            colors={['rgba(251, 191, 36, 0.1)', 'rgba(251, 191, 36, 0.02)']}
            style={styles.rewardsCardGradient}
          >
            <View style={styles.rewardsHeader}>
              <Text style={styles.rewardsIcon}>🎁</Text>
              <Text style={styles.rewardsTitle}>{t('rewards')}</Text>
            </View>

            <View style={styles.rewardsList}>
              <View style={styles.rewardRow}>
                <View style={styles.rewardLeft}>
                  <Text style={styles.rewardMedal}>🥉</Text>
                  <View>
                    <Text style={styles.rewardName}>{t('complete')}</Text>
                    <Text style={styles.rewardDesc}>{t('finishChallenge')}</Text>
                  </View>
                </View>
                <View style={styles.rewardRight}>
                  <Text style={styles.rewardXP}>+50 XP</Text>
                  <Text style={styles.rewardCoins}>+20 🪙</Text>
                </View>
              </View>
              
              <View style={styles.rewardDivider} />
              
              <View style={styles.rewardRow}>
                <View style={styles.rewardLeft}>
                  <Text style={styles.rewardMedal}>🥈</Text>
                  <View>
                    <Text style={styles.rewardName}>{t('speedRun')}</Text>
                    <Text style={styles.rewardDesc}>{t('underFiveMinutes')}</Text>
                  </View>
                </View>
                <View style={styles.rewardRight}>
                  <Text style={styles.rewardXP}>+100 XP</Text>
                  <Text style={styles.rewardCoins}>+50 🪙</Text>
                </View>
              </View>
              
              <View style={styles.rewardDivider} />
              
              <View style={styles.rewardRow}>
                <View style={styles.rewardLeft}>
                  <Text style={styles.rewardMedal}>🥇</Text>
                  <View>
                    <Text style={styles.rewardName}>{t('perfect')}</Text>
                    <Text style={styles.rewardDesc}>{t('noErrors')}</Text>
                  </View>
                </View>
                <View style={styles.rewardRight}>
                  <Text style={styles.rewardXP}>+150 XP</Text>
                  <Text style={styles.rewardCoins}>+100 🪙</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Bottom spacing */}
        <View style={{ height: 40 }} />
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
    fontSize: 20, 
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  streakBadgeIcon: {
    fontSize: 16,
  },
  streakBadgeNum: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '700',
  },

  // Content
  content: { 
    paddingHorizontal: 20,
    gap: 16,
  },

  // Date Card
  dateCard: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  dateCardGradient: {
    padding: 24,
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  calendarEmoji: { 
    fontSize: 56, 
    marginBottom: 12,
  },
  date: { 
    color: '#fff', 
    fontSize: 22, 
    fontWeight: '700',
    textAlign: 'center',
  },
  dateSubtext: {
    color: '#a78bfa',
    fontSize: 14,
    marginTop: 4,
  },

  // Challenge Card
  challengeCard: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  challengeCardGradient: {
    padding: 24,
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    position: 'relative',
    overflow: 'hidden',
  },
  challengeGlow: {
    position: 'absolute',
    top: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    opacity: 0.1,
  },
  diffLabel: { 
    color: '#94a3b8', 
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  difficultyBadge: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
  },
  difficulty: { 
    color: '#000', 
    fontSize: 28, 
    fontWeight: '900',
    letterSpacing: 2,
  },
  diffStars: { 
    flexDirection: 'row', 
    gap: 8,
    marginTop: 16,
  },
  star: { 
    fontSize: 24,
    opacity: 0.3,
  },
  starActive: {
    opacity: 1,
  },
  challengeStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    width: '100%',
    justifyContent: 'center',
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  statValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // Streak Card
  streakCard: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  streakCardGradient: {
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 20, 
    borderRadius: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  streakIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  streakIcon: { 
    fontSize: 36,
  },
  streakGlow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
  },
  streakInfo: {
    flex: 1,
  },
  streakNum: { 
    color: '#ef4444', 
    fontSize: 32, 
    fontWeight: '800',
  },
  streakLabel: { 
    color: '#94a3b8', 
    fontSize: 13,
    fontWeight: '500',
  },
  streakProgress: {
    alignItems: 'flex-end',
  },
  streakProgressText: {
    color: '#64748b',
    fontSize: 11,
    marginBottom: 6,
  },
  streakProgressBar: {
    width: 80,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  streakProgressFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Timer Card
  timerCard: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  timerCardGradient: {
    alignItems: 'center', 
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.2)',
  },
  timerLabel: { 
    color: '#64748b', 
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 12,
  },
  timerDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerUnit: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  timerSeparator: {
    color: '#60a5fa',
    fontSize: 28,
    fontWeight: '300',
    marginHorizontal: 4,
  },
  timerBox: {
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  timerValue: { 
    color: '#60a5fa', 
    fontSize: 28, 
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  timerUnitLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600',
    position: 'absolute',
    bottom: -18,
  },

  // Completed Card
  completedCard: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  completedCardGradient: {
    padding: 24, 
    borderRadius: 20, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completedIcon: {
    fontSize: 28,
  },
  completedText: { 
    color: '#4ade80', 
    fontSize: 22, 
    fontWeight: '700',
  },
  completedStars: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  completedStar: { 
    fontSize: 32,
  },
  completedSubtext: {
    color: '#64748b',
    fontSize: 14,
    marginTop: 12,
  },

  // Play Button
  playBtn: { 
    borderRadius: 20, 
    overflow: 'hidden',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  playGrad: { 
    flexDirection: 'row',
    padding: 20, 
    alignItems: 'center',
    justifyContent: 'center', 
    borderRadius: 20,
    gap: 12,
  },
  playIcon: {
    fontSize: 28,
  },
  playText: { 
    color: '#000', 
    fontSize: 22, 
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Rewards Card
  rewardsCard: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  rewardsCardGradient: {
    padding: 20, 
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.2)',
  },
  rewardsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  rewardsIcon: {
    fontSize: 24,
  },
  rewardsTitle: { 
    color: '#fff', 
    fontSize: 18, 
    fontWeight: '700',
  },
  rewardsList: {
    gap: 0,
  },
  rewardRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    alignItems: 'center', 
    paddingVertical: 14,
  },
  rewardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rewardMedal: {
    fontSize: 28,
  },
  rewardName: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '600',
  },
  rewardDesc: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  rewardRight: {
    alignItems: 'flex-end',
  },
  rewardXP: {
    color: '#a78bfa',
    fontSize: 14,
    fontWeight: '700',
  },
  rewardCoins: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  rewardDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
});