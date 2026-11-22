import {
  CATEGORIES,
  CIVICS_QUESTIONS,
  getEffectiveAnswers,
  isDynamicUnconfigured, displayNumber } from '../../domain/questions';
import { shuffleArray } from '../../domain/examEngine';
import type { CivicsCategory, CivicsQuestion, MasteryStatus, PersistedState } from '../../domain/types';
import { getQuestionProgress } from '../../services/storage';
import { isSpeechSynthesisSupported, speakText, stopSpeaking } from '../../services/speech';
import { announce } from '../announcer';
import { escapeHtml, ICONS } from '../dom';

export type FlashcardFilter = 'all' | '65-20' | 'review' | CivicsCategory;

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
      secEl.textContent = `${seconds}s`;
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
        announce('Time is up. Official answers shown.');
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
        ? '7-second auto-reveal timer enabled.'
        : '7-second auto-reveal timer disabled.',
    );
  };

  const toggleTimerPaused = () => {
    if (!viewState.timerEnabled || viewState.revealed) return;
    timerPaused = !timerPaused;
    lastTickAt = performance.now();
    render();
    announce(timerPaused ? 'Countdown paused.' : 'Countdown resumed.');
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
    announce(viewState.revealed ? 'Official answers shown.' : 'Answers hidden.');
  };

  const markStatus = (status: MasteryStatus) => {
    const qId = viewState.deckIds[viewState.index];
    if (qId === undefined) return;
    callbacks.onSetStatus(qId, status);
    announce(
      status === 'mastered'
        ? `Question ${qId} marked as mastered.`
        : `Question ${qId} flagged for review.`,
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

    const filters: Array<{ id: FlashcardFilter; label: string }> = [
      { id: 'all', label: 'All (128)' },
      { id: '65-20', label: '65/20 ★ (20)' },
      { id: 'review', label: `Needs Review (${reviewCount})` },
      ...CATEGORIES.map((c) => ({ id: c as FlashcardFilter, label: c })),
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
            <h1 id="main-heading" tabindex="-1">Flashcards</h1>
            <p class="view-lead">Say your answer aloud in English before revealing the official USCIS bullets.</p>
          </div>
          <div class="card-action-group">
            <button
              type="button"
              id="fc-timer-toggle-btn"
              class="btn ${viewState.timerEnabled ? 'btn--primary' : 'btn--secondary'}"
              aria-pressed="${viewState.timerEnabled}"
            >
              7s Auto-Reveal: ${viewState.timerEnabled ? 'On' : 'Off'}
            </button>
            <button
              type="button"
              id="fc-shuffle-btn"
              class="btn ${viewState.shuffled ? 'btn--primary' : 'btn--secondary'}"
              aria-pressed="${viewState.shuffled}"
            >
              ${ICONS.shuffle} ${viewState.shuffled ? 'Shuffled' : 'Shuffle Deck'}
            </button>
          </div>
        </div>

        <div class="pill-bar" role="group" aria-label="Filter flashcards" style="margin-block-end:1.15rem;">
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
            <h2 style="margin:0 0 0.5rem;">No cards in this filter</h2>
            <p style="margin:0 0 1.25rem;color:var(--text-secondary);">
              ${
                viewState.filter === 'review'
                  ? 'You have cleared every card flagged for review. Nice work!'
                  : 'Try selecting another category.'
              }
            </p>
            <button type="button" id="fc-show-all-btn" class="btn btn--primary">Study All 128 Questions</button>
          </div>
        `
            : `
          <div class="study-toolbar">
            <span style="font-weight:700;font-size:0.92rem;font-variant-numeric:tabular-nums;">
              Card ${viewState.index + 1} of ${viewState.deckIds.length}
            </span>
            <progress
              class="progress-track"
              style="max-inline-size:16rem;"
              max="${viewState.deckIds.length}"
              value="${viewState.index + 1}"
              aria-label="Deck position ${viewState.index + 1} of ${viewState.deckIds.length}"
            ></progress>
          </div>

          <article class="question-card" aria-label="Flashcard ${question.id}">
            <div class="question-card-top">
              <div class="badge-row">
                <span class="badge badge--number">Q${displayNumber(question)}</span>
                <span class="badge badge--category">${escapeHtml(question.category)}</span>
                ${question.is6520 ? `<span class="badge badge--6520">★ 65/20</span>` : ''}
                ${question.dynamicKey ? `<span class="badge badge--dynamic">Current Official</span>` : ''}
                ${
                  progress?.status === 'mastered'
                    ? `<span class="badge badge--mastered">Mastered</span>`
                    : progress?.status === 'review'
                      ? `<span class="badge badge--review">Needs Review</span>`
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
                  aria-label="${isSpeaking ? 'Stop reading aloud' : `Listen to question ${question.id}`}"
                >
                  ${isSpeaking ? ICONS.stop : ICONS.volume}
                  <span>${isSpeaking ? 'Stop' : 'Listen'}</span>
                </button>
              `
                  : ''
              }
            </div>

            <p class="question-section-label">${escapeHtml(question.section)}</p>
            <h2 class="question-stem">${escapeHtml(question.question)}</h2>

            ${
              question.requiredCount > 1
                ? `<p class="notice notice--info" style="margin:0;">This question requires <strong>${question.requiredCount}</strong> distinct answers on the exam.</p>`
                : ''
            }

            ${
              viewState.revealed
                ? `
              <div class="answer-panel">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;">
                  <h3 class="answer-panel-title">Official USCIS Accepted Answer${effectiveAnswers.length > 1 ? 's' : ''}</h3>
                  ${
                    ttsSupported
                      ? `<button type="button" id="fc-speak-answers-btn" class="btn btn--ghost" style="padding:0.25rem 0.6rem;min-block-size:2rem;font-size:0.84rem;">${ICONS.volume} Read Answer</button>`
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
                        <span>Set your state's current answer in Settings so you can drill it accurately.</span>
                        <button type="button" id="fc-open-settings" class="btn btn--secondary">Configure in Settings</button>
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
                      <span>${timerPaused ? 'Auto-reveal paused' : 'Auto-revealing answer in'}</span>
                      <strong id="fc-timer-seconds" class="countdown-seconds ${remainingMs <= 2000 ? 'is-urgent' : ''}">${Math.max(0, Math.ceil(remainingMs / 1000))}s</strong>
                    </div>
                    <progress
                      id="fc-timer-progress"
                      class="progress-track ${remainingMs <= 2000 ? 'progress-track--urgent' : ''}"
                      max="${AUTO_REVEAL_MS}"
                      value="${Math.max(0, Math.round(remainingMs))}"
                      aria-label="Countdown to auto-reveal answer"
                    ></progress>
                  </div>
                `
                    : `<p>Answer aloud in English first, then reveal the official USCIS list.</p>`
                }
                <div class="card-action-group" style="justify-content:center;">
                  <button type="button" id="fc-reveal-btn" class="btn btn--primary">
                    Show Official Answer
                  </button>
                  ${
                    viewState.timerEnabled
                      ? `
                    <button type="button" id="fc-timer-pause-btn" class="btn btn--secondary" aria-pressed="${timerPaused}">
                      ${timerPaused ? 'Resume Timer' : 'Pause Timer'}
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
                <button type="button" id="fc-prev-btn" class="btn btn--secondary" aria-label="Previous flashcard">
                  ${ICONS.arrowLeft} Prev
                </button>
                <button type="button" id="fc-next-btn" class="btn btn--secondary" aria-label="Next flashcard">
                  Next ${ICONS.arrowRight}
                </button>
              </div>

              <div class="card-action-group">
                <button type="button" id="fc-review-btn" class="btn btn--soft-danger">
                  Needs Review
                </button>
                <button type="button" id="fc-mastered-btn" class="btn btn--soft-success">
                  ${ICONS.check} Mastered
                </button>
              </div>
            </div>
          </article>

          <div class="kbd-hint" aria-label="Keyboard shortcuts">
            <span><kbd>Space</kbd> Reveal</span>
            <span><kbd>←</kbd> <kbd>→</kbd> Navigate</span>
            ${viewState.timerEnabled ? `<span><kbd>P</kbd> Pause Timer</span>` : ''}
            ${ttsSupported ? `<span><kbd>L</kbd> Listen</span>` : ''}
            <span><kbd>1</kbd> Needs Review</span>
            <span><kbd>2</kbd> Mastered</span>
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
