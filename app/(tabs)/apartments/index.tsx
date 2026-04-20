import React, { useEffect, useState, useCallback } from 'react';
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
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import DatePickerField from '../../../src/components/DatePickerField';
import * as ImagePicker from 'expo-image-picker';
import ScreenWrapper from '../../../src/components/ScreenWrapper';
import HamburgerMenu from '../../../src/components/HamburgerMenu';
import EmptyState from '../../../src/components/EmptyState';
import StarRating from '../../../src/components/StarRating';
import ChipPicker from '../../../src/components/ChipPicker';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../../src/constants/theme';
import { supabase } from '../../../src/lib/supabase';
import { formatDate } from '../../../src/lib/helpers';
import { uploadApartmentImage } from '../../../src/lib/uploadImage';
import { useSharedListsStore } from '../../../src/stores/sharedListsStore';
import { useAuthStore } from '../../../src/stores/authStore';
import type { Apartment } from '../../../src/types/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type SortKey = 'price_asc' | 'price_desc' | 'rooms' | 'rating';

const AMENITY_LIST: { key: keyof Apartment; icon: string; label: string }[] = [
  { key: 'is_furnished', icon: 'bed-outline', label: 'מרוהטת' },
  { key: 'has_balcony', icon: 'leaf-outline', label: 'מרפסת' },
  { key: 'has_parking', icon: 'car-outline', label: 'חניה' },
  { key: 'pets_allowed', icon: 'paw-outline', label: 'חיות' },
];

