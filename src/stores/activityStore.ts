import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface ContentStats {
  view_count: number;
  react_count: number;
  unique_viewers: number;
}

interface ActivityState {
  myContentStats: Record<string, ContentStats>;
  loading: boolean;

  /** Get view/reaction stats for a piece of content the current user created */
  fetchContentStats: (targetType: string, targetId: string) => Promise<ContentStats | null>;

  /** Get how many times the current user viewed a specific item */
  fetchMyViewCount: (targetType: string, targetId: string) => Promise<number>;
}

export const useActivityStore = create<ActivityState>((set, get) => ({
  myContentStats: {},
  loading: false,

  fetchContentStats: async (targetType, targetId) => {
    try {
      set({ loading: true });

      // Count total views
      const { count: viewCount } = await supabase
        .from('user_activity')
        .select('*', { count: 'exact', head: true })
        .eq('target_type', targetType)
        .eq('target_id', targetId)
        .eq('activity_type', 'view');

      // Count reactions
      const { count: reactCount } = await supabase
        .from('user_activity')
        .select('*', { count: 'exact', head: true })
        .eq('target_type', targetType)
        .eq('target_id', targetId)
        .eq('activity_type', 'react');

      const stats: ContentStats = {
        view_count: viewCount || 0,
        react_count: reactCount || 0,
        unique_viewers: 0, // Would need a distinct query
      };

      set((state) => ({
        myContentStats: { ...state.myContentStats, [`${targetType}:${targetId}`]: stats },
        loading: false,
      }));

      return stats;
    } catch (e) {
      set({ loading: false });
      return null;
    }
  },

  fetchMyViewCount: async (targetType, targetId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return 0;

      const { count } = await supabase
        .from('user_activity')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('target_type', targetType)
        .eq('target_id', targetId)
        .eq('activity_type', 'view');

      return count || 0;
    } catch (e) {
      return 0;
    }
  },
}));
