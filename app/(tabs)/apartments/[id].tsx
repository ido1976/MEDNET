import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  FlatList,
  Dimensions,
  Linking,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import ScreenWrapper from '../../../src/components/ScreenWrapper';
import StarRating from '../../../src/components/StarRating';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../../src/constants/theme';
import { supabase } from '../../../src/lib/supabase';
import { formatDate } from '../../../src/lib/helpers';
import { uploadApartmentImage } from '../../../src/lib/uploadImage';
import { useAuthStore } from '../../../src/stores/authStore';
import { trackView, trackReact } from '../../../src/lib/activityTracker';
import DatePickerField from '../../../src/components/DatePickerField';
import type { Apartment } from '../../../src/types/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AMENITY_LIST = [
  { key: 'is_furnished' as keyof Apartment, icon: 'bed-outline', label: 'מרוהטת' },
  { key: 'has_balcony' as keyof Apartment, icon: 'leaf-outline', label: 'מרפסת' },
  { key: 'has_parking' as keyof Apartment, icon: 'car-outline', label: 'חניה' },
  { key: 'pets_allowed' as keyof Apartment, icon: 'paw-outline', label: 'מותר חיות' },
];

const ToggleChip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
  <TouchableOpacity style={[styles.toggleChip, active && styles.toggleChipActive]} onPress={onPress}>
    <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={active ? COLORS.white : COLORS.gray} />
    <Text style={[styles.toggleChipText, active && styles.toggleChipTextActive]}>{label}</Text>
  </TouchableOpacity>
);

