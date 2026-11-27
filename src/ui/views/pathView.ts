import { evaluateAnswer } from '../../domain/answerMatcher';
import {
  answerStep,
  buildChoice,
  buildPath,
  buildStudyPlan,
  checkpointPassed,
  CHECKPOINT_PASS,
  countLessons,
  countLessonsDone,
  createLessonSession,
  currentStep,
  easiestAnswers,
  findNextStep,
  isCheckpointReady,
  isLessonFinished,
  isUnitComplete,
  isUnitOpen,
  joinAnswers,
  lessonProgress,
  lessonState,
  otherAcceptedAnswers,
  pickCheckpoint,
  sectionTitle,
  seededRandom,
  stepsRemaining,
  type Choice,
  type LessonSession,
  type PathUnit,
} from '../../domain/learningPath';
import {
  CIVICS_QUESTIONS,
  displayNumber,
  findQuestionById,
  getTestVersion,
  isDynamicUnconfigured,
} from '../../domain/questions';
import type { AppView, CivicsQuestion, PersistedState } from '../../domain/types';
import { getLang, t } from '../../i18n';
import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  speakText,
  startListening,
  stopSpeaking,
  type ListeningSession,
} from '../../services/speech';
import {
  getEnglishProgress,
  getPathProgress,
  getQuestionProgress,
  isDueForReview,
  localDayKey,
} from '../../services/storage';
import { announce } from '../announcer';
import { escapeHtml, ICONS } from '../dom';
import { mascotSvg } from '../mascot';
import { renderTranslationToggle } from '../translation';

export interface PathCallbacks {
  getState: () => PersistedState;
  onRecordResult: (questionId: number, correct: boolean) => void;
  onLessonDone: (lessonId: string) => void;
  onUnitPassed: (unitId: string, lessonIds: string[]) => void;
  onReviewDone: () => void;
  onNavigate: (view: AppView) => void;
  onOpenSettings: () => void;
}

/** What the screen is showing. */
type Mode =
  | { kind: 'map' }
  | { kind: 'lesson'; unitIndex: number; lessonIndex: number; session: LessonSession; skipped: number }
  | { kind: 'review'; session: LessonSession }
  | { kind: 'checkpoint'; unitIndex: number; ids: number[]; index: number; correct: number; missed: number[] }
  | { kind: 'lessonDone'; unitIndex: number; lessonIndex: number; mistakes: number; total: number; skipped: number }
  | { kind: 'reviewDone'; total: number; mistakes: number }
  | { kind: 'checkpointDone'; unitIndex: number; correct: number; asked: number; missed: number[] };

/** Feedback after answering the current step. */
interface Feedback {
  correct: boolean;
  chosen?: number;
  message: string;
}

const REVIEW_SIZE = 10;
const LOCK_ICON = '<svg aria-hidden="true" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

/**
 * The lesson in progress survives re-renders of the app shell (language switch,
 * settings changes, visiting another tab) as long as the test version stays.
 */
let saved: { mode: Mode; version: string; seed: number } | null = null;

