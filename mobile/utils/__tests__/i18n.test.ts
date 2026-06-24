/**
 * Tests for utils/i18n.ts.
 *
 * Two kinds of value here:
 *  - behavioural: t() resolves per-language, falls back to en, then to the raw
 *    key; isRTL flags Arabic.
 *  - correctness: full translation-key PARITY across en/fr/ar — every language
 *    must define exactly the same set of keys (a real bug-catcher).
 */
import { translations, t, isRTL, Language } from '../i18n';

const LANGS: Language[] = ['en', 'fr', 'ar'];

describe('t() translation lookup', () => {
  test('returns the language-specific string for a known key', () => {
    expect(t('play', 'en')).toBe('Play');
    expect(t('play', 'fr')).toBe('Jouer');
    expect(t('play', 'ar')).toBe(translations.ar.play);
  });
  test('defaults to English when no language is given', () => {
    expect(t('settings')).toBe('Settings');
  });
  test('falls back to the raw key for an unknown key', () => {
    // @ts-expect-error — deliberately passing an unknown key
    expect(t('totally_unknown_key', 'fr')).toBe('totally_unknown_key');
  });
  test('appName resolves to a non-empty string in every language', () => {
    expect(t('appName', 'en')).toBe('SallySudo');
    expect(t('appName', 'fr')).toBe('SallySudo');
    // Arabic localizes the brand name; just assert it is present and non-empty.
    expect(typeof t('appName', 'ar')).toBe('string');
    expect(t('appName', 'ar').length).toBeGreaterThan(0);
  });
});

describe('isRTL', () => {
  test('only Arabic is right-to-left', () => {
    expect(isRTL('ar')).toBe(true);
    expect(isRTL('en')).toBe(false);
    expect(isRTL('fr')).toBe(false);
  });
});

describe('translation key parity', () => {
  const enKeys = Object.keys(translations.en).sort();

  test.each(LANGS)('%s defines exactly the same top-level keys as en', (lang) => {
    const keys = Object.keys(translations[lang]).sort();
    const missing = enKeys.filter(k => !keys.includes(k));
    const extra = keys.filter(k => !enKeys.includes(k));
    expect({ lang, missing, extra }).toEqual({ lang, missing: [], extra: [] });
  });

  test('nested days/slots objects share the same sub-keys in every language', () => {
    const dayKeys = Object.keys((translations.en as any).days).sort();
    const slotKeys = Object.keys((translations.en as any).slots).sort();
    for (const lang of LANGS) {
      expect(Object.keys((translations[lang] as any).days).sort()).toEqual(dayKeys);
      expect(Object.keys((translations[lang] as any).slots).sort()).toEqual(slotKeys);
    }
  });

  test('every non-nested value is a non-empty string in every language', () => {
    for (const lang of LANGS) {
      for (const [key, val] of Object.entries(translations[lang])) {
        if (key === 'days' || key === 'slots') continue; // nested objects
        expect(typeof val).toBe('string');
        expect((val as string).length).toBeGreaterThan(0);
      }
    }
  });
});
