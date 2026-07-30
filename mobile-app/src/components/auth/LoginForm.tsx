import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { AuthInput } from './AuthInput';
import { PasswordInput } from './PasswordInput';

interface LoginFormProps {
  onSubmit: (email: string, pass: string) => void;
  onSwitchToRegister: () => void;
  onForgotPassword: () => void;
  busy: boolean;
  error?: string;
}

export function LoginForm({ onSubmit, onSwitchToRegister, onForgotPassword, busy, error }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localErrors, setLocalErrors] = useState<{ email?: string; password?: string }>({});

  const handleLoginSubmit = () => {
    const errors: typeof localErrors = {};
    if (!email) {
      errors.email = 'Please fill all fields.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }
    if (!password) {
      errors.password = 'Please fill all fields.';
    }

    setLocalErrors(errors);

    if (Object.keys(errors).length === 0) {
      onSubmit(email.trim(), password);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log In !</Text>

      {error ? (
        <View style={styles.errorWrapper}>
          <Text style={styles.errorText}>⚠ {error}</Text>
        </View>
      ) : null}

      <AuthInput
        icon="mail-outline"
        placeholder="Email Address"
        value={email}
        onChangeText={(val) => {
          setEmail(val);
          if (localErrors.email) setLocalErrors((prev) => ({ ...prev, email: undefined }));
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        error={localErrors.email}
        editable={!busy}
      />

      <PasswordInput
        placeholder="Password"
        value={password}
        onChangeText={(val) => {
          setPassword(val);
          if (localErrors.password) setLocalErrors((prev) => ({ ...prev, password: undefined }));
        }}
        error={localErrors.password}
        editable={!busy}
      />

      <View style={styles.forgotWrapper}>
        <Pressable onPress={onForgotPassword} disabled={busy}>
          <Text style={styles.forgotText}>Forget Password ?</Text>
        </Pressable>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.loginBtn,
          pressed && styles.loginBtnPressed,
          busy && styles.loginBtnDisabled,
        ]}
        onPress={handleLoginSubmit}
        disabled={busy}
        accessibilityRole="button"
      >
        {busy ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <Text style={styles.loginBtnText}>Log in</Text>
        )}
      </Pressable>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Don't have an account ? </Text>
        <Pressable onPress={onSwitchToRegister} disabled={busy}>
          <Text style={styles.signUpText}>Sign Up</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  title: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 32,
    color: '#111',
    textAlign: 'center',
    marginBottom: 28,
  },
  errorWrapper: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 14,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
  },
  forgotWrapper: {
    width: '100%',
    alignItems: 'flex-end',
    marginTop: -4,
    marginBottom: 20,
  },
  forgotText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    fontFamily: 'Poppins_600SemiBold',
  },
  loginBtn: {
    width: '100%',
    backgroundColor: '#e67e22',
    borderRadius: 10,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    // iOS shadow
    shadowColor: '#e67e22',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    // Android elevation
    elevation: 4,
  },
  loginBtnPressed: {
    backgroundColor: '#d4691a',
  },
  loginBtnDisabled: {
    opacity: 0.65,
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  footerText: {
    fontSize: 14,
    color: '#555',
    fontFamily: 'Poppins_400Regular',
  },
  signUpText: {
    fontSize: 14,
    color: '#e67e22',
    fontFamily: 'Poppins_600SemiBold',
  },
});
