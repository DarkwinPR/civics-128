import { describe, expect, it } from 'vitest';
import { CIVICS_QUESTIONS, DEFAULT_OFFICIALS, getEffectiveAnswers } from '../src/domain/questions';

const EXPECTED_6520_IDS = [
  2, 7, 12, 20, 30, 36, 38, 39, 44, 52, 61, 66, 74, 78, 86, 94, 113, 115, 121, 126,
];

describe('USCIS 2025 128 Civics Questions dataset', () => {
  it('contains exactly 128 sequential questions (1..128)', () => {
    expect(CIVICS_QUESTIONS).toHaveLength(128);
    CIVICS_QUESTIONS.forEach((q, idx) => {
      expect(q.id).toBe(idx + 1);
      expect(q.question.trim().length).toBeGreaterThan(5);
      expect(q.answers.length).toBeGreaterThan(0);
      expect(q.requiredCount).toBeGreaterThanOrEqual(1);
    });
  });

  it('marks the exact 20 official 65/20 Special Consideration questions', () => {
    const flaggedIds = CIVICS_QUESTIONS.filter((q) => q.is6520).map((q) => q.id);
    expect(flaggedIds).toEqual(EXPECTED_6520_IDS);
    expect(flaggedIds).toHaveLength(20);
  });

  it('uses custom officials when configured and falls back cleanly otherwise', () => {
    const senatorQ = CIVICS_QUESTIONS.find((q) => q.id === 23)!;
    const defaultAnswers = getEffectiveAnswers(senatorQ, DEFAULT_OFFICIALS);
    expect(defaultAnswers[0]).toContain('Answers will vary');

    const customAnswers = getEffectiveAnswers(senatorQ, {
      ...DEFAULT_OFFICIALS,
      senator: 'Alex Padilla, Adam Schiff',
    });
    expect(customAnswers).toEqual(['Alex Padilla', 'Adam Schiff']);
  });
});
