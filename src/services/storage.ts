import { DEFAULT_OFFICIALS } from '../domain/questions';
import type {
  EnglishProgress,
  EnglishSentenceProgress,
  ExamRecord,
  MasteryStatus,
  OfficialOverrides,
  PersistedState,
  QuestionProgress,
  StudySettings,
} from '../domain/types';

const STORAGE_KEY = 'civics128:state:v1';

const DEFAULT_SETTINGS: StudySettings = {
  speechRate: 0.95,
  voiceURI: '',
  autoSpeak: false,
  officials: { ...DEFAULT_OFFICIALS },
  homeState: '',
  homeDistrict: '',
  testVersion: '2025',
  dailyGoal: 10,
  fontScale: 1,
};

function defaultState(): PersistedState {
  return {
    progress: {},
    examHistory: [],
    settings: {
      ...DEFAULT_SETTINGS,
      officials: { ...DEFAULT_OFFICIALS },
    },
    activity: {},
  };
}

const asRecord = (value: unknown): Record<string, EnglishSentenceProgress> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, EnglishSentenceProgress>)
    : {};

function sanitizeEnglish(value: unknown): EnglishProgress {
  const raw = (value && typeof value === 'object' ? value : {}) as Partial<EnglishProgress>;
  return {
    reading: asRecord(raw.reading),
    writing: asRecord(raw.writing),
    interview: asRecord(raw.interview),
  };
}

export function getEnglishProgress(state: PersistedState): EnglishProgress {
  return state.english ?? { reading: {}, writing: {}, interview: {} };
}

/** Parse a stored or exported state object, filling defaults for anything missing. */
export function parseState(raw: string): PersistedState {
  return fromParsed(JSON.parse(raw) as Partial<PersistedState>);
}

export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return parseState(raw);
  } catch {
    return defaultState();
  }
}

function fromParsed(parsed: Partial<PersistedState>): PersistedState {
  return {
    progress:
      parsed.progress && typeof parsed.progress === 'object' && !Array.isArray(parsed.progress)
        ? parsed.progress
        : {},
    examHistory: Array.isArray(parsed.examHistory) ? parsed.examHistory : [],
    settings: {
      speechRate:
        typeof parsed.settings?.speechRate === 'number'
          ? parsed.settings.speechRate
          : DEFAULT_SETTINGS.speechRate,
      voiceURI:
        typeof parsed.settings?.voiceURI === 'string'
          ? parsed.settings.voiceURI
          : DEFAULT_SETTINGS.voiceURI,
      autoSpeak:
        typeof parsed.settings?.autoSpeak === 'boolean'
          ? parsed.settings.autoSpeak
          : DEFAULT_SETTINGS.autoSpeak,
      officials: {
        ...DEFAULT_OFFICIALS,
        ...(parsed.settings?.officials ?? {}),
      },
      homeState:
        typeof parsed.settings?.homeState === 'string' ? parsed.settings.homeState : '',
      homeDistrict:
        typeof parsed.settings?.homeDistrict === 'string' ? parsed.settings.homeDistrict : '',
      testVersion: parsed.settings?.testVersion === '2008' ? '2008' : '2025',
      dailyGoal:
        typeof parsed.settings?.dailyGoal === 'number' && parsed.settings.dailyGoal > 0
          ? parsed.settings.dailyGoal
          : DEFAULT_SETTINGS.dailyGoal,
      fontScale:
        typeof parsed.settings?.fontScale === 'number' &&
        parsed.settings.fontScale >= 0.9 &&
        parsed.settings.fontScale <= 1.5
          ? parsed.settings.fontScale
          : DEFAULT_SETTINGS.fontScale,
    },
    activity:
      parsed.activity && typeof parsed.activity === 'object' ? parsed.activity : {},
    english: sanitizeEnglish(parsed.english),
  };
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage quota or private browsing restriction; keep in-memory state working.
  }
}

export function getQuestionProgress(
  state: PersistedState,
  questionId: number,
): QuestionProgress {
  return (
    state.progress[questionId] ?? {
      status: 'unseen',
      attempts: 0,
      correct: 0,
    }
  );
}

// ---------------------------------------------------------------------------
// Spaced repetition (Leitner boxes) & daily activity
// ---------------------------------------------------------------------------

/** Days until a card in each box is due again. */
const BOX_INTERVAL_DAYS = [0, 1, 3, 7, 14, 30];
const DAY_MS = 24 * 60 * 60 * 1000;

function dueDateForBox(box: number, from = new Date()): string {
  const days = BOX_INTERVAL_DAYS[Math.min(box, BOX_INTERVAL_DAYS.length - 1)] ?? 0;
  return new Date(from.getTime() + days * DAY_MS).toISOString();
}

/** A card is due when it was practiced before and its review date has arrived. */
export function isDueForReview(progress: QuestionProgress, now = new Date()): boolean {
  if (progress.status === 'unseen') return false;
  if (!progress.dueAt) return progress.status === 'review';
  return new Date(progress.dueAt).getTime() <= now.getTime();
}

export function localDayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function bumpActivity(activity: Record<string, number>): Record<string, number> {
  const key = localDayKey();
  return { ...activity, [key]: (activity[key] ?? 0) + 1 };
}

