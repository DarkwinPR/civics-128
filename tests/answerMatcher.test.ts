import { describe, expect, it } from 'vitest';
import { evaluateAnswer } from '../src/domain/answerMatcher';
import { CIVICS_QUESTIONS, DEFAULT_OFFICIALS } from '../src/domain/questions';

const getQ = (id: number) => CIVICS_QUESTIONS.find((q) => q.id === id)!;

describe('Oral & typed answer evaluator', () => {
  it('accepts parenthetical simplifications and spoken/numeric equivalents', () => {
    expect(evaluateAnswer(getQ(2), 'The Constitution', DEFAULT_OFFICIALS).isMatch).toBe(true);
    expect(evaluateAnswer(getQ(7), '27', DEFAULT_OFFICIALS).isMatch).toBe(true);
    expect(evaluateAnswer(getQ(7), 'twenty seven', DEFAULT_OFFICIALS).isMatch).toBe(true);
    expect(evaluateAnswer(getQ(24), 'four hundred thirty five', DEFAULT_OFFICIALS).isMatch).toBe(
      true,
    );
    expect(evaluateAnswer(getQ(78), 'Jefferson', DEFAULT_OFFICIALS).isMatch).toBe(true);
  });

  it('enforces multi-item requiredCount on Name two / three / five questions', () => {
    const q10 = getQ(10); // Name two important ideas
    const partial = evaluateAnswer(q10, 'Liberty', DEFAULT_OFFICIALS);
    expect(partial.isMatch).toBe(false);
    expect(partial.matchedAnswers).toHaveLength(1);

    const complete = evaluateAnswer(q10, 'Equality and natural rights', DEFAULT_OFFICIALS);
    expect(complete.isMatch).toBe(true);
    expect(complete.matchedAnswers).toHaveLength(2);

    const q126 = getQ(126); // Name three national U.S. holidays
    expect(
      evaluateAnswer(
        q126,
        'Memorial Day, Independence Day, and Thanksgiving Day',
        DEFAULT_OFFICIALS,
      ).isMatch,
    ).toBe(true);
  });

  it('accepts Secretary of Defense as well as Secretary of War for Q48', () => {
    const q48 = getQ(48);
    const res = evaluateAnswer(q48, 'Secretary of State and Secretary of Defense', DEFAULT_OFFICIALS);
    expect(res.isMatch).toBe(true);
  });

  it('evaluates dynamic federal and custom state officials accurately', () => {
    expect(evaluateAnswer(getQ(38), 'Trump', DEFAULT_OFFICIALS).isMatch).toBe(true);

    const customOfficials = {
      ...DEFAULT_OFFICIALS,
      governor: 'Gavin Newsom',
      stateCapital: 'Sacramento',
    };
    expect(evaluateAnswer(getQ(61), 'Newsom', customOfficials).isMatch).toBe(true);
    expect(evaluateAnswer(getQ(62), 'Sacramento', customOfficials).isMatch).toBe(true);
  });
});
