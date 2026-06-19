/**
 * WeeklyChampionsBoard — three side-by-side podium cards on /leaderboard.
 *
 * Each card shows a tiny top-3 podium (gold/silver/bronze) for a different
 * time window:
 *   - 🌅 Aujourd'hui — top of /api/leaderboard/weekly (proxy: no daily endpoint
 *     exists yet, we surface the most recent ranking as "today's" pulse)
 *   - 📅 Cette semaine — same /weekly endpoint, but framed as the week recap
 *   - 🏆 Légende — top of the global /api/leaderboard (all-time)
 *
 * Mounted on /leaderboard desktop only, just above the YOUR RANK card so the
 * top of the page reads "who are the champions" before "where am I".
 */
import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLang } from '../utils/LanguageContext';

const API = 'https://api.sallysudo.com/api';

type Row = { rank: number; username: string; avatar: string; stars: number };

async function fetchBoard(url: string): Promise<Row[]> {
  try {
    const token = await AsyncStorage.getItem('sudoku_token');
    const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!r.ok) return [];
    const j = await r.json();
    const raw: any[] = j?.leaderboard || [];
    return raw.slice(0, 3).map((u: any, i: number) => ({
      rank: u.rank ?? i + 1,
      username: u.username || '?',
      avatar: u.avatar || '🎮',
      stars: u.stars ?? 0,
    }));
  } catch {
    return [];
  }
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function WeeklyChampionsBoard() {
  const { t } = useLang();
  const PANELS = [
    { key: 'today', icon: '🌅', label: t('todayChamp'),    color: '#fbbf24', url: `${API}/leaderboard/weekly` },
    { key: 'week',  icon: '📅', label: t('thisWeekChamp'), color: '#7c5cff', url: `${API}/leaderboard/weekly` },
    { key: 'all',   icon: '🏆', label: t('legendChamp'),   color: '#a855f7', url: `${API}/leaderboard` },
  ];
  const [boards, setBoards] = useState<Record<string, Row[]>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = await Promise.all(PANELS.map(p => fetchBoard(p.url)));
      if (cancelled) return;
      const m: Record<string, Row[]> = {};
      PANELS.forEach((p, i) => { m[p.key] = results[i]; });
      setBoards(m);
    })();
    return () => { cancelled = true; };
  }, [t]);

  return (
    <View style={{ flexDirection: 'row', gap: 14, marginTop: 14, marginBottom: 4 }}>
      {PANELS.map(panel => {
        const rows = boards[panel.key] || [];
        return (
          <View
            key={panel.key}
            style={{
              flex: 1,
              padding: 18,
              borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.02)',
              borderWidth: 1,
              borderColor: `${panel.color}30`,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: `${panel.color}1f`, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 16 }}>{panel.icon}</Text>
              </View>
              <Text style={{ color: '#f9fafb', fontSize: 13, fontWeight: '800', letterSpacing: 0.4 }}>{panel.label}</Text>
            </View>

            {rows.length === 0 ? (
              <View style={{ paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ color: '#64748b', fontSize: 11, textAlign: 'center', lineHeight: 16 }}>
                  {t('noChampionsYet')}{'\n'}
                  <Text style={{ color: panel.color, fontWeight: '700' }}>{t('beFirst')}</Text>
                </Text>
              </View>
            ) : (
              rows.map((r, i) => (
                <View
                  key={r.username + i}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingVertical: 6,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: 'rgba(255,255,255,0.04)',
                  }}
                >
                  <Text style={{ fontSize: 14, width: 22, textAlign: 'center' }}>{MEDALS[i] || '•'}</Text>
                  <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 12 }}>{r.avatar}</Text>
                  </View>
                  <Text style={{ color: '#f9fafb', fontSize: 12, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                    {r.username}
                  </Text>
                  <Text style={{ color: panel.color, fontSize: 12, fontWeight: '900' }}>{r.stars}</Text>
                  <Text style={{ fontSize: 10 }}>⭐</Text>
                </View>
              ))
            )}
          </View>
        );
      })}
    </View>
  );
}
