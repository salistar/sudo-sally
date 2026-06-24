/**
 * Localized content for the static legal / marketing pages
 * (/privacy /terms /about /pricing /press).
 *
 * Long-form prose lives here — keyed by language — so it doesn't bloat
 * i18n.ts (same precedent as changelog.ts). Each page is a list of typed
 * blocks (heading / paragraph / bullet) rendered in order by the page,
 * which maps each kind to the LegalLayout H / P / Li helpers.
 *
 * Interactive / structural JSX (the €0 price card, the press fast-facts
 * table, asset-download buttons, CTAs) stays in the page files; only the
 * visible TEXT is provided here (titles, subtitles, headings, paragraphs,
 * bullets, and a few labels exported separately for those pages).
 */

export type Loc = { en: string; fr: string; ar: string };

export type Block =
  | { kind: 'p'; text: Loc }
  | { kind: 'h'; text: Loc }
  | { kind: 'li'; text: Loc };

export type LegalPage = { title: Loc; subtitle: Loc; blocks: Block[] };

const L = (en: string, fr: string, ar: string): Loc => ({ en, fr, ar });

// ── Privacy ──────────────────────────────────────────────────────────────
const privacy: LegalPage = {
  title: L('Privacy Policy', 'Politique de confidentialité', 'سياسة الخصوصية'),
  subtitle: L(
    'Last updated: 19 June 2026. How SallySudo handles your data — in plain language.',
    'Dernière mise à jour : 19 juin 2026. Comment SallySudo traite vos données — en termes simples.',
    'آخر تحديث: 19 يونيو 2026. كيف يتعامل SallySudo مع بياناتك — بلغة واضحة.',
  ),
  blocks: [
    {
      kind: 'p',
      text: L(
        'SallySudo (“we”, “the app”) is a Sudoku game available on the web and as a mobile app. We keep data collection to the minimum needed to run your account and the game. We do not sell your data and we do not run third‑party advertising or tracking.',
        'SallySudo (« nous », « l’application ») est un jeu de Sudoku disponible sur le web et en application mobile. Nous limitons la collecte de données au strict nécessaire pour gérer votre compte et le jeu. Nous ne vendons pas vos données et nous ne diffusons aucune publicité ni aucun traçage tiers.',
        'SallySudo (« نحن »، « التطبيق ») هي لعبة سودوكو متاحة على الويب وكتطبيق للهاتف المحمول. نُبقي جمع البيانات عند الحد الأدنى اللازم لتشغيل حسابك واللعبة. نحن لا نبيع بياناتك ولا نعرض أي إعلانات أو تتبّع من أطراف خارجية.',
      ),
    },
    { kind: 'h', text: L('What we collect', 'Ce que nous collectons', 'ما الذي نجمعه') },
    {
      kind: 'li',
      text: L(
        'Account data: a username, email address, and an avatar you choose. Passwords are stored only as a salted bcrypt hash — never in plain text. If you sign in with Google, we receive a Google account identifier and your basic profile (name, email) from Google’s sign‑in token.',
        'Données de compte : un nom d’utilisateur, une adresse e‑mail et un avatar de votre choix. Les mots de passe sont stockés uniquement sous forme de hachage bcrypt salé — jamais en clair. Si vous vous connectez avec Google, nous recevons un identifiant de compte Google et votre profil de base (nom, e‑mail) à partir du jeton de connexion de Google.',
        'بيانات الحساب: اسم مستخدم وعنوان بريد إلكتروني وصورة رمزية تختارها. تُخزَّن كلمات المرور فقط على هيئة بصمة bcrypt مُملَّحة — وليست أبداً كنص صريح. إذا سجّلت الدخول عبر Google، فإننا نتلقى معرّف حساب Google وملفك الأساسي (الاسم، البريد الإلكتروني) من رمز تسجيل الدخول الخاص بـ Google.',
      ),
    },
    {
      kind: 'li',
      text: L(
        'Gameplay data: your levels, stars, XP, coins, streaks, achievements, and 1v1 challenge results.',
        'Données de jeu : vos niveaux, étoiles, XP, pièces, séries, succès et résultats des défis 1v1.',
        'بيانات اللعب: مستوياتك ونجومك ونقاط الخبرة والعملات والسلاسل والإنجازات ونتائج تحديات 1 ضد 1.',
      ),
    },
    {
      kind: 'li',
      text: L(
        'On‑device data: your progress, settings, theme and consent choices are also cached in your browser/device local storage so the app works smoothly and remembers your preferences.',
        'Données sur l’appareil : votre progression, vos paramètres, votre thème et vos choix de consentement sont également mis en cache dans le stockage local de votre navigateur/appareil afin que l’application fonctionne bien et mémorise vos préférences.',
        'بيانات على الجهاز: يتم أيضاً تخزين تقدّمك وإعداداتك والثيم وخيارات الموافقة في وحدة التخزين المحلية لمتصفحك/جهازك حتى يعمل التطبيق بسلاسة ويتذكّر تفضيلاتك.',
      ),
    },
    { kind: 'h', text: L('How we use it', 'Comment nous l’utilisons', 'كيف نستخدمها') },
    {
      kind: 'li',
      text: L(
        'To create and secure your account and sign you in.',
        'Pour créer et sécuriser votre compte et vous connecter.',
        'لإنشاء حسابك وتأمينه وتسجيل دخولك.',
      ),
    },
    {
      kind: 'li',
      text: L(
        'To run the game: save progress, compute the leaderboard, match you in 1v1 duels and show profiles.',
        'Pour faire fonctionner le jeu : enregistrer la progression, calculer le classement, vous associer dans les duels 1v1 et afficher les profils.',
        'لتشغيل اللعبة: حفظ التقدّم، وحساب لوحة المتصدرين، ومطابقتك في مبارزات 1 ضد 1، وعرض الملفات الشخصية.',
      ),
    },
    {
      kind: 'li',
      text: L(
        'To keep the service working and prevent abuse.',
        'Pour maintenir le service en état de marche et prévenir les abus.',
        'للحفاظ على عمل الخدمة ومنع إساءة الاستخدام.',
      ),
    },
    { kind: 'h', text: L('Cookies & local storage', 'Cookies et stockage local', 'ملفات تعريف الارتباط والتخزين المحلي') },
    {
      kind: 'p',
      text: L(
        'We use device local storage (and the equivalent on web) for essential functions: keeping you signed in, saving progress and settings, and remembering that you accepted this notice. We do not use advertising or cross‑site tracking cookies.',
        'Nous utilisons le stockage local de l’appareil (et son équivalent sur le web) pour des fonctions essentielles : vous garder connecté, enregistrer la progression et les paramètres, et mémoriser que vous avez accepté cet avis. Nous n’utilisons pas de cookies publicitaires ni de traçage inter‑sites.',
        'نستخدم وحدة التخزين المحلية للجهاز (وما يعادلها على الويب) لوظائف أساسية: إبقاؤك مسجّلاً، وحفظ التقدّم والإعدادات، وتذكّر موافقتك على هذا الإشعار. نحن لا نستخدم ملفات تعريف ارتباط إعلانية أو للتتبّع عبر المواقع.',
      ),
    },
    { kind: 'h', text: L('Third parties', 'Tiers', 'الأطراف الخارجية') },
    {
      kind: 'li',
      text: L(
        'Google Sign‑In — optional; used only to authenticate you. Subject to Google’s own privacy policy.',
        'Connexion Google — facultative ; utilisée uniquement pour vous authentifier. Soumise à la propre politique de confidentialité de Google.',
        'تسجيل الدخول عبر Google — اختياري؛ يُستخدم فقط للتحقق من هويتك. خاضع لسياسة خصوصية Google الخاصة.',
      ),
    },
    {
      kind: 'li',
      text: L(
        'Real‑time duels & calls — 1v1 play uses a real‑time socket connection; optional voice/video calls are peer‑to‑peer (WebRTC) and use public STUN/TURN servers to connect. Call media is exchanged directly between players and is not stored by us. Optional live broadcast — if BOTH players consent, the match (both players’ boards, names, in‑game chat, and, when a call is active, your camera and microphone) is composited and streamed live to YouTube (a Google service) via our media relay. Broadcasts are unlisted by default; this audio/video is transmitted to and processed by YouTube under Google’s Privacy Policy and YouTube’s Terms; our relay forwards it transiently and does not retain it. Either player can decline or stop the live at any time.',
        'Duels et appels en temps réel — le jeu 1v1 utilise une connexion socket en temps réel ; les appels audio/vidéo facultatifs sont pair‑à‑pair (WebRTC) et utilisent des serveurs STUN/TURN publics. Le flux des appels est échangé directement entre les joueurs et n’est pas stocké par nos soins. Diffusion en direct facultative — si LES DEUX joueurs y consentent, le match (les grilles des deux joueurs, leurs noms, le chat, et, si un appel est actif, votre caméra et votre micro) est composé puis diffusé en direct sur YouTube (un service Google) via notre relais média. Les diffusions sont non répertoriées par défaut ; cet audio/vidéo est transmis à YouTube et traité selon la politique de confidentialité de Google et les conditions de YouTube ; notre relais ne fait que le transmettre et ne le conserve pas. Chaque joueur peut refuser ou arrêter le direct à tout moment.',
        'المبارزات والمكالمات الفورية — يستخدم اللعب 1 ضد 1 اتصال socket فوري؛ أما المكالمات الصوتية/المرئية الاختيارية فهي من نظير إلى نظير (WebRTC) وتستخدم خوادم STUN/TURN العامة. يتم تبادل وسائط المكالمة مباشرة بين اللاعبين ولا نقوم بتخزينها. البث المباشر الاختياري — إذا وافق كلا اللاعبين، تُجمَّع المباراة (لوحتا اللاعبين وأسماؤهما والمحادثة، وعند تفعيل مكالمة كاميرتك وميكروفونك) وتُبثّ مباشرة على YouTube (خدمة من Google) عبر مُرحِّل الوسائط لدينا. تكون عمليات البث غير مُدرجة افتراضيًا؛ ويُنقل هذا الصوت/الفيديو إلى YouTube ويُعالَج وفق سياسة خصوصية Google وشروط YouTube؛ ومُرحِّلنا ينقله مؤقتًا فقط ولا يحتفظ به. يمكن لأي لاعب الرفض أو إيقاف البث في أي وقت.',
      ),
    },
    { kind: 'h', text: L('Data retention & your rights', 'Conservation des données et vos droits', 'الاحتفاظ بالبيانات وحقوقك') },
    {
      kind: 'p',
      text: L(
        'You can delete your account at any time from Settings → Delete my account, which removes your account record from our servers. You may also request access to or correction of your data. To exercise these rights, contact us via sallysudo.com.',
        'Vous pouvez supprimer votre compte à tout moment depuis Paramètres → Supprimer mon compte, ce qui efface l’enregistrement de votre compte de nos serveurs. Vous pouvez également demander l’accès à vos données ou leur rectification. Pour exercer ces droits, contactez‑nous via sallysudo.com.',
        'يمكنك حذف حسابك في أي وقت من الإعدادات ← حذف حسابي، ما يؤدي إلى إزالة سجل حسابك من خوادمنا. يمكنك أيضاً طلب الوصول إلى بياناتك أو تصحيحها. لممارسة هذه الحقوق، تواصل معنا عبر sallysudo.com.',
      ),
    },
    { kind: 'h', text: L('Children', 'Enfants', 'الأطفال') },
    {
      kind: 'p',
      text: L(
        'SallySudo is not directed at children under 13 (or the minimum age in your country). We do not knowingly collect data from children.',
        'SallySudo ne s’adresse pas aux enfants de moins de 13 ans (ou de l’âge minimum dans votre pays). Nous ne collectons pas sciemment de données auprès d’enfants.',
        'SallySudo ليس موجّهاً للأطفال دون سن 13 عاماً (أو الحد الأدنى للسن في بلدك). نحن لا نجمع بيانات عن الأطفال عن قصد.',
      ),
    },
    { kind: 'h', text: L('Changes', 'Modifications', 'التغييرات') },
    {
      kind: 'p',
      text: L(
        'We may update this policy as the app evolves. We’ll update the “last updated” date above and, for significant changes, surface a notice in the app.',
        'Nous pouvons mettre à jour cette politique à mesure que l’application évolue. Nous mettrons à jour la date de « dernière mise à jour » ci‑dessus et, pour les changements importants, afficherons un avis dans l’application.',
        'قد نقوم بتحديث هذه السياسة مع تطوّر التطبيق. سنحدّث تاريخ « آخر تحديث » أعلاه، وبالنسبة للتغييرات الجوهرية، سنعرض إشعاراً داخل التطبيق.',
      ),
    },
  ],
};

