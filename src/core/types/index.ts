export interface Profile {
  id: string;
  email: string;
  full_name?: string | null;
  avatar_url?: string | null;
  created_at: string;
}

export type SubscriptionTier = 'free' | 'pro';

export interface Subscription {
  id: string;
  user_id: string;
  tier: SubscriptionTier;
  sessions_used_this_month: number;
  month_key: string;
  renews_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanInfo {
  tier: SubscriptionTier;
  freeLimit: number;
  usedThisMonth: number;
  proPriceKes: number;
  renewsAt?: string | null;
}

export interface InterviewQuestion {
  id: string;
  question: string;
  sampleAnswer: string;
  focus: string;
}

export type FeedbackRole = 'user' | 'coach';

/** Per-answer competency breakdown emitted by the feedback function. */
export interface CompetencyScores {
  clarity: number;
  structure: number;
  depth: number;
  communication: number;
}

export interface FeedbackMessage {
  id: string;
  role: FeedbackRole;
  content: string;
  createdAt: string;
  /** Overall 1-10 score, present on coach critique messages (new sessions). */
  rating?: number;
  scores?: CompetencyScores;
}

export interface InterviewSession {
  id: string;
  role: string;
  company: string;
  jobDescription: string;
  questions: InterviewQuestion[];
  feedback: Record<string, FeedbackMessage[]>;
  createdAt: string;
}

export interface GenerateQuestionsResult {
  session: InterviewSession;
}

export interface FeedbackResult {
  answers: FeedbackMessage[];
}
