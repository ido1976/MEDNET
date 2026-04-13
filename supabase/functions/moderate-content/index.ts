// Supabase Edge Function: moderate-content
// AI-based content moderation for user-generated content

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY')!;

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      });
    }

    const { content } = await req.json();

    if (!content || typeof content !== 'string') {
      return new Response(
        JSON.stringify({ flagged: false }),
        { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Use Claude to check for offensive content
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        system: 'You are a content moderator for a medical student community platform. Analyze the given text and respond with JSON: {"flagged": true/false, "reason": "explanation"}. Flag content that is: offensive, discriminatory, sexually explicit, threatening, spam, or contains personal attacks. Do NOT flag: medical terminology, academic discussions, mild disagreements, or Hebrew slang.',
        messages: [
          { role: 'user', content: `בדוק את התוכן הבא:\n\n${content}` },
        ],
      }),
    });

    const data = await response.json();
    const resultText = data.content?.[0]?.text || '{"flagged": false}';

    let result;
    try {
      result = JSON.parse(resultText);
    } catch {
      result = { flagged: false };
    }

    return new Response(
      JSON.stringify(result),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    // On error, don't block content
    return new Response(
      JSON.stringify({ flagged: false }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
});
