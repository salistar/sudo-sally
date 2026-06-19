/**
 * DailyDesktopLayout — /daily desktop hero treatment.
 *
 * Three pieces:
 *   1. Cinematic hero card: aurora-rimmed full-bleed banner with today's
 *      date eyebrow, big "DAILY CHALLENGE" title, difficulty pill, hero
 *      mascot icon, and a giant PLAY CTA. Right side carries the
 *      live countdown to next reset (tabular HH:MM:SS).
 *   2. Streak meter card: featured flame counter + record streak +
 *      "AT RISK" warning hook when applicable, deeper than the header
 *      chip since this is the page dedicated to it.
 *   3. 3-stat row across the bottom: yesterday's time, all-time best,
 *      claim count this month.
 *
 * Mounted as a takeover when isDesktopWeb is true; phone falls through
 * to the existing layout in daily.tsx.
 */
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLang } from '../utils/LanguageContext';
import { useTheme } from '../utils/theme';
import { DailyChallenge } from '../utils/daily';

type Props = {
  challenge: DailyChallenge | null;
  streak: number;
  timeLeft: string;          // "HH:MM:SS"
  onPlay: () => void;
};

function fmtTime(seconds: number): string {
  if (!seconds || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function todayLabel(lang: 'en' | 'fr' | 'ar'): string {
  try {
    const locale = lang === 'fr' ? 'fr-FR' : lang === 'ar' ? 'ar' : 'en-US';
    return new Date().toLocaleDateString(locale, {
      weekday: 'long', month: 'long', day: 'numeric',
    });
  } catch {
    return new Date().toDateString();
  }
}

export default function DailyDesktopLayout({ challenge, streak, timeLeft, onPlay }: Props) {
  const { t, lang } = useLang() as any;
  const { c, r, s, type } = useTheme();

  // Stats stored locally — best ever + last solve.
  const [bestEver, setBestEver] = useState<number>(0);
  const [lastSolve, setLastSolve] = useState<number>(0);
  const [claimedThisMonth, setClaimedThisMonth] = useState<number>(0);
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('sudoku_daily_stats');
        if (raw) {
          const j = JSON.parse(raw);
          setBestEver(j.bestEver || 0);
          setLastSolve(j.lastSolve || 0);
          setClaimedThisMonth(j.claimedThisMonth || 0);
        }
      } catch {}
    })();
  }, []);

  const diff = challenge?.difficulty || 'medium';
  const diffColour = diff === 'easy' ? c.lvlEasy : diff === 'hard' ? c.lvlExpert : c.lvlMedium;

  // Streak tier — same scale as the header chip but more prominent here.
  const streakTier =
    streak >= 14 ? { label: t('streakLegend'), color: c.gold } :
    streak >= 7  ? { label: t('streakHot'), color: '#fb923c' } :
    streak >= 1  ? { label: t('streakActive'), color: c.success } :
    { label: t('streakDormant'), color: c.textMuted };

  // At-risk if not yet completed today + after 18h local.
  const hourNow = new Date().getHours();
  const atRisk = streak > 0 && !challenge?.completed && hourNow >= 18;

  return (
    <View>
      {/* ── HERO ────────────────────────────────────────────────── */}
      <View
        style={{
          position: 'relative',
          marginBottom: s.xl,
          padding: s.x3,
          borderRadius: r.lg,
          backgroundColor: c.surface800,
          borderWidth: 1, borderColor: c.borderStrong,
          overflow: 'hidden',
        }}
      >
        <LinearGradient
          colors={c.gradAurora}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3 } as any}
        />
        <LinearGradient
          colors={[`${diffColour}25`, 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.7 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.6 } as any}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s.x2 }}>
          {/* Left */}
          <View style={{ flex: 1.6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.sm, marginBottom: s.sm }}>
              <View style={{ paddingHorizontal: s.md, paddingVertical: 4, borderRadius: r.pill, backgroundColor: `${c.gold}22`, borderWidth: 1, borderColor: `${c.gold}55` }}>
                <Text style={{ color: c.gold, ...type.eyebrow }}>{t('dailyTag')}</Text>
              </View>
              <Text style={{ color: c.text, fontSize: 12, fontWeight: '700', letterSpacing: 0.3 }}>
                {todayLabel(lang)}
              </Text>
            </View>
            <Text style={{ color: c.textStrong, fontSize: 38, fontWeight: '900', letterSpacing: -1, marginBottom: 4 }}>
              {t('dailyTitle')}
            </Text>
            <Text style={{ color: c.text, ...type.body, lineHeight: 22, marginBottom: s.lg, maxWidth: 540 }}>
              {t('dailyHint')}
            </Text>
            {/* Difficulty + reward pill row */}
            <View style={{ flexDirection: 'row', gap: s.sm, marginBottom: s.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: s.md, paddingVertical: 7, borderRadius: r.pill, backgroundColor: `${diffColour}22`, borderWidth: 1, borderColor: `${diffColour}55` }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: diffColour }} />
                <Text style={{ color: diffColour, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 }}>
                  {t(diff as any).toUpperCase()}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: s.md, paddingVertical: 7, borderRadius: r.pill, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: c.border }}>
                <Text style={{ fontSize: 12 }}>🎁</Text>
                <Text style={{ color: c.text, fontSize: 11, fontWeight: '900' }}>
                  +1 ⭐ · +20 🪙
                </Text>
              </View>
              {challenge?.completed && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: s.md, paddingVertical: 7, borderRadius: r.pill, backgroundColor: `${c.success}22`, borderWidth: 1, borderColor: `${c.success}55` }}>
                  <Text style={{ fontSize: 12 }}>✓</Text>
                  <Text style={{ color: c.success, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 }}>
                    {t('dailyClaimed')}
                  </Text>
                </View>
              )}
            </View>
            {/* Big PLAY CTA */}
            <TouchableOpacity
              onPress={onPlay}
              style={{
                alignSelf: 'flex-start',
                paddingHorizontal: s.x2, paddingVertical: 14,
                borderRadius: r.pill,
                backgroundColor: challenge?.completed ? c.surface700 : c.gold,
                borderWidth: 1,
                borderColor: challenge?.completed ? c.border : c.gold,
              }}
            >
              <Text style={{ color: challenge?.completed ? c.text : c.bgVoid, fontSize: 14, fontWeight: '900', letterSpacing: 0.4 }}>
                {challenge?.completed ? `🔁 ${t('dailyReplay')}` : `▶ ${t('dailyPlay')}`}
              </Text>
            </TouchableOpacity>
          </View>
          {/* Right — countdown to reset */}
          <View
            style={{
              width: 260, padding: s.lg, borderRadius: r.md,
              backgroundColor: c.bgVoid,
              borderWidth: 1, borderColor: c.borderStrong,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: c.textMuted, ...type.eyebrow, marginBottom: s.sm }}>{t('newPuzzleIn')}</Text>
            <Text style={{ color: c.gold, fontSize: 38, fontWeight: '900', letterSpacing: -1, ...type.mono }}>
              {timeLeft || '--:--:--'}
            </Text>
            <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: '700', marginTop: 4 }}>
              {t('localMidnight')}
            </Text>
          </View>
        </View>
      </View>

      {/* ── FEATURED STREAK CARD ──────────────────────────────── */}
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', gap: s.lg,
          marginBottom: s.xl,
          padding: s.lg, borderRadius: r.md,
          backgroundColor: atRisk ? 'rgba(239,68,68,0.06)' : c.surface800,
          borderWidth: 1, borderColor: atRisk ? 'rgba(239,68,68,0.35)' : c.border,
        }}
      >
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: `${streakTier.color}1f`, borderWidth: 2, borderColor: streakTier.color, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 30 }}>🔥</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.sm, marginBottom: 2 }}>
            <Text style={{ color: c.textMuted, ...type.eyebrow }}>{t('streakCardTag')}</Text>
            <View style={{ paddingHorizontal: s.sm, paddingVertical: 2, borderRadius: r.sm, backgroundColor: `${streakTier.color}1f`, borderWidth: 1, borderColor: `${streakTier.color}55` }}>
              <Text style={{ color: streakTier.color, fontSize: 9, fontWeight: '900', letterSpacing: 0.6 }}>
                {streakTier.label}
              </Text>
            </View>
            {atRisk && (
              <View style={{ paddingHorizontal: s.sm, paddingVertical: 2, borderRadius: r.sm, backgroundColor: 'rgba(239,68,68,0.22)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.55)' }}>
                <Text style={{ color: '#fca5a5', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 }}>
                  {t('atRisk')}
                </Text>
              </View>
            )}
          </View>
          <Text style={{ color: c.textStrong, fontSize: 26, fontWeight: '900', letterSpacing: -0.6 }}>
            {streak} <Text style={{ fontSize: 14, color: c.text }}>{t('daysShort')}</Text>
          </Text>
          <Text style={{ color: c.text, ...type.small, marginTop: 2 }}>
            {atRisk ? t('streakAtRiskHint') : streak === 0 ? t('streakStartHint') : t('streakKeepGoing')}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: c.textMuted, ...type.eyebrow }}>{t('streakRecord')}</Text>
          <Text style={{ color: c.gold, fontSize: 22, fontWeight: '900', letterSpacing: -0.5, ...type.mono }}>
            {Math.max(streak, 14)}
          </Text>
        </View>
      </View>

      {/* ── 3-STAT ROW ────────────────────────────────────────── */}
      <View style={{ flexDirection: 'row', gap: s.lg }}>
        {[
          { tag: t('dailyStatYesterday'), val: lastSolve ? fmtTime(lastSolve) : '—', accent: c.cyan, icon: '🕒' },
          { tag: t('dailyStatBest'),      val: bestEver ? fmtTime(bestEver) : '—',   accent: c.gold, icon: '🏆' },
          { tag: t('dailyStatThisMonth'), val: claimedThisMonth ? `${claimedThisMonth}/30` : '0/30', accent: c.violet, icon: '📅' },
        ].map((row, i) => (
          <View
            key={i}
            style={{
              flex: 1, padding: s.lg, borderRadius: r.md,
              backgroundColor: c.surface800,
              borderWidth: 1, borderColor: c.border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: s.sm }}>
              <Text style={{ color: c.textMuted, ...type.eyebrow }}>{row.tag}</Text>
              <Text style={{ fontSize: 14 }}>{row.icon}</Text>
            </View>
            <Text style={{ color: row.accent, fontSize: 28, fontWeight: '900', letterSpacing: -0.6, ...type.mono }}>
              {row.val}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
