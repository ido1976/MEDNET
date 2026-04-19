# Profile — Missing Fields & Couple Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the four missing profile fields (graduation year, languages, has children, children ages) and a couple-sync card that lets users find and link a partner.

**Architecture:** All changes are in `app/(tabs)/profile.tsx`. New state variables added at the top, new fields inserted into the existing "Enhanced Profile" card, and a new "Partner" card added below it. The `searchUsers` function from `friendStore` is reused for partner search. `sendPartnerRequest` from `authStore` handles the request. Incoming partner requests are read from Supabase `notifications` table directly in this screen.

**Tech Stack:** React Native, Zustand (`authStore`, `friendStore`), Supabase JS client, existing COLORS/SPACING/RADIUS theme constants.

---

## File Map

| File | Change |
|------|--------|
| `app/(tabs)/profile.tsx` | Add state, new fields, couple sync card, update handleSave |

---

### Task 1: Add missing state variables and constants

**Files:**
- Modify: `app/(tabs)/profile.tsx` (top of component, after existing state declarations)

- [ ] **Step 1: Add `LANGUAGE_OPTIONS` constant above the component**

Find the line:
```tsx
export default function ProfileScreen() {
```

Insert immediately before it:
```tsx
const LANGUAGE_OPTIONS = [
  'עברית', 'אנגלית', 'ערבית', 'רוסית', 'צרפתית', 'ספרדית', 'אמהרית', 'גרוזינית',
];
```

- [ ] **Step 2: Add missing state variables inside the component**

Find the block that ends with:
```tsx
  const [maritalStatus, setMaritalStatus] = useState<'single' | 'in_relationship' | 'married'>(
    user?.marital_status || 'single'
  );
```

Insert immediately after it:
```tsx
  // Missing profile fields
  const [graduationYear, setGraduationYear] = useState<string>(
    user?.graduation_year?.toString() || ''
  );
  const [languages, setLanguages] = useState<string[]>(user?.languages || ['עברית']);
  const [hasChildren, setHasChildren] = useState<boolean>(user?.has_children || false);
  const [childrenAges, setChildrenAges] = useState<string>(
    user?.children_ages?.join(', ') || ''
  );

  // Couple sync
  const [partnerSearch, setPartnerSearch] = useState('');
  const [partnerUser, setPartnerUser] = useState<User | null>(null);
  const [incomingPartnerRequests, setIncomingPartnerRequests] = useState<any[]>([]);
```

- [ ] **Step 3: Add import for supabase at the top of the file**

Find:
```tsx
import type { User, Friendship } from '../../src/types/database';
```

Replace with:
```tsx
import type { User, Friendship } from '../../src/types/database';
import { supabase } from '../../src/lib/supabase';
```

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/profile.tsx"
git commit -m "feat(profile): add missing state variables and language options"
```

---

### Task 2: Sync new fields from user object

**Files:**
- Modify: `app/(tabs)/profile.tsx` — the `useEffect` that syncs user → local state (around line 102)

- [ ] **Step 1: Extend the sync useEffect**

Find:
```tsx
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
```

Replace with:
```tsx
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
      setGraduationYear(user.graduation_year?.toString() || '');
      setLanguages(user.languages || ['עברית']);
      setHasChildren(user.has_children || false);
      setChildrenAges(user.children_ages?.join(', ') || '');
    }
  }, [user?.full_name, user?.year_of_study, user?.interests?.length, (user as any)?.user_type,
      user?.bio, user?.settlement, user?.graduation_year, user?.languages?.length,
      user?.has_children, user?.children_ages?.length]);
```

- [ ] **Step 2: Add partner and incoming requests fetch inside the existing useEffect**

Find:
```tsx
  useEffect(() => {
    if (user?.id) {
      fetchFriends(user.id);
      fetchRequests(user.id);
    }
    fetchAllTags();
  }, [user?.id]);
```

Replace with:
```tsx
  useEffect(() => {
    if (user?.id) {
      fetchFriends(user.id);
      fetchRequests(user.id);
      fetchPartnerData(user.id);
    }
    fetchAllTags();
  }, [user?.id]);
