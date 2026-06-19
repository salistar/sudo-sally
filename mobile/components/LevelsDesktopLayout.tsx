/**
 * LevelsDesktopLayout — /levels desktop refresh.
 *
 * Three pieces:
 *   1. Hero "Resume your journey" card with a big Next Level CTA pulling
 *      the first non-completed unlocked level. Shows current progression
 *      (% complete + completed/total + stars/max).
 *   2. Difficulty filter chip row using the Midnight Atlas level ramp
 *      (Easy → Medium → Hard → Expert → Master) — each chip outlined in
 *      its own ramp colour, active = filled.
 *   3. 6-column tile grid. Each tile shows: level number, difficulty
 *      stripe, stars (out of 3), best-time tabular-num, locked overlay.
 *
 * Mounted as a takeover when isDesktopWeb is true; phone falls through
 * to the existing layout in levels.tsx.
 */
import { useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLang } from '../utils/LanguageContext';
import { useTheme } from '../utils/theme';
import { LevelData } from '../utils/storage';
import { formatDuration } from '../utils/format';

type Props = {
  levels: LevelData[];
  selectedDifficulty: string | null;
  onFilter: (d: string | null) => void;
  onLevel: (lvl: LevelData) => void;
};

function diffColor(diff: string, c: any): string {
  switch (diff) {
    case 'beginner': return c.lvlEasy;
    case 'easy':     return c.lvlEasy;
    case 'medium':   return c.lvlMedium;
    case 'hard':     return c.lvlHard;
    case 'expert':   return c.lvlExpert;
    case 'master':   return c.violet;
    default:         return c.text;
  }
}

// m:SS with "—" fallback for 0/empty — shared util. Behaviour unchanged.
const fmtTime = formatDuration;

