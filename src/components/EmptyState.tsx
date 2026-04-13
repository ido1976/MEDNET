import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../constants/theme';

interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle?: string;
}

export default function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon as any} size={64} color={COLORS.grayLight} />
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xxl,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.gray,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.grayLight,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
});
