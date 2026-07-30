import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from './Image';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Colors, Typography, Layout } from '../../constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface FoodCardProps {
  title: string;
  description?: string;
  image: any;
  price?: number;
  onOrderPress?: () => void;
}

export function FoodCard({ title, description, image, price, onOrderPress }: FoodCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPressIn={() => (scale.value = withSpring(0.97))}
      onPressOut={() => (scale.value = withSpring(1))}
      style={[styles.card, animatedStyle]}
    >
      <View style={styles.imageContainer}>
        <Image source={image} style={styles.image} contentFit="cover" />
      </View>
      <View style={styles.content}>
        <Text style={Typography.h3} numberOfLines={1}>
          {title}
        </Text>
        {description ? (
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        ) : null}

        <View style={styles.footerRow}>
          {price !== undefined ? <Text style={styles.price}>₹{price}</Text> : null}
          <Pressable onPress={onOrderPress} style={styles.orderBtn}>
            <Text style={styles.orderBtnText}>ORDER NOW</Text>
          </Pressable>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.radius,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  imageContainer: {
    height: 160,
    width: '100%',
    backgroundColor: Colors.surface2,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  content: {
    padding: 14,
  },
  description: {
    fontSize: 13,
    color: Colors.text2,
    marginTop: 4,
    lineHeight: 18,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.brandDark,
  },
  orderBtn: {
    backgroundColor: Colors.brand,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Layout.radiusFull,
  },
  orderBtnText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
