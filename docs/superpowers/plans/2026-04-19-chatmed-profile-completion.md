# CHATMED Profile Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CHATMED asks missing profile fields one-at-a-time in conversation and saves answers automatically to the DB via Claude tool_use — no client changes needed.

**Architecture:** The Edge Function defines a `save_profile_field` tool for Claude. On first session, the system prompt instructs CHATMED to ask missing fields in order. On subsequent sessions, CHATMED asks organically. When Claude calls the tool, the Edge Function saves directly to `users` via the admin client, sends a `tool_result` back to Claude, and returns Claude's final text response to the client. The client is unchanged.

**Tech Stack:** Deno, Supabase Edge Functions, Claude Sonnet 4.6 (tool_use), TypeScript

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/functions/medit-chat/index.ts` | MODIFY | Add `computeMissingFields()`, `PROFILE_COMPLETION_TOOL`, system prompt sections, tool_use round-trip handling |

---

### Task 1: Add `computeMissingFields` + tool definition

**Files:**
- Modify: `supabase/functions/medit-chat/index.ts`

- [ ] **Step 1: Add the missing fields helper and tool constant after the `extractTopicTags` function**

In `supabase/functions/medit-chat/index.ts`, after the `extractTopicTags` function (around line 134), add:

```typescript
// Ordered list of profile fields to collect via chat
const PROFILE_FIELDS_ORDER = [
  {
    field: 'marital_status',
    question: 'מה המצב המשפחתי שלך? (רווק/ה, בזוגיות, נשוי/אה)',
  },
  {
    field: 'has_children',
    question: 'יש לך ילדים?',
  },
  {
    field: 'children_ages',
    question: 'כמה שנות גיל יש לילדים? (מופרד בפסיקים, לדוגמה: 3, 7)',
  },
  {
    field: 'bio',
    question: 'ספר על עצמך במשפט אחד — מה מייחד אותך?',
  },
  {
    field: 'graduation_year',
    question: 'באיזו שנה אתה מתכנן לסיים את הלימודים?',
  },
  {
    field: 'phone',
    question: 'מה מספר הטלפון שלך? (יוצג לקהילה)',
  },
] as const;

type ProfileField = typeof PROFILE_FIELDS_ORDER[number]['field'];

// Returns ordered list of fields that are null/empty in the profile
function computeMissingFields(profile: any): { field: ProfileField; question: string }[] {
  return PROFILE_FIELDS_ORDER.filter(({ field }) => {
    if (field === 'children_ages') {
      // Only ask if has_children is true and children_ages is empty
      return profile?.has_children === true &&
        (!profile?.children_ages || profile.children_ages.length === 0);
    }
    const val = profile?.[field];
    return val === null || val === undefined || val === '' ||
      (Array.isArray(val) && val.length === 0);
  });
}

// Claude tool definition for saving a single profile field
const PROFILE_COMPLETION_TOOL = {
  name: 'save_profile_field',
  description: 'Save a user\'s answer to a profile question. Call this immediately when the user answers a profile question.',
  input_schema: {
    type: 'object' as const,
    properties: {
      field: {
        type: 'string',
        enum: ['marital_status', 'has_children', 'children_ages', 'bio', 'graduation_year', 'phone'],
        description: 'The profile field to save',
      },
      value: {
        description: 'The value to save. marital_status: "single"|"in_relationship"|"married". has_children: true|false. children_ages: array of integers. graduation_year: integer. bio and phone: string.',
      },
    },
    required: ['field', 'value'],
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/medit-chat/index.ts
git commit -m "feat(chatmed): add computeMissingFields + PROFILE_COMPLETION_TOOL"
```

---

### Task 2: Add profile completion section to system prompt

**Files:**
- Modify: `supabase/functions/medit-chat/index.ts`

- [ ] **Step 1: Update `buildSystemPrompt` signature to accept `missingFields`**

Change the function signature from:

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
```

To:

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
  },
  missingFields: { field: string; question: string }[]
): string {
```

- [ ] **Step 2: Add profile completion section at the end of `buildSystemPrompt`, before the return statement**

Find the `newSessionInstruction` block and the return statement. Add the profile completion section just before `return`:

```typescript
  // Profile completion section
  let profileCompletionSection = '';
  if (missingFields.length > 0) {
    const questionsList = missingFields.map(f => `- ${f.question}`).join('\n');
    if (isNewSession) {
      profileCompletionSection = `

=== השלמת פרופיל (שיחה ראשונה) ===
שאל את המשתמש על השדות הבאים אחד-אחד, לפי הסדר:
${questionsList}

כללים:
1. שאל שאלה אחת בכל הודעה — אחרי ברכת הפתיחה, שאל את השאלה הראשונה
2. כשמקבל תשובה — קרא ל-save_profile_field ועבור לשאלה הבאה
3. אם המשתמש אומר "דלג" / "לא רוצה" / "אחר כך" / "פחות חשוב" — עבור לשאלה הבאה בלי לשמור
4. אחרי כל השאלות — המשך כרגיל לשיחה חופשית
5. שמור על טון חם ואישי — לא כמו טופס`;
    } else {
      profileCompletionSection = `

=== שדות פרופיל חסרים ===
אם ההקשר מתאים — שאל באופן טבעי על אחד מהשדות הבאים (בחר את המתאים ביותר):
${questionsList}
אל תכריח — שאל רק אם זה מרגיש טבעי בהמשך השיחה.`;
    }
  }
```

- [ ] **Step 3: Append `profileCompletionSection` to the returned string**

Find the closing of the template literal in the return statement (ends with `${newSessionInstruction}\`` ) and change it to:

