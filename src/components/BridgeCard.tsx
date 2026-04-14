import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS, RADIUS, SPACING } from '../constants/theme';
import StarRating from './StarRating';
import { formatDate } from '../lib/helpers';
import type { Bridge } from '../types/database';

interface BridgeCardProps {
  bridge: Bridge;
  variant?: 'large' | 'compact';
  currentUserId?: string;
}

const BRIDGE_ICONS: Record<string, string> = {
  'לימודים': 'book',
  'קליניקה': 'medkit',
  'מחקר': 'flask',
  'חברתי': 'people',
  'ספורט': 'fitness',
  'התנדבות': 'heart',
  'קריירה': 'briefcase',
  'כללי': 'grid',
};

export default function BridgeCard({ bridge, variant = 'large', currentUserId }: BridgeCardProps) {
  const router = useRouter();

  const handlePress = () => {
    router.push(`/(tabs)/bridges/${bridge.id}`);
  };

  const firstImage = bridge.images?.[0]?.image_uri;

  if (variant === 'compact') {
    return (
      <TouchableOpacity style={styles.compactCard} onPress={handlePress} activeOpacity={0.8}>
        <View style={styles.compactIconContainer}>
          <Ionicons
            name={(BRIDGE_ICONS[bridge.name] || 'grid') as any}
            size={20}
            color={COLORS.primary}
          />
        </View>
        <Text style={styles.compactName} numberOfLines={1}>
          {bridge.name}
        </Text>
        <StarRating rating={bridge.rating_avg} size={12} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.largeCard} onPress={handlePress} activeOpacity={0.8}>
      {/* Header image */}
      {firstImage && (
        <Image source={{ uri: firstImage }} style={styles.headerImage} />
      )}

      <View style={styles.largeContent}>
        <View style={styles.largeHeader}>
          <View style={styles.largeIconContainer}>
            <Ionicons
              name={(BRIDGE_ICONS[bridge.name] || 'grid') as any}
              size={28}
              color={COLORS.primary}
            />
          </View>
          <View style={styles.largeInfo}>
            <Text style={styles.largeName}>{bridge.name}</Text>
            <Text style={styles.largeDescription} numberOfLines={2}>
              {bridge.description}
            </Text>
          </View>
        </View>

        {/* Tags */}
        {bridge.tags && bridge.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {bridge.tags.slice(0, 4).map((tag) => (
              <View key={tag.id} style={styles.tagChip}>
                <Text style={styles.tagText}>{tag.name}</Text>
              </View>
            ))}
            {bridge.tags.length > 4 && (
              <View style={styles.tagChip}>
                <Text style={styles.tagText}>+{bridge.tags.length - 4}</Text>
              </View>
            )}
          </View>
        )}

        {/* Creator and date info */}
        <View style={styles.metaRow}>
          {currentUserId && bridge.created_by === currentUserId ? (
            <View style={styles.myBadge}>
              <Ionicons name="person" size={12} color={COLORS.white} />
              <Text style={styles.myBadgeText}>שלי</Text>
            </View>
          ) : bridge.creator?.full_name ? (
            <View style={styles.metaItem}>
              <Text style={styles.metaText}>{bridge.creator.full_name}</Text>
              <Ionicons name="person-outline" size={13} color={COLORS.gray} />
            </View>
          ) : null}
          <View style={styles.metaItem}>
            <Text style={styles.metaText}>{formatDate(bridge.created_at)}</Text>
            <Ionicons name="calendar-outline" size={13} color={COLORS.gray} />
          </View>
        </View>

        <View style={styles.largeFooter}>
          <StarRating rating={bridge.rating_avg} size={16} />
          <View style={styles.arrowContainer}>
            <Ionicons name="chevron-back" size={18} color={COLORS.gray} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  largeCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  headerImage: {
    width: '100%',
    height: 140,
    resizeMode: 'cover',
  },
  largeContent: {
    padding: SPACING.lg,
  },
  largeHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  largeIconContainer: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.md,
  },
  largeInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  largeName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primaryDark,
    marginBottom: 4,
    textAlign: 'right',
  },
  largeDescription: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'right',
    lineHeight: 20,
  },
  tagsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SPACING.md,
  },
  tagChip: {
    backgroundColor: COLORS.primary + '18',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  tagText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  metaRow: {
    flexDirection: 'row-reverse',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.gray,
  },
  myBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADIUS.xl,
  },
  myBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
  largeFooter: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  arrowContainer: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    width: 120,
    marginLeft: SPACING.sm,
    ...SHADOWS.card,
  },
  compactIconContainer: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  compactName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primaryDark,
    marginBottom: 4,
    textAlign: 'center',
  },
});
