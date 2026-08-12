import { Preferences } from '@capacitor/preferences';
import type { InterviewApi } from '@/core/services/interviewApi';
import type {
  FeedbackMessage,
  FeedbackResult,
  GenerateQuestionsResult,
  InterviewQuestion,
  InterviewSession,
  PlanInfo,
} from '@/core/types';

const SESSIONS_KEY = 'hirepath.mock.sessions';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uid(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

function daysAgoIso(days: number, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

interface QuestionBankEntry {
  focus: string;
  match: RegExp;
  questions: string[];
}

const QUESTION_BANKS: QuestionBankEntry[] = [
  {
    focus: 'Technical depth',
    match: /(engineer|developer|software|react|vue|typescript|backend|full.?stack|front.?end|data)/i,
    questions: [
      'Walk me through a recent technical project you shipped. What was the hardest problem, and how did you approach it?',
      'How do you decide between speed and code quality when a deadline is tight?',
      'Describe a time you had to debug a production issue you did not fully understand at first.',
      'How do you approach code reviews — as an author and as a reviewer?',
      'Tell me about a technical decision you made that you later regretted. What did you learn?',
    ],
  },
  {
    focus: 'Product thinking',
    match: /(product|manager|growth|strategy|roadmap|stakeholder|business)/i,
    questions: [
      'How do you prioritise between competing features when every stakeholder calls theirs urgent?',
      'Walk me through a metric you moved. What did you change, and how did you know it worked?',
      'Tell me about a time a launch did not go as planned. How did you recover?',
      'How do you decide what not to build?',
      'Describe how you would take a vague idea and turn it into a scoped deliverable.',
    ],
  },
  {
    focus: 'General',
    match: /.*/,
    questions: [
      'Tell me about yourself and why this role interests you.',
      'Describe a time you disagreed with a colleague and how you resolved it.',
      'How do you handle feedback — especially when you disagree with it?',
      'Where do you want to be professionally in three years?',
      'What is the last thing you taught yourself? How did you approach learning it?',
    ],
  },
];

export function parseJobDescription(jobDescription: string): { role: string; company: string } {
  const lines = jobDescription.split('\n').map((l) => l.trim()).filter(Boolean);
  const first = lines.find((l) => l.length >= 4) ?? 'Open position';
  const atMatch = first.match(/^(.+?)\s+(?:at|–|-|—)\s+(.+?)\s*$/i);
  const company =
    jobDescription.match(/(?:at|–|-|—)\s+([A-Z][A-Za-z0-9&.\- ]{2,40})$/i)?.[1] ??
    'Our team';
  if (atMatch) {
    return { role: atMatch[1].replace(/\.+$/, ''), company: atMatch[2] };
  }
  return { role: first.replace(/\.+$/, ''), company };
}

function buildQuestions(jobDescription: string): InterviewQuestion[] {
  const questions: InterviewQuestion[] = [];
  for (const bank of QUESTION_BANKS) {
    if (bank.match.test(jobDescription)) {
      bank.questions.slice(0, 3).forEach((questionText) => {
        questions.push({
          id: uid(),
          question: questionText,
          focus: bank.focus,
          sampleAnswer: `A strong answer uses STAR: set the Situation, describe the Task, explain the Action you took, and close with measurable Result. Tie it back to the responsibilities in this job description rather than listing generic duties.`,
        });
      });
    }
  }
  return questions.slice(0, 5);
}

function upsertSession(sessions: InterviewSession[], session: InterviewSession): void {
  const index = sessions.findIndex((s) => s.id === session.id);
  if (index === -1) {
    sessions.unshift(session);
  } else {
    sessions[index] = session;
  }
}

async function persist(sessions: InterviewSession[]): Promise<void> {
  await Preferences.set({ key: SESSIONS_KEY, value: JSON.stringify(sessions) });
}

async function loadSessions(): Promise<InterviewSession[]> {
  const { value } = await Preferences.get({ key: SESSIONS_KEY });
  if (!value) return [];
  try {
    return JSON.parse(value) as InterviewSession[];
  } catch {
    return [];
  }
}

function seedSessions(): InterviewSession[] {
  const mk = (
    id: string,
    role: string,
    company: string,
    createdAt: string,
    questionTexts: { q: string; focus: string }[]
  ): InterviewSession => ({
    id,
    role,
    company,
    jobDescription: `${role} at ${company}\nWe are hiring a ${role.toLowerCase()} to help us scale.`,
    createdAt,
    questions: questionTexts.map((item) => ({
      id: uid(),
      question: item.q,
      focus: item.focus,
      sampleAnswer: `A strong answer uses STAR and references this company's context.`,
    })),
    feedback: {},
  });

  return [
    mk(
      'seed-fe-1',
      'Senior Frontend Engineer',
      'M-KOPA',
      daysAgoIso(0, 9),
      [
        { q: 'Walk me through a recent frontend project you shipped.', focus: 'Technical depth' },
        { q: 'How do you approach performance budgets on a growing React app?', focus: 'Technical depth' },
        { q: 'Describe a time you had to refactor legacy code without breaking users.', focus: 'Technical depth' },
      ]
    ),
    mk(
      'seed-pm-1',
      'Product Manager',
      'Cellulant',
      daysAgoIso(1, 14),
      [
        { q: 'How do you prioritise between competing features?', focus: 'Product thinking' },
        { q: 'Walk me through a metric you moved.', focus: 'Product thinking' },
        { q: 'How do you decide what not to build?', focus: 'Product thinking' },
      ]
    ),
    mk(
      'seed-da-1',
      'Data Analyst',
      'Safaricom',
      daysAgoIso(4, 8),
      [
        { q: 'Tell me about an analysis that changed a decision.', focus: 'Data & analysis' },
        { q: 'How do you communicate findings to non-technical stakeholders?', focus: 'Communication' },
      ]
    ),
  ];
}

export const mockInterviewApi: InterviewApi = {
  async generateQuestions(jobDescription): Promise<GenerateQuestionsResult> {
    await delay(1800);
    const { role, company } = parseJobDescription(jobDescription);
    const session: InterviewSession = {
      id: uid(),
      role,
      company,
      jobDescription,
      createdAt: nowIso(),
      questions: buildQuestions(jobDescription),
      feedback: {},
    };
    const sessions = await loadSessions();
    upsertSession(sessions, session);
    await persist(sessions);
    return { session };
  },

  async getSessions(): Promise<InterviewSession[]> {
    await delay(350);
    const stored = await loadSessions();
    return stored.length ? stored : seedSessions();
  },

  async getSession(id): Promise<InterviewSession | null> {
    await delay(250);
    const sessions = await loadSessions();
    return sessions.find((s) => s.id === id) ?? null;
  },

  async deleteSession(id): Promise<void> {
    await delay(200);
    const sessions = await loadSessions();
    await persist(sessions.filter((s) => s.id !== id));
  },

  async submitAnswer(sessionId, questionId, answer): Promise<FeedbackResult> {
    await delay(1600);
    const sessions = await loadSessions();
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error('Session not found');

    const thread = session.feedback[questionId] ?? [];
    const messages: FeedbackMessage[] = [
      ...thread,
      { id: uid(), role: 'user', content: answer, createdAt: nowIso() },
      {
        id: uid(),
        role: 'coach',
        content:
          'Solid attempt. You explain what you did clearly, but the result is undersold — quantify it. Which metric moved after your action, and how far? Also, name the specific technology or method you used rather than describing it in general terms.',
        createdAt: nowIso(),
      },
      {
        id: uid(),
        role: 'coach',
        content:
          'Follow-up: if you had one more week to redo this task, what would you have changed and why?',
        createdAt: nowIso(),
      },
    ];
    session.feedback[questionId] = messages;
    upsertSession(sessions, session);
    await persist(sessions);
    return { answers: messages };
  },

  async getPlan(): Promise<PlanInfo> {
    await delay(200);
    return {
      tier: 'free',
      freeLimit: 3,
      usedThisMonth: 2,
      proPriceKes: 1,
      renewsAt: null,
    };
  },
};
