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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../../src/components/ScreenWrapper';
import HamburgerMenu from '../../../src/components/HamburgerMenu';
import EmptyState from '../../../src/components/EmptyState';
import ChipPicker from '../../../src/components/ChipPicker';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../../src/constants/theme';
import { useDiscussionStore } from '../../../src/stores/discussionStore';
import { useSharedListsStore } from '../../../src/stores/sharedListsStore';
import { BRIDGE_TAGS } from '../../../src/lib/helpers';
import { formatRelative } from '../../../src/lib/helpers';
import type { Discussion } from '../../../src/types/database';

export default function DiscussionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bridgeId?: string }>();
  const { discussions, fetchDiscussions, createDiscussion, loading } = useDiscussionStore();
  const { categories, addCategory } = useSharedListsStore();
  const discussionCategories = categories.discussions || BRIDGE_TAGS;
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTag, setNewTag] = useState(discussionCategories[0]);

  useEffect(() => {
    fetchDiscussions(params.bridgeId);
  }, [params.bridgeId]);

  const handleCreate = async () => {
    if (!newTitle.trim()) { Alert.alert('שגיאה', 'נא להזין כותרת'); return; }
    await createDiscussion({ title: newTitle, tag: newTag, bridge_id: params.bridgeId });
    setShowCreate(false);
    setNewTitle('');
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
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Ionicons name="close" size={24} color={COLORS.gray} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>דיון חדש</Text>
              <View style={{ width: 24 }} />
            </View>
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
  modalContent: { backgroundColor: COLORS.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.lg, paddingBottom: 40, gap: SPACING.md },
  modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.primaryDark },
  modalInput: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.grayLight, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: 15, color: COLORS.black, writingDirection: 'rtl' },
  modalLabel: { fontSize: 14, fontWeight: '600', color: COLORS.primaryDark, textAlign: 'right' },
  createBtn: { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: RADIUS.xl, alignItems: 'center', marginTop: SPACING.sm, ...SHADOWS.button },
  createBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
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