```

- [ ] **Step 3: Add `fetchPartnerData` function after the existing helpers**

Find:
```tsx
  const handleFriendSearch = (text: string) => {
```

Insert immediately before it:
```tsx
  const fetchPartnerData = async (userId: string) => {
    // Fetch linked partner profile (if any)
    if (user?.partner_user_id) {
      const { data } = await supabase
        .from('users')
        .select('id, full_name, avatar_url, year_of_study')
        .eq('id', user.partner_user_id)
        .single();
      if (data) setPartnerUser(data as User);
    }

    // Fetch incoming partner requests (notifications of type 'partner_request')
    const { data: reqs } = await supabase
      .from('notifications')
      .select('id, reference_id')
      .eq('user_id', userId)
      .eq('type', 'partner_request')
      .eq('is_read', false);

    if (reqs && reqs.length > 0) {
      // Resolve requester names
      const requesterIds = reqs.map((r: any) => r.reference_id);
      const { data: requesters } = await supabase
        .from('users')
        .select('id, full_name, avatar_url')
        .in('id', requesterIds);

      setIncomingPartnerRequests(
        reqs.map((r: any) => ({
          notificationId: r.id,
          requesterId: r.reference_id,
          requester: requesters?.find((u: any) => u.id === r.reference_id) || null,
        }))
      );
    }
  };

```

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/profile.tsx"
git commit -m "feat(profile): sync new profile fields and fetch partner/incoming requests"
```

---

### Task 3: Update `handleSave` to include new fields

**Files:**
- Modify: `app/(tabs)/profile.tsx` — `handleSave` function (around line 117)

- [ ] **Step 1: Extend the updateProfile call**

Find:
```tsx
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
```

Replace with:
```tsx
  const handleSave = async () => {
    const parsedChildrenAges = hasChildren && childrenAges.trim()
      ? childrenAges
          .split(',')
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n))
      : [];

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
      graduation_year: graduationYear ? parseInt(graduationYear, 10) : null,
      languages,
      has_children: hasChildren,
      children_ages: parsedChildrenAges,
    } as any);
```

- [ ] **Step 2: Commit**

```bash
git add "app/(tabs)/profile.tsx"
git commit -m "feat(profile): save graduation year, languages, children fields"
```

---

### Task 4: Add missing fields to the Enhanced Profile card

**Files:**
- Modify: `app/(tabs)/profile.tsx` — Enhanced Profile card section (around line 393)

- [ ] **Step 1: Add fields after the marital status field**

Find the closing tag of the Enhanced Profile card:
```tsx
        </View>

        {/* Tag Subscriptions */}
```

Insert the new fields immediately before that closing `</View>`:
```tsx
          <View style={styles.divider} />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>שנת סיום לימודים (משוערת)</Text>
            {editing ? (
              <TextInput
                style={styles.fieldInput}
                value={graduationYear}
                onChangeText={setGraduationYear}
                textAlign="right"
                keyboardType="numeric"
                placeholder="לדוגמה: 2028"
                placeholderTextColor={COLORS.grayLight}
                maxLength={4}
              />
            ) : (
              <Text style={styles.fieldValue}>{user?.graduation_year || '-'}</Text>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>שפות</Text>
            {editing ? (
              <View style={styles.yearRow}>
                {LANGUAGE_OPTIONS.map((lang) => (
                  <TouchableOpacity
                    key={lang}
                    style={[styles.yearChip, languages.includes(lang) && styles.yearChipActive]}
                    onPress={() =>
                      setLanguages((prev) =>
                        prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.yearChipText,
                        languages.includes(lang) && styles.yearChipTextActive,
                      ]}
                    >
                      {lang}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.fieldValue}>
                {user?.languages?.length ? user.languages.join(', ') : 'לא צוין'}
              </Text>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>ילדים</Text>
            {editing ? (
              <View style={styles.yearRow}>
                <TouchableOpacity
                  style={[styles.yearChip, hasChildren && styles.yearChipActive]}
                  onPress={() => setHasChildren(true)}
                >
                  <Text style={[styles.yearChipText, hasChildren && styles.yearChipTextActive]}>
                    יש ילדים
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.yearChip, !hasChildren && styles.yearChipActive]}
                  onPress={() => setHasChildren(false)}
                >
                  <Text style={[styles.yearChipText, !hasChildren && styles.yearChipTextActive]}>
                    אין ילדים
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.fieldValue}>{user?.has_children ? 'יש ילדים' : 'אין ילדים'}</Text>
            )}
          </View>

          {(editing ? hasChildren : user?.has_children) && (
            <>
              <View style={styles.divider} />
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>גילאי ילדים (מופרדים בפסיק)</Text>
                {editing ? (
                  <TextInput
                    style={styles.fieldInput}
                    value={childrenAges}
                    onChangeText={setChildrenAges}
                    textAlign="right"
                    keyboardType="numeric"
                    placeholder="לדוגמה: 3, 7, 12"
                    placeholderTextColor={COLORS.grayLight}
                  />
                ) : (
                  <Text style={styles.fieldValue}>
                    {user?.children_ages?.length ? user.children_ages.join(', ') : '-'}
                  </Text>
                )}
              </View>
            </>
          )}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(tabs)/profile.tsx"
git commit -m "feat(profile): add graduation year, languages, children fields to edit form"
```

---

### Task 5: Add couple sync card

**Files:**
- Modify: `app/(tabs)/profile.tsx` — add new card after the Tag Subscriptions card

The couple sync card:
- Shows linked partner (if `user.partner_user_id` is set)
- Shows incoming partner requests with Accept button
- Shows search + send request if no partner linked

- [ ] **Step 1: Add couple sync helper functions**

Find:
```tsx
  const toggleInterest = (interest: string) => {
```

Insert immediately before it:
```tsx
  const handlePartnerSearch = (text: string) => {
    setPartnerSearch(text);
    if (user?.id) searchUsers(text, user.id);
  };

  const handleSendPartnerRequest = async (targetUserId: string) => {
    const { error } = await sendPartnerRequest(targetUserId);
    if (error) {
      Alert.alert('שגיאה', error);
    } else {
      Alert.alert('נשלח!', 'בקשת שיוך זוגי נשלחה');
      setPartnerSearch('');
    }
  };

  const handleAcceptPartnerRequest = async (notificationId: string, requesterId: string) => {
    const { error } = await acceptPartnerRequest(requesterId);
    if (error) {
      Alert.alert('שגיאה', error);
    } else {
      // Mark notification as read
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
      setIncomingPartnerRequests([]);
      if (user?.id) fetchPartnerData(user.id);
    }
  };

```

- [ ] **Step 2: Add `sendPartnerRequest` and `acceptPartnerRequest` to the destructuring at the top of the component**

Find:
```tsx
  const { user, updateProfile, signOut, subscribedTags, subscribeToTag, unsubscribeFromTag } = useAuthStore();
```

Replace with:
```tsx
  const {
    user, updateProfile, signOut,
    subscribedTags, subscribeToTag, unsubscribeFromTag,
    sendPartnerRequest, acceptPartnerRequest,
  } = useAuthStore();
```

- [ ] **Step 3: Insert the couple sync card into the JSX**

Find:
```tsx
        {/* Profile Completeness */}
```

Insert immediately before it:
```tsx
        {/* Couple Sync */}
        <View style={[styles.card, { marginTop: SPACING.md }]}>
          <Text style={styles.friendsSectionTitle}>שיוך זוגי</Text>

          {/* Linked partner */}
          {user?.partner_user_id && partnerUser ? (
            <View style={styles.friendRow}>
              {partnerUser.avatar_url ? (
                <Image source={{ uri: partnerUser.avatar_url }} style={styles.friendAvatar} />
              ) : (
                <View style={styles.friendAvatarPlaceholder}>
                  <Text style={styles.friendAvatarText}>
                    {getInitials(partnerUser.full_name || '?')}
                  </Text>
                </View>
              )}
              <View style={styles.friendInfo}>
                <Text style={styles.friendName}>{partnerUser.full_name}</Text>
                <Text style={{ fontSize: 12, color: COLORS.gray, textAlign: 'right' }}>
                  {partnerUser.year_of_study ? YEAR_LABELS[partnerUser.year_of_study] : ''}
                </Text>
              </View>
              <Ionicons name="heart" size={20} color={COLORS.accent} />
            </View>
          ) : (
            <>
              {/* Incoming partner requests */}
              {incomingPartnerRequests.length > 0 && (
                <View style={{ marginBottom: SPACING.sm }}>
                  <Text style={styles.requestsTitle}>
                    בקשות שיוך זוגי ({incomingPartnerRequests.length})
                  </Text>
                  {incomingPartnerRequests.map((req) => (
                    <View key={req.notificationId} style={styles.friendRow}>
                      <TouchableOpacity
                        style={styles.acceptBtn}
                        onPress={() =>
                          handleAcceptPartnerRequest(req.notificationId, req.requesterId)
                        }
                      >
                        <Ionicons name="checkmark" size={16} color={COLORS.white} />
                      </TouchableOpacity>
                      <View style={styles.friendInfo}>
                        <Text style={styles.friendName}>
                          {req.requester?.full_name || 'משתמש'}
                        </Text>
                      </View>
                      {req.requester?.avatar_url ? (
                        <Image
                          source={{ uri: req.requester.avatar_url }}
                          style={styles.friendAvatar}
                        />
                      ) : (
                        <View style={styles.friendAvatarPlaceholder}>
                          <Text style={styles.friendAvatarText}>
                            {getInitials(req.requester?.full_name || '?')}
                          </Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* Partner search */}
              <Text style={{ fontSize: 13, color: COLORS.gray, textAlign: 'right', marginBottom: SPACING.sm }}>
                חפש את השותף/ה שלך לשיוך הפרופילים
              </Text>
              <View style={styles.friendSearchRow}>
                <Ionicons name="search" size={18} color={COLORS.gray} />
                <TextInput
                  style={styles.friendSearchInput}
                  placeholder="חפש לפי שם..."
                  placeholderTextColor={COLORS.grayLight}
                  value={partnerSearch}
                  onChangeText={handlePartnerSearch}
                  textAlign="right"
                />
              </View>

              {partnerSearch.length > 0 && searchResults.length > 0 && (
                <View style={styles.searchResultsList}>
                  {searchResults.map((u) => (
                    <View key={u.id} style={styles.friendRow}>
                      <TouchableOpacity
                        style={styles.addFriendBtn}
                        onPress={() => handleSendPartnerRequest(u.id)}
                      >
                        <Ionicons name="heart-outline" size={16} color={COLORS.primary} />
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
            </>
          )}
        </View>

```

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/profile.tsx"
git commit -m "feat(profile): add couple sync card — search, send request, accept, show partner"
```

---

### Task 6: Manual verification

- [ ] **Step 1: Start the app**

```bash
npx expo start
```

- [ ] **Step 2: Test missing fields**

Sign in → go to Profile → press "ערוך". Verify:
- "שנת סיום לימודים" field appears with numeric keyboard
- "שפות" shows language chips (עברית, אנגלית, etc.) that toggle on/off
- "ילדים" shows יש/אין toggle
- Selecting "יש ילדים" reveals the "גילאי ילדים" text field
- Press "שמור" → fields persist after leaving and returning to profile

Verify in Supabase `users` table: `graduation_year`, `languages`, `has_children`, `children_ages` columns are saved.

- [ ] **Step 3: Test couple sync — send request**

With User A: open Profile → scroll to "שיוך זוגי" → type User B's name → see them in results → tap the heart icon → "נשלח!" alert appears.

Verify in Supabase `notifications` table: a row with `type = 'partner_request'`, `user_id = B.id`, `reference_id = A.id`.

- [ ] **Step 4: Test couple sync — accept request**

Sign in as User B → open Profile → scroll to "שיוך זוגי" → see incoming request from User A → tap ✓ → both profiles should show the partner card.

Verify in Supabase `users` table: both A and B have `partner_user_id` set to each other's ID.

---

## Done ✓

After Task 6 passes, all Phase 1 profile fields are complete and couple sync works end-to-end.
