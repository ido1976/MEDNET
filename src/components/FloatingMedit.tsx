import React from 'react';
import { TouchableOpacity, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';

export default function FloatingMedit() {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => router.push('/(tabs)/chat')}
      activeOpacity={0.85}
    >
      <View style={styles.inner}>
        <Ionicons name="chatbubble-ellipses" size={22} color={COLORS.white} />
        <Text style={styles.label}>MEDIT</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90,
    left: 20,
    zIndex: 1000,
    ...SHADOWS.button,
  },
  inner: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 30,
    gap: 8,
  },
  label: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 1,
  },
});