```typescript
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
7. אם שואלים רפואה קלינית — הפנה לגשרים הרלוונטיים${newSessionInstruction}${profileCompletionSection}`;
```

- [ ] **Step 4: Update the `buildSystemPrompt` call site (around line 338) to pass `missingFields`**

Find:
```typescript
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

Replace with:
```typescript
    const missingFields = computeMissingFields(profileRes.data);

    const systemPrompt = buildSystemPrompt(
      profileRes.data,
      tagNames,
      activityRes.data || [],
      pendingRes.data || [],
      bridges,
      !!is_new_session,
      extras,
      missingFields
    );
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/medit-chat/index.ts
git commit -m "feat(chatmed): add profile completion sections to system prompt"
```

---

### Task 3: Add tool_use round-trip handling in the Claude call

**Files:**
- Modify: `supabase/functions/medit-chat/index.ts`

This is the core task. Replace the Claude API call section (step 7, around line 349) with a version that handles tool_use.

- [ ] **Step 1: Replace the Claude API call block**

Find the existing Claude API call (section `--- 7. Call Claude API ---`) and replace everything from `const claudeResponse = await fetch(...)` through `const assistantResponse = claudeData.content?.[0]?.text || ...` with:

```typescript
    // --- 7. Call Claude API (with tool_use support) ---
    const callClaude = async (messages: any[]): Promise<any> => {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemPrompt,
          tools: missingFields.length > 0 ? [PROFILE_COMPLETION_TOOL] : undefined,
          messages,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('Claude API error:', res.status, errText);
        throw new Error(`Claude API returned ${res.status}`);
      }

      return res.json();
    };

    // Allowed fields for saving (whitelist — prevents arbitrary column writes)
    const ALLOWED_SAVE_FIELDS: Record<string, (v: any) => any> = {
      marital_status: (v: any) => ['single', 'in_relationship', 'married'].includes(v) ? v : null,
      has_children: (v: any) => typeof v === 'boolean' ? v : v === 'true' ? true : v === 'false' ? false : null,
      children_ages: (v: any) => Array.isArray(v) ? v.map(Number).filter(n => !isNaN(n)) : null,
      bio: (v: any) => typeof v === 'string' && v.trim() ? v.trim().slice(0, 500) : null,
      graduation_year: (v: any) => {
        const n = parseInt(v, 10);
        return n >= 2024 && n <= 2040 ? n : null;
      },
      phone: (v: any) => typeof v === 'string' && v.trim() ? v.trim().slice(0, 20) : null,
    };

    let conversationMessages = [...safeMsgs];
    let claudeData = await callClaude(conversationMessages);
    let assistantResponse = '';

    // Handle tool_use round-trip (Claude may call save_profile_field)
    while (claudeData.stop_reason === 'tool_use') {
      const toolUseBlock = claudeData.content.find((b: any) => b.type === 'tool_use');
      if (!toolUseBlock) break;

      let toolResult = 'saved';

      if (toolUseBlock.name === 'save_profile_field') {
        const { field, value } = toolUseBlock.input || {};
        const sanitizer = ALLOWED_SAVE_FIELDS[field];

        if (sanitizer) {
          const sanitized = sanitizer(value);
          if (sanitized !== null) {
            const { error: saveError } = await adminClient
              .from('users')
              .update({ [field]: sanitized })
              .eq('id', user.id);

            if (saveError) {
              console.error(`Failed to save profile field ${field}:`, saveError);
              toolResult = 'error saving field';
            }
          } else {
            toolResult = 'invalid value — skipped';
          }
        } else {
          toolResult = 'unknown field — skipped';
        }
      }

      // Send tool_result back to Claude and get next response
      conversationMessages = [
        ...conversationMessages,
        { role: 'assistant', content: claudeData.content },
        {
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: toolUseBlock.id,
            content: toolResult,
          }],
        },
      ];

      claudeData = await callClaude(conversationMessages);
    }

    // Extract final text response
    assistantResponse = claudeData.content
      ?.filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('') || 'מצטער, לא הצלחתי לעבד את הבקשה.';
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/medit-chat/index.ts
git commit -m "feat(chatmed): tool_use round-trip for profile field saving"
```

---

### Task 4: Deploy + Verify

**Files:** None (deployment only)

- [ ] **Step 1: Deploy the Edge Function**

```bash
supabase functions deploy medit-chat
```

Expected: `Deployed Function medit-chat`

- [ ] **Step 2: Smoke test — new session with missing fields**

1. In Supabase → Table Editor → `users`, set `marital_status = null` for your test user
2. Open CHATMED → tap `+` (new session)
3. First CHATMED message should: greet by name + mention a pending action/bridge + ask "מה המצב המשפחתי שלך?"
4. Answer "נשוי" → CHATMED saves and asks next field (has_children)
5. Answer "דלג" → CHATMED skips to bio question
6. In Supabase → Table Editor → `users` → confirm `marital_status = 'married'`, `has_children` still null

- [ ] **Step 3: Smoke test — skip flow**

1. New session → answer "דלג" to every question
2. After all questions → CHATMED switches to normal conversation
3. No new data saved in `users` table

- [ ] **Step 4: Smoke test — subsequent session**

1. Start a new session after profile is complete
2. Send a normal message ("מה חדש?")
3. CHATMED should NOT ask profile questions (missingFields is empty)

- [ ] **Step 5: Check Edge Function logs**

Supabase Dashboard → Edge Functions → medit-chat → Logs
- Confirm: no uncaught errors
- Confirm: tool_use calls appear in logs when profile fields are saved

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "feat(chatmed): profile completion via tool_use — Phase 2B complete"
```