// ── Terms ────────────────────────────────────────────────────────────────
const terms: LegalPage = {
  title: L('Terms of Service', 'Conditions d’utilisation', 'شروط الخدمة'),
  subtitle: L(
    'Last updated: 19 June 2026. The rules for using SallySudo.',
    'Dernière mise à jour : 19 juin 2026. Les règles d’utilisation de SallySudo.',
    'آخر تحديث: 19 يونيو 2026. قواعد استخدام SallySudo.',
  ),
  blocks: [
    {
      kind: 'p',
      text: L(
        'By creating an account or using SallySudo, you agree to these terms. If you don’t agree, please don’t use the app.',
        'En créant un compte ou en utilisant SallySudo, vous acceptez ces conditions. Si vous n’êtes pas d’accord, veuillez ne pas utiliser l’application.',
        'بإنشاء حساب أو باستخدام SallySudo، فإنك توافق على هذه الشروط. إذا لم توافق، فيُرجى عدم استخدام التطبيق.',
      ),
    },
    { kind: 'h', text: L('Eligibility & accounts', 'Éligibilité et comptes', 'الأهلية والحسابات') },
    {
      kind: 'li',
      text: L(
        'You must meet the minimum age in your country (at least 13).',
        'Vous devez avoir l’âge minimum requis dans votre pays (au moins 13 ans).',
        'يجب أن تكون قد بلغت الحد الأدنى للسن في بلدك (13 عاماً على الأقل).',
      ),
    },
    {
      kind: 'li',
      text: L(
        'You’re responsible for your account and for keeping your credentials secure. Don’t share your account or impersonate others.',
        'Vous êtes responsable de votre compte et de la sécurité de vos identifiants. Ne partagez pas votre compte et n’usurpez pas l’identité d’autrui.',
        'أنت مسؤول عن حسابك وعن الحفاظ على أمان بيانات اعتمادك. لا تشارك حسابك ولا تنتحل شخصية الآخرين.',
      ),
    },
    {
      kind: 'li',
      text: L(
        'Provide accurate information and keep your username appropriate — we may rename or remove offensive or infringing usernames.',
        'Fournissez des informations exactes et veillez à ce que votre nom d’utilisateur reste approprié — nous pouvons renommer ou supprimer les noms d’utilisateur offensants ou contrefaisants.',
        'قدّم معلومات دقيقة وحافظ على ملاءمة اسم المستخدم الخاص بك — يجوز لنا تغيير أو إزالة أسماء المستخدمين المسيئة أو المخالفة.',
      ),
    },
    { kind: 'h', text: L('Acceptable use', 'Usage acceptable', 'الاستخدام المقبول') },
    {
      kind: 'li',
      text: L(
        'Play fair: no cheating, automation/bots, exploiting bugs, or tampering with scores, the leaderboard, or 1v1 results.',
        'Jouez franc jeu : pas de triche, d’automatisation/bots, d’exploitation de bugs, ni de falsification des scores, du classement ou des résultats 1v1.',
        'العب بنزاهة: ممنوع الغش أو الأتمتة/الروبوتات أو استغلال الثغرات أو التلاعب بالنتائج أو لوحة المتصدرين أو نتائج 1 ضد 1.',
      ),
    },
    {
      kind: 'li',
      text: L(
        'Be respectful in chat and calls. No harassment, hate speech, or illegal content.',
        'Soyez respectueux dans le chat et les appels. Pas de harcèlement, de discours haineux ni de contenu illégal.',
        'كن محترماً في الدردشة والمكالمات. ممنوع التحرّش أو خطاب الكراهية أو المحتوى غير القانوني.',
      ),
    },
    {
      kind: 'li',
      text: L(
        'Don’t attack, overload, reverse‑engineer, or disrupt the service or other players.',
        'N’attaquez pas, ne surchargez pas, ne faites pas de rétro‑ingénierie et ne perturbez pas le service ou les autres joueurs.',
        'لا تهاجم الخدمة أو اللاعبين الآخرين أو تُثقلها أو تقوم بهندستها العكسية أو تعطّلها.',
      ),
    },
    { kind: 'h', text: L('Virtual items', 'Objets virtuels', 'العناصر الافتراضية') },
    {
      kind: 'p',
      text: L(
        'Coins, stars, XP, themes and power‑ups are part of the game. They have no monetary value, cannot be exchanged for cash, and may be adjusted or reset to keep the game fair and balanced.',
        'Les pièces, étoiles, XP, thèmes et bonus font partie du jeu. Ils n’ont aucune valeur monétaire, ne peuvent pas être échangés contre de l’argent, et peuvent être ajustés ou réinitialisés afin de garder le jeu juste et équilibré.',
        'العملات والنجوم ونقاط الخبرة والثيمات والمعزّزات جزء من اللعبة. ليس لها أي قيمة نقدية، ولا يمكن استبدالها بالنقود، وقد يتم تعديلها أو إعادة ضبطها للحفاظ على عدالة اللعبة وتوازنها.',
      ),
    },
    { kind: 'h', text: L('Availability & “as is”', 'Disponibilité et « tel quel »', 'التوافر و « كما هو »') },
    {
      kind: 'p',
      text: L(
        'We work to keep SallySudo running, but the service is provided “as is” without warranties of any kind. Features may change, and play may be interrupted for maintenance or beyond our control.',
        'Nous nous efforçons de maintenir SallySudo en fonctionnement, mais le service est fourni « tel quel », sans aucune garantie. Les fonctionnalités peuvent évoluer et le jeu peut être interrompu pour maintenance ou pour des raisons indépendantes de notre volonté.',
        'نعمل على إبقاء SallySudo قيد التشغيل، لكن الخدمة تُقدَّم « كما هي » دون أي ضمانات من أي نوع. قد تتغيّر الميزات، وقد ينقطع اللعب للصيانة أو لأسباب خارجة عن إرادتنا.',
      ),
    },
    { kind: 'h', text: L('Limitation of liability', 'Limitation de responsabilité', 'تحديد المسؤولية') },
    {
      kind: 'p',
      text: L(
        'To the maximum extent permitted by law, SallySudo and its creators are not liable for indirect or incidental damages arising from your use of the app.',
        'Dans toute la mesure permise par la loi, SallySudo et ses créateurs ne sauraient être tenus responsables des dommages indirects ou accessoires découlant de votre utilisation de l’application.',
        'إلى أقصى حد يسمح به القانون، لا يتحمّل SallySudo ومبتكروه المسؤولية عن أي أضرار غير مباشرة أو عرضية ناشئة عن استخدامك للتطبيق.',
      ),
    },
    { kind: 'h', text: L('Termination', 'Résiliation', 'الإنهاء') },
    {
      kind: 'p',
      text: L(
        'You can stop using SallySudo and delete your account at any time from Settings. We may suspend or terminate accounts that violate these terms.',
        'Vous pouvez cesser d’utiliser SallySudo et supprimer votre compte à tout moment depuis les Paramètres. Nous pouvons suspendre ou résilier les comptes qui enfreignent ces conditions.',
        'يمكنك التوقف عن استخدام SallySudo وحذف حسابك في أي وقت من الإعدادات. يجوز لنا تعليق أو إنهاء الحسابات التي تنتهك هذه الشروط.',
      ),
    },
    { kind: 'h', text: L('Changes & contact', 'Modifications et contact', 'التغييرات والتواصل') },
    {
      kind: 'p',
      text: L(
        'We may update these terms as the app evolves; continued use means you accept the updated terms. Questions? Reach us via sallysudo.com.',
        'Nous pouvons mettre à jour ces conditions à mesure que l’application évolue ; une utilisation continue signifie que vous acceptez les conditions mises à jour. Des questions ? Contactez‑nous via sallysudo.com.',
        'قد نقوم بتحديث هذه الشروط مع تطوّر التطبيق؛ ويعني استمرارك في الاستخدام موافقتك على الشروط المحدَّثة. أسئلة؟ تواصل معنا عبر sallysudo.com.',
      ),
    },
  ],
};

