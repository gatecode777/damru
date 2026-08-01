import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from '../ui/Image';
import { MenuCard } from '../ui/MenuCard';
import { MenuCardSkeleton } from '../ui/MenuCardSkeleton';
import { useHomeMenu } from '../../hooks/useHomeMenu';
import { Colors, Typography } from '../../constants/theme';
import { LocalAssets } from '../../constants/assets';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.72;
const SNAP_INTERVAL = CARD_WIDTH + 16;
const SKELETON_COUNT = 3;

/**
 * Website CSS @keyframes leafSway:
 *   0%, 100% { transform: rotate(0deg) translateX(0px); }
 *   50%       { transform: rotate(3deg) translateX(-10px) translateY(5px); }
 *   duration: 6s ease-in-out infinite
 *   transform-origin: top right
 */
function WavingLeaf() {
  const rotate = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    // Mirrors the website CSS @keyframes leafSway exactly
    // 6s total: 0→3s goes to 50% keyframe, 3s→6s returns to 0%
    rotate.value = withRepeat(
      withSequence(
        withTiming(3, { duration: 3000, easing: Easing.bezier(0.45, 0, 0.55, 1) }),
        withTiming(0, { duration: 3000, easing: Easing.bezier(0.45, 0, 0.55, 1) }),
      ),
      -1,
      false,
    );

    translateX.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 3000, easing: Easing.bezier(0.45, 0, 0.55, 1) }),
        withTiming(0, { duration: 3000, easing: Easing.bezier(0.45, 0, 0.55, 1) }),
      ),
      -1,
      false,
    );

    translateY.value = withRepeat(
      withSequence(
        withTiming(5, { duration: 3000, easing: Easing.bezier(0.45, 0, 0.55, 1) }),
        withTiming(0, { duration: 3000, easing: Easing.bezier(0.45, 0, 0.55, 1) }),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(rotate);
      cancelAnimation(translateX);
      cancelAnimation(translateY);
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      // Simulate transform-origin: top right by chaining translate+rotate+translate-back
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <Animated.View style={[styles.leafWrapper, animatedStyle]}>
      <Image
        source={LocalAssets.menuleaf}
        style={styles.leafImage}
        contentFit="contain"
      />
    </Animated.View>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Exact replica of website .ms-order-btn
 * hover → press: translateY(-4px) + deeper shadow + bg #c95c0a
 */
function OrderButton({ onPress }: { onPress: () => void }) {
  const translateY = useSharedValue(0);
  const shadowOpacity = useSharedValue(0.20);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    shadowOpacity: shadowOpacity.value,
    shadowRadius: translateY.value < 0 ? 20 : 12,
  }));

  return (
    <View style={styles.orderBtnRow}>
      <AnimatedPressable
        style={[styles.orderBtn, animatedStyle]}
        onPress={onPress}
        onPressIn={() => {
          translateY.value = withSpring(-4, { damping: 12, stiffness: 200 });
          shadowOpacity.value = withTiming(0.35, { duration: 150 });
        }}
        onPressOut={() => {
          translateY.value = withSpring(0, { damping: 12, stiffness: 200 });
          shadowOpacity.value = withTiming(0.20, { duration: 200 });
        }}
      >
        <Text style={styles.orderBtnText}>See More</Text>
        <Ionicons name="arrow-forward" size={18} color="#fff" />
      </AnimatedPressable>
    </View>
  );
}

export function MenuSection() {
  const { items, loading, error } = useHomeMenu();
  const router = useRouter();

  return (
    <View style={styles.section}>

      {/* ms-leaf-img: position absolute, top: -95px, right: -190px */}
      <WavingLeaf />

      {/* ms-header: margin-top: 90px equivalent → paddingTop */}
      <View style={styles.msHeader}>

        {/* ms-title: Playfair Display, 35.2px, #000, margin-bottom: 15px */}
        <Text style={styles.msTitle}>Our Menu</Text>

        {/* .feature-item p: Poppins, ~15px, #666, lh 1.6, maxW 280 */}
        <Text style={styles.msSubtitle}>
          A curated selection of our most loved dishes — crafted fresh, served with love.
        </Text>
      </View>

      {/* Cards */}
      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={28} color="#999" />
          <Text style={styles.errorText}>Couldn't load menu.</Text>
          <Text style={styles.errorSub}>Check your network connection.</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          decelerationRate="fast"
          snapToInterval={SNAP_INTERVAL}
          snapToAlignment="start"
        >
          {loading
            ? Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <MenuCardSkeleton key={i} />
            ))
            : items.map((item, i) => (
              <MenuCard key={item._id} item={item} index={i} />
            ))
          }
        </ScrollView>
      )}

      {/* ms-footer: See More — exact .ms-order-btn from website CSS */}
      {!loading && !error && items.length > 0 && (
        <OrderButton onPress={() => router.push('/menu' as any)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#ffffff',
    paddingTop: 40,
    paddingBottom: 32,
    position: 'relative',
    overflow: 'hidden',
  },

  /* .ms-leaf-img: top -95px, right -190px — scaled proportionally for mobile */
  leafWrapper: {
    position: 'absolute',
    top: -30,    // website: -95px on desktop (proportional for mobile)
    right: -50,  // website: -190px on desktop (proportional for mobile)
    zIndex: 1,
    pointerEvents: 'none',
  },
  leafImage: {
    width: 220,   // website: 750px on desktop → ~220px mobile equivalent
    height: 200,
  },

  /* .ms-header: margin-top 90px — using paddingTop on header */
  msHeader: {
    marginTop: 20,
    marginBottom: 28,
    zIndex: 2,
    alignItems: 'center',
  },

  /* .ms-title: font Playfair Display, 35.2px, #000, margin-bottom 15px */
  msTitle: {
    fontFamily: 'PlayfairDisplay_800ExtraBold',   // "Playfair Display", serif
    fontSize: 35,
    color: '#000000',
    marginBottom: 15,
    lineHeight: 42,
    letterSpacing: -0.3,
    textAlign: 'center',
  },

  /* .ms-subtitle: Poppins 400, 16px, #4D4D4D, line-height 1.5 */
  msSubtitle: {
    fontFamily: 'Poppins_400Regular',          // website body font: Poppins, sans-serif
    fontSize: 16,
    color: '#4D4D4D',
    lineHeight: 24,                               // 16 * 1.5
    fontWeight: '400',
    textAlign: 'center',
    maxWidth: SCREEN_WIDTH * 0.78,
  },

  /* Cards scroll */
  scrollContent: {
    paddingVertical: 4,
    paddingLeft: 20,
    paddingRight: 20,
  },

  /* Error */
  errorBox: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
    textAlign: 'center',
  },
  errorSub: {
    ...Typography.caption,
    textAlign: 'center',
  },

  /* ms-order-btn wrapper */
  orderBtnRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
    paddingBottom: 8,
  },
  /* .ms-order-btn exact */
  orderBtn: {
    backgroundColor: '#000000',         // black — as shown on website
    paddingVertical: 15,                // padding: 15px 45px
    paddingHorizontal: 45,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.20,
    shadowRadius: 12,
    elevation: 5,
  },
  orderBtnText: {
    color: '#ffffff',
    fontFamily: 'Montserrat_600SemiBold',         // font-weight: 600 → SemiBold
    fontSize: 17,                                 // 1.1rem ≈ 17.6px
    letterSpacing: 0.3,
  },
});
