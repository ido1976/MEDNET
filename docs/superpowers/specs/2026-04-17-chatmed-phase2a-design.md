# CHATMED Phase 2A: Personalized Context + Conversation Persistence

## Context

CHATMED (the AI assistant in MEDNET, internally `medit-chat`) is currently a basic Q&A bot. It:
- Fetches generic top-20 bridges, 10 events, 10 discussions per request
- Has no knowledge of who the user is beyond their first name
- Loses all conversation history when the app closes
- Never initiates contact or proactively surfaces relevant information

Phase 1 built the data foundation: deep user profiles, activity tracking, tag subscriptions, pending actions, and social circles. Phase 2A connects all that data to CHATMED, turning it into a personalized companion.

**Branding:** The assistant is called **CHATMED** everywhere in the UI. The Supabase Edge Function name stays `medit-chat` (renaming Supabase functions requires redeployment and URL changes — not worth it).

---

## What Phase 2A Delivers

1. **Conversation persistence** — sessions and messages saved to Supabase + local AsyncStorage
2. **Personalized context** — CHATMED knows the full Phase 1 profile: name, year, settlement, family, tags, recent activity, pending actions, partner
3. **Proactive opening** — on new session, CHATMED greets by name and mentions one relevant thing waiting for the user
4. **Chat interactions logging** — every question saved to `chat_interactions` for community FAQ (Phase 3)
5. **Consistent naming** — "CHATMED" replaces "MEDIT" in all UI strings

---

## Database Changes

### New table: `chat_sessions`

```sql
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
```

### New table: `chat_messages`

```sql
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

---

## Context Builder (Edge Function)

The `medit-chat` Edge Function builds a rich system prompt from Phase 1 data before each Claude call. It runs 5 parallel Supabase queries:

### Queries (all run in parallel with `Promise.all`)

1. **User profile** — full row from `users` including new Phase 1 fields
2. **Tag subscriptions** — `user_tag_subscriptions` joined with `bridge_tags` → user's subscribed tag names
3. **Recent activity** — last 5 rows from `user_activity` (views, searches, creates)
4. **Pending actions** — `pending_actions` where `status = 'pending'`, ordered by `due_date`
5. **Relevant bridges** — bridges whose tags match the user's subscribed tags (via `bridge_tag_assignments`), limited to 10, ordered by newest

### System Prompt Structure

```
אתה CHATMED — הצ'אט החכם של MEDNET, הרשת החברתית לסטודנטים לרפואה בצפת.
אתה החבר הקרוב של [שם המשתמש]. אתה מכיר אותו לעומק ומלווה אותו.

=== זהות המשתמש ===
שם: [full_name] | שנה: [year_of_study] | מסלול: [academic_track]
ישוב: [settlement] | עיר מוצא: [origin_city]
מצב משפחתי: [marital_status] | ילדים: [has_children]
[אם partner_user_id קיים: בן/בת זוג [שם בן/בת הזוג] גם חבר/ה ב-MEDNET]

=== תחומי עניין (תיוגים שעוקב אחריהם) ===
[tag1], [tag2], [tag3]...

=== פעילות אחרונה ===
[5 פעולות אחרונות: "צפה בגשר X לפני 2 ימים", "חיפש Y אתמול"...]

=== ממתין לטיפול ===
[pending_actions עם due_date אם יש]

=== גשרים רלוונטיים שעודכנו לאחרונה ===
[עד 10 גשרים שמתאימים לתיוגים שלו]

