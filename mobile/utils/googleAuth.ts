/**
 * ============================================================================
 * GOOGLE OAUTH CONFIG
 * ============================================================================
 * Client IDs from Google Cloud Console (https://console.cloud.google.com).
 *
 *  - `web`     : OAuth "Web application" client. This is the one passed to
 *                GoogleSignin.configure({ webClientId }) — it is what mints the
 *                idToken on ALL platforms (including Android).
 *  - `android` : OAuth "Android" client. You do NOT pass this to configure();
 *                Google matches it automatically using the app's package name
 *                (com.sudokusally.v3) + the signing certificate SHA-1.
 *                ⚠️ The SHA-1 of the keystore that SIGNED the app MUST be
 *                registered on this Android client, otherwise signIn() throws
 *                DEVELOPER_ERROR (code 10).
 *  - `ios`     : OAuth "iOS" client (bundle id com.sudokusally.v3).
 *
 * Debug build SHA-1 — the build is signed with the PROJECT keystore
 * android/app/debug.keystore (see android/app/build.gradle), NOT the global
 * ~/.android/debug.keystore. Register THIS one on the Android OAuth client:
 *   5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
 * ============================================================================
 */
import Constants from 'expo-constants';

export const GOOGLE_CLIENT_IDS = {
  web: '106972968307-o1m39edcftpo3r77q856o87o29b1ai4u.apps.googleusercontent.com',
  android: '106972968307-2d38675a5rkl8vgkppll7f9ab5fe96oe.apps.googleusercontent.com',
  ios: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
};

/** True once at least one real client ID has been filled in. */
export const isGoogleConfigured = Object.values(GOOGLE_CLIENT_IDS).some(
  (id) => !!id && !id.startsWith('YOUR_'),
);

/**
 * Expo Go can't load native modules → Google sign-in is impossible there.
 * `appOwnership === 'expo'` means we're inside Expo Go; in a dev/standalone
 * build it is 'guest'/'standalone' (or undefined on newer SDKs → not Expo Go).
 */
export const isExpoGo = Constants.appOwnership === 'expo';

export type GoogleErrorCode =
  | 'EXPO_GO'         // running in Expo Go, native module absent
  | 'NO_MODULE'       // dynamic import failed (module not linked)
  | 'CANCELLED'       // user dismissed the account picker
  | 'IN_PROGRESS'     // a sign-in is already running
  | 'PLAY_SERVICES'   // Play Services missing/outdated
  | 'DEVELOPER_ERROR' // SHA-1 / package / client misconfiguration
  | 'UNKNOWN';

export interface GoogleResult {
  ok: boolean;
  idToken?: string;
  /** Normalized code for the UI to branch on. */
  code?: GoogleErrorCode;
  /** Raw error message (and original code) for debugging. */
  error?: string;
}

let configured = false;

/**
 * Native Google sign-in via @react-native-google-signin.
 * Returns a rich result so the UI can show the REAL reason instead of a
 * generic "use a dev build" message.
 */
export async function signInWithGoogle(): Promise<GoogleResult> {
  // 1) Expo Go: the native module simply isn't there.
  if (isExpoGo) {
    console.log('[googleAuth] running in Expo Go → native sign-in unavailable');
    return { ok: false, code: 'EXPO_GO', error: 'Expo Go' };
  }

  // 2) Load the native module (present in dev/standalone builds).
  let GoogleSignin: any;
  let statusCodes: any;
  try {
    const mod = await import('@react-native-google-signin/google-signin');
    GoogleSignin = mod.GoogleSignin;
    statusCodes = mod.statusCodes;
  } catch (e) {
    console.log('[googleAuth] native module import failed:', String(e));
    return { ok: false, code: 'NO_MODULE', error: String(e) };
  }

  // 3) Configure + sign in.
  try {
    if (!configured) {
      GoogleSignin.configure({ webClientId: GOOGLE_CLIENT_IDS.web, offlineAccess: false });
      configured = true;
    }
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Force the Google account picker on EVERY sign-in by clearing any cached
    // session first (otherwise the library silently reuses the last account).
    try {
      await GoogleSignin.signOut();
    } catch (e) {
      console.log('[googleAuth] pre-signOut skipped:', String(e));
    }
    const result: any = await GoogleSignin.signIn();
    const idToken = result?.data?.idToken ?? result?.idToken;
    console.log('[googleAuth] sign-in OK, idToken present:', !!idToken);
    // TODO: POST idToken to backend /auth/google to create/login a real account.
    return { ok: true, idToken };
  } catch (e: any) {
    const raw = e?.code != null ? String(e.code) : '';
    const msg = e?.message ? String(e.message) : String(e);
    console.log('[googleAuth] sign-in failed — code:', raw, 'msg:', msg);

    // Normalize the library's status codes (string or numeric across versions).
    let code: GoogleErrorCode = 'UNKNOWN';
    if (raw === String(statusCodes?.SIGN_IN_CANCELLED) || raw === '12501' || /cancel/i.test(msg)) {
      code = 'CANCELLED';
    } else if (raw === String(statusCodes?.IN_PROGRESS)) {
      code = 'IN_PROGRESS';
    } else if (raw === String(statusCodes?.PLAY_SERVICES_NOT_AVAILABLE)) {
      code = 'PLAY_SERVICES';
    } else if (raw === String(statusCodes?.DEVELOPER_ERROR) || raw === '10' || /developer_error/i.test(msg)) {
      code = 'DEVELOPER_ERROR';
    }
    return { ok: false, code, error: `${raw ? raw + ' — ' : ''}${msg}` };
  }
}
