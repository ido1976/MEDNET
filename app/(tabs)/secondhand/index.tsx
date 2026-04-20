import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  Alert,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import ScreenWrapper from '../../../src/components/ScreenWrapper';
import HamburgerMenu from '../../../src/components/HamburgerMenu';
import EmptyState from '../../../src/components/EmptyState';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../../src/constants/theme';
import { useSecondhandStore } from '../../../src/stores/secondhandStore';
import { useAuthStore } from '../../../src/stores/authStore';
import { uploadImage } from '../../../src/lib/uploadImage';
import { supabase } from '../../../src/lib/supabase';
import type { SecondhandListing } from '../../../src/types/database';

const CATEGORIES = [
  { id: 'all', label: 'הכל' },
  { id: 'product', label: 'מוצרים' },
  { id: 'service', label: 'שירותים' },
  { id: 'giveaway', label: 'למסירה 🎁' },
  { id: 'other', label: 'אחר' },
];

export default function SecondhandScreen() {
  const router = useRouter();
  const { user, session } = useAuthStore();
  const { listings, loading, fetchListings, createListing } = useSecondhandStore();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCategory, setNewCategory] = useState<'product' | 'service' | 'other' | 'giveaway'>('product');
  const [newImages, setNewImages] = useState<string[]>([]);

  // Refresh on every screen focus (like apartments)
  useFocusEffect(
    useCallback(() => {
      fetchListings(selectedCategory === 'all' ? undefined : selectedCategory);
    }, [selectedCategory])
  );

  // Auto-fill phone from profile when modal opens
  useEffect(() => {
    if (showCreate) {
      setNewPhone(user?.phone || '');
    }
  }, [showCreate]);

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      const uris = result.assets.map((a) => a.uri);
      setNewImages((prev) => [...prev, ...uris].slice(0, 6)); // max 6 images
    }
  };

  const removeImage = (index: number) => {
    setNewImages((prev) => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setNewTitle('');
    setNewDesc('');
    setNewPrice('');
    setNewPhone('');
    setNewCategory('product' as const);
    setNewImages([]);
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      Alert.alert('שגיאה', 'נא להזין כותרת');
      return;
    }
    if (!session?.user?.id) {
      Alert.alert('שגיאה', 'יש להתחבר תחילה');
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload images to Storage before saving
      const uploadedUrls: string[] = [];
      for (const uri of newImages) {
        try {
          const url = await uploadImage(uri, 'secondhand-images');
          uploadedUrls.push(url);
        } catch (err) {
          console.warn('Image upload failed, skipping:', err);
        }
      }

      const result = await createListing({
        title: newTitle.trim(),
        description: newDesc.trim(),
        category: newCategory,
        price: newCategory === 'giveaway' ? null : (newPrice ? parseFloat(newPrice) : null),
        images: uploadedUrls,
        contact_info: newPhone.trim() || '',
        contact_phone: newPhone.trim() || undefined,
        created_by: session.user.id,
        status: 'active',
      });

      if (result.error) {
        Alert.alert('שגיאה', result.error);
        return;
      }

      // Fire-and-forget: schedule CHATMED relevance check in 30 days
      if (result.id) {
        supabase
          .rpc('create_secondhand_check_action', {
            p_listing_id: result.id,
            p_title: newTitle.trim(),
          })
          .then(({ error }) => {
            if (error) console.warn('create_secondhand_check_action failed:', error);
          });
      }

      setShowCreate(false);
      resetForm();
    } catch (err: any) {
      Alert.alert('שגיאה', err.message || 'שגיאה לא צפויה');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredListings = listings.filter((l) => {
    if (!search) return true;
    return l.title.includes(search) || l.description?.includes(search);
  });

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'product': return 'מוצר';
      case 'service': return 'שירות';
      case 'giveaway': return 'למסירה 🎁';
      default: return 'אחר';
    }
  };

  const renderListing = ({ item }: { item: SecondhandListing }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => router.push(`/(tabs)/secondhand/${item.id}`)}
    >
      <View style={styles.cardRow}>
        {/* Info — takes remaining space */}
        <View style={styles.cardContent}>
          {/* Title + category badge */}
          <View style={styles.cardTitleRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{getCategoryLabel(item.category)}</Text>
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          </View>

          {/* Description */}
          {item.description ? (
            <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
          ) : null}

          {/* Price */}
          {item.category === 'giveaway' ? (
            <Text style={styles.giveawayText}>ללא תשלום 🎁</Text>
          ) : item.price != null ? (
            <Text style={styles.priceText}>₪{item.price.toLocaleString()}</Text>
          ) : (
            <Text style={styles.noPriceText}>ללא מחיר</Text>
          )}

          {/* Footer: seller + status badge */}
          <View style={styles.cardFooter}>
            {(item as any).creator?.full_name ? (
              <View style={styles.sellerRow}>
                <Ionicons name="person-circle-outline" size={13} color={COLORS.gray} />
                <Text style={styles.sellerText} numberOfLines={1}>
                  {(item as any).creator.full_name}
                </Text>
              </View>
            ) : <View />}
            {item.status === 'sold' && (
              <View style={styles.soldBadge}>
                <Text style={styles.soldBadgeText}>נמכר 🔴</Text>
              </View>
            )}
          </View>
        </View>

        {/* Image — fixed 110×110 on the right */}
        <View style={styles.cardImageContainer}>
          {item.images?.[0] ? (
            <Image source={{ uri: item.images[0] }} style={styles.cardImage} />
          ) : (
            <View style={styles.cardImagePlaceholder}>
              <Ionicons name="bag-handle-outline" size={32} color={COLORS.grayLight} />
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <HamburgerMenu />
        <Text style={styles.headerTitle}>יד שנייה מרופאה</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)}>
          <Ionicons name="add-circle" size={28} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { setShowCreate(false); resetForm(); }}>
                <Ionicons name="close" size={24} color={COLORS.gray} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>פרסום חדש</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {/* Category — first so user sets context */}
              <Text style={styles.modalLabel}>קטגוריה:</Text>
              <View style={styles.categoryRow}>
                {(['product', 'service', 'giveaway', 'other'] as const).map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catChip, newCategory === cat && styles.catChipActive]}
                    onPress={() => setNewCategory(cat)}
                  >
                    <Text style={[styles.catChipText, newCategory === cat && styles.catChipTextActive]}>
                      {getCategoryLabel(cat)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.modalInput}
                placeholder="כותרת *"
                value={newTitle}
                onChangeText={setNewTitle}
                textAlign="right"
                placeholderTextColor={COLORS.grayLight}
              />
              <TextInput
                style={[styles.modalInput, { height: 80 }]}
                placeholder="תיאור"
                value={newDesc}
                onChangeText={setNewDesc}
                textAlign="right"
                multiline
                placeholderTextColor={COLORS.grayLight}
              />
              {newCategory === 'giveaway' ? (
                <View style={styles.freeLabelRow}>
                  <Ionicons name="gift-outline" size={16} color={COLORS.accent} />
                  <Text style={styles.freeLabelText}>ללא תשלום — למסירה</Text>
                </View>
              ) : (
                <TextInput
                  style={styles.modalInput}
                  placeholder="מחיר ₪ (אופציונלי)"
                  value={newPrice}
                  onChangeText={setNewPrice}
                  textAlign="right"
                  keyboardType="numeric"
                  placeholderTextColor={COLORS.grayLight}
                />
              )}

              {/* Phone — auto-filled from profile */}
              <View>
                <TextInput
                  style={styles.modalInput}
                  placeholder="טלפון ליצירת קשר"
                  value={newPhone}
                  onChangeText={setNewPhone}
                  textAlign="right"
                  keyboardType="phone-pad"
                  placeholderTextColor={COLORS.grayLight}
                />
                {user?.phone ? (
                  <Text style={styles.phoneHint}>מולא אוטומטית מהפרופיל שלך</Text>
                ) : null}
              </View>

              {/* Images */}
              <Text style={styles.modalLabel}>תמונות (עד 6):</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imagesRow}>
                {newImages.map((uri, idx) => (
                  <View key={idx} style={styles.imageThumbContainer}>
                    <Image source={{ uri }} style={styles.imageThumb} />
                    <TouchableOpacity style={styles.removeImageBtn} onPress={() => removeImage(idx)}>
                      <Ionicons name="close-circle" size={22} color={COLORS.red} />
                    </TouchableOpacity>
                  </View>
                ))}
                {newImages.length < 6 && (
                  <TouchableOpacity style={styles.addImageBtn} onPress={pickImages}>
                    <Ionicons name="camera-outline" size={28} color={COLORS.gray} />
                    <Text style={styles.addImageText}>הוסף</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>

              <TouchableOpacity
                style={[styles.createBtn, isSubmitting && { opacity: 0.7 }]}
                onPress={handleCreate}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.createBtnText}>פרסם</Text>
                )}
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
          placeholder="חפש מוצר או שירות..."
          placeholderTextColor={COLORS.grayLight}
          value={search}
          onChangeText={setSearch}
          textAlign="right"
        />
      </View>

      {/* Category Filter */}
      <FlatList
        horizontal
        data={CATEGORIES}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterChip, selectedCategory === item.id && styles.filterChipActive]}
            onPress={() => setSelectedCategory(item.id)}
          >
            <Text style={[styles.filterChipText, selectedCategory === item.id && styles.filterChipTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
      />

      <FlatList
        data={filteredListings}
        renderItem={renderListing}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading
            ? <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
            : <EmptyState icon="bag-handle-outline" title="אין פרסומים" subtitle="פרסם משהו חדש!" />
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
    fontSize: 20,
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
  filtersRow: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.grayLight,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primaryDark,
  },
  filterChipTextActive: {
    color: COLORS.white,
  },
  list: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 100,
    paddingTop: SPACING.sm,
  },

  // Horizontal card layout
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  cardRow: {
    flexDirection: 'row',
    padding: SPACING.md,
    gap: SPACING.md,
    alignItems: 'flex-start',
  },
  cardContent: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 4,
  },
  cardTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: SPACING.xs,
    flexWrap: 'wrap',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primaryDark,
    textAlign: 'right',
    flex: 1,
  },
  categoryBadge: {
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.primary,
  },
  cardDesc: {
    fontSize: 13,
    color: COLORS.gray,
    textAlign: 'right',
    lineHeight: 18,
  },
  priceText: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.accent,
    textAlign: 'right',
    marginTop: 2,
  },
  noPriceText: {
    fontSize: 13,
    color: COLORS.grayLight,
    textAlign: 'right',
    fontStyle: 'italic',
  },
  giveawayText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.accent,
    textAlign: 'right',
    marginTop: 2,
  },
  freeLabelRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.accent + '15',
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  freeLabelText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.accent,
  },
  cardFooter: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 4,
  },
  sellerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    flex: 1,
  },
  sellerText: {
    fontSize: 11,
    color: COLORS.gray,
  },
  soldBadge: {
    backgroundColor: COLORS.red + '15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  soldBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.red,
  },

  // Image on the right
  cardImageContainer: {
    width: 110,
    height: 110,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    flexShrink: 0,
  },
  cardImage: {
    width: 110,
    height: 110,
    resizeMode: 'cover',
  },
  cardImagePlaceholder: {
    width: 110,
    height: 110,
    backgroundColor: COLORS.grayLight + '30',
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.lg,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row-reverse' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: SPACING.sm,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
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
    writingDirection: 'rtl' as const,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: COLORS.primaryDark,
    textAlign: 'right' as const,
  },
  phoneHint: {
    fontSize: 11,
    color: COLORS.gray,
    textAlign: 'right',
    marginTop: 3,
    marginRight: 4,
    fontStyle: 'italic',
  },
  categoryRow: {
    flexDirection: 'row-reverse',
    gap: SPACING.sm,
  },
  catChip: {
    flex: 1,
    alignItems: 'center' as const,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.grayLight,
    backgroundColor: COLORS.cardBg,
  },
  catChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  catChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primaryDark,
  },
  catChipTextActive: {
    color: COLORS.white,
  },
  imagesRow: {
    gap: SPACING.sm,
  },
  imageThumbContainer: {
    position: 'relative' as const,
  },
  imageThumb: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.md,
  },
  removeImageBtn: {
    position: 'absolute' as const,
    top: -6,
    left: -6,
    backgroundColor: COLORS.white,
    borderRadius: 12,
  },
  addImageBtn: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.grayLight,
    borderStyle: 'dashed' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
  },
  addImageText: {
    fontSize: 11,
    color: COLORS.gray,
  },
  createBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: RADIUS.xl,
    alignItems: 'center' as const,
    marginTop: SPACING.sm,
    ...SHADOWS.button,
  },
  createBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700' as const,
  },
});
