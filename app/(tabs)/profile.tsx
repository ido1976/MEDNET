import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  TextInput,
  Alert,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import ScreenWrapper from '../../src/components/ScreenWrapper';
import HamburgerMenu from '../../src/components/HamburgerMenu';
import TagSelector from '../../src/components/TagSelector';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../src/constants/theme';
import { useAuthStore } from '../../src/stores/authStore';
import { useBridgeStore } from '../../src/stores/bridgeStore';
import { useFriendStore } from '../../src/stores/friendStore';
import { getInitials, YEAR_LABELS, INTEREST_OPTIONS } from '../../src/lib/helpers';
import type { User, Friendship } from '../../src/types/database';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, updateProfile, signOut, subscribedTags, subscribeToTag, unsubscribeFromTag } = useAuthStore();
  const { allTags, fetchAllTags, createTag } = useBridgeStore();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [yearOfStudy, setYearOfStudy] = useState<number | null>(user?.year_of_study || null);
  const [interests, setInterests] = useState<string[]>(user?.interests || []);
  const [userType, setUserType] = useState<'student' | 'family_member'>(
    (user as any)?.user_type || 'student'
  );
  // Enhanced profile fields
  const [bio, setBio] = useState(user?.bio || '');
  const [settlement, setSettlement] = useState(user?.settlement || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [academicTrack, setAcademicTrack] = useState(user?.academic_track || '');
  const [originCity, setOriginCity] = useState(user?.origin_city || '');
  const [maritalStatus, setMaritalStatus] = useState<'single' | 'in_relationship' | 'married'>(
    user?.marital_status || 'single'
  );

  // Friends
  const {
    friends, incomingRequests, searchResults, loading: friendsLoading,
    fetchFriends, fetchRequests, searchUsers, sendFriendRequest, acceptFriend, rejectFriend,
  } = useFriendStore();
  const [friendSearch, setFriendSearch] = useState('');

  useEffect(() => {
    if (user?.id) {
      fetchFriends(user.id);
      fetchRequests(user.id);
    }
    fetchAllTags();
  }, [user?.id]);

  const handleFriendSearch = (text: string) => {
    setFriendSearch(text);
    if (user?.id) searchUsers(text, user.id);
  };

  const handleSendRequest = async (addresseeId: string) => {
    if (!user?.id) return;
    const result = await sendFriendRequest(user.id, addresseeId);
    if (result.error) {
      Alert.alert('שגיאה', result.error);
    } else {
      Alert.alert('נשלח', 'בקשת חברות נשלחה');
      setFriendSearch('');
      searchUsers('', user.id);
    }
  };

  const handleAcceptFriend = async (friendshipId: string) => {
    const result = await acceptFriend(friendshipId);
    if (!result.error && user?.id) {
      fetchFriends(user.id);
      fetchRequests(user.id);
    }
  };

  const handleRejectFriend = async (friendshipId: string) => {
    const result = await rejectFriend(friendshipId);
    if (!result.error && user?.id) {
      fetchRequests(user.id);
    }
  };

  const getFriendUser = (friendship: Friendship): any => {
    const req = (friendship as any).requester;
    const addr = (friendship as any).addressee;
    if (req?.id === user?.id) return addr;
    return req;
  };

  // Sync local state when user data loads/changes
  React.useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setYearOfStudy(user.year_of_study || null);
      setInterests(user.interests || []);
      setUserType((user as any)?.user_type || 'student');
      setBio(user.bio || '');
      setSettlement(user.settlement || '');
      setPhone(user.phone || '');
      setAcademicTrack(user.academic_track || '');
      setOriginCity(user.origin_city || '');
      setMaritalStatus(user.marital_status || 'single');
    }
  }, [user?.full_name, user?.year_of_study, user?.interests?.length, (user as any)?.user_type, user?.bio, user?.settlement]);

  const handleSave = async () => {
    const { error } = await updateProfile({
      full_name: fullName,
      year_of_study: yearOfStudy,
      interests,
      user_type: userType,
      bio,
      settlement,
      phone,
      academic_track: academicTrack,
      origin_city: originCity,
      marital_status: maritalStatus,
    } as any);
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
          <View style={styles.divider} />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>סוג משתמש</Text>
            {editing ? (
              <View style={styles.yearRow}>
                <TouchableOpacity
                  style={[styles.yearChip, userType === 'student' && styles.yearChipActive]}
                  onPress={() => setUserType('student')}
                >
                  <Text style={[styles.yearChipText, userType === 'student' && styles.yearChipTextActive]}>
                    סטודנט
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.yearChip, userType === 'family_member' && styles.yearChipActive]}
                  onPress={() => setUserType('family_member')}
                >
                  <Text style={[styles.yearChipText, userType === 'family_member' && styles.yearChipTextActive]}>
                    בן משפחה של סטודנט
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.fieldValue}>
                {userType === 'family_member' ? 'בן משפחה של סטודנט' : 'סטודנט'}
              </Text>
            )}
          </View>
        </View>

        {/* Enhanced Profile Fields */}
        <View style={[styles.card, { marginTop: SPACING.md }]}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>אודות</Text>
            {editing ? (
              <TextInput
                style={[styles.fieldInput, { minHeight: 60 }]}
                value={bio}
                onChangeText={setBio}
                textAlign="right"
                multiline
                placeholder="ספר על עצמך..."
                placeholderTextColor={COLORS.grayLight}
              />
            ) : (
              <Text style={styles.fieldValue}>{user?.bio || '-'}</Text>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>ישוב מגורים</Text>
            {editing ? (
              <TextInput style={styles.fieldInput} value={settlement} onChangeText={setSettlement} textAlign="right" placeholder="למשל: צפת, כרמיאל..." placeholderTextColor={COLORS.grayLight} />
            ) : (
              <Text style={styles.fieldValue}>{user?.settlement || '-'}</Text>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>עיר מוצא</Text>
            {editing ? (
              <TextInput style={styles.fieldInput} value={originCity} onChangeText={setOriginCity} textAlign="right" placeholder="העיר שגדלת בה..." placeholderTextColor={COLORS.grayLight} />
            ) : (
              <Text style={styles.fieldValue}>{user?.origin_city || '-'}</Text>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>טלפון</Text>
            {editing ? (
              <TextInput style={styles.fieldInput} value={phone} onChangeText={setPhone} textAlign="right" keyboardType="phone-pad" placeholder="050-..." placeholderTextColor={COLORS.grayLight} />
            ) : (
              <Text style={styles.fieldValue}>{user?.phone || '-'}</Text>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>מסלול / התמחות</Text>
            {editing ? (
              <TextInput style={styles.fieldInput} value={academicTrack} onChangeText={setAcademicTrack} textAlign="right" placeholder="למשל: כירורגיה, פנימית..." placeholderTextColor={COLORS.grayLight} />
            ) : (
              <Text style={styles.fieldValue}>{user?.academic_track || '-'}</Text>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>מצב משפחתי</Text>
            {editing ? (
              <View style={styles.yearRow}>
                {([['single', 'רווק/ה'], ['in_relationship', 'בזוגיות'], ['married', 'נשוי/אה']] as const).map(([value, label]) => (
                  <TouchableOpacity
                    key={value}
                    style={[styles.yearChip, maritalStatus === value && styles.yearChipActive]}
                    onPress={() => setMaritalStatus(value)}
                  >
                    <Text style={[styles.yearChipText, maritalStatus === value && styles.yearChipTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.fieldValue}>
                {maritalStatus === 'married' ? 'נשוי/אה' : maritalStatus === 'in_relationship' ? 'בזוגיות' : 'רווק/ה'}
              </Text>
            )}
          </View>
        </View>

        {/* Tag Subscriptions */}
        <View style={[styles.card, { marginTop: SPACING.md }]}>
          <TagSelector
            label="תיוגים שאני עוקב/ת אחריהם"
            allTags={allTags}
            selectedTags={subscribedTags}
            onToggleTag={(tagId) => {
              if (subscribedTags.some((t) => t.id === tagId)) {
                unsubscribeFromTag(tagId);
              } else {
                subscribeToTag(tagId);
              }
            }}
            onCreateTag={createTag}
          />
        </View>

        {/* Profile Completeness */}
        {user?.profile_completeness !== undefined && user.profile_completeness < 100 && (
          <View style={[styles.card, { marginTop: SPACING.md }]}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>השלמת פרופיל</Text>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${user.profile_completeness}%` }]} />
              </View>
              <Text style={[styles.fieldValue, { fontSize: 13, marginTop: 4 }]}>
                {user.profile_completeness}% — מלא את הפרופיל כדי שהצ'אט יכיר אותך טוב יותר
              </Text>
            </View>
          </View>
        )}

        {/* Role Badge */}
        <View style={styles.roleCard}>
          <Ionicons name="shield-checkmark" size={22} color={COLORS.primary} />
          <Text style={styles.roleText}>
            {user?.role === 'admin' ? 'מנהל' : user?.role === 'moderator' ? 'מנחה' : 'סטודנט'}
          </Text>
        </View>

        {/* Friends Section */}
        <View style={styles.friendsSection}>
          <Text style={styles.friendsSectionTitle}>חברים</Text>

          {/* Search */}
          <View style={styles.friendSearchRow}>
            <Ionicons name="search" size={18} color={COLORS.gray} />
            <TextInput
              style={styles.friendSearchInput}
              placeholder="חפש חברים..."
              placeholderTextColor={COLORS.grayLight}
              value={friendSearch}
              onChangeText={handleFriendSearch}
              textAlign="right"
            />
          </View>

          {/* Search Results */}
          {friendSearch.length > 0 && searchResults.length > 0 && (
            <View style={styles.searchResultsList}>
              {searchResults.map((u) => (
                <View key={u.id} style={styles.friendRow}>
                  <TouchableOpacity
                    style={styles.addFriendBtn}
                    onPress={() => handleSendRequest(u.id)}
                  >
                    <Ionicons name="person-add" size={16} color={COLORS.primary} />
                  </TouchableOpacity>
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName}>{u.full_name}</Text>
                  </View>
                  {u.avatar_url ? (
                    <Image source={{ uri: u.avatar_url }} style={styles.friendAvatar} />
                  ) : (
                    <View style={styles.friendAvatarPlaceholder}>
                      <Text style={styles.friendAvatarText}>{getInitials(u.full_name)}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Incoming Requests */}
          {incomingRequests.length > 0 && (
            <View style={styles.requestsSection}>
              <Text style={styles.requestsTitle}>בקשות חברות ({incomingRequests.length})</Text>
              {incomingRequests.map((req) => {
                const reqUser = (req as any).requester;
                return (
                  <View key={req.id} style={styles.friendRow}>
                    <View style={styles.requestActions}>
                      <TouchableOpacity
                        style={styles.acceptBtn}
                        onPress={() => handleAcceptFriend(req.id)}
                      >
                        <Ionicons name="checkmark" size={16} color={COLORS.white} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.rejectBtn}
                        onPress={() => handleRejectFriend(req.id)}
                      >
                        <Ionicons name="close" size={16} color={COLORS.red} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.friendInfo}>
                      <Text style={styles.friendName}>{reqUser?.full_name || 'משתמש'}</Text>
                    </View>
                    {reqUser?.avatar_url ? (
                      <Image source={{ uri: reqUser.avatar_url }} style={styles.friendAvatar} />
                    ) : (
                      <View style={styles.friendAvatarPlaceholder}>
                        <Text style={styles.friendAvatarText}>{getInitials(reqUser?.full_name || '?')}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Friends List */}
          {friends.length > 0 ? (
            friends.map((f) => {
              const friendUser = getFriendUser(f);
              return (
                <View key={f.id} style={styles.friendRow}>
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName}>{friendUser?.full_name || 'משתמש'}</Text>
                  </View>
                  {friendUser?.avatar_url ? (
                    <Image source={{ uri: friendUser.avatar_url }} style={styles.friendAvatar} />
                  ) : (
                    <View style={styles.friendAvatarPlaceholder}>
                      <Text style={styles.friendAvatarText}>{getInitials(friendUser?.full_name || '?')}</Text>
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            <Text style={styles.noFriendsText}>אין חברים עדיין - חפש והוסף חברים!</Text>
          )}
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
  // Friends
  friendsSection: {
    width: '100%',
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginTop: SPACING.md,
    ...SHADOWS.card,
  },
  friendsSectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.primaryDark,
    textAlign: 'right',
    marginBottom: SPACING.sm,
  },
  friendSearchRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: COLORS.cream,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md,
    height: 40,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.grayLight,
    marginBottom: SPACING.sm,
  },
  friendSearchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.black,
    writingDirection: 'rtl',
  },
  searchResultsList: {
    backgroundColor: COLORS.cream,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.grayLight,
  },
  friendRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  friendAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  friendAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatarText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  friendInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  friendName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primaryDark,
  },
  addFriendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestsSection: {
    marginBottom: SPACING.sm,
  },
  requestsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.accent,
    textAlign: 'right',
    marginBottom: SPACING.xs,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noFriendsText: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    paddingVertical: SPACING.md,
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
  progressBarBg: {
    width: '100%',
    height: 8,
    backgroundColor: COLORS.grayLight,
    borderRadius: 4,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
});
