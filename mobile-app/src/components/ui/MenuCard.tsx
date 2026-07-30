import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image } from './Image';
import { Colors, Layout } from '../../constants/theme';
import { assetUrl } from '../../config';
import { LocalAssets } from '../../constants/assets';
import type { HomeMenuItem } from '../../hooks/useHomeMenu';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.72;
const IMAGE_HEIGHT = Math.round(CARD_WIDTH * 1.0);   // taller crop area

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface MenuCardProps {
  item: HomeMenuItem;
  index?: number;
}

export function MenuCard({ item, index = 0 }: MenuCardProps) {
  const router = useRouter();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    router.push('/menu' as any);
  }, [router]);

  const imageUri = item.image
    ? assetUrl('menu-items', item.image)
    : undefined;

  // Fallback to local shake images (same as website homepage)
  const fallbackImage = LocalAssets.shakes[index % LocalAssets.shakes.length];

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={() => (scale.value = withSpring(0.97))}
      onPressOut={() => (scale.value = withSpring(1))}
      style={[styles.card, animatedStyle]}
    >
      {/* — Food Image — */}
      <View style={styles.imageBox}>
        <Image
          source={imageUri ? { uri: imageUri } : fallbackImage}
          style={styles.image}
          contentFit="cover"
        />

        {/* Heart Wishlist Button */}
        <View style={styles.heartBtn}>
          <Ionicons name="heart-outline" size={18} color={Colors.brand} />
        </View>

        {/* Veg / Non-Veg Badge */}
        <View style={[styles.vegBadge, item.isVeg ? styles.vegGreen : styles.nonVeg]}>
          <View style={[styles.vegDot, item.isVeg ? styles.vegDotGreen : styles.nonVegDot]} />
        </View>
      </View>

      {/* — Card Body — */}
      <View style={styles.body}>
        {/* Category Tag */}
        <View style={styles.tagRow}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>Beverage</Text>
          </View>
        </View>

        {/* Price */}
        <Text style={styles.price}>₹{item.basePrice}</Text>

        {/* Name */}
        <Text style={styles.name} numberOfLines={2}>{item.name}</Text>

        {/* Description */}
        <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>

        {/* Prep Time + Divider */}
        <View style={styles.metaRow}>
          <View style={styles.prepTime}>
            <Ionicons name="time-outline" size={13} color={Colors.text3} />
            <Text style={styles.prepText}>10–15 min</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Actions Row */}
        <View style={styles.actionsRow}>
          {/* Order Now button */}
          <Pressable style={styles.orderBtn} onPress={handlePress}>
            <Ionicons name="restaurant" size={14} color={Colors.white} />
            <Text style={styles.orderBtnText}>Order Now</Text>
          </Pressable>

          {/* Add (+) button */}
          <Pressable style={styles.addBtn} onPress={handlePress}>
            <Ionicons name="add" size={20} color={Colors.brand} />
          </Pressable>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.white,
    borderRadius: Layout.radius + 4,
    marginRight: 16,
    overflow: 'hidden',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },

  /* ── Image ── */
  imageBox: {
    width: '100%',
    height: IMAGE_HEIGHT,
    backgroundColor: '#f5f0eb',
    position: 'relative',
    overflow: 'hidden',
  },
  /* object-position: top — image positioned from top so dish head is always visible */
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    height: IMAGE_HEIGHT * 1.25,   // extra height so cover crop doesn't cut the top
  },
  heartBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  vegBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 18,
    height: 18,
    borderRadius: 3,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vegGreen: { borderColor: '#198754' },
  nonVeg: { borderColor: '#c0392b' },
  vegDot: { width: 8, height: 8, borderRadius: 4 },
  vegDotGreen: { backgroundColor: '#198754' },
  nonVegDot: { backgroundColor: '#c0392b' },

  /* ── Body ── */
  body: {
    padding: 14,
  },
  tagRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  tag: {
    backgroundColor: '#fff3e0',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Layout.radiusFull,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.brand,
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.brand,
    marginBottom: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.darkText,
    lineHeight: 21,
    marginBottom: 4,
  },
  desc: {
    fontSize: 12,
    color: '#888',
    lineHeight: 17,
    marginBottom: 8,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  prepTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Layout.radiusFull,
  },
  prepText: {
    fontSize: 11,
    color: Colors.text3,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginBottom: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  orderBtn: {
    flex: 1,
    height: 40,
    backgroundColor: Colors.brand,
    borderRadius: Layout.radiusFull,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  orderBtnText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