// ── About ────────────────────────────────────────────────────────────────
const about: LegalPage = {
  title: L('About SallySudo', 'À propos de SallySudo', 'حول SallySudo'),
  subtitle: L(
    'Sudoku, reimagined for real-time play.',
    'Le Sudoku, réinventé pour le jeu en temps réel.',
    'السودوكو، مُعاد ابتكاره للّعب الفوري.',
  ),
  blocks: [
    {
      kind: 'p',
      text: L(
        'SallySudo is a modern take on the classic number puzzle: the calm, logical Sudoku you love — plus daily challenges, a ranked leaderboard, and real‑time 1v1 duels where you can chat, call, and watch replays. It runs in your browser and as a mobile app, and your progress follows you across both.',
        'SallySudo est une version moderne du célèbre casse‑tête de chiffres : le Sudoku calme et logique que vous aimez — avec en plus des défis quotidiens, un classement, et des duels 1v1 en temps réel où vous pouvez discuter, appeler et regarder des replays. Il fonctionne dans votre navigateur et en application mobile, et votre progression vous suit sur les deux.',
        'SallySudo هو إصدار عصري من لغز الأرقام الكلاسيكي: السودوكو الهادئ والمنطقي الذي تحبّه — بالإضافة إلى تحديات يومية ولوحة متصدّرين مصنّفة ومبارزات 1 ضد 1 فورية حيث يمكنك الدردشة والاتصال ومشاهدة الإعادات. يعمل في متصفحك وكتطبيق للهاتف، ويتبعك تقدّمك على كليهما.',
      ),
    },
    { kind: 'h', text: L('What makes it different', 'Ce qui le distingue', 'ما الذي يميّزه') },
    {
      kind: 'li',
      text: L(
        'Real‑time 1v1 duels — challenge anyone, race on the same puzzle, and talk smack in chat or on a call.',
        'Duels 1v1 en temps réel — défiez n’importe qui, courez sur la même grille et chambrez‑vous dans le chat ou en appel.',
        'مبارزات 1 ضد 1 فورية — تحدَّ أي شخص، وتسابقوا على الشبكة نفسها، وتبادلوا الاستفزازات في الدردشة أو في مكالمة.',
      ),
    },
    {
      kind: 'li',
      text: L(
        'Replays — relive any finished match move by move, Chess.com‑style.',
        'Replays — revivez n’importe quelle partie terminée coup par coup, façon Chess.com.',
        'الإعادات — أعِد عيش أي مباراة منتهية حركة بحركة، على طريقة Chess.com.',
      ),
    },
    {
      kind: 'li',
      text: L(
        'Progression that sticks — levels, stars, XP, coins, streaks, achievements and themes.',
        'Une progression qui reste — niveaux, étoiles, XP, pièces, séries, succès et thèmes.',
        'تقدّم يدوم — مستويات ونجوم ونقاط خبرة وعملات وسلاسل وإنجازات وثيمات.',
      ),
    },
    {
      kind: 'li',
      text: L(
        'Cross‑platform — one account, web and mobile, three languages (English, Français, العربية) with full RTL.',
        'Multiplateforme — un seul compte, web et mobile, trois langues (English, Français, العربية) avec prise en charge complète du sens droite‑à‑gauche.',
        'متعدّد المنصّات — حساب واحد، على الويب والهاتف، بثلاث لغات (English، Français، العربية) مع دعم كامل للكتابة من اليمين إلى اليسار.',
      ),
    },
    { kind: 'h', text: L('Who builds it', 'Qui le développe', 'من يطوّره') },
    {
      kind: 'p',
      text: L(
        'SallySudo is crafted by the Salistar studio. We care about fast, polished, fair games that respect your time and your data — no ad tracking, no pay‑to‑win.',
        'SallySudo est conçu par le studio Salistar. Nous tenons à des jeux rapides, soignés et équitables qui respectent votre temps et vos données — sans traçage publicitaire, sans pay‑to‑win.',
        'SallySudo من صنع استوديو Salistar. نحرص على ألعاب سريعة ومتقنة وعادلة تحترم وقتك وبياناتك — بلا تتبّع إعلاني، وبلا دفع‑مقابل‑الفوز.',
      ),
    },
  ],
};

