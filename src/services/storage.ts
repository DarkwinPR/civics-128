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
};

function defaultState(): PersistedState {
  return {
    progress: {},
    examHistory: [],
    settings: {
      ...DEFAULT_SETTINGS,
      officials: { ...DEFAULT_OFFICIALS },
    },
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
      },
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
      },
    },
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

  const next: PersistedState = {
    ...state,
    progress: {
      ...state.progress,
      [questionId]: {
        status: nextStatus,
        attempts: existing.attempts + 1,
        correct: existing.correct + (correct ? 1 : 0),
        lastPracticedAt: new Date().toISOString(),
      },
    },
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
  };
  saveState(next);
  return next;
}
