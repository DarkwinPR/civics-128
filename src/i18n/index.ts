/**
 * Tiny i18n layer. The interface can be English or Spanish; the civics
 * questions themselves always stay in English (that is how the real interview
 * works), with an optional Spanish translation helper.
 *
 * Strings live in per-area modules under ./strings so several people can
 * translate different screens without editing the same file.
 */
import bank from './strings/bank';
import common from './strings/common';
import dashboard from './strings/dashboard';
import english from './strings/english';
import exam from './strings/exam';
import flashcards from './strings/flashcards';
import oral from './strings/oral';
import settings from './strings/settings';

export type Lang = 'en' | 'es';

export interface StringModule {
  en: Record<string, string>;
  es: Record<string, string>;
}

const MODULES: StringModule[] = [common, dashboard, flashcards, exam, oral, bank, settings, english];

const DICTS: Record<Lang, Record<string, string>> = { en: {}, es: {} };
for (const mod of MODULES) {
  Object.assign(DICTS.en, mod.en);
  Object.assign(DICTS.es, mod.es);
}

const LANG_KEY = 'civics128:lang';
const listeners = new Set<(lang: Lang) => void>();

function detectLang(): Lang {
  try {
    const saved = typeof localStorage === 'undefined' ? null : localStorage.getItem(LANG_KEY);
    if (saved === 'en' || saved === 'es') return saved;
  } catch {
    // Storage unavailable: fall back to the browser language.
  }
  if (typeof navigator === 'undefined') return 'en';
  return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

let current: Lang = detectLang();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // Ignore storage errors; the choice still applies for this visit.
  }
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  listeners.forEach((fn) => fn(lang));
}

export function onLangChange(fn: (lang: Lang) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Translate a key. {name} placeholders are replaced from params.
 * Falls back to English, then to the key itself, so a missing translation
 * never breaks the page.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  let text = DICTS[current][key] ?? DICTS.en[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

/** Locale for dates and numbers. */
export function locale(): string {
  return current === 'es' ? 'es-US' : 'en-US';
}

/**
 * Apply translations to static markup in index.html:
 * data-i18n sets textContent, data-i18n-html sets innerHTML (trusted strings
 * only), data-i18n-aria sets aria-label, data-i18n-title sets title.
 */
export function applyStaticTranslations(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n ?? '');
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml ?? '');
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria ?? ''));
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    el.setAttribute('title', t(el.dataset.i18nTitle ?? ''));
  });
}

if (typeof document !== 'undefined') document.documentElement.lang = current;
