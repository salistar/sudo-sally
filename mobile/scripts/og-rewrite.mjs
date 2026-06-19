/**
 * Per-route Open Graph rewrite (sprint-33b).
 *
 * Expo's static web export emits one .html per route, all sharing the single
 * <head> from app/+html.tsx — so every page unfurls with the same OG card.
 * There's no SSR, so we post-process the exported HTML: for a known map of
 * named static routes, rewrite og:title / og:description / og:url / twitter:*
 * / <title> with route-specific copy.
 *
 * Runs in Dockerfile.web right after `expo export`:  node scripts/og-rewrite.mjs dist
 *
 * Dynamic routes (/u/[username], /replay/[id]) keep the default site card —
 * a single template can't carry per-instance OG without an edge worker.
 */
import fs from 'fs';
import path from 'path';

const dist = process.argv[2] || 'dist';
const BASE = 'https://app.sallysudo.com';

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  .replace(/</g, '&lt;').replace(/>/g, '&gt;');

// route file → { title, desc }. og:url is derived from the path.
const ROUTES = {
  'about.html':        { p: '/about',        title: 'About SallySudo',                 desc: 'Sudoku, reimagined for real-time play — daily puzzles, a ranked leaderboard and live 1v1 duels.' },
  'pricing.html':      { p: '/pricing',      title: 'SallySudo — Pricing (Free to play)', desc: 'Free forever. No subscription, no pay-to-win, no ads.' },
  'privacy.html':      { p: '/privacy',      title: 'SallySudo — Privacy Policy',      desc: 'How SallySudo handles your data, in plain language.' },
  'terms.html':        { p: '/terms',        title: 'SallySudo — Terms of Service',    desc: 'The rules for using SallySudo.' },
  'press.html':        { p: '/press',        title: 'SallySudo — Press Kit',           desc: 'Boilerplate, fast facts and brand assets for press and creators.' },
  'leaderboard.html':  { p: '/leaderboard',  title: 'SallySudo — Leaderboard',         desc: 'See the top Sudoku players and where you rank.' },
  'daily.html':        { p: '/daily',        title: 'SallySudo — Daily Challenge',     desc: 'A fresh Sudoku puzzle every day. Keep your streak alive.' },
  'levels.html':       { p: '/levels',       title: 'SallySudo — Levels',              desc: '30 levels from Beginner to Master. Earn stars and climb.' },
  'challenges.html':   { p: '/challenges',   title: 'SallySudo — 1v1 Lobby',           desc: 'Challenge anyone to a real-time Sudoku duel.' },
  'achievements.html': { p: '/achievements', title: 'SallySudo — Achievements',        desc: 'Unlock achievements as you play.' },
  'howtoplay.html':    { p: '/howtoplay',    title: 'How to play SallySudo',           desc: 'Sudoku rules, tips and controls.' },
};

function setMeta(html, attr, key, val) {
  const re = new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`, 'g');
  return html.replace(re, `$1${val}$2`);
}

let n = 0;
for (const [file, r] of Object.entries(ROUTES)) {
  const fp = path.join(dist, file);
  if (!fs.existsSync(fp)) continue;
  let html = fs.readFileSync(fp, 'utf8');
  const T = esc(r.title), D = esc(r.desc), U = esc(BASE + r.p);
  html = setMeta(html, 'property', 'og:title', T);
  html = setMeta(html, 'property', 'og:description', D);
  html = setMeta(html, 'property', 'og:url', U);
  html = setMeta(html, 'name', 'twitter:title', T);
  html = setMeta(html, 'name', 'twitter:description', D);
  html = setMeta(html, 'name', 'description', D);
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${T}</title>`);
  fs.writeFileSync(fp, html);
  n++;
  console.log('og-rewrite:', file, '→', r.title);
}
console.log(`og-rewrite: updated ${n} route(s).`);
