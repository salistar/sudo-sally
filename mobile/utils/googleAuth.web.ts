/**
 * Web build of utils/googleAuth — picked by Metro on the `web` platform
 * (overrides googleAuth.ts). Uses Google Identity Services (GSI) — no extra
 * npm dependency, just the official Google script loaded on demand.
 *
 *   https://developers.google.com/identity/gsi/web
 *
 * Flow:
 *  1. Lazy-load https://accounts.google.com/gsi/client once per session.
 *  2. Call google.accounts.id.initialize({ client_id, callback }).
 *  3. Render google.accounts.id.prompt() — the GSI overlay (One Tap if
 *     possible, else the account-picker iframe).
 *  4. Google calls our callback with a CredentialResponse — the `credential`
 *     field is the JWS ID token. We hand it to /api/auth/google and store
 *     the returned app JWT exactly like the native flow.
 */
import Constants from 'expo-constants';

export const GOOGLE_CLIENT_IDS = {
  web: '106972968307-o1m39edcftpo3r77q856o87o29b1ai4u.apps.googleusercontent.com',
  android: '106972968307-2d38675a5rkl8vgkppll7f9ab5fe96oe.apps.googleusercontent.com',
  ios: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
};

export const isGoogleConfigured = Object.values(GOOGLE_CLIENT_IDS).some(
  (id) => !!id && !id.startsWith('YOUR_'),
);

export const isExpoGo = Constants.appOwnership === 'expo';

export type GoogleErrorCode =
  | 'EXPO_GO'
  | 'NO_MODULE'
  | 'CANCELLED'
  | 'IN_PROGRESS'
  | 'PLAY_SERVICES'
  | 'DEVELOPER_ERROR'
  | 'UNKNOWN';

export interface GoogleResult {
  ok: boolean;
  idToken?: string;
  appToken?: string;
  user?: any;
  code?: GoogleErrorCode;
  error?: string;
}

const GSI_SCRIPT = 'https://accounts.google.com/gsi/client';
let gsiLoaded: Promise<void> | null = null;

/** Inject the GSI script once. Resolves when `window.google` is ready. */
function loadGsi(): Promise<void> {
  if (typeof document === 'undefined') return Promise.reject(new Error('not in browser'));
  if ((window as any).google?.accounts?.id) return Promise.resolve();
  if (gsiLoaded) return gsiLoaded;
  gsiLoaded = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GSI_SCRIPT}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('GSI script failed to load')));
      return;
    }
    const s = document.createElement('script');
    s.src = GSI_SCRIPT;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('GSI script failed to load'));
    document.head.appendChild(s);
  });
  return gsiLoaded;
}

/** Same helper as the native build — exchange Google idToken → our JWT. */
export async function exchangeGoogleIdToken(idToken: string): Promise<{ appToken?: string; user?: any; error?: string }> {
  try {
    const res = await fetch('https://api.sallysudo.com/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    const data = await res.json();
    if (!res.ok || !data?.success) return { error: data?.error || `HTTP ${res.status}` };
    return { appToken: data.token, user: data.user };
  } catch (e: any) {
    return { error: String(e?.message || e) };
  }
}

/**
 * Open the Google sign-in overlay (One Tap or account picker).
 * Resolves once we have either a verified app token or a final error.
 */
export async function signInWithGoogle(): Promise<GoogleResult> {
  try {
    await loadGsi();
  } catch (e: any) {
    return { ok: false, code: 'NO_MODULE', error: String(e?.message || e) };
  }

  return new Promise<GoogleResult>((resolve) => {
    let settled = false;
    const finish = (r: GoogleResult) => { if (!settled) { settled = true; resolve(r); } };
    try {
      const g: any = (window as any).google;
      g.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_IDS.web,
        auto_select: false,
        cancel_on_tap_outside: true,
        ux_mode: 'popup',
        callback: async (resp: any) => {
          const idToken = resp?.credential;
          if (!idToken) return finish({ ok: false, code: 'CANCELLED', error: 'No credential' });
          const { appToken, user, error } = await exchangeGoogleIdToken(idToken);
          if (!appToken) return finish({ ok: false, code: 'UNKNOWN', error: `Backend exchange failed: ${error}` });
          finish({ ok: true, idToken, appToken, user });
        },
      });
      g.accounts.id.prompt((notification: any) => {
        // The user dismissed One Tap or it can't display (cookies blocked, etc.)
        if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.() || notification.isDismissedMoment?.()) {
          const reason = notification.getNotDisplayedReason?.() || notification.getSkippedReason?.() || notification.getDismissedReason?.() || 'dismissed';
          console.log('[googleAuth/web] prompt unavailable:', reason);
          // Don't fail immediately — the user may have cancelled. Wait 200ms,
          // then if the callback hasn't fired, settle as CANCELLED.
          setTimeout(() => finish({ ok: false, code: 'CANCELLED', error: `Google prompt ${reason}` }), 200);
        }
      });
    } catch (e: any) {
      finish({ ok: false, code: 'UNKNOWN', error: String(e?.message || e) });
    }
  });
}
