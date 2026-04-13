import React from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { formatRelative } from '../lib/helpers';
import type { BridgeAddition } from '../types/database';

interface AdditionCardProps {
  addition: BridgeAddition;
  isCreator: boolean;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

export default function AdditionCard({ addition, isCreator, onApprove, onReject }: AdditionCardProps) {
  const isPending = addition.status === 'pending';

  return (
    <View style={[styles.card, isPending && styles.cardPending]}>
      {isPending && (
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingText}>ממתין לאישור</Text>
        </View>
      )}

      <Text style={styles.content}>{addition.content}</Text>

      {addition.link ? (
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => Linking.openURL(addition.link)}
        >
          <Ionicons name="link" size={16} color={COLORS.primary} />
          <Text style={styles.linkText} numberOfLines={1}>{addition.link}</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.footer}>
        {isPending && isCreator && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.approveBtn]}
              onPress={() => onApprove?.(addition.id)}
            >
              <Ionicons name="checkmark" size={18} color={COLORS.white} />
              <Text style={styles.actionBtnText}>אשר</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => onReject?.(addition.id)}
            >
              <Ionicons name="close" size={18} color={COLORS.white} />
              <Text style={styles.actionBtnText}>דחה</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.meta}>
          <Text style={styles.date}>{formatRelative(addition.created_at)}</Text>
          <Text style={styles.author}>{addition.suggestor?.full_name || 'אנונימי'}</Text>
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
  cardPending: {
    borderWidth: 1.5,
    borderColor: COLORS.yellow,
  },
  pendingBadge: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.yellow + '25',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.sm,
  },
  pendingText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.yellow,
  },
  content: {
    fontSize: 15,
    color: COLORS.primaryDark,
    textAlign: 'right',
    lineHeight: 22,
    marginBottom: SPACING.sm,
  },
  linkRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.primary + '10',
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  linkText: {
    fontSize: 13,
    color: COLORS.primary,
    flex: 1,
    textAlign: 'right',
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
  actions: {
    flexDirection: 'row-reverse',
    gap: SPACING.sm,
  },
  actionBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.xl,
  },
  approveBtn: {
    backgroundColor: COLORS.green,
  },
  rejectBtn: {
    backgroundColor: COLORS.red,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
});
