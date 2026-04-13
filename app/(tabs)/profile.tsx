import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import ScreenWrapper from '../../src/components/ScreenWrapper';
import HamburgerMenu from '../../src/components/HamburgerMenu';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../src/constants/theme';
import { useAuthStore } from '../../src/stores/authStore';
import { getInitials, YEAR_LABELS, INTEREST_OPTIONS } from '../../src/lib/helpers';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, updateProfile, signOut } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [yearOfStudy, setYearOfStudy] = useState<number | null>(user?.year_of_study || null);
  const [interests, setInterests] = useState<string[]>(user?.interests || []);

  // Sync local state when user data loads/changes
  React.useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setYearOfStudy(user.year_of_study || null);
      setInterests(user.interests || []);
    }
  }, [user?.full_name, user?.year_of_study, user?.interests?.length]);

  const handleSave = async () => {
    const { error } = await updateProfile({
      full_name: fullName,
      year_of_study: yearOfStudy,
      interests,
    });
    if (error) {
      Alert.alert('שגיאה', error);
    } else {
      setEditing(false);
    }
  };

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      await updateProfile({ avatar_url: result.assets[0].uri });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/welcome');
  };

  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <HamburgerMenu />
        <Text style={styles.headerTitle}>פרופיל</Text>
        <TouchableOpacity onPress={() => (editing ? handleSave() : setEditing(true))}>
          <Text style={styles.editBtn}>{editing ? 'שמור' : 'ערוך'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <TouchableOpacity style={styles.avatarContainer} onPress={pickAvatar}>
          {user?.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {user?.full_name ? getInitials(user.full_name) : '?'}
              </Text>
            </View>
          )}
          <View style={styles.cameraIcon}>
            <Ionicons name="camera" size={16} color={COLORS.white} />
          </View>
        </TouchableOpacity>

        {/* Info Card */}
        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>שם מלא</Text>
            {editing ? (
              <TextInput
                style={styles.fieldInput}
                value={fullName}
                onChangeText={setFullName}
                textAlign="right"
              />
            ) : (
              <Text style={styles.fieldValue}>{user?.full_name || '-'}</Text>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>אימייל</Text>
            <Text style={styles.fieldValue}>{user?.email || '-'}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>שנת לימודים</Text>
            {editing ? (
              <View style={styles.yearRow}>
                {Object.entries(YEAR_LABELS).map(([year, label]) => (
                  <TouchableOpacity
                    key={year}
                    style={[
                      styles.yearChip,
                      yearOfStudy === Number(year) && styles.yearChipActive,
                    ]}
                    onPress={() => setYearOfStudy(Number(year))}
                  >
                    <Text
                      style={[
                        styles.yearChipText,
                        yearOfStudy === Number(year) && styles.yearChipTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.fieldValue}>
                {user?.year_of_study ? YEAR_LABELS[user.year_of_study] : '-'}
              </Text>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>תחומי עניין</Text>
            {editing ? (
              <View style={styles.interestsGrid}>
                {INTEREST_OPTIONS.map((interest) => (
                  <TouchableOpacity
                    key={interest}
                    style={[
                      styles.interestChip,
                      interests.includes(interest) && styles.interestChipActive,
                    ]}
                    onPress={() => toggleInterest(interest)}
                  >
                    <Text
                      style={[
                        styles.interestChipText,
                        interests.includes(interest) && styles.interestChipTextActive,
                      ]}
                    >
                      {interest}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.fieldValue}>
                {user?.interests?.length ? user.interests.join(', ') : 'לא נבחרו'}
              </Text>
            )}
          </View>
        </View>

        {/* Role Badge */}
        <View style={styles.roleCard}>
          <Ionicons name="shield-checkmark" size={22} color={COLORS.primary} />
          <Text style={styles.roleText}>
            {user?.role === 'admin' ? 'מנהל' : user?.role === 'moderator' ? 'מנחה' : 'סטודנט'}
          </Text>
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out" size={22} color={COLORS.red} />
          <Text style={styles.signOutText}>התנתקות</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  editBtn: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },
  scroll: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 100,
    alignItems: 'center',
  },
  avatarContainer: {
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 32,
    fontWeight: '700',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.cream,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.card,
  },
  field: {
    paddingVertical: SPACING.sm,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray,
    textAlign: 'right',
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 16,
    color: COLORS.primaryDark,
    textAlign: 'right',
  },
  fieldInput: {
    fontSize: 16,
    color: COLORS.primaryDark,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary,
    paddingVertical: 4,
    writingDirection: 'rtl',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.grayLight,
    marginVertical: SPACING.xs,
  },
  yearRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  yearChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.grayLight,
  },
  yearChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  yearChipText: {
    fontSize: 12,
    color: COLORS.primaryDark,
  },
  yearChipTextActive: {
    color: COLORS.white,
  },
  interestsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  interestChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.grayLight,
  },
  interestChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  interestChipText: {
    fontSize: 12,
    color: COLORS.primaryDark,
  },
  interestChipTextActive: {
    color: COLORS.white,
  },
  roleCard: {
    width: '100%',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.md,
    gap: SPACING.sm,
    ...SHADOWS.card,
  },
  roleText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primaryDark,
  },
  signOutBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginTop: SPACING.xl,
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.red,
  },
});
