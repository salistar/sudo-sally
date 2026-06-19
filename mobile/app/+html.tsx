/**
 * Root HTML template for the Expo Web build (web only — ignored on native).
 *  - <ScrollViewStyleReset/> so RN-Web ScrollView scrolls correctly inside #root.
 *  - On desktop the whole app is FULL-WIDTH (no phone preview frame) so screens
 *    feel like a real web app, not a mobile cropped layout.
 */
import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>SallySudo — real-time 1v1 Sudoku</title>
        <meta name="description" content="SallySudo is the modern Sudoku game with daily puzzles, ranked leaderboard and real-time 1v1 multiplayer duels with audio/video calls." />
        <meta name="theme-color" content="#0a0a1a" />
        {/* Open Graph — link unfurls on Slack / Discord / Facebook / WhatsApp.
            Static export = one shared head for every route (no SSR), so this is
            the site-wide card. */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="SallySudo" />
        <meta property="og:locale" content="en" />
        <meta property="og:title" content="SallySudo — real-time 1v1 Sudoku" />
        <meta property="og:description" content="Daily puzzles, leaderboard, and real-time 1v1 duels with chat and calls." />
        <meta property="og:url" content="https://app.sallysudo.com" />
        <meta property="og:image" content="https://app.sallysudo.com/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        {/* Twitter card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="SallySudo — real-time 1v1 Sudoku" />
        <meta name="twitter:description" content="Daily puzzles, leaderboard, and real-time 1v1 duels with chat and calls." />
        <meta name="twitter:image" content="https://app.sallysudo.com/og-image.png" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/favicon.ico" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: webCss }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const webCss = `
  html, body { margin: 0; padding: 0; background: #0a0a1a; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    background:
      radial-gradient(circle at 30% 20%, rgba(124,92,255,0.10), transparent 60%),
      radial-gradient(circle at 80% 80%, rgba(96,165,250,0.08), transparent 60%),
      #0a0a1a;
    min-height: 100vh;
  }
  #root { width: 100%; min-height: 100vh; background: transparent; }

  /* v3.8.0 — Visible custom scrollbar (Chrome/Edge/Safari).
     The default was hidden because react-native-web scroll containers ship
     overflow:hidden by default and 'overflow:auto' overrides without giving
     the scrollbar any width on dark themes. */
  *::-webkit-scrollbar          { width: 12px; height: 12px; }
  *::-webkit-scrollbar-track    { background: rgba(255,255,255,0.02); }
  *::-webkit-scrollbar-thumb    { background: rgba(124,92,255,0.35); border-radius: 6px; border: 2px solid #0a0a1a; }
  *::-webkit-scrollbar-thumb:hover { background: rgba(124,92,255,0.6); }
  /* Firefox */
  * { scrollbar-width: thin; scrollbar-color: rgba(124,92,255,0.35) rgba(255,255,255,0.02); }
`;
