/**
 * Learning path: the question bank split into units (one per official section)
 * and lessons of about 10 questions. Each unit ends with a short checkpoint exam.
 *
 * Everything here is pure so it can be unit-tested; the screen lives in
 * ui/views/pathView.ts.
 */
import { evaluateAnswer } from './answerMatcher';
import { getEffectiveAnswers } from './questions';
import type { CivicsQuestion, OfficialOverrides, TestVersion } from './types';

export const LESSON_SIZE = 10;
export const CHECKPOINT_SIZE = 10;
export const CHECKPOINT_PASS = 0.8;

export interface PathLesson {
  /** Stable id, e.g. "2025:b-system-of-government:2". */
  id: string;
  questionIds: number[];
}

export interface PathUnit {
  id: string;
  /** Official section name (English). */
  section: string;
  category: string;
  lessons: PathLesson[];
  questionIds: number[];
}

/** Spanish names for the official sections of both tests. */
export const SECTION_ES: Record<string, string> = {
  'A: Principles of American Government': 'Principios del gobierno estadounidense',
  'A: Principles of American Democracy': 'Principios de la democracia estadounidense',
  'B: System of Government': 'Sistema de gobierno',
  'C: Rights and Responsibilities': 'Derechos y responsabilidades',
  'A: Colonial Period and Independence': 'Época colonial e independencia',
  'B: 1800s': 'Los años 1800',
  'C: Recent American History and Other Important Historical Information':
    'Historia reciente y otros datos históricos importantes',
  'A: Symbols': 'Símbolos',
  'B: Holidays': 'Días festivos',
  'A: Geography': 'Geografía',
  'B: Symbols': 'Símbolos',
  'C: Holidays': 'Días festivos',
};

/** Section name without the "A: " prefix. */
export function sectionTitle(section: string, lang: 'en' | 'es'): string {
  if (lang === 'es' && SECTION_ES[section]) return SECTION_ES[section]!;
  return section.replace(/^[A-Z]:\s*/, '');
}

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Split n items into ceil(n/size) groups of nearly equal size (47 → 10,10,9,9,9). */
export function balancedChunks<T>(items: readonly T[], size: number): T[][] {
  if (items.length === 0) return [];
  const count = Math.ceil(items.length / size);
  const base = Math.floor(items.length / count);
  let extra = items.length % count;
  const chunks: T[][] = [];
  let i = 0;
  for (let c = 0; c < count; c++) {
    const len = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra--;
    chunks.push(items.slice(i, i + len));
    i += len;
  }
  return chunks;
}

/** Units in the order the sections first appear in the official list. */
export function buildPath(questions: readonly CivicsQuestion[], version: TestVersion): PathUnit[] {
  const bySection = new Map<string, CivicsQuestion[]>();
  for (const q of questions) {
    const list = bySection.get(q.section) ?? [];
    list.push(q);
    bySection.set(q.section, list);
  }
  return [...bySection.entries()].map(([section, qs]) => {
    const unitId = `${version}:${slug(`${qs[0]!.category}-${section}`)}`;
    return {
      id: unitId,
      section,
      category: qs[0]!.category,
      questionIds: qs.map((q) => q.id),
      lessons: balancedChunks(qs, LESSON_SIZE).map((chunk, i) => ({
        id: `${unitId}:${i + 1}`,
        questionIds: chunk.map((q) => q.id),
      })),
    };
  });
}

// ---------------------------------------------------------------------------
// Progress and unlocking
// ---------------------------------------------------------------------------

export interface PathProgress {
  /** Lesson id → ISO date it was completed. */
  lessonsDone: Record<string, string>;
  /** Unit id → ISO date its checkpoint was passed. */
  unitsPassed: Record<string, string>;
  /** Local day (YYYY-MM-DD) the daily review was finished. */
  reviewDoneOn?: string;
}

export const emptyPathProgress = (): PathProgress => ({ lessonsDone: {}, unitsPassed: {} });

export type LessonState = 'locked' | 'next' | 'done';

export function isUnitComplete(unit: PathUnit, progress: PathProgress): boolean {
  return Boolean(progress.unitsPassed[unit.id]);
}

/** A unit opens when the previous unit's checkpoint was passed. */
export function isUnitOpen(units: PathUnit[], index: number, progress: PathProgress): boolean {
  if (index === 0) return true;
  const prev = units[index - 1];
  return Boolean(prev && isUnitComplete(prev, progress));
}