// ── Pricing ──────────────────────────────────────────────────────────────
const pricing: LegalPage = {
  title: L('Pricing', 'Tarifs', 'الأسعار'),
  subtitle: L(
    'Free to play. No subscription, no pay‑to‑win, no ads.',
    'Gratuit. Sans abonnement, sans pay‑to‑win, sans publicité.',
    'مجاني تماماً. بلا اشتراك، بلا دفع‑مقابل‑الفوز، بلا إعلانات.',
  ),
  blocks: [
    { kind: 'h', text: L('What about coins and themes?', 'Et les pièces et les thèmes ?', 'ماذا عن العملات والثيمات؟') },
    {
      kind: 'p',
      text: L(
        'Coins, power‑ups and premium themes are earned by playing — they’re part of the game, not a paywall. There is currently no real‑money purchase required to enjoy any gameplay feature.',
        'Les pièces, les bonus et les thèmes premium se gagnent en jouant — ils font partie du jeu, pas d’un paywall. Aucun achat en argent réel n’est actuellement requis pour profiter d’une quelconque fonctionnalité de jeu.',
        'تُكتسَب العملات والمعزّزات والثيمات المميّزة من خلال اللعب — فهي جزء من اللعبة، وليست جداراً للدفع. لا يلزم حالياً أي شراء بأموال حقيقية للاستمتاع بأي ميزة من ميزات اللعب.',
      ),
    },
    {
      kind: 'li',
      text: L(
        'Coins are earned from wins, daily challenges and streaks.',
        'Les pièces se gagnent grâce aux victoires, aux défis quotidiens et aux séries.',
        'تُكتسَب العملات من الانتصارات والتحديات اليومية والسلاسل.',
      ),
    },
    {
      kind: 'li',
      text: L(
        'Virtual items have no cash value and exist only to personalize your experience.',
        'Les objets virtuels n’ont aucune valeur monétaire et n’existent que pour personnaliser votre expérience.',
        'العناصر الافتراضية ليس لها قيمة نقدية وتوجد فقط لتخصيص تجربتك.',
      ),
    },
    { kind: 'h', text: L('For teams & events', 'Pour les équipes et les événements', 'للفرق والفعاليات') },
    {
      kind: 'p',
      text: L(
        'Interested in private tournaments, classroom use, or a branded leaderboard? Get in touch via sallysudo.com.',
        'Intéressé par des tournois privés, une utilisation en classe ou un classement à votre marque ? Contactez‑nous via sallysudo.com.',
        'مهتمّ ببطولات خاصة أو الاستخدام الصفّي أو لوحة متصدّرين بعلامتك التجارية؟ تواصل معنا عبر sallysudo.com.',
      ),
    },
  ],
};

