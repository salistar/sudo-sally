/**
 * Changelog data + canonical app version.
 *
 * The "What's new" modal (mounted in WebGlobals) shows the entries whose
 * version is newer than the visitor's last-seen version. Items are localized
 * inline ({en,fr,ar}) so they don't bloat i18n.ts.
 *
 * Keep CURRENT_VERSION in sync with app.json's `version`. Newest entry first.
 */
export const CURRENT_VERSION = '3.11.17';

type LocStr = { en: string; fr: string; ar: string };
export type ChangelogEntry = { version: string; date: string; items: LocStr[] };

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '3.11.17',
    date: '2026-06-19',
    items: [
      { en: 'Level-up & achievement celebrations when you win', fr: 'Célébrations de niveau et de succès à la victoire', ar: 'احتفالات الترقية والإنجازات عند الفوز' },
      { en: 'Keyboard shortcuts on the board (arrows + 1-9)', fr: 'Raccourcis clavier sur la grille (flèches + 1-9)', ar: 'اختصارات لوحة المفاتيح على الشبكة (الأسهم + 1-9)' },
      { en: 'Theme switcher: Midnight or Atlas Gold', fr: 'Sélecteur de thème : Minuit ou Atlas Or', ar: 'مبدّل الثيم: منتصف الليل أو أطلس الذهبي' },
      { en: 'Right-to-left layout for Arabic', fr: 'Mise en page de droite à gauche pour l\'arabe', ar: 'تخطيط من اليمين إلى اليسار للعربية' },
      { en: 'Smoother loading skeletons', fr: 'Chargements en squelette plus fluides', ar: 'هياكل تحميل أكثر سلاسة' },
    ],
  },
  {
    version: '3.11.16',
    date: '2026-06-19',
    items: [
      { en: 'Real-time chat taunts in 1v1 duels', fr: 'Provocations de chat en temps réel dans les duels 1v1', ar: 'استفزازات الدردشة الفورية في مبارزات 1 ضد 1' },
      { en: 'Move-by-move replay of finished matches', fr: 'Replay coup par coup des parties terminées', ar: 'إعادة المباريات المنتهية حركة بحركة' },
      { en: 'Public profile pages and live toasts', fr: 'Pages de profil public et notifications en direct', ar: 'صفحات الملف العام والإشعارات الحية' },
    ],
  },
];
