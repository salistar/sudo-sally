// Multiplayer Lobby - Feature #27
import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const FILE_NAME = '📁 [Multiplayer.tsx]';

export default function Multiplayer() {
  console.log(`${FILE_NAME} 🚀 Component mounting...`);
  
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [onlinePlayers, setOnlinePlayers] = useState(1247);
  const [activeTab, setActiveTab] = useState<'quick' | 'friends' | 'ranked'>('quick');
  const [comingSoon, setComingSoon] = useState<string | null>(null);

  console.log(`${FILE_NAME} 📊 Initial state - roomCode: "${roomCode}", searching: ${searching}, activeTab: ${activeTab}`);

  useEffect(() => {
    console.log(`${FILE_NAME} 🔧 useEffect() - Simulating online players count...`);
    
    // Simulate fluctuating online player count
    const interval = setInterval(() => {
      setOnlinePlayers(prev => {
        const change = Math.floor(Math.random() * 20) - 10;
        const newCount = Math.max(1000, prev + change);
        console.log(`${FILE_NAME} 👥 Online players updated: ${newCount}`);
        return newCount;
      });
    }, 5000);
    
    return () => {
      console.log(`${FILE_NAME} 🧹 useEffect() cleanup - Clearing interval`);
      clearInterval(interval);
    };
  }, []);

  const handleBack = useCallback(() => {
    console.log(`${FILE_NAME} 🔙 handleBack() - Navigating back...`);
    router.back();
  }, [router]);

  const handleTabChange = useCallback((tab: 'quick' | 'friends' | 'ranked') => {
    console.log(`${FILE_NAME} 📑 handleTabChange() - Switching to "${tab}" tab`);
    setActiveTab(tab);
  }, []);

  const handleRoomCodeChange = useCallback((text: string) => {
    const formatted = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
    console.log(`${FILE_NAME} ✏️ handleRoomCodeChange() - Code: "${formatted}" (length: ${formatted.length})`);
    setRoomCode(formatted);
  }, []);

  const createRoom = useCallback(async () => {
    console.log(`${FILE_NAME} 🏠 createRoom() - Creating new room...`);
    
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      console.log(`${FILE_NAME} 📳 createRoom() - Haptic feedback triggered`);
    } catch (error) {
      console.log(`${FILE_NAME} ⚠️ createRoom() - Haptics not available`);
    }
    
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    console.log(`${FILE_NAME} 🔑 createRoom() - Generated room code: ${code}`);
    
    Alert.alert('🎉 Room Created!', `Share this code with friends:\n\n${code}`, [
      { 
        text: 'Copy & Start', 
        onPress: () => {
          console.log(`${FILE_NAME} 📋 createRoom() - User copied code`);
          setComingSoon('Le mode multijoueur en ligne arrive dans la prochaine mise à jour !');
        }
      }
    ]);
  }, []);

  const joinRoom = useCallback(() => {
    console.log(`${FILE_NAME} 🚪 joinRoom() - Attempting to join room with code: "${roomCode}"`);
    
    if (roomCode.length !== 6) {
      console.log(`${FILE_NAME} ⚠️ joinRoom() - Invalid code length: ${roomCode.length}`);
      Alert.alert('Invalid Code', 'Room code must be 6 characters');
      return;
    }
    
    console.log(`${FILE_NAME} ✅ joinRoom() - Code valid, attempting to join...`);
    setComingSoon('Le mode multijoueur en ligne arrive dans la prochaine mise à jour !');
  }, [roomCode]);

  const quickMatch = useCallback(async () => {
    console.log(`${FILE_NAME} ⚡ quickMatch() - Starting matchmaking...`);
    
    setSearching(true);
    console.log(`${FILE_NAME} 🔍 quickMatch() - Searching state: true`);
    
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      console.log(`${FILE_NAME} 📳 quickMatch() - Haptic feedback triggered`);
    } catch (error) {
      console.log(`${FILE_NAME} ⚠️ quickMatch() - Haptics not available`);
    }
    
    console.log(`${FILE_NAME} ⏳ quickMatch() - Simulating matchmaking (2s)...`);
    setTimeout(() => {
      setSearching(false);
      console.log(`${FILE_NAME} 🔍 quickMatch() - Searching state: false`);
      console.log(`${FILE_NAME} ❌ quickMatch() - No match found (feature not available)`);
      setComingSoon('Le matchmaking en ligne arrive dans la prochaine mise à jour !');
    }, 2000);
  }, []);

  const cancelSearch = useCallback(() => {
    console.log(`${FILE_NAME} 🛑 cancelSearch() - Cancelling matchmaking...`);
    setSearching(false);
  }, []);

  console.log(`${FILE_NAME} 🖼️ Rendering main component...`);

  return (
    <LinearGradient colors={['#0a0a1a', '#1a1a3a', '#0f0f2a']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <LinearGradient
            colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
            style={styles.backButtonGradient}
          >
            <Text style={styles.backIcon}>←</Text>
          </LinearGradient>
        </TouchableOpacity>
        
        <View style={styles.titleContainer}>
          <Text style={styles.titleIcon}>👥</Text>
          <Text style={styles.title}>Multiplayer</Text>
        </View>
        
        <View style={styles.onlineIndicator}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>{onlinePlayers.toLocaleString()}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {([
          { key: 'quick', icon: '⚡', label: 'Quick' },
          { key: 'friends', icon: '👫', label: 'Friends' },
          { key: 'ranked', icon: '🏆', label: 'Ranked' },
        ] as const).map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => handleTabChange(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Match Card */}
        <View style={styles.modeCard}>
          <LinearGradient
            colors={['rgba(74,222,128,0.12)', 'rgba(74,222,128,0.04)']}
            style={styles.modeGradient}
          >
            <View style={styles.modeIconContainer}>
              <Text style={styles.modeIcon}>⚡</Text>
              <View style={styles.modeIconGlow} />
            </View>
            
            <Text style={styles.modeTitle}>Quick Match</Text>
            <Text style={styles.modeDesc}>Find an opponent instantly and compete in real-time</Text>
            
            <View style={styles.modeStats}>
              <View style={styles.modeStat}>
                <Text style={styles.modeStatValue}>~30s</Text>
                <Text style={styles.modeStatLabel}>Avg. Wait</Text>
              </View>
              <View style={styles.modeStatDivider} />
              <View style={styles.modeStat}>
                <Text style={styles.modeStatValue}>{onlinePlayers}</Text>
                <Text style={styles.modeStatLabel}>Online</Text>
              </View>
            </View>
            
            {searching ? (
              <View style={styles.searchingContainer}>
                <LinearGradient
                  colors={['#f59e0b', '#d97706']}
                  style={styles.searchingGradient}
                >
                  <Text style={styles.searchingDots}>● ● ●</Text>
                  <Text style={styles.searchingText}>Searching for opponent...</Text>
                </LinearGradient>
                <TouchableOpacity style={styles.cancelButton} onPress={cancelSearch}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.modeBtn} onPress={quickMatch} activeOpacity={0.9}>
                <LinearGradient
                  colors={['#4ade80', '#22c55e']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.modeBtnGradient}
                >
                  <Text style={styles.modeBtnIcon}>🎮</Text>
                  <Text style={styles.modeBtnText}>Find Opponent</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </LinearGradient>
        </View>

        {/* Create Room Card */}
        <View style={styles.modeCard}>
          <LinearGradient
            colors={['rgba(139,92,246,0.12)', 'rgba(139,92,246,0.04)']}
            style={styles.modeGradient}
          >
            <View style={[styles.modeIconContainer, styles.modeIconPurple]}>
              <Text style={styles.modeIcon}>🏠</Text>
            </View>
            
            <Text style={styles.modeTitle}>Create Room</Text>
            <Text style={styles.modeDesc}>Start a private game and invite your friends</Text>
            
            <View style={styles.roomFeatures}>
              <View style={styles.roomFeature}>
                <Text style={styles.roomFeatureIcon}>🔒</Text>
                <Text style={styles.roomFeatureText}>Private</Text>
              </View>
              <View style={styles.roomFeature}>
                <Text style={styles.roomFeatureIcon}>👥</Text>
                <Text style={styles.roomFeatureText}>2-4 Players</Text>
              </View>
              <View style={styles.roomFeature}>
                <Text style={styles.roomFeatureIcon}>⚙️</Text>
                <Text style={styles.roomFeatureText}>Custom Rules</Text>
              </View>
            </View>
            
            <TouchableOpacity style={styles.modeBtn} onPress={createRoom} activeOpacity={0.9}>
              <LinearGradient
                colors={['#8b5cf6', '#7c3aed']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.modeBtnGradient}
              >
                <Text style={styles.modeBtnIcon}>➕</Text>
                <Text style={styles.modeBtnText}>Create Room</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {/* Join Room Card */}
        <View style={styles.modeCard}>
          <LinearGradient
            colors={['rgba(59,130,246,0.12)', 'rgba(59,130,246,0.04)']}
            style={styles.modeGradient}
          >
            <View style={[styles.modeIconContainer, styles.modeIconBlue]}>
              <Text style={styles.modeIcon}>🚪</Text>
            </View>
            
            <Text style={styles.modeTitle}>Join Room</Text>
            <Text style={styles.modeDesc}>Enter a room code to join your friends</Text>
            
            <View style={styles.codeInputContainer}>
              <Text style={styles.codeInputLabel}>ROOM CODE</Text>
              <View style={styles.codeInputWrapper}>
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <View 
                    key={index} 
                    style={[
                      styles.codeBox,
                      roomCode[index] && styles.codeBoxFilled,
                    ]}
                  >
                    <Text style={[
                      styles.codeBoxText,
                      roomCode[index] && styles.codeBoxTextFilled,
                    ]}>
                      {roomCode[index] || '•'}
                    </Text>
                  </View>
                ))}
              </View>
              <TextInput
                style={styles.hiddenInput}
                value={roomCode}
                onChangeText={handleRoomCodeChange}
                maxLength={6}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>
            
            <TouchableOpacity 
              style={[styles.modeBtn, roomCode.length !== 6 && styles.modeBtnDisabled]} 
              onPress={joinRoom} 
              activeOpacity={0.9}
              disabled={roomCode.length !== 6}
            >
              <LinearGradient
                colors={roomCode.length === 6 ? ['#3b82f6', '#2563eb'] : ['#475569', '#334155']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.modeBtnGradient}
              >
                <Text style={styles.modeBtnIcon}>🎯</Text>
                <Text style={[styles.modeBtnText, roomCode.length !== 6 && styles.modeBtnTextDisabled]}>
                  Join Room
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {/* Coming Soon Banner */}
        <View style={styles.comingSoon}>
          <LinearGradient
            colors={['rgba(251,191,36,0.15)', 'rgba(251,191,36,0.05)']}
            style={styles.comingSoonGradient}
          >
            <View style={styles.comingSoonContent}>
              <Text style={styles.comingSoonIcon}>🚧</Text>
              <View style={styles.comingSoonText}>
                <Text style={styles.comingSoonTitle}>Coming Soon!</Text>
                <Text style={styles.comingSoonDesc}>
                  Multiplayer features will be available in V3.1
                </Text>
              </View>
            </View>
            <View style={styles.comingSoonFeatures}>
              <Text style={styles.comingSoonFeature}>✓ Real-time battles</Text>
              <Text style={styles.comingSoonFeature}>✓ Global rankings</Text>
              <Text style={styles.comingSoonFeature}>✓ Voice chat</Text>
            </View>
          </LinearGradient>
        </View>

        {/* Bottom spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Coming Soon Modal */}
      <Modal visible={!!comingSoon} transparent animationType="fade" onRequestClose={() => setComingSoon(null)}>
        <View style={styles.csOverlay}>
          <View style={styles.csContainer}>
            <LinearGradient colors={['#241b3d', '#1a1430']} style={styles.csCard}>
              <View style={styles.csBadge}>
                <Text style={styles.csEmoji}>🚀</Text>
              </View>
              <Text style={styles.csTitle}>Bientôt disponible</Text>
              <View style={styles.csTag}>
                <Text style={styles.csTagText}>V3.1</Text>
              </View>
              <Text style={styles.csMessage}>{comingSoon}</Text>
              <TouchableOpacity style={styles.csButton} onPress={() => setComingSoon(null)} activeOpacity={0.9}>
                <LinearGradient colors={['#a78bfa', '#8b5cf6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.csButtonGrad}>
                  <Text style={styles.csButtonText}>J'ai compris</Text>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },

  // Coming Soon modal
  csOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  csContainer: {
    width: '100%',
    maxWidth: 360,
  },
  csCard: {
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.5)',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 18,
  },
  csBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(167,139,250,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  csEmoji: {
    fontSize: 46,
  },
  csTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.5,
  },
  csTag: {
    marginTop: 8,
    backgroundColor: 'rgba(167,139,250,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  csTagText: {
    color: '#c4b5fd',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  csMessage: {
    color: '#cbd5e1',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 16,
    marginBottom: 24,
  },
  csButton: {
    alignSelf: 'stretch',
    borderRadius: 16,
    overflow: 'hidden',
  },
  csButtonGrad: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  csButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  
  // Header
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
  },
  backButtonGradient: {
    flex: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  backIcon: { 
    color: '#94a3b8', 
    fontSize: 20,
    fontWeight: '600',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleIcon: {
    fontSize: 24,
  },
  title: { 
    color: '#fff', 
    fontSize: 20, 
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  onlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74,222,128,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ade80',
  },
  onlineText: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '700',
  },
  
  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  tabActive: {
    backgroundColor: 'rgba(74,222,128,0.2)',
  },
  tabIcon: {
    fontSize: 16,
  },
  tabText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#4ade80',
  },
  
  // Content
  content: { 
    paddingHorizontal: 20,
    gap: 16,
  },
  
  // Mode Card
  modeCard: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  modeGradient: { 
    padding: 24, 
    borderRadius: 24, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  modeIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(74,222,128,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  modeIconPurple: {
    backgroundColor: 'rgba(139,92,246,0.15)',
  },
  modeIconBlue: {
    backgroundColor: 'rgba(59,130,246,0.15)',
  },
  modeIconGlow: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(74,222,128,0.2)',
  },
  modeIcon: { 
    fontSize: 36,
  },
  modeTitle: { 
    color: '#fff', 
    fontSize: 22, 
    fontWeight: '700',
    marginBottom: 8,
  },
  modeDesc: { 
    color: '#94a3b8', 
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  
  // Mode Stats
  modeStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    width: '100%',
    justifyContent: 'center',
  },
  modeStat: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modeStatValue: {
    color: '#4ade80',
    fontSize: 20,
    fontWeight: '700',
  },
  modeStatLabel: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
  },
  modeStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  
  // Room Features
  roomFeatures: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  roomFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139,92,246,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  roomFeatureIcon: {
    fontSize: 14,
  },
  roomFeatureText: {
    color: '#a78bfa',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Mode Button
  modeBtn: { 
    borderRadius: 16, 
    overflow: 'hidden',
    width: '100%',
  },
  modeBtnDisabled: {
    opacity: 0.6,
  },
  modeBtnGradient: {
    flexDirection: 'row',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  modeBtnIcon: {
    fontSize: 20,
  },
  modeBtnText: { 
    color: '#000', 
    fontWeight: '700',
    fontSize: 16,
  },
  modeBtnTextDisabled: {
    color: '#94a3b8',
  },
  
  // Searching
  searchingContainer: {
    width: '100%',
    gap: 12,
  },
  searchingGradient: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  searchingDots: {
    color: '#000',
    fontSize: 12,
    letterSpacing: 4,
  },
  searchingText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Code Input
  codeInputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  codeInputLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 12,
  },
  codeInputWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  codeBox: {
    width: 44,
    height: 56,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  codeBoxFilled: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59,130,246,0.1)',
  },
  codeBoxText: {
    color: '#475569',
    fontSize: 24,
    fontWeight: '700',
  },
  codeBoxTextFilled: {
    color: '#3b82f6',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: '100%',
    height: 56,
  },
  
  // Coming Soon
  comingSoon: { 
    borderRadius: 20,
    overflow: 'hidden',
  },
  comingSoonGradient: {
    padding: 20, 
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
  },
  comingSoonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  comingSoonIcon: {
    fontSize: 32,
  },
  comingSoonText: {
    flex: 1,
  },
  comingSoonTitle: {
    color: '#fbbf24',
    fontSize: 18,
    fontWeight: '700',
  },
  comingSoonDesc: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
  },
  comingSoonFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  comingSoonFeature: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '500',
  },
});