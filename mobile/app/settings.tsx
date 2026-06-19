import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { storage, Settings } from '../utils/storage';
import { Language } from '../utils/i18n';
import { useLang } from '../utils/LanguageContext';
import AppModal, { PopupData } from '../components/AppModal';
import BottomNav from '../components/BottomNav';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, setTheme, ThemeName } from '../utils/theme';

const FILE_NAME = '📁 [Settings.tsx]';

export default function SettingsScreen() {
  console.log(`${FILE_NAME} 🚀 Component mounting...`);
  
  const router = useRouter();
  const { t, setLang } = useLang();
  const { name: themeName } = useTheme();
  const [popup, setPopup] = useState<PopupData | null>(null);
  const [settings, setSettings] = useState<Settings>({
    language: 'en', 
    sound: true, 
    music: true, 
    vibration: true, 
    darkMode: true, 
    notifications: true 
  });
  const [loading, setLoading] = useState(true);

  console.log(`${FILE_NAME} 📊 Initial state - settings:`, settings);

  const loadSettings = useCallback(async () => {
    console.log(`${FILE_NAME} ⏳ loadSettings() - Loading settings from storage...`);
    
    try {
      setLoading(true);
      const savedSettings = await storage.getSettings();
      
      console.log(`${FILE_NAME} ✅ loadSettings() - Settings loaded:`, savedSettings);
      setSettings(savedSettings);
    } catch (error) {
      console.error(`${FILE_NAME} ❌ loadSettings() - Error:`, error);
    } finally {
      setLoading(false);
      console.log(`${FILE_NAME} 🏁 loadSettings() - Loading complete`);
    }
  }, []);

  useEffect(() => {
    console.log(`${FILE_NAME} 🔧 useEffect() - Component mounted, loading settings...`);
    loadSettings();
    
    return () => {
      console.log(`${FILE_NAME} 🧹 useEffect() cleanup - Component unmounting...`);
    };
  }, [loadSettings]);

  const handleBack = useCallback(() => {
    console.log(`${FILE_NAME} 🔙 handleBack() - Navigating back...`);
    router.back();
  }, [router]);

  const update = useCallback(async (key: keyof Settings, value: any) => {
    console.log(`${FILE_NAME} 🔄 update() - Updating "${key}" to:`, value);
    
    try {
      if (settings.vibration) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        console.log(`${FILE_NAME} 📳 update() - Haptic feedback triggered`);
      }
    } catch (error) {
      console.log(`${FILE_NAME} ⚠️ update() - Haptics not available`);
    }
    
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    
    console.log(`${FILE_NAME} 💾 update() - Saving new settings...`);
    await storage.setSettings(newSettings);
    console.log(`${FILE_NAME} ✅ update() - Settings saved successfully`);
  }, [settings]);

  const handleLanguageChange = useCallback((langCode: Language) => {
    console.log(`${FILE_NAME} 🌍 handleLanguageChange() - Changing language to: ${langCode}`);
    setLang(langCode);     // propagate to every screen instantly
    update('language', langCode); // keep local state + storage in sync
  }, [update, setLang]);

  const handleThemeChange = useCallback(async (name: ThemeName) => {
    console.log(`${FILE_NAME} 🎨 handleThemeChange() - Changing theme to: ${name}`);
    try {
      if (settings.vibration) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.log(`${FILE_NAME} ⚠️ handleThemeChange() - Haptics not available`);
    }
    // Global switch — setTheme persists to AsyncStorage and live-notifies
    // every useTheme() consumer (including this screen) via the listener Set.
    await setTheme(name);
  }, [settings.vibration]);

  const handleLogout = useCallback(() => {
    console.log(`${FILE_NAME} 🚪 handleLogout() - Logout requested, showing confirmation...`);
    setPopup({
      type: 'error',
      title: t('logout'),
      message: t('logoutConfirm'),
      confirmLabel: t('logout'),
      onConfirm: async () => {
        console.log(`${FILE_NAME} ✅ handleLogout() - Confirmed, clearing session...`);
        await storage.logout();
        router.replace('/login');
      },
    });
  }, [router, t]);

  const handleResetProgress = useCallback(() => {
    console.log(`${FILE_NAME} ⚠️ handleResetProgress() - Reset requested, showing confirmation...`);
    setPopup({
      type: 'error',
      title: t('resetProgress'),
      message: t('resetConfirm'),
      confirmLabel: t('reset'),
      onConfirm: () => {
        console.log(`${FILE_NAME} 🗑️ handleResetProgress() - Confirmed`);
        setPopup({ type: 'success', title: t('success'), message: t('progressReset') });
      },
    });
  }, [t]);

  const handleContactSupport = useCallback(() => {
    console.log(`${FILE_NAME} 📧 handleContactSupport() - Opening support...`);
    Alert.alert('Contact Support', 'Email us at support@sudokusally.com');
  }, []);

  // v3.7.2 — Regional indicator emojis (🇬🇧 🇫🇷 🇲🇦) don't render on Chrome
  // for Linux (the desktop runner that builds the web container and what
  // most ChromeOS / Linux users see). We fall back to a globe glyph + the
  // ISO code so every browser shows something readable.
  const languages: { code: Language; name: string; flag: string }[] = [
    { code: 'en', name: 'English',  flag: '🌐 EN' },
    { code: 'fr', name: 'Français', flag: '🌐 FR' },
    { code: 'ar', name: 'العربية',  flag: '🌐 AR' },
  ];

  const preferences = [
    { key: 'sound', icon: '🔊', label: t('sound'), desc: 'Play sounds during gameplay' },
    { key: 'music', icon: '🎵', label: t('music'), desc: 'Play music while playing' },
    { key: 'vibration', icon: '📳', label: t('vibration'), desc: 'Haptic feedback on actions' },
    { key: 'notifications', icon: '🔔', label: t('notifications'), desc: 'Daily reminders & updates' },
  ];

  const themes: { name: ThemeName; icon: string; label: string }[] = [
    { name: 'midnight',   icon: '🌙', label: t('themeMidnight') },
    { name: 'atlas-gold', icon: '🪙', label: t('themeAtlasGold') },
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
          <Text style={styles.titleIcon}>⚙️</Text>
          <Text style={styles.title}>{t('settings')}</Text>
        </View>
        
        <View style={{ width: 44 }} />
      </View>
      
      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Language Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>🌍</Text>
            <Text style={styles.sectionTitle}>{t('language')}</Text>
          </View>
          
          <View style={styles.languageCard}>
            <LinearGradient
              colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
              style={styles.languageGradient}
            >
              <View style={styles.langRow}>
                {languages.map((lang) => {
                  const isSelected = settings.language === lang.code;
                  console.log(`${FILE_NAME} 🏳️ Rendering language: ${lang.code} (selected: ${isSelected})`);
                  
                  return (
                    <TouchableOpacity 
                      key={lang.code} 
                      style={[styles.langBtn, isSelected && styles.langBtnActive]} 
                      onPress={() => handleLanguageChange(lang.code)}
                      activeOpacity={0.7}
                    >
                      {isSelected && (
                        <LinearGradient
                          colors={['rgba(74,222,128,0.2)', 'rgba(74,222,128,0.05)']}
                          style={styles.langBtnGradient}
                        />
                      )}
                      <Text style={styles.langFlag}>{lang.flag}</Text>
                      <Text
                        style={[styles.langText, isSelected && styles.langTextActive]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                      >
                        {lang.name}
                      </Text>
                      {isSelected && (
                        <View style={styles.langCheck}>
                          <Text style={styles.langCheckText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </LinearGradient>
          </View>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>🎛️</Text>
            <Text style={styles.sectionTitle}>Preferences</Text>
          </View>
          
          <View style={styles.preferencesCard}>
            {preferences.map((item, index) => {
              const isEnabled = settings[item.key as keyof Settings] as boolean;
              console.log(`${FILE_NAME} ⚙️ Rendering preference: ${item.key} = ${isEnabled}`);
              
              return (
                <View key={item.key}>
                  <View style={styles.prefRow}>
                    <View style={[styles.prefIconContainer, isEnabled && styles.prefIconActive]}>
                      <Text style={styles.prefIcon}>{item.icon}</Text>
                    </View>
                    <View style={styles.prefInfo}>
                      <Text style={styles.prefLabel}>{item.label}</Text>
                      <Text style={styles.prefDesc}>{item.desc}</Text>
                    </View>
                    <Switch 
                      value={isEnabled} 
                      onValueChange={(v) => update(item.key as keyof Settings, v)} 
                      trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(74,222,128,0.4)' }}
                      thumbColor={isEnabled ? '#4ade80' : '#64748b'}
                      ios_backgroundColor="rgba(255,255,255,0.1)"
                    />
                  </View>
                  {index < preferences.length - 1 && <View style={styles.prefDivider} />}
                </View>
              );
            })}
          </View>
        </View>

        {/* Appearance Section — real palette switcher (Midnight / Atlas Gold) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>🎨</Text>
            <Text style={styles.sectionTitle}>{t('theme')}</Text>
          </View>

          <View style={styles.appearanceCard}>
            <LinearGradient
              colors={['rgba(139,92,246,0.1)', 'rgba(139,92,246,0.02)']}
              style={styles.appearanceGradient}
            >
              <View style={styles.langRow}>
                {themes.map((theme) => {
                  const isSelected = themeName === theme.name;
                  console.log(`${FILE_NAME} 🎨 Rendering theme: ${theme.name} (selected: ${isSelected})`);

                  return (
                    <TouchableOpacity
                      key={theme.name}
                      style={[styles.langBtn, isSelected && styles.themeBtnActive]}
                      onPress={() => handleThemeChange(theme.name)}
                      activeOpacity={0.7}
                    >
                      {isSelected && (
                        <LinearGradient
                          colors={['rgba(139,92,246,0.25)', 'rgba(139,92,246,0.05)']}
                          style={styles.langBtnGradient}
                        />
                      )}
                      <Text style={styles.langFlag}>{theme.icon}</Text>
                      <Text
                        style={[styles.langText, isSelected && styles.themeTextActive]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                      >
                        {theme.label}
                      </Text>
                      {isSelected && (
                        <View style={styles.themeCheck}>
                          <Text style={styles.langCheckText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </LinearGradient>
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>👤</Text>
            <Text style={styles.sectionTitle}>Account</Text>
          </View>
          
          <View style={styles.accountCard}>
            <TouchableOpacity 
              style={styles.accountRow}
              onPress={() => router.push('/profile')}
              activeOpacity={0.7}
            >
              <View style={styles.accountIconContainer}>
                <Text style={styles.accountIcon}>👤</Text>
              </View>
              <View style={styles.accountInfo}>
                <Text style={styles.accountLabel}>Edit Profile</Text>
                <Text style={styles.accountDesc}>Change avatar, username</Text>
              </View>
              <Text style={styles.accountArrow}>→</Text>
            </TouchableOpacity>
            
            <View style={styles.accountDivider} />
            
            <TouchableOpacity 
              style={styles.accountRow}
              onPress={handleContactSupport}
              activeOpacity={0.7}
            >
              <View style={styles.accountIconContainer}>
                <Text style={styles.accountIcon}>📧</Text>
              </View>
              <View style={styles.accountInfo}>
                <Text style={styles.accountLabel}>Contact Support</Text>
                <Text style={styles.accountDesc}>Get help with issues</Text>
              </View>
              <Text style={styles.accountArrow}>→</Text>
            </TouchableOpacity>
            
            <View style={styles.accountDivider} />
            
            <TouchableOpacity
              style={styles.accountRow}
              onPress={() => router.push('/privacy' as any)}
              activeOpacity={0.7}
            >
              <View style={styles.accountIconContainer}>
                <Text style={styles.accountIcon}>🔒</Text>
              </View>
              <View style={styles.accountInfo}>
                <Text style={styles.accountLabel}>Privacy Policy</Text>
                <Text style={styles.accountDesc}>How we handle your data</Text>
              </View>
              <Text style={styles.accountArrow}>→</Text>
            </TouchableOpacity>

            <View style={styles.accountDivider} />

            <TouchableOpacity
              style={styles.accountRow}
              onPress={() => router.push('/terms' as any)}
              activeOpacity={0.7}
            >
              <View style={styles.accountIconContainer}>
                <Text style={styles.accountIcon}>📄</Text>
              </View>
              <View style={styles.accountInfo}>
                <Text style={styles.accountLabel}>Terms of Service</Text>
                <Text style={styles.accountDesc}>The rules for using SallySudo</Text>
              </View>
              <Text style={styles.accountArrow}>→</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>⚠️</Text>
            <Text style={[styles.sectionTitle, styles.sectionTitleDanger]}>Danger Zone</Text>
          </View>
          
          <View style={styles.dangerCard}>
            <TouchableOpacity 
              style={styles.dangerRow}
              onPress={handleResetProgress}
              activeOpacity={0.7}
            >
              <View style={[styles.accountIconContainer, styles.dangerIconContainer]}>
                <Text style={styles.accountIcon}>🗑️</Text>
              </View>
              <View style={styles.accountInfo}>
                <Text style={styles.dangerLabel}>Reset Progress</Text>
                <Text style={styles.dangerDesc}>Delete all game data</Text>
              </View>
            </TouchableOpacity>
            
            <View style={styles.dangerDivider} />
            
            <TouchableOpacity
              style={styles.dangerRow}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <View style={[styles.accountIconContainer, styles.dangerIconContainer]}>
                <Text style={styles.accountIcon}>🚪</Text>
              </View>
              <View style={styles.accountInfo}>
                <Text style={styles.dangerLabel}>{t('logout')}</Text>
                <Text style={styles.dangerDesc}>Sign out of your account</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.dangerDivider} />

            {/* v3.5 — RGPD / Play Data Safety: a one-tap "delete my account"
                action is now required by Google Play. Confirms with a popup,
                then DELETE /api/users/:id, clears local storage, sends the
                user back to /welcome. */}
            <TouchableOpacity
              style={styles.dangerRow}
              activeOpacity={0.7}
              onPress={() => {
                setPopup({
                  type: 'error', title: 'Delete account?',
                  message: 'This permanently erases your username, email, stats, games and achievements from our server. This action cannot be undone.',
                  onConfirm: async () => {
                    try {
                      const token = await AsyncStorage.getItem('sudoku_token');
                      const userStr = await AsyncStorage.getItem('sudoku_user');
                      const u = userStr ? JSON.parse(userStr) : null;
                      if (u?.id && token) {
                        await fetch(`https://api.sallysudo.com/api/users/${u.id}`, {
                          method: 'DELETE',
                          headers: { Authorization: `Bearer ${token}` },
                        });
                      }
                    } catch (e) { console.log('[settings] delete account err', e); }
                    await AsyncStorage.multiRemove(['sudoku_token', 'sudoku_auth_token', 'sudoku_user']);
                    router.replace('/welcome');
                  },
                });
              }}
            >
              <View style={[styles.accountIconContainer, styles.dangerIconContainer]}>
                <Text style={styles.accountIcon}>🗑️</Text>
              </View>
              <View style={styles.accountInfo}>
                <Text style={styles.dangerLabel}>Delete my account</Text>
                <Text style={styles.dangerDesc}>Permanently erase your data (RGPD / Play data safety)</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appLogo}>🧩</Text>
          <Text style={styles.appName}>SallySudo</Text>
          <Text style={styles.appVersion}>Version 3.5.0</Text>
          <Text style={styles.appCopyright}>© 2026 Sally Suite</Text>
        </View>

        {/* Bottom spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>

      <AppModal
        popup={popup}
        onClose={() => setPopup(null)}
        buttonLabel={popup?.confirmLabel ? t('cancel') : t('ok')}
      />
          <BottomNav active="settings" />
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
  
  // Content
  content: {
    paddingHorizontal: 20,
  },
  
  // Section
  section: { 
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionIcon: {
    fontSize: 18,
  },
  sectionTitle: { 
    color: '#94a3b8', 
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionTitleDanger: {
    color: '#ef4444',
  },
  
  // Language
  languageCard: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  languageGradient: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  langRow: { 
    flexDirection: 'row', 
    gap: 10,
  },
  langBtn: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 6,        // narrower so "English" / "Français" / "العربية" never wrap
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
    overflow: 'hidden',
    minWidth: 0,                  // allow flex children to shrink past intrinsic content
  },
  langBtnActive: { 
    borderColor: '#4ade80',
  },
  langBtnGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  langFlag: {
    fontSize: 28,
    marginBottom: 8,
  },
  langText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  langTextActive: {
    color: '#4ade80',
  },
  langCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4ade80',
    justifyContent: 'center',
    alignItems: 'center',
  },
  langCheckText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '800',
  },
  
  // Preferences
  preferencesCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  prefRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 14,
  },
  prefIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  prefIconActive: {
    backgroundColor: 'rgba(74,222,128,0.15)',
  },
  prefIconPurple: {
    backgroundColor: 'rgba(139,92,246,0.15)',
  },
  prefIcon: { 
    fontSize: 20,
  },
  prefInfo: {
    flex: 1,
  },
  prefLabel: { 
    color: '#fff', 
    fontSize: 16,
    fontWeight: '600',
  },
  prefDesc: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  prefDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 14,
  },
  
  // Appearance
  appearanceCard: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  appearanceGradient: {
    padding: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.2)',
  },
  lockedBadge: {
    backgroundColor: 'rgba(139,92,246,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  lockedBadgeText: {
    color: '#a78bfa',
    fontSize: 12,
    fontWeight: '700',
  },
  // Theme (palette) switcher — purple-accented variant of the language pills
  themeBtnActive: {
    borderColor: '#a78bfa',
  },
  themeTextActive: {
    color: '#a78bfa',
  },
  themeCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#a78bfa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Account
  accountCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  accountIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(59,130,246,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  accountIcon: {
    fontSize: 20,
  },
  accountInfo: {
    flex: 1,
  },
  accountLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  accountDesc: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  accountArrow: {
    color: '#64748b',
    fontSize: 18,
  },
  accountDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 14,
  },
  
  // Danger Zone
  dangerCard: {
    backgroundColor: 'rgba(239,68,68,0.05)',
    borderRadius: 20,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  dangerIconContainer: {
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  dangerLabel: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
  dangerDesc: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  dangerDivider: {
    height: 1,
    backgroundColor: 'rgba(239,68,68,0.1)',
    marginHorizontal: 14,
  },
  
  // App Info
  appInfo: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  appLogo: {
    fontSize: 40,
    marginBottom: 8,
  },
  appName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  appVersion: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 4,
  },
  appCopyright: {
    color: '#475569',
    fontSize: 12,
    marginTop: 8,
  },
});