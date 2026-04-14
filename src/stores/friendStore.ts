import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { User, Friendship } from '../types/database';

interface FriendState {
  friends: Friendship[];
  incomingRequests: Friendship[];
  searchResults: User[];
  loading: boolean;
  fetchFriends: (userId: string) => Promise<void>;
  fetchRequests: (userId: string) => Promise<void>;
  searchUsers: (query: string, currentUserId: string) => Promise<void>;
  sendFriendRequest: (requesterId: string, addresseeId: string) => Promise<{ error: string | null }>;
  acceptFriend: (friendshipId: string) => Promise<{ error: string | null }>;
  rejectFriend: (friendshipId: string) => Promise<{ error: string | null }>;
  removeFriend: (friendshipId: string) => Promise<{ error: string | null }>;
}

export const useFriendStore = create<FriendState>((set) => ({
  friends: [],
  incomingRequests: [],
  searchResults: [],
  loading: false,

  fetchFriends: async (userId) => {
    const { data } = await supabase
      .from('friendships')
      .select('*, requester:users!friendships_requester_id_fkey(id, full_name, avatar_url), addressee:users!friendships_addressee_id_fkey(id, full_name, avatar_url)')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

    set({ friends: (data || []) as Friendship[] });
  },

  fetchRequests: async (userId) => {
    const { data } = await supabase
      .from('friendships')
      .select('*, requester:users!friendships_requester_id_fkey(id, full_name, avatar_url)')
      .eq('addressee_id', userId)
      .eq('status', 'pending');

    set({ incomingRequests: (data || []) as Friendship[] });
  },

  searchUsers: async (query, currentUserId) => {
    if (!query.trim()) {
      set({ searchResults: [] });
      return;
    }
    set({ loading: true });
    const { data } = await supabase
      .from('users')
      .select('id, full_name, avatar_url')
      .ilike('full_name', `%${query}%`)
      .neq('id', currentUserId)
      .limit(20);

    set({ searchResults: (data || []) as User[], loading: false });
  },

  sendFriendRequest: async (requesterId, addresseeId) => {
    const { error } = await supabase
      .from('friendships')
      .insert({ requester_id: requesterId, addressee_id: addresseeId, status: 'pending' });

    if (error) {
      if (error.code === '23505') return { error: 'בקשת חברות כבר נשלחה' };
      return { error: error.message };
    }
    return { error: null };
  },

  acceptFriend: async (friendshipId) => {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId);

    if (error) return { error: error.message };
    return { error: null };
  },

  rejectFriend: async (friendshipId) => {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'rejected' })
      .eq('id', friendshipId);

    if (error) return { error: error.message };
    return { error: null };
  },

  removeFriend: async (friendshipId) => {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);

    if (error) return { error: error.message };
    return { error: null };
  },
}));
