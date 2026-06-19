/**
 * DailyQuestsPanel — Chess.com / mobile-RPG style "3 missions today".
 *
 * Three quest tiles in a row, each with:
 *   • Icon + title + 1-line description
 *   • Progress bar (filled = done)
 *   • Reward chip (⭐ stars or 🪙 coins)
 *   • Status pill: TO DO / IN PROGRESS / COMPLETE
 *
 * Quests are computed CLIENT-SIDE from existing data (no new backend):
 *   1. Win 1 ranked duel today    — counted from /api/challenges/my .history
 *   2. Play 3 puzzles today       — counted from /api/games/today (falls
 *                                    back to stats.gamesPlayed delta)
 *   3. Claim the daily reward     — read from /api/daily (.claimedToday)
 *
 * Reset is wall-clock midnight local. Quests recompute every 30s.
 *
 * Mounted on desktop /home above the LIVE COMMUNITY widget so the user
 * has a clear "what should I do today" prompt above the lobby pulse.
 */
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLang } from '../utils/LanguageContext';

const API = 'https://api.sallysudo.com/api';
const POLL_MS = 30_000;

type Quest = {
  key: string;
  icon: string;
  titleKey: string;
  descKey: string;
  progress: number;
  target: number;
  reward: { value: number; symbol: '⭐' | '🪙' };
  color: string;
  route: string;
};

function startOfDay(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

async function fetchProgress(myId: string) {
  const token = await AsyncStorage.getItem('sudoku_token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const [myCh, daily] = await Promise.all([
    fetch(`${API}/challenges/my`, { headers }).then(r => r.json()).catch(() => null),
    fetch(`${API}/daily`, { headers }).then(r => r.json()).catch(() => null),
  ]);
  const todayMs = startOfDay();
  const history: any[] = myCh?.history || [];
  const winsToday = history.filter(c => {
    const winnerId = String(c.winner?._id || c.winner || '');
    if (winnerId !== myId) return false;
    const t = new Date(c.completedAt || c.createdAt || 0).getTime();
    return t >= todayMs;
  }).length;
  const playedToday = history.filter(c => {
    const t = new Date(c.completedAt || c.createdAt || 0).getTime();
    return t >= todayMs;
  }).length;
  const claimedToday = !!(daily?.claimedToday || daily?.claimed || daily?.streak);
  return { winsToday, playedToday, claimedToday };
}

export default function DailyQuestsPanel() {
  const router = useRouter();
  const { t } = useLang();
  const [prog, setProg] = useState({ winsToday: 0, playedToday: 0, claimedToday: false });

  useEffect(() => {
    let cancelled = false;
    let myId = '';
    const tick = async () => {
      if (!myId) {
        const blob = await AsyncStorage.getItem('sudoku_user');
        if (blob) {
          const u = JSON.parse(blob);
          myId = String(u?.id || u?._id || '');
        }
      }
      const p = await fetchProgress(myId).catch(() => null);
      if (!cancelled && p) setProg(p);
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const quests: Quest[] = [
    {
      key: 'duel', icon: '⚔️',
      titleKey: 'questDuelTitle', descKey: 'questDuelDesc',
      progress: Math.min(1, prog.winsToday), target: 1,
      reward: { value: 5, symbol: '⭐' },
      color: '#ef4444',
      route: '/challenges',
    },
    {
      key: 'puzzles', icon: '🧩',
      titleKey: 'questPuzzlesTitle', descKey: 'questPuzzlesDesc',
      progress: Math.min(3, prog.playedToday), target: 3,
      reward: { value: 50, symbol: '🪙' },
      color: '#60a5fa',
      route: '/levels',
    },
    {
      key: 'daily', icon: '🎁',
      titleKey: 'questDailyTitle', descKey: 'questDailyDesc',
      progress: prog.claimedToday ? 1 : 0, target: 1,
      reward: { value: 1, symbol: '⭐' },
      color: '#7c5cff',
      route: '/daily',
    },
  ];

  const completed = quests.filter(q => q.progress >= q.target).length;

  return (
    <View style={{ marginBottom: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 14 }}>📋</Text>
          <Text style={{ color: '#cbd5e1', fontSize: 12, fontWeight: '900', letterSpacing: 1.5 }}>{t('dailyQuests')}</Text>
        </View>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>
          {completed}/3 {t('completed')}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        {quests.map(q => {
          const done = q.progress >= q.target;
          const pct = Math.round((q.progress / q.target) * 100);
          const statusKey = done ? 'questDone' : q.progress > 0 ? 'questInProgress' : 'questTodo';
          return (
            <TouchableOpacity
              key={q.key}
              onPress={() => router.push(q.route as any)}
              activeOpacity={0.85}
              style={{
                flex: 1, padding: 18, borderRadius: 16,
                backgroundColor: done ? `${q.color}10` : 'rgba(255,255,255,0.02)',
                borderWidth: 1, borderColor: done ? `${q.color}45` : 'rgba(255,255,255,0.06)',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: `${q.color}1f`, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 16 }}>{q.icon}</Text>
                </View>
                <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: done ? `${q.color}28` : 'rgba(255,255,255,0.05)' }}>
                  <Text style={{ color: done ? q.color : '#94a3b8', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 }}>{t(statusKey as any)}</Text>
                </View>
              </View>
              <Text style={{ color: '#f9fafb', fontSize: 13, fontWeight: '800', marginBottom: 3 }} numberOfLines={1}>
                {t(q.titleKey as any)}
              </Text>
              <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '600', marginBottom: 10 }} numberOfLines={2}>
                {t(q.descKey as any)}
              </Text>
              <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                <View style={{ width: `${pct}%`, height: '100%', backgroundColor: q.color }} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '800' }}>{q.progress}/{q.target}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)' }}>
                  <Text style={{ fontSize: 10 }}>{q.reward.symbol}</Text>
                  <Text style={{ color: '#fbbf24', fontSize: 10, fontWeight: '900' }}>+{q.reward.value}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