=== כללי התנהגות ===
1. פנה תמיד בשמו הפרטי
2. בפתיחת שיחה חדשה — ציין מיד דבר אחד חשוב שממתין לו (pending action או גשר חדש רלוונטי)
3. אם בן/בת הזוג גם ב-MEDNET — ציין דברים משותפים רלוונטיים כשמתאים
4. ענה רק על מידע שקיים ב-MEDNET — אל תמציא
5. שמור על טון חם, ישיר, כמו חבר קרוב — לא פורמלי
6. דבר עברית בלבד
7. אם שואלים רפואה קלינית — הפנה לגשרים הרלוונטיים
```

### Token Budget

| רכיב | גודל משוער |
|------|------------|
| System prompt (context) | ~800 tokens |
| היסטוריית שיחה (15 הודעות אחרונות) | ~1,500 tokens |
| הודעת המשתמש הנוכחית | ~50-200 tokens |
| **סה"כ input** | ~2,300-2,500 tokens |
| max_tokens (תשובה) | 1,024 tokens |

זה בטוח מאוד בתוך מגבלות Claude Sonnet (200k context window).

---

## Client-Side Changes

### Updated `meditStore.ts`

**State:**
```typescript
interface MeditState {
  messages: MeditMessage[];
  loading: boolean;
  sessions: ChatSession[];     // list of past sessions
  currentSessionId: string | null;
  // Actions
  sendMessage: (content: string) => Promise<void>;
  startNewSession: () => void;
  loadLastSession: () => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  fetchSessions: () => Promise<void>;
}
```

**New types:**
```typescript
interface ChatSession {
  id: string;
  title: string | null;
  started_at: string;
  last_message_at: string;
}
```

**`loadLastSession()`** — called on app start:
1. Load messages from AsyncStorage key `chatmed_current_session` (instant)
2. Fetch latest session from Supabase in background
3. If Supabase has newer messages → merge into local state

**`sendMessage()`** — updated flow:
1. If no `currentSessionId` → create session in Supabase (get id back)
2. Add user message to local state immediately (responsive UI)
3. Save user message to `chat_messages` in Supabase (fire and forget)
4. Call Edge Function with `{ messages, session_id, is_new_session }`
5. Save assistant response to Supabase
6. Save full session to AsyncStorage
7. Log to `chat_interactions` (handled by Edge Function)

**`startNewSession()`:**
- Clear local messages
- Set `currentSessionId` to null (new session created on first send)
- Clear AsyncStorage current session

### Updated `chat.tsx`

**Changes:**
- History modal now loads real sessions from `sessions` state
- Clicking a past session calls `loadSession(id)`
- Welcome screen → CHATMED greets with name and one proactive message
  - "היי ידידו! יש לך טופס מלגה שצריך מילוי עד שבוע הבא — רוצה שנעשה את זה יחד?"
  - If no pending actions: "היי ידידו! נוספו 3 גשרים חדשים בתחום הכירורגיה השבוע. מה אתה צריך היום?"
- Replace all UI strings: "MEDIT" / "CHATMED" → **"CHATMED"** consistently

---

## Updated Edge Function: `medit-chat`

### New request body

```typescript
{
  messages: { role: string; content: string }[];
  session_id: string | null;   // null = new session
  is_new_session: boolean;     // true = proactive opening message
}
```

### New response body

```typescript
{
  response: string;
  session_id: string;   // returns the (possibly newly created) session_id
}
```

### Updated function flow

```
1. Auth check (existing)
2. Rate limit check (existing, 50/day)
3. Parse request: messages, session_id, is_new_session
4. Parallel data fetch (5 queries):
   - User profile
   - Tag subscriptions
   - Recent activity (last 5)
   - Pending actions
   - Relevant bridges (by tags, limit 10)
5. Build system prompt from context
6. If is_new_session → prepend instruction: "זוהי שיחה חדשה. פנה למשתמש בשמו ואמור לו דבר אחד חשוב שממתין לו."
7. Call Claude API (existing mechanism)
8. Save assistant message to chat_messages
9. Log to chat_interactions (question + topic_tags: match words in user's message against known tag names — simple string contains, no extra AI call)
10. Increment medit_usage (existing)
11. Return { response, session_id }
```

---

## Files to Change

### New files
- `supabase/migrations/006_chatmed_sessions.sql` — chat_sessions + chat_messages tables

### Modified files
- `supabase/functions/medit-chat/index.ts` — context builder + session persistence + chat_interactions logging
- `src/stores/meditStore.ts` — session management, Supabase persistence, AsyncStorage hybrid
- `src/types/database.ts` — add ChatSession, update MeditMessage (add session_id)
- `app/(tabs)/chat.tsx` — real history, proactive welcome, rename MEDIT → CHATMED
- `src/components/FloatingMedit.tsx` — rename button label MEDIT → CHATMED

### Name change (UI strings only, not file/function names)
- `app/(tabs)/chat.tsx`: "CHATMED" throughout
- `src/components/FloatingMedit.tsx`: button label → "CHATMED"
- System prompt: uses "CHATMED" as assistant name

---

## Verification Plan

1. **Migration** — apply 006, verify tables + RLS
2. **New session** — send first message → session created in Supabase, messages saved
3. **Persistence** — close app, reopen → last session loads from AsyncStorage, Supabase sync confirmed
4. **History** — open history modal → past sessions listed with titles
5. **Personalization** — check Edge Function logs: system prompt includes user name, tags, pending actions
6. **Proactive opening** — new session with a pending action → CHATMED mentions it in greeting
7. **Chat interactions** — after sending a message → row appears in `chat_interactions` with topic_tags
8. **Rate limit** — still 50/day, unchanged
9. **Name** — "CHATMED" everywhere in UI, no "MEDIT" visible

---

## What This Does NOT Include (Phase 2B / 2C)

- **Page awareness** (knowing which screen user is on) → Phase 2B
- **Proactive push** (CHATMED initiates outside of chat screen) → Phase 2B
- **Action execution** (creating rides, searching marketplace via chat) → Phase 2C
- **Admin analytics** on chat patterns → Phase 3
