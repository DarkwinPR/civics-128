import { afterEach, describe, expect, it } from 'vitest';
import { compareWriting, readingScore } from '../src/domain/englishCheck';
import { N400_INTERVIEW, READING_SENTENCES, WRITING_SENTENCES } from '../src/domain/englishTest';
import { createExamSession, getExamRules } from '../src/domain/examEngine';
import {
  CIVICS_QUESTIONS,
  displayNumber,
  findQuestionById,
  setTestVersion,
} from '../src/domain/questions';
import { CIVICS_QUESTIONS_2008, QUESTIONS_2008_ES } from '../src/domain/questions2008';
import { JURISDICTIONS } from '../src/domain/states';
import type { PersistedState } from '../src/domain/types';
import { QUESTIONS_2025_ES } from '../src/i18n/questionsEs';
import {
  getStreak,
  isDueForReview,
  localDayKey,
  recordPracticeResult,
  setQuestionStatus,
} from '../src/services/storage';

const emptyState = (): PersistedState => ({
  progress: {},
  examHistory: [],
  activity: {},
  settings: {
    speechRate: 1,
    voiceURI: '',
    autoSpeak: false,
    homeState: '',
    homeDistrict: '',
    testVersion: '2025',
    dailyGoal: 10,
    fontScale: 1,
    interviewDate: '',
    officials: {
      president: '',
      vicePresident: '',
      speaker: '',
      chiefJustice: '',
      senator: '',
      representative: '',
      governor: '',
      stateCapital: '',
    },
  },
});

afterEach(() => setTestVersion('2025'));

describe('2008 civics test', () => {
  it('has 100 questions with ids 1001-1100 and the 20 official 65/20 questions', () => {
    expect(CIVICS_QUESTIONS_2008).toHaveLength(100);
    CIVICS_QUESTIONS_2008.forEach((q, i) => expect(q.id).toBe(1001 + i));
    const starred = CIVICS_QUESTIONS_2008.filter((q) => q.is6520).map(displayNumber);
    expect(starred).toEqual([6, 11, 13, 17, 20, 27, 28, 44, 45, 49, 54, 56, 70, 75, 78, 85, 94, 95, 97, 99]);
    expect(Object.keys(QUESTIONS_2008_ES)).toHaveLength(100);
  });

  it('switches the active bank and the exam rules', () => {
    setTestVersion('2008');
    expect(CIVICS_QUESTIONS).toHaveLength(100);
    expect(getExamRules('standard')).toMatchObject({ maxQuestions: 10, passThreshold: 6, failThreshold: 5 });
    const session = createExamSession(CIVICS_QUESTIONS, '65-20', () => 0.5);
    expect(session.queue).toHaveLength(10);
    expect(session.queue.every((q) => q.is6520)).toBe(true);
    setTestVersion('2025');
    expect(CIVICS_QUESTIONS).toHaveLength(128);
    expect(getExamRules('standard').maxQuestions).toBe(20);
  });

  it('finds questions from either bank and shows official numbers', () => {
    expect(displayNumber(findQuestionById(1020)!)).toBe(20);
    expect(findQuestionById(5)?.id).toBe(5);
  });
});

describe('Spanish translations', () => {
  it('cover all 128 questions of the 2025 test with matching answer counts', () => {
    setTestVersion('2025');
    for (const q of CIVICS_QUESTIONS) {
      const tr = QUESTIONS_2025_ES[q.id];
      expect(tr, `missing translation for ${q.id}`).toBeDefined();
      expect(tr!.a).toHaveLength(q.answers.length);
    }
  });
});

describe('spaced repetition and streak', () => {
  it('schedules correct answers later and wrong answers now', () => {
    let state = recordPracticeResult(emptyState(), 1, true);
    expect(state.progress[1]?.box).toBe(1);
    expect(isDueForReview(state.progress[1]!)).toBe(false);
    state = recordPracticeResult(state, 1, false);
    expect(state.progress[1]?.box).toBe(0);
    expect(isDueForReview(state.progress[1]!)).toBe(true);
  });

  it('pushes a card marked mastered at least a week out', () => {
    const state = setQuestionStatus(emptyState(), 2, 'mastered');
    const due = new Date(state.progress[2]!.dueAt!).getTime();
    expect(due - Date.now()).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
  });

  it('counts consecutive practice days', () => {
    const state = emptyState();
    const today = new Date();
    for (let i = 0; i < 3; i += 1) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      state.activity[localDayKey(d)] = 5;
    }
    expect(getStreak(state, today)).toBe(3);
    expect(getStreak(emptyState(), today)).toBe(0);
  });
});

describe('English test practice', () => {
  it('has reading, writing and interview content', () => {
    expect(READING_SENTENCES.length).toBeGreaterThanOrEqual(30);
    expect(WRITING_SENTENCES.length).toBeGreaterThanOrEqual(30);
    expect(N400_INTERVIEW.flatMap((s) => s.items).length).toBeGreaterThanOrEqual(40);
  });

  it('checks dictation ignoring case and punctuation', () => {
    expect(compareWriting('Washington was the first President.', 'washington was the first president').exact).toBe(true);
    const wrong = compareWriting('Lincoln was President during the Civil War.', 'Lincoln was president in the Civil War');
    expect(wrong.exact).toBe(false);
    expect(wrong.marks.find((m) => m.word === 'during')?.ok).toBe(false);
  });

  it('scores read-aloud transcripts', () => {
    expect(readingScore('Who was the first President?', 'who was the first president')).toBe(1);
    expect(readingScore('Who was the first President?', 'who')).toBeLessThan(0.5);
  });
});

describe('states', () => {
  it('lists 50 states, D.C. and 5 territories with capitals and governors', () => {
    expect(JURISDICTIONS.filter((j) => j.kind === 'state')).toHaveLength(50);
    expect(JURISDICTIONS).toHaveLength(56);
    JURISDICTIONS.forEach((j) => {
      expect(j.capital).toBeTruthy();
      expect(j.governor).toBeTruthy();
    });
  });
});
