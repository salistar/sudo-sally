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
        <meta property="og:title" content="SallySudo — real-time 1v1 Sudoku" />
        <meta property="og:description" content="Daily puzzles, leaderboard, and real-time 1v1 duels with chat and calls." />
        <meta property="og:url" content="https://app.sallysudo.com" />
        <link rel="icon" href="/favicon.ico" />
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
      radial-gradient(circle at 30% 20%, rgba(74,222,128,0.10), transparent 60%),
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
  *::-webkit-scrollbar-thumb    { background: rgba(74,222,128,0.35); border-radius: 6px; border: 2px solid #0a0a1a; }
  *::-webkit-scrollbar-thumb:hover { background: rgba(74,222,128,0.6); }
  /* Firefox */
  * { scrollbar-width: thin; scrollbar-color: rgba(74,222,128,0.35) rgba(255,255,255,0.02); }
`;
