import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../src/components/ScreenWrapper';
import HamburgerMenu from '../../src/components/HamburgerMenu';
import BridgeCard from '../../src/components/BridgeCard';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../src/constants/theme';
import { useAuthStore } from '../../src/stores/authStore';
import { useBridgeStore } from '../../src/stores/bridgeStore';

const QUICK_ACTIONS = [
  { icon: 'chatbubble-ellipses', label: 'MEDIT', route: '/(tabs)/chat', color: '#2d5a3d' },
  { icon: 'chatbubbles', label: 'דיונים', route: '/(tabs)/discussions/', color: '#4A90D9' },
  { icon: 'calendar', label: 'אירועים', route: '/(tabs)/events/', color: '#F4C542' },
  { icon: 'home-outline', label: 'דירות', route: '/(tabs)/apartments/', color: '#E8734A' },
  { icon: 'car', label: 'טרמפים', route: '/(tabs)/rides/', color: '#9B59B6' },
  { icon: 'pricetag', label: 'מחירון', route: '/(tabs)/prices/', color: '#50B878' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { bridges, fetchBridges } = useBridgeStore();

  useEffect(() => {
    fetchBridges();
  }, []);

  return (
    <ScreenWrapper showMedit={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <HamburgerMenu />
          <View style={styles.headerCenter}>
            <Text style={styles.greeting}>
              שלום, {user?.full_name?.split(' ')[0] || 'סטודנט'} 👋
            </Text>
            <Text style={styles.headerSubtitle}>מה חדש ב-MEDNET?</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
            {user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.headerAvatar} />
            ) : (
              <View style={styles.headerAvatarPlaceholder}>
                <Ionicons name="person" size={20} color={COLORS.white} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* MEDIT CTA - Pi.ai style */}
        <TouchableOpacity
          style={styles.meditCard}
          onPress={() => router.push('/(tabs)/chat')}
          activeOpacity={0.85}
        >
          <View style={styles.meditIcon}>
            <Ionicons name="chatbubble-ellipses" size={28} color={COLORS.white} />
          </View>
          <View style={styles.meditInfo}>
            <Text style={styles.meditTitle}>שאל את MEDIT</Text>
            <Text style={styles.meditDesc}>העוזר החכם שלך – שאל כל שאלה על MEDNET</Text>
          </View>
          <Ionicons name="chevron-back" size={22} color={COLORS.white} />
        </TouchableOpacity>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>גישה מהירה</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickActions}
          style={styles.quickActionsRow}
        >
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.quickAction}
              onPress={() => router.push(action.route as any)}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: action.color + '15' }]}>
                <Ionicons name={action.icon as any} size={24} color={action.color} />
              </View>
              <Text style={styles.quickActionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Top Bridges */}
        <View style={styles.sectionHeader}>
          <TouchableOpacity onPress={() => router.push('/(tabs)/discover')}>
            <Text style={styles.seeAll}>הצג הכל</Text>
          </TouchableOpacity>
          <Text style={styles.sectionTitle}>גשרים מובילים</Text>
        </View>
        {bridges.slice(0, 4).map((bridge) => (
          <BridgeCard key={bridge.id} bridge={bridge} variant="large" />
        ))}

        {/* Community Questions CTA */}
        <TouchableOpacity
          style={styles.communityCard}
          onPress={() => router.push('/(tabs)/community/')}
          activeOpacity={0.85}
        >
          <Ionicons name="help-circle" size={32} color={COLORS.accent} />
          <View style={styles.communityInfo}>
            <Text style={styles.communityTitle}>הקהילה שואלת</Text>
            <Text style={styles.communityDesc}>שאלות ותשובות מהקהילה</Text>
          </View>
          <Ionicons name="chevron-back" size={20} color={COLORS.gray} />
        </TouchableOpacity>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  greeting: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  headerSubtitle: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 2,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meditCard: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginTop: SPACING.md,
    ...SHADOWS.button,
  },
  meditIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.md,
  },
  meditInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  meditTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.white,
  },
  meditDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
    textAlign: 'right',
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.primaryDark,
    textAlign: 'right',
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
  },
  seeAll: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  quickActionsRow: {
    marginHorizontal: -SPACING.lg,
  },
  quickActions: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  quickAction: {
    alignItems: 'center',
    width: 72,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
    ...SHADOWS.card,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primaryDark,
    textAlign: 'center',
  },
  communityCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginTop: SPACING.lg,
    gap: SPACING.md,
    ...SHADOWS.card,
  },
  communityInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  communityTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  communityDesc: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 2,
  },
});
