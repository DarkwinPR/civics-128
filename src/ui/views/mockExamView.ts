import { evaluateAnswer } from '../../domain/answerMatcher';
import {
  createExamSession,
  getExamRules,
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
import { renderTranslationToggle } from '../translation';
import { launchConfetti } from '../confetti';

export interface MockExamCallbacks {
  /** Open the full interview simulation (N-400, civics, reading, writing). */
  onStartFullInterview?: () => void;
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
  let showTranslation = false;

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
    showTranslation = false;
    render();

    const firstQ = session.queue[0];
    if (firstQ && callbacks.getState().settings.autoSpeak) {
      readQuestion(firstQ.question);
    }
    const startParams = {
      year: getTestVersion(),
      max: session.rules.maxQuestions,
      pass: session.rules.passThreshold,
    };
    announce(
      mode === '65-20'
        ? t('exam.announceStart6520', startParams)
        : t('exam.announceStartStandard', startParams),
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
        announce(t('exam.announceListening'));
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
    showTranslation = false;

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
          ? t('exam.announcePassed', { correct: record.correct })
          : t('exam.announceEnded', { correct: record.correct, asked: record.asked }),
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
      const year = getTestVersion();
      const standardRules = getExamRules('standard');
      const rules6520 = getExamRules('65-20');
      const total = CIVICS_QUESTIONS.length;
      const starred = CIVICS_QUESTIONS.filter((q) => q.is6520).length;
      container.innerHTML = `
        <div class="study-stage-wrapper">
          <div class="view-header">
            <div>
              <h1 id="main-heading" tabindex="-1">${escapeHtml(t('exam.setupTitle', { year }))}</h1>
              <p class="view-lead">
                ${escapeHtml(t('exam.setupLead'))}
              </p>
            </div>
          </div>

          ${
            callbacks.onStartFullInterview
              ? `<article class="full-interview-card">
                  <span class="full-interview-icon" aria-hidden="true">🧑‍💼</span>
                  <div>
                    <h2>${escapeHtml(t('mock.fullCardTitle'))}</h2>
                    <p>${escapeHtml(t('mock.fullCardBody'))}</p>
                    <button type="button" id="start-full-interview-btn" class="btn btn--primary">${escapeHtml(t('mock.fullCardButton'))}</button>
                  </div>
                </article>`
              : ''
          }

          <div class="exam-mode-grid">
            <article class="mode-option-card">
              <div class="badge-row">
                <span class="badge badge--number">${escapeHtml(t('exam.standardBadge', { year }))}</span>
                <span class="badge badge--category">${escapeHtml(t('exam.questionCount', { n: total }))}</span>
              </div>
              <h2>${escapeHtml(t('exam.standardTitle'))}</h2>
              <p>${escapeHtml(t(year === '2008' ? 'exam.standardWho2008' : 'exam.standardWho2025'))}</p>
              <ul class="rule-list">
                <li>${t('exam.ruleStandardAsked', { max: standardRules.maxQuestions, total })}</li>
                <li>${t('exam.rulePass', { n: standardRules.passThreshold })}</li>
                <li>${t('exam.ruleFail', { n: standardRules.failThreshold })}</li>
                <li>${escapeHtml(t('exam.ruleAnswerWays'))}</li>
              </ul>
              <button type="button" id="start-standard-btn" class="btn btn--primary btn--lg">
                ${escapeHtml(t('exam.startStandard', { n: standardRules.maxQuestions }))}
              </button>
            </article>

            <article class="mode-option-card">
              <div class="badge-row">
                <span class="badge badge--6520">${escapeHtml(t('exam.6520Badge'))}</span>
                <span class="badge badge--category">${escapeHtml(t('exam.starredCount', { n: starred }))}</span>
              </div>
              <h2>${escapeHtml(t('exam.6520Title'))}</h2>
              <p>${escapeHtml(t('exam.6520Who'))}</p>
              <ul class="rule-list">
                <li>${t('exam.rule6520Asked', { max: rules6520.maxQuestions, starred })}</li>
                <li>${t('exam.rulePass', { n: rules6520.passThreshold })}</li>
                <li>${t('exam.ruleFail', { n: rules6520.failThreshold })}</li>
                <li>${escapeHtml(t('exam.rule6520Drill'))}</li>
              </ul>
              <button type="button" id="start-6520-btn" class="btn btn--secondary btn--lg">
                ${escapeHtml(t('exam.start6520', { n: rules6520.maxQuestions }))}
              </button>
            </article>
          </div>
        </div>
      `;

      container
        .querySelector('#start-full-interview-btn')
        ?.addEventListener('click', () => callbacks.onStartFullInterview?.());
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
          <h1 id="main-heading" tabindex="-1" class="visually-hidden">${escapeHtml(t('exam.resultsHeading'))}</h1>

          <section class="result-banner ${passed ? 'result-banner--passed' : 'result-banner--failed'}" aria-label="${escapeHtml(t('exam.outcomeAria'))}">
            <span class="badge ${passed ? 'badge--mastered' : 'badge--review'}">
              ${escapeHtml(session.rules.mode === '65-20' ? t('exam.result6520Badge') : t('exam.resultStandardBadge', { year: getTestVersion() }))}
            </span>
            <h2>${escapeHtml(passed ? t('exam.passedTitle') : t('exam.failedTitle'))}</h2>
            <p style="margin:0;max-inline-size:48ch;color:var(--text-primary);">
              ${t('exam.resultSummary', {
                correct: tallies.correct,
                incorrect: tallies.incorrect,
                asked: tallies.answered,
                pass: session.rules.passThreshold,
                max: session.rules.maxQuestions,
              })}
            </p>
            <div class="hero-actions" style="justify-content:center;">
              <button type="button" id="exam-retake-btn" class="btn btn--primary">
                ${ICONS.rotate} ${escapeHtml(t('exam.retake'))}
              </button>
              ${
                missedCount > 0
                  ? `<button type="button" id="exam-review-missed-btn" class="btn btn--secondary">${escapeHtml(t('exam.practiceFlagged', { n: missedCount }))}</button>`
                  : ''
              }
              <button type="button" id="exam-change-mode-btn" class="btn btn--ghost">${escapeHtml(t('exam.changeMode'))}</button>
              ${
                passed
                  ? `<a class="btn btn--success" target="_blank" rel="noopener noreferrer" href="https://wa.me/?text=${encodeURIComponent(
                      t('share.passedMessage', { score: `${tallies.correct}/${tallies.answered}`, url: appUrl() }),
                    )}">💬 ${escapeHtml(t('share.whatsapp'))}</a>`
                  : ''
              }
            </div>
          </section>

          <h3 style="margin:0 0 0.85rem;">${escapeHtml(t('exam.reviewHeading'))}</h3>
          <ul class="review-list" role="list">
            ${session.results
              .map((res, idx) => {
                const q = CIVICS_QUESTIONS.find((item) => item.id === res.questionId);
                if (!q) return '';
                const answers = getEffectiveAnswers(q, appState.settings.officials);
                return `
                  <li class="review-card ${res.correct ? 'review-card--correct' : 'review-card--wrong'}">
                    <div class="badge-row" style="margin-block-end:0.45rem;">
                      <span class="badge badge--number">#${idx + 1} · ${escapeHtml(t('exam.qNumber', { n: displayNumber(q) }))}</span>
                      <span class="badge ${res.correct ? 'badge--mastered' : 'badge--review'}">
                        ${escapeHtml(res.correct ? t('exam.correct') : t('exam.missed'))}
                      </span>
                    </div>
                    <p style="margin:0 0 0.45rem;font-weight:700;">${escapeHtml(q.question)}</p>
                    ${
                      res.userAnswer
                        ? `<p style="margin:0 0 0.45rem;font-size:0.88rem;color:var(--text-secondary);">${escapeHtml(t('exam.yourAnswer'))} <em>"${escapeHtml(res.userAnswer)}"</em></p>`
                        : ''
                    }
                    <ul class="bank-card-answers">
                      ${answers.slice(0, 5).map((a) => `<li>${escapeHtml(a)}</li>`).join('')}
                      ${answers.length > 5 ? `<li><em>${escapeHtml(t('exam.moreAnswers', { n: answers.length - 5 }))}</em></li>` : ''}
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
            ${escapeHtml(session.rules.mode === '65-20' ? t('exam.active6520Title') : t('exam.activeStandardTitle', { year: getTestVersion() }))}
          </h1>
          <button type="button" id="exam-quit-btn" class="btn btn--ghost">${escapeHtml(t('exam.exit'))}</button>
        </div>

        <div class="exam-hud" aria-label="${escapeHtml(t('exam.scoreAria'))}">
          <div class="hud-pill">
            <span class="hud-pill-label">${escapeHtml(t('exam.hudQuestion'))}</span>
            <span class="hud-pill-value">${tallies.answered + 1} / ${session.rules.maxQuestions}</span>
          </div>
          <div class="hud-pill hud-pill--pass">
            <span class="hud-pill-label">${escapeHtml(t('exam.hudCorrect', { n: session.rules.passThreshold }))}</span>
            <span class="hud-pill-value">${tallies.correct}</span>
          </div>
          <div class="hud-pill hud-pill--miss">
            <span class="hud-pill-label">${escapeHtml(t('exam.hudIncorrect', { n: session.rules.failThreshold }))}</span>
            <span class="hud-pill-value">${tallies.incorrect}</span>
          </div>
        </div>

        <progress
          class="progress-track progress-track--success"
          style="margin-block-end:1.15rem;"
          max="${session.rules.passThreshold}"
          value="${tallies.correct}"
          aria-label="${escapeHtml(t('exam.progressAria', { correct: tallies.correct, pass: session.rules.passThreshold }))}"
        ></progress>

        <article class="question-card">
          <div class="question-card-top">
            <div class="badge-row">
              <span class="badge badge--number">${escapeHtml(t('exam.qNumber', { n: displayNumber(question) }))}</span>
              <span class="badge badge--category">${escapeHtml(t(`category.${question.category}`))}</span>
              ${question.is6520 ? `<span class="badge badge--6520">★ 65/20</span>` : ''}
            </div>
            ${
              ttsSupported
                ? `
              <button
                type="button"
                id="exam-speak-btn"
                class="icon-btn ${speaking ? 'is-speaking' : ''}"
                aria-label="${escapeHtml(speaking ? t('exam.stopVoiceAria') : t('exam.hearVoiceAria'))}"
              >
                ${speaking ? ICONS.stop : ICONS.volume}
                <span>${escapeHtml(speaking ? t('exam.stop') : t('exam.officerVoice'))}</span>
              </button>
            `
                : ''
            }
          </div>

          <h2 class="question-stem">${escapeHtml(question.question)}</h2>

          ${renderTranslationToggle(question, showTranslation, false)}

          ${
            question.requiredCount > 1
              ? `<p class="notice notice--info" style="margin:0;">${t('exam.giveAnswers', { n: question.requiredCount })}</p>`
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
                  ${ICONS.mic} ${escapeHtml(listening ? t('exam.listening') : t('exam.speakAnswer'))}
                </button>
              `
                  : `<span class="field-hint">${escapeHtml(t('exam.noMic'))}</span>`
              }
              <button type="button" id="exam-reveal-btn" class="btn btn--secondary" style="margin-inline-start:auto;">
                ${escapeHtml(t('exam.reveal'))}
              </button>
            </div>

            ${
              listening
                ? `<div class="transcript-box"><span class="transcript-label">${escapeHtml(t('exam.liveTranscript'))}</span><span id="exam-live-transcript">${escapeHtml(userResponse || t('exam.speakNow'))}</span></div>`
                : ''
            }

            ${micError ? `<p class="notice notice--error" style="margin:0;">${escapeHtml(micError)}</p>` : ''}

            <form id="exam-answer-form" class="typed-answer-form">
              <label for="exam-answer-input" class="visually-hidden">${escapeHtml(t('exam.typeLabel'))}</label>
              <input
                id="exam-answer-input"
                type="text"
                class="text-input"
                value="${escapeHtml(userResponse)}"
                placeholder="${escapeHtml(t('exam.typePlaceholder'))}"
              />
              <button type="submit" class="btn btn--secondary">${escapeHtml(t('exam.check'))}</button>
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
              <h3 class="answer-panel-title">${escapeHtml(t('exam.officialAnswers'))}</h3>
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
                <span style="font-size:0.88rem;color:var(--text-secondary);">${escapeHtml(t('exam.confirmGrade'))}</span>
                <div class="card-action-group">
                  <button type="button" id="exam-grade-wrong" class="btn btn--soft-danger">
                    ${escapeHtml(t('exam.markMissed'))}
                  </button>
                  <button type="button" id="exam-grade-correct" class="btn btn--success">
                    ${ICONS.check} ${escapeHtml(t('exam.markCorrect'))}
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

    container
      .querySelector('[data-action="toggle-translation"]')
      ?.addEventListener('click', () => {
        showTranslation = !showTranslation;
        render();
      });

    container.querySelector('#exam-reveal-btn')?.addEventListener('click', () => {
      revealedManually = true;
      render();
      announce(t('exam.announceRevealed'));
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
