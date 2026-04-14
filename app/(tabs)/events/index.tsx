import React, { useEffect, useState } from 'react';
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
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import ScreenWrapper from '../../../src/components/ScreenWrapper';
import HamburgerMenu from '../../../src/components/HamburgerMenu';
import EmptyState from '../../../src/components/EmptyState';
import ChipPicker from '../../../src/components/ChipPicker';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../../src/constants/theme';
import { formatDate, formatTime } from '../../../src/lib/helpers';
import { useSharedListsStore } from '../../../src/stores/sharedListsStore';
import { useEventStore } from '../../../src/stores/eventStore';
import { useBridgeStore } from '../../../src/stores/bridgeStore';
import { useAuthStore } from '../../../src/stores/authStore';
import type { Event as EventType, Bridge } from '../../../src/types/database';

const MONTHS_HE = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

export default function EventsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bridgeId?: string; openCreate?: string }>();
  const { user, session } = useAuthStore();
  const { events, loading, fetchEvents, createEvent, toggleRsvp, fetchRsvps, rsvps } = useEventStore();
  const { bridges, fetchBridges, fetchSubBridges } = useBridgeStore();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newLink, setNewLink] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newImage, setNewImage] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState('כללי');
  const [selectedBridgeId, setSelectedBridgeId] = useState<string | null>(null);
  const [showBridgePicker, setShowBridgePicker] = useState(false);
  const [allBridgesWithSubs, setAllBridgesWithSubs] = useState<{ id: string; name: string; isSub: boolean }[]>([]);

  // RSVP expanded state
  const [expandedRsvp, setExpandedRsvp] = useState<string | null>(null);

  const { categories, addCategory } = useSharedListsStore();
  const eventCategories = categories.events || ['כללי', 'לימודים', 'חברתי', 'ספורט', 'תרבות', 'התנדבות'];

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
    events.forEach((e) => fetchRsvps(e.id));
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
    setNewDate('');
    setNewImage(null);
    setNewCategory('כללי');
    setSelectedBridgeId(null);
  };

  const handleCreateEvent = async () => {
    if (!newTitle.trim()) {
      Alert.alert('שגיאה', 'נא להזין כותרת');
      return;
    }
    if (!session?.user?.id) {
      Alert.alert('שגיאה', 'יש להתחבר תחילה');
      return;
    }

    const eventDate = newDate.trim()
      ? new Date(newDate).toISOString()
      : new Date().toISOString();

    const result = await createEvent({
      title: newTitle.trim(),
      description: newDesc.trim(),
      location: newLocation.trim() || undefined,
      link: newLink.trim() || undefined,
      date: eventDate,
      category: newCategory,
      image_url: newImage,
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
  };

  const getSelectedBridgeName = () => {
    const found = allBridgesWithSubs.find((b) => b.id === selectedBridgeId);
    return found?.name || 'בחר גשר';
  };

  const getRsvpCount = (eventId: string) => {
    return rsvps.filter((r) => r.event_id === eventId && r.status === 'going').length;
  };

  const getRsvpNames = (eventId: string) => {
    return rsvps
      .filter((r) => r.event_id === eventId && r.status === 'going')
      .map((r) => (r as any).user?.full_name || 'משתמש')
      .filter(Boolean);
  };

  const isUserGoing = (eventId: string) => {
    return rsvps.some(
      (r) => r.event_id === eventId && r.user_id === user?.id && r.status === 'going'
    );
  };

  const handleRsvp = async (eventId: string) => {
    if (!user?.id) return;
    await toggleRsvp(eventId, user.id);
  };

  const renderEvent = ({ item }: { item: EventType }) => {
    const date = new Date(item.date);
    const isOwn = item.created_by === user?.id;
    const going = isUserGoing(item.id);
    const count = getRsvpCount(item.id);
    const expanded = expandedRsvp === item.id;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => router.push(`/(tabs)/events/${item.id}`)}
      >
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

          {/* Creator */}
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

          {/* RSVP row */}
          <View style={styles.rsvpRow}>
            <TouchableOpacity
              style={[styles.rsvpBtn, going && styles.rsvpBtnActive]}
              onPress={() => handleRsvp(item.id)}
            >
              <Ionicons
                name={going ? 'checkmark-circle' : 'checkmark-circle-outline'}
                size={16}
                color={going ? COLORS.white : COLORS.primary}
              />
              <Text style={[styles.rsvpBtnText, going && styles.rsvpBtnTextActive]}>
                {going ? 'מגיע/ה' : 'אישור הגעה'}
              </Text>
            </TouchableOpacity>
            {count > 0 && (
              <TouchableOpacity
                style={styles.rsvpCount}
                onPress={() => setExpandedRsvp(expanded ? null : item.id)}
              >
                <Ionicons name="people" size={14} color={COLORS.primary} />
                <Text style={styles.rsvpCountText}>{count} מאשרים</Text>
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
              <TextInput style={styles.modalInput} placeholder="שם האירוע *" value={newTitle} onChangeText={setNewTitle} textAlign="right" placeholderTextColor={COLORS.grayLight} />
              <TextInput style={[styles.modalInput, { height: 80 }]} placeholder="תיאור" value={newDesc} onChangeText={setNewDesc} textAlign="right" multiline placeholderTextColor={COLORS.grayLight} />
              <TextInput style={styles.modalInput} placeholder="מיקום" value={newLocation} onChangeText={setNewLocation} textAlign="right" placeholderTextColor={COLORS.grayLight} />

              {/* Date input */}
              <TextInput
                style={styles.modalInput}
                placeholder="תאריך (YYYY-MM-DD)"
                value={newDate}
                onChangeText={setNewDate}
                textAlign="right"
                placeholderTextColor={COLORS.grayLight}
              />

              {/* Link field */}
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
                  {selectedBridgeId ? getSelectedBridgeName() : 'בחר גשר (אופציונלי)'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={COLORS.gray} />
              </TouchableOpacity>
              {selectedBridgeId && (
                <TouchableOpacity onPress={() => setSelectedBridgeId(null)}>
                  <Text style={styles.clearBridge}>הסר שיוך לגשר</Text>
                </TouchableOpacity>
              )}

              <ChipPicker
                label="קטגוריה:"
                items={eventCategories}
                selected={newCategory}
                onSelect={setNewCategory}
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

              <TouchableOpacity style={styles.createBtn} onPress={handleCreateEvent}>
                <Text style={styles.createBtnText}>צור אירוע</Text>
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
        data={events}
        renderItem={renderEvent}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState icon="calendar-outline" title="אין אירועים בחודש זה" subtitle="צור אירוע חדש!" />
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
    padding: SPACING.md,
    flexDirection: 'row-reverse',
    marginBottom: SPACING.md,
    gap: SPACING.md,
    ...SHADOWS.card,
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
  rsvpRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
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
  rsvpCount: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  rsvpCountText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
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
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.lg, paddingBottom: 40, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row-reverse' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: SPACING.sm },
  modalTitle: { fontSize: 20, fontWeight: '700' as const, color: COLORS.primaryDark },
  modalInput: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.grayLight, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: 15, color: COLORS.black, writingDirection: 'rtl' as const },
  modalLabel: { fontSize: 14, fontWeight: '600' as const, color: COLORS.primaryDark, textAlign: 'right' as const },
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
  createBtn: { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: RADIUS.xl, alignItems: 'center' as const, marginTop: SPACING.sm, ...SHADOWS.button },
  createBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' as const },
  imagePickerBtn: { borderRadius: RADIUS.md, overflow: 'hidden' as const, borderWidth: 1, borderColor: COLORS.grayLight, borderStyle: 'dashed' as const },
  imagePreview: { width: '100%' as any, height: 160, borderRadius: RADIUS.md },
  imagePlaceholder: { height: 100, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: COLORS.cardBg, gap: 6 },
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
