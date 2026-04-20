// Supabase Edge Function: medit-chat
// Phase 2A: Personalized context + conversation persistence
// v2: Security hardening — user-scoped client, atomic rate limit, session ownership check

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

if (!CLAUDE_API_KEY) {
  throw new Error('CLAUDE_API_KEY env var is missing — set it in Supabase Dashboard → Edge Functions → Secrets');
}

const DAILY_LIMIT = 50;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Build rich Hebrew system prompt from Phase 2 context data
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
    children: { id: string; name: string | null; gender: string | null; age: number }[];
  },
  missingFields: { field: string; question: string }[],
  userApartments: { id: string; address: string; available_from: string }[],
  userSecondhand: { id: string; title: string; price: number | null; status: string; created_at: string }[]
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
        // Include IDs for tools that need them
        let extra = '';
        if (p.action_type === 'apartment_check') {
          extra = ` [pending_action_id:${p.id}, apartment_id:${p.metadata?.apartment_id}, address:${p.metadata?.address}, available_from:${p.metadata?.available_from}]`;
        } else if (p.action_type === 'secondhand_check') {
          extra = ` [pending_action_id:${p.id}, listing_id:${p.metadata?.listing_id}, title:${p.metadata?.title}]`;
        }
        return `- [${p.action_type}] ${p.title}${due}${extra}`;
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

  const childrenList = extras.children.length > 0
    ? extras.children.map((c) => {
        const genderLabel = c.gender === 'female' ? 'בת' : c.gender === 'male' ? 'בן' : 'ילד';
        const namePart = c.name ? ` | שם: ${c.name}` : '';
        return `- ID: ${c.id} | ${genderLabel} | גיל ${c.age}${namePart}`;
      }).join('\n')
    : null;

  const hasApartments = userApartments.length > 0;
  // Only prompt about secondhand listings that are at least 7 days old —
  // freshly-posted items shouldn't trigger "is this still for sale?" questions.
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const oldSecondhand = userSecondhand.filter((s) => {
    const created = new Date(s.created_at).getTime();
    return Number.isFinite(created) && (now - created) >= SEVEN_DAYS_MS;
  });
  const hasSecondhand = oldSecondhand.length > 0;
  const hasPendingApartmentCheck = pendingActions.some((p: any) => p.action_type === 'apartment_check');
  const hasPendingSecondhandCheck = pendingActions.some((p: any) => p.action_type === 'secondhand_check');
  const hasAnyListing = hasApartments || hasSecondhand;

  let proactiveInstructions = '';
  if (hasApartments) {
    proactiveInstructions += `\nיש לו מודעת דירה ברשימת "מודעות דירה שפרסמת" — בצע בסדר:\n1. קרא ל-get_apartment_analytics עם ה-apartment_id הראשון\n2. הצג נתוני חשיפה בצורה חמה${hasPendingApartmentCheck ? '\n3. שאל אם המודעה עדיין רלוונטית' : ''}`;
  }
  if (hasSecondhand) {
    if (hasApartments) {
      proactiveInstructions += `\nבנוסף יש לו מודעת יד שנייה (פורסמה לפני 7+ ימים) — אחרי הדירה שאל אם רוצה לשמוע על החשיפה שלה, ואז שאל אם הפריט עדיין למכירה (אם לא — קרא ל-delete_secondhand_listing לאחר אישור).`;
    } else {
      proactiveInstructions += `\nיש לו מודעת יד שנייה שפורסמה לפני 7+ ימים — בצע בסדר:\n1. קרא ל-get_secondhand_analytics עם ה-listing_id הראשון\n2. הצג נתוני חשיפה בצורה חמה\n3. שאל אם הפריט עדיין למכירה (אם לא — קרא ל-delete_secondhand_listing לאחר אישור)`;
    }
  }

  const newSessionInstruction = isNewSession
    ? hasAnyListing
      ? `\n\n=== הוראה לפתיחת שיחה ===\nזוהי שיחה חדשה. פנה למשתמש בשמו הפרטי.${proactiveInstructions}\nאחרי הכל — בדוק אם יש pending actions אחרים לציין.`
      : '\n\n=== הוראה לפתיחת שיחה ===\nזוהי שיחה חדשה. פנה למשתמש בשמו הפרטי ואמור לו דבר אחד חשוב שממתין לו (pending action בעדיפות ראשונה, אחרת גשר חדש רלוונטי). אם אין כלום ויש שדות פרופיל חסרים — שאל על השדה הראשון מהרשימה באופן חם ואישי. אם הכול מלא — שאל מה הוא צריך היום.'
    : '';

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

  return `אתה CHATMED — הצ'אט החכם של MEDNET, הרשת החברתית לסטודנטים לרפואה בצפת.
אתה החבר הקרוב של ${firstName}. אתה מכיר אותו לעומק ומלווה אותו.

=== זהות המשתמש ===
שם: ${profile?.full_name || '—'} | שנה: ${profile?.year_of_study || '—'} | מסלול: ${profile?.academic_track || '—'}
ישוב: ${profile?.settlement || '—'} | עיר מוצא: ${profile?.origin_city || '—'}
מצב משפחתי: ${profile?.marital_status || '—'} | ילדים: ${profile?.has_children ? `כן (${extras.children.length})` : 'לא'}${partnerLine}${bioLine}${interestsLine}${circlesLine}

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
${childrenList ? `\n=== ילדים קיימים (השתמש ב-ID לעדכון) ===\n${childrenList}` : ''}
${userApartments.length > 0 ? `\n=== מודעות דירה שפרסמת (השתמש ב-ID לאנליטיקות) ===\n${userApartments.map((a: { id: string; address: string; available_from: string }) => `- ID: ${a.id} | ${a.address} | כניסה: ${a.available_from}`).join('\n')}` : ''}
${userSecondhand.length > 0 ? `\n=== מודעות יד שנייה שפרסמת (השתמש ב-ID לאנליטיקות) ===\n${userSecondhand.map((s) => `- ID: ${s.id} | ${s.title}${s.price != null ? ` | ₪${s.price}` : ''} | ${s.status === 'active' ? 'פעיל' : 'נמכר'}`).join('\n')}` : ''}
=== כללי התנהגות ===
1. פנה תמיד בשמו הפרטי
2. בפתיחת שיחה חדשה — ציין מיד דבר אחד חשוב שממתין לו
3. אם בן/בת הזוג גם ב-MEDNET — ציין דברים משותפים רלוונטיים כשמתאים
4. ענה רק על מידע שקיים ב-MEDNET — אל תמציא
5. שמור על טון חם, ישיר, כמו חבר קרוב — לא פורמלי
6. דבר עברית בלבד
7. אם שואלים רפואה קלינית — הפנה לגשרים הרלוונטיים
8. אם המשתמש מבקש לעדכן פרט בפרופיל (כגון מצב משפחתי, ביוגרפיה, טלפון וכד') — קרא ל-save_profile_field מיד
9. לשמירת ילד חדש — קרא ל-save_child פעם אחת לכל ילד בנפרד (שם אם ידוע, מגדר, גיל). אסור לשמור כמה ילדים בקריאה אחת
10. לתיקון פרטי ילד קיים (גיל, שם, מגדר) — קרא ל-update_child עם ה-ID מרשימת "ילדים קיימים". לא save_child
11. כשיש pending_action מסוג apartment_check: שאל בטון חברותי "ראיתי שפרסמת דירה ב-[address], תאריך הכניסה [available_from] מתקרב — האם המודעה עדיין פעילה?". • אם כן/עדיין רלוונטי → קרא ל-snooze_apartment_check והצג את ההודעה שהכלי מחזיר כמות שהיא. • אם לא/תמחק/כבר לא רלוונטי → בקש אישור קצר ואז קרא ל-delete_apartment. • אם המשתמש אמר "אני אודיע" — הסבר שתחזור אחרי תאריך הכניסה. השתמש ב-pending_action_id ו-apartment_id מה-metadata שברשימת הממתינים.
12. כשמשתמש שואל על חשיפה / כמה ראו / סטטיסטיקות של מודעת דירה — קרא ל-get_apartment_analytics. אם יש דירה אחת ברשימת "מודעות דירה שפרסמת" — השתמש בה מיד. אם יש כמה — שאל על איזו דירה מדובר. הצג את הנתונים בצורה חמה וידידותית.
13. כשיש pending_action מסוג secondhand_check: שאל "ראיתי שפרסמת '[title]' לפני 30 יום — האם הפריט עדיין למכירה?". • אם כן/עדיין רלוונטי → קרא ל-snooze_secondhand_check. • אם נמכר/לא רלוונטי → בקש אישור קצר ואז קרא ל-delete_secondhand_listing. השתמש ב-pending_action_id ו-listing_id מרשימת הממתינים.
14. כשמשתמש שואל על חשיפה / סטטיסטיקות של מודעת יד שנייה — קרא ל-get_secondhand_analytics. אם יש מודעה אחת ברשימת "מודעות יד שנייה שפרסמת" — השתמש בה מיד. הצג בצורה חמה וידידותית.${newSessionInstruction}${profileCompletionSection}`;
}

