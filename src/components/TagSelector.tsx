import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import TagSearchModal from './TagSearchModal';
import type { BridgeTag } from '../types/database';

interface TagSelectorProps {
  label: string;
  allTags: BridgeTag[];
  selectedTags: BridgeTag[];
  onToggleTag: (tagId: string) => void;
  onCreateTag: (name: string) => Promise<BridgeTag | null>;
}

export default function TagSelector({
  label,
  allTags,
  selectedTags,
  onToggleTag,
  onCreateTag,
}: TagSelectorProps) {
  const [showModal, setShowModal] = useState(false);

  const selectedTagIds = selectedTags.map((t) => t.id);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{label}</Text>
        <TouchableOpacity style={styles.editBtn} onPress={() => setShowModal(true)}>
          <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
          <Text style={styles.editBtnText}>ערוך</Text>
        </TouchableOpacity>
      </View>

      {selectedTags.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tagsList}
        >
          {selectedTags.map((tag) => (
            <TouchableOpacity
              key={tag.id}
              style={styles.tagChip}
              onPress={() => onToggleTag(tag.id)}
            >
              <Text style={styles.tagChipText}>{tag.name}</Text>
              <Ionicons name="close-circle" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.emptyText}>לא נבחרו תיוגים — לחץ על ערוך כדי לבחור</Text>
      )}

      <TagSearchModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        allTags={allTags}
        selectedTagIds={selectedTagIds}
        onToggleTag={onToggleTag}
        onCreateTag={onCreateTag}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  headerRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primaryDark,
    textAlign: 'right',
  },
  editBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  tagsList: {
    gap: SPACING.sm,
    paddingVertical: 4,
  },
  tagChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  tagChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.gray,
    textAlign: 'right',
  },
});
