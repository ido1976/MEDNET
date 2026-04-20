import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import ScreenWrapper from '../../../src/components/ScreenWrapper';
import HamburgerMenu from '../../../src/components/HamburgerMenu';
import EmptyState from '../../../src/components/EmptyState';
import ChipPicker from '../../../src/components/ChipPicker';
import DatePickerField from '../../../src/components/DatePickerField';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../../src/constants/theme';
import { formatTime } from '../../../src/lib/helpers';
import { uploadImage } from '../../../src/lib/uploadImage';
import { useSharedListsStore } from '../../../src/stores/sharedListsStore';
import { useEventStore } from '../../../src/stores/eventStore';
import { useBridgeStore } from '../../../src/stores/bridgeStore';
import { useAuthStore } from '../../../src/stores/authStore';
import type { Event as EventType } from '../../../src/types/database';

const MONTHS_HE = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

export default function EventsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bridgeId?: string; openCreate?: string }>();
  const { user, session } = useAuthStore();
  const { events, loading, fetchEvents, createEvent, toggleRsvp, fetchRsvpsForEvents, rsvps } = useEventStore();
  const { bridges, fetchBridges, fetchSubBridges } = useBridgeStore();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [showCreate, setShowCreate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newLink, setNewLink] = useState('');
  const [newEventDate, setNewEventDate] = useState<Date | null>(null);
  const [newImage, setNewImage] = useState<string | null>(null);
  const [newCategories, setNewCategories] = useState<string[]>([]);
  const [selectedBridgeId, setSelectedBridgeId] = useState<string | null>(null);
  const [showBridgePicker, setShowBridgePicker] = useState(false);
  const [allBridgesWithSubs, setAllBridgesWithSubs] = useState<{ id: string; name: string; isSub: boolean }[]>([]);

  // RSVP expanded state
  const [expandedRsvp, setExpandedRsvp] = useState<string | null>(null);

  // Archive
  const [showPastEvents, setShowPastEvents] = useState(false);

  // Split events into upcoming / past
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcomingEvents = events.filter(e => new Date(e.date) >= today);
  const pastEvents     = events.filter(e => new Date(e.date) < today);

  const { categories, addCategory } = useSharedListsStore();
  const eventCategories = React.useMemo(
    () => categories.events || ['כללי', 'לימודים', 'חברתי', 'ספורט', 'תרבות', 'התנדבות'],
    [categories.events]
  );

  useEffect(() => {
    fetchEvents(selectedMonth);
  }, [selectedMonth]);

  useEffect(() => {
    loadAllBridges();
  }, []);

  useEffect(() => {
    if (params.bridgeId) {
      setSelectedBridgeId(params.bridgeId);
    }
    if (params.openCreate === 'true') {
      setShowCreate(true);
    }
  }, [params.bridgeId, params.openCreate]);

  useEffect(() => {
    if (events.length > 0) {
      fetchRsvpsForEvents(events.map((e) => e.id));
    }
  }, [events]);

  const loadAllBridges = async () => {
    await fetchBridges();
    const mainBridges = useBridgeStore.getState().bridges;
    const allItems: { id: string; name: string; isSub: boolean }[] = [];

    for (const b of mainBridges) {
      allItems.push({ id: b.id, name: b.name, isSub: false });
      const subs = await fetchSubBridges(b.id);
      for (const sub of subs) {
        allItems.push({ id: sub.id, name: `  ↳ ${sub.name}`, isSub: true });
      }
    }
    setAllBridgesWithSubs(allItems);
  };

  const pickEventImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      setNewImage(result.assets[0].uri);
    }
  };

  const resetForm = () => {
    setNewTitle('');
    setNewDesc('');
    setNewLocation('');
    setNewLink('');
    setNewEventDate(null);
    setNewImage(null);
    setNewCategories([]);
    setSelectedBridgeId(null);
  };

  const handleCreateEvent = async () => {
    if (!newTitle.trim()) {
      Alert.alert('שגיאה', 'נא להזין כותרת');
      return;
    }
    if (!selectedBridgeId) {
      Alert.alert('שגיאה', 'יש לבחור גשר לאירוע');
      return;
    }
    if (!session?.user?.id) {
      Alert.alert('שגיאה', 'יש להתחבר תחילה');
      return;
    }

    setIsSubmitting(true);
    try {
      // Safe date computation — no RangeError possible
      let eventDate: string;
      try {
        eventDate = newEventDate ? newEventDate.toISOString() : new Date().toISOString();
      } catch {
        eventDate = new Date().toISOString();
      }

      // Upload event image to Storage before saving
      let imageUrl: string | null = null;
      if (newImage) {
        try {
          imageUrl = await uploadImage(newImage, 'event-images');
        } catch (err) {
          console.warn('Event image upload failed, continuing without image:', err);
        }
      }

      const result = await createEvent({
        title: newTitle.trim(),
        description: newDesc.trim(),
        location: newLocation.trim() || undefined,
        link: newLink.trim() || undefined,
        date: eventDate,
        categories: newCategories,
        category: newCategories[0] || 'כללי',
        image_url: imageUrl,
        bridge_id: selectedBridgeId || null,
        created_by: session.user.id,
      });

      if (result.error) {
        Alert.alert('שגיאה', result.error);
        return;
      }

      setShowCreate(false);
      resetForm();
      fetchEvents(selectedMonth);
    } catch (err: any) {
      Alert.alert('שגיאה', err.message || 'שגיאה לא צפויה');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSelectedBridgeName = () => {
    const found = allBridgesWithSubs.find((b) => b.id === selectedBridgeId);
    return found?.name || 'בחר גשר';
  };

  const getRsvpCount = (eventId: string, status: 'going' | 'maybe' = 'going') =>
    rsvps.filter((r) => r.event_id === eventId && r.status === status).length;

  const getRsvpNames = (eventId: string) =>
    rsvps
      .filter((r) => r.event_id === eventId && r.status === 'going')
      .map((r) => (r as any).user?.full_name || 'משתמש')
      .filter(Boolean);

  const isUserGoing = (eventId: string) =>
    rsvps.some((r) => r.event_id === eventId && r.user_id === user?.id && r.status === 'going');

  const isUserMaybe = (eventId: string) =>
    rsvps.some((r) => r.event_id === eventId && r.user_id === user?.id && r.status === 'maybe');

  const renderEvent = ({ item }: { item: EventType }) => {
    const date = new Date(item.date);
    const isOwn = item.created_by === user?.id;
    const going = isUserGoing(item.id);
    const maybe = isUserMaybe(item.id);
    const goingCount = getRsvpCount(item.id, 'going');
    const maybeCount = getRsvpCount(item.id, 'maybe');
    const expanded = expandedRsvp === item.id;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => router.push(`/(tabs)/events/${item.id}`)}
      >
        {/* Banner image */}
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.eventCardImage} />
        ) : null}
        <View style={styles.cardBody}>
        <View style={styles.dateBox}>
          <Text style={styles.dateDay}>{date.getDate()}</Text>
          <Text style={styles.dateMonth}>{MONTHS_HE[date.getMonth()]?.slice(0, 3)}</Text>
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {isOwn && (
              <View style={styles.ownBadge}>
                <Text style={styles.ownBadgeText}>שלי</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>

          {/* Category badges */}
          {(item.categories?.length ? item.categories : item.category ? [item.category] : []).length > 0 && (
            <View style={styles.catBadgesRow}>
              {(item.categories?.length ? item.categories : item.category ? [item.category] : []).slice(0, 2).map((cat) => (
                <View key={cat} style={styles.catBadge}>
                  <Text style={styles.catBadgeText}>{cat}</Text>
                </View>
              ))}
              {(item.categories?.length ?? 0) > 2 && (
                <Text style={styles.catBadgeMore}>+{(item.categories?.length ?? 0) - 2}</Text>
              )}
            </View>
          )}

          {(item as any).creator?.full_name && (
            <View style={styles.cardMeta}>
              <Ionicons name="person-outline" size={13} color={COLORS.gray} />
              <Text style={styles.metaText}>{(item as any).creator.full_name}</Text>
            </View>
          )}

          <View style={styles.cardMeta}>
            <Ionicons name="time" size={14} color={COLORS.gray} />
            <Text style={styles.metaText}>{formatTime(item.date)}</Text>
            {(item as any).bridge?.name && (
              <>
                <Ionicons name="git-network" size={14} color={COLORS.gray} />
                <Text style={styles.metaText}>{(item as any).bridge.name}</Text>
              </>
            )}
          </View>

          {/* RSVP row — two buttons: אצטרף + מעוניין */}
          <View style={styles.rsvpRow}>
            {/* Going button */}
            <TouchableOpacity
              style={[styles.rsvpBtn, going && styles.rsvpBtnActive]}
              onPress={() => user?.id && toggleRsvp(item.id, user.id, 'going')}
            >
              <Ionicons
                name={going ? 'checkmark-circle' : 'checkmark-circle-outline'}
                size={15}
                color={going ? COLORS.white : COLORS.primary}
              />
              <Text style={[styles.rsvpBtnText, going && styles.rsvpBtnTextActive]}>
                {going ? 'מגיע/ה' : 'אצטרף'}
                {goingCount > 0 ? ` (${goingCount})` : ''}
              </Text>
            </TouchableOpacity>

            {/* Maybe button */}
            <TouchableOpacity
              style={[styles.rsvpBtnMaybe, maybe && styles.rsvpBtnMaybeActive]}
              onPress={() => user?.id && toggleRsvp(item.id, user.id, 'maybe')}
            >
              <Ionicons
                name={maybe ? 'star' : 'star-outline'}
                size={15}
                color={maybe ? COLORS.white : '#F59E0B'}
              />
              <Text style={[styles.rsvpBtnMaybeText, maybe && styles.rsvpBtnMaybeTextActive]}>
                מעוניין/ת
                {maybeCount > 0 ? ` (${maybeCount})` : ''}
              </Text>
            </TouchableOpacity>

            {/* Expand attendees */}
            {goingCount > 0 && (
              <TouchableOpacity
                style={styles.rsvpCount}
                onPress={() => setExpandedRsvp(expanded ? null : item.id)}
              >
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.primary} />
              </TouchableOpacity>
            )}
          </View>

          {expanded && (
            <View style={styles.rsvpNames}>
              {getRsvpNames(item.id).map((name, idx) => (
                <Text key={idx} style={styles.rsvpNameText}>• {name}</Text>
              ))}
            </View>
          )}
        </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <HamburgerMenu />
        <Text style={styles.headerTitle}>אירועים</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)}>
          <Ionicons name="add-circle" size={28} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Create Event Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { setShowCreate(false); resetForm(); }}>
                <Ionicons name="close" size={24} color={COLORS.gray} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>אירוע חדש</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              <TextInput
                style={styles.modalInput}
                placeholder="שם האירוע *"
                value={newTitle}
                onChangeText={setNewTitle}
                textAlign="right"
                placeholderTextColor={COLORS.grayLight}
              />
              <TextInput
                style={[styles.modalInput, { height: 80 }]}
                placeholder="תיאור"
                value={newDesc}
                onChangeText={setNewDesc}
                textAlign="right"
                multiline
                placeholderTextColor={COLORS.grayLight}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="מיקום"
                value={newLocation}
                onChangeText={setNewLocation}
                textAlign="right"
                placeholderTextColor={COLORS.grayLight}
              />

              {/* Date — native picker, no RangeError */}
              <Text style={styles.modalLabel}>תאריך האירוע:</Text>
              <DatePickerField
                value={newEventDate}
                onChange={setNewEventDate}
                placeholder="בחר תאריך האירוע"
              />

              <TextInput
                style={styles.modalInput}
                placeholder="קישור (אופציונלי)"
                value={newLink}
                onChangeText={setNewLink}
                textAlign="right"
                placeholderTextColor={COLORS.grayLight}
                keyboardType="url"
                autoCapitalize="none"
              />

              {/* Bridge picker */}
              <Text style={styles.modalLabel}>שיוך לגשר:</Text>
              <TouchableOpacity
                style={styles.bridgePickerBtn}
                onPress={() => setShowBridgePicker(true)}
              >
                <Text style={[styles.bridgePickerText, selectedBridgeId && { color: COLORS.primaryDark }]}>
                  {selectedBridgeId ? getSelectedBridgeName() : 'בחר גשר *'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={COLORS.gray} />
              </TouchableOpacity>
              {selectedBridgeId && (
                <TouchableOpacity onPress={() => setSelectedBridgeId(null)}>
                  <Text style={styles.clearBridge}>הסר שיוך לגשר</Text>
                </TouchableOpacity>
              )}

              <ChipPicker
                label="קטגוריות (אפשר לבחור כמה):"
                items={eventCategories}
                multiSelect
                selectedMulti={newCategories}
                onSelectMulti={setNewCategories}
                onAddNew={(cat) => addCategory('events', cat)}
                placeholder="קטגוריה חדשה..."
              />

              <Text style={styles.modalLabel}>תמונה:</Text>
              <TouchableOpacity style={styles.imagePickerBtn} onPress={pickEventImage}>
                {newImage ? (
                  <Image source={{ uri: newImage }} style={styles.imagePreview} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name="camera-outline" size={28} color={COLORS.gray} />
                    <Text style={styles.imagePlaceholderText}>הוסף תמונה</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.createBtn, isSubmitting && { opacity: 0.7 }]}
                onPress={handleCreateEvent}
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? <ActivityIndicator color={COLORS.white} />
                  : <Text style={styles.createBtnText}>צור אירוע</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Bridge Picker Modal */}
      <Modal visible={showBridgePicker} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModal}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowBridgePicker(false)}>
                <Ionicons name="close" size={24} color={COLORS.gray} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>בחר גשר</Text>
              <View style={{ width: 24 }} />
            </View>
            <FlatList
              data={allBridgesWithSubs}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, item.id === selectedBridgeId && styles.pickerItemActive]}
                  onPress={() => {
                    setSelectedBridgeId(item.id);
                    setShowBridgePicker(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, item.isSub && { paddingRight: 16 }]}>
                    {item.name}
                  </Text>
                  {item.id === selectedBridgeId && (
                    <Ionicons name="checkmark" size={18} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Month Selector */}
      <FlatList
        horizontal
        data={MONTHS_HE}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={[styles.monthChip, selectedMonth === index && styles.monthChipActive]}
            onPress={() => setSelectedMonth(index)}
          >
            <Text style={[styles.monthText, selectedMonth === index && styles.monthTextActive]}>
              {item}
            </Text>
          </TouchableOpacity>
        )}
        keyExtractor={(_, i) => i.toString()}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.monthsRow}
      />

      <FlatList
        data={upcomingEvents}
        renderItem={renderEvent}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading
            ? <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
            : pastEvents.length === 0
              ? <EmptyState icon="calendar-outline" title="אין אירועים בחודש זה" subtitle="צור אירוע חדש!" />
              : null
        }
        ListFooterComponent={
          pastEvents.length > 0 ? (
            <View>
              {upcomingEvents.length === 0 && !loading && (
                <Text style={styles.noUpcomingText}>אין אירועים קרובים בחודש זה</Text>
              )}
              <TouchableOpacity
                style={styles.archiveToggle}
                onPress={() => setShowPastEvents(p => !p)}
              >
                <Ionicons
                  name={showPastEvents ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={COLORS.gray}
                />
                <Text style={styles.archiveToggleText}>
                  אירועים שעברו ({pastEvents.length})
                </Text>
              </TouchableOpacity>
              {showPastEvents && pastEvents.map(item => (
                <View key={item.id} style={styles.pastCardWrapper}>
                  {renderEvent({ item })}
                </View>
              ))}
            </View>
          ) : null
        }
      />
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
  monthsRow: {
    paddingHorizontal: SPACING.lg,
    gap: 6,
    marginBottom: SPACING.md,
  },
  monthChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.grayLight,
  },
  monthChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  monthText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primaryDark,
  },
  monthTextActive: {
    color: COLORS.white,
  },
  list: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    flexDirection: 'column',
    marginBottom: SPACING.md,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  eventCardImage: {
    width: '100%',
    height: 110,
    resizeMode: 'cover',
  },
  cardBody: {
    flexDirection: 'row-reverse',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  dateBox: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
  },
  dateMonth: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
  },
  cardInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  cardTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primaryDark,
    textAlign: 'right',
  },
  ownBadge: {
    backgroundColor: COLORS.accent + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  ownBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.accent,
  },
  cardDesc: {
    fontSize: 13,
    color: COLORS.gray,
    textAlign: 'right',
    marginTop: 2,
    lineHeight: 18,
  },
  cardMeta: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    marginTop: SPACING.xs,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.gray,
    marginLeft: SPACING.sm,
  },

  // Category badges on card
  catBadgesRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  catBadge: {
    backgroundColor: COLORS.primary + '18',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  catBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.primary,
  },
  catBadgeMore: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.gray,
    alignSelf: 'center',
  },

  // RSVP
  rsvpRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.sm,
    flexWrap: 'wrap',
  },
  rsvpBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  rsvpBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  rsvpBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  rsvpBtnTextActive: {
    color: COLORS.white,
  },
  rsvpBtnMaybe: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  rsvpBtnMaybeActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  rsvpBtnMaybeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
  },
  rsvpBtnMaybeTextActive: {
    color: COLORS.white,
  },
  rsvpCount: {
    padding: 4,
  },
  rsvpNames: {
    marginTop: 4,
    alignSelf: 'stretch',
  },
  rsvpNameText: {
    fontSize: 12,
    color: COLORS.gray,
    textAlign: 'right',
    lineHeight: 20,
  },

  // Archive
  noUpcomingText: {
    fontSize: 13,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    fontStyle: 'italic',
  },
  archiveToggle: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.sm,
  },
  archiveToggleText: {
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: '600',
  },
  pastCardWrapper: {
    opacity: 0.55,
  },

  // Modal styles
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
  bridgePickerBtn: {
    flexDirection: 'row-reverse' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.grayLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  bridgePickerText: { fontSize: 15, color: COLORS.grayLight },
  clearBridge: { fontSize: 12, color: COLORS.red, textAlign: 'right' as const, marginTop: 2 },
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
  imagePreview: { width: '100%' as any, height: 160, borderRadius: RADIUS.md },
  imagePlaceholder: {
    height: 100,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: COLORS.cardBg,
    gap: 6,
  },
  imagePlaceholderText: { fontSize: 13, color: COLORS.gray },
  pickerModal: {
    backgroundColor: COLORS.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.lg,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  pickerItem: {
    flexDirection: 'row-reverse' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  pickerItemActive: {
    backgroundColor: COLORS.primary + '10',
  },
  pickerItemText: {
    fontSize: 15,
    color: COLORS.primaryDark,
    textAlign: 'right' as const,
  },
});
