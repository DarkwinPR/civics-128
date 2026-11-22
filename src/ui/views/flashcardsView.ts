import {
  CATEGORIES,
  CIVICS_QUESTIONS,
  getEffectiveAnswers,
  displayNumber,
  getTestVersion,
  isDynamicUnconfigured,
} from '../../domain/questions';
import { shuffleArray } from '../../domain/examEngine';
import type { CivicsCategory, CivicsQuestion, MasteryStatus, PersistedState } from '../../domain/types';
import { getQuestionProgress, isDueForReview } from '../../services/storage';
import { renderReportLink, renderTranslationToggle } from '../translation';
import { t } from '../../i18n';
import { isSpeechSynthesisSupported, speakText, stopSpeaking } from '../../services/speech';
import { announce } from '../announcer';
import { escapeHtml, ICONS } from '../dom';

export type FlashcardFilter = 'all' | '65-20' | 'review' | 'due' | CivicsCategory;

const AUTO_REVEAL_MS = 7000;

export interface FlashcardsViewState {
  filter: FlashcardFilter;
  shuffled: boolean;
  timerEnabled: boolean;
  deckIds: number[];
  index: number;
  revealed: boolean;
}

export interface FlashcardsCallbacks {
  getState: () => PersistedState;
  onSetStatus: (questionId: number, status: MasteryStatus) => void;
  onOpenSettings: () => void;
}

export function createInitialFlashcardsState(
  state: PersistedState,
  filter: FlashcardFilter = 'all',
): FlashcardsViewState {
  const deck = buildDeck(state, filter, false);
  return {
    filter,
    shuffled: false,
    timerEnabled: true,
    deckIds: deck.map((q) => q.id),
    index: 0,
    revealed: false,
  };
}

function buildDeck(
  state: PersistedState,
  filter: FlashcardFilter,
  shuffled: boolean,
): CivicsQuestion[] {
  let list = [...CIVICS_QUESTIONS];
  if (filter === '65-20') {
    list = list.filter((q) => q.is6520);
  } else if (filter === 'review') {
    list = list.filter((q) => getQuestionProgress(state, q.id).status === 'review');
  } else if (filter === 'due') {
    // Smart review: cards whose spaced-repetition date has arrived, oldest first.
    const now = new Date();
    list = list
      .filter((q) => isDueForReview(getQuestionProgress(state, q.id), now))
      .sort(
        (a, b) =>
          (getQuestionProgress(state, a.id).dueAt ?? '').localeCompare(
            getQuestionProgress(state, b.id).dueAt ?? '',
          ),
      );
    return list;
  } else if (filter !== 'all') {
    list = list.filter((q) => q.category === filter);
  }
  return shuffled ? shuffleArray(list) : list;
}