export function mountPathView(container: HTMLElement, callbacks: PathCallbacks): () => void {
  const lang = () => getLang();
  const units = (): PathUnit[] => buildPath(CIVICS_QUESTIONS, getTestVersion());
  const officials = () => callbacks.getState().settings.officials;

  let mode: Mode = saved && saved.version === getTestVersion() ? saved.mode : { kind: 'map' };
  let feedback: Feedback | null = null;
  let choice: Choice | null = null;
  let choiceKey = '';
  let typed = '';
  let showTranslation = false;
  let listening: ListeningSession | null = null;
  let isListening = false;
  let micError = '';
  let seed = saved?.seed ?? Date.now() % 100000;

  const canSpeak = isSpeechSynthesisSupported();
  const canListen = isSpeechRecognitionSupported();

  const say = (text: string) => {
    const s = callbacks.getState().settings;
    speakText(text, { rate: s.speechRate, voiceURI: s.voiceURI });
  };

  const stopMic = () => {
    listening?.abort();
    listening = null;
    isListening = false;
  };

  const resetStep = () => {
    feedback = null;
    choice = null;
    choiceKey = '';
    typed = '';
    showTranslation = false;
    micError = '';
    stopMic();
    stopSpeaking();
  };

  const dueIds = () => {
    const state = callbacks.getState();
    const now = new Date();
    return CIVICS_QUESTIONS.filter((q) => isDueForReview(getQuestionProgress(state, q.id), now)).map((q) => q.id);
  };

  // -------------------------------------------------------------------------
  // Map
  // -------------------------------------------------------------------------

  const renderPlan = (allUnits: PathUnit[]) => {
    const state = callbacks.getState();
    const plan = buildStudyPlan(state.settings.interviewDate, stepsRemaining(allUnits, getPathProgress(state)));
    if (!plan) {
      return `
        <div class="path-plan path-plan--empty">
          <span aria-hidden="true">📅</span>
          <p>${escapeHtml(t('path.planAsk'))}</p>
          <button type="button" class="btn btn--secondary" data-path="settings">${escapeHtml(t('path.planSet'))}</button>
        </div>`;
    }
    const msg =
      plan.status === 'done'
        ? t('path.planDone', { days: plan.daysLeft })
        : plan.status === 'past'
          ? t('path.planPast')
          : t(`path.plan.${plan.status}`, { days: plan.daysLeft, steps: plan.stepsLeft, perDay: plan.perDay });
    return `
      <div class="path-plan path-plan--${plan.status}">
        <span aria-hidden="true">${plan.status === 'behind' ? '⏰' : plan.status === 'tight' ? '💪' : '📅'}</span>
        <p>${escapeHtml(msg)}</p>
      </div>`;
  };

  const renderToday = (allUnits: PathUnit[]) => {
    const state = callbacks.getState();
    const progress = getPathProgress(state);
    const today = localDayKey();
    const due = dueIds();
    const reviewDone = progress.reviewDoneOn === today || due.length === 0;
    const lessonDoneToday = Object.values(progress.lessonsDone).some((d) => localDayKey(new Date(d)) === today);
    const english = getEnglishProgress(state);
    const englishDone = [english.reading, english.writing, english.interview].some((part) =>
      Object.values(part).some((p) => p.lastPracticedAt && localDayKey(new Date(p.lastPracticedAt)) === today),
    );
    const next = findNextStep(allUnits, progress);
    const allDone = reviewDone && lessonDoneToday && englishDone;

    const step = (done: boolean, icon: string, label: string, detail: string, action: string, cta: string, disabled = false) => `
      <li class="today-step ${done ? 'is-done' : ''}">
        <span class="today-step-icon" aria-hidden="true">${done ? '✅' : icon}</span>
        <span class="today-step-text"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(detail)}</span></span>
        ${done ? `<span class="visually-hidden">${escapeHtml(t('path.stepDone'))}</span>` : `<button type="button" class="btn btn--primary" data-path="${action}" ${disabled ? 'disabled' : ''}>${escapeHtml(cta)}</button>`}
      </li>`;

    return `
      <section class="surface-card today-session" aria-labelledby="today-heading">
        <h2 id="today-heading">${escapeHtml(allDone ? t('path.todayAllDone') : t('path.todayTitle'))}</h2>
        <ol class="today-steps" role="list">
          ${step(reviewDone, '🔁', t('path.todayReview'), due.length ? t('path.todayReviewDetail', { n: Math.min(due.length, REVIEW_SIZE) }) : t('path.todayReviewNone'), 'review', t('path.start'))}
          ${step(lessonDoneToday, '⭐', t('path.todayLesson'), next ? t('path.todayLessonDetail') : t('path.pathFinished'), 'next', t('path.start'), !next)}
          ${step(englishDone, '🗣️', t('path.todayEnglish'), t('path.todayEnglishDetail'), 'english', t('path.go'))}
        </ol>
      </section>`;
  };

  const renderUnit = (allUnits: PathUnit[], unit: PathUnit, u: number) => {
    const state = callbacks.getState();
    const progress = getPathProgress(state);
    const open = isUnitOpen(allUnits, u, progress);
    const complete = isUnitComplete(unit, progress);
    const done = unit.lessons.filter((l) => progress.lessonsDone[l.id] || complete).length;
    const checkpointReady = isCheckpointReady(unit, progress) && !complete;
    const unconfigured = unit.questionIds.filter((id) => {
      const q = findQuestionById(id);
      return q && isDynamicUnconfigured(q, officials());
    }).length;

    const nodes = unit.lessons
      .map((lesson, l) => {
        const st = lessonState(allUnits, u, l, progress);
        const nums = lesson.questionIds.map((id) => findQuestionById(id)).filter(Boolean) as CivicsQuestion[];
        const range = nums.length ? `${displayNumber(nums[0]!)}–${displayNumber(nums[nums.length - 1]!)}` : '';
        const label = t('path.lessonLabel', { n: l + 1, range });
        return `
          <li class="path-node path-node--${st}" style="--offset:${[0, 1, 2, 1][l % 4]}">
            <button type="button" class="path-node-btn" data-path="lesson" data-unit="${u}" data-lesson="${l}"
              ${st === 'locked' ? 'disabled' : ''} aria-label="${escapeHtml(`${label} · ${t(`path.state.${st}`)}`)}">
              <span aria-hidden="true">${st === 'done' ? '✓' : st === 'locked' ? LOCK_ICON : '★'}</span>
            </button>
            <span class="path-node-label">${escapeHtml(label)}${st === 'next' ? ` <strong>${escapeHtml(t('path.startHere'))}</strong>` : ''}</span>
          </li>`;
      })
      .join('');

    const checkpointState = complete ? 'done' : checkpointReady ? 'next' : 'locked';
    return `
      <section class="path-unit ${open ? '' : 'is-locked'} ${complete ? 'is-complete' : ''}" aria-labelledby="unit-${u}-title">
        <header class="path-unit-banner">
          <div>
            <p class="path-unit-eyebrow">${escapeHtml(t('path.unitLabel', { n: u + 1 }))} · ${escapeHtml(t(`category.${unit.category}`))}</p>
            <h2 id="unit-${u}-title">${escapeHtml(sectionTitle(unit.section, lang()))}</h2>
            <p class="path-unit-meta">${escapeHtml(t('path.unitMeta', { q: unit.questionIds.length, done, total: unit.lessons.length }))}</p>
          </div>
          ${open && !complete ? mascotSvg('stand', 76) : complete ? '<span class="path-unit-trophy" aria-hidden="true">🏆</span>' : ''}
        </header>
        ${
          open && !complete && !checkpointReady
            ? `<button type="button" class="btn btn--ghost path-skip" data-path="checkpoint" data-unit="${u}">${escapeHtml(t('path.skipTest'))}</button>`
            : ''
        }
        ${unconfigured && open ? `<p class="notice notice--gold path-unit-note">${escapeHtml(t('path.unconfigured', { n: unconfigured }))} <button type="button" class="btn btn--ghost" data-path="settings">${escapeHtml(t('path.planSet'))}</button></p>` : ''}
        <ol class="path-nodes" role="list">
          ${nodes}
          <li class="path-node path-node--checkpoint path-node--${checkpointState}" style="--offset:1">
            <button type="button" class="path-node-btn" data-path="checkpoint" data-unit="${u}" ${checkpointState === 'next' ? '' : 'disabled'}
              aria-label="${escapeHtml(`${t('path.checkpoint')} · ${t(`path.state.${checkpointState}`)}`)}">
              <span aria-hidden="true">${complete ? '🏆' : checkpointState === 'next' ? '🏁' : LOCK_ICON}</span>
            </button>
            <span class="path-node-label">${escapeHtml(t('path.checkpoint'))}${checkpointState === 'next' ? ` <strong>${escapeHtml(t('path.startHere'))}</strong>` : ''}</span>
          </li>
        </ol>
      </section>`;
  };

  const renderMap = () => {
    const allUnits = units();
    const progress = getPathProgress(callbacks.getState());
    const total = countLessons(allUnits);
    const done = countLessonsDone(allUnits, progress);
    const unitsDone = allUnits.filter((u) => isUnitComplete(u, progress)).length;
    return `
      <div class="view-header">
        <div>
          <h1 id="main-heading" tabindex="-1">${escapeHtml(t('path.title'))}</h1>
          <p class="view-lead">${escapeHtml(t('path.lead'))}</p>
        </div>
      </div>
      <div class="path-summary">
        <div class="path-summary-text">
          <strong>${escapeHtml(t('path.summary', { done, total }))}</strong>
          <span>${escapeHtml(t('path.summaryUnits', { done: unitsDone, total: allUnits.length }))}</span>
        </div>
        <progress class="progress-track progress-track--success" max="${total}" value="${done}">${done}/${total}</progress>
      </div>
      ${renderPlan(allUnits)}
      ${renderToday(allUnits)}
      <div class="path-tools">
        <button type="button" class="btn btn--secondary" data-path="audio">🎧 ${escapeHtml(t('path.audio'))}</button>
      </div>
      <div class="path-map">
        ${allUnits.map((unit, u) => renderUnit(allUnits, unit, u)).join('')}
      </div>`;
  };

  // -------------------------------------------------------------------------
  // Lesson / review / checkpoint steps
  // -------------------------------------------------------------------------

  const activeQuestion = (): { q: CivicsQuestion; kind: 'choice' | 'recall' } | null => {
    if (mode.kind === 'lesson' || mode.kind === 'review') {
      const step = currentStep(mode.session);
      const q = step ? findQuestionById(step.questionId) : undefined;
      return q && step ? { q, kind: step.kind } : null;
    }
    if (mode.kind === 'checkpoint') {
      const q = findQuestionById(mode.ids[mode.index] ?? -1);
      return q ? { q, kind: 'recall' } : null;
    }
    return null;
  };

  const ensureChoice = (q: CivicsQuestion, stepNo: number) => {
    const key = `${q.id}:${stepNo}`;
    if (choice && choiceKey === key) return choice;
    choice = buildChoice(q, CIVICS_QUESTIONS, officials(), seededRandom(seed + q.id * 31 + stepNo));
    choiceKey = key;
    return choice;
  };

  const easiestLine = (q: CivicsQuestion) =>
    `<p class="easiest-answer"><span class="easiest-label">💡 ${escapeHtml(t('path.easiest'))}</span> <span lang="en">${escapeHtml(joinAnswers(easiestAnswers(q, officials())))}</span>
      ${canSpeak ? `<button type="button" class="icon-btn" data-say="${escapeHtml(joinAnswers(easiestAnswers(q, officials())))}" aria-label="${escapeHtml(t('path.hearAnswer'))}">${ICONS.volume}</button>` : ''}</p>`;

  const otherAnswersBlock = (q: CivicsQuestion) => {
    const others = otherAcceptedAnswers(q, officials());
    if (!others.length) return '';
    return `<div class="other-answers">
        <p class="other-answers-label">${escapeHtml(q.requiredCount > 1 ? t('path.alsoAcceptedMany', { n: q.requiredCount }) : t('path.alsoAccepted'))}</p>
        <ul class="other-answers-list" role="list">${others.map((a) => `<li lang="en">${escapeHtml(a)}</li>`).join('')}</ul>
      </div>`;
  };

  const progressHeader = (pct: number, label: string) => `
    <div class="lesson-top">
      <button type="button" class="icon-btn" data-path="quit" aria-label="${escapeHtml(t('path.quit'))}">✕</button>
      <progress class="progress-track progress-track--success lesson-progress" max="100" value="${Math.round(pct * 100)}" aria-label="${escapeHtml(label)}"></progress>
    </div>`;

  const renderStep = () => {
    const active = activeQuestion();
    if (!active) return '';
    const { q, kind } = active;
    let pct = 0;
    let label = '';
    let stepNo = 0;
    if (mode.kind === 'lesson' || mode.kind === 'review') {
      pct = lessonProgress(mode.session);
      stepNo = mode.session.answered;
      label = mode.kind === 'review' ? t('path.reviewTitle') : t('path.lessonProgress', { pct: Math.round(pct * 100) });
    } else if (mode.kind === 'checkpoint') {
      pct = mode.index / mode.ids.length;
      stepNo = mode.index;
      label = t('path.checkpointProgress', { n: mode.index + 1, total: mode.ids.length });
    }
    const title =
      mode.kind === 'checkpoint'
        ? `🏁 ${t('path.checkpoint')} · ${t('path.checkpointProgress', { n: mode.index + 1, total: mode.ids.length })}`
        : kind === 'choice'
          ? t('path.kindChoice')
          : t('path.kindRecall');

    const body =
      kind === 'choice'
        ? (() => {
            const c = ensureChoice(q, stepNo);
            return `<div class="choice-list" role="group" aria-label="${escapeHtml(t('path.kindChoice'))}">
              ${c.options
                .map((opt, i) => {
                  const state = feedback
                    ? i === c.correctIndex
                      ? 'is-right'
                      : i === feedback.chosen
                        ? 'is-wrong'
                        : 'is-dim'
                    : '';
                  return `<button type="button" class="choice-btn ${state}" data-choice="${i}" lang="en" ${feedback ? 'disabled' : ''}>
                    <span class="choice-key" aria-hidden="true">${i + 1}</span>${escapeHtml(opt)}</button>`;
                })
                .join('')}
            </div>`;
          })()
        : `<form class="typed-answer-form" data-form="path-recall" autocomplete="off">
            <label class="visually-hidden" for="path-input">${escapeHtml(t('path.typeAnswer'))}</label>
            <input id="path-input" class="text-input" type="text" lang="en" spellcheck="false" autocapitalize="sentences"
              placeholder="${escapeHtml(t('path.typeAnswer'))}" value="${escapeHtml(typed)}" ${feedback ? 'disabled' : ''} />
            ${
              feedback
                ? ''
                : `<button type="submit" class="btn btn--primary">${ICONS.check} ${escapeHtml(t('path.check'))}</button>`
            }
          </form>
          ${
            !feedback
              ? `<div class="card-action-group">
                  ${canListen ? `<button type="button" class="btn btn--secondary mic-btn ${isListening ? 'is-listening' : ''}" data-path="mic" aria-pressed="${isListening}">${ICONS.mic} ${escapeHtml(isListening ? t('english.stopListening') : t('path.sayIt'))}</button>` : ''}
                  <button type="button" class="btn btn--ghost" data-path="dont-know">${escapeHtml(t('path.dontKnow'))}</button>
                </div>`
              : ''
          }
          ${micError ? `<p class="notice notice--error" style="margin:0;">${escapeHtml(micError)}</p>` : ''}`;

    const feedbackBar = feedback
      ? `<div class="lesson-feedback ${feedback.correct ? 'is-right' : 'is-wrong'}" role="status">
          <p class="lesson-feedback-title">${escapeHtml(feedback.message)}</p>
          ${easiestLine(q)}
          ${otherAnswersBlock(q)}
          <button type="button" class="btn ${feedback.correct ? 'btn--success' : 'btn--primary'} btn--lg" data-path="continue" id="lesson-continue">${escapeHtml(t('path.continue'))}</button>
        </div>`
      : '';

    return `
      ${progressHeader(pct, label)}
      <article class="question-card lesson-card" tabindex="-1">
        <p class="lesson-kind">${escapeHtml(title)}</p>
        <div class="lesson-question">
          <span class="badge badge--number">${displayNumber(q)}</span>
          <h2 class="question-stem" lang="en">${escapeHtml(q.question)}</h2>
          ${canSpeak ? `<button type="button" class="icon-btn" data-say="${escapeHtml(q.question)}" aria-label="${escapeHtml(t('path.hearQuestion'))}">${ICONS.volume}</button>` : ''}
        </div>
        ${q.requiredCount > 1 ? `<p class="notice notice--info" style="margin:0;">${escapeHtml(t('path.needMany', { n: q.requiredCount }))}</p>` : ''}
        ${renderTranslationToggle(q, showTranslation, false)}
        ${body}
      </article>
      ${feedbackBar}`;
  };

  const celebration = (emoji: string, title: string, lines: string[], actions: string) => `
    <div class="lesson-done" role="status">
      ${emoji === '🌱' ? mascotSvg('stand', 120) : mascotSvg('flag', 120)}
      <h1 id="main-heading" tabindex="-1">${escapeHtml(title)}</h1>
      ${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('')}
      <div class="card-action-group" style="justify-content:center;">${actions}</div>
    </div>`;

  const renderDone = () => {
    if (mode.kind === 'lessonDone') {
      const accuracy = mode.total ? Math.round((mode.total / (mode.total + mode.mistakes)) * 100) : 100;
      return celebration(
        mode.mistakes === 0 ? '🌟' : '🎉',
        t('path.lessonDoneTitle'),
        [
          mode.mistakes === 0 ? t('path.lessonPerfect') : t('path.lessonDoneBody', { n: mode.total, pct: accuracy }),
          ...(mode.skipped ? [t('path.lessonSkipped', { n: mode.skipped })] : []),
        ],
        `<button type="button" class="btn btn--primary btn--lg" data-path="next">${escapeHtml(t('path.nextLesson'))} ${ICONS.arrowRight}</button>
         <button type="button" class="btn btn--ghost" data-path="map">${escapeHtml(t('path.backToMap'))}</button>`,
      );
    }
    if (mode.kind === 'reviewDone') {
      return celebration(
        '🔁',
        t('path.reviewDoneTitle'),
        [t('path.reviewDoneBody', { n: mode.total })],
        `<button type="button" class="btn btn--primary btn--lg" data-path="next">${escapeHtml(t('path.nextLesson'))} ${ICONS.arrowRight}</button>
         <button type="button" class="btn btn--ghost" data-path="map">${escapeHtml(t('path.backToMap'))}</button>`,
      );
    }
    if (mode.kind === 'checkpointDone') {
      const passed = checkpointPassed(mode.correct, mode.asked);
      const unit = units()[mode.unitIndex];
      const missed = mode.missed
        .map((id) => findQuestionById(id))
        .filter(Boolean)
        .map((q) => `<li><strong>${displayNumber(q!)}.</strong> <span lang="en">${escapeHtml(q!.question)}</span><br /><span class="field-hint">💡 <span lang="en">${escapeHtml(joinAnswers(easiestAnswers(q!, officials())))}</span></span></li>`)
        .join('');
      return `${celebration(
        passed ? '🏆' : '🌱',
        passed ? t('path.checkpointPassTitle') : t('path.checkpointRetryTitle'),
        [
          t('path.checkpointScore', { correct: mode.correct, asked: mode.asked, need: Math.ceil(mode.asked * CHECKPOINT_PASS) }),
          passed
            ? t('path.checkpointPassBody', { unit: unit ? sectionTitle(unit.section, lang()) : '' })
            : t('path.checkpointRetryBody'),
        ],
        passed
          ? `<button type="button" class="btn btn--primary btn--lg" data-path="next">${escapeHtml(t('path.nextLesson'))} ${ICONS.arrowRight}</button>
             <button type="button" class="btn btn--ghost" data-path="map">${escapeHtml(t('path.backToMap'))}</button>`
          : `<button type="button" class="btn btn--primary btn--lg" data-path="checkpoint" data-unit="${mode.unitIndex}">${ICONS.rotate} ${escapeHtml(t('path.tryAgain'))}</button>
             <button type="button" class="btn btn--ghost" data-path="map">${escapeHtml(t('path.backToMap'))}</button>`,
      )}
      ${missed ? `<section class="surface-card missed-review"><h2>${escapeHtml(t('path.toReview'))}</h2><ul>${missed}</ul></section>` : ''}`;
    }
    return '';
  };

  const render = () => {
    const inStep = mode.kind === 'lesson' || mode.kind === 'review' || mode.kind === 'checkpoint';
    container.innerHTML = `<div class="path-view ${inStep ? 'is-focus' : ''}">
      ${mode.kind === 'map' ? renderMap() : inStep ? `<h1 id="main-heading" class="visually-hidden" tabindex="-1">${escapeHtml(t('path.title'))}</h1>${renderStep()}` : renderDone()}
    </div>`;
  };

  const focusMain = () => {
    const target =
      container.querySelector<HTMLElement>('#lesson-continue') ??
      container.querySelector<HTMLElement>('.lesson-card') ??
      container.querySelector<HTMLElement>('#main-heading');
    target?.focus({ preventScroll: false });
  };

  // -------------------------------------------------------------------------
  // Flow
  // -------------------------------------------------------------------------

  const startLesson = (unitIndex: number, lessonIndex: number) => {
    const unit = units()[unitIndex];
    const lesson = unit?.lessons[lessonIndex];
    if (!lesson) return;
    // Questions about your own state need your answers first; they are skipped for now.
    const ids = lesson.questionIds.filter((id) => {
      const q = findQuestionById(id);
      return q && !isDynamicUnconfigured(q, officials());
    });
    seed += 1;
    resetStep();
    mode = {
      kind: 'lesson',
      unitIndex,
      lessonIndex,
      session: createLessonSession(ids, seededRandom(seed)),
      skipped: lesson.questionIds.length - ids.length,
    };
    if (ids.length === 0) finishLesson();
    render();
    window.scrollTo({ top: 0 });
    focusMain();
    autoSpeak();
  };

  const startReview = () => {
    const ids = dueIds().slice(0, REVIEW_SIZE);
    if (!ids.length) return;
    seed += 1;
    resetStep();
    mode = { kind: 'review', session: createLessonSession(ids, seededRandom(seed), true) };
    render();
    window.scrollTo({ top: 0 });
    focusMain();
    autoSpeak();
  };

  const startCheckpoint = (unitIndex: number) => {
    const unit = units()[unitIndex];
    if (!unit) return;
    seed += 1;
    const ids = pickCheckpoint(unit, seededRandom(seed)).filter((id) => {
      const q = findQuestionById(id);
      return q && !isDynamicUnconfigured(q, officials());
    });
    resetStep();
    mode = { kind: 'checkpoint', unitIndex, ids, index: 0, correct: 0, missed: [] };
    render();
    window.scrollTo({ top: 0 });
    focusMain();
    autoSpeak();
  };

  const startNext = () => {
    const allUnits = units();
    const next = findNextStep(allUnits, getPathProgress(callbacks.getState()));
    if (!next) {
      mode = { kind: 'map' };
      render();
      return;
    }
    if (next.lessonIndex === -1) startCheckpoint(next.unitIndex);
    else startLesson(next.unitIndex, next.lessonIndex);
  };

  const autoSpeak = () => {
    const active = activeQuestion();
    if (active && canSpeak && callbacks.getState().settings.autoSpeak) say(active.q.question);
  };

  const finishLesson = () => {
    if (mode.kind !== 'lesson') return;
    const unit = units()[mode.unitIndex];
    const lesson = unit?.lessons[mode.lessonIndex];
    if (lesson) callbacks.onLessonDone(lesson.id);
    mode = {
      kind: 'lessonDone',
      unitIndex: mode.unitIndex,
      lessonIndex: mode.lessonIndex,
      mistakes: mode.session.mistakes,
      total: mode.session.total,
      skipped: mode.skipped,
    };
    announce(t('path.lessonDoneTitle'));
  };

  const submitAnswer = (correct: boolean, chosen?: number) => {
    const active = activeQuestion();
    if (!active || feedback) return;
    stopMic();
    const isRecall = active.kind === 'recall';
    // Only answers from memory count for spaced repetition and the daily goal.
    if (isRecall) callbacks.onRecordResult(active.q.id, correct);
    const message = correct
      ? t(`path.right.${(seed + (mode.kind === 'checkpoint' ? mode.index : 0)) % 4}`)
      : mode.kind === 'checkpoint'
        ? t('path.wrongCheckpoint')
        : t('path.wrongAgain');
    feedback = { correct, chosen, message };
    announce(`${message} ${t('path.easiest')} ${joinAnswers(easiestAnswers(active.q, officials()))}`);
    render();
    focusMain();
  };

  let silent = false;
  const advanceSilently = () => {
    silent = true;
    advance();
    silent = false;
  };

  const advance = () => {
    if (!feedback) return;
    const correct = feedback.correct;
    resetStep();
    if (mode.kind === 'lesson' || mode.kind === 'review') {
      const session = answerStep(mode.session, correct);
      if (isLessonFinished(session)) {
        if (mode.kind === 'lesson') {
          mode = { ...mode, session };
          finishLesson();
        } else {
          callbacks.onReviewDone();
          mode = { kind: 'reviewDone', total: session.total, mistakes: session.mistakes };
          announce(t('path.reviewDoneTitle'));
        }
      } else {
        mode = { ...mode, session };
      }
    } else if (mode.kind === 'checkpoint') {
      const id = mode.ids[mode.index]!;
      const nextCorrect = mode.correct + (correct ? 1 : 0);
      const missed = correct ? mode.missed : [...mode.missed, id];
      const index = mode.index + 1;
      if (index >= mode.ids.length) {
        const unit = units()[mode.unitIndex];
        const passed = checkpointPassed(nextCorrect, mode.ids.length);
        if (passed && unit) callbacks.onUnitPassed(unit.id, unit.lessons.map((l) => l.id));
        mode = { kind: 'checkpointDone', unitIndex: mode.unitIndex, correct: nextCorrect, asked: mode.ids.length, missed };
        announce(passed ? t('path.checkpointPassTitle') : t('path.checkpointRetryTitle'));
      } else {
        mode = { ...mode, index, correct: nextCorrect, missed };
      }
    }
    if (silent) return;
    render();
    window.scrollTo({ top: 0 });
    focusMain();
    autoSpeak();
  };

  const checkTyped = (text: string) => {
    const active = activeQuestion();
    if (!active || !text.trim()) return;
    typed = text;
    const result = evaluateAnswer(active.q, text, officials());
    submitAnswer(result.isMatch);
  };

  const toggleMic = () => {
    if (isListening) {
      listening?.stop();
      return;
    }
    micError = '';
    let finalText = '';
    listening = startListening({
      onStart: () => {
        isListening = true;
        render();
      },
      onInterim: (text) => {
        typed = text;
        const input = container.querySelector<HTMLInputElement>('#path-input');
        if (input) input.value = text;
      },
      onFinal: (text) => {
        finalText = text;
      },
      onError: (message) => {
        micError = message || t('english.micError');
      },
      onEnd: () => {
        isListening = false;
        listening = null;
        const text = (finalText || typed).trim();
        if (text && !micError) checkTyped(text);
        else render();
      },
    });
    if (!listening) {
      micError = t('english.micError');
      render();
    }
  };

  const onClick = (event: Event) => {
    const target = event.target as HTMLElement;
    const sayBtn = target.closest<HTMLElement>('[data-say]');
    if (sayBtn) {
      say(sayBtn.dataset.say ?? '');
      return;
    }
    const choiceBtn = target.closest<HTMLElement>('[data-choice]');
    if (choiceBtn && choice) {
      const i = Number(choiceBtn.dataset.choice);
      submitAnswer(i === choice.correctIndex, i);
      return;
    }
    if (target.closest('[data-action="toggle-translation"]')) {
      showTranslation = !showTranslation;
      render();
      return;
    }
    const btn = target.closest<HTMLElement>('[data-path]');
    if (!btn) return;
    const unitIndex = Number(btn.dataset.unit ?? -1);
    switch (btn.dataset.path) {
      case 'lesson':
        startLesson(unitIndex, Number(btn.dataset.lesson));
        break;
      case 'checkpoint':
        startCheckpoint(unitIndex);
        break;
      case 'review':
        startReview();
        break;
      case 'next':
        startNext();
        break;
      case 'english':
        callbacks.onNavigate('english');
        break;
      case 'audio':
        callbacks.onNavigate('audio');
        break;
      case 'settings':
        callbacks.onOpenSettings();
        break;
      case 'continue':
        advance();
        break;
      case 'dont-know':
        submitAnswer(false);
        break;
      case 'mic':
        toggleMic();
        break;
      case 'quit':
      case 'map':
        resetStep();
        mode = { kind: 'map' };
        render();
        focusMain();
        break;
      default:
        break;
    }
  };

  const onSubmit = (event: Event) => {
    const form = event.target as HTMLFormElement;
    if (form.dataset.form !== 'path-recall') return;
    event.preventDefault();
    const input = form.querySelector<HTMLInputElement>('#path-input');
    if (input) checkTyped(input.value);
  };

  const onInput = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (input.id === 'path-input') typed = input.value;
  };

  /** Number keys pick an option; Enter continues. */
  const onKeydown = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement) return;
    if (feedback && event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
      advance();
      return;
    }
    if (!feedback && choice && /^[1-4]$/.test(event.key)) {
      const i = Number(event.key) - 1;
      if (i < choice.options.length) submitAnswer(i === choice.correctIndex, i);
    }
  };

  container.addEventListener('click', onClick);
  container.addEventListener('submit', onSubmit);
  container.addEventListener('input', onInput);
  window.addEventListener('keydown', onKeydown);
  render();

  return () => {
    // Keep an unfinished lesson; an answered step resumes at its next question.
    if (feedback) advanceSilently();
    saved = { mode, version: getTestVersion(), seed };
    stopMic();
    stopSpeaking();
    container.removeEventListener('click', onClick);
    container.removeEventListener('submit', onSubmit);
    container.removeEventListener('input', onInput);
    window.removeEventListener('keydown', onKeydown);
  };
}
