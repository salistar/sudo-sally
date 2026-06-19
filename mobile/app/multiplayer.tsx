/**
 * Multiplayer entry — redirects to the real lobby (/challenges).
 *
 * Pre-v3.3.0 this showed a fake "players online" counter + "Coming soon" tabs.
 * Now it just forwards to the real 1v1 lobby at /challenges. Renders a small
 * "redirecting" screen (not `null`) so a deep-link to /multiplayer never shows
 * a blank page while the client-side redirect fires.
 */
import { useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useLang } from '../utils/LanguageContext';

export default function MultiplayerRedirect() {
  const router = useRouter();
  const { t } = useLang();

  useEffect(() => {
    const id = setTimeout(() => router.replace('/challenges' as any), 60);
    return () => clearTimeout(id);
  }, [router]);

  return (
    <LinearGradient colors={['#0a0a1a', '#0d1424']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, minHeight: '100vh' as any }}>
      <Text style={{ fontSize: 40 }}>⚔️</Text>
      <ActivityIndicator color="#7C5CFF" />
      <Text style={{ color: '#cbd5e1', fontSize: 15, fontWeight: '700' }}>{t('lobby')}…</Text>
      <TouchableOpacity onPress={() => router.replace('/challenges' as any)} style={{ marginTop: 6, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 999, backgroundColor: '#7C5CFF' }}>
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>{t('lobby')}</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}
