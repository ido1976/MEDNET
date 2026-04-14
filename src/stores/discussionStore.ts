import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Discussion, Message } from '../types/database';

interface DiscussionState {
  discussions: Discussion[];
  currentDiscussion: Discussion | null;
  messages: Message[];
  loading: boolean;
  fetchDiscussions: (bridgeId?: string, eventId?: string) => Promise<void>;
  fetchDiscussion: (id: string) => Promise<void>;
  fetchMessages: (discussionId: string) => Promise<void>;
  createDiscussion: (discussion: Partial<Discussion>) => Promise<{ id?: string; error: string | null }>;
  sendMessage: (discussionId: string, userId: string, content: string) => Promise<{ error: string | null }>;
  subscribeToMessages: (discussionId: string) => () => void;
}

export const useDiscussionStore = create<DiscussionState>((set, get) => ({
  discussions: [],
  currentDiscussion: null,
  messages: [],
  loading: false,

  fetchDiscussions: async (bridgeId, eventId?) => {
    set({ loading: true });
    try {
      let query = supabase
        .from('discussions')
        .select('*, bridge:bridges(name), creator:users(full_name, avatar_url)')
        .order('last_message_at', { ascending: false });

      if (bridgeId) query = query.eq('bridge_id', bridgeId);
      if (eventId) query = query.eq('event_id', eventId);

      const { data } = await query;
      if (data && data.length > 0) {
        set({ discussions: data as Discussion[], loading: false });
        return;
      }
    } catch (e) {}
    set({ discussions: [], loading: false });
  },

  fetchDiscussion: async (id) => {
    const { data } = await supabase
      .from('discussions')
      .select('*, bridge:bridges(name), creator:users(full_name, avatar_url)')
      .eq('id', id)
      .single();

    set({ currentDiscussion: data as Discussion });
  },

  fetchMessages: async (discussionId) => {
    set({ loading: true });
    const { data } = await supabase
      .from('messages')
      .select('*, user:users(full_name, avatar_url)')
      .eq('discussion_id', discussionId)
      .order('created_at', { ascending: true });

    set({ messages: (data || []) as Message[], loading: false });
  },

  createDiscussion: async (discussion) => {
    const newDiscussion: Discussion = {
      id: Date.now().toString(),
      title: discussion.title || '',
      tag: discussion.tag || 'כללי',
      bridge_id: discussion.bridge_id || null,
      created_by: discussion.created_by || '',
      participants_count: 1,
      last_message_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      ...discussion,
    } as Discussion;

    // Add locally
    set((state) => ({ discussions: [newDiscussion, ...state.discussions] }));

    // Try DB
    try {
      const { data, error } = await supabase
        .from('discussions')
        .insert(discussion)
        .select()
        .single();
      if (!error && data) return { id: data.id, error: null };
    } catch (e) {}

    return { id: newDiscussion.id, error: null };
  },

  sendMessage: async (discussionId, userId, content) => {
    // Moderate content first
    const { data: modResult } = await supabase.functions.invoke('moderate-content', {
      body: { content },
    });

    if (modResult?.flagged) {
      return { error: 'התוכן סומן כפוגעני ולא נשלח' };
    }

    const { error } = await supabase.from('messages').insert({
      discussion_id: discussionId,
      user_id: userId,
      content,
    });

    if (error) return { error: error.message };
    return { error: null };
  },

  subscribeToMessages: (discussionId) => {
    const channel = supabase
      .channel(`messages:${discussionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `discussion_id=eq.${discussionId}`,
        },
        async (payload) => {
          const { data: message } = await supabase
            .from('messages')
            .select('*, user:users(full_name, avatar_url)')
            .eq('id', payload.new.id)
            .single();

          if (message) {
            set((state) => ({
              messages: [...state.messages, message as Message],
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
