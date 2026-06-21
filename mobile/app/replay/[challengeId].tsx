/**
 * Replay viewer — /replay/<challengeId>
 *
 * Chess.com-style move-by-move playback of a finished 1v1. Renders two
 * side-by-side Sudoku boards (challenger left, challenged right) whose
 * state is reconstructed by replaying the move log up to a scrubber
 * cursor `frame`.
 *
 * Controls:
 *   • ◀◀ jump to start
 *   • ⏮ step back one move
 *   • ▶ / ⏸ play / pause
 *   • ⏭ step forward one move
 *   • ▶▶ jump to end
 *   • speed: 0.5x / 1x / 2x / 4x
 *   • scrubber: drag to any frame
 *
 * Fetches /api/challenges/<id>/replay (added in sprint-21 backend).
 * Phone and desktop share the same layout; on phone the boards stack
 * vertically.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Platform, useWindowDimensions, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLang } from '../../utils/LanguageContext';
import { useTheme } from '../../utils/theme';
import { API_URL } from '../../utils/api';
import { formatClock, formatClockMs } from '../../utils/format';

// Demo replay used when /replay/demo is opened — lets us screenshot the
// UI before any real game has been recorded. A real puzzle with both
// players gradually filling cells over ~5 minutes; winner is the right
// side. Move timestamps in ms since startedAt.
const DEMO_PUZZLE   = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const DEMO_SOLUTION = '534678912672195348198342567859761423426853791713924856961537284287419635345286179';
const DEMO_REPLAY: any = {
  challengeId: 'demo',
  puzzle: DEMO_PUZZLE,
  solution: DEMO_SOLUTION,
  difficulty: 'medium',
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  challenger: { username: 'webtest_2026', avatar: '🦉' },
  challenged: { username: 'GhostPlayer', avatar: '👻' },
  winner: { username: 'GhostPlayer' },
  isDraw: false,
  challengerMoves: [
    { cell: 2,  value: 4, t: 4500,   err: false },
    { cell: 3,  value: 6, t: 12000,  err: false },
    { cell: 4,  value: 7, t: 18000,  err: false },
    { cell: 11, value: 7, t: 28000,  err: false },
    { cell: 13, value: 2, t: 36000,  err: false },
    { cell: 20, value: 1, t: 45000,  err: false },
    { cell: 21, value: 3, t: 56000,  err: false },
    { cell: 22, value: 4, t: 68000,  err: false },
    { cell: 30, value: 5, t: 78000,  err: false },
    { cell: 31, value: 9, t: 90000,  err: false },
    { cell: 33, value: 7, t: 108000, err: false },
    { cell: 38, value: 5, t: 122000, err: true  },
    { cell: 40, value: 5, t: 140000, err: false },
    { cell: 42, value: 3, t: 158000, err: false },
    { cell: 55, value: 4, t: 178000, err: false },
    { cell: 60, value: 9, t: 195000, err: false },
    { cell: 62, value: 1, t: 215000, err: false },
    { cell: 70, value: 8, t: 238000, err: false },
    { cell: 75, value: 6, t: 260000, err: false },
  ],
  challengedMoves: [
    { cell: 2,  value: 4, t: 3800,   err: false },
    { cell: 3,  value: 6, t: 9500,   err: false },
    { cell: 4,  value: 7, t: 15000,  err: false },
    { cell: 5,  value: 8, t: 20000,  err: false },
    { cell: 8,  value: 2, t: 28000,  err: false },
    { cell: 11, value: 7, t: 35000,  err: false },
    { cell: 13, value: 2, t: 42000,  err: false },
    { cell: 14, value: 1, t: 52000,  err: false },
    { cell: 18, value: 1, t: 60000,  err: false },
    { cell: 20, value: 1, t: 70000,  err: false },
    { cell: 22, value: 4, t: 82000,  err: false },
    { cell: 27, value: 8, t: 96000,  err: false },
    { cell: 30, value: 5, t: 108000, err: false },
    { cell: 38, value: 5, t: 122000, err: false },
    { cell: 40, value: 5, t: 138000, err: false },
    { cell: 42, value: 3, t: 152000, err: false },
    { cell: 55, value: 4, t: 168000, err: false },
    { cell: 60, value: 9, t: 184000, err: false },
    { cell: 62, value: 1, t: 200000, err: false },
    { cell: 70, value: 8, t: 218000, err: false },
    { cell: 75, value: 6, t: 232000, err: false },
    { cell: 79, value: 7, t: 248000, err: false },
  ],
  challengerTime:  280,
  challengedTime:  250,
  challengerErrors: 1,
  challengedErrors: 0,
};

type Move = { cell: number; value: number; t: number; err?: boolean };

type Replay = {
  challengeId: string;
  puzzle: string;
  solution: string;
  difficulty: string;
  startedAt?: string;
  completedAt?: string;
  challenger: { username: string; avatar: string };
  challenged: { username: string; avatar: string };
  winner?: { username: string };
  isDraw: boolean;
  challengerMoves: Move[];
  challengedMoves: Move[];
  challengerTime: number;
  challengedTime: number;
  challengerErrors: number;
  challengedErrors: number;
};

// Reconstruct the 81-cell board by applying `moves[0..frame-1]` on top
// of `puzzle`. Returns a 9x9 grid of digit-or-0.
function boardAtFrame(puzzle: string, moves: Move[], frame: number): number[] {
  const grid = puzzle.split('').map(ch => {
    const n = parseInt(ch, 10);
    return Number.isNaN(n) ? 0 : n;
  });
  // Track which cells are "given" so the renderer can color them differently.
  for (let i = 0; i < Math.min(frame, moves.length); i++) {
    const m = moves[i];
    grid[m.cell] = m.value;
  }
  return grid;
}

// m:SS from MILLISECONDS — shared util. Behaviour unchanged.
const fmtTime = formatClockMs;
// m:SS from SECONDS — shared util. Behaviour unchanged.
const fmtTotalSec = formatClock;

export default function ReplayPage() {
  const { challengeId } = useLocalSearchParams<{ challengeId: string }>();
  const router = useRouter();
  const { t } = useLang();
  const { c, r, s, type } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 1024;

  // Board size that always fits the viewport. On phones the two boards stack,
  // so each can use most of the width; on desktop we cap at 360 and show them
  // side-by-side. Fixes digits being clipped off the right edge on mobile.
  const boardSize = isDesktopWeb ? 360 : Math.min(width - 40, 380);

  const [replay, setReplay] = useState<Replay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timer = useRef<any>(null);

  // Fetch — or use the baked-in demo when challengeId === 'demo'. The demo
  // path lets us screenshot the replay UI before the schema migration has
  // populated real games. Authentic challenges hit the API as usual.
  useEffect(() => {
    if (!challengeId) return;
    let cancelled = false;
    if (challengeId === 'demo') { setReplay(DEMO_REPLAY); return; }
    (async () => {
      try {
        const token = await AsyncStorage.getItem('sudoku_token');
        const r = await fetch(`${API_URL}/challenges/${challengeId}/replay`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const j = await r.json();
        if (cancelled) return;
        if (j?.replay) setReplay(j.replay);
        else setError(j?.error || 'Failed to load replay');
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message || e));
      }
    })();
    return () => { cancelled = true; };
  }, [challengeId]);

  // Build the unified frame timeline = merged sorted moves so the scrubber
  // advances one event at a time across both players. We don't actually
  // need a merged array for the boards (each renders from its own slice)
  // but we DO need `totalFrames` and `cursorMs` to drive playback.
  const { events, totalFrames, lastTime } = useMemo(() => {
    if (!replay) return { events: [] as Array<{ side: 'L' | 'R'; t: number; idx: number }>, totalFrames: 0, lastTime: 0 };
    // One merged, stably-sorted timeline. Each event carries its side and that
    // side's running index. Stepping the scrubber by 1 = exactly 1 board move,
    // even when both players have a move at the SAME timestamp (the previous
    // inclusive `<=` filter on both arrays revealed 2+ cells per step and let
    // the frame counter drift from the actual board state).
    const evs = [
      ...replay.challengerMoves.map((m, idx) => ({ side: 'L' as const, t: m.t, idx })),
      ...replay.challengedMoves.map((m, idx) => ({ side: 'R' as const, t: m.t, idx })),
    ].sort((a, b) => a.t - b.t || (a.side === b.side ? a.idx - b.idx : a.side === 'L' ? -1 : 1));
    return { events: evs, totalFrames: evs.length, lastTime: evs[evs.length - 1]?.t || 0 };
  }, [replay]);

  // Per-side frame = how many of that side's moves fall within the first
  // `frame` events. cursorMs = timestamp of the last revealed event.
  const cursorMs = frame === 0 ? 0 : (events[frame - 1]?.t || 0);
  const leftFrame  = useMemo(() => events.slice(0, frame).filter(e => e.side === 'L').length, [events, frame]);
  const rightFrame = useMemo(() => events.slice(0, frame).filter(e => e.side === 'R').length, [events, frame]);
  const leftBoard  = useMemo(() => replay ? boardAtFrame(replay.puzzle, replay.challengerMoves, leftFrame)  : [], [replay, leftFrame]);
  const rightBoard = useMemo(() => replay ? boardAtFrame(replay.puzzle, replay.challengedMoves, rightFrame) : [], [replay, rightFrame]);
  const givens     = useMemo(() => replay ? replay.puzzle.split('').map(ch => parseInt(ch, 10) || 0) : [], [replay]);

  // Playback ticker
  useEffect(() => {
    if (!playing || !replay) return;
    timer.current = setInterval(() => {
      setFrame(f => {
        if (f >= totalFrames) { setPlaying(false); return f; }
        return f + 1;
      });
    }, Math.max(40, 320 / speed));
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [playing, totalFrames, speed, replay]);

  if (error) {
    return (
      <LinearGradient colors={[c.bgVoid, c.bg900]} style={{ flex: 1 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: s.xl }}>
          <Text style={{ fontSize: 40, marginBottom: s.md }}>🎞️</Text>
          <Text style={{ color: c.textStrong, fontSize: 20, fontWeight: '900', marginBottom: 6 }}>{t('replayNotFound')}</Text>
          <Text style={{ color: c.text, ...type.body, textAlign: 'center', marginBottom: s.lg, maxWidth: 360 }}>
            {t('replayNotFoundHint')}
          </Text>
          <TouchableOpacity onPress={() => router.push('/home' as any)} style={{ paddingHorizontal: s.xl, paddingVertical: 10, borderRadius: r.pill, backgroundColor: c.violet }}>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>{t('backToHome')}</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  if (!replay) {
    return (
      <LinearGradient colors={[c.bgVoid, c.bg900]} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 30, marginBottom: s.sm }}>⏳</Text>
        <Text style={{ color: c.text }}>{t('loading')}</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[c.bgVoid, c.bg900]} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: isDesktopWeb ? 32 : 16, maxWidth: 1240, alignSelf: 'center', width: '100%' }}>
        {/* ── HERO STRIP ──────────────────────────────────────── */}
        <View
          style={{
            padding: s.xl, borderRadius: r.lg,
            backgroundColor: c.surface800,
            borderWidth: 1, borderColor: c.borderStrong,
            marginBottom: s.xl,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <LinearGradient colors={c.gradAurora} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3 } as any} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.sm, marginBottom: s.sm }}>
            <View style={{ paddingHorizontal: s.md, paddingVertical: 4, borderRadius: r.pill, backgroundColor: `${c.gold}22`, borderWidth: 1, borderColor: `${c.gold}55` }}>
              <Text style={{ color: c.gold, ...type.eyebrow }}>{t('replayTag')}</Text>
            </View>
            <View style={{ paddingHorizontal: s.md, paddingVertical: 4, borderRadius: r.pill, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: c.border }}>
              <Text style={{ color: c.text, ...type.eyebrow }}>{replay.difficulty.toUpperCase()}</Text>
            </View>
          </View>
          <Text style={{ color: c.textStrong, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 }}>
            {replay.challenger.username} <Text style={{ color: c.text }}>vs</Text> {replay.challenged.username}
          </Text>
          <Text style={{ color: c.text, ...type.small, marginTop: 4 }}>
            {replay.isDraw
              ? t('replayDraw')
              : replay.winner
                ? t('replayWonBy').replace('{name}', replay.winner.username)
                : t('replayNoWinner')}
            {' · '}{totalFrames} {t('replayMoves')}
          </Text>
        </View>

        {/* ── PLAYER + BOARD COLUMNS ──────────────────────────── */}
        <View style={{ flexDirection: isDesktopWeb ? 'row' : 'column', gap: s.xl, alignItems: 'flex-start' }}>
          <PlayerColumn side="L" replay={replay} board={leftBoard} givens={givens} moveIdx={leftFrame} c={c} r={r} s={s} type={type} t={t} boardSize={boardSize} />
          <PlayerColumn side="R" replay={replay} board={rightBoard} givens={givens} moveIdx={rightFrame} c={c} r={r} s={s} type={type} t={t} boardSize={boardSize} />
        </View>

        {/* ── CONTROLS ────────────────────────────────────────── */}
        <View
          style={{
            marginTop: s.xl, padding: s.lg, borderRadius: r.md,
            backgroundColor: c.surface800,
            borderWidth: 1, borderColor: c.border,
          }}
        >
          {/* Scrubber */}
          <View style={{ marginBottom: s.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ color: c.textMuted, ...type.eyebrow }}>{t('frame')} {frame}/{totalFrames}</Text>
              <Text style={{ color: c.gold, ...type.eyebrow, ...type.mono }}>{fmtTime(cursorMs)}</Text>
            </View>
            <View style={{ height: 10, borderRadius: 5, backgroundColor: c.surface700, overflow: 'hidden' }}>
              <View style={{ width: totalFrames > 0 ? `${(frame / totalFrames) * 100}%` : '0%', height: '100%', backgroundColor: c.gold }} />
            </View>
          </View>
          {/* Buttons */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: s.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.sm }}>
              <CtrlBtn label="◀◀" onPress={() => { setPlaying(false); setFrame(0); }} c={c} r={r} s={s} />
              <CtrlBtn label="◀"  onPress={() => { setPlaying(false); setFrame(f => Math.max(0, f - 1)); }} c={c} r={r} s={s} />
              <CtrlBtn
                label={playing ? '⏸' : '▶'}
                accent
                onPress={() => {
                  if (frame >= totalFrames) setFrame(0);
                  setPlaying(p => !p);
                }}
                c={c} r={r} s={s}
              />
              <CtrlBtn label="▶"  onPress={() => { setPlaying(false); setFrame(f => Math.min(totalFrames, f + 1)); }} c={c} r={r} s={s} />
              <CtrlBtn label="▶▶" onPress={() => { setPlaying(false); setFrame(totalFrames); }} c={c} r={r} s={s} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.sm }}>
              <Text style={{ color: c.textMuted, ...type.eyebrow }}>{t('speed')}</Text>
              {[0.5, 1, 2, 4].map(sp => (
                <TouchableOpacity
                  key={sp}
                  onPress={() => setSpeed(sp)}
                  style={{
                    paddingHorizontal: s.md, paddingVertical: 6,
                    borderRadius: r.pill,
                    backgroundColor: speed === sp ? c.violet : 'transparent',
                    borderWidth: 1, borderColor: speed === sp ? c.violet : c.border,
                  }}
                >
                  <Text style={{ color: speed === sp ? '#fff' : c.text, fontSize: 11, fontWeight: '900' }}>{sp}×</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

function CtrlBtn({ label, onPress, accent, c, r, s }: { label: string; onPress: () => void; accent?: boolean; c: any; r: any; s: any }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        width: accent ? 52 : 40, height: accent ? 52 : 40,
        borderRadius: r.md,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: accent ? c.gold : c.surface700,
        borderWidth: 1, borderColor: accent ? c.gold : c.border,
      }}
    >
      <Text style={{ color: accent ? c.bgVoid : c.textStrong, fontSize: accent ? 22 : 16, fontWeight: '900' }}>{label}</Text>
    </TouchableOpacity>
  );
}

