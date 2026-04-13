import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../src/components/ScreenWrapper';
import HamburgerMenu from '../../src/components/HamburgerMenu';
import BridgeCard from '../../src/components/BridgeCard';
import EmptyState from '../../src/components/EmptyState';
import TagSearchModal from '../../src/components/TagSearchModal';
import BridgeImagePicker from '../../src/components/BridgeImagePicker';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../src/constants/theme';
import { useBridgeStore } from '../../src/stores/bridgeStore';
import { useAuthStore } from '../../src/stores/authStore';
import type { Bridge } from '../../src/types/database';

export default function DiscoverScreen() {
  const router = useRouter();
  const { bridges, fetchBridges, createBridge, allTags, fetchAllTags, createTag, loading } = useBridgeStore();
  const { user, session } = useAuthStore();
  const [search, setSearch] = useState('');
  const [selectedFilterTags, setSelectedFilterTags] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTagIds, setNewTagIds] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<string[]>([]);
  // Sub-bridge support
  const [bridgeType, setBridgeType] = useState<'main' | 'sub'>('main');
  const [parentBridgeId, setParentBridgeId] = useState<string | null>(null);
  const [showParentPicker, setShowParentPicker] = useState(false);

  useEffect(() => {
    fetchBridges();
    fetchAllTags();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) { Alert.alert('שגיאה', 'נא להזין שם לגשר'); return; }
    if (!session?.user?.id || !user?.id) { Alert.alert('שגיאה', 'פג תוקף ההתחברות. יש לצאת ולהתחבר מחדש'); return; }
    if (newTagIds.length === 0) { Alert.alert('שגיאה', 'יש לבחור לפחות תגית אחת'); return; }
    if (bridgeType === 'sub' && !parentBridgeId) { Alert.alert('שגיאה', 'יש לבחור גשר אב'); return; }

    const result = await createBridge(
      {
        name: newName,
        description: newDesc,
        created_by: user.id,
        parent_id: bridgeType === 'sub' ? parentBridgeId : null,
      },
      newTagIds,
      newImages,
    );

    if (result.error) {
      Alert.alert('שגיאה', result.error);
      return;
    }

    setShowCreate(false);
    resetCreateForm();
    Alert.alert('הגשר נוצר בהצלחה!');
  };

  const resetCreateForm = () => {
    setNewName('');
    setNewDesc('');
    setNewTagIds([]);
    setNewImages([]);
    setBridgeType('main');
    setParentBridgeId(null);
  };

  const handleToggleTag = (tagId: string) => {
    setNewTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const handleToggleFilterTag = (tagId: string) => {
    setSelectedFilterTags(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const filteredBridges = bridges.filter((b) => {
    const matchSearch = !search || b.name.includes(search) || b.description.includes(search);
    const matchTags = selectedFilterTags.length === 0 ||
      (b.tags && b.tags.some(t => selectedFilterTags.includes(t.id)));
    return matchSearch && matchTags;
  });

  const selectedParentBridge = bridges.find(b => b.id === parentBridgeId);
  const selectedTagNames = allTags.filter(t => newTagIds.includes(t.id));

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={styles.header}>
        <HamburgerMenu />
        <Text style={styles.headerTitle}>גשרים</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)}>
          <Ionicons name="add-circle" size={28} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Create Bridge Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { setShowCreate(false); resetCreateForm(); }}>
                <Ionicons name="close" size={24} color={COLORS.gray} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>גשר חדש</Text>
              <View style={{ width: 24 }} />
            </View>

            {/* Bridge type selector */}
            <Text style={styles.modalLabel}>סוג גשר:</Text>
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeBtn, bridgeType === 'main' && styles.typeBtnActive]}
                onPress={() => { setBridgeType('main'); setParentBridgeId(null); }}
              >
                <Text style={[styles.typeText, bridgeType === 'main' && styles.typeTextActive]}>גשר ראשי</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, bridgeType === 'sub' && styles.typeBtnActive]}
                onPress={() => setBridgeType('sub')}
              >
                <Text style={[styles.typeText, bridgeType === 'sub' && styles.typeTextActive]}>גשר משנה</Text>
              </TouchableOpacity>
            </View>

            {/* Parent bridge picker */}
            {bridgeType === 'sub' && (
              <>
                <Text style={styles.modalLabel}>גשר אב:</Text>
                <TouchableOpacity
                  style={styles.parentPicker}
                  onPress={() => setShowParentPicker(true)}
                >
                  <Ionicons name="chevron-back" size={18} color={COLORS.gray} />
                  <Text style={[styles.parentPickerText, !selectedParentBridge && { color: COLORS.grayLight }]}>
                    {selectedParentBridge?.name || 'בחר גשר ראשי...'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <TextInput style={styles.modalInput} placeholder="שם הגשר" value={newName} onChangeText={setNewName} textAlign="right" placeholderTextColor={COLORS.grayLight} />
            <TextInput style={[styles.modalInput, { height: 80 }]} placeholder="תיאור" value={newDesc} onChangeText={setNewDesc} textAlign="right" multiline placeholderTextColor={COLORS.grayLight} />

            {/* Tag selection */}
            <Text style={styles.modalLabel}>תגיות:</Text>
            <View style={styles.selectedTagsRow}>
              {selectedTagNames.map(tag => (
                <TouchableOpacity key={tag.id} style={styles.selectedTagChip} onPress={() => handleToggleTag(tag.id)}>
                  <Ionicons name="close" size={14} color={COLORS.primary} />
                  <Text style={styles.selectedTagText}>{tag.name}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.addTagBtn} onPress={() => setShowTagModal(true)}>
                <Ionicons name="add" size={18} color={COLORS.primary} />
                <Text style={styles.addTagText}>הוסף תגית</Text>
              </TouchableOpacity>
            </View>

            {/* Image picker */}
            <Text style={styles.modalLabel}>תמונות:</Text>
            <BridgeImagePicker images={newImages} onImagesChange={setNewImages} maxImages={1} />

            <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
              <Text style={styles.createBtnText}>צור גשר</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Tag Search Modal */}
      <TagSearchModal
        visible={showTagModal}
        onClose={() => setShowTagModal(false)}
        allTags={allTags}
        selectedTagIds={newTagIds}
        onToggleTag={handleToggleTag}
        onCreateTag={createTag}
      />

      {/* Parent bridge picker modal */}
      <Modal visible={showParentPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.parentPickerModal}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowParentPicker(false)}>
                <Ionicons name="close" size={24} color={COLORS.gray} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>בחר גשר אב</Text>
              <View style={{ width: 24 }} />
            </View>
            <FlatList
              data={bridges}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.parentOption, parentBridgeId === item.id && styles.parentOptionActive]}
                  onPress={() => { setParentBridgeId(item.id); setShowParentPicker(false); }}
                >
                  <Text style={styles.parentOptionText}>{item.name}</Text>
                  {parentBridgeId === item.id && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
                </TouchableOpacity>
              )}
              contentContainerStyle={{ padding: SPACING.lg }}
            />
          </View>
        </View>
      </Modal>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={COLORS.gray} />
        <TextInput
          style={styles.searchInput}
          placeholder="חפש גשר..."
          placeholderTextColor={COLORS.grayLight}
          value={search}
          onChangeText={setSearch}
          textAlign="right"
        />
      </View>

      {/* Tags Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tagsRow}
        style={styles.tagsContainer}
      >
        <TouchableOpacity
          style={[styles.tagChip, selectedFilterTags.length === 0 && styles.tagChipActive]}
          onPress={() => setSelectedFilterTags([])}
        >
          <Text style={[styles.tagText, selectedFilterTags.length === 0 && styles.tagTextActive]}>הכל</Text>
        </TouchableOpacity>
        {allTags.map((tag) => (
          <TouchableOpacity
            key={tag.id}
            style={[styles.tagChip, selectedFilterTags.includes(tag.id) && styles.tagChipActive]}
            onPress={() => handleToggleFilterTag(tag.id)}
          >
            <Text style={[styles.tagText, selectedFilterTags.includes(tag.id) && styles.tagTextActive]}>
              {tag.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Bridges List */}
      <FlatList
        data={filteredBridges}
        renderItem={({ item }) => <BridgeCard bridge={item} variant="large" />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="git-network-outline"
            title="אין גשרים עדיין"
            subtitle="היה הראשון ליצור גשר חדש!"
          />
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
  tagsContainer: {
    marginTop: SPACING.md,
  },
  tagsRow: {
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
  tagText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primaryDark,
  },
  tagTextActive: {
    color: COLORS.white,
  },
  list: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: 100,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalScroll: {
    backgroundColor: COLORS.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalContent: {
    padding: SPACING.lg,
    paddingBottom: 40,
    gap: SPACING.md,
  },
  modalHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  modalInput: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.grayLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 15,
    color: COLORS.black,
    writingDirection: 'rtl',
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primaryDark,
    textAlign: 'right',
  },
  createBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    marginTop: SPACING.sm,
    ...SHADOWS.button,
  },
  createBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  // Tag selection in create modal
  selectedTagsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  selectedTagChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.xl,
  },
  selectedTagText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  addTagBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
  },
  addTagText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  // Bridge type selector
  typeRow: {
    flexDirection: 'row-reverse',
    gap: SPACING.sm,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.grayLight,
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
  },
  typeBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  typeText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primaryDark,
  },
  typeTextActive: {
    color: COLORS.white,
  },
  // Parent bridge picker
  parentPicker: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.grayLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  parentPickerText: {
    fontSize: 15,
    color: COLORS.black,
    flex: 1,
    textAlign: 'right',
  },
  parentPickerModal: {
    backgroundColor: COLORS.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%',
  },
  parentOption: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  parentOptionActive: {
    backgroundColor: COLORS.primary + '12',
  },
  parentOptionText: {
    fontSize: 16,
    color: COLORS.primaryDark,
    fontWeight: '500',
  },
});
