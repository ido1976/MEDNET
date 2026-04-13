import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { formatRelative } from '../lib/helpers';
import type { BridgeTip } from '../types/database';

interface TipCardProps {
  tip: BridgeTip;
  currentUserId: string;
  onLike: (tipId: string) => void;
}

export default function TipCard({ tip, currentUserId, onLike }: TipCardProps) {
  const isLiked = tip.liked_by_me;

  return (
    <View style={styles.card}>
      <Text style={styles.content}>{tip.content}</Text>
      <View style={styles.footer}>
        <TouchableOpacity style={styles.likeBtn} onPress={() => onLike(tip.id)}>
          <Text style={[styles.likeCount, isLiked && styles.likedText]}>{tip.likes_count}</Text>
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={18}
            color={isLiked ? COLORS.red : COLORS.gray}
          />
        </TouchableOpacity>
        <View style={styles.meta}>
          <Text style={styles.date}>{formatRelative(tip.created_at)}</Text>
          <Text style={styles.author}>{tip.user?.full_name || 'אנונימי'}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.card,
  },
  content: {
    fontSize: 15,
    color: COLORS.primaryDark,
    textAlign: 'right',
    lineHeight: 22,
    marginBottom: SPACING.sm,
  },
  footer: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meta: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  author: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  date: {
    fontSize: 12,
    color: COLORS.gray,
  },
  likeBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.xl,
  },
  likeCount: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray,
  },
  likedText: {
    color: COLORS.red,
  },
});
