import { useEffect } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';

// 1. Continuous Plate Spin (20s linear infinite)
export function useSpinAnimation(durationMs = 20000) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, {
        duration: durationMs,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  return animatedStyle;
}

// 2. Vertical Floating Animation (5s ease-in-out infinite)
export function useFloatAnimation(distance = 10, durationMs = 3000) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(-distance, { duration: durationMs / 2, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: durationMs / 2, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  return animatedStyle;
}

// 3. Leaf Swaying Animation (6s ease-in-out infinite)
export function useSwayAnimation(maxAngle = 12, durationMs = 4000) {
  const angle = useSharedValue(-maxAngle);

  useEffect(() => {
    angle.value = withRepeat(
      withSequence(
        withTiming(maxAngle, { duration: durationMs, easing: Easing.inOut(Easing.ease) }),
        withTiming(-maxAngle, { duration: durationMs, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotateZ: `${angle.value}deg` }],
    };
  });

  return animatedStyle;
}
