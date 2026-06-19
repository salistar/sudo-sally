/**
 * Shared chrome for the static legal / marketing pages (sprint-34):
 * /privacy /terms /about /pricing /press. One layout = consistent header,
 * aurora rule, footer cross-links and copyright across all five, so the pages
 * themselves are just content. Exports H / P / Li / Card content helpers.
 */
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTheme } from '../utils/theme';

const LINKS: { label: string; route: string }[] = [
  { label: 'About', route: '/about' },
  { label: 'Pricing', route: '/pricing' },
  { label: 'Privacy', route: '/privacy' },
  { label: 'Terms', route: '/terms' },
  { label: 'Press kit', route: '/press' },
];

export default function LegalLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const { c, r, s, type } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 1024;

  return (
    <LinearGradient colors={[c.bgVoid, c.bg900]} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: isDesktop ? 40 : 18, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 820 }}>
          <TouchableOpacity onPress={() => router.push('/home' as any)} style={{ marginBottom: s.lg }}>
            <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '800' }}>← SallySudo</Text>
          </TouchableOpacity>

          <Text style={{ color: c.textStrong, fontSize: isDesktop ? 40 : 30, fontWeight: '900', letterSpacing: -0.8 }}>{title}</Text>
          {!!subtitle && <Text style={{ color: c.text, ...type.body, marginTop: 8, lineHeight: 22 }}>{subtitle}</Text>}
          <LinearGradient colors={c.gradAurora} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 3, borderRadius: 2, marginTop: s.md, marginBottom: s.xl, width: 120 } as any} />

          {children}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.lg, marginTop: 48, paddingTop: s.lg, borderTopWidth: 1, borderTopColor: c.border }}>
            {LINKS.map((l) => (
              <TouchableOpacity key={l.route} onPress={() => router.push(l.route as any)}>
                <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '700' }}>{l.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ color: c.textMuted, fontSize: 11, marginTop: s.md }}>© 2026 SallySudo · sallysudo.com</Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

// ── Content helpers (each consumes the theme directly) ──
export function H({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  return <Text style={{ color: c.textStrong, fontSize: 19, fontWeight: '900', marginTop: 26, marginBottom: 8 }}>{children}</Text>;
}
export function P({ children }: { children: React.ReactNode }) {
  const { c, type } = useTheme();
  return <Text style={{ color: c.text, ...type.body, lineHeight: 23, marginBottom: 8 }}>{children}</Text>;
}
export function B({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  return <Text style={{ color: c.textStrong, fontWeight: '800' }}>{children}</Text>;
}
export function Li({ children }: { children: React.ReactNode }) {
  const { c, type } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 6, alignItems: 'flex-start' }}>
      <Text style={{ color: c.violet, fontSize: 15, fontWeight: '900' }}>›</Text>
      <Text style={{ color: c.text, ...type.body, lineHeight: 22, flex: 1 }}>{children}</Text>
    </View>
  );
}
export function Card({ children }: { children: React.ReactNode }) {
  const { c, r, s } = useTheme();
  return (
    <View style={{ padding: s.lg, borderRadius: r.md, backgroundColor: c.surface800, borderWidth: 1, borderColor: c.border, marginTop: s.md }}>
      {children}
    </View>
  );
}
