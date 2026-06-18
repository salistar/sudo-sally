/**
 * ShopDesktopLayout — Steam-/console-store style /shop layout for desktop.
 *
 * Replaces the mobile vertical list with a true storefront:
 *   • Featured "Bundle of the week" hero card (full-bleed, animated halo,
 *     SALE badge, original price strikethrough)
 *   • Segmented tabs (THEMES / POWER-UPS) in glass pills
 *   • 3-column tile grid with deal badges (NEW · HOT · SALE)
 *   • Owned items keep a green check pill in the corner
 *   • Buy buttons disabled when coins < price
 *
 * Mounted as a takeover when isDesktopWeb is true; the mobile screen
 * falls back to the existing layout otherwise. All colour comes from
 * the Midnight Atlas tokens so a theme switch later propagates here.
 */
import { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLang } from '../utils/LanguageContext';
import { useTheme } from '../utils/theme';
import { Theme as ThemeItem } from '../utils/themes';
import { PowerUp } from '../utils/powerups';

type Props = {
  coins: number;
  themes: ThemeItem[];
  ownedThemes: string[];
  powerups: PowerUp[];
  tab: 'themes' | 'powerups';
  onTab: (t: 'themes' | 'powerups') => void;
  onBuyTheme: (t: ThemeItem) => void;
  onBuyPowerup: (p: PowerUp) => void;
};

function badgeFor(price: number): { label: string; color: string } | null {
  if (price === 0)   return { label: 'FREE', color: '#34D399' };
  if (price >= 500)  return { label: 'PREMIUM', color: '#E5B567' };
  if (price >= 200)  return { label: 'HOT', color: '#FB7185' };
  if (price <= 50)   return { label: 'NEW', color: '#2DD4DB' };
  return null;
}