export function lessonState(
  units: PathUnit[],
  unitIndex: number,
  lessonIndex: number,
  progress: PathProgress,
): LessonState {
  const unit = units[unitIndex];
  const lesson = unit?.lessons[lessonIndex];
  if (!unit || !lesson) return 'locked';
  if (progress.lessonsDone[lesson.id] || progress.unitsPassed[unit.id]) return 'done';
  if (!isUnitOpen(units, unitIndex, progress)) return 'locked';
  const prev = unit.lessons[lessonIndex - 1];
  if (prev && !progress.lessonsDone[prev.id]) return 'locked';
  return 'next';
}

/** All lessons of the unit done: the checkpoint is the next step. */
export function isCheckpointReady(unit: PathUnit, progress: PathProgress): boolean {
  return unit.lessons.every((l) => progress.lessonsDone[l.id]);
}

export interface NextStep {
  unitIndex: number;
  /** Lesson index, or -1 for the unit checkpoint. */
  lessonIndex: number;
}

/** First lesson or checkpoint still to do, or null when the whole path is done. */
export function findNextStep(units: PathUnit[], progress: PathProgress): NextStep | null {
  for (let u = 0; u < units.length; u++) {
    const unit = units[u]!;
    if (isUnitComplete(unit, progress)) continue;
    const l = unit.lessons.findIndex((lesson) => !progress.lessonsDone[lesson.id]);
    return { unitIndex: u, lessonIndex: l };
  }
  return null;
}

export function countLessons(units: PathUnit[]): number {
  return units.reduce((sum, u) => sum + u.lessons.length, 0);
}

export function countLessonsDone(units: PathUnit[], progress: PathProgress): number {
  return units.reduce(
    (sum, u) =>
      sum + u.lessons.filter((l) => progress.lessonsDone[l.id] || progress.unitsPassed[u.id]).length,
    0,
  );
}

/** Lessons + checkpoints left (each checkpoint counts as one step). */
export function stepsRemaining(units: PathUnit[], progress: PathProgress): number {
  return units.reduce((sum, u) => {
    if (progress.unitsPassed[u.id]) return sum;
    return sum + u.lessons.filter((l) => !progress.lessonsDone[l.id]).length + 1;
  }, 0);
}

// ---------------------------------------------------------------------------
// Study plan from the interview date
// ---------------------------------------------------------------------------

export interface StudyPlan {
  daysLeft: number;
  stepsLeft: number;
  perDay: number;
  /** 'done' everything finished; 'past' the date passed; 'ok' / 'tight' / 'behind'. */
  status: 'done' | 'past' | 'ok' | 'tight' | 'behind';
}

/**
 * Days left counts today. The plan leaves the last 2 days free for review and
 * mock exams when there is room.
 */
export function buildStudyPlan(interviewDate: string, stepsLeft: number, now = new Date()): StudyPlan | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(interviewDate)) return null;
  const [y, m, d] = interviewDate.split('-').map(Number) as [number, number, number];
  const target = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysLeft = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (stepsLeft === 0) return { daysLeft, stepsLeft, perDay: 0, status: 'done' };
  if (daysLeft < 0) return { daysLeft, stepsLeft, perDay: 0, status: 'past' };
  const studyDays = Math.max(1, daysLeft > 7 ? daysLeft - 2 : daysLeft);
  const perDay = Math.ceil(stepsLeft / studyDays);
  const status = perDay <= 2 ? 'ok' : perDay <= 4 ? 'tight' : 'behind';
  return { daysLeft, stepsLeft, perDay, status };
}

// ---------------------------------------------------------------------------
// Easiest answer and multiple choice
// ---------------------------------------------------------------------------

/** Answer text without the optional parts in parentheses. */
export function cleanAnswer(answer: string): string {
  return answer
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.])/g, '$1')
    .trim();
}

/**
 * The shortest accepted answers (as many as the question asks for), with
 * optional words removed: the easiest thing to memorize and say.
 */
export function easiestAnswers(question: CivicsQuestion, officials: OfficialOverrides): string[] {
  const answers = getEffectiveAnswers(question, officials)
    .map((a, i) => ({ text: cleanAnswer(a) || a, i }))
    .filter((a) => a.text);
  const unique = answers.filter((a, idx) => answers.findIndex((b) => b.text.toLowerCase() === a.text.toLowerCase()) === idx);
  const sorted = [...unique].sort(
    (a, b) => a.text.split(' ').length - b.text.split(' ').length || a.text.length - b.text.length || a.i - b.i,
  );
  return sorted.slice(0, Math.max(1, question.requiredCount)).map((a) => a.text);
}

export function joinAnswers(parts: string[], lang: 'en' | 'es' = 'en'): string {
  if (parts.length <= 1) return parts[0] ?? '';
  const and = lang === 'es' ? ' y ' : ' and ';
  return `${parts.slice(0, -1).join(', ')}${and}${parts[parts.length - 1]}`;
}

export interface Choice {
  options: string[];
  correctIndex: number;
}

