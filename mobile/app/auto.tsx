/**
 * Quick auto-login helper used to open two browser sessions for demos
 * (e.g. idriss1 vs idriss2 in a 1v1 challenge).
 *
 *   /auto?email=foo@bar&password=secret&go=/challenge-game?id=ABC
 *
 * Not used by the main UI — just a backdoor for scripted/multi-window scenarios.
 */
import { useEffect, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { storage } from '../utils/storage';

export default function Auto() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; password?: string; go?: string }>();
  const [status, setStatus] = useState('Signing in…');

  useEffect(() => {
    (async () => {
      const email = (params.email as string) || '';
      const password = (params.password as string) || '';
      const go = (params.go as string) || '/home';

      if (!email || !password) {
        setStatus('Missing email/password in URL — sending you to /login');
        setTimeout(() => router.replace('/login'), 1200);
        return;
      }
      try {
        const user = await storage.login(email, password);
        if (user) {
          setStatus(`Welcome ${user.username} — opening ${go}…`);
          setTimeout(() => router.replace(go as any), 600);
        } else {
          setStatus('Invalid credentials — sending you to /login');
          setTimeout(() => router.replace('/login'), 1500);
        }
      } catch (e) {
        setStatus('Login failed — sending you to /login');
        setTimeout(() => router.replace('/login'), 1500);
      }
    })();
  }, []);

  return (
    <LinearGradient colors={['#0a0a1a', '#1a1a3a', '#0f0f2a']} style={styles.box}>
      <ActivityIndicator size="large" color="#7c5cff" />
      <Text style={styles.text}>{status}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 18 },
  text: { color: '#94a3b8', fontSize: 15 },
});
