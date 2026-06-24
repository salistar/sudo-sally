/**
 * Data-integrity tests for the static-data util modules:
 * changelog.ts, themes.ts, powerups.ts, tutorial.ts, legalContent.ts.
 *
 * Importing each module executes its top-level lines (→ coverage); the shape
 * assertions catch real regressions (a malformed theme, a changelog entry with
 * no items, a legal page missing a translation, etc.).
 */
import { CHANGELOG, CURRENT_VERSION } from '../changelog';
import { THEMES, Theme } from '../themes';
import { POWERUPS } from '../powerups';
import { TUTORIAL_STEPS } from '../tutorial';
import { LEGAL, PRICING_UI, PRESS_UI, LegalPage } from '../legalContent';

const isVersion = (v: string) => /^\d+\.\d+\.\d+$/.test(v);
const hasLoc = (o: any) => o && typeof o.en === 'string' && o.en.length > 0
  && typeof o.fr === 'string' && o.fr.length > 0
  && typeof o.ar === 'string' && o.ar.length > 0;

describe('changelog.ts', () => {
  test('CURRENT_VERSION is a semver string', () => {
    expect(isVersion(CURRENT_VERSION)).toBe(true);
  });
  test('every entry has a version, ISO date, and ≥1 localized item', () => {
    expect(CHANGELOG.length).toBeGreaterThan(0);
    CHANGELOG.forEach(e => {
      expect(isVersion(e.version)).toBe(true);
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.items.length).toBeGreaterThan(0);
      e.items.forEach(it => expect(hasLoc(it)).toBe(true));
    });
  });
  test('the newest changelog entry matches CURRENT_VERSION', () => {
    expect(CHANGELOG[0].version).toBe(CURRENT_VERSION);
  });
});

describe('themes.ts', () => {
  test('every theme is fully populated and well-typed', () => {
    expect(THEMES.length).toBeGreaterThan(0);
    THEMES.forEach((t: Theme) => {
      expect(typeof t.id).toBe('string');
      expect(typeof t.name).toBe('string');
      expect(t.primary).toMatch(/^#/);
      expect(t.secondary).toMatch(/^#/);
      expect(t.accent).toMatch(/^#/);
      expect(t.background).toHaveLength(3);
      t.background.forEach(c => expect(typeof c).toBe('string'));
      expect(typeof t.cell).toBe('string');
      expect(typeof t.cellSelected).toBe('string');
      expect(typeof t.text).toBe('string');
      expect(typeof t.locked).toBe('boolean');
      expect(typeof t.price).toBe('number');
      expect(t.price).toBeGreaterThanOrEqual(0);
    });
  });
  test('theme ids are unique', () => {
    const ids = THEMES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  test('the default theme is free and unlocked', () => {
    const def = THEMES.find(t => t.id === 'default');
    expect(def).toBeDefined();
    expect(def!.locked).toBe(false);
    expect(def!.price).toBe(0);
  });
  test('locked themes carry a positive price', () => {
    THEMES.filter(t => t.locked).forEach(t => expect(t.price).toBeGreaterThan(0));
  });
});

describe('powerups.ts', () => {
  test('every power-up is well-formed with a positive price', () => {
    expect(POWERUPS.length).toBeGreaterThan(0);
    POWERUPS.forEach(p => {
      expect(typeof p.id).toBe('string');
      expect(typeof p.name).toBe('string');
      expect(typeof p.description).toBe('string');
      expect(typeof p.icon).toBe('string');
      expect(p.price).toBeGreaterThan(0);
      expect(p.quantity).toBe(0);
    });
  });
  test('power-up ids are unique', () => {
    const ids = POWERUPS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('tutorial.ts', () => {
  test('steps are sequential and well-formed', () => {
    expect(TUTORIAL_STEPS.length).toBeGreaterThan(0);
    TUTORIAL_STEPS.forEach((s, i) => {
      expect(s.id).toBe(i + 1); // 1-based, contiguous
      expect(typeof s.title).toBe('string');
      expect(typeof s.description).toBe('string');
      expect(typeof s.action).toBe('string');
      expect([null, 'board', 'numpad', 'tools', 'stats']).toContain(s.highlight);
    });
  });
  test('first step intros and last step finishes', () => {
    expect(TUTORIAL_STEPS[0].action).toBe('next');
    expect(TUTORIAL_STEPS[TUTORIAL_STEPS.length - 1].action).toBe('finish');
  });
});

describe('legalContent.ts', () => {
  const pages: [string, LegalPage][] = Object.entries(LEGAL);

  test('LEGAL exposes the five expected pages', () => {
    expect(Object.keys(LEGAL).sort()).toEqual(['about', 'press', 'pricing', 'privacy', 'terms']);
  });

  test.each(pages)('%s page has localized title/subtitle and valid blocks', (_name, page) => {
    expect(hasLoc(page.title)).toBe(true);
    expect(hasLoc(page.subtitle)).toBe(true);
    expect(page.blocks.length).toBeGreaterThan(0);
    page.blocks.forEach(b => {
      expect(['p', 'h', 'li']).toContain(b.kind);
      expect(hasLoc(b.text)).toBe(true);
    });
  });

  test('PRICING_UI labels and included bullets are localized', () => {
    expect(hasLoc(PRICING_UI.eyebrow)).toBe(true);
    expect(hasLoc(PRICING_UI.per)).toBe(true);
    expect(hasLoc(PRICING_UI.cta)).toBe(true);
    expect(PRICING_UI.included.length).toBeGreaterThan(0);
    PRICING_UI.included.forEach(l => expect(hasLoc(l)).toBe(true));
  });

  test('PRESS_UI fast-facts and asset labels are localized', () => {
    expect(PRESS_UI.facts.length).toBeGreaterThan(0);
    PRESS_UI.facts.forEach(f => {
      expect(hasLoc(f.k)).toBe(true);
      expect(hasLoc(f.v)).toBe(true);
    });
    expect(hasLoc(PRESS_UI.assetSocial)).toBe(true);
    expect(hasLoc(PRESS_UI.assetIcon)).toBe(true);
  });
});
