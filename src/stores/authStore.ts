import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import type { User } from '../types/database';

interface AuthState {
  user: User | null;
  session: any | null;
  loading: boolean;
  onboardingStep: number;
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
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  onboardingStep: 0,

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

    // Try to save to DB (will fail silently if tables don't exist)
    try {
      await supabase
        .from('users')
        .update(updates)
        .eq('id', baseUser.id);
    } catch (e) {}

    set({ user: updatedUser });
    return { error: null };
  },

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        set({ session });
        await get().fetchProfile();
      }
    } finally {
      set({ loading: false });
    }

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session });
      if (session) {
        get().fetchProfile();
      } else {
        set({ user: null });
      }
    });
  },
}));
