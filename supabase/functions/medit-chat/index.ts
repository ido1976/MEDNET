// Supabase Edge Function: medit-chat
// Calls Claude API with MEDNET context for the MEDIT assistant

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const SYSTEM_PROMPT = `אתה MEDIT – העוזר החכם של קהילת MEDNET, פלטפורמה לסטודנטים לרפואה בצפת.

כללי התנהגות:
1. ענה רק על בסיס מידע שקיים במערכת MEDNET - גשרים, דיונים, אירועים, דירות, טרמפים, מחירון.
2. בכל תשובה, ספק קישור למקור המידע הרלוונטי במערכת.
3. אם אין לך מידע על הנושא, הצע אחת מהאפשרויות הבאות:
   - לשאול ב"הקהילה שואלת"
   - לבקש פתיחת גשר חדש בנושא
   - לפתוח דיון בגשר רלוונטי
4. לעולם אל תמציא מידע. אם אינך יודע - אמור שאינך יודע.
5. דבר עברית בלבד.
6. היה ידידותי, תמציתי ומועיל.
7. אם מישהו שואל על נושאים רפואיים ספציפיים, הפנה אותו למרצים או לגשרים הרלוונטיים.`;

const DAILY_LIMIT = 50;

serve(async (req) => {
  try {
    // CORS
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      });
    }

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // Rate limiting: check daily usage
    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabase
      .from('medit_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', `${today}T00:00:00Z`);

    if ((count || 0) >= DAILY_LIMIT) {
      return new Response(
        JSON.stringify({ error: 'הגעת למגבלת 50 הודעות ליום. נסה שוב מחר.' }),
        { status: 429 }
      );
    }

    const { messages } = await req.json();

    // Fetch relevant context from MEDNET
    const [bridgesRes, eventsRes, discussionsRes] = await Promise.all([
      supabase.from('bridges').select('name, description').eq('status', 'active').limit(20),
      supabase.from('events').select('title, date, description').gte('date', new Date().toISOString()).limit(10),
      supabase.from('discussions').select('title, tag').order('last_message_at', { ascending: false }).limit(10),
    ]);

    const context = `
מידע עדכני מ-MEDNET:

גשרים פעילים: ${bridgesRes.data?.map((b: any) => `${b.name} - ${b.description}`).join('; ') || 'אין'}

אירועים קרובים: ${eventsRes.data?.map((e: any) => `${e.title} (${e.date})`).join('; ') || 'אין'}

דיונים אחרונים: ${discussionsRes.data?.map((d: any) => `${d.title} [${d.tag}]`).join('; ') || 'אין'}
`;

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: `${SYSTEM_PROMPT}\n\n${context}`,
        messages: messages.slice(-10), // Last 10 messages for context
      }),
    });

    const data = await response.json();

    // Log usage
    await supabase.from('medit_usage').insert({
      user_id: user.id,
      created_at: new Date().toISOString(),
    });

    const assistantResponse = data.content?.[0]?.text || 'מצטער, לא הצלחתי לעבד את הבקשה.';

    return new Response(
      JSON.stringify({ response: assistantResponse }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
});
