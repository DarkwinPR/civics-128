import { getExamRules } from '../../domain/examEngine';
import { appUrl } from '../../config';
import {
  CATEGORIES,
  CIVICS_QUESTIONS,
  displayNumber,
  findQuestionById,
  getTestVersion,
  isDynamicUnconfigured,
} from '../../domain/questions';
import { getLang, locale, t } from '../../i18n';
import {
  buildPath,
  buildStudyPlan,
  countLessonsDone,
  findNextStep,
  sectionTitle,
  stepsRemaining,
} from '../../domain/learningPath';
import { mascotSvg } from '../mascot';
import type { AppView, PersistedState } from '../../domain/types';
import { READING_SENTENCES, WRITING_SENTENCES } from '../../domain/englishTest';
import {
  countEnglishMastered,
  getMostMissed,
  getPathProgress,
  getQuestionProgress,
  getStreak,
  getTodayCount,
  isDueForReview,
} from '../../services/storage';
import { escapeHtml, ICONS } from '../dom';

export interface DashboardCallbacks {
  onNavigate: (
    view: AppView,
    options?: { filterReview?: boolean; filter6520?: boolean; filterDue?: boolean; filterMissed?: boolean },
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
  const dueCount = CIVICS_QUESTIONS.filter((q) =>
    isDueForReview(getQuestionProgress(state, q.id)),
  ).length;
  const shareHref = `https://wa.me/?text=${encodeURIComponent(t('share.message', { url: appUrl() }))}`;
  const examsTaken = state.examHistory.length;
  const examsPassed = state.examHistory.filter((e) => e.passed).length;

  const missed = getMostMissed(state, CIVICS_QUESTIONS.map((q) => q.id), 5);
  const englishRead = countEnglishMastered(state, 'reading');
  const englishWrite = countEnglishMastered(state, 'writing');

  const categoryStats = CATEGORIES.map((cat) => {
    const items = CIVICS_QUESTIONS.filter((q) => q.category === cat);
    const done = items.filter((q) => getQuestionProgress(state, q.id).status === 'mastered').length;
    return { category: cat, done, total: items.length };
  });

  const allUnits = buildPath(CIVICS_QUESTIONS, version);
  const pathProgress = getPathProgress(state);
  const next = findNextStep(allUnits, pathProgress);
  const nextUnit = next ? allUnits[next.unitIndex] : undefined;
  const plan = buildStudyPlan(state.settings.interviewDate, stepsRemaining(allUnits, pathProgress));
  const hour = new Date().getHours();
  const greeting = t(hour < 12 ? 'home.morning' : hour < 19 ? 'home.afternoon' : 'home.evening');
  const nextText = !next
    ? t('home.pathDone')
    : next.lessonIndex === -1
      ? t('home.nextExam', { unit: sectionTitle(nextUnit!.section, getLang()) })
      : countLessonsDone(allUnits, pathProgress) === 0
        ? t('home.firstLesson')
        : t('home.nextLesson', { n: next.lessonIndex + 1, unit: sectionTitle(nextUnit!.section, getLang()) });

  container.innerHTML = `
    <div class="home-layout">
    <h1 id="main-heading" class="visually-hidden" tabindex="-1">${escapeHtml(t('title.dashboard'))}</h1>
    <section class="home-hello" aria-label="${escapeHtml(greeting)}">
      ${mascotSvg(todayCount >= goal ? 'cheer' : 'happy', 104)}
      <p class="home-bubble"><strong>${escapeHtml(greeting)}</strong><br />${escapeHtml(nextText)}${todayCount >= goal ? ` ${escapeHtml(t('home.goalDone'))}` : ''}</p>
    </section>
    <button type="button" class="btn btn--primary home-cta" data-go="path">${escapeHtml(t('dashboard.studyToday'))}</button>

    <div class="home-tiles">
      <div class="home-tile">
        <span class="home-tile-value"><svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3-1-5 1-8z"/></svg>${streak}</span>
        <span>${escapeHtml(streak === 1 ? t('dashboard.streakOne') : t('dashboard.streakMany'))}</span>
      </div>
      <div class="home-tile">
        <span class="home-tile-value">${readinessPct}%</span>
        <span>${escapeHtml(t('home.ready'))}</span>
      </div>
    </div>

    ${
      plan
        ? `<div class="path-plan path-plan--${plan.status}"><span aria-hidden="true">📅</span><p>${escapeHtml(
            plan.status === 'done'
              ? t('path.planDone', { days: plan.daysLeft })
              : plan.status === 'past'
                ? t('path.planPast')
                : t(`path.plan.${plan.status}`, { days: plan.daysLeft, steps: plan.stepsLeft, perDay: plan.perDay }),
          )}</p></div>`
        : `<div class="path-plan path-plan--empty"><span aria-hidden="true">📅</span><p>${escapeHtml(t('path.planAsk'))}</p><button type="button" class="btn btn--secondary" id="dashboard-plan-settings">${escapeHtml(t('path.planSet'))}</button></div>`
    }

    <div class="home-tiles">
      <div class="home-tile">
        <span class="home-tile-value">${Math.min(todayCount, goal)}/${goal}</span>
        <span>${escapeHtml(todayCount >= goal ? t('dashboard.goalReached') : t('dashboard.questionsToday'))}</span>
      </div>
      <button type="button" class="home-tile home-tile--action" id="smart-review-btn" ${dueCount === 0 ? 'disabled' : ''}>
        <span class="home-tile-value">${dueCount}</span>
        <span>${escapeHtml(dueCount > 0 ? t('home.dueTap') : t('dashboard.dueLabel'))}</span>
      </button>
    </div>

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
    </div>

    <h2 class="home-section-title">${escapeHtml(t('home.progressTitle'))}</h2>
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

    ${
      missed.length > 0
        ? `
    <section class="surface-card missed-card" aria-labelledby="missed-heading">
      <div class="missed-card-head">
        <div>
          <h2 id="missed-heading">${escapeHtml(t('dashboard.missedHeading'))}</h2>
          <p class="field-hint" style="margin:0;">${escapeHtml(t('dashboard.missedHelp'))}</p>
        </div>
        <button type="button" class="btn btn--primary" id="drill-missed-btn">${escapeHtml(t('dashboard.missedPractice'))}</button>
      </div>
      <ol class="missed-list" role="list">
        ${missed
          .map((m) => {
            const q = findQuestionById(m.id);
            if (!q) return '';
            return `<li>
              <span class="missed-number">${displayNumber(q)}</span>
              <span class="missed-text" lang="en">${escapeHtml(q.question)}</span>
              <span class="missed-count">${escapeHtml(t('dashboard.missedCount', { n: m.misses, total: m.attempts }))}</span>
            </li>`;
          })
          .join('')}
      </ol>
    </section>`
        : ''
    }

    <section class="surface-card english-mini" aria-labelledby="english-mini-heading">
      <span class="today-emoji" aria-hidden="true">🗣️</span>
      <div>
        <h2 id="english-mini-heading">${escapeHtml(t('dashboard.englishHeading'))}</h2>
        <p class="field-hint" style="margin:0;">${escapeHtml(t('dashboard.englishSummary', { r: englishRead, rt: READING_SENTENCES.length, w: englishWrite, wt: WRITING_SENTENCES.length }))}</p>
      </div>
      <button type="button" class="btn btn--secondary" data-go="english">${escapeHtml(t('dashboard.englishGo'))}</button>
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
    <p class="home-share"><a class="btn btn--secondary" href="${shareHref}" target="_blank" rel="noopener noreferrer">💬 ${escapeHtml(t('share.whatsapp'))}</a> <span class="field-hint">${escapeHtml(t('dashboard.shareHelp'))}</span></p>
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

  container.querySelector('#dashboard-plan-settings')?.addEventListener('click', () => {
    callbacks.onOpenSettings();
  });

  container.querySelector('#smart-review-btn')?.addEventListener('click', () => {
    callbacks.onNavigate('flashcards', { filterDue: true });
  });

  container.querySelector('#drill-review-btn')?.addEventListener('click', () => {
    callbacks.onNavigate('flashcards', { filterReview: true });
  });

  container.querySelector('#drill-missed-btn')?.addEventListener('click', () => {
    callbacks.onNavigate('flashcards', { filterMissed: true });
  });

  container.querySelector('#drill-6520-btn')?.addEventListener('click', () => {
    callbacks.onNavigate('flashcards', { filter6520: true });
  });
}
