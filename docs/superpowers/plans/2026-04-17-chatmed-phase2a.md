# CHATMED Phase 2A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform CHATMED from a stateless Q&A bot into a personalized companion that knows the user from Phase 1 data and persists conversations across sessions.

**Architecture:** The Supabase Edge Function builds a rich Hebrew system prompt from 4 parallel context queries + 1 sequential bridges query (user profile, tag subscriptions, recent activity, pending actions, then relevant bridges by tag IDs) before every Claude call. Chat sessions and messages are persisted in Supabase (`chat_sessions` + `chat_messages` tables) and cached in AsyncStorage for instant load on app open. The meditStore manages hybrid persistence with a session-aware send flow.

**Tech Stack:** React Native/Expo 54, Supabase (Postgres + Edge Functions on Deno), Zustand, `@react-native-async-storage/async-storage`, Claude Sonnet 4.6, TypeScript

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/006_chatmed_sessions.sql` | CREATE | `chat_sessions` + `chat_messages` tables with RLS and indexes |
| `src/types/database.ts` | MODIFY | Add `ChatSession` interface; add `session_id?` to `MeditMessage` |
| `supabase/functions/medit-chat/index.ts` | REWRITE | Context builder (5-query system prompt), session persistence, `chat_interactions` logging |
| `src/stores/meditStore.ts` | REWRITE | Session management, hybrid AsyncStorage + Supabase persistence |
| `app/(tabs)/chat.tsx` | MODIFY | Real session history modal, proactive welcome card, `loadLastSession` on mount |
| `src/components/FloatingMedit.tsx` | NO CHANGE | Already says "CHATMED" |

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/006_chatmed_sessions.sql`

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/006_chatmed_sessions.sql` with this exact content:

```sql
-- Phase 2A: CHATMED conversation persistence

-- chat_sessions: one row per conversation thread
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,                -- auto-generated from first user message (40 chars)
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sessions" ON chat_sessions
  FOR ALL USING (user_id = auth.uid());

CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id, last_message_at DESC);

-- chat_messages: one row per message in a session
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own messages" ON chat_messages
  FOR ALL USING (user_id = auth.uid());

CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at ASC);
CREATE INDEX idx_chat_messages_user ON chat_messages(user_id, created_at DESC);
```

- [ ] **Step 2: Apply the migration to Supabase**

In Supabase Studio → SQL Editor, paste and run the full SQL above. Or via CLI:
```bash
supabase db push
```

- [ ] **Step 3: Verify tables + RLS**

In Supabase Studio, confirm:
- `chat_sessions` table exists with columns: `id`, `user_id`, `title`, `started_at`, `last_message_at`
- `chat_messages` table exists with columns: `id`, `session_id`, `user_id`, `role`, `content`, `created_at`
- Authentication → Policies: both tables show "RLS enabled"
- Policy "Users can manage own sessions" appears on `chat_sessions`
- Policy "Users can manage own messages" appears on `chat_messages`

---

### Task 2: TypeScript Types

**Files:**
- Modify: `src/types/database.ts` — `MeditMessage` (line 228) + add `ChatSession` at end

- [ ] **Step 1: Add `session_id` to `MeditMessage`**

In `src/types/database.ts`, replace the `MeditMessage` interface (currently lines 228–233):

```typescript
export interface MeditMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  session_id?: string;
}
```

- [ ] **Step 2: Add `ChatSession` interface at end of file**

Append after the `ChatInteraction` interface (at end of `src/types/database.ts`):

```typescript
export interface ChatSession {
  id: string;
  title: string | null;
  started_at: string;
  last_message_at: string;
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
cd C:\Users\idoro\Desktop\MEDNET
npx tsc --noEmit 2>&1 | grep -v "supabase/functions"
```

Expected: zero errors in app source files. (Edge Function Deno import errors are pre-existing and expected — ignore them.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/006_chatmed_sessions.sql src/types/database.ts
git commit -m "feat: add chat_sessions/chat_messages tables + ChatSession type (Phase 2A)"
```

---

### Task 3: Edge Function Rewrite

**Files:**
- Rewrite: `supabase/functions/medit-chat/index.ts`

This is a full replacement. The new function: builds a Hebrew system prompt from Phase 1 context data, preserves the rate limit, adds session persistence, and logs to `chat_interactions`.

- [ ] **Step 1: Replace the entire Edge Function**

Replace the entire contents of `supabase/functions/medit-chat/index.ts`:

```typescript
// Supabase Edge Function: medit-chat
// Phase 2A: Personalized context + conversation persistence

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const DAILY_LIMIT = 50;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Build rich Hebrew system prompt from Phase 1 context data
function buildSystemPrompt(
  profile: any,
  tagNames: string[],
  activity: any[],
  pendingActions: any[],
  bridges: any[],
  isNewSession: boolean
): string {
  const firstName = profile?.full_name?.split(' ')[0] || 'חבר/ה';

  const tagsList = tagNames.length > 0 ? tagNames.join(', ') : 'לא נבחרו תיוגים';

  const activityList = activity.length > 0
    ? activity.map((a: any) => {
        const days = Math.floor((Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24));
        const timeStr = days === 0 ? 'היום' : days === 1 ? 'אתמול' : `לפני ${days} ימים`;
        const actionMap: Record<string, string> = {
          view: 'צפה ב', create: 'יצר', react: 'הגיב על',
          search: 'חיפש', bookmark: 'שמר', share: 'שיתף',
        };
        return `${actionMap[a.activity_type] || a.activity_type}${a.target_type} ${timeStr}`;
      }).join('\n')
    : 'אין פעילות אחרונה';

  const pendingList = pendingActions.length > 0
    ? pendingActions.map((p: any) => {
        const due = p.due_date
          ? ` (עד ${new Date(p.due_date).toLocaleDateString('he-IL')})`
          : '';
        return `- ${p.title}${due}`;
      }).join('\n')
    : 'אין פעולות ממתינות';

  const bridgesList = bridges.length > 0
    ? bridges.map((b: any) => `- ${b.name}: ${b.description || '—'}`).join('\n')
    : 'אין גשרים רלוונטיים';

  const partnerLine = profile?.partner_user_id
    ? '\nבן/בת זוג: מחובר/ת ל-MEDNET'
    : '';

  const newSessionInstruction = isNewSession
    ? '\n\n=== הוראה לפתיחת שיחה ===\nזוהי שיחה חדשה. פנה למשתמש בשמו הפרטי ואמור לו דבר אחד חשוב שממתין לו (pending action בעדיפות ראשונה, אחרת גשר חדש רלוונטי). אם אין כלום — שאל מה הוא צריך היום.'
    : '';

  return `אתה CHATMED — הצ'אט החכם של MEDNET, הרשת החברתית לסטודנטים לרפואה בצפת.
אתה החבר הקרוב של ${firstName}. אתה מכיר אותו לעומק ומלווה אותו.

=== זהות המשתמש ===
שם: ${profile?.full_name || '—'} | שנה: ${profile?.year_of_study || '—'} | מסלול: ${profile?.academic_track || '—'}
ישוב: ${profile?.settlement || '—'} | עיר מוצא: ${profile?.origin_city || '—'}
מצב משפחתי: ${profile?.marital_status || '—'} | ילדים: ${profile?.has_children ? 'כן' : 'לא'}${partnerLine}

=== תחומי עניין (תיוגים שעוקב אחריהם) ===
${tagsList}

=== פעילות אחרונה ===
${activityList}

=== ממתין לטיפול ===
${pendingList}

=== גשרים רלוונטיים שעודכנו לאחרונה ===
${bridgesList}

=== כללי התנהגות ===
1. פנה תמיד בשמו הפרטי
2. בפתיחת שיחה חדשה — ציין מיד דבר אחד חשוב שממתין לו
3. אם בן/בת הזוג גם ב-MEDNET — ציין דברים משותפים רלוונטיים כשמתאים
4. ענה רק על מידע שקיים ב-MEDNET — אל תמציא
5. שמור על טון חם, ישיר, כמו חבר קרוב — לא פורמלי
6. דבר עברית בלבד
7. אם שואלים רפואה קלינית — הפנה לגשרים הרלוונטיים${newSessionInstruction}`;
}

// Simple tag extraction: find known tag names that appear in the user's question
function extractTopicTags(question: string, knownTagNames: string[]): string[] {
  const questionLower = question.toLowerCase();
  return knownTagNames.filter(tag => questionLower.includes(tag.toLowerCase()));
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Rate limit: 50 messages per day
    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabase
      .from('medit_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', `${today}T00:00:00Z`);

    if ((count || 0) >= DAILY_LIMIT) {
      return new Response(
        JSON.stringify({ error: 'הגעת למגבלת 50 הודעות ליום. נסה שוב מחר.' }),
        { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const { messages, session_id, is_new_session } = await req.json();

    // --- 4 parallel context queries ---
    const [profileRes, tagsRes, activityRes, pendingRes] = await Promise.all([
      supabase.from('users').select('*').eq('id', user.id).single(),
      supabase
        .from('user_tag_subscriptions')
        .select('tag_id, tag:bridge_tags(name)')
        .eq('user_id', user.id),
      supabase
        .from('user_activity')
        .select('activity_type, target_type, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('pending_actions')
        .select('title, due_date')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('due_date', { ascending: true, nullsFirst: false }),
    ]);

    const tagIds = (tagsRes.data || []).map((t: any) => t.tag_id);
    const tagNames = (tagsRes.data || [])
      .map((t: any) => t.tag?.name)
      .filter(Boolean) as string[];

    // --- Relevant bridges by subscribed tag IDs (sequential, depends on tagIds) ---
    let bridges: any[] = [];
    if (tagIds.length > 0) {
      const bridgesRes = await supabase
        .from('bridge_tag_assignments')
        .select('bridge:bridges(id, name, description)')
        .in('tag_id', tagIds)
        .limit(20); // fetch extra for deduplication

      // Deduplicate: same bridge can match multiple subscribed tags
      const seen = new Set<string>();
      bridges = (bridgesRes.data || [])
        .map((b: any) => b.bridge)
        .filter(Boolean)
        .filter((b: any) => {
          if (seen.has(b.id)) return false;
          seen.add(b.id);
          return true;
        })
        .slice(0, 10);
    }

    // --- Build system prompt ---
    const systemPrompt = buildSystemPrompt(
      profileRes.data,
      tagNames,
      activityRes.data || [],
      pendingRes.data || [],
      bridges,
      !!is_new_session
    );

    // --- Call Claude API ---
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: (messages as any[]).slice(-15),
      }),
    });

    const claudeData = await claudeResponse.json();
    const assistantResponse = claudeData.content?.[0]?.text || 'מצטער, לא הצלחתי לעבד את הבקשה.';

    // --- Persist assistant message + update session ---
    if (session_id) {
      const now = new Date().toISOString();
      const updatePayload: Record<string, any> = { last_message_at: now };

      // Set title from first user message when opening new session
      if (is_new_session) {
        const firstUserMsg = (messages as any[]).find((m: any) => m.role === 'user');
        if (firstUserMsg?.content) {
          updatePayload.title = firstUserMsg.content.slice(0, 40);
        }
      }

      await Promise.all([
        supabase.from('chat_messages').insert({
          session_id,
          user_id: user.id,
          role: 'assistant',
          content: assistantResponse,
        }),
        supabase.from('chat_sessions').update(updatePayload).eq('id', session_id),
      ]);
    }

    // --- Log to chat_interactions (fire and forget) ---
    const lastUserMessage = [...(messages as any[])].reverse().find((m: any) => m.role === 'user');
    if (lastUserMessage?.content) {
      supabase.from('chat_interactions').insert({
        user_id: user.id,
        question: lastUserMessage.content,
        topic_tags: extractTopicTags(lastUserMessage.content, tagNames),
        session_id: session_id || null,
      }).then(() => {}).catch(() => {});
    }

    // --- Increment daily usage counter ---
    await supabase.from('medit_usage').insert({
      user_id: user.id,
      created_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ response: assistantResponse, session_id: session_id || null }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('medit-chat error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
```

- [ ] **Step 2: Deploy the Edge Function**

```bash
supabase functions deploy medit-chat
```

Expected output: `Deployed Function medit-chat` (or similar success message)

- [ ] **Step 3: Smoke test via Supabase logs**

1. Open the app and send one test message in CHATMED
2. Supabase Dashboard → Edge Functions → medit-chat → Logs
3. Confirm: HTTP 200, no error in log output
4. At this stage, `session_id` will be `null` (meditStore not yet updated) — that's fine, the function still returns a response

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/medit-chat/index.ts
git commit -m "feat: CHATMED Phase 2A - context builder + session persistence in Edge Function"
```

---

### Task 4: meditStore Rewrite

**Files:**
- Rewrite: `src/stores/meditStore.ts`

- [ ] **Step 1: Install AsyncStorage if not already present**

```bash
npx expo install @react-native-async-storage/async-storage
```

Expected: package added to `package.json` dependencies (or "already installed"). Verify `@react-native-async-storage/async-storage` appears in `package.json`.

- [ ] **Step 2: Replace the entire meditStore**

Replace the entire contents of `src/stores/meditStore.ts`:

```typescript
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import type { MeditMessage, ChatSession } from '../types/database';
import { v4 as uuid } from 'uuid';

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
    const isNewSession = !get().currentSessionId;