// Simple tag extraction: find known tag names that appear in the user's question
function extractTopicTags(question: string, knownTagNames: string[]): string[] {
  const questionLower = question.toLowerCase();
  return knownTagNames.filter(tag =>
    questionLower.includes(tag.toLowerCase()) && tag.length > 2
  );
}

// Ordered list of profile fields to collect via chat
const PROFILE_FIELDS_ORDER = [
  {
    field: 'marital_status',
    question: 'מה המצב המשפחתי שלך? (רווק/ה, בזוגיות, נשוי/אה)',
  },
  {
    field: 'has_children',
    question: 'יש לך ילדים? אם כן — ספר לי על כל ילד (שם, מגדר, גיל)',
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
    question: 'מה הטלפון שלך? (לרשות הקהילה)',
  },
] as const;

type ProfileField = typeof PROFILE_FIELDS_ORDER[number]['field'];

// Returns ordered list of fields that are null/empty in the profile
function computeMissingFields(profile: any): { field: ProfileField; question: string }[] {
  return PROFILE_FIELDS_ORDER.filter(({ field }) => {
    const val = profile?.[field];
    return val === null || val === undefined || val === '' ||
      (Array.isArray(val) && val.length === 0);
  });
}

// Claude tool for updating an existing child's details
const UPDATE_CHILD_TOOL = {
  name: 'update_child',
  description: 'Update details of an existing child. Use the child_id from the system prompt children list.',
  input_schema: {
    type: 'object' as const,
    properties: {
      child_id: { type: 'string', description: 'The UUID of the child from ילדים קיימים list' },
      name: { type: 'string', description: 'New name (optional)' },
      gender: { type: 'string', enum: ['male', 'female'], description: 'New gender (optional)' },
      age: { type: 'number', description: 'New age (optional)' },
    },
    required: ['child_id'],
  },
};

