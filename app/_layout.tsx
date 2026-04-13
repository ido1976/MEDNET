import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nManager, StyleSheet } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';
import { useSharedListsStore } from '../src/stores/sharedListsStore';

// Force RTL
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

export default function RootLayout() {
  const { initialize } = useAuthStore();
  const initLists = useSharedListsStore((s) => s.initialize);

  useEffect(() => {
    initialize();
    initLists();
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#F5F0E8' },
            animation: 'slide_from_left',
          }}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
