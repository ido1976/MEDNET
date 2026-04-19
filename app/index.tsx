import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';
import { COLORS } from '../src/constants/theme';

export default function Index() {
  const router = useRouter();
  const { session, user, loading } = useAuthStore();

  useEffect(() => {
    if (loading) return;

    if (!session) {
      router.replace('/(auth)/welcome');
    } else if (!user?.onboarding_completed_at) {
      router.replace('/(auth)/onboarding');
    } else {
      router.replace('/(tabs)/');
    }
  }, [loading, session, user]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
