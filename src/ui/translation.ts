import { displayNumber } from '../domain/questions';
import { QUESTIONS_2008_ES } from '../domain/questions2008';
import type { CivicsQuestion } from '../domain/types';
import { t } from '../i18n';
import { QUESTIONS_2025_ES } from '../i18n/questionsEs';
import { WHY_2025_ES } from '../i18n/whyEs';
import { reportIssueUrl } from '../config';
import { escapeHtml } from './dom';

export interface QuestionTranslationView {
  question: string;
  answers?: string[];
}

/** Spanish helper text for a civics question (2008 bank has question text only). */
export function getSpanishTranslation(question: CivicsQuestion): QuestionTranslationView | undefined {
  if (question.id > 1000) {
    const q = QUESTIONS_2008_ES[question.id];
    return q ? { question: q } : undefined;
  }
  const entry = QUESTIONS_2025_ES[question.id];
  return entry ? { question: entry.q, answers: entry.a } : undefined;
}

/**
 * "Ver en español" toggle + box. The caller owns the open/closed state and
 * binds clicks on [data-action="toggle-translation"].
 */
export function renderTranslationToggle(
  question: CivicsQuestion,
  open: boolean,
  includeAnswers: boolean,
): string {
  const tr = getSpanishTranslation(question);
  if (!tr) return '';
  return `
    <div class="translation-wrap">
      <button type="button" class="btn btn--ghost translation-toggle" data-action="toggle-translation" aria-expanded="${open}" lang="es">
        ${escapeHtml(open ? t('translation.hide') : t('translation.show'))}
      </button>
      ${
        open
          ? `<div class="translation-box" lang="es">
              <span class="translation-label">${escapeHtml(t('translation.label'))}</span>
              <strong>${escapeHtml(tr.question)}</strong>
              ${
                includeAnswers && tr.answers?.length
                  ? `<ul class="translation-answers">${tr.answers.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ul>`
                  : ''
              }
            </div>`
          : ''
      }
    </div>`;
}

/** Link to open a prefilled GitHub issue about a specific question. */
export function renderReportLink(question: CivicsQuestion, version: string): string {
  const title = `Q${displayNumber(question)} (${version} test): `;
  const body = `Question ${displayNumber(question)} — ${question.question}`;
  return `<a class="report-link" href="${escapeHtml(reportIssueUrl(title, body))}" target="_blank" rel="noopener noreferrer">${escapeHtml(t('report.title'))}</a>`;
}

/** Short Spanish "why" explanation (2025 questions only, for now). */
export function getWhyEs(question: CivicsQuestion): string | undefined {
  return question.id <= 1000 ? WHY_2025_ES[question.id] : undefined;
}

/** "¿Por qué?" box shown after answering. Always in Spanish (lang="es"). */
export function renderWhy(question: CivicsQuestion): string {
  const why = getWhyEs(question);
  if (!why) return '';
  return `<div class="why-box" lang="es"><p class="why-label">🦅 ${escapeHtml(t('why.label'))}</p><p class="why-text">${escapeHtml(why)}</p></div>`;
}
