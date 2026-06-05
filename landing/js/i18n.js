/**
 * Landing pages i18n (EN / FR / AR).
 *
 * v3.10.0 — single shared translation layer for all 7 landing pages.
 * Loaded as a regular <script> at the end of <body>.
 *
 * How it works:
 *   1. Walks every element with data-i18n="<key>" and replaces its text
 *      (or innerHTML if data-i18n-html is present).
 *   2. Reads / writes the chosen language to localStorage.sallysudo_lang.
 *   3. Toggles <html lang="…"> and <html dir="…"> for RTL Arabic.
 *   4. Renders an EN | FR | AR switcher next to the .nav-cta button.
 *   5. Renders a "Dashboard" link if a user blob is present in
 *      localStorage (set by the web app on sign-in) — so a signed-in
 *      visitor can jump straight into their app instead of seeing a
 *      generic "Play on web" CTA.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'sallysudo_lang';
  const APP_BASE    = 'https://app.sudoku.gowithsally.com';

  const T = {
    en: {
      // nav
      navHome: 'Home',
      navFeatures: 'Features',
      navHowto: 'How to Play',
      navScreens: 'Screenshots',
      navFaq: 'FAQ',
      navPlayWeb: '▶ Play on web',
      navDownload: 'Download',
      navDashboard: '▶ My dashboard',
      navSignIn: 'Sign in',
      authOr: 'or sign in',
      authSignIn: 'Sign in',
      authRegister: 'Create account',

      // hero
      heroBadge: 'Available now for Android · iOS coming soon',
      heroTitle: 'SallySudo',
      heroTagline: 'Train your brain daily.',
      heroLede: 'A beautiful, modern Sudoku puzzle game with five difficulty levels, smart hints, live 1v1 challenges and a gorgeous animated dark interface. Built for the way you actually play.',
      heroCtaDownload: '⬇ Download APK',
      heroCtaWeb: '▶ Play on web',
      heroCtaHow: 'How to play',

      // hero stats
      statLevels: 'DIFFICULTY LEVELS',
      statLangs: 'LANGUAGES · RTL',
      statChall: 'CHALLENGE MODE',

      // why-you'll-love
      whyEyebrow: "Why you'll love it",
      whyTitle: 'Everything a Sudoku fan wants',
      whySub: 'Thoughtfully designed features that make solving puzzles feel effortless and rewarding.',

      // difficulty
      diffEyebrow: 'Level progression',
      diffSub: "Master one tier to unlock the next. There's always a tougher puzzle waiting.",

      // CTA band
      ctaTitle: 'Ready to start solving?',
      ctaSub: 'Download SallySudo for Android today and play your first puzzle in seconds. Sign in with Google or jump straight in as a guest.',

      // footer
      footerTagline: 'The beautiful, modern Sudoku game for Android & iOS. Train your brain daily.',
      footerExplore: 'Explore',
      footerLegal: 'Legal',
      footerPrivacy: 'Privacy',
      footerCopyright: '© 2026 SallySudo · Made with focus.',
    },
    fr: {
      navHome: 'Accueil',
      navFeatures: 'Fonctionnalités',
      navHowto: 'Comment jouer',
      navScreens: 'Captures',
      navFaq: 'FAQ',
      navPlayWeb: '▶ Jouer en ligne',
      navDownload: 'Télécharger',
      navDashboard: '▶ Mon tableau de bord',
      navSignIn: 'Connexion',
      authOr: 'ou connecte-toi',
      authSignIn: 'Connexion',
      authRegister: 'Créer un compte',

      heroBadge: 'Disponible sur Android · iOS bientôt',
      heroTitle: 'SallySudo',
      heroTagline: "Entraîne ton cerveau, chaque jour.",
      heroLede: 'Un jeu de Sudoku moderne et soigné : cinq niveaux de difficulté, indices intelligents, duels 1v1 en direct et une interface sombre animée. Pensé pour la façon dont tu joues vraiment.',
      heroCtaDownload: '⬇ Télécharger l’APK',
      heroCtaWeb: '▶ Jouer en ligne',
      heroCtaHow: 'Comment jouer',

      statLevels: 'NIVEAUX DE DIFFICULTÉ',
      statLangs: 'LANGUES · RTL',
      statChall: 'MODE DUEL',

      whyEyebrow: 'Pourquoi tu vas adorer',
      whyTitle: 'Tout ce qu’un fan de Sudoku veut',
      whySub: 'Des fonctionnalités pensées pour rendre la résolution fluide et satisfaisante.',

      diffEyebrow: 'Progression des niveaux',
      diffSub: 'Maîtrise un palier pour débloquer le suivant. Il y a toujours une grille plus dure qui t’attend.',

      ctaTitle: 'Prêt à te lancer ?',
      ctaSub: 'Télécharge SallySudo pour Android et joue ta première grille en quelques secondes. Connecte-toi avec Google ou démarre en invité.',

      footerTagline: 'Le jeu de Sudoku moderne et soigné pour Android & iOS. Entraîne ton cerveau, chaque jour.',
      footerExplore: 'Explorer',
      footerLegal: 'Légal',
      footerPrivacy: 'Confidentialité',
      footerCopyright: '© 2026 SallySudo · Conçu avec attention.',
    },
    ar: {
      navHome: 'الرئيسية',
      navFeatures: 'المزايا',
      navHowto: 'طريقة اللعب',
      navScreens: 'لقطات',
      navFaq: 'الأسئلة',
      navPlayWeb: '▶ العب على الويب',
      navDownload: 'تنزيل',
      navDashboard: '▶ لوحة التحكم',
      navSignIn: 'تسجيل الدخول',
      authOr: 'أو سجل الدخول',
      authSignIn: 'تسجيل الدخول',
      authRegister: 'إنشاء حساب',

      heroBadge: 'متوفر الآن لأندرويد · iOS قريباً',
      heroTitle: 'ساليسودو',
      heroTagline: 'درّب دماغك كل يوم.',
      heroLede: 'لعبة سودوكو حديثة وأنيقة: خمسة مستويات صعوبة، تلميحات ذكية، تحديات 1v1 مباشرة، وواجهة داكنة بحركات سلسة. مصممة لطريقتك في اللعب.',
      heroCtaDownload: '⬇ تنزيل APK',
      heroCtaWeb: '▶ العب على الويب',
      heroCtaHow: 'طريقة اللعب',

      statLevels: 'مستويات الصعوبة',
      statLangs: 'لغات · RTL',
      statChall: 'وضع التحدي',

      whyEyebrow: 'لماذا ستحبها',
      whyTitle: 'كل ما يريده عاشق السودوكو',
      whySub: 'مزايا مصممة بعناية تجعل حل الألغاز سلساً ومُرضياً.',

      diffEyebrow: 'تدرج المستويات',
      diffSub: 'أتقن مستوى لفتح التالي. هناك دائماً لغز أصعب ينتظرك.',

      ctaTitle: 'جاهز للبدء؟',
      ctaSub: 'نزّل SallySudo لأندرويد والعب أول لغز خلال ثوانٍ. سجل دخول بـ Google أو ابدأ كضيف.',

      footerTagline: 'لعبة السودوكو الحديثة الأنيقة لأندرويد و iOS. درّب دماغك كل يوم.',
      footerExplore: 'استكشف',
      footerLegal: 'قانوني',
      footerPrivacy: 'الخصوصية',
      footerCopyright: '© 2026 SallySudo · صُمم بعناية.',
    },
  };

  function getLang() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && T[stored]) return stored;
    } catch (_) {}
    const browser = (navigator.language || 'en').slice(0, 2);
    return T[browser] ? browser : 'en';
  }

  function setLang(lang) {
    if (!T[lang]) return;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) {}
    applyLang(lang);
  }

  function applyLang(lang) {
    const dict = T[lang];
    document.documentElement.lang = lang;
    document.documentElement.dir = (lang === 'ar') ? 'rtl' : 'ltr';

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (dict[key] == null) return;
      if (el.hasAttribute('data-i18n-html')) el.innerHTML = dict[key];
      else el.textContent = dict[key];
    });

    document.querySelectorAll('.lang-switcher .lang-chip').forEach((chip) => {
      const code = chip.getAttribute('data-lang');
      chip.classList.toggle('active', code === lang);
    });
  }

  function isSignedIn() {
    try {
      // The web app writes 'sudoku_user' (AsyncStorage wraps it as the same
      // key in localStorage on the web build).
      const raw = localStorage.getItem('sudoku_user') || localStorage.getItem('@react-native-async-storage:sudoku_user');
      return !!(raw && raw.length > 2);
    } catch (_) { return false; }
  }

  function buildSwitcher() {
    const cta = document.querySelector('.nav-cta');
    if (!cta || cta.parentNode.querySelector('.lang-switcher')) return;
    const wrap = document.createElement('div');
    wrap.className = 'lang-switcher';
    ['en', 'fr', 'ar'].forEach((code) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'lang-chip';
      b.setAttribute('data-lang', code);
      b.textContent = code.toUpperCase();
      b.addEventListener('click', (e) => { e.preventDefault(); setLang(code); });
      wrap.appendChild(b);
    });
    cta.parentNode.insertBefore(wrap, cta);
  }

  function maybeRenderDashboard() {
    // Logged in? Swap the "Play on web" nav link for a direct link to the
    // in-app dashboard.
    if (!isSignedIn()) return;
    document.querySelectorAll('a.play-web').forEach((a) => {
      a.setAttribute('data-i18n', 'navDashboard');
      a.setAttribute('href', APP_BASE + '/home');
    });
    // Hero CTA "Play on web" → "Open dashboard"
    document.querySelectorAll('.btn-web').forEach((a) => {
      a.setAttribute('data-i18n', 'navDashboard');
      a.setAttribute('href', APP_BASE + '/home');
    });
  }

  /**
   * Auto-tag the standard nav links + footer chunks by their original English
   * text, so we don't have to sprinkle data-i18n attributes across every one
   * of the 7 landing pages. Only runs once on first paint.
   */
  function autoTag() {
    const NAV_MAP = {
      'Home': 'navHome',
      'Features': 'navFeatures',
      'How to Play': 'navHowto',
      'Screenshots': 'navScreens',
      'FAQ': 'navFaq',
      'Download': 'navDownload',
    };
    document.querySelectorAll('.nav-links a').forEach((a) => {
      if (a.hasAttribute('data-i18n')) return;
      const txt = (a.textContent || '').trim();
      if (NAV_MAP[txt]) a.setAttribute('data-i18n', NAV_MAP[txt]);
      else if (txt === '▶ Play on web') a.setAttribute('data-i18n', 'navPlayWeb');
      else if (a.classList.contains('nav-signin')) a.setAttribute('data-i18n', 'navSignIn');
    });
    document.querySelectorAll('.footer-col h4').forEach((h) => {
      const txt = (h.textContent || '').trim();
      if (txt === 'Explore') h.setAttribute('data-i18n', 'footerExplore');
      else if (txt === 'Legal') h.setAttribute('data-i18n', 'footerLegal');
    });
    document.querySelectorAll('.footer-col a, .footer-grid a').forEach((a) => {
      if (a.hasAttribute('data-i18n')) return;
      const txt = (a.textContent || '').trim();
      if (NAV_MAP[txt]) a.setAttribute('data-i18n', NAV_MAP[txt]);
      else if (txt === 'Privacy' || txt === 'Privacy Policy') a.setAttribute('data-i18n', 'footerPrivacy');
    });
    document.querySelectorAll('.footer-brand p').forEach((p) => {
      if (!p.hasAttribute('data-i18n')) p.setAttribute('data-i18n', 'footerTagline');
    });
    document.querySelectorAll('.footer-bottom, .copyright, .site-footer .container > p').forEach((p) => {
      const txt = (p.textContent || '').trim();
      if (txt.startsWith('©') || /SallySudo/.test(txt)) p.setAttribute('data-i18n', 'footerCopyright');
    });
  }

  /**
   * v3.11.1 — render the Google Identity Services button into
   * #g_id_signin_landing on pages that contain it (currently only
   * index.html). Hides the whole auth row when a session is already
   * detected (the Dashboard link in the nav takes over).
   */
  function setupLandingAuth() {
    if (isSignedIn()) {
      document.body.classList.add('is-authed');
      return;
    }
    const slot = document.getElementById('g_id_signin_landing');
    if (!slot) return;
    const SA = window.SALLYSUDO_AUTH;
    if (!SA || !SA.clientId) return;

    function render() {
      if (!window.google || !window.google.accounts || !window.google.accounts.id) return false;
      try {
        window.google.accounts.id.initialize({
          client_id: SA.clientId,
          callback: window.handleSallySudoCredential,
          auto_select: false,
        });
        window.google.accounts.id.renderButton(slot, {
          theme: 'filled_black',
          size: 'large',
          text: 'signin_with',
          shape: 'pill',
          logo_alignment: 'left',
        });
        return true;
      } catch (_) { return false; }
    }
    // gsi/client is loaded async — poll briefly until it appears.
    if (render()) return;
    let tries = 0;
    const iv = setInterval(() => {
      tries++;
      if (render() || tries > 40) clearInterval(iv);
    }, 150);
  }

  function init() {
    buildSwitcher();
    autoTag();
    maybeRenderDashboard();
    setupLandingAuth();
    applyLang(getLang());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
