/**
 * ActiveDuelsWidget — desktop-web "your matches in progress" panel.
 *
 * Polls /api/challenges/my .active every 10s and shows each unfinished
 * duel as a strip with: opponent avatar+name, time elapsed, your progress
 * %, opponent progress %, and a "Reprendre / Resume / استئناف" CTA that
 * deeplinks to the challenge-game screen.
 *
 * Renders nothing when there's no active match (avoids dead-card noise on
 * empty home pages). Mounted on desktop /home above LiveCommunityWidget so
 * the user sees their own in-flight games before community pulse.
 */
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLang } from '../utils/LanguageContext';
import { API_URL } from '../utils/api';

const POLL_MS = 10_000;

type Duel = {
  id: string;
  opponentName: string;
  opponentAvatar: string;
  myPct: number;
  oppPct: number;
  elapsedSec: number;
  status: string;
};

function pct(progress: any): number {
  if (!progress) return 0;
  const filled = progress.filledCells ?? 0;
  const total = progress.totalCells ?? 81;
  return Math.min(100, Math.round((filled / total) * 100));
}

async function fetchActive(myId: string): Promise<Duel[]> {
  try {
    const token = await AsyncStorage.getItem('sudoku_token');
    if (!token) return [];
    const j = await fetch(`${API_URL}/challenges/my`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .catch(() => null);
    const active: any[] = j?.active || [];
    return active.map(c => {
      const challenger = c.challenger || {};
      const challenged = c.challenged || {};
      const meChallenger = String(challenger._id) === myId;
      const opp = meChallenger ? challenged : challenger;
      const myProg = meChallenger ? c.challengerProgress : c.challengedProgress;
      const oppProg = meChallenger ? c.challengedProgress : c.challengerProgress;
      const startedAt = c.startedAt ? new Date(c.startedAt).getTime() : Date.now();
      return {
        id: String(c._id),
        opponentName: opp.username || '?',
        opponentAvatar: opp.avatar || '🎮',
        myPct: pct(myProg),
        oppPct: pct(oppProg),
        elapsedSec: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
        status: c.status || 'playing',
      };
    });
  } catch {
    return [];
  }
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m${String(s).padStart(2, '0')}` : `${s}s`;
}

export default function ActiveDuelsWidget() {
  const router = useRouter();
  const { t } = useLang();
  const [duels, setDuels] = useState<Duel[]>([]);

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
      const rows = await fetchActive(myId);
      if (!cancelled) setDuels(rows);
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (duels.length === 0) return null;

  return (
    <View style={{ marginBottom: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Text style={{ fontSize: 14 }}>⚡</Text>
        <Text style={{ color: '#fbbf24', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 }}>
          {t('liveDuels')} · {duels.length}
        </Text>
      </View>
      {duels.map(d => (
        <View
          key={d.id}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 14,
            padding: 16, marginBottom: 8,
            borderRadius: 14,
            backgroundColor: 'rgba(251,191,36,0.06)',
            borderWidth: 1, borderColor: 'rgba(251,191,36,0.30)',
          }}
        >
          <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 20 }}>{d.opponentAvatar}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ color: '#f9fafb', fontSize: 14, fontWeight: '800' }}>
                {t('vsOpponent')} {d.opponentName}
              </Text>
              <Text style={{ color: '#fbbf24', fontSize: 11, fontWeight: '700' }}>⏱ {fmt(d.elapsedSec)}</Text>
            </View>
            {/* Dual progress bars */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                  <Text style={{ color: '#7c5cff', fontSize: 10, fontWeight: '700' }}>{t('you')}</Text>
                  <Text style={{ color: '#7c5cff', fontSize: 10, fontWeight: '900' }}>{d.myPct}%</Text>
                </View>
                <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{ width: `${d.myPct}%`, height: '100%', backgroundColor: '#7c5cff' }} />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                  <Text style={{ color: '#94a3b8', fontSize: 10, fontWeight: '700' }} numberOfLines={1}>{d.opponentName}</Text>
                  <Text style={{ color: '#94a3b8', fontSize: 10, fontWeight: '900' }}>{d.oppPct}%</Text>
                </View>
                <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{ width: `${d.oppPct}%`, height: '100%', backgroundColor: '#94a3b8' }} />
                </View>
              </View>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => router.push(`/challenge-game?id=${d.id}` as any)}
            style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#fbbf24' }}
          >
            <Text style={{ color: '#0a0a1a', fontSize: 12, fontWeight: '900', letterSpacing: 0.4 }}>{t('resumeDuel')}</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}
