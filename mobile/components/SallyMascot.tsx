/**
 * Sally — the SallySudo mascot.
 *
 * A small, friendly puzzle-themed character drawn entirely in SVG (so it
 * scales crisply at any size and ships at ~3 kB instead of relying on
 * Apple/Google system emojis as our brand identity).
 *
 * Sally is a stylised owl — pattern-recognition icon worldwide, has the
 * "smart brain" connotation Sudoku.com and Brilliant.org also lean on,
 * and the round body + big eyes hit the same "approachable cute" register
 * as Duolingo's Duo and Royal Match's King.
 *
 * Three visual modes:
 *   • "default"   — neutral pose, mid-size, for headers / empty states
 *   • "wink"      — one eye closed, used during onboarding / first-win
 *   • "thinking"  — both eyes off + a thought bubble, for tutorial / hints
 *
 * Usage:
 *   <SallyMascot size={120} mode="wink" />
 */
import React from 'react';
import Svg, { Defs, LinearGradient, Stop, RadialGradient, Circle, Ellipse, Path, Rect, G, Text as SvgText } from 'react-native-svg';

export type MascotMode = 'default' | 'wink' | 'thinking';

export default function SallyMascot({
  size = 120,
  mode = 'default',
}: {
  size?: number;
  mode?: MascotMode;
}) {
  return (
    <Svg viewBox="0 0 200 200" width={size} height={size}>
      <Defs>
        {/* Body gradient — soft green that ties into the brand */}
        <LinearGradient id="sallyBody" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#5eead4" />
          <Stop offset="0.6" stopColor="#7c5cff" />
          <Stop offset="1" stopColor="#2dd4db" />
        </LinearGradient>
        <LinearGradient id="sallyBelly" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#dcfce7" />
          <Stop offset="1" stopColor="#bbf7d0" />
        </LinearGradient>
        <RadialGradient id="sallyHighlight" cx="0.35" cy="0.35" r="0.7">
          <Stop offset="0" stopColor="#ffffff" stopOpacity="0.45" />
          <Stop offset="0.6" stopColor="#ffffff" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="sallyEye" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0a0a1a" />
          <Stop offset="1" stopColor="#1e293b" />
        </LinearGradient>
        <LinearGradient id="sallyBeak" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#fde047" />
          <Stop offset="1" stopColor="#f59e0b" />
        </LinearGradient>
      </Defs>

      {/* Soft shadow under the body */}
      <Ellipse cx="100" cy="186" rx="58" ry="8" fill="#000" opacity="0.18" />

      {/* Body — slightly egg-shaped owl */}
      <Ellipse cx="100" cy="115" rx="68" ry="70" fill="url(#sallyBody)" />
      {/* Belly patch */}
      <Ellipse cx="100" cy="125" rx="42" ry="48" fill="url(#sallyBelly)" />
      {/* Top-left highlight to add depth */}
      <Ellipse cx="78" cy="80" rx="55" ry="55" fill="url(#sallyHighlight)" />

      {/* Ear tufts */}
      <Path d="M 55 60 Q 50 30 70 38 Q 70 52 65 70 Z" fill="url(#sallyBody)" />
      <Path d="M 145 60 Q 150 30 130 38 Q 130 52 135 70 Z" fill="url(#sallyBody)" />

      {/* Face mask (lighter green ring around eyes) */}
      <Ellipse cx="100" cy="92" rx="48" ry="38" fill="#bbf7d0" opacity="0.55" />

      {/* Eyes */}
      <Eyes mode={mode} />

      {/* Beak — diamond */}
      <Path d="M 100 110 L 110 122 L 100 132 L 90 122 Z" fill="url(#sallyBeak)" />
      {/* Beak highlight */}
      <Path d="M 100 110 L 105 120 L 100 122 L 95 120 Z" fill="#fef9c3" opacity="0.7" />

      {/* Tiny rosy cheeks */}
      <Circle cx="68" cy="118" r="6" fill="#fda4af" opacity="0.55" />
      <Circle cx="132" cy="118" r="6" fill="#fda4af" opacity="0.55" />

      {/* Feet */}
      <Ellipse cx="78" cy="180" rx="14" ry="6" fill="url(#sallyBeak)" />
      <Ellipse cx="122" cy="180" rx="14" ry="6" fill="url(#sallyBeak)" />

      {/* Wings — small tucked-in arcs on each side */}
      <Path d="M 35 110 Q 20 130 35 155 Q 50 145 45 120 Z" fill="#2dd4db" />
      <Path d="M 165 110 Q 180 130 165 155 Q 150 145 155 120 Z" fill="#2dd4db" />

      {/* Sudoku thought bubble — only in 'thinking' mode */}
      {mode === 'thinking' && (
        <G>
          <Rect x="138" y="22" width="46" height="46" rx="10" fill="#fff" />
          <Rect x="143" y="27" width="36" height="36" rx="6" fill="none" stroke="#7c5cff" strokeWidth="1.5" />
          {/* Mini 3×3 with two digits */}
          <Path d="M 155 27 V 63 M 167 27 V 63 M 143 39 H 179 M 143 51 H 179" stroke="#7c5cff" strokeWidth="1" />
          <SvgText x="146" y="38" fill="#0a0a1a" fontSize="10" fontWeight="bold" fontFamily="Arial">5</SvgText>
          <SvgText x="170" y="62" fill="#0a0a1a" fontSize="10" fontWeight="bold" fontFamily="Arial">8</SvgText>
          {/* Bubble tail */}
          <Circle cx="142" cy="76" r="4" fill="#fff" />
          <Circle cx="135" cy="84" r="2.5" fill="#fff" />
        </G>
      )}
    </Svg>
  );
}

function Eyes({ mode }: { mode: MascotMode }) {
  if (mode === 'wink') {
    return (
      <>
        {/* Left eye — open */}
        <Circle cx="78" cy="88" r="10" fill="url(#sallyEye)" />
        <Circle cx="82" cy="84" r="3" fill="#fff" />
        {/* Right eye — winking ^ */}
        <Path d="M 112 90 Q 122 80 132 90" stroke="#0a0a1a" strokeWidth="3" strokeLinecap="round" fill="none" />
      </>
    );
  }
  if (mode === 'thinking') {
    return (
      <>
        {/* Both eyes — closed flat lines (looking up at the bubble) */}
        <Path d="M 68 88 L 88 88" stroke="#0a0a1a" strokeWidth="3" strokeLinecap="round" />
        <Path d="M 112 88 L 132 88" stroke="#0a0a1a" strokeWidth="3" strokeLinecap="round" />
      </>
    );
  }
  return (
    <>
      <Circle cx="78" cy="88" r="10" fill="url(#sallyEye)" />
      <Circle cx="122" cy="88" r="10" fill="url(#sallyEye)" />
      {/* Catchlights */}
      <Circle cx="82" cy="84" r="3" fill="#fff" />
      <Circle cx="126" cy="84" r="3" fill="#fff" />
    </>
  );
}
