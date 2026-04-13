import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import FloatingMedit from './FloatingMedit';

interface ScreenWrapperProps {
  children: React.ReactNode;
  showMedit?: boolean;
  style?: ViewStyle;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}

export default function ScreenWrapper({
  children,
  showMedit = true,
  style,
  edges = ['top'],
}: ScreenWrapperProps) {
  return (
    <SafeAreaView style={[styles.container, style]} edges={edges}>
      <View style={styles.content}>{children}</View>
      {showMedit && <FloatingMedit />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  content: {
    flex: 1,
  },
});
