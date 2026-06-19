/**
 * ToastHost — global real-time notification stack.
 *
 * Mounted once at the root layout. Listens to the existing
 * socketService events:
 *   • challenge:received  → "X challenged you to a duel"  (red accent)
 *   • challenge:accepted  → "X accepted your challenge"   (green accent)
 *   • challenge:declined  → "X declined your challenge"   (grey accent)
 *
 * Each event pushes a toast onto a top-right stack with slide-in +
 * fade-in animation. Toasts auto-dismiss after 6s, can be clicked to
 * deeplink (received → /challenges, accepted → /challenge-game?id=),
 * or dismissed with the ✕ button.
 *
 * Pure desktop-web feature for now — the phone build already shows
 * AppModal popups inline on /challenges, and a global toast would
 * double-render there.
 */
import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { socketService } from '../utils/socket';
import { useLang } from '../utils/LanguageContext';
import { useTheme } from '../utils/theme';

type Kind = 'received' | 'accepted' | 'declined';

type Toast = {
  id: string;
  kind: Kind;
  title: string;
  body: string;
  href?: string;
  avatar?: string;
  createdAt: number;
};

const AUTO_DISMISS_MS = 6000;
const MAX_VISIBLE = 4;

function colorFor(kind: Kind, c: any): { bg: string; ring: string; fg: string } {
  switch (kind) {
    case 'received': return { bg: 'rgba(239,68,68,0.10)', ring: 'rgba(239,68,68,0.45)', fg: '#fca5a5' };
    case 'accepted': return { bg: 'rgba(74,222,128,0.10)', ring: 'rgba(74,222,128,0.45)', fg: '#86efac' };
    case 'declined': return { bg: 'rgba(148,163,184,0.10)', ring: 'rgba(148,163,184,0.35)', fg: '#cbd5e1' };
  }
}

function iconFor(kind: Kind): string {
  return kind === 'received' ? '⚔️' : kind === 'accepted' ? '✅' : '🚫';
}

export default function ToastHost() {
  const router = useRouter();
  const { t } = useLang();
  const { c, r, s, type } = useTheme();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  // Web-only — phone shows modal popups inline already.
  const enabled = Platform.OS === 'web';

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let cleanups: Array<() => void> = [];

    (async () => {
      try { await socketService.connect(); } catch {}
      if (cancelled) return;

      const onReceived = (data: any) => {
        const id = `r${++seq.current}`;
        const name = data?.challengerName || data?.challenger?.username || '?';
        const avatar = data?.challengerAvatar || data?.challenger?.avatar || '🎮';
        push({
          id, kind: 'received', avatar,
          title: t('toastChallengedYou').replace('{name}', name),
          body: t('toastChallengedYouHint'),
          href: '/challenges',
          createdAt: Date.now(),
        });
      };
      const onAccepted = (data: any) => {
        const id = `a${++seq.current}`;
        const name = data?.username || data?.opponentName || '?';
        push({
          id, kind: 'accepted',
          title: t('toastAccepted').replace('{name}', name),
          body: t('toastAcceptedHint'),
          href: data?.challengeId ? `/challenge-game?id=${data.challengeId}` : '/challenges',
          createdAt: Date.now(),
        });
      };
      const onDeclined = (data: any) => {
        const id = `d${++seq.current}`;
        const name = data?.username || data?.opponentName || '?';
        push({
          id, kind: 'declined',
          title: t('toastDeclined').replace('{name}', name),
          body: t('toastDeclinedHint'),
          href: '/challenges',
          createdAt: Date.now(),
        });
      };

      socketService.on('challenge:received', onReceived);
      socketService.on('challenge:accepted', onAccepted);
      socketService.on('challenge:declined', onDeclined);
      cleanups.push(() => socketService.off('challenge:received', onReceived));
      cleanups.push(() => socketService.off('challenge:accepted', onAccepted));
      cleanups.push(() => socketService.off('challenge:declined', onDeclined));

      // Web-only DOM seam — lets any code in the page (analytics,
      // service workers, e2e scripts) trigger a toast without holding
      // a socket reference. Dispatch a CustomEvent('sally-toast', {
      //   detail: { kind: 'received', name: 'X', avatar: '👹',
      //     challengeId: '...' } })  on window to push a toast.
      if (typeof window !== 'undefined') {
        const onCustom = (e: any) => {
          const d = (e && e.detail) || {};
          const kind: Kind = (d.kind || 'received') as Kind;
          if (kind === 'received') onReceived({ challengerName: d.name, challengerAvatar: d.avatar });
          else if (kind === 'accepted') onAccepted({ username: d.name, challengeId: d.challengeId });
          else if (kind === 'declined') onDeclined({ username: d.name });
        };
        window.addEventListener('sally-toast', onCustom);
        cleanups.push(() => window.removeEventListener('sally-toast', onCustom));
      }
    })();

    return () => {
      cancelled = true;
      cleanups.forEach(fn => fn());
    };
  }, [enabled, t]);

  const push = (toast: Toast) => {
    setToasts(prev => {
      const next = [toast, ...prev].slice(0, MAX_VISIBLE);
      return next;
    });
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toast.id));
    }, AUTO_DISMISS_MS);
  };

  const dismiss = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const openToast = (toast: Toast) => {
    if (toast.href) router.push(toast.href as any);
    dismiss(toast.id);
  };

  if (!enabled || toasts.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute' as any,
        top: 80, right: 24,
        gap: s.sm,
        zIndex: 9999,
      } as any}
    >
      {toasts.map(toast => <ToastCard key={toast.id} toast={toast} onClick={() => openToast(toast)} onDismiss={() => dismiss(toast.id)} c={c} s={s} r={r} type={type} t={t} />)}
    </View>
  );
}

function ToastCard({
  toast, onClick, onDismiss, c, s, r, type, t,
}: {
  toast: Toast;
  onClick: () => void;
  onDismiss: () => void;
  c: any; s: any; r: any; type: any;
  t: (k: any) => string;
}) {
  const slide = useRef(new Animated.Value(60)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide, { toValue: 0, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fade,  { toValue: 1, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [slide, fade]);

  const colors = colorFor(toast.kind, c);

  return (
    <Animated.View
      style={{
        opacity: fade,
        transform: [{ translateX: slide }],
      }}
    >
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={onClick}
        style={{
          width: 340,
          flexDirection: 'row', alignItems: 'flex-start', gap: s.md,
          padding: s.lg, borderRadius: r.md,
          backgroundColor: c.surface800,
          borderWidth: 1, borderColor: colors.ring,
          shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 6 },
        } as any}
      >
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.ring, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 18 }}>{toast.avatar || iconFor(toast.kind)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.textStrong, fontSize: 13, fontWeight: '900', letterSpacing: 0.2, marginBottom: 2 }} numberOfLines={1}>
            {toast.title}
          </Text>
          <Text style={{ color: c.text, ...type.small, lineHeight: 16 }} numberOfLines={2}>
            {toast.body}
          </Text>
          <Text style={{ color: colors.fg, fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginTop: 6 }}>
            {t('toastClickToOpen')}
          </Text>
        </View>
        <TouchableOpacity
          onPress={(e: any) => { e?.stopPropagation?.(); onDismiss(); }}
          style={{ padding: 4 }}
        >
          <Text style={{ color: c.textMuted, fontSize: 14, fontWeight: '900' }}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}
