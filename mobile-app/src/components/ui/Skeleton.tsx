import { useEffect } from "react";
import { View, type DimensionValue } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { colors } from "@/config";

/**
 * Shared skeleton block — same pulsing-opacity treatment already used by
 * LoadingSkeleton/MenuProductSkeleton/BranchCardSkeleton, formalized so new
 * screens don't each redefine it. Compose these into content-shaped layouts
 * (a title-width line, an image-sized box, a row of them) rather than one
 * generic rectangle, so the skeleton reads as "this screen" before data
 * arrives.
 */
export function Skeleton({
  width = "100%",
  height = 14,
  radius = 4,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: object;
}) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.ease }),
        withTiming(0.4, { duration: 800, easing: Easing.ease }),
      ),
      -1,
      false,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.line }, animatedStyle, style]}
    />
  );
}

/** A block of skeleton text lines, last one shorter — mimics paragraph shape. */
export function SkeletonLines({
  count = 2,
  lineHeight = 12,
  gap = 6,
  lastWidth = "60%",
  style,
}: {
  count?: number;
  lineHeight?: number;
  gap?: number;
  lastWidth?: DimensionValue;
  style?: object;
}) {
  return (
    <View style={[{ gap }, style]}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={lineHeight} width={i === count - 1 ? lastWidth : "100%"} />
      ))}
    </View>
  );
}