function PlayerColumn({
  side, replay, board, givens, moveIdx, c, r, s, type, t, boardSize,
}: {
  side: 'L' | 'R';
  replay: Replay;
  board: number[];
  givens: number[];
  moveIdx: number;
  c: any; r: any; s: any; type: any;
  t: (k: any) => string;
  boardSize: number;
}) {
  const player = side === 'L' ? replay.challenger : replay.challenged;
  const moves = side === 'L' ? replay.challengerMoves : replay.challengedMoves;
  const errors = side === 'L' ? replay.challengerErrors : replay.challengedErrors;
  const timeSec = side === 'L' ? replay.challengerTime : replay.challengedTime;
  const isWinner = !!replay.winner && replay.winner.username === player.username;
  const isLastMove = moveIdx > 0;
  const lastCell = isLastMove ? moves[moveIdx - 1]?.cell : -1;

  return (
    <View style={{ flex: 1, gap: s.md }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: s.md,
        padding: s.md, borderRadius: r.md,
        backgroundColor: c.surface800,
        borderWidth: 1, borderColor: isWinner ? `${c.gold}55` : c.border,
      }}>
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: c.surface700, borderWidth: 1, borderColor: isWinner ? c.gold : c.border, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 20 }}>{player.avatar}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.sm }}>
            <Text style={{ color: c.textStrong, fontSize: 14, fontWeight: '900' }} numberOfLines={1}>{player.username}</Text>
            {isWinner && <Text style={{ color: c.gold, ...type.eyebrow }}>🏆 {t('winnerTag')}</Text>}
          </View>
          <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: '700' }}>
            {fmtTotalSec(timeSec)} · {errors} {t('errorsShort')} · {moves.length} {t('replayMoves')}
          </Text>
        </View>
        <View>
          <Text style={{ color: c.gold, fontSize: 16, fontWeight: '900', ...type.mono }}>{moveIdx}/{moves.length}</Text>
        </View>
      </View>
      {/* Board */}
      <SudokuBoard board={board} givens={givens} highlight={lastCell} c={c} size={boardSize} />
    </View>
  );
}

