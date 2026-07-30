import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Layout } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.72;
const IMAGE_HEIGHT = CARD_WIDTH * 0.85;

function SkeletonBox({ style }: { style?: object }) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.ease }),
        withTiming(0.4, { duration: 700, easing: Easing.ease }),
      ),
      -1,
      false,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.skeletonBase, style, animatedStyle]} />
  );
}

export function MenuCardSkeleton() {
  return (
    <View style={styles.card}>
      {/* Image placeholder */}
      <SkeletonBox style={styles.image} />

      <View style={styles.body}>
        {/* Tag */}
        <SkeletonBox style={styles.tag} />
        {/* Price */}
        <SkeletonBox style={styles.price} />
        {/* Name line 1 */}
        <SkeletonBox style={styles.nameLine1} />
        {/* Name line 2 */}
        <SkeletonBox style={styles.nameLine2} />
        {/* Desc line 1 */}
        <SkeletonBox style={styles.descLine1} />
        {/* Desc line 2 */}
        <SkeletonBox style={styles.descLine2} />
        {/* Prep time */}
        <View style={styles.metaRow}>
          <SkeletonBox style={styles.prepTime} />
        </View>
        {/* Divider */}
        <View style={styles.divider} />
        {/* Action buttons */}
        <View style={styles.actionsRow}>
          <SkeletonBox style={styles.orderBtn} />
          <SkeletonBox style={styles.addBtn} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: Layout.radius + 4,
    marginRight: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  image: {
    width: '100%',
    height: IMAGE_HEIGHT,
    borderRadius: 0,
  },
  body: {
    padding: 14,
  },
  tag: {
    width: 72,
    height: 22,
    borderRadius: 999,
    marginBottom: 10,
  },
  price: {
    width: 60,
    height: 22,
    borderRadius: 6,
    marginBottom: 8,
  },
  nameLine1: {
    width: '85%',
    height: 17,
    borderRadius: 6,
    marginBottom: 6,
  },
  nameLine2: {
    width: '55%',
    height: 17,
    borderRadius: 6,
    marginBottom: 10,
  },
  descLine1: {
    width: '90%',
    height: 12,
    borderRadius: 4,
    marginBottom: 5,
  },
  descLine2: {
    width: '70%',
    height: 12,
    borderRadius: 4,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  prepTime: {
    width: 80,
    height: 24,
    borderRadius: 999,
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginBottom: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  orderBtn: {
    flex: 1,
    height: 40,
    borderRadius: 999,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  skeletonBase: {
    backgroundColor: '#e8e8e8',
  },
});
