import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../../src/components/ScreenWrapper';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../../src/constants/theme';
import { useEventStore } from '../../../src/stores/eventStore';
import { useDiscussionStore } from '../../../src/stores/discussionStore';
import { useAuthStore } from '../../../src/stores/authStore';
import { formatDate, formatTime } from '../../../src/lib/helpers';
import type { Discussion } from '../../../src/types/database';

const MONTHS_HE = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { currentEvent, fetchEvent, rsvps, fetchRsvps, toggleRsvp } = useEventStore();
  const { discussions, fetchDiscussions } = useDiscussionStore();
  const [loading, setLoading] = useState(true);
  const [eventDiscussions, setEventDiscussions] = useState<Discussion[]>([]);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    await Promise.all([
      fetchEvent(id),
      fetchRsvps(id),
      loadDiscussions(),
    ]);
    setLoading(false);
  };

  const loadDiscussions = async () => {
    if (!id) return;
    await fetchDiscussions(undefined);
    const allDisc = useDiscussionStore.getState().discussions;
    setEventDiscussions(allDisc.filter((d: any) => d.event_id === id));
  };

  const eventRsvps = rsvps.filter((r) => r.event_id === id);
  const goingCount = eventRsvps.filter((r) => r.status === 'going').length;
  const isGoing = eventRsvps.some((r) => r.user_id === user?.id && r.status === 'going');

  const handleRsvp = async () => {
    if (!user?.id || !id) return;
    await toggleRsvp(id, user.id);
  };

  if (loading || !currentEvent) {
    return (
      <ScreenWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  const date = new Date(currentEvent.date);

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-forward" size={24} color={COLORS.primaryDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{currentEvent.title}</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Image */}
        {currentEvent.image_url && (
          <Image source={{ uri: currentEvent.image_url }} style={styles.eventImage} />
        )}

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.eventTitle}>{currentEvent.title}</Text>
          {currentEvent.description ? (
            <Text style={styles.eventDesc}>{currentEvent.description}</Text>
          ) : null}

          {/* Date */}
          <View style={styles.metaRow}>
            <Ionicons name="calendar" size={18} color={COLORS.primary} />
            <Text style={styles.metaValue}>
              {date.getDate()} {MONTHS_HE[date.getMonth()]} {date.getFullYear()} · {formatTime(currentEvent.date)}
            </Text>
          </View>

          {/* Location */}
          {currentEvent.location ? (
            <View style={styles.metaRow}>
              <Ionicons name="location" size={18} color={COLORS.primary} />
              <Text style={styles.metaValue}>{currentEvent.location}</Text>
            </View>
          ) : null}

          {/* Link */}
          {currentEvent.link ? (
            <TouchableOpacity style={styles.metaRow} onPress={() => Linking.openURL(currentEvent.link!)}>
              <Ionicons name="link" size={18} color={COLORS.primary} />
              <Text style={[styles.metaValue, { color: COLORS.primary, textDecorationLine: 'underline' }]}>
                {currentEvent.link}
              </Text>
            </TouchableOpacity>
          ) : null}

          {/* Bridge */}
          {(currentEvent as any).bridge?.name && (
            <View style={styles.metaRow}>
              <Ionicons name="git-network" size={18} color={COLORS.primary} />
              <Text style={styles.metaValue}>{(currentEvent as any).bridge.name}</Text>
            </View>
          )}

          {/* Creator */}
          {(currentEvent as any).creator?.full_name && (
            <View style={styles.metaRow}>
              <Ionicons name="person" size={18} color={COLORS.primary} />
              <Text style={styles.metaValue}>נוצר ע״י {(currentEvent as any).creator.full_name}</Text>
            </View>
          )}

          {/* Category */}
          {currentEvent.category && (
            <View style={styles.categoryChip}>
              <Text style={styles.categoryText}>{currentEvent.category}</Text>
            </View>
          )}
        </View>

        {/* RSVP Section */}
        <View style={styles.rsvpSection}>
          <Text style={styles.sectionTitle}>אישור הגעה</Text>
          <TouchableOpacity
            style={[styles.rsvpMainBtn, isGoing && styles.rsvpMainBtnActive]}
            onPress={handleRsvp}
          >
            <Ionicons
              name={isGoing ? 'checkmark-circle' : 'checkmark-circle-outline'}
              size={22}
              color={isGoing ? COLORS.white : COLORS.primary}
            />
            <Text style={[styles.rsvpMainBtnText, isGoing && styles.rsvpMainBtnTextActive]}>
              {isGoing ? 'מגיע/ה ✓' : 'אישור הגעה'}
            </Text>
          </TouchableOpacity>

          {goingCount > 0 && (
            <View style={styles.attendeesList}>
              <Text style={styles.attendeesTitle}>{goingCount} מאשרים:</Text>
              {eventRsvps
                .filter((r) => r.status === 'going')
                .map((r, i) => (
                  <View key={i} style={styles.attendeeRow}>
                    <Ionicons name="person-circle" size={20} color={COLORS.primary} />
                    <Text style={styles.attendeeName}>
                      {(r as any).user?.full_name || 'משתמש'}
                    </Text>
                  </View>
                ))}
            </View>
          )}
        </View>

        {/* Discussions Section */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionActions}>
            <TouchableOpacity
              onPress={() =>
                router.push(
                  `/(tabs)/discussions/?eventId=${id}&bridgeId=${currentEvent.bridge_id || ''}&openCreate=true`
                )
              }
            >
              <Ionicons name="add-circle-outline" size={22} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push(`/(tabs)/discussions/?eventId=${id}`)}
            >
              <Text style={styles.seeAll}>הצג הכל</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionTitle}>דיונים</Text>
        </View>
        {eventDiscussions.length === 0 ? (
          <View style={styles.emptySection}>
            <Text style={styles.emptyText}>אין דיונים לאירוע זה</Text>
          </View>
        ) : (
          eventDiscussions.slice(0, 3).map((disc) => (
            <TouchableOpacity
              key={disc.id}
              style={styles.discussionItem}
              onPress={() => router.push(`/(tabs)/discussions/${disc.id}`)}
            >
              <View style={styles.discussionInfo}>
                <Text style={styles.discussionTitle}>{disc.title}</Text>
                <View style={styles.discussionMeta}>
                  <Ionicons name="people" size={14} color={COLORS.gray} />
                  <Text style={styles.discussionMetaText}>{disc.participants_count}</Text>
                  <Ionicons name="pricetag" size={14} color={COLORS.gray} />
                  <Text style={styles.discussionMetaText}>{disc.tag}</Text>
                </View>
              </View>
              <Ionicons name="chevron-back" size={18} color={COLORS.grayLight} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primaryDark,
    flex: 1,
    textAlign: 'center',
  },
  eventImage: {
    width: '100%',
    height: 200,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
  },
  infoCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.sm,
    ...SHADOWS.card,
  },
  eventTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primaryDark,
    textAlign: 'right',
  },
  eventDesc: {
    fontSize: 15,
    color: COLORS.gray,
    textAlign: 'right',
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  metaValue: {
    fontSize: 14,
    color: COLORS.primaryDark,
    flex: 1,
    textAlign: 'right',
  },
  categoryChip: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: RADIUS.xl,
    marginTop: SPACING.xs,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  // RSVP
  rsvpSection: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginTop: SPACING.md,
    ...SHADOWS.card,
  },
  rsvpMainBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: RADIUS.xl,
    borderWidth: 2,
    borderColor: COLORS.primary,
    marginTop: SPACING.sm,
  },
  rsvpMainBtnActive: {
    backgroundColor: COLORS.primary,
  },
  rsvpMainBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  rsvpMainBtnTextActive: {
    color: COLORS.white,
  },
  attendeesList: {
    marginTop: SPACING.md,
    gap: SPACING.xs,
  },
  attendeesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primaryDark,
    textAlign: 'right',
  },
  attendeeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  attendeeName: {
    fontSize: 14,
    color: COLORS.gray,
  },
  // Sections
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
  },
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  seeAll: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: SPACING.xl,
  },
  emptySection: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.card,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.gray,
  },
  // Discussion items
  discussionItem: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    ...SHADOWS.card,
  },
  discussionInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  discussionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primaryDark,
    marginBottom: 4,
  },
  discussionMeta: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  discussionMetaText: {
    fontSize: 12,
    color: COLORS.gray,
    marginLeft: SPACING.sm,
  },
});
