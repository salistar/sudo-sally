/**
 * HallOfFameWidget — Steam-style "all-time top 3" podium for /leaderboard.
 *
 * Fetches /api/leaderboard (top-N all-time) and renders the top 3 as a
 * gold-framed podium centerpiece — distinct from the regular Top-10 bar
 * chart above it. Each podium card has:
 *   • Large avatar with rank medal (🥇 🥈 🥉) overlay
 *   • Username
 *   • Big stars number + ⭐ symbol
 *   • A "legend tier" pill (LEGEND / CHAMPION / RISING) derived from
 *     stars / level so the visual hierarchy reads as a hall of fame.
 *
 * Mounted under the existing RankingBarChart on /leaderboard desktop.
 * Pure visual upgrade — same endpoint, different aesthetic.
 */
import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLang } from '../utils/LanguageContext';

const API = 'https://api.sallysudo.com/api';

type Row = {
  rank: number;
  username: string;
  avatar: string;
  stars: number;
  level: number;
};

async function fetchTopThree(): Promise<Row[]> {
  try {
    const token = await AsyncStorage.getItem('sudoku_token');
    const r = await fetch(`${API}/leaderboard`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!r.ok) return [];
    const j = await r.json();
    const raw: any[] = j?.leaderboard || [];
    return raw.slice(0, 3).map((u: any, i: number) => ({
      rank: u.rank ?? i + 1,
      username: u.username || '?',
      avatar: u.avatar || '🎮',
      stars: u.stars ?? 0,
      level: u.level ?? 1,
    }));
  } catch {
    return [];
  }
}

function tierFor(stars: number, t: (k: any) => string): { label: string; color: string } {
  if (stars >= 50) return { label: t('tierLegend'),   color: '#fbbf24' };
  if (stars >= 10) return { label: t('tierChampion'), color: '#a855f7' };
  return { label: t('tierRising'), color: '#4ade80' };
}

const MEDALS = ['🥇', '🥈', '🥉'];
const PODIUM_HEIGHTS = [140, 110, 90]; // tallest = champion

export default function HallOfFameWidget() {
  const { t } = useLang();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTopThree().then(r => { if (!cancelled) setRows(r); });
    return () => { cancelled = true; };
  }, []);

  if (rows === null) {
    return (
      <View style={{ marginTop: 22, padding: 22, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
        <Text style={{ color: '#64748b', fontSize: 12, textAlign: 'center' }}>{t('loading')}</Text>
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <View style={{ marginTop: 22, padding: 26, borderRadius: 18, backgroundColor: 'rgba(251,191,36,0.06)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)', alignItems: 'center' }}>
        <Text style={{ fontSize: 30, marginBottom: 8 }}>🏛️</Text>
        <Text style={{ color: '#fbbf24', fontSize: 14, fontWeight: '900', marginBottom: 4 }}>{t('hallOfFame')}</Text>
        <Text style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center' }}>{t('hallOfFameEmpty')}</Text>
      </View>
    );
  }

  // Visual podium order: 2nd, 1st, 3rd (centered champion)
  const podiumOrder: Array<{ row: Row; rankIdx: number }> = [];
  if (rows[1]) podiumOrder.push({ row: rows[1], rankIdx: 1 });
  if (rows[0]) podiumOrder.push({ row: rows[0], rankIdx: 0 });
  if (rows[2]) podiumOrder.push({ row: rows[2], rankIdx: 2 });

  return (
    <View
      style={{
        marginTop: 22,
        padding: 26,
        borderRadius: 22,
        backgroundColor: 'rgba(251,191,36,0.04)',
        borderWidth: 1,
        borderColor: 'rgba(251,191,36,0.3)',
        overflow: 'hidden',
      }}
    >
      <LinearGradient
        colors={['rgba(251,191,36,0.06)', 'transparent']}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 220 } as any}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 18 }}>🏛️</Text>
          <Text style={{ color: '#fbbf24', fontSize: 15, fontWeight: '900', letterSpacing: 1 }}>{t('hallOfFame')}</Text>
        </View>
        <Text style={{ color: '#94a3b8', fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>{t('allTimeTop3')}</Text>
      </View>
      <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 18 }}>
        {t('hallOfFameHint')}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 18 }}>
        {podiumOrder.map(({ row, rankIdx }, i) => {
          const tier = tierFor(row.stars, t);
          const podiumH = PODIUM_HEIGHTS[rankIdx];
          const isChampion = rankIdx === 0;
          return (
            <View key={row.username + i} style={{ alignItems: 'center', width: 200 }}>
              {/* Avatar with medal */}
              <View style={{ position: 'relative', marginBottom: 10 }}>
                <View style={{
                  width: isChampion ? 76 : 60, height: isChampion ? 76 : 60, borderRadius: 38,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderWidth: 2, borderColor: tier.color,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: isChampion ? 36 : 28 }}>{row.avatar}</Text>
                </View>
                <View style={{
                  position: 'absolute', top: -8, right: -8,
                  width: 28, height: 28, borderRadius: 14,
                  backgroundColor: '#0a0a1a',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 16 }}>{MEDALS[rankIdx]}</Text>
                </View>
              </View>
              {/* Username + level */}
              <Text style={{ color: '#f9fafb', fontSize: isChampion ? 14 : 12, fontWeight: '900' }} numberOfLines={1}>
                {row.username}
              </Text>
              <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '700' }}>
                {t('level')} {row.level}
              </Text>
              {/* Stars */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, marginBottom: 8 }}>
                <Text style={{ fontSize: 14 }}>⭐</Text>
                <Text style={{ color: tier.color, fontSize: isChampion ? 22 : 18, fontWeight: '900', letterSpacing: -0.5 }}>
                  {row.stars}
                </Text>
              </View>
              {/* Tier pill */}
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: `${tier.color}1f`, borderWidth: 1, borderColor: `${tier.color}45`, marginBottom: 10 }}>
                <Text style={{ color: tier.color, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 }}>{tier.label}</Text>
              </View>
              {/* Podium column */}
              <LinearGradient
                colors={[`${tier.color}40`, `${tier.color}12`]}
                start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                style={{
                  width: '100%', height: podiumH,
                  borderTopLeftRadius: 8, borderTopRightRadius: 8,
                  borderWidth: 1, borderBottomWidth: 0, borderColor: `${tier.color}50`,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{ color: tier.color, fontSize: isChampion ? 32 : 24, fontWeight: '900', letterSpacing: -1, opacity: 0.55 }}>
                  #{row.rank}
                </Text>
              </LinearGradient>
            </View>
          );
        })}
      </View>
    </View>
  );
}
