import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

interface ChipPickerProps {
  items: string[];
  // Single-select (original API — required for backward compat)
  selected?: string;
  onSelect?: (item: string) => void;
  // Multi-select (new)
  multiSelect?: boolean;
  selectedMulti?: string[];
  onSelectMulti?: (items: string[]) => void;
  // Optional
  label?: string;
  onAddNew?: (item: string) => void;
  placeholder?: string;
}

export default function ChipPicker({
  items,
  selected = '',
  onSelect,
  multiSelect = false,
  selectedMulti = [],
  onSelectMulti,
  onAddNew,
  placeholder = 'הוסף...',
  label,
}: ChipPickerProps) {
  const [showInput, setShowInput] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const isActive = (item: string) =>
    multiSelect ? selectedMulti.includes(item) : selected === item;

  const handlePress = (item: string) => {
    if (multiSelect && onSelectMulti) {
      if (selectedMulti.includes(item)) {
        onSelectMulti(selectedMulti.filter((i) => i !== item));
      } else {
        onSelectMulti([...selectedMulti, item]);
      }
    } else if (onSelect) {
      onSelect(item);
    }
  };

  const handleAdd = () => {
    if (!customValue.trim()) return;
    if (onAddNew) onAddNew(customValue.trim());
    handlePress(customValue.trim());
    setCustomValue('');
    setShowInput(false);
  };

  return (
    <View>
      {label && <Text style={styles.label}>{label}</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.chip, isActive(item) && styles.chipActive]}
            onPress={() => handlePress(item)}
          >
            <Text style={[styles.chipText, isActive(item) && styles.chipTextActive]}>{item}</Text>
          </TouchableOpacity>
        ))}
        {onAddNew && (
          <TouchableOpacity style={styles.addChip} onPress={() => setShowInput(true)}>
            <Ionicons name="add" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        )}
      </ScrollView>
      {showInput && (
        <View style={styles.inputRow}>
          <TouchableOpacity style={styles.confirmBtn} onPress={handleAdd}>
            <Ionicons name="checkmark" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor={COLORS.grayLight}
            value={customValue}
            onChangeText={setCustomValue}
            textAlign="right"
            autoFocus
            onSubmitEditing={handleAdd}
          />
          <TouchableOpacity onPress={() => setShowInput(false)}>
            <Ionicons name="close" size={20} color={COLORS.gray} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', color: COLORS.primaryDark, textAlign: 'right', marginBottom: 6 },
  row: { gap: 8, paddingVertical: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.grayLight, backgroundColor: COLORS.cardBg },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.primaryDark },
  chipTextActive: { color: COLORS.white },
  addChip: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: COLORS.primary, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  inputRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginTop: 8 },
  input: { flex: 1, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: COLORS.black, writingDirection: 'rtl' },
  confirmBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
});
