import { getEffectiveAnswers } from './questions';
import type { AnswerMatchResult, CivicsQuestion, OfficialOverrides } from './types';

const NUMBER_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bfour hundred(?: and)? thirty[\s-]?five\b/g, '435'],
  [/\bone hundred\b/g, '100'],
  [/\bthirty[\s-]?fourth\b/g, '34th'],
  [/\btwenty[\s-]?seven\b/g, '27'],
  [/\btwenty[\s-]?second\b/g, '22nd'],
  [/\bnineteenth\b/g, '19th'],
  [/\beighteen\b/g, '18'],
  [/\bsixteenth\b/g, '16th'],
  [/\bfifteenth\b/g, '15th'],
  [/\bfourteenth\b/g, '14th'],
  [/\bthirteen\b/g, '13'],
  [/\bfifty\b/g, '50'],
  [/\btenth\b/g, '10th'],
  [/\bnine\b/g, '9'],
  [/\bsix\b/g, '6'],
  [/\bfive\b/g, '5'],
  [/\bfourth\b/g, '4th'],
  [/\bfour\b/g, '4'],
  [/\bthird\b/g, '3rd'],
  [/\bthree\b/g, '3'],
  [/\btwo\b/g, '2'],
  [/\bfirst\b/g, '1st'],
  [/\bone\b/g, '1'],
  [/\bworld war two\b/g, 'world war 2'],
  [/\bworld war ii\b/g, 'world war 2'],
  [/\bww2\b/g, 'world war 2'],
  [/\bwwii\b/g, 'world war 2'],
  [/\bworld war one\b/g, 'world war 1'],
  [/\bworld war i\b/g, 'world war 1'],
  [/\bww1\b/g, 'world war 1'],
  [/\bwwi\b/g, 'world war 1'],
  [/\bjuly 4th\b/g, 'july 4'],
  [/\bfourth of july\b/g, 'july 4'],
  [/\b4th of july\b/g, 'july 4'],
  [/\bu\.?\s*s\.?\s*a\.?\b/g, 'united states'],
  [/\bu\s+s\b/g, 'united states'],
  [/\bus\b/g, 'united states'],
  [/\bd\s+c\b/g, 'dc'],
];

const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'of',
  'to',
  'in',
  'for',
  'by',
  'on',
  'at',
  'is',
  'are',
  'was',
  'were',
  'be',
  'it',
  'its',
  'that',
  'this',
  'they',
  'them',
  'their',
  'there',
  'our',
  'your',
  'my',
  'we',
  'because',
  'and',
  'or',
  'from',
  'with',
  'as',
  'can',
  'do',
  'does',
  'who',
  'have',
  'has',
  'had',
]);

export function normalizeText(input: string): string {
  let text = input
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[-/]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const [pattern, replacement] of NUMBER_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  return text.replace(/\s+/g, ' ').trim();
}

function significantTokens(normalized: string): string[] {
  const words = normalized.split(' ').filter(Boolean);
  const filtered = words.filter((w) => !STOPWORDS.has(w));
  return filtered.length > 0 ? filtered : words;
}

function buildVariants(officialAnswer: string): string[] {
  const variants = new Set<string>();
  const full = normalizeText(officialAnswer);
  if (full) variants.add(full);

  // Version without parentheticals: "(Thomas) Jefferson" -> "jefferson"
  const withoutParens = normalizeText(officialAnswer.replace(/\([^)]*\)/g, ' '));
  if (withoutParens) variants.add(withoutParens);

  // Parenthetical contents themselves if meaningful (e.g. "(Defense)", "(Connecticut Compromise)", "(1929)")
  const parenMatches = officialAnswer.matchAll(/\(([^)]+)\)/g);
  for (const match of parenMatches) {
    const inner = match[1]?.trim();
    if (!inner) continue;
    const normInner = normalizeText(inner);
    if (normInner && normInner.length >= 1) {
      // Avoid tiny generic parentheticals like "for", "until", "example of", "because"
      const tokens = significantTokens(normInner);
      if (tokens.length > 0 && !['example', 'if needed', 'needed'].includes(normInner)) {
        variants.add(normInner);
      }
    }
  }

  // Handle "Secretary of War (Defense)" -> also accept "secretary of defense"
  if (/secretary of war\s*\(defense\)/i.test(officialAnswer)) {
    variants.add('secretary of defense');
  }

  return [...variants];
}

