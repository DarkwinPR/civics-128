import { evaluateAnswer } from '../../domain/answerMatcher';
import { shuffleArray } from '../../domain/examEngine';
import { CATEGORIES, CIVICS_QUESTIONS, getEffectiveAnswers, displayNumber } from '../../domain/questions';
import type { AnswerMatchResult, CivicsCategory, CivicsQuestion, PersistedState } from '../../domain/types';
import { getQuestionProgress } from '../../services/storage';
import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  speakText,
  startListening,
  stopSpeaking,
  type ListeningSession,
} from '../../services/speech';
import { t } from '../../i18n';
import { renderTranslationToggle } from '../translation';
import { announce } from '../announcer';
import { escapeHtml, ICONS } from '../dom';

type OralPool = 'smart' | 'all' | '65-20' | CivicsCategory;

export interface OralPracticeCallbacks {
  getState: () => PersistedState;
  onRecordResult: (questionId: number, correct: boolean) => void;
}

export function mountOralPracticeView(
  container: HTMLElement,
  callbacks: OralPracticeCallbacks,
): () => void {
  const ttsSupported = isSpeechSynthesisSupported();
  const micSupported = isSpeechRecognitionSupported();

  let pool: OralPool = 'smart';
  let hideTextUntilAnswered = false;
  let queue: CivicsQuestion[] = [];
  let index = 0;
  let speaking = false;
  let listening = false;
  let transcript = '';
  let micError = '';
  let evaluation: AnswerMatchResult | null = null;
  let sessionCorrect = 0;
  let sessionPracticed = 0;
  let activeMic: ListeningSession | null = null;
  let showTranslation = false;

  const stopAudio = () => {
    stopSpeaking();
    speaking = false;
    activeMic?.abort();
    activeMic = null;
    listening = false;
  };

  const buildQueue = (selectedPool: OralPool) => {
    const state = callbacks.getState();
    let list: CivicsQuestion[];

    if (selectedPool === 'smart') {
      const review = CIVICS_QUESTIONS.filter(
        (q) => getQuestionProgress(state, q.id).status === 'review',
      );
      const unseen = CIVICS_QUESTIONS.filter(
        (q) => getQuestionProgress(state, q.id).status === 'unseen',
      );
      const mastered = CIVICS_QUESTIONS.filter(
        (q) => getQuestionProgress(state, q.id).status === 'mastered',
      );
      list = [...shuffleArray(review), ...shuffleArray(unseen), ...shuffleArray(mastered)];
    } else if (selectedPool === '65-20') {
      list = shuffleArray(CIVICS_QUESTIONS.filter((q) => q.is6520));
    } else if (selectedPool === 'all') {
      list = shuffleArray(CIVICS_QUESTIONS);
    } else {
      list = shuffleArray(CIVICS_QUESTIONS.filter((q) => q.category === selectedPool));
    }

    queue = list;
    index = 0;
    showTranslation = false;
    transcript = '';
    micError = '';
    evaluation = null;
  };

  const askCurrentAloud = () => {
    const q = queue[index];
    if (!q || !ttsSupported) return;
    if (speaking) {
      stopSpeaking();
      speaking = false;
      render();
      return;
    }

    const { speechRate, voiceURI } = callbacks.getState().settings;
    speakText(q.question, {
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

  const runEvaluation = () => {
    const q = queue[index];
    if (!q) return;
    evaluation = evaluateAnswer(q, transcript, callbacks.getState().settings.officials);
    render();
    announce(evaluation.feedback);
  };

  const toggleMic = () => {
    if (listening) {
      activeMic?.stop();
      return;
    }

    micError = '';
    evaluation = null;
    transcript = '';

    activeMic = startListening({
      onStart: () => {
        listening = true;
        render();
        announce(t('oral.announceMic'));
      },
      onInterim: (text) => {
        transcript = text;
        const live = container.querySelector<HTMLElement>('#oral-live-transcript');
        if (live) live.textContent = text;
        const input = container.querySelector<HTMLInputElement>('#oral-typed-input');
        if (input) input.value = text;
      },
      onFinal: (text) => {
        transcript = text;
        runEvaluation();
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

  const advance = (markCorrect: boolean | null) => {
    const q = queue[index];
    stopAudio();
    if (q && markCorrect !== null) {
      callbacks.onRecordResult(q.id, markCorrect);
      sessionPracticed += 1;
      if (markCorrect) sessionCorrect += 1;
    }
    index = (index + 1) % Math.max(1, queue.length);
    showTranslation = false;
    transcript = '';
    micError = '';
    evaluation = null;
    render();
    if (ttsSupported) {
      askCurrentAloud();
    }
  };

  const render = () => {
    const appState = callbacks.getState();
    const q = queue[index];
    if (!q) return;

    const effectiveAnswers = getEffectiveAnswers(q, appState.settings.officials);
    const poolOptions: Array<{ id: OralPool; label: string }> = [
      { id: 'smart', label: t('oral.poolSmart') },
      { id: 'all', label: t('oral.poolAll') },
      { id: '65-20', label: t('oral.pool6520') },
      ...CATEGORIES.map((c) => ({ id: c as OralPool, label: t(`category.${c}`) })),
    ];

    const showPromptText = !hideTextUntilAnswered || evaluation !== null;

    container.innerHTML = `
      <div class="study-stage-wrapper">
        <div class="view-header">
          <div>
            <h1 id="main-heading" tabindex="-1">${escapeHtml(t('oral.title'))}</h1>
            <p class="view-lead">
              ${escapeHtml(t('oral.lead'))}
            </p>
          </div>
          <div class="badge-row">
            <span class="badge badge--mastered">${escapeHtml(t('oral.session', { correct: sessionCorrect, total: sessionPracticed }))}</span>
          </div>
        </div>

        <div class="pill-bar" role="group" aria-label="${escapeHtml(t('oral.poolAria'))}" style="margin-block-end:1rem;">
          ${poolOptions
            .map(
              (opt) => `
            <button
              type="button"
              class="pill-btn"
              data-pool="${escapeHtml(opt.id)}"
              aria-pressed="${pool === opt.id}"
            >
              ${escapeHtml(opt.label)}
            </button>
          `,
            )
            .join('')}
        </div>

        ${
          ttsSupported
            ? `
          <div style="margin-block-end:1rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;">
            <label style="display:inline-flex;align-items:center;gap:0.5rem;font-size:0.9rem;cursor:pointer;">
              <input id="oral-blind-toggle" type="checkbox" ${hideTextUntilAnswered ? 'checked' : ''} />
              ${escapeHtml(t('oral.earTraining'))}
            </label>
            <span style="font-size:0.85rem;color:var(--text-muted);">${escapeHtml(t('oral.counter', { n: index + 1, total: queue.length }))}</span>
          </div>
        `
            : `<p class="notice notice--gold" style="margin-block-end:1rem;">${escapeHtml(t('oral.noTts'))}</p>`
        }

        <article class="question-card">
          <div class="question-card-top">
            <div class="badge-row">
              <span class="badge badge--number">Q${displayNumber(q)}</span>
              <span class="badge badge--category">${escapeHtml(t(`category.${q.category}`))}</span>
              ${q.is6520 ? `<span class="badge badge--6520">★ 65/20</span>` : ''}
            </div>
            ${
              ttsSupported
                ? `
              <button
                type="button"
                id="oral-ask-btn"
                class="btn ${speaking ? 'btn--danger' : 'btn--primary'}"
              >
                ${speaking ? ICONS.stop : ICONS.volume}
                ${escapeHtml(speaking ? t('oral.stopOfficer') : t('oral.askOfficer'))}
              </button>
            `
                : ''
            }
          </div>

          ${
            showPromptText
              ? `<h2 class="question-stem">${escapeHtml(q.question)}</h2>
              ${renderTranslationToggle(q, showTranslation, evaluation !== null)}`
              : `
            <div class="answer-hidden-box">
              <p><strong>${escapeHtml(t('oral.earActiveTitle'))}</strong> ${escapeHtml(t('oral.earActiveHelp', { button: t('oral.askOfficer') }))}</p>
              <button type="button" id="oral-peek-btn" class="btn btn--ghost">${escapeHtml(t('oral.showText'))}</button>
            </div>
          `
          }

          ${
            q.requiredCount > 1
              ? `<p class="notice notice--info" style="margin:0;">${t('oral.requiredCount', { n: q.requiredCount })}</p>`
              : ''
          }

          <div class="response-composer">
            <div class="voice-controls-row">
              ${
                micSupported
                  ? `
                <button
                  type="button"
                  id="oral-mic-btn"
                  class="btn btn--lg ${listening ? 'btn--danger is-listening' : 'btn--primary'} mic-btn"
                >
                  ${ICONS.mic} ${escapeHtml(listening ? t('oral.listeningBtn') : t('oral.speakBtn'))}
                </button>
              `
                  : `<p class="notice" style="margin:0;">${escapeHtml(t('oral.noMic'))}</p>`
              }
              <button type="button" id="oral-reveal-btn" class="btn btn--secondary" style="margin-inline-start:auto;">
                ${escapeHtml(t('oral.reveal'))}
              </button>
            </div>

            ${
              listening || transcript
                ? `
              <div class="transcript-box">
                <span class="transcript-label">${escapeHtml(listening ? t('oral.listeningLive') : t('oral.captured'))}</span>
                <span id="oral-live-transcript">${escapeHtml(transcript || t('oral.speakClearly'))}</span>
              </div>
            `
                : ''
            }

            ${micError ? `<p class="notice notice--error" style="margin:0;">${escapeHtml(micError)}</p>` : ''}

            <form id="oral-typed-form" class="typed-answer-form">
              <label for="oral-typed-input" class="visually-hidden">${escapeHtml(t('oral.typedLabel'))}</label>
              <input
                id="oral-typed-input"
                type="text"
                class="text-input"
                value="${escapeHtml(transcript)}"
                placeholder="${escapeHtml(t('oral.typedPlaceholder'))}"
              />
              <button type="submit" class="btn btn--secondary">${escapeHtml(t('oral.evaluate'))}</button>
            </form>
          </div>

          ${
            evaluation
              ? `
            <div class="answer-panel">
              <p class="notice ${evaluation.isMatch ? 'notice--success' : 'notice--info'}" style="margin:0;">
                ${escapeHtml(evaluation.feedback)}
              </p>
              <h3 class="answer-panel-title">${escapeHtml(t('oral.answersTitle'))}</h3>
              <ul class="answer-list">
                ${effectiveAnswers
                  .map((ans) => {
                    const matched = evaluation?.matchedAnswers.includes(ans) ?? false;
                    return `<li class="${matched ? 'is-matched' : ''}">${escapeHtml(ans)}${matched ? ' ✓' : ''}</li>`;
                  })
                  .join('')}
              </ul>
              ${q.note ? `<p class="notice" style="margin:0;">${escapeHtml(q.note)}</p>` : ''}

              <div class="card-actions">
                <button type="button" id="oral-retry-btn" class="btn btn--ghost">
                  ${ICONS.rotate} ${escapeHtml(t('oral.retry'))}
                </button>
                <div class="card-action-group">
                  <button type="button" id="oral-flag-next" class="btn btn--soft-danger">
                    ${escapeHtml(t('oral.flagNext'))}
                  </button>
                  <button type="button" id="oral-pass-next" class="btn btn--success">
                    ${ICONS.check} ${escapeHtml(t('oral.passNext'))}
                  </button>
                </div>
              </div>
            </div>
          `
              : `
            <div class="card-actions">
              <span class="field-hint">${escapeHtml(t('oral.tip'))}</span>
              <button type="button" id="oral-skip-btn" class="btn btn--ghost">${escapeHtml(t('oral.skip'))} ${ICONS.arrowRight}</button>
            </div>
          `
          }
        </article>
      </div>
    `;

    container.querySelectorAll<HTMLButtonElement>('[data-pool]').forEach((btn) => {
      btn.addEventListener('click', () => {
        stopAudio();
        pool = btn.dataset.pool as OralPool;
        buildQueue(pool);
        render();
      });
    });

    const blindToggle = container.querySelector<HTMLInputElement>('#oral-blind-toggle');
    blindToggle?.addEventListener('change', () => {
      hideTextUntilAnswered = blindToggle.checked;
      render();
    });

    container.querySelector('#oral-peek-btn')?.addEventListener('click', () => {
      hideTextUntilAnswered = false;
      render();
    });

    container.querySelector('[data-action="toggle-translation"]')?.addEventListener('click', () => {
      showTranslation = !showTranslation;
      render();
    });

    container.querySelector('#oral-ask-btn')?.addEventListener('click', askCurrentAloud);
    container.querySelector('#oral-mic-btn')?.addEventListener('click', toggleMic);
    container.querySelector('#oral-reveal-btn')?.addEventListener('click', () => {
      evaluation = evaluateAnswer(q, transcript, appState.settings.officials);
      render();
    });

    const typedInput = container.querySelector<HTMLInputElement>('#oral-typed-input');
    typedInput?.addEventListener('input', () => {
      transcript = typedInput.value;
    });

    container.querySelector('#oral-typed-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      transcript = typedInput?.value ?? transcript;
      runEvaluation();
    });

    container.querySelector('#oral-retry-btn')?.addEventListener('click', () => {
      transcript = '';
      evaluation = null;
      micError = '';
      render();
    });

    container.querySelector('#oral-flag-next')?.addEventListener('click', () => advance(false));
    container.querySelector('#oral-pass-next')?.addEventListener('click', () => advance(true));
    container.querySelector('#oral-skip-btn')?.addEventListener('click', () => advance(null));
  };

  buildQueue(pool);
  render();

  return () => {
    stopAudio();
  };
}
