import { CATEGORIES, CIVICS_QUESTIONS, getEffectiveAnswers, displayNumber } from '../../domain/questions';
import type { CivicsCategory, MasteryStatus, PersistedState } from '../../domain/types';
import { getQuestionProgress } from '../../services/storage';
import { isSpeechSynthesisSupported, speakText, stopSpeaking } from '../../services/speech';
import { announce } from '../announcer';
import { escapeHtml, ICONS } from '../dom';

export interface BankCallbacks {
  getState: () => PersistedState;
  onSetStatus: (questionId: number, status: MasteryStatus) => void;
}

export function mountBankView(container: HTMLElement, callbacks: BankCallbacks): () => void {
  const ttsSupported = isSpeechSynthesisSupported();
  let query = '';
  let categoryFilter: 'all' | '65-20' | CivicsCategory = 'all';
  let statusFilter: 'all' | MasteryStatus = 'all';
  let speakingTarget: { id: number; kind: 'question' | 'answers' } | null = null;

  const cycleStatus = (current: MasteryStatus): MasteryStatus => {
    if (current === 'unseen') return 'mastered';
    if (current === 'mastered') return 'review';
    return 'unseen';
  };

  const renderGrid = () => {
    const appState = callbacks.getState();
    const gridEl = container.querySelector<HTMLElement>('#bank-grid-root');
    const countEl = container.querySelector<HTMLElement>('#bank-results-count');
    if (!gridEl) return;

    const qLower = query.trim().toLowerCase();
    const filtered = CIVICS_QUESTIONS.filter((q) => {
      if (categoryFilter === '65-20' && !q.is6520) return false;
      if (categoryFilter !== 'all' && categoryFilter !== '65-20' && q.category !== categoryFilter) {
        return false;
      }

      const status = getQuestionProgress(appState, q.id).status;
      if (statusFilter !== 'all' && status !== statusFilter) return false;

      if (!qLower) return true;
      const effective = getEffectiveAnswers(q, appState.settings.officials);
      return (
        String(q.id) === qLower ||
        `q${q.id}` === qLower ||
        q.question.toLowerCase().includes(qLower) ||
        q.section.toLowerCase().includes(qLower) ||
        effective.some((a) => a.toLowerCase().includes(qLower))
      );
    });

    if (countEl) {
      countEl.textContent = `Showing ${filtered.length} of ${CIVICS_QUESTIONS.length} official questions`;
    }

    if (filtered.length === 0) {
      gridEl.innerHTML = `
        <div class="surface-card" style="grid-column:1 / -1;text-align:center;padding:2rem;">
          <p style="margin:0;color:var(--text-secondary);">No questions match your search and filters.</p>
        </div>
      `;
      return;
    }

    gridEl.innerHTML = filtered
      .map((q) => {
        const progress = getQuestionProgress(appState, q.id);
        const answers = getEffectiveAnswers(q, appState.settings.officials);
        const isSpeakingQuestion =
          speakingTarget?.id === q.id && speakingTarget.kind === 'question';
        const isSpeakingAnswers =
          speakingTarget?.id === q.id && speakingTarget.kind === 'answers';
        return `
          <article class="bank-card" aria-label="Question ${q.id}">
            <div class="badge-row">
              <span class="badge badge--number">Q${displayNumber(q)}</span>
              <span class="badge badge--category">${escapeHtml(q.category)}</span>
              ${q.is6520 ? `<span class="badge badge--6520">★ 65/20</span>` : ''}
            </div>

            <h2 class="bank-card-question">${escapeHtml(q.question)}</h2>

            <ul class="bank-card-answers">
              ${answers.map((ans) => `<li>${escapeHtml(ans)}</li>`).join('')}
            </ul>

            ${q.note ? `<p class="field-hint">${escapeHtml(q.note)}</p>` : ''}

            <div class="bank-card-footer">
              <button
                type="button"
                class="pill-btn"
                data-status-id="${q.id}"
                aria-label="Question ${q.id} status: ${progress.status}. Activate to change."
              >
                ${
                  progress.status === 'mastered'
                    ? '✓ Mastered'
                    : progress.status === 'review'
                      ? '● Needs Review'
                      : '○ Unseen'
                }
              </button>

              ${
                ttsSupported
                  ? `
                <div class="bank-audio-actions">
                  <button
                    type="button"
                    class="icon-btn bank-audio-btn ${isSpeakingQuestion ? 'is-speaking' : ''}"
                    data-speak-id="${q.id}"
                    data-speak-kind="question"
                    aria-label="${isSpeakingQuestion ? `Stop reading question ${q.id}` : `Question: listen to question ${q.id}`}"
                  >
                    ${isSpeakingQuestion ? ICONS.stop : ICONS.volume}
                    <span>${isSpeakingQuestion ? 'Stop' : 'Question'}</span>
                  </button>
                  <button
                    type="button"
                    class="icon-btn bank-audio-btn ${isSpeakingAnswers ? 'is-speaking' : ''}"
                    data-speak-id="${q.id}"
                    data-speak-kind="answers"
                    aria-label="${isSpeakingAnswers ? `Stop reading answers for question ${q.id}` : `Answers: listen to answers for question ${q.id}`}"
                  >
                    ${isSpeakingAnswers ? ICONS.stop : ICONS.volume}
                    <span>${isSpeakingAnswers ? 'Stop' : 'Answers'}</span>
                  </button>
                </div>
              `
                  : ''
              }
            </div>
          </article>
        `;
      })
      .join('');

    gridEl.querySelectorAll<HTMLButtonElement>('[data-status-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.statusId);
        const current = getQuestionProgress(callbacks.getState(), id).status;
        const next = cycleStatus(current);
        callbacks.onSetStatus(id, next);
        announce(`Question ${id} marked as ${next}.`);
        renderGrid();
      });
    });

    gridEl.querySelectorAll<HTMLButtonElement>('[data-speak-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.speakId);
        const kind = (btn.dataset.speakKind as 'question' | 'answers') ?? 'question';
        if (speakingTarget?.id === id && speakingTarget.kind === kind) {
          stopSpeaking();
          speakingTarget = null;
          renderGrid();
          return;
        }
        const q = CIVICS_QUESTIONS.find((item) => item.id === id);
        if (!q) return;
        const latestState = callbacks.getState();
        const { speechRate, voiceURI, officials } = latestState.settings;
        const textToSpeak =
          kind === 'answers'
            ? getEffectiveAnswers(q, officials).join('. ')
            : q.question;

        const nextTarget = { id, kind };
        speakingTarget = nextTarget;
        renderGrid();

        speakText(textToSpeak, {
          rate: speechRate,
          voiceURI,
          onStart: () => {
            speakingTarget = nextTarget;
            renderGrid();
          },
          onEnd: () => {
            if (speakingTarget === nextTarget) {
              speakingTarget = null;
              renderGrid();
            }
          },
          onError: () => {
            if (speakingTarget === nextTarget) {
              speakingTarget = null;
              renderGrid();
            }
          },
        });
      });
    });
  };

  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 id="main-heading" tabindex="-1">All 128 Official Questions</h1>
        <p class="view-lead">Complete USCIS 2025 (Form M-1778) question bank with search, category filters, audio playback, and status tracking.</p>
      </div>
      <span id="bank-results-count" style="font-size:0.88rem;color:var(--text-muted);font-weight:600;"></span>
    </div>

    <div class="bank-controls">
      <div class="field">
        <label for="bank-search">Search by number, keyword, or answer</label>
        <input
          id="bank-search"
          type="search"
          class="text-input"
          placeholder="e.g. Constitution, 1776, Lincoln, Q38…"
        />
      </div>

      <div class="field">
        <label for="bank-status-filter">Progress Status</label>
        <select id="bank-status-filter" class="select-input">
          <option value="all">All Statuses</option>
          <option value="unseen">Unseen</option>
          <option value="review">Needs Review</option>
          <option value="mastered">Mastered</option>
        </select>
      </div>
    </div>

    <div class="pill-bar" role="group" aria-label="Category filter" style="margin-block-end:1.25rem;">
      <button type="button" class="pill-btn" data-cat="all" aria-pressed="true">All (128)</button>
      <button type="button" class="pill-btn" data-cat="65-20" aria-pressed="false">65/20 ★ (20)</button>
      ${CATEGORIES.map(
        (cat) =>
          `<button type="button" class="pill-btn" data-cat="${escapeHtml(cat)}" aria-pressed="false">${escapeHtml(cat)}</button>`,
      ).join('')}
    </div>

    <div id="bank-grid-root" class="bank-grid"></div>
  `;

  const searchInput = container.querySelector<HTMLInputElement>('#bank-search');
  searchInput?.addEventListener('input', () => {
    query = searchInput.value;
    renderGrid();
  });

  const statusSelect = container.querySelector<HTMLSelectElement>('#bank-status-filter');
  statusSelect?.addEventListener('change', () => {
    statusFilter = statusSelect.value as 'all' | MasteryStatus;
    renderGrid();
  });

  container.querySelectorAll<HTMLButtonElement>('[data-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      categoryFilter = btn.dataset.cat as 'all' | '65-20' | CivicsCategory;
      container.querySelectorAll<HTMLButtonElement>('[data-cat]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b === btn));
      });
      renderGrid();
    });
  });

  renderGrid();

  return () => {
    stopSpeaking();
  };
}
