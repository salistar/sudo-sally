/**
 * WebGlobals — web-only global overlays + document-level effects, mounted once
 * by WebShell. Bundles four Phase-3 polish features so there's a single mount:
 *   • RTL          — sets <html dir/lang> from the active language (sprint-28)
 *   • Onboarding   — first-run 3-slide intro (sprint-26)
 *   • Changelog    — "What's new" modal on version bump (sprint-30)
 *   • Cookie       — GDPR-style consent banner (sprint-30)
 *
 * Persistence uses the `@sallysudo_` localStorage namespace so the flags
 * survive sign-out (WebShell's sign-out only wipes `sudoku_*`).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useLang } from '../utils/LanguageContext';
import { useTheme } from '../utils/theme';
import { CHANGELOG, CURRENT_VERSION } from '../utils/changelog';

const K_ONBOARDED = '@sallysudo_onboarded';
const K_CONSENT   = '@sallysudo_consent';
const K_LAST_VER  = '@sallysudo_last_seen_version';

const ls = {
  get(k: string): string | null { try { return typeof window !== 'undefined' ? window.localStorage.getItem(k) : null; } catch { return null; } },
  set(k: string, v: string) { try { if (typeof window !== 'undefined') window.localStorage.setItem(k, v); } catch {} },
};

export default function WebGlobals() {
  const isWeb = Platform.OS === 'web';
  const { t, lang, isRTL } = useLang() as any;

  // ── RTL: mirror the document for Arabic. +html.tsx is static, so set it here. ──
  useEffect(() => {
    if (!isWeb || typeof document === 'undefined') return;
    try {
      document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
      document.documentElement.setAttribute('lang', lang || 'en');
    } catch {}
  }, [isWeb, isRTL, lang]);

  if (!isWeb) return null;
  return (
    <>
      <Onboarding t={t} />
      <Changelog t={t} lang={lang} />
      <CookieBanner t={t} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Onboarding — first-run 3-slide intro
// ─────────────────────────────────────────────────────────────────────────
function Onboarding({ t }: { t: (k: any) => string }) {
  const { c, r, s, type } = useTheme();
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!ls.get(K_ONBOARDED)) setOpen(true);
  }, []);

  const slides = [
    { icon: '🧩', title: t('onbTitle1'), body: t('onbBody1') },
    { icon: '⭐', title: t('onbTitle2'), body: t('onbBody2') },
    { icon: '⚔️', title: t('onbTitle3'), body: t('onbBody3') },
  ];

  const finish = () => {
    ls.set(K_ONBOARDED, '1');
    // A brand-new user has already "seen" everything new — don't immediately
    // pop the changelog on top of onboarding.
    ls.set(K_LAST_VER, CURRENT_VERSION);
    setOpen(false);
  };

  if (!open) return null;
  const last = i >= slides.length - 1;
  const sl = slides[i];

  return (
    <Backdrop>
      <Card c={c} r={r}>
        <View style={{ alignItems: 'center', gap: s.md }}>
          <Text style={{ fontSize: 54 }}>{sl.icon}</Text>
          <Text style={{ color: c.textStrong, fontSize: 22, fontWeight: '900', textAlign: 'center' }}>{sl.title}</Text>
          <Text style={{ color: c.text, ...type.body, textAlign: 'center', lineHeight: 22 }}>{sl.body}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginVertical: s.lg }}>
          {slides.map((_, k) => (
            <View key={k} style={{ width: k === i ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: k === i ? c.violet : c.border }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s.md }}>
          <TouchableOpacity onPress={finish}>
            <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '700' }}>{t('skip')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => (last ? finish() : setI(i + 1))}
            style={{ paddingHorizontal: s.xl, paddingVertical: 12, borderRadius: r.pill, backgroundColor: c.violet }}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 0.4 }}>
              {last ? t('getStarted') : t('next')}
            </Text>
          </TouchableOpacity>
        </View>
      </Card>
    </Backdrop>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Changelog — "What's new" on version bump
// ─────────────────────────────────────────────────────────────────────────
function Changelog({ t, lang }: { t: (k: any) => string; lang: string }) {
  const { c, r, s, type } = useTheme();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Only after onboarding, and only when the version actually changed.
    if (!ls.get(K_ONBOARDED)) return;
    const seen = ls.get(K_LAST_VER);
    if (seen !== CURRENT_VERSION) setOpen(true);
  }, []);

  const close = () => { ls.set(K_LAST_VER, CURRENT_VERSION); setOpen(false); };
  if (!open) return null;

  const seen = ls.get(K_LAST_VER);
  const fresh = CHANGELOG.filter(e => !seen || e.version !== seen); // entries newer than last seen
  const entries = fresh.length ? fresh : CHANGELOG.slice(0, 1);

  return (
    <Backdrop>
      <Card c={c} r={r}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.sm, marginBottom: s.md }}>
          <Text style={{ fontSize: 24 }}>🎉</Text>
          <Text style={{ color: c.textStrong, fontSize: 20, fontWeight: '900' }}>{t('whatsNew')}</Text>
          <View style={{ paddingHorizontal: s.sm, paddingVertical: 2, borderRadius: r.pill, backgroundColor: `${c.gold}22`, borderWidth: 1, borderColor: `${c.gold}55` }}>
            <Text style={{ color: c.gold, fontSize: 11, fontWeight: '900' }}>v{CURRENT_VERSION}</Text>
          </View>
        </View>
        <View style={{ gap: s.md, maxHeight: 320 as any }}>
          {entries.map(e => (
            <View key={e.version} style={{ gap: 6 }}>
              {entries.length > 1 && (
                <Text style={{ color: c.textMuted, ...type.eyebrow }}>v{e.version} · {e.date}</Text>
              )}
              {e.items.map((it, k) => (
                <View key={k} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                  <Text style={{ color: c.violet, fontSize: 14, fontWeight: '900' }}>›</Text>
                  <Text style={{ color: c.text, ...type.body, flex: 1, lineHeight: 20 }}>{(it as any)[lang] || it.en}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
        <TouchableOpacity
          onPress={close}
          style={{ marginTop: s.lg, alignSelf: 'stretch', paddingVertical: 12, borderRadius: r.pill, backgroundColor: c.violet, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900' }}>{t('gotIt')}</Text>
        </TouchableOpacity>
      </Card>
    </Backdrop>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Cookie consent — dismissible bottom banner
// ─────────────────────────────────────────────────────────────────────────
function CookieBanner({ t }: { t: (k: any) => string }) {
  const { c, r, s, type } = useTheme();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => { if (!ls.get(K_CONSENT)) setOpen(true); }, []);
  const accept = () => { ls.set(K_CONSENT, '1'); setOpen(false); };
  if (!open) return null;

  return (
    <View
      style={{
        position: 'fixed' as any, left: 0, right: 0, bottom: 0, zIndex: 10000,
        padding: s.md, alignItems: 'center',
      }}
      pointerEvents="box-none"
    >
      <View style={{
        maxWidth: 760, width: '100%',
        flexDirection: 'row', alignItems: 'center', gap: s.md, flexWrap: 'wrap',
        padding: s.lg, borderRadius: r.lg,
        backgroundColor: c.surface800, borderWidth: 1, borderColor: c.borderStrong,
        shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 8 },
      }}>
        <Text style={{ fontSize: 20 }}>🍪</Text>
        <Text style={{ color: c.text, ...type.small, flex: 1, minWidth: 220, lineHeight: 18 }}>{t('cookieMessage')}</Text>
        <TouchableOpacity onPress={() => router.push('/privacy' as any)}>
          <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '700' }}>{t('cookiePrivacy')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={accept} style={{ paddingHorizontal: s.xl, paddingVertical: 10, borderRadius: r.pill, backgroundColor: c.violet }}>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>{t('cookieAccept')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Shared shell pieces
// ─────────────────────────────────────────────────────────────────────────
function Backdrop({ children }: { children: React.ReactNode }) {
  return (
    <View style={{
      position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, zIndex: 10001,
      backgroundColor: 'rgba(5,5,16,0.72)',
      alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      {children}
    </View>
  );
}

function Card({ children, c, r }: { children: React.ReactNode; c: any; r: any }) {
  return (
    <View style={{ width: '100%', maxWidth: 460, padding: 26, borderRadius: r.lg, backgroundColor: c.surface800, borderWidth: 1, borderColor: c.borderStrong, overflow: 'hidden' }}>
      <LinearGradient colors={c.gradAurora} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3 } as any} />
      {children}
    </View>
  );
}
