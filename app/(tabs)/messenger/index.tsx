import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../../src/components/ScreenWrapper';
import HamburgerMenu from '../../../src/components/HamburgerMenu';
import EmptyState from '../../../src/components/EmptyState';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../../src/constants/theme';
import { useMessengerStore } from '../../../src/stores/messengerStore';
import { useAuthStore } from '../../../src/stores/authStore';
import { getInitials, formatRelative, truncate } from '../../../src/lib/helpers';

export default function MessengerScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { conversations, fetchConversations, loading } = useMessengerStore();

  useEffect(() => {
    if (user) fetchConversations(user.id);
  }, [user]);

  const renderConversation = ({ item }: { item: (typeof conversations)[0] }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(tabs)/messenger/${item.user.id}`)}
      activeOpacity={0.85}
    >
      {item.user.avatar_url ? (
        <Image source={{ uri: item.user.avatar_url }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>{getInitials(item.user.full_name)}</Text>
        </View>
      )}
      <View style={styles.cardInfo}>
        <View style={styles.cardTop}>
          <Text style={styles.userName}>{item.user.full_name}</Text>
          <Text style={styles.timeText}>{formatRelative(item.lastMessage.created_at)}</Text>
        </View>
        <View style={styles.cardBottom}>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {truncate(item.lastMessage.content, 50)}
          </Text>
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <HamburgerMenu />
        <Text style={styles.headerTitle}>הודעות</Text>
        <View style={{ width: 28 }} />
      </View>

      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.user.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState icon="mail-outline" title="אין הודעות" subtitle="שלח הודעה לחבר!" />
        }
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  list: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: SPACING.md,
    ...SHADOWS.card,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 16,
  },
  cardInfo: {
    flex: 1,
  },
  cardTop: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primaryDark,
  },
  timeText: {
    fontSize: 12,
    color: COLORS.grayLight,
  },
  cardBottom: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    color: COLORS.gray,
    flex: 1,
    textAlign: 'right',
  },
  unreadBadge: {
    backgroundColor: COLORS.primary,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginRight: SPACING.sm,
  },
  unreadText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
});
