import OpenAI from 'npm:openai@4';
import { z } from 'npm:zod@3';
import { createAuthedClient } from '../_shared/supabase.ts';
import { corsHeaders, json } from '../_shared/cors.ts';

// Provider: OpenRouter (preferred) or OpenAI. Both speak the OpenAI API.
// Set OPENROUTER_API_KEY + optional OPENROUTER_MODEL (defaults to a free
// tier model so a zero-balance OpenRouter account works out of the box),
// or OPENAI_API_KEY.
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

const QuestionSchema = z.object({
  question: z.string().min(10),
  sampleAnswer: z.string().min(20),
  focus: z.string().min(2),
});

const ResultSchema = z.object({
  role: z.string().min(2),
  company: z.string().nullable().optional(),
  questions: z.array(QuestionSchema).min(3).max(6),
});

function monthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createAuthedClient(req.headers.get('Authorization'));
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: 'unauthorized' }, 401);

    const body = await req.json().catch(() => null);
    const jobDescription = String(body?.jobDescription ?? '').trim();
    if (jobDescription.length < 40) {
      return json({ error: 'job_description_too_short' }, 400);
    }

    // ---- server-side free-tier quota: count sessions started this month
    const mk = monthKey();
    const { count, error: countError } = await supabase
      .from('interview_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', `${mk}-01T00:00:00Z`);
    if (countError) return json({ error: 'quota_check_failed' }, 500);

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('tier')
      .eq('user_id', user.id)
      .maybeSingle();
    const tier = sub?.tier ?? 'free';
    const used = count ?? 0;
    if (tier === 'free' && used >= 3) {
      return json({ error: 'free_limit_reached' }, 402);
    }

    // ---- AI generation (grounded strictly in the pasted JD)
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are an expert interview coach. From a job description, produce tailored interview questions and concise sample answers. Ground everything strictly in the text provided; do not invent company details. Respond ONLY with JSON: { "role": string, "company": string|null, "questions": [{ "question", "sampleAnswer", "focus" }] } where focus is a short category like "Technical depth" or "Product thinking". 3-5 questions.',
        },
        { role: 'user', content: jobDescription },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return json({ error: 'ai_empty_response' }, 502);
    const parsed = ResultSchema.parse(JSON.parse(raw));

    const questions = parsed.questions.map((q) => ({
      id: crypto.randomUUID(),
      question: q.question,
      sampleAnswer: q.sampleAnswer,
      focus: q.focus,
    }));

    const { data: sessionRow, error: insertError } = await supabase
      .from('interview_sessions')
      .insert({
        user_id: user.id,
        role: parsed.role,
        company: parsed.company ?? '',
        job_description: jobDescription,
        questions,
      })
      .select('*')
      .single();
    if (insertError || !sessionRow) {
      return json({ error: 'session_insert_failed' }, 500);
    }

    return json({ session: sessionRow });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'internal_error';
    if (message.includes('free_limit_reached')) return json({ error: 'free_limit_reached' }, 402);
    return json({ error: message }, 500);
  }
});
