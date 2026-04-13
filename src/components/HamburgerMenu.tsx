import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useAuthStore } from '../stores/authStore';
import { getInitials } from '../lib/helpers';
import NotificationBell from './NotificationBell';

const MENU_ITEMS = [
  { label: 'בית', icon: 'home', route: '/(tabs)/' },
  { label: 'MEDIT', icon: 'chatbubble-ellipses', route: '/(tabs)/chat' },
  { label: 'גשרים', icon: 'git-network', route: '/(tabs)/discover' },
  { label: 'דיונים', icon: 'chatbubbles', route: '/(tabs)/discussions/' },
  { label: 'אירועים', icon: 'calendar', route: '/(tabs)/events/' },
  { label: 'דירות', icon: 'home-outline', route: '/(tabs)/apartments/' },
  { label: 'טרמפים', icon: 'car', route: '/(tabs)/rides/' },
  { label: 'מחירון', icon: 'pricetag', route: '/(tabs)/prices/' },
  { label: 'הודעות', icon: 'mail', route: '/(tabs)/messenger/' },
  { label: 'הקהילה שואלת', icon: 'help-circle', route: '/(tabs)/community/' },
  { label: 'פרופיל', icon: 'person', route: '/(tabs)/profile' },
];

export default function HamburgerMenu() {
  const [visible, setVisible] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuthStore();

  const handleNavigate = (route: string) => {
    setVisible(false);
    setTimeout(() => router.push(route as any), 200);
  };

  const handleSignOut = async () => {
    setVisible(false);
    await signOut();
    router.replace('/(auth)/welcome');
  };

  return (
    <>
      <TouchableOpacity onPress={() => setVisible(true)} style={styles.trigger}>
        <Ionicons name="menu" size={26} color={COLORS.primaryDark} />
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" transparent>
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <View style={[styles.drawer, { paddingTop: insets.top + 10 }]}>
            <Pressable onPress={() => {}}>
              {/* User Info Header */}
              <View style={styles.userHeader}>
                {user?.avatar_url ? (
                  <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>
                      {user?.full_name ? getInitials(user.full_name) : '?'}
                    </Text>
                  </View>
                )}
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user?.full_name || 'משתמש'}</Text>
                  <Text style={styles.userEmail}>{user?.email}</Text>
                </View>
                <NotificationBell />
                <TouchableOpacity onPress={() => setVisible(false)} style={styles.closeBtn}>
                  <Ionicons name="close" size={24} color={COLORS.gray} />
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              {/* Menu Items */}
              <ScrollView showsVerticalScrollIndicator={false}>
                {MENU_ITEMS.map((item) => (
                  <TouchableOpacity
                    key={item.route}
                    style={styles.menuItem}
                    onPress={() => handleNavigate(item.route)}
                  >
                    <Ionicons name={item.icon as any} size={22} color={COLORS.primary} />
                    <Text style={styles.menuLabel}>{item.label}</Text>
                  </TouchableOpacity>
                ))}

                <View style={styles.divider} />

                <TouchableOpacity style={styles.menuItem} onPress={handleSignOut}>
                  <Ionicons name="log-out" size={22} color={COLORS.red} />
                  <Text style={[styles.menuLabel, { color: COLORS.red }]}>התנתקות</Text>
                </TouchableOpacity>
              </ScrollView>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    padding: 8,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    flexDirection: 'row-reverse',
  },
  drawer: {
    width: '80%',
    backgroundColor: COLORS.cream,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
    ...SHADOWS.card,
  },
  userHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginLeft: SPACING.md,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.md,
  },
  avatarText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 18,
  },
  userInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  userEmail: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.grayLight,
    marginVertical: SPACING.md,
  },
  menuItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.primaryDark,
  },
});
