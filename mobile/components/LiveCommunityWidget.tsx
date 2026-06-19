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
import { useLang } from '../utils/LanguageContext';
import { socketService } from '../utils/socket';

const API = 'https://api.sallysudo.com/api';
const REFRESH_MS = 15_000;
const FEED_CAP = 12;

type FeedRow = {
  id: string;
  winnerName: string;
  winnerAvatar: string;
  loserName: string;
  loserAvatar: string;
  timeSpent: number; // seconds, lower is better
  errors: number;
  isDraw: boolean;
  difficulty?: string;
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

// Maps a GLOBAL activity-feed item (GET /api/challenges/feed/recent, or the
// socket 'activity:completed' payload) to the widget's existing FeedRow shape.
// Global items don't carry per-player time/errors, so those columns stay 0.
function rowFromFeedItem(it: any): FeedRow | null {
  if (!it) return null;
  const challenger = it.challenger || {};
  const challenged = it.challenged || {};
  const isDraw = !!it.isDraw;
  // Winner identity is matched by username (the feed has no ids); on a draw
  // there's no winner so we fall back to challenger-vs-challenged ordering.
  const winnerName = it.winner?.username;
  let w = challenger;
  let l = challenged;
  if (!isDraw && winnerName) {
    if (challenged.username === winnerName) { w = challenged; l = challenger; }
    else { w = challenger; l = challenged; }
  }
  return {
    id: String(it.id ?? `${challenger.username}-${challenged.username}-${it.at ?? ''}`),
    winnerName: w.username || '?',
    winnerAvatar: w.avatar || '🎮',
    loserName: l.username || '?',
    loserAvatar: l.avatar || '🎮',
    timeSpent: 0,
    errors: 0,
    isDraw,
    difficulty: it.difficulty,
  };
}

// Fetches the real GLOBAL recent-match feed (all players, newest first).
async function fetchGlobalFeed(): Promise<FeedRow[]> {
  try {
    const token = await AsyncStorage.getItem('sudoku_token');
    if (!token) return [];
    const res = await fetch(`${API}/challenges/feed/recent`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()).catch(() => null);
    const items: any[] = res?.feed || [];
    return items.slice(0, FEED_CAP).map(rowFromFeedItem).filter(Boolean) as FeedRow[];
  } catch {
    return [];
  }
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
    const onlineUsers = onlineUsersRaw.slice(0, 5).map(asUser);
    // NOTE: the recent-games feed is no longer derived here from the current
    // user's own history — it now comes from the GLOBAL feed state (see the
    // `feed` state + fetchGlobalFeed + 'activity:completed' socket handler).
    return {
      online: onlineUsersRaw.length,
      active: active.length,
      recentUsernames: onlineUsers.slice(0, 3).map(u => u.username),
      onlineUsers,
      feed: [],
      fetchedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

export default function LiveCommunityWidget() {
  const router = useRouter();
  const { t } = useLang();
  const [stats, setStats] = useState<Stats | null>(null);
  // GLOBAL recent-match feed — initial state from GET /challenges/feed/recent,
  // then kept live by the 'activity:completed' socket broadcast below.
  const [feed, setFeed] = useState<FeedRow[]>([]);
  // Count of matches that finished while the widget was mounted, surfaced as a
  // "live" bump next to the section title.
  const [liveCount, setLiveCount] = useState(0);
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

  // GLOBAL feed: initial fetch + live socket updates. The handler prepends each
  // freshly-finished match, guards against duplicate ids, caps the list, and
  // bumps the "live" counter. Falls back to an empty feed on any failure.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const initial = await fetchGlobalFeed();
      if (!cancelled) setFeed(initial);
    })();

    const onActivity = (data: any) => {
      const row = rowFromFeedItem(data);
      if (!row) return;
      setFeed(prev => {
        if (prev.some(r => r.id === row.id)) return prev; // de-dupe
        return [row, ...prev].slice(0, FEED_CAP);
      });
      setLiveCount(n => n + 1);
    };
    socketService.on('activity:completed', onActivity);
    return () => {
      cancelled = true;
      socketService.off('activity:completed', onActivity);
    };
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

  // Sprint-6 — skeleton shimmer while the first fetch is in-flight.
  // Animated opacity loop on a flat grey block so the cards don't snap from
  // "—" to a real number on first render.
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (stats) return; // only loop while loading
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, [shimmer, stats]);
  const shimmerOpacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.55] });

  const cards = [
    {
      key: 'online',
      icon: '🟢',
      label: t('playersOnline'),
      value: stats?.online ?? '—',
      hint: stats?.recentUsernames?.length
        ? stats.recentUsernames.join(' · ').slice(0, 60)
        : t('nobodyYetBeFirst'),
      color: '#4ade80',
      onPress: () => router.push('/challenges' as any),
    },
    {
      key: 'active',
      icon: '⚔️',
      label: t('matchesInProgress'),
      value: stats?.active ?? '—',
      hint: stats?.active
        ? `${stats.active} ${t('challengesInProgress')}`
        : t('startA1v1Now'),
      color: '#f59e0b',
      onPress: () => router.push('/challenges' as any),
    },
    {
      key: 'freshness',
      icon: '📡',
      label: t('lastUpdate'),
      value: stats ? `${age}s` : '—',
      hint: t('refreshEvery15s'),
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
        <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 }}>{t('liveCommunity')}</Text>
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
                {stats ? (
                  <Text style={{ color: c.color, fontSize: 32, fontWeight: '900', letterSpacing: -0.5 }}>
                    {c.value}
                  </Text>
                ) : (
                  // Sprint-6 — shimmer placeholder for the value
                  <Animated.View style={{ width: 70, height: 32, borderRadius: 8, backgroundColor: c.color, opacity: shimmerOpacity }} />
                )}
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

      {/* GLOBAL recent-match feed.
          Initial state from GET /api/challenges/feed/recent (all players,
          newest first), then kept live by the 'activity:completed' socket
          broadcast. Shows up to 12 finished games as "{winner} beat {loser}"
          or "{a} vs {b} · draw". Empty state CTA invites the user to be first. */}
      <View style={{ marginTop: 16, padding: 18, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Text style={{ fontSize: 14 }}>📜</Text>
          <Text style={{ color: '#f9fafb', fontSize: 13, fontWeight: '800', letterSpacing: 0.4 }}>{t('recentGames')}</Text>
          {feed.length > 0 && (
            <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginLeft: 'auto' }}>
              {liveCount > 0 ? `+${liveCount} live · ` : ''}{feed.length} {t('resultsCount')}
            </Text>
          )}
        </View>
        {feed.length === 0 ? (
          <View style={{ paddingVertical: 18, alignItems: 'center' }}>
            <Text style={{ color: '#64748b', fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
              {t('noGameFinished')}{'\n'}
              <Text style={{ color: '#4ade80', fontWeight: '700' }}>{t('beFirstToAppear')}</Text>
            </Text>
          </View>
        ) : (
          feed.map(row => {
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
                <Text style={{ color: row.isDraw ? '#94a3b8' : '#cbd5e1', fontSize: 11, fontWeight: '700' }}>
                  {row.difficulty || ''}
                </Text>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}
