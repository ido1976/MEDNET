import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { MeditMessage } from '../types/database';
import { v4 as uuid } from 'uuid';

interface MeditState {
  messages: MeditMessage[];
  loading: boolean;
  sendMessage: (content: string) => Promise<void>;
  clearChat: () => void;
}

export const useMeditStore = create<MeditState>((set, get) => ({
  messages: [],
  loading: false,

  sendMessage: async (content) => {
    const userMessage: MeditMessage = {
      id: uuid(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
      loading: true,
    }));

    try {
      const history = get().messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const { data, error } = await supabase.functions.invoke('medit-chat', {
        body: {
          messages: [...history, { role: 'user', content }],
        },
      });

      if (error) throw error;

      const assistantMessage: MeditMessage = {
        id: uuid(),
        role: 'assistant',
        content: data?.response || 'מצטער, לא הצלחתי לעבד את הבקשה.',
        timestamp: Date.now(),
      };

      set((state) => ({
        messages: [...state.messages, assistantMessage],
        loading: false,
      }));
    } catch {
      const errorMessage: MeditMessage = {
        id: uuid(),
        role: 'assistant',
        content: 'מצטער, אירעה שגיאה. נסה שוב מאוחר יותר.',
        timestamp: Date.now(),
      };

      set((state) => ({
        messages: [...state.messages, errorMessage],
        loading: false,
      }));
    }
  },

  clearChat: () => set({ messages: [] }),
}));