export function getTodayCount(state: PersistedState): number {
  return state.activity[localDayKey()] ?? 0;
}

/** Consecutive days (ending today, or yesterday if today has no practice yet) with practice. */
export function getStreak(state: PersistedState, now = new Date()): number {
  let streak = 0;
  const cursor = new Date(now);
  if (!state.activity[localDayKey(cursor)]) cursor.setDate(cursor.getDate() - 1);
  while (state.activity[localDayKey(cursor)]) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function setQuestionStatus(
  state: PersistedState,
  questionId: number,
  status: MasteryStatus,
): PersistedState {
  const existing = getQuestionProgress(state, questionId);
  const next: PersistedState = {
    ...state,
    progress: {
      ...state.progress,
      [questionId]: {
        ...existing,
        status,
        lastPracticedAt: new Date().toISOString(),
        ...(status === 'mastered'
          ? { box: Math.max(existing.box ?? 0, 3), dueAt: dueDateForBox(Math.max(existing.box ?? 0, 3)) }
          : status === 'review'
            ? { box: 0, dueAt: dueDateForBox(0) }
            : { box: undefined, dueAt: undefined }),
      },
    },
    activity: status === 'unseen' ? state.activity : bumpActivity(state.activity),
  };
  saveState(next);
  return next;
}

export function recordPracticeResult(
  state: PersistedState,
  questionId: number,
  correct: boolean,
): PersistedState {
  const existing = getQuestionProgress(state, questionId);
  const nextStatus: MasteryStatus = correct
    ? existing.status === 'review' && existing.correct < 1
      ? 'review'
      : 'mastered'
    : 'review';
  const nextBox = correct ? Math.min((existing.box ?? 0) + 1, BOX_INTERVAL_DAYS.length - 1) : 0;

  const next: PersistedState = {
    ...state,
    progress: {
      ...state.progress,
      [questionId]: {
        status: nextStatus,
        attempts: existing.attempts + 1,
        correct: existing.correct + (correct ? 1 : 0),
        lastPracticedAt: new Date().toISOString(),
        box: nextBox,
        dueAt: dueDateForBox(nextBox),
      },
    },
    activity: bumpActivity(state.activity),
  };
  saveState(next);
  return next;
}

export function addExamRecord(state: PersistedState, record: ExamRecord): PersistedState {
  const next: PersistedState = {
    ...state,
    examHistory: [record, ...state.examHistory].slice(0, 25),
  };
  saveState(next);
  return next;
}

export function updateSettings(
  state: PersistedState,
  patch: Partial<StudySettings>,
): PersistedState {
  const next: PersistedState = {
    ...state,
    settings: {
      ...state.settings,
      ...patch,
      officials: patch.officials
        ? { ...state.settings.officials, ...patch.officials }
        : state.settings.officials,
    },
  };
  saveState(next);
  return next;
}

export function updateOfficials(
  state: PersistedState,
  officials: OfficialOverrides,
): PersistedState {
  return updateSettings(state, { officials });
}

export function resetProgressOnly(state: PersistedState): PersistedState {
  const next: PersistedState = {
    progress: {},
    examHistory: [],
    settings: state.settings,
    activity: {},
    english: { reading: {}, writing: {}, interview: {} },
  };
  saveState(next);
  return next;
}

// ---------------------------------------------------------------------------
// English test practice
// ---------------------------------------------------------------------------

export type EnglishPart = keyof EnglishProgress;

/** Record one reading, writing or interview attempt; counts toward the daily goal. */
export function recordEnglishAttempt(
  state: PersistedState,
  part: EnglishPart,
  id: string,
  passed: boolean,
): PersistedState {
  const english = getEnglishProgress(state);
  const existing = english[part][id] ?? { attempts: 0, passes: 0 };
  const next: PersistedState = {
    ...state,
    english: {
      ...english,
      [part]: {
        ...english[part],
        [id]: {
          attempts: existing.attempts + 1,
          passes: existing.passes + (passed ? 1 : 0),
          lastPracticedAt: new Date().toISOString(),
        },
      },
    },
    activity: bumpActivity(state.activity),
  };
  saveState(next);
  return next;
}

/** Number of sentences in a part that were done right at least once. */
export function countEnglishMastered(state: PersistedState, part: EnglishPart): number {
  return Object.values(getEnglishProgress(state)[part]).filter((p) => p.passes > 0).length;
}

// ---------------------------------------------------------------------------
// Backup (export / import) — the file stays on the user's device
// ---------------------------------------------------------------------------

const BACKUP_APP = 'civics-128';

export function exportBackup(state: PersistedState, now = new Date()): string {
  return JSON.stringify({ app: BACKUP_APP, version: 1, exportedAt: now.toISOString(), state }, null, 2);
}

/** Read a backup file's text without saving it. Throws if it is not a Civics 128 backup. */
export function parseBackup(text: string): PersistedState {
  const data = JSON.parse(text) as { app?: string; state?: Partial<PersistedState> };
  if (data?.app !== BACKUP_APP || !data.state || typeof data.state !== 'object') {
    throw new Error('not-a-backup');
  }
  return fromParsed(data.state);
}

/** Replace the saved state with a parsed backup. */
export function restoreBackup(state: PersistedState): PersistedState {
  saveState(state);
  return state;
}
