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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import ScreenWrapper from '../../../src/components/ScreenWrapper';
import HamburgerMenu from '../../../src/components/HamburgerMenu';
import EmptyState from '../../../src/components/EmptyState';
import ChipPicker from '../../../src/components/ChipPicker';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../../src/constants/theme';
import { supabase } from '../../../src/lib/supabase';
import { formatDate, formatTime } from '../../../src/lib/helpers';
import { useSharedListsStore } from '../../../src/stores/sharedListsStore';
import type { Event as EventType } from '../../../src/types/database';

const MONTHS_HE = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

export default function EventsScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<EventType[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newImage, setNewImage] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState('כללי');
  const { categories, addCategory } = useSharedListsStore();
  const eventCategories = categories.events || ['כללי', 'לימודים', 'חברתי', 'ספורט', 'תרבות', 'התנדבות'];

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

  useEffect(() => {
    fetchEvents();
  }, [selectedMonth]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const startDate = new Date(new Date().getFullYear(), selectedMonth, 1).toISOString();
      const endDate = new Date(new Date().getFullYear(), selectedMonth + 1, 0).toISOString();

      const { data } = await supabase
        .from('events')
        .select('*, bridge:bridges(name), creator:users(full_name)')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      setEvents((data || []) as EventType[]);
    } catch (e) {}
    setLoading(false);
  };

  const handleCreateEvent = () => {
    if (!newTitle.trim()) { Alert.alert('שגיאה', 'נא להזין כותרת'); return; }
    const newEvent: EventType = {
      id: Date.now().toString(),
      title: newTitle,
      description: newDesc,
      location: newLocation,
      date: new Date().toISOString(),
      created_by: '',
      created_at: new Date().toISOString(),
      category: newCategory,
      image_url: newImage,
    } as EventType;
    setEvents((prev) => [newEvent, ...prev]);
    setShowCreate(false);
    setNewTitle('');
    setNewDesc('');
    setNewLocation('');
    setNewImage(null);
    setNewCategory('כללי');
  };

  const renderEvent = ({ item }: { item: EventType }) => {
    const date = new Date(item.date);
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.85}>
        <View style={styles.dateBox}>
          <Text style={styles.dateDay}>{date.getDate()}</Text>
          <Text style={styles.dateMonth}>{MONTHS_HE[date.getMonth()]?.slice(0, 3)}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
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
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Ionicons name="close" size={24} color={COLORS.gray} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>אירוע חדש</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              <TextInput style={styles.modalInput} placeholder="שם האירוע *" value={newTitle} onChangeText={setNewTitle} textAlign="right" placeholderTextColor={COLORS.grayLight} />
              <TextInput style={[styles.modalInput, { height: 80 }]} placeholder="תיאור" value={newDesc} onChangeText={setNewDesc} textAlign="right" multiline placeholderTextColor={COLORS.grayLight} />
              <TextInput style={styles.modalInput} placeholder="מיקום" value={newLocation} onChangeText={setNewLocation} textAlign="right" placeholderTextColor={COLORS.grayLight} />

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
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  monthChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
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
    fontSize: 13,
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primaryDark,
    textAlign: 'right',
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.lg, paddingBottom: 40, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row-reverse' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: SPACING.sm },
  modalTitle: { fontSize: 20, fontWeight: '700' as const, color: COLORS.primaryDark },
  modalInput: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.grayLight, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: 15, color: COLORS.black, writingDirection: 'rtl' as const },
  createBtn: { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: RADIUS.xl, alignItems: 'center' as const, marginTop: SPACING.sm, ...SHADOWS.button },
  createBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' as const },
  modalLabel: { fontSize: 14, fontWeight: '600' as const, color: COLORS.primaryDark, textAlign: 'right' as const },
  imagePickerBtn: { borderRadius: RADIUS.md, overflow: 'hidden' as const, borderWidth: 1, borderColor: COLORS.grayLight, borderStyle: 'dashed' as const },
  imagePreview: { width: '100%' as any, height: 160, borderRadius: RADIUS.md },
  imagePlaceholder: { height: 100, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: COLORS.cardBg, gap: 6 },
  imagePlaceholderText: { fontSize: 13, color: COLORS.gray },
});
