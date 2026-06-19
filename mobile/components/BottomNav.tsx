/**
 * Persistent bottom navigation.
 *
 * Top puzzle apps (Sudoku.com, Block Blast, Royal Match) keep 4-5 anchors
 * always one tap away. We do the same: Home / Play / Lobby / Profile +
 * a center "PLAY NOW" button that drops you straight into the next puzzle.
 *
 * Visibility:
 *   • Renders on all "shell" screens (home, levels, daily, challenges,
 *     leaderboard, profile, stats, achievements, shop, settings)
 *   • Hides itself when the user is INSIDE an active game (/game,
 *     /challenge-game, /tutorial) — those screens own the full viewport.
 *
 * Drop it once at the bottom of each shell screen:
 *   <BottomNav active="home" />
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

export type NavKey = 'home' | 'play' | 'lobby' | 'profile' | 'settings';

const ITEMS: Array<{ key: NavKey; icon: string; label: string; route: string }> = [
  { key: 'home',     icon: '🏠', label: 'Home',     route: '/home' },
  { key: 'play',     icon: '🎮', label: 'Play',     route: '/levels' },
  { key: 'lobby',    icon: '⚔️', label: 'Lobby',    route: '/challenges' },
  { key: 'profile',  icon: '👤', label: 'Profile',  route: '/profile' },
  { key: 'settings', icon: '⚙️', label: 'Settings', route: '/settings' },
];

export default function BottomNav({ active }: { active?: NavKey }) {
  const router = useRouter();
  // v3.7 — On desktop-web the WebShell already shows a sidebar with the same
  // links, so the floating bottom bar would just clutter the bottom of the
  // viewport. Hide it on web viewports ≥ 1024 px.
  const { width } = useWindowDimensions();
  if (Platform.OS === 'web' && width >= 1024) return null;
  return (
    <LinearGradient
      colors={['rgba(10,10,26,0)', 'rgba(10,10,26,0.95)', '#0a0a1a']}
      style={styles.wrap}
    >
      <View style={styles.bar}>
        {ITEMS.map((it) => {
          const isActive = active === it.key;
          return (
            <TouchableOpacity
              key={it.key}
              style={styles.item}
              onPress={() => router.replace(it.route as any)}
              activeOpacity={0.7}
            >
              <Text style={[styles.icon, isActive && styles.iconActive]}>{it.icon}</Text>
              <Text style={[styles.label, isActive && styles.labelActive]}>{it.label}</Text>
              {isActive && <View style={styles.dot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingHorizontal: 8,
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(20,20,40,0.85)',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', position: 'relative', paddingVertical: 4 },
  icon: { fontSize: 22, opacity: 0.55 },
  iconActive: { opacity: 1 },
  label: { color: '#64748b', fontSize: 10, fontWeight: '600', marginTop: 2 },
  labelActive: { color: '#7c5cff', fontWeight: '800' },
  dot: { position: 'absolute', bottom: -6, width: 16, height: 3, borderRadius: 2, backgroundColor: '#7c5cff' },
});
