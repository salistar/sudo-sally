/**
 * Root HTML template for the Expo Web build (web only — ignored on native).
 * Adds:
 *  - <ScrollViewStyleReset/> so RN-Web ScrollView scrolls correctly inside #root.
 *  - A "phone-preview" max-width on desktop so the mobile-first UI stays readable
 *    in a wide browser (full-width on small viewports).
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
        <style dangerouslySetInnerHTML={{ __html: responsiveBackgroundCss }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveBackgroundCss = `
  html, body { margin: 0; padding: 0; background: #0a0a1a; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  #root { width: 100%; min-height: 100vh; background: #0a0a1a; }

  /* On a wide desktop, frame the mobile-first UI in a phone-shaped column,
     centered, with a subtle backdrop. */
  @media (min-width: 600px) {
    body { background:
      radial-gradient(circle at 30% 20%, rgba(74,222,128,0.10), transparent 60%),
      radial-gradient(circle at 80% 80%, rgba(96,165,250,0.08), transparent 60%),
      #0a0a1a; }
    #root {
      max-width: 480px;
      margin: 0 auto;
      min-height: 100vh;
      box-shadow: 0 0 0 1px rgba(255,255,255,0.04), 0 30px 80px rgba(0,0,0,0.55);
    }
  }
`;