export default function ShopDesktopLayout({
  coins, themes, ownedThemes, powerups, tab, onTab, onBuyTheme, onBuyPowerup,
}: Props) {
  const { t } = useLang();
  const { c, r, s, type } = useTheme();

  // Featured = first locked theme priced as the hero deal. Falls back
  // to the most expensive theme if everything is owned.
  const featured =
    themes.find(th => !ownedThemes.includes(th.id) && th.price > 0) ||
    [...themes].sort((a, b) => b.price - a.price)[0];

  // Aurora halo loop for the featured hero card.
  const halo = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(halo, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(halo, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    ).start();
  }, [halo]);
  const haloOpacity = halo.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });

  return (
    <View>
      {/* ── Featured bundle ───────────────────────────────────────── */}
      {featured && (
        <View
          style={{
            position: 'relative',
            marginBottom: s.xl,
            padding: s.x2,
            borderRadius: r.lg,
            backgroundColor: c.surface800,
            borderWidth: 1, borderColor: c.borderStrong,
            overflow: 'hidden',
          }}
        >
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -80, right: -80,
              width: 320, height: 320, borderRadius: 160,
              backgroundColor: c.glow,
              opacity: haloOpacity,
            }}
          />
          <LinearGradient
            colors={c.gradAurora}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2 } as any}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.x2 }}>
            <View style={{ flex: 1.4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.sm, marginBottom: s.sm }}>
                <View style={{ paddingHorizontal: s.md, paddingVertical: 4, borderRadius: r.pill, backgroundColor: `${c.gold}22`, borderWidth: 1, borderColor: `${c.gold}55` }}>
                  <Text style={{ color: c.gold, ...type.eyebrow }}>{t('shopFeaturedTag')}</Text>
                </View>
                <View style={{ paddingHorizontal: s.md, paddingVertical: 4, borderRadius: r.pill, backgroundColor: 'rgba(239,68,68,0.18)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)' }}>
                  <Text style={{ color: '#FCA5A5', ...type.eyebrow }}>{t('shopSale')} -30%</Text>
                </View>
              </View>
              <Text style={{ color: c.textStrong, fontSize: 28, fontWeight: '900', letterSpacing: -0.6, marginBottom: 4 }}>
                {featured.name}
              </Text>
              <Text style={{ color: c.text, ...type.body, lineHeight: 22, marginBottom: s.lg, maxWidth: 520 }}>
                {t('shopFeaturedDesc')}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.md, marginBottom: s.lg }}>
                <Text style={{ color: c.textMuted, fontSize: 14, fontWeight: '700', textDecorationLine: 'line-through' }}>
                  🪙 {Math.round(featured.price * 1.4)}
                </Text>
                <Text style={{ color: c.gold, fontSize: 28, fontWeight: '900', letterSpacing: -0.6 }}>
                  🪙 {featured.price}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: s.md }}>
                <TouchableOpacity
                  onPress={() => onBuyTheme(featured)}
                  disabled={coins < featured.price || ownedThemes.includes(featured.id)}
                  style={{
                    paddingHorizontal: s.xl, paddingVertical: 12,
                    borderRadius: r.pill,
                    backgroundColor: c.violet,
                    opacity: (coins < featured.price || ownedThemes.includes(featured.id)) ? 0.5 : 1,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 }}>
                    {ownedThemes.includes(featured.id) ? t('owned') : t('shopBuyNow')}
                  </Text>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: s.lg, paddingVertical: 12, borderRadius: r.pill, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: c.border }}>
                  <Text style={{ fontSize: 12 }}>⏱</Text>
                  <Text style={{ color: c.text, ...type.small }}>{t('shopExpires')}</Text>
                </View>
              </View>
            </View>
            {/* Right preview card */}
            <View
              style={{
                width: 240, height: 220, borderRadius: r.md,
                backgroundColor: c.bgVoid,
                borderWidth: 1, borderColor: `${c.gold}40`,
                alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              <LinearGradient
                colors={[`${c.violet}22`, 'transparent']}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as any}
              />
              <Text style={{ fontSize: 110, lineHeight: 130 }}>{(featured as any).icon || '🎨'}</Text>
              <Text style={{ color: c.textStrong, fontSize: 14, fontWeight: '800', marginTop: s.sm, letterSpacing: 0.4 }}>
                {featured.name.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* ── Tab pills ─────────────────────────────────────────────── */}
      <View style={{ flexDirection: 'row', gap: s.sm, marginBottom: s.xl, padding: 6, borderRadius: r.pill, backgroundColor: c.surface800, borderWidth: 1, borderColor: c.border, alignSelf: 'flex-start' }}>
        {(['themes', 'powerups'] as const).map(key => {
          const active = tab === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => onTab(key)}
              style={{
                paddingHorizontal: s.xl, paddingVertical: 9,
                borderRadius: r.pill,
                backgroundColor: active ? c.violet : 'transparent',
              }}
            >
              <Text style={{ color: active ? '#fff' : c.text, fontSize: 13, fontWeight: '900', letterSpacing: 0.5 }}>
                {key === 'themes' ? `🎨 ${t('themes')}` : `⚡ ${t('powerups')}`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Tile grid ─────────────────────────────────────────────── */}
      {tab === 'themes' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.lg }}>
          {themes.map(th => {
            const isOwned = ownedThemes.includes(th.id);
            const cantAfford = !isOwned && coins < th.price;
            const badge = isOwned ? { label: t('owned'), color: c.success } : badgeFor(th.price);
            return (
              <View
                key={th.id}
                style={{
                  width: 230,
                  padding: s.lg,
                  borderRadius: r.md,
                  backgroundColor: c.surface800,
                  borderWidth: 1, borderColor: c.border,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: s.md }}>
                  <Text style={{ fontSize: 38 }}>{(th as any).icon || '🎨'}</Text>
                  {badge && (
                    <View style={{ paddingHorizontal: s.sm, paddingVertical: 3, borderRadius: r.sm, backgroundColor: `${badge.color}1f`, borderWidth: 1, borderColor: `${badge.color}45` }}>
                      <Text style={{ color: badge.color, ...type.eyebrow }}>{badge.label}</Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: c.textStrong, fontSize: 15, fontWeight: '900', marginBottom: 4 }} numberOfLines={1}>
                  {th.name}
                </Text>
                <Text style={{ color: c.text, ...type.small, lineHeight: 16, marginBottom: s.md, minHeight: 32 }} numberOfLines={2}>
                  {(th as any).description || t('shopThemeDesc')}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontSize: 14 }}>🪙</Text>
                    <Text style={{ color: c.gold, fontSize: 15, fontWeight: '900' }}>{th.price}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => onBuyTheme(th)}
                    disabled={isOwned || cantAfford}
                    style={{
                      paddingHorizontal: s.md, paddingVertical: 7,
                      borderRadius: r.pill,
                      backgroundColor: isOwned ? `${c.success}22` : cantAfford ? c.surface700 : c.violet,
                      borderWidth: 1, borderColor: isOwned ? `${c.success}55` : cantAfford ? c.border : c.violet,
                    }}
                  >
                    <Text style={{ color: isOwned ? c.success : cantAfford ? c.textMuted : '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.4 }}>
                      {isOwned ? '✓' : cantAfford ? `${t('shopShort')} ${th.price - coins}` : t('buy')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.lg }}>
          {powerups.map(p => {
            const cantAfford = coins < p.price;
            const badge = badgeFor(p.price);
            return (
              <View
                key={p.id}
                style={{
                  width: 230,
                  padding: s.lg,
                  borderRadius: r.md,
                  backgroundColor: c.surface800,
                  borderWidth: 1, borderColor: c.border,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: s.md }}>
                  <Text style={{ fontSize: 38 }}>{(p as any).icon || '⚡'}</Text>
                  {badge && (
                    <View style={{ paddingHorizontal: s.sm, paddingVertical: 3, borderRadius: r.sm, backgroundColor: `${badge.color}1f`, borderWidth: 1, borderColor: `${badge.color}45` }}>
                      <Text style={{ color: badge.color, ...type.eyebrow }}>{badge.label}</Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: c.textStrong, fontSize: 15, fontWeight: '900', marginBottom: 4 }} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={{ color: c.text, ...type.small, lineHeight: 16, marginBottom: s.md, minHeight: 32 }} numberOfLines={2}>
                  {(p as any).description || t('shopPowerupDesc')}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ color: c.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }}>
                    {t('owned')}: {p.quantity}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontSize: 14 }}>🪙</Text>
                    <Text style={{ color: c.gold, fontSize: 15, fontWeight: '900' }}>{p.price}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => onBuyPowerup(p)}
                    disabled={cantAfford}
                    style={{
                      paddingHorizontal: s.md, paddingVertical: 7,
                      borderRadius: r.pill,
                      backgroundColor: cantAfford ? c.surface700 : c.cyan,
                      borderWidth: 1, borderColor: cantAfford ? c.border : c.cyan,
                    }}
                  >
                    <Text style={{ color: cantAfford ? c.textMuted : '#0a0a1a', fontSize: 11, fontWeight: '900', letterSpacing: 0.4 }}>
                      {cantAfford ? `${t('shopShort')} ${p.price - coins}` : t('buy')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
