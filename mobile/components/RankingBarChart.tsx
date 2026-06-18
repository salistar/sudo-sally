/**
 * RankingBarChart — horizontal animated bar chart for the leaderboard.
 *
 * Renders up to 10 horizontal bars (one per top player), each bar's width
 * proportional to the player's stars relative to the top of the leaderboard.
 * Bars animate from 0% to their target width in the first 700ms after mount
 * — gives /leaderboard a real data-viz feel instead of just a vertical list.
 *
 * Highlights:
 * - Rank 1 bar gets a brighter gradient (champion accent).
 * - The current user's row (if their userId matches the auth user) is
 *   subtly outlined so they can spot themselves in the bar pile.
 * - Empty state: a small CTA card if the board has zero entries.
 *
 * Mounted on /leaderboard desktop web only (isDesktopWeb gate) — phone keeps
 * the existing podium + vertical list.
 */
import { useEffect, useRef, useMemo } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export type RankRow = {
  rank: number;
  username: string;
  avatar: string;
  stars: number;
  level?: number;
  userId?: string;
};

type Props = {
  rows: RankRow[];
  currentUserId?: string;
};

export default function RankingBarChart({ rows, currentUserId }: Props) {
  const top = useMemo(() => rows.slice(0, 10), [rows]);
  const max = useMemo(() => Math.max(1, ...top.map(r => r.stars)), [top]);
  const fill = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fill.setValue(0);
    Animated.timing(fill, {
      toValue: 1,
      duration: 700,
      delay: 80,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [top, fill]);

  if (top.length === 0) {
    return (
      <View style={{ marginTop: 18, padding: 22, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', alignItems: 'center' }}>
        <Text style={{ fontSize: 28, marginBottom: 8 }}>🏆</Text>
        <Text style={{ color: '#f9fafb', fontSize: 14, fontWeight: '800', marginBottom: 4 }}>Classement à conquérir</Text>
        <Text style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
          Personne n'a encore gagné d'étoiles cette période.{'\n'}
          <Text style={{ color: '#4ade80', fontWeight: '700' }}>Joue une partie pour ouvrir le bal !</Text>
        </Text>
      </View>
    );
  }

  return (
    <View style={{ marginTop: 18, padding: 22, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 16 }}>📊</Text>
          <Text style={{ color: '#f9fafb', fontSize: 14, fontWeight: '800', letterSpacing: 0.4 }}>Top {top.length} par étoiles</Text>
        </View>
        <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>{max} ⭐ MAX</Text>
      </View>

      {top.map((r, i) => {
        const isYou = !!(currentUserId && r.userId && String(currentUserId) === String(r.userId));
        const isTop = i === 0;
        const targetPct = (r.stars / max) * 100;
        const widthAnim = fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${targetPct}%`] });
        const colors: [string, string] = isTop
          ? ['#fbbf24', '#f59e0b']
          : i < 3
          ? ['#4ade80', '#22c55e']
          : ['#3b82f6', '#2563eb'];

        return (
          <View
            key={r.username + i}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              paddingVertical: 8, paddingHorizontal: isYou ? 10 : 0,
              borderRadius: 10,
              borderWidth: isYou ? 1 : 0,
              borderColor: isYou ? 'rgba(74,222,128,0.45)' : 'transparent',
              backgroundColor: isYou ? 'rgba(74,222,128,0.06)' : 'transparent',
              marginBottom: 2,
            }}
          >
            {/* Rank pill */}
            <View style={{ width: 32, alignItems: 'center' }}>
              <Text style={{
                color: isTop ? '#fbbf24' : i < 3 ? '#4ade80' : '#94a3b8',
                fontSize: 14, fontWeight: '900', letterSpacing: -0.5,
              }}>
                #{r.rank}
              </Text>
            </View>
            {/* Avatar */}
            <View style={{
              width: 30, height: 30, borderRadius: 15,
              backgroundColor: 'rgba(255,255,255,0.05)',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 14 }}>{r.avatar}</Text>
            </View>
            {/* Name */}
            <View style={{ width: 120 }}>
              <Text style={{ color: '#f9fafb', fontSize: 12, fontWeight: '700' }} numberOfLines={1}>
                {r.username}
                {isYou && <Text style={{ color: '#4ade80', fontSize: 10, fontWeight: '800' }}>  · TOI</Text>}
              </Text>
            </View>
            {/* Bar */}
            <View style={{ flex: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 7, overflow: 'hidden' }}>
              <Animated.View style={{ width: widthAnim, height: '100%' }}>
                <LinearGradient
                  colors={colors}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ width: '100%', height: '100%', borderRadius: 7 }}
                />
              </Animated.View>
            </View>
            {/* Stars */}
            <View style={{ width: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
              <Text style={{ fontSize: 12 }}>⭐</Text>
              <Text style={{ color: isTop ? '#fbbf24' : '#f9fafb', fontSize: 13, fontWeight: '900' }}>
                {r.stars}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
