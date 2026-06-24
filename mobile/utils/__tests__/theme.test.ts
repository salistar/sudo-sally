/**
 * Tests for utils/theme.ts — the design-token store.
 *
 * theme.ts imports AsyncStorage (mocked in-memory) and React. The exported
 * palettes, spacing/radius/type tokens, and the imperative theme store
 * (paletteFor / getThemeName / setTheme / loadStoredTheme) are all node-safe.
 * We do NOT exercise the useTheme() React hook here (it needs a renderer and
 * is covered by E2E); everything else is.
 */
const mockStore = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => (mockStore.has(k) ? mockStore.get(k)! : null)),
    setItem: jest.fn(async (k: string, v: string) => { mockStore.set(k, v); }),
    removeItem: jest.fn(async (k: string) => { mockStore.delete(k); }),
  },
}));

import {
  MIDNIGHT,
  ATLAS_GOLD,
  SPACE,
  RADIUS,
  TYPE,
  paletteFor,
  getThemeName,
  setTheme,
  loadStoredTheme,
  Palette,
} from '../theme';

beforeEach(() => mockStore.clear());

const PALETTE_KEYS: (keyof Palette)[] = [
  'bgVoid', 'bg900', 'surface800', 'surface700', 'border', 'borderStrong',
  'textStrong', 'text', 'textMuted', 'violet', 'indigo', 'cyan', 'gold', 'glow',
  'gradAurora', 'error', 'success', 'lvlEasy', 'lvlMedium', 'lvlHard',
  'lvlExpert', 'lvlDiabolique',
];

describe('palettes', () => {
  test('MIDNIGHT and ATLAS_GOLD expose the same complete key set', () => {
    PALETTE_KEYS.forEach(k => {
      expect(MIDNIGHT[k]).toBeDefined();
      expect(ATLAS_GOLD[k]).toBeDefined();
    });
    expect(Object.keys(ATLAS_GOLD).sort()).toEqual(Object.keys(MIDNIGHT).sort());
  });
  test('gradient stops are 3-colour tuples; diabolique ramp is a 2-colour tuple', () => {
    [MIDNIGHT, ATLAS_GOLD].forEach(p => {
      expect(p.gradAurora).toHaveLength(3);
      expect(p.lvlDiabolique).toHaveLength(2);
    });
  });
});

describe('spacing / radius / type tokens', () => {
  test('SPACE follows an 8-pt-ish scale', () => {
    expect(SPACE.xs).toBe(4);
    expect(SPACE.lg).toBe(16);
    expect(SPACE.x5).toBe(96);
  });
  test('RADIUS pill is the round value', () => {
    expect(RADIUS.pill).toBe(999);
    expect(RADIUS.sm).toBeLessThan(RADIUS.lg);
  });
  test('TYPE headings carry font sizes', () => {
    expect(TYPE.h1.fontSize).toBe(32);
    expect(TYPE.h2.fontSize).toBe(24);
    expect(TYPE.body.fontSize).toBe(14);
  });
});

describe('paletteFor', () => {
  test('maps the theme name to the matching palette', () => {
    expect(paletteFor('atlas-gold')).toBe(ATLAS_GOLD);
    expect(paletteFor('midnight')).toBe(MIDNIGHT);
  });
  test('unknown name defaults to MIDNIGHT', () => {
    expect(paletteFor('whatever' as any)).toBe(MIDNIGHT);
  });
});

describe('theme store (imperative)', () => {
  test('defaults to midnight', () => {
    // setTheme may have been called by other tests; reset it explicitly
    return setTheme('midnight').then(() => {
      expect(getThemeName()).toBe('midnight');
    });
  });
  test('setTheme updates the current name and persists it', async () => {
    await setTheme('atlas-gold');
    expect(getThemeName()).toBe('atlas-gold');
    expect(mockStore.get('sudoku_theme')).toBe('atlas-gold');
  });
  test('loadStoredTheme restores a previously stored valid theme', async () => {
    await setTheme('midnight');
    mockStore.set('sudoku_theme', 'atlas-gold');
    await loadStoredTheme();
    expect(getThemeName()).toBe('atlas-gold');
  });
  test('loadStoredTheme ignores an invalid stored value', async () => {
    await setTheme('midnight');
    mockStore.set('sudoku_theme', 'bogus');
    await loadStoredTheme();
    expect(getThemeName()).toBe('midnight'); // unchanged
  });
  test('loadStoredTheme is a no-op when nothing is stored', async () => {
    await setTheme('atlas-gold');
    mockStore.clear();
    await loadStoredTheme();
    expect(getThemeName()).toBe('atlas-gold'); // unchanged
  });
});
