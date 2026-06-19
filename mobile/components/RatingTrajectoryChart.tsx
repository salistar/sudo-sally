/**
 * RatingTrajectoryChart — inline SVG line chart of stars over the last 14 days.
 *
 * Derives the trajectory client-side from /api/challenges/my .history: each
 * finished win counts as +1 star (matches the same heuristic the leaderboard
 * uses). The chart shows cumulative stars day-by-day so the user sees their
 * growth curve at a glance.
 *
 * Mounted on /profile desktop only (phone keeps the lighter profile layout).
 * No backend changes — pure client derivation from existing history payload.
 */
import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLang } from '../utils/LanguageContext';

const API = 'https://api.sallysudo.com/api';
const DAYS = 14;
const W = 720;
const H = 180;
const PAD_X = 36;
const PAD_TOP = 18;
const PAD_BOT = 26;

type Point = { day: number; stars: number; label: string };

async function fetchSeries(): Promise<Point[]> {
  try {
    const token = await AsyncStorage.getItem('sudoku_token');
    const userBlob = await AsyncStorage.getItem('sudoku_user');
    if (!token) return [];
    const me = userBlob ? JSON.parse(userBlob) : null;
    const myId = String(me?.id || me?._id || '');
    const j = await fetch(`${API}/challenges/my`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .catch(() => null);
    const history: any[] = j?.history || [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayMs = 24 * 3600 * 1000;
    const buckets = new Array(DAYS).fill(0);

    for (const c of history) {
      const winnerId = String(c.winner?._id || c.winner || '');
      if (!winnerId || winnerId !== myId) continue;
      const finishedAt = c.completedAt || c.createdAt;
      if (!finishedAt) continue;
      const d = new Date(finishedAt);
      d.setHours(0, 0, 0, 0);
      const daysAgo = Math.floor((today.getTime() - d.getTime()) / dayMs);
      if (daysAgo < 0 || daysAgo >= DAYS) continue;
      buckets[DAYS - 1 - daysAgo] += 1;
    }

    let cum = 0;
    return buckets.map((win, i) => {
      cum += win;
      const d = new Date(today.getTime() - (DAYS - 1 - i) * dayMs);
      return {
        day: i,
        stars: cum,
        label: `${d.getDate()}/${d.getMonth() + 1}`,
      };
    });
  } catch {
    return [];
  }
}

export default function RatingTrajectoryChart() {
  const { t } = useLang();
  const [series, setSeries] = useState<Point[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSeries().then(s => { if (!cancelled) setSeries(s); });
    return () => { cancelled = true; };
  }, []);

  if (series === null) {
    return (
      <View style={{ marginTop: 22, padding: 22, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
        <Text style={{ color: '#64748b', fontSize: 12, textAlign: 'center' }}>{t('loading')}</Text>
      </View>
    );
  }

  const maxStars = Math.max(1, ...series.map(p => p.stars));
  const chartW = W - PAD_X * 2;
  const chartH = H - PAD_TOP - PAD_BOT;
  const xFor = (i: number) => PAD_X + (i / Math.max(1, DAYS - 1)) * chartW;
  const yFor = (s: number) => PAD_TOP + chartH - (s / maxStars) * chartH;

  const pathD = series
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(p.stars).toFixed(1)}`)
    .join(' ');
  const areaD = pathD + ` L ${xFor(DAYS - 1).toFixed(1)} ${PAD_TOP + chartH} L ${xFor(0).toFixed(1)} ${PAD_TOP + chartH} Z`;

  const totalWins = series[series.length - 1]?.stars || 0;
  const isFlat = series.every(p => p.stars === 0);

  return (
    <View style={{ marginTop: 22, padding: 22, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 16 }}>📈</Text>
          <Text style={{ color: '#f9fafb', fontSize: 14, fontWeight: '800', letterSpacing: 0.4 }}>{t('ratingTrajectory')}</Text>
        </View>
        <Text style={{ color: '#7c5cff', fontSize: 12, fontWeight: '900' }}>+{totalWins} ⭐ / {DAYS}j</Text>
      </View>
      <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 14 }}>
        {isFlat ? t('noWinYet14d') : t('cumulativeStars')}
      </Text>

      <View style={{ alignItems: 'center' }}>
        <Svg width={W} height={H}>
          {/* Y gridlines */}
          {[0, 0.5, 1].map((f, i) => (
            <Line
              key={i}
              x1={PAD_X} x2={W - PAD_X}
              y1={PAD_TOP + chartH * (1 - f)} y2={PAD_TOP + chartH * (1 - f)}
              stroke="rgba(255,255,255,0.05)" strokeWidth={1}
            />
          ))}
          {/* Area fill */}
          {!isFlat && <Path d={areaD} fill="rgba(124,92,255,0.10)" />}
          {/* Line */}
          <Path d={pathD} stroke="#7c5cff" strokeWidth={2.5} fill="none" />
          {/* Dots */}
          {series.map((p, i) => (
            <Circle key={i} cx={xFor(i)} cy={yFor(p.stars)} r={p.stars > 0 ? 3.5 : 2} fill={p.stars > 0 ? '#7c5cff' : 'rgba(255,255,255,0.15)'} />
          ))}
          {/* X labels (every 3rd) */}
          {series.map((p, i) => (
            i % 3 === 0 || i === DAYS - 1 ? (
              <SvgText
                key={`l${i}`}
                x={xFor(i)} y={H - 8}
                fontSize={10} fill="#64748b" textAnchor="middle"
                fontWeight="600"
              >
                {p.label}
              </SvgText>
            ) : null
          ))}
          {/* Max marker */}
          <SvgText
            x={PAD_X - 6} y={PAD_TOP + 4}
            fontSize={10} fill="#94a3b8" textAnchor="end" fontWeight="700"
          >
            {maxStars}
          </SvgText>
          <SvgText
            x={PAD_X - 6} y={PAD_TOP + chartH + 4}
            fontSize={10} fill="#64748b" textAnchor="end" fontWeight="700"
          >
            0
          </SvgText>
        </Svg>
      </View>
    </View>
  );
}
