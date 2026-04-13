import { Stack } from 'expo-router';

export default function DiscussionsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#F5F0E8' },
      }}
    />
  );
}
