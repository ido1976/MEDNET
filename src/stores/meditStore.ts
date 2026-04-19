import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import type { MeditMessage, ChatSession } from '../types/database';
const uuid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const STORAGE_KEY = 'chatmed_current_session';

interface MeditState {
  messages: MeditMessage[];
  loading: boolean;
  sessions: ChatSession[];
  currentSessionId: string | null;
  // Actions
  sendMessage: (content: string) => Promise<void>;
  startNewSession: () => void;
  loadLastSession: () => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  fetchSessions: () => Promise<void>;
}

export const useMeditStore = create<MeditState>((set, get) => ({
  messages: [],
  loading: false,
  sessions: [],
  currentSessionId: null,

  // Called on app start: instant load from AsyncStorage, then Supabase sync in background
  loadLastSession: async () => {
    try {
      // 1. Instant load from local cache
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        set({
          messages: parsed.messages || [],
          currentSessionId: parsed.session_id || null,
        });
      }

      // 2. Fetch latest session from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: latestSession } = await supabase
        .from('chat_sessions')
        .select('id, last_message_at')
        .eq('user_id', session.user.id)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .single();

      if (!latestSession) return;

      const currentMessages = get().messages;
      const localLastTs = currentMessages.length > 0
        ? Math.max(...currentMessages.map(m => m.timestamp))
        : 0;
      const supabaseLastTs = new Date(latestSession.last_message_at).getTime();

      // 3. If Supabase is newer, sync down
      if (supabaseLastTs > localLastTs) {
        const { data: dbMessages } = await supabase
          .from('chat_messages')
          .select('id, role, content, created_at, session_id')
          .eq('session_id', latestSession.id)
          .order('created_at', { ascending: true });

        if (dbMessages && dbMessages.length > 0) {
          const mapped: MeditMessage[] = dbMessages.map(m => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            timestamp: new Date(m.created_at).getTime(),
            session_id: m.session_id,
          }));

          set({ messages: mapped, currentSessionId: latestSession.id });

          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
            session_id: latestSession.id,
            messages: mapped,
          }));
        }
      }
    } catch {
      // Silent fail — chat still works without history
    }
  },

  // Load a specific past session by ID (from history modal)
  loadSession: async (sessionId: string) => {
    try {
      const { data: dbMessages } = await supabase
        .from('chat_messages')
        .select('id, role, content, created_at, session_id')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      const mapped: MeditMessage[] = (dbMessages || []).map(m => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: new Date(m.created_at).getTime(),
        session_id: m.session_id,
      }));

      set({ messages: mapped, currentSessionId: sessionId });
    } catch {
      // Silent fail
    }
  },

  // Fetch list of past sessions for the history modal
  fetchSessions: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data } = await supabase
        .from('chat_sessions')
        .select('id, title, started_at, last_message_at')
        .eq('user_id', session.user.id)
        .order('last_message_at', { ascending: false })
        .limit(20);

      set({ sessions: (data || []) as ChatSession[] });
    } catch {
      // Silent fail
    }
  },

  // Start a fresh session — clear state and local cache
  startNewSession: () => {
    set({ messages: [], currentSessionId: null });
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  },

  // Send a message: create session if needed, persist user message, call Edge Function
  sendMessage: async (content: string) => {
    // Guard: prevent concurrent sends — two rapid taps would create duplicate sessions
    if (get().loading) return;

    const isNewSession = !get().currentSessionId;

    const userMessage: MeditMessage = {
      id: uuid(),
      role: 'user',
      content,
      timestamp: Date.now(),
      session_id: get().currentSessionId || undefined,
    };

    // Optimistic update — show user message immediately, block further sends
    set(state => ({ messages: [...state.messages, userMessage], loading: true }));

    // Snapshot history synchronously before any await — prevents stale/duplicate history
    const historySnapshot = get().messages.map(m => ({ role: m.role, content: m.content }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      // Create Supabase session on first message of a new thread
      let sessionId = get().currentSessionId;
      if (!sessionId && userId) {
        const { data: newSession } = await supabase
          .from('chat_sessions')
          .insert({ user_id: userId, title: content.slice(0, 40) })
          .select('id')
          .single();

        sessionId = newSession?.id || null;
        set({ currentSessionId: sessionId });
      }

      // Save user message to Supabase (fire and forget — don't block UI)
      if (sessionId && userId) {
        supabase.from('chat_messages').insert({
          session_id: sessionId,
          user_id: userId,
          role: 'user',
          content,
        }).then(() => {}, (err) => console.warn('Failed to save user message:', err));
      }

      // Call Edge Function (uses historySnapshot taken synchronously before all awaits)
      const { data, error } = await supabase.functions.invoke('medit-chat', {
        body: {
          messages: historySnapshot,
          session_id: sessionId,
          is_new_session: isNewSession,
        },
      });

      if (error) throw error;

      const assistantMessage: MeditMessage = {
        id: uuid(),
        role: 'assistant',
        content: data?.response || 'מצטער, לא הצלחתי לעבד את הבקשה.',
        timestamp: Date.now(),
        session_id: sessionId || undefined,
      };

      const updatedMessages = [...get().messages, assistantMessage];
      set({ messages: updatedMessages, loading: false });

      // Persist full session to AsyncStorage for instant next-load
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
        session_id: sessionId,
        messages: updatedMessages,
      }));
    } catch {
      const errorMessage: MeditMessage = {
        id: uuid(),
        role: 'assistant',
        content: 'מצטער, אירעה שגיאה. נסה שוב מאוחר יותר.',
        timestamp: Date.now(),
      };
      set(state => ({ messages: [...state.messages, errorMessage], loading: false }));
      // Persist error state so it survives app restart
      const sessionId = get().currentSessionId;
      const updatedMessages = get().messages;
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
        session_id: sessionId,
        messages: updatedMessages,
      })).catch(() => {});
    }
  },
}));
