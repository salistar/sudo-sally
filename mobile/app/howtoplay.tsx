import { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useLang } from '../utils/LanguageContext';

const FILE_NAME = '📁 [HowToPlay.tsx]';

export default function HowToPlay() {
  console.log(`${FILE_NAME} 🚀 Component mounting...`);

  const router = useRouter();
  const { t } = useLang();

  const rules = [
    { title: `🎯 ${t('objective')}`, desc: t('objectiveDesc') },
    { title: `🔢 ${t('basicRule')}`, desc: t('basicRuleDesc') },
    { title: `📊 ${t('columnsRule')}`, desc: t('columnsRuleDesc') },
    { title: `📦 ${t('boxesRule')}`, desc: t('boxesRuleDesc') },
    { title: `🚫 ${t('noGuessing')}`, desc: t('noGuessingDesc') },
  ];

  const tips = [
    { icon: '1️⃣', title: t('tipScanning'), desc: t('tipScanningDesc') },
    { icon: '2️⃣', title: t('tipPencilMarks'), desc: t('tipPencilMarksDesc') },
    { icon: '3️⃣', title: t('tipElimination'), desc: t('tipEliminationDesc') },
    { icon: '4️⃣', title: t('tipNakedPairs'), desc: t('tipNakedPairsDesc') },
    { icon: '5️⃣', title: t('tipBoxLine'), desc: t('tipBoxLineDesc') },
  ];

  const controls = [
    { icon: '👆', action: t('ctrlTapCell'), desc: t('ctrlTapCellDesc') },
    { icon: '🔢', action: t('ctrlTapNumber'), desc: t('ctrlTapNumberDesc') },
    { icon: '📝', action: t('ctrlNotes'), desc: t('ctrlNotesDesc') },
    { icon: '🧹', action: t('ctrlErase'), desc: t('ctrlEraseDesc') },
    { icon: '↩️', action: t('ctrlUndo'), desc: t('ctrlUndoDesc') },
    { icon: '💡', action: t('ctrlHint'), desc: t('ctrlHintDesc') },
    { icon: '⏸️', action: t('ctrlPause'), desc: t('ctrlPauseDesc') },
  ];

  const difficulty = [
    { level: t('beginner'), range: '1-5', clues: '45-50', color: '#4ade80' },
    { level: t('easy'), range: '6-10', clues: '36-44', color: '#22c55e' },
    { level: t('medium'), range: '11-15', clues: '32-35', color: '#fbbf24' },
    { level: t('hard'), range: '16-20', clues: '28-31', color: '#f97316' },
    { level: t('expert'), range: '21-25', clues: '24-27', color: '#ef4444' },
    { level: t('master'), range: '26-30', clues: '17-23', color: '#8b5cf6' },
  ];

  console.log(`${FILE_NAME} 📚 Content loaded - Rules: ${rules.length}, Tips: ${tips.length}, Controls: ${controls.length}, Difficulties: ${difficulty.length}`);

  const handleBack = useCallback(() => {
    console.log(`${FILE_NAME} 🔙 handleBack() - Navigating back...`);
    router.back();
  }, [router]);

  const renderRule = useCallback((rule: typeof rules[0], index: number) => {
    console.log(`${FILE_NAME} 📜 renderRule() - Rendering rule [${index}]: ${rule.title}`);
    return (
      <View key={index} style={styles.ruleCard}>
        <LinearGradient
          colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
          style={styles.ruleGradient}
        >
          <View style={styles.ruleHeader}>
            <Text style={styles.ruleTitle}>{rule.title}</Text>
            <View style={styles.ruleNumber}>
              <Text style={styles.ruleNumberText}>{index + 1}</Text>
            </View>
          </View>
          <Text style={styles.ruleDesc}>{rule.desc}</Text>
        </LinearGradient>
      </View>
    );
  }, []);

  const renderTip = useCallback((tip: typeof tips[0], index: number) => {
    console.log(`${FILE_NAME} 💡 renderTip() - Rendering tip [${index}]: ${tip.title}`);
    return (
      <View key={index} style={styles.tipCard}>
        <LinearGradient
          colors={['rgba(74,222,128,0.12)', 'rgba(74,222,128,0.04)']}
          style={styles.tipGradient}
        >
          <View style={styles.tipIconContainer}>
            <Text style={styles.tipIcon}>{tip.icon}</Text>
          </View>
          <View style={styles.tipContent}>
            <Text style={styles.tipTitle}>{tip.title}</Text>
            <Text style={styles.tipDesc}>{tip.desc}</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }, []);

  const renderControl = useCallback((ctrl: typeof controls[0], index: number) => {
    console.log(`${FILE_NAME} 🎛️ renderControl() - Rendering control [${index}]: ${ctrl.action}`);
    return (
      <View key={index} style={styles.controlRow}>
        <View style={styles.controlIconContainer}>
          <Text style={styles.controlIcon}>{ctrl.icon}</Text>
        </View>
        <View style={styles.controlText}>
          <Text style={styles.controlAction}>{ctrl.action}</Text>
          <Text style={styles.controlDesc}>{ctrl.desc}</Text>
        </View>
        <View style={styles.controlArrow}>
          <Text style={styles.controlArrowText}>→</Text>
        </View>
      </View>
    );
  }, []);

  const renderDifficulty = useCallback((d: typeof difficulty[0], index: number) => {
    console.log(`${FILE_NAME} 📊 renderDifficulty() - Rendering difficulty [${index}]: ${d.level}`);
    return (
      <View key={index} style={styles.diffCard}>
        <LinearGradient
          colors={[`${d.color}15`, `${d.color}05`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.diffGradient, { borderLeftColor: d.color }]}
        >
          <View style={styles.diffLeft}>
            <Text style={[styles.diffLevel, { color: d.color }]}>{d.level}</Text>
            <Text style={styles.diffRange}>{t('levels')} {d.range}</Text>
          </View>
          <View style={styles.diffRight}>
            <Text style={styles.diffCluesNum}>{d.clues}</Text>
            <Text style={styles.diffCluesLabel}>{t('clues')}</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }, [t]);

  // Example grid data
  const exampleGrid = [
    [5, 3, null, null, 7, null, null, null, null],
    [6, null, null, 1, 9, 5, null, null, null],
    [null, 9, 8, null, null, null, null, 6, null],
  ];

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
          <Text style={styles.titleIcon}>📖</Text>
          <Text style={styles.title}>{t('howToPlay')}</Text>
        </View>
        
        <View style={{ width: 44 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.content} 
        showsVerticalScrollIndicator={false}
      >
        {/* Intro Card */}
        <View style={styles.introCard}>
          <LinearGradient
            colors={['rgba(74,222,128,0.15)', 'rgba(74,222,128,0.05)']}
            style={styles.introGradient}
          >
            <Text style={styles.introIcon}>🧩</Text>
            <Text style={styles.introTitle}>{t('welcomeToSudoku')}</Text>
            <Text style={styles.introText}>
              {t('sudokuIntro')}
            </Text>
          </LinearGradient>
        </View>

        {/* Rules Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>📜</Text>
            <Text style={styles.sectionTitle}>{t('rules')}</Text>
          </View>
          {rules.map(renderRule)}
        </View>

        {/* Example Grid */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>🎮</Text>
            <Text style={styles.sectionTitle}>{t('exampleGrid')}</Text>
          </View>
          
          <View style={styles.exampleCard}>
            <LinearGradient
              colors={['rgba(59,130,246,0.1)', 'rgba(59,130,246,0.02)']}
              style={styles.exampleGradient}
            >
              <View style={styles.miniBoard}>
                {exampleGrid.map((row, i) => (
                  <View key={i} style={[styles.miniRow, i % 3 === 2 && i !== 8 && styles.miniRowBorder]}>
                    {row.map((cell, j) => (
                      <View 
                        key={j} 
                        style={[
                          styles.miniCell,
                          j % 3 === 2 && j !== 8 && styles.miniCellBorderR,
                          cell !== null && styles.miniCellFilled,
                        ]}
                      >
                        <Text style={[styles.miniText, cell !== null && styles.miniTextFilled]}>
                          {cell || ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
              
              <View style={styles.exampleLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendBox, styles.legendFilled]} />
                  <Text style={styles.legendText}>{t('givenNumbers')}</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendBox, styles.legendEmpty]} />
                  <Text style={styles.legendText}>{t('fillTheseIn')}</Text>
                </View>
              </View>

              <Text style={styles.exampleNote}>
                {t('exampleNote')}
              </Text>
            </LinearGradient>
          </View>
        </View>

        {/* Controls Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>🎛️</Text>
            <Text style={styles.sectionTitle}>{t('controls')}</Text>
          </View>
          <View style={styles.controlsGrid}>
            {controls.map(renderControl)}
          </View>
        </View>

        {/* Tips Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>💡</Text>
            <Text style={styles.sectionTitle}>{t('tipsStrategies')}</Text>
          </View>
          {tips.map(renderTip)}
        </View>

        {/* Difficulty Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>📊</Text>
            <Text style={styles.sectionTitle}>{t('difficultyLevels')}</Text>
          </View>
          <View style={styles.diffGrid}>
            {difficulty.map(renderDifficulty)}
          </View>
        </View>

        {/* Scoring Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>⭐</Text>
            <Text style={styles.sectionTitle}>{t('scoringSystem')}</Text>
          </View>
          
          <View style={styles.scoreCard}>
            <LinearGradient
              colors={['rgba(251,191,36,0.12)', 'rgba(251,191,36,0.04)']}
              style={styles.scoreGradient}
            >
              <View style={styles.scoreRow}>
                <View style={styles.scoreStars}>
                  <Text style={styles.starText}>⭐⭐⭐</Text>
                </View>
                <View style={styles.scoreInfo}>
                  <Text style={styles.scoreTitle}>{t('perfect')}</Text>
                  <Text style={styles.scoreDesc}>{t('completeFast')}</Text>
                </View>
                <Text style={styles.scoreXP}>+150 XP</Text>
              </View>
              
              <View style={styles.scoreDivider} />
              
              <View style={styles.scoreRow}>
                <View style={styles.scoreStars}>
                  <Text style={styles.starText}>⭐⭐</Text>
                </View>
                <View style={styles.scoreInfo}>
                  <Text style={styles.scoreTitle}>{t('great')}</Text>
                  <Text style={styles.scoreDesc}>{t('withinTimeLimit')}</Text>
                </View>
                <Text style={styles.scoreXP}>+100 XP</Text>
              </View>
              
              <View style={styles.scoreDivider} />
              
              <View style={styles.scoreRow}>
                <View style={styles.scoreStars}>
                  <Text style={styles.starText}>⭐</Text>
                </View>
                <View style={styles.scoreInfo}>
                  <Text style={styles.scoreTitle}>{t('good')}</Text>
                  <Text style={styles.scoreDesc}>{t('completePuzzle')}</Text>
                </View>
                <Text style={styles.scoreXP}>+50 XP</Text>
              </View>
              
              <View style={styles.warningBox}>
                <Text style={styles.warningIcon}>⚠️</Text>
                <Text style={styles.warningText}>{t('threeErrorsGameOver')}</Text>
              </View>
            </LinearGradient>
          </View>
        </View>

        {/* Ready to Play */}
        <View style={styles.readyCard}>
          <LinearGradient
            colors={['rgba(74,222,128,0.2)', 'rgba(74,222,128,0.05)']}
            style={styles.readyGradient}
          >
            <Text style={styles.readyIcon}>🚀</Text>
            <Text style={styles.readyTitle}>{t('readyToPlay')}</Text>
            <Text style={styles.readyText}>
              {t('readyToPlayText')}
            </Text>
            <TouchableOpacity 
              style={styles.playButton}
              onPress={() => {
                console.log(`${FILE_NAME} 🎮 Play button pressed - Navigating to levels`);
                router.push('/levels');
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#4ade80', '#22c55e'] as const}
                style={styles.playButtonGradient}
              >
                <Text style={styles.playButtonText}>{t('startPlaying')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>

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
    fontSize: 20, 
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  
  // Content
  content: { 
    padding: 20,
  },
  
  // Intro Card
  introCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
  },
  introGradient: {
    padding: 24,
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.2)',
  },
  introIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  introTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  introText: {
    color: '#94a3b8',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  
  // Section
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionIcon: {
    fontSize: 20,
  },
  sectionTitle: { 
    color: '#4ade80', 
    fontSize: 18, 
    fontWeight: '700',
  },
  
  // Rule Card
  ruleCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 10,
  },
  ruleGradient: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  ruleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ruleTitle: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '600',
  },
  ruleNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(74,222,128,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ruleNumberText: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '700',
  },
  ruleDesc: { 
    color: '#94a3b8', 
    fontSize: 14, 
    lineHeight: 21,
  },
  
  // Example Grid
  exampleCard: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  exampleGradient: { 
    alignItems: 'center', 
    padding: 24, 
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
  },
  miniBoard: { 
    borderWidth: 2, 
    borderColor: '#4ade80',
    borderRadius: 8,
    overflow: 'hidden',
  },
  miniRow: { 
    flexDirection: 'row',
  },
  miniRowBorder: {
    borderBottomWidth: 2,
    borderBottomColor: '#4ade80',
  },
  miniCell: { 
    width: 32, 
    height: 32, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 0.5, 
    borderColor: 'rgba(100,116,139,0.3)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  miniCellBorderR: { 
    borderRightWidth: 2, 
    borderRightColor: '#4ade80',
  },
  miniCellFilled: {
    backgroundColor: 'rgba(74,222,128,0.1)',
  },
  miniText: { 
    color: 'rgba(255,255,255,0.3)', 
    fontSize: 14,
    fontWeight: '600',
  },
  miniTextFilled: {
    color: '#fff',
  },
  exampleLegend: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  legendFilled: {
    backgroundColor: 'rgba(74,222,128,0.3)',
  },
  legendEmpty: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  legendText: {
    color: '#64748b',
    fontSize: 12,
  },
  exampleNote: { 
    color: '#64748b', 
    fontSize: 13, 
    marginTop: 16, 
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Controls
  controlsGrid: {
    gap: 8,
  },
  controlRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.03)', 
    padding: 14, 
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  controlIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  controlIcon: { 
    fontSize: 22,
  },
  controlText: { 
    flex: 1,
  },
  controlAction: { 
    color: '#fff', 
    fontSize: 15, 
    fontWeight: '600',
  },
  controlDesc: { 
    color: '#64748b', 
    fontSize: 13,
    marginTop: 2,
  },
  controlArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(74,222,128,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlArrowText: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Tips
  tipCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 10,
  },
  tipGradient: { 
    flexDirection: 'row', 
    padding: 16, 
    borderRadius: 16,
    borderLeftWidth: 4, 
    borderLeftColor: '#4ade80',
  },
  tipIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  tipIcon: { 
    fontSize: 24,
  },
  tipContent: { 
    flex: 1,
    justifyContent: 'center',
  },
  tipTitle: { 
    color: '#4ade80', 
    fontSize: 16, 
    fontWeight: '700',
  },
  tipDesc: { 
    color: '#94a3b8', 
    fontSize: 13, 
    marginTop: 4,
    lineHeight: 19,
  },
  
  // Difficulty
  diffGrid: { 
    gap: 8,
  },
  diffCard: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  diffGradient: { 
    padding: 14, 
    borderRadius: 14, 
    borderLeftWidth: 4,
    flexDirection: 'row', 
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  diffLeft: {},
  diffLevel: { 
    fontSize: 15, 
    fontWeight: '700',
  },
  diffRange: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  diffRight: {
    alignItems: 'flex-end',
  },
  diffCluesNum: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  diffCluesLabel: { 
    color: '#64748b', 
    fontSize: 11,
  },
  
  // Scoring
  scoreCard: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  scoreGradient: { 
    padding: 20, 
    borderRadius: 20,
    borderWidth: 1, 
    borderColor: 'rgba(251,191,36,0.2)',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  scoreStars: {
    width: 70,
  },
  starText: {
    fontSize: 18,
  },
  scoreInfo: {
    flex: 1,
  },
  scoreTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  scoreDesc: { 
    color: '#94a3b8', 
    fontSize: 12,
    marginTop: 2,
  },
  scoreXP: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '700',
  },
  scoreDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.15)',
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  warningIcon: {
    fontSize: 18,
  },
  warningText: { 
    color: '#ef4444', 
    fontSize: 14, 
    fontWeight: '700',
  },
  
  // Ready Card
  readyCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 8,
  },
  readyGradient: {
    padding: 28,
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.3)',
  },
  readyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  readyTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  readyText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  playButton: {
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
  },
  playButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 16,
  },
  playButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '700',
  },
});