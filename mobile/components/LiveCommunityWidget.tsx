/**
 * LiveCommunityWidget — desktop-web "the lobby is alive" pulse.
 *
 * Fetches /api/challenges/users/online + /api/challenges/active every 15s and
 * renders a 3-card row showing "X joueurs en ligne", "Y matches en cours",
 * and a "Last X seconds" freshness marker. The pulse animation on the green
 * dot prevents the row from looking like dead text.
 *
 * Mounted on desktop home only (mobile already has the bottom-nav lobby
 * badge for the same info, plus phone screen real estate is precious).
 */
import { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API = 'https://api.sallysudo.com/api';
const REFRESH_MS = 15_000;

type FeedRow = {
  id: string;
  winnerName: string;
  winnerAvatar: string;
  loserName: string;
  loserAvatar: string;
  timeSpent: number; // seconds, lower is better
  errors: number;
  isDraw: boolean;
};

type OnlineUser = {
  username: string;
  avatar: string;
  level: number;
};

type Stats = {
  online: number;
  active: number;
  recentUsernames: string[];
  onlineUsers: OnlineUser[];
  feed: FeedRow[];
  fetchedAt: number;
};

function asUser(u: any): OnlineUser {
  return {
    username: u?.username || '?',
    avatar: u?.avatar || '🎮',
    level: u?.level || 1,
  };
}

function rowFromChallenge(c: any): FeedRow | null {
  if (!c?.winner && !c?.isDraw) return null;
  const challenger = c.challenger || {};
  const challenged = c.challenged || {};
  const winnerId = c.winner?._id || c.winner;
  const w = String(challenger._id) === String(winnerId) ? challenger : challenged;
  const l = String(challenger._id) === String(winnerId) ? challenged : challenger;
  const winnerProgress = String(challenger._id) === String(winnerId) ? c.challengerProgress : c.challengedProgress;
  return {
    id: String(c._id),
    winnerName: w.username || '?',
    winnerAvatar: w.avatar || '🎮',
    loserName: l.username || '?',
    loserAvatar: l.avatar || '🎮',
    timeSpent: winnerProgress?.timeSpent || 0,
    errors: winnerProgress?.errors || 0,
    isDraw: !!c.isDraw,
  };
}

async function fetchStats(): Promise<Stats | null> {
  try {
    const token = await AsyncStorage.getItem('sudoku_token');
    if (!token) return null;
    const headers = { Authorization: `Bearer ${token}` };
    const [onlineRes, myRes] = await Promise.all([
      fetch(`${API}/challenges/users/online`, { headers }).then(r => r.json()).catch(() => null),
      fetch(`${API}/challenges/my`, { headers }).then(r => r.json()).catch(() => null),
    ]);
    const onlineUsersRaw: any[] = onlineRes?.users || [];
    const active: any[] = myRes?.active || [];
    const history: any[] = myRes?.history || [];
    const onlineUsers = onlineUsersRaw.slice(0, 5).map(asUser);
    const feed = history.slice(0, 5).map(rowFromChallenge).filter(Boolean) as FeedRow[];
    return {
      online: onlineUsersRaw.length,
      active: active.length,
      recentUsernames: onlineUsers.slice(0, 3).map(u => u.username),
      onlineUsers,
      feed,
      fetchedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

export default function LiveCommunityWidget() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [age, setAge] = useState(0);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const s = await fetchStats();
      if (!cancelled && s) setStats(s);
    };
    tick();
    const id = setInterval(tick, REFRESH_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Age ticker — recompute "X seconds ago" every second so the freshness
  // marker counts up between fetches instead of looking frozen.
  useEffect(() => {
    if (!stats) return;
    const id = setInterval(() => setAge(Math.floor((Date.now() - stats.fetchedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [stats?.fetchedAt]);

  // Pulse loop for the green dot.
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  const dotScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] });
  const dotOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 0.35] });

  const cards = [
    {
      key: 'online',
      icon: '🟢',
      label: 'JOUEURS EN LIGNE',
      value: stats?.online ?? '—',
      hint: stats?.recentUsernames?.length
        ? stats.recentUsernames.join(' · ').slice(0, 60)
        : 'Personne pour le moment — sois le premier !',
      color: '#4ade80',
      onPress: () => router.push('/challenges' as any),
    },
    {
      key: 'active',
      icon: '⚔️',
      label: 'MATCHES EN COURS',
      value: stats?.active ?? '—',
      hint: stats?.active
        ? `${stats.active} défi${stats.active === 1 ? '' : 's'} en cours`
        : 'Démarre un défi 1v1 maintenant',
      color: '#f59e0b',
      onPress: () => router.push('/challenges' as any),
    },
    {
      key: 'freshness',
      icon: '📡',
      label: 'MISE À JOUR',
      value: stats ? `${age}s` : '—',
      hint: 'Refresh auto toutes les 15s',
      color: '#3b82f6',
      onPress: () => undefined,
    },
  ];

  return (
    <View style={{ marginBottom: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#4ade80', justifyContent: 'center', alignItems: 'center' }}>
          <Animated.View style={{ position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#4ade80', transform: [{ scale: dotScale }], opacity: dotOpacity }} />
        </View>
        <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 }}>LIVE COMMUNITY</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        {cards.map(c => (
          <TouchableOpacity
            key={c.key}
            onPress={c.onPress}
            activeOpacity={c.onPress === undefined ? 1 : 0.85}
            style={{ flex: 1, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.01)']}
              style={{ paddingVertical: 18, paddingHorizontal: 18 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Text style={{ fontSize: 16 }}>{c.icon}</Text>
                <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }}>{c.label}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ color: c.color, fontSize: 32, fontWeight: '900', letterSpacing: -0.5 }}>
                  {c.value}
                </Text>
                {/* v3.11.5 sprint-5 — avatar stack on the "online" card so
                    the card shows WHO is playing right now, not just the
                    count. Up to 4 stacked emojis with -8px overlap. */}
                {c.key === 'online' && stats && stats.onlineUsers.length > 0 && (
                  <View style={{ flexDirection: 'row' }}>
                    {stats.onlineUsers.slice(0, 4).map((u, i) => (
                      <View
                        key={u.username + i}
                        style={{
                          width: 30, height: 30, borderRadius: 15,
                          backgroundColor: 'rgba(74,222,128,0.18)',
                          borderWidth: 1.5, borderColor: '#0a0a1a',
                          marginLeft: i === 0 ? 0 : -8,
                          alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 14 }}>{u.avatar}</Text>
                      </View>
                    ))}
                    {stats.online > 4 && (
                      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1.5, borderColor: '#0a0a1a', marginLeft: -8, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: '#94a3b8', fontSize: 10, fontWeight: '800' }}>+{stats.online - 4}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
              <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '600' }} numberOfLines={1}>
                {c.hint}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </View>

      {/* v3.11.5 sprint-5 — recent challenges feed.
          Reads /api/challenges/my .history slice via the same fetch, shows
          the last up to 5 finished games with winner / loser / time / errors.
          Empty state CTA invites the user to be the first to fill the feed. */}
      <View style={{ marginTop: 16, padding: 18, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Text style={{ fontSize: 14 }}>📜</Text>
          <Text style={{ color: '#f9fafb', fontSize: 13, fontWeight: '800', letterSpacing: 0.4 }}>Dernières parties</Text>
          {stats?.feed && stats.feed.length > 0 && (
            <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginLeft: 'auto' }}>
              {stats.feed.length} RÉSULTAT{stats.feed.length === 1 ? '' : 'S'}
            </Text>
          )}
        </View>
        {(!stats || stats.feed.length === 0) ? (
          <View style={{ paddingVertical: 18, alignItems: 'center' }}>
            <Text style={{ color: '#64748b', fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
              Aucune partie terminée pour le moment.{'\n'}
              <Text style={{ color: '#4ade80', fontWeight: '700' }}>Sois le premier à apparaître ici !</Text>
            </Text>
          </View>
        ) : (
          stats.feed.map(row => {
            const m = Math.floor(row.timeSpent / 60);
            const s = row.timeSpent % 60;
            const timeStr = m > 0 ? `${m}min ${String(s).padStart(2, '0')}s` : `${s}s`;
            return (
              <View
                key={row.id}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                  paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)',
                }}
              >
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(74,222,128,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 14 }}>{row.winnerAvatar}</Text>
                </View>
                <Text style={{ color: '#f9fafb', fontSize: 13, fontWeight: '800' }} numberOfLines={1}>{row.winnerName}</Text>
                {row.isDraw ? (
                  <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '700' }}>= égalité avec</Text>
                ) : (
                  <Text style={{ color: '#4ade80', fontSize: 11, fontWeight: '900' }}>WIN vs</Text>
                )}
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 11 }}>{row.loserAvatar}</Text>
                </View>
                <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '600' }} numberOfLines={1}>{row.loserName}</Text>
                <View style={{ flex: 1 }} />
                <Text style={{ color: '#cbd5e1', fontSize: 11, fontWeight: '700' }}>{timeStr}</Text>
                <View style={{ width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 4 }} />
                <Text style={{ color: row.errors > 0 ? '#ef4444' : '#4ade80', fontSize: 11, fontWeight: '700' }}>
                  {row.errors} ❌
                </Text>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}
