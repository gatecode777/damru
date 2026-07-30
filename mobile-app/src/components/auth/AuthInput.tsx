import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Text, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AuthInputProps extends TextInputProps {
  icon: keyof typeof Ionicons.glyphMap | string;
  error?: string;
  rightElement?: React.ReactNode;
}

export function AuthInput({ icon, error, rightElement, style, ...props }: AuthInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.field,
          isFocused && styles.fieldFocused,
          error ? styles.fieldError : null,
        ]}
      >
        <Ionicons
          name={icon as any}
          size={20}
          color={error ? '#dc2626' : isFocused ? '#e67e22' : '#aaa'}
          style={styles.icon}
        />
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor="#bbb"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        {rightElement}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 14,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: '#fafafa',
    height: 52,
  },
  fieldFocused: {
    borderColor: '#e67e22',
    backgroundColor: '#fff',
  },
  fieldError: {
    borderColor: '#dc2626',
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    color: '#111',
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
    padding: 0,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    marginTop: 4,
    marginLeft: 4,
  },
});
