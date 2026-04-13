import React, { useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS } from '../constants/theme';
import { useNotificationStore } from '../stores/notificationStore';
import { useAuthStore } from '../stores/authStore';

interface NotificationBellProps {
  onPress?: () => void;
}

export default function NotificationBell({ onPress }: NotificationBellProps) {
  const { user } = useAuthStore();
  const { unreadCount, fetchNotifications, subscribeToNotifications } = useNotificationStore();

  useEffect(() => {
    if (!user) return;
    fetchNotifications(user.id);
    const unsubscribe = subscribeToNotifications(user.id);
    return unsubscribe;
  }, [user?.id]);

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <Ionicons name="notifications-outline" size={24} color={COLORS.primaryDark} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: COLORS.red,
    borderRadius: RADIUS.full,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.white,
  },
});
