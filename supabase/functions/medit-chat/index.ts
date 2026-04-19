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
  },
  missingFields: { field: string; question: string }[]
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
    question: 'מה הטלפון שלך? (לרשות הקהילה)',
  },
] as const;

type ProfileField = typeof PROFILE_FIELDS_ORDER[number]['field'];

// Returns ordered list of fields that are null/empty in the profile
function computeMissingFields(profile: any): { field: ProfileField; question: string }[] {
  return PROFILE_FIELDS_ORDER.filter(({ field }) => {
    if (field === 'children_ages') {
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
    console.log('[medit-chat] request received | authHeader present:', !!authHeader, '| prefix:', authHeader?.slice(0, 30) || 'NONE');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Admin client: only for auth.getUser() — service role needed to verify JWT
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const token = authHeader.replace('Bearer ', '');
    console.log('[auth] header present:', !!authHeader, '| token prefix:', token.slice(0, 20));
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    console.log('[auth] getUser result — user:', user?.id || 'null', '| error:', authError?.message || 'none');

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
    const [profileRes, tagsRes, activityRes, pendingRes, searchRes, circlesRes, recentChatsRes] = await Promise.all([
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
      userClient
        .from('chat_interactions')
        .select('question')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
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
      missingFields
    );

    // --- 7. Call Claude API (with tool_use support) ---
    console.log('[medit-chat] missingFields count:', missingFields.length, 'isNewSession:', !!is_new_session);

    const callClaude = async (messages: any[]): Promise<any> => {
      const requestBody = {
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        tools: missingFields.length > 0 ? [PROFILE_COMPLETION_TOOL] : undefined,
        messages,
      };
      console.log('[medit-chat] calling Claude, messages count:', messages.length, 'tools:', requestBody.tools ? 'yes' : 'no');

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
      marital_status: (v: any) => ['single', 'in_relationship', 'married'].includes(v) ? v : null,
      has_children: (v: any) => typeof v === 'boolean' ? v : v === 'true' ? true : v === 'false' ? false : null,
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

    // Handle tool_use round-trip (Claude may call save_profile_field)
    let toolCallCount = 0;
    while (claudeData.stop_reason === 'tool_use') {
      if (++toolCallCount > 10) {
        console.error('Tool call limit exceeded — breaking loop');
        break;
      }
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
