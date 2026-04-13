import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { DirectMessage, User } from '../types/database';

interface Conversation {
  user: User;
  lastMessage: DirectMessage;
  unreadCount: number;
}

interface MessengerState {
  conversations: Conversation[];
  currentMessages: DirectMessage[];
  loading: boolean;
  fetchConversations: (userId: string) => Promise<void>;
  fetchMessages: (userId: string, otherUserId: string) => Promise<void>;
  sendDirectMessage: (fromId: string, toId: string, content: string) => Promise<{ error: string | null }>;
  markAsRead: (userId: string, fromUserId: string) => Promise<void>;
  subscribeToDirectMessages: (userId: string) => () => void;
}

export const useMessengerStore = create<MessengerState>((set) => ({
  conversations: [],
  currentMessages: [],
  loading: false,

  fetchConversations: async (userId) => {
    set({ loading: true });
    const { data: messages } = await supabase
      .from('direct_messages')
      .select('*, from_user:users!from_user_id(*), to_user:users!to_user_id(*)')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (!messages) {
      set({ conversations: [], loading: false });
      return;
    }

    const conversationMap = new Map<string, Conversation>();

    for (const msg of messages) {
      const otherUser = msg.from_user_id === userId ? msg.to_user : msg.from_user;
      if (!otherUser) continue;
      const otherId = otherUser.id;

      if (!conversationMap.has(otherId)) {
        const unread = messages.filter(
          (m: any) => m.from_user_id === otherId && m.to_user_id === userId && !m.read
        ).length;

        conversationMap.set(otherId, {
          user: otherUser as User,
          lastMessage: msg as DirectMessage,
          unreadCount: unread,
        });
      }
    }

    set({
      conversations: Array.from(conversationMap.values()),
      loading: false,
    });
  },

  fetchMessages: async (userId, otherUserId) => {
    set({ loading: true });
    const { data } = await supabase
      .from('direct_messages')
      .select('*, from_user:users!from_user_id(full_name, avatar_url)')
      .or(
        `and(from_user_id.eq.${userId},to_user_id.eq.${otherUserId}),and(from_user_id.eq.${otherUserId},to_user_id.eq.${userId})`
      )
      .order('created_at', { ascending: true });

    set({ currentMessages: (data || []) as DirectMessage[], loading: false });
  },

  sendDirectMessage: async (fromId, toId, content) => {
    const { error } = await supabase.from('direct_messages').insert({
      from_user_id: fromId,
      to_user_id: toId,
      content,
    });
    if (error) return { error: error.message };
    return { error: null };
  },

  markAsRead: async (userId, fromUserId) => {
    await supabase
      .from('direct_messages')
      .update({ read: true })
      .eq('to_user_id', userId)
      .eq('from_user_id', fromUserId)
      .eq('read', false);
  },

  subscribeToDirectMessages: (userId) => {
    const channel = supabase
      .channel(`dm:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `to_user_id=eq.${userId}`,
        },
        async (payload) => {
          const { data: msg } = await supabase
            .from('direct_messages')
            .select('*, from_user:users!from_user_id(full_name, avatar_url)')
            .eq('id', payload.new.id)
            .single();

          if (msg) {
            set((state) => ({
              currentMessages: [...state.currentMessages, msg as DirectMessage],
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
}));
