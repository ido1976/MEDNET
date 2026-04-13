import { Stack } from 'expo-router';

export default function BridgesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#F5F0E8' },
      }}
    />
  );
}
