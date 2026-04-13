import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../src/constants/theme';
import { useAuthStore } from '../../src/stores/authStore';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleRegister = async () => {
    if (!email.trim()) {
      Alert.alert('שגיאה', 'נא להזין כתובת אימייל');
      return;
    }
    if (password.length < 6) {
      Alert.alert('שגיאה', 'הסיסמה חייבת להכיל לפחות 6 תווים');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('שגיאה', 'הסיסמאות אינן תואמות');
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password);
    setLoading(false);

    if (error) {
      Alert.alert('שגיאה', error);
    } else {
      router.replace('/(auth)/onboarding');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Back Button */}
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-forward" size={24} color={COLORS.primaryDark} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoSmall}>
              <Ionicons name="medical" size={28} color={COLORS.white} />
            </View>
            <Text style={styles.title}>הצטרף ל-MEDNET</Text>
            <Text style={styles.subtitle}>הרשמה מהירה עם אימייל וסיסמה</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>אימייל</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="your@email.com"
                  placeholderTextColor={COLORS.grayLight}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  textAlign="right"
                />
                <Ionicons name="mail" size={20} color={COLORS.gray} style={styles.inputIcon} />
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>סיסמה</Text>
              <View style={styles.inputWrapper}>
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={COLORS.gray}
                  />
                </TouchableOpacity>
                <TextInput
                  style={styles.input}
                  placeholder="לפחות 6 תווים"
                  placeholderTextColor={COLORS.grayLight}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  textAlign="right"
                />
                <Ionicons name="lock-closed" size={20} color={COLORS.gray} style={styles.inputIcon} />
              </View>
            </View>

            {/* Confirm Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>אימות סיסמה</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="הזן סיסמה שוב"
                  placeholderTextColor={COLORS.grayLight}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  textAlign="right"
                />
                <Ionicons name="lock-closed" size={20} color={COLORS.gray} style={styles.inputIcon} />
              </View>
            </View>
          </View>

          {/* Register Button */}
          <TouchableOpacity
            style={[styles.registerBtn, loading && styles.disabledBtn]}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.registerBtnText}>
              {loading ? 'נרשם...' : 'הרשמה'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.terms}>
            בהרשמה אתה מסכים לתנאי השימוש ומדיניות הפרטיות
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  backBtn: {
    alignSelf: 'flex-end',
    padding: SPACING.sm,
    marginTop: SPACING.sm,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  logoSmall: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: SPACING.xs,
  },
  form: {
    gap: SPACING.md,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primaryDark,
    textAlign: 'right',
  },
  inputWrapper: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.grayLight,
    paddingHorizontal: SPACING.md,
    height: 52,
  },
  inputIcon: {
    marginLeft: SPACING.sm,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.black,
    writingDirection: 'rtl',
  },
  registerBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    marginTop: SPACING.xl,
    ...SHADOWS.button,
  },
  disabledBtn: {
    opacity: 0.7,
  },
  registerBtnText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '700',
  },
  terms: {
    fontSize: 12,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: SPACING.md,
    lineHeight: 18,
  },
});
