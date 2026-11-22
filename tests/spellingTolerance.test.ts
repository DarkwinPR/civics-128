import { describe, expect, it } from 'vitest';
import { evaluateAnswer } from '../src/domain/answerMatcher';
import { CIVICS_QUESTIONS, DEFAULT_OFFICIALS } from '../src/domain/questions';
import { isNearMiss } from '../src/domain/textDistance';
import type { PersistedState } from '../src/domain/types';
import { getMostMissed } from '../src/services/storage';

const getQ = (id: number) => CIVICS_QUESTIONS.find((q) => q.id === id)!;
const ok = (id: number, answer: string) => evaluateAnswer(getQ(id), answer, DEFAULT_OFFICIALS).isMatch;

describe('spelling and accent tolerance', () => {
  it('accepts accents and one-letter slips on long words', () => {
    expect(ok(2, 'La Constitución')).toBe(true);
    expect(ok(2, 'the constitucion')).toBe(true);
    expect(ok(78, 'Jeferson')).toBe(true);
  });

  it('does not stretch to different words', () => {
    expect(isNearMiss('police', 'policy')).toBe(false); // too short to guess
    expect(isNearMiss('independent', 'independence')).toBe(false);
    expect(isNearMiss('jefferson', 'xefferson')).toBe(false); // first letter must match
    expect(ok(2, 'the president')).toBe(false);
  });
});

describe('most missed questions', () => {
  it('ranks by misses and drops cards that reached long-term review', () => {
    const state = {
      progress: {
        1: { status: 'review', attempts: 4, correct: 1, box: 0 },
        2: { status: 'review', attempts: 2, correct: 0, box: 0 },
        3: { status: 'mastered', attempts: 6, correct: 3, box: 4 },
        4: { status: 'mastered', attempts: 3, correct: 3, box: 3 },
      },
      examHistory: [],
      activity: {},
      settings: {},
    } as unknown as PersistedState;
    expect(getMostMissed(state, [1, 2, 3, 4]).map((m) => m.id)).toEqual([1, 2]);
    expect(getMostMissed(state, [1, 2, 3, 4], 1)).toEqual([{ id: 1, misses: 3, attempts: 4 }]);
  });
});
