/**
 * SkillRadarChart — Steam-style 5-axis player skill radar.
 *
 * Renders an SVG pentagon with axes:
 *   1. Speed       — derived from avgTime per win (lower = better)
 *   2. Accuracy    — gamesWon / gamesPlayed
 *   3. Streak      — bestStreak normalized to 30
 *   4. Volume      — gamesPlayed normalized to 100
 *   5. Daily       — current daily streak normalized to 14
 *
 * Each metric maps to 0..1. The filled polygon is the user's skill shape.
 * Helps the user see at-a-glance which skill they're strongest/weakest at.
 *
 * Mounted on /stats desktop only. Pure derivation from existing stats blob,
 * no backend changes.
 */
import { View, Text } from 'react-native';
import Svg, { Polygon, Line, Circle, Text as SvgText } from 'react-native-svg';
import { useLang } from '../utils/LanguageContext';

type Stats = {
  gamesPlayed?: number;
  gamesWon?: number;
  totalTime?: number;
  bestStreak?: number;
  perfectGames?: number;
  currentStreak?: number;
};

type Props = {
  stats?: Stats | null;
  dailyStreak?: number;
};

const W = 360;
const H = 320;
const CX = W / 2;
const CY = H / 2 + 10;
const R = 110;
const RINGS = 4;

function angleFor(i: number): number {
  return -Math.PI / 2 + (i * 2 * Math.PI) / 5;
}

function xy(i: number, r: number): [number, number] {
  return [CX + Math.cos(angleFor(i)) * r, CY + Math.sin(angleFor(i)) * r];
}

export default function SkillRadarChart({ stats, dailyStreak = 0 }: Props) {
  const { t } = useLang();
  const gp = stats?.gamesPlayed ?? 0;
  const gw = stats?.gamesWon ?? 0;
  const avg = gw > 0 ? (stats?.totalTime ?? 0) / gw : 0;

  // Each axis normalized to 0..1. Empty profile shows a tiny seed shape
  // (5%) instead of a degenerate dot at the center.
  const SEED = 0.05;
  const speed    = avg > 0 ? Math.max(SEED, Math.min(1, 600 / avg)) : SEED;        // 10min target
  const accuracy = gp > 0 ? Math.max(SEED, gw / gp) : SEED;
  const streak   = Math.max(SEED, Math.min(1, (stats?.bestStreak ?? 0) / 30));
  const volume   = Math.max(SEED, Math.min(1, gp / 100));
  const daily    = Math.max(SEED, Math.min(1, dailyStreak / 14));

  const labels = [t('axisSpeed'), t('axisAccuracy'), t('axisStreak'), t('axisVolume'), t('axisDaily')];
  const values = [speed, accuracy, streak, volume, daily];

  const polyPoints = values
    .map((v, i) => {
      const [x, y] = xy(i, R * v);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const totalScore = Math.round((values.reduce((a, b) => a + b, 0) / 5) * 100);

  return (
    <View style={{ marginTop: 22, padding: 22, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 16 }}>🎯</Text>
          <Text style={{ color: '#f9fafb', fontSize: 14, fontWeight: '800', letterSpacing: 0.4 }}>{t('skillRadar')}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
          <Text style={{ color: '#4ade80', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>{totalScore}</Text>
          <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '700' }}>/100</Text>
        </View>
      </View>
      <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 14 }}>
        {t('skillRadarHint')}
      </Text>

      <View style={{ alignItems: 'center' }}>
        <Svg width={W} height={H}>
          {/* Concentric rings */}
          {Array.from({ length: RINGS }).map((_, ringIdx) => {
            const ring = (ringIdx + 1) / RINGS;
            const pts = Array.from({ length: 5 })
              .map((_, i) => {
                const [x, y] = xy(i, R * ring);
                return `${x.toFixed(1)},${y.toFixed(1)}`;
              })
              .join(' ');
            return (
              <Polygon
                key={ringIdx}
                points={pts}
                fill="transparent"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
              />
            );
          })}
          {/* Spokes */}
          {Array.from({ length: 5 }).map((_, i) => {
            const [x, y] = xy(i, R);
            return (
              <Line
                key={`spoke${i}`}
                x1={CX} y1={CY} x2={x} y2={y}
                stroke="rgba(255,255,255,0.05)" strokeWidth={1}
              />
            );
          })}
          {/* User polygon */}
          <Polygon
            points={polyPoints}
            fill="rgba(74,222,128,0.22)"
            stroke="#4ade80"
            strokeWidth={2}
          />
          {/* Vertex dots */}
          {values.map((v, i) => {
            const [x, y] = xy(i, R * v);
            return <Circle key={`dot${i}`} cx={x} cy={y} r={3.5} fill="#4ade80" />;
          })}
          {/* Axis labels */}
          {labels.map((label, i) => {
            const [x, y] = xy(i, R + 22);
            const anchor = i === 0 ? 'middle' : i === 1 || i === 4 ? (i === 1 ? 'start' : 'start') : i === 2 || i === 3 ? 'end' : 'middle';
            // Simpler: middle for top/bottom, start for right, end for left
            const isRight = Math.cos(angleFor(i)) > 0.2;
            const isLeft = Math.cos(angleFor(i)) < -0.2;
            const ta = isRight ? 'start' : isLeft ? 'end' : 'middle';
            return (
              <SvgText
                key={`l${i}`}
                x={x} y={y}
                fontSize={11} fill="#cbd5e1" textAnchor={ta as any}
                fontWeight="700"
              >
                {label}
              </SvgText>
            );
          })}
          {/* Score value labels next to each axis label */}
          {values.map((v, i) => {
            const [x, y] = xy(i, R + 36);
            const isRight = Math.cos(angleFor(i)) > 0.2;
            const isLeft = Math.cos(angleFor(i)) < -0.2;
            const ta = isRight ? 'start' : isLeft ? 'end' : 'middle';
            return (
              <SvgText
                key={`v${i}`}
                x={x} y={y}
                fontSize={9} fill="#4ade80" textAnchor={ta as any}
                fontWeight="900"
              >
                {Math.round(v * 100)}
              </SvgText>
            );
          })}
        </Svg>
      </View>
    </View>
  );
}
