// Tutorial Screen - Feature #10
import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useLang } from '../utils/LanguageContext';
import * as Haptics from 'expo-haptics';

const FILE_NAME = '[Tutorial.tsx]';
const { width, height } = Dimensions.get('window');

// Localized tutorial pages — was hardcoded French before, now pulled from i18n
// so EN / FR / AR users see the tutorial in their own language. The shape (visual
// keyword + color) stays language-neutral.
const VISUALS: Array<{ visual: string; color: string }> = [
  { visual: 'grid',   color: '#4ade80' },
  { visual: 'select', color: '#60a5fa' },
  { visual: 'notes',  color: '#c084fc' },
  { visual: 'hint',   color: '#fbbf24' },
  { visual: 'stars',  color: '#facc15' },
  { visual: 'errors', color: '#f87171' },
  { visual: 'tools',  color: '#22d3d1' },
  { visual: 'tips',   color: '#fb923c' },
];

function getTutorialPages(t: (k: string) => string) {
  return VISUALS.map((v, i) => {
    const n = i + 1;
    const details: string[] = [];
    // Each page has up to 5 detail keys: tutP{n}D1..D5 — absent ones are skipped.
    for (let d = 1; d <= 5; d++) {
      const key = `tutP${n}D${d}`;
      const val = t(key);
      if (val && val !== key) details.push(val);
    }
    return {
      title:   t(`tutP${n}Title`),
      content: t(`tutP${n}Content`),
      details,
      visual:  v.visual,
      color:   v.color,
    };
  });
}

