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

type Stats = {
  online: number;
  active: number;
  recentUsernames: string[];
  fetchedAt: number;
};

async function fetchStats(): Promise<Stats | null> {
  try {
    const token = await AsyncStorage.getItem('sudoku_token');
    if (!token) return null;
    const headers = { Authorization: `Bearer ${token}` };
    const [onlineRes, myRes] = await Promise.all([
      fetch(`${API}/challenges/users/online`, { headers }).then(r => r.json()).catch(() => null),
      fetch(`${API}/challenges/my`, { headers }).then(r => r.json()).catch(() => null),
    ]);
    const onlineUsers: any[] = onlineRes?.users || [];
    const active: any[] = myRes?.active || [];
    return {
      online: onlineUsers.length,
      active: active.length,
      recentUsernames: onlineUsers.slice(0, 3).map(u => u.username || '?'),
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
              <Text style={{ color: c.color, fontSize: 32, fontWeight: '900', letterSpacing: -0.5, marginBottom: 4 }}>
                {c.value}
              </Text>
              <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '600' }} numberOfLines={1}>
                {c.hint}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
