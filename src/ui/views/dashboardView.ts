import { CATEGORIES, CIVICS_QUESTIONS, isDynamicUnconfigured } from '../../domain/questions';
import type { AppView, PersistedState } from '../../domain/types';
import { getQuestionProgress } from '../../services/storage';
import { escapeHtml, ICONS } from '../dom';

export interface DashboardCallbacks {
  onNavigate: (view: AppView, options?: { filterReview?: boolean; filter6520?: boolean }) => void;
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
        <h1 id="main-heading" tabindex="-1">Master All <span class="hero-highlight">128</span> Civics Questions in English</h1>
        <p class="view-lead">
          Practice for the real oral interview: 20 questions asked, 12 correct to pass (or 6 of 10 for 65/20 applicants). Train with flashcards, realistic mock exams, and voice coaching.
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
                <strong>${escapeHtml(c.category)}</strong>
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

  container.querySelector('#drill-review-btn')?.addEventListener('click', () => {
    callbacks.onNavigate('flashcards', { filterReview: true });
  });

  container.querySelector('#drill-6520-btn')?.addEventListener('click', () => {
    callbacks.onNavigate('flashcards', { filter6520: true });
  });
}
