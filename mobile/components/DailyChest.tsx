/**
 * Daily reward chest — purely client-side.
 *
 * Sudoku.com, Royal Match and Block Blast all have a "come back tomorrow"
 * reward that compounds with a streak. This is our local version, with
 * payout doubling every consecutive day capped at day 7.
 *
 * Storage:
 *   AsyncStorage.@sallysudo_lastChest  → ISO date of the last claim
 *   AsyncStorage.@sallysudo_chestStreak → integer day count (1..7)
 *
 * On a fresh install both keys are absent, the chest is claimable and the
 * payout is 10 coins. Each consecutive day doubles the payout (10/20/40/
 * 80/160/320/640). Missing a day resets the streak to 1 and payout to 10.
 *
 * The chest is integrated into home.tsx via:
 *   import DailyChest from '../components/DailyChest';
 *   <DailyChest user={user} onClaimed={(coins) => refreshCoins()} />
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

const KEY_LAST  = '@sallysudo_lastChest';
const KEY_STREAK = '@sallysudo_chestStreak';

function dayStr(d: Date) { return d.toISOString().slice(0, 10); }
function daysBetween(a: string, b: string) {
  const A = new Date(a + 'T00:00:00Z').getTime();
  const B = new Date(b + 'T00:00:00Z').getTime();
  return Math.round((B - A) / (24 * 60 * 60 * 1000));
}
function payoutFor(streak: number) {
  // 10, 20, 40, 80, 160, 320, 640 — capped at day 7.
  const n = Math.max(1, Math.min(streak, 7));
  return 10 * Math.pow(2, n - 1);
}

export default function DailyChest({ user, onClaimed }: { user: any; onClaimed?: (coins: number) => void }) {
  const [claimable, setClaimable] = useState(false);
  const [streak, setStreak] = useState(1);
  const [todayPayout, setTodayPayout] = useState(10);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    (async () => {
      const [lastRaw, streakRaw] = await Promise.all([
        AsyncStorage.getItem(KEY_LAST),
        AsyncStorage.getItem(KEY_STREAK),
      ]);
      const today = dayStr(new Date());
      const last  = lastRaw || '';
      const prevStreak = parseInt(streakRaw || '0', 10) || 0;

      let nextStreak: number;
      let canClaim: boolean;
      if (!last) {
        nextStreak = 1; canClaim = true;
      } else {
        const diff = daysBetween(last, today);
        if (diff <= 0) {           // already claimed today
          nextStreak = prevStreak || 1;
          canClaim = false;
        } else if (diff === 1) {   // consecutive day → streak++ (cap 7)
          nextStreak = Math.min(prevStreak + 1, 7);
          canClaim = true;
        } else {                   // missed at least one day → reset
          nextStreak = 1;
          canClaim = true;
        }
      }
      setStreak(nextStreak);
      setTodayPayout(payoutFor(nextStreak));
      setClaimable(canClaim);
    })();
  }, []);

  const claim = async () => {
    if (!claimable || animating) return;
    setAnimating(true);
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
    await AsyncStorage.setItem(KEY_LAST, dayStr(new Date()));
    await AsyncStorage.setItem(KEY_STREAK, String(streak));
    // Add coins to the in-memory user object so the home updates instantly.
    if (user && typeof user.coins === 'number') user.coins += todayPayout;
    onClaimed?.(todayPayout);
    setTimeout(() => { setClaimable(false); setAnimating(false); }, 600);
  };

  if (!claimable) {
    return (
      <View style={[styles.card, styles.cardClaimed]}>
        <View style={styles.row}>
          <Text style={styles.icon}>✅</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.titleClaimed}>Daily chest claimed</Text>
            <Text style={styles.subClaimed}>Streak: {streak} day{streak > 1 ? 's' : ''} · Come back tomorrow!</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={claim}>
      <LinearGradient
        colors={['#facc15', '#eab308', '#ca8a04']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.row}>
          <Text style={styles.icon}>🎁</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Daily chest is ready!</Text>
            <Text style={styles.sub}>Day {streak} streak · {streak < 7 ? 'rewards double tomorrow' : 'MAX streak reached!'}</Text>
          </View>
          <View style={styles.coinPill}>
            <Text style={styles.coinText}>+{todayPayout}</Text>
            <Text style={styles.coinIcon}>🪙</Text>
          </View>
        </View>
        <View style={styles.cta}>
          <Text style={styles.ctaText}>TAP TO CLAIM →</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18, padding: 16, marginBottom: 16,
    shadowColor: '#eab308', shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  cardClaimed: {
    backgroundColor: 'rgba(74,222,128,0.10)',
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.25)',
    shadowOpacity: 0,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { fontSize: 38 },
  title: { color: '#0a0a1a', fontSize: 17, fontWeight: '900', letterSpacing: 0.3 },
  sub:   { color: '#1f2937', fontSize: 12, opacity: 0.8, marginTop: 2 },
  titleClaimed: { color: '#4ade80', fontSize: 15, fontWeight: '700' },
  subClaimed:   { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  coinPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#0a0a1a', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  coinText: { color: '#facc15', fontSize: 16, fontWeight: '900' },
  coinIcon: { fontSize: 16 },
  cta: { marginTop: 10, alignItems: 'center' },
  ctaText: { color: '#0a0a1a', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
});
