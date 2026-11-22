import { DEFAULT_OFFICIALS } from '../domain/questions';
import type {
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

export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      progress: parsed.progress ?? {},
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
    };
  } catch {
    return defaultState();
  }
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
  };
  saveState(next);
  return next;
}
