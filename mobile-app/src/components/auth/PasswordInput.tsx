import React, { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthInput } from './AuthInput';

interface PasswordInputProps extends Omit<React.ComponentProps<typeof AuthInput>, 'icon' | 'rightElement'> {
  icon?: string;
}

export function PasswordInput({ icon = 'lock-closed-outline', ...props }: PasswordInputProps) {
  const [hidePassword, setHidePassword] = useState(true);

  return (
    <AuthInput
      icon={icon}
      secureTextEntry={hidePassword}
      autoCapitalize="none"
      autoCorrect={false}
      rightElement={
        <Pressable
          onPress={() => setHidePassword(!hidePassword)}
          style={styles.toggle}
          hitSlop={8}
          accessibilityLabel={hidePassword ? "Show password" : "Hide password"}
        >
          <Ionicons
            name={hidePassword ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color="#aaa"
          />
        </Pressable>
      }
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  toggle: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
