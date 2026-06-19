import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, useWindowDimensions, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { storage, User } from '../utils/storage';
import { useLang } from '../utils/LanguageContext';
import AppModal, { PopupData } from '../components/AppModal';
import * as Haptics from 'expo-haptics';
import SallyMascot from '../components/SallyMascot';

const FILE_NAME = '📁 [Register.tsx]';

export default function Register() {
  console.log(`${FILE_NAME} 🚀 Component mounting...`);
  
  const router = useRouter();
  const { t } = useLang();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  // v3.10.3 — desktop reflow
  const { width: winW } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && winW >= 1024;
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [popup, setPopup] = useState<PopupData | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState(false);

  console.log(`${FILE_NAME} 📊 Initial state - username: "${username}", email: "${email ? '***' : 'empty'}", loading: ${loading}`);

  const handleBack = useCallback(() => {
    console.log(`${FILE_NAME} 🔙 handleBack() - Navigating back...`);
    router.back();
  }, [router]);

  const validateEmail = useCallback((email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(email);
    console.log(`${FILE_NAME} 📧 validateEmail() - Email "${email}" is ${isValid ? 'valid' : 'invalid'}`);
    return isValid;
  }, []);

  const getPasswordStrength = useCallback((password: string): { strength: number; label: string; color: string } => {
    let strength = 0;
    if (password.length >= 4) strength++;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    const labels = [t('veryWeak'), t('weak'), t('fair'), t('good'), t('strong')];
    const colors = ['#ef4444', '#f97316', '#fbbf24', '#7c5cff', '#2dd4db'];
    
    const result = {
      strength,
      label: labels[Math.min(strength, 4)],
      color: colors[Math.min(strength, 4)],
    };
    
    console.log(`${FILE_NAME} 🔐 getPasswordStrength() - Strength: ${strength}/5 (${result.label})`);
    return result;
  }, [t]);

  const handleRegister = useCallback(async () => {
    console.log(`${FILE_NAME} 📝 handleRegister() - Registration attempt started`);
    console.log(`${FILE_NAME} 📋 handleRegister() - Username: "${username}", Email: "${email}"`);
    
    // Validation
    if (!username || !email || !password || !confirmPassword) {
      console.log(`${FILE_NAME} ⚠️ handleRegister() - Validation failed: missing fields`);
      setPopup({ type: 'error', title: t('error'), message: t('fillAllFields') });
      return;
    }

    if (username.length < 3) {
      console.log(`${FILE_NAME} ⚠️ handleRegister() - Validation failed: username too short`);
      setPopup({ type: 'error', title: t('error'), message: t('usernameMin') });
      return;
    }

    if (!validateEmail(email)) {
      console.log(`${FILE_NAME} ⚠️ handleRegister() - Validation failed: invalid email`);
      setPopup({ type: 'error', title: t('error'), message: t('validEmail') });
      return;
    }

    if (password !== confirmPassword) {
      console.log(`${FILE_NAME} ⚠️ handleRegister() - Validation failed: passwords don't match`);
      setPopup({ type: 'error', title: t('error'), message: t('passwordsNoMatch') });
      return;
    }

    if (password.length < 4) {
      console.log(`${FILE_NAME} ⚠️ handleRegister() - Validation failed: password too short`);
      setPopup({ type: 'error', title: t('error'), message: t('passwordMin') });
      return;
    }

    if (!acceptedTerms) {
      console.log(`${FILE_NAME} ⚠️ handleRegister() - Validation failed: terms not accepted`);
      setPopup({ type: 'error', title: t('error'), message: t('acceptTerms') });
      return;
    }

    console.log(`${FILE_NAME} ✅ handleRegister() - All validations passed`);

    setLoading(true);
    console.log(`${FILE_NAME} ⏳ handleRegister() - Loading state: true`);
    
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      console.log(`${FILE_NAME} 📳 handleRegister() - Haptic feedback triggered`);
    } catch (error) {
      console.log(`${FILE_NAME} ⚠️ handleRegister() - Haptics not available`);
    }

    // Simulate network delay
    console.log(`${FILE_NAME} 🌐 handleRegister() - Simulating network delay (1s)...`);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create new user
    console.log(`${FILE_NAME} 👤 handleRegister() - Creating new user...`);
    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      username,
      email,
      avatar: '🎮',
      level: 1,
      xp: 0,
      coins: 100,
      stars: 0,
      createdAt: new Date().toISOString(),
    };

    console.log(`${FILE_NAME} 💾 handleRegister() - Saving user to storage...`);
    await storage.setUser(newUser);
    setLoading(false);
    console.log(`${FILE_NAME} ⏳ handleRegister() - Loading state: false`);
    
    console.log(`${FILE_NAME} ✅ handleRegister() - Registration successful! User ID: ${newUser.id}`);
    
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.log(`${FILE_NAME} ⚠️ handleRegister() - Haptics not available`);
    }
    
    setRegisterSuccess(true);
    setPopup({ type: 'success', title: t('success'), message: t('accountCreated') });
  }, [username, email, password, confirmPassword, acceptedTerms, t, router, validateEmail]);

  const closePopup = useCallback(() => {
    setPopup(null);
    if (registerSuccess) {
      console.log(`${FILE_NAME} 🏠 closePopup() - Navigating to home...`);
      setRegisterSuccess(false);
      router.replace('/home');
    }
  }, [registerSuccess, router]);

  const handleLogin = useCallback(() => {
    console.log(`${FILE_NAME} 🔑 handleLogin() - Navigating to login screen...`);
    router.back();
  }, [router]);

  const passwordStrength = getPasswordStrength(password);
  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

  console.log(`${FILE_NAME} 🖼️ Rendering main component...`);

  // v3.10.3 — desktop: drop KeyboardAvoidingView and center the form.
  const FormShell: any = isDesktopWeb ? View : KeyboardAvoidingView;
  const formShellProps: any = isDesktopWeb
    ? { style: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 32 } }
    : { behavior: Platform.OS === 'ios' ? 'padding' : 'height', style: styles.keyboardView };
  const ContentShell: any = isDesktopWeb ? View : ScrollView;
  const contentShellProps: any = isDesktopWeb
    ? { style: { width: '100%', maxWidth: 520 } as any }
    : { contentContainerStyle: styles.scrollContent, showsVerticalScrollIndicator: false, keyboardShouldPersistTaps: 'handled' };

  // v3.11 — desktop web: aurora hero image panel beside the form (right column).
  const HeroPanel = () => (
    <View style={styles.heroPanel}>
      <LinearGradient
        colors={['#7c5cff', '#5b8def', '#2dd4db']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroGlow}
      >
        <View style={styles.heroInner}>
          <Image
            source={{ uri: '/hero-profile.png' }}
            style={styles.heroImage}
            resizeMode="cover"
          />
        </View>
      </LinearGradient>
      <Text style={styles.heroTagline}>
        Create your profile and challenge anyone, anywhere.
      </Text>
    </View>
  );

  return (
    <LinearGradient colors={['#0a0a1a', '#1a1a3a', '#0f0f2a']} style={styles.container}>
      <View style={isDesktopWeb ? styles.desktopRow : undefined}>
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
                colors={['rgba(59,130,246,0.2)', 'rgba(59,130,246,0.05)']}
                style={styles.logoGradient}
              >
                <SallyMascot size={90} mode="thinking" />{/* v3.6 — was 📝 emoji */}
              </LinearGradient>
              <View style={styles.logoGlow} />
            </View>
            <Text style={styles.title}>{t('createAccount')}</Text>
            <Text style={styles.subtitle}>{t('joinEnthusiasts')}</Text>
          </View>

          {/* Progress Steps */}
          <View style={styles.progressSteps}>
            <View style={[styles.step, username.length >= 3 && styles.stepComplete]}>
              <Text style={styles.stepText}>1</Text>
            </View>
            <View style={[styles.stepLine, username.length >= 3 && styles.stepLineComplete]} />
            <View style={[styles.step, validateEmail(email) && styles.stepComplete]}>
              <Text style={styles.stepText}>2</Text>
            </View>
            <View style={[styles.stepLine, password.length >= 4 && styles.stepLineComplete]} />
            <View style={[styles.step, passwordsMatch && styles.stepComplete]}>
              <Text style={styles.stepText}>3</Text>
            </View>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Username Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{t('username')}</Text>
              <View style={[
                styles.inputWrapper,
                focusedInput === 'username' && styles.inputWrapperFocused,
                username.length >= 3 && styles.inputWrapperValid,
              ]}>
                <Text style={styles.inputIcon}>👤</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('chooseUsername')}
                  placeholderTextColor="#475569"
                  value={username}
                  onChangeText={(text) => {
                    console.log(`${FILE_NAME} ✏️ Username changed: "${text}" (length: ${text.length})`);
                    setUsername(text);
                  }}
                  onFocus={() => setFocusedInput('username')}
                  onBlur={() => setFocusedInput(null)}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {username.length >= 3 && (
                  <Text style={styles.validIcon}>✓</Text>
                )}
              </View>
              <Text style={styles.inputHint}>{t('atLeast3Chars')}</Text>
            </View>

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{t('email')}</Text>
              <View style={[
                styles.inputWrapper,
                focusedInput === 'email' && styles.inputWrapperFocused,
                validateEmail(email) && styles.inputWrapperValid,
              ]}>
                <Text style={styles.inputIcon}>📧</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('enterYourEmail')}
                  placeholderTextColor="#475569"
                  value={email}
                  onChangeText={(text) => {
                    console.log(`${FILE_NAME} ✏️ Email changed (length: ${text.length})`);
                    setEmail(text);
                  }}
                  onFocus={() => setFocusedInput('email')}
                  onBlur={() => setFocusedInput(null)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {validateEmail(email) && (
                  <Text style={styles.validIcon}>✓</Text>
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
                  placeholder={t('createPassword')}
                  placeholderTextColor="#475569"
                  value={password}
                  onChangeText={(text) => {
                    console.log(`${FILE_NAME} ✏️ Password changed (length: ${text.length})`);
                    setPassword(text);
                  }}
                  onFocus={() => setFocusedInput('password')}
                  onBlur={() => setFocusedInput(null)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.showPasswordButton}>
                  <Text style={styles.showPasswordText}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
              
              {/* Password Strength Indicator */}
              {password.length > 0 && (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthBars}>
                    {[1, 2, 3, 4, 5].map((level) => (
                      <View 
                        key={level}
                        style={[
                          styles.strengthBar,
                          level <= passwordStrength.strength && { backgroundColor: passwordStrength.color },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={[styles.strengthLabel, { color: passwordStrength.color }]}>
                    {passwordStrength.label}
                  </Text>
                </View>
              )}
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{t('confirmPassword')}</Text>
              <View style={[
                styles.inputWrapper,
                focusedInput === 'confirmPassword' && styles.inputWrapperFocused,
                passwordsMatch && styles.inputWrapperValid,
                confirmPassword.length > 0 && !passwordsMatch && styles.inputWrapperError,
              ]}>
                <Text style={styles.inputIcon}>🔐</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('confirmYourPassword')}
                  placeholderTextColor="#475569"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    console.log(`${FILE_NAME} ✏️ Confirm password changed (length: ${text.length})`);
                    setConfirmPassword(text);
                  }}
                  onFocus={() => setFocusedInput('confirmPassword')}
                  onBlur={() => setFocusedInput(null)}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.showPasswordButton}>
                  <Text style={styles.showPasswordText}>{showConfirmPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
              {confirmPassword.length > 0 && (
                <Text style={[styles.matchText, passwordsMatch ? styles.matchTextValid : styles.matchTextError]}>
                  {passwordsMatch ? `✓ ${t('passwordsMatch')}` : `✗ ${t('passwordsNoMatch')}`}
                </Text>
              )}
            </View>

            {/* Terms Checkbox */}
            <TouchableOpacity 
              style={styles.termsContainer}
              onPress={() => {
                console.log(`${FILE_NAME} ☑️ Terms accepted: ${!acceptedTerms}`);
                setAcceptedTerms(!acceptedTerms);
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                {acceptedTerms && <Text style={styles.checkboxText}>✓</Text>}
              </View>
              <Text style={styles.termsText}>
                {t('agreeToTerms')} <Text style={styles.termsLink}>{t('termsOfService')}</Text> {t('and')} <Text style={styles.termsLink}>{t('privacyPolicy')}</Text>
              </Text>
            </TouchableOpacity>

            {/* Register Button */}
            <TouchableOpacity 
              style={[styles.registerButton, loading && styles.registerButtonDisabled]} 
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={loading ? ['#64748b', '#475569'] : ['#3b82f6', '#2563eb']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.registerGradient}
              >
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <Text style={styles.loadingDots}>●●●</Text>
                    <Text style={styles.registerButtonText}>{t('loading')}</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.registerIcon}>🚀</Text>
                    <Text style={styles.registerButtonText}>{t('register')}</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Login Link */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>{t('hasAccount')} </Text>
            <TouchableOpacity onPress={handleLogin} activeOpacity={0.7}>
              <Text style={styles.loginLink}>{t('login')}</Text>
            </TouchableOpacity>
          </View>

          {/* Benefits Section */}
          <View style={styles.benefitsSection}>
            <LinearGradient
              colors={['rgba(59,130,246,0.1)', 'rgba(59,130,246,0.02)']}
              style={styles.benefitsGradient}
            >
              <Text style={styles.benefitsTitle}>{t('whyCreateAccount')}</Text>
              <View style={styles.benefitsList}>
                <View style={styles.benefitItem}>
                  <Text style={styles.benefitIcon}>☁️</Text>
                  <Text style={styles.benefitText}>{t('syncProgress')}</Text>
                </View>
                <View style={styles.benefitItem}>
                  <Text style={styles.benefitIcon}>🏆</Text>
                  <Text style={styles.benefitText}>{t('competeGlobal')}</Text>
                </View>
                <View style={styles.benefitItem}>
                  <Text style={styles.benefitIcon}>🎁</Text>
                  <Text style={styles.benefitText}>{t('bonusCoins')}</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* Bottom spacing */}
          <View style={{ height: 40 }} />
        </ContentShell>
      </FormShell>
      {isDesktopWeb && <HeroPanel />}
      </View>

      <AppModal popup={popup} onClose={closePopup} buttonLabel={t('ok')} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // v3.11 — desktop web 2-column row: form (left) + hero image panel (right)
  desktopRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  heroPanel: {
    width: 520,
    maxWidth: 520,
    alignItems: 'center',
  },
  heroGlow: {
    width: 520,
    maxWidth: 520,
    padding: 3,
    borderRadius: 20,
    shadowColor: '#7c5cff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
  },
  heroInner: {
    borderRadius: 17,
    overflow: 'hidden',
    backgroundColor: '#0a0a1a',
  },
  heroImage: {
    width: '100%',
    aspectRatio: 1300 / 820,
    borderRadius: 16,
  },
  heroTagline: {
    marginTop: 22,
    color: '#cbd5e1',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 460,
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
    marginBottom: 24,
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
    borderColor: 'rgba(59,130,246,0.3)',
  },
  logoGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(59,130,246,0.1)',
    top: -10,
    left: -10,
  },
  emoji: {
    fontSize: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
  },
  
  // Progress Steps
  progressSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  step: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  stepComplete: {
    backgroundColor: 'rgba(124,92,255,0.2)',
    borderColor: '#7c5cff',
  },
  stepText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 8,
  },
  stepLineComplete: {
    backgroundColor: '#7c5cff',
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
    borderColor: 'rgba(59,130,246,0.5)',
    backgroundColor: 'rgba(59,130,246,0.05)',
  },
  inputWrapperValid: {
    borderColor: 'rgba(124,92,255,0.5)',
  },
  inputWrapperError: {
    borderColor: 'rgba(239,68,68,0.5)',
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
  validIcon: {
    color: '#7c5cff',
    fontSize: 18,
    fontWeight: '700',
  },
  inputHint: {
    color: '#64748b',
    fontSize: 12,
    marginLeft: 4,
  },
  showPasswordButton: {
    padding: 8,
  },
  showPasswordText: {
    fontSize: 18,
  },
  
  // Password Strength
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  strengthBars: {
    flexDirection: 'row',
    gap: 4,
  },
  strengthBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Match Text
  matchText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  matchTextValid: {
    color: '#7c5cff',
  },
  matchTextError: {
    color: '#ef4444',
  },
  
  // Terms
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  checkboxText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  termsText: {
    flex: 1,
    color: '#64748b',
    fontSize: 13,
    lineHeight: 18,
  },
  termsLink: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  
  // Register Button
  registerButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  registerButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  registerGradient: {
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
  registerIcon: {
    fontSize: 20,
  },
  registerButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  
  // Login Link
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 28,
  },
  loginText: {
    color: '#64748b',
    fontSize: 15,
  },
  loginLink: {
    color: '#3b82f6',
    fontSize: 15,
    fontWeight: '700',
  },
  
  // Benefits Section
  benefitsSection: {
    marginTop: 28,
    borderRadius: 20,
    overflow: 'hidden',
  },
  benefitsGradient: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
  },
  benefitsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  benefitsList: {
    gap: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitIcon: {
    fontSize: 20,
  },
  benefitText: {
    color: '#94a3b8',
    fontSize: 14,
  },
});