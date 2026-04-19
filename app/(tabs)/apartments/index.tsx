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
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import ScreenWrapper from '../../../src/components/ScreenWrapper';
import HamburgerMenu from '../../../src/components/HamburgerMenu';
import EmptyState from '../../../src/components/EmptyState';
import StarRating from '../../../src/components/StarRating';
import ChipPicker from '../../../src/components/ChipPicker';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../../src/constants/theme';
import { supabase } from '../../../src/lib/supabase';
import { formatDate } from '../../../src/lib/helpers';
import { useSharedListsStore } from '../../../src/stores/sharedListsStore';
import type { Apartment } from '../../../src/types/database';

type SortKey = 'price_asc' | 'price_desc' | 'rooms' | 'rating';

export default function ApartmentsScreen() {
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('price_asc');
  const [loading, setLoading] = useState(true);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const { settlements, addSettlement } = useSharedListsStore();

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newRooms, setNewRooms] = useState('');
  const [newSettlement, setNewSettlement] = useState('צפת');
  const [newAddress, setNewAddress] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newFloor, setNewFloor] = useState('');
  const [newFurnished, setNewFurnished] = useState(false);
  const [newBalcony, setNewBalcony] = useState(false);
  const [newParking, setNewParking] = useState(false);
  const [newPets, setNewPets] = useState(false);
  const [newAvailableFrom, setNewAvailableFrom] = useState('');
  const [newImages, setNewImages] = useState<string[]>([]);

  useEffect(() => {
    fetchApartments();
  }, [sortBy]);

  const fetchApartments = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('apartments')
        .select('*, contact_user:users(full_name, avatar_url)');

      if (sortBy === 'price_asc') query = query.order('price', { ascending: true });
      else if (sortBy === 'price_desc') query = query.order('price', { ascending: false });
      else if (sortBy === 'rooms') query = query.order('rooms', { ascending: false });
      else if (sortBy === 'rating') query = query.order('landlord_rating', { ascending: false });

      const { data } = await query;
      if (data && data.length > 0) setApartments(data as Apartment[]);
    } catch (e) {}
    setLoading(false);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      setNewImages((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const handleCreate = async () => {
    if (!newAddress.trim()) { Alert.alert('שגיאה', 'נא להזין כתובת'); return; }
    if (!newPrice.trim()) { Alert.alert('שגיאה', 'נא להזין מחיר'); return; }
    if (!newRooms.trim()) { Alert.alert('שגיאה', 'נא להזין מספר חדרים'); return; }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { Alert.alert('שגיאה', 'יש להתחבר קודם'); return; }

    setLoading(true);
    const availableFrom = (() => {
      if (!newAvailableFrom.trim()) return new Date().toISOString().split('T')[0];
      const [day, month, year] = newAvailableFrom.split('/').map(Number);
      const d = new Date(year || new Date().getFullYear(), (month || 1) - 1, day || 1);
      return isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    })();

    const { data, error } = await supabase
      .from('apartments')
      .insert({
        contact_user_id: session.user.id,
        address: newAddress ? `${newAddress}, ${newSettlement}` : newSettlement,
        description: newDesc || newTitle,
        price: Number(newPrice),
        rooms: Number(newRooms),
        landlord_rating: 0,
        available_from: availableFrom,
      })
      .select('*, contact_user:users(full_name, avatar_url)')
      .single();
    setLoading(false);

    if (error) { Alert.alert('שגיאה', 'לא ניתן לפרסם את הדירה'); return; }
    setApartments((prev) => [data as Apartment, ...prev]);
    setShowCreate(false);
    resetForm();
    Alert.alert('פורסם!', 'הדירה פורסמה בהצלחה');
  };

  const resetForm = () => {
    setNewTitle(''); setNewPrice(''); setNewRooms(''); setNewSettlement('צפת');
    setNewAddress(''); setNewDesc(''); setNewPhone(''); setNewFloor('');
    setNewFurnished(false); setNewBalcony(false); setNewParking(false); setNewPets(false);
    setNewAvailableFrom(''); setNewImages([]);
  };

  const filteredApartments = apartments.filter((a) => {
    const matchSearch = !search || a.address.includes(search) || a.description.includes(search);
    const matchMinPrice = !minPrice || a.price >= Number(minPrice);
    const matchMaxPrice = !maxPrice || a.price <= Number(maxPrice);
    return matchSearch && matchMinPrice && matchMaxPrice;
  });

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: 'price_asc', label: 'מחיר ↑' },
    { key: 'price_desc', label: 'מחיר ↓' },
    { key: 'rooms', label: 'חדרים' },
    { key: 'rating', label: 'דירוג' },
  ];

  const ToggleChip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
    <TouchableOpacity style={[styles.toggleChip, active && styles.toggleChipActive]} onPress={onPress}>
      <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={active ? COLORS.white : COLORS.gray} />
      <Text style={[styles.toggleChipText, active && styles.toggleChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  const renderApartment = ({ item }: { item: Apartment }) => (
    <View style={styles.card}>
      {item.images && item.images.length > 0 && (
        <Image source={{ uri: item.images[0] }} style={styles.cardImage} />
      )}
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.priceTag}>
            <Text style={styles.priceText}>₪{item.price.toLocaleString()}</Text>
            <Text style={styles.priceLabel}>/חודש</Text>
          </View>
          <View style={styles.roomsBadge}>
            <Ionicons name="bed" size={14} color={COLORS.primary} />
            <Text style={styles.roomsText}>{item.rooms} חדרים</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.addressRow}>
            <Ionicons name="location" size={16} color={COLORS.primary} />
            <Text style={styles.addressText}>{item.address}</Text>
          </View>
          <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
        </View>

        {item.contact_phone ? (
          <View style={styles.phoneRow}>
            <Ionicons name="call" size={14} color={COLORS.primary} />
            <Text style={styles.phoneText}>{item.contact_phone}</Text>
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.availableText}>פנוי מ-{formatDate(item.available_from)}</Text>
          </View>
          <View style={styles.footerRight}>
            <Text style={styles.ratingLabel}>דירוג משכיר</Text>
            <StarRating rating={item.landlord_rating} size={14} />
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <HamburgerMenu />
        <Text style={styles.headerTitle}>דירות</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)}>
          <Ionicons name="add-circle" size={28} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Create Apartment Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Ionicons name="close" size={24} color={COLORS.gray} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>פרסום דירה</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              <ChipPicker
                label="ישוב:"
                items={settlements}
                selected={newSettlement}
                onSelect={setNewSettlement}
                onAddNew={addSettlement}
                placeholder="שם ישוב חדש..."
              />

              <TextInput style={styles.modalInput} placeholder="כתובת / רחוב (אופציונלי)" value={newAddress} onChangeText={setNewAddress} textAlign="right" placeholderTextColor={COLORS.grayLight} />

              <View style={styles.rowInputs}>
                <TextInput style={[styles.modalInput, { flex: 1 }]} placeholder="מחיר ₪ *" value={newPrice} onChangeText={setNewPrice} keyboardType="numeric" textAlign="right" placeholderTextColor={COLORS.grayLight} />
                <TextInput style={[styles.modalInput, { flex: 1 }]} placeholder="חדרים *" value={newRooms} onChangeText={setNewRooms} keyboardType="numeric" textAlign="right" placeholderTextColor={COLORS.grayLight} />
                <TextInput style={[styles.modalInput, { flex: 1 }]} placeholder="קומה" value={newFloor} onChangeText={setNewFloor} keyboardType="numeric" textAlign="right" placeholderTextColor={COLORS.grayLight} />
              </View>

              <TextInput style={[styles.modalInput, { height: 70 }]} placeholder="תיאור הדירה" value={newDesc} onChangeText={setNewDesc} textAlign="right" multiline placeholderTextColor={COLORS.grayLight} />

              <TextInput style={styles.modalInput} placeholder="טלפון ליצירת קשר" value={newPhone} onChangeText={setNewPhone} keyboardType="phone-pad" textAlign="right" placeholderTextColor={COLORS.grayLight} />

              <TextInput style={styles.modalInput} placeholder="תאריך כניסה (לדוגמה: 01/06/2026)" value={newAvailableFrom} onChangeText={setNewAvailableFrom} textAlign="right" placeholderTextColor={COLORS.grayLight} />

              <Text style={styles.modalLabel}>מאפיינים:</Text>
              <View style={styles.toggleRow}>
                <ToggleChip label="מרוהטת" active={newFurnished} onPress={() => setNewFurnished(!newFurnished)} />
                <ToggleChip label="מרפסת" active={newBalcony} onPress={() => setNewBalcony(!newBalcony)} />
                <ToggleChip label="חניה" active={newParking} onPress={() => setNewParking(!newParking)} />
                <ToggleChip label="מותר חיות" active={newPets} onPress={() => setNewPets(!newPets)} />
              </View>

              <TextInput style={[styles.modalInput, { height: 50 }]} placeholder="הערות נוספות" value={newTitle} onChangeText={setNewTitle} textAlign="right" multiline placeholderTextColor={COLORS.grayLight} />

              <Text style={styles.modalLabel}>תמונות:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {newImages.map((uri, i) => (
                  <Image key={i} source={{ uri }} style={styles.thumbImage} />
                ))}
                <TouchableOpacity style={styles.addImageBtn} onPress={pickImage}>
                  <Ionicons name="camera-outline" size={28} color={COLORS.gray} />
                  <Text style={styles.addImageText}>הוסף</Text>
                </TouchableOpacity>
              </ScrollView>

              <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
                <Text style={styles.createBtnText}>פרסם דירה</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={COLORS.gray} />
        <TextInput style={styles.searchInput} placeholder="חפש כתובת..." placeholderTextColor={COLORS.grayLight} value={search} onChangeText={setSearch} textAlign="right" />
      </View>

      {/* Price Filters */}
      <View style={styles.filterRow}>
        <View style={styles.priceFilter}>
          <TextInput style={styles.priceInput} placeholder="מינימום ₪" placeholderTextColor={COLORS.grayLight} value={minPrice} onChangeText={setMinPrice} keyboardType="numeric" textAlign="center" />
        </View>
        <Text style={styles.filterDash}>—</Text>
        <View style={styles.priceFilter}>
          <TextInput style={styles.priceInput} placeholder="מקסימום ₪" placeholderTextColor={COLORS.grayLight} value={maxPrice} onChangeText={setMaxPrice} keyboardType="numeric" textAlign="center" />
        </View>
      </View>

      {/* Sort */}
      <FlatList
        horizontal
        data={SORT_OPTIONS}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.sortChip, sortBy === item.key && styles.sortChipActive]} onPress={() => setSortBy(item.key)}>
            <Text style={[styles.sortText, sortBy === item.key && styles.sortTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sortRow}
      />

      <FlatList
        data={filteredApartments}
        renderItem={renderApartment}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState icon="home-outline" title="אין דירות זמינות" subtitle="פרסם דירה חדשה!" />}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  headerTitle: { fontSize: 22, fontWeight: '700', color: COLORS.primaryDark },
  searchContainer: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: COLORS.cardBg, borderRadius: RADIUS.xl, marginHorizontal: SPACING.lg, paddingHorizontal: SPACING.md, height: 46, gap: SPACING.sm, borderWidth: 1, borderColor: COLORS.grayLight },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.black, writingDirection: 'rtl' },
  filterRow: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: SPACING.lg, marginTop: SPACING.md, gap: SPACING.sm },
  priceFilter: { flex: 1 },
  priceInput: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.grayLight, paddingVertical: 8, paddingHorizontal: SPACING.sm, fontSize: 14, color: COLORS.black },
  filterDash: { color: COLORS.gray, fontSize: 16 },
  sortRow: { paddingHorizontal: SPACING.lg, gap: SPACING.sm, marginTop: SPACING.md, marginBottom: SPACING.sm },
  sortChip: { paddingHorizontal: SPACING.md, paddingVertical: 7, borderRadius: RADIUS.xl, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.grayLight },
  sortChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  sortText: { fontSize: 13, fontWeight: '600', color: COLORS.primaryDark },
  sortTextActive: { color: COLORS.white },
  list: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: 100 },
  card: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, marginBottom: SPACING.md, overflow: 'hidden', ...SHADOWS.card },
  cardImage: { width: '100%', height: 160 },
  cardContent: { padding: SPACING.md },
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  priceTag: { flexDirection: 'row-reverse', alignItems: 'baseline', gap: 2 },
  priceText: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  priceLabel: { fontSize: 12, color: COLORS.gray },
  roomsBadge: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: COLORS.primary + '15', paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.sm, gap: 4 },
  roomsText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  cardBody: { marginBottom: SPACING.sm },
  addressRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginBottom: 4 },
  addressText: { fontSize: 15, fontWeight: '600', color: COLORS.primaryDark },
  description: { fontSize: 13, color: COLORS.gray, textAlign: 'right', lineHeight: 18 },
  phoneRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: SPACING.sm },
  phoneText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  cardFooter: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.grayLight, paddingTop: SPACING.sm },
  availableText: { fontSize: 12, color: COLORS.gray },
  footerRight: { flexDirection: 'row-reverse', alignItems: 'center', gap: SPACING.xs },
  ratingLabel: { fontSize: 12, color: COLORS.gray },
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.lg, paddingBottom: 40, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.primaryDark },
  modalInput: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.grayLight, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: 15, color: COLORS.black, writingDirection: 'rtl' },
  modalLabel: { fontSize: 14, fontWeight: '600', color: COLORS.primaryDark, textAlign: 'right' },
  rowInputs: { flexDirection: 'row-reverse', gap: 8 },
  toggleRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  toggleChip: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.grayLight, backgroundColor: COLORS.cardBg },
  toggleChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  toggleChipText: { fontSize: 13, fontWeight: '500', color: COLORS.primaryDark },
  toggleChipTextActive: { color: COLORS.white },
  thumbImage: { width: 70, height: 70, borderRadius: RADIUS.md },
  addImageBtn: { width: 70, height: 70, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.grayLight, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  addImageText: { fontSize: 11, color: COLORS.gray, marginTop: 2 },
  createBtn: { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: RADIUS.xl, alignItems: 'center', marginTop: SPACING.sm, ...SHADOWS.button },
  createBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});
