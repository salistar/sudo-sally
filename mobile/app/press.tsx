import { View, Text, TouchableOpacity, Platform, Linking } from 'react-native';
import { useTheme } from '../utils/theme';
import LegalLayout, { H, P, Li, Card } from '../components/LegalLayout';
import { useLang } from '../utils/LanguageContext';
import { LEGAL, PRESS_UI } from '../utils/legalContent';

const open = (url: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(url, '_blank');
  else Linking.openURL(url).catch(() => {});
};

export default function Press() {
  const { c, r, s } = useTheme();
  const { lang } = useLang() as any;
  const page = LEGAL.press;
  const tr = (l: any) => l[lang] || l.en;
  // Headings are addressed by their position in page.blocks for clarity.
  const h = (i: number) => tr(page.blocks[i].text);

  const Asset = ({ label, url }: { label: string; url: string }) => (
    <TouchableOpacity onPress={() => open(url)} style={{ paddingHorizontal: s.lg, paddingVertical: 10, borderRadius: r.pill, backgroundColor: 'rgba(124,92,255,0.12)', borderWidth: 1, borderColor: 'rgba(124,92,255,0.4)' }}>
      <Text style={{ color: c.violet, fontWeight: '800', fontSize: 13 }}>⬇ {label}</Text>
    </TouchableOpacity>
  );

  return (
    <LegalLayout title={tr(page.title)} subtitle={tr(page.subtitle)}>
      {/* 0: Boilerplate heading, 1: boilerplate paragraph */}
      <H>{h(0)}</H>
      <P>{tr(page.blocks[1].text)}</P>

      {/* 2: Fast facts heading + table */}
      <H>{h(2)}</H>
      <Card>
        {PRESS_UI.facts.map((f, i) => (
          <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.border, gap: s.lg }}>
            <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '700' }}>{tr(f.k)}</Text>
            <Text style={{ color: c.text, fontSize: 13, fontWeight: '700', textAlign: 'right', flex: 1 }}>{tr(f.v)}</Text>
          </View>
        ))}
      </Card>

      {/* 3: Brand assets heading, 4: brand assets paragraph + buttons */}
      <H>{h(3)}</H>
      <P>{tr(page.blocks[4].text)}</P>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.md, marginTop: s.sm }}>
        <Asset label={tr(PRESS_UI.assetSocial)} url="https://app.sallysudo.com/og-image.png" />
        <Asset label={tr(PRESS_UI.assetIcon)} url="https://app.sallysudo.com/favicon.ico" />
      </View>

      {/* 5: Key features heading, 6-9: bullets */}
      <H>{h(5)}</H>
      <Li>{tr(page.blocks[6].text)}</Li>
      <Li>{tr(page.blocks[7].text)}</Li>
      <Li>{tr(page.blocks[8].text)}</Li>
      <Li>{tr(page.blocks[9].text)}</Li>

      {/* 10: Contact heading, 11: contact paragraph */}
      <H>{h(10)}</H>
      <P>{tr(page.blocks[11].text)}</P>
    </LegalLayout>
  );
}
