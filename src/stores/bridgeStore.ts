import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Bridge, BridgeTag, BridgeTip, BridgeAddition, BridgeFile } from '../types/database';

interface BridgeState {
  bridges: Bridge[];
  currentBridge: Bridge | null;
  allTags: BridgeTag[];
  tips: BridgeTip[];
  additions: BridgeAddition[];
  pendingAdditions: BridgeAddition[];
  files: BridgeFile[];
  loading: boolean;
  fetchBridges: () => Promise<void>;
  fetchBridge: (id: string) => Promise<void>;
  fetchSubBridges: (parentId: string) => Promise<Bridge[]>;
  createBridge: (bridge: Partial<Bridge>, tagIds: string[], imageUris: string[]) => Promise<{ error: string | null }>;
  updateBridge: (id: string, updates: Partial<Bridge>, tagIds: string[], imageUris: string[]) => Promise<{ error: string | null }>;
  deleteBridge: (id: string) => Promise<{ error: string | null }>;
  rateBridge: (bridgeId: string, userId: string, rating: number) => Promise<void>;
  fetchAllTags: () => Promise<void>;
  createTag: (name: string) => Promise<BridgeTag | null>;
  fetchTips: (bridgeId: string) => Promise<void>;
  addTip: (bridgeId: string, userId: string, content: string) => Promise<{ error: string | null }>;
  toggleTipLike: (tipId: string, userId: string) => Promise<void>;
  fetchAdditions: (bridgeId: string) => Promise<void>;
  fetchPendingAdditions: (bridgeId: string) => Promise<void>;
  suggestAddition: (bridgeId: string, userId: string, content: string, link: string) => Promise<{ error: string | null }>;
  reviewAddition: (additionId: string, approved: boolean) => Promise<void>;
  fetchFiles: (bridgeId: string) => Promise<void>;
  addFile: (bridgeId: string, userId: string, file: { name: string; uri: string; type: string; size: number }) => Promise<{ error: string | null }>;
  removeFile: (fileId: string, bridgeId: string) => Promise<{ error: string | null }>;
  generateBridgeContent: (prompt: string) => Promise<{ content: string | null; error: string | null }>;
}

const mapBridgeRow = (bridgeRow: any): Bridge => ({
  ...bridgeRow,
  tags: bridgeRow.bridge_tag_assignments?.map((assignment: any) => assignment.tag).filter(Boolean) || [],
  images: ((bridgeRow.images || []) as any[])
    .slice()
    .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0)),
});

const normalizeIds = (ids: string[]) =>
  Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));

const normalizeImageUris = (imageUris: string[]) =>
  Array.from(new Set(imageUris.map((uri) => uri.trim()).filter(Boolean)));

const ensureUserRow = async (userId: string): Promise<string | null> => {
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (!data) {
    const { data: authData } = await supabase.auth.getUser();
    const email = authData.user?.email || '';
    const { error } = await supabase.from('users').upsert({
      id: userId,
      email,
      full_name: email.split('@')[0] || '',
    }, { onConflict: 'id' });
    if (error) return error.message;
  }
  return null;
};

