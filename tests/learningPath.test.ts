import { describe, expect, it } from 'vitest';
import { evaluateAnswer } from '../src/domain/answerMatcher';
import {
  answerStep,
  balancedChunks,
  buildChoice,
  buildPath,
  buildStudyPlan,
  checkpointPassed,
  cleanAnswer,
  createLessonSession,
  currentStep,
  easiestAnswers,
  emptyPathProgress,
  findNextStep,
  isCheckpointReady,
  isLessonFinished,
  lessonProgress,
  lessonState,
  otherAcceptedAnswers,
  seededRandom,
  stepsRemaining,
} from '../src/domain/learningPath';
import { DEFAULT_OFFICIALS, QUESTIONS_2025 } from '../src/domain/questions';
import { CIVICS_QUESTIONS_2008 } from '../src/domain/questions2008';

const officials = { ...DEFAULT_OFFICIALS, senator: 'Jane Doe', representative: 'John Roe', governor: 'Ann Poe', stateCapital: 'Austin' };

describe('path structure', () => {
  it('splits sections into balanced lessons of at most 10', () => {
    expect(balancedChunks(Array.from({ length: 47 }, (_, i) => i), 10).map((c) => c.length)).toEqual([10, 10, 9, 9, 9]);
    for (const [bank, version] of [[QUESTIONS_2025, '2025'], [CIVICS_QUESTIONS_2008, '2008']] as const) {
      const units = buildPath(bank, version);
      const ids = units.flatMap((u) => u.lessons.flatMap((l) => l.questionIds));
      expect(ids.sort((a, b) => a - b)).toEqual(bank.map((q) => q.id).sort((a, b) => a - b));
      units.forEach((u) => u.lessons.forEach((l) => expect(l.questionIds.length).toBeLessThanOrEqual(10)));
      expect(new Set(units.flatMap((u) => u.lessons.map((l) => l.id))).size).toBe(units.reduce((s, u) => s + u.lessons.length, 0));
    }
  });

  it('unlocks lessons in order and units after their checkpoint', () => {
    const units = buildPath(QUESTIONS_2025, '2025');
    const p = emptyPathProgress();
    expect(lessonState(units, 0, 0, p)).toBe('next');
    expect(lessonState(units, 0, 1, p)).toBe('locked');
    expect(lessonState(units, 1, 0, p)).toBe('locked');
    units[0]!.lessons.forEach((l) => (p.lessonsDone[l.id] = 'x'));
    expect(isCheckpointReady(units[0]!, p)).toBe(true);
    expect(findNextStep(units, p)).toEqual({ unitIndex: 0, lessonIndex: -1 });
    expect(lessonState(units, 1, 0, p)).toBe('locked');
    p.unitsPassed[units[0]!.id] = 'x';
    expect(lessonState(units, 1, 0, p)).toBe('next');
    expect(findNextStep(units, p)).toEqual({ unitIndex: 1, lessonIndex: 0 });
  });

  it('counts remaining steps and builds a study plan', () => {
    const units = buildPath(QUESTIONS_2025, '2025');
    const left = stepsRemaining(units, emptyPathProgress());
    expect(left).toBeGreaterThan(units.length);
    const now = new Date(2026, 10, 23);
    expect(buildStudyPlan('2026-12-23', left, now)).toMatchObject({ daysLeft: 30, status: 'ok' });
    expect(buildStudyPlan('2026-11-25', left, now)?.status).toBe('behind');
    expect(buildStudyPlan('2026-11-01', left, now)?.status).toBe('past');
    expect(buildStudyPlan('', left, now)).toBeNull();
    expect(buildStudyPlan('2026-12-23', 0, now)?.status).toBe('done');
  });
});

describe('easiest answer and choices', () => {
  it('picks short answers without optional words', () => {
    expect(cleanAnswer('(Thomas) Jefferson')).toBe('Jefferson');
    const q2 = QUESTIONS_2025.find((q) => q.id === 2)!;
    expect(easiestAnswers(q2, officials)).toEqual(['(U.S.) Constitution'.replace('(U.S.) ', '')]);
  });

  it('every question gets 4 options where only the right one is accepted', () => {
    for (const bank of [QUESTIONS_2025, CIVICS_QUESTIONS_2008]) {
      for (const q of bank) {
        const choice = buildChoice(q, bank, officials, seededRandom(q.id));
        expect(choice.options.length, `q${q.id}`).toBe(4);
        expect(new Set(choice.options).size).toBe(4);
        choice.options.forEach((opt, i) => {
          const res = evaluateAnswer(q, opt, officials);
          if (i === choice.correctIndex) expect(res.isMatch, `q${q.id} correct: ${opt}`).toBe(true);
          else expect(res.matchedAnswers.length, `q${q.id} distractor: ${opt}`).toBe(0);
        });
      }
    }
  });
});

describe('other accepted answers', () => {
  it('lists every other official answer, without repeating the easiest one', () => {
    const q3 = QUESTIONS_2025.find((q) => q.id === 3)!;
    const easiest = easiestAnswers(q3, officials);
    const others = otherAcceptedAnswers(q3, officials);
    expect(others.length).toBe(q3.answers.length - easiest.length);
    others.forEach((o) => expect(easiest).not.toContain(o));
    const q7 = QUESTIONS_2025.find((q) => q.answers.length === 1)!;
    expect(otherAcceptedAnswers(q7, officials)).toEqual([]);
  });
});

describe('lesson engine', () => {
  it('needs each question right with options and then from memory', () => {
    let s = createLessonSession([1, 2], seededRandom(1));
    expect(currentStep(s)?.kind).toBe('choice');
    let guard = 0;
    // Answer wrong once, then everything right.
    s = answerStep(s, false);
    expect(s.mistakes).toBe(1);
    while (!isLessonFinished(s) && guard++ < 20) s = answerStep(s, true);
    expect(s.mastered.sort()).toEqual([1, 2]);
    expect(s.answered).toBe(5);
    expect(lessonProgress(s)).toBe(1);
  });

  it('review sessions are memory-only', () => {
    let s = createLessonSession([5, 6, 7], seededRandom(2), true);
    expect(s.queue.every((x) => x.kind === 'recall')).toBe(true);
    s = answerStep(s, true);
    expect(lessonProgress(s)).toBeCloseTo(1 / 3);
  });

  it('checkpoint passes at 80%', () => {
    expect(checkpointPassed(8, 10)).toBe(true);
    expect(checkpointPassed(7, 10)).toBe(false);
    expect(checkpointPassed(0, 0)).toBe(false);
  });
});
