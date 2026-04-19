# Onboarding Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the existing 6-step onboarding flow to collect all Phase 1 profile fields, subscribe users to real DB tags, and mark onboarding as completed.

**Architecture:** Two files change. `app/index.tsx` gets a stricter routing guard (check `onboarding_completed_at` instead of `full_name`). `app/(auth)/onboarding.tsx` gains a new Location step (settlement, origin_city, academic_track), replaces the static BRIDGE_TAGS chip list with real `bridge_tags` from Supabase, and calls `subscribeToTag` + saves `onboarding_completed_at` on completion.

**Tech Stack:** React Native, Expo Router, Supabase JS client, Zustand (`authStore`).

---

## File Map

| File | Change |
|------|--------|
| `app/index.tsx` | Line 16: change routing guard condition |
| `app/(auth)/onboarding.tsx` | Expand steps, new state, DB fetch, save new fields |

---

### Task 1: Fix routing guard in `app/index.tsx`

**Files:**
- Modify: `app/index.tsx` line 16

The current guard `!user?.full_name` sends users back to onboarding every time they clear their name. `onboarding_completed_at` is set exactly once and never cleared — it's the correct sentinel.

- [ ] **Step 1: Edit the condition**

In `app/index.tsx`, change line 16 from:
```tsx
    } else if (!user?.full_name) {
```
to:
```tsx
    } else if (!user?.onboarding_completed_at) {
```

- [ ] **Step 2: Verify the file looks correct**

`app/index.tsx` should now read:
```tsx
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';
import { COLORS } from '../src/constants/theme';

export default function Index() {
  const router = useRouter();
  const { session, user, loading } = useAuthStore();

  useEffect(() => {
    if (loading) return;

    if (!session) {
      router.replace('/(auth)/welcome');
    } else if (!user?.onboarding_completed_at) {
      router.replace('/(auth)/onboarding');
    } else {
      router.replace('/(tabs)/');
    }
  }, [loading, session, user]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add app/index.tsx
git commit -m "fix(routing): guard onboarding by onboarding_completed_at instead of full_name"
```

---

### Task 2: Rewrite `app/(auth)/onboarding.tsx`

**Files:**
- Modify: `app/(auth)/onboarding.tsx` (full replacement)

Changes:
1. New state: `settlement`, `academicTrack`, `originCity`, `dbTags`, `selectedTagIds`
2. `useEffect` to fetch `bridge_tags` from Supabase on mount
3. TOTAL_STEPS → 7 (adding Location step between Interests and Tags)
4. Step 4 (NEW): Location — TextInput for settlement, origin_city, academic_track
5. Step 5 (was 4): Tags — DB chips using `dbTags` / `selectedTagIds`, not static BRIDGE_TAGS
6. Step 6 (was 5): Avatar — unchanged
7. Step 7 (was 6): Summary — shows settlement + selected tag names
8. `handleComplete`: saves all new fields + `onboarding_completed_at`, then calls `subscribeToTag` per selected tag

- [ ] **Step 1: Replace the entire file**

Write the following to `app/(auth)/onboarding.tsx`:

```tsx
import React, { useState, useEffect } from 'react';
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
import { YEAR_LABELS, INTEREST_OPTIONS } from '../../src/lib/helpers';
import { supabase } from '../../src/lib/supabase';
import type { BridgeTag } from '../../src/types/database';

const TOTAL_STEPS = 7;

export default function OnboardingScreen() {
  const router = useRouter();
  const { updateProfile, subscribeToTag } = useAuthStore();

  // Step state
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1 — Name
  const [fullName, setFullName] = useState('');

  // Step 2 — Year
  const [yearOfStudy, setYearOfStudy] = useState<number | null>(null);

  // Step 3 — Interests
  const [interests, setInterests] = useState<string[]>([]);

  // Step 4 — Location (all optional)
  const [settlement, setSettlement] = useState('');
  const [originCity, setOriginCity] = useState('');
  const [academicTrack, setAcademicTrack] = useState('');

  // Step 5 — Tags (real DB tags)
  const [dbTags, setDbTags] = useState<BridgeTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Step 6 — Avatar
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Fetch real tags from DB on mount
  useEffect(() => {
    supabase
      .from('bridge_tags')
      .select('id, name')
      .order('name')
      .then(({ data }) => {
        if (data) setDbTags(data as BridgeTag[]);
      });
  }, []);

  // ── Helpers ──────────────────────────────────────────────

  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const toggleTagId = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
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

  // ── Navigation ────────────────────────────────────────────

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
      const { error } = await updateProfile({
        full_name: fullName,
        year_of_study: yearOfStudy,
        interests,
        avatar_url: avatarUrl,
        settlement: settlement.trim() || null,
        origin_city: originCity.trim() || null,
        academic_track: academicTrack.trim() || null,
        onboarding_completed_at: new Date().toISOString(),
      });

      if (error) {
        // Non-blocking — profile saved locally even if DB fails
        console.warn('Profile DB save warning:', error);
      }

      // Subscribe to each selected tag
      for (const tagId of selectedTagIds) {
        await subscribeToTag(tagId);
      }
    } catch (e) {
      console.warn('Onboarding complete error:', e);
    }
    setLoading(false);
    router.replace('/(tabs)/');
  };

  // ── Step content ─────────────────────────────────────────

  const renderStepContent = () => {
    switch (step) {
      // ── Step 1: Name ──────────────────────────────────────
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

      // ── Step 2: Year ──────────────────────────────────────
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

      // ── Step 3: Interests ─────────────────────────────────
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

      // ── Step 4: Location (NEW) ────────────────────────────
      case 4:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepEmoji}>📍</Text>
            <Text style={styles.stepTitle}>קצת עליך</Text>
            <Text style={styles.stepDesc}>כל השדות אופציונליים</Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>יישוב מגורים</Text>
              <TextInput
                style={styles.input}
                placeholder="לדוגמה: צפת, ירושלים"
                placeholderTextColor={COLORS.grayLight}
                value={settlement}
                onChangeText={setSettlement}
                textAlign="right"
              />
              <Text style={styles.fieldLabel}>עיר מוצא</Text>
              <TextInput
                style={styles.input}
                placeholder="עיר הולדת"
                placeholderTextColor={COLORS.grayLight}
                value={originCity}
                onChangeText={setOriginCity}
                textAlign="right"
              />
              <Text style={styles.fieldLabel}>מסלול לימודים</Text>
              <TextInput
                style={styles.input}
                placeholder="לדוגמה: רפואה, רפואת שיניים"
                placeholderTextColor={COLORS.grayLight}
                value={academicTrack}
                onChangeText={setAcademicTrack}
                textAlign="right"
              />
            </View>
          </View>
        );

      // ── Step 5: Tags (DB) ─────────────────────────────────
      case 5:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepEmoji}>🏷️</Text>
            <Text style={styles.stepTitle}>תיוגים</Text>
            <Text style={styles.stepDesc}>באילו גשרים תרצה להשתתף?</Text>
            <View style={styles.chipsGrid}>
              {dbTags.length === 0 ? (
                <Text style={styles.emptyTagsText}>טוען תיוגים...</Text>
              ) : (
                dbTags.map((tag) => (
                  <TouchableOpacity
                    key={tag.id}
                    style={[
                      styles.chip,
                      selectedTagIds.includes(tag.id) && styles.chipActive,
                    ]}
                    onPress={() => toggleTagId(tag.id)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedTagIds.includes(tag.id) && styles.chipTextActive,
                      ]}
                    >
                      {tag.name}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </View>
        );

      // ── Step 6: Avatar ────────────────────────────────────
      case 6:
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

      // ── Step 7: Summary ───────────────────────────────────
      case 7:
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
              {settlement ? (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryValue}>{settlement}</Text>
                  <Text style={styles.summaryLabel}>יישוב:</Text>
                </View>
              ) : null}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryValue}>
                  {interests.length > 0 ? interests.join(', ') : 'לא נבחרו'}
                </Text>
                <Text style={styles.summaryLabel}>תחומי עניין:</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryValue}>
                  {selectedTagIds.length > 0
                    ? dbTags
                        .filter((t) => selectedTagIds.includes(t.id))
                        .map((t) => t.name)
                        .join(', ')
                    : 'לא נבחרו'}
                </Text>
                <Text style={styles.summaryLabel}>גשרים:</Text>
              </View>
            </View>
          </View>
        );
    }
  };

  // ── Render ────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Progress */}
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            {step} / {TOTAL_STEPS}
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]}
            />
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

          {/* Skip allowed on optional steps (3, 4, 5, 6) */}
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

// ── Styles ─────────────────────────────────────────────────

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
  // ── Name step
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
  // ── Year step
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
  // ── Chips (interests + tags)
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
  emptyTagsText: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
  },
  // ── Location step
  fieldGroup: {
    width: '100%',
    gap: SPACING.sm,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primaryDark,
    textAlign: 'right',
    marginTop: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.grayLight,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: 16,
    color: COLORS.primaryDark,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  // ── Avatar step
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
  // ── Summary step
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
  // ── Navigation
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
```

