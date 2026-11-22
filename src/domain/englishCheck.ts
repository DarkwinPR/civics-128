import { normalizeText } from './answerMatcher';

export interface WordMark {
  word: string;
  ok: boolean;
  /** Typed/heard word was one small typo away (only set when ok is false). */
  close?: boolean;
  /** What the learner wrote in this position, when it differs. */
  got?: string;
  /** The word as it appears in the sentence (casing and abbreviations kept), for display. */
  display: string;
}

const words = (text: string) =>
  normalizeText(text)
    .replace(/\bd c\b/g, 'dc')
    .replace(/\bu s\b/g, 'us')
    .split(' ')
    .filter(Boolean);

const DISPLAY_SPECIAL: Record<string, string> = {
  dc: 'D.C.',
  us: 'U.S.',
  '1st': 'first',
  '2nd': 'second',
  '1': 'one',
  '2': 'two',
  '4': 'four',
  '50': 'fifty',
  '100': 'one hundred',
};

/** Recover how a normalized word is written in the original sentence. */
function displayWord(word: string, original: string): string {
  const base = DISPLAY_SPECIAL[word] ?? word;
  if (base.includes('.')) return base;
  const found = original
    .replace(/['’]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .find((w) => w.toLowerCase() === base);
  if (found) return found;
  // Multi-word number like "one hundred": keep the sentence's casing of the first word.
  return base;
}

/** Levenshtein distance, small inputs only. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length]!;
}

/** One-letter slip on a word of 4+ letters (e.g. "presdent", "goverment"). */
function isCloseSpelling(target: string, got: string): boolean {
  return target.length >= 4 && editDistance(target, got) === 1;
}

/**
 * Align the learner's words with the target (longest common subsequence), so one
 * missing word does not mark everything after it as wrong.
 * Returns, for each target word, the index of the matching learner word or -1.
 */
function align(target: string[], got: string[], same: (a: string, b: string) => boolean): number[] {
  const n = target.length;
  const m = got.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] = same(target[i]!, got[j]!)
        ? dp[i + 1]![j + 1]! + 1
        : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const result = new Array<number>(n).fill(-1);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (same(target[i]!, got[j]!)) {
      result[i] = j;
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      i++;
    } else {
      j++;
    }
  }
  return result;
}

export interface WritingResult {
  exact: boolean;
  marks: WordMark[];
  /** Target words the learner did not write. */
  missing: number;
  /** Words written that are not in the sentence. */
  extra: string[];
  /** Every mistake is a one-letter typo: "you are very close". */
  onlyTypos: boolean;
}

/** Compare a typed sentence with the target, word by word (punctuation and case ignored). */
export function compareWriting(target: string, typed: string): WritingResult {
  const targetWords = words(target);
  const typedWords = words(typed);
  const exactAlign = align(targetWords, typedWords, (a, b) => a === b);
  const used = new Set(exactAlign.filter((j) => j >= 0));

  const marks: WordMark[] = targetWords.map((word, i) => {
    const display = displayWord(word, target);
    if (exactAlign[i]! >= 0) return { word, display, ok: true };
    // Look for a near-miss between the neighbouring matched words.
    const prevJ = i > 0 ? Math.max(...exactAlign.slice(0, i), -1) : -1;
    const nextCandidates = exactAlign.slice(i + 1).filter((j) => j >= 0);
    const nextJ = nextCandidates.length ? nextCandidates[0]! : typedWords.length;
    for (let j = prevJ + 1; j < nextJ; j++) {
      if (used.has(j)) continue;
      const got = typedWords[j]!;
      if (isCloseSpelling(word, got)) {
        used.add(j);
        return { word, display, ok: false, close: true, got };
      }
    }
    for (let j = prevJ + 1; j < nextJ; j++) {
      if (used.has(j)) continue;
      used.add(j);
      return { word, display, ok: false, got: typedWords[j]! };
    }
    return { word, display, ok: false };
  });

  const extra = typedWords.filter((_, j) => !used.has(j));
  const wrong = marks.filter((m) => !m.ok);
  return {
    exact: wrong.length === 0 && extra.length === 0,
    marks,
    missing: marks.filter((m) => !m.ok && m.got === undefined).length,
    extra,
    onlyTypos: wrong.length > 0 && extra.length === 0 && wrong.every((m) => m.close),
  };
}

/** Words speech recognition often writes differently from what was said correctly. */
const SOUND_ALIKE: Record<string, string[]> = {
  to: ['2', 'too'],
  '2': ['to', 'too'],
  for: ['4'],
  '1': ['won'],
  where: ['wear', 'were', 'ware'],
  who: ['hoo', 'whom'],
  right: ['write', 'rite'],
  red: ['read'],
  white: ['wight'],
  meet: ['meat'],
  dollar: ['dollars'],
  states: ['state'],
  senators: ['senator'],
  presidents: ['president', 'presidents'],
  people: ['peoples'],
  citizens: ['citizen'],
  in: ['and'],
  is: ['s', 'its'],
};

function heardAs(target: string, heard: string): boolean {
  if (target === heard) return true;
  if (SOUND_ALIKE[target]?.includes(heard)) return true;
  // Accents often change one sound: "presiden", "lincon".
  return target.length >= 5 && editDistance(target, heard) === 1;
}

export interface ReadingResult {
  score: number;
  marks: WordMark[];
}

/** Word-by-word check of a read-aloud transcript (order-insensitive, accent-friendly). */
export function checkReading(target: string, transcript: string): ReadingResult {
  const targetWords = words(target);
  const heard = words(transcript);
  const used = new Set<number>();
  const marks: WordMark[] = targetWords.map((word) => {
    const display = displayWord(word, target);
    const j = heard.findIndex((h, idx) => !used.has(idx) && heardAs(word, h));
    if (j >= 0) {
      used.add(j);
      return { word, display, ok: true };
    }
    return { word, display, ok: false };
  });
  const score = targetWords.length ? marks.filter((m) => m.ok).length / targetWords.length : 0;
  return { score, marks };
}

/** Share of the target's words heard in a spoken transcript (order-insensitive). */
export function readingScore(target: string, transcript: string): number {
  return checkReading(target, transcript).score;
}

/** Pick a varied, friendly message so the same words are not repeated every time. */
export function pickVariant(count: number, seed: number): number {
  if (count <= 0) return 0;
  return Math.abs(Math.floor(seed)) % count;
}
