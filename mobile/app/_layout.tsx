import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { AppProvider } from '../utils/context';
import { LanguageProvider } from '../utils/LanguageContext';
import WebShell from '../components/WebShell';
import { loadStoredTheme } from '../utils/theme';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  useEffect(() => { setTimeout(() => setReady(true), 300); }, []);
  // Apply any persisted palette choice before first paint (fire-and-forget).
  useEffect(() => { loadStoredTheme(); }, []);

  if (!ready) return <View style={styles.loading}><ActivityIndicator size="large" color="#7c5cff" /></View>;

  return (
    <AppProvider>
      <LanguageProvider>
      <WebShell>
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="splash" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="home" />
        <Stack.Screen name="levels" />
        <Stack.Screen name="game" />
        <Stack.Screen name="stats" />
        <Stack.Screen name="achievements" />
        <Stack.Screen name="leaderboard" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="shop" />
        <Stack.Screen name="daily" />
        <Stack.Screen name="multiplayer" />
        <Stack.Screen name="howtoplay" />
        {/* Challenge Ouvert - NEW */}
        <Stack.Screen 
          name="challenges" 
          options={{ 
            animation: 'slide_from_right',
            gestureEnabled: true 
          }} 
        />
        <Stack.Screen 
          name="challenge-game" 
          options={{ 
            animation: 'slide_from_bottom',
            gestureEnabled: false  // Prevent accidental swipe during game
          }} 
        />
      </Stack>
      </WebShell>
      <StatusBar style="light" />
      </LanguageProvider>
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#0a0a1a', justifyContent: 'center', alignItems: 'center' },
});