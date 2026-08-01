/**
 * NavMenu.tsx — Exact website mobile overlay nav
 *
 * Fixes:
 *  1. Status bar overlap → panel paddingTop uses insets.top
 *  2. Close not working  → internal `isRendered` state drives Modal visibility;
 *     animation runs to completion before unmount via setTimeout, no runOnJS race.
 */

import React, { useEffect, useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  ScrollView,
  Modal,
  Linking,
  BackHandler,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/* ─────────────────────────────────────────
   Nav items — exact order & routes from website
────────────────────────────────────────── */
type NavItem = {
  id: string;
  label: string;
  route: string;
  matchFn: (p: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  { id: 'home',    label: 'HOME',            route: '/',           matchFn: p => p === '/'              },
  { id: 'menu',    label: 'MENU',            route: '/menu',       matchFn: p => p === '/menu'          },
  { id: 'about',   label: 'ABOUT US',        route: '/about-us',   matchFn: p => p === '/about-us'      },
  { id: 'contact', label: 'CONTACT US',      route: '/contact-us', matchFn: p => p === '/contact-us'    },
  { id: 'gallery', label: 'GALLERY',         route: '/gallery',    matchFn: p => p === '/gallery'       },
  { id: 'blogs',   label: 'BLOGS',           route: '/blogs',      matchFn: p => p.startsWith('/blogs') },
  { id: 'offers',  label: 'OFFERS',          route: '/offers',     matchFn: p => p === '/offers'        },
  { id: 'banquet', label: 'WEDDING / EVENT', route: '/branches',   matchFn: p => p.startsWith('/branches') },
];
const LOGIN_ITEM = { id: 'login', label: 'LOGIN', route: '/auth' };

/* ─────────────────────────────────────────
   Contact & social data — exact from website
────────────────────────────────────────── */
const CONTACT = {
  phone:   '+91 8690987272',
  email:   'info@damrubynamo.com',
  address: '35 A Mansarover, Jaipur (Rajasthan), 302020',
};
type SocialIcon = { id: string; icon: keyof typeof Ionicons.glyphMap; url: string };
const SOCIALS: SocialIcon[] = [
  { id: 'instagram', icon: 'logo-instagram', url: 'https://www.instagram.com/damrubynamo' },
  { id: 'twitter',   icon: 'logo-twitter',   url: 'https://twitter.com/damrubynamo'       },
  { id: 'facebook',  icon: 'logo-facebook',  url: 'https://www.facebook.com/damrubynamo'  },
  { id: 'youtube',   icon: 'logo-youtube',   url: 'https://www.youtube.com/@damrubynamo'  },
];

/* ─────────────────────────────────────────
   Animation timings
────────────────────────────────────────── */
const SCREEN_WIDTH   = Dimensions.get('window').width;
const OPEN_MS        = 320;
const CLOSE_MS       = 260;

/* ─────────────────────────────────────────
   Props
────────────────────────────────────────── */
interface NavMenuProps {
  visible: boolean;
  onClose: () => void;
}

export function NavMenu({ visible, onClose }: NavMenuProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const insets   = useSafeAreaInsets();

  // Internal rendered state — stays true during close animation
  const [isRendered, setIsRendered] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const translateX = useSharedValue(-SCREEN_WIDTH);

  /* Open */
  const openPanel = useCallback(() => {
    setIsRendered(true);
    // Give Modal one frame to mount, then animate
    requestAnimationFrame(() => {
      translateX.value = withTiming(0, {
        duration: OPEN_MS,
        easing: Easing.out(Easing.cubic),
      });
    });
  }, []);

  /* Close — animate out, THEN notify parent */
  const closePanel = useCallback(() => {
    translateX.value = withTiming(-SCREEN_WIDTH, {
      duration: CLOSE_MS,
      easing: Easing.in(Easing.cubic),
    });
    // After animation completes: unmount & notify parent
    closeTimer.current = setTimeout(() => {
      setIsRendered(false);
      onClose();
    }, CLOSE_MS + 20);
  }, [onClose]);

  // Sync to parent `visible`
  useEffect(() => {
    if (visible) {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      openPanel();
    } else if (isRendered) {
      closePanel();
    }
  }, [visible]);

  // Android back button
  useEffect(() => {
    if (!isRendered) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closePanel();
      return true;
    });
    return () => sub.remove();
  }, [isRendered, closePanel]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Navigate and close
  const navigate = useCallback((route: string) => {
    closePanel();
    setTimeout(() => router.navigate(route as any), CLOSE_MS + 30);
  }, [closePanel, router]);

  if (!isRendered) return null;

  // Modals return 0 for insets.top in some Expo versions.
  // Fall back to StatusBar height on Android (typically 24-40px) or standard iOS notch height (44px)
  const safeTop = insets.top > 0
    ? insets.top
    : (Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 44);

  return (
    <Modal
      visible={isRendered}
      transparent
      animationType="none"
      onRequestClose={closePanel}
      statusBarTranslucent={true}
    >
      {/* Tap-outside backdrop */}
      <Pressable
        style={styles.backdrop}
        onPress={closePanel}
      />

      {/* Slide-in panel */}
      <Animated.View style={[styles.panel, panelStyle]}>

        {/* ── Top bar: contains × button ── */}
        <View style={[styles.topBar, { paddingTop: safeTop + 10 }]}>
          <Pressable
            style={styles.closeBtn}
            onPress={closePanel}
            hitSlop={12}
            accessibilityLabel="Close menu"
            accessibilityRole="button"
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        {/* ── Scrollable nav + contact ── */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 32 },
          ]}
        >
          {/* Nav items */}
          {NAV_ITEMS.map(item => {
            const active = item.matchFn(pathname);
            return (
              <Pressable
                key={item.id}
                style={styles.navRow}
                onPress={() => navigate(item.route)}
                accessibilityRole="menuitem"
                accessibilityLabel={item.label}
              >
                <View style={[styles.dot, active && styles.dotActive]} />
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}


        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

/* ─────────────────────────────────────────
   Styles — exact mobile website CSS
────────────────────────────────────────── */
const styles = StyleSheet.create({
  /* Semi-transparent tap-outside backdrop */
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },

  /*
   * Panel — full-height white slide-in from left
   * Width: 88vw so backdrop is visible on the right
   */
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
    backgroundColor: '#ffffff',
    zIndex: 10,
    paddingHorizontal: Math.round(SCREEN_WIDTH * 0.05),   // 5% horizontal padding
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 24,
  },

  /* ── Top bar (status-bar clearance + close button row) ── */
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },

  /* × button — orange circle, brand color #e67e22 */
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#e67e22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 20,
    color: '#ffffff',
    lineHeight: 22,
    fontWeight: '600',
    marginTop: -1,
  },

  /* Scroll content — no extra top padding needed (topBar handles it) */
  scrollContent: {
    paddingTop: 8,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,         // slightly more than website's 15px for breathing room
    paddingVertical: 2,
  },

  /* .overlay-nav .dot — 5×5 black circle, 12px gap */
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#000000',
    marginRight: 14,
    flexShrink: 0,
  },
  dotActive: {
    backgroundColor: '#e67e22',
  },

  /* .overlay-nav a — Playfair Display, 28px, #000, weight 600 */
  navLabel: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 21,
    color: '#000000',
    lineHeight: 28,
    flexShrink: 1,
  },
  navLabelActive: {
    color: '#e67e22',
  },

  /* ── Contact section ── */
  sectionDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginTop: 8,
    marginBottom: 28,
  },

  contactHeading: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 19,
    color: '#000000',
    marginBottom: 10,
  },
  dottedDivider: {
    borderBottomWidth: 2,
    borderStyle: 'dotted',
    borderColor: 'rgba(0,0,0,0.20)',
    marginBottom: 18,
  },
  contactDetail: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: '#333333',
    lineHeight: 22,
    marginBottom: 4,
  },
  contactEmail: {
    color: '#2a8f8f',
  },
  contactAddress: {
    marginTop: 10,
  },
  socialsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 20,
  },
  socialBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
