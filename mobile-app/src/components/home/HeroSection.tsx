import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Image } from '../ui/Image';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  cancelAnimation,
  withRepeat,
  withTiming,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { Colors } from '../../constants/theme';
import { LocalAssets } from '../../constants/assets';
import { FoodThumbnailSelector } from './FoodThumbnailSelector';
import { HeroActions } from './HeroActions';
import { useHeroSelection } from '../../hooks/useHeroSelection';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Dynamic Wheel & Dish Sizes
const WHEEL_SIZE = SCREEN_WIDTH * 0.82;
const DISH_SIZE = SCREEN_WIDTH * 0.65;
const RIM_RADIUS = WHEEL_SIZE * 0.42;

export const HeroSection: React.FC = () => {
  const { selectedIndex, selectIndex } = useHeroSelection(4, 5000);

  // Wheel rotation angle matching website main.js: selectedIndex * -90deg
  const rotation = useSharedValue(0);
  const plateRotation = useSharedValue(0);

  useEffect(() => {
    plateRotation.value = 0;
    plateRotation.value = withRepeat(
      withTiming(-1, { duration: 24000, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(plateRotation);
  }, [plateRotation]);

  useEffect(() => {
    rotation.value = withTiming(selectedIndex * -90, {
      duration: 800,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  }, [selectedIndex, rotation]);

  const wheelAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  return (
    <View style={styles.container}>
      {/* Subheading & Main Title */}
      <View style={styles.textContainer}>
        <Text style={styles.subHeading}>Banquet | Restaurant</Text>
        <Text style={styles.mainHeading}>
          Delicious Food &{'\n'}
          Perfect Venue for Every{'\n'}
          Occasion
        </Text>
      </View>

      {/* 4 Circular Food Thumbnails */}
      <FoodThumbnailSelector
        selectedIndex={selectedIndex}
        onSelectIndex={selectIndex}
      />

      {/* CTA Action Buttons */}
      <HeroActions />

      {/* Main Food Showcase Section (100% Unclipped Mobile Layout) */}
      <View style={styles.visualContainer}>
        {/* Animated Rotating Wheel with Orange Circle Background */}
        <Animated.View style={[styles.wheel, wheelAnimatedStyle]}>
          {LocalAssets.plates.map((plateSource, index) => {
            // Position 4 plates on the rim: 9 o'clock (180°), 12 o'clock (270°), 3 o'clock (0°), 6 o'clock (90°)
            const itemAngleDeg = 180 + index * 90;

            return (
              <PlateItem
                key={index}
                plateSource={plateSource}
                itemAngleDeg={itemAngleDeg}
                rotation={rotation}
                plateRotation={plateRotation}
                isActive={selectedIndex === index}
              />
            );
          })}
        </Animated.View>
      </View>
    </View>
  );
}

function PlateItem({
  plateSource,
  itemAngleDeg,
  rotation,
  plateRotation,
  isActive,
}: {
  plateSource: any;
  itemAngleDeg: number;
  rotation: SharedValue<number>;
  plateRotation: SharedValue<number>;
  isActive: boolean;
}) {
  // Counter-rotate plate so food remains right-side up
  const animatedPlateStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { rotate: `${-rotation.value}deg` },
        {
          scale: withTiming(isActive ? 1.05 : 0.9, {
            duration: 400,
          }),
        },
      ],
      opacity: withTiming(isActive ? 1 : 0, {
        duration: 400,
      }),
    };
  });

  const spinningPlateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${plateRotation.value * 360}deg` }],
  }));

  // Calculate rim positions
  const angleRad = (itemAngleDeg * Math.PI) / 180;
  const cx = WHEEL_SIZE / 2;
  const cy = WHEEL_SIZE / 2;

  const x = cx + RIM_RADIUS * Math.cos(angleRad);
  const y = cy + RIM_RADIUS * Math.sin(angleRad);

  return (
    <Animated.View
      style={[
        styles.plateWrapper,
        {
          left: x - DISH_SIZE / 2,
          top: y - DISH_SIZE / 2,
        },
        animatedPlateStyle,
      ]}
    >
      <Animated.View style={[styles.spinningPlate, spinningPlateStyle]}>
        <Image
          source={plateSource}
          style={styles.bowlImage}
          contentFit="contain"
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingTop: 24,
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  subHeading: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textBrown,
    letterSpacing: 1.0,
    marginTop: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  mainHeading: {
    fontSize: 32,
    lineHeight: 38.4,
    color: Colors.darkText,
    textAlign: 'center',
    fontFamily: 'PlayfairDisplay_800ExtraBold',
  },
  visualContainer: {
    width: SCREEN_WIDTH,
    height: WHEEL_SIZE + 10,
    position: 'relative',
    marginTop: 16,
    overflow: 'hidden',
  },
  wheel: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    borderRadius: WHEEL_SIZE / 2,
    backgroundColor: Colors.primaryOrange,
    position: 'absolute',
    left: SCREEN_WIDTH * 0.46,
    top: 5,
    zIndex: 2,
  },
  plateWrapper: {
    position: 'absolute',
    width: DISH_SIZE,
    height: DISH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bowlImage: {
    width: '100%',
    height: '100%',
  },
  spinningPlate: {
    width: '100%',
    height: '100%',
  },
});
