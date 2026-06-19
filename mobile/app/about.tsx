import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../utils/theme';
import LegalLayout, { H, P, Li } from '../components/LegalLayout';

export default function About() {
  const { c, r, s } = useTheme();
  const router = useRouter();
  return (
    <LegalLayout title="About SallySudo" subtitle="Sudoku, reimagined for real-time play.">
      <P>SallySudo is a modern take on the classic number puzzle: the calm, logical Sudoku you love — plus daily challenges, a ranked leaderboard, and real‑time 1v1 duels where you can chat, call, and watch replays. It runs in your browser and as a mobile app, and your progress follows you across both.</P>

      <H>What makes it different</H>
      <Li><Bld c={c}>Real‑time 1v1 duels</Bld> — challenge anyone, race on the same puzzle, and talk smack in chat or on a call.</Li>
      <Li><Bld c={c}>Replays</Bld> — relive any finished match move by move, Chess.com‑style.</Li>
      <Li><Bld c={c}>Progression that sticks</Bld> — levels, stars, XP, coins, streaks, achievements and themes.</Li>
      <Li><Bld c={c}>Cross‑platform</Bld> — one account, web and mobile, three languages (English, Français, العربية) with full RTL.</Li>

      <H>Who builds it</H>
      <P>SallySudo is crafted by the Salistar studio. We care about fast, polished, fair games that respect your time and your data — no ad tracking, no pay‑to‑win.</P>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.md, marginTop: s.xl }}>
        <TouchableOpacity onPress={() => router.push('/home' as any)} style={{ paddingHorizontal: s.xl, paddingVertical: 12, borderRadius: r.pill, backgroundColor: c.violet }}>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>▶ Play now</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/pricing' as any)} style={{ paddingHorizontal: s.xl, paddingVertical: 12, borderRadius: r.pill, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: c.border }}>
          <Text style={{ color: c.text, fontWeight: '900', fontSize: 14 }}>See pricing</Text>
        </TouchableOpacity>
      </View>
    </LegalLayout>
  );
}

function Bld({ children, c }: { children: React.ReactNode; c: any }) {
  return <Text style={{ color: c.textStrong, fontWeight: '800' }}>{children}</Text>;
}
