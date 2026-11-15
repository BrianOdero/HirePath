import { describe, expect, it } from 'vitest';
import type { InterviewSession } from '@/core/types';
import { computeReadiness } from '@/features/interview/utils/readiness';

function session(feedback: Record<string, Array<{ role: 'user' | 'coach'; rating?: number; scores?: Record<string, number> }>>, createdAt = '2026-11-10T10:00:00Z'): InterviewSession {
  return {
    id: 's1',
    role: 'Frontend Engineer',
    company: 'Acme',
    jobDescription: 'jd',
    questions: [{ id: 'q1', question: 'Q', sampleAnswer: 'A', focus: 'f' }],
    feedback: Object.fromEntries(
      Object.entries(feedback).map(([key, msgs]) => [
        key,
        msgs.map((m, i) => ({ id: `${key}-${i}`, role: m.role, content: 'c', createdAt: createdAt, rating: m.rating, scores: m.scores as never })),
      ])
    ),
    createdAt,
  };
}

describe('computeReadiness', () => {
  it('returns zeroed stats and null scores for empty/legacy data', () => {
    const empty = computeReadiness([]);
    expect(empty).toEqual({
      sessionsCompleted: 0,
      questionsGenerated: 0,
      answersGiven: 0,
      readinessIndex: null,
      trend: null,
      competencies: null,
      scoredCount: 0,
    });

    // Legacy session: messages exist but no ratings were persisted.
    const legacy = computeReadiness([
      session({ q1: [{ role: 'user' }, { role: 'coach' }] }),
      session({ q1: [{ role: 'user' }] }),
    ]);
    expect(legacy.sessionsCompleted).toBe(2);
    expect(legacy.answersGiven).toBe(2);
    expect(legacy.readinessIndex).toBeNull();
    expect(legacy.competencies).toBeNull();
  });

  it('computes index, trend and competency means across sessions', () => {
    const now = new Date();
    const nowIso = now.toISOString();
    const prior = new Date(now);
    prior.setMonth(prior.getMonth() - 1);
    const priorIso = prior.toISOString();

    const stats = computeReadiness([
      // this month: ratings 8 and 9 → avg 8.5 → index 85
      session({ q1: [{ role: 'user' }, { role: 'coach', rating: 8, scores: { clarity: 7, structure: 8, depth: 9, communication: 8 } }] }, nowIso),
      session({ q1: [{ role: 'user' }, { role: 'coach', rating: 9, scores: { clarity: 9, structure: 8, depth: 7, communication: 9 } }] }, nowIso),
      // prior month: rating 7 → trend = 85 - 70 = +15
      session({ q1: [{ role: 'user' }, { role: 'coach', rating: 7 }] }, priorIso),
      // unrated coach message + extra questions inflate counts only
      session({ q1: [{ role: 'coach' }] }, nowIso),
    ]);

    expect(stats.sessionsCompleted).toBe(4);
    expect(stats.questionsGenerated).toBe(4);
    expect(stats.answersGiven).toBe(3);
    expect(stats.scoredCount).toBe(3);
    // All-time average: (8+9+7)/3 = 8 → 80. The month trend is 85 vs 70.
    expect(stats.readinessIndex).toBe(80);
    expect(stats.trend).toBe(15);
    expect(stats.competencies).toEqual({ clarity: 8, structure: 8, depth: 8, communication: 8.5 });
  });

  it('trend stays null when one month has no scores', () => {
    const stats = computeReadiness([
      session({ q1: [{ role: 'coach', rating: 8 }] }),
    ]);
    expect(stats.readinessIndex).toBe(80);
    expect(stats.trend).toBeNull();
  });
});
