import { beforeEach, describe, expect, it } from 'vitest';
import { checkReading, compareWriting, editDistance } from '../src/domain/englishCheck';
import { HELPFUL_PHRASES } from '../src/domain/englishTest';
import { governorsMayHaveChanged } from '../src/domain/states';
import type { PersistedState } from '../src/domain/types';
import {
  countEnglishMastered,
  exportBackup,
  getEnglishProgress,
  localDayKey,
  parseBackup,
  recordEnglishAttempt,
} from '../src/services/storage';

// Minimal in-memory localStorage for saveState in Node.
beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage;
});

const baseState = (): PersistedState =>
  parseBackup(JSON.stringify({ app: 'civics-128', state: {} }));

describe('writing check', () => {
  it('one missing word does not mark the rest of the sentence wrong', () => {
    const r = compareWriting('Lincoln was President during the Civil War.', 'Lincoln was President the Civil War');
    expect(r.exact).toBe(false);
    expect(r.missing).toBe(1);
    expect(r.marks.filter((m) => !m.ok).map((m) => m.word)).toEqual(['during']);
  });

  it('recognises one-letter spelling slips', () => {
    const r = compareWriting('The President lives in the White House.', 'The Presdent lives in the White House');
    expect(r.exact).toBe(false);
    expect(r.onlyTypos).toBe(true);
    expect(r.marks.find((m) => m.close)?.got).toBe('presdent');
  });

  it('reports extra words', () => {
    const r = compareWriting('We pay taxes.', 'We all pay taxes');
    expect(r.exact).toBe(false);
    expect(r.extra).toEqual(['all']);
  });

  it('keeps how words are written in the sentence for display', () => {
    const r = compareWriting('Congress meets in Washington, D.C.', 'congress meet in washington');
    expect(r.marks.map((m) => m.display)).toEqual(['Congress', 'meets', 'in', 'Washington', 'D.C.']);
    expect(compareWriting('Washington was the first President.', 'washington was the 1st president').exact).toBe(true);
  });
});

describe('reading check', () => {
  it('accepts common speech-recognition spellings and accents', () => {
    expect(checkReading('Where is the White House?', 'wear is the white house').score).toBe(1);
    expect(checkReading('Who was Abraham Lincoln?', 'who was abraham lincon').score).toBe(1);
    expect(checkReading('How many states do we have?', 'how many states do we have').score).toBe(1);
  });

  it('marks words that were not heard', () => {
    const r = checkReading('Who elects Senators?', 'who');
    expect(r.score).toBeLessThan(0.5);
    expect(r.marks.filter((m) => !m.ok).map((m) => m.display)).toEqual(['elects', 'Senators']);
  });

  it('edit distance', () => {
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(editDistance('same', 'same')).toBe(0);
  });
});

describe('english progress and backup', () => {
  it('records attempts, passes and daily activity', () => {
    let state = baseState();
    state = recordEnglishAttempt(state, 'reading', 'r01', false);
    state = recordEnglishAttempt(state, 'reading', 'r01', true);
    state = recordEnglishAttempt(state, 'writing', 'w01', false);
    expect(getEnglishProgress(state).reading.r01).toMatchObject({ attempts: 2, passes: 1 });
    expect(countEnglishMastered(state, 'reading')).toBe(1);
    expect(countEnglishMastered(state, 'writing')).toBe(0);
    expect(state.activity[localDayKey()]).toBe(3);
  });

  it('round-trips a backup and rejects other files', () => {
    const state = recordEnglishAttempt(baseState(), 'interview', 'g01', true);
    const restored = parseBackup(exportBackup(state));
    expect(restored.english?.interview.g01?.passes).toBe(1);
    expect(restored.settings.testVersion).toBe('2025');
    expect(() => parseBackup('{"hello":1}')).toThrow();
    expect(() => parseBackup('not json')).toThrow();
  });
});

describe('misc', () => {
  it('asks to recheck governors from January 2027', () => {
    expect(governorsMayHaveChanged(new Date('2026-11-22T12:00:00'))).toBe(false);
    expect(governorsMayHaveChanged(new Date('2027-01-15T12:00:00'))).toBe(true);
  });

  it('every helpful phrase has a Spanish meaning', () => {
    HELPFUL_PHRASES.forEach((p) => {
      expect(p.text.length).toBeGreaterThan(0);
      expect(p.es.length).toBeGreaterThan(0);
    });
  });
});
