import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '@/providers/AppProvider';
import { post } from '@/lib/api';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegistrationForm } from '@/components/auth/RegistrationForm';
import { AuthInput } from '@/components/auth/AuthInput';
import { PasswordInput } from '@/components/auth/PasswordInput';
import type { User } from '@/types';

type Mode = 'login' | 'register' | 'forgot' | 'otp' | 'reset';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function AuthScreen() {
  const router = useRouter();
  const { setUser } = useApp();
  const params = useLocalSearchParams<{ ref?: string }>();
  const initialReferralCode = typeof params.ref === 'string' ? params.ref.toUpperCase() : '';

  const [mode, setMode] = useState<Mode>(initialReferralCode ? 'register' : 'login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  // Form states for forgot / otp / reset flows
  const [forgotEmail, setForgotEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Countdown timer for Resend OTP
  const [countdown, setCountdown] = useState(60);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (mode === 'otp' && isOtpSent && countdown > 0) {
      timerRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [mode, isOtpSent, countdown]);

  const handleClose = () => {
    router.back();
  };

  const handleLogin = async (email: string, pass: string) => {
    setBusy(true);
    setError('');
    setOkMsg('');
    try {
      const data = await post<{ user: User }>('/api/user/login', {
        email: email.trim(),
        password: pass,
      });
      setUser(data.user);
      router.back();
    } catch (e) {
      console.error('[Auth] Login error:', e);
      setError(e instanceof Error ? e.message : 'Login failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (name: string, phone: string, email: string, pass: string, referralCode: string) => {
    setBusy(true);
    setError('');
    setOkMsg('');
    try {
      const data = await post<{ user: User }>('/api/user/register', {
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim(),
        password: pass,
        referralCode: referralCode.trim() || undefined,
      });
      setUser(data.user);
      router.back();
    } catch (e) {
      console.error('[Auth] Registration error:', e);
      setError(e instanceof Error ? e.message : 'Registration failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSendOtp = async () => {
    if (!forgotEmail) {
      setError('Enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setBusy(true);
    setError('');
    setOkMsg('');
    try {
      const data = await post<{ success: boolean; otpToken: string }>('/api/user/send-otp', {
        email: forgotEmail.trim(),
      });
      setOtpToken(data.otpToken);
      setOkMsg('OTP sent! Check your inbox.');
      setIsOtpSent(true);
      setCountdown(60);
      setMode('otp');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send OTP.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length < 6 || /\D/.test(otpCode)) {
      setError('Enter all 6 digits.');
      return;
    }

    setBusy(true);
    setError('');
    setOkMsg('');
    try {
      const data = await post<{ success: boolean; resetToken: string }>('/api/user/verify-otp', {
        otpToken,
        otp: otpCode,
      });
      setResetToken(data.resetToken);
      setOkMsg('OTP verified! Set your new password.');
      setMode('reset');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid OTP.');
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword) {
      setError('Enter new password.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Min 6 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("Passwords don't match.");
      return;
    }

    setBusy(true);
    setError('');
    setOkMsg('');
    try {
      await post('/api/user/reset-password', {
        resetToken,
        password: newPassword,
      });
      setOkMsg('Password reset successfully! You can now log in.');
      setTimeout(() => {
        setMode('login');
        setError('');
        setOkMsg('');
        setNewPassword('');
        setConfirmNewPassword('');
      }, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset password failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.outerContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Pressable style={styles.backdrop} onPress={handleClose} />

      <View style={styles.cardContainer}>
        <View style={styles.modalCard}>
          {/* Close button top right */}
          <Pressable
            style={styles.closeBtn}
            onPress={handleClose}
            hitSlop={12}
            accessibilityLabel="Close auth dialog"
          >
            <Ionicons name="close-outline" size={26} color="#555" />
          </Pressable>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {mode === 'login' && (
              <LoginForm
                onSubmit={handleLogin}
                onForgotPassword={() => {
                  setError('');
                  setOkMsg('');
                  setMode('forgot');
                }}
                onSwitchToRegister={() => {
                  setError('');
                  setOkMsg('');
                  setMode('register');
                }}
                busy={busy}
                error={error}
              />
            )}

            {mode === 'register' && (
              <RegistrationForm
                onSubmit={handleRegister}
                onSwitchToLogin={() => {
                  setError('');
                  setOkMsg('');
                  setMode('login');
                }}
                busy={busy}
                error={error}
                initialReferralCode={initialReferralCode}
              />
            )}

            {mode === 'forgot' && (
              <View style={styles.flowSection}>
                <Text style={styles.flowTitle}>Forgot Password !</Text>
                <Text style={styles.flowDesc}>
                  Please enter your email address below you will receive OTP on your email address.
                </Text>

                {error ? (
                  <View style={styles.errorWrapper}>
                    <Text style={styles.errorText}>⚠ {error}</Text>
                  </View>
                ) : null}

                <AuthInput
                  icon="mail-outline"
                  placeholder="Email Address"
                  value={forgotEmail}
                  onChangeText={(val) => {
                    setForgotEmail(val);
                    if (error) setError('');
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!busy}
                />

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    pressed && styles.primaryBtnPressed,
                    busy && styles.primaryBtnDisabled,
                  ]}
                  onPress={handleSendOtp}
                  disabled={busy}
                >
                  <Text style={styles.primaryBtnText}>
                    {busy ? 'Sending OTP…' : 'Continue'}
                  </Text>
                </Pressable>
              </View>
            )}

            {mode === 'otp' && (
              <View style={styles.flowSection}>
                <Text style={styles.flowTitle}>Verify OTP</Text>
                <Text style={styles.flowDesc}>
                  Please enter OTP sent to <Text style={styles.boldText}>{forgotEmail}</Text>
                </Text>

                {error ? (
                  <View style={styles.errorWrapper}>
                    <Text style={styles.errorText}>⚠ {error}</Text>
                  </View>
                ) : null}
                {okMsg ? (
                  <View style={styles.okWrapper}>
                    <Text style={styles.okText}>✓ {okMsg}</Text>
                  </View>
                ) : null}

                <AuthInput
                  icon="key-outline"
                  placeholder="Enter 6-digit OTP"
                  value={otpCode}
                  onChangeText={(val) => {
                    setOtpCode(val.replace(/\D/g, '').slice(0, 6));
                    if (error) setError('');
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!busy}
                />

                <View style={styles.timerWrapper}>
                  {busy ? (
                    <Text style={styles.timerText}>Sending OTP to your email…</Text>
                  ) : countdown > 0 ? (
                    <Text style={styles.timerText}>{countdown} Seconds</Text>
                  ) : (
                    <Pressable onPress={handleSendOtp}>
                      <Text style={[styles.timerText, styles.orangeLink]}>Resend OTP</Text>
                    </Pressable>
                  )}
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    pressed && styles.primaryBtnPressed,
                    busy && styles.primaryBtnDisabled,
                  ]}
                  onPress={handleVerifyOtp}
                  disabled={busy}
                >
                  <Text style={styles.primaryBtnText}>
                    {busy ? 'Verifying…' : 'Continue'}
                  </Text>
                </Pressable>
              </View>
            )}

            {mode === 'reset' && (
              <View style={styles.flowSection}>
                <Text style={styles.flowTitle}>New Password</Text>
                <Text style={styles.flowDesc}>Enter your new password below.</Text>

                {error ? (
                  <View style={styles.errorWrapper}>
                    <Text style={styles.errorText}>⚠ {error}</Text>
                  </View>
                ) : null}
                {okMsg ? (
                  <View style={styles.okWrapper}>
                    <Text style={styles.okText}>✓ {okMsg}</Text>
                  </View>
                ) : null}

                <PasswordInput
                  placeholder="New Password"
                  value={newPassword}
                  onChangeText={(val) => {
                    setNewPassword(val);
                    if (error) setError('');
                  }}
                  editable={!busy}
                />

                <PasswordInput
                  placeholder="Confirm New Password"
                  value={confirmNewPassword}
                  onChangeText={(val) => {
                    setConfirmNewPassword(val);
                    if (error) setError('');
                  }}
                  editable={!busy}
                />

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    pressed && styles.primaryBtnPressed,
                    busy && styles.primaryBtnDisabled,
                  ]}
                  onPress={handleResetPassword}
                  disabled={busy}
                >
                  <Text style={styles.primaryBtnText}>
                    {busy ? 'Saving…' : 'Reset Password'}
                  </Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.50)', // matching auth-overlay background
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    position: 'relative',
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.2,
    shadowRadius: 25,
    // Android elevation
    elevation: 24,
    overflow: 'hidden',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 20,
    zIndex: 10,
    padding: 4,
  },
  scrollContent: {
    paddingVertical: 40,
    paddingHorizontal: 28,
  },
  flowSection: {
    width: '100%',
  },
  flowTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 28,
    color: '#111',
    textAlign: 'center',
    marginBottom: 20,
  },
  flowDesc: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'Poppins_400Regular',
  },
  boldText: {
    fontWeight: '600',
    color: '#111',
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
  okWrapper: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 14,
  },
  okText: {
    color: '#16a34a',
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: '#e67e22',
    borderRadius: 10,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    // iOS shadow
    shadowColor: '#e67e22',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    // Android elevation
    elevation: 4,
  },
  primaryBtnPressed: {
    backgroundColor: '#d4691a',
  },
  primaryBtnDisabled: {
    opacity: 0.65,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
  },
  timerWrapper: {
    alignItems: 'center',
    marginBottom: 20,
  },
  timerText: {
    fontSize: 14,
    color: '#e67e22',
    fontWeight: '600',
    fontFamily: 'Poppins_600SemiBold',
  },
  orangeLink: {
    textDecorationLine: 'underline',
  },
});