export default function ApartmentsScreen() {
  const router = useRouter();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('price_asc');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const { settlements, addSettlement } = useSharedListsStore();
  const { user } = useAuthStore();

  // Create form
  const [showCreate, setShowCreate] = useState(false);
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
  const [newAvailableDate, setNewAvailableDate] = useState<Date | null>(null);
  const [newImages, setNewImages] = useState<string[]>([]);

  // Auto-fill phone when create modal opens
  useEffect(() => {
    if (showCreate) setNewPhone(user?.phone || '');
  }, [showCreate]);

  // Re-fetch on every screen focus (catches deletions/edits from [id] screen)
  useFocusEffect(
    useCallback(() => {
      fetchApartments();
    }, [sortBy])
  );

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
      if (data) setApartments(data as Apartment[]);
    } catch (e) {}
    setLoading(false);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.7,
      orderedSelection: true,
    });
    if (!result.canceled) {
      const uris = result.assets.map(a => a.uri);
      setNewImages((prev) => [...prev, ...uris]);
    }
  };

  const handleCreate = async () => {
    if (!newAddress.trim() && !newSettlement.trim()) { Alert.alert('שגיאה', 'נא להזין כתובת'); return; }
    if (!newPrice.trim()) { Alert.alert('שגיאה', 'נא להזין מחיר'); return; }
    if (!newRooms.trim()) { Alert.alert('שגיאה', 'נא להזין מספר חדרים'); return; }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { Alert.alert('שגיאה', 'יש להתחבר קודם'); return; }

    setUploading(true);

    // Upload images to Supabase Storage one by one (more resilient than Promise.all)
    const imageUrls: string[] = [];
    for (const uri of newImages) {
      try {
        const url = await uploadApartmentImage(uri);
        imageUrls.push(url);
      } catch (e: any) {
        console.warn('Image upload failed:', e?.message || e);
      }
    }
    if (newImages.length > 0 && imageUrls.length === 0) {
      Alert.alert('שים לב', 'לא הצלחנו להעלות תמונות — המודעה תפורסם ללא תמונות');
    }

    const todayISO = new Date().toISOString().split('T')[0];
    const availableFrom = newAvailableDate
      ? newAvailableDate.toISOString().split('T')[0]
      : todayISO;

    const { data, error } = await supabase
      .from('apartments')
      .insert({
        contact_user_id: session.user.id,
        address: newAddress ? `${newAddress}, ${newSettlement}` : newSettlement,
        description: newDesc,
        price: Number(newPrice),
        rooms: Number(newRooms),
        floor: newFloor ? Number(newFloor) : null,
        landlord_rating: 0,
        available_from: availableFrom,
        contact_phone: newPhone || null,
        images: imageUrls,
        is_furnished: newFurnished,
        has_balcony: newBalcony,
        has_parking: newParking,
        pets_allowed: newPets,
      })
      .select('*, contact_user:users(full_name, avatar_url)')
      .single();
    setUploading(false);

    if (error) { Alert.alert('שגיאה', 'לא ניתן לפרסם את הדירה'); return; }
    setApartments((prev) => [data as Apartment, ...prev]);
    setShowCreate(false);
    resetForm();

    // Fire-and-forget: create a pending_action so CHATMED checks relevance 7 days before entry
    if (data?.id && newAvailableDate) {
      supabase.rpc('create_apartment_check_action', {
        p_apartment_id: data.id,
        p_address: data.address,
        p_available_from: availableFrom,
      }).then();
    }

    Alert.alert('פורסם!', 'הדירה פורסמה בהצלחה');
  };

  const resetForm = () => {
    setNewPrice(''); setNewRooms(''); setNewSettlement('צפת');
    setNewAddress(''); setNewDesc(''); setNewPhone(''); setNewFloor('');
    setNewFurnished(false); setNewBalcony(false); setNewParking(false); setNewPets(false);
    setNewAvailableDate(null); setNewImages([]);
  };

  const filteredApartments = apartments.filter((a) => {
    const matchSearch = !search || a.address?.includes(search) || a.description?.includes(search);
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

  const renderApartment = ({ item }: { item: Apartment }) => {
    const hasImage = item.images && item.images.length > 0;
    const amenities = AMENITY_LIST.filter(a => item[a.key]);
    const landlordName = (item as any).contact_user?.full_name;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(tabs)/apartments/${item.id}` as any)}
        activeOpacity={0.9}
      >
        {/* Image / Placeholder */}
        <View style={styles.imageContainer}>
          {hasImage ? (
            <Image source={{ uri: item.images![0] }} style={styles.cardImage} resizeMode="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="home" size={48} color={COLORS.grayLight} />
              <Text style={styles.placeholderText}>אין תמונה</Text>
            </View>
          )}
          {/* Gradient overlay with price */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.72)']}
            style={styles.imageGradient}
          >
            <View style={styles.overlayRow}>
              <Text style={styles.overlayPrice}>₪{item.price.toLocaleString()}<Text style={styles.overlayPerMonth}>/חודש</Text></Text>
              <View style={styles.overlayRooms}>
                <Ionicons name="bed-outline" size={14} color={COLORS.white} />
                <Text style={styles.overlayRoomsText}>{item.rooms} חדרים</Text>
              </View>
            </View>
          </LinearGradient>
          {/* Image count badge */}
          {item.images && item.images.length > 1 && (
            <View style={styles.imageBadge}>
              <Ionicons name="images-outline" size={12} color={COLORS.white} />
              <Text style={styles.imageBadgeText}>{item.images.length}</Text>
            </View>
          )}
        </View>

        {/* Card body */}
        <View style={styles.cardContent}>
          <View style={styles.addressRow}>
            <Ionicons name="location" size={15} color={COLORS.primary} />
            <Text style={styles.addressText} numberOfLines={1}>{item.address}</Text>
          </View>

          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={13} color={COLORS.gray} />
            <Text style={styles.metaText}>פנוי מ-{formatDate(item.available_from)}</Text>
            {item.floor != null && (
              <>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>קומה {item.floor}</Text>
              </>
            )}
          </View>

          {/* Amenity badges */}
          {amenities.length > 0 && (
            <View style={styles.amenityRow}>
              {amenities.map(a => (
                <View key={a.key as string} style={styles.amenityBadge}>
                  <Ionicons name={a.icon as any} size={11} color={COLORS.primary} />
                  <Text style={styles.amenityText}>{a.label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Footer */}
          <View style={styles.cardFooter}>
            <View style={styles.landlordInfo}>
              <Ionicons name="person-circle-outline" size={18} color={COLORS.grayDark} />
              <Text style={styles.landlordName}>{landlordName || 'משכיר'}</Text>
              <StarRating rating={item.landlord_rating} size={12} />
            </View>
            <TouchableOpacity
              style={styles.detailsBtn}
              onPress={() => router.push(`/(tabs)/apartments/${item.id}` as any)}
            >
              <Text style={styles.detailsBtnText}>פרטים</Text>
              <Ionicons name="chevron-back" size={14} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

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

              {user?.phone && (
                <Text style={styles.phoneHint}>טלפון מהפרופיל שלך — ניתן לשנות</Text>
              )}
              <TextInput style={styles.modalInput} placeholder="טלפון ליצירת קשר" value={newPhone} onChangeText={setNewPhone} keyboardType="phone-pad" textAlign="right" placeholderTextColor={COLORS.grayLight} />

              <DatePickerField
                value={newAvailableDate}
                onChange={setNewAvailableDate}
                placeholder="תאריך כניסה"
                minDate={new Date()}
              />

              <Text style={styles.modalLabel}>מאפיינים:</Text>
              <View style={styles.toggleRow}>
                <ToggleChip label="מרוהטת" active={newFurnished} onPress={() => setNewFurnished(!newFurnished)} />
                <ToggleChip label="מרפסת" active={newBalcony} onPress={() => setNewBalcony(!newBalcony)} />
                <ToggleChip label="חניה" active={newParking} onPress={() => setNewParking(!newParking)} />
                <ToggleChip label="מותר חיות" active={newPets} onPress={() => setNewPets(!newPets)} />
              </View>

              <View style={styles.imageLabelRow}>
                <Text style={styles.modalLabel}>תמונות:</Text>
                {newImages.length > 0 && (
                  <Text style={styles.imageCount}>{newImages.length} נבחרו</Text>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {newImages.map((uri, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setNewImages(prev => prev.filter((_, idx) => idx !== i))}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri }} style={styles.thumbImage} />
                    {i === 0 && (
                      <View style={styles.mainBadge}>
                        <Text style={styles.mainBadgeText}>ראשית</Text>
                      </View>
                    )}
                    <View style={styles.thumbRemove}>
                      <Ionicons name="close-circle" size={20} color={COLORS.red} />
                    </View>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.addImageBtn} onPress={pickImage}>
                  <Ionicons name="images-outline" size={28} color={COLORS.gray} />
                  <Text style={styles.addImageText}>הוסף</Text>
                  <Text style={styles.addImageSub}>ניתן לבחור מספר</Text>
                </TouchableOpacity>
              </ScrollView>

              <TouchableOpacity
                style={[styles.createBtn, uploading && { opacity: 0.7 }]}
                onPress={handleCreate}
                disabled={uploading}
              >
                <Text style={styles.createBtnText}>{uploading ? 'מעלה תמונות...' : 'פרסם דירה'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={COLORS.gray} />
        <TextInput
          style={styles.searchInput}
          placeholder="חפש כתובת, ישוב..."
          placeholderTextColor={COLORS.grayLight}
          value={search}
          onChangeText={setSearch}
          textAlign="right"
        />
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sortRow}
      >
        {SORT_OPTIONS.map(item => (
          <TouchableOpacity
            key={item.key}
            style={[styles.sortChip, sortBy === item.key && styles.sortChipActive]}
            onPress={() => setSortBy(item.key)}
          >
            <Text style={[styles.sortText, sortBy === item.key && styles.sortTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

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
  filterRow: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: SPACING.lg, marginTop: SPACING.sm, gap: SPACING.sm },
  priceFilter: { flex: 1 },
  priceInput: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.grayLight, paddingVertical: 8, paddingHorizontal: SPACING.sm, fontSize: 14, color: COLORS.black },
  filterDash: { color: COLORS.gray, fontSize: 16 },
  sortRow: { paddingHorizontal: SPACING.lg, gap: SPACING.sm, marginTop: SPACING.sm, marginBottom: SPACING.xs },
  sortChip: { paddingHorizontal: SPACING.md, paddingVertical: 7, borderRadius: RADIUS.xl, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.grayLight },
  sortChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  sortText: { fontSize: 13, fontWeight: '600', color: COLORS.black },
  sortTextActive: { color: COLORS.white },
  list: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: 100 },

  // Card
  card: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, marginBottom: SPACING.md, overflow: 'hidden', ...SHADOWS.card },
  imageContainer: { width: '100%', height: 200, position: 'relative' },
  cardImage: { width: '100%', height: '100%' },
  imagePlaceholder: { width: '100%', height: '100%', backgroundColor: COLORS.creamDark, alignItems: 'center', justifyContent: 'center', gap: 6 },
  placeholderText: { fontSize: 13, color: COLORS.grayLight },
  imageGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, justifyContent: 'flex-end', paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm },
  overlayRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-end' },
  overlayPrice: { fontSize: 22, fontWeight: '800', color: COLORS.white },
  overlayPerMonth: { fontSize: 13, fontWeight: '400', color: 'rgba(255,255,255,0.85)' },
  overlayRooms: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.sm },
  overlayRoomsText: { fontSize: 13, color: COLORS.white, fontWeight: '600' },
  imageBadge: { position: 'absolute', top: SPACING.sm, left: SPACING.sm, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: RADIUS.sm },
  imageBadgeText: { fontSize: 12, color: COLORS.white, fontWeight: '600' },

  cardContent: { padding: SPACING.md, gap: SPACING.xs },
  addressRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  addressText: { fontSize: 15, fontWeight: '700', color: COLORS.primaryDark, flex: 1, textAlign: 'right' },
  metaRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, color: COLORS.gray },
  metaDot: { fontSize: 12, color: COLORS.grayLight },
  amenityRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  amenityBadge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3, backgroundColor: COLORS.primary + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm },
  amenityText: { fontSize: 11, fontWeight: '600', color: COLORS.primary },
  cardFooter: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.grayLight, paddingTop: SPACING.sm, marginTop: SPACING.xs },
  landlordInfo: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  landlordName: { fontSize: 13, color: COLORS.grayDark, fontWeight: '500' },
  detailsBtn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: SPACING.md, paddingVertical: 7, borderRadius: RADIUS.xl, gap: 3 },
  detailsBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },

  // Modal
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
  imageLabelRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  imageCount: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  thumbImage: { width: 90, height: 90, borderRadius: RADIUS.md },
  thumbRemove: { position: 'absolute', top: -6, right: -6 },
  mainBadge: { position: 'absolute', bottom: 4, left: 0, right: 0, alignItems: 'center' },
  mainBadgeText: { fontSize: 10, color: COLORS.white, backgroundColor: COLORS.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.sm, overflow: 'hidden', fontWeight: '700' },
  addImageBtn: { width: 90, height: 90, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.primary, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 2 },
  addImageText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  addImageSub: { fontSize: 10, color: COLORS.gray },
  phoneHint: { fontSize: 11, color: COLORS.gray, textAlign: 'right' },
  createBtn: { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: RADIUS.xl, alignItems: 'center', marginTop: SPACING.sm, ...SHADOWS.button },
  createBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});
