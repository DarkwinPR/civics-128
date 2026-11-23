import { easiestAnswers, joinAnswers } from '../../domain/learningPath';
import {
  CATEGORIES,
  CIVICS_QUESTIONS,
  displayNumber,
  getEffectiveAnswers,
  getTestVersion,
  isDynamicUnconfigured,
} from '../../domain/questions';
import type { CivicsCategory, MasteryStatus, PersistedState } from '../../domain/types';
import { getQuestionProgress } from '../../services/storage';
import { isSpeechSynthesisSupported, speakText, stopSpeaking } from '../../services/speech';
import { t } from '../../i18n';
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
      countEl.textContent = t('bank.resultsCount', {
        shown: filtered.length,
        total: CIVICS_QUESTIONS.length,
      });
    }

    if (filtered.length === 0) {
      gridEl.innerHTML = `
        <div class="surface-card" style="grid-column:1 / -1;text-align:center;padding:2rem;">
          <p style="margin:0;color:var(--text-secondary);">${escapeHtml(t('bank.noResults'))}</p>
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
          <article class="bank-card" aria-label="${escapeHtml(t('bank.cardAria', { id: q.id }))}">
            <div class="badge-row">
              <span class="badge badge--number">Q${displayNumber(q)}</span>
              <span class="badge badge--category">${escapeHtml(t(`category.${q.category}`))}</span>
              ${q.is6520 ? `<span class="badge badge--6520">★ 65/20</span>` : ''}
            </div>

            <h2 class="bank-card-question">${escapeHtml(q.question)}</h2>

            ${
              answers.length > q.requiredCount && !isDynamicUnconfigured(q, appState.settings.officials)
                ? `<p class="easiest-answer easiest-answer--small"><span class="easiest-label">💡 ${escapeHtml(t('path.easiest'))}</span> ${escapeHtml(joinAnswers(easiestAnswers(q, appState.settings.officials)))}</p>`
                : ''
            }
            <ul class="bank-card-answers">
              ${answers.map((ans) => `<li>${escapeHtml(ans)}</li>`).join('')}
            </ul>

            ${q.note ? `<p class="field-hint">${escapeHtml(q.note)}</p>` : ''}

            <div class="bank-card-footer">
              <button
                type="button"
                class="pill-btn"
                data-status-id="${q.id}"
                aria-label="${escapeHtml(t('bank.statusAria', { id: q.id, status: t(`bank.statusWord.${progress.status}`) }))}"
              >
                ${
                  progress.status === 'mastered'
                    ? `✓ ${escapeHtml(t('badge.mastered'))}`
                    : progress.status === 'review'
                      ? `● ${escapeHtml(t('badge.review'))}`
                      : `○ ${escapeHtml(t('bank.unseen'))}`
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
                    aria-label="${escapeHtml(isSpeakingQuestion ? t('bank.stopQuestionAria', { id: q.id }) : t('bank.listenQuestionAria', { id: q.id }))}"
                  >
                    ${isSpeakingQuestion ? ICONS.stop : ICONS.volume}
                    <span>${escapeHtml(isSpeakingQuestion ? t('bank.stop') : t('bank.question'))}</span>
                  </button>
                  <button
                    type="button"
                    class="icon-btn bank-audio-btn ${isSpeakingAnswers ? 'is-speaking' : ''}"
                    data-speak-id="${q.id}"
                    data-speak-kind="answers"
                    aria-label="${escapeHtml(isSpeakingAnswers ? t('bank.stopAnswersAria', { id: q.id }) : t('bank.listenAnswersAria', { id: q.id }))}"
                  >
                    ${isSpeakingAnswers ? ICONS.stop : ICONS.volume}
                    <span>${escapeHtml(isSpeakingAnswers ? t('bank.stop') : t('bank.answers'))}</span>
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
        announce(t('bank.statusAnnounce', { id, status: t(`bank.statusWord.${next}`) }));
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
        <h1 id="main-heading" tabindex="-1">${escapeHtml(t('bank.title', { total: CIVICS_QUESTIONS.length }))}</h1>
        <p class="view-lead">${
          getTestVersion() === '2008'
            ? escapeHtml(t('bank.lead2008'))
            : escapeHtml(t('bank.lead2025'))
        }</p>
      </div>
      <div class="card-action-group">
        <span id="bank-results-count" style="font-size:0.88rem;color:var(--text-muted);font-weight:600;"></span>
        <button type="button" id="bank-print-btn" class="btn btn--secondary">${escapeHtml(t('bank.print'))}</button>
      </div>
    </div>

    <div class="bank-controls">
      <div class="field">
        <label for="bank-search">${escapeHtml(t('bank.searchLabel'))}</label>
        <input
          id="bank-search"
          type="search"
          class="text-input"
          placeholder="${escapeHtml(t('bank.searchPlaceholder'))}"
        />
      </div>

      <div class="field">
        <label for="bank-status-filter">${escapeHtml(t('bank.statusLabel'))}</label>
        <select id="bank-status-filter" class="select-input">
          <option value="all">${escapeHtml(t('bank.allStatuses'))}</option>
          <option value="unseen">${escapeHtml(t('bank.unseen'))}</option>
          <option value="review">${escapeHtml(t('badge.review'))}</option>
          <option value="mastered">${escapeHtml(t('badge.mastered'))}</option>
        </select>
      </div>
    </div>

    <div class="pill-bar" role="group" aria-label="${escapeHtml(t('bank.categoryFilter'))}" style="margin-block-end:1.25rem;">
      <button type="button" class="pill-btn" data-cat="all" aria-pressed="true">${escapeHtml(t('bank.allCount', { n: CIVICS_QUESTIONS.length }))}</button>
      <button type="button" class="pill-btn" data-cat="65-20" aria-pressed="false">${escapeHtml(t('bank.count6520', { n: CIVICS_QUESTIONS.filter((q) => q.is6520).length }))}</button>
      ${CATEGORIES.map(
        (cat) =>
          `<button type="button" class="pill-btn" data-cat="${escapeHtml(cat)}" aria-pressed="false">${escapeHtml(t(`category.${cat}`))}</button>`,
      ).join('')}
    </div>

    <div id="bank-grid-root" class="bank-grid"></div>
  `;

  const searchInput = container.querySelector<HTMLInputElement>('#bank-search');
  container.querySelector('#bank-print-btn')?.addEventListener('click', () => {
    window.print();
  });

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