/** Small seeded random generator so a lesson's options stay stable while it is open. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function shuffleWith<T>(items: T[], rnd: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Four options: the easiest correct answer plus three answers taken from other
 * questions (same unit first, so they look plausible). Distractors that the
 * answer checker would accept for this question are never used.
 */
export function buildChoice(
  question: CivicsQuestion,
  pool: readonly CivicsQuestion[],
  officials: OfficialOverrides,
  rnd: () => number,
  optionCount = 4,
): Choice {
  const correct = joinAnswers(easiestAnswers(question, officials));
  const sameSection = pool.filter((q) => q.id !== question.id && q.section === question.section);
  const sameCategory = pool.filter((q) => q.id !== question.id && q.section !== question.section && q.category === question.category);
  const rest = pool.filter((q) => q.id !== question.id && q.category !== question.category);
  const candidates: string[] = [];
  for (const group of [sameSection, sameCategory, rest]) {
    for (const other of shuffleWith(group, rnd)) {
      if (other.dynamicKey && other.dynamicKey === question.dynamicKey) continue;
      const parts = shuffleWith(getEffectiveAnswers(other, officials).map(cleanAnswer).filter(Boolean), rnd).slice(
        0,
        Math.max(1, question.requiredCount),
      );
      if (parts.length < Math.max(1, question.requiredCount)) continue;
      const text = joinAnswers(parts);
      const lower = text.toLowerCase();
      if (lower === correct.toLowerCase() || candidates.some((c) => c.toLowerCase() === lower)) continue;
      if (evaluateAnswer(question, text, officials).matchedAnswers.length > 0) continue;
      candidates.push(text);
      if (candidates.length >= optionCount - 1) break;
    }
    if (candidates.length >= optionCount - 1) break;
  }
  const options = shuffleWith([correct, ...candidates], rnd);
  return { options, correctIndex: options.indexOf(correct) };
}

// ---------------------------------------------------------------------------
// Lesson engine: every question is answered right twice, first with options,
// then from memory. Mistakes come back a few steps later. No penalties.
// ---------------------------------------------------------------------------

export type StepKind = 'choice' | 'recall';

export interface LessonStep {
  questionId: number;
  kind: StepKind;
}

export interface LessonSession {
  queue: LessonStep[];
  mastered: number[];
  total: number;
  mistakes: number;
  answered: number;
  recallOnly: boolean;
}

const REQUEUE_GAP = 3;

/** recallOnly: for review sessions of cards already learned. */
export function createLessonSession(questionIds: number[], rnd: () => number, recallOnly = false): LessonSession {
  return {
    queue: shuffleWith(questionIds, rnd).map((questionId) => ({ questionId, kind: recallOnly ? 'recall' : 'choice' })),
    mastered: [],
    total: questionIds.length,
    mistakes: 0,
    answered: 0,
    recallOnly,
  };
}

export function currentStep(session: LessonSession): LessonStep | undefined {
  return session.queue[0];
}

export function answerStep(session: LessonSession, correct: boolean): LessonSession {
  const [step, ...rest] = session.queue;
  if (!step) return session;
  const queue = [...rest];
  let mastered = session.mastered;
  if (correct && step.kind === 'choice') {
    queue.splice(Math.min(REQUEUE_GAP, queue.length), 0, { questionId: step.questionId, kind: 'recall' });
  } else if (correct) {
    mastered = [...mastered, step.questionId];
  } else {
    queue.splice(Math.min(REQUEUE_GAP, queue.length), 0, step);
  }
  return {
    ...session,
    queue,
    mastered,
    mistakes: session.mistakes + (correct ? 0 : 1),
    answered: session.answered + 1,
  };
}

/** 0..1, counting both the options step and the memory step of each question. */
export function lessonProgress(session: LessonSession): number {
  if (session.total === 0) return 1;
  const stepsPerQ = session.recallOnly ? 1 : 2;
  const recallPending = session.queue.filter((s) => s.kind === 'recall').length;
  const choicePending = session.queue.filter((s) => s.kind === 'choice').length;
  const totalSteps = session.total * stepsPerQ;
  const pending = choicePending * 2 + recallPending;
  return Math.max(0, Math.min(1, (totalSteps - pending) / totalSteps));
}

export function isLessonFinished(session: LessonSession): boolean {
  return session.queue.length === 0;
}

/** Checkpoint questions: a random sample of the unit (all of it when small). */
export function pickCheckpoint(unit: PathUnit, rnd: () => number): number[] {
  return shuffleWith(unit.questionIds, rnd).slice(0, CHECKPOINT_SIZE);
}

export function checkpointPassed(correct: number, asked: number): boolean {
  return asked > 0 && correct / asked >= CHECKPOINT_PASS;
}
