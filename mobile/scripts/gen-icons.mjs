// Brand asset generator for "Sudoku Sally"
// Renders crisp SVG -> PNG and overwrites the three asset files.
// Library: tries sharp, falls back to @resvg/resvg-js.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, statSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const IMG = join(ROOT, "assets", "images");

// ---------- shared palette ----------
const BG_TOP = "#0a0a1a";
const BG_BOT = "#1a1a3a";
const GREEN_LIGHT = "#4ade80";
const GREEN_DARK = "#22c55e";
const CELL_BG = "#13132e";
const CELL_BG2 = "#1c1c44";
const GRID_LINE = "#3a3a66";

// Reusable defs (gradients + soft glow filter). `idp` namespaces ids so
// multiple defs blocks can't collide if ever combined.
function defs(idp = "") {
  return `
  <defs>
    <linearGradient id="bg${idp}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BG_TOP}"/>
      <stop offset="1" stop-color="${BG_BOT}"/>
    </linearGradient>
    <linearGradient id="green${idp}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${GREEN_LIGHT}"/>
      <stop offset="1" stop-color="${GREEN_DARK}"/>
    </linearGradient>
    <linearGradient id="cell${idp}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${CELL_BG2}"/>
      <stop offset="1" stop-color="${CELL_BG}"/>
    </linearGradient>
    <radialGradient id="vign${idp}" cx="0.5" cy="0.42" r="0.75">
      <stop offset="0" stop-color="#2a2a55" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow${idp}" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="9" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`;
}

// Build the core 3x3 sudoku logo into a 0..S coordinate box.
// `idp` selects which gradient ids to reference.
// Highlighted cells (row,col) form a stylized "S" path through the grid.
function logo(S, idp = "") {
  const pad = S * 0.06;        // inner padding inside the logo box
  const inner = S - pad * 2;   // grid drawing area
  const gap = inner * 0.045;   // gap between cells
  const cell = (inner - gap * 2) / 3;
  const r = cell * 0.22;       // cell corner radius

  // cells highlighted in green to suggest an "S" zig-zag
  const lit = new Set(["0,0", "0,1", "0,2", "1,0", "1,1", "2,1", "2,2"]);
  // (top row full, mid-left, center, bottom-mid, bottom-right) -> S shape

  let cells = "";
  let glyphs = "";
  // a few numbers to read as sudoku, placed in lit + a couple of dim cells
  const nums = { "0,0": "5", "0,2": "3", "1,1": "8", "2,2": "1", "1,2": "6", "2,0": "4" };

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const x = pad + col * (cell + gap);
      const y = pad + row * (cell + gap);
      const key = `${row},${col}`;
      const isLit = lit.has(key);
      const fill = isLit ? `url(#green${idp})` : `url(#cell${idp})`;
      const stroke = isLit ? "none" : GRID_LINE;
      const sw = isLit ? 0 : Math.max(1, S * 0.004);
      const filt = isLit ? ` filter="url(#glow${idp})"` : "";
      cells += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" rx="${r.toFixed(2)}" ry="${r.toFixed(2)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw.toFixed(2)}"${filt}/>`;

      const n = nums[key];
      if (n) {
        const cx = x + cell / 2;
        const cy = y + cell / 2;
        const numColor = isLit ? BG_TOP : "#9aa0c8";
        const fs = cell * 0.62;
        glyphs += `<text x="${cx.toFixed(2)}" y="${cy.toFixed(2)}" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="${fs.toFixed(2)}" fill="${numColor}" text-anchor="middle" dominant-baseline="central">${n}</text>`;
      }
    }
  }
  return cells + glyphs;
}

