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
`;
