import React, { useEffect, useRef, useState } from 'react';
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
import ScreenWrapper from '../../../src/components/ScreenWrapper';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../../src/constants/theme';
import { trackView, trackReact } from '../../../src/lib/activityTracker';
import { useSecondhandStore } from '../../../src/stores/secondhandStore';
import { useAuthStore } from '../../../src/stores/authStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SecondhandDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { currentListing, fetchListing, updateListing, deleteListing } = useSecondhandStore();
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const hasTrackedImageScroll = useRef(false);

  // Edit modal
  const [showEdit, setShowEdit] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCategory, setEditCategory] = useState<'product' | 'service' | 'other' | 'giveaway'>('product');
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    await fetchListing(id);
    setLoading(false);
  };

  // Track view after listing loads — only for non-owners
  useEffect(() => {
    if (currentListing && user?.id !== currentListing.created_by && id) {
      trackView('secondhand', id);
    }
  }, [currentListing?.id]);

  const isOwner = user?.id === currentListing?.created_by;

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'product': return 'מוצר';
      case 'service': return 'שירות';
      case 'giveaway': return 'למסירה 🎁';
      default: return 'אחר';
    }
  };

  const openEdit = () => {
    if (!currentListing) return;
    setEditTitle(currentListing.title || '');
    setEditDesc(currentListing.description || '');
    setEditPrice(currentListing.price?.toString() || '');
    setEditPhone(currentListing.contact_phone || '');
    setEditCategory((currentListing.category as any) || 'product');
    setShowEdit(true);
  };

  const handleSaveEdit = async () => {
    if (!id || !editTitle.trim()) {
      Alert.alert('שגיאה', 'נא להזין כותרת');
      return;
    }
    setIsEditSubmitting(true);
    const result = await updateListing(id, {
      title: editTitle.trim(),
      description: editDesc.trim(),
      category: editCategory,
      price: editCategory === 'giveaway' ? null : (editPrice ? parseFloat(editPrice) : null),
      contact_phone: editPhone.trim() || undefined,
      contact_info: editPhone.trim() || '',
    });
    setIsEditSubmitting(false);
    if (result.error) Alert.alert('שגיאה', result.error);
    else setShowEdit(false);
  };

  // Resolve phone: contact_phone → creator profile phone → contact_info (if it looks like a number)
  const phone = currentListing?.contact_phone ||
    (currentListing as any)?.creator?.phone ||
    (currentListing?.contact_info?.match(/^[0-9+\s\-()]{6,20}$/)
      ? currentListing.contact_info
      : null);

  const handleCall = () => {
    if (!phone) return;
    if (!isOwner && id) trackReact('secondhand', id, { action: 'phone_click' });
    Linking.openURL(`tel:${phone.replace(/[^0-9+]/g, '')}`);
  };

  const handleWhatsApp = () => {
    if (!phone) return;
    if (!isOwner && id) trackReact('secondhand', id, { action: 'whatsapp_click' });
    const clean = phone.replace(/[^0-9]/g, '');
    Linking.openURL(
      `whatsapp://send?phone=${clean}&text=${encodeURIComponent('שלום, ראיתי את המודעה שלך ב-MEDNET')}`
    );
  };

  const handleMarkSold = () => {
    Alert.alert(
      '🎉 הפריט נמכר!',
      'המודעה תימחק מהלוח. פעולה זו לא ניתנת לביטול.',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'כן, נמכר!',
          style: 'destructive',
          onPress: async () => {
            if (!id) return;
            const result = await deleteListing(id);
            if (result.error) Alert.alert('שגיאה', result.error);
            else router.back();
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    Alert.alert('מחיקת פרסום', 'בטוח שברצונך למחוק את הפרסום?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק',
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          const result = await deleteListing(id);
          if (result.error) {
            Alert.alert('שגיאה', result.error);
          } else {
            router.back();
          }
        },
      },
    ]);
  };

  if (loading || !currentListing) {
    return (
      <ScreenWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  const images = currentListing.images || [];

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-forward" size={24} color={COLORS.primaryDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{currentListing.title}</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Image Carousel */}
        {images.length > 0 && (
          <View style={styles.carouselContainer}>
            <FlatList
              data={images}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, i) => i.toString()}
              renderItem={({ item }) => (
                <Image source={{ uri: item }} style={styles.carouselImage} />
              )}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(
                  e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - SPACING.lg * 2)
                );
                setActiveImageIndex(idx);
                // Track image scroll once per visit for non-owners
                if (!isOwner && !hasTrackedImageScroll.current && id) {
                  hasTrackedImageScroll.current = true;
                  trackReact('secondhand', id, { action: 'image_scroll' });
                }
              }}
            />
            {images.length > 1 && (
              <View style={styles.dotsRow}>
                {images.map((_, i) => (
                  <View key={i} style={[styles.dot, i === activeImageIndex && styles.dotActive]} />
                ))}
                <Text style={styles.imageCounter}>{activeImageIndex + 1}/{images.length}</Text>
              </View>
            )}
          </View>
        )}

        {/* Info Card */}
        <View style={styles.infoCard}>
          {/* Title + category */}
          <View style={styles.titleRow}>
            <Text style={styles.title}>{currentListing.title}</Text>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{getCategoryLabel(currentListing.category)}</Text>
            </View>
          </View>

          {/* Price */}
          {currentListing.category === 'giveaway' ? (
            <View style={styles.giveawayBadge}>
              <Ionicons name="gift-outline" size={18} color={COLORS.accent} />
              <Text style={styles.giveawayText}>למסירה — ללא תשלום 🎁</Text>
            </View>
          ) : currentListing.price != null ? (
            <Text style={styles.price}>₪{currentListing.price.toLocaleString()}</Text>
          ) : (
            <Text style={styles.noPrice}>ללא מחיר</Text>
          )}

          {/* Description */}
          {currentListing.description ? (
            <Text style={styles.description}>{currentListing.description}</Text>
          ) : null}
        </View>

        {/* Publisher Card */}
        <View style={styles.publisherCard}>
          <Text style={styles.sectionTitle}>פרטי מפרסם</Text>
          <View style={styles.publisherRow}>
            <Ionicons name="person-circle" size={42} color={COLORS.primary} />
            <View style={styles.publisherInfo}>
              <Text style={styles.publisherName}>
                {(currentListing as any).creator?.full_name || 'משתמש'}
              </Text>
              {phone ? (
                <Text style={styles.publisherPhone}>{phone}</Text>
              ) : null}
            </View>
          </View>

          {/* Contact buttons */}
          {phone && !isOwner ? (
            <View style={styles.contactBtns}>
              <TouchableOpacity style={styles.callBtn} onPress={handleCall}>
                <Ionicons name="call" size={18} color={COLORS.white} />
                <Text style={styles.callBtnText}>התקשר</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.whatsappBtn} onPress={handleWhatsApp}>
                <Ionicons name="logo-whatsapp" size={18} color={COLORS.white} />
                <Text style={styles.whatsappBtnText}>וואטסאפ</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Show phone for owner (read-only) */}
          {phone && isOwner ? (
            <View style={styles.ownerPhoneRow}>
              <Ionicons name="call-outline" size={16} color={COLORS.gray} />
              <Text style={styles.ownerPhoneText}>{phone}</Text>
            </View>
          ) : null}
        </View>

        {/* Owner Actions */}
        {isOwner && (
          <View style={styles.ownerActions}>
            <TouchableOpacity style={styles.editBtn} onPress={openEdit}>
              <Ionicons name="pencil-outline" size={18} color={COLORS.primary} />
              <Text style={styles.editBtnText}>ערוך מודעה</Text>
            </TouchableOpacity>
            {currentListing.status === 'active' && (
              <TouchableOpacity style={styles.markSoldBtn} onPress={handleMarkSold}>
                <Ionicons name="checkmark-done" size={18} color={COLORS.white} />
                <Text style={styles.markSoldText}>🎉 נמכר! מחק מודעה</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={18} color={COLORS.red} />
              <Text style={styles.deleteBtnText}>מחק פרסום</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Edit Modal */}
        <Modal visible={showEdit} animationType="slide" transparent>
          <View style={styles.editModalOverlay}>
            <View style={styles.editModalContent}>
              <View style={styles.editModalHeader}>
                <TouchableOpacity onPress={() => setShowEdit(false)}>
                  <Ionicons name="close" size={24} color={COLORS.gray} />
                </TouchableOpacity>
                <Text style={styles.editModalTitle}>עריכת מודעה</Text>
                <View style={{ width: 24 }} />
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {/* Category */}
                <Text style={styles.editLabel}>קטגוריה:</Text>
                <View style={styles.editCatRow}>
                  {(['product', 'service', 'giveaway', 'other'] as const).map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.editCatChip, editCategory === cat && styles.editCatChipActive]}
                      onPress={() => setEditCategory(cat)}
                    >
                      <Text style={[styles.editCatChipText, editCategory === cat && styles.editCatChipTextActive]}>
                        {getCategoryLabel(cat)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput
                  style={styles.editInput}
                  placeholder="כותרת *"
                  value={editTitle}
                  onChangeText={setEditTitle}
                  textAlign="right"
                  placeholderTextColor={COLORS.grayLight}
                />
                <TextInput
                  style={[styles.editInput, { height: 80 }]}
                  placeholder="תיאור"
                  value={editDesc}
                  onChangeText={setEditDesc}
                  textAlign="right"
                  multiline
                  placeholderTextColor={COLORS.grayLight}
                />

                {editCategory === 'giveaway' ? (
                  <View style={styles.freeLabelRow}>
                    <Ionicons name="gift-outline" size={16} color={COLORS.accent} />
                    <Text style={styles.freeLabelText}>ללא תשלום — למסירה</Text>
                  </View>
                ) : (
                  <TextInput
                    style={styles.editInput}
                    placeholder="מחיר ₪"
                    value={editPrice}
                    onChangeText={setEditPrice}
                    textAlign="right"
                    keyboardType="numeric"
                    placeholderTextColor={COLORS.grayLight}
                  />
                )}

                <TextInput
                  style={styles.editInput}
                  placeholder="טלפון ליצירת קשר"
                  value={editPhone}
                  onChangeText={setEditPhone}
                  textAlign="right"
                  keyboardType="phone-pad"
                  placeholderTextColor={COLORS.grayLight}
                />

                <TouchableOpacity
                  style={[styles.saveEditBtn, isEditSubmitting && { opacity: 0.7 }]}
                  onPress={handleSaveEdit}
                  disabled={isEditSubmitting}
                >
                  {isEditSubmitting
                    ? <ActivityIndicator color={COLORS.white} />
                    : <Text style={styles.saveEditBtnText}>שמור שינויים</Text>
                  }
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primaryDark,
    flex: 1,
    textAlign: 'center',
  },
  carouselContainer: {
    marginBottom: SPACING.md,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  carouselImage: {
    width: SCREEN_WIDTH - SPACING.lg * 2,
    height: 240,
    resizeMode: 'cover',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.cardBg,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.grayLight,
  },
  dotActive: {
    backgroundColor: COLORS.primary,
    width: 14,
  },
  imageCounter: {
    fontSize: 11,
    color: COLORS.gray,
    marginRight: 4,
  },
  infoCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.sm,
    ...SHADOWS.card,
  },
  titleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primaryDark,
    textAlign: 'right',
    flex: 1,
  },
  categoryBadge: {
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: RADIUS.xl,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  price: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.accent,
    textAlign: 'right',
  },
  noPrice: {
    fontSize: 14,
    color: COLORS.grayLight,
    textAlign: 'right',
    fontStyle: 'italic',
  },
  description: {
    fontSize: 15,
    color: COLORS.gray,
    textAlign: 'right',
    lineHeight: 22,
    marginTop: 4,
  },

  // Publisher
  publisherCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginTop: SPACING.md,
    gap: SPACING.md,
    ...SHADOWS.card,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.primaryDark,
    textAlign: 'right',
  },
  publisherRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: SPACING.md,
  },
  publisherInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  publisherName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primaryDark,
  },
  publisherPhone: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 2,
  },
  contactBtns: {
    flexDirection: 'row-reverse',
    gap: SPACING.sm,
  },
  callBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 13,
    borderRadius: RADIUS.xl,
    ...SHADOWS.button,
  },
  callBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  whatsappBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#25D366',
    paddingVertical: 13,
    borderRadius: RADIUS.xl,
    ...SHADOWS.button,
  },
  whatsappBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  ownerPhoneRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  ownerPhoneText: {
    fontSize: 14,
    color: COLORS.gray,
  },

  // Giveaway
  giveawayBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.accent + '15',
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  giveawayText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.accent,
  },

  // Owner actions
  ownerActions: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  markSoldBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: RADIUS.xl,
    ...SHADOWS.button,
  },
  markSoldText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  deleteBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: COLORS.red,
  },
  deleteBtnText: {
    color: COLORS.red,
    fontSize: 15,
    fontWeight: '700',
  },

  // Edit button
  editBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  editBtnText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '700',
  },

  // Edit Modal
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  editModalContent: {
    backgroundColor: COLORS.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.lg,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  editModalHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  editModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primaryDark,
    textAlign: 'right',
  },
  editCatRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  editCatChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.grayLight,
    backgroundColor: COLORS.cardBg,
  },
  editCatChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  editCatChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primaryDark,
  },
  editCatChipTextActive: {
    color: COLORS.white,
  },
  editInput: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.grayLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 15,
    color: COLORS.black,
    writingDirection: 'rtl',
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
  saveEditBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    marginTop: SPACING.sm,
    ...SHADOWS.button,
  },
  saveEditBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
