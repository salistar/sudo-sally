/**
 * StreakFlameMeter — Duolingo-style header flame counter.
 *
 * Always-visible chip in the WebShell header showing the user's current
 * daily-play streak. Mechanics:
 *   • Reads /api/stats/me .currentStreak (falls back to user.streak,
 *     then 0). Polls every 60s.
 *   • Flame icon pulses + saturates with streak length:
 *       0      → grey "🔥" + "Start" label
 *       1-3    → orange "🔥"
 *       4-13   → red-orange "🔥"
 *       14+    → red+gold "🔥" with a "LEGEND" mini-tag
 *   • If the user hasn't played today AND it's after 18:00 local time
 *     (so they're at risk of breaking the streak), the chip pulses red
 *     and adds a "AT RISK" mini-tag to nudge them to play.
 *
 * Mounted in WebShell header before the wallet pill on desktop. Hidden
 * when not signed in.
 */
import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLang } from '../utils/LanguageContext';

const API = 'https://api.sallysudo.com/api';
const POLL_MS = 60_000;

function streakColor(streak: number, atRisk: boolean): { bg: string; fg: string; ring: string } {
  if (atRisk) return { bg: 'rgba(239,68,68,0.16)', fg: '#ef4444', ring: 'rgba(239,68,68,0.45)' };
  if (streak >= 14) return { bg: 'rgba(251,191,36,0.18)', fg: '#fbbf24', ring: 'rgba(251,191,36,0.5)' };
  if (streak >= 4)  return { bg: 'rgba(249,115,22,0.16)', fg: '#fb923c', ring: 'rgba(249,115,22,0.4)' };
  if (streak >= 1)  return { bg: 'rgba(245,158,11,0.14)', fg: '#f59e0b', ring: 'rgba(245,158,11,0.35)' };
  return { bg: 'rgba(255,255,255,0.04)', fg: '#94a3b8', ring: 'rgba(255,255,255,0.08)' };
}

export default function StreakFlameMeter() {
  const router = useRouter();
  const { t } = useLang();
  const [streak, setStreak] = useState(0);
  const [playedToday, setPlayedToday] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const token = await AsyncStorage.getItem('sudoku_token');
        const userBlob = await AsyncStorage.getItem('sudoku_user');
        const me = userBlob ? JSON.parse(userBlob) : null;
        let curStreak = me?.stats?.currentStreak ?? me?.streak ?? 0;

        if (token) {
          const stats = await fetch(`${API}/stats/me`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .catch(() => null);
          if (stats?.stats) {
            curStreak = stats.stats.currentStreak ?? stats.stats.streak ?? curStreak;
          }
          const myCh = await fetch(`${API}/challenges/my`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .catch(() => null);
          const history: any[] = myCh?.history || [];
          const d = new Date(); d.setHours(0, 0, 0, 0);
          const todayMs = d.getTime();
          const playedSomethingToday = history.some(c =>
            new Date(c.completedAt || c.createdAt || 0).getTime() >= todayMs
          );
          if (!cancelled) setPlayedToday(playedSomethingToday);
        }
        if (!cancelled) setStreak(curStreak);
      } catch {}
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const hour = new Date().getHours();
  const atRisk = streak > 0 && !playedToday && hour >= 18;

  useEffect(() => {
    if (!atRisk) {
      pulse.setValue(0);
      return;
    }
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 800, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, [atRisk, pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const colors = streakColor(streak, atRisk);
  const showTag = streak >= 14 || atRisk;
  const tagLabel = atRisk ? t('atRisk') : t('legend');

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={() => router.push('/daily' as any)}
        activeOpacity={0.85}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 6,
          paddingHorizontal: 12, paddingVertical: 7,
          borderRadius: 16,
          backgroundColor: colors.bg,
          borderWidth: 1, borderColor: colors.ring,
        }}
      >
        <Text style={{ fontSize: 14 }}>🔥</Text>
        <Text style={{ color: colors.fg, fontSize: 13, fontWeight: '900' }}>{streak}</Text>
        {streak === 0 && (
          <Text style={{ color: colors.fg, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginLeft: 2 }}>
            {t('startStreak')}
          </Text>
        )}
        {showTag && (
          <View style={{ marginLeft: 4, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, backgroundColor: atRisk ? 'rgba(239,68,68,0.32)' : 'rgba(251,191,36,0.28)' }}>
            <Text style={{ color: atRisk ? '#fecaca' : '#fde68a', fontSize: 8, fontWeight: '900', letterSpacing: 0.6 }}>{tagLabel}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}
