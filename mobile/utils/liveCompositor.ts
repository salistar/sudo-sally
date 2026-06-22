/**
 * Shared canvas-compositor primitives for the YouTube live broadcaster.
 *
 * These owl / board / camera / clock helpers were previously copy-pasted into
 * both spectate/[challengeId].tsx (portrait stream) and challenge-game.tsx
 * (landscape stream with cameras + chat). They are now defined once here and
 * imported by both; each screen keeps only its own frame *layout*.
 *
 * NOTE: broadcast/[challengeId].tsx embeds an equivalent HTML string inside a
 * WebView (a different JS runtime that cannot `import` RN modules), so its copy
 * is structural, not duplication that can be collapsed here.
 *
 * `ctx` is a CanvasRenderingContext2D (typed `any` because react-native-web's
 * canvas typings aren't available on native).
 */
export const LIVE_PURPLE = '#7c5cff';

export function rrect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  else { ctx.beginPath(); ctx.rect(x, y, w, h); }
}

/** Sally the owl mascot — gradient body, lilac belly, yellow beak. */
export function drawOwl(ctx: any, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.fillStyle = '#7c5cff';
  ctx.beginPath(); ctx.moveTo(cx - r * 0.7, cy - r * 0.55); ctx.lineTo(cx - r * 0.32, cy - r * 1.12); ctx.lineTo(cx - r * 0.05, cy - r * 0.5); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx + r * 0.7, cy - r * 0.55); ctx.lineTo(cx + r * 0.32, cy - r * 1.12); ctx.lineTo(cx + r * 0.05, cy - r * 0.5); ctx.closePath(); ctx.fill();
  const bg = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  bg.addColorStop(0, '#5eead4'); bg.addColorStop(0.6, '#7c5cff'); bg.addColorStop(1, '#2dd4db');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.92, r, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ede9ff'; ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.2, r * 0.54, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx - r * 0.38, cy - r * 0.16, r * 0.33, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + r * 0.38, cy - r * 0.16, r * 0.33, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0a0a1a';
  ctx.beginPath(); ctx.arc(cx - r * 0.38, cy - r * 0.16, r * 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + r * 0.38, cy - r * 0.16, r * 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.moveTo(cx, cy + r * 0.06); ctx.lineTo(cx - r * 0.14, cy + r * 0.3); ctx.lineTo(cx + r * 0.14, cy + r * 0.3); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/** mm:ss clock formatter. */
export function fmt(s: number) {
  return `${String(Math.floor((s || 0) / 60)).padStart(2, '0')}:${String((s || 0) % 60).padStart(2, '0')}`;
}

/**
 * Draw a 9×9 Sudoku board. `cell(r,c)` returns the digit (0/null = empty);
 * `given(r,c)` returns whether that digit is a puzzle clue (white) vs a played
 * value (cyan). Accessors keep this agnostic to the caller's data shape
 * (flat 81-array vs 9×9-array).
 */
export function drawSudokuBoard(
  ctx: any, x: number, y: number, size: number,
  cell: (r: number, c: number) => number | null | undefined,
  given: (r: number, c: number) => boolean,
) {
  const step = size / 9;
  ctx.fillStyle = 'rgba(124,92,255,0.06)'; rrect(ctx, x - 10, y - 10, size + 20, size + 20, 14); ctx.fill();
  ctx.fillStyle = '#0a0a1a'; ctx.fillRect(x, y, size, size);
  for (let i = 0; i <= 9; i++) {
    const major = i % 3 === 0;
    ctx.strokeStyle = major ? 'rgba(124,92,255,0.55)' : '#262640'; ctx.lineWidth = major ? 2.5 : 1;
    ctx.beginPath(); ctx.moveTo(x + i * step, y); ctx.lineTo(x + i * step, y + size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + i * step); ctx.lineTo(x + size, y + i * step); ctx.stroke();
  }
  ctx.strokeStyle = LIVE_PURPLE; ctx.lineWidth = 2.5; ctx.strokeRect(x, y, size, size);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    const v = cell(r, c) || 0; if (!v) continue;
    const g = given(r, c);
    ctx.fillStyle = g ? '#ffffff' : '#2dd4db';
    ctx.font = `${g ? '800' : '700'} ${Math.floor(step * 0.55)}px Arial, sans-serif`;
    ctx.fillText(String(v), x + c * step + step / 2, y + r * step + step / 2 + 1);
  }
}

/** A rounded camera tile (drawImage of a <video>), with a placeholder + label. */
export function drawCamTile(ctx: any, x: number, y: number, w: number, h: number, videoEl: any, label: string) {
  ctx.save(); rrect(ctx, x, y, w, h, 10); ctx.clip();
  ctx.fillStyle = '#11112a'; ctx.fillRect(x, y, w, h);
  let drew = false;
  try {
    if (videoEl && videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
      const vr = videoEl.videoWidth / videoEl.videoHeight, br = w / h;
      let dw = w, dh = h, dx = x, dy = y;
      if (vr > br) { dh = h; dw = h * vr; dx = x - (dw - w) / 2; } else { dw = w; dh = w / vr; dy = y - (dh - h) / 2; }
      ctx.drawImage(videoEl, dx, dy, dw, dh); drew = true;
    }
  } catch (e) {}
  ctx.restore();
  if (!drew) {
    ctx.fillStyle = '#475569'; ctx.font = '600 13px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('📷 ' + label, x + w / 2, y + h / 2);
  }
  ctx.fillStyle = 'rgba(10,10,26,0.72)'; rrect(ctx, x + 6, y + h - 26, Math.min(w - 12, 22 + label.length * 7), 20, 6); ctx.fill();
  ctx.fillStyle = '#e2e8f0'; ctx.font = '700 12px Arial, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('🎤 ' + label, x + 12, y + h - 15);
  ctx.strokeStyle = 'rgba(124,92,255,0.5)'; ctx.lineWidth = 1.5; rrect(ctx, x, y, w, h, 10); ctx.stroke();
}
