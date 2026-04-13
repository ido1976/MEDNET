import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: number;
  editable?: boolean;
  onRate?: (rating: number) => void;
}

export default function StarRating({
  rating,
  maxStars = 5,
  size = 20,
  editable = false,
  onRate,
}: StarRatingProps) {
  const stars = [];

  for (let i = 1; i <= maxStars; i++) {
    const iconName = i <= rating ? 'star' : i - 0.5 <= rating ? 'star-half' : 'star-outline';

    const star = (
      <TouchableOpacity
        key={i}
        disabled={!editable}
        onPress={() => onRate?.(i)}
        style={styles.star}
      >
        <Ionicons name={iconName} size={size} color={COLORS.accent} />
      </TouchableOpacity>
    );

    stars.push(star);
  }

  return <View style={styles.container}>{stars}</View>;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  star: {
    marginHorizontal: 1,
  },
});
