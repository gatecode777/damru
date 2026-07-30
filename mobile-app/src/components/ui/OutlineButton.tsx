import React from 'react';
import { StyleSheet, Text, Pressable, ViewStyle, TextStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Layout } from '../../constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface OutlineButtonProps {
  title: string;
  onPress?: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  showArrow?: boolean;
}

export function OutlineButton({ title, onPress, style, textStyle, showArrow = true }: OutlineButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => (scale.value = withSpring(0.95))}
      onPressOut={() => (scale.value = withSpring(1))}
      style={[styles.button, style, animatedStyle]}
    >
      <Text style={[styles.text, textStyle]}>{title}</Text>
      {showArrow && <Ionicons name="arrow-forward" size={16} color={Colors.brand} />}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 46,
    paddingHorizontal: 22,
    borderRadius: Layout.radiusFull,
    borderWidth: 1.5,
    borderColor: Colors.brand,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.brand,
  },
});
