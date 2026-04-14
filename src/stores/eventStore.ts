import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Event, EventRsvp } from '../types/database';

interface EventState {
  events: Event[];
  currentEvent: Event | null;
  rsvps: EventRsvp[];
  loading: boolean;
  fetchEvents: (month: number, year?: number) => Promise<void>;
  fetchEvent: (id: string) => Promise<void>;
  createEvent: (event: Partial<Event>) => Promise<{ id?: string; error: string | null }>;
  toggleRsvp: (eventId: string, userId: string) => Promise<void>;
  fetchRsvps: (eventId: string) => Promise<void>;
  getRsvpStatus: (eventId: string, userId: string) => EventRsvp | undefined;
}

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  currentEvent: null,
  rsvps: [],
  loading: false,

  fetchEvents: async (month, year) => {
    set({ loading: true });
    try {
      const y = year ?? new Date().getFullYear();
      const startDate = new Date(y, month, 1).toISOString();
      const endDate = new Date(y, month + 1, 0, 23, 59, 59).toISOString();

      const { data } = await supabase
        .from('events')
        .select('*, bridge:bridges(name), creator:users(full_name, avatar_url)')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      set({ events: (data || []) as Event[], loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchEvent: async (id) => {
    const { data } = await supabase
      .from('events')
      .select('*, bridge:bridges(name), creator:users(full_name, avatar_url)')
      .eq('id', id)
      .single();

    set({ currentEvent: data as Event });
  },

  createEvent: async (event) => {
    try {
      const { data, error } = await supabase
        .from('events')
        .insert(event)
        .select('*, bridge:bridges(name), creator:users(full_name, avatar_url)')
        .single();

      if (error) return { error: error.message };

      if (data) {
        set((state) => ({ events: [data as Event, ...state.events] }));
        return { id: data.id, error: null };
      }
      return { error: 'No data returned' };
    } catch (e: any) {
      return { error: e.message || 'Unknown error' };
    }
  },

  toggleRsvp: async (eventId, userId) => {
    const existing = get().rsvps.find(
      (r) => r.event_id === eventId && r.user_id === userId
    );

    if (existing) {
      await supabase
        .from('event_rsvps')
        .delete()
        .eq('event_id', eventId)
        .eq('user_id', userId);

      set((state) => ({
        rsvps: state.rsvps.filter(
          (r) => !(r.event_id === eventId && r.user_id === userId)
        ),
      }));
    } else {
      const { data } = await supabase
        .from('event_rsvps')
        .insert({ event_id: eventId, user_id: userId, status: 'going' })
        .select('*, user:users(full_name, avatar_url)')
        .single();

      if (data) {
        set((state) => ({ rsvps: [...state.rsvps, data as EventRsvp] }));
      }
    }
  },

  fetchRsvps: async (eventId) => {
    const { data } = await supabase
      .from('event_rsvps')
      .select('*, user:users(full_name, avatar_url)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    set({ rsvps: (data || []) as EventRsvp[] });
  },

  getRsvpStatus: (eventId, userId) => {
    return get().rsvps.find(
      (r) => r.event_id === eventId && r.user_id === userId
    );
  },
}));