// ---------- 1) APP ICON (1024) full-bleed rounded card on dark gradient ----------
function svgIcon(size = 1024) {
  const rr = size * 0.225; // rounded-square card radius
  const logoBox = size * 0.62;
  const off = (size - logoBox) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${defs("I")}
  <rect x="0" y="0" width="${size}" height="${size}" rx="${rr}" ry="${rr}" fill="url(#bgI)"/>
  <rect x="0" y="0" width="${size}" height="${size}" rx="${rr}" ry="${rr}" fill="url(#vignI)"/>
  <rect x="${(size*0.012).toFixed(1)}" y="${(size*0.012).toFixed(1)}" width="${(size*0.976).toFixed(1)}" height="${(size*0.976).toFixed(1)}" rx="${(rr*0.96).toFixed(1)}" ry="${(rr*0.96).toFixed(1)}" fill="none" stroke="#ffffff" stroke-opacity="0.06" stroke-width="${(size*0.006).toFixed(1)}"/>
  <g transform="translate(${off.toFixed(2)},${off.toFixed(2)})">
    ${logo(logoBox, "I")}
  </g>
</svg>`;
}

// ---------- 2) ADAPTIVE FOREGROUND (1024) transparent, ~20% safe padding ----------
function svgAdaptive(size = 1024) {
  const logoBox = size * 0.58; // logo within central safe zone (~21% padding)
  const off = (size - logoBox) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${defs("A")}
  <g transform="translate(${off.toFixed(2)},${off.toFixed(2)})">
    ${logo(logoBox, "A")}
  </g>
</svg>`;
}

// ---------- 3) SPLASH (1242) transparent bg, logo + wordmark ----------
function svgSplash(size = 1242) {
  const logoBox = size * 0.5;
  const off = (size - logoBox) / 2;
  const logoY = size * 0.205; // shift up to leave room for wordmark
  const textY = logoY + logoBox + size * 0.085;
  const fs = size * 0.072;
  const subFs = size * 0.03;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${defs("S")}
  <g transform="translate(${off.toFixed(2)},${logoY.toFixed(2)})">
    ${logo(logoBox, "S")}
  </g>
  <text x="${(size/2).toFixed(1)}" y="${textY.toFixed(1)}" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="${fs.toFixed(1)}" letter-spacing="${(size*0.012).toFixed(1)}" fill="#ffffff" text-anchor="middle">SUDOKU</text>
  <text x="${(size/2).toFixed(1)}" y="${(textY + fs*0.92).toFixed(1)}" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="${fs.toFixed(1)}" letter-spacing="${(size*0.012).toFixed(1)}" fill="url(#greenS)" text-anchor="middle">SALLY</text>
  <text x="${(size/2).toFixed(1)}" y="${(textY + fs*0.92 + subFs*1.9).toFixed(1)}" font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="${subFs.toFixed(1)}" letter-spacing="${(size*0.02).toFixed(1)}" fill="#8a90b8" text-anchor="middle">PLAY  •  LEARN  •  SOLVE</text>
</svg>`;
}

const targets = [
  { name: "icon.png", svg: svgIcon(1024), w: 1024, h: 1024 },
  { name: "adaptive-icon.png", svg: svgAdaptive(1024), w: 1024, h: 1024 },
  { name: "splash.png", svg: svgSplash(1242), w: 1242, h: 1242 },
];

async function renderWithSharp() {
  const sharp = (await import("sharp")).default;
  for (const t of targets) {
    const out = join(IMG, t.name);
    await sharp(Buffer.from(t.svg))
      .resize(t.w, t.h, { fit: "fill" })
      .png({ compressionLevel: 9 })
      .toFile(out);
    report(out, t);
  }
  return "sharp";
}

async function renderWithResvg() {
  const { Resvg } = await import("@resvg/resvg-js");
  for (const t of targets) {
    const out = join(IMG, t.name);
    const resvg = new Resvg(t.svg, {
      fitTo: { mode: "width", value: t.w },
      background: "rgba(0,0,0,0)",
    });
    const png = resvg.render().asPng();
    writeFileSync(out, png);
    report(out, t);
  }
  return "@resvg/resvg-js";
}

function report(out, t) {
  const sz = statSync(out).size;
  console.log(`  wrote ${t.name}  ${t.w}x${t.h}  ${(sz / 1024).toFixed(1)} KB`);
}

const which = (process.env.RENDERER || "sharp").toLowerCase();
try {
  let lib;
  if (which === "resvg") lib = await renderWithResvg();
  else {
    try {
      lib = await renderWithSharp();
    } catch (e) {
      console.error("sharp failed, trying resvg:", e.message);
      lib = await renderWithResvg();
    }
  }
  console.log(`DONE via ${lib}`);
} catch (e) {
  console.error("RENDER FAILED:", e);
  process.exit(1);
}
