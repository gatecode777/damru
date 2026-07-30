import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from './Image';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/theme';
import { LocalAssets } from '../../constants/assets';

export interface FoodCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: any;
  icon?: any;
  targetRoute: string;
  chefImage?: any;
  chefPosition?: 'left' | 'right';
  height?: number;
}

interface FoodCategoryCardProps {
  category: FoodCategory;
  onPress?: () => void;
  isRevealed?: boolean;
  onToggle?: () => void;
}

export const FoodCategoryCard: React.FC<FoodCategoryCardProps> = ({
  category,
  onPress,
  isRevealed: controlledIsRevealed,
  onToggle,
}) => {
  const router = useRouter();
  const [internalIsRevealed, setInternalIsRevealed] = useState(false);
  const opacityVal = useSharedValue(0);

  const isRevealed = controlledIsRevealed !== undefined ? controlledIsRevealed : internalIsRevealed;

  useEffect(() => {
    opacityVal.value = withTiming(isRevealed ? 1 : 0, {
      duration: 350,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  }, [isRevealed]);

  const overlayAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacityVal.value,
    };
  });

  const handleCardTap = (e?: any) => {
    e?.stopPropagation?.();
    if (onToggle) {
      onToggle();
    } else {
      setInternalIsRevealed((prev) => !prev);
    }
  };

  const handleExploreTap = (e: any) => {
    e?.stopPropagation?.();
    if (onPress) {
      onPress();
    } else if (category.targetRoute) {
      router.push(category.targetRoute as any);
    }
  };

  const cardHeight = category.height || 220;
  const chefHeight = cardHeight * 0.58;
  const chefWidth = chefHeight * (85 / 130);
  const isChefLeft = category.chefPosition === 'left';

  return (
    <Pressable onPress={handleCardTap} style={[styles.card, category.height ? { height: category.height } : null]}>
      {/* Base Food Background Image */}
      <Image
        source={category.image}
        style={styles.baseImage}
        contentFit="cover"
      />

      {/* Dark Overlay with Category Content */}
      <Animated.View
        style={[styles.overlay, overlayAnimatedStyle, { flexDirection: isChefLeft ? 'row-reverse' : 'row' }]}
        pointerEvents={isRevealed ? 'auto' : 'none'}
      >
        <Pressable
          onPress={handleCardTap}
          style={[
            styles.textContent,
            isChefLeft ? { paddingLeft: 80, paddingRight: 0 } : { paddingRight: 80, paddingLeft: 0 }
          ]}
        >
          {/* Category Icon */}
          {category.icon ? (
            <Image
              source={category.icon}
              style={styles.iconImage}
              contentFit="contain"
            />
          ) : null}

          {/* Category Name */}
          <Text style={styles.title} numberOfLines={2}>
            {category.name}
          </Text>

          {/* Category Tags / Description */}
          <Text style={styles.description} numberOfLines={2}>
            {category.description}
          </Text>

          {/* Explore CTA */}
          <Pressable onPress={handleExploreTap} hitSlop={10}>
            <Text style={styles.exploreBtn}>Tap to Explore →</Text>
          </Pressable>
        </Pressable>

        {/* Chef Illustration Peeking */}
        <Image
          source={category.chefImage || LocalAssets.chef}
          style={[
            styles.chefImage,
            isChefLeft ? { left: -15, right: undefined } : { right: -15, left: undefined },
            { width: chefWidth, height: chefHeight }
          ]}
          contentFit="contain"
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: Colors.surface2,
    marginVertical: 12,
  },
  baseImage: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  textContent: {
    flex: 1,
    paddingRight: 80, // Reserves 80px space on the right so text NEVER gets overlapped by chef!
    justifyContent: 'center',
    height: '100%',
  },
  iconImage: {
    width: 36,
    height: 36,
    marginBottom: 6,
  },
  title: {
    fontFamily: 'serif',
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    lineHeight: 26,
  },
  description: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 10,
    lineHeight: 18,
  },
  exploreBtn: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FBD404',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  chefImage: {
    position: 'absolute',
    right: -15,
    bottom: -2,
    width: 85,
    height: 130,
    pointerEvents: 'none',
  },
});
