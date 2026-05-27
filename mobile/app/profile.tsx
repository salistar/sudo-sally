import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { storage, User } from '../utils/storage';
import { useLang } from '../utils/LanguageContext';
import * as Haptics from 'expo-haptics';

const FILE_NAME = '📁 [Profile.tsx]';

const AVATARS = ['🎮', '👤', '🎯', '🧩', '🏆', '⭐', '🔥', '💎', '🎪', '🎨', '🦊', '🐱', '🐶', '🦁', '🐼'];

export default function Profile() {
  console.log(`${FILE_NAME} 🚀 Component mounting...`);
  
  const router = useRouter();
  const { t } = useLang();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);

  console.log(`${FILE_NAME} 📊 Initial state - user: ${user ? user.username : 'null'}, loading: ${loading}`);

  const loadUser = useCallback(async () => {
    console.log(`${FILE_NAME} ⏳ loadUser() - Starting to fetch user data...`);
    
    try {
      setLoading(true);
      const userData = await storage.getUser();
      
      if (userData) {
        console.log(`${FILE_NAME} ✅ loadUser() - User loaded:`, {
          username: userData.username,
          email: userData.email,
          level: userData.level,
          xp: userData.xp,
          stars: userData.stars,
          coins: userData.coins,
          avatar: userData.avatar,
        });
        setUser(userData);
        setSelectedAvatar(userData.avatar);
      } else {
        console.log(`${FILE_NAME} ⚠️ loadUser() - No user found`);
      }
    } catch (error) {
      console.error(`${FILE_NAME} ❌ loadUser() - Error:`, error);
    } finally {
      setLoading(false);
      console.log(`${FILE_NAME} 🏁 loadUser() - Loading complete`);
    }
  }, []);

  useEffect(() => {
    console.log(`${FILE_NAME} 🔧 useEffect() - Component mounted, triggering loadUser()`);
    loadUser();
    
    return () => {
      console.log(`${FILE_NAME} 🧹 useEffect() cleanup - Component unmounting...`);
    };
  }, [loadUser]);

  const handleBack = useCallback(() => {
    console.log(`${FILE_NAME} 🔙 handleBack() - Navigating back...`);
    router.back();
  }, [router]);

  const changeAvatar = useCallback(async (avatar: string) => {
    console.log(`${FILE_NAME} 🎭 changeAvatar() - Changing avatar to: ${avatar}`);
    
    if (!user) {
      console.log(`${FILE_NAME} ⚠️ changeAvatar() - No user loaded`);
      return;
    }
    
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      console.log(`${FILE_NAME} 📳 changeAvatar() - Haptic feedback triggered`);
    } catch (error) {
      console.log(`${FILE_NAME} ⚠️ changeAvatar() - Haptics not available`);
    }
    
    setSelectedAvatar(avatar);
    
    const updatedUser = { ...user, avatar };
    console.log(`${FILE_NAME} 💾 changeAvatar() - Saving updated user...`);
    await storage.setUser(updatedUser);
    setUser(updatedUser);
    
    console.log(`${FILE_NAME} ✅ changeAvatar() - Avatar changed successfully`);
  }, [user]);

  const calculateLevel = useCallback((xp: number): number => {
    const level = Math.floor(xp / 100) + 1;
    console.log(`${FILE_NAME} 📈 calculateLevel() - XP: ${xp} -> Level: ${level}`);
    return level;
  }, []);

  const calculateXPProgress = useCallback((xp: number): number => {
    const progress = xp % 100;
    console.log(`${FILE_NAME} 📊 calculateXPProgress() - XP: ${xp} -> Progress: ${progress}/100`);
    return progress;
  }, []);

  const getXPToNextLevel = useCallback((xp: number): number => {
    return 100 - (xp % 100);
  }, []);

  console.log(`${FILE_NAME} 🖼️ Rendering main component...`);

  const level = user ? calculateLevel(user.xp) : 1;
  const xpProgress = user ? calculateXPProgress(user.xp) : 0;
  const xpToNext = user ? getXPToNextLevel(user.xp) : 100;

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
          <Text style={styles.titleIcon}>👤</Text>
          <Text style={styles.title}>{t('profile')}</Text>
        </View>
        
        <TouchableOpacity style={styles.editButton}>
          <Text style={styles.editButtonText}>✏️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <LinearGradient
            colors={['rgba(74,222,128,0.15)', 'rgba(74,222,128,0.05)']}
            style={styles.avatarSectionGradient}
          >
            <View style={styles.avatarContainer}>
              <LinearGradient
                colors={['rgba(74,222,128,0.3)', 'rgba(74,222,128,0.1)']}
                style={styles.currentAvatar}
              >
                <Text style={styles.avatarLarge}>{user?.avatar || '👤'}</Text>
              </LinearGradient>
              <View style={styles.avatarGlow} />
              <View style={styles.levelBadge}>
                <LinearGradient
                  colors={['#4ade80', '#22c55e']}
                  style={styles.levelBadgeGradient}
                >
                  <Text style={styles.levelBadgeText}>{level}</Text>
                </LinearGradient>
              </View>
            </View>
            
            <Text style={styles.username}>{user?.username || t('player')}</Text>
            <Text style={styles.email}>{user?.email || t('guestAccount')}</Text>

            {/* XP Progress */}
            <View style={styles.xpContainer}>
              <View style={styles.xpHeader}>
                <Text style={styles.xpLabel}>{t('levelLabel')} {level}</Text>
                <Text style={styles.xpText}>{xpProgress}/100 XP</Text>
              </View>
              <View style={styles.xpBarContainer}>
                <LinearGradient
                  colors={['#4ade80', '#22c55e']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.xpBar, { width: `${xpProgress}%` }]}
                />
              </View>
              <Text style={styles.xpNextLevel}>{xpToNext} {t('xpToLevel')} {level + 1}</Text>
            </View>
          </LinearGradient>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>📊 {t('stats')}</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <LinearGradient
                colors={['rgba(74,222,128,0.12)', 'rgba(74,222,128,0.04)']}
                style={styles.statGradient}
              >
                <Text style={styles.statIcon}>⭐</Text>
                <Text style={styles.statNum}>{user?.stars || 0}</Text>
                <Text style={styles.statLabel}>{t('totalStars')}</Text>
              </LinearGradient>
            </View>
            
            <View style={styles.statCard}>
              <LinearGradient
                colors={['rgba(251,191,36,0.12)', 'rgba(251,191,36,0.04)']}
                style={styles.statGradient}
              >
                <Text style={styles.statIcon}>🪙</Text>
                <Text style={[styles.statNum, styles.statNumCoins]}>{user?.coins?.toLocaleString() || 0}</Text>
                <Text style={styles.statLabel}>{t('coins')}</Text>
              </LinearGradient>
            </View>
            
            <View style={styles.statCard}>
              <LinearGradient
                colors={['rgba(139,92,246,0.12)', 'rgba(139,92,246,0.04)']}
                style={styles.statGradient}
              >
                <Text style={styles.statIcon}>🎯</Text>
                <Text style={[styles.statNum, styles.statNumXP]}>{user?.xp || 0}</Text>
                <Text style={styles.statLabel}>{t('totalXP')}</Text>
              </LinearGradient>
            </View>
            
            <View style={styles.statCard}>
              <LinearGradient
                colors={['rgba(239,68,68,0.12)', 'rgba(239,68,68,0.04)']}
                style={styles.statGradient}
              >
                <Text style={styles.statIcon}>🔥</Text>
                <Text style={[styles.statNum, styles.statNumStreak]}>7</Text>
                <Text style={styles.statLabel}>{t('dayStreak')}</Text>
              </LinearGradient>
            </View>
          </View>
        </View>

        {/* Avatar Picker */}
        <View style={styles.avatarPicker}>
          <Text style={styles.sectionTitle}>🎭 {t('changeAvatar')}</Text>
          <View style={styles.avatarPickerCard}>
            <LinearGradient
              colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
              style={styles.avatarPickerGradient}
            >
              <View style={styles.avatarGrid}>
                {AVATARS.map((avatar) => {
                  const isSelected = selectedAvatar === avatar;
                  console.log(`${FILE_NAME} 🎨 Rendering avatar option: ${avatar} (selected: ${isSelected})`);
                  
                  return (
                    <TouchableOpacity 
                      key={avatar} 
                      style={[styles.avatarBtn, isSelected && styles.avatarBtnActive]} 
                      onPress={() => changeAvatar(avatar)}
                      activeOpacity={0.7}
                    >
                      {isSelected && (
                        <LinearGradient
                          colors={['rgba(74,222,128,0.3)', 'rgba(74,222,128,0.1)']}
                          style={styles.avatarBtnGradient}
                        />
                      )}
                      <Text style={styles.avatarOption}>{avatar}</Text>
                      {isSelected && (
                        <View style={styles.avatarCheck}>
                          <Text style={styles.avatarCheckText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </LinearGradient>
          </View>
        </View>

        {/* Achievements Preview */}
        <View style={styles.achievementsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🏆 {t('recentAchievements')}</Text>
            <TouchableOpacity onPress={() => router.push('/achievements')}>
              <Text style={styles.viewAllText}>{t('viewAll')} →</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.achievementsScroll}
          >
            {[
              { icon: '🎯', title: t('firstWin'), unlocked: true },
              { icon: '🔥', title: t('sevenDayStreak'), unlocked: true },
              { icon: '⚡', title: t('speedDemon'), unlocked: false },
              { icon: '💎', title: t('perfectionist'), unlocked: false },
            ].map((achievement, index) => (
              <View
                key={index}
                style={[styles.achievementCard, !achievement.unlocked && styles.achievementLocked]}
              >
                <Text style={styles.achievementIcon}>{achievement.icon}</Text>
                <Text style={styles.achievementTitle}>{achievement.title}</Text>
                {achievement.unlocked ? (
                  <Text style={styles.achievementUnlocked}>✓ {t('unlocked')}</Text>
                ) : (
                  <Text style={styles.achievementLockedText}>🔒 {t('locked')}</Text>
                )}
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
            <LinearGradient
              colors={['rgba(59,130,246,0.15)', 'rgba(59,130,246,0.05)']}
              style={styles.actionButtonGradient}
            >
              <Text style={styles.actionButtonIcon}>⚙️</Text>
              <Text style={styles.actionButtonText}>{t('editProfile')}</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
            <LinearGradient
              colors={['rgba(239,68,68,0.15)', 'rgba(239,68,68,0.05)']}
              style={styles.actionButtonGradient}
            >
              <Text style={styles.actionButtonIcon}>🚪</Text>
              <Text style={[styles.actionButtonText, styles.actionButtonTextDanger]}>{t('logOut')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Bottom spacing */}
        <View style={{ height: 40 }} />
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
  editButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  editButtonText: {
    fontSize: 18,
  },
  
  // Content
  content: {
    paddingHorizontal: 20,
  },
  
  // Avatar Section
  avatarSection: { 
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 24,
  },
  avatarSectionGradient: {
    alignItems: 'center',
    padding: 28,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.2)',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  currentAvatar: { 
    width: 120, 
    height: 120, 
    borderRadius: 36, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 3, 
    borderColor: 'rgba(74,222,128,0.5)',
  },
  avatarGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(74,222,128,0.1)',
    top: -10,
    left: -10,
  },
  avatarLarge: { 
    fontSize: 56,
  },
  levelBadge: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  levelBadgeGradient: {
    width: 40,
    height: 40,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#0a0a1a',
  },
  levelBadgeText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
  },
  username: { 
    color: '#fff', 
    fontSize: 28, 
    fontWeight: '800',
    marginBottom: 4,
  },
  email: { 
    color: '#64748b', 
    fontSize: 14,
    marginBottom: 20,
  },
  
  // XP Progress
  xpContainer: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 16,
    padding: 16,
  },
  xpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  xpLabel: {
    color: '#4ade80',
    fontSize: 14,
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
  xpNextLevel: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
  },
  
  // Section Title
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  viewAllText: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Stats Section
  statsSection: {
    marginBottom: 24,
  },
  statsGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '47%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  statGradient: { 
    padding: 20,
    borderRadius: 20, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  statNum: { 
    color: '#4ade80', 
    fontSize: 28, 
    fontWeight: '800',
  },
  statNumCoins: {
    color: '#fbbf24',
  },
  statNumXP: {
    color: '#a78bfa',
  },
  statNumStreak: {
    color: '#ef4444',
  },
  statLabel: { 
    color: '#64748b', 
    fontSize: 12, 
    marginTop: 6,
    fontWeight: '500',
  },
  
  // Avatar Picker
  avatarPicker: {
    marginBottom: 24,
  },
  avatarPickerCard: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  avatarPickerGradient: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  avatarGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 10,
    justifyContent: 'center',
  },
  avatarBtn: { 
    width: 58, 
    height: 58, 
    backgroundColor: 'rgba(255,255,255,0.05)', 
    borderRadius: 16, 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
    overflow: 'hidden',
  },
  avatarBtnActive: { 
    borderColor: '#4ade80',
  },
  avatarBtnGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  avatarOption: { 
    fontSize: 28,
  },
  avatarCheck: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#4ade80',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarCheckText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '800',
  },
  
  // Achievements Section
  achievementsSection: {
    marginBottom: 24,
  },
  achievementsScroll: {
    gap: 12,
  },
  achievementCard: {
    width: 120,
    backgroundColor: 'rgba(74,222,128,0.1)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.2)',
  },
  achievementLocked: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.05)',
    opacity: 0.6,
  },
  achievementIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  achievementTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
  },
  achievementUnlocked: {
    color: '#4ade80',
    fontSize: 10,
    fontWeight: '600',
  },
  achievementLockedText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600',
  },
  
  // Action Buttons
  actionButtons: {
    gap: 12,
  },
  actionButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  actionButtonIcon: {
    fontSize: 20,
  },
  actionButtonText: {
    color: '#60a5fa',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonTextDanger: {
    color: '#ef4444',
  },
});