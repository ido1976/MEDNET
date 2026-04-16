import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { UserCircle } from '../types/database';

interface CircleState {
  myCircles: UserCircle[];
  loading: boolean;

  /** Fetch all circles the current user belongs to */
  fetchMyCircles: () => Promise<void>;

  /** Get members of a specific circle (with user details) */
  fetchCircleMembers: (circleId: string) => Promise<any[]>;

  /** Get circle members who also interacted with a target (bridge, discussion, etc.) */
  getCircleActivityForTarget: (targetType: string, targetId: string) => Promise<{ circle_name: string; count: number }[]>;
}

export const useCircleStore = create<CircleState>((set) => ({
  myCircles: [],
  loading: false,

  fetchMyCircles: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    set({ loading: true });
    try {
      const { data } = await supabase
        .from('user_circle_members')
        .select('circle_id, user_circles(id, name, circle_type, auto_generated, created_at)')
        .eq('user_id', session.user.id);

      if (data) {
        const circles = data
          .map((m: any) => m.user_circles)
          .filter(Boolean) as UserCircle[];
        set({ myCircles: circles });
      }
    } catch (e) {}
    set({ loading: false });
  },

  fetchCircleMembers: async (circleId) => {
    try {
      const { data } = await supabase
        .from('user_circle_members')
        .select('user_id, joined_at, users(id, full_name, avatar_url)')
        .eq('circle_id', circleId);

      return data || [];
    } catch (e) {
      return [];
    }
  },

  getCircleActivityForTarget: async (targetType, targetId) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return [];

    try {
      // Get user's circles
      const { data: memberData } = await supabase
        .from('user_circle_members')
        .select('circle_id, user_circles(name)')
        .eq('user_id', session.user.id);

      if (!memberData || memberData.length === 0) return [];

      const results: { circle_name: string; count: number }[] = [];

      for (const m of memberData) {
        const circleName = (m as any).user_circles?.name;
        if (!circleName) continue;

        // Get all members of this circle
        const { data: members } = await supabase
          .from('user_circle_members')
          .select('user_id')
          .eq('circle_id', m.circle_id);

        if (!members) continue;
        const memberIds = members.map((mem: any) => mem.user_id).filter((id: string) => id !== session.user!.id);

        if (memberIds.length === 0) continue;

        // Count how many circle members viewed this target
        const { count } = await supabase
          .from('user_activity')
          .select('*', { count: 'exact', head: true })
          .in('user_id', memberIds)
          .eq('target_type', targetType)
          .eq('target_id', targetId)
          .eq('activity_type', 'view');

        if (count && count > 0) {
          results.push({ circle_name: circleName, count });
        }
      }

      return results;
    } catch (e) {
      return [];
    }
  },
}));
