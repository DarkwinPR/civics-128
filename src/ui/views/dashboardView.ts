import { appUrl } from '../../config';
import {
  CATEGORIES,
  CIVICS_QUESTIONS,
  getTestVersion,
  isDynamicUnconfigured,
} from '../../domain/questions';
import { t } from '../../i18n';
import type { AppView, PersistedState } from '../../domain/types';
import {
  getQuestionProgress,
  getStreak,
  getTodayCount,
  isDueForReview,
} from '../../services/storage';
import { escapeHtml, ICONS } from '../dom';

export interface DashboardCallbacks {
  onNavigate: (
    view: AppView,
    options?: { filterReview?: boolean; filter6520?: boolean; filterDue?: boolean },
  ) => void;
  onOpenSettings: () => void;
}

export function renderDashboardView(
  container: HTMLElement,
  state: PersistedState,
  callbacks: DashboardCallbacks,
): void {
  const total = CIVICS_QUESTIONS.length;
  let mastered = 0;
  let review = 0;
  let mastered6520 = 0;
  let total6520 = 0;
  let unconfiguredStateCount = 0;

  for (const q of CIVICS_QUESTIONS) {
    const p = getQuestionProgress(state, q.id);
    if (p.status === 'mastered') mastered += 1;
    if (p.status === 'review') review += 1;
    if (q.is6520) {
      total6520 += 1;
      if (p.status === 'mastered') mastered6520 += 1;
    }
    if (isDynamicUnconfigured(q, state.settings.officials)) {
      unconfiguredStateCount += 1;
    }
  }

  const readinessPct = Math.round((mastered / total) * 100);
  const version = getTestVersion();
  const streak = getStreak(state);
  const todayCount = getTodayCount(state);
  const goal = state.settings.dailyGoal;
  const goalPct = Math.min(100, Math.round((todayCount / goal) * 100));
  const dueCount = CIVICS_QUESTIONS.filter((q) =>
    isDueForReview(getQuestionProgress(state, q.id)),
  ).length;
  const shareHref = `https://wa.me/?text=${encodeURIComponent(t('share.message', { url: appUrl() }))}`;
  const examsTaken = state.examHistory.length;
  const examsPassed = state.examHistory.filter((e) => e.passed).length;

  const categoryStats = CATEGORIES.map((cat) => {
    const items = CIVICS_QUESTIONS.filter((q) => q.category === cat);
    const done = items.filter((q) => getQuestionProgress(state, q.id).status === 'mastered').length;
    return { category: cat, done, total: items.length };
  });

  container.innerHTML = `
    <section class="hero-banner" aria-labelledby="main-heading">
      <div>
        <p class="hero-eyebrow"><span class="hero-stars" aria-hidden="true">★ ★ ★</span> Official USCIS 2025 Naturalization Test</p>
        <h1 id="main-heading" tabindex="-1">Master All <span class="hero-highlight">${total}</span> Civics Questions in English</h1>
        <p class="view-lead">
          ${
            version === '2008'
              ? 'You are studying the 2008 test (N-400 filed before Oct 20, 2025): 10 questions asked, 6 correct to pass.'
              : 'Practice for the real oral interview: 20 questions asked, 12 correct to pass (or 6 of 10 for 65/20 applicants).'
          }
          Train with flashcards, realistic mock exams, voice coaching and English test practice.
        </p>
        <div class="hero-actions">
          <button type="button" class="btn btn--primary btn--lg" data-go="exam">
            ${ICONS.play} Start Mock Exam
          </button>
          <button type="button" class="btn btn--secondary btn--lg" data-go="oral">
            ${ICONS.mic} Oral Voice Coach
          </button>
          <button type="button" class="btn btn--secondary btn--lg" data-go="flashcards">
            ${ICONS.cards} Study Flashcards
          </button>
        </div>
      </div>

      <div class="readiness-ring" style="--pct:${readinessPct}" aria-label="${readinessPct}% of 128 questions mastered">
        <div class="readiness-ring-inner">
          <span class="readiness-value">${readinessPct}%</span>
          <span class="readiness-caption">Mastered</span>
        </div>
      </div>
    </section>

    ${
      unconfiguredStateCount > 0
        ? `
      <div class="notice notice--gold" style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:0.75rem;margin-block-end:1.25rem;">
        <span>
          <strong>Personalize your state answers:</strong> ${unconfiguredStateCount} state-specific questions (Senator, Representative, Governor ★, State Capital) are not set yet.
        </span>
        <button type="button" id="dashboard-open-settings" class="btn btn--secondary">
          Set State Officials
        </button>
      </div>
    `
        : ''
    }

    <section class="today-strip" aria-label="Today">
      <div class="today-card today-card--streak">
        <span class="today-emoji" aria-hidden="true">🔥</span>
        <div>
          <span class="today-value">${streak}</span>
          <span class="today-label">${streak === 1 ? 'day streak' : 'day streak'}</span>
        </div>
      </div>
      <div class="today-card today-card--goal">
        <div class="mini-ring" style="--pct:${goalPct}" aria-hidden="true"><span>${goalPct}%</span></div>
        <div>
          <span class="today-value">${Math.min(todayCount, goal)} / ${goal}</span>
          <span class="today-label">${todayCount >= goal ? 'Daily goal reached! 🎉' : 'questions today'}</span>
        </div>
      </div>
      <div class="today-card today-card--due">
        <div>
          <span class="today-value">${dueCount}</span>
          <span class="today-label">cards due for smart review</span>
        </div>
        <button type="button" class="btn ${dueCount > 0 ? 'btn--primary' : 'btn--secondary'}" id="smart-review-btn" ${dueCount === 0 ? 'disabled' : ''}>
          Review now
        </button>
      </div>
      <a class="today-card today-card--share" href="${shareHref}" target="_blank" rel="noopener noreferrer">
        <span class="today-emoji" aria-hidden="true">💬</span>
        <div>
          <span class="today-label today-label--strong">${t('share.whatsapp')}</span>
          <span class="today-label">Help a friend study too</span>
        </div>
      </a>
    </section>

    <section class="stats-grid" aria-label="Study metrics">
      <div class="stat-card stat-card--blue">
        <span class="stat-icon">${ICONS.target}</span>
        <span class="stat-label">Mastered</span>
        <span class="stat-number">${mastered} <span style="font-size:1rem;font-weight:600;color:var(--text-muted)">/ ${total}</span></span>
        <span class="stat-sub">${total - mastered} remaining to master</span>
      </div>

      <div class="stat-card stat-card--red">
        <span class="stat-icon">${ICONS.flag}</span>
        <span class="stat-label">Needs Review</span>
        <span class="stat-number" style="color:${review > 0 ? 'var(--crimson)' : 'inherit'}">${review}</span>
        <span class="stat-sub">
          ${
            review > 0
              ? `<button type="button" class="btn btn--ghost" id="drill-review-btn" style="padding:0;min-block-size:auto;color:var(--brand);text-decoration:underline;">Practice flagged cards</button>`
              : 'No cards flagged for review'
          }
        </span>
      </div>

      <div class="stat-card stat-card--gold">
        <span class="stat-icon">${ICONS.star}</span>
        <span class="stat-label">65/20 Starred</span>
        <span class="stat-number">${mastered6520} <span style="font-size:1rem;font-weight:600;color:var(--text-muted)">/ ${total6520}</span></span>
        <span class="stat-sub">
          <button type="button" class="btn btn--ghost" id="drill-6520-btn" style="padding:0;min-block-size:auto;color:var(--brand);text-decoration:underline;">Study 65/20 subset</button>
        </span>
      </div>

      <div class="stat-card stat-card--green">
        <span class="stat-icon">${ICONS.trophy}</span>
        <span class="stat-label">Mock Exams Passed</span>
        <span class="stat-number">${examsPassed} <span style="font-size:1rem;font-weight:600;color:var(--text-muted)">/ ${examsTaken}</span></span>
        <span class="stat-sub">${examsTaken === 0 ? 'Take your first 20-question test' : 'Passed official threshold'}</span>
      </div>
    </section>

    <div class="dashboard-columns">
      <section class="surface-card" aria-labelledby="cat-heading">
        <h2 id="cat-heading" style="margin:0 0 1rem;font-size:1.15rem;">Mastery by Official Category</h2>
        <ul class="category-list" role="list">
          ${categoryStats
            .map(
              (c) => `
            <li>
              <div class="category-row-head">
                <strong>${escapeHtml(t(`category.${c.category}`))}</strong>
                <span>${c.done} / ${c.total}</span>
              </div>
              <progress class="progress-track progress-track--success" max="${c.total}" value="${c.done}" aria-label="${escapeHtml(c.category)} mastery: ${c.done} of ${c.total}"></progress>
            </li>
          `,
            )
            .join('')}
        </ul>
      </section>

      <section class="surface-card" aria-labelledby="history-heading">
        <h2 id="history-heading" style="margin:0 0 1rem;font-size:1.15rem;">Recent Mock Exams</h2>
        ${
          state.examHistory.length === 0
            ? `<p style="margin:0;color:var(--text-secondary);">No mock exams completed yet. The official 2025 exam asks up to 20 questions and stops as soon as you reach 12 correct (pass) or 9 incorrect (fail).</p>`
            : `
          <ul class="history-list" role="list">
            ${state.examHistory
              .slice(0, 5)
              .map((rec) => {
                const dateStr = new Date(rec.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                });
                return `
                  <li class="history-item">
                    <div>
                      <strong>${rec.mode === '65-20' ? '65/20 Exam ★' : 'Standard 2025 Exam'}</strong>
                      <div style="font-size:0.8rem;color:var(--text-muted);">${escapeHtml(dateStr)} · ${rec.asked} asked</div>
                    </div>
                    <div class="badge-row">
                      <span style="font-weight:700;font-variant-numeric:tabular-nums;">${rec.correct}/${rec.asked}</span>
                      <span class="badge ${rec.passed ? 'badge--mastered' : 'badge--review'}">
                        ${rec.passed ? 'PASSED' : 'NOT PASSED'}
                      </span>
                    </div>
                  </li>
                `;
              })
              .join('')}
          </ul>
        `
        }
      </section>
    </div>
  `;

  container.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.go as AppView;
      callbacks.onNavigate(target);
    });
  });

  container.querySelector('#dashboard-open-settings')?.addEventListener('click', () => {
    callbacks.onOpenSettings();
  });

  container.querySelector('#smart-review-btn')?.addEventListener('click', () => {
    callbacks.onNavigate('flashcards', { filterDue: true });
  });

  container.querySelector('#drill-review-btn')?.addEventListener('click', () => {
    callbacks.onNavigate('flashcards', { filterReview: true });
  });

  container.querySelector('#drill-6520-btn')?.addEventListener('click', () => {
    callbacks.onNavigate('flashcards', { filter6520: true });
  });
}
