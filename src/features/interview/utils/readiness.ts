import type { CompetencyScores, FeedbackMessage, InterviewSession } from '@/core/types';

export interface ReadinessStats {
  sessionsCompleted: number;
  questionsGenerated: number;
  answersGiven: number;
  /** Average answer rating (1-10) on a 0-100 scale, null until scores exist. */
  readinessIndex: number | null;
  /** Index change vs the previous month, null when either month has no scores. */
  trend: number | null;
  /** Mean per competency across scored answers, null until scores exist. */
  competencies: CompetencyScores | null;
  /** How many answers carried a rating — drives the radar fallback state. */
  scoredCount: number;
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/**
 * Aggregates a user's sessions into Readiness dashboard stats.
 * All data comes from the sessions query (which batch-loads messages);
 * no extra requests. Legacy sessions without ratings simply don't
 * contribute to score-based metrics.
 */
export function computeReadiness(sessions: InterviewSession[]): ReadinessStats {
  const messages = (sessions ?? []).flatMap((session) =>
    Object.values(session.feedback ?? {}).flat()
  );

  const critiques = messages.filter(
    (message): message is FeedbackMessage & { rating: number } =>
      message.role === 'coach' && typeof message.rating === 'number'
  );

  const avg10 = (list: { rating: number }[]): number | null =>
    list.length
      ? Math.round((list.reduce((sum, m) => sum + (m.rating ?? 0), 0) / list.length) * 10)
      : null;

  const nowKey = monthKey(new Date().toISOString());
  const thisMonth = critiques.filter((m) => monthKey(m.createdAt) === nowKey);
  const priorMonth = critiques.filter((m) => monthKey(m.createdAt) < nowKey);
  const current = avg10(thisMonth);
  const previous = avg10(priorMonth);
  const trend = current !== null && previous !== null ? current - previous : null;

  const scored = critiques.filter((m) => m.scores);
  const meanOf = (axis: keyof CompetencyScores): number =>
    Math.round(
      (scored.reduce((sum, m) => sum + (m.scores?.[axis] ?? 0), 0) / scored.length) * 10
    ) / 10;
  const competencies = scored.length
    ? {
        clarity: meanOf('clarity'),
        structure: meanOf('structure'),
        depth: meanOf('depth'),
        communication: meanOf('communication'),
      }
    : null;

  return {
    sessionsCompleted: sessions?.length ?? 0,
    questionsGenerated: (sessions ?? []).reduce((sum, s) => sum + s.questions.length, 0),
    answersGiven: messages.filter((m) => m.role === 'user').length,
    readinessIndex: avg10(critiques),
    trend,
    competencies,
    scoredCount: critiques.length,
  };
}