export function mountFlashcardsView(
  container: HTMLElement,
  viewState: FlashcardsViewState,
  callbacks: FlashcardsCallbacks,
): () => void {
  const ttsSupported = isSpeechSynthesisSupported();
  let isSpeaking = false;
  let showTranslation = false;
  let remainingMs = AUTO_REVEAL_MS;
  let timerPaused = false;
  let countdownInterval: number | undefined;
  let lastTickAt = 0;

  const getQuestionById = (id: number): CivicsQuestion | undefined =>
    CIVICS_QUESTIONS.find((q) => q.id === id);

  const stopCountdown = () => {
    if (countdownInterval !== undefined) {
      window.clearInterval(countdownInterval);
      countdownInterval = undefined;
    }
  };

  const syncCountdownDom = () => {
    const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
    const secEl = container.querySelector<HTMLElement>('#fc-timer-seconds');
    if (secEl) {
      secEl.textContent = t('flashcards.seconds', { n: seconds });
      secEl.classList.toggle('is-urgent', remainingMs <= 2000);
    }
    const barEl = container.querySelector<HTMLProgressElement>('#fc-timer-progress');
    if (barEl) {
      barEl.value = Math.max(0, Math.round(remainingMs));
      barEl.classList.toggle('progress-track--urgent', remainingMs <= 2000);
    }
  };

  const startCountdown = () => {
    stopCountdown();
    if (!viewState.timerEnabled || viewState.revealed || viewState.deckIds.length === 0) {
      return;
    }
    lastTickAt = performance.now();
    countdownInterval = window.setInterval(() => {
      const now = performance.now();
      const delta = now - lastTickAt;
      lastTickAt = now;

      if (
        timerPaused ||
        !viewState.timerEnabled ||
        viewState.revealed ||
        document.querySelector('dialog[open]')
      ) {
        return;
      }

      remainingMs = Math.max(0, remainingMs - delta);
      if (remainingMs <= 0) {
        stopCountdown();
        viewState.revealed = true;
        render();
        announce(t('flashcards.announceTimeUp'));
        return;
      }
      syncCountdownDom();
    }, 100);
  };

  const resetCountdown = () => {
    remainingMs = AUTO_REVEAL_MS;
    timerPaused = false;
    startCountdown();
  };

  const toggleTimerEnabled = () => {
    viewState.timerEnabled = !viewState.timerEnabled;
    if (viewState.timerEnabled) {
      resetCountdown();
    } else {
      stopCountdown();
      timerPaused = false;
    }
    render();
    announce(
      viewState.timerEnabled
        ? t('flashcards.announceTimerOn')
        : t('flashcards.announceTimerOff'),
    );
  };

  const toggleTimerPaused = () => {
    if (!viewState.timerEnabled || viewState.revealed) return;
    timerPaused = !timerPaused;
    lastTickAt = performance.now();
    render();
    announce(timerPaused ? t('flashcards.announcePaused') : t('flashcards.announceResumed'));
  };

  const rebuildDeck = (nextFilter: FlashcardFilter, nextShuffled: boolean) => {
    stopSpeaking();
    isSpeaking = false;
    viewState.filter = nextFilter;
    viewState.shuffled = nextShuffled;
    viewState.deckIds = buildDeck(callbacks.getState(), nextFilter, nextShuffled).map((q) => q.id);
    viewState.index = 0;
    viewState.revealed = false;
    resetCountdown();
    render();
  };

  const speakCurrent = (includeAnswers = false) => {
    const qId = viewState.deckIds[viewState.index];
    if (qId === undefined) return;
    const question = getQuestionById(qId);
    if (!question) return;

    if (isSpeaking) {
      stopSpeaking();
      isSpeaking = false;
      render();
      return;
    }

    const appState = callbacks.getState();
    const answers = getEffectiveAnswers(question, appState.settings.officials);
    const text = includeAnswers
      ? `${question.question} Official answers: ${answers.slice(0, 4).join('. ')}`
      : question.question;

    speakText(text, {
      rate: appState.settings.speechRate,
      voiceURI: appState.settings.voiceURI,
      onStart: () => {
        isSpeaking = true;
        render();
      },
      onEnd: () => {
        isSpeaking = false;
        render();
      },
      onError: () => {
        isSpeaking = false;
        render();
      },
    });
  };

  const go = (delta: number) => {
    if (viewState.deckIds.length === 0) return;
    stopSpeaking();
    isSpeaking = false;
    const len = viewState.deckIds.length;
    viewState.index = (viewState.index + delta + len) % len;
    viewState.revealed = false;
    showTranslation = false;
    resetCountdown();
    render();
    if (callbacks.getState().settings.autoSpeak) {
      speakCurrent(false);
    }
  };

  const toggleReveal = () => {
    if (viewState.deckIds.length === 0) return;
    viewState.revealed = !viewState.revealed;
    if (viewState.revealed) {
      stopCountdown();
    } else {
      resetCountdown();
    }
    render();
    announce(viewState.revealed ? t('flashcards.announceShown') : t('flashcards.announceHidden'));
  };

  const markStatus = (status: MasteryStatus) => {
    const qId = viewState.deckIds[viewState.index];
    if (qId === undefined) return;
    callbacks.onSetStatus(qId, status);
    announce(
      status === 'mastered'
        ? t('flashcards.announceMastered', { id: qId })
        : t('flashcards.announceReview', { id: qId }),
    );

    if (viewState.filter === 'review' && status === 'mastered') {
      viewState.deckIds = viewState.deckIds.filter((id) => id !== qId);
      if (viewState.index >= viewState.deckIds.length) {
        viewState.index = Math.max(0, viewState.deckIds.length - 1);
      }
      viewState.revealed = false;
      resetCountdown();
      render();
      return;
    }

    if (viewState.index < viewState.deckIds.length - 1) {
      go(1);
    } else {
      render();
    }
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (document.querySelector('dialog[open]')) return;
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

    if (event.key === ' ' && target?.tagName !== 'BUTTON') {
      event.preventDefault();
      toggleReveal();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(-1);
    } else if (event.key.toLowerCase() === 'l' && ttsSupported) {
      event.preventDefault();
      speakCurrent(false);
    } else if (event.key.toLowerCase() === 'p') {
      event.preventDefault();
      toggleTimerPaused();
    } else if (event.key === '1') {
      event.preventDefault();
      markStatus('review');
    } else if (event.key === '2') {
      event.preventDefault();
      markStatus('mastered');
    }
  };

  window.addEventListener('keydown', handleKeydown);

  const render = () => {
    const appState = callbacks.getState();
    const reviewCount = CIVICS_QUESTIONS.filter(
      (q) => getQuestionProgress(appState, q.id).status === 'review',
    ).length;

    const dueCount = CIVICS_QUESTIONS.filter((q) =>
      isDueForReview(getQuestionProgress(appState, q.id)),
    ).length;
    const starredCount = CIVICS_QUESTIONS.filter((q) => q.is6520).length;

    const filters: Array<{ id: FlashcardFilter; label: string }> = [
      { id: 'all', label: t('flashcards.filterAll', { n: CIVICS_QUESTIONS.length }) },
      { id: 'due', label: t('flashcards.filterDue', { n: dueCount }) },
      { id: '65-20', label: t('flashcards.filter6520', { n: starredCount }) },
      { id: 'review', label: t('flashcards.filterReview', { n: reviewCount }) },
      ...CATEGORIES.map((c) => ({ id: c as FlashcardFilter, label: t(`category.${c}`) })),
    ];

    const currentId = viewState.deckIds[viewState.index];
    const question = currentId !== undefined ? getQuestionById(currentId) : undefined;
    const progress = question ? getQuestionProgress(appState, question.id) : undefined;
    const effectiveAnswers = question
      ? getEffectiveAnswers(question, appState.settings.officials)
      : [];
    const needsCustomState = question
      ? isDynamicUnconfigured(question, appState.settings.officials)
      : false;

    container.innerHTML = `
      <div class="study-stage-wrapper">
        <div class="view-header">
          <div>
            <h1 id="main-heading" tabindex="-1">${escapeHtml(t('flashcards.title'))}</h1>
            <p class="view-lead">${escapeHtml(t('flashcards.lead'))}</p>
          </div>
          <div class="card-action-group">
            <button
              type="button"
              id="fc-timer-toggle-btn"
              class="btn ${viewState.timerEnabled ? 'btn--primary' : 'btn--secondary'}"
              aria-pressed="${viewState.timerEnabled}"
            >
              ${escapeHtml(viewState.timerEnabled ? t('flashcards.timerOn') : t('flashcards.timerOff'))}
            </button>
            <button
              type="button"
              id="fc-shuffle-btn"
              class="btn ${viewState.shuffled ? 'btn--primary' : 'btn--secondary'}"
              aria-pressed="${viewState.shuffled}"
            >
              ${ICONS.shuffle} ${escapeHtml(viewState.shuffled ? t('flashcards.shuffled') : t('flashcards.shuffle'))}
            </button>
          </div>
        </div>

        <div class="pill-bar" role="group" aria-label="${escapeHtml(t('flashcards.filterAria'))}" style="margin-block-end:1.15rem;">
          ${filters
            .map(
              (f) => `
            <button
              type="button"
              class="pill-btn"
              data-filter="${escapeHtml(f.id)}"
              aria-pressed="${viewState.filter === f.id}"
            >
              ${escapeHtml(f.label)}
            </button>
          `,
            )
            .join('')}
        </div>

        ${
          !question
            ? `
          <div class="surface-card" style="text-align:center;padding:2.5rem 1.5rem;">
            <h2 style="margin:0 0 0.5rem;">${escapeHtml(t('flashcards.emptyTitle'))}</h2>
            <p style="margin:0 0 1.25rem;color:var(--text-secondary);">
              ${
                viewState.filter === 'review'
                  ? escapeHtml(t('flashcards.emptyReview'))
                  : escapeHtml(t('flashcards.emptyOther'))
              }
            </p>
            <button type="button" id="fc-show-all-btn" class="btn btn--primary">${escapeHtml(t('flashcards.studyAll'))}</button>
          </div>
        `
            : `
          <div class="study-toolbar">
            <span style="font-weight:700;font-size:0.92rem;font-variant-numeric:tabular-nums;">
              ${escapeHtml(t('flashcards.cardCount', { n: viewState.index + 1, total: viewState.deckIds.length }))}
            </span>
            <progress
              class="progress-track"
              style="max-inline-size:16rem;"
              max="${viewState.deckIds.length}"
              value="${viewState.index + 1}"
              aria-label="${escapeHtml(t('flashcards.deckAria', { n: viewState.index + 1, total: viewState.deckIds.length }))}"
            ></progress>
          </div>

          <article class="question-card" aria-label="${escapeHtml(t('flashcards.cardAria', { id: question.id }))}">
            <div class="question-card-top">
              <div class="badge-row">
                <span class="badge badge--number">Q${displayNumber(question)}</span>
                <span class="badge badge--category">${escapeHtml(t(`category.${question.category}`))}</span>
                ${question.is6520 ? `<span class="badge badge--6520">★ 65/20</span>` : ''}
                ${question.dynamicKey ? `<span class="badge badge--dynamic">${escapeHtml(t('badge.currentOfficial'))}</span>` : ''}
                ${
                  progress?.status === 'mastered'
                    ? `<span class="badge badge--mastered">${escapeHtml(t('badge.mastered'))}</span>`
                    : progress?.status === 'review'
                      ? `<span class="badge badge--review">${escapeHtml(t('badge.review'))}</span>`
                      : ''
                }
              </div>

              ${
                ttsSupported
                  ? `
                <button
                  type="button"
                  id="fc-speak-btn"
                  class="icon-btn ${isSpeaking ? 'is-speaking' : ''}"
                  aria-label="${escapeHtml(isSpeaking ? t('flashcards.stopAria') : t('flashcards.listenAria', { id: question.id }))}"
                >
                  ${isSpeaking ? ICONS.stop : ICONS.volume}
                  <span>${escapeHtml(isSpeaking ? t('flashcards.stop') : t('flashcards.listen'))}</span>
                </button>
              `
                  : ''
              }
            </div>

            <p class="question-section-label">${escapeHtml(question.section)}</p>
            <h2 class="question-stem">${escapeHtml(question.question)}</h2>
            ${renderTranslationToggle(question, showTranslation, viewState.revealed)}

            ${
              question.requiredCount > 1
                ? `<p class="notice notice--info" style="margin:0;">${t('flashcards.requiredCount', { n: question.requiredCount })}</p>`
                : ''
            }

            ${
              viewState.revealed
                ? `
              <div class="answer-panel">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;">
                  <h3 class="answer-panel-title">${escapeHtml(effectiveAnswers.length > 1 ? t('flashcards.answersTitle') : t('flashcards.answerTitle'))}</h3>
                  ${
                    ttsSupported
                      ? `<button type="button" id="fc-speak-answers-btn" class="btn btn--ghost" style="padding:0.25rem 0.6rem;min-block-size:2rem;font-size:0.84rem;">${ICONS.volume} ${escapeHtml(t('flashcards.readAnswer'))}</button>`
                      : ''
                  }
                </div>
                <ul class="answer-list">
                  ${effectiveAnswers.map((ans) => `<li>${escapeHtml(ans)}</li>`).join('')}
                </ul>
                ${question.note ? `<p class="notice" style="margin:0;">${escapeHtml(question.note)}</p>` : ''}
                ${
                  needsCustomState
                    ? `<div class="notice notice--gold" style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:0.6rem;">
                        <span>${escapeHtml(t('flashcards.customState'))}</span>
                        <button type="button" id="fc-open-settings" class="btn btn--secondary">${escapeHtml(t('flashcards.configure'))}</button>
                      </div>`
                    : ''
                }
              </div>
            `
                : `
              <div class="answer-hidden-box">
                ${
                  viewState.timerEnabled
                    ? `
                  <div class="countdown-panel">
                    <div class="countdown-header">
                      <span>${escapeHtml(timerPaused ? t('flashcards.timerPaused') : t('flashcards.timerRunning'))}</span>
                      <strong id="fc-timer-seconds" class="countdown-seconds ${remainingMs <= 2000 ? 'is-urgent' : ''}">${escapeHtml(t('flashcards.seconds', { n: Math.max(0, Math.ceil(remainingMs / 1000)) }))}</strong>
                    </div>
                    <progress
                      id="fc-timer-progress"
                      class="progress-track ${remainingMs <= 2000 ? 'progress-track--urgent' : ''}"
                      max="${AUTO_REVEAL_MS}"
                      value="${Math.max(0, Math.round(remainingMs))}"
                      aria-label="${escapeHtml(t('flashcards.timerAria'))}"
                    ></progress>
                  </div>
                `
                    : `<p>${escapeHtml(t('flashcards.noTimerHint'))}</p>`
                }
                <div class="card-action-group" style="justify-content:center;">
                  <button type="button" id="fc-reveal-btn" class="btn btn--primary">
                    ${escapeHtml(t('flashcards.reveal'))}
                  </button>
                  ${
                    viewState.timerEnabled
                      ? `
                    <button type="button" id="fc-timer-pause-btn" class="btn btn--secondary" aria-pressed="${timerPaused}">
                      ${escapeHtml(timerPaused ? t('flashcards.resumeTimer') : t('flashcards.pauseTimer'))}
                    </button>
                  `
                      : ''
                  }
                </div>
              </div>
            `
            }

            <div class="card-actions">
              <div class="card-action-group">
                <button type="button" id="fc-prev-btn" class="btn btn--secondary" aria-label="${escapeHtml(t('flashcards.prevAria'))}">
                  ${ICONS.arrowLeft} ${escapeHtml(t('flashcards.prev'))}
                </button>
                <button type="button" id="fc-next-btn" class="btn btn--secondary" aria-label="${escapeHtml(t('flashcards.nextAria'))}">
                  ${escapeHtml(t('flashcards.next'))} ${ICONS.arrowRight}
                </button>
              </div>

              <div class="card-action-group">
                <button type="button" id="fc-review-btn" class="btn btn--soft-danger">
                  ${escapeHtml(t('badge.review'))}
                </button>
                <button type="button" id="fc-mastered-btn" class="btn btn--soft-success">
                  ${ICONS.check} ${escapeHtml(t('badge.mastered'))}
                </button>
              </div>
            </div>
            <p class="report-row">${renderReportLink(question, getTestVersion())}</p>
          </article>

          <div class="kbd-hint" aria-label="${escapeHtml(t('flashcards.kbdAria'))}">
            <span><kbd>${escapeHtml(t('flashcards.keySpace'))}</kbd> ${escapeHtml(t('flashcards.kbdReveal'))}</span>
            <span><kbd>←</kbd> <kbd>→</kbd> ${escapeHtml(t('flashcards.kbdNavigate'))}</span>
            ${viewState.timerEnabled ? `<span><kbd>P</kbd> ${escapeHtml(t('flashcards.pauseTimer'))}</span>` : ''}
            ${ttsSupported ? `<span><kbd>L</kbd> ${escapeHtml(t('flashcards.listen'))}</span>` : ''}
            <span><kbd>1</kbd> ${escapeHtml(t('badge.review'))}</span>
            <span><kbd>2</kbd> ${escapeHtml(t('badge.mastered'))}</span>
          </div>
        `
        }
      </div>
    `;

    // Bind events
    container.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        rebuildDeck(btn.dataset.filter as FlashcardFilter, viewState.shuffled);
      });
    });

    container.querySelector('#fc-timer-toggle-btn')?.addEventListener('click', toggleTimerEnabled);
    container.querySelector('#fc-timer-pause-btn')?.addEventListener('click', toggleTimerPaused);

    container.querySelector('#fc-shuffle-btn')?.addEventListener('click', () => {
      rebuildDeck(viewState.filter, !viewState.shuffled);
    });

    container.querySelector('#fc-show-all-btn')?.addEventListener('click', () => {
      rebuildDeck('all', false);
    });

    container.querySelector('#fc-reveal-btn')?.addEventListener('click', toggleReveal);
    container.querySelector('#fc-prev-btn')?.addEventListener('click', () => go(-1));
    container.querySelector('#fc-next-btn')?.addEventListener('click', () => go(1));
    container.querySelector('#fc-review-btn')?.addEventListener('click', () => markStatus('review'));
    container
      .querySelector('#fc-mastered-btn')
      ?.addEventListener('click', () => markStatus('mastered'));
    container.querySelector('#fc-speak-btn')?.addEventListener('click', () => speakCurrent(false));
    container
      .querySelector('#fc-speak-answers-btn')
      ?.addEventListener('click', () => speakCurrent(true));
    container.querySelector('[data-action="toggle-translation"]')?.addEventListener('click', () => {
      showTranslation = !showTranslation;
      render();
    });
    container.querySelector('#fc-open-settings')?.addEventListener('click', () => {
      callbacks.onOpenSettings();
    });
  };

  resetCountdown();
  render();

  return () => {
    stopCountdown();
    window.removeEventListener('keydown', handleKeydown);
    stopSpeaking();
  };
}
