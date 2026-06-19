import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { storage, TEST_USERS } from '../utils/storage';
import { useLang } from '../utils/LanguageContext';
import AppModal, { PopupData } from '../components/AppModal';
import * as Haptics from 'expo-haptics';
import { signInWithGoogle } from '../utils/googleAuth';
import { storage as storageFull } from '../utils/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SallyMascot from '../components/SallyMascot';

const FILE_NAME = '📁 [Login.tsx]';

export default function Login() {
  console.log(`${FILE_NAME} 🚀 Component mounting...`);
  
  const router = useRouter();
  const { t } = useLang();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState<'email' | 'password' | null>(null);
  // v3.10.3 — desktop reflow
  const { width: winW } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && winW >= 1024;
  const [popup, setPopup] = useState<PopupData | null>(null);

  console.log(`${FILE_NAME} 📊 Initial state - email: "${email ? '***' : 'empty'}", loading: ${loading}`);

  const handleGoogle = useCallback(async () => {
    console.log(`${FILE_NAME} 🔵 handleGoogle() - Google sign-in tapped`);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    const res = await signInWithGoogle();
    console.log(`${FILE_NAME} 🔵 handleGoogle() - result:`, JSON.stringify(res));

    if (res.ok && res.appToken && res.user) {
      // Store the REAL session under both keys (KEYS.AUTH_TOKEN for isLoggedIn,
      // 'sudoku_token' for socket.ts) and persist the user record so home/profile
      // show "name + picture" instead of a Guest_ stub.
      const u = res.user;
      const localUser = {
        id: u.id || u._id, username: u.username, email: u.email,
        avatar: u.avatar || '🎮', level: u.level ?? 1, xp: u.xp ?? 0,
        coins: u.coins ?? 100, stars: u.stars ?? 0,
        createdAt: u.createdAt || new Date().toISOString(),
      };
      await storage.setUser(localUser as any);
      await AsyncStorage.setItem('sudoku_token', res.appToken);
      await AsyncStorage.setItem('sudoku_auth_token', res.appToken);
      router.replace('/home');
      return;
    }
    if (res.ok && !res.appToken) {
      // Native sign-in succeeded but we couldn't exchange for our JWT — show the error.
      setPopup({ type: 'error', title: 'Google sign-in', message: res.error || 'Could not link the Google account to a SallySudo account.' });
      return;
    }

    switch (res.code) {
      case 'CANCELLED':
        // User dismissed the picker — no popup, silent.
        break;
      case 'EXPO_GO':
      case 'NO_MODULE':
        setPopup({ type: 'info', title: 'Google', message: t('googleNotConfigured') });
        break;
      case 'PLAY_SERVICES':
        setPopup({ type: 'error', title: 'Google', message: t('googlePlayServices') });
        break;
      case 'DEVELOPER_ERROR':
        setPopup({ type: 'error', title: 'Google', message: t('googleDevError') });
        break;
      default:
        setPopup({
          type: 'error',
          title: t('googleSignInFailed'),
          message: res.error || 'Unknown error',
        });
    }
  }, [t, router]);

  const handleBack = useCallback(() => {
    console.log(`${FILE_NAME} 🔙 handleBack() - Navigating back...`);
    router.back();
  }, [router]);

  const handleEmailChange = useCallback((text: string) => {
    console.log(`${FILE_NAME} ✏️ handleEmailChange() - Email updated (length: ${text.length})`);
    setEmail(text);
  }, []);

  const handlePasswordChange = useCallback((text: string) => {
    console.log(`${FILE_NAME} ✏️ handlePasswordChange() - Password updated (length: ${text.length})`);
    setPassword(text);
  }, []);

  const toggleShowPassword = useCallback(() => {
    console.log(`${FILE_NAME} 👁️ toggleShowPassword() - Show password: ${!showPassword}`);
    setShowPassword(prev => !prev);
  }, [showPassword]);

  /** One-click login for the demo accounts (idriss1 / idriss2). */
  const quickLogin = useCallback(async (label: string, mail: string, pwd: string) => {
    setLoading(true);
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    await new Promise(r => setTimeout(r, 200));
    const user = await storage.login(mail, pwd);
    setLoading(false);
    if (user) {
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      router.replace('/home');
    } else {
      setPopup({ type: 'error', title: t('error'), message: `Login failed for ${label}.\n${mail}` });
    }
  }, [router, t]);

  const handleLogin = useCallback(async () => {
    console.log(`${FILE_NAME} 🔐 handleLogin() - Login attempt started`);
    console.log(`${FILE_NAME} 📧 handleLogin() - Email: ${email}`);
    
    if (!email || !password) {
      console.log(`${FILE_NAME} ⚠️ handleLogin() - Validation failed: missing fields`);
      setPopup({ type: 'error', title: t('error'), message: t('fillAllFields') });
      return;
    }

    setLoading(true);
    console.log(`${FILE_NAME} ⏳ handleLogin() - Loading state: true`);
    
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      console.log(`${FILE_NAME} 📳 handleLogin() - Haptic feedback triggered`);
    } catch (error) {
      console.log(`${FILE_NAME} ⚠️ handleLogin() - Haptics not available`);
    }

    // Simulate network delay
    console.log(`${FILE_NAME} 🌐 handleLogin() - Simulating network delay (800ms)...`);
    await new Promise(resolve => setTimeout(resolve, 800));

    console.log(`${FILE_NAME} 🔍 handleLogin() - Attempting authentication...`);
    const user = await storage.login(email, password);
    setLoading(false);
    console.log(`${FILE_NAME} ⏳ handleLogin() - Loading state: false`);

    if (user) {
      console.log(`${FILE_NAME} ✅ handleLogin() - Login successful! User: ${user.username}`);
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error) {
        console.log(`${FILE_NAME} ⚠️ handleLogin() - Haptics not available`);
      }
      console.log(`${FILE_NAME} 🏠 handleLogin() - Navigating to home...`);
      router.replace('/home');
    } else {
      console.log(`${FILE_NAME} ❌ handleLogin() - Login failed: Invalid credentials`);
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch (error) {
        console.log(`${FILE_NAME} ⚠️ handleLogin() - Haptics not available`);
      }
      setPopup({ type: 'error', title: t('error'), message: `${t('invalidCredentials')}\n\ntest@test.com / test123` });
    }
  }, [email, password, t, router]);

  const handleGuest = useCallback(async () => {
    console.log(`${FILE_NAME} 👤 handleGuest() - Guest login requested`);
    
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      console.log(`${FILE_NAME} 📳 handleGuest() - Haptic feedback triggered`);
    } catch (error) {
      console.log(`${FILE_NAME} ⚠️ handleGuest() - Haptics not available`);
    }
    
    console.log(`${FILE_NAME} 🔓 handleGuest() - Creating guest session...`);
    await storage.loginAsGuest();
    
    console.log(`${FILE_NAME} ✅ handleGuest() - Guest login successful, navigating to home...`);
    router.replace('/home');
  }, [router]);

  const handleRegister = useCallback(() => {
    console.log(`${FILE_NAME} 📝 handleRegister() - Navigating to register screen...`);
    router.push('/register');
  }, [router]);

  const handleForgotPassword = useCallback(() => {
    console.log(`${FILE_NAME} 🔑 handleForgotPassword() - Forgot password tapped`);
    setPopup({ type: 'info', title: t('resetPassword'), message: t('resetPasswordSoon') });
  }, [t]);

  console.log(`${FILE_NAME} 🖼️ Rendering main component...`);

  // v3.10.3 — desktop: drop the keyboard-avoiding shell (no virtual keyboard
  // on web) and center the form in a 480 px column inside WebShell.
  const FormShell: any = isDesktopWeb ? View : KeyboardAvoidingView;
  const formShellProps: any = isDesktopWeb
    ? { style: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 32 } }
    : { behavior: Platform.OS === 'ios' ? 'padding' : 'height', style: styles.keyboardView };
  const ContentShell: any = isDesktopWeb ? View : ScrollView;
  const contentShellProps: any = isDesktopWeb
    ? { style: { width: '100%', maxWidth: 480 } as any }
    : { contentContainerStyle: styles.scrollContent, showsVerticalScrollIndicator: false, keyboardShouldPersistTaps: 'handled' };

  return (
    <LinearGradient colors={['#0a0a1a', '#1a1a3a', '#0f0f2a']} style={styles.container}>
      <FormShell {...formShellProps}>
        <ContentShell {...contentShellProps}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back Button */}
          <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
            <LinearGradient
              colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
              style={styles.backButtonGradient}
            >
              <Text style={styles.backIcon}>←</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={['rgba(124,92,255,0.2)', 'rgba(124,92,255,0.05)']}
                style={styles.logoGradient}
              >
                {/* v3.6 — was 🔐 emoji; replaced with Sally for brand consistency */}
                <SallyMascot size={90} mode="default" />
              </LinearGradient>
              <View style={styles.logoGlow} />
            </View>
            <Text style={styles.title}>{t('login')}</Text>
            <Text style={styles.subtitle}>{t('welcomeSubtitle')}</Text>
          </View>

          {/* ── Demo accounts: 1-tap login (real users in the DB) ── */}
          <View style={styles.demoBox}>
            <Text style={styles.demoHint}>One-tap demo · play 1v1 across web ↔ mobile:</Text>
            <View style={styles.demoRow}>
              <TouchableOpacity
                style={[styles.demoTab, styles.demoTabA]}
                onPress={() => quickLogin('idriss1', 'idriss1@sudoku.local', 'Sally-idriss-2026!')}
                activeOpacity={0.85}
                disabled={loading}
              >
                <Text style={styles.demoAvatar}>🧑‍💻</Text>
                <Text style={styles.demoName}>idriss1</Text>
                <Text style={styles.demoSub}>Sign in</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.demoTab, styles.demoTabB]}
                onPress={() => quickLogin('idriss2', 'idriss2@sudoku.local', 'Sally-idriss-2026!')}
                activeOpacity={0.85}
                disabled={loading}
              >
                <Text style={styles.demoAvatar}>🧑‍🎮</Text>
                <Text style={styles.demoName}>idriss2</Text>
                <Text style={styles.demoSub}>Sign in</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.demoTab, styles.demoTabC]}
                onPress={() => quickLogin('idrissmobile', 'idrissmobile@sudoku.local', 'Sally-idriss-2026!')}
                activeOpacity={0.85}
                disabled={loading}
              >
                <Text style={styles.demoAvatar}>📱</Text>
                <Text style={styles.demoName}>idrissmobile</Text>
                <Text style={styles.demoSub}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{t('email')}</Text>
              <View style={[
                styles.inputWrapper,
                focusedInput === 'email' && styles.inputWrapperFocused,
              ]}>
                <Text style={styles.inputIcon}>📧</Text>
                <TextInput
                  style={styles.input}
                  placeholder="test@test.com"
                  placeholderTextColor="#475569"
                  value={email}
                  onChangeText={handleEmailChange}
                  onFocus={() => setFocusedInput('email')}
                  onBlur={() => setFocusedInput(null)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {email.length > 0 && (
                  <TouchableOpacity onPress={() => setEmail('')} style={styles.clearButton}>
                    <Text style={styles.clearButtonText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{t('password')}</Text>
              <View style={[
                styles.inputWrapper,
                focusedInput === 'password' && styles.inputWrapperFocused,
              ]}>
                <Text style={styles.inputIcon}>🔑</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#475569"
                  value={password}
                  onChangeText={handlePasswordChange}
                  onFocus={() => setFocusedInput('password')}
                  onBlur={() => setFocusedInput(null)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={toggleShowPassword} style={styles.showPasswordButton}>
                  <Text style={styles.showPasswordText}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot Password */}
            <TouchableOpacity onPress={handleForgotPassword} activeOpacity={0.7}>
              <Text style={styles.forgotPassword}>{t('forgotPassword')}</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity 
              style={[styles.loginButton, loading && styles.loginButtonDisabled]} 
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={loading ? ['#64748b', '#475569'] : ['#7c5cff', '#2dd4db']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.loginGradient}
              >
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <Text style={styles.loadingDots}>●●●</Text>
                    <Text style={styles.loginText}>{t('loading')}</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.loginIcon}>🚀</Text>
                    <Text style={styles.loginText}>{t('login')}</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <View style={styles.dividerTextContainer}>
                <Text style={styles.dividerText}>OR</Text>
              </View>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign-In */}
            <TouchableOpacity style={styles.googleButton} onPress={handleGoogle} activeOpacity={0.9}>
              <View style={styles.googleLogo}>
                <Text style={styles.googleBlue}>G</Text>
              </View>
              <Text style={styles.googleText}>{t('continueWithGoogle')}</Text>
            </TouchableOpacity>

            {/* Guest Button */}
            <TouchableOpacity style={styles.guestButton} onPress={handleGuest} activeOpacity={0.8}>
              <LinearGradient
                colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']}
                style={styles.guestGradient}
              >
                <Text style={styles.guestIcon}>👤</Text>
                <Text style={styles.guestText}>{t('guest')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Register Link */}
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>{t('noAccount')} </Text>
            <TouchableOpacity onPress={handleRegister} activeOpacity={0.7}>
              <Text style={styles.registerLink}>{t('register')}</Text>
            </TouchableOpacity>
          </View>

          {/* Test Account Info */}
          <View style={styles.testInfo}>
            <LinearGradient
              colors={['rgba(251, 191, 36, 0.12)', 'rgba(251, 191, 36, 0.04)']}
              style={styles.testInfoGradient}
            >
              <View style={styles.testHeader}>
                <Text style={styles.testIcon}>🧪</Text>
                <Text style={styles.testTitle}>{t('testAccount')}</Text>
              </View>
              <View style={styles.testCredentials}>
                <View style={styles.testRow}>
                  <Text style={styles.testLabel}>Email:</Text>
                  <Text style={styles.testValue}>test@test.com</Text>
                </View>
                <View style={styles.testRow}>
                  <Text style={styles.testLabel}>Password:</Text>
                  <Text style={styles.testValue}>test123</Text>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.autofillButton}
                onPress={() => {
                  console.log(`${FILE_NAME} 🔄 Autofill test credentials`);
                  setEmail('test@test.com');
                  setPassword('test123');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.autofillText}>{t('tapToAutofill')}</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>

          {/* Bottom spacing */}
          <View style={{ height: 40 }} />
        </ContentShell>
      </FormShell>

      <AppModal popup={popup} onClose={() => setPopup(null)} buttonLabel={t('ok')} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 60,
  },
  
  // Back Button
  backButton: {
    width: 44,
    height: 44,
    marginBottom: 20,
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
  
  // Header
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  logoGradient: {
    width: 100,
    height: 100,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(124,92,255,0.3)',
  },
  logoGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(124,92,255,0.1)',
    top: -10,
    left: -10,
  },
  emoji: {
    fontSize: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
    marginTop: 10,
    textAlign: 'center',
  },
  
  // Form
  form: {
    gap: 18,
  },
  inputContainer: {
    gap: 8,
  },
  inputLabel: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  inputWrapperFocused: {
    borderColor: 'rgba(124,92,255,0.5)',
    backgroundColor: 'rgba(124,92,255,0.05)',
  },
  inputIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#fff',
  },
  clearButton: {
    padding: 8,
  },
  clearButtonText: {
    color: '#64748b',
    fontSize: 14,
  },
  showPasswordButton: {
    padding: 8,
  },
  showPasswordText: {
    fontSize: 18,
  },
  
  // Forgot Password
  forgotPassword: {
    color: '#7c5cff',
    fontSize: 14,
    textAlign: 'right',
    fontWeight: '600',
  },
  
  // Login Button
  loginButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: '#7c5cff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  loginButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  loginGradient: {
    flexDirection: 'row',
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    gap: 10,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingDots: {
    color: '#fff',
    fontSize: 12,
    letterSpacing: 2,
  },
  loginIcon: {
    fontSize: 20,
  },
  loginText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  
  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dividerTextContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    marginHorizontal: 12,
  },
  dividerText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Google Button
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  googleLogo: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  googleBlue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#4285F4',
  },
  googleText: {
    color: '#1f2937',
    fontSize: 16,
    fontWeight: '700',
  },
  
  // Guest Button
  guestButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  guestGradient: {
    flexDirection: 'row',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 10,
  },
  guestIcon: {
    fontSize: 20,
  },
  guestText: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '600',
  },
  
  // Register Link
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 28,
  },
  registerText: {
    color: '#64748b',
    fontSize: 15,
  },
  registerLink: {
    color: '#7c5cff',
    fontSize: 15,
    fontWeight: '700',
  },
  
  // Test Info
  testInfo: {
    marginTop: 28,
    borderRadius: 20,
    overflow: 'hidden',
  },
  testInfoGradient: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.25)',
  },
  testHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  testIcon: {
    fontSize: 20,
  },
  testTitle: {
    color: '#fbbf24',
    fontSize: 16,
    fontWeight: '700',
  },
  testCredentials: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  testRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  testLabel: {
    color: '#94a3b8',
    fontSize: 13,
  },
  testValue: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  autofillButton: {
    marginTop: 14,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  autofillText: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Demo accounts (idriss1 / idriss2) — one-tap sign in ──
  demoBox: { marginBottom: 18 },
  demoHint: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  demoRow: { flexDirection: 'row', gap: 8 },
  demoTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  demoTabA: { borderColor: 'rgba(124,92,255,0.5)', backgroundColor: 'rgba(124,92,255,0.08)' },
  demoTabB: { borderColor: 'rgba(96,165,250,0.5)', backgroundColor: 'rgba(96,165,250,0.08)' },
  demoTabC: { borderColor: 'rgba(251,191,36,0.5)', backgroundColor: 'rgba(251,191,36,0.08)' },
  demoAvatar: { fontSize: 24 },
  demoName: { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 4 },
  demoSub: { color: '#94a3b8', fontSize: 10, marginTop: 2, fontWeight: '600', letterSpacing: 0.5 },
});