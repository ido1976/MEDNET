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
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../../src/components/ScreenWrapper';
import HamburgerMenu from '../../../src/components/HamburgerMenu';
import EmptyState from '../../../src/components/EmptyState';
import ChipPicker from '../../../src/components/ChipPicker';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../../src/constants/theme';
import { supabase } from '../../../src/lib/supabase';
import { formatDate, formatTime } from '../../../src/lib/helpers';
import { useSharedListsStore } from '../../../src/stores/sharedListsStore';
import type { Ride } from '../../../src/types/database';

export default function RidesScreen() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const { cities, addCity } = useSharedListsStore();

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newFrom, setNewFrom] = useState('צפת');
  const [newTo, setNewTo] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newSeats, setNewSeats] = useState('4');
  const [newPrice, setNewPrice] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [returnTime, setReturnTime] = useState('');

  useEffect(() => {
    fetchRides();
  }, []);

  const fetchRides = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('rides')
        .select('*, driver:users(full_name, avatar_url)')
        .gte('date_time', new Date().toISOString())
        .order('date_time', { ascending: true });
      if (data && data.length > 0) setRides(data as Ride[]);
    } catch (e) {}
    setLoading(false);
  };

  const handleCreate = () => {
    if (!newFrom.trim()) { Alert.alert('שגיאה', 'נא להזין מוצא'); return; }
    if (!newTo.trim()) { Alert.alert('שגיאה', 'נא להזין יעד'); return; }
    if (!newDate.trim()) { Alert.alert('שגיאה', 'נא להזין תאריך'); return; }
    if (!newTime.trim()) { Alert.alert('שגיאה', 'נא להזין שעה'); return; }

    const newRide: Ride = {
      id: Date.now().toString(),
      from_location: newFrom,
      to_location: newTo,
      date_time: new Date().toISOString(),
      seats: Number(newSeats) || 4,
      price: Number(newPrice) || 0,
      contact_phone: newPhone,
      notes: newNotes + (isRoundTrip ? ` | חזרה: ${returnTime}` : ''),
      driver_id: '',
      created_at: new Date().toISOString(),
      // Display fields
      _display_date: newDate,
      _display_time: newTime,
    } as any;

    setRides((prev) => [newRide, ...prev]);
    setShowCreate(false);
    resetForm();
    Alert.alert('פורסם!', 'הטרמפ פורסם בהצלחה');
  };

  const resetForm = () => {
    setNewFrom('צפת'); setNewTo(''); setNewDate(''); setNewTime('');
    setNewSeats('4'); setNewPrice(''); setNewPhone(''); setNewNotes('');
    setIsRoundTrip(false); setReturnTime('');
  };

  const renderRide = ({ item }: { item: Ride }) => (
    <View style={styles.card}>
      <View style={styles.route}>
        <View style={styles.routePoint}>
          <View style={styles.dotGreen} />
          <Text style={styles.routeText}>{item.from_location}</Text>
        </View>
        <View style={styles.routeLine} />
        <View style={styles.routePoint}>
          <View style={styles.dotRed} />
          <Text style={styles.routeText}>{item.to_location}</Text>
        </View>
      </View>

      <View style={styles.cardDetails}>
        <View style={styles.detailItem}>
          <Ionicons name="calendar" size={16} color={COLORS.primary} />
          <Text style={styles.detailText}>{(item as any)._display_date || formatDate(item.date_time)}</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="time" size={16} color={COLORS.primary} />
          <Text style={styles.detailText}>{(item as any)._display_time || formatTime(item.date_time)}</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="people" size={16} color={COLORS.primary} />
          <Text style={styles.detailText}>{item.seats} מקומות</Text>
        </View>
        {item.price > 0 && (
          <View style={styles.detailItem}>
            <Ionicons name="cash" size={16} color={COLORS.primary} />
            <Text style={styles.detailText}>₪{item.price}</Text>
          </View>
        )}
      </View>

      {item.contact_phone ? (
        <View style={styles.phoneRow}>
          <Ionicons name="call" size={14} color={COLORS.primary} />
          <Text style={styles.phoneText}>{item.contact_phone}</Text>
        </View>
      ) : null}

      {item.notes ? (
        <Text style={styles.notesText}>{item.notes}</Text>
      ) : null}

      <View style={styles.cardFooter}>
        <Text style={styles.driverName}>
          {(item as any).driver?.full_name || 'נהג'}
        </Text>
        <TouchableOpacity style={styles.contactBtn}>
          <Text style={styles.contactBtnText}>צור קשר</Text>
          <Ionicons name="chatbubble" size={14} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <HamburgerMenu />
        <Text style={styles.headerTitle}>טרמפים</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)}>
          <Ionicons name="add-circle" size={28} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Create Ride Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Ionicons name="close" size={24} color={COLORS.gray} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>פרסום טרמפ</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              <ChipPicker
                label="מוצא:"
                items={cities}
                selected={newFrom}
                onSelect={setNewFrom}
                onAddNew={addCity}
                placeholder="הוסף ישוב/עיר..."
              />

              <ChipPicker
                label="יעד:"
                items={cities.filter(c => c !== newFrom)}
                selected={newTo}
                onSelect={setNewTo}
                onAddNew={addCity}
                placeholder="הוסף ישוב/עיר..."
              />

              <View style={styles.rowInputs}>
                <TextInput style={[styles.modalInput, { flex: 1 }]} placeholder="תאריך (01/05) *" value={newDate} onChangeText={setNewDate} textAlign="right" placeholderTextColor={COLORS.grayLight} />
                <TextInput style={[styles.modalInput, { flex: 1 }]} placeholder="שעה (08:00) *" value={newTime} onChangeText={setNewTime} textAlign="right" placeholderTextColor={COLORS.grayLight} />
              </View>

              <View style={styles.rowInputs}>
                <TextInput style={[styles.modalInput, { flex: 1 }]} placeholder="מקומות פנויים" value={newSeats} onChangeText={setNewSeats} keyboardType="numeric" textAlign="right" placeholderTextColor={COLORS.grayLight} />
                <TextInput style={[styles.modalInput, { flex: 1 }]} placeholder="מחיר ₪ (0=חינם)" value={newPrice} onChangeText={setNewPrice} keyboardType="numeric" textAlign="right" placeholderTextColor={COLORS.grayLight} />
              </View>

              <TextInput style={styles.modalInput} placeholder="טלפון ליצירת קשר" value={newPhone} onChangeText={setNewPhone} keyboardType="phone-pad" textAlign="right" placeholderTextColor={COLORS.grayLight} />

              <TouchableOpacity style={[styles.roundTripBtn, isRoundTrip && styles.roundTripBtnActive]} onPress={() => setIsRoundTrip(!isRoundTrip)}>
                <Ionicons name={isRoundTrip ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={isRoundTrip ? COLORS.white : COLORS.gray} />
                <Text style={[styles.roundTripText, isRoundTrip && styles.roundTripTextActive]}>הלוך-חזור</Text>
              </TouchableOpacity>

              {isRoundTrip && (
                <TextInput style={styles.modalInput} placeholder="שעת חזרה (לדוגמה: 17:00)" value={returnTime} onChangeText={setReturnTime} textAlign="right" placeholderTextColor={COLORS.grayLight} />
              )}

              <TextInput style={[styles.modalInput, { height: 60 }]} placeholder="הערות (עישון, מזוודות, עצירות בדרך...)" value={newNotes} onChangeText={setNewNotes} textAlign="right" multiline placeholderTextColor={COLORS.grayLight} />

              <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
                <Text style={styles.createBtnText}>פרסם טרמפ</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <FlatList
        data={rides}
        renderItem={renderRide}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState icon="car-outline" title="אין טרמפים זמינים" subtitle="פרסם טרמפ חדש!" />}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  headerTitle: { fontSize: 22, fontWeight: '700', color: COLORS.primaryDark },
  list: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: 100 },
  card: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, ...SHADOWS.card },
  route: { marginBottom: SPACING.md },
  routePoint: { flexDirection: 'row-reverse', alignItems: 'center', gap: SPACING.sm },
  dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.green },
  dotRed: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.red },
  routeLine: { width: 2, height: 20, backgroundColor: COLORS.grayLight, marginRight: 4, marginVertical: 2, alignSelf: 'flex-end' },
  routeText: { fontSize: 16, fontWeight: '600', color: COLORS.primaryDark },
  cardDetails: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.md, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.grayLight },
  detailItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  detailText: { fontSize: 13, color: COLORS.gray },
  phoneRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: SPACING.sm },
  phoneText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  notesText: { fontSize: 13, color: COLORS.gray, textAlign: 'right', marginBottom: SPACING.sm, fontStyle: 'italic' },
  cardFooter: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  driverName: { fontSize: 14, fontWeight: '600', color: COLORS.primaryDark },
  contactBtn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: SPACING.md, paddingVertical: 8, borderRadius: RADIUS.xl, gap: 6 },
  contactBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.lg, paddingBottom: 40, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.primaryDark },
  modalInput: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.grayLight, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: 15, color: COLORS.black, writingDirection: 'rtl' },
  modalLabel: { fontSize: 14, fontWeight: '600', color: COLORS.primaryDark, textAlign: 'right' },
  rowInputs: { flexDirection: 'row-reverse', gap: 8 },
  cityChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.grayLight, backgroundColor: COLORS.cardBg },
  cityChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  cityChipText: { fontSize: 13, fontWeight: '600', color: COLORS.primaryDark },
  cityChipTextActive: { color: COLORS.white },
  roundTripBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.grayLight, backgroundColor: COLORS.cardBg },
  roundTripBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  roundTripText: { fontSize: 14, fontWeight: '600', color: COLORS.primaryDark },
  roundTripTextActive: { color: COLORS.white },
  createBtn: { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: RADIUS.xl, alignItems: 'center', marginTop: SPACING.sm, ...SHADOWS.button },
  createBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});
