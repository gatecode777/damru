import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { colors } from '@/config';
import {
  IndoChineseProductCard,
  type IndoChineseProduct,
} from './IndoChineseProductCard';

/* ─────────────────────────────────────────────
   Static product data — mirrors the website exactly.
   Images are local require() bundles; names are the
   same hardcoded strings the website uses.
───────────────────────────────────────────── */
const INDO_CHINESE_PRODUCTS: IndoChineseProduct[] = [
  { key: 'IC1', name: 'Paneer in Hot Garlic Sauce', image: require('@/assets/images/IC1.png') },
  { key: 'IC2', name: 'Honey Chilli Potato',        image: require('@/assets/images/IC2.png') },
  { key: 'IC3', name: 'EOK Tossed Waterchestnut',   image: require('@/assets/images/IC3.png') },
  { key: 'IC4', name: 'Mushroom Chilli Dry',         image: require('@/assets/images/IC4.png') },
  { key: 'IC5', name: 'Spring Roll',                 image: require('@/assets/images/IC5.png') },
  { key: 'IC6', name: 'Paneer 65',                   image: require('@/assets/images/IC6.png') },
  { key: 'IC7', name: 'Crispy Corn',                 image: require('@/assets/images/IC7.png') },
  { key: 'IC8', name: 'Paneer Kung Pao',             image: require('@/assets/images/IC8.png') },
  { key: 'IC9', name: 'Schezwan Vegetables in Hot',  image: require('@/assets/images/IC9.png') },
];

const { width: SCREEN_W } = Dimensions.get('window');

/* ─────────────────────────────────────────────
   Animated card wrapper — fades + slides up
   when section mounts (staggered per card).
───────────────────────────────────────────── */
function AnimatedCard({
  product,
  index,
}: {
  product: IndoChineseProduct;
  index: number;
}) {
  const opacity      = useSharedValue(0);
  const translateY   = useSharedValue(24);

  useEffect(() => {
    const delay = index * 80; // 80ms stagger
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) }),
    );
    translateY.value = withDelay(
      delay,
      withTiming(0, { duration: 420, easing: Easing.out(Easing.quad) }),
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <IndoChineseProductCard product={product} index={index} imageRight={index % 2 !== 0} />
    </Animated.View>
  );
}

/* ─────────────────────────────────────────────
   Section header — "Indo Chinese" title +
   orange decorative divider with bowl icon.
   Matches the approved reference image exactly.
───────────────────────────────────────────── */
function SectionHeader() {
  return (
    <View style={styles.headerContainer}>
      {/* Main heading */}
      <Text style={styles.heading}>Indo Chinese</Text>

      {/* Decorative divider: line — 🍜 — line */}
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerIcon}>🍜</Text>
        <View style={styles.dividerLine} />
      </View>
    </View>
  );
}

/* ─────────────────────────────────────────────
   Main section export
───────────────────────────────────────────── */
export function IndoChineseSection() {
  return (
    <View style={styles.section}>
      <SectionHeader />

      {/* Card list — vertically stacked */}
      <View style={styles.cardList}>
        {INDO_CHINESE_PRODUCTS.map((product, i) => (
          <AnimatedCard key={product.key} product={product} index={i} />
        ))}
      </View>
    </View>
  );
}

/* ─────────────────────────────────────────────
   Styles
───────────────────────────────────────────── */
const styles = StyleSheet.create({
  section: {
    backgroundColor: '#ffffff',
    paddingTop: 48,
    paddingBottom: 36,
  },

  /* Header */
  headerContainer: {
    alignItems: 'center',
    marginBottom: 28,
    paddingHorizontal: 24,
  },
  heading: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 36,
    color: '#111111',
    textAlign: 'center',
    marginBottom: 14,
    letterSpacing: -0.3,
    lineHeight: 44,
  },

  /* Decorative divider row */
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: SCREEN_W * 0.55,
  },
  dividerLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: colors.orange,
    borderRadius: 1,
  },
  dividerIcon: {
    fontSize: 18,
    marginHorizontal: 10,
    color: colors.orange,
  },

  /* Card list */
  cardList: {
    paddingTop: 4,
  },
});
