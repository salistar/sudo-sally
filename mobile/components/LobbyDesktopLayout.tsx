/**
 * LobbyDesktopLayout — /challenges desktop refresh.
 *
 * Two pieces composed into one:
 *   1. A hero banner: "RANKED 1v1 LOBBY" with stats (W-L-WinRate),
 *      online-now pulse and a QUICK MATCH CTA pulling the top online
 *      opponent.
 *   2. A tab strip (Online / Received / Sent / Active / History) styled
 *      with Midnight Atlas tokens — pills with badge counters.
 *   3. A grid of online player cards (4-col) with avatar, name, level,
 *      stars, online dot and a "CHALLENGE" CTA per card.
 *
 * Mounted as a takeover when isDesktopWeb is true; phone falls through
 * to the existing list layout in challenges.tsx.
 */
import { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLang } from '../utils/LanguageContext';
import { useTheme } from '../utils/theme';

type User = {
  _id: string;
  username: string;
  avatar: string;
  level: number;
  stars: number;
};

type Challenge = {
  _id: string;
  challenger: User;
  challenged: User;
  difficulty: string;
  status: string;
  createdAt: string;
};

type TabKey = 'online' | 'received' | 'sent' | 'active' | 'history';

type Props = {
  currentUser: any;
  onlineUsers: User[];
  receivedChallenges: Challenge[];
  sentChallenges: Challenge[];
  activeChallenges: Challenge[];
  history: Challenge[];
  stats: { challengesWon: number; challengesLost: number; winRate: number };
  selectedTab: TabKey;
  onTab: (k: TabKey) => void;
  onChallenge: (user: User) => void;
  onAccept: (challengeId: string) => void;
  onDecline: (challengeId: string) => void;
  onResume: (challengeId: string) => void;
};

