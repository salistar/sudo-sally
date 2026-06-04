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
import { useLang } from '../utils/LanguageContext';

const SIDEBAR_W = 260;
const HEADER_H  = 64;
const BREAKPOINT = 1024;
const LANDING_URL = 'https://sudoku.gowithsally.com';

type NavItem = { key: string; icon: string; tKey: string; route: string };

// v3.10.0 — labels are now translation keys, resolved through useLang() at
// render time. Hard-coded "Home" / "Play" / "Settings" wouldn't reflect the
// user's chosen language.
const PRIMARY: NavItem[] = [
  { key: 'home',     icon: '🏠', tKey: 'home',          route: '/home' },
  { key: 'play',     icon: '🎮', tKey: 'play',          route: '/levels' },
  { key: 'daily',    icon: '⏱️', tKey: 'daily',         route: '/daily' },
  { key: 'lobby',    icon: '⚔️', tKey: 'lobby',         route: '/challenges' },
  { key: 'leader',   icon: '🏆', tKey: 'leaderboard',   route: '/leaderboard' },
];
const SECONDARY: NavItem[] = [
  { key: 'profile',  icon: '👤', tKey: 'profile',       route: '/profile' },
  { key: 'stats',    icon: '📊', tKey: 'stats',         route: '/stats' },
  { key: 'shop',     icon: '🛒', tKey: 'shop',          route: '/shop' },
  { key: 'achv',     icon: '🌟', tKey: 'achievements',  route: '/achievements' },
  { key: 'settings', icon: '⚙️', tKey: 'settings',      route: '/settings' },
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
  const { t } = useLang();
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
          {t(item.tKey as any)}
        </Text>
      </TouchableOpacity>
    );
  };

  // v3.10.0 — explicit sign-out clears the auth tokens + user blob, then
  // sends the visitor to the public landing page (where the Sign in /
  // Create account flows live).
  const handleSignOut = async () => {
    try {
      await AsyncStorage.multiRemove([
        'sudoku_token',
        'sudoku_auth_token',
        'sudoku_user',
      ]);
    } catch {}
    setUser(null);
    if (typeof window !== 'undefined') {
      window.location.href = LANDING_URL;
    } else {
      router.replace('/home' as any);
    }
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
        <TouchableOpacity
          onPress={() => {
            // v3.10.0 — brand mark in sidebar links to the marketing landing,
            // not the in-app /home. Lets visitors get back to the public site
            // (where Sign in / Create account / Download live) in one click.
            if (typeof window !== 'undefined') window.location.href = LANDING_URL;
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24, paddingHorizontal: 6 }}
        >
          <SallyMascot size={42} mode="wink" />
          <View>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18, letterSpacing: 0.5 }}>SallySudo</Text>
            <Text style={{ color: '#4ade80', fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>v3.10 · WEB</Text>
          </View>
        </TouchableOpacity>

        <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginLeft: 14, marginBottom: 8 }}>
          {t('play').toUpperCase()}
        </Text>
        {PRIMARY.map((it) => <NavBtn key={it.key} item={it} />)}

        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 14, marginHorizontal: 6 }} />

        <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginLeft: 14, marginBottom: 8 }}>
          {t('you').toUpperCase()}
        </Text>
        {SECONDARY.map((it) => <NavBtn key={it.key} item={it} />)}

        <View style={{ flex: 1 }} />

        {user ? (
          // v3.10.0 — logged in: show user pill + a dedicated Sign-out button.
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12 }}>
              <Text style={{ fontSize: 28 }}>{user.avatar || '🎮'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }} numberOfLines={1}>{user.username}</Text>
                <Text style={{ color: '#94a3b8', fontSize: 11 }}>Lvl {user.level ?? 1} · ⭐ {user.stars ?? 0}</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={handleSignOut}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                paddingVertical: 10, borderRadius: 12,
                borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)',
                backgroundColor: 'rgba(239,68,68,0.08)',
              }}
            >
              <Text style={{ fontSize: 15 }}>🚪</Text>
              <Text style={{ color: '#fca5a5', fontWeight: '700', fontSize: 13 }}>{t('signOut')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // v3.10.0 — logged out: don't render Sign in / Create account in the
          // sidebar anymore. Those entry points live on the public landing
          // page; the sidebar just nudges the visitor back to it.
          <TouchableOpacity
            onPress={() => { if (typeof window !== 'undefined') window.location.href = LANDING_URL; }}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              paddingVertical: 12, borderRadius: 12,
              backgroundColor: '#4ade80',
            }}
          >
            <Text style={{ fontSize: 15 }}>🌐</Text>
            <Text style={{ color: '#0a0a1a', fontWeight: '800', fontSize: 13 }}>SallySudo.com</Text>
          </TouchableOpacity>
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
            {labelFor(path, t)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {path !== '/daily' && (
              <TouchableOpacity onPress={() => router.replace('/daily' as any)}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: 'rgba(74,222,128,0.12)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)' }}>
                <Text style={{ color: '#4ade80', fontSize: 12, fontWeight: '800' }}>⏱️ {t('daily')}</Text>
              </TouchableOpacity>
            )}
            {path !== '/challenges' && (
              <TouchableOpacity onPress={() => router.replace('/challenges' as any)}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' }}>
                <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '800' }}>⚔️ 1v1</Text>
              </TouchableOpacity>
            )}
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
          paddingVertical: 24, paddingHorizontal: 32,
          overflowY: 'auto',
          overflowX: 'hidden',
          height: 'calc(100vh - 64px)',
        } as any}>
          <View style={{ width: '100%', maxWidth: 1240, minHeight: '100%' } as any}>
            {children}
          </View>
        </View>
      </View>
    </View>
  );
}

function labelFor(path: string, t: (k: any) => string) {
  if (!path) return '';
  const map: Record<string, string> = {
    '/home': t('home'),
    '/levels': t('levels'),
    '/daily': t('dailyChallenge'),
    '/challenges': t('lobby'),
    '/leaderboard': t('leaderboard'),
    '/profile': t('profile'),
    '/stats': t('stats'),
    '/shop': t('shop'),
    '/achievements': t('achievements'),
    '/settings': t('settings'),
    '/login': t('login'),
    '/register': t('createAccount'),
    '/welcome': t('welcome'),
  };
  return map[path] || '';
}
