import { supabase } from '@/core/services/supabase';
import type { InterviewApi } from '@/core/services/interviewApi';
import type {
  FeedbackMessage,
  FeedbackResult,
  GenerateQuestionsResult,
  InterviewQuestion,
  InterviewSession,
  PlanInfo,
  SubscriptionTier,
} from '@/core/types';

interface SessionRow {
  id: string;
  user_id: string;
  role: string;
  company: string;
  job_description: string;
  questions: InterviewQuestion[];
  created_at: string;
}

interface MessageRow {
  id: string;
  session_id: string;
  question_id: string;
  role: 'user' | 'coach';
  content: string;
  created_at: string;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  tier: SubscriptionTier;
  status: string;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

function toSession(row: SessionRow, feedback: Record<string, FeedbackMessage[]> = {}): InterviewSession {
  return {
    id: row.id,
    role: row.role,
    company: row.company,
    jobDescription: row.job_description,
    questions: row.questions,
    feedback,
    createdAt: row.created_at,
  };
}

function toMessage(row: MessageRow): FeedbackMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  };
}

function monthStartIso(): string {
  return `${new Date().toISOString().slice(0, 7)}-01T00:00:00Z`;
}

async function countSessionsThisMonth(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('interview_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', monthStartIso());
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function fetchThread(sessionId: string): Promise<Record<string, FeedbackMessage[]>> {
  const { data, error } = await supabase
    .from('session_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);

  const grouped: Record<string, FeedbackMessage[]> = {};
  for (const row of (data ?? []) as MessageRow[]) {
    const key = row.question_id;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(toMessage(row));
  }
  return grouped;
}

export const supabaseInterviewApi: InterviewApi = {
  async generateQuestions(jobDescription): Promise<GenerateQuestionsResult> {
    const { data, error } = await supabase.functions.invoke('generate-questions', {
      body: { jobDescription },
    });
    if (error) {
      const message = (error as { message?: string })?.message ?? 'generate_questions_failed';
      throw new Error(message.includes('free_limit') ? 'FREE_LIMIT_REACHED' : message);
    }
    const session = (data as { session?: SessionRow })?.session;
    if (!session) throw new Error('generate_questions_failed');
    return { session: toSession(session) };
  },

  async getSessions(): Promise<InterviewSession[]> {
    const { data, error } = await supabase
      .from('interview_sessions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as SessionRow[]).map((row) => toSession(row));
  },

  async getSession(id): Promise<InterviewSession | null> {
    const { data, error } = await supabase
      .from('interview_sessions')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return toSession(data as SessionRow, await fetchThread(id));
  },

  async deleteSession(id): Promise<void> {
    const { error } = await supabase.from('interview_sessions').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async submitAnswer(sessionId, questionId, answer): Promise<FeedbackResult> {
    const { data: row } = await supabase
      .from('interview_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();
    const question = ((row?.questions ?? []) as InterviewQuestion[]).find(
      (q) => q.id === questionId
    );

    const { error } = await supabase.functions.invoke('feedback', {
      body: {
        sessionId,
        questionId,
        question: question?.question ?? '',
        answer,
      },
    });
    if (error) throw new Error((error as { message?: string })?.message ?? 'feedback_failed');

    const thread = await fetchThread(sessionId);
    return { answers: thread[questionId] ?? [] };
  },

  async getPlan(): Promise<PlanInfo> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { tier: 'free', freeLimit: 3, usedThisMonth: 0, proPriceKes: 1, renewsAt: null };
    }

    const [usedThisMonth, subResult] = await Promise.all([
      countSessionsThisMonth(user.id),
      supabase.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle(),
    ]);
    const sub = subResult.data as SubscriptionRow | null;

    return {
      tier: sub?.tier ?? 'free',
      freeLimit: 3,
      usedThisMonth,
      proPriceKes: 1,
      renewsAt: sub?.current_period_end ?? null,
    };
  },
};
