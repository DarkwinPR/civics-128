import { getExamRules } from '../../domain/examEngine';
import { appUrl } from '../../config';
import {
  CATEGORIES,
  CIVICS_QUESTIONS,
  getTestVersion,
  isDynamicUnconfigured,
} from '../../domain/questions';
import { locale, t } from '../../i18n';
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
  const examRules = getExamRules('standard');
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
        <p class="hero-eyebrow"><span class="hero-stars" aria-hidden="true">★ ★ ★</span> ${escapeHtml(t('dashboard.eyebrow', { year: version }))}</p>
        <h1 id="main-heading" tabindex="-1">${t('dashboard.heroTitle', { total: `<span class="hero-highlight">${total}</span>` })}</h1>
        <p class="view-lead">
          ${
            version === '2008'
              ? escapeHtml(t('dashboard.lead2008'))
              : escapeHtml(t('dashboard.lead2025'))
          }
          ${escapeHtml(t('dashboard.leadTrain'))}
        </p>
        <div class="hero-actions">
          <button type="button" class="btn btn--primary btn--lg" data-go="exam">
            ${ICONS.play} ${escapeHtml(t('dashboard.startExam'))}
          </button>
          <button type="button" class="btn btn--secondary btn--lg" data-go="oral">
            ${ICONS.mic} ${escapeHtml(t('dashboard.oralCoach'))}
          </button>
          <button type="button" class="btn btn--secondary btn--lg" data-go="flashcards">
            ${ICONS.cards} ${escapeHtml(t('dashboard.studyFlashcards'))}
          </button>
        </div>
      </div>

      <div class="readiness-ring" style="--pct:${readinessPct}" aria-label="${escapeHtml(t('dashboard.readinessAria', { pct: readinessPct, total }))}">
        <div class="readiness-ring-inner">
          <span class="readiness-value">${readinessPct}%</span>
          <span class="readiness-caption">${escapeHtml(t('dashboard.masteredCaption'))}</span>
        </div>
      </div>
    </section>

    ${
      unconfiguredStateCount > 0
        ? `
      <div class="notice notice--gold" style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:0.75rem;margin-block-end:1.25rem;">
        <span>
          <strong>${escapeHtml(t('dashboard.personalizeTitle'))}</strong> ${escapeHtml(t('dashboard.personalizeBody', { count: unconfiguredStateCount }))}
        </span>
        <button type="button" id="dashboard-open-settings" class="btn btn--secondary">
          ${escapeHtml(t('dashboard.setOfficials'))}
        </button>
      </div>
    `
        : ''
    }

    <section class="today-strip" aria-label="${escapeHtml(t('dashboard.todayAria'))}">
      <div class="today-card today-card--streak">
        <span class="today-emoji" aria-hidden="true">🔥</span>
        <div>
          <span class="today-value">${streak}</span>
          <span class="today-label">${escapeHtml(streak === 1 ? t('dashboard.streakOne') : t('dashboard.streakMany'))}</span>
        </div>
      </div>
      <div class="today-card today-card--goal">
        <div class="mini-ring" style="--pct:${goalPct}" aria-hidden="true"><span>${goalPct}%</span></div>
        <div>
          <span class="today-value">${Math.min(todayCount, goal)} / ${goal}</span>
          <span class="today-label">${escapeHtml(todayCount >= goal ? t('dashboard.goalReached') : t('dashboard.questionsToday'))}</span>
        </div>
      </div>
      <div class="today-card today-card--due">
        <div>
          <span class="today-value">${dueCount}</span>
          <span class="today-label">${escapeHtml(t('dashboard.dueLabel'))}</span>
        </div>
        <button type="button" class="btn ${dueCount > 0 ? 'btn--primary' : 'btn--secondary'}" id="smart-review-btn" ${dueCount === 0 ? 'disabled' : ''}>
          ${escapeHtml(t('dashboard.reviewNow'))}
        </button>
      </div>
      <a class="today-card today-card--share" href="${shareHref}" target="_blank" rel="noopener noreferrer">
        <span class="today-emoji" aria-hidden="true">💬</span>
        <div>
          <span class="today-label today-label--strong">${escapeHtml(t('share.whatsapp'))}</span>
          <span class="today-label">${escapeHtml(t('dashboard.shareHelp'))}</span>
        </div>
      </a>
    </section>

    <section class="stats-grid" aria-label="${escapeHtml(t('dashboard.statsAria'))}">
      <div class="stat-card stat-card--blue">
        <span class="stat-icon">${ICONS.target}</span>
        <span class="stat-label">${escapeHtml(t('dashboard.statMastered'))}</span>
        <span class="stat-number">${mastered} <span style="font-size:1rem;font-weight:600;color:var(--text-muted)">/ ${total}</span></span>
        <span class="stat-sub">${escapeHtml(t('dashboard.remaining', { n: total - mastered }))}</span>
      </div>

      <div class="stat-card stat-card--red">
        <span class="stat-icon">${ICONS.flag}</span>
        <span class="stat-label">${escapeHtml(t('dashboard.statReview'))}</span>
        <span class="stat-number" style="color:${review > 0 ? 'var(--crimson)' : 'inherit'}">${review}</span>
        <span class="stat-sub">
          ${
            review > 0
              ? `<button type="button" class="btn btn--ghost" id="drill-review-btn" style="padding:0;min-block-size:auto;color:var(--brand);text-decoration:underline;">${escapeHtml(t('dashboard.practiceFlagged'))}</button>`
              : escapeHtml(t('dashboard.noFlagged'))
          }
        </span>
      </div>

      <div class="stat-card stat-card--gold">
        <span class="stat-icon">${ICONS.star}</span>
        <span class="stat-label">${escapeHtml(t('dashboard.stat6520'))}</span>
        <span class="stat-number">${mastered6520} <span style="font-size:1rem;font-weight:600;color:var(--text-muted)">/ ${total6520}</span></span>
        <span class="stat-sub">
          <button type="button" class="btn btn--ghost" id="drill-6520-btn" style="padding:0;min-block-size:auto;color:var(--brand);text-decoration:underline;">${escapeHtml(t('dashboard.study6520'))}</button>
        </span>
      </div>

      <div class="stat-card stat-card--green">
        <span class="stat-icon">${ICONS.trophy}</span>
        <span class="stat-label">${escapeHtml(t('dashboard.statExams'))}</span>
        <span class="stat-number">${examsPassed} <span style="font-size:1rem;font-weight:600;color:var(--text-muted)">/ ${examsTaken}</span></span>
        <span class="stat-sub">${escapeHtml(examsTaken === 0 ? t('dashboard.firstExam', { n: examRules.maxQuestions }) : t('dashboard.passedThreshold'))}</span>
      </div>
    </section>

    <div class="dashboard-columns">
      <section class="surface-card" aria-labelledby="cat-heading">
        <h2 id="cat-heading" style="margin:0 0 1rem;font-size:1.15rem;">${escapeHtml(t('dashboard.categoryHeading'))}</h2>
        <ul class="category-list" role="list">
          ${categoryStats
            .map(
              (c) => `
            <li>
              <div class="category-row-head">
                <strong>${escapeHtml(t(`category.${c.category}`))}</strong>
                <span>${c.done} / ${c.total}</span>
              </div>
              <progress class="progress-track progress-track--success" max="${c.total}" value="${c.done}" aria-label="${escapeHtml(t('dashboard.categoryAria', { category: t(`category.${c.category}`), done: c.done, total: c.total }))}"></progress>
            </li>
          `,
            )
            .join('')}
        </ul>
      </section>

      <section class="surface-card" aria-labelledby="history-heading">
        <h2 id="history-heading" style="margin:0 0 1rem;font-size:1.15rem;">${escapeHtml(t('dashboard.historyHeading'))}</h2>
        ${
          state.examHistory.length === 0
            ? `<p style="margin:0;color:var(--text-secondary);">${escapeHtml(t('dashboard.noExams', { year: version, max: examRules.maxQuestions, pass: examRules.passThreshold, fail: examRules.failThreshold }))}</p>`
            : `
          <ul class="history-list" role="list">
            ${state.examHistory
              .slice(0, 5)
              .map((rec) => {
                const dateStr = new Date(rec.date).toLocaleDateString(locale(), {
                  month: 'short',
                  day: 'numeric',
                });
                return `
                  <li class="history-item">
                    <div>
                      <strong>${escapeHtml(rec.mode === '65-20' ? t('dashboard.exam6520') : t('dashboard.examStandard', { year: rec.version ?? '2025' }))}</strong>
                      <div style="font-size:0.8rem;color:var(--text-muted);">${escapeHtml(t('dashboard.historyMeta', { date: dateStr, n: rec.asked }))}</div>
                    </div>
                    <div class="badge-row">
                      <span style="font-weight:700;font-variant-numeric:tabular-nums;">${rec.correct}/${rec.asked}</span>
                      <span class="badge ${rec.passed ? 'badge--mastered' : 'badge--review'}">
                        ${escapeHtml(rec.passed ? t('dashboard.passed') : t('dashboard.notPassed'))}
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
