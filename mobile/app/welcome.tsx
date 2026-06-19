// Welcome Screen - Feature #2
import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { storage } from '../utils/storage';
import { Language, t } from '../utils/i18n';
import { useLang } from '../utils/LanguageContext';
import * as Haptics from 'expo-haptics';
import SallyMascot from '../components/SallyMascot';

const FILE_NAME = '[Welcome.tsx]';
const { width, height } = Dimensions.get('window');

const LANGUAGES: { code: Language; name: string; flag: string; nativeName: string }[] = [
  { code: 'en', name: 'English', flag: '🇬🇧', nativeName: 'English' },
  { code: 'fr', name: 'Français', flag: '🇫🇷', nativeName: 'French' },
  { code: 'ar', name: 'العربية', flag: '🇲🇦', nativeName: 'Arabic' },
];

export default function Welcome() {
  console.log(`${FILE_NAME} 👋 Component rendering...`);
  
  const router = useRouter();
  const { setLang } = useLang();
  const [selectedLang, setSelectedLang] = useState<Language>('en');
  const [isLoading, setIsLoading] = useState(true);
  
  // Animations
  // v3.7.2 — Start fully visible. The pre-v3.7.2 code started fadeAnim=0
  // and only animated to 1 inside the loadSavedLanguage async callback;
  // if storage.getSettings() threw silently on web, the welcome screen
  // stayed at opacity 0 and looked completely blank. Initial value 1
  // means the screen always paints; the entrance animation now just
  // overrides briefly to 0 then back to 1 (no visible flicker).
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const logoScaleAnim = useRef(new Animated.Value(0.5)).current;
  const logoRotateAnim = useRef(new Animated.Value(0)).current;
  const buttonScaleAnim = useRef(new Animated.Value(0.9)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  console.log(`${FILE_NAME} 🌍 Current selected language: ${selectedLang}`);

  useEffect(() => {
    console.log(`${FILE_NAME} 🔄 useEffect triggered - Loading saved language...`);

    // v3.10.0 — auth gate. /welcome is the language-picker landing screen meant
    // for first-time visitors only. If a user blob exists in storage they are
    // already onboarded — skip straight to /home (the dashboard) so refreshing
    // the page from any authenticated session doesn't bounce back through the
    // language picker.
    const checkAuthAndMaybeRedirect = async () => {
      try {
        const raw = await (await import('@react-native-async-storage/async-storage')).default.getItem('sudoku_user');
        if (raw) {
          console.log(`${FILE_NAME} 👤 Already signed in — redirecting to /home`);
          router.replace('/home' as any);
          return true;
        }
      } catch {}
      return false;
    };

    const loadSavedLanguage = async () => {
      try {
        if (await checkAuthAndMaybeRedirect()) return;
        const settings = await storage.getSettings();
        console.log(`${FILE_NAME} ⚙️ Settings loaded:`, settings ? `language: ${settings.language}` : 'No settings found');
        
        if (settings?.language) {
          setSelectedLang(settings.language);
          console.log(`${FILE_NAME} 🌍 Applied saved language: ${settings.language}`);
        }
        setIsLoading(false);
        
        // Start entrance animations
        console.log(`${FILE_NAME} 🎬 Starting entrance animations...`);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.spring(logoScaleAnim, {
            toValue: 1,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.spring(buttonScaleAnim, {
            toValue: 1,
            tension: 50,
            friction: 7,
            delay: 300,
            useNativeDriver: true,
          }),
        ]).start(() => {
          console.log(`${FILE_NAME} ✅ Entrance animations completed`);
        });
        
        // Start logo pulse animation
        console.log(`${FILE_NAME} 💫 Starting pulse animation loop...`);
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.05,
              duration: 2000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 2000,
              useNativeDriver: true,
            }),
          ])
        ).start();
        
      } catch (error) {
        console.error(`${FILE_NAME} ❌ Error loading settings:`, error);
        setIsLoading(false);
      }
    };
    
    loadSavedLanguage();
  }, []);

  const handleLanguageSelect = async (lang: Language) => {
    console.log(`${FILE_NAME} 🌍 Language selection: ${selectedLang} → ${lang}`);
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedLang(lang);
    setLang(lang); // propagate to every screen via context

    try {
      const settings = await storage.getSettings();
      console.log(`${FILE_NAME} 💾 Saving language preference: ${lang}`);
      await storage.setSettings({ ...settings, language: lang });
      console.log(`${FILE_NAME} ✅ Language saved successfully`);
    } catch (error) {
      console.error(`${FILE_NAME} ❌ Error saving language:`, error);
    }
  };

  const handleContinue = () => {
    console.log(`${FILE_NAME} ➡️ Continue button pressed, navigating to /login...`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/login');
  };

  console.log(`${FILE_NAME} 🖼️ Rendering UI - isLoading: ${isLoading}, selectedLang: ${selectedLang}`);

  return (
    <LinearGradient colors={['#0a0a1a', '#12122a', '#1a1a3a', '#0f0f2a']} style={styles.container}>
      {/* Background Decorations */}
      <View style={styles.decorations}>
        <Animated.View style={[styles.decorCircle, styles.decorTop, { transform: [{ scale: pulseAnim }] }]} />
        <Animated.View style={[styles.decorCircle, styles.decorBottom]} />
        <View style={[styles.decorCircle, styles.decorMiddle]} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
      {/* Header */}
      <Animated.View style={[
        styles.header,
        { 
          opacity: fadeAnim, 
          transform: [{ translateY: slideAnim }] 
        }
      ]}>
        {/* Logo */}
        <Animated.View style={[
          styles.logoContainer,
          { transform: [{ scale: logoScaleAnim }] }
        ]}>
          <LinearGradient
            colors={['rgba(124,92,255,0.2)', 'rgba(124,92,255,0.05)']}
            style={styles.logoGradient}
          >
            <View style={styles.logoInner}>
              <SallyMascot size={110} mode="default" />{/* v3.6 — was 🧩 emoji */}
            </View>
            {/* Corner Accents */}
            <View style={[styles.cornerAccent, styles.cornerTL]} />
            <View style={[styles.cornerAccent, styles.cornerTR]} />
            <View style={[styles.cornerAccent, styles.cornerBL]} />
            <View style={[styles.cornerAccent, styles.cornerBR]} />
          </LinearGradient>
        </Animated.View>

        <Text style={styles.title}>{t('welcome', selectedLang)}</Text>
        <LinearGradient
          colors={['#7c5cff', '#2dd4db']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.subtitleBadge}
        >
          <Text style={styles.subtitle}>{t('appName', selectedLang)}</Text>
        </LinearGradient>
      </Animated.View>

      {/* Language Selection */}
      <Animated.View style={[
        styles.langSection,
        { 
          opacity: fadeAnim, 
          transform: [{ translateY: slideAnim }] 
        }
      ]}>
        <View style={styles.langTitleContainer}>
          <View style={styles.langTitleLine} />
          <Text style={styles.langTitle}>{t('language', selectedLang)}</Text>
          <View style={styles.langTitleLine} />
        </View>
        
        <View style={styles.langContainer}>
          {LANGUAGES.map((lang, index) => {
            const isSelected = selectedLang === lang.code;
            console.log(`${FILE_NAME} 🏳️ Rendering language option: ${lang.code} (selected: ${isSelected})`);
            
            return (
              <TouchableOpacity
                key={lang.code}
                style={styles.langButton}
                onPress={() => handleLanguageSelect(lang.code)}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={isSelected 
                    ? ['rgba(124,92,255,0.2)', 'rgba(124,92,255,0.08)']
                    : ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']
                  }
                  style={[
                    styles.langButtonGradient,
                    isSelected && styles.langButtonActive,
                  ]}
                >
                  <View style={styles.langFlagContainer}>
                    <Text style={styles.langFlag}>{lang.flag}</Text>
                  </View>
                  <View style={styles.langInfo}>
                    <Text style={[
                      styles.langName,
                      isSelected && styles.langNameActive,
                    ]}>{lang.name}</Text>
                    <Text style={styles.langNative}>{lang.nativeName}</Text>
                  </View>
                  {isSelected && (
                    <LinearGradient
                      colors={['#7c5cff', '#2dd4db']}
                      style={styles.checkmark}
                    >
                      <Text style={styles.checkmarkText}>✓</Text>
                    </LinearGradient>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>

      {/* Features Preview */}
      <Animated.View style={[
        styles.features,
        { 
          opacity: fadeAnim, 
          transform: [{ translateY: slideAnim }] 
        }
      ]}>
        {[
          { icon: '🎮', text: `30 ${t('levels', selectedLang)}`, color: '#60a5fa' },
          { icon: '⏱️', text: t('dailyChallenge', selectedLang), color: '#f472b6' },
          { icon: '🏆', text: t('leaderboard', selectedLang), color: '#fbbf24' },
        ].map((feature, index) => {
          console.log(`${FILE_NAME} ✨ Rendering feature: ${feature.text}`);
          return (
            <View key={index} style={styles.featureItem}>
              <LinearGradient
                colors={[`${feature.color}25`, `${feature.color}08`]}
                style={styles.featureIconBg}
              >
                <Text style={styles.featureIcon}>{feature.icon}</Text>
              </LinearGradient>
              <Text style={styles.featureText}>{feature.text}</Text>
            </View>
          );
        })}
      </Animated.View>

      {/* Continue Button */}
      <Animated.View style={[
        styles.buttonContainer,
        { transform: [{ scale: buttonScaleAnim }] }
      ]}>
        <TouchableOpacity 
          style={styles.continueButton} 
          onPress={handleContinue}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={['#7c5cff', '#2dd4db', '#16a34a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.continueGradient}
          >
            <Text style={styles.continueText}>
              {selectedLang === 'ar' ? 'متابعة' : 'Continue'}
            </Text>
            <View style={styles.arrowContainer}>
              <Text style={styles.arrowText}>→</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
        
        {/* Button Glow Effect */}
        <View style={styles.buttonGlow} />
      </Animated.View>

      {/* Footer */}
      <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
        <Text style={styles.footerText}>Powered by Sally Suite</Text>
        <View style={styles.footerDots}>
          <View style={[styles.footerDot, { backgroundColor: '#7c5cff' }]} />
          <View style={[styles.footerDot, { backgroundColor: '#60a5fa' }]} />
          <View style={[styles.footerDot, { backgroundColor: '#f472b6' }]} />
        </View>
      </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  
  // Decorations
  decorations: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 999,
  },
  decorTop: {
    top: -100,
    right: -80,
    width: 250,
    height: 250,
    backgroundColor: 'rgba(124, 92, 255, 0.06)',
  },
  decorBottom: {
    bottom: -120,
    left: -100,
    width: 300,
    height: 300,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  decorMiddle: {
    top: height * 0.4,
    right: -50,
    width: 150,
    height: 150,
    backgroundColor: 'rgba(244, 114, 182, 0.04)',
  },
  
  // Header
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoContainer: {
    marginBottom: 20,
  },
  logoGradient: {
    width: 120,
    height: 120,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#7c5cff',
  },
  logoInner: {
    width: 90,
    height: 90,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(124,92,255,0.3)',
  },
  cornerAccent: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderColor: '#7c5cff',
  },
  cornerTL: {
    top: 6,
    left: 6,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopLeftRadius: 6,
  },
  cornerTR: {
    top: 6,
    right: 6,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderTopRightRadius: 6,
  },
  cornerBL: {
    bottom: 6,
    left: 6,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderBottomLeftRadius: 6,
  },
  cornerBR: {
    bottom: 6,
    right: 6,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderBottomRightRadius: 6,
  },
  emoji: {
    fontSize: 50,
  },
  title: {
    fontSize: 38,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  subtitleBadge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#000',
    fontWeight: '700',
    letterSpacing: 3,
  },
  
  // Language Section
  langSection: {
    marginBottom: 20,
  },
  langTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  langTitleLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  langTitle: {
    fontSize: 13,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 3,
    fontWeight: '600',
  },
  langContainer: {
    gap: 10,
  },
  langButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  langButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  langButtonActive: {
    borderColor: '#7c5cff',
  },
  langFlagContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  langFlag: {
    fontSize: 28,
  },
  langInfo: {
    flex: 1,
  },
  langName: {
    fontSize: 17,
    color: '#94a3b8',
    fontWeight: '600',
  },
  langNameActive: {
    color: '#fff',
  },
  langNative: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  
  // Features
  features: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 20,
    paddingVertical: 20,
    paddingHorizontal: 10,
  },
  featureItem: {
    alignItems: 'center',
    flex: 1,
  },
  featureIconBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  featureIcon: {
    fontSize: 26,
  },
  featureText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 16,
  },
  
  // Button
  buttonContainer: {
    marginTop: 'auto',
    marginBottom: 20,
    position: 'relative',
  },
  continueButton: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#7c5cff',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  continueGradient: {
    flexDirection: 'row',
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    gap: 12,
  },
  continueText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 1,
  },
  arrowContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000',
  },
  buttonGlow: {
    position: 'absolute',
    bottom: -10,
    left: '20%',
    right: '20%',
    height: 20,
    backgroundColor: '#7c5cff',
    borderRadius: 100,
    opacity: 0.2,
  },
  
  // Footer
  footer: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#475569',
    letterSpacing: 1,
    marginBottom: 10,
  },
  footerDots: {
    flexDirection: 'row',
    gap: 6,
  },
  footerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});