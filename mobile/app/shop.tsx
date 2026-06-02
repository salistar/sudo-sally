// Shop Screen - Feature #25
import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { storage } from '../utils/storage';
import { THEMES, Theme } from '../utils/themes';
import { POWERUPS, PowerUp } from '../utils/powerups';
import { useLang } from '../utils/LanguageContext';
import AppModal, { PopupData } from '../components/AppModal';
import BottomNav from '../components/BottomNav';
import * as Haptics from 'expo-haptics';

const FILE_NAME = '[Shop.tsx]';
const { width } = Dimensions.get('window');

export default function Shop() {
  console.log(`${FILE_NAME} 🏪 Component rendering...`);
  
  const router = useRouter();
  const { t } = useLang();
  const [coins, setCoins] = useState(0);
  const [ownedThemes, setOwnedThemes] = useState<string[]>(['default', 'ocean']);
  const [powerups, setPowerups] = useState(POWERUPS);
  const [tab, setTab] = useState<'themes' | 'powerups'>('themes');
  const [isLoading, setIsLoading] = useState(true);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [popup, setPopup] = useState<PopupData | null>(null);

  console.log(`${FILE_NAME} 📊 Initial state - coins: ${coins}, tab: ${tab}, ownedThemes: ${ownedThemes.length}`);

  useEffect(() => {
    console.log(`${FILE_NAME} 🔄 useEffect triggered - Loading user data...`);
    
    const loadUserData = async () => {
      console.log(`${FILE_NAME} ⏳ Fetching user from storage...`);
      try {
        const user = await storage.getUser();
        console.log(`${FILE_NAME} ✅ User data received:`, user ? `coins: ${user.coins}` : 'No user found');
        setCoins(user?.coins || 0);
        setIsLoading(false);
        
        // Fade in animation
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
        console.log(`${FILE_NAME} 🎬 Fade animation started`);
      } catch (error) {
        console.error(`${FILE_NAME} ❌ Error loading user data:`, error);
        setIsLoading(false);
      }
    };
    
    loadUserData();
  }, []);

  const handleTabChange = useCallback((newTab: 'themes' | 'powerups') => {
    console.log(`${FILE_NAME} 🔀 Tab change requested: ${tab} → ${newTab}`);
    Haptics.selectionAsync();
    setTab(newTab);
  }, [tab]);

  const buyTheme = async (theme: Theme) => {
    console.log(`${FILE_NAME} 🎨 buyTheme called for: ${theme.name} (${theme.id})`);
    console.log(`${FILE_NAME} 💰 Current coins: ${coins}, Theme price: ${theme.price}`);
    
    if (coins < theme.price) {
      const deficit = theme.price - coins;
      console.log(`${FILE_NAME} ⚠️ Insufficient coins! Deficit: ${deficit}`);
      setPopup({ type: 'error', title: t('notEnoughCoins'), message: `${deficit} ${t('needMoreCoins')}` });
      return;
    }
    
    console.log(`${FILE_NAME} ✅ Sufficient coins, proceeding with purchase...`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    try {
      const user = await storage.getUser();
      console.log(`${FILE_NAME} 👤 User retrieved for update:`, user ? 'found' : 'not found');
      
      if (user) {
        const previousCoins = user.coins;
        user.coins -= theme.price;
        console.log(`${FILE_NAME} 💳 Deducting coins: ${previousCoins} - ${theme.price} = ${user.coins}`);
        
        await storage.setUser(user);
        console.log(`${FILE_NAME} 💾 User saved to storage`);
        
        setCoins(user.coins);
        const newOwnedThemes = [...ownedThemes, theme.id];
        setOwnedThemes(newOwnedThemes);
        console.log(`${FILE_NAME} 🎉 Theme purchased! New owned themes:`, newOwnedThemes);
      }
      
      setPopup({ type: 'success', title: t('purchased'), message: `${t('youNowOwn')} ${theme.name}!` });
    } catch (error) {
      console.error(`${FILE_NAME} ❌ Error purchasing theme:`, error);
      setPopup({ type: 'error', title: t('error'), message: t('purchaseFailed') });
    }
  };

  const buyPowerup = async (powerup: PowerUp) => {
    console.log(`${FILE_NAME} ⚡ buyPowerup called for: ${powerup.name} (${powerup.id})`);
    console.log(`${FILE_NAME} 💰 Current coins: ${coins}, Powerup price: ${powerup.price}`);
    console.log(`${FILE_NAME} 📦 Current quantity owned: ${powerup.quantity}`);
    
    if (coins < powerup.price) {
      const deficit = powerup.price - coins;
      console.log(`${FILE_NAME} ⚠️ Insufficient coins! Deficit: ${deficit}`);
      setPopup({ type: 'error', title: t('notEnoughCoins'), message: `${deficit} ${t('needMoreCoins')}` });
      return;
    }
    
    console.log(`${FILE_NAME} ✅ Sufficient coins, proceeding with purchase...`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const user = await storage.getUser();
      console.log(`${FILE_NAME} 👤 User retrieved for update:`, user ? 'found' : 'not found');
      
      if (user) {
        const previousCoins = user.coins;
        user.coins -= powerup.price;
        console.log(`${FILE_NAME} 💳 Deducting coins: ${previousCoins} - ${powerup.price} = ${user.coins}`);
        
        await storage.setUser(user);
        console.log(`${FILE_NAME} 💾 User saved to storage`);
        
        setCoins(user.coins);
      }
      
      const updatedPowerups = powerups.map(p => 
        p.id === powerup.id ? { ...p, quantity: p.quantity + 1 } : p
      );
      setPowerups(updatedPowerups);
      
      const newQuantity = updatedPowerups.find(p => p.id === powerup.id)?.quantity;
      console.log(`${FILE_NAME} 🎉 Powerup purchased! New quantity: ${newQuantity}`);
      
    } catch (error) {
      console.error(`${FILE_NAME} ❌ Error purchasing powerup:`, error);
      setPopup({ type: 'error', title: t('error'), message: t('purchaseFailed') });
    }
  };

  const handleBack = () => {
    console.log(`${FILE_NAME} 🔙 Back button pressed, navigating back...`);
    router.back();
  };

  console.log(`${FILE_NAME} 🖼️ Rendering UI - isLoading: ${isLoading}, tab: ${tab}`);

  return (
    <LinearGradient colors={['#0a0a1a', '#12122a', '#1a1a3a', '#0f0f2a']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <LinearGradient colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']} style={styles.backButtonGradient}>
            <Text style={styles.back}>←</Text>
          </LinearGradient>
        </TouchableOpacity>
        
        <View style={styles.titleContainer}>
          <Text style={styles.titleIcon}>🛒</Text>
          <Text style={styles.title}>{t('shop')}</Text>
        </View>
        
        <LinearGradient colors={['rgba(234,179,8,0.3)', 'rgba(234,179,8,0.1)']} style={styles.coinBadge}>
          <Text style={styles.coinIcon}>🪙</Text>
          <Text style={styles.coinText}>{coins.toLocaleString()}</Text>
        </LinearGradient>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']} style={styles.tabs}>
          <TouchableOpacity 
            style={[styles.tab, tab === 'themes' && styles.tabActive]} 
            onPress={() => handleTabChange('themes')}
            activeOpacity={0.7}
          >
            {tab === 'themes' ? (
              <LinearGradient colors={['#4ade80', '#22c55e']} style={styles.tabGradient}>
                <Text style={styles.tabIcon}>🎨</Text>
                <Text style={styles.tabTextActive}>{t('themes')}</Text>
              </LinearGradient>
            ) : (
              <View style={styles.tabInner}>
                <Text style={styles.tabIcon}>🎨</Text>
                <Text style={styles.tabText}>{t('themes')}</Text>
              </View>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, tab === 'powerups' && styles.tabActive]} 
            onPress={() => handleTabChange('powerups')}
            activeOpacity={0.7}
          >
            {tab === 'powerups' ? (
              <LinearGradient colors={['#4ade80', '#22c55e']} style={styles.tabGradient}>
                <Text style={styles.tabIcon}>⚡</Text>
                <Text style={styles.tabTextActive}>{t('powerups')}</Text>
              </LinearGradient>
            ) : (
              <View style={styles.tabInner}>
                <Text style={styles.tabIcon}>⚡</Text>
                <Text style={styles.tabText}>{t('powerups')}</Text>
              </View>
            )}
          </TouchableOpacity>
        </LinearGradient>
      </View>

      {/* Content */}
      <Animated.View style={[styles.contentWrapper, { opacity: fadeAnim }]}>
        <ScrollView 
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {tab === 'themes' ? (
            <>
              <Text style={styles.sectionTitle}>{t('availableThemes')}</Text>
              <Text style={styles.sectionSubtitle}>{t('customizeExperience')}</Text>
              
              {THEMES.map((theme, index) => {
                console.log(`${FILE_NAME} 🎨 Rendering theme card: ${theme.name} (owned: ${ownedThemes.includes(theme.id)})`);
                const isOwned = ownedThemes.includes(theme.id);
                
                return (
                  <View key={theme.id} style={styles.card}>
                    <LinearGradient 
                      colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']} 
                      style={styles.cardGradient}
                    >
                      <LinearGradient colors={theme.background} style={styles.themePreview}>
                        <View style={styles.previewGrid}>
                          <View style={[styles.previewCell, styles.previewCellLarge, { backgroundColor: theme.primary }]} />
                          <View style={styles.previewColumn}>
                            <View style={[styles.previewCell, styles.previewCellSmall, { backgroundColor: theme.secondary }]} />
                            <View style={[styles.previewCell, styles.previewCellSmall, { backgroundColor: theme.accent }]} />
                          </View>
                        </View>
                      </LinearGradient>
                      
                      <View style={styles.cardInfo}>
                        <Text style={styles.cardName}>{theme.name}</Text>
                        <Text style={styles.cardDesc}>{t('premiumTheme')}</Text>

                        {isOwned ? (
                          <View style={styles.ownedBadge}>
                            <Text style={styles.ownedIcon}>✓</Text>
                            <Text style={styles.ownedText}>{t('owned')}</Text>
                          </View>
                        ) : (
                          <TouchableOpacity 
                            style={styles.buyBtn} 
                            onPress={() => buyTheme(theme)}
                            activeOpacity={0.8}
                          >
                            <LinearGradient 
                              colors={['rgba(234,179,8,0.4)', 'rgba(234,179,8,0.2)']} 
                              style={styles.buyBtnGradient}
                            >
                              <Text style={styles.coinEmoji}>🪙</Text>
                              <Text style={styles.buyText}>{theme.price}</Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        )}
                      </View>
                    </LinearGradient>
                  </View>
                );
              })}
            </>
          ) : (
            <>
              <Text style={styles.sectionTitle}>{t('powerups')}</Text>
              <Text style={styles.sectionSubtitle}>{t('boostGameplay')}</Text>
              
              {powerups.map((p, index) => {
                console.log(`${FILE_NAME} ⚡ Rendering powerup card: ${p.name} (quantity: ${p.quantity})`);
                
                return (
                  <View key={p.id} style={styles.card}>
                    <LinearGradient 
                      colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']} 
                      style={styles.cardGradient}
                    >
                      <View style={styles.powerupIconContainer}>
                        <LinearGradient 
                          colors={['rgba(74,222,128,0.2)', 'rgba(74,222,128,0.05)']} 
                          style={styles.powerupIconBg}
                        >
                          <Text style={styles.powerupIcon}>{p.icon}</Text>
                        </LinearGradient>
                      </View>
                      
                      <View style={styles.cardInfo}>
                        <Text style={styles.cardName}>{p.name}</Text>
                        <Text style={styles.cardDesc}>{p.description}</Text>
                        <View style={styles.quantityBadge}>
                          <Text style={styles.quantityLabel}>{t('owned')}:</Text>
                          <Text style={styles.quantityValue}>{p.quantity}</Text>
                        </View>
                      </View>
                      
                      <TouchableOpacity 
                        style={styles.buyBtn} 
                        onPress={() => buyPowerup(p)}
                        activeOpacity={0.8}
                      >
                        <LinearGradient 
                          colors={['rgba(234,179,8,0.4)', 'rgba(234,179,8,0.2)']} 
                          style={styles.buyBtnGradient}
                        >
                          <Text style={styles.coinEmoji}>🪙</Text>
                          <Text style={styles.buyText}>{p.price}</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </LinearGradient>
                  </View>
                );
              })}
            </>
          )}
          
          {/* Bottom Spacer */}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </Animated.View>

      <AppModal popup={popup} onClose={() => setPopup(null)} buttonLabel={t('gotIt')} />
          <BottomNav active="play" />
      </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  
  // Header
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  backButtonGradient: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  back: { 
    color: '#fff', 
    fontSize: 20,
    fontWeight: '600',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleIcon: {
    fontSize: 28,
  },
  title: { 
    color: '#fff', 
    fontSize: 28, 
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  coinBadge: { 
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(234,179,8,0.3)',
    gap: 6,
  },
  coinIcon: {
    fontSize: 18,
  },
  coinText: { 
    color: '#eab308', 
    fontWeight: '700',
    fontSize: 16,
  },
  
  // Tabs
  tabsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  tabs: { 
    flexDirection: 'row', 
    borderRadius: 16, 
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tab: { 
    flex: 1, 
    borderRadius: 12,
    overflow: 'hidden',
  },
  tabActive: {},
  tabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    borderRadius: 12,
  },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  tabIcon: {
    fontSize: 18,
  },
  tabText: { 
    color: '#64748b', 
    fontWeight: '600',
    fontSize: 15,
  },
  tabTextActive: { 
    color: '#000',
    fontWeight: '700',
    fontSize: 15,
  },
  
  // Content
  contentWrapper: {
    flex: 1,
  },
  content: { 
    paddingHorizontal: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: '#64748b',
    fontSize: 14,
    marginBottom: 20,
  },
  
  // Cards
  card: { 
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardGradient: {
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  
  // Theme Preview
  themePreview: { 
    width: 70, 
    height: 70, 
    borderRadius: 16, 
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewGrid: {
    flexDirection: 'row',
    gap: 4,
  },
  previewColumn: {
    gap: 4,
  },
  previewCell: { 
    borderRadius: 4,
  },
  previewCellLarge: {
    width: 28,
    height: 54,
  },
  previewCellSmall: {
    width: 20,
    height: 25,
  },
  
  // Card Info
  cardInfo: { 
    flex: 1, 
    marginLeft: 16,
  },
  cardName: { 
    color: '#fff', 
    fontSize: 18, 
    fontWeight: '700',
    marginBottom: 4,
  },
  cardDesc: { 
    color: '#64748b', 
    fontSize: 13,
    lineHeight: 18,
  },
  
  // Quantity Badge
  quantityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  quantityLabel: {
    color: '#64748b',
    fontSize: 13,
  },
  quantityValue: { 
    color: '#4ade80', 
    fontSize: 15,
    fontWeight: '700',
  },
  
  // Owned Badge
  ownedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(74,222,128,0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  ownedIcon: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '700',
  },
  ownedText: { 
    color: '#4ade80', 
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Buy Button
  buyBtn: { 
    borderRadius: 16,
    overflow: 'hidden',
  },
  buyBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18, 
    paddingVertical: 12, 
    borderRadius: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(234,179,8,0.3)',
  },
  coinEmoji: {
    fontSize: 16,
  },
  buyText: { 
    color: '#eab308', 
    fontWeight: '700',
    fontSize: 16,
  },
  
  // Powerup Icon
  powerupIconContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  powerupIconBg: {
    width: 70,
    height: 70,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.2)',
  },
  powerupIcon: { 
    fontSize: 36,
  },
  
  // Bottom Spacer
  bottomSpacer: {
    height: 40,
  },
});