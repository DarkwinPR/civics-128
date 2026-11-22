import { normalizeText } from './answerMatcher';

export interface WordMark {
  word: string;
  ok: boolean;
}

/** Compare a typed sentence with the target, word by word (punctuation and case ignored). */
export function compareWriting(target: string, typed: string): { exact: boolean; marks: WordMark[] } {
  const targetWords = normalizeText(target).split(' ').filter(Boolean);
  const typedWords = normalizeText(typed).split(' ').filter(Boolean);
  const marks = targetWords.map((word, i) => ({ word, ok: typedWords[i] === word }));
  const exact = typedWords.length === targetWords.length && marks.every((m) => m.ok);
  return { exact, marks };
}

/** Share of the target's words heard in a spoken transcript (order-insensitive). */
export function readingScore(target: string, transcript: string): number {
  const targetWords = normalizeText(target).split(' ').filter(Boolean);
  if (targetWords.length === 0) return 0;
  const heard = new Set(normalizeText(transcript).split(' ').filter(Boolean));
  const hits = targetWords.filter((w) => heard.has(w)).length;
  return hits / targetWords.length;
}