export default function Tutorial() {
  console.log(`${FILE_NAME} 📖 Component rendering...`);
  
  const router = useRouter();
  const { t } = useLang();
  const [currentPage, setCurrentPage] = useState(0);
  const tutorialPages = getTutorialPages(t as any);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const page = tutorialPages[currentPage];
  
  console.log(`${FILE_NAME} 📄 Current page: ${currentPage + 1}/${tutorialPages.length} - ${page.title}`);

  useEffect(() => {
    console.log(`${FILE_NAME} 🔄 useEffect triggered - Animating progress bar...`);
    Animated.timing(progressAnim, {
      toValue: (currentPage + 1) / tutorialPages.length,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [currentPage]);

  const animatePageTransition = (direction: 'next' | 'prev') => {
    console.log(`${FILE_NAME} 🎬 Page transition animation: ${direction}`);
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: direction === 'next' ? -30 : 30,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      slideAnim.setValue(direction === 'next' ? 30 : -30);
      
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start(() => {
        console.log(`${FILE_NAME} ✅ Page transition completed`);
      });
    });
  };

  const handleNext = () => {
    console.log(`${FILE_NAME} ➡️ Next button pressed - Current: ${currentPage}, Max: ${tutorialPages.length - 1}`);
    if (currentPage < tutorialPages.length - 1) {
      Haptics.selectionAsync();
      animatePageTransition('next');
      setCurrentPage(p => p + 1);
    }
  };

  const handlePrev = () => {
    console.log(`${FILE_NAME} ⬅️ Previous button pressed - Current: ${currentPage}`);
    if (currentPage > 0) {
      Haptics.selectionAsync();
      animatePageTransition('prev');
      setCurrentPage(p => p - 1);
    }
  };

  const handleBack = () => {
    console.log(`${FILE_NAME} 🔙 Back button pressed, navigating back...`);
    router.back();
  };

  const handlePlay = () => {
    console.log(`${FILE_NAME} 🎮 Play button pressed, navigating to /home...`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/home');
  };

  const handleDotPress = (index: number) => {
    console.log(`${FILE_NAME} 🔘 Dot pressed: ${index + 1}`);
    if (index !== currentPage) {
      Haptics.selectionAsync();
      animatePageTransition(index > currentPage ? 'next' : 'prev');
      setCurrentPage(index);
    }
  };

  const renderVisual = () => {
    console.log(`${FILE_NAME} 🖼️ Rendering visual: ${page.visual}`);
    
    switch (page.visual) {
      case 'grid':
        return (
          <View style={styles.miniGridContainer}>
            <LinearGradient 
              colors={['rgba(74,222,128,0.1)', 'rgba(74,222,128,0.02)']} 
              style={styles.miniGridWrapper}
            >
              <View style={styles.miniGrid}>
                {[...Array(9)].map((_, i) => (
                  <View key={i} style={styles.miniRow}>
                    {[...Array(9)].map((_, j) => {
                      const isHighlighted = (i < 3 && j < 3);
                      return (
                        <View key={j} style={[
                          styles.miniCell,
                          j % 3 === 2 && j !== 8 && styles.borderRight,
                          i % 3 === 2 && i !== 8 && styles.borderBottom,
                          isHighlighted && styles.miniCellHighlighted,
                        ]}>
                          <Text style={[
                            styles.miniCellText,
                            isHighlighted && styles.miniCellTextHighlighted
                          ]}>
                            {(i + j) % 9 + 1}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
              <View style={styles.gridLabel}>
                <Text style={styles.gridLabelText}>Bloc 3x3</Text>
              </View>
            </LinearGradient>
          </View>
        );
        
      case 'stars':
        return (
          <View style={styles.starsDemo}>
            {[
              { stars: '⭐⭐⭐', label: 'Parfait!', color: '#fbbf24' },
              { stars: '⭐⭐☆', label: 'Bien!', color: '#94a3b8' },
              { stars: '⭐☆☆', label: 'Terminé', color: '#64748b' },
            ].map((item, i) => (
              <LinearGradient 
                key={i}
                colors={[`${item.color}15`, `${item.color}05`]}
                style={styles.starRowCard}
              >
                <Text style={styles.starText}>{item.stars}</Text>
                <Text style={[styles.starLabel, { color: item.color }]}>{item.label}</Text>
              </LinearGradient>
            ))}
          </View>
        );
        
      case 'tools':
        return (
          <View style={styles.toolsDemo}>
            {[
              { icon: '↩️', label: 'Annuler' },
              { icon: '🧹', label: 'Effacer' },
              { icon: '📝', label: 'Notes' },
              { icon: '💡', label: 'Indice' },
              { icon: '⏸️', label: 'Pause' },
            ].map((tool, i) => (
              <View key={i} style={styles.toolItem}>
                <LinearGradient 
                  colors={['rgba(34,211,209,0.2)', 'rgba(34,211,209,0.05)']}
                  style={styles.toolIcon}
                >
                  <Text style={styles.toolEmoji}>{tool.icon}</Text>
                </LinearGradient>
                <Text style={styles.toolLabel}>{tool.label}</Text>
              </View>
            ))}
          </View>
        );
        
      case 'errors':
        return (
          <View style={styles.errorsDemo}>
            <LinearGradient 
              colors={['rgba(248,113,113,0.2)', 'rgba(248,113,113,0.05)']}
              style={styles.errorsCard}
            >
              <View style={styles.errorsRow}>
                {[1, 2, 3].map((_, i) => (
                  <View key={i} style={[styles.errorHeart, i < 2 && styles.errorHeartFilled]}>
                    <Text style={styles.errorHeartText}>{i < 2 ? '❤️' : '🖤'}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.errorsLabel}>2 erreurs restantes</Text>
            </LinearGradient>
          </View>
        );
        
      default:
        return (
          <View style={styles.iconDemo}>
            <LinearGradient 
              colors={[`${page.color}30`, `${page.color}10`]}
              style={styles.iconDemoBg}
            >
              <Animated.Text style={[styles.demoEmoji, { transform: [{ scale: scaleAnim }] }]}>
                {page.visual === 'select' ? '👆' : 
                 page.visual === 'notes' ? '📝' : 
                 page.visual === 'hint' ? '💡' : 
                 page.visual === 'tips' ? '🏆' : '🎯'}
              </Animated.Text>
            </LinearGradient>
          </View>
        );
    }
  };

  console.log(`${FILE_NAME} 🖼️ Rendering UI...`);

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
          <Text style={styles.titleIcon}>📖</Text>
          <Text style={styles.title}>{t('howToPlay')}</Text>
        </View>
        
        <View style={styles.pageNumBadge}>
          <Text style={styles.pageNum}>{currentPage + 1}/{tutorialPages.length}</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <Animated.View 
            style={[
              styles.progressFill, 
              { 
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
                backgroundColor: page.color 
              }
            ]} 
          />
        </View>
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View style={[
          styles.pageContent,
          { 
            opacity: fadeAnim, 
            transform: [{ translateX: slideAnim }] 
          }
        ]}>
          {/* Page Title */}
          <Text style={styles.pageTitle}>{page.title}</Text>
          <Text style={styles.pageSubtitle}>{page.content}</Text>

          {/* Visual */}
          {renderVisual()}

          {/* Details Box */}
          <View style={styles.detailsBox}>
            <LinearGradient 
              colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']}
              style={styles.detailsGradient}
            >
              {page.details.map((detail, i) => (
                <View key={i} style={styles.detailRow}>
                  <View style={[styles.detailBullet, { backgroundColor: page.color }]} />
                  <Text style={styles.detailItem}>{detail}</Text>
                </View>
              ))}
            </LinearGradient>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Navigation */}
      <View style={styles.navigation}>
        <LinearGradient 
          colors={['rgba(255,255,255,0.05)', 'transparent']}
          style={styles.navigationGradient}
        >
          <TouchableOpacity 
            style={[styles.navBtn, currentPage === 0 && styles.navBtnDisabled]}
            onPress={handlePrev}
            disabled={currentPage === 0}
            activeOpacity={0.7}
          >
            <LinearGradient 
              colors={currentPage === 0 ? ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)'] : ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)']}
              style={styles.navBtnGradient}
            >
              <Text style={[styles.navBtnText, currentPage === 0 && styles.navBtnTextDisabled]}>← {t('previous')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Dots */}
          <View style={styles.dots}>
            {tutorialPages.map((p, i) => (
              <TouchableOpacity 
                key={i} 
                onPress={() => handleDotPress(i)}
                activeOpacity={0.7}
              >
                <Animated.View 
                  style={[
                    styles.dot, 
                    i === currentPage && styles.dotActive,
                    i === currentPage && { backgroundColor: page.color }
                  ]} 
                />
              </TouchableOpacity>
            ))}
          </View>

          {currentPage < tutorialPages.length - 1 ? (
            <TouchableOpacity 
              style={styles.navBtn}
              onPress={handleNext}
              activeOpacity={0.7}
            >
              <LinearGradient 
                colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)']}
                style={styles.navBtnGradient}
              >
                <Text style={styles.navBtnText}>{t('next')} →</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.navBtn}
              onPress={handlePlay}
              activeOpacity={0.8}
            >
              <LinearGradient 
                colors={['#4ade80', '#22c55e']}
                style={styles.navBtnGradient}
              >
                <Text style={styles.navBtnTextPrimary}>{t('playExcl')} 🎮</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </LinearGradient>
      </View>
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
    paddingBottom: 15,
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
    fontSize: 24,
  },
  title: { 
    color: '#fff', 
    fontSize: 20, 
    fontWeight: '700',
  },
  pageNumBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  pageNum: { 
    color: '#94a3b8', 
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Progress Bar
  progressContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  
  // Content
  content: { 
    padding: 20, 
    alignItems: 'center',
    paddingBottom: 20,
  },
  pageContent: {
    width: '100%',
    alignItems: 'center',
  },
  pageTitle: { 
    fontSize: 36, 
    color: '#fff', 
    fontWeight: '800', 
    marginBottom: 12, 
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  pageSubtitle: { 
    fontSize: 16, 
    color: '#94a3b8', 
    textAlign: 'center', 
    marginBottom: 30,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  
  // Mini Grid
  miniGridContainer: {
    marginBottom: 30,
  },
  miniGridWrapper: {
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.2)',
  },
  miniGrid: { 
    backgroundColor: 'rgba(0,0,0,0.3)', 
    borderRadius: 8, 
    padding: 4,
  },
  miniRow: { 
    flexDirection: 'row' 
  },
  miniCell: { 
    width: 28, 
    height: 28, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 0.5, 
    borderColor: '#334155' 
  },
  miniCellHighlighted: {
    backgroundColor: 'rgba(74,222,128,0.15)',
  },
  miniCellText: { 
    color: '#64748b', 
    fontSize: 11,
    fontWeight: '600',
  },
  miniCellTextHighlighted: {
    color: '#4ade80',
  },
  borderRight: { 
    borderRightWidth: 2, 
    borderRightColor: '#4ade80' 
  },
  borderBottom: { 
    borderBottomWidth: 2, 
    borderBottomColor: '#4ade80' 
  },
  gridLabel: {
    position: 'absolute',
    top: -8,
    left: 20,
    backgroundColor: '#0a0a1a',
    paddingHorizontal: 8,
  },
  gridLabelText: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Stars Demo
  starsDemo: { 
    marginBottom: 30, 
    gap: 12,
    width: '100%',
  },
  starRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  starText: { 
    fontSize: 28 
  },
  starLabel: { 
    fontSize: 18,
    fontWeight: '700',
  },
  
  // Tools Demo
  toolsDemo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 30,
  },
  toolItem: {
    alignItems: 'center',
    width: 70,
  },
  toolIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(34,211,209,0.3)',
  },
  toolEmoji: {
    fontSize: 28,
  },
  toolLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Errors Demo
  errorsDemo: {
    marginBottom: 30,
    width: '100%',
  },
  errorsCard: {
    alignItems: 'center',
    paddingVertical: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.3)',
  },
  errorsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  errorHeart: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorHeartFilled: {
    backgroundColor: 'rgba(248,113,113,0.2)',
  },
  errorHeartText: {
    fontSize: 28,
  },
  errorsLabel: {
    color: '#f87171',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Icon Demo
  iconDemo: { 
    marginBottom: 30 
  },
  iconDemoBg: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  demoEmoji: { 
    fontSize: 70 
  },
  
  // Details Box
  detailsBox: { 
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  detailsGradient: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  detailBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    marginRight: 12,
  },
  detailItem: { 
    flex: 1,
    color: '#cbd5e1', 
    fontSize: 15, 
    lineHeight: 22,
  },
  
  // Navigation
  navigation: { 
    borderTopWidth: 1, 
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  navigationGradient: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 20,
    paddingBottom: 34,
  },
  navBtn: { 
    borderRadius: 16,
    overflow: 'hidden',
  },
  navBtnGradient: {
    paddingVertical: 14, 
    paddingHorizontal: 20, 
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  navBtnDisabled: { 
    opacity: 0.4 
  },
  navBtnText: { 
    color: '#fff', 
    fontWeight: '600',
    fontSize: 15,
  },
  navBtnTextDisabled: {
    color: '#64748b',
  },
  navBtnTextPrimary: { 
    color: '#000',
    fontWeight: '700',
    fontSize: 15,
  },
  
  // Dots
  dots: { 
    flexDirection: 'row', 
    gap: 8,
    alignItems: 'center',
  },
  dot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: 'rgba(255,255,255,0.2)' 
  },
  dotActive: { 
    width: 24,
    borderRadius: 4,
  },
});