export const useBridgeStore = create<BridgeState>((set, get) => ({
  bridges: [],
  currentBridge: null,
  allTags: [],
  tips: [],
  additions: [],
  pendingAdditions: [],
  files: [],
  loading: false,

  fetchBridges: async () => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('bridges')
        .select('*, creator:users(full_name, avatar_url), bridge_tag_assignments(tag:bridge_tags(*)), images:bridge_images(*)')
        .is('parent_id', null)
        .eq('status', 'active')
        .order('rating_avg', { ascending: false });

      if (error) {
        const { data: fallbackData } = await supabase
          .from('bridges')
          .select('*, bridge_tag_assignments(tag:bridge_tags(*)), images:bridge_images(*)')
          .is('parent_id', null)
          .eq('status', 'active')
          .order('rating_avg', { ascending: false });

        const bridges = (fallbackData || []).map((b: any) => mapBridgeRow(b));
        set({ bridges: bridges as Bridge[], loading: false });
        return;
      }

      const bridges = (data || []).map((b: any) => mapBridgeRow(b));
      set({ bridges: bridges as Bridge[], loading: false });
      return;
    } catch (e) {}
    set({ loading: false });
  },

  fetchBridge: async (id) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('bridges')
        .select('*, creator:users(full_name, avatar_url), bridge_tag_assignments(tag:bridge_tags(*)), images:bridge_images(*)')
        .eq('id', id)
        .single();

      if (!error && data) {
        set({ currentBridge: mapBridgeRow(data) as Bridge, loading: false });
        return;
      }

      const { data: fallbackData } = await supabase
        .from('bridges')
        .select('*, bridge_tag_assignments(tag:bridge_tags(*)), images:bridge_images(*)')
        .eq('id', id)
        .single();

      if (fallbackData) {
        set({ currentBridge: mapBridgeRow(fallbackData) as Bridge, loading: false });
        return;
      }
    } catch (e) {}
    // Fallback to local
    const local = get().bridges.find(b => b.id === id);
    if (local) { set({ currentBridge: local, loading: false }); return; }
    set({ loading: false });
  },

  fetchSubBridges: async (parentId) => {
    try {
      const { data } = await supabase
        .from('bridges')
        .select('*, bridge_tag_assignments(tag:bridge_tags(*))')
        .eq('parent_id', parentId)
        .eq('status', 'active');
      return ((data || []) as any[]).map(b => ({
        ...b,
        tags: b.bridge_tag_assignments?.map((a: any) => a.tag).filter(Boolean) || [],
      })) as Bridge[];
    } catch (e) {
      return [];
    }
  },

  createBridge: async (bridge, tagIds, imageUris) => {
    try {
      if (!bridge.created_by) {
        return { error: 'לא נמצא משתמש מחובר ליצירת גשר' };
      }

      const userRowError = await ensureUserRow(bridge.created_by);
      if (userRowError) {
        return { error: 'שגיאה ביצירת פרופיל משתמש: ' + userRowError };
      }

      // Insert bridge
      const { data, error } = await supabase
        .from('bridges')
        .insert({
          name: bridge.name || '',
          description: bridge.description || '',
          parent_id: bridge.parent_id || null,
          created_by: bridge.created_by,
          status: 'active',
        })
        .select()
        .single();

      if (error || !data) {
        return { error: error?.message || 'שגיאה ביצירת הגשר' };
      }

      const bridgeId = data.id;
      const uniqueTagIds = normalizeIds(tagIds);
      const coverImageUri = normalizeImageUris(imageUris)[0];

      // Insert tag assignments
      if (uniqueTagIds.length > 0) {
        const { error: tagInsertError } = await supabase.from('bridge_tag_assignments').insert(
          uniqueTagIds.map((tagId) => ({ bridge_id: bridgeId, tag_id: tagId })),
        );

        if (tagInsertError) {
          await supabase.from('bridges').delete().eq('id', bridgeId);
          return { error: 'שגיאה בשמירת התגיות' };
        }
      }

      // Save only the selected cover image
      if (coverImageUri) {
        const { error: imageInsertError } = await supabase.from('bridge_images').insert({
          bridge_id: bridgeId,
          image_uri: coverImageUri,
          display_order: 0,
        });

        if (imageInsertError) {
          await supabase.from('bridges').delete().eq('id', bridgeId);
          return { error: 'שגיאה בשמירת תמונת הגשר' };
        }
      }

      // Refresh list
      await get().fetchBridges();
      return { error: null };
    } catch (e) {
      return { error: 'שגיאה ביצירת הגשר' };
    }
  },

  updateBridge: async (id, updates, tagIds, imageUris) => {
    try {
      // Update bridge fields
      const { error: updateBridgeError } = await supabase.from('bridges').update({
        name: updates.name,
        description: updates.description,
        updated_at: new Date().toISOString(),
      }).eq('id', id);

      if (updateBridgeError) {
        return { error: 'שגיאה בעדכון פרטי הגשר' };
      }

      const uniqueTagIds = normalizeIds(tagIds);
      const coverImageUri = normalizeImageUris(imageUris)[0];

      // Sync tags: delete old, insert new
      const { error: clearTagsError } = await supabase
        .from('bridge_tag_assignments')
        .delete()
        .eq('bridge_id', id);

      if (clearTagsError) {
        return { error: 'שגיאה בעדכון התגיות' };
      }

      if (uniqueTagIds.length > 0) {
        const { error: insertTagsError } = await supabase.from('bridge_tag_assignments').insert(
          uniqueTagIds.map((tagId) => ({ bridge_id: id, tag_id: tagId })),
        );

        if (insertTagsError) {
          return { error: 'שגיאה בעדכון התגיות' };
        }
      }

      // Sync images: delete old, insert new
      const { error: clearImagesError } = await supabase
        .from('bridge_images')
        .delete()
        .eq('bridge_id', id);

      if (clearImagesError) {
        return { error: 'שגיאה בעדכון תמונת הגשר' };
      }

      if (coverImageUri) {
        const { error: insertImageError } = await supabase.from('bridge_images').insert({
          bridge_id: id,
          image_uri: coverImageUri,
          display_order: 0,
        });

        if (insertImageError) {
          return { error: 'שגיאה בעדכון תמונת הגשר' };
        }
      }

      // Refresh
      await get().fetchBridge(id);
      await get().fetchBridges();
      return { error: null };
    } catch (e) {
      return { error: 'שגיאה בעדכון הגשר' };
    }
  },

  rateBridge: async (bridgeId, userId, rating) => {
    try {
      await supabase.from('bridge_ratings').upsert({
        bridge_id: bridgeId,
        user_id: userId,
        rating,
      });
    } catch (e) {}
  },

  fetchAllTags: async () => {
    try {
      const { data } = await supabase
        .from('bridge_tags')
        .select('*')
        .order('name');
      if (data) set({ allTags: data as BridgeTag[] });
    } catch (e) {}
  },

  createTag: async (name) => {
    try {
      const normalizedName = name.trim();
      if (!normalizedName) return null;

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) {
        throw new Error('AUTH_REQUIRED');
      }

      const existingTag = get().allTags.find(
        (tag) => tag.name.trim().toLowerCase() === normalizedName.toLowerCase(),
      );
      if (existingTag) {
        return existingTag;
      }

      const { data: existingRemote } = await supabase
        .from('bridge_tags')
        .select('*')
        .ilike('name', normalizedName)
        .limit(1)
        .maybeSingle();

      if (existingRemote) {
        set((state) => ({
          allTags: [...state.allTags, existingRemote as BridgeTag]
            .filter((tag, index, arr) => arr.findIndex((candidate) => candidate.id === tag.id) === index)
            .sort((a, b) => a.name.localeCompare(b.name)),
        }));
        return existingRemote as BridgeTag;
      }

      const { data, error } = await supabase
        .from('bridge_tags')
        .insert({ name: normalizedName, created_by: null })
        .select()
        .single();

      if (error) {
        throw new Error(error.message || 'CREATE_TAG_FAILED');
      }

      if (data) {
        set((state) => ({
          allTags: [...state.allTags, data as BridgeTag].sort((a, b) => a.name.localeCompare(b.name)),
        }));
        return data as BridgeTag;
      }
    } catch (e) {
      throw e;
    }
    return null;
  },

  // Tips
  fetchTips: async (bridgeId) => {
    try {
      const { data } = await supabase
        .from('bridge_tips')
        .select('*, user:users(full_name, avatar_url)')
        .eq('bridge_id', bridgeId)
        .order('likes_count', { ascending: false });
      set({ tips: (data || []) as BridgeTip[] });
    } catch (e) {}
  },

  addTip: async (bridgeId, userId, content) => {
    try {
      const { error } = await supabase.from('bridge_tips').insert({
        bridge_id: bridgeId,
        user_id: userId,
        content,
      });
      if (error) return { error: 'שגיאה בהוספת טיפ' };
      await get().fetchTips(bridgeId);
      return { error: null };
    } catch (e) {
      return { error: 'שגיאה בהוספת טיפ' };
    }
  },

  toggleTipLike: async (tipId, userId) => {
    try {
      // Check if already liked
      const { data: existing } = await supabase
        .from('bridge_tip_likes')
        .select('*')
        .eq('tip_id', tipId)
        .eq('user_id', userId)
        .single();

      if (existing) {
        await supabase.from('bridge_tip_likes').delete()
          .eq('tip_id', tipId).eq('user_id', userId);
      } else {
        await supabase.from('bridge_tip_likes').insert({ tip_id: tipId, user_id: userId });
      }

      // Update local tips state
      set((state) => ({
        tips: state.tips.map(t => t.id === tipId ? {
          ...t,
          likes_count: existing ? t.likes_count - 1 : t.likes_count + 1,
          liked_by_me: !existing,
        } : t),
      }));
    } catch (e) {}
  },

  // Additions
  fetchAdditions: async (bridgeId) => {
    try {
      const { data } = await supabase
        .from('bridge_additions')
        .select('*, suggestor:users!suggested_by(full_name, avatar_url)')
        .eq('bridge_id', bridgeId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
      set({ additions: (data || []) as BridgeAddition[] });
    } catch (e) {}
  },

  fetchPendingAdditions: async (bridgeId) => {
    try {
      const { data } = await supabase
        .from('bridge_additions')
        .select('*, suggestor:users!suggested_by(full_name, avatar_url)')
        .eq('bridge_id', bridgeId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      set({ pendingAdditions: (data || []) as BridgeAddition[] });
    } catch (e) {}
  },

  suggestAddition: async (bridgeId, userId, content, link) => {
    try {
      const { data, error } = await supabase.from('bridge_additions').insert({
        bridge_id: bridgeId,
        suggested_by: userId,
        content,
        link,
      }).select().single();

      if (error) return { error: 'שגיאה בהוספת תוספת' };

      // Create notification for bridge creator
      const bridge = get().currentBridge;
      if (bridge && bridge.created_by !== userId) {
        await supabase.from('notifications').insert({
          user_id: bridge.created_by,
          type: 'addition_pending',
          reference_id: data.id,
          bridge_id: bridgeId,
        });
      }

      return { error: null };
    } catch (e) {
      return { error: 'שגיאה בהוספת תוספת' };
    }
  },

  reviewAddition: async (additionId, approved) => {
    try {
      const { data } = await supabase.from('bridge_additions')
        .update({
          status: approved ? 'approved' : 'rejected',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', additionId)
        .select('*, suggestor:users!suggested_by(full_name)')
        .single();

      if (data) {
        // Notify the suggestor
        await supabase.from('notifications').insert({
          user_id: data.suggested_by,
          type: approved ? 'addition_approved' : 'addition_rejected',
          reference_id: additionId,
          bridge_id: data.bridge_id,
        });

        // Refresh lists
        await get().fetchAdditions(data.bridge_id);
        await get().fetchPendingAdditions(data.bridge_id);
      }
    } catch (e) {}
  },

  // Delete bridge
  deleteBridge: async (id) => {
    try {
      const { error } = await supabase.from('bridges').delete().eq('id', id);
      if (error) return { error: 'שגיאה במחיקת הגשר' };
      await get().fetchBridges();
      return { error: null };
    } catch (e) {
      return { error: 'שגיאה במחיקת הגשר' };
    }
  },

  // Files
  fetchFiles: async (bridgeId) => {
    try {
      const { data } = await supabase
        .from('bridge_files')
        .select('*, uploader:users!uploaded_by(full_name)')
        .eq('bridge_id', bridgeId)
        .order('created_at', { ascending: false });
      set({ files: (data || []) as BridgeFile[] });
    } catch (e) {
      set({ files: [] });
    }
  },

  addFile: async (bridgeId, userId, file) => {
    try {
      const { error } = await supabase.from('bridge_files').insert({
        bridge_id: bridgeId,
        file_name: file.name,
        file_uri: file.uri,
        file_type: file.type,
        file_size: file.size,
        uploaded_by: userId,
      });
      if (error) return { error: 'שגיאה בהעלאת הקובץ' };
      await get().fetchFiles(bridgeId);
      return { error: null };
    } catch (e) {
      return { error: 'שגיאה בהעלאת הקובץ' };
    }
  },

  removeFile: async (fileId, bridgeId) => {
    try {
      const { error } = await supabase.from('bridge_files').delete().eq('id', fileId);
      if (error) return { error: 'שגיאה במחיקת הקובץ' };
      await get().fetchFiles(bridgeId);
      return { error: null };
    } catch (e) {
      return { error: 'שגיאה במחיקת הקובץ' };
    }
  },

  // AI content generation
  generateBridgeContent: async (prompt) => {
    try {
      const { data, error } = await supabase.functions.invoke('medit-chat', {
        body: {
          messages: [
            {
              role: 'system',
              content: 'אתה עוזר כתיבה למערכת MEDNET. תפקידך לעזור לסטודנטים לרפואה לכתוב תוכן לגשרים (נושאים/קהילות). כתוב בעברית, בצורה ברורה, תמציתית ומקצועית. אל תוסיף כותרות או פורמט מיוחד, רק את התוכן עצמו.',
            },
            { role: 'user', content: prompt },
          ],
        },
      });
      if (error) return { content: null, error: 'שגיאה ביצירת תוכן AI' };
      return { content: data?.response || null, error: null };
    } catch (e) {
      return { content: null, error: 'שגיאה ביצירת תוכן AI' };
    }
  },
}));