// Structural labels for the pricing page (the €0 price card).
export const PRICING_UI = {
  eyebrow: L('FREE FOREVER', 'GRATUIT POUR TOUJOURS', 'مجاني للأبد'),
  per: L('/ forever', '/ pour toujours', '/ للأبد'),
  cta: L('▶ Start playing', '▶ Commencer à jouer', '▶ ابدأ اللعب'),
  included: [
    L(
      'Unlimited puzzles across 30 levels + a fresh daily challenge',
      'Des grilles illimitées sur 30 niveaux + un nouveau défi quotidien',
      'ألغاز غير محدودة عبر 30 مستوى + تحدٍّ يومي جديد',
    ),
    L(
      'Real‑time 1v1 duels with chat, voice & video calls',
      'Duels 1v1 en temps réel avec chat et appels audio et vidéo',
      'مبارزات 1 ضد 1 فورية مع دردشة ومكالمات صوتية ومرئية',
    ),
    L(
      'Move‑by‑move replays of every match',
      'Replays coup par coup de chaque partie',
      'إعادات حركة بحركة لكل مباراة',
    ),
    L(
      'Ranked leaderboard, achievements, streaks & XP',
      'Classement, succès, séries et XP',
      'لوحة متصدّرين مصنّفة وإنجازات وسلاسل ونقاط خبرة',
    ),
    L(
      'Two themes (Midnight & Atlas Gold) + cosmetics earned with in‑game coins',
      'Deux thèmes (Minuit et Atlas Or) + des cosmétiques gagnés avec les pièces du jeu',
      'ثيمان (منتصف الليل وأطلس الذهبي) + عناصر تجميلية تُكتسَب بعملات اللعبة',
    ),
    L(
      'Web and mobile, three languages — one account everywhere',
      'Web et mobile, trois langues — un seul compte partout',
      'الويب والهاتف، ثلاث لغات — حساب واحد في كل مكان',
    ),
  ],
};

