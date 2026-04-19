# MEDIT Phase 2 — Richer User Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make MEDIT significantly smarter by injecting 4 new context layers into its system prompt: user bio/interests, partner's name, recent search history, circle membership, and recent chat topics.

**Architecture:** All changes are in `supabase/functions/medit-chat/index.ts`. New queries are added to (or after) the existing `Promise.all` block at step 5. `buildSystemPrompt` gains an `extras` parameter for the new data. After editing, the function is redeployed via Supabase CLI.

**Tech Stack:** Deno (Edge Function runtime), Supabase JS client, Claude API.

---

## What's changing and why

| Addition | Source table | Why it matters |
|----------|-------------|----------------|
| `bio` + `interests` | `users` (already fetched, just not selected) | User's self-description and medical interests — free context, zero extra query |
| Partner first name | `users` (one extra query if `partner_user_id` set) | Currently shows "מחובר/ת ל-MEDNET" — a name is 10× more useful |
| Recent searches | `user_search_history` | Shows what user is actively looking for right now |
| Circle membership | `user_circle_members` + `user_circles` | "אתה בחוג שנה ב׳ וצפת" — gives MEDIT cohort context |
| Recent chat topics | `chat_interactions` | Prevents MEDIT repeating itself; spots recurring themes |

---

## File Map

| File | Change |
|------|--------|
| `supabase/functions/medit-chat/index.ts` | All changes (queries + system prompt) |

---

### Task 1: Enrich profile query and add `extras` parameter to `buildSystemPrompt`

**Files:**
- Modify: `supabase/functions/medit-chat/index.ts`

- [ ] **Step 1: Update `buildSystemPrompt` signature and body**

Replace the entire `buildSystemPrompt` function (lines 25–98) with:

```typescript
function buildSystemPrompt(
  profile: any,
  tagNames: string[],
  activity: any[],
  pendingActions: any[],
  bridges: any[],
  isNewSession: boolean,
  extras: {
    searchHistory: any[];
    circles: string[];
    recentChatTopics: string[];
    partnerName: string | null;
  }
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
        return `${actionMap[a.activity_type] || a.activity_type} ${a.target_type} ${timeStr}`;
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
    ? `\nבן/בת זוג: ${extras.partnerName || 'מחובר/ת ל-MEDNET'}`
    : '';

  const bioLine = profile?.bio ? `\nביוגרפיה: ${profile.bio}` : '';
  const interestsLine = profile?.interests?.length
    ? `\nתחומי לימוד: ${profile.interests.join(', ')}`
    : '';
  const circlesLine = extras.circles.length > 0
    ? `\nחוגים: ${extras.circles.join(', ')}`
    : '';

  const searchList = extras.searchHistory.length > 0
    ? extras.searchHistory.map((s: any) => `- "${s.query}" (${s.context || 'כללי'})`).join('\n')
    : 'אין חיפושים אחרונים';

  const recentTopicsList = extras.recentChatTopics.length > 0
    ? extras.recentChatTopics.map((q: string) => `- ${q}`).join('\n')
    : 'אין שיחות קודמות';

  const newSessionInstruction = isNewSession
    ? '\n\n=== הוראה לפתיחת שיחה ===\nזוהי שיחה חדשה. פנה למשתמש בשמו הפרטי ואמור לו דבר אחד חשוב שממתין לו (pending action בעדיפות ראשונה, אחרת גשר חדש רלוונטי). אם אין כלום — שאל מה הוא צריך היום.'
    : '';

  return `אתה CHATMED — הצ'אט החכם של MEDNET, הרשת החברתית לסטודנטים לרפואה בצפת.
אתה החבר הקרוב של ${firstName}. אתה מכיר אותו לעומק ומלווה אותו.

=== זהות המשתמש ===
שם: ${profile?.full_name || '—'} | שנה: ${profile?.year_of_study || '—'} | מסלול: ${profile?.academic_track || '—'}
ישוב: ${profile?.settlement || '—'} | עיר מוצא: ${profile?.origin_city || '—'}
מצב משפחתי: ${profile?.marital_status || '—'} | ילדים: ${profile?.has_children ? 'כן' : 'לא'}${partnerLine}${bioLine}${interestsLine}${circlesLine}

=== תחומי עניין (תיוגים שעוקב אחריהם) ===
${tagsList}

=== פעילות אחרונה ===
${activityList}

=== ממתין לטיפול ===
${pendingList}

=== גשרים רלוונטיים שעודכנו לאחרונה ===
${bridgesList}

=== חיפושים אחרונים ===
${searchList}

=== נושאים שנשאלו לאחרונה בצ'אט ===
${recentTopicsList}

=== כללי התנהגות ===
1. פנה תמיד בשמו הפרטי
2. בפתיחת שיחה חדשה — ציין מיד דבר אחד חשוב שממתין לו
3. אם בן/בת הזוג גם ב-MEDNET — ציין דברים משותפים רלוונטיים כשמתאים
4. ענה רק על מידע שקיים ב-MEDNET — אל תמציא
5. שמור על טון חם, ישיר, כמו חבר קרוב — לא פורמלי
6. דבר עברית בלבד
7. אם שואלים רפואה קלינית — הפנה לגשרים הרלוונטיים${newSessionInstruction}`;
}
```

- [ ] **Step 2: Add `bio, interests` to the profile SELECT query**