// Claude tool for saving a single child's details
const SAVE_CHILD_TOOL = {
  name: 'save_child',
  description: 'Save details of one child. Call once per child separately.',
  input_schema: {
    type: 'object' as const,
    properties: {
      name: { type: 'string', description: 'Child\'s name (optional)' },
      gender: { type: 'string', enum: ['male', 'female'], description: 'male for boy, female for girl' },
      age: { type: 'number', description: 'Child\'s age in whole years' },
    },
    required: ['age'],
  },
};

// Tool: delete an apartment listing on behalf of the user
const DELETE_APARTMENT_TOOL = {
  name: 'delete_apartment',
  description: 'מוחק מודעת דירה של המשתמש לאחר אישורו המפורש. קרא לכלי זה רק אחרי שהמשתמש אמר בצורה ברורה שהוא רוצה למחוק את המודעה.',
  input_schema: {
    type: 'object' as const,
    properties: {
      apartment_id: { type: 'string', description: 'ה-UUID של מודעת הדירה למחיקה' },
      pending_action_id: { type: 'string', description: 'ה-UUID של ה-pending_action לסגירה אחרי המחיקה' },
    },
    required: ['apartment_id', 'pending_action_id'],
  },
};

// Tool: snooze apartment relevance check until after available_from date
const SNOOZE_APARTMENT_TOOL = {
  name: 'snooze_apartment_check',
  description: 'דוחה את בדיקת הרלוונטיות של מודעת הדירה. אם תאריך הכניסה עדיין לא הגיע — ידחה עד יום אחרי תאריך הכניסה. אם כבר עבר — ידחה 7 ימים.',
  input_schema: {
    type: 'object' as const,
    properties: {
      pending_action_id: { type: 'string', description: 'ה-UUID של ה-pending_action לדחייה' },
    },
    required: ['pending_action_id'],
  },
};

