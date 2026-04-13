import React from 'react';
import { Tabs } from 'expo-router';
import { COLORS } from '../../src/constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="bridges" />
      <Tabs.Screen name="discussions" />
      <Tabs.Screen name="events" />
      <Tabs.Screen name="apartments" />
      <Tabs.Screen name="rides" />
      <Tabs.Screen name="prices" />
      <Tabs.Screen name="messenger" />
      <Tabs.Screen name="community" />
    </Tabs>
  );
}
