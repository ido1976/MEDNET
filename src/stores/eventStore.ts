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
  updateEvent: (id: string, updates: Partial<Event>) => Promise<{ error: string | null }>;
  deleteEvent: (id: string) => Promise<{ error: string | null }>;
  toggleRsvp: (eventId: string, userId: string, status?: 'going' | 'maybe') => Promise<void>;
  fetchRsvps: (eventId: string) => Promise<void>;
  fetchRsvpsForEvents: (eventIds: string[]) => Promise<void>;
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
        .select('*, bridge:bridges(name), creator:users!created_by(full_name, avatar_url)')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      set({ events: (data || []) as Event[], loading: false });
    } catch (e) {
      console.warn('fetchEvents failed:', e);
      set({ loading: false });
    }
  },

  fetchEvent: async (id) => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*, bridge:bridges(name), creator:users!created_by(full_name, avatar_url)')
        .eq('id', id)
        .single();

      if (error) {
        console.warn('fetchEvent failed:', error);
        return;
      }
      set({ currentEvent: data as Event });
    } catch (e) {
      console.warn('fetchEvent failed:', e);
    }
  },

  createEvent: async (event) => {
    try {
      const { data, error } = await supabase
        .from('events')
        .insert(event)
        .select('*, bridge:bridges(name), creator:users!created_by(full_name, avatar_url)')
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

  updateEvent: async (id, updates) => {
    try {
      const { error } = await supabase
        .from('events')
        .update(updates)
        .eq('id', id);

      if (error) return { error: error.message };

      set((state) => ({
        events: state.events.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        currentEvent:
          state.currentEvent?.id === id
            ? { ...state.currentEvent, ...updates }
            : state.currentEvent,
      }));
      return { error: null };
    } catch (e: any) {
      return { error: e.message || 'Unknown error' };
    }
  },

  deleteEvent: async (id) => {
    try {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) return { error: error.message };

      set((state) => ({
        events: state.events.filter((e) => e.id !== id),
        currentEvent: state.currentEvent?.id === id ? null : state.currentEvent,
      }));
      return { error: null };
    } catch (e: any) {
      return { error: e.message || 'Unknown error' };
    }
  },

  toggleRsvp: async (eventId, userId, status = 'going') => {
    const existing = get().rsvps.find(
      (r) => r.event_id === eventId && r.user_id === userId
    );

    if (existing) {
      if (existing.status === status) {
        // Same status → remove (toggle off)
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
        // Different status → update to new status
        await supabase
          .from('event_rsvps')
          .update({ status })
          .eq('event_id', eventId)
          .eq('user_id', userId);

        set((state) => ({
          rsvps: state.rsvps.map((r) =>
            r.event_id === eventId && r.user_id === userId
              ? { ...r, status: status as EventRsvp['status'] }
              : r
          ),
        }));
      }
    } else {
      // No existing RSVP → insert
      const { data } = await supabase
        .from('event_rsvps')
        .insert({ event_id: eventId, user_id: userId, status })
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

    set((state) => ({
      rsvps: [
        ...state.rsvps.filter((r) => r.event_id !== eventId),
        ...((data || []) as EventRsvp[]),
      ],
    }));
  },

  fetchRsvpsForEvents: async (eventIds) => {
    if (eventIds.length === 0) return;
    const { data } = await supabase
      .from('event_rsvps')
      .select('*, user:users(full_name, avatar_url)')
      .in('event_id', eventIds)
      .order('created_at', { ascending: true });

    set((state) => ({
      rsvps: [
        ...state.rsvps.filter((r) => !eventIds.includes(r.event_id)),
        ...((data || []) as EventRsvp[]),
      ],
    }));
  },

  getRsvpStatus: (eventId, userId) => {
    return get().rsvps.find(
      (r) => r.event_id === eventId && r.user_id === userId
    );
  },
}));
