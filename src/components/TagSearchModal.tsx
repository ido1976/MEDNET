import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import type { BridgeTag } from '../types/database';

interface TagSearchModalProps {
  visible: boolean;
  onClose: () => void;
  allTags: BridgeTag[];
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
  onCreateTag: (name: string) => Promise<BridgeTag | null>;
}

export default function TagSearchModal({
  visible,
  onClose,
  allTags,
  selectedTagIds,
  onToggleTag,
  onCreateTag,
}: TagSearchModalProps) {
  const [search, setSearch] = useState('');

  const filteredTags = useMemo(() => {
    if (!search.trim()) return allTags;
    const normalizedSearch = search.trim().toLowerCase();
    return allTags.filter((t) => t.name.toLowerCase().includes(normalizedSearch));
  }, [allTags, search]);

  const showCreateOption = !!search.trim() && !allTags.some(
    (t) => t.name.trim().toLowerCase() === search.trim().toLowerCase(),
  );

  const handleCreateAndSelect = async () => {
    try {
      const tagName = search.trim();
      const tag = await onCreateTag(tagName);
      if (tag) {
        if (!selectedTagIds.includes(tag.id)) {
          onToggleTag(tag.id);
        }
        setSearch('');
        return;
      }
      Alert.alert('שגיאה', 'לא ניתן ליצור תגית כרגע. בדוק שאתה מחובר ונסה שוב.');
    } catch (error: any) {
      if (error?.message === 'AUTH_REQUIRED') {
        Alert.alert('נדרשת התחברות', 'פג תוקף ההתחברות. צא והתחבר מחדש כדי ליצור תגיות חדשות.');
        return;
      }
      Alert.alert('שגיאה', error?.message || 'לא ניתן ליצור תגית כרגע. נסה שוב.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={COLORS.gray} />
            </TouchableOpacity>
            <Text style={styles.title}>בחר תגיות</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.doneText}>סיום</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={COLORS.gray} />
            <TextInput
              style={styles.searchInput}
              placeholder="חפש תגית..."
              placeholderTextColor={COLORS.grayLight}
              value={search}
              onChangeText={setSearch}
              textAlign="right"
              autoFocus
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={20} color={COLORS.grayLight} />
              </TouchableOpacity>
            )}
          </View>

          {/* Selected count */}
          {selectedTagIds.length > 0 && (
            <Text style={styles.selectedCount}>
              {selectedTagIds.length} תגיות נבחרו
            </Text>
          )}

          {/* Tags list */}
          <FlatList
            data={filteredTags}
            extraData={selectedTagIds}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isSelected = selectedTagIds.includes(item.id);
              return (
                <TouchableOpacity
                  style={[styles.tagRow, isSelected && styles.tagRowSelected]}
                  onPress={() => onToggleTag(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Ionicons name="checkmark" size={16} color={COLORS.white} />}
                  </View>
                  <Text style={[styles.tagName, isSelected && styles.tagNameSelected]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              );
            }}
            keyboardShouldPersistTaps="always"
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              !showCreateOption ? (
                <Text style={styles.emptyText}>לא נמצאו תגיות</Text>
              ) : null
            }
          />

          {/* Create new tag */}
          {showCreateOption && (
            <TouchableOpacity style={styles.createRow} onPress={handleCreateAndSelect}>
              <Ionicons name="add-circle" size={24} color={COLORS.primary} />
              <Text style={styles.createText}>צור תגית חדשה: "{search.trim()}"</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  doneText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  searchContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.xl,
    marginHorizontal: SPACING.lg,
    paddingHorizontal: SPACING.md,
    height: 44,
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
  selectedCount: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
    textAlign: 'right',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
  },
  list: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
  },
  tagRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: 4,
  },
  tagRowSelected: {
    backgroundColor: COLORS.primary + '12',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.grayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tagName: {
    fontSize: 16,
    color: COLORS.primaryDark,
    fontWeight: '500',
  },
  tagNameSelected: {
    fontWeight: '700',
    color: COLORS.primary,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.gray,
    fontSize: 14,
    marginTop: SPACING.lg,
  },
  createRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.grayLight,
  },
  createText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },
});
