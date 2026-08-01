import React, { useEffect } from "react";
import { StyleProp, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

const AnimatedIonicons = Animated.createAnimatedComponent(Ionicons);

interface AnimatedIconProps {
  name: string;
  size: number;
  color: string;
  active?: boolean;
  type?: "spring" | "pulse" | "spin" | "float" | "none";
  style?: StyleProp<ViewStyle>;
}

export function AnimatedIcon({
  name,
  size,
  color,
  active = false,
  type = "spring",
  style,
}: AnimatedIconProps) {
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const floatOffset = useSharedValue(0);

  useEffect(() => {
    if (type === "spring") {
      scale.value = withSequence(
        withSpring(active ? 1.25 : 0.9, { damping: 10, stiffness: 200 }),
        withSpring(active ? 1.15 : 1.0, { damping: 12, stiffness: 150 })
      );
    } else if (type === "pulse") {
      scale.value = withRepeat(
        withTiming(1.15, { duration: 1000, easing: Easing.ease }),
        -1,
        true
      );
    } else if (type === "spin") {
      rotation.value = withRepeat(
        withTiming(360, { duration: 2500, easing: Easing.linear }),
        -1,
        false
      );
    } else if (type === "float") {
      floatOffset.value = withRepeat(
        withTiming(-4, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    }
  }, [active, type]);

  const animatedStyle = useAnimatedStyle(() => {
    const transforms: any[] = [];

    if (type === "spring" || type === "pulse") {
      transforms.push({ scale: scale.value });
    }
    if (type === "spin") {
      transforms.push({ rotate: `${rotation.value}deg` });
    }
    if (type === "float") {
      transforms.push({ translateY: floatOffset.value });
    }

    return {
      transform: transforms,
    };
  });

  return (
    <AnimatedIonicons
      name={name as any}
      size={size}
      color={color}
      style={[style as any, animatedStyle]}
    />
  );
}
