import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import type { User, BridgeTag, UserTagSubscription } from '../types/database';

interface AuthState {
  user: User | null;
  session: any | null;
  loading: boolean;
  onboardingStep: number;
  subscribedTags: BridgeTag[];
  setUser: (user: User | null) => void;
  setSession: (session: any) => void;
  setLoading: (loading: boolean) => void;
  setOnboardingStep: (step: number) => void;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<{ error: string | null }>;
  initialize: () => Promise<void>;
  // Tag subscriptions
  fetchSubscribedTags: () => Promise<void>;
  subscribeToTag: (tagId: string) => Promise<void>;
  unsubscribeFromTag: (tagId: string) => Promise<void>;
  // Couple sync
  sendPartnerRequest: (partnerUserId: string) => Promise<{ error: string | null }>;
  acceptPartnerRequest: (requesterId: string) => Promise<{ error: string | null }>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  onboardingStep: 0,
  subscribedTags: [],

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setLoading: (loading) => set({ loading }),
  setOnboardingStep: (step) => set({ onboardingStep: step }),

  signUp: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return { error: error.message };

      if (data.user) {
        // Create user profile
        await supabase.from('users').insert({
          id: data.user.id,
          email,
          full_name: '',
        });
      }

      return { error: null };
    } catch (e: any) {
      return { error: e.message };
    }
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    await get().fetchProfile();
    return { error: null };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    try { await AsyncStorage.removeItem('mednet_profile'); } catch (e) {}
    set({ user: null, session: null });
  },

  fetchProfile: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    // Try DB first
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();
      if (data) {
        set({ user: data as User });
        return;
      }
    } catch (e) {}

    // Fallback: load from local storage
    try {
      const saved = await AsyncStorage.getItem('mednet_profile');
      if (saved) {
        set({ user: JSON.parse(saved) as User });
        return;
      }
    } catch (e) {}

    // Last fallback: basic user from session
    set({
      user: {
        id: session.user.id,
        email: session.user.email || '',
        full_name: '',
        created_at: new Date().toISOString(),
      } as User,
    });
  },

  updateProfile: async (updates) => {
    const user = get().user;
    const session = get().session;

    // Build user object from existing or session
    const baseUser = user || {
      id: session?.user?.id || 'local',
      email: session?.user?.email || '',
      full_name: '',
      created_at: new Date().toISOString(),
    } as User;

    const updatedUser = { ...baseUser, ...updates } as User;

    // Save locally so data persists even without DB
    try {
      await AsyncStorage.setItem('mednet_profile', JSON.stringify(updatedUser));
    } catch (e) {}

    // Save to DB — surface errors so the UI can inform the user
    try {
      const { error: dbError } = await supabase
        .from('users')
        .update(updates)
        .eq('id', baseUser.id);

      if (dbError) {
        console.error('Profile DB update failed:', dbError);
        // Local save already happened — state is updated locally but not in DB
        // Return the error so the caller can show a warning toast
        set({ user: updatedUser });
        return { error: dbError.message };
      }
    } catch (e: any) {
      console.error('Profile update exception:', e);
      set({ user: updatedUser });
      return { error: e?.message || 'שגיאה בשמירת הפרופיל' };
    }

    set({ user: updatedUser });
    return { error: null };
  },

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        set({ session });
        await get().fetchProfile();
        await get().fetchSubscribedTags();
      }
    } finally {
      set({ loading: false });
    }

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session });
      if (session) {
        get().fetchProfile();
        get().fetchSubscribedTags();
      } else {
        set({ user: null, subscribedTags: [] });
      }
    });
  },

  // Tag subscriptions
  fetchSubscribedTags: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    try {
      const { data } = await supabase
        .from('user_tag_subscriptions')
        .select('tag_id, subscribed_at, bridge_tags(id, name)')
        .eq('user_id', session.user.id);

      if (data) {
        const tags = data
          .map((sub: any) => sub.bridge_tags)
          .filter(Boolean) as BridgeTag[];
        set({ subscribedTags: tags });
      }
    } catch (e) {}
  },

  subscribeToTag: async (tagId) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    try {
      await supabase.from('user_tag_subscriptions').upsert(
        { user_id: session.user.id, tag_id: tagId },
        { onConflict: 'user_id,tag_id', ignoreDuplicates: true }
      );
      await get().fetchSubscribedTags();
    } catch (e) {}
  },

  unsubscribeFromTag: async (tagId) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    try {
      await supabase
        .from('user_tag_subscriptions')
        .delete()
        .eq('user_id', session.user.id)
        .eq('tag_id', tagId);
      await get().fetchSubscribedTags();
    } catch (e) {}
  },

  // Couple sync
  sendPartnerRequest: async (partnerUserId) => {
    const user = get().user;
    if (!user) return { error: 'לא מחובר' };

    try {
      // Update own profile with partner ID (pending)
      await supabase.from('users').update({ partner_user_id: partnerUserId }).eq('id', user.id);

      // Create a notification for the partner
      await supabase.from('notifications').insert({
        user_id: partnerUserId,
        type: 'partner_request',
        reference_id: user.id,
        bridge_id: null,
      });

      return { error: null };
    } catch (e: any) {
      return { error: e.message };
    }
  },

  acceptPartnerRequest: async (requesterId) => {
    const user = get().user;
    if (!user) return { error: 'לא מחובר' };

    try {
      // Update accepter's own row (User B → partner = A)
      const { error: ownUpdateError } = await supabase
        .from('users')
        .update({ partner_user_id: requesterId })
        .eq('id', user.id);

      if (ownUpdateError) return { error: ownUpdateError.message };

      // Update requester's row via RPC (service-side function bypasses RLS)
      // This ensures the link is bidirectional: A.partner=B AND B.partner=A
      const { error: rpcError } = await supabase.rpc('link_partner', {
        requester_id: requesterId,
        accepter_id: user.id,
      });

      if (rpcError) {
        // RPC might not exist yet — log but don't fail the whole operation
        // The requester's row was already set in sendPartnerRequest
        console.warn('link_partner RPC failed (may not exist yet):', rpcError);
      }

      // Notify the requester
      await supabase.from('notifications').insert({
        user_id: requesterId,
        type: 'partner_accepted',
        reference_id: user.id,
        bridge_id: null,
      });

      await get().fetchProfile();
      return { error: null };
    } catch (e: any) {
      return { error: e?.message || 'שגיאה בקבלת הבקשה' };
    }
  },
}));
