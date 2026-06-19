/**
 * AchievementsCategoryGrid — Steam-style achievement panel for /achievements.
 *
 * Buckets the existing achievements list into 4 themed categories
 * (heuristic match on id keywords) and renders each category as a card
 * containing its tiles. Each tile has:
 *   - Big icon emoji
 *   - Title + 1-line description
 *   - Progress bar (filled if unlocked, empty if locked)
 *   - Rarity pill: COMMON / RARE / EPIC based on the target threshold
 *
 * Mounted on /achievements desktop only — phone keeps the existing
 * vertical list because the category grid would be too cramped at 720px.
 */
import { useMemo } from 'react';
import { View, Text } from 'react-native';
import { useLang } from '../utils/LanguageContext';

type Achievement = {
  id: string;
  title: any;
  description: any;
  icon: string;
  unlocked: boolean;
  progress: number;
  target: number;
};

type Category = {
  key: string;
  label: string;
  icon: string;
  color: string;
  match: (id: string) => boolean;
};

function buildCategories(t: (k: string) => string): Category[] {
  return [
    {
      key: 'combat',
      label: t('catCombat'),
      icon: '⚔️',
      color: '#ef4444',
      match: (id) => /challenge|duel|1v1|versus|win.*challenge|opponent/i.test(id),
    },
    {
      key: 'streak',
      label: t('catStreak'),
      icon: '🔥',
      color: '#f59e0b',
      match: (id) => /streak|daily|consecutive|week|month/i.test(id),
    },
    {
      key: 'mastery',
      label: t('catMastery'),
      icon: '🧠',
      color: '#a855f7',
      match: (id) => /perfect|speed|expert|master|hard|hint|no_hint|hint_free|flawless|no_error/i.test(id),
    },
    {
      key: 'discovery',
      label: t('catDiscovery'),
      icon: '✨',
      color: '#7c5cff',
      match: () => true,
    },
  ];
}

function rarity(target: number, t: (k: string) => string): { label: string; color: string } {
  if (target <= 1) return { label: t('rarityCommon'), color: '#94a3b8' };
  if (target <= 5) return { label: t('rarityRare'), color: '#3b82f6' };
  return { label: t('rarityEpic'), color: '#a855f7' };
}

function pickLang(field: any, lang: 'fr' | 'en' | 'ar' = 'fr'): string {
  if (typeof field === 'string') return field;
  if (field && typeof field === 'object') return field[lang] || field.en || field.fr || Object.values(field)[0] || '';
  return '';
}

type Props = {
  achievements: Achievement[];
  lang?: 'fr' | 'en' | 'ar';
};

export default function AchievementsCategoryGrid({ achievements, lang = 'fr' }: Props) {
  const { t } = useLang();
  const CATEGORIES = useMemo(() => buildCategories(t), [t]);

  const buckets = useMemo(() => {
    const map: Record<string, Achievement[]> = {};
    CATEGORIES.forEach(c => { map[c.key] = []; });
    const used = new Set<string>();
    for (const a of achievements) {
      for (const c of CATEGORIES) {
        if (used.has(a.id)) continue;
        if (c.match(a.id)) {
          map[c.key].push(a);
          used.add(a.id);
          break;
        }
      }
    }
    return map;
  }, [achievements, CATEGORIES]);

  if (achievements.length === 0) {
    return (
      <View style={{ marginTop: 18, padding: 22, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', alignItems: 'center' }}>
        <Text style={{ fontSize: 28, marginBottom: 8 }}>🏅</Text>
        <Text style={{ color: '#f9fafb', fontSize: 14, fontWeight: '800', marginBottom: 4 }}>{t('noAchievementsYetCat')}</Text>
        <Text style={{ color: '#94a3b8', fontSize: 12 }}>{t('playToUnlock')}</Text>
      </View>
    );
  }

  return (
    <View style={{ marginTop: 16 }}>
      {CATEGORIES.map(cat => {
        const list = buckets[cat.key];
        if (!list || list.length === 0) return null;
        const unlocked = list.filter(a => a.unlocked).length;

        return (
          <View key={cat.key} style={{ marginBottom: 16, padding: 18, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: `${cat.color}1f`, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 16 }}>{cat.icon}</Text>
                </View>
                <Text style={{ color: '#f9fafb', fontSize: 14, fontWeight: '800', letterSpacing: 0.4 }}>{cat.label}</Text>
              </View>
              <Text style={{ color: cat.color, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 }}>
                {unlocked}/{list.length}
              </Text>
            </View>

            {/* Grid 2-col on desktop */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {list.map(a => {
                const r = rarity(a.target, t);
                const pct = a.target > 0 ? Math.min(100, (a.progress / a.target) * 100) : 0;
                return (
                  <View
                    key={a.id}
                    style={{
                      width: '49%',
                      padding: 14,
                      borderRadius: 12,
                      backgroundColor: a.unlocked ? `${cat.color}0d` : 'rgba(255,255,255,0.02)',
                      borderWidth: 1,
                      borderColor: a.unlocked ? `${cat.color}40` : 'rgba(255,255,255,0.04)',
                      opacity: a.unlocked ? 1 : 0.65,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                      <Text style={{ fontSize: 28 }}>{a.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                          <Text style={{ color: '#f9fafb', fontSize: 12, fontWeight: '800' }} numberOfLines={1}>
                            {pickLang(a.title, lang)}
                          </Text>
                          <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: `${r.color}1f`, borderWidth: 1, borderColor: `${r.color}40` }}>
                            <Text style={{ color: r.color, fontSize: 8, fontWeight: '900', letterSpacing: 0.6 }}>{r.label}</Text>
                          </View>
                        </View>
                        <Text style={{ color: '#94a3b8', fontSize: 10, marginBottom: 8 }} numberOfLines={2}>
                          {pickLang(a.description, lang)}
                        </Text>
                        <View style={{ height: 5, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                          <View style={{ width: `${pct}%`, height: '100%', backgroundColor: a.unlocked ? cat.color : 'rgba(255,255,255,0.2)' }} />
                        </View>
                        <Text style={{ color: '#64748b', fontSize: 9, fontWeight: '700', marginTop: 4 }}>
                          {a.progress}/{a.target}
                          {a.unlocked && <Text style={{ color: cat.color, fontWeight: '900' }}>  · {t('unlocked')}</Text>}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}
