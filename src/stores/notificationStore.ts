import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Notification } from '../types/database';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: (userId: string) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllRead: (userId: string) => Promise<void>;
  subscribeToNotifications: (userId: string) => () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

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
}));
