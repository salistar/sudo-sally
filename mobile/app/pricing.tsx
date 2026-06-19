import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../utils/theme';
import LegalLayout, { H, P, Li } from '../components/LegalLayout';
import { useLang } from '../utils/LanguageContext';
import { LEGAL, PRICING_UI } from '../utils/legalContent';

export default function Pricing() {
  const { c, r, s, type } = useTheme();
  const router = useRouter();
  const { lang } = useLang() as any;
  const page = LEGAL.pricing;
  const tr = (l: any) => l[lang] || l.en;

  return (
    <LegalLayout title={tr(page.title)} subtitle={tr(page.subtitle)}>
      <View style={{ padding: s.x2, borderRadius: r.lg, backgroundColor: c.surface800, borderWidth: 1, borderColor: c.borderStrong, marginTop: s.md, overflow: 'hidden' }}>
        <Text style={{ color: c.violet, ...type.eyebrow }}>{tr(PRICING_UI.eyebrow)}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 6, marginBottom: s.lg }}>
          <Text style={{ color: c.textStrong, fontSize: 56, fontWeight: '900', letterSpacing: -2 }}>€0</Text>
          <Text style={{ color: c.textMuted, fontSize: 16, marginBottom: 12 }}>{tr(PRICING_UI.per)}</Text>
        </View>
        {PRICING_UI.included.map((it, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
            <Text style={{ color: c.success, fontSize: 15, fontWeight: '900' }}>✓</Text>
            <Text style={{ color: c.text, ...type.body, lineHeight: 22, flex: 1 }}>{tr(it)}</Text>
          </View>
        ))}
        <TouchableOpacity onPress={() => router.push('/home' as any)} style={{ marginTop: s.lg, alignSelf: 'flex-start', paddingHorizontal: s.x2, paddingVertical: 13, borderRadius: r.pill, backgroundColor: c.violet }}>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>{tr(PRICING_UI.cta)}</Text>
        </TouchableOpacity>
      </View>

      {page.blocks.map((b, i) => {
        const text = tr(b.text);
        if (b.kind === 'h') return <H key={i}>{text}</H>;
        if (b.kind === 'li') return <Li key={i}>{text}</Li>;
        return <P key={i}>{text}</P>;
      })}
    </LegalLayout>
  );
}
