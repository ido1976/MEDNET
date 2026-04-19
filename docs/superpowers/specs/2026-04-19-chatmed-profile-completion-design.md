# CHATMED Profile Completion — Design Spec

**Date:** 2026-04-19
**Goal:** CHATMED collects missing profile fields through natural conversation and saves them automatically to the DB — no manual profile editing required.

---

## Overview

CHATMED acts as a profile concierge. In the first session it walks the user through missing fields one at a time. In subsequent sessions it asks organically when context fits. All saving happens server-side via Claude tool_use — no client changes needed.

---

## Architecture

**Server-side only.** The Edge Function defines a `save_profile_field` tool for Claude. When the user answers a profile question, Claude calls the tool. The Edge Function writes directly to `users` via the admin client and returns a normal text response. meditStore and authStore are unchanged.

### Why tool_use (not JSON parsing):
- Profile saved server-side — no client parsing logic
- Clean separation: meditStore handles chat, Edge Function handles profile
- If Claude fails to parse the answer, it simply doesn't call the tool — safe fallback

---

## Fields & Order

Asked in this order (first session):

| # | Field | Hebrew question | Type |
|---|-------|----------------|------|
| 1 | `marital_status` | נשוי/ה? בזוגיות? רווק/ה? | enum: single / in_relationship / married |
| 2 | `has_children` | יש לך ילדים? | boolean |
| 3 | `children_ages` | כמה שנים יש להם? (מופרד בפסיקים) | int[] — only asked if has_children=true |
| 4 | `bio` | ספר על עצמך במשפט אחד לקהילה | text |
| 5 | `graduation_year` | מתי אתה מסיים לימודים? | int (year) |
| 6 | `phone` | מה הטלפון שלך? (לרשות הקהילה) | text |

Skip: if the user says "דלג", "לא רוצה", "אחר כך" or similar — CHATMED moves to the next field without saving.

---

## System Prompt Changes

### First session (is_new_session=true):

Edge Function computes `missingFields` — the ordered list above filtered to fields where `profile[field]` is null/empty.

If `missingFields.length > 0`, append to system prompt:

```
=== השלמת פרופיל ===
שאל את המשתמש על השדות הבאים אחד-אחד, לפי הסדר:
[list of Hebrew questions]

כללים:
1. שאל שאלה אחת בכל הודעה
2. אחרי שמקבל תשובה — קרא ל-save_profile_field ועבור לשאלה הבאה
3. אם המשתמש אומר "דלג" / "לא רוצה" / "אחר כך" — עבור לשאלה הבאה בלי לשמור
4. אחרי שסיימת את כל השאלות — המשך לשיחה חופשית
5. פנה בשם הפרטי, שמור על טון חם ואישי
```

### Subsequent sessions:

If `missingFields.length > 0`, append:

```
=== שדות פרופיל חסרים ===
אם ההקשר מתאים, שאל באופן טבעי על אחד מהשדות הבאים:
[list]
אל תפריע לשיחה — שאל רק אם זה מרגיש טבעי.
```

---

## Tool Definition

```typescript
const tools = [
  {
    name: 'save_profile_field',
    description: 'Save a single profile field answer to the user profile',
    input_schema: {
      type: 'object',
      properties: {
        field: {
          type: 'string',
          enum: ['marital_status', 'has_children', 'children_ages', 'bio', 'graduation_year', 'phone'],
        },
        value: {
          description: 'The value to save. For has_children: true/false. For children_ages: array of ints. For marital_status: single/in_relationship/married. For graduation_year: integer year.',
        },
      },
      required: ['field', 'value'],
    },
  },
];
```

---

## Edge Function Flow (updated)

```
1. Auth + rate limit (unchanged)
2. Parallel context queries (unchanged)
3. Compute missingFields from profileRes.data
4. Build system prompt (with profile completion section if needed)
5. Call Claude API — include tools array
6. If response includes tool_use block:
   a. Extract { field, value }
   b. Validate field is in allowed list
   c. adminClient.from('users').update({ [field]: value }).eq('id', user.id)
   d. Continue to get final text response (Claude may need a tool_result round-trip)
7. Persist assistant message + session (unchanged)
8. Return { response, session_id }
```

### Tool result round-trip:
Claude tool_use requires sending a `tool_result` message back before Claude generates the final text. The Edge Function handles this internally — one extra Claude API call when tool_use is detected. The client sees no difference.

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/medit-chat/index.ts` | Add `computeMissingFields()`, add tools to Claude call, handle tool_use response |

No client changes required.

---

## Error Handling

- Tool call fails to save → log error, continue conversation (don't surface to user)
- Claude calls tool with invalid field → validate and reject silently
- User gives ambiguous answer → Claude doesn't call tool, asks clarifying follow-up

---

## Verification

1. New user (all fields empty) → first CHATMED message asks marital_status
2. Answer "נשוי" → saved to DB, next message asks has_children
3. Answer "דלג" → skips to bio, nothing saved
4. After all questions → CHATMED continues as normal assistant
5. Existing user (some fields filled) → only missing fields asked
6. Subsequent session → organic question if context fits, not forced
