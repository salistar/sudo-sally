import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { storage } from '../utils/storage';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const isLoggedIn = await storage.isLoggedIn();
      if (isLoggedIn) {
        router.replace('/home');
      } else {
        router.replace('/splash');
      }
    };
    checkAuth();
  }, []);

  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a' },
});
