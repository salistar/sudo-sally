/**
 * Midnight Atlas — central design tokens for SallySudo.
 *
 * Two themes ship in the same shape so screens can swap by reading
 * `useTheme().t` instead of hardcoding hexes. Defaults to 'midnight'
 * (cold navy + aurora violet/cyan + gold), with 'atlas-gold' available
 * as a warm green-black + saffron variant for MENA-first audiences.
 *
 * Spacing/radius/typography are theme-agnostic. Only the colour palette
 * differs between themes.
 *
 * Usage:
 *   import { useTheme } from '../utils/theme';
 *   const { c, r, s, type } = useTheme();
 *   <View style={{ backgroundColor: c.surface800, borderRadius: r.md }} />
 */
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeName = 'midnight' | 'atlas-gold';

export type Palette = {
  bgVoid: string;
  bg900: string;
  surface800: string;
  surface700: string;
  border: string;
  borderStrong: string;

  textStrong: string;
  text: string;
  textMuted: string;

  violet: string;
  indigo: string;
  cyan: string;
  gold: string;
  glow: string;
  // Pre-built gradient stops (LinearGradient consumes string[]).
  gradAurora: [string, string, string];

  error: string;
  success: string;

  // Difficulty ramp — used everywhere from /levels through the board.
  lvlEasy: string;
  lvlMedium: string;
  lvlHard: string;
  lvlExpert: string;
  lvlDiabolique: [string, string];
};

export const MIDNIGHT: Palette = {
  bgVoid:       '#0A0A1A',
  bg900:        '#0F1024',
  surface800:   '#171933',
  surface700:   '#1F2240',
  border:       'rgba(255,255,255,0.06)',
  borderStrong: 'rgba(255,255,255,0.12)',

  textStrong:   '#F5F7FA',
  text:         '#A8B0C0',
  textMuted:    '#6B7385',

  violet:       '#7C5CFF',
  indigo:       '#5B8DEF',
  cyan:         '#2DD4DB',
  gold:         '#E5B567',
  glow:         'rgba(124,92,255,0.35)',
  gradAurora:   ['#7C5CFF', '#5B8DEF', '#2DD4DB'],

  error:        '#EF4444',
  success:      '#34D399',

  lvlEasy:       '#34D399',
  lvlMedium:     '#60A5FA',
  lvlHard:       '#FBBF24',
  lvlExpert:     '#FB7185',
  lvlDiabolique: ['#A855F7', '#EF4444'],
};

export const ATLAS_GOLD: Palette = {
  bgVoid:       '#08120E',
  bg900:        '#0C1A14',
  surface800:   '#122620',
  surface700:   '#1A352B',
  border:       'rgba(255,255,255,0.06)',
  borderStrong: 'rgba(229,181,103,0.18)',

  textStrong:   '#F4F2E9',
  text:         '#B0BAAE',
  textMuted:    '#6E7A6E',

  violet:       '#10B981',
  indigo:       '#14B8A6',
  cyan:         '#34D399',
  gold:         '#E5B567',
  glow:         'rgba(16,185,129,0.30)',
  gradAurora:   ['#10B981', '#14B8A6', '#E5B567'],

  error:        '#DC2626',
  success:      '#10B981',

  lvlEasy:       '#34D399',
  lvlMedium:     '#2DD4BF',
  lvlHard:       '#FBBF24',
  lvlExpert:     '#F97316',
  lvlDiabolique: ['#DC2626', '#7C2D12'],
};

// 8-pt spacing — base unit times multiplier.
export const SPACE = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, x2: 32, x3: 48, x4: 64, x5: 96,
};

export const RADIUS = {
  sm: 12, md: 16, lg: 24, pill: 999,
};

// Type tokens — kept as constants so any screen can compose
// consistent labels without hand-tuning font sizes everywhere.
export const TYPE = {
  display: { fontWeight: '700' as const, letterSpacing: -0.02 * 16 },
  h1:      { fontSize: 32, fontWeight: '900' as const, letterSpacing: -0.4 },
  h2:      { fontSize: 24, fontWeight: '900' as const, letterSpacing: -0.3 },
  h3:      { fontSize: 18, fontWeight: '800' as const, letterSpacing: -0.1 },
  body:    { fontSize: 14, fontWeight: '500' as const },
  small:   { fontSize: 12, fontWeight: '600' as const },
  mono:    { fontVariant: ['tabular-nums' as any] },
  eyebrow: { fontSize: 10, fontWeight: '900' as const, letterSpacing: 1.5 },
};

const STORAGE_KEY = 'sudoku_theme';

export function paletteFor(name: ThemeName): Palette {
  return name === 'atlas-gold' ? ATLAS_GOLD : MIDNIGHT;
}

let currentTheme: ThemeName = 'midnight';
const listeners = new Set<(t: ThemeName) => void>();

export function getThemeName(): ThemeName {
  return currentTheme;
}

export async function setTheme(name: ThemeName) {
  currentTheme = name;
  try { await AsyncStorage.setItem(STORAGE_KEY, name); } catch {}
  listeners.forEach(fn => fn(name));
}

export async function loadStoredTheme() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === 'midnight' || raw === 'atlas-gold') {
      currentTheme = raw;
      listeners.forEach(fn => fn(raw));
    }
  } catch {}
}

// React hook — subscribe to theme changes and return both name + palette.
export function useTheme() {
  const [name, setName] = useState<ThemeName>(currentTheme);
  useEffect(() => {
    listeners.add(setName);
    loadStoredTheme();
    return () => { listeners.delete(setName); };
  }, []);
  return {
    name,
    c: paletteFor(name),
    s: SPACE,
    r: RADIUS,
    type: TYPE,
  };
}
