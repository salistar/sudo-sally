/**
 * Multiplayer entry — redirects to the real lobby (/challenges).
 *
 * Pre-v3.3.0 this screen showed a fake "1247 players online" counter and
 * three "Coming soon" tabs (Quick match / Friends / Ranked), which confused
 * users into thinking multiplayer didn't work yet — even though the real
 * 1v1 challenge lobby is fully built at /challenges. Cleaner: just redirect.
 */
import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function MultiplayerRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/challenges'); }, [router]);
  return null;
}