// Tool: fetch analytics for an apartment listing
const GET_APARTMENT_ANALYTICS_TOOL = {
  name: 'get_apartment_analytics',
  description: 'מביא נתוני חשיפה של מודעת דירה: צפיות, גלישת תמונות, לחיצות טלפון ווואטסאפ. קרא לכלי זה כשבעל המודעה שואל על החשיפה / כמה ראו / סטטיסטיקות.',
  input_schema: {
    type: 'object' as const,
    properties: {
      apartment_id: { type: 'string', description: 'ה-UUID של מודעת הדירה' },
    },
    required: ['apartment_id'],
  },
};

// Tool: delete a secondhand listing on behalf of the user
const DELETE_SECONDHAND_TOOL = {
  name: 'delete_secondhand_listing',
  description: 'מוחק מודעת יד שנייה של המשתמש לאחר אישורו המפורש. קרא לכלי זה רק אחרי שהמשתמש אמר בצורה ברורה שהוא רוצה למחוק.',
  input_schema: {
    type: 'object' as const,
    properties: {
      listing_id: { type: 'string', description: 'ה-UUID של מודעת יד שנייה למחיקה' },
      pending_action_id: { type: 'string', description: 'ה-UUID של ה-pending_action לסגירה אחרי המחיקה' },
    },
    required: ['listing_id', 'pending_action_id'],
  },
};

// Tool: snooze secondhand relevance check by 30 days
const SNOOZE_SECONDHAND_TOOL = {
  name: 'snooze_secondhand_check',
  description: 'דוחה את בדיקת הרלוונטיות של מודעת יד שנייה ב-30 יום.',
  input_schema: {
    type: 'object' as const,
    properties: {
      pending_action_id: { type: 'string', description: 'ה-UUID של ה-pending_action לדחייה' },
    },
    required: ['pending_action_id'],
  },
};

