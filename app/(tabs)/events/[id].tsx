import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Image,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import ScreenWrapper from '../../../src/components/ScreenWrapper';
import DatePickerField from '../../../src/components/DatePickerField';
import ChipPicker from '../../../src/components/ChipPicker';
import { useSharedListsStore } from '../../../src/stores/sharedListsStore';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../../src/constants/theme';
import { trackView } from '../../../src/lib/activityTracker';
import { uploadImage } from '../../../src/lib/uploadImage';
import { useEventStore } from '../../../src/stores/eventStore';
import { useAuthStore } from '../../../src/stores/authStore';
import { supabase } from '../../../src/lib/supabase';
import { formatDate, formatTime } from '../../../src/lib/helpers';
import type { Discussion } from '../../../src/types/database';

const MONTHS_HE = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { currentEvent, fetchEvent, rsvps, fetchRsvps, toggleRsvp, updateEvent, deleteEvent } = useEventStore();
  const [loading, setLoading] = useState(true);
  const [eventDiscussions, setEventDiscussions] = useState<Discussion[]>([]);

  // Edit modal state
  const [showEdit, setShowEdit] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editLink, setEditLink] = useState('');
  const [editDate, setEditDate] = useState<Date | null>(null);
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [editImage, setEditImage] = useState<string | null>(null);

  const { categories: sharedCategories, addCategory } = useSharedListsStore();
  const eventCategories = sharedCategories.events || ['כללי', 'לימודים', 'חברתי', 'ספורט', 'תרבות', 'התנדבות'];
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  // Refresh discussions when returning from the discussions screen
  useFocusEffect(
    useCallback(() => {
      if (id) loadDiscussions();
    }, [id])
  );

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    trackView('event', id);
    await Promise.all([
      fetchEvent(id),
      fetchRsvps(id),
      loadDiscussions(),
    ]);
    setLoading(false);
  };

  const loadDiscussions = async () => {
    if (!id) return;
    const { data } = await supabase
      .from('discussions')
      .select('*, bridge:bridges(name)')
      .eq('event_id', id)
      .order('last_message_at', { ascending: false });
    setEventDiscussions((data || []) as Discussion[]);
  };

  const eventRsvps = rsvps.filter((r) => r.event_id === id);
  const goingCount = eventRsvps.filter((r) => r.status === 'going').length;
  const maybeCount = eventRsvps.filter((r) => r.status === 'maybe').length;
  const isGoing = eventRsvps.some((r) => r.user_id === user?.id && r.status === 'going');
  const isMaybe = eventRsvps.some((r) => r.user_id === user?.id && r.status === 'maybe');
  const isOwner = currentEvent?.created_by === user?.id;

  const handleGoingRsvp = async () => {
    if (!user?.id || !id) return;
    await toggleRsvp(id, user.id, 'going');
  };

  const handleMaybeRsvp = async () => {
    if (!user?.id || !id) return;
    await toggleRsvp(id, user.id, 'maybe');
  };

  const openEdit = () => {
    if (!currentEvent) return;
    setEditTitle(currentEvent.title || '');
    setEditDesc(currentEvent.description || '');
    setEditLocation(currentEvent.location || '');
    setEditLink(currentEvent.link || '');
    setEditCategories(
      currentEvent.categories?.length
        ? currentEvent.categories
        : currentEvent.category
          ? [currentEvent.category]
          : []
    );
    setEditImage(currentEvent.image_url || null);
    try {
      setEditDate(currentEvent.date ? new Date(currentEvent.date) : null);
    } catch {
      setEditDate(null);
    }
    setShowEdit(true);
  };

  const pickEditImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      setEditImage(result.assets[0].uri);
    }
  };

  const handleUpdate = async () => {
    if (!editTitle.trim() || !id) {
      Alert.alert('שגיאה', 'נא להזין כותרת');
      return;
    }
    setIsSaving(true);
    try {
      let eventDate: string;
      try {
        eventDate = editDate ? editDate.toISOString() : (currentEvent?.date || new Date().toISOString());
      } catch {
        eventDate = currentEvent?.date || new Date().toISOString();
      }

      // Upload new image if local URI selected
      let imageUrl = currentEvent?.image_url || null;
      if (editImage && editImage.startsWith('file')) {
        try {
          imageUrl = await uploadImage(editImage, 'event-images');
        } catch (err) {
          console.warn('Edit image upload failed:', err);
        }
      } else if (editImage) {
        imageUrl = editImage;
      }

      const result = await updateEvent(id, {
        title: editTitle.trim(),
        description: editDesc.trim(),
        location: editLocation.trim() || undefined,
        link: editLink.trim() || undefined,
        date: eventDate,
        category: editCategories[0] || 'כללי',
        categories: editCategories,
        image_url: imageUrl,
      });

      if (result.error) {
        Alert.alert('שגיאה', result.error);
      } else {
        setShowEdit(false);
      }
    } catch (err: any) {
      Alert.alert('שגיאה', err.message || 'שגיאה לא צפויה');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('מחיקת אירוע', 'בטוח שברצונך למחוק את האירוע?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק',
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          const result = await deleteEvent(id);
          if (result.error) {
            Alert.alert('שגיאה', result.error);
          } else {
            router.back();
          }
        },
      },
    ]);
  };

  if (loading || !currentEvent) {
    return (
      <ScreenWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  const date = new Date(currentEvent.date);

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-forward" size={24} color={COLORS.primaryDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{currentEvent.title}</Text>
          {isOwner ? (
            <TouchableOpacity onPress={openEdit}>
              <Ionicons name="create-outline" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 24 }} />
          )}
        </View>

        {/* Image */}
        {currentEvent.image_url && (
          <Image source={{ uri: currentEvent.image_url }} style={styles.eventImage} />
        )}

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.eventTitle}>{currentEvent.title}</Text>
          {currentEvent.description ? (
            <Text style={styles.eventDesc}>{currentEvent.description}</Text>
          ) : null}

          <View style={styles.metaRow}>
            <Ionicons name="calendar" size={18} color={COLORS.primary} />
            <Text style={styles.metaValue}>
              {date.getDate()} {MONTHS_HE[date.getMonth()]} {date.getFullYear()} · {formatTime(currentEvent.date)}
            </Text>
          </View>

          {currentEvent.location ? (
            <View style={styles.metaRow}>
              <Ionicons name="location" size={18} color={COLORS.primary} />
              <Text style={styles.metaValue}>{currentEvent.location}</Text>
            </View>
          ) : null}

          {currentEvent.link ? (
            <TouchableOpacity style={styles.metaRow} onPress={() => Linking.openURL(currentEvent.link!)}>
              <Ionicons name="link" size={18} color={COLORS.primary} />
              <Text style={[styles.metaValue, { color: COLORS.primary, textDecorationLine: 'underline' }]}>
                {currentEvent.link}
              </Text>
            </TouchableOpacity>
          ) : null}

          {(currentEvent as any).bridge?.name && (
            <View style={styles.metaRow}>
              <Ionicons name="git-network" size={18} color={COLORS.primary} />
              <Text style={styles.metaValue}>{(currentEvent as any).bridge.name}</Text>
            </View>
          )}

          {(currentEvent as any).creator?.full_name && (
            <View style={styles.metaRow}>
              <Ionicons name="person" size={18} color={COLORS.primary} />
              <Text style={styles.metaValue}>נוצר ע״י {(currentEvent as any).creator.full_name}</Text>
            </View>
          )}

          {/* Multi-category badges */}
          {(currentEvent.categories?.length
            ? currentEvent.categories
            : currentEvent.category
              ? [currentEvent.category]
              : []
          ).length > 0 && (
            <View style={styles.catBadgesRow}>
              {(currentEvent.categories?.length
                ? currentEvent.categories
                : currentEvent.category
                  ? [currentEvent.category]
                  : []
              ).map((cat) => (
                <View key={cat} style={styles.categoryChip}>
                  <Text style={styles.categoryText}>{cat}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* RSVP Section */}
        <View style={styles.rsvpSection}>
          <Text style={styles.sectionTitle}>השתתפות</Text>

          {/* Counts */}
          {(goingCount > 0 || maybeCount > 0) && (
            <Text style={styles.rsvpSummary}>
              {goingCount > 0 ? `${goingCount} יצטרפו` : ''}
              {goingCount > 0 && maybeCount > 0 ? ' · ' : ''}
              {maybeCount > 0 ? `${maybeCount} מעוניינים` : ''}
            </Text>
          )}

          {/* Action buttons */}
          <View style={styles.rsvpButtons}>
            <TouchableOpacity
              style={[styles.rsvpMainBtn, isGoing && styles.rsvpMainBtnActive]}
              onPress={handleGoingRsvp}
            >
              <Ionicons
                name={isGoing ? 'checkmark-circle' : 'checkmark-circle-outline'}
                size={20}
                color={isGoing ? COLORS.white : COLORS.primary}
              />
              <Text style={[styles.rsvpMainBtnText, isGoing && styles.rsvpMainBtnTextActive]}>
                {isGoing ? 'מגיע/ה ✓' : 'אצטרף'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.rsvpMaybeBtn, isMaybe && styles.rsvpMaybeBtnActive]}
              onPress={handleMaybeRsvp}
            >
              <Ionicons
                name={isMaybe ? 'star' : 'star-outline'}
                size={20}
                color={isMaybe ? COLORS.white : '#F59E0B'}
              />
              <Text style={[styles.rsvpMaybeBtnText, isMaybe && styles.rsvpMaybeBtnTextActive]}>
                {isMaybe ? 'מעוניין/ת ★' : 'מעוניין/ת'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Attendees list — going + maybe with avatar */}
          {(goingCount > 0 || maybeCount > 0) && (
            <View style={styles.attendeesList}>
              <Text style={styles.attendeesTitle}>
                {goingCount > 0 ? `${goingCount} מאשרים` : ''}
                {goingCount > 0 && maybeCount > 0 ? ' · ' : ''}
                {maybeCount > 0 ? `${maybeCount} מעוניינים` : ''}
              </Text>
              {eventRsvps
                .filter((r) => r.status === 'going' || r.status === 'maybe')
                .slice(0, 6)
                .map((r, i) => (
                  <View key={i} style={styles.attendeeRow}>
                    {(r as any).user?.avatar_url ? (
                      <Image
                        source={{ uri: (r as any).user.avatar_url }}
                        style={styles.attendeeAvatar}
                      />
                    ) : (
                      <View style={[
                        styles.attendeeAvatarPlaceholder,
                        r.status === 'maybe' && styles.attendeeMaybePlaceholder,
                      ]}>
                        <Ionicons name="person" size={14} color={COLORS.white} />
                      </View>
                    )}
                    <Text style={styles.attendeeName}>
                      {(r as any).user?.full_name || 'משתמש'}
                    </Text>
                    {r.status === 'maybe' && (
                      <Text style={styles.attendeeStatusBadge}>מעוניין/ת</Text>
                    )}
                  </View>
                ))}
              {(goingCount + maybeCount) > 6 && (
                <Text style={styles.moreAttendeesText}>ועוד {(goingCount + maybeCount) - 6}...</Text>
              )}
            </View>
          )}
        </View>

        {/* Discussions Section */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionActions}>
            <TouchableOpacity
              onPress={() => {
                const tags = encodeURIComponent(
                  (currentEvent.categories?.join(',') || currentEvent.category || '')
                );
                router.push(
                  `/(tabs)/discussions/?eventId=${id}&bridgeId=${currentEvent.bridge_id || ''}&openCreate=true&eventTags=${tags}`
                );
              }}
            >
              <Ionicons name="add-circle-outline" size={22} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push(`/(tabs)/discussions/?eventId=${id}`)}>
              <Text style={styles.seeAll}>הצג הכל</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionTitle}>דיונים</Text>
        </View>

        {eventDiscussions.length === 0 ? (
          <TouchableOpacity
            style={styles.createDiscussionCard}
            onPress={() => {
              const tags = encodeURIComponent(
                (currentEvent.categories?.join(',') || currentEvent.category || '')
              );
              router.push(
                `/(tabs)/discussions/?eventId=${id}&bridgeId=${currentEvent.bridge_id || ''}&openCreate=true&eventTags=${tags}`
              );
            }}
          >
            <Ionicons name="chatbubble-outline" size={20} color={COLORS.primary} />
            <Text style={styles.createDiscussionText}>+ פתח דיון על אירוע זה</Text>
          </TouchableOpacity>
        ) : (
          eventDiscussions.slice(0, 3).map((disc) => (
            <TouchableOpacity
              key={disc.id}
              style={styles.discussionItem}
              onPress={() => router.push(`/(tabs)/discussions/${disc.id}`)}
            >
              <View style={styles.discussionInfo}>
                <Text style={styles.discussionTitle}>{disc.title}</Text>
                <View style={styles.discussionMeta}>
                  <Ionicons name="people" size={14} color={COLORS.gray} />
                  <Text style={styles.discussionMetaText}>{disc.participants_count}</Text>
                  <Ionicons name="pricetag" size={14} color={COLORS.gray} />
                  <Text style={styles.discussionMetaText}>{disc.tag}</Text>
                </View>
              </View>
              <Ionicons name="chevron-back" size={18} color={COLORS.grayLight} />
            </TouchableOpacity>
          ))
        )}

        {/* Owner Actions */}
        {isOwner && (
          <View style={styles.ownerActions}>
            <TouchableOpacity style={styles.editBtn} onPress={openEdit}>
              <Ionicons name="create-outline" size={18} color={COLORS.white} />
              <Text style={styles.editBtnText}>ערוך אירוע</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={18} color={COLORS.red} />
              <Text style={styles.deleteBtnText}>מחק אירוע</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={showEdit} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowEdit(false)}>
                <Ionicons name="close" size={24} color={COLORS.gray} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>עריכת אירוע</Text>
              <View style={{ width: 24 }} />
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              <TextInput
                style={styles.modalInput}
                placeholder="שם האירוע *"
                value={editTitle}
                onChangeText={setEditTitle}
                textAlign="right"
                placeholderTextColor={COLORS.grayLight}
              />
              <TextInput
                style={[styles.modalInput, { height: 80 }]}
                placeholder="תיאור"
                value={editDesc}
                onChangeText={setEditDesc}
                textAlign="right"
                multiline
                placeholderTextColor={COLORS.grayLight}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="מיקום"
                value={editLocation}
                onChangeText={setEditLocation}
                textAlign="right"
                placeholderTextColor={COLORS.grayLight}
              />
              <Text style={styles.modalLabel}>תאריך האירוע:</Text>
              <DatePickerField
                value={editDate}
                onChange={setEditDate}
                placeholder="בחר תאריך"
              />
              <TextInput
                style={styles.modalInput}
                placeholder="קישור (אופציונלי)"
                value={editLink}
                onChangeText={setEditLink}
                textAlign="right"
                placeholderTextColor={COLORS.grayLight}
                keyboardType="url"
                autoCapitalize="none"
              />
              <ChipPicker
                label="קטגוריות (אפשר לבחור כמה):"
                items={eventCategories}
                multiSelect
                selectedMulti={editCategories}
                onSelectMulti={setEditCategories}
                onAddNew={(cat) => addCategory('events', cat)}
                placeholder="קטגוריה חדשה..."
              />

              <Text style={styles.modalLabel}>תמונה:</Text>
              <TouchableOpacity style={styles.imagePickerBtn} onPress={pickEditImage}>
                {editImage ? (
                  <Image source={{ uri: editImage }} style={styles.imagePreview} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name="camera-outline" size={28} color={COLORS.gray} />
                    <Text style={styles.imagePlaceholderText}>הוסף תמונה</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.createBtn, isSaving && { opacity: 0.7 }]}
                onPress={handleUpdate}
                disabled={isSaving}
              >
                {isSaving
                  ? <ActivityIndicator color={COLORS.white} />
                  : <Text style={styles.createBtnText}>שמור שינויים</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primaryDark,
    flex: 1,
    textAlign: 'center',
  },
  eventImage: {
    width: '100%',
    height: 200,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
  },
  infoCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.sm,
    ...SHADOWS.card,
  },
  eventTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primaryDark,
    textAlign: 'right',
  },
  eventDesc: {
    fontSize: 15,
    color: COLORS.gray,
    textAlign: 'right',
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  metaValue: {
    fontSize: 14,
    color: COLORS.primaryDark,
    flex: 1,
    textAlign: 'right',
  },
  catBadgesRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  categoryChip: {
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: RADIUS.xl,
    marginTop: SPACING.xs,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // RSVP section
  rsvpSection: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginTop: SPACING.md,
    ...SHADOWS.card,
  },
  rsvpSummary: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'right',
    marginBottom: SPACING.sm,
  },
  rsvpButtons: {
    flexDirection: 'row-reverse',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  rsvpMainBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: RADIUS.xl,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  rsvpMainBtnActive: {
    backgroundColor: COLORS.primary,
  },
  rsvpMainBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  rsvpMainBtnTextActive: {
    color: COLORS.white,
  },
  rsvpMaybeBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: RADIUS.xl,
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  rsvpMaybeBtnActive: {
    backgroundColor: '#F59E0B',
  },
  rsvpMaybeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F59E0B',
  },
  rsvpMaybeBtnTextActive: {
    color: COLORS.white,
  },
  attendeesList: {
    marginTop: SPACING.md,
    gap: SPACING.xs,
  },
  attendeesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primaryDark,
    textAlign: 'right',
  },
  attendeeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  attendeeAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  attendeeAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendeeMaybePlaceholder: {
    backgroundColor: '#F59E0B',
  },
  attendeeStatusBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#F59E0B',
    backgroundColor: '#F59E0B20',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  attendeeName: {
    fontSize: 14,
    color: COLORS.gray,
    flex: 1,
    textAlign: 'right',
  },
  moreAttendeesText: {
    fontSize: 13,
    color: COLORS.primary,
    textAlign: 'right',
    marginTop: 4,
  },

  // Sections
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.primaryDark,
    textAlign: 'right',
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  seeAll: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: SPACING.xl,
  },

  // Discussions
  createDiscussionCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1.5,
    borderColor: COLORS.primary + '40',
    borderStyle: 'dashed',
    ...SHADOWS.card,
  },
  createDiscussionText: {
    fontSize: 15,
    color: COLORS.primary,
    fontWeight: '600',
  },
  discussionItem: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    ...SHADOWS.card,
  },
  discussionInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  discussionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primaryDark,
    marginBottom: 4,
  },
  discussionMeta: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  discussionMetaText: {
    fontSize: 12,
    color: COLORS.gray,
    marginLeft: SPACING.sm,
  },

  // Owner actions
  ownerActions: {
    marginTop: SPACING.xl,
    gap: SPACING.sm,
  },
  editBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: RADIUS.xl,
    ...SHADOWS.button,
  },
  editBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  deleteBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: COLORS.red,
  },
  deleteBtnText: {
    color: COLORS.red,
    fontSize: 15,
    fontWeight: '700',
  },

  // Edit modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.lg,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row-reverse' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: SPACING.sm,
  },
  modalTitle: { fontSize: 20, fontWeight: '700' as const, color: COLORS.primaryDark },
  modalInput: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.grayLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 15,
    color: COLORS.black,
    writingDirection: 'rtl' as const,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: COLORS.primaryDark,
    textAlign: 'right' as const,
  },
  createBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: RADIUS.xl,
    alignItems: 'center' as const,
    marginTop: SPACING.sm,
    ...SHADOWS.button,
  },
  createBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' as const },
  imagePickerBtn: {
    borderRadius: RADIUS.md,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: COLORS.grayLight,
    borderStyle: 'dashed' as const,
  },
  imagePreview: { width: '100%' as any, height: 160 },
  imagePlaceholder: {
    height: 100,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: COLORS.cardBg,
    gap: 6,
  },
  imagePlaceholderText: { fontSize: 13, color: COLORS.gray },
});
