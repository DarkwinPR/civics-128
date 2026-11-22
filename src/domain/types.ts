export type CivicsCategory =
  | 'American Government'
  | 'American History'
  | 'Symbols and Holidays';

export type DynamicOfficialKey =
  | 'president'
  | 'vicePresident'
  | 'speaker'
  | 'chiefJustice'
  | 'senator'
  | 'representative'
  | 'governor'
  | 'stateCapital';

export interface CivicsQuestion {
  readonly id: number;
  readonly category: CivicsCategory;
  readonly section: string;
  readonly question: string;
  readonly answers: readonly string[];
  readonly is6520: boolean;
  readonly requiredCount: number;
  readonly dynamicKey?: DynamicOfficialKey;
  readonly note?: string;
}

export type MasteryStatus = 'unseen' | 'review' | 'mastered';

export interface QuestionProgress {
  status: MasteryStatus;
  attempts: number;
  correct: number;
  lastPracticedAt?: string;
}

export type ExamMode = 'standard' | '65-20';

export interface ExamRecord {
  id: string;
  date: string;
  mode: ExamMode;
  passed: boolean;
  correct: number;
  incorrect: number;
  asked: number;
  targetPass: number;
  maxQuestions: number;
  missedIds: number[];
}

export interface OfficialOverrides {
  president: string;
  vicePresident: string;
  speaker: string;
  chiefJustice: string;
  senator: string;
  representative: string;
  governor: string;
  stateCapital: string;
}

export type ThemePreference = 'system' | 'light' | 'dark';

export interface StudySettings {
  speechRate: number;
  voiceURI: string;
  autoSpeak: boolean;
  officials: OfficialOverrides;
  /** Two-letter code of the user's state/territory ('' = not chosen). */
  homeState: string;
  /** Congressional district number as text ('' = not chosen). */
  homeDistrict: string;
}

export interface PersistedState {
  progress: Record<number, QuestionProgress>;
  examHistory: ExamRecord[];
  settings: StudySettings;
}

export type AppView = 'dashboard' | 'flashcards' | 'exam' | 'oral' | 'bank';

export interface AnswerMatchResult {
  isMatch: boolean;
  matchedAnswers: string[];
  requiredCount: number;
  confidence: number;
  feedback: string;
}
