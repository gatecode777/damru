import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from '../ui/Image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/theme';
import { LocalAssets } from '../../constants/assets';
import { NavMenu } from '../ui/NavMenu';
import { useApp } from '@/providers/AppProvider';
import { avatarUrl } from '@/config';
import { getUnreadCount } from '@/services/notificationsApi';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';

interface HomeHeaderProps {
  onSearchPress?: () => void;
  onProfilePress?: () => void;
}

export function HomeHeader({ onSearchPress, onProfilePress }: HomeHeaderProps) {
  const router = useRouter();
  const { user, totalItems } = useApp();
  const { height: screenHeight } = useWindowDimensions();

  const [menuOpen, setMenuOpen] = useState(false);
  const unreadQuery = useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: getUnreadCount,
    enabled: Boolean(user),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const unreadCount = user ? Math.max(0, unreadQuery.data?.count ?? 0) : 0;

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
          <Pressable onPress={() => router.navigate('/')} style={styles.logoContainer}>
            <Image
              source={LocalAssets.logo}
              style={{ width: logoWidth, height: logoHeight }}
              contentFit="contain"
            />
          </Pressable>

          {/* Right: Actions (Search, Cart & User Avatar) */}
          <View style={styles.rightActions}>
            <Pressable
              onPress={onSearchPress || (() => router.push('/search'))}
              style={styles.iconBtn}
              accessibilityLabel="Search"
            >
              <Ionicons name="search-outline" size={22} color={Colors.darkText} />
            </Pressable>

            {user ? (
              <Pressable
                onPress={() => router.push('/notifications')}
                style={styles.iconBtn}
                accessibilityLabel={`Notifications, ${unreadCount} unread`}
                accessibilityRole="button"
              >
                <Ionicons name="notifications-outline" size={22} color={Colors.darkText} />
                {unreadCount > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => router.push('/cart')}
              style={styles.iconBtn}
              accessibilityLabel={`Cart, ${totalItems} items`}
              accessibilityRole="button"
            >
              <Ionicons name="cart-outline" size={24} color={Colors.darkText} />
              {totalItems > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {totalItems > 99 ? '99+' : totalItems}
                  </Text>
                </View>
              ) : null}
            </Pressable>

            {user ? (
              <Pressable
                onPress={() => router.navigate('/(tabs)/profile')}
                style={styles.avatarBtn}
                accessibilityLabel="Go to Profile"
              >
                {user.avatar ? (
                  <Image
                    source={avatarUrl(user.avatar)}
                    style={styles.avatarImg}
                  />
                ) : (
                  <View style={styles.avatarTextContainer}>
                    <Text style={styles.avatarInitials}>
                      {user.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </Pressable>
            ) : null}
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
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -1,
    right: -1,
    backgroundColor: '#ff6b35', // Damru Orange
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3.5,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 8.5,
    fontWeight: '700',
  },
  avatarBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    marginLeft: 4,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 17,
  },
  avatarTextContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 17,
    backgroundColor: '#e67e22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
