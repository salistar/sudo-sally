import LegalLayout, { H, P, Li, B } from '../components/LegalLayout';

export default function Privacy() {
  return (
    <LegalLayout title="Privacy Policy" subtitle="Last updated: 19 June 2026. How SallySudo handles your data — in plain language.">
      <P>SallySudo (“we”, “the app”) is a Sudoku game available on the web and as a mobile app. We keep data collection to the minimum needed to run your account and the game. We do not sell your data and we do not run third‑party advertising or tracking.</P>

      <H>What we collect</H>
      <Li><B>Account data</B>: a username, email address, and an avatar you choose. Passwords are stored only as a salted bcrypt hash — never in plain text. If you sign in with Google, we receive a Google account identifier and your basic profile (name, email) from Google’s sign‑in token.</Li>
      <Li><B>Gameplay data</B>: your levels, stars, XP, coins, streaks, achievements, and 1v1 challenge results.</Li>
      <Li><B>On‑device data</B>: your progress, settings, theme and consent choices are also cached in your browser/device local storage so the app works smoothly and remembers your preferences.</Li>

      <H>How we use it</H>
      <Li>To create and secure your account and sign you in.</Li>
      <Li>To run the game: save progress, compute the leaderboard, match you in 1v1 duels and show profiles.</Li>
      <Li>To keep the service working and prevent abuse.</Li>

      <H>Cookies & local storage</H>
      <P>We use device local storage (and the equivalent on web) for essential functions: keeping you signed in, saving progress and settings, and remembering that you accepted this notice. We do not use advertising or cross‑site tracking cookies.</P>

      <H>Third parties</H>
      <Li><B>Google Sign‑In</B> — optional; used only to authenticate you. Subject to Google’s own privacy policy.</Li>
      <Li><B>Real‑time duels & calls</B> — 1v1 play uses a real‑time socket connection; optional voice/video calls are peer‑to‑peer (WebRTC) and use public STUN servers to connect. Call media is exchanged directly between players, not stored by us.</Li>

      <H>Data retention & your rights</H>
      <P>You can delete your account at any time from Settings → Delete my account, which removes your account record from our servers. You may also request access to or correction of your data. To exercise these rights, contact us via sallysudo.com.</P>

      <H>Children</H>
      <P>SallySudo is not directed at children under 13 (or the minimum age in your country). We do not knowingly collect data from children.</P>

      <H>Changes</H>
      <P>We may update this policy as the app evolves. We’ll update the “last updated” date above and, for significant changes, surface a notice in the app.</P>
    </LegalLayout>
  );
}
