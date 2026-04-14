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
  Image,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import ScreenWrapper from '../../../src/components/ScreenWrapper';
import HamburgerMenu from '../../../src/components/HamburgerMenu';
import EmptyState from '../../../src/components/EmptyState';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../../src/constants/theme';
import { useSecondhandStore } from '../../../src/stores/secondhandStore';
import { useAuthStore } from '../../../src/stores/authStore';
import type { SecondhandListing } from '../../../src/types/database';

const CATEGORIES = [
  { id: 'all', label: 'הכל' },
  { id: 'product', label: 'מוצרים' },
  { id: 'service', label: 'שירותים' },
  { id: 'other', label: 'אחר' },
];

export default function SecondhandScreen() {
  const router = useRouter();
  const { user, session } = useAuthStore();
  const { listings, loading, fetchListings, createListing } = useSecondhandStore();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newContact, setNewContact] = useState('');
  const [newCategory, setNewCategory] = useState<'product' | 'service' | 'other'>('product');
  const [newImages, setNewImages] = useState<string[]>([]);

  useEffect(() => {
    fetchListings(selectedCategory === 'all' ? undefined : selectedCategory);
  }, [selectedCategory]);

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

  const removeImage = (index: number) => {
    setNewImages((prev) => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setNewTitle('');
    setNewDesc('');
    setNewPrice('');
    setNewContact('');
    setNewCategory('product');
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

    const result = await createListing({
      title: newTitle.trim(),
      description: newDesc.trim(),
      category: newCategory,
      price: newPrice ? parseFloat(newPrice) : null,
      images: newImages,
      contact_info: newContact.trim(),
      created_by: session.user.id,
    });

    if (result.error) {
      Alert.alert('שגיאה', result.error);
      return;
    }

    setShowCreate(false);
    resetForm();
    fetchListings(selectedCategory === 'all' ? undefined : selectedCategory);
  };

  const filteredListings = listings.filter((l) => {
    if (!search) return true;
    return l.title.includes(search) || l.description?.includes(search);
  });

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'product': return 'מוצר';
      case 'service': return 'שירות';
      default: return 'אחר';
    }
  };

  const renderListing = ({ item }: { item: SecondhandListing }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => router.push(`/(tabs)/secondhand/${item.id}`)}
    >
      {item.images?.[0] && (
        <Image source={{ uri: item.images[0] }} style={styles.cardImage} />
      )}
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{getCategoryLabel(item.category)}</Text>
          </View>
        </View>
        {item.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}
        <View style={styles.cardFooter}>
          {item.price != null && (
            <Text style={styles.priceText}>₪{item.price}</Text>
          )}
          {(item as any).creator?.full_name && (
            <View style={styles.publisherRow}>
              <Ionicons name="person-circle-outline" size={14} color={COLORS.gray} />
              <Text style={styles.publisherText}>{(item as any).creator.full_name}</Text>
            </View>
          )}
          {item.status === 'sold' && (
            <View style={styles.soldBadge}>
              <Text style={styles.soldBadgeText}>נמכר</Text>
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
              <TextInput
                style={styles.modalInput}
                placeholder="מחיר (₪)"
                value={newPrice}
                onChangeText={setNewPrice}
                textAlign="right"
                keyboardType="numeric"
                placeholderTextColor={COLORS.grayLight}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="פרטי קשר (טלפון/אימייל)"
                value={newContact}
                onChangeText={setNewContact}
                textAlign="right"
                placeholderTextColor={COLORS.grayLight}
              />

              {/* Category */}
              <Text style={styles.modalLabel}>קטגוריה:</Text>
              <View style={styles.categoryRow}>
                {(['product', 'service', 'other'] as const).map((cat) => (
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

              {/* Images */}
              <Text style={styles.modalLabel}>תמונות:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imagesRow}>
                {newImages.map((uri, idx) => (
                  <View key={idx} style={styles.imageThumbContainer}>
                    <Image source={{ uri }} style={styles.imageThumb} />
                    <TouchableOpacity style={styles.removeImageBtn} onPress={() => removeImage(idx)}>
                      <Ionicons name="close-circle" size={22} color={COLORS.red} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addImageBtn} onPress={pickImage}>
                  <Ionicons name="camera-outline" size={28} color={COLORS.gray} />
                  <Text style={styles.addImageText}>הוסף</Text>
                </TouchableOpacity>
              </ScrollView>

              <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
                <Text style={styles.createBtnText}>פרסם</Text>
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
          <EmptyState icon="bag-handle-outline" title="אין פרסומים" subtitle="פרסם משהו חדש!" />
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
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  cardImage: {
    width: '100%',
    height: 160,
  },
  cardBody: {
    padding: SPACING.md,
  },
  cardTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primaryDark,
    flex: 1,
    textAlign: 'right',
  },
  categoryBadge: {
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
  },
  cardDesc: {
    fontSize: 13,
    color: COLORS.gray,
    textAlign: 'right',
    marginTop: 4,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
  },
  priceText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.accent,
  },
  publisherRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  publisherText: {
    fontSize: 12,
    color: COLORS.gray,
  },
  soldBadge: {
    backgroundColor: COLORS.red + '20',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  soldBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.red,
  },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.lg, paddingBottom: 40, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row-reverse' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: SPACING.sm },
  modalTitle: { fontSize: 20, fontWeight: '700' as const, color: COLORS.primaryDark },
  modalInput: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.grayLight, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: 15, color: COLORS.black, writingDirection: 'rtl' as const },
  modalLabel: { fontSize: 14, fontWeight: '600' as const, color: COLORS.primaryDark, textAlign: 'right' as const },
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
  createBtn: { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: RADIUS.xl, alignItems: 'center' as const, marginTop: SPACING.sm, ...SHADOWS.button },
  createBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' as const },
});