function SudokuBoard({ board, givens, highlight, c, size = 360 }: { board: number[]; givens: number[]; highlight: number; c: any; size?: number }) {
  const cell = size / 9;
  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }}>
      <View style={{ width: size, height: size, backgroundColor: c.bgVoid, borderWidth: 2, borderColor: c.borderStrong, borderRadius: 6 }}>
        {Array.from({ length: 9 }).map((_, row) => (
          <View key={row} style={{ flexDirection: 'row', height: cell }}>
            {Array.from({ length: 9 }).map((_, col) => {
              const idx = row * 9 + col;
              const val = board[idx];
              const isGiven = givens[idx] > 0;
              const isPlayed = !isGiven && val > 0;
              const isHi = idx === highlight;
              // Heavy borders on every 3rd cell line
              const borderRight = (col + 1) % 3 === 0 && col < 8 ? 2 : 1;
              const borderBottom = (row + 1) % 3 === 0 && row < 8 ? 2 : 1;
              return (
                <View
                  key={col}
                  style={{
                    width: cell, height: cell,
                    alignItems: 'center', justifyContent: 'center',
                    borderRightWidth: borderRight, borderRightColor: c.borderStrong,
                    borderBottomWidth: borderBottom, borderBottomColor: c.borderStrong,
                    backgroundColor: isHi ? `${c.gold}22` : 'transparent',
                  }}
                >
                  {val > 0 && (
                    <Text
                      style={{
                        color: isGiven ? c.textStrong : isHi ? c.gold : c.cyan,
                        fontSize: cell * 0.5,
                        fontWeight: isGiven ? '900' : '700',
                        // tabular-nums for visual alignment across rows
                        fontVariant: ['tabular-nums' as any],
                      }}
                    >
                      {val}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
