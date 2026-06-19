import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../utils/theme';
import LegalLayout, { H, P, Li } from '../components/LegalLayout';
import { useLang } from '../utils/LanguageContext';
import { LEGAL } from '../utils/legalContent';

const PLAY = { en: '▶ Play now', fr: '▶ Jouer maintenant', ar: '▶ العب الآن' } as const;
const PRICING = { en: 'See pricing', fr: 'Voir les tarifs', ar: 'عرض الأسعار' } as const;

export default function About() {
  const { c, r, s } = useTheme();
  const router = useRouter();
  const { lang } = useLang() as any;
  const page = LEGAL.about;
  const tr = (l: any) => l[lang] || l.en;

  return (
    <LegalLayout title={tr(page.title)} subtitle={tr(page.subtitle)}>
      {page.blocks.map((b, i) => {
        const text = tr(b.text);
        if (b.kind === 'h') return <H key={i}>{text}</H>;
        if (b.kind === 'li') return <Li key={i}>{text}</Li>;
        return <P key={i}>{text}</P>;
      })}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.md, marginTop: s.xl }}>
        <TouchableOpacity onPress={() => router.push('/home' as any)} style={{ paddingHorizontal: s.xl, paddingVertical: 12, borderRadius: r.pill, backgroundColor: c.violet }}>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>{PLAY[lang as keyof typeof PLAY] || PLAY.en}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/pricing' as any)} style={{ paddingHorizontal: s.xl, paddingVertical: 12, borderRadius: r.pill, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: c.border }}>
          <Text style={{ color: c.text, fontWeight: '900', fontSize: 14 }}>{PRICING[lang as keyof typeof PRICING] || PRICING.en}</Text>
        </TouchableOpacity>
      </View>
    </LegalLayout>
  );
}
