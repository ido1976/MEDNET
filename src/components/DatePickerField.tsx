import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

interface DatePickerFieldProps {
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder?: string;
  minDate?: Date;
}

/**
 * Cross-platform date picker field.
 * - Android: native calendar dialog opens on press
 * - iOS: native spinner shown inside a bottom-sheet modal
 */
export default function DatePickerField({
  value,
  onChange,
  placeholder = 'בחר תאריך',
  minDate,
}: DatePickerFieldProps) {
  const [showPicker, setShowPicker] = useState(false);
  // iOS temp date while picker is open (confirm on "בחר")
  const [tempDate, setTempDate] = useState<Date>(value ?? minDate ?? new Date());

  const formattedValue = value
    ? `${String(value.getDate()).padStart(2, '0')}/${String(value.getMonth() + 1).padStart(2, '0')}/${value.getFullYear()}`
    : null;

  const handlePress = () => {
    setTempDate(value ?? minDate ?? new Date());
    setShowPicker(true);
  };

  const handleChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (selected) onChange(selected);
    } else {
      // iOS: keep picker open, update temp date
      if (selected) setTempDate(selected);
    }
  };

  const handleIOSConfirm = () => {
    onChange(tempDate);
    setShowPicker(false);
  };

  return (
    <View>
      <TouchableOpacity style={styles.field} onPress={handlePress} activeOpacity={0.7}>
        <Ionicons name="calendar-outline" size={18} color={value ? COLORS.primaryDark : COLORS.grayLight} />
        <Text style={[styles.fieldText, !value && styles.placeholder]}>
          {formattedValue ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={COLORS.grayLight} />
      </TouchableOpacity>

      {/* Android: just render picker when visible — it auto-shows a dialog */}
      {Platform.OS === 'android' && showPicker && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display="default"
          minimumDate={minDate}
          onChange={handleChange}
        />
      )}

      {/* iOS: wrap in a modal with a confirm button */}
      {Platform.OS === 'ios' && (
        <Modal visible={showPicker} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.iosSheet}>
              <View style={styles.iosHeader}>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Text style={styles.iosCancelBtn}>ביטול</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleIOSConfirm}>
                  <Text style={styles.iosConfirmBtn}>בחר</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                minimumDate={minDate}
                onChange={handleChange}
                style={styles.iosPicker}
                locale="he"
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.grayLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
  },
  fieldText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.primaryDark,
    textAlign: 'right',
  },
  placeholder: {
    color: COLORS.grayLight,
  },

  // iOS modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  iosSheet: {
    backgroundColor: COLORS.cream,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
  },
  iosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  iosCancelBtn: {
    fontSize: 16,
    color: COLORS.gray,
  },
  iosConfirmBtn: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  iosPicker: {
    height: 200,
  },
});