export default function LevelsDesktopLayout({ levels, selectedDifficulty, onFilter, onLevel }: Props) {
  const { t } = useLang();
  const { c, r, s, type } = useTheme();

  const filtered = useMemo(
    () => selectedDifficulty ? levels.filter(l => l.difficulty === selectedDifficulty) : levels,
    [levels, selectedDifficulty],
  );

  const completed = levels.filter(l => l.completed).length;
  const totalStars = levels.reduce((sum, l) => sum + l.stars, 0);
  const maxStars = levels.length * 3;
  const pct = levels.length > 0 ? Math.round((completed / levels.length) * 100) : 0;
  const nextLevel = levels.find(l => !l.completed && !l.locked) || levels[0];

  const diffs = [
    { key: 'beginner', tKey: 'diffBeginner', range: '1-5'   },
    { key: 'easy',     tKey: 'diffEasy',     range: '6-10'  },
    { key: 'medium',   tKey: 'diffMedium',   range: '11-15' },
    { key: 'hard',     tKey: 'diffHard',     range: '16-20' },
    { key: 'expert',   tKey: 'diffExpert',   range: '21-25' },
    { key: 'master',   tKey: 'diffMaster',   range: '26-30' },
  ];

  return (
    <View>
      {/* ── HERO ────────────────────────────────────────────────── */}
      <View
        style={{
          position: 'relative',
          marginBottom: s.xl,
          padding: s.x2,
          borderRadius: r.lg,
          backgroundColor: c.surface800,
          borderWidth: 1, borderColor: c.borderStrong,
          overflow: 'hidden',
        }}
      >
        <LinearGradient
          colors={c.gradAurora}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2 } as any}
        />
        <LinearGradient
          colors={[c.glow, 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.6 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.4 } as any}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1.6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.sm, marginBottom: s.sm }}>
              <View style={{ paddingHorizontal: s.md, paddingVertical: 4, borderRadius: r.pill, backgroundColor: `${c.gold}22`, borderWidth: 1, borderColor: `${c.gold}55` }}>
                <Text style={{ color: c.gold, ...type.eyebrow }}>{t('levelsTag')}</Text>
              </View>
              <View style={{ paddingHorizontal: s.md, paddingVertical: 4, borderRadius: r.pill, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: c.border }}>
                <Text style={{ color: c.text, ...type.eyebrow }}>
                  {completed}/{levels.length} · {totalStars}/{maxStars} ⭐
                </Text>
              </View>
            </View>
            <Text style={{ color: c.textStrong, fontSize: 30, fontWeight: '900', letterSpacing: -0.6, marginBottom: 4 }}>
              {t('levelsTitle')}
            </Text>
            <Text style={{ color: c.text, ...type.body, lineHeight: 22, marginBottom: s.lg, maxWidth: 540 }}>
              {t('levelsHint')}
            </Text>
            {/* Big progression bar */}
            <View style={{ marginBottom: s.lg, maxWidth: 540 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: c.text, ...type.eyebrow }}>{t('progress')}</Text>
                <Text style={{ color: c.success, fontSize: 12, fontWeight: '900', ...type.mono }}>{pct}%</Text>
              </View>
              <View style={{ height: 10, borderRadius: 5, backgroundColor: c.surface700, overflow: 'hidden' }}>
                <LinearGradient
                  colors={c.gradAurora}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ width: `${pct}%`, height: '100%' } as any}
                />
              </View>
            </View>
            {nextLevel && (
              <TouchableOpacity
                onPress={() => onLevel(nextLevel)}
                style={{
                  alignSelf: 'flex-start',
                  paddingHorizontal: s.xl, paddingVertical: 12,
                  borderRadius: r.pill,
                  backgroundColor: c.gold,
                }}
              >
                <Text style={{ color: c.bgVoid, fontSize: 13, fontWeight: '900', letterSpacing: 0.4 }}>
                  ▶ {t('levelsResume')} #{nextLevel.id}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {/* Next-level preview card */}
          {nextLevel && (
            <View
              style={{
                width: 220, padding: s.lg, borderRadius: r.md,
                backgroundColor: c.bgVoid,
                borderWidth: 1, borderColor: `${diffColor(nextLevel.difficulty, c)}55`,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: c.textMuted, ...type.eyebrow, marginBottom: s.sm }}>{t('nextLevel')}</Text>
              <Text style={{ color: c.textStrong, fontSize: 56, fontWeight: '900', letterSpacing: -2, lineHeight: 64 }}>
                {nextLevel.id}
              </Text>
              <View style={{ paddingHorizontal: s.md, paddingVertical: 3, borderRadius: r.sm, backgroundColor: `${diffColor(nextLevel.difficulty, c)}22`, borderWidth: 1, borderColor: `${diffColor(nextLevel.difficulty, c)}55`, marginTop: s.sm }}>
                <Text style={{ color: diffColor(nextLevel.difficulty, c), ...type.eyebrow }}>
                  {nextLevel.difficulty.toUpperCase()}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 3, marginTop: s.sm }}>
                {[1, 2, 3].map(i => (
                  <Text key={i} style={{ fontSize: 14, opacity: i <= nextLevel.stars ? 1 : 0.25 }}>⭐</Text>
                ))}
              </View>
            </View>
          )}
        </View>
      </View>

      {/* ── DIFFICULTY CHIPS ──────────────────────────────────── */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.sm, marginBottom: s.xl }}>
        <TouchableOpacity
          onPress={() => onFilter(null)}
          style={{
            paddingHorizontal: s.lg, paddingVertical: 9,
            borderRadius: r.pill,
            backgroundColor: selectedDifficulty === null ? c.violet : 'transparent',
            borderWidth: 1,
            borderColor: selectedDifficulty === null ? c.violet : c.border,
          }}
        >
          <Text style={{ color: selectedDifficulty === null ? '#fff' : c.text, fontSize: 12, fontWeight: '900', letterSpacing: 0.4 }}>
            {t('allLevels')} · {levels.length}
          </Text>
        </TouchableOpacity>
        {diffs.map(d => {
          const active = selectedDifficulty === d.key;
          const colour = diffColor(d.key, c);
          const count = levels.filter(l => l.difficulty === d.key).length;
          return (
            <TouchableOpacity
              key={d.key}
              onPress={() => onFilter(active ? null : d.key)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: s.lg, paddingVertical: 9,
                borderRadius: r.pill,
                backgroundColor: active ? `${colour}22` : 'transparent',
                borderWidth: 1, borderColor: active ? colour : `${colour}55`,
              }}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colour }} />
              <Text style={{ color: active ? colour : c.text, fontSize: 12, fontWeight: '900', letterSpacing: 0.4 }}>
                {t(d.tKey as any)}
              </Text>
              <Text style={{ color: c.textMuted, fontSize: 10, fontWeight: '800', marginLeft: 2 }}>
                {count}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── TILE GRID ─────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <View style={{ padding: s.x2, borderRadius: r.md, backgroundColor: c.surface800, borderWidth: 1, borderColor: c.border, alignItems: 'center' }}>
          <Text style={{ fontSize: 30, marginBottom: s.sm }}>🔍</Text>
          <Text style={{ color: c.textStrong, fontSize: 15, fontWeight: '900' }}>{t('noLevelMatch')}</Text>
          <Text style={{ color: c.text, ...type.small, marginTop: 4 }}>{t('noLevelMatchHint')}</Text>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.md }}>
          {filtered.map(lvl => {
            const colour = diffColor(lvl.difficulty, c);
            const locked = lvl.locked;
            const done = lvl.completed;
            return (
              <TouchableOpacity
                key={lvl.id}
                disabled={locked}
                onPress={() => onLevel(lvl)}
                activeOpacity={0.85}
                style={{
                  width: 156, padding: s.md,
                  borderRadius: r.md,
                  backgroundColor: locked ? c.bg900 : c.surface800,
                  borderWidth: 1,
                  borderColor: locked ? c.border : done ? `${colour}55` : c.borderStrong,
                  opacity: locked ? 0.55 : 1,
                  overflow: 'hidden',
                }}
              >
                {/* Top stripe in difficulty colour */}
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: colour, opacity: locked ? 0.3 : done ? 1 : 0.6 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 6 }}>
                  <Text style={{ color: locked ? c.textMuted : c.textStrong, fontSize: 26, fontWeight: '900', letterSpacing: -0.8, ...type.mono }}>
                    {lvl.id}
                  </Text>
                  {locked ? (
                    <Text style={{ fontSize: 14, opacity: 0.6 }}>🔒</Text>
                  ) : done ? (
                    <Text style={{ fontSize: 14 }}>✅</Text>
                  ) : (
                    <Text style={{ color: colour, ...type.eyebrow }}>▶</Text>
                  )}
                </View>
                <Text style={{ color: colour, ...type.eyebrow, marginTop: 2 }}>
                  {lvl.difficulty.toUpperCase()}
                </Text>
                {/* Stars */}
                <View style={{ flexDirection: 'row', gap: 2, marginTop: s.sm, marginBottom: 4 }}>
                  {[1, 2, 3].map(i => (
                    <Text key={i} style={{ fontSize: 12, opacity: i <= lvl.stars ? 1 : 0.22 }}>⭐</Text>
                  ))}
                </View>
                {/* Best time */}
                <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: '700', ...type.mono }}>
                  {lvl.bestTime ? `🕒 ${fmtTime(lvl.bestTime)}` : t('noRecord')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}
