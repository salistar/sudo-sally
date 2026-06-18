/**
 * NotificationsBell — desktop-web header inbox.
 *
 * Bell icon with a red unread badge that lives in the WebShell header.
 * Click opens a dropdown panel listing:
 *   • Pending 1v1 challenges (from /api/challenges/pending) — top of list,
 *     each row has the challenger avatar + "Accept" deeplink.
 *   • Recently completed challenges where the user won — surfaced as
 *     "You beat X" celebratory items (from /my .history filtered to wins
 *     in the last 24h).
 *
 * The bell polls every 25s. Counter shows the SUM of pending + fresh wins.
 * Click a row to deeplink to /challenges or /challenge-game.
 *
 * Mounted in WebShell.tsx header. Phone uses the existing in-app feedback
 * bell so no double UI.
 */
import { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLang } from '../utils/LanguageContext';

const API = 'https://api.sallysudo.com/api';
const POLL_MS = 25_000;
const FRESH_WIN_WINDOW_MS = 24 * 3600 * 1000;

type Item = {
  id: string;
  kind: 'challenge' | 'win';
  avatar: string;
  title: string;
  subtitle: string;
  href: string;
};

async function fetchInbox(myId: string, t: (k: any) => string): Promise<Item[]> {
  try {
    const token = await AsyncStorage.getItem('sudoku_token');
    if (!token) return [];
    const j = await fetch(`${API}/challenges/my`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .catch(() => null);
    const pending: any[] = j?.received || j?.pending || [];
    const history: any[] = j?.history || [];

    const items: Item[] = [];

    for (const c of pending.slice(0, 5)) {
      const ch = c.challenger || {};
      items.push({
        id: `p${String(c._id)}`,
        kind: 'challenge',
        avatar: ch.avatar || '🎮',
        title: `${ch.username || '?'} ${t('challengedYou')}`,
        subtitle: t('tapToOpenLobby'),
        href: '/challenges',
      });
    }

    const cutoff = Date.now() - FRESH_WIN_WINDOW_MS;
    for (const c of history.slice(0, 10)) {
      const winnerId = String(c.winner?._id || c.winner || '');
      if (winnerId !== myId) continue;
      const finished = new Date(c.completedAt || c.createdAt || 0).getTime();
      if (finished < cutoff) continue;
      const challenger = c.challenger || {};
      const challenged = c.challenged || {};
      const opp = String(challenger._id) === myId ? challenged : challenger;
      items.push({
        id: `w${String(c._id)}`,
        kind: 'win',
        avatar: opp.avatar || '🎮',
        title: `${t('youBeat')} ${opp.username || '?'}`,
        subtitle: t('victoryEarnedStar'),
        href: '/profile',
      });
    }

    return items.slice(0, 8);
  } catch {
    return [];
  }
}

export default function NotificationsBell() {
  const router = useRouter();
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const pulse = useRef(new Animated.Value(0)).current;

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
      const rows = await fetchInbox(myId, t);
      if (!cancelled) setItems(rows);
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [t]);

  useEffect(() => {
    if (items.length === 0) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, [items.length, pulse]);

  const badgeScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const unread = items.length;

  return (
    <View style={{ position: 'relative' }}>
      <TouchableOpacity
        onPress={() => setOpen(v => !v)}
        style={{
          width: 40, height: 40, borderRadius: 20,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: open ? 'rgba(74,222,128,0.16)' : 'rgba(255,255,255,0.04)',
          borderWidth: 1, borderColor: open ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.08)',
        }}
      >
        <Text style={{ fontSize: 16 }}>🔔</Text>
        {unread > 0 && (
          <Animated.View
            style={{
              position: 'absolute', top: 4, right: 4,
              minWidth: 16, height: 16, borderRadius: 8,
              backgroundColor: '#ef4444',
              alignItems: 'center', justifyContent: 'center',
              paddingHorizontal: 4,
              transform: [{ scale: badgeScale }],
            }}
          >
            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>{unread}</Text>
          </Animated.View>
        )}
      </TouchableOpacity>

      {open && (
        <View
          style={{
            position: 'absolute', top: 48, right: 0, width: 320,
            backgroundColor: 'rgba(15,15,30,0.98)',
            borderRadius: 16,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
            padding: 14,
            zIndex: 1000,
            shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 4 },
          } as any}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ color: '#f9fafb', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 }}>{t('inbox')}</Text>
            <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>{unread} {t('newCount')}</Text>
          </View>
          {items.length === 0 ? (
            <View style={{ paddingVertical: 22, alignItems: 'center' }}>
              <Text style={{ fontSize: 22, marginBottom: 6 }}>📭</Text>
              <Text style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center' }}>{t('inboxEmpty')}</Text>
            </View>
          ) : (
            items.map(it => (
              <TouchableOpacity
                key={it.id}
                onPress={() => { setOpen(false); router.push(it.href as any); }}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                  paddingVertical: 10, paddingHorizontal: 8,
                  borderRadius: 10,
                  marginBottom: 4,
                  borderLeftWidth: 3,
                  borderLeftColor: it.kind === 'challenge' ? '#ef4444' : '#4ade80',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                }}
              >
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 16 }}>{it.avatar}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#f9fafb', fontSize: 12, fontWeight: '800' }} numberOfLines={1}>{it.title}</Text>
                  <Text style={{ color: '#94a3b8', fontSize: 10, fontWeight: '600' }} numberOfLines={1}>{it.subtitle}</Text>
                </View>
                <Text style={{ fontSize: 11, color: it.kind === 'challenge' ? '#ef4444' : '#4ade80', fontWeight: '900' }}>
                  {it.kind === 'challenge' ? '⚔️' : '⭐'}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}
    </View>
  );
}
