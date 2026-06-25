/**
 * ChallengeHistoryList — recent 1v1 challenges the current player has played.
 *
 * Reads /api/challenges/my .history (up to 20 most recent finished games),
 * renders each as a row showing:
 *   - Win/Loss/Draw badge
 *   - Opponent avatar + name
 *   - Time spent + errors of the current player's progress
 *   - Date relative to now ("aujourd'hui", "hier", "il y a 3 jours", ...)
 *
 * Empty state invites the user to start their first challenge.
 *
 * Mounted on /profile desktop web only. Phone keeps the lighter profile
 * layout because phone screen real estate is already tight.
 */
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLang } from '../utils/LanguageContext';
import { API_URL } from '../utils/api';

const API = API_URL;

type Row = {
  id: string;
  outcome: 'win' | 'loss' | 'draw';
  opponentName: string;
  opponentAvatar: string;
  myTime: number; // seconds
  myErrors: number;
  completedAt: string; // ISO
};

function relTime(iso: string): string {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const day = 24 * 3600 * 1000;
    if (ms < 60 * 1000) return "à l'instant";
    if (ms < 3600 * 1000) return `il y a ${Math.floor(ms / 60000)} min`;
    if (ms < day) return `il y a ${Math.floor(ms / 3600000)} h`;
    if (ms < 2 * day) return 'hier';
    if (ms < 7 * day) return `il y a ${Math.floor(ms / day)} j`;
    return new Date(iso).toLocaleDateString('fr-FR');
  } catch {
    return '';
  }
}

function fmtTime(seconds: number): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m${String(s).padStart(2, '0')}` : `${s}s`;
}

export default function ChallengeHistoryList() {
  const router = useRouter();
  const { t } = useLang();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await AsyncStorage.getItem('sudoku_token');
        const userBlob = await AsyncStorage.getItem('sudoku_user');
        if (!token) {
          if (!cancelled) setRows([]);
          return;
        }
        const me = userBlob ? JSON.parse(userBlob) : null;
        const myId = String(me?.id || me?._id || '');

        const j = await fetch(`${API}/challenges/my`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .catch(() => null);
        const history: any[] = j?.history || [];

        const mapped: Row[] = history.slice(0, 10).map(c => {
          const challenger = c.challenger || {};
          const challenged = c.challenged || {};
          const winnerId = String(c.winner?._id || c.winner || '');
          const meChallenger = String(challenger._id) === myId;
          const opponent = meChallenger ? challenged : challenger;
          const myProgress = meChallenger ? c.challengerProgress : c.challengedProgress;
          let outcome: Row['outcome'] = 'loss';
          if (c.isDraw) outcome = 'draw';
          else if (winnerId && winnerId === myId) outcome = 'win';
          return {
            id: String(c._id),
            outcome,
            opponentName: opponent.username || '?',
            opponentAvatar: opponent.avatar || '🎮',
            myTime: myProgress?.timeSpent || 0,
            myErrors: myProgress?.errors || 0,
            completedAt: c.completedAt || c.createdAt || new Date().toISOString(),
          };
        });
        if (!cancelled) setRows(mapped);
      } catch {
        if (!cancelled) setRows([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loading = rows === null;

  return (
    <View style={{ marginTop: 22, padding: 22, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 16 }}>⚔️</Text>
          <Text style={{ color: '#f9fafb', fontSize: 14, fontWeight: '800', letterSpacing: 0.4 }}>{t('yourLastDuels')}</Text>
        </View>
        {rows && rows.length > 0 && (
          <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>
            {rows.filter(r => r.outcome === 'win').length} {t('aggW')} · {rows.filter(r => r.outcome === 'loss').length} {t('aggD')} · {rows.filter(r => r.outcome === 'draw').length} {t('aggDraw')}
          </Text>
        )}
      </View>

      {loading ? (
        <Text style={{ color: '#64748b', fontSize: 12, textAlign: 'center', paddingVertical: 16 }}>{t('loading')}</Text>
      ) : rows.length === 0 ? (
        <View style={{ paddingVertical: 18, alignItems: 'center' }}>
          <Text style={{ color: '#64748b', fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 12 }}>
            {t('noDuelPlayed')}{'\n'}
            <Text style={{ color: '#7c5cff', fontWeight: '700' }}>{t('startFirst1v1')}</Text>
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/challenges' as any)}
            style={{ paddingHorizontal: 18, paddingVertical: 8, borderRadius: 16, backgroundColor: 'rgba(124,92,255,0.14)', borderWidth: 1, borderColor: 'rgba(124,92,255,0.35)' }}
          >
            <Text style={{ color: '#7c5cff', fontSize: 12, fontWeight: '800' }}>{t('open1v1Lobby')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        rows.map(r => {
          const colour = r.outcome === 'win' ? '#7c5cff' : r.outcome === 'draw' ? '#94a3b8' : '#ef4444';
          const tag = r.outcome === 'win' ? t('victoryTag') : r.outcome === 'draw' ? t('drawTag') : t('defeatTag');
          return (
            <View
              key={r.id}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)',
              }}
            >
              {/* Outcome tag */}
              <View style={{ width: 88, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: `${colour}1f`, borderWidth: 1, borderColor: `${colour}40`, alignItems: 'center' }}>
                <Text style={{ color: colour, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 }}>{tag}</Text>
              </View>
              {/* Opponent */}
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 14 }}>{r.opponentAvatar}</Text>
              </View>
              <Text style={{ color: '#f9fafb', fontSize: 13, fontWeight: '700', minWidth: 100 }} numberOfLines={1}>
                {r.opponentName}
              </Text>
              <View style={{ flex: 1 }} />
              {/* Stats */}
              <Text style={{ color: '#cbd5e1', fontSize: 11, fontWeight: '700' }}>{fmtTime(r.myTime)}</Text>
              <View style={{ width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.08)' }} />
              <Text style={{ color: r.myErrors > 0 ? '#ef4444' : '#7c5cff', fontSize: 11, fontWeight: '700' }}>
                {r.myErrors} ❌
              </Text>
              <View style={{ width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.08)' }} />
              <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '600', minWidth: 80, textAlign: 'right' }}>
                {relTime(r.completedAt)}
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
}
