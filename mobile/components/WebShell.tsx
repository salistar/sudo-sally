/**
 * WebShell — desktop-web layout wrapper.
 *
 * On a viewport ≥ 1024 px in the web build, wraps every screen with:
 *   • a 260 px fixed sidebar on the left (Home / Play / Lobby / Profile /
 *     Settings + Sign in / Register when logged out)
 *   • a 64 px sticky header at the top (brand mark + login state)
 *   • the route's content fills the remaining area, scrollable
 *
 * On mobile, on narrow web viewports (< 1024 px), or on native (iOS/Android),
 * the shell is a no-op pass-through — the existing mobile-shaped UI shows.
 *
 * Mounted once at the root in app/_layout.tsx.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SallyMascot from './SallyMascot';

const SIDEBAR_W = 260;
const HEADER_H  = 64;
const BREAKPOINT = 1024;

type NavItem = { key: string; icon: string; label: string; route: string };

const PRIMARY: NavItem[] = [
  { key: 'home',     icon: '🏠', label: 'Home',     route: '/home' },
  { key: 'play',     icon: '🎮', label: 'Play',     route: '/levels' },
  { key: 'daily',    icon: '⏱️', label: 'Daily',    route: '/daily' },
  { key: 'lobby',    icon: '⚔️', label: '1v1 Lobby', route: '/challenges' },
  { key: 'leader',   icon: '🏆', label: 'Leaderboard', route: '/leaderboard' },
];
const SECONDARY: NavItem[] = [
  { key: 'profile',  icon: '👤', label: 'Profile',     route: '/profile' },
  { key: 'stats',    icon: '📊', label: 'Stats',       route: '/stats' },
  { key: 'shop',     icon: '🛒', label: 'Shop',        route: '/shop' },
  { key: 'achv',     icon: '🌟', label: 'Achievements', route: '/achievements' },
  { key: 'settings', icon: '⚙️', label: 'Settings',    route: '/settings' },
];

export default function WebShell({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= BREAKPOINT;

  if (!isDesktopWeb) return <>{children}</>;

  return <DesktopShell>{children}</DesktopShell>;
}

function DesktopShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('sudoku_user');
        setUser(raw ? JSON.parse(raw) : null);
      } catch {}
    })();
  }, [path]);

  const isActive = (route: string) => path === route || path.startsWith(route + '/');

  const NavBtn = ({ item }: { item: NavItem }) => {
    const active = isActive(item.route);
    return (
      <TouchableOpacity
        onPress={() => router.replace(item.route as any)}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 12,
          paddingVertical: 11, paddingHorizontal: 14, borderRadius: 12,
          backgroundColor: active ? 'rgba(74,222,128,0.14)' : 'transparent',
          borderWidth: 1, borderColor: active ? 'rgba(74,222,128,0.35)' : 'transparent',
          marginBottom: 4,
        }}
      >
        <Text style={{ fontSize: 18 }}>{item.icon}</Text>
        <Text style={{ color: active ? '#4ade80' : '#cbd5e1', fontWeight: active ? '800' : '600', fontSize: 14 }}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#0a0a1a', minHeight: '100vh' as any }}>
      {/* SIDEBAR */}
      <View style={{
        width: SIDEBAR_W,
        backgroundColor: 'rgba(20,20,40,0.85)',
        borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.06)',
        paddingTop: 20, paddingBottom: 20, paddingHorizontal: 14,
        flexDirection: 'column',
      }}>
        <TouchableOpacity onPress={() => router.replace('/home')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24, paddingHorizontal: 6 }}>
          <SallyMascot size={42} mode="wink" />
          <View>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18, letterSpacing: 0.5 }}>SallySudo</Text>
            <Text style={{ color: '#4ade80', fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>v3.7 · WEB</Text>
          </View>
        </TouchableOpacity>

        <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginLeft: 14, marginBottom: 8 }}>PLAY</Text>
        {PRIMARY.map((it) => <NavBtn key={it.key} item={it} />)}

        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 14, marginHorizontal: 6 }} />

        <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginLeft: 14, marginBottom: 8 }}>YOU</Text>
        {SECONDARY.map((it) => <NavBtn key={it.key} item={it} />)}

        <View style={{ flex: 1 }} />

        {user ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12 }}>
            <Text style={{ fontSize: 28 }}>{user.avatar || '🎮'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }} numberOfLines={1}>{user.username}</Text>
              <Text style={{ color: '#94a3b8', fontSize: 11 }}>Lvl {user.level ?? 1} · ⭐ {user.stars ?? 0}</Text>
            </View>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <TouchableOpacity onPress={() => router.replace('/login' as any)}
              style={{ backgroundColor: '#4ade80', paddingVertical: 11, borderRadius: 12, alignItems: 'center' }}>
              <Text style={{ color: '#0a0a1a', fontWeight: '900', fontSize: 14 }}>Sign in</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.replace('/register' as any)}
              style={{ paddingVertical: 11, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
              <Text style={{ color: '#cbd5e1', fontWeight: '700', fontSize: 14 }}>Create account</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* MAIN COLUMN: HEADER + CONTENT */}
      <View style={{ flex: 1, flexDirection: 'column' }}>
        {/* HEADER */}
        <View style={{
          height: HEADER_H,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 24,
          backgroundColor: 'rgba(10,10,26,0.85)',
          borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
        }}>
          <Text style={{ color: '#94a3b8', fontSize: 13, fontWeight: '600' }}>
            {labelFor(path)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => router.replace('/daily' as any)}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: 'rgba(74,222,128,0.12)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)' }}>
              <Text style={{ color: '#4ade80', fontSize: 12, fontWeight: '800' }}>⏱️ Daily challenge</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.replace('/challenges' as any)}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' }}>
              <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '800' }}>⚔️ Play 1v1</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* CONTENT — plain View with overflow:auto (web-only). React Native's
            ScrollView would collapse children with `flex: 1` to height 0 because
            its content size is unbounded. A View with calc(100vh - 64px) and
            overflow:auto gives each route a real bounded height and lets it
            scroll internally when it overflows. */}
        <View style={{
          flex: 1,
          alignItems: 'center',
          paddingVertical: 16, paddingHorizontal: 24,
          overflow: 'auto',
          height: 'calc(100vh - 64px)',
        } as any}>
          <View style={{ width: '100%', maxWidth: 920, minHeight: '100%', flex: 1 } as any}>
            {children}
          </View>
        </View>
      </View>
    </View>
  );
}

function labelFor(path: string) {
  if (!path) return '';
  const map: Record<string, string> = {
    '/home': 'Home',
    '/levels': 'Levels',
    '/daily': 'Daily challenge',
    '/challenges': '1v1 lobby',
    '/leaderboard': 'Leaderboard',
    '/profile': 'Profile',
    '/stats': 'Statistics',
    '/shop': 'Shop',
    '/achievements': 'Achievements',
    '/settings': 'Settings',
    '/login': 'Sign in',
    '/register': 'Create account',
    '/welcome': 'Welcome',
  };
  return map[path] || '';
}
