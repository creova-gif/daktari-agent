import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  Alert, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../hooks/useAuth';
import { colors, typography, spacing, radius, shared } from '../lib/theme';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

export default function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  async function handleLogin() {
    if (!phone.trim() || !password.trim()) {
      Alert.alert('Hitilafu', 'Tafadhali jaza namba ya simu na nenosiri.');
      return;
    }

    // Normalize phone: ensure +255 prefix
    const normalizedPhone = phone.startsWith('+')
      ? phone
      : phone.startsWith('0')
      ? '+255' + phone.slice(1)
      : '+255' + phone;

    setLoading(true);
    try {
      await signIn(normalizedPhone, password);
      navigation.replace('Dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Imeshindwa kuingia. Jaribu tena.';
      Alert.alert('Hitilafu ya Kuingia', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Header Gradient */}
        <LinearGradient
          colors={['#1A5E35', '#2ECC71']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroSection}
        >
          <View style={styles.logoMark}>
            <Text style={styles.logoIcon}>🩺</Text>
          </View>
          <Text style={styles.appName}>Daktari Agent</Text>
          <Text style={styles.appTagline}>Msaidizi wa Kliniki wa AI</Text>
          <Text style={styles.appTaglineEn}>CHW Clinical Intelligence · Tanzania</Text>
        </LinearGradient>

        {/* Login Form */}
        <View style={styles.form}>
          <Text style={styles.formTitle}>Ingia</Text>
          <Text style={styles.formSub}>Tumia namba yako ya simu na nenosiri.</Text>

          {/* Phone */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>NAMBA YA SIMU</Text>
            <TextInput
              style={[
                styles.input,
                phoneFocused && styles.inputFocused,
              ]}
              placeholder="+255 712 000 001"
              placeholderTextColor={colors.inkDim}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              autoCapitalize="none"
              onFocus={() => setPhoneFocused(true)}
              onBlur={() => setPhoneFocused(false)}
            />
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>NENOSIRI</Text>
            <TextInput
              style={[
                styles.input,
                passwordFocused && styles.inputFocused,
              ]}
              placeholder="••••••••"
              placeholderTextColor={colors.inkDim}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
            />
          </View>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.inkInverse} />
            ) : (
              <Text style={styles.loginBtnText}>Ingia →</Text>
            )}
          </TouchableOpacity>

          {/* Info */}
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Akaunti yako inasimamia na Msimamizi wa Wilaya.
              Kwa msaada, piga simu: <Text style={{ color: colors.green }}>+255-800-DAKTARI</Text>
            </Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Daktari Agent v0.1 · Wizara ya Afya Tanzania · CREOVA Health
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flexGrow: 1,
  },
  heroSection: {
    paddingTop: 80,
    paddingBottom: 48,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoIcon: {
    fontSize: 36,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  appTagline: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
    fontWeight: '500',
  },
  appTaglineEn: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  form: {
    flex: 1,
    backgroundColor: colors.surface,
    marginTop: -24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
    paddingTop: 36,
  },
  formTitle: {
    ...typography.h2,
    marginBottom: 6,
  },
  formSub: {
    ...typography.bodyMuted,
    marginBottom: spacing.xl,
  },
  fieldGroup: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  input: {
    ...shared.input,
    fontSize: 16,
  },
  inputFocused: {
    borderColor: colors.green,
    borderWidth: 2,
  },
  loginBtn: {
    ...shared.primaryButton,
    marginTop: spacing.md,
    height: 56,
  },
  loginBtnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    ...shared.primaryButtonText,
    fontSize: 18,
  },
  infoBox: {
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: colors.greenLight,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.green,
  },
  infoText: {
    ...typography.caption,
    color: colors.greenDark,
    lineHeight: 18,
  },
  footer: {
    textAlign: 'center',
    ...typography.caption,
    padding: spacing.lg,
    color: colors.inkDim,
  },
});
