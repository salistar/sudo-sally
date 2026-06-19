// Splash Screen — animated brand intro
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { useLang } from '../utils/LanguageContext';

const { width } = Dimensions.get('window');

// 3x3 mini sudoku motif for the logo. null = empty, number = filled (accent).
const LOGO_GRID: (number | null)[] = [5, null, 9, null, 7, null, 2, null, 6];

export default function Splash() {
  const router = useRouter();
  const { t } = useLang();

  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.4)).current;
  const slideUp = useRef(new Animated.Value(28)).current;
  const glow = useRef(new Animated.Value(0.35)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const [dots, setDots] = useState('');

  useEffect(() => {
    // Entrance
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, tension: 45, friction: 7, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();

    // Pulsing glow
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 0.9, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.35, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();

    // Rotating accent ring
    Animated.loop(
      Animated.timing(ring, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true }),
    ).start();

    // Loading dots
    const dotsI = setInterval(() => setDots((p) => (p.length >= 3 ? '' : p + '.')), 350);

    // Navigate after intro
    const nav = setTimeout(() => router.replace('/welcome'), 2600);

    return () => {
      clearInterval(dotsI);
      clearTimeout(nav);
    };
  }, []);

  const spin = ring.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <LinearGradient colors={['#0a0a1a', '#12122a', '#1a1a3a', '#0f0f2a']} style={styles.container}>
      {/* Ambient blobs */}
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobBottom]} />

      <Animated.View style={[styles.center, { opacity: fade, transform: [{ translateY: slideUp }] }]}>
        {/* Logo */}
        <Animated.View style={{ transform: [{ scale }] }}>
          <View style={styles.logoWrap}>
            {/* Pulsing glow halo */}
            <Animated.View style={[styles.glow, { opacity: glow, transform: [{ scale: glow.interpolate({ inputRange: [0.35, 0.9], outputRange: [1, 1.25] }) }] }]} />
            {/* Rotating accent ring */}
            <Animated.View style={[styles.ring, { transform: [{ rotate: spin }] }]} />

            <LinearGradient
              colors={['rgba(124,92,255,0.18)', 'rgba(45,212,219,0.06)']}
              style={styles.logoCard}
            >
              <View style={styles.grid}>
                {LOGO_GRID.map((cell, i) => (
                  <View
                    key={i}
                    style={[
                      styles.cell,
                      (i + 1) % 3 === 0 && i % 9 !== 8 ? null : null,
                      cell != null && styles.cellFilled,
                    ]}
                  >
                    {cell != null && <Text style={styles.cellText}>{cell}</Text>}
                  </View>
                ))}
              </View>
              {/* Corner accents */}
              <View style={[styles.corner, styles.cTL]} />
              <View style={[styles.corner, styles.cTR]} />
              <View style={[styles.corner, styles.cBL]} />
              <View style={[styles.corner, styles.cBR]} />
            </LinearGradient>
          </View>
        </Animated.View>

        {/* Wordmark */}
        <Text style={styles.title}>SALLYSUDO</Text>
        <LinearGradient colors={['#7c5cff', '#2dd4db']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.tagBadge}>
          <Text style={styles.tagText}>{t('trainBrainDaily')}</Text>
        </LinearGradient>
      </Animated.View>

      {/* Loader */}
      <Animated.View style={[styles.loader, { opacity: fade }]}>
        <View style={styles.loaderRow}>
          <View style={[styles.loaderDot, { backgroundColor: '#7c5cff' }]} />
          <View style={[styles.loaderDot, { backgroundColor: '#60a5fa' }]} />
          <View style={[styles.loaderDot, { backgroundColor: '#f472b6' }]} />
        </View>
        <Text style={styles.loadingText}>{t('loading').replace('...', '')}{dots}</Text>
        <Text style={styles.version}>v{Constants.expoConfig?.version ?? '?'}</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const CARD = Math.min(160, width * 0.42);
const CELL = (CARD - 28) / 3;

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  blob: { position: 'absolute', borderRadius: 999 },
  blobTop: { top: -90, right: -70, width: 240, height: 240, backgroundColor: 'rgba(124,92,255,0.07)' },
  blobBottom: { bottom: -110, left: -80, width: 280, height: 280, backgroundColor: 'rgba(96,165,250,0.06)' },

  center: { alignItems: 'center' },

  logoWrap: { width: CARD + 40, height: CARD + 40, justifyContent: 'center', alignItems: 'center', marginBottom: 28 },
  glow: {
    position: 'absolute', width: CARD, height: CARD, borderRadius: CARD / 2,
    backgroundColor: 'rgba(124,92,255,0.35)',
  },
  ring: {
    position: 'absolute', width: CARD + 26, height: CARD + 26, borderRadius: (CARD + 26) / 2,
    borderWidth: 2, borderColor: 'rgba(124,92,255,0.35)', borderTopColor: '#7c5cff', borderRightColor: '#2dd4db',
  },
  logoCard: {
    width: CARD, height: CARD, borderRadius: 30, padding: 14,
    borderWidth: 2, borderColor: 'rgba(124,92,255,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  grid: { width: CARD - 28, height: CARD - 28, flexDirection: 'row', flexWrap: 'wrap', borderRadius: 8, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.25)' },
  cell: {
    width: CELL, height: CELL, justifyContent: 'center', alignItems: 'center',
    borderWidth: 0.5, borderColor: 'rgba(124,92,255,0.18)',
  },
  cellFilled: { backgroundColor: 'rgba(124,92,255,0.16)' },
  cellText: { color: '#7c5cff', fontSize: CELL * 0.5, fontWeight: '800' },

  corner: { position: 'absolute', width: 16, height: 16, borderColor: '#7c5cff' },
  cTL: { top: 7, left: 7, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 8 },
  cTR: { top: 7, right: 7, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 8 },
  cBL: { bottom: 7, left: 7, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 8 },
  cBR: { bottom: 7, right: 7, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 8 },

  title: { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: 4 },
  tagBadge: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 },
  tagText: { color: '#06240f', fontSize: 13, fontWeight: '800', letterSpacing: 1 },

  loader: { position: 'absolute', bottom: 60, alignItems: 'center' },
  loaderRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  loaderDot: { width: 8, height: 8, borderRadius: 4 },
  loadingText: { color: '#64748b', fontSize: 13, letterSpacing: 1, fontWeight: '600', minHeight: 18 },
  version: { color: '#334155', fontSize: 11, marginTop: 8, letterSpacing: 1 },
});
