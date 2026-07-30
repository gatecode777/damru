import React from 'react';
import { StyleSheet, Text, Pressable, ViewStyle, TextStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Colors, Typography, Layout } from '../../constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PrimaryButtonProps {
  title: string;
  onPress?: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
  dark?: boolean;
}

export function PrimaryButton({ title, onPress, style, textStyle, icon, dark }: PrimaryButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => (scale.value = withSpring(0.95))}
      onPressOut={() => (scale.value = withSpring(1))}
      style={[
        styles.button,
        dark ? styles.darkBg : styles.brandBg,
        style,
        animatedStyle,
      ]}
    >
      <Text style={[Typography.btnText, textStyle]}>{title}</Text>
      {icon}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 46,
    paddingHorizontal: 22,
    borderRadius: Layout.radiusFull,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 3,
    shadowColor: Colors.brandDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  brandBg: {
    backgroundColor: Colors.brand,
  },
  darkBg: {
    backgroundColor: Colors.text,
  },
});