export default function ApartmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();

  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Edit modal state
  const [showEdit, setShowEdit] = useState(false);
  const [editPrice, setEditPrice] = useState('');
  const [editRooms, setEditRooms] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editFloor, setEditFloor] = useState('');
  const [editAvailableDate, setEditAvailableDate] = useState<Date | null>(null);
  const [editFurnished, setEditFurnished] = useState(false);
  const [editBalcony, setEditBalcony] = useState(false);
  const [editParking, setEditParking] = useState(false);
  const [editPets, setEditPets] = useState(false);
  const [editImages, setEditImages] = useState<string[]>([]);
  const [editNewImages, setEditNewImages] = useState<string[]>([]);
  const [editUploading, setEditUploading] = useState(false);

  // Analytics: track only one image-scroll event per visit
  const hasTrackedImageScroll = useRef(false);

  useEffect(() => {
    if (id) loadApartment();
  }, [id]);

  // Track view when apartment loads (non-owners only)
  useEffect(() => {
    if (id && apartment && !isOwner) {
      trackView('apartment', id);
    }
  }, [id, apartment]);

  const loadApartment = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('apartments')
        .select('*, contact_user:users(full_name, avatar_url, phone)')
        .eq('id', id)
        .single();
      if (!error && data) setApartment(data as Apartment);
    } catch (e) {}
    setLoading(false);
  };

  const isOwner = user?.id === apartment?.contact_user_id;

  // ──────────────────────────────────────
  // Delete
  // ──────────────────────────────────────
  const handleDelete = () => {
    Alert.alert(
      'מחיקת מודעה',
      'האם אתה בטוח? פעולה זו אינה ניתנת לביטול.',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.from('apartments').delete().eq('id', id);
              // Mark related apartment_check as completed
              await supabase
                .from('pending_actions')
                .update({ status: 'completed', completed_at: new Date().toISOString() })
                .eq('user_id', user!.id)
                .eq('action_type', 'apartment_check')
                .filter('metadata->>apartment_id', 'eq', id);
              router.back();
            } catch (e) {
              Alert.alert('שגיאה', 'לא ניתן למחוק את המודעה');
            }
          },
        },
      ]
    );
  };

  // ──────────────────────────────────────
  // Edit helpers
  // ──────────────────────────────────────
  const openEdit = () => {
    if (!apartment) return;
    setEditPrice(String(apartment.price));
    setEditRooms(String(apartment.rooms));
    setEditAddress(apartment.address);
    setEditDesc(apartment.description || '');
    setEditPhone(apartment.contact_phone || '');
    setEditFloor(apartment.floor != null ? String(apartment.floor) : '');
    setEditAvailableDate(apartment.available_from ? new Date(apartment.available_from) : null);
    setEditFurnished(apartment.is_furnished || false);
    setEditBalcony(apartment.has_balcony || false);
    setEditParking(apartment.has_parking || false);
    setEditPets(apartment.pets_allowed || false);
    setEditImages(apartment.images || []);
    setEditNewImages([]);
    setShowEdit(true);
  };

  const pickEditImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.7,
      orderedSelection: true,
    });
    if (!result.canceled) {
      setEditNewImages(prev => [...prev, ...result.assets.map(a => a.uri)]);
    }
  };

  const handleUpdate = async () => {
    if (!editAddress.trim()) { Alert.alert('שגיאה', 'נא להזין כתובת'); return; }
    if (!editPrice.trim()) { Alert.alert('שגיאה', 'נא להזין מחיר'); return; }

    setEditUploading(true);

    // Upload new images
    const newUrls: string[] = [];
    for (const uri of editNewImages) {
      try {
        const url = await uploadApartmentImage(uri);
        newUrls.push(url);
      } catch (e: any) {
        console.warn('Image upload failed:', e?.message || e);
      }
    }

    const availableFrom = editAvailableDate
      ? editAvailableDate.toISOString().split('T')[0]
      : apartment!.available_from;

    const { data, error } = await supabase
      .from('apartments')
      .update({
        address: editAddress,
        description: editDesc,
        price: Number(editPrice),
        rooms: Number(editRooms),
        floor: editFloor ? Number(editFloor) : null,
        available_from: availableFrom,
        contact_phone: editPhone || null,
        images: [...editImages, ...newUrls],
        is_furnished: editFurnished,
        has_balcony: editBalcony,
        has_parking: editParking,
        pets_allowed: editPets,
      })
      .eq('id', id)
      .select('*, contact_user:users(full_name, avatar_url, phone)')
      .single();

    setEditUploading(false);

    if (error) { Alert.alert('שגיאה', 'לא ניתן לשמור שינויים'); return; }
    setApartment(data as Apartment);
    setShowEdit(false);
  };

  // ──────────────────────────────────────
  // Contact actions
  // ──────────────────────────────────────
  const handleCall = () => {
    const phone = apartment?.contact_phone || (apartment as any)?.contact_user?.phone;
    if (!phone) { Alert.alert('שגיאה', 'לא צוין מספר טלפון'); return; }
    if (!isOwner) trackReact('apartment', id, { action: 'phone_click' });
    Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsApp = () => {
    const phone = apartment?.contact_phone || (apartment as any)?.contact_user?.phone;
    if (!phone) { Alert.alert('שגיאה', 'לא צוין מספר טלפון'); return; }
    if (!isOwner) trackReact('apartment', id, { action: 'whatsapp_click' });
    const normalized = '972' + phone.replace(/^0/, '').replace(/\D/g, '');
    Linking.openURL(`whatsapp://send?phone=${normalized}`);
  };

  // ──────────────────────────────────────
  // Loading / not-found states
  // ──────────────────────────────────────
  if (loading) {
    return (
      <ScreenWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  if (!apartment) {
    return (
      <ScreenWrapper>
        <View style={styles.loadingContainer}>
          <Ionicons name="home-outline" size={64} color={COLORS.grayLight} />
          <Text style={{ color: COLORS.gray, marginTop: SPACING.md }}>הדירה לא נמצאה</Text>
        </View>
      </ScreenWrapper>
    );
  }

  const images = apartment.images || [];
  const amenities = AMENITY_LIST.filter(a => apartment[a.key]);
  const landlord = (apartment as any).contact_user;
  const contactPhone = apartment.contact_phone || landlord?.phone;

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-forward" size={22} color={COLORS.primaryDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{apartment.address}</Text>
          <View style={{ width: 38 }} />
        </View>

        {/* Image Carousel */}
        {images.length > 0 ? (
          <View style={styles.carouselContainer}>
            <FlatList
              data={images}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, i) => i.toString()}
              renderItem={({ item }) => (
                <Image source={{ uri: item }} style={styles.carouselImage} resizeMode="cover" />
              )}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                setActiveImageIndex(idx);
                if (!isOwner && !hasTrackedImageScroll.current && idx > 0) {
                  hasTrackedImageScroll.current = true;
                  trackReact('apartment', id, { action: 'image_scroll' });
                }
              }}
            />
            {images.length > 1 && (
              <View style={styles.imageCounter}>
                <Ionicons name="images-outline" size={13} color={COLORS.white} />
                <Text style={styles.imageCounterText}>{activeImageIndex + 1} / {images.length}</Text>
              </View>
            )}
            {images.length > 1 && (
              <View style={styles.dotsRow}>
                {images.map((_, i) => (
                  <View key={i} style={[styles.dot, i === activeImageIndex && styles.dotActive]} />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.noImageBanner}>
            <Ionicons name="home" size={64} color={COLORS.grayLight} />
            <Text style={styles.noImageText}>אין תמונות למודעה זו</Text>
          </View>
        )}

        {/* Hero info */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <Text style={styles.heroPrice}>₪{apartment.price.toLocaleString()}<Text style={styles.heroPerMonth}>/חודש</Text></Text>
            <View style={styles.heroMeta}>
              <View style={styles.heroBadge}>
                <Ionicons name="bed-outline" size={14} color={COLORS.primary} />
                <Text style={styles.heroBadgeText}>{apartment.rooms} חדרים</Text>
              </View>
              {apartment.floor != null && (
                <View style={styles.heroBadge}>
                  <Ionicons name="layers-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.heroBadgeText}>קומה {apartment.floor}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.addressRow}>
            <Ionicons name="location" size={16} color={COLORS.primary} />
            <Text style={styles.addressText}>{apartment.address}</Text>
          </View>

          <View style={styles.availableRow}>
            <Ionicons name="calendar-outline" size={15} color={COLORS.gray} />
            <Text style={styles.availableText}>פנוי מ-{formatDate(apartment.available_from)}</Text>
          </View>
        </View>

        {/* Description */}
        {!!apartment.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>תיאור</Text>
            <Text style={styles.descriptionText}>{apartment.description}</Text>
          </View>
        )}

        {/* Amenities */}
        {amenities.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>מאפיינים</Text>
            <View style={styles.amenityGrid}>
              {amenities.map(a => (
                <View key={a.key as string} style={styles.amenityItem}>
                  <View style={styles.amenityIconBox}>
                    <Ionicons name={a.icon as any} size={20} color={COLORS.primary} />
                  </View>
                  <Text style={styles.amenityLabel}>{a.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Landlord + Contact */}
        <View style={[styles.section, styles.contactSection]}>
          <Text style={styles.sectionTitle}>פרטי משכיר</Text>

          <View style={styles.landlordRow}>
            <Ionicons name="person-circle" size={44} color={COLORS.primary} />
            <View style={styles.landlordInfo}>
              <Text style={styles.landlordName}>{landlord?.full_name || 'משכיר'}</Text>
              <View style={styles.ratingRow}>
                <StarRating rating={apartment.landlord_rating} size={15} />
                {apartment.landlord_rating > 0 && (
                  <Text style={styles.ratingText}>({apartment.landlord_rating}/5)</Text>
                )}
              </View>
            </View>
          </View>

          {contactPhone ? (
            <>
              <Text style={styles.phoneDisplay}>{contactPhone}</Text>
              <TouchableOpacity style={styles.callBtn} onPress={handleCall}>
                <Ionicons name="call" size={18} color={COLORS.white} />
                <Text style={styles.callBtnText}>התקשר</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.whatsappBtn} onPress={handleWhatsApp}>
                <Ionicons name="logo-whatsapp" size={18} color={COLORS.white} />
                <Text style={styles.whatsappBtnText}>שלח הודעה בוואטסאפ</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.noPhoneText}>לא צוין טלפון — צור קשר דרך מערכת ההודעות</Text>
          )}
        </View>

        {/* Owner Actions */}
        {isOwner && (
          <View style={[styles.section, styles.ownerSection]}>
            <Text style={styles.sectionTitle}>ניהול מודעה</Text>
            <TouchableOpacity style={styles.editBtn} onPress={openEdit}>
              <Ionicons name="create-outline" size={20} color={COLORS.white} />
              <Text style={styles.editBtnText}>ערוך מודעה</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={20} color={COLORS.red} />
              <Text style={styles.deleteBtnText}>מחק מודעה</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ─────────── Edit Modal ─────────── */}
      <Modal visible={showEdit} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowEdit(false)}>
                <Ionicons name="close" size={24} color={COLORS.gray} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>עריכת מודעה</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              <TextInput
                style={styles.modalInput}
                placeholder="כתובת *"
                value={editAddress}
                onChangeText={setEditAddress}
                textAlign="right"
                placeholderTextColor={COLORS.grayLight}
              />

              <View style={styles.rowInputs}>
                <TextInput
                  style={[styles.modalInput, { flex: 1 }]}
                  placeholder="מחיר ₪ *"
                  value={editPrice}
                  onChangeText={setEditPrice}
                  keyboardType="numeric"
                  textAlign="right"
                  placeholderTextColor={COLORS.grayLight}
                />
                <TextInput
                  style={[styles.modalInput, { flex: 1 }]}
                  placeholder="חדרים *"
                  value={editRooms}
                  onChangeText={setEditRooms}
                  keyboardType="numeric"
                  textAlign="right"
                  placeholderTextColor={COLORS.grayLight}
                />
                <TextInput
                  style={[styles.modalInput, { flex: 1 }]}
                  placeholder="קומה"
                  value={editFloor}
                  onChangeText={setEditFloor}
                  keyboardType="numeric"
                  textAlign="right"
                  placeholderTextColor={COLORS.grayLight}
                />
              </View>

              <TextInput
                style={[styles.modalInput, { height: 70 }]}
                placeholder="תיאור הדירה"
                value={editDesc}
                onChangeText={setEditDesc}
                textAlign="right"
                multiline
                placeholderTextColor={COLORS.grayLight}
              />

              <TextInput
                style={styles.modalInput}
                placeholder="טלפון ליצירת קשר"
                value={editPhone}
                onChangeText={setEditPhone}
                keyboardType="phone-pad"
                textAlign="right"
                placeholderTextColor={COLORS.grayLight}
              />

              <DatePickerField
                value={editAvailableDate}
                onChange={setEditAvailableDate}
                placeholder="תאריך כניסה"
              />

              <Text style={styles.modalLabel}>מאפיינים:</Text>
              <View style={styles.toggleRow}>
                <ToggleChip label="מרוהטת" active={editFurnished} onPress={() => setEditFurnished(!editFurnished)} />
                <ToggleChip label="מרפסת" active={editBalcony} onPress={() => setEditBalcony(!editBalcony)} />
                <ToggleChip label="חניה" active={editParking} onPress={() => setEditParking(!editParking)} />
                <ToggleChip label="מותר חיות" active={editPets} onPress={() => setEditPets(!editPets)} />
              </View>

              {/* Existing images */}
              <Text style={styles.modalLabel}>תמונות:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {editImages.map((url, i) => (
                  <TouchableOpacity
                    key={`existing-${i}`}
                    onPress={() => setEditImages(prev => prev.filter((_, idx) => idx !== i))}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: url }} style={styles.thumbImage} />
                    <View style={styles.thumbRemove}>
                      <Ionicons name="close-circle" size={20} color={COLORS.red} />
                    </View>
                  </TouchableOpacity>
                ))}
                {editNewImages.map((uri, i) => (
                  <TouchableOpacity
                    key={`new-${i}`}
                    onPress={() => setEditNewImages(prev => prev.filter((_, idx) => idx !== i))}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri }} style={[styles.thumbImage, styles.newThumb]} />
                    <View style={styles.thumbRemove}>
                      <Ionicons name="close-circle" size={20} color={COLORS.red} />
                    </View>
                    <View style={styles.newBadge}>
                      <Text style={styles.newBadgeText}>חדש</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.addImageBtn} onPress={pickEditImages}>
                  <Ionicons name="images-outline" size={28} color={COLORS.gray} />
                  <Text style={styles.addImageText}>הוסף</Text>
                </TouchableOpacity>
              </ScrollView>

              <TouchableOpacity
                style={[styles.saveBtn, editUploading && { opacity: 0.7 }]}
                onPress={handleUpdate}
                disabled={editUploading}
              >
                <Text style={styles.saveBtnText}>{editUploading ? 'שומר...' : 'שמור שינויים'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 100 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },

  // Header
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center', ...SHADOWS.card },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: COLORS.primaryDark, textAlign: 'center', marginHorizontal: SPACING.sm },

  // Carousel
  carouselContainer: { marginBottom: SPACING.md, position: 'relative' },
  carouselImage: { width: SCREEN_WIDTH, height: 280 },
  dotsRow: { position: 'absolute', bottom: SPACING.sm, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  imageCounter: { position: 'absolute', top: SPACING.sm, right: SPACING.sm, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.xl },
  imageCounterText: { fontSize: 13, color: COLORS.white, fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: COLORS.white, width: 22 },
  noImageBanner: { marginHorizontal: SPACING.lg, height: 160, backgroundColor: COLORS.creamDark, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md, gap: SPACING.sm },
  noImageText: { fontSize: 14, color: COLORS.grayLight },

  // Hero
  heroCard: { marginHorizontal: SPACING.lg, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.lg, gap: SPACING.sm, ...SHADOWS.card, marginBottom: SPACING.md },
  heroTopRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroPrice: { fontSize: 28, fontWeight: '800', color: COLORS.primary },
  heroPerMonth: { fontSize: 14, fontWeight: '400', color: COLORS.gray },
  heroMeta: { flexDirection: 'column', gap: SPACING.xs, alignItems: 'flex-end' },
  heroBadge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, backgroundColor: COLORS.primary + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.sm },
  heroBadgeText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  addressRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  addressText: { fontSize: 16, fontWeight: '600', color: COLORS.primaryDark, textAlign: 'right', flex: 1 },
  availableRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  availableText: { fontSize: 13, color: COLORS.gray },

  // Sections
  section: { marginHorizontal: SPACING.lg, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.lg, gap: SPACING.sm, ...SHADOWS.card, marginBottom: SPACING.md },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.primaryDark, textAlign: 'right', marginBottom: 4 },
  descriptionText: { fontSize: 15, color: COLORS.gray, textAlign: 'right', lineHeight: 22 },

  // Amenities
  amenityGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: SPACING.sm },
  amenityItem: { alignItems: 'center', gap: 5, minWidth: 70 },
  amenityIconBox: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primary + '15', alignItems: 'center', justifyContent: 'center' },
  amenityLabel: { fontSize: 12, fontWeight: '600', color: COLORS.primaryDark },

  // Contact
  contactSection: { gap: SPACING.md },
  landlordRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: SPACING.md },
  landlordInfo: { flex: 1, alignItems: 'flex-end', gap: 4 },
  landlordName: { fontSize: 17, fontWeight: '700', color: COLORS.primaryDark },
  ratingRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: SPACING.xs },
  ratingText: { fontSize: 13, color: COLORS.gray },
  phoneDisplay: { fontSize: 18, fontWeight: '700', color: COLORS.primaryDark, textAlign: 'center', letterSpacing: 1, paddingVertical: SPACING.xs },
  callBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: RADIUS.xl, ...SHADOWS.button },
  callBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  whatsappBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#25D366', paddingVertical: 14, borderRadius: RADIUS.xl },
  whatsappBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  noPhoneText: { fontSize: 13, color: COLORS.gray, textAlign: 'center', fontStyle: 'italic' },

  // Owner Actions
  ownerSection: { gap: SPACING.sm },
  editBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: RADIUS.xl, ...SHADOWS.button },
  editBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  deleteBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: COLORS.red, paddingVertical: 13, borderRadius: RADIUS.xl },
  deleteBtnText: { color: COLORS.red, fontSize: 16, fontWeight: '700' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.lg, paddingBottom: 40, maxHeight: '88%' },
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
  thumbImage: { width: 90, height: 90, borderRadius: RADIUS.md },
  newThumb: { opacity: 0.85, borderWidth: 2, borderColor: COLORS.primary },
  thumbRemove: { position: 'absolute', top: -6, right: -6 },
  newBadge: { position: 'absolute', bottom: 4, left: 0, right: 0, alignItems: 'center' },
  newBadgeText: { fontSize: 10, color: COLORS.white, backgroundColor: COLORS.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.sm, overflow: 'hidden', fontWeight: '700' },
  addImageBtn: { width: 90, height: 90, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.primary, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 2 },
  addImageText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  saveBtn: { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: RADIUS.xl, alignItems: 'center', marginTop: SPACING.sm, ...SHADOWS.button },
  saveBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});