// ── Press ────────────────────────────────────────────────────────────────
const press: LegalPage = {
  title: L('Press kit', 'Kit presse', 'الملف الصحفي'),
  subtitle: L(
    'Everything you need to write about SallySudo.',
    'Tout ce qu’il vous faut pour écrire sur SallySudo.',
    'كل ما تحتاجه للكتابة عن SallySudo.',
  ),
  blocks: [
    { kind: 'h', text: L('Boilerplate', 'Présentation', 'النبذة التعريفية') },
    {
      kind: 'p',
      text: L(
        'SallySudo is a modern, real‑time Sudoku game for web and mobile. Beyond daily solo puzzles and a ranked leaderboard, it lets players face off in live 1v1 duels — racing the same grid while they chat, call, and review move‑by‑move replays afterward. Built by the Salistar studio, SallySudo is free to play, available in three languages, and designed to be fast, polished and fair: no ad tracking and no pay‑to‑win.',
        'SallySudo est un jeu de Sudoku moderne et en temps réel pour le web et le mobile. Au‑delà des grilles solo quotidiennes et d’un classement, il permet aux joueurs de s’affronter en duels 1v1 en direct — en courant sur la même grille tout en discutant, en s’appelant et en revoyant ensuite des replays coup par coup. Développé par le studio Salistar, SallySudo est gratuit, disponible en trois langues, et conçu pour être rapide, soigné et équitable : sans traçage publicitaire et sans pay‑to‑win.',
        'SallySudo هي لعبة سودوكو عصرية وفورية للويب والهاتف. إلى جانب الألغاز الفردية اليومية ولوحة المتصدّرين المصنّفة، تتيح للّاعبين التنافس في مبارزات 1 ضد 1 مباشرة — يتسابقون على الشبكة نفسها بينما يتحادثون ويتّصلون ويراجعون بعدها إعادات حركة بحركة. من تطوير استوديو Salistar، SallySudo مجانية ومتاحة بثلاث لغات ومصمَّمة لتكون سريعة ومتقنة وعادلة: بلا تتبّع إعلاني وبلا دفع‑مقابل‑الفوز.',
      ),
    },
    { kind: 'h', text: L('Fast facts', 'En bref', 'حقائق سريعة') },
    { kind: 'h', text: L('Brand assets', 'Éléments de marque', 'عناصر العلامة التجارية') },
    {
      kind: 'p',
      text: L(
        'Download our share image and icon. Please don’t alter the logo or imply endorsement.',
        'Téléchargez notre image de partage et notre icône. Merci de ne pas modifier le logo ni de laisser entendre un quelconque soutien de notre part.',
        'حمّل صورة المشاركة والأيقونة الخاصة بنا. يُرجى عدم تعديل الشعار أو الإيحاء بوجود رعاية أو تأييد.',
      ),
    },
    { kind: 'h', text: L('Key features', 'Fonctionnalités clés', 'الميزات الرئيسية') },
    {
      kind: 'li',
      text: L(
        'Real‑time 1v1 Sudoku duels with chat, voice & video.',
        'Duels de Sudoku 1v1 en temps réel avec chat, audio et vidéo.',
        'مبارزات سودوكو 1 ضد 1 فورية مع دردشة وصوت وفيديو.',
      ),
    },
    {
      kind: 'li',
      text: L(
        'Chess.com‑style replays of finished matches.',
        'Replays façon Chess.com des parties terminées.',
        'إعادات على طراز Chess.com للمباريات المنتهية.',
      ),
    },
    {
      kind: 'li',
      text: L(
        'Daily challenge, 30 levels, ranked leaderboard, achievements.',
        'Défi quotidien, 30 niveaux, classement, succès.',
        'تحدٍّ يومي، 30 مستوى، لوحة متصدّرين مصنّفة، إنجازات.',
      ),
    },
    {
      kind: 'li',
      text: L(
        'Cross‑platform single account; English / Français / العربية.',
        'Compte unique multiplateforme ; English / Français / العربية.',
        'حساب واحد متعدّد المنصّات؛ English / Français / العربية.',
      ),
    },
    { kind: 'h', text: L('Contact', 'Contact', 'التواصل') },
    {
      kind: 'p',
      text: L(
        'For interviews, assets or review access, reach out via sallysudo.com.',
        'Pour les interviews, les éléments visuels ou un accès de test, contactez‑nous via sallysudo.com.',
        'لإجراء المقابلات أو الحصول على العناصر أو الوصول للمراجعة، تواصل معنا عبر sallysudo.com.',
      ),
    },
  ],
};

