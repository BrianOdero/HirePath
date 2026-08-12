import OpenAI from 'npm:openai@4';
import { z } from 'npm:zod@3';
import { createAuthedClient } from '../_shared/supabase.ts';
import { corsHeaders, json } from '../_shared/cors.ts';

// Provider: OpenRouter (preferred) or OpenAI. Both speak the OpenAI API.
function modelDefaults(): { key: string; baseUrl: string; model: string } {
  const openrouterKey = Deno.env.get('OPENROUTER_API_KEY');
  if (openrouterKey) {
    return {
      key: openrouterKey,
      baseUrl: Deno.env.get('OPENROUTER_BASE_URL') ?? 'https://openrouter.ai/api/v1',
      model: Deno.env.get('OPENROUTER_MODEL') ?? 'nvidia/nemotron-3-super-120b-a12b:free',
    };
  }
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) throw new Error('Missing AI provider key: set OPENROUTER_API_KEY or OPENAI_API_KEY');
  return { key: openaiKey, baseUrl: null as string | null, model: 'gpt-4o-mini' };
}

const provider = modelDefaults();
const openai = new OpenAI({
  apiKey: provider.key,
  ...(provider.baseUrl ? { baseURL: provider.baseUrl } : {}),
});
const AI_MODEL = provider.model;

const BodySchema = z.object({
  sessionId: z.string().uuid(),
  questionId: z.string().uuid(),
  question: z.string().min(5),
  answer: z.string().min(1),
});

const FeedbackSchema = z.object({
  rating: z.number().min(1).max(10),
  critique: z.string().min(20),
  followUp: z.string().min(10),
});

const MAX_MESSAGES = 12;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createAuthedClient(req.headers.get('Authorization'));
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: 'unauthorized' }, 401);

    const body = BodySchema.parse(await req.json().catch(() => null));

    // session must belong to the caller
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('*')
      .eq('id', body.sessionId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (sessionError || !session) return json({ error: 'session_not_found' }, 404);

    // cap conversation length to bound token cost
    const { count } = await supabase
      .from('session_messages')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', body.sessionId);
    if ((count ?? 0) >= MAX_MESSAGES) {
      return json({ error: 'conversation_limit' }, 429);
    }

    // ---- insert the user's answer
    const { error: userInsertError } = await supabase.from('session_messages').insert({
      session_id: body.sessionId,
      question_id: body.questionId,
      role: 'user',
      content: body.answer,
    });
    if (userInsertError) return json({ error: 'message_insert_failed' }, 500);

    // ---- AI critique + follow-up grounded in the question
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are an expert interview coach. Critique the candidate answer against the given interview question. Be specific, honest, and encouraging. Respond ONLY with JSON: { "rating": number 1-10, "critique": string (2-4 sentences), "followUp": string (a short follow-up question) }.',
        },
        {
          role: 'user',
          content: `Question: ${body.question}\n\nCandidate answer: ${body.answer}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return json({ error: 'ai_empty_response' }, 502);
    const fb = FeedbackSchema.parse(JSON.parse(raw));

    // ---- persist critique + follow-up coach messages (plain text,
    // the chat UI renders content as-is)
    const { error: coachInsertError } = await supabase.from('session_messages').insert([
      {
        session_id: body.sessionId,
        question_id: body.questionId,
        role: 'coach',
        content: fb.critique,
      },
      {
        session_id: body.sessionId,
        question_id: body.questionId,
        role: 'coach',
        content: fb.followUp,
      },
    ]);
    if (coachInsertError) return json({ error: 'message_insert_failed' }, 500);

    return json({
      rating: fb.rating,
      critique: fb.critique,
      followUp: fb.followUp,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'internal_error';
    return json({ error: message }, 500);
  }
});
