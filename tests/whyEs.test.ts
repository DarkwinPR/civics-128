import { describe, expect, it } from 'vitest';
import { QUESTIONS_2025 } from '../src/domain/questions';
import { WHY_2025_ES } from '../src/i18n/whyEs';

describe('Spanish "why" explanations', () => {
  it('every 2025 question has a short explanation', () => {
    for (const q of QUESTIONS_2025) {
      const why = WHY_2025_ES[q.id];
      expect(why, `Q${q.id}`).toBeTruthy();
      expect(why!.length, `Q${q.id}`).toBeLessThan(240);
    }
    expect(Object.keys(WHY_2025_ES)).toHaveLength(QUESTIONS_2025.length);
  });

  it('does not hard-code names of officials who can change', () => {
    for (const id of [23, 29, 30, 38, 39, 57, 61]) {
      expect(WHY_2025_ES[id]).not.toMatch(/Trump|Vance|Johnson|Roberts/);
    }
  });
});
