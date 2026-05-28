/**
 * Web build of utils/googleAuth — picked by Metro on the `web` platform
 * (overrides googleAuth.ts). The native @react-native-google-signin module
 * doesn't exist in a browser, so we expose the same surface but never try
 * to import it. The UI's login screen already handles `NO_MODULE` cleanly.
 *
 * A future full web flow could be implemented with Google Identity Services
 * (https://developers.google.com/identity/gsi/web) or @react-oauth/google.
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
  code?: GoogleErrorCode;
  error?: string;
}

export async function signInWithGoogle(): Promise<GoogleResult> {
  console.log('[googleAuth/web] Google native module unavailable on web');
  return {
    ok: false,
    code: 'NO_MODULE',
    error: 'On web, use email or guest sign-in (Google sign-in available in the Android app).',
  };
}