// Structural labels for the press page (fast-facts table + asset buttons).
export const PRESS_UI = {
  facts: [
    { k: L('Name', 'Nom', 'الاسم'), v: L('SallySudo', 'SallySudo', 'SallySudo') },
    {
      k: L('Category', 'Catégorie', 'الفئة'),
      v: L(
        'Puzzle / Casual · Real‑time multiplayer',
        'Puzzle / Casual · Multijoueur en temps réel',
        'ألغاز / عارضة · متعدّد اللاعبين فوري',
      ),
    },
    {
      k: L('Platforms', 'Plateformes', 'المنصّات'),
      v: L('Web (app.sallysudo.com) · Android · iOS', 'Web (app.sallysudo.com) · Android · iOS', 'الويب (app.sallysudo.com) · Android · iOS'),
    },
    { k: L('Price', 'Prix', 'السعر'), v: L('Free to play', 'Gratuit', 'مجاني') },
    {
      k: L('Languages', 'Langues', 'اللغات'),
      v: L('English · Français · العربية (RTL)', 'English · Français · العربية (RTL)', 'English · Français · العربية (من اليمين إلى اليسار)'),
    },
    { k: L('Studio', 'Studio', 'الاستوديو'), v: L('Salistar', 'Salistar', 'Salistar') },
    { k: L('Website', 'Site web', 'الموقع'), v: L('sallysudo.com', 'sallysudo.com', 'sallysudo.com') },
  ],
  assetSocial: L('Social image (1200×630)', 'Image sociale (1200×630)', 'صورة للمشاركة (1200×630)'),
  assetIcon: L('App icon', 'Icône de l’app', 'أيقونة التطبيق'),
};

export const LEGAL: {
  privacy: LegalPage;
  terms: LegalPage;
  about: LegalPage;
  pricing: LegalPage;
  press: LegalPage;
} = { privacy, terms, about, pricing, press };
