import type {
  FeedbackResult,
  GenerateQuestionsResult,
  InterviewSession,
  PlanInfo,
} from '@/core/types';

/**
 * Contract the screens depend on. Swap the implementation (mock -> Supabase
 * Edge Functions) without touching any UI by changing the import in
 * src/core/services/interviewApi.ts.
 */
export interface InterviewApi {
  generateQuestions(jobDescription: string): Promise<GenerateQuestionsResult>;
  getSessions(): Promise<InterviewSession[]>;
  getSession(id: string): Promise<InterviewSession | null>;
  deleteSession(id: string): Promise<void>;
  submitAnswer(
    sessionId: string,
    questionId: string,
    answer: string
  ): Promise<FeedbackResult>;
  getPlan(): Promise<PlanInfo>;
}

/**
 * Active implementation. Supabase backend (Edge Functions). For local
 * demos without network, swap back to the mock:
 *   import { mockInterviewApi } from '@/core/services/mockInterviewApi';
 */
import { supabaseInterviewApi } from '@/core/services/supabaseInterviewApi';

export const interviewApi: InterviewApi = supabaseInterviewApi;

