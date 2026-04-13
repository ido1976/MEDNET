import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../src/constants/theme';
import { useAuthStore } from '../../src/stores/authStore';
import { YEAR_LABELS, INTEREST_OPTIONS, BRIDGE_TAGS } from '../../src/lib/helpers';

const TOTAL_STEPS = 6;

export default function OnboardingScreen() {
  const router = useRouter();
  const { updateProfile, user } = useAuthStore();
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [yearOfStudy, setYearOfStudy] = useState<number | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setAvatarUrl(result.assets[0].uri);
    }
  };

  const handleNext = () => {
    if (step === 1 && !fullName.trim()) {
      Alert.alert('שגיאה', 'נא להזין שם מלא');
      return;
    }
    if (step === 2 && !yearOfStudy) {
      Alert.alert('שגיאה', 'נא לבחור שנת לימודים');
      return;
    }
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      await updateProfile({
        full_name: fullName,
        year_of_study: yearOfStudy,
        interests,
        avatar_url: avatarUrl,
      });
    } catch (e) {
      // Ignore errors - DB tables may not exist yet
    }
    setLoading(false);
    router.replace('/(tabs)/');
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepEmoji}>👋</Text>
            <Text style={styles.stepTitle}>מה השם שלך?</Text>
            <Text style={styles.stepDesc}>כך יכירו אותך בקהילה</Text>
            <TextInput
              style={styles.bigInput}
              placeholder="השם המלא שלך"
              placeholderTextColor={COLORS.grayLight}
              value={fullName}
              onChangeText={setFullName}
              textAlign="right"
              autoFocus
            />
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepEmoji}>📚</Text>
            <Text style={styles.stepTitle}>באיזו שנה אתה?</Text>
            <Text style={styles.stepDesc}>נתאים את התוכן אליך</Text>
            <View style={styles.yearGrid}>
              {Object.entries(YEAR_LABELS).map(([year, label]) => (
                <TouchableOpacity
                  key={year}
                  style={[
                    styles.yearBtn,
                    yearOfStudy === Number(year) && styles.yearBtnActive,
                  ]}
                  onPress={() => setYearOfStudy(Number(year))}
                >
                  <Text
                    style={[
                      styles.yearBtnText,
                      yearOfStudy === Number(year) && styles.yearBtnTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepEmoji}>🔬</Text>
            <Text style={styles.stepTitle}>מה מעניין אותך?</Text>
            <Text style={styles.stepDesc}>בחר תחומים שמעניינים אותך</Text>
            <View style={styles.chipsGrid}>
              {INTEREST_OPTIONS.map((interest) => (
                <TouchableOpacity
                  key={interest}
                  style={[
                    styles.chip,
                    interests.includes(interest) && styles.chipActive,
                  ]}
                  onPress={() => toggleInterest(interest)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      interests.includes(interest) && styles.chipTextActive,
                    ]}
                  >
                    {interest}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      case 4:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepEmoji}>🏷️</Text>
            <Text style={styles.stepTitle}>תיוגים</Text>
            <Text style={styles.stepDesc}>באילו גשרים תרצה להשתתף?</Text>
            <View style={styles.chipsGrid}>
              {BRIDGE_TAGS.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[styles.chip, tags.includes(tag) && styles.chipActive]}
                  onPress={() => toggleTag(tag)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      tags.includes(tag) && styles.chipTextActive,
                    ]}
                  >
                    {tag}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      case 5:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepEmoji}>📸</Text>
            <Text style={styles.stepTitle}>תמונת פרופיל</Text>
            <Text style={styles.stepDesc}>הוסף תמונה כדי שיכירו אותך</Text>
            <TouchableOpacity style={styles.avatarPicker} onPress={pickImage}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarPreview} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="camera" size={40} color={COLORS.gray} />
                  <Text style={styles.avatarHint}>לחץ לבחירת תמונה</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        );
      case 6:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepEmoji}>✅</Text>
            <Text style={styles.stepTitle}>הכל מוכן!</Text>
            <Text style={styles.stepDesc}>סיכום הפרטים שלך</Text>
            <View style={styles.summary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryValue}>{fullName}</Text>
                <Text style={styles.summaryLabel}>שם:</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryValue}>
                  {yearOfStudy ? YEAR_LABELS[yearOfStudy] : 'לא נבחר'}
                </Text>
                <Text style={styles.summaryLabel}>שנה:</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryValue}>
                  {interests.length > 0 ? interests.join(', ') : 'לא נבחרו'}
                </Text>
                <Text style={styles.summaryLabel}>תחומי עניין:</Text>
              </View>
            </View>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Progress */}
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>{step} / {TOTAL_STEPS}</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
          </View>
        </View>

        {renderStepContent()}

        {/* Navigation */}
        <View style={styles.navContainer}>
          <TouchableOpacity
            style={[styles.nextBtn, loading && styles.disabledBtn]}
            onPress={handleNext}
            disabled={loading}
          >
            <Text style={styles.nextBtnText}>
              {step === TOTAL_STEPS ? (loading ? 'שומר...' : 'סיום') : 'המשך'}
            </Text>
            {step < TOTAL_STEPS && (
              <Ionicons name="arrow-back" size={20} color={COLORS.white} />
            )}
          </TouchableOpacity>

          {step > 1 && (
            <TouchableOpacity style={styles.prevBtn} onPress={() => setStep(step - 1)}>
              <Text style={styles.prevBtnText}>חזור</Text>
            </TouchableOpacity>
          )}

          {step >= 3 && step < TOTAL_STEPS && (
            <TouchableOpacity onPress={() => setStep(step + 1)}>
              <Text style={styles.skipText}>דלג</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  scroll: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
    flexGrow: 1,
  },
  progressContainer: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  progressText: {
    fontSize: 13,
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  progressBar: {
    height: 6,
    backgroundColor: COLORS.grayLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  stepContent: {
    flex: 1,
    alignItems: 'center',
    paddingTop: SPACING.lg,
  },
  stepEmoji: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.primaryDark,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  stepDesc: {
    fontSize: 15,
    color: COLORS.gray,
    marginBottom: SPACING.xl,
    textAlign: 'center',
  },
  bigInput: {
    width: '100%',
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.grayLight,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.primaryDark,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  yearGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.sm,
    width: '100%',
  },
  yearBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.cardBg,
    borderWidth: 2,
    borderColor: COLORS.grayLight,
    ...SHADOWS.card,
  },
  yearBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  yearBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primaryDark,
  },
  yearBtnTextActive: {
    color: COLORS.white,
  },
  chipsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.sm,
    width: '100%',
  },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.cardBg,
    borderWidth: 1.5,
    borderColor: COLORS.grayLight,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primaryDark,
  },
  chipTextActive: {
    color: COLORS.white,
  },
  avatarPicker: {
    width: 160,
    height: 160,
    borderRadius: 80,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  avatarPreview: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.cardBg,
    borderWidth: 2,
    borderColor: COLORS.grayLight,
    borderStyle: 'dashed',
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: SPACING.sm,
  },
  summary: {
    width: '100%',
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.md,
    ...SHADOWS.card,
  },
  summaryRow: {
    flexDirection: 'row-reverse',
    gap: SPACING.sm,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  summaryValue: {
    fontSize: 14,
    color: COLORS.gray,
    flex: 1,
    textAlign: 'right',
  },
  navContainer: {
    marginTop: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.md,
  },
  nextBtn: {
    width: '100%',
    backgroundColor: COLORS.primary,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: RADIUS.xl,
    gap: SPACING.sm,
    ...SHADOWS.button,
  },
  disabledBtn: {
    opacity: 0.7,
  },
  nextBtnText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '700',
  },
  prevBtn: {
    paddingVertical: 10,
  },
  prevBtnText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  skipText: {
    color: COLORS.gray,
    fontSize: 14,
  },
});
