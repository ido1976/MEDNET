import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../../src/components/ScreenWrapper';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../../src/constants/theme';
import { trackView } from '../../../src/lib/activityTracker';
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

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    trackView('secondhand', id);
    await fetchListing(id);
    setLoading(false);
  };

  const isOwner = user?.id === currentListing?.created_by;

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'product': return 'מוצר';
      case 'service': return 'שירות';
      default: return 'אחר';
    }
  };

  const handleMarkSold = async () => {
    if (!id) return;
    const result = await updateListing(id, { status: 'sold' });
    if (result.error) Alert.alert('שגיאה', result.error);
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

  const handleContact = () => {
    if (!currentListing?.contact_info) return;
    const info = currentListing.contact_info;
    if (info.includes('@')) {
      Linking.openURL(`mailto:${info}`);
    } else {
      Linking.openURL(`tel:${info}`);
    }
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
                setActiveImageIndex(Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - SPACING.lg * 2)));
              }}
            />
            {images.length > 1 && (
              <View style={styles.dotsRow}>
                {images.map((_, i) => (
                  <View key={i} style={[styles.dot, i === activeImageIndex && styles.dotActive]} />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{currentListing.title}</Text>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{getCategoryLabel(currentListing.category)}</Text>
            </View>
          </View>

          {currentListing.price != null && (
            <Text style={styles.price}>₪{currentListing.price}</Text>
          )}

          {currentListing.description ? (
            <Text style={styles.description}>{currentListing.description}</Text>
          ) : null}

          {currentListing.status === 'sold' && (
            <View style={styles.soldBanner}>
              <Text style={styles.soldBannerText}>הפריט נמכר</Text>
            </View>
          )}
        </View>

        {/* Publisher Info */}
        <View style={styles.publisherCard}>
          <Text style={styles.sectionTitle}>פרטי מפרסם</Text>
          <View style={styles.publisherRow}>
            <Ionicons name="person-circle" size={40} color={COLORS.primary} />
            <View style={styles.publisherInfo}>
              <Text style={styles.publisherName}>
                {(currentListing as any).creator?.full_name || 'משתמש'}
              </Text>
              {(currentListing as any).creator?.email && (
                <Text style={styles.publisherEmail}>
                  {(currentListing as any).creator.email}
                </Text>
              )}
            </View>
          </View>

          {currentListing.contact_info ? (
            <TouchableOpacity style={styles.contactBtn} onPress={handleContact}>
              <Ionicons name="call" size={18} color={COLORS.white} />
              <Text style={styles.contactBtnText}>צור קשר: {currentListing.contact_info}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Owner actions */}
        {isOwner && (
          <View style={styles.ownerActions}>
            {currentListing.status === 'active' && (
              <TouchableOpacity style={styles.markSoldBtn} onPress={handleMarkSold}>
                <Ionicons name="checkmark-done" size={18} color={COLORS.white} />
                <Text style={styles.markSoldText}>סמן כנמכר</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={18} color={COLORS.red} />
              <Text style={styles.deleteBtnText}>מחק פרסום</Text>
            </TouchableOpacity>
          </View>
        )}
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
    gap: 6,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.cardBg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.grayLight,
  },
  dotActive: {
    backgroundColor: COLORS.primary,
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
    alignItems: 'center',
    justifyContent: 'space-between',
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
  description: {
    fontSize: 15,
    color: COLORS.gray,
    textAlign: 'right',
    lineHeight: 22,
  },
  soldBanner: {
    backgroundColor: COLORS.red + '15',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  soldBannerText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.red,
  },
  publisherCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginTop: SPACING.md,
    gap: SPACING.sm,
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
  publisherEmail: {
    fontSize: 13,
    color: COLORS.gray,
  },
  contactBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: RADIUS.xl,
    marginTop: SPACING.sm,
    ...SHADOWS.button,
  },
  contactBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
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
});