- [ ] **Step 2: Verify the import of `BRIDGE_TAGS` is removed from helpers import**

The old line was:
```tsx
import { YEAR_LABELS, INTEREST_OPTIONS, BRIDGE_TAGS } from '../../src/lib/helpers';
```
The new import is:
```tsx
import { YEAR_LABELS, INTEREST_OPTIONS } from '../../src/lib/helpers';
```
Confirm this is correct in the file you just wrote.

- [ ] **Step 3: Commit**

```bash
git add app/(auth)/onboarding.tsx
git commit -m "feat(onboarding): expand to Phase 1 fields — location step, DB tags, onboarding_completed_at"
```

---

### Task 3: Manual verification

These steps confirm the feature works end-to-end in the running app.

- [ ] **Step 1: Start the app**

```bash
npx expo start
```

Scan the QR code or press `i` for iOS simulator / `a` for Android emulator.

- [ ] **Step 2: Test new user onboarding flow**

Sign up with a new email. Verify:
1. App routes to onboarding (not home)
2. Step 1 — Name: entering nothing and pressing "המשך" shows alert
3. Step 2 — Year: selecting nothing and pressing "המשך" shows alert
4. Step 3 — Interests: chips toggle correctly; "דלג" skips to step 4
5. Step 4 — Location: all three TextInputs are RTL; "דלג" works; fields are optional
6. Step 5 — Tags: chips come from DB (not static list); "דלג" works
7. Step 6 — Avatar: camera picker opens; "דלג" works
8. Step 7 — Summary: shows Name, Year, settlement (if entered), interests, selected tag names
9. "סיום" → loading spinner → navigates to main tabs

- [ ] **Step 3: Verify data in Supabase**

In the Supabase Table Editor, open the `users` table and find the new user row. Confirm:
- `full_name` is set
- `year_of_study` is set
- `settlement`, `origin_city`, `academic_track` contain what was entered (or NULL if skipped)
- `onboarding_completed_at` is a timestamp (not NULL)

In the `user_tag_subscriptions` table, confirm rows exist for each tag the user selected.

- [ ] **Step 4: Test returning user does NOT re-enter onboarding**

Force-close the app and reopen. Verify the user goes directly to the main tabs (not back to onboarding), because `onboarding_completed_at` is now set.

- [ ] **Step 5: Test existing users (already have full_name, no onboarding_completed_at)**

Sign in with an old test account that has `full_name` set but `onboarding_completed_at = NULL`. Verify:
- App routes to onboarding (because `onboarding_completed_at` is NULL)
- Completing onboarding sets the timestamp
- On next launch, app routes to home

> **Note for existing test users:** If you want to skip re-onboarding an existing account during development, run this SQL in Supabase:
> ```sql
> UPDATE users SET onboarding_completed_at = NOW() WHERE email = 'your-test@email.com';
> ```

---

## Done ✓

After Task 3 passes, the onboarding feature is complete for Phase 1.

**What this delivers:**
- Users fill in settlement, origin_city, academic_track during onboarding
- Tag subscriptions are saved to `user_tag_subscriptions` (real DB, used by MEDIT for context)
- `onboarding_completed_at` is set once and used as the routing guard
- All fields optional except Name and Year (same as before)
