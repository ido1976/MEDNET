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
