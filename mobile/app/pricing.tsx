import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../utils/theme';
import LegalLayout, { H, P, Li } from '../components/LegalLayout';

export default function Pricing() {
  const { c, r, s, type } = useTheme();
  const router = useRouter();

  const included = [
    'Unlimited puzzles across 30 levels + a fresh daily challenge',
    'Real‑time 1v1 duels with chat, voice & video calls',
    'Move‑by‑move replays of every match',
    'Ranked leaderboard, achievements, streaks & XP',
    'Two themes (Midnight & Atlas Gold) + cosmetics earned with in‑game coins',
    'Web and mobile, three languages — one account everywhere',
  ];

  return (
    <LegalLayout title="Pricing" subtitle="Free to play. No subscription, no pay‑to‑win, no ads.">
      <View style={{ padding: s.x2, borderRadius: r.lg, backgroundColor: c.surface800, borderWidth: 1, borderColor: c.borderStrong, marginTop: s.md, overflow: 'hidden' }}>
        <Text style={{ color: c.violet, ...type.eyebrow }}>FREE FOREVER</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 6, marginBottom: s.lg }}>
          <Text style={{ color: c.textStrong, fontSize: 56, fontWeight: '900', letterSpacing: -2 }}>€0</Text>
          <Text style={{ color: c.textMuted, fontSize: 16, marginBottom: 12 }}>/ forever</Text>
        </View>
        {included.map((it, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
            <Text style={{ color: c.success, fontSize: 15, fontWeight: '900' }}>✓</Text>
            <Text style={{ color: c.text, ...type.body, lineHeight: 22, flex: 1 }}>{it}</Text>
          </View>
        ))}
        <TouchableOpacity onPress={() => router.push('/home' as any)} style={{ marginTop: s.lg, alignSelf: 'flex-start', paddingHorizontal: s.x2, paddingVertical: 13, borderRadius: r.pill, backgroundColor: c.violet }}>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>▶ Start playing</Text>
        </TouchableOpacity>
      </View>

      <H>What about coins and themes?</H>
      <P>Coins, power‑ups and premium themes are earned by playing — they’re part of the game, not a paywall. There is currently no real‑money purchase required to enjoy any gameplay feature.</P>
      <Li>Coins are earned from wins, daily challenges and streaks.</Li>
      <Li>Virtual items have no cash value and exist only to personalize your experience.</Li>

      <H>For teams & events</H>
      <P>Interested in private tournaments, classroom use, or a branded leaderboard? Get in touch via sallysudo.com.</P>
    </LegalLayout>
  );
}
