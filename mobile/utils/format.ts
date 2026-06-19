/**
 * Shared time-formatting helpers.
 *
 * Consolidates the ~8 duplicated formatters that used to live inline across
 * screens/components. Three pure functions, no side effects:
 *
 *   formatClock(seconds)    → "m:SS"  (unpadded minutes)         e.g. 65    -> "1:05"
 *   formatClockMs(ms)       → "m:SS"  (unpadded, from millis)    e.g. 65000 -> "1:05"
 *   formatDuration(seconds) → "m:SS" or "—" fallback for 0/null  e.g. 0     -> "—"
 *
 * NOTE: storage.ts keeps its own `formatTime` (PADDED "MM:SS", e.g. 65 -> "01:05")
 * and challenge-game.tsx keeps its local padded formatter — those use a DIFFERENT
 * visual format and are intentionally NOT routed through here.
 */

// MM:SS-style m:SS, zero-padded SECONDS (minutes NOT padded) from a number of SECONDS.
// e.g. 65 -> "1:05"
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

// Same but from MILLISECONDS. e.g. 65000 -> "1:05"
export function formatClockMs(ms: number): string {
  return formatClock(Math.floor((Number(ms) || 0) / 1000));
}

// m:SS with an em-dash fallback for empty/zero, used by the widgets. 0/undefined -> "—"
export function formatDuration(totalSeconds?: number | null): string {
  if (totalSeconds == null || totalSeconds <= 0) return '—';
  return formatClock(totalSeconds);
}
