export type CivicsCategory =
  | 'American Government'
  | 'American History'
  | 'Symbols and Holidays'
  | 'Integrated Civics';

/** 2025 test (128 questions) or 2008 test (100 questions, N-400 filed before Oct 20, 2025). */
export type TestVersion = '2025' | '2008';

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
  /** Spaced-repetition box (0 = new/wrong … 5 = long-term). */
  box?: number;
  /** ISO date when the card is due again for smart review. */
  dueAt?: string;
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
  version?: TestVersion;
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
  testVersion: TestVersion;
  /** Questions to practice per day. */
  dailyGoal: number;
  /** Text size multiplier (1 = normal). */
  fontScale: number;
  /** Interview date YYYY-MM-DD ('' = not set). */
  interviewDate: string;
}

/** Per-sentence practice record for the English test (keyed by sentence id). */
export interface EnglishSentenceProgress {
  attempts: number;
  passes: number;
  lastPracticedAt?: string;
}

export interface EnglishProgress {
  reading: Record<string, EnglishSentenceProgress>;
  writing: Record<string, EnglishSentenceProgress>;
  /** N-400 interview questions answered out loud, keyed by item id. */
  interview: Record<string, EnglishSentenceProgress>;
}

export interface PersistedState {
  progress: Record<number, QuestionProgress>;
  examHistory: ExamRecord[];
  settings: StudySettings;
  /** Practice count per local day, keyed YYYY-MM-DD. */
  activity: Record<string, number>;
  /** English test practice (optional for data saved by older versions). */
  english?: EnglishProgress;
  /** Learning path progress (optional for data saved by older versions). */
  path?: PathProgressState;
}

/** Learning path progress: lesson and unit ids include the test version. */
export interface PathProgressState {
  lessonsDone: Record<string, string>;
  unitsPassed: Record<string, string>;
  reviewDoneOn?: string;
}

export type AppView =
  | 'dashboard'
  | 'path'
  | 'flashcards'
  | 'exam'
  | 'oral'
  | 'english'
  | 'bank'
  | 'audio'
  | 'more';

export interface AnswerMatchResult {
  isMatch: boolean;
  matchedAnswers: string[];
  requiredCount: number;
  confidence: number;
  feedback: string;
}
