import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../../src/components/ScreenWrapper';
import HamburgerMenu from '../../../src/components/HamburgerMenu';
import EmptyState from '../../../src/components/EmptyState';
import ChipPicker from '../../../src/components/ChipPicker';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../../src/constants/theme';
import { useDiscussionStore } from '../../../src/stores/discussionStore';
import { useBridgeStore } from '../../../src/stores/bridgeStore';
import { useSharedListsStore } from '../../../src/stores/sharedListsStore';
import { BRIDGE_TAGS } from '../../../src/lib/helpers';
import { formatRelative } from '../../../src/lib/helpers';
import type { Discussion, Bridge, Event as EventType } from '../../../src/types/database';
import { supabase } from '../../../src/lib/supabase';

export default function DiscussionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bridgeId?: string; eventId?: string; openCreate?: string }>();
  const { discussions, fetchDiscussions, createDiscussion, loading } = useDiscussionStore();
  const { bridges, fetchBridges, fetchSubBridges } = useBridgeStore();
  const { categories, addCategory } = useSharedListsStore();
  const discussionCategories = categories.discussions || BRIDGE_TAGS;
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTag, setNewTag] = useState(discussionCategories[0]);
  // Bridge picker
  const [selectedBridgeId, setSelectedBridgeId] = useState<string | null>(params.bridgeId || null);
  const [showBridgePicker, setShowBridgePicker] = useState(false);
  const [allBridgesWithSubs, setAllBridgesWithSubs] = useState<Bridge[]>([]);
  // Event linking
  const [selectedEventId, setSelectedEventId] = useState<string | null>(params.eventId || null);
  const [bridgeEvents, setBridgeEvents] = useState<EventType[]>([]);
  const [showEventPicker, setShowEventPicker] = useState(false);

  useEffect(() => {
    fetchDiscussions(params.bridgeId);
    loadAllBridges();
  }, [params.bridgeId]);

  // Auto-open create modal if coming from bridge/event page
  useEffect(() => {
    if (params.openCreate === 'true') {
      setSelectedBridgeId(params.bridgeId || null);
      setSelectedEventId(params.eventId || null);
      setShowCreate(true);
    }
  }, [params.openCreate]);

  // Load events for selected bridge
  useEffect(() => {
    if (selectedBridgeId) {
      loadBridgeEvents(selectedBridgeId);
    } else {
      setBridgeEvents([]);
      setSelectedEventId(null);
    }
  }, [selectedBridgeId]);

  const loadBridgeEvents = async (bridgeId: string) => {
    const { data } = await supabase
      .from('events')
      .select('id, title, date')
      .eq('bridge_id', bridgeId)
      .order('date', { ascending: false });
    setBridgeEvents((data || []) as EventType[]);
  };

  const loadAllBridges = async () => {
    await fetchBridges();
    // Build flat list of all bridges + sub-bridges
    const mainBridges = useBridgeStore.getState().bridges;
    const allItems: Bridge[] = [];
    for (const b of mainBridges) {
      allItems.push(b);
      const subs = await fetchSubBridges(b.id);
      for (const sub of subs) {
        allItems.push({ ...sub, name: `  ↳ ${sub.name}` });
      }
    }
    setAllBridgesWithSubs(allItems);
  };

  const selectedBridge = allBridgesWithSubs.find(b => b.id === selectedBridgeId);

  const handleCreate = async () => {
    if (!newTitle.trim()) { Alert.alert('שגיאה', 'נא להזין כותרת'); return; }
    if (!selectedBridgeId) { Alert.alert('שגיאה', 'יש לבחור גשר לדיון'); return; }
    if (!newTag) { Alert.alert('שגיאה', 'יש לבחור לפחות תיוג אחד'); return; }
    await createDiscussion({
      title: newTitle,
      tag: newTag,
      bridge_id: selectedBridgeId,
      event_id: selectedEventId || undefined,
    });
    setShowCreate(false);
    setNewTitle('');
    setSelectedBridgeId(params.bridgeId || null);
    setSelectedEventId(params.eventId || null);
    fetchDiscussions(params.bridgeId);
  };

  const filteredDiscussions = discussions.filter((d) => {
    const matchSearch = !search || d.title.includes(search);
    const matchTag = !selectedTag || d.tag === selectedTag;
    return matchSearch && matchTag;
  });

  const renderDiscussion = ({ item }: { item: Discussion }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(tabs)/discussions/${item.id}`)}
      activeOpacity={0.85}
    >
      <View style={styles.cardHeader}>
        <View style={styles.tagBadge}>
          <Text style={styles.tagBadgeText}>{item.tag}</Text>
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title}
        </Text>
      </View>
      {item.bridge && (
        <View style={styles.bridgeBadgeRow}>
          <Ionicons name="git-network-outline" size={13} color={COLORS.primary} />
          <Text style={styles.bridgeBadgeText}>{(item.bridge as any)?.name || ''}</Text>
        </View>
      )}
      <View style={styles.cardFooter}>
        <View style={styles.meta}>
          <Ionicons name="people" size={14} color={COLORS.gray} />
          <Text style={styles.metaText}>{item.participants_count} משתתפים</Text>
        </View>
        <Text style={styles.timeText}>{formatRelative(item.last_message_at)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <HamburgerMenu />
        <Text style={styles.headerTitle}>דיונים</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)}>
          <Ionicons name="add-circle" size={28} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Create Discussion Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { setShowCreate(false); setSelectedBridgeId(params.bridgeId || null); }}>
                <Ionicons name="close" size={24} color={COLORS.gray} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>דיון חדש</Text>
              <View style={{ width: 24 }} />
            </View>

            {/* Bridge picker */}
            <Text style={styles.modalLabel}>שייך לגשר:</Text>
            <TouchableOpacity
              style={styles.bridgePicker}
              onPress={() => setShowBridgePicker(true)}
            >
              <Ionicons name="chevron-back" size={18} color={COLORS.gray} />
              <Text style={[styles.bridgePickerText, !selectedBridge && { color: COLORS.grayLight }]}>
                {selectedBridge ? selectedBridge.name.replace('  ↳ ', '') : 'בחר גשר...'}
              </Text>
              <Ionicons name="git-network-outline" size={18} color={COLORS.primary} />
            </TouchableOpacity>

            {/* Event picker (optional, shows events of selected bridge) */}
            {bridgeEvents.length > 0 && (
              <>
                <Text style={styles.modalLabel}>שייך לאירוע (אופציונלי):</Text>
                <TouchableOpacity
                  style={styles.bridgePicker}
                  onPress={() => setShowEventPicker(true)}
                >
                  <Ionicons name="chevron-back" size={18} color={COLORS.gray} />
                  <Text style={[styles.bridgePickerText, !selectedEventId && { color: COLORS.grayLight }]}>
                    {selectedEventId
                      ? bridgeEvents.find((e) => e.id === selectedEventId)?.title || 'אירוע'
                      : 'בחר אירוע...'}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
                </TouchableOpacity>
                {selectedEventId && (
                  <TouchableOpacity onPress={() => setSelectedEventId(null)}>
                    <Text style={{ fontSize: 12, color: COLORS.red, textAlign: 'right' }}>הסר שיוך לאירוע</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            <TextInput style={styles.modalInput} placeholder="כותרת הדיון" value={newTitle} onChangeText={setNewTitle} textAlign="right" placeholderTextColor={COLORS.grayLight} />
            <ChipPicker
              label="תיוג:"
              items={discussionCategories}
              selected={newTag}
              onSelect={setNewTag}
              onAddNew={(cat) => addCategory('discussions', cat)}
              placeholder="קטגוריה חדשה..."
            />
            <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
              <Text style={styles.createBtnText}>פתח דיון</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Bridge Picker Modal */}
      <Modal visible={showBridgePicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.bridgePickerModal}>
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
              renderItem={({ item }) => {
                const isSub = item.name.startsWith('  ↳');
                return (
                  <TouchableOpacity
                    style={[styles.bridgeOption, selectedBridgeId === item.id && styles.bridgeOptionActive]}
                    onPress={() => { setSelectedBridgeId(item.id); setShowBridgePicker(false); }}
                  >
                    <View style={styles.bridgeOptionRow}>
                      {isSub && <View style={styles.subIndent} />}
                      <Ionicons
                        name={isSub ? 'git-branch-outline' : 'git-network-outline'}
                        size={18}
                        color={selectedBridgeId === item.id ? COLORS.primary : COLORS.gray}
                      />
                      <Text style={[styles.bridgeOptionText, isSub && styles.bridgeOptionSubText]}>
                        {item.name.replace('  ↳ ', '')}
                      </Text>
                    </View>
                    {selectedBridgeId === item.id && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={{ padding: SPACING.lg }}
              ListEmptyComponent={
                <Text style={styles.bridgeEmptyText}>אין גשרים זמינים</Text>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Event Picker Modal */}
      <Modal visible={showEventPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.bridgePickerModal}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowEventPicker(false)}>
                <Ionicons name="close" size={24} color={COLORS.gray} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>בחר אירוע</Text>
              <View style={{ width: 24 }} />
            </View>
            <FlatList
              data={bridgeEvents}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.bridgeOption, selectedEventId === item.id && styles.bridgeOptionActive]}
                  onPress={() => { setSelectedEventId(item.id); setShowEventPicker(false); }}
                >
                  <View style={styles.bridgeOptionRow}>
                    <Ionicons name="calendar-outline" size={18} color={selectedEventId === item.id ? COLORS.primary : COLORS.gray} />
                    <Text style={styles.bridgeOptionText}>{item.title}</Text>
                  </View>
                  {selectedEventId === item.id && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
                </TouchableOpacity>
              )}
              contentContainerStyle={{ padding: SPACING.lg }}
              ListEmptyComponent={
                <Text style={styles.bridgeEmptyText}>אין אירועים לגשר זה</Text>
              }
            />
          </View>
        </View>
      </Modal>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={COLORS.gray} />
        <TextInput
          style={styles.searchInput}
          placeholder="חפש דיון..."
          placeholderTextColor={COLORS.grayLight}
          value={search}
          onChangeText={setSearch}
          textAlign="right"
        />
      </View>

      <View style={styles.tagsScroll}>
        <FlatList
          horizontal
          data={['הכל', ...discussionCategories]}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.tagChip,
                (item === 'הכל' ? !selectedTag : selectedTag === item) && styles.tagChipActive,
              ]}
              onPress={() => setSelectedTag(item === 'הכל' ? null : item)}
            >
              <Text
                style={[
                  styles.tagChipText,
                  (item === 'הכל' ? !selectedTag : selectedTag === item) && styles.tagChipTextActive,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tagsList}
        />
      </View>

      <FlatList
        data={filteredDiscussions}
        renderItem={renderDiscussion}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState icon="chatbubbles-outline" title="אין דיונים" subtitle="היה הראשון לפתוח דיון!" />
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
  searchContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.xl,
    marginHorizontal: SPACING.lg,
    paddingHorizontal: SPACING.md,
    height: 46,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.grayLight,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.black,
    writingDirection: 'rtl',
  },
  tagsScroll: {
    marginTop: SPACING.md,
  },
  tagsList: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  tagChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.cardBg,
    borderWidth: 1.5,
    borderColor: COLORS.grayLight,
  },
  tagChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tagChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primaryDark,
  },
  tagChipTextActive: {
    color: COLORS.white,
  },
  list: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: 100,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalScroll: { backgroundColor: COLORS.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalContent: { padding: SPACING.lg, paddingBottom: 40, gap: SPACING.md },
  modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.primaryDark },
  modalInput: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.grayLight, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: 15, color: COLORS.black, writingDirection: 'rtl' },
  modalLabel: { fontSize: 14, fontWeight: '600', color: COLORS.primaryDark, textAlign: 'right' },
  createBtn: { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: RADIUS.xl, alignItems: 'center', marginTop: SPACING.sm, ...SHADOWS.button },
  createBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  // Bridge picker
  bridgePicker: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.grayLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  bridgePickerText: {
    fontSize: 15,
    color: COLORS.black,
    flex: 1,
    textAlign: 'right',
  },
  bridgePickerModal: {
    backgroundColor: COLORS.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  bridgeOption: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  bridgeOptionActive: {
    backgroundColor: COLORS.primary + '12',
  },
  bridgeOptionRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  bridgeOptionText: {
    fontSize: 16,
    color: COLORS.primaryDark,
    fontWeight: '500',
  },
  bridgeOptionSubText: {
    fontSize: 14,
    color: COLORS.gray,
    fontWeight: '400',
  },
  subIndent: {
    width: 16,
  },
  bridgeEmptyText: {
    textAlign: 'center',
    color: COLORS.gray,
    fontSize: 15,
    paddingVertical: SPACING.xl,
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.card,
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  tagBadge: {
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  tagBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primaryDark,
    textAlign: 'right',
  },
  bridgeBadgeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    marginBottom: SPACING.sm,
  },
  bridgeBadgeText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meta: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.gray,
  },
  timeText: {
    fontSize: 12,
    color: COLORS.grayLight,
  },
});
