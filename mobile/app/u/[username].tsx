/**
 * Public profile page — /u/<username>
 *
 * Visible to anyone (auth or guest). Fetches sanitized profile data
 * from /api/users/by-username/:username (added in sprint-19) and renders
 * a desktop-grade card with avatar, level, stars, joined-at, online
 * dot, W-L tally, current/best streak, and a CHALLENGE CTA that
 * deeplinks to /challenges?to=<username>.
 *
 * Designed as the viral share target — once the user has a stable URL
 * to their own profile, every share button across the app can copy it.
 *
 * Phone falls back to a simpler stacked layout; both share the data
 * fetch hook below.
 */
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Platform, useWindowDimensions, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useLang } from '../../utils/LanguageContext';
import { useTheme } from '../../utils/theme';
import { API_URL } from '../../utils/api';

type PublicProfile = {
  username: string;
  avatar: string;
  level: number;
  stars: number;
  joinedAt?: string;
  isOnline: boolean;
  lastActive?: string;
  gamesPlayed: number;
  gamesWon: number;
  bestStreak: number;
  currentStreak: number;
};

function formatJoined(iso?: string, lang: 'en' | 'fr' | 'ar' = 'en'): string {
  if (!iso) return '—';
  try {
    const locale = lang === 'fr' ? 'fr-FR' : lang === 'ar' ? 'ar' : 'en-US';
    return new Date(iso).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
}

export default function PublicProfile() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const { t, lang } = useLang() as any;
  const { c, r, s, type } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 1024;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!username) return;
    // Reset for the new username so we never flash the previous profile or a
    // stale error (expo-router reuses this screen on /u/alice → /u/bob).
    setProfile(null);
    setError(null);
    setLoading(true);
    fetch(`${API_URL}/users/by-username/${encodeURIComponent(String(username))}`)
      .then(r => r.json())
      .then(j => {
        if (cancelled) return;
        if (j?.user) { setError(null); setProfile(j.user); }
        else setError(j?.error || 'Not found');
      })
      .catch(e => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [username]);

  const winRate = profile && profile.gamesPlayed > 0
    ? Math.round((profile.gamesWon / profile.gamesPlayed) * 100)
    : 0;

  const handleChallenge = () => {
    router.push(`/challenges?to=${encodeURIComponent(String(username))}` as any);
  };

  const handleShare = async () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  if (loading) {
    return (
      <LinearGradient colors={[c.bgVoid, c.bg900]} style={{ flex: 1 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: s.x2 }}>
          <Text style={{ fontSize: 30, marginBottom: s.sm }}>⏳</Text>
          <Text style={{ color: c.text, ...type.body }}>{t('loading')}</Text>
        </View>
      </LinearGradient>
    );
  }

  if (error || !profile) {
    return (
      <LinearGradient colors={[c.bgVoid, c.bg900]} style={{ flex: 1 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: s.x2 }}>
          <Text style={{ fontSize: 50, marginBottom: s.md }}>🚫</Text>
          <Text style={{ color: c.textStrong, fontSize: 22, fontWeight: '900', marginBottom: 6 }}>
            {t('profileNotFound')}
          </Text>
          <Text style={{ color: c.text, ...type.body, textAlign: 'center', marginBottom: s.lg, maxWidth: 360 }}>
            {t('profileNotFoundHint')} <Text style={{ color: c.gold, fontWeight: '800' }}>@{username}</Text>
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/home' as any)}
            style={{ paddingHorizontal: s.xl, paddingVertical: 10, borderRadius: r.pill, backgroundColor: c.violet }}
          >
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 }}>{t('backToHome')}</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[c.bgVoid, c.bg900]} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: isDesktopWeb ? 32 : 16, alignSelf: 'center', maxWidth: 920, width: '100%' }}>
        {/* ── Hero card ───────────────────────────────────────── */}
        <View
          style={{
            position: 'relative',
            padding: isDesktopWeb ? s.x3 : s.xl,
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
            colors={[c.glow, 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.7 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.4 } as any}
          />
          <View style={{ flexDirection: isDesktopWeb ? 'row' : 'column', alignItems: 'center', gap: isDesktopWeb ? s.x2 : s.lg }}>
            {/* Avatar */}
            <View style={{ position: 'relative' }}>
              <View
                style={{
                  width: 120, height: 120, borderRadius: 60,
                  backgroundColor: c.surface700,
                  borderWidth: 3, borderColor: c.gold,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 60 }}>{profile.avatar}</Text>
              </View>
              {profile.isOnline && (
                <View
                  style={{
                    position: 'absolute', bottom: 4, right: 4,
                    width: 22, height: 22, borderRadius: 11,
                    backgroundColor: c.success, borderWidth: 3, borderColor: c.surface800,
                  }}
                />
              )}
            </View>
            {/* Identity + actions */}
            <View style={{ flex: 1, alignItems: isDesktopWeb ? 'flex-start' : 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.sm, marginBottom: s.sm }}>
                <View style={{ paddingHorizontal: s.md, paddingVertical: 3, borderRadius: r.pill, backgroundColor: profile.isOnline ? 'rgba(74,222,128,0.16)' : 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: profile.isOnline ? 'rgba(74,222,128,0.4)' : c.border }}>
                  <Text style={{ color: profile.isOnline ? c.success : c.textMuted, ...type.eyebrow }}>
                    {profile.isOnline ? `● ${t('onlineNow')}` : t('offline')}
                  </Text>
                </View>
                <View style={{ paddingHorizontal: s.md, paddingVertical: 3, borderRadius: r.pill, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: c.border }}>
                  <Text style={{ color: c.text, ...type.eyebrow }}>
                    {t('joined')} {formatJoined(profile.joinedAt, lang)}
                  </Text>
                </View>
              </View>
              <Text style={{ color: c.textStrong, fontSize: isDesktopWeb ? 36 : 28, fontWeight: '900', letterSpacing: -0.6 }}>
                {profile.username}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.md, marginTop: s.xs }}>
                <Text style={{ color: c.text, fontSize: 14, fontWeight: '700' }}>
                  {t('level')} {profile.level}
                </Text>
                <Text style={{ color: c.textMuted, fontSize: 14 }}>·</Text>
                <Text style={{ color: c.gold, fontSize: 14, fontWeight: '900' }}>
                  ⭐ {profile.stars}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: s.sm, marginTop: s.lg, flexWrap: 'wrap', justifyContent: isDesktopWeb ? 'flex-start' : 'center' }}>
                <TouchableOpacity
                  onPress={handleChallenge}
                  style={{ paddingHorizontal: s.xl, paddingVertical: 12, borderRadius: r.pill, backgroundColor: c.violet }}
                >
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 }}>
                    ⚔️ {t('challenge')} {profile.username}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleShare}
                  style={{ paddingHorizontal: s.lg, paddingVertical: 12, borderRadius: r.pill, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: c.border }}
                >
                  <Text style={{ color: c.text, fontSize: 12, fontWeight: '900', letterSpacing: 0.5 }}>
                    {copied ? `✓ ${t('linkCopied')}` : `🔗 ${t('shareProfile')}`}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* ── Stats row ───────────────────────────────────────── */}
        <View style={{ flexDirection: 'row', gap: s.lg, marginTop: s.xl, flexWrap: 'wrap' }}>
          {[
            { tag: t('gamesPlayed'),  val: profile.gamesPlayed, accent: c.cyan,   icon: '🎮' },
            { tag: t('gamesWon'),     val: profile.gamesWon,    accent: c.success, icon: '🏆' },
            { tag: t('winRate'),      val: `${winRate}%`,        accent: c.gold,   icon: '📈' },
            { tag: t('streakRecord'), val: profile.bestStreak,   accent: c.violet, icon: '🔥' },
          ].map((row, i) => (
            <View
              key={i}
              style={{
                flex: 1, minWidth: 180,
                padding: s.lg, borderRadius: r.md,
                backgroundColor: c.surface800,
                borderWidth: 1, borderColor: c.border,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: s.sm }}>
                <Text style={{ color: c.textMuted, ...type.eyebrow }}>{row.tag}</Text>
                <Text style={{ fontSize: 14 }}>{row.icon}</Text>
              </View>
              <Text style={{ color: row.accent, fontSize: 32, fontWeight: '900', letterSpacing: -0.8, ...type.mono }}>
                {row.val}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Streak feature ──────────────────────────────────── */}
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: s.lg,
            marginTop: s.xl,
            padding: s.lg, borderRadius: r.md,
            backgroundColor: c.surface800,
            borderWidth: 1, borderColor: c.border,
          }}
        >
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: `${c.gold}1f`, borderWidth: 2, borderColor: c.gold, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 24 }}>🔥</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.textMuted, ...type.eyebrow }}>{t('streakCardTag')}</Text>
            <Text style={{ color: c.textStrong, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>
              {profile.currentStreak} <Text style={{ fontSize: 13, color: c.text }}>{t('daysShort')}</Text>
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: c.textMuted, ...type.eyebrow }}>{t('streakRecord')}</Text>
            <Text style={{ color: c.gold, fontSize: 18, fontWeight: '900', ...type.mono }}>{profile.bestStreak}</Text>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
