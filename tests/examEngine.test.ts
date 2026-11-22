import { describe, expect, it } from 'vitest';
import {
  createExamSession,
  getExamTallies,
  submitExamAnswer,
} from '../src/domain/examEngine';
import { CIVICS_QUESTIONS } from '../src/domain/questions';

describe('USCIS 2025 Mock Exam Engine', () => {
  it('standard exam draws 20 unique questions and stops early at 12 correct', () => {
    let session = createExamSession(CIVICS_QUESTIONS, 'standard', () => 0.42);
    expect(session.queue).toHaveLength(20);
    expect(new Set(session.queue.map((q) => q.id)).size).toBe(20);

    for (let i = 0; i < 11; i += 1) {
      session = submitExamAnswer(session, true);
      expect(session.status).toBe('in-progress');
    }

    session = submitExamAnswer(session, true);
    expect(session.status).toBe('passed');
    expect(getExamTallies(session)).toEqual({
      correct: 12,
      incorrect: 0,
      answered: 12,
      remaining: 8,
    });
  });

  it('standard exam stops early at 9 incorrect answers', () => {
    let session = createExamSession(CIVICS_QUESTIONS, 'standard', () => 0.17);

    // 3 correct + 8 wrong -> still possible to reach 12/20 (3 + 9 remaining = 12)
    for (let i = 0; i < 3; i += 1) session = submitExamAnswer(session, true);
    for (let i = 0; i < 8; i += 1) session = submitExamAnswer(session, false);
    expect(session.status).toBe('in-progress');

    // 9th wrong -> mathematically impossible to reach 12 -> stops immediately
    session = submitExamAnswer(session, false);
    expect(session.status).toBe('failed');
    expect(getExamTallies(session).incorrect).toBe(9);
  });

  it('65/20 exam uses only starred questions and stops at 6 correct or 5 incorrect', () => {
    let passSession = createExamSession(CIVICS_QUESTIONS, '65-20', () => 0.33);
    expect(passSession.queue).toHaveLength(10);
    expect(passSession.queue.every((q) => q.is6520)).toBe(true);

    for (let i = 0; i < 6; i += 1) {
      passSession = submitExamAnswer(passSession, true);
    }
    expect(passSession.status).toBe('passed');
    expect(passSession.results).toHaveLength(6);

    let failSession = createExamSession(CIVICS_QUESTIONS, '65-20', () => 0.77);
    for (let i = 0; i < 4; i += 1) {
      failSession = submitExamAnswer(failSession, false);
      expect(failSession.status).toBe('in-progress');
    }
    failSession = submitExamAnswer(failSession, false);
    expect(failSession.status).toBe('failed');
    expect(failSession.results).toHaveLength(5);
  });
});
