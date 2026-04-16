import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Notification, NotificationPreference, PendingAction } from '../types/database';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  preferences: NotificationPreference[];
  pendingActions: PendingAction[];
  pendingActionsCount: number;
  fetchNotifications: (userId: string) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllRead: (userId: string) => Promise<void>;
  subscribeToNotifications: (userId: string) => () => void;
  // Notification preferences
  fetchPreferences: () => Promise<void>;
  updatePreference: (type: string, enabled: boolean, channel?: string) => Promise<void>;
  // Pending actions
  fetchPendingActions: () => Promise<void>;
  completePendingAction: (actionId: string) => Promise<void>;
  dismissPendingAction: (actionId: string) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  preferences: [],
  pendingActions: [],
  pendingActionsCount: 0,

  fetchNotifications: async (userId) => {
    set({ loading: true });
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*, bridge:bridges(name)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      const notifications = (data || []) as Notification[];
      set({
        notifications,
        unreadCount: notifications.filter(n => !n.read).length,
        loading: false,
      });
    } catch (e) {
      set({ loading: false });
    }
  },

  markAsRead: async (notificationId) => {
    try {
      await supabase.from('notifications').update({ read: true }).eq('id', notificationId);
      set((state) => ({
        notifications: state.notifications.map(n =>
          n.id === notificationId ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch (e) {}
  },

  markAllRead: async (userId) => {
    try {
      await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
      set((state) => ({
        notifications: state.notifications.map(n => ({ ...n, read: true })),
        unreadCount: 0,
      }));
    } catch (e) {}
  },

  subscribeToNotifications: (userId) => {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, () => {
        get().fetchNotifications(userId);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  // Notification preferences
  fetchPreferences: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    try {
      const { data } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', session.user.id);
      set({ preferences: (data || []) as NotificationPreference[] });
    } catch (e) {}
  },

  updatePreference: async (type, enabled, channel = 'in_app') => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    try {
      await supabase
        .from('notification_preferences')
        .upsert({
          user_id: session.user.id,
          notification_type: type,
          enabled,
          channel,
        });
      await get().fetchPreferences();
    } catch (e) {}
  },

  // Pending actions
  fetchPendingActions: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    try {
      const { data } = await supabase
        .from('pending_actions')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('status', 'pending')
        .order('due_date', { ascending: true, nullsFirst: false });

      const actions = (data || []) as PendingAction[];
      set({ pendingActions: actions, pendingActionsCount: actions.length });
    } catch (e) {}
  },

  completePendingAction: async (actionId) => {
    try {
      await supabase
        .from('pending_actions')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', actionId);
      await get().fetchPendingActions();
    } catch (e) {}
  },

  dismissPendingAction: async (actionId) => {
    try {
      await supabase
        .from('pending_actions')
        .update({ status: 'dismissed' })
        .eq('id', actionId);
      await get().fetchPendingActions();
    } catch (e) {}
  },
}));
