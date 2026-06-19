import LegalLayout, { H, P, Li } from '../components/LegalLayout';
import { useLang } from '../utils/LanguageContext';
import { LEGAL } from '../utils/legalContent';

export default function Terms() {
  const { lang } = useLang() as any;
  const page = LEGAL.terms;
  const tr = (l: any) => l[lang] || l.en;

  return (
    <LegalLayout title={tr(page.title)} subtitle={tr(page.subtitle)}>
      {page.blocks.map((b, i) => {
        const text = tr(b.text);
        if (b.kind === 'h') return <H key={i}>{text}</H>;
        if (b.kind === 'li') return <Li key={i}>{text}</Li>;
        return <P key={i}>{text}</P>;
      })}
    </LegalLayout>
  );
}