// Tool: fetch analytics for a secondhand listing
const GET_SECONDHAND_ANALYTICS_TOOL = {
  name: 'get_secondhand_analytics',
  description: 'מביא נתוני חשיפה של מודעת יד שנייה: צפיות, גלישת תמונות, לחיצות טלפון ווואטסאפ.',
  input_schema: {
    type: 'object' as const,
    properties: {
      listing_id: { type: 'string', description: 'ה-UUID של מודעת יד שנייה' },
    },
    required: ['listing_id'],
  },
};

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
        type: 'string',
        description: 'The value to save. marital_status: "single"|"in_relationship"|"married". has_children: true|false. children_ages: array of integers. graduation_year: integer. bio and phone: string.',
      },
    },
    required: ['field', 'value'],
  },
};

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    // --- 1. Auth check ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Admin client: only for auth.getUser() — service role needed to verify JWT
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // User-scoped client: all user data queries go through this — RLS enforces correctness
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // --- 2. Validate request body ---
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const { session_id, is_new_session } = body;
    const rawMessages = Array.isArray(body.messages) ? body.messages : [];

    // Sanitize messages: last 15 only, cap content length, valid roles only
    const safeMsgs = rawMessages
      .slice(-15)
      .map((m: any) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: typeof m.content === 'string' ? m.content.slice(0, 2000) : '',
      }))
      .filter((m: any) => m.content.length > 0);

    // --- 3. Rate limit: check count (fail closed on error) ---
    const today = new Date().toISOString().split('T')[0];
    const { count, error: countError } = await adminClient
      .from('medit_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', `${today}T00:00:00Z`);

    if (countError) {
      console.error('Rate limit check failed:', countError);
      return new Response(
        JSON.stringify({ error: 'שגיאה זמנית, נסה שוב עוד רגע.' }),
        { status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if ((count || 0) >= DAILY_LIMIT) {
      return new Response(
        JSON.stringify({ error: 'הגעת למגבלת 50 הודעות ליום. נסה שוב מחר.' }),
        { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Insert usage counter BEFORE Claude call — prevents race condition where
    // 50 parallel requests all pass the limit check before any insert lands
    await adminClient.from('medit_usage').insert({
      user_id: user.id,
      created_at: new Date().toISOString(),
    });

    // --- 4. Verify session ownership (before any writes) ---
    if (session_id) {
      const { data: sessionData, error: sessionError } = await userClient
        .from('chat_sessions')
        .select('id')
        .eq('id', session_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (sessionError || !sessionData) {
        return new Response(JSON.stringify({ error: 'Invalid session' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // --- 5. Parallel context queries (via userClient — RLS enforced) ---
    const [profileRes, tagsRes, activityRes, pendingRes, searchRes, circlesRes, recentChatsRes, childrenRes] = await Promise.all([
      userClient
        .from('users')
        .select('full_name, year_of_study, academic_track, settlement, origin_city, marital_status, has_children, partner_user_id, bio, interests, graduation_year, phone, children_ages')
        .eq('id', user.id)
        .single(),
      userClient
        .from('user_tag_subscriptions')
        .select('tag_id, tag:bridge_tags(name)')
        .eq('user_id', user.id),
      userClient
        .from('user_activity')
        .select('activity_type, target_type, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      userClient
        .from('pending_actions')
        .select('id, action_type, title, due_date, metadata')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .or('due_date.is.null,due_date.lte.' + new Date().toISOString())
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
      userClient
        .from('chat_interactions')
        .select('question')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      userClient
        .from('user_children')
        .select('id, name, gender, age')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
    ]);

    // Resolve partner first name (only if linked)
    let partnerName: string | null = null;
    if (profileRes.data?.partner_user_id) {
      const { data: partnerData } = await userClient
        .from('users')
        .select('full_name')
        .eq('id', profileRes.data.partner_user_id)
        .single();
      partnerName = partnerData?.full_name?.split(' ')[0] || null;
    }

    const tagIds = (tagsRes.data || []).map((t: any) => t.tag_id);
    const tagNames = (tagsRes.data || [])
      .map((t: any) => t.tag?.name)
      .filter(Boolean) as string[];

    // Sequential bridges query (depends on tagIds from above)
    let bridges: any[] = [];
    if (tagIds.length > 0) {
      const bridgesRes = await userClient
        .from('bridge_tag_assignments')
        .select('bridge:bridges(id, name, description)')
        .in('tag_id', tagIds)
        .limit(20);

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

    // Fetch apartments published by this user (for analytics context)
    const { data: userApartmentsData } = await userClient
      .from('apartments')
      .select('id, address, available_from')
      .eq('contact_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);
    const userApartments: { id: string; address: string; available_from: string }[] = userApartmentsData || [];

    // Fetch secondhand listings published by this user
    const { data: userSecondhandData } = await userClient
      .from('secondhand_listings')
      .select('id, title, price, status, created_at')
      .eq('created_by', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(5);
    const userSecondhand: { id: string; title: string; price: number | null; status: string; created_at: string }[] = userSecondhandData || [];

    // --- 6. Build system prompt ---
    const extras = {
      searchHistory: searchRes.data || [],
      circles: (circlesRes.data || [])
        .map((c: any) => c.circle?.name)
        .filter(Boolean) as string[],
      recentChatTopics: (recentChatsRes.data || [])
        .map((c: any) => c.question?.slice(0, 80))
        .filter(Boolean) as string[],
      partnerName,
      children: (childrenRes.data || []) as { id: string; name: string | null; gender: string | null; age: number }[],
    };

    const missingFields = computeMissingFields(profileRes.data);

    const systemPrompt = buildSystemPrompt(
      profileRes.data,
      tagNames,
      activityRes.data || [],
      pendingRes.data || [],
      bridges,
      !!is_new_session,
      extras,
      missingFields,
      userApartments,
      userSecondhand
    );

    // --- 7. Call Claude API (with tool_use support) ---
    const callClaude = async (messages: any[]): Promise<any> => {
      const requestBody = {
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        tools: [PROFILE_COMPLETION_TOOL, SAVE_CHILD_TOOL, UPDATE_CHILD_TOOL, DELETE_APARTMENT_TOOL, SNOOZE_APARTMENT_TOOL, GET_APARTMENT_ANALYTICS_TOOL, DELETE_SECONDHAND_TOOL, SNOOZE_SECONDHAND_TOOL, GET_SECONDHAND_ANALYTICS_TOOL],
        messages,
      };

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('[medit-chat] Claude API error:', res.status, errText);
        throw new Error(`Claude API returned ${res.status}: ${errText.slice(0, 200)}`);
      }

      return res.json();
    };

    // Allowed fields whitelist with sanitizers — prevents arbitrary column writes
    const ALLOWED_SAVE_FIELDS: Record<string, (v: any) => any> = {
      marital_status: (v: any) => {
        const map: Record<string, string> = {
          single: 'single', רווק: 'single', רווקה: 'single',
          in_relationship: 'in_relationship', בזוגיות: 'in_relationship',
          married: 'married', נשוי: 'married', נשואה: 'married',
        };
        return map[String(v || '').trim()] ?? null;
      },
      has_children: (v: any) => {
        if (typeof v === 'boolean') return v;
        const s = String(v).trim().toLowerCase();
        if (['true', 'yes', 'כן', '1'].includes(s)) return true;
        if (['false', 'no', 'לא', '0'].includes(s)) return false;
        return null;
      },
      children_ages: (v: any) => {
        if (!v && v !== 0) return null;
        const arr = Array.isArray(v) ? v : String(v).trim().split(/[\s,]+/).filter(Boolean);
        const nums = arr.map(Number).filter((n: number) => !isNaN(n) && n >= 0 && n < 100);
        return nums.length > 0 ? nums : null;
      },
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

    // Handle tool_use round-trip — process ALL tool_use blocks in each response
    let toolCallCount = 0;
    while (claudeData.stop_reason === 'tool_use') {
      if (++toolCallCount > 10) {
        console.error('Tool call limit exceeded — breaking loop');
        break;
      }

      const toolUseBlocks = claudeData.content.filter((b: any) => b.type === 'tool_use');
      if (toolUseBlocks.length === 0) break;

      // Process every tool_use block in this response and collect results
      const toolResults: any[] = [];
      for (const toolUseBlock of toolUseBlocks) {
        let toolResult = 'saved';

        if (toolUseBlock.name === 'update_child') {
          const { child_id, name, gender, age } = toolUseBlock.input || {};
          if (!child_id) {
            toolResult = 'missing child_id';
          } else {
            const updates: Record<string, any> = {};
            if (typeof name === 'string' && name.trim()) updates.name = name.trim();
            if (gender === 'male' || gender === 'female') updates.gender = gender;
            if (typeof age === 'number' && age >= 0 && age < 100) updates.age = age;
            else if (age !== undefined) {
              const parsed = parseInt(String(age), 10);
              if (!isNaN(parsed) && parsed >= 0 && parsed < 100) updates.age = parsed;
            }
            if (Object.keys(updates).length === 0) {
              toolResult = 'no valid fields to update';
            } else {
              const { error: updErr } = await adminClient
                .from('user_children')
                .update(updates)
                .eq('id', child_id)
                .eq('user_id', user.id);
              if (updErr) {
                console.error('Failed to update child:', updErr);
                toolResult = 'error updating child';
              }
            }
          }
        } else if (toolUseBlock.name === 'save_child') {
          const { name, gender, age } = toolUseBlock.input || {};
          const validAge = typeof age === 'number' ? age : parseInt(String(age), 10);
          if (!isNaN(validAge) && validAge >= 0 && validAge < 100) {
            const genderMap: Record<string, string> = {
              male: 'male', female: 'female', זכר: 'male', נקבה: 'female', בן: 'male', בת: 'female',
            };
            const { error: childError } = await adminClient.from('user_children').insert({
              user_id: user.id,
              name: typeof name === 'string' && name.trim() ? name.trim() : null,
              gender: genderMap[String(gender || '')] || null,
              age: validAge,
            });
            if (childError) {
              console.error('Failed to save child:', childError);
              toolResult = 'error saving child';
            } else {
              // Ensure has_children is true
              await adminClient.from('users').update({ has_children: true }).eq('id', user.id);
            }
          } else {
            toolResult = 'invalid age — skipped';
          }
        } else if (toolUseBlock.name === 'save_profile_field') {
          const { field, value } = toolUseBlock.input || {};
          const sanitizer = ALLOWED_SAVE_FIELDS[field];

          if (sanitizer) {
            let sanitized = sanitizer(value);
            if (sanitized !== null) {
              // children_ages: append to existing array instead of overwriting
              if (field === 'children_ages') {
                const { data: cur } = await adminClient
                  .from('users').select('children_ages').eq('id', user.id).single();
                const existing: number[] = cur?.children_ages || [];
                sanitized = [...new Set([...existing, ...(sanitized as number[])])];
              }

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

        if (toolUseBlock.name === 'delete_apartment') {
          const { apartment_id, pending_action_id } = toolUseBlock.input || {};
          if (!apartment_id || !pending_action_id) {
            toolResult = 'שגיאה: חסרים פרטי מזהה';
          } else {
            // Verify ownership before delete
            const { data: apt } = await adminClient
              .from('apartments')
              .select('contact_user_id')
              .eq('id', apartment_id)
              .single();
            if (!apt || apt.contact_user_id !== user.id) {
              toolResult = 'שגיאה: אין הרשאה למחוק מודעה זו';
            } else {
              await adminClient.from('apartments').delete().eq('id', apartment_id);
              await adminClient.from('pending_actions')
                .update({ status: 'completed', completed_at: new Date().toISOString() })
                .eq('id', pending_action_id);
              toolResult = 'המודעה נמחקה בהצלחה ✓';
            }
          }
        } else if (toolUseBlock.name === 'snooze_apartment_check') {
          const { pending_action_id } = toolUseBlock.input || {};
          if (!pending_action_id) {
            toolResult = 'שגיאה: חסר מזהה pending_action';
          } else {
            // Read available_from from metadata to decide next check date
            const { data: pa } = await adminClient
              .from('pending_actions')
              .select('metadata')
              .eq('id', pending_action_id)
              .single();

            const availableFrom = pa?.metadata?.available_from
              ? new Date(pa.metadata.available_from as string)
              : null;

            const now = new Date();
            let nextDue: Date;
            let message: string;

            if (availableFrom && availableFrom > now) {
              // Entry date still in the future — ask again the day after
              nextDue = new Date(availableFrom);
              nextDue.setDate(nextDue.getDate() + 1);
              const heDate = nextDue.toLocaleDateString('he-IL');
              message = `בסדר! אבקש שתעדכן אותי כשהמודעה כבר לא רלוונטית. אחזור אליך לאחר תאריך הכניסה (${heDate}) לבדוק ✓`;
            } else {
              // Entry date already passed — check again in 7 days
              nextDue = new Date();
              nextDue.setDate(now.getDate() + 7);
              message = 'בסדר, אחזור אליך שוב בעוד שבוע ✓';
            }

            await adminClient.from('pending_actions')
              .update({ due_date: nextDue.toISOString() })
              .eq('id', pending_action_id)
              .eq('user_id', user.id);

            toolResult = message;
          }
        } else if (toolUseBlock.name === 'get_apartment_analytics') {
          const { apartment_id } = toolUseBlock.input || {};
          if (!apartment_id) {
            toolResult = 'שגיאה: חסר מזהה מודעה';
          } else {
            const { data: apt } = await adminClient
              .from('apartments')
              .select('contact_user_id, address')
              .eq('id', apartment_id)
              .single();
            if (!apt || apt.contact_user_id !== user.id) {
              toolResult = 'שגיאה: אין גישה לנתוני מודעה זו';
            } else {
              const { data: acts } = await adminClient
                .from('user_activity')
                .select('activity_type, metadata')
                .eq('target_type', 'apartment')
                .eq('target_id', apartment_id)
                .neq('user_id', user.id); // exclude owner's own views
              const views    = acts?.filter((a: any) => a.activity_type === 'view').length ?? 0;
              const images   = acts?.filter((a: any) => a.activity_type === 'react' && a.metadata?.action === 'image_scroll').length ?? 0;
              const phones   = acts?.filter((a: any) => a.activity_type === 'react' && a.metadata?.action === 'phone_click').length ?? 0;
              const whatsapp = acts?.filter((a: any) => a.activity_type === 'react' && a.metadata?.action === 'whatsapp_click').length ?? 0;
              toolResult = `נתוני חשיפה — ${apt.address}:\n👁 צפיות: ${views}\n🖼 גלישת תמונות: ${images}\n📞 לחיצות טלפון: ${phones}\n💬 שליחות וואטסאפ: ${whatsapp}`;
            }
          }
        } else if (toolUseBlock.name === 'delete_secondhand_listing') {
          const { listing_id, pending_action_id } = toolUseBlock.input || {};
          if (!listing_id || !pending_action_id) {
            toolResult = 'שגיאה: חסרים פרטי מזהה';
          } else {
            const { data: listing } = await adminClient
              .from('secondhand_listings')
              .select('created_by, title')
              .eq('id', listing_id)
              .single();
            if (!listing || listing.created_by !== user.id) {
              toolResult = 'שגיאה: אין הרשאה למחוק מודעה זו';
            } else {
              await adminClient.from('secondhand_listings').delete().eq('id', listing_id);
              await adminClient.from('pending_actions')
                .update({ status: 'completed', completed_at: new Date().toISOString() })
                .eq('id', pending_action_id);
              toolResult = `המודעה "${listing.title}" נמחקה בהצלחה ✓`;
            }
          }
        } else if (toolUseBlock.name === 'snooze_secondhand_check') {
          const { pending_action_id } = toolUseBlock.input || {};
          if (!pending_action_id) {
            toolResult = 'שגיאה: חסר מזהה pending_action';
          } else {
            const nextDue = new Date();
            nextDue.setDate(nextDue.getDate() + 30);
            await adminClient.from('pending_actions')
              .update({ due_date: nextDue.toISOString() })
              .eq('id', pending_action_id)
              .eq('user_id', user.id);
            toolResult = 'בסדר, אחזור אליך בעוד 30 יום לבדוק ✓';
          }
        } else if (toolUseBlock.name === 'get_secondhand_analytics') {
          const { listing_id } = toolUseBlock.input || {};
          if (!listing_id) {
            toolResult = 'שגיאה: חסר מזהה מודעה';
          } else {
            const { data: listing } = await adminClient
              .from('secondhand_listings')
              .select('created_by, title')
              .eq('id', listing_id)
              .single();
            if (!listing || listing.created_by !== user.id) {
              toolResult = 'שגיאה: אין גישה לנתוני מודעה זו';
            } else {
              const { data: acts } = await adminClient
                .from('user_activity')
                .select('activity_type, metadata')
                .eq('target_type', 'secondhand')
                .eq('target_id', listing_id)
                .neq('user_id', user.id);
              const views    = acts?.filter((a: any) => a.activity_type === 'view').length ?? 0;
              const images   = acts?.filter((a: any) => a.activity_type === 'react' && a.metadata?.action === 'image_scroll').length ?? 0;
              const phones   = acts?.filter((a: any) => a.activity_type === 'react' && a.metadata?.action === 'phone_click').length ?? 0;
              const whatsapp = acts?.filter((a: any) => a.activity_type === 'react' && a.metadata?.action === 'whatsapp_click').length ?? 0;
              toolResult = `נתוני חשיפה — ${listing.title}:\n👁 צפיות: ${views}\n🖼 גלישת תמונות: ${images}\n📞 לחיצות טלפון: ${phones}\n💬 שליחות וואטסאפ: ${whatsapp}`;
            }
          }
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUseBlock.id,
          content: toolResult,
        });
      }

      // Send all tool_results back to Claude in a single user message
      conversationMessages = [
        ...conversationMessages,
        { role: 'assistant', content: claudeData.content },
        { role: 'user', content: toolResults },
      ];

      claudeData = await callClaude(conversationMessages);
    }

    // Extract final text response
    assistantResponse = claudeData.content
      ?.filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('') || 'מצטער, לא הצלחתי לעבד את הבקשה.';

    // --- 8. Persist assistant message + update session ---
    if (session_id) {
      const now = new Date().toISOString();
      const updatePayload: Record<string, any> = { last_message_at: now };

      if (is_new_session) {
        const firstUserMsg = safeMsgs.find((m: any) => m.role === 'user');
        if (firstUserMsg?.content) {
          updatePayload.title = firstUserMsg.content.slice(0, 40);
        }
      }

      // userClient enforces RLS — only the session owner can write here
      const [msgResult, sessionResult] = await Promise.all([
        userClient.from('chat_messages').insert({
          session_id,
          user_id: user.id,
          role: 'assistant',
          content: assistantResponse,
        }),
        userClient.from('chat_sessions').update(updatePayload).eq('id', session_id),
      ]);

      if (msgResult.error) console.error('Failed to save assistant message:', msgResult.error);
      if (sessionResult.error) console.error('Failed to update session:', sessionResult.error);
    }

    // --- 9. Log to chat_interactions (awaited — analytics, low latency ~5ms) ---
    const lastUserMessage = [...safeMsgs].reverse().find((m: any) => m.role === 'user');
    if (lastUserMessage?.content) {
      const { error: logError } = await userClient.from('chat_interactions').insert({
        user_id: user.id,
        question: lastUserMessage.content,
        topic_tags: extractTopicTags(lastUserMessage.content, tagNames),
        session_id: session_id || null,
      });
      if (logError) console.error('chat_interactions log failed:', logError);
    }

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