    const userMessage: MeditMessage = {
      id: uuid(),
      role: 'user',
      content,
      timestamp: Date.now(),
      session_id: get().currentSessionId || undefined,
    };

    // Optimistic update — show user message immediately
    set(state => ({ messages: [...state.messages, userMessage], loading: true }));

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
        }).then(() => {}).catch(() => {});
      }

      // Build full message history for the API (includes the optimistic user message)
      const history = get().messages.map(m => ({ role: m.role, content: m.content }));

      // Call Edge Function
      const { data, error } = await supabase.functions.invoke('medit-chat', {
        body: {
          messages: history,
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
    }
  },
}));
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "supabase/functions"
```

Expected: zero errors in app source files.

- [ ] **Step 4: Commit**

```bash
git add src/stores/meditStore.ts package.json
git commit -m "feat: CHATMED Phase 2A - session management + hybrid persistence in meditStore"
```

---

### Task 5: Update chat.tsx

**Files:**
- Rewrite: `app/(tabs)/chat.tsx`

Changes: load session on mount, fetch pending actions for proactive welcome, real history modal using Supabase sessions, `startNewSession` replaces `clearChat`.

- [ ] **Step 1: Replace the entire chat.tsx**

Replace the entire contents of `app/(tabs)/chat.tsx`:

```typescript
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../src/constants/theme';
import { useMeditStore } from '../../src/stores/meditStore';
import { useAuthStore } from '../../src/stores/authStore';
import { useNotificationStore } from '../../src/stores/notificationStore';
import type { MeditMessage } from '../../src/types/database';

