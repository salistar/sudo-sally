/**
 * RematchPanel — "Play them again" row of last 5 unique opponents.
 *
 * Reads /api/challenges/my .history, picks the 5 most-recent UNIQUE
 * opponents (dedupe by username), and renders a horizontal row of
 * tiles. Each tile shows:
 *   • Opponent avatar + name
 *   • W-L vs them (from history)
 *   • REMATCH button → deeplinks to /challenges?to=<username> so the
 *     1v1 lobby can prefill the target.
 *
 * Mounted on /profile desktop only (after RatingTrajectoryChart and
 * ChallengeHistoryList) — gives the user a 1-tap path to re-engage.
 *
 * No backend changes — pure client derivation.
 */
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLang } from '../utils/LanguageContext';

const API = 'https://api.sallysudo.com/api';

type Opp = {
  username: string;
  avatar: string;
  wins: number;
  losses: number;
  draws: number;
  lastPlayed: number;
};

async function fetchOpponents(myId: string): Promise<Opp[]> {
  try {
    const token = await AsyncStorage.getItem('sudoku_token');
    if (!token) return [];
    const j = await fetch(`${API}/challenges/my`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .catch(() => null);
    const history: any[] = j?.history || [];
    const map = new Map<string, Opp>();
    for (const c of history) {
      const challenger = c.challenger || {};
      const challenged = c.challenged || {};
      const meChallenger = String(challenger._id) === myId;
      const opp = meChallenger ? challenged : challenger;
      const name = opp.username || '?';
      const ts = new Date(c.completedAt || c.createdAt || 0).getTime();
      const winnerId = String(c.winner?._id || c.winner || '');
      const isDraw = !!c.isDraw;
      const won = !isDraw && winnerId === myId;
      const lost = !isDraw && winnerId && winnerId !== myId;

      const cur = map.get(name) || {
        username: name,
        avatar: opp.avatar || '🎮',
        wins: 0, losses: 0, draws: 0,
        lastPlayed: 0,
      };
      if (isDraw) cur.draws += 1;
      else if (won) cur.wins += 1;
      else if (lost) cur.losses += 1;
      cur.lastPlayed = Math.max(cur.lastPlayed, ts);
      map.set(name, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.lastPlayed - a.lastPlayed)
      .slice(0, 5);
  } catch {
    return [];
  }
}

export default function RematchPanel() {
  const router = useRouter();
  const { t } = useLang();
  const [opps, setOpps] = useState<Opp[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const blob = await AsyncStorage.getItem('sudoku_user');
      const me = blob ? JSON.parse(blob) : null;
      const myId = String(me?.id || me?._id || '');
      const list = await fetchOpponents(myId);
      if (!cancelled) setOpps(list);
    })();
    return () => { cancelled = true; };
  }, []);

  if (opps === null) {
    return (
      <View style={{ marginTop: 22, padding: 22, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
        <Text style={{ color: '#64748b', fontSize: 12, textAlign: 'center' }}>{t('loading')}</Text>
      </View>
    );
  }

  if (opps.length === 0) {
    return (
      <View style={{ marginTop: 22, padding: 22, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', alignItems: 'center' }}>
        <Text style={{ fontSize: 26, marginBottom: 6 }}>🤝</Text>
        <Text style={{ color: '#f9fafb', fontSize: 13, fontWeight: '800', marginBottom: 4 }}>{t('rematchEmpty')}</Text>
        <Text style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', marginBottom: 12 }}>{t('rematchEmptyHint')}</Text>
        <TouchableOpacity
          onPress={() => router.push('/challenges' as any)}
          style={{ paddingHorizontal: 18, paddingVertical: 8, borderRadius: 16, backgroundColor: 'rgba(239,68,68,0.14)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)' }}
        >
          <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '800' }}>⚔️ {t('findOpponent')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ marginTop: 22, padding: 22, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 16 }}>🔁</Text>
          <Text style={{ color: '#f9fafb', fontSize: 14, fontWeight: '800', letterSpacing: 0.4 }}>{t('rematchTitle')}</Text>
        </View>
        <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>{opps.length} {t('opponentsCount')}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
        {opps.map(o => {
          const total = o.wins + o.losses + o.draws;
          const winRate = total > 0 ? Math.round((o.wins / total) * 100) : 0;
          const colour = o.wins > o.losses ? '#7c5cff' : o.losses > o.wins ? '#ef4444' : '#94a3b8';
          return (
            <View
              key={o.username}
              style={{
                width: 200, padding: 14, borderRadius: 14,
                backgroundColor: 'rgba(255,255,255,0.02)',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 16 }}>{o.avatar}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#f9fafb', fontSize: 12, fontWeight: '800' }} numberOfLines={1}>{o.username}</Text>
                  <Text style={{ color: colour, fontSize: 10, fontWeight: '900' }}>
                    {o.wins}{t('aggW')}-{o.losses}{t('aggD')}{o.draws > 0 ? `-${o.draws}${t('aggDraw')}` : ''}
                  </Text>
                </View>
                <Text style={{ color: colour, fontSize: 11, fontWeight: '900' }}>{winRate}%</Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push(`/challenges?to=${encodeURIComponent(o.username)}` as any)}
                style={{ paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.14)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)', alignItems: 'center' }}
              >
                <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '900', letterSpacing: 0.4 }}>⚔️ {t('rematchBtn')}</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );
}