function matchSingleVariant(userNorm: string, userTokens: Set<string>, variant: string): number {
  if (!variant || !userNorm) return 0;

  // Direct substring match (word-boundary safe for short tokens like numbers)
  const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const boundaryRe = new RegExp(`(?:^|\\s)${escaped}(?:$|\\s)`);
  if (boundaryRe.test(userNorm)) {
    return 1;
  }

  const targetTokens = significantTokens(variant);
  if (targetTokens.length === 0) return 0;

  let hits = 0;
  for (const token of targetTokens) {
    if (userTokens.has(token)) {
      hits += 1;
      continue;
    }
    // Simple singular/plural tolerance (e.g., law/laws, tax/taxes, colony/colonies)
    for (const ut of userTokens) {
      if (
        (token.length >= 4 && ut.startsWith(token)) ||
        (ut.length >= 4 && token.startsWith(ut))
      ) {
        hits += 1;
        break;
      }
    }
  }

  const ratio = hits / targetTokens.length;
  if (targetTokens.length === 1) {
    return ratio >= 1 ? 0.95 : 0;
  }
  if (targetTokens.length === 2) {
    return ratio >= 1 ? 0.95 : 0;
  }
  return ratio >= 0.67 ? ratio : 0;
}

export function evaluateAnswer(
  question: CivicsQuestion,
  userResponse: string,
  officials: OfficialOverrides,
): AnswerMatchResult {
  const userNorm = normalizeText(userResponse);
  if (!userNorm) {
    return {
      isMatch: false,
      matchedAnswers: [],
      requiredCount: question.requiredCount,
      confidence: 0,
      feedback: 'No answer captured yet. Speak or type your response.',
    };
  }

  const effectiveAnswers = getEffectiveAnswers(question, officials);
  const userTokens = new Set(significantTokens(userNorm));
  const matchedAnswers: string[] = [];
  let bestScore = 0;

  for (const answer of effectiveAnswers) {
    const variants = buildVariants(answer);
    let answerBest = 0;
    for (const variant of variants) {
      const score = matchSingleVariant(userNorm, userTokens, variant);
      if (score > answerBest) {
        answerBest = score;
      }
    }

    // For custom/dynamic names like "Donald J. Trump" or "Mike Johnson", also allow last name alone
    if (question.dynamicKey && answerBest < 0.67) {
      const parts = significantTokens(normalizeText(answer));
      const lastName = parts[parts.length - 1];
      if (lastName && lastName.length >= 3 && userTokens.has(lastName)) {
        answerBest = 0.9;
      }
    }

    if (answerBest >= 0.67) {
      matchedAnswers.push(answer);
      if (answerBest > bestScore) {
        bestScore = answerBest;
      }
    }
  }

  const isMatch = matchedAnswers.length >= question.requiredCount;

  let feedback: string;
  if (isMatch) {
    feedback =
      question.requiredCount > 1
        ? `Correct — matched ${matchedAnswers.length} of ${question.requiredCount} required answers.`
        : 'Correct — matches an official USCIS answer.';
  } else if (matchedAnswers.length > 0) {
    feedback = `Partial match — found ${matchedAnswers.length} of ${question.requiredCount} required answers (${matchedAnswers.join(', ')}).`;
  } else {
    feedback =
      'Did not automatically match an official answer. Compare with the official list below — you can still mark it correct if your phrasing was valid.';
  }

  return {
    isMatch,
    matchedAnswers,
    requiredCount: question.requiredCount,
    confidence: bestScore,
    feedback,
  };
}
