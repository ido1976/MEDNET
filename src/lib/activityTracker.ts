import { supabase } from './supabase';
import type { UserActivity } from '../types/database';

type ActivityType = UserActivity['activity_type'];
type TargetType = UserActivity['target_type'];

/**
 * Track a user viewing content
 */
export async function trackView(targetType: TargetType, targetId: string, metadata?: Record<string, unknown>) {
  return logActivity('view', targetType, targetId, metadata);
}

/**
 * Track a user creating content
 */
export async function trackCreate(targetType: TargetType, targetId: string, metadata?: Record<string, unknown>) {
  return logActivity('create', targetType, targetId, metadata);
}

/**
 * Track a user reacting to content (like, rate, rsvp)
 */
export async function trackReact(targetType: TargetType, targetId: string, metadata?: Record<string, unknown>) {
  return logActivity('react', targetType, targetId, metadata);
}

/**
 * Track a user search
 */
export async function trackSearch(context: string, query: string, resultCount: number) {
  // Log to user_activity
  logActivity('search', context as TargetType, null, { query, result_count: resultCount });

  // Also log to search history table
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    await supabase.from('user_search_history').insert({
      user_id: session.user.id,
      query,
      result_count: resultCount,
      context,
    });
  } catch (e) {
    // Fail silently — tracking should never break the app
  }
}

/**
 * Track a user bookmarking content
 */
export async function trackBookmark(targetType: TargetType, targetId: string) {
  return logActivity('bookmark', targetType, targetId);
}

/**
 * Core logging function — fires and forgets, never blocks UI
 */
async function logActivity(
  activityType: ActivityType,
  targetType: TargetType,
  targetId: string | null,
  metadata?: Record<string, unknown>
) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    await supabase.from('user_activity').insert({
      user_id: session.user.id,
      activity_type: activityType,
      target_type: targetType,
      target_id: targetId,
      metadata: metadata || {},
    });
  } catch (e) {
    // Fail silently — tracking should never break the app
  }
}
