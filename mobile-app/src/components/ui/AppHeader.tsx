import React from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from './Image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '../../providers/AppProvider';
import { Colors } from '../../constants/theme';
import { StaticAssets } from '../../constants/assets';

interface AppHeaderProps {
  cartCount?: number;
  onSearchPress?: () => void;
  onMenuPress?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ cartCount, onSearchPress, onMenuPress }) => {
  const router = useRouter();
  const { totalItems } = useApp();
  const { height: screenHeight } = useWindowDimensions();

  // Dynamic height calculated according to screen height
  const headerHeight = Math.min(Math.max(screenHeight * 0.075, 58), 80);
  const logoHeight = headerHeight * 0.75;
  const logoWidth = logoHeight * 2.3;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={[styles.container, { height: headerHeight }]}>
        {/* Left: Brand Logo */}
        <Pressable onPress={() => router.push('/')} style={styles.logoRow}>
          <Image
            source={StaticAssets.logo}
            style={{ width: logoWidth, height: logoHeight }}
            contentFit="contain"
          />
        </Pressable>

        {/* Right: Actions */}
        <View style={styles.actionsRow}>
          <Pressable onPress={onSearchPress || (() => router.push('/search'))} style={styles.iconBtn}>
            <Ionicons name="search-outline" size={22} color={Colors.text} />
          </Pressable>

          <Pressable onPress={() => router.push('/cart')} style={styles.iconBtn}>
            <Ionicons name="cart-outline" size={22} color={Colors.text} />
            {((cartCount !== undefined ? cartCount : totalItems) > 0) && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount !== undefined ? cartCount : totalItems}</Text>
              </View>
            )}
          </Pressable>

          <Pressable onPress={onMenuPress || (() => router.push('/profile'))} style={styles.iconBtn}>
            <Ionicons name="menu-outline" size={26} color={Colors.text} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    width: 100,
    height: 100,
    marginRight: 8,
  },
  logoTextCol: {
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.brand,
    letterSpacing: 0.5,
    lineHeight: 20,
  },
  brandSubtitle: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.text2,
    letterSpacing: 1.5,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: Colors.brandDark,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
});
