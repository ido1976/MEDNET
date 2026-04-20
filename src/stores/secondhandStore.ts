import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { SecondhandListing } from '../types/database';

interface SecondhandState {
  listings: SecondhandListing[];
  currentListing: SecondhandListing | null;
  loading: boolean;
  fetchListings: (category?: string) => Promise<void>;
  fetchListing: (id: string) => Promise<void>;
  createListing: (listing: Partial<SecondhandListing>) => Promise<{ id?: string; error: string | null }>;
  updateListing: (id: string, updates: Partial<SecondhandListing>) => Promise<{ error: string | null }>;
  deleteListing: (id: string) => Promise<{ error: string | null }>;
}

export const useSecondhandStore = create<SecondhandState>((set) => ({
  listings: [],
  currentListing: null,
  loading: false,

  fetchListings: async (category?) => {
    set({ loading: true });
    try {
      let query = supabase
        .from('secondhand_listings')
        .select('*, creator:users(full_name, avatar_url, email)')
        .order('created_at', { ascending: false });

      if (category && category !== 'all') {
        query = query.eq('category', category);
      }

      const { data } = await query;
      set({ listings: (data || []) as SecondhandListing[], loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchListing: async (id) => {
    const { data } = await supabase
      .from('secondhand_listings')
      .select('*, creator:users(full_name, avatar_url, email, phone)')
      .eq('id', id)
      .single();

    set({ currentListing: data as SecondhandListing });
  },

  createListing: async (listing) => {
    try {
      const { data, error } = await supabase
        .from('secondhand_listings')
        .insert(listing)
        .select('*, creator:users(full_name, avatar_url, email)')
        .single();

      if (error) return { error: error.message };

      if (data) {
        set((state) => ({ listings: [data as SecondhandListing, ...state.listings] }));
        return { id: data.id, error: null };
      }
      return { error: 'No data returned' };
    } catch (e: any) {
      return { error: e.message || 'Unknown error' };
    }
  },

  updateListing: async (id, updates) => {
    const { error } = await supabase
      .from('secondhand_listings')
      .update(updates)
      .eq('id', id);

    if (error) return { error: error.message };

    set((state) => ({
      listings: state.listings.map((l) => (l.id === id ? { ...l, ...updates } : l)),
      currentListing: state.currentListing?.id === id
        ? { ...state.currentListing, ...updates }
        : state.currentListing,
    }));
    return { error: null };
  },

  deleteListing: async (id) => {
    const { error } = await supabase
      .from('secondhand_listings')
      .delete()
      .eq('id', id);

    if (error) return { error: error.message };

    set((state) => ({
      listings: state.listings.filter((l) => l.id !== id),
    }));
    return { error: null };
  },
}));
