import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { colors } from '@/config';

export interface IndoChineseProduct {
  key: string;
  image: ReturnType<typeof require>;
  name: string;
}

interface Props {
  product: IndoChineseProduct;
  /** 0-based index — used for "01", "02"… badge */
  index: number;
  /** When true the orange image block appears on the RIGHT */
  imageRight?: boolean;
}

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_H        = 170;
const IMAGE_BLOCK_W = 148;
const BORDER_RADIUS = 20;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function IndoChineseProductCard({
  product,
  index,
  imageRight = false,
}: Props) {
  const seqNum = String(index + 1).padStart(2, '0');

  const cardScale  = useSharedValue(1);
  const arrowScale = useSharedValue(1);

  const cardStyle  = useAnimatedStyle(() => ({ transform: [{ scale: cardScale.value }] }));
  const arrowStyle = useAnimatedStyle(() => ({ transform: [{ scale: arrowScale.value }] }));

  const handlePressIn  = () => {
    cardScale.value  = withSpring(0.975, { damping: 18, stiffness: 200 });
    arrowScale.value = withSpring(0.88,  { damping: 18, stiffness: 200 });
  };
  const handlePressOut = () => {
    cardScale.value  = withSpring(1, { damping: 15 });
    arrowScale.value = withSpring(1, { damping: 15 });
  };
  const handlePress    = () => router.navigate('/(tabs)/menu' as any);

  /* ── Orange image block (reused in both layouts) ── */
  const ImageBlock = (
    <View style={styles.imageBlock}>
      <View style={styles.decoCircle1} />
      <View style={styles.decoCircle2} />
      <Image
        source={product.image}
        style={styles.productImage}
        resizeMode="contain"
        accessibilityLabel={product.name}
      />
    </View>
  );

  /* ── White content block (reused in both layouts) ── */
  const ContentBlock = (
    <View style={styles.contentBlock}>
      {/* Number + dotted line */}
      <View style={styles.seqRow}>
        <Text style={styles.seqNum}>{seqNum}</Text>
        <View style={styles.dottedLine} />
      </View>

      {/* Product name */}
      <Text style={styles.productName} numberOfLines={3}>
        {product.name}
      </Text>

      {/* Orange accent */}
      <View style={styles.accentRow}>
        <View style={styles.accentLine} />
        <View style={styles.accentDot} />
      </View>

      {/* Circular arrow */}
      <View style={styles.arrowRow}>
        <Animated.View style={[styles.arrowCircle, arrowStyle]}>
          <Text style={styles.arrowIcon}>→</Text>
        </Animated.View>
      </View>
    </View>
  );

  return (
    <AnimatedPressable
      style={[styles.card, cardStyle]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={`View ${product.name}`}
    >
      {imageRight ? (
        <>
          {ContentBlock}
          {ImageBlock}
        </>
      ) : (
        <>
          {ImageBlock}
          {ContentBlock}
        </>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 18,
    height: CARD_H,
    borderRadius: BORDER_RADIUS,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.09,
    shadowRadius: 14,
    elevation: 5,
  },

  imageBlock: {
    width: IMAGE_BLOCK_W,
    height: CARD_H,
    backgroundColor: '#E67E22',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  decoCircle1: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 18,
    borderColor: 'rgba(255,255,255,0.10)',
    bottom: -30,
    left: -30,
  },
  decoCircle2: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 14,
    borderColor: 'rgba(255,255,255,0.07)',
    top: -20,
    right: -20,
  },
  productImage: {
    width: IMAGE_BLOCK_W - 12,
    height: CARD_H - 12,
  },

  contentBlock: {
    flex: 1,
    paddingTop: 14,
    paddingBottom: 12,
    paddingLeft: 14,
    paddingRight: 10,
    justifyContent: 'flex-start',
  },

  seqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  seqNum: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: colors.orange,
    letterSpacing: 0.5,
    marginRight: 8,
  },
  dottedLine: {
    flex: 1,
    height: 0,
    borderStyle: 'dotted',
    borderBottomWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 1,
  },

  productName: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 18,
    color: '#111111',
    lineHeight: 24,
    marginBottom: 8,
    flex: 1,
  },

  accentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  accentLine: {
    width: 26,
    height: 2.5,
    backgroundColor: colors.orange,
    borderRadius: 2,
    marginRight: 5,
  },
  accentDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.orange,
  },

  arrowRow: {
    alignItems: 'flex-end',
    marginTop: 'auto',
  },
  arrowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowIcon: {
    fontSize: 15,
    color: colors.orange,
    lineHeight: 17,
  },
});
