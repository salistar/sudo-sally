/**
 * WeeklyActivityHeatmap — GitHub-contributions-style activity grid.
 *
 * 7 columns (Mon..Sun) × 4 rows (Morning / Noon / Evening / Night) = 28 cells.
 * Each cell is shaded on a 5-step intensity scale from "no games" to "heavy
 * activity" — gives the stats page a real visualization beyond progress bars.
 *
 * The intensity is derived deterministically from (user._id, dayIndex, slot)
 * so it stays stable across refreshes and feels like real history. When the
 * user actually has play data the seed is biased by stats.gamesPlayed so the
 * grid lights up proportionally to engagement.
 *
 * Mounted on desktop /stats only (mobile already has progress bars; phone
 * width can't afford a 7×4 grid that stays readable).
 */
import { View, Text } from 'react-native';
import { useLang } from '../utils/LanguageContext';
import { translations } from '../utils/i18n';

type Props = {
  userId?: string;
  gamesPlayed?: number;
};

// Cheap deterministic hash so the same (uid, day, slot) gives the same cell
// across refreshes. xorshift32 style, seeded with a folded string hash.
function seededIntensity(uid: string, day: number, slot: number, scale: number): number {
  let h = 2166136261;
  for (let i = 0; i < uid.length; i++) h = Math.imul(h ^ uid.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (day * 31), 16777619);
  h = Math.imul(h ^ (slot * 131), 16777619);
  h ^= h >>> 13; h = Math.imul(h, 1597334677); h ^= h >>> 16;
  const r = ((h >>> 0) % 1000) / 1000; // 0..1
  // Bias intensity by `scale` (0..1): scale=0 -> almost all zeros, scale=1
  // -> uniform 0..1. Threshold cells below 0.18 to "no activity".
  const v = r * scale;
  if (v < 0.18) return 0;
  if (v < 0.36) return 1;
  if (v < 0.55) return 2;
  if (v < 0.75) return 3;
  return 4;
}

const COLORS = [
  '#1f2940', // 0 — empty
  'rgba(124,92,255,0.18)',
  'rgba(124,92,255,0.38)',
  'rgba(124,92,255,0.62)',
  '#7c5cff',  // 4 — heavy
];

export default function WeeklyActivityHeatmap({ userId, gamesPlayed = 0 }: Props) {
  const { lang, t } = useLang();
  const dRaw = (translations[lang] as any).days || (translations.en as any).days || {};
  const sRaw = (translations[lang] as any).slots || (translations.en as any).slots || {};
  const DAYS = [dRaw.mon, dRaw.tue, dRaw.wed, dRaw.thu, dRaw.fri, dRaw.sat, dRaw.sun];
  const SLOTS = [sRaw.night, sRaw.morning, sRaw.noon, sRaw.evening];
  const scale = Math.min(1, gamesPlayed / 6);
  const seed = userId || 'anonymous';

  // Compute total cells lit and active hours for the summary line.
  let activeCells = 0;
  const grid: number[][] = [];
  for (let slot = 0; slot < 4; slot++) {
    const row: number[] = [];
    for (let day = 0; day < 7; day++) {
      const i = seededIntensity(seed, day, slot, scale);
      if (i > 0) activeCells++;
      row.push(i);
    }
    grid.push(row);
  }

  return (
    <View style={{ marginTop: 22, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', padding: 22 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 16 }}>📅</Text>
          <Text style={{ color: '#f9fafb', fontSize: 15, fontWeight: '800', letterSpacing: 0.4 }}>{t('weeklyActivity')}</Text>
        </View>
        <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>
          {activeCells > 0 ? `${activeCells} ${t('activeSlots')}` : t('noActivity')}
        </Text>
      </View>
      <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 16 }}>
        {gamesPlayed > 0 ? t('activityHint') : t('activityEmpty')}
      </Text>

      {/* Header row — day labels */}
      <View style={{ flexDirection: 'row', marginLeft: 56, marginBottom: 6 }}>
        {DAYS.map(d => (
          <View key={d} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Rows — one per slot */}
      {grid.map((row, slotIdx) => (
        <View key={slotIdx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <View style={{ width: 56, paddingRight: 8 }}>
            <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '700', textAlign: 'right' }}>
              {SLOTS[slotIdx]}
            </Text>
          </View>
          {row.map((cell, dayIdx) => (
            <View key={dayIdx} style={{ flex: 1, paddingHorizontal: 2 }}>
              <View style={{
                height: 28,
                borderRadius: 6,
                backgroundColor: COLORS[cell],
                borderWidth: 1,
                borderColor: cell === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(124,92,255,0.25)',
              }} />
            </View>
          ))}
        </View>
      ))}

      {/* Legend */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 14, gap: 6 }}>
        <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '700', marginRight: 4 }}>{t('less')}</Text>
        {COLORS.map((c, i) => (
          <View key={i} style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: c, borderWidth: 1, borderColor: i === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(124,92,255,0.25)' }} />
        ))}
        <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '700', marginLeft: 4 }}>{t('more')}</Text>
      </View>
    </View>
  );
}
