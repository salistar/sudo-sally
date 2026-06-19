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
import NotificationsBell from './NotificationsBell';
import StreakFlameMeter from './StreakFlameMeter';
import ToastHost from './ToastHost';
import { useLang } from '../utils/LanguageContext';

const SIDEBAR_W = 260;
const HEADER_H  = 64;
const BREAKPOINT = 1024;
const LANDING_URL = 'https://sallysudo.com';

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

  // v3.11.0 — explicit sign-out clears EVERY sudoku_* storage key (web cache
  // sometimes survives a partial purge because RNW's web fallback writes raw
  // keys to window.localStorage; multiRemove also doesn't wipe sessionStorage)
  // then hard-redirects to the public landing. The previous version only
  // removed 3 keys and `setUser(null)` couldn't survive a page refresh, so
  // refreshing the app after "Sign out" still showed the user signed in.
  const handleSignOut = async () => {
    try {
      // Drop EVERY sudoku_* AsyncStorage key, not just auth (so stale stats /
      // levels / achievements from the previous account don't bleed into the
      // next visitor's session). User language preference is intentionally
      // kept (sudoku_settings has it nested but we wipe the whole blob — the
      // landing page reads its own sallysudo_lang anyway).
      const keys = await AsyncStorage.getAllKeys();
      const sudoku = keys.filter((k) => k.startsWith('sudoku_'));
      if (sudoku.length) await AsyncStorage.multiRemove(sudoku);
    } catch {}
    // Web-only belt-and-braces — clear localStorage / sessionStorage
    // directly in case AsyncStorage's web layer missed anything.
    if (typeof window !== 'undefined') {
      try {
        for (let i = window.localStorage.length - 1; i >= 0; i--) {
          const k = window.localStorage.key(i);
          if (k && (k.startsWith('sudoku_') || k.startsWith('@sallysudo_'))) {
            window.localStorage.removeItem(k);
          }
        }
        window.sessionStorage.clear();
      } catch {}
    }
    setUser(null);
    if (typeof window !== 'undefined') {
      window.location.href = LANDING_URL;
    } else {
      router.replace('/welcome' as any);
    }
  };

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#0a0a1a', minHeight: '100vh' as any }}>
      {/* v3.11.15 sprint-20 — global socket toast stack, top-right
          floating layer above all routes. Renders nothing when no
          live event has fired recently. */}
      <ToastHost />
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
            <Text style={{ color: '#4ade80', fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>v3.11.5 · WEB</Text>
          </View>
        </TouchableOpacity>

        {/* v3.11.5 sprint-2 — removed the sidebar mascot hero card: it was
            duplicating the in-page hero (home shows a big SallySudo logo +
            mascot in the main column) and bloating the sidebar height. The
            42px wink mascot in the brand row above is enough sidebar brand
            presence. The home page owns the big mascot. */}

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

        {/* v3.10.2 — sidebar foot. Sign-out is now ALWAYS visible (user asked
            "ou est bouton deconnexion"). Above it, the user pill shows when
            signed in. Below it, a thin SallySudo.com link to the landing
            stays for everyone. */}
        <View style={{ gap: 8 }}>
          {user && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12 }}>
              <Text style={{ fontSize: 28 }}>{user.avatar || '🎮'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }} numberOfLines={1}>{user.username}</Text>
                <Text style={{ color: '#94a3b8', fontSize: 11 }}>Lvl {user.level ?? 1} · ⭐ {user.stars ?? 0}</Text>
              </View>
            </View>
          )}
          <TouchableOpacity
            onPress={handleSignOut}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              paddingVertical: 12, borderRadius: 12,
              borderWidth: 1, borderColor: 'rgba(239,68,68,0.45)',
              backgroundColor: 'rgba(239,68,68,0.12)',
            }}
          >
            <Text style={{ fontSize: 16 }}>🚪</Text>
            <Text style={{ color: '#fca5a5', fontWeight: '800', fontSize: 14 }}>{t('signOut')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { if (typeof window !== 'undefined') window.location.href = LANDING_URL; }}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
              paddingVertical: 8,
            }}
          >
            <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '600' }}>🌐 sallysudo.com</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* MAIN COLUMN: HEADER + CONTENT */}
      <View style={{ flex: 1, flexDirection: 'column' }}>
        {/* HEADER — v3.11.5 redesigned to the SaaS gaming pattern: route
            breadcrumb on the left, then a player wallet pill (coins/streak),
            then quick-action pills (Daily / 1v1), then the avatar.
            Previously this row only had the breadcrumb + 2 CTA buttons, which
            wasted ~900px of header space and left the user with no at-a-glance
            wallet/level info. */}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {/* v3.11.9 sprint-14 — Duolingo-style streak flame, visible
                on every page so the user always sees their day count.
                Pulses red when at risk after 18h local. */}
            {user && <StreakFlameMeter />}
            {/* Wallet pill — coins + streak. Only shown when signed in. */}
            {user && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 14 }}>🪙</Text>
                  <Text style={{ color: '#fbbf24', fontSize: 13, fontWeight: '800' }}>{user.coins ?? 0}</Text>
                </View>
                <View style={{ width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 14 }}>⭐</Text>
                  <Text style={{ color: '#4ade80', fontSize: 13, fontWeight: '800' }}>{user.stars ?? 0}</Text>
                </View>
              </View>
            )}
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
            {user && <NotificationsBell />}
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
