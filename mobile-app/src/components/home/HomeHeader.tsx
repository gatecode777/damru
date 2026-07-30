import React, { useState } from 'react';
import { View, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from '../ui/Image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/theme';
import { LocalAssets } from '../../constants/assets';
import { NavMenu } from '../ui/NavMenu';
import { useApp } from '@/providers/AppProvider';

interface HomeHeaderProps {
  onSearchPress?: () => void;
  onProfilePress?: () => void;
}

export function HomeHeader({ onSearchPress, onProfilePress }: HomeHeaderProps) {
  const router = useRouter();
  const { user } = useApp();
  const { height: screenHeight } = useWindowDimensions();

  const [menuOpen, setMenuOpen] = useState(false);

  // Dynamic height calculated according to screen height
  const headerHeight = Math.min(Math.max(screenHeight * 0.075, 58), 80);
  const logoHeight = headerHeight * 0.75;
  const logoWidth = logoHeight * 2.3;

  return (
    <>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={[styles.headerRow, { height: headerHeight }]}>
          {/* Left: Hamburger Menu → opens NavMenu */}
          <Pressable
            onPress={() => setMenuOpen(true)}
            style={styles.iconBtn}
            accessibilityLabel="Open Menu"
            accessibilityRole="button"
          >
            <Ionicons name="menu-outline" size={26} color={Colors.darkText} />
          </Pressable>

          {/* Center-Left: Damru Logo */}
          <Pressable onPress={() => router.push('/')} style={styles.logoContainer}>
            <Image
              source={LocalAssets.logo}
              style={{ width: logoWidth, height: logoHeight }}
              contentFit="contain"
            />
          </Pressable>

          {/* Right: Actions (Search & Profile) */}
          <View style={styles.rightActions}>
            <Pressable
              onPress={onSearchPress || (() => router.push('/menu'))}
              style={styles.iconBtn}
              accessibilityLabel="Search"
            >
              <Ionicons name="search-outline" size={22} color={Colors.darkText} />
            </Pressable>

            <Pressable
              onPress={onProfilePress || (() => {
                if (user) {
                  router.push('/profile');
                } else {
                  router.push('/auth');
                }
              })}
              style={styles.iconBtn}
              accessibilityLabel="Profile"
            >
              <Ionicons name="person-outline" size={22} color={Colors.darkText} />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      {/* Slide-out nav menu — rendered outside SafeAreaView so it covers full screen */}
      <NavMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    zIndex: 100,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  logoContainer: {
    flex: 1,
    paddingLeft: 8,
    justifyContent: 'center',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
