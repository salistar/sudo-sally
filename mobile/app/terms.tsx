import LegalLayout, { H, P, Li } from '../components/LegalLayout';

export default function Terms() {
  return (
    <LegalLayout title="Terms of Service" subtitle="Last updated: 19 June 2026. The rules for using SallySudo.">
      <P>By creating an account or using SallySudo, you agree to these terms. If you don’t agree, please don’t use the app.</P>

      <H>Eligibility & accounts</H>
      <Li>You must meet the minimum age in your country (at least 13).</Li>
      <Li>You’re responsible for your account and for keeping your credentials secure. Don’t share your account or impersonate others.</Li>
      <Li>Provide accurate information and keep your username appropriate — we may rename or remove offensive or infringing usernames.</Li>

      <H>Acceptable use</H>
      <Li>Play fair: no cheating, automation/bots, exploiting bugs, or tampering with scores, the leaderboard, or 1v1 results.</Li>
      <Li>Be respectful in chat and calls. No harassment, hate speech, or illegal content.</Li>
      <Li>Don’t attack, overload, reverse‑engineer, or disrupt the service or other players.</Li>

      <H>Virtual items</H>
      <P>Coins, stars, XP, themes and power‑ups are part of the game. They have no monetary value, cannot be exchanged for cash, and may be adjusted or reset to keep the game fair and balanced.</P>

      <H>Availability & “as is”</H>
      <P>We work to keep SallySudo running, but the service is provided “as is” without warranties of any kind. Features may change, and play may be interrupted for maintenance or beyond our control.</P>

      <H>Limitation of liability</H>
      <P>To the maximum extent permitted by law, SallySudo and its creators are not liable for indirect or incidental damages arising from your use of the app.</P>

      <H>Termination</H>
      <P>You can stop using SallySudo and delete your account at any time from Settings. We may suspend or terminate accounts that violate these terms.</P>

      <H>Changes & contact</H>
      <P>We may update these terms as the app evolves; continued use means you accept the updated terms. Questions? Reach us via sallysudo.com.</P>
    </LegalLayout>
  );
}
