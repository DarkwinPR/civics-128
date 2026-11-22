import { getTestVersion } from './questions';
import type { CivicsQuestion, ExamMode } from './types';

export interface ExamRules {
  readonly mode: ExamMode;
  readonly maxQuestions: number;
  readonly passThreshold: number;
  readonly failThreshold: number;
}

export interface ExamTurnResult {
  readonly questionId: number;
  readonly correct: boolean;
  readonly userAnswer?: string;
}

export interface ExamSessionState {
  readonly rules: ExamRules;
  readonly queue: readonly CivicsQuestion[];
  readonly currentIndex: number;
  readonly results: readonly ExamTurnResult[];
  readonly status: 'in-progress' | 'passed' | 'failed';
}

export function getExamRules(mode: ExamMode): ExamRules {
  if (getTestVersion() === '2008') {
    // 2008 test (N-400 filed before Oct 20, 2025): up to 10 questions, 6 correct to pass.
    // 65/20 applicants get the same count from the 20 asterisked questions.
    return { mode, maxQuestions: 10, passThreshold: 6, failThreshold: 5 };
  }

  if (mode === '65-20') {
    // Official USCIS 2025 65/20 Special Consideration:
    // 10 questions asked from the 20 asterisked (*) questions; 6 correct to pass (5 incorrect = fail).
    return {
      mode: '65-20',
      maxQuestions: 10,
      passThreshold: 6,
      failThreshold: 5,
    };
  }

  // Official USCIS 2025 Standard Naturalization Civics Test:
  // Up to 20 questions from all 128; stops early at 12 correct (pass) or 9 incorrect (fail).
  return {
    mode: 'standard',
    maxQuestions: 20,
    passThreshold: 12,
    failThreshold: 9,
  };
}

export function shuffleArray<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const current = copy[i];
    const swap = copy[j];
    if (current !== undefined && swap !== undefined) {
      copy[i] = swap;
      copy[j] = current;
    }
  }
  return copy;
}

export function createExamSession(
  allQuestions: readonly CivicsQuestion[],
  mode: ExamMode,
  rng: () => number = Math.random,
): ExamSessionState {
  const rules = getExamRules(mode);
  const pool = mode === '65-20' ? allQuestions.filter((q) => q.is6520) : allQuestions;
  const queue = shuffleArray(pool, rng).slice(0, rules.maxQuestions);

  return {
    rules,
    queue,
    currentIndex: 0,
    results: [],
    status: 'in-progress',
  };
}

export function getExamTallies(session: ExamSessionState): {
  correct: number;
  incorrect: number;
  answered: number;
  remaining: number;
} {
  let correct = 0;
  let incorrect = 0;
  for (const r of session.results) {
    if (r.correct) correct += 1;
    else incorrect += 1;
  }
  const answered = session.results.length;
  const remaining = Math.max(0, session.queue.length - answered);
  return { correct, incorrect, answered, remaining };
}

export function submitExamAnswer(
  session: ExamSessionState,
  correct: boolean,
  userAnswer?: string,
): ExamSessionState {
  if (session.status !== 'in-progress') {
    return session;
  }

  const currentQuestion = session.queue[session.currentIndex];
  if (!currentQuestion) {
    return session;
  }

  const nextResults: ExamTurnResult[] = [
    ...session.results,
    { questionId: currentQuestion.id, correct, userAnswer },
  ];

  let correctCount = 0;
  let incorrectCount = 0;
  for (const r of nextResults) {
    if (r.correct) correctCount += 1;
    else incorrectCount += 1;
  }

  let nextStatus: ExamSessionState['status'] = 'in-progress';
  if (correctCount >= session.rules.passThreshold) {
    nextStatus = 'passed';
  } else if (
    incorrectCount >= session.rules.failThreshold ||
    nextResults.length >= session.queue.length
  ) {
    nextStatus = correctCount >= session.rules.passThreshold ? 'passed' : 'failed';
  }

  const nextIndex =
    nextStatus === 'in-progress'
      ? Math.min(session.currentIndex + 1, session.queue.length - 1)
      : session.currentIndex;

  return {
    ...session,
    results: nextResults,
    currentIndex: nextIndex,
    status: nextStatus,
  };
}