Find:
```typescript
      userClient
        .from('users')
        .select('full_name, year_of_study, academic_track, settlement, origin_city, marital_status, has_children, partner_user_id')
        .eq('id', user.id)
        .single(),
```

Replace with:
```typescript
      userClient
        .from('users')
        .select('full_name, year_of_study, academic_track, settlement, origin_city, marital_status, has_children, partner_user_id, bio, interests')
        .eq('id', user.id)
        .single(),
```

- [ ] **Step 3: Add search history and circles to the `Promise.all`**

Find:
```typescript
    const [profileRes, tagsRes, activityRes, pendingRes] = await Promise.all([
```

Replace with:
```typescript
    const [profileRes, tagsRes, activityRes, pendingRes, searchRes, circlesRes] = await Promise.all([
```

Find the closing of the Promise.all (after the `pendingRes` query, before the `]);`):
```typescript
      userClient
        .from('pending_actions')
        .select('title, due_date')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(10),
    ]);
```

Replace with:
```typescript
      userClient
        .from('pending_actions')
        .select('title, due_date')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(10),
      userClient
        .from('user_search_history')
        .select('query, context')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      userClient
        .from('user_circle_members')
        .select('circle:user_circles(name)')
        .eq('user_id', user.id),
    ]);
```

- [ ] **Step 4: Add partner name + recent chat topics queries (after the Promise.all block)**

Find:
```typescript
    const tagIds = (tagsRes.data || []).map((t: any) => t.tag_id);
```

Insert immediately before it:
```typescript
    // Resolve partner first name (only if partner_user_id is set)
    let partnerName: string | null = null;
    if (profileRes.data?.partner_user_id) {
      const { data: partnerData } = await userClient
        .from('users')
        .select('full_name')
        .eq('id', profileRes.data.partner_user_id)
        .single();
      partnerName = partnerData?.full_name?.split(' ')[0] || null;
    }

    // Fetch last 5 chat topics (questions the user has asked before)
    const { data: recentChatsData } = await userClient
      .from('chat_interactions')
      .select('question')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

```

- [ ] **Step 5: Build `extras` object and pass it to `buildSystemPrompt`**

Find:
```typescript
    // --- 6. Build system prompt ---
    const systemPrompt = buildSystemPrompt(
      profileRes.data,
      tagNames,
      activityRes.data || [],
      pendingRes.data || [],
      bridges,
      !!is_new_session
    );
```

Replace with:
```typescript
    // --- 6. Build system prompt ---
    const extras = {
      searchHistory: searchRes.data || [],
      circles: (circlesRes.data || [])
        .map((c: any) => c.circle?.name)
        .filter(Boolean) as string[],
      recentChatTopics: (recentChatsData || [])
        .map((c: any) => c.question?.slice(0, 80))
        .filter(Boolean) as string[],
      partnerName,
    };

    const systemPrompt = buildSystemPrompt(
      profileRes.data,
      tagNames,
      activityRes.data || [],
      pendingRes.data || [],
      bridges,
      !!is_new_session,
      extras
    );
```

- [ ] **Step 6: Commit the code change**

```bash
git add supabase/functions/medit-chat/index.ts
git commit -m "feat(medit): Phase 2 context — bio, interests, partner name, search history, circles, recent chat topics"
```

---

### Task 2: Deploy the updated Edge Function

**Files:**
- Deploy: `supabase/functions/medit-chat/index.ts`

The Edge Function runs on Supabase's servers. Code changes don't take effect until deployed.

- [ ] **Step 1: Deploy**

In CMD (in the MEDNET project folder):
```
npx supabase functions deploy medit-chat
```

Expected output:
```
Deploying Function medit-chat (script size: ~Xkb)
Done: medit-chat
```

If this fails with "not logged in": run `npx supabase login` first.

- [ ] **Step 2: Verify deploy succeeded**

Go to Supabase Dashboard → Edge Functions → `medit-chat` → check the "Last deployed" timestamp updated.

---

### Task 3: Manual verification

- [ ] **Step 1: Start the app**

```
npx expo start
```

- [ ] **Step 2: Open MEDIT and start a new chat**

Tap the MEDIT button. Start a new conversation. Verify:

1. MEDIT addresses you by your **first name**
2. If you filled in `bio` during onboarding/profile — MEDIT's response reflects it contextually
3. Ask "מה חיפשתי לאחרונה?" — MEDIT should mention recent searches if any exist
4. Ask "באיזה חוגים אני?" — MEDIT should mention your circles (year group, settlement)
5. Ask "על מה דיברנו בפעם הקודמת?" — MEDIT should recall recent chat topics

- [ ] **Step 3: Check CMD for errors**

While testing, watch the CMD for any `console.error` lines from the Edge Function. Common issues:
- `user_search_history: permission denied` → RLS blocks the query; fix with SQL below
- `user_circle_members: permission denied` → same fix

If you see permission errors, run this in Supabase SQL Editor:
```sql
-- Ensure RLS allows users to read their own data (should already exist from migration 005)
-- Run only if you see permission denied errors:
CREATE POLICY IF NOT EXISTS "Users can read own search history" ON user_search_history
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can read own circle memberships" ON user_circle_members
  FOR SELECT USING (user_id = auth.uid());
```

---

## Done ✓

After Task 3 passes, MEDIT knows:
- Your bio and medical interests
- Your partner's first name  
- What you've been searching for lately
- Which cohort circles you belong to
- What you've asked MEDIT about before