export default function ChatScreen() {
  const router = useRouter();
  const {
    messages,
    loading,
    sessions,
    sendMessage,
    startNewSession,
    loadLastSession,
    loadSession,
    fetchSessions,
  } = useMeditStore();
  const { user } = useAuthStore();
  const { pendingActions, fetchPendingActions } = useNotificationStore();
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const firstName = user?.full_name?.split(' ')[0] || '';

  // Load last session + pending actions on mount
  useEffect(() => {
    loadLastSession();
    fetchPendingActions();
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleOpenHistory = () => {
    fetchSessions();
    setShowHistory(true);
  };

  const handleSelectSession = (sessionId: string) => {
    loadSession(sessionId);
    setShowHistory(false);
  };

  const handleNewSession = () => {
    startNewSession();
    setShowHistory(false);
  };

  const renderMessage = ({ item }: { item: MeditMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        {!isUser && (
          <View style={styles.meditAvatar}>
            <Text style={styles.flowerIcon}>🌸</Text>
          </View>
        )}
        <View style={[styles.messageContent, isUser ? styles.userContent : styles.assistantContent]}>
          <Text style={[styles.messageText, isUser && styles.userText]}>{item.content}</Text>
        </View>
      </View>
    );
  };

  // Proactive greeting: mention first pending action if available
  const getGreetingText = () => {
    if (pendingActions.length > 0) {
      const next = pendingActions[0];
      const dueStr = next.due_date
        ? ` עד ${new Date(next.due_date).toLocaleDateString('he-IL')}`
        : '';
      return `אהלן${firstName ? ` ${firstName}` : ''}! יש לך "${next.title}"${dueStr}. רוצה שנעשה את זה יחד?`;
    }
    return `אהלן${firstName ? ` ${firstName}` : ''}, מה מתחשק לך לעשות היום ביחד?`;
  };

  const renderWelcome = () => (
    <View style={styles.welcomeContainer}>
      <View style={styles.welcomeLogo}>
        <Text style={styles.welcomeFlower}>🌸</Text>
      </View>
      <Text style={styles.welcomeTitle}>CHATMED</Text>
      <View style={styles.greetingCard}>
        <Text style={styles.greetingText}>{getGreetingText()}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={24} color={COLORS.primaryDark} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.headerFlower}>🌸</Text>
          <Text style={styles.headerText}>CHATMED</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleOpenHistory}>
            <Ionicons name="time-outline" size={22} color={COLORS.gray} />
          </TouchableOpacity>
          <TouchableOpacity onPress={startNewSession}>
            <Ionicons name="add-outline" size={24} color={COLORS.gray} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={0}
      >
        {/* Messages or Welcome screen */}
        {messages.length === 0 ? (
          renderWelcome()
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          />
        )}

        {/* Loading indicator */}
        {loading && (
          <View style={styles.typingIndicator}>
            <View style={styles.meditAvatarSmall}>
              <Text style={{ fontSize: 10 }}>🌸</Text>
            </View>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.typingText}>CHATMED מקליד...</Text>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="send" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="שאל את CHATMED..."
            placeholderTextColor={COLORS.grayLight}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            textAlign="right"
            onSubmitEditing={handleSend}
          />
        </View>
      </KeyboardAvoidingView>

      {/* History Modal */}
      <Modal visible={showHistory} animationType="slide" transparent>
        <View style={styles.historyOverlay}>
          <View style={styles.historyModal}>
            <View style={styles.historyHeader}>
              <TouchableOpacity onPress={() => setShowHistory(false)}>
                <Ionicons name="close" size={24} color={COLORS.gray} />
              </TouchableOpacity>
              <Text style={styles.historyTitle}>היסטוריית שיחות</Text>
              <TouchableOpacity onPress={handleNewSession} style={styles.newSessionBtn}>
                <Ionicons name="add" size={20} color={COLORS.primary} />
                <Text style={styles.newSessionText}>שיחה חדשה</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.historyList}>
              {sessions.length === 0 ? (
                <View style={styles.historyEmpty}>
                  <Ionicons name="chatbubbles-outline" size={40} color={COLORS.grayLight} />
                  <Text style={styles.historyEmptyText}>אין שיחות קודמות</Text>
                </View>
              ) : (
                sessions.map((session) => (
                  <TouchableOpacity
                    key={session.id}
                    style={styles.historyItem}
                    onPress={() => handleSelectSession(session.id)}
                  >
                    <View style={styles.historyItemIcon}>
                      <Ionicons name="chatbubble-outline" size={18} color={COLORS.primary} />
                    </View>
                    <View style={styles.historyItemInfo}>
                      <Text style={styles.historyItemText} numberOfLines={1}>
                        {session.title || 'שיחה ללא כותרת'}
                      </Text>
                      <Text style={styles.historyItemMeta}>
                        {new Date(session.last_message_at).toLocaleDateString('he-IL')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.grayLight,
  },
  headerTitle: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  headerFlower: {
    fontSize: 20,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primaryDark,
    letterSpacing: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  messagesList: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  messageBubble: {
    flexDirection: 'row-reverse',
    marginBottom: SPACING.md,
    alignItems: 'flex-end',
  },
  userBubble: {
    justifyContent: 'flex-start',
  },
  assistantBubble: {
    justifyContent: 'flex-end',
  },
  meditAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
  },
  flowerIcon: {
    fontSize: 16,
  },
  messageContent: {
    maxWidth: '80%',
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
  },
  userContent: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  assistantContent: {
    backgroundColor: COLORS.cardBg,
    borderBottomLeftRadius: 4,
    ...SHADOWS.card,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.primaryDark,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  userText: {
    color: COLORS.white,
  },
  typingIndicator: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  meditAvatarSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typingText: {
    fontSize: 13,
    color: COLORS.gray,
  },
  inputContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.grayLight,
    backgroundColor: COLORS.cream,
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.black,
    maxHeight: 100,
    textAlign: 'right',
    writingDirection: 'rtl',
    borderWidth: 1,
    borderColor: COLORS.grayLight,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.button,
  },
  sendBtnDisabled: {
    backgroundColor: COLORS.grayLight,
  },
  welcomeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  welcomeLogo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  welcomeFlower: {
    fontSize: 40,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.primaryDark,
    letterSpacing: 2,
    marginBottom: SPACING.lg,
  },
  greetingCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    alignSelf: 'stretch',
    ...SHADOWS.card,
  },
  greetingText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primaryDark,
    textAlign: 'center',
    lineHeight: 28,
  },
  // History modal
  historyOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  historyModal: {
    backgroundColor: COLORS.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  historyHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.grayLight,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  newSessionBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  newSessionText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  historyList: {
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  historyEmpty: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    gap: SPACING.sm,
  },
  historyEmptyText: {
    fontSize: 15,
    color: COLORS.gray,
  },
  historyItem: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: SPACING.sm,
    ...SHADOWS.card,
  },
  historyItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyItemInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  historyItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primaryDark,
    marginBottom: 2,
  },
  historyItemMeta: {
    fontSize: 12,
    color: COLORS.gray,
  },
});
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "supabase/functions"
```

Expected: zero errors in app source files.

- [ ] **Step 3: Commit**

```bash
git add app/(tabs)/chat.tsx
git commit -m "feat: CHATMED Phase 2A - real session history + proactive welcome in chat.tsx"
```

---

### Task 6: End-to-End Verification

No code changes — manual testing checklist per the spec's Verification Plan.

- [ ] **Step 1: New session flow**

1. Open CHATMED (welcome screen visible — no messages)
2. If there's a pending action in the DB, welcome card shows it by name + due date
3. Type "שלום" and send
4. CHATMED responds — mentions user's name, mentions one pending action (if `is_new_session=true` worked)
5. In Supabase → Table Editor → `chat_sessions`: confirm new row with `title` = first 40 chars of your message
6. In `chat_messages`: confirm 2 rows — `role='user'` and `role='assistant'`

- [ ] **Step 2: Persistence**

1. Send 2–3 more messages
2. Force-close the app (swipe away on device/simulator)
3. Reopen → messages load instantly (AsyncStorage)
4. Wait a few seconds → Supabase sync runs silently in background

- [ ] **Step 3: History modal**

1. Tap `+` (new session) → welcome screen reappears
2. Send a message in the new session
3. Tap the clock icon → history modal opens
4. Both sessions appear with title + date
5. Tap the first session → its messages load correctly

- [ ] **Step 4: Personalization in logs**

1. Supabase Dashboard → Edge Functions → medit-chat → Logs
2. Find recent invocation → check log output for system prompt content
3. Confirm: user's name, `year_of_study`, subscribed tag names, pending action titles all appear

- [ ] **Step 5: chat_interactions**

After sending any message:
- Supabase → Table Editor → `chat_interactions`
- Confirm: new row with `question` = your message, `session_id` set, `topic_tags` = array of matched tag names (empty array is fine if no tags match)

- [ ] **Step 6: Rate limit unchanged**

Send 51 messages in one day → 51st gets "הגעת למגבלת 50 הודעות" error response.

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "feat: CHATMED Phase 2A complete - personalized context + conversation persistence"
```
