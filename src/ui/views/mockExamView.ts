import { evaluateAnswer } from '../../domain/answerMatcher';
import {
  createExamSession,
  getExamTallies,
  submitExamAnswer,
  type ExamSessionState,
} from '../../domain/examEngine';
import { appUrl } from '../../config';
import {
  CIVICS_QUESTIONS,
  displayNumber,
  getEffectiveAnswers,
  getTestVersion,
} from '../../domain/questions';
import { t } from '../../i18n';
import type { AnswerMatchResult, ExamMode, ExamRecord, PersistedState } from '../../domain/types';
import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  speakText,
  startListening,
  stopSpeaking,
  type ListeningSession,
} from '../../services/speech';
import { announce } from '../announcer';
import { escapeHtml, ICONS } from '../dom';
import { launchConfetti } from '../confetti';

export interface MockExamCallbacks {
  getState: () => PersistedState;
  onRecordQuestionResult: (questionId: number, correct: boolean) => void;
  onCompleteExam: (record: ExamRecord) => void;
  onPracticeReview: () => void;
}

export function mountMockExamView(
  container: HTMLElement,
  callbacks: MockExamCallbacks,
): () => void {
  const ttsSupported = isSpeechSynthesisSupported();
  const micSupported = isSpeechRecognitionSupported();

  let session: ExamSessionState | null = null;
  let userResponse = '';
  let evaluated: AnswerMatchResult | null = null;
  let revealedManually = false;
  let listening = false;
  let speaking = false;
  let micError = '';
  let activeMic: ListeningSession | null = null;

  const stopAudio = () => {
    stopSpeaking();
    speaking = false;
    activeMic?.abort();
    activeMic = null;
    listening = false;
  };

  const startNewExam = (mode: ExamMode) => {
    stopAudio();
    session = createExamSession(CIVICS_QUESTIONS, mode);
    userResponse = '';
    evaluated = null;
    revealedManually = false;
    micError = '';
    render();

    const firstQ = session.queue[0];
    if (firstQ && callbacks.getState().settings.autoSpeak) {
      readQuestion(firstQ.question);
    }
    announce(
      mode === '65-20'
        ? 'Started 65/20 mock exam. Up to 10 questions; 6 correct to pass.'
        : 'Started standard 2025 mock exam. Up to 20 questions; 12 correct to pass.',
    );
  };

  const readQuestion = (text: string) => {
    if (!ttsSupported) return;
    if (speaking) {
      stopSpeaking();
      speaking = false;
      render();
      return;
    }
    const { speechRate, voiceURI } = callbacks.getState().settings;
    speakText(text, {
      rate: speechRate,
      voiceURI,
      onStart: () => {
        speaking = true;
        render();
      },
      onEnd: () => {
        speaking = false;
        render();
      },
      onError: () => {
        speaking = false;
        render();
      },
    });
  };

  const toggleMic = () => {
    if (!session || session.status !== 'in-progress') return;
    if (listening) {
      activeMic?.stop();
      return;
    }

    micError = '';
    activeMic = startListening({
      onStart: () => {
        listening = true;
        render();
        announce('Listening. Speak your answer in English.');
      },
      onInterim: (transcript) => {
        userResponse = transcript;
        const inputEl = container.querySelector<HTMLInputElement>('#exam-answer-input');
        if (inputEl) inputEl.value = transcript;
        const liveTranscript = container.querySelector<HTMLElement>('#exam-live-transcript');
        if (liveTranscript) liveTranscript.textContent = transcript;
      },
      onFinal: (transcript) => {
        userResponse = transcript;
        checkCurrentAnswer();
      },
      onError: (msg) => {
        micError = msg;
        listening = false;
        render();
      },
      onEnd: () => {
        listening = false;
        activeMic = null;
        render();
      },
    });
  };

  const checkCurrentAnswer = () => {
    if (!session || session.status !== 'in-progress') return;
    const question = session.queue[session.currentIndex];
    if (!question) return;
    evaluated = evaluateAnswer(question, userResponse, callbacks.getState().settings.officials);
    revealedManually = true;
    render();
    announce(evaluated.feedback);
  };

  const commitGrade = (correct: boolean) => {
    if (!session || session.status !== 'in-progress') return;
    const question = session.queue[session.currentIndex];
    if (!question) return;

    stopAudio();
    callbacks.onRecordQuestionResult(question.id, correct);
    session = submitExamAnswer(session, correct, userResponse || undefined);
    userResponse = '';
    evaluated = null;
    revealedManually = false;
    micError = '';

    if (session.status !== 'in-progress') {
      const tallies = getExamTallies(session);
      const record: ExamRecord = {
        id: `${Date.now()}`,
        date: new Date().toISOString(),
        mode: session.rules.mode,
        passed: session.status === 'passed',
        correct: tallies.correct,
        incorrect: tallies.incorrect,
        asked: tallies.answered,
        targetPass: session.rules.passThreshold,
        maxQuestions: session.rules.maxQuestions,
        missedIds: session.results.filter((r) => !r.correct).map((r) => r.questionId),
        version: getTestVersion(),
      };
      callbacks.onCompleteExam(record);
      render();
      if (record.passed) launchConfetti();
      announce(
        record.passed
          ? `Congratulations! You passed the mock exam with ${record.correct} correct answers.`
          : `Mock exam ended. You answered ${record.correct} correctly out of ${record.asked}.`,
      );
      return;
    }

    render();
    const nextQ = session.queue[session.currentIndex];
    if (nextQ && callbacks.getState().settings.autoSpeak) {
      readQuestion(nextQ.question);
    }
  };

  const render = () => {
    const appState = callbacks.getState();

    // 1. Setup screen
    if (!session) {
      container.innerHTML = `
        <div class="study-stage-wrapper">
          <div class="view-header">
            <div>
              <h1 id="main-heading" tabindex="-1">Official 2025 Mock Exam</h1>
              <p class="view-lead">
                Simulates the real USCIS oral interview rules, including automatic early termination once you pass or can no longer pass.
              </p>
            </div>
          </div>

          <div class="exam-mode-grid">
            <article class="mode-option-card">
              <div class="badge-row">
                <span class="badge badge--number">Standard 2025</span>
                <span class="badge badge--category">128 Questions</span>
              </div>
              <h2>Standard Naturalization Exam</h2>
              <p>For applicants filing Form N-400 on or after October 20, 2025.</p>
              <ul class="rule-list">
                <li>Up to <strong>20 questions</strong> selected at random from all 128</li>
                <li>Stops immediately at <strong>12 correct</strong> (PASS)</li>
                <li>Stops immediately at <strong>9 incorrect</strong> (FAIL)</li>
                <li>Answer by voice, typing, or self-grading aloud</li>
              </ul>
              <button type="button" id="start-standard-btn" class="btn btn--primary btn--lg">
                Start Standard Exam (20 Questions)
              </button>
            </article>

            <article class="mode-option-card">
              <div class="badge-row">
                <span class="badge badge--6520">★ 65/20 Exemption</span>
                <span class="badge badge--category">20 Starred Questions</span>
              </div>
              <h2>65/20 Special Consideration</h2>
              <p>For applicants age 65+ who have been permanent residents for 20+ years.</p>
              <ul class="rule-list">
                <li>Up to <strong>10 questions</strong> from the 20 official ★ questions</li>
                <li>Stops immediately at <strong>6 correct</strong> (PASS)</li>
                <li>Stops immediately at <strong>5 incorrect</strong> (FAIL)</li>
                <li>Great quick drill even for standard applicants</li>
              </ul>
              <button type="button" id="start-6520-btn" class="btn btn--secondary btn--lg">
                Start 65/20 Exam (10 Questions)
              </button>
            </article>
          </div>
        </div>
      `;

      container
        .querySelector('#start-standard-btn')
        ?.addEventListener('click', () => startNewExam('standard'));
      container
        .querySelector('#start-6520-btn')
        ?.addEventListener('click', () => startNewExam('65-20'));
      return;
    }

    const tallies = getExamTallies(session);

    // 2. Results screen
    if (session.status !== 'in-progress') {
      const passed = session.status === 'passed';
      const missedCount = session.results.filter((r) => !r.correct).length;

      container.innerHTML = `
        <div class="study-stage-wrapper">
          <h1 id="main-heading" tabindex="-1" class="visually-hidden">Mock Exam Results</h1>

          <section class="result-banner ${passed ? 'result-banner--passed' : 'result-banner--failed'}" aria-label="Exam outcome">
            <span class="badge ${passed ? 'badge--mastered' : 'badge--review'}">
              ${session.rules.mode === '65-20' ? '65/20 Special Consideration ★' : 'Standard 2025 Civics Test'}
            </span>
            <h2>${passed ? 'You Passed the Mock Exam!' : 'Keep Practicing — Not Passed Yet'}</h2>
            <p style="margin:0;max-inline-size:48ch;color:var(--text-primary);">
              You answered <strong>${tallies.correct} correctly</strong> and <strong>${tallies.incorrect} incorrectly</strong> out of <strong>${tallies.answered}</strong> questions asked
              (official passing score: ${session.rules.passThreshold}/${session.rules.maxQuestions}).
            </p>
            <div class="hero-actions" style="justify-content:center;">
              <button type="button" id="exam-retake-btn" class="btn btn--primary">
                ${ICONS.rotate} Take Another Exam
              </button>
              ${
                missedCount > 0
                  ? `<button type="button" id="exam-review-missed-btn" class="btn btn--secondary">Practice Flagged Cards (${missedCount})</button>`
                  : ''
              }
              <button type="button" id="exam-change-mode-btn" class="btn btn--ghost">Change Mode</button>
              ${
                passed
                  ? `<a class="btn btn--success" target="_blank" rel="noopener noreferrer" href="https://wa.me/?text=${encodeURIComponent(
                      t('share.passedMessage', { score: `${tallies.correct}/${tallies.answered}`, url: appUrl() }),
                    )}">💬 ${escapeHtml(t('share.whatsapp'))}</a>`
                  : ''
              }
            </div>
          </section>

          <h3 style="margin:0 0 0.85rem;">Question-by-Question Review</h3>
          <ul class="review-list" role="list">
            ${session.results
              .map((res, idx) => {
                const q = CIVICS_QUESTIONS.find((item) => item.id === res.questionId);
                if (!q) return '';
                const answers = getEffectiveAnswers(q, appState.settings.officials);
                return `
                  <li class="review-card ${res.correct ? 'review-card--correct' : 'review-card--wrong'}">
                    <div class="badge-row" style="margin-block-end:0.45rem;">
                      <span class="badge badge--number">#${idx + 1} · Q${displayNumber(q)}</span>
                      <span class="badge ${res.correct ? 'badge--mastered' : 'badge--review'}">
                        ${res.correct ? 'Correct' : 'Missed'}
                      </span>
                    </div>
                    <p style="margin:0 0 0.45rem;font-weight:700;">${escapeHtml(q.question)}</p>
                    ${
                      res.userAnswer
                        ? `<p style="margin:0 0 0.45rem;font-size:0.88rem;color:var(--text-secondary);">Your answer: <em>"${escapeHtml(res.userAnswer)}"</em></p>`
                        : ''
                    }
                    <ul class="bank-card-answers">
                      ${answers.slice(0, 5).map((a) => `<li>${escapeHtml(a)}</li>`).join('')}
                      ${answers.length > 5 ? `<li><em>…and ${answers.length - 5} more accepted answers</em></li>` : ''}
                    </ul>
                  </li>
                `;
              })
              .join('')}
          </ul>
        </div>
      `;

      const currentMode = session.rules.mode;
      container
        .querySelector('#exam-retake-btn')
        ?.addEventListener('click', () => startNewExam(currentMode));
      container.querySelector('#exam-change-mode-btn')?.addEventListener('click', () => {
        session = null;
        render();
      });
      container.querySelector('#exam-review-missed-btn')?.addEventListener('click', () => {
        callbacks.onPracticeReview();
      });
      return;
    }

    // 3. Active question screen
    const question = session.queue[session.currentIndex];
    if (!question) return;
    const effectiveAnswers = getEffectiveAnswers(question, appState.settings.officials);

    container.innerHTML = `
      <div class="study-stage-wrapper">
        <div class="study-toolbar">
          <h1 id="main-heading" tabindex="-1" style="margin:0;font-size:1.35rem;">
            ${session.rules.mode === '65-20' ? '65/20 Mock Exam ★' : 'Standard 2025 Mock Exam'}
          </h1>
          <button type="button" id="exam-quit-btn" class="btn btn--ghost">Exit Exam</button>
        </div>

        <div class="exam-hud" aria-label="Exam score">
          <div class="hud-pill">
            <span class="hud-pill-label">Question</span>
            <span class="hud-pill-value">${tallies.answered + 1} / ${session.rules.maxQuestions}</span>
          </div>
          <div class="hud-pill hud-pill--pass">
            <span class="hud-pill-label">Correct (Pass at ${session.rules.passThreshold})</span>
            <span class="hud-pill-value">${tallies.correct}</span>
          </div>
          <div class="hud-pill hud-pill--miss">
            <span class="hud-pill-label">Incorrect (Stop at ${session.rules.failThreshold})</span>
            <span class="hud-pill-value">${tallies.incorrect}</span>
          </div>
        </div>

        <progress
          class="progress-track progress-track--success"
          style="margin-block-end:1.15rem;"
          max="${session.rules.passThreshold}"
          value="${tallies.correct}"
          aria-label="${tallies.correct} of ${session.rules.passThreshold} correct answers needed to pass"
        ></progress>

        <article class="question-card">
          <div class="question-card-top">
            <div class="badge-row">
              <span class="badge badge--number">Q${displayNumber(question)}</span>
              <span class="badge badge--category">${escapeHtml(question.category)}</span>
              ${question.is6520 ? `<span class="badge badge--6520">★ 65/20</span>` : ''}
            </div>
            ${
              ttsSupported
                ? `
              <button
                type="button"
                id="exam-speak-btn"
                class="icon-btn ${speaking ? 'is-speaking' : ''}"
                aria-label="${speaking ? 'Stop officer voice' : 'Hear officer ask question'}"
              >
                ${speaking ? ICONS.stop : ICONS.volume}
                <span>${speaking ? 'Stop' : 'Officer Voice'}</span>
              </button>
            `
                : ''
            }
          </div>

          <h2 class="question-stem">${escapeHtml(question.question)}</h2>

          ${
            question.requiredCount > 1
              ? `<p class="notice notice--info" style="margin:0;">Give <strong>${question.requiredCount}</strong> distinct answers.</p>`
              : ''
          }

          <div class="response-composer">
            <div class="voice-controls-row">
              ${
                micSupported
                  ? `
                <button
                  type="button"
                  id="exam-mic-btn"
                  class="btn ${listening ? 'btn--danger is-listening' : 'btn--primary'} mic-btn"
                >
                  ${ICONS.mic} ${listening ? 'Listening… Tap to Stop' : 'Speak Answer'}
                </button>
              `
                  : `<span class="field-hint">Voice input unavailable in this browser — type your answer or reveal to self-grade.</span>`
              }
              <button type="button" id="exam-reveal-btn" class="btn btn--secondary" style="margin-inline-start:auto;">
                Reveal Official Answers
              </button>
            </div>

            ${
              listening
                ? `<div class="transcript-box"><span class="transcript-label">Live Transcript</span><span id="exam-live-transcript">${escapeHtml(userResponse || 'Speak now…')}</span></div>`
                : ''
            }

            ${micError ? `<p class="notice notice--error" style="margin:0;">${escapeHtml(micError)}</p>` : ''}

            <form id="exam-answer-form" class="typed-answer-form">
              <label for="exam-answer-input" class="visually-hidden">Type your answer in English</label>
              <input
                id="exam-answer-input"
                type="text"
                class="text-input"
                value="${escapeHtml(userResponse)}"
                placeholder="Or type your answer in English and press Check…"
              />
              <button type="submit" class="btn btn--secondary">Check Answer</button>
            </form>
          </div>

          ${
            revealedManually
              ? `
            <div class="answer-panel">
              ${
                evaluated
                  ? `<p class="notice ${evaluated.isMatch ? 'notice--success' : 'notice--info'}" style="margin:0;">${escapeHtml(evaluated.feedback)}</p>`
                  : ''
              }
              <h3 class="answer-panel-title">Official USCIS Accepted Answers</h3>
              <ul class="answer-list">
                ${effectiveAnswers
                  .map((ans) => {
                    const matched = evaluated?.matchedAnswers.includes(ans) ?? false;
                    return `<li class="${matched ? 'is-matched' : ''}">${escapeHtml(ans)}${matched ? ' ✓' : ''}</li>`;
                  })
                  .join('')}
              </ul>
              ${question.note ? `<p class="notice" style="margin:0;">${escapeHtml(question.note)}</p>` : ''}

              <div class="card-actions">
                <span style="font-size:0.88rem;color:var(--text-secondary);">Confirm your grade to continue:</span>
                <div class="card-action-group">
                  <button type="button" id="exam-grade-wrong" class="btn btn--soft-danger">
                    Mark Missed
                  </button>
                  <button type="button" id="exam-grade-correct" class="btn btn--success">
                    ${ICONS.check} Mark Correct
                  </button>
                </div>
              </div>
            </div>
          `
              : ''
          }
        </article>
      </div>
    `;

    container.querySelector('#exam-quit-btn')?.addEventListener('click', () => {
      stopAudio();
      session = null;
      render();
    });

    container
      .querySelector('#exam-speak-btn')
      ?.addEventListener('click', () => readQuestion(question.question));

    container.querySelector('#exam-mic-btn')?.addEventListener('click', toggleMic);

    container.querySelector('#exam-reveal-btn')?.addEventListener('click', () => {
      revealedManually = true;
      render();
      announce('Official answers revealed. Mark whether your response was correct or missed.');
    });

    const inputEl = container.querySelector<HTMLInputElement>('#exam-answer-input');
    inputEl?.addEventListener('input', () => {
      userResponse = inputEl.value;
    });

    container.querySelector('#exam-answer-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      userResponse = inputEl?.value ?? userResponse;
      checkCurrentAnswer();
    });

    container
      .querySelector('#exam-grade-correct')
      ?.addEventListener('click', () => commitGrade(true));
    container
      .querySelector('#exam-grade-wrong')
      ?.addEventListener('click', () => commitGrade(false));
  };

  render();

  return () => {
    stopAudio();
  };
}