export default function LobbyDesktopLayout(p: Props) {
  const { t } = useLang();
  const { c, r, s, type } = useTheme();

  // Pulse loop for the online dot.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);
  const dotScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] });
  const dotOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 0.35] });

  // Quick-match target = first online user that isn't me.
  const meId = String(p.currentUser?._id || p.currentUser?.id || '');
  const quickTarget = p.onlineUsers.find(u => String(u._id) !== meId);

  const totalDuels = p.stats.challengesWon + p.stats.challengesLost;
  const wlRatio = totalDuels > 0 ? p.stats.challengesWon / totalDuels : 0;

  const tabs: Array<{ key: TabKey; icon: string; tKey: any; count: number }> = [
    { key: 'online',   icon: '🟢', tKey: 'online',   count: p.onlineUsers.length },
    { key: 'received', icon: '📩', tKey: 'received', count: p.receivedChallenges.length },
    { key: 'sent',     icon: '📤', tKey: 'sent',     count: p.sentChallenges.length },
    { key: 'active',   icon: '⚔️', tKey: 'active',   count: p.activeChallenges.length },
    { key: 'history',  icon: '📜', tKey: 'history',  count: p.history.length },
  ];

  return (
    <View>
      {/* ── HERO BANNER ─────────────────────────────────────────── */}
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
        <LinearGradient
          colors={c.gradAurora}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2 } as any}
        />
        <LinearGradient
          colors={[c.glow, 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.6 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.45 } as any}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Left: title + sub */}
          <View style={{ flex: 1.4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.sm, marginBottom: s.sm }}>
              <View style={{ paddingHorizontal: s.md, paddingVertical: 4, borderRadius: r.pill, backgroundColor: `${c.violet}22`, borderWidth: 1, borderColor: `${c.violet}45` }}>
                <Text style={{ color: c.violet, ...type.eyebrow }}>{t('rankedTag')}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: s.md, paddingVertical: 4, borderRadius: r.pill, backgroundColor: 'rgba(74,222,128,0.12)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.35)' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.success }}>
                  <Animated.View style={{ position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: c.success, transform: [{ scale: dotScale }], opacity: dotOpacity }} />
                </View>
                <Text style={{ color: c.success, ...type.eyebrow }}>
                  {p.onlineUsers.length} {t('onlineNow')}
                </Text>
              </View>
            </View>
            <Text style={{ color: c.textStrong, fontSize: 32, fontWeight: '900', letterSpacing: -0.6, marginBottom: 4 }}>
              {t('lobbyTitle')}
            </Text>
            <Text style={{ color: c.text, ...type.body, lineHeight: 22, marginBottom: s.lg, maxWidth: 540 }}>
              {t('lobbyHint')}
            </Text>
            {/* Stats inline */}
            <View style={{ flexDirection: 'row', gap: s.x2 }}>
              <View>
                <Text style={{ color: c.text, ...type.eyebrow }}>{t('won')}</Text>
                <Text style={{ color: c.success, fontSize: 22, fontWeight: '900' }}>{p.stats.challengesWon}</Text>
              </View>
              <View>
                <Text style={{ color: c.text, ...type.eyebrow }}>{t('lost')}</Text>
                <Text style={{ color: c.error, fontSize: 22, fontWeight: '900' }}>{p.stats.challengesLost}</Text>
              </View>
              <View>
                <Text style={{ color: c.text, ...type.eyebrow }}>{t('winRate')}</Text>
                <Text style={{ color: c.gold, fontSize: 22, fontWeight: '900' }}>{p.stats.winRate}%</Text>
              </View>
              {/* W/L bar */}
              <View style={{ flex: 1, justifyContent: 'center', maxWidth: 180 }}>
                <Text style={{ color: c.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.8, marginBottom: 4 }}>
                  {t('wlRatio')}
                </Text>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: c.surface700, overflow: 'hidden', flexDirection: 'row' }}>
                  <View style={{ flex: wlRatio, backgroundColor: c.success }} />
                  <View style={{ flex: 1 - wlRatio, backgroundColor: c.error, opacity: 0.6 }} />
                </View>
              </View>
            </View>
          </View>
          {/* Right: quick-match card */}
          {quickTarget && (
            <View
              style={{
                width: 280, padding: s.lg, borderRadius: r.md,
                backgroundColor: c.bgVoid,
                borderWidth: 1, borderColor: `${c.gold}40`,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: c.gold, ...type.eyebrow, marginBottom: s.sm }}>
                {t('quickMatch')}
              </Text>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: c.surface700, alignItems: 'center', justifyContent: 'center', marginBottom: s.sm, borderWidth: 2, borderColor: c.gold }}>
                <Text style={{ fontSize: 28 }}>{quickTarget.avatar}</Text>
              </View>
              <Text style={{ color: c.textStrong, fontSize: 14, fontWeight: '900' }} numberOfLines={1}>
                {quickTarget.username}
              </Text>
              <Text style={{ color: c.textMuted, ...type.small, marginBottom: s.md }}>
                {t('level')} {quickTarget.level} · ⭐ {quickTarget.stars}
              </Text>
              <TouchableOpacity
                onPress={() => p.onChallenge(quickTarget)}
                style={{
                  paddingHorizontal: s.x2, paddingVertical: 10,
                  borderRadius: r.pill,
                  backgroundColor: c.gold,
                }}
              >
                <Text style={{ color: c.bgVoid, fontSize: 13, fontWeight: '900', letterSpacing: 0.4 }}>
                  ⚔️ {t('quickMatchBtn')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* ── TAB STRIP ──────────────────────────────────────────── */}
      <View style={{ flexDirection: 'row', gap: s.sm, marginBottom: s.xl, padding: 6, borderRadius: r.pill, backgroundColor: c.surface800, borderWidth: 1, borderColor: c.border, alignSelf: 'flex-start' }}>
        {tabs.map(tab => {
          const active = p.selectedTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => p.onTab(tab.key)}
              style={{
                paddingHorizontal: s.lg, paddingVertical: 9,
                borderRadius: r.pill,
                backgroundColor: active ? c.violet : 'transparent',
                flexDirection: 'row', alignItems: 'center', gap: 6,
              }}
            >
              <Text style={{ fontSize: 13 }}>{tab.icon}</Text>
              <Text style={{ color: active ? '#fff' : c.text, fontSize: 13, fontWeight: '800', letterSpacing: 0.3 }}>
                {t(tab.tKey)}
              </Text>
              {tab.count > 0 && (
                <View style={{ paddingHorizontal: 7, paddingVertical: 1, borderRadius: 10, backgroundColor: active ? 'rgba(255,255,255,0.18)' : `${c.violet}33`, marginLeft: 2 }}>
                  <Text style={{ color: active ? '#fff' : c.violet, fontSize: 10, fontWeight: '900' }}>{tab.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── CONTENT PER TAB ────────────────────────────────────── */}
      {p.selectedTab === 'online' && (
        <OnlineGrid users={p.onlineUsers} meId={meId} onChallenge={p.onChallenge} />
      )}
      {p.selectedTab === 'received' && (
        <ReceivedList items={p.receivedChallenges} onAccept={p.onAccept} onDecline={p.onDecline} />
      )}
      {p.selectedTab === 'sent' && (
        <SimpleList items={p.sentChallenges} kind="sent" />
      )}
      {p.selectedTab === 'active' && (
        <SimpleList items={p.activeChallenges} kind="active" onResume={p.onResume} />
      )}
      {p.selectedTab === 'history' && (
        <SimpleList items={p.history} kind="history" />
      )}
    </View>
  );
}

function OnlineGrid({ users, meId, onChallenge }: { users: User[]; meId: string; onChallenge: (u: User) => void }) {
  const { t } = useLang();
  const { c, r, s, type } = useTheme();
  const filtered = users.filter(u => String(u._id) !== meId);

  if (filtered.length === 0) {
    return (
      <View style={{ padding: s.x2, borderRadius: r.md, backgroundColor: c.surface800, borderWidth: 1, borderColor: c.border, alignItems: 'center' }}>
        <Text style={{ fontSize: 30, marginBottom: s.sm }}>🌑</Text>
        <Text style={{ color: c.textStrong, fontSize: 15, fontWeight: '900', marginBottom: 4 }}>{t('lobbyEmpty')}</Text>
        <Text style={{ color: c.text, ...type.small, textAlign: 'center' }}>{t('lobbyEmptyHint')}</Text>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.lg }}>
      {filtered.map(u => (
        <View
          key={u._id}
          style={{
            width: 220, padding: s.lg, borderRadius: r.md,
            backgroundColor: c.surface800,
            borderWidth: 1, borderColor: c.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.md, marginBottom: s.md }}>
            <View style={{ position: 'relative' }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.surface700, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 22 }}>{u.avatar}</Text>
              </View>
              <View style={{ position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: c.success, borderWidth: 2, borderColor: c.surface800 }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.textStrong, fontSize: 14, fontWeight: '900' }} numberOfLines={1}>
                {u.username}
              </Text>
              <Text style={{ color: c.textMuted, ...type.small }}>
                {t('level')} {u.level} · ⭐ {u.stars}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => onChallenge(u)}
            style={{
              paddingVertical: 9, borderRadius: r.pill,
              backgroundColor: c.violet,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 }}>
              ⚔️ {t('challenge')}
            </Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

function ReceivedList({ items, onAccept, onDecline }: { items: Challenge[]; onAccept: (id: string) => void; onDecline: (id: string) => void }) {
  const { t } = useLang();
  const { c, r, s, type } = useTheme();
  if (items.length === 0) {
    return (
      <View style={{ padding: s.x2, borderRadius: r.md, backgroundColor: c.surface800, borderWidth: 1, borderColor: c.border, alignItems: 'center' }}>
        <Text style={{ fontSize: 30, marginBottom: s.sm }}>📭</Text>
        <Text style={{ color: c.textStrong, fontSize: 15, fontWeight: '900' }}>{t('receivedEmpty')}</Text>
      </View>
    );
  }
  return (
    <View style={{ gap: s.sm }}>
      {items.map(it => (
        <View
          key={it._id}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: s.md,
            padding: s.lg, borderRadius: r.md,
            backgroundColor: `${c.gold}10`,
            borderWidth: 1, borderColor: `${c.gold}45`,
          }}
        >
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.surface700, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 22 }}>{it.challenger.avatar}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.textStrong, fontSize: 14, fontWeight: '900' }}>{it.challenger.username}</Text>
            <Text style={{ color: c.text, ...type.small }}>
              {t('challengedYouShort')} · {it.difficulty.toUpperCase()}
            </Text>
          </View>
          <TouchableOpacity onPress={() => onAccept(it._id)} style={{ paddingHorizontal: s.lg, paddingVertical: 8, borderRadius: r.pill, backgroundColor: c.success }}>
            <Text style={{ color: c.bgVoid, fontSize: 12, fontWeight: '900', letterSpacing: 0.4 }}>{t('accept')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDecline(it._id)} style={{ paddingHorizontal: s.lg, paddingVertical: 8, borderRadius: r.pill, backgroundColor: 'rgba(239,68,68,0.16)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)' }}>
            <Text style={{ color: c.error, fontSize: 12, fontWeight: '900', letterSpacing: 0.4 }}>{t('decline')}</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

function SimpleList({ items, kind, onResume }: { items: Challenge[]; kind: 'sent' | 'active' | 'history'; onResume?: (id: string) => void }) {
  const { t } = useLang();
  const { c, r, s, type } = useTheme();
  if (items.length === 0) {
    const emptyKey = kind === 'sent' ? 'sentEmpty' : kind === 'active' ? 'activeEmpty' : 'historyEmpty';
    return (
      <View style={{ padding: s.x2, borderRadius: r.md, backgroundColor: c.surface800, borderWidth: 1, borderColor: c.border, alignItems: 'center' }}>
        <Text style={{ fontSize: 30, marginBottom: s.sm }}>📭</Text>
        <Text style={{ color: c.textStrong, fontSize: 15, fontWeight: '900' }}>{t(emptyKey as any)}</Text>
      </View>
    );
  }
  return (
    <View style={{ gap: s.sm }}>
      {items.map(it => {
        const opp = kind === 'sent' ? it.challenged : it.challenger;
        return (
          <View
            key={it._id}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: s.md,
              padding: s.lg, borderRadius: r.md,
              backgroundColor: c.surface800,
              borderWidth: 1, borderColor: c.border,
            }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface700, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18 }}>{opp.avatar}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.textStrong, fontSize: 13, fontWeight: '800' }}>{opp.username}</Text>
              <Text style={{ color: c.textMuted, ...type.small }}>{it.difficulty.toUpperCase()} · {it.status.toUpperCase()}</Text>
            </View>
            {kind === 'active' && onResume && (
              <TouchableOpacity onPress={() => onResume(it._id)} style={{ paddingHorizontal: s.lg, paddingVertical: 8, borderRadius: r.pill, backgroundColor: c.cyan }}>
                <Text style={{ color: c.bgVoid, fontSize: 12, fontWeight: '900' }}>{t('resumeDuel')}</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
}
