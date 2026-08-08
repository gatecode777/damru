import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Linking } from 'react-native';
import { AuthInput } from './AuthInput';
import { PasswordInput } from './PasswordInput';

interface RegistrationFormProps {
  onSubmit: (name: string, phone: string, email: string, pass: string, referralCode: string) => void;
  onSwitchToLogin: () => void;
  busy: boolean;
  error?: string;
  initialReferralCode?: string;
}

export function RegistrationForm({ onSubmit, onSwitchToLogin, busy, error, initialReferralCode }: RegistrationFormProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [referralCode, setReferralCode] = useState(initialReferralCode || '');
  const [showReferralField, setShowReferralField] = useState(!!initialReferralCode);

  const [localErrors, setLocalErrors] = useState<{
    name?: string;
    phone?: string;
    email?: string;
    password?: string;
    confirm?: string;
  }>({});

  const handleRegisterSubmit = () => {
    const errors: typeof localErrors = {};

    if (!name.trim()) {
      errors.name = 'Fill all required fields.';
    }
    if (!email.trim()) {
      errors.email = 'Fill all required fields.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }
    if (phone.trim() && !/^[6-9]\d{9}$/.test(phone.trim())) {
      errors.phone = 'Please enter a valid 10-digit phone number.';
    }
    if (!password) {
      errors.password = 'Fill all required fields.';
    } else if (password.length < 6) {
      errors.password = 'Password min 6 characters.';
    }
    if (password !== confirm) {
      errors.confirm = "Passwords don't match.";
    }

    setLocalErrors(errors);

    if (Object.keys(errors).length === 0) {
      onSubmit(name.trim(), phone.trim(), email.trim(), password, referralCode.trim());
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Registration !</Text>

      {error ? (
        <View style={styles.errorWrapper}>
          <Text style={styles.errorText}>⚠ {error}</Text>
        </View>
      ) : null}

      <AuthInput
        icon="person-outline"
        placeholder="Full Name"
        value={name}
        onChangeText={(val) => {
          setName(val);
          if (localErrors.name) setLocalErrors((prev) => ({ ...prev, name: undefined }));
        }}
        autoCapitalize="words"
        editable={!busy}
        error={localErrors.name}
      />

      <AuthInput
        icon="call-outline"
        placeholder="Contact Number (10 digit)"
        value={phone}
        onChangeText={(val) => {
          const digitsOnly = val.replace(/\D/g, '').slice(0, 10);
          setPhone(digitsOnly);
          if (localErrors.phone) setLocalErrors((prev) => ({ ...prev, phone: undefined }));
        }}
        keyboardType="phone-pad"
        maxLength={10}
        editable={!busy}
        error={localErrors.phone}
      />

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
        editable={!busy}
        error={localErrors.email}
      />

      <PasswordInput
        placeholder="Password"
        value={password}
        onChangeText={(val) => {
          setPassword(val);
          if (localErrors.password) setLocalErrors((prev) => ({ ...prev, password: undefined }));
        }}
        editable={!busy}
        error={localErrors.password}
      />

      <PasswordInput
        placeholder="Confirm Password"
        value={confirm}
        onChangeText={(val) => {
          setConfirm(val);
          if (localErrors.confirm) setLocalErrors((prev) => ({ ...prev, confirm: undefined }));
        }}
        editable={!busy}
        error={localErrors.confirm}
      />

      {showReferralField ? (
        <AuthInput
          icon="gift-outline"
          placeholder="Referral Code (optional)"
          value={referralCode}
          onChangeText={(val) => setReferralCode(val.toUpperCase())}
          autoCapitalize="characters"
          editable={!busy}
        />
      ) : (
        <Pressable onPress={() => setShowReferralField(true)} style={styles.referralToggle} disabled={busy}>
          <Text style={styles.referralToggleText}>Have a referral code?</Text>
        </Pressable>
      )}

      <Text style={styles.termsText}>
        By signing below, you agree to the{' '}
        <Text style={styles.linkText} onPress={() => Linking.openURL('https://damrurestro.com/terms')}>
          terms of use
        </Text>{' '}
        and{' '}
        <Text style={styles.linkText} onPress={() => Linking.openURL('https://damrurestro.com/privacy')}>
          privacy notice
        </Text>
      </Text>

      <Pressable
        style={({ pressed }) => [
          styles.registerBtn,
          pressed && styles.registerBtnPressed,
          busy && styles.registerBtnDisabled,
        ]}
        onPress={handleRegisterSubmit}
        disabled={busy}
        accessibilityRole="button"
      >
        {busy ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <Text style={styles.registerBtnText}>Register</Text>
        )}
      </Pressable>

      <Pressable onPress={onSwitchToLogin} style={styles.backLink} disabled={busy}>
        <Text style={styles.backLinkText}>← Back to Login Page</Text>
      </Pressable>
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
  referralToggle: {
    marginBottom: 14,
  },
  referralToggleText: {
    color: '#e67e22',
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
  },
  termsText: {
    fontSize: 13,
    color: '#555',
    lineHeight: 20,
    marginBottom: 16,
    fontFamily: 'Poppins_400Regular',
  },
  linkText: {
    color: '#e67e22',
    fontFamily: 'Poppins_500Medium',
  },
  registerBtn: {
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
  registerBtnPressed: {
    backgroundColor: '#d4691a',
  },
  registerBtnDisabled: {
    opacity: 0.65,
  },
  registerBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
  },
  backLink: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 4,
  },
  backLinkText: {
    color: '#e67e22',
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
  },
});
