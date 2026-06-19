import { View, Text, TouchableOpacity, Platform, Linking } from 'react-native';
import { useTheme } from '../utils/theme';
import LegalLayout, { H, P, Li, Card } from '../components/LegalLayout';

const open = (url: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(url, '_blank');
  else Linking.openURL(url).catch(() => {});
};

export default function Press() {
  const { c, r, s, type } = useTheme();

  const facts: [string, string][] = [
    ['Name', 'SallySudo'],
    ['Category', 'Puzzle / Casual · Real‑time multiplayer'],
    ['Platforms', 'Web (app.sallysudo.com) · Android · iOS'],
    ['Price', 'Free to play'],
    ['Languages', 'English · Français · العربية (RTL)'],
    ['Studio', 'Salistar'],
    ['Website', 'sallysudo.com'],
  ];

  const Asset = ({ label, url }: { label: string; url: string }) => (
    <TouchableOpacity onPress={() => open(url)} style={{ paddingHorizontal: s.lg, paddingVertical: 10, borderRadius: r.pill, backgroundColor: 'rgba(124,92,255,0.12)', borderWidth: 1, borderColor: 'rgba(124,92,255,0.4)' }}>
      <Text style={{ color: c.violet, fontWeight: '800', fontSize: 13 }}>⬇ {label}</Text>
    </TouchableOpacity>
  );

  return (
    <LegalLayout title="Press kit" subtitle="Everything you need to write about SallySudo.">
      <H>Boilerplate</H>
      <P>SallySudo is a modern, real‑time Sudoku game for web and mobile. Beyond daily solo puzzles and a ranked leaderboard, it lets players face off in live 1v1 duels — racing the same grid while they chat, call, and review move‑by‑move replays afterward. Built by the Salistar studio, SallySudo is free to play, available in three languages, and designed to be fast, polished and fair: no ad tracking and no pay‑to‑win.</P>

      <H>Fast facts</H>
      <Card>
        {facts.map(([k, v], i) => (
          <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.border, gap: s.lg }}>
            <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '700' }}>{k}</Text>
            <Text style={{ color: c.text, fontSize: 13, fontWeight: '700', textAlign: 'right', flex: 1 }}>{v}</Text>
          </View>
        ))}
      </Card>

      <H>Brand assets</H>
      <P>Download our share image and icon. Please don’t alter the logo or imply endorsement.</P>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.md, marginTop: s.sm }}>
        <Asset label="Social image (1200×630)" url="https://app.sallysudo.com/og-image.png" />
        <Asset label="App icon" url="https://app.sallysudo.com/favicon.ico" />
      </View>

      <H>Key features</H>
      <Li>Real‑time 1v1 Sudoku duels with chat, voice & video.</Li>
      <Li>Chess.com‑style replays of finished matches.</Li>
      <Li>Daily challenge, 30 levels, ranked leaderboard, achievements.</Li>
      <Li>Cross‑platform single account; English / Français / العربية.</Li>

      <H>Contact</H>
      <P>For interviews, assets or review access, reach out via sallysudo.com.</P>
    </LegalLayout>
  );
}
