import {
  checkReading,
  compareWriting,
  pickVariant,
  type WordMark,
  type WritingResult,
} from '../../domain/englishCheck';
import { shuffleArray } from '../../domain/examEngine';
import {
  HELPFUL_PHRASES,
  N400_INTERVIEW,
  READING_SENTENCES,
  READING_VOCAB,
  WRITING_SENTENCES,
  WRITING_VOCAB,
  type PracticeSentence,
  type VocabGroup,
} from '../../domain/englishTest';
import type { AppView, EnglishSentenceProgress, PersistedState } from '../../domain/types';
import { getLang, t } from '../../i18n';
import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  speakText,
  startListening,
  stopSpeaking,
  type ListeningSession,
} from '../../services/speech';
import { getEnglishProgress, type EnglishPart } from '../../services/storage';
import { announce } from '../announcer';
import { escapeHtml, ICONS } from '../dom';
import { mountEnglishMockInterview } from './englishMockInterview';
import { mascotSvg } from '../mascot';

type EnglishTab = 'reading' | 'writing' | 'interview' | 'mock' | 'vocab';

export interface EnglishTestCallbacks {
  getState: () => PersistedState;
  onRecordAttempt: (part: EnglishPart, id: string, passed: boolean) => void;
  onNavigate?: (view: AppView) => void;
}

const WELCOME_KEY = 'civics128:englishWelcome:v1';
const READING_PASS = 0.8;
const INTERVIEW_TOTAL = N400_INTERVIEW.reduce((sum, s) => sum + s.items.length, 0);

const welcomeDismissed = (): boolean => {
  try {
    return localStorage.getItem(WELCOME_KEY) === '1';
  } catch {
    return false;
  }
};

/** Sentences not yet done well come first, so practice goes where it helps most. */
function buildDeck(
  sentences: PracticeSentence[],
  progress: Record<string, EnglishSentenceProgress>,
): PracticeSentence[] {
  const pending = sentences.filter((s) => !(progress[s.id]?.passes ?? 0));
  const done = sentences.filter((s) => (progress[s.id]?.passes ?? 0) > 0);
  return [...shuffleArray(pending), ...shuffleArray(done)];
}

export function mountEnglishTestView(
  container: HTMLElement,
  callbacks: EnglishTestCallbacks,
): () => void {
  const english = () => getEnglishProgress(callbacks.getState());

  let tab: EnglishTab = 'reading';
  let readingDeck = buildDeck(READING_SENTENCES, english().reading);
  let writingDeck = buildDeck(WRITING_SENTENCES, english().writing);
  let readingIdx = 0;
  let writingIdx = 0;
  let sectionIdx = 0;
  let itemIdx = 0;
  let showHelp = false;
  let showTranslation = false;
  let showHint = false;
  let showWelcome = !welcomeDismissed();
  let cleanupMock: (() => void) | null = null;

  let typed = '';
  let writingResult: WritingResult | null = null;
  let writingRevealed = false;
  let transcript = '';
  let readingResult: { score: number; marks: WordMark[] } | null = null;
  let interviewHeard: string | null = null;
  let listening: ListeningSession | null = null;
  let isListening = false;
  let micError = '';

  // Warmth: vary the encouragement and celebrate streaks within this visit.
  let cheerSeed = Math.floor(Math.random() * 100);
  let inARow = 0;
  let sessionCount = 0;

  const speechOpts = () => {
    const settings = callbacks.getState().settings;
    return { rate: settings.speechRate, voiceURI: settings.voiceURI };
  };

  const say = (text: string, slower = false) => {
    const opts = speechOpts();
    speakText(text, { ...opts, rate: slower ? Math.max(0.6, opts.rate - 0.25) : opts.rate });
  };

  /** Read each word with a pause so the learner can follow along. */
  const sayWordByWord = (text: string) => {
    const opts = speechOpts();
    const spaced = text.replace(/[.?!]/g, '').split(/\s+/).join(', ');
    speakText(spaced, { ...opts, rate: Math.max(0.55, opts.rate - 0.3) });
  };

  const stopMic = () => {
    listening?.abort();
    listening = null;
    isListening = false;
  };

  const resetAttempt = () => {
    typed = '';
    writingResult = null;
    writingRevealed = false;
    transcript = '';
    readingResult = null;
    interviewHeard = null;
    micError = '';
    showHelp = false;
    showTranslation = false;
    showHint = false;
    stopMic();
    stopSpeaking();
  };

  const record = (part: EnglishPart, id: string, passed: boolean) => {
    callbacks.onRecordAttempt(part, id, passed);
    sessionCount += 1;
    inARow = passed ? inARow + 1 : 0;
    cheerSeed += 1;
  };

  const cheer = (prefix: string, count: number, params?: Record<string, string | number>) =>
    t(`${prefix}.${pickVariant(count, cheerSeed)}`, params);

  const tabButton = (id: EnglishTab, label: string) =>
    `<button type="button" class="pill-btn" data-tab="${id}" aria-pressed="${tab === id}">${escapeHtml(label)}</button>`;

  const translationBlock = (es: string) =>
    getLang() === 'es' || showTranslation
      ? `
      <button type="button" class="btn btn--ghost translation-toggle" data-action="toggle-translation" aria-expanded="${showTranslation}">
        ${escapeHtml(showTranslation ? t('translation.hide') : t('translation.show'))}
      </button>
      ${
        showTranslation
          ? `<p class="translation-box"><span class="translation-label">${escapeHtml(t('translation.label'))}</span>${escapeHtml(es)}</p>`
          : ''
      }`
      : '';

  const counter = (idx: number, total: number) =>
    `<p class="question-section-label">${escapeHtml(t('english.counter', { n: idx + 1, total }))}</p>`;

  const statusBadge = (progress: EnglishSentenceProgress | undefined) =>
    (progress?.passes ?? 0) > 0
      ? `<span class="english-status english-status--done">${ICONS.check} ${escapeHtml(t('english.doneBadge'))}</span>`
      : !progress
        ? `<span class="english-status">${escapeHtml(t('english.newBadge'))}</span>`
        : '';

  const streakBadge = () =>
    inARow >= 2
      ? `<span class="english-streak" aria-live="polite">🔥 ${escapeHtml(t('english.inARow', { n: inARow }))}</span>`
      : '';

  const progressRow = (label: string, done: number, total: number) => `
    <div class="english-progress-row">
      <div class="english-progress-label">
        <span>${escapeHtml(label)}</span>
        <span class="english-progress-count">${escapeHtml(t('english.progressOf', { n: done, total }))}</span>
      </div>
      <progress class="progress-track progress-track--success" max="${total}" value="${done}">${done}/${total}</progress>
    </div>`;

  const renderProgress = (): string => {
    const p = english();
    const passed = (r: Record<string, EnglishSentenceProgress>) =>
      Object.values(r).filter((x) => x.passes > 0).length;
    return `
      <section class="surface-card english-progress" aria-labelledby="english-progress-heading">
        <h2 id="english-progress-heading" class="english-progress-title">${escapeHtml(t('english.progressTitle'))}</h2>
        ${progressRow(t('english.progressReading'), passed(p.reading), READING_SENTENCES.length)}
        ${progressRow(t('english.progressWriting'), passed(p.writing), WRITING_SENTENCES.length)}
        ${progressRow(t('english.progressInterview'), Object.keys(p.interview).length, INTERVIEW_TOTAL)}
        ${sessionCount > 0 ? `<p class="english-session-note">💛 ${escapeHtml(t('english.sessionDone', { n: sessionCount }))}</p>` : ''}
      </section>`;
  };

  const renderWelcome = (): string =>
    showWelcome
      ? `
      <section class="english-welcome" aria-labelledby="english-welcome-heading">
        ${mascotSvg('happy', 72)}
        <div>
          <h2 id="english-welcome-heading">${escapeHtml(t('english.welcomeTitle'))}</h2>
          <p>${escapeHtml(t('english.welcomeBody'))}</p>
          <button type="button" class="btn btn--secondary" data-action="hide-welcome">${escapeHtml(t('english.welcomeHide'))}</button>
        </div>
      </section>`
      : '';

  const wordChips = (marks: WordMark[], clickable: boolean) =>
    `<p class="word-marks" aria-label="${escapeHtml(t('english.wordCheck'))}">${marks
      .map((m) => {
        const cls = m.ok ? 'is-ok' : m.close ? 'is-close' : 'is-wrong';
        const title = m.got ? ` title="${escapeHtml(t('english.youWrote', { got: m.got }))}"` : '';
        return clickable && !m.ok
          ? `<button type="button" class="word-mark ${cls}" data-say="${escapeHtml(m.display)}" lang="en"${title}>${escapeHtml(m.display)} ${ICONS.volume}</button>`
          : `<span class="word-mark ${cls}" lang="en"${title}>${escapeHtml(m.display)}</span>`;
      })
      .join(' ')}</p>`;

  const legend = (withClose: boolean) => `
    <p class="word-legend">
      <span class="word-mark is-ok">${escapeHtml(t('english.legendOk'))}</span>
      ${withClose ? `<span class="word-mark is-close">${escapeHtml(t('english.legendClose'))}</span>` : ''}
      <span class="word-mark is-wrong">${escapeHtml(t('english.legendWrong'))}</span>
    </p>`;

  const navButtons = (prevDisabled: boolean) => `
    <div class="card-actions">
      <div class="card-action-group">
        <button type="button" class="btn btn--ghost" data-action="prev" ${prevDisabled ? 'disabled' : ''}>${ICONS.arrowLeft} ${escapeHtml(t('english.prev'))}</button>
      </div>
      <div class="card-action-group">
        <button type="button" class="btn btn--primary" data-action="next">${escapeHtml(t('english.next'))} ${ICONS.arrowRight}</button>
      </div>
    </div>`;

  const renderReading = (): string => {
    const item = readingDeck[readingIdx];
    if (!item) return '';
    const canListen = isSpeechRecognitionSupported();
    const canSpeak = isSpeechSynthesisSupported();
    const passed = readingResult !== null && readingResult.score >= READING_PASS;
    const pct = readingResult ? Math.round(readingResult.score * 100) : 0;
    return `
      <article class="question-card english-card" tabindex="-1">
        <div class="question-card-top">
          <span class="badge badge--number">${escapeHtml(t('english.readingBadge'))}</span>
          ${statusBadge(english().reading[item.id])}
          ${streakBadge()}
          ${counter(readingIdx, readingDeck.length)}
        </div>
        <p class="field-hint">${escapeHtml(t('english.readingHelp'))}</p>
        <p class="english-sentence" lang="en">${escapeHtml(item.text)}</p>
        ${translationBlock(item.es)}
        <div class="card-action-group">
          ${
            canListen
              ? `<button type="button" class="btn btn--primary mic-btn ${isListening ? 'is-listening' : ''}" data-action="read-aloud" aria-pressed="${isListening}">
                  ${ICONS.mic} ${escapeHtml(isListening ? t('english.stopListening') : readingResult && !passed ? t('english.tryAgain') : t('english.readAloud'))}
                </button>`
              : `<p class="notice" style="margin:0;">${escapeHtml(t('english.noMic'))}</p>`
          }
          ${
            canSpeak
              ? `<button type="button" class="btn btn--secondary" data-action="hear">${ICONS.volume} ${escapeHtml(t('english.hearIt'))}</button>
                 <button type="button" class="btn btn--ghost" data-action="hear-slow">${escapeHtml(t('english.hearSlow'))}</button>`
              : ''
          }
        </div>
        ${micError ? `<p class="notice notice--error" style="margin:0;">${escapeHtml(micError)}</p>` : ''}
        ${
          transcript
            ? `<div class="transcript-box"><span class="transcript-label">${escapeHtml(t('english.weHeard'))}</span>${escapeHtml(transcript)}</div>`
            : ''
        }
        ${
          readingResult !== null
            ? `
          <div class="english-feedback ${passed ? 'is-pass' : 'is-retry'}">
            <p class="english-feedback-title">${passed ? '🎉 ' : '💪 '}${escapeHtml(
              passed
                ? cheer('english.cheerRead', 4)
                : transcript
                  ? cheer('english.retryRead', 3, { pct })
                  : t('english.nothingHeard'),
            )}</p>
            ${transcript ? wordChips(readingResult.marks, canSpeak) : ''}
            ${transcript && !passed && canSpeak ? `<p class="field-hint" style="margin:0;">${escapeHtml(t('english.tapToHear'))}</p>` : ''}
          </div>`
            : ''
        }
        ${navButtons(readingIdx === 0)}
      </article>`;
  };

  const writingFeedback = (result: WritingResult): string => {
    if (result.exact) return `🎉 ${cheer('english.cheerWrite', 4)}`;
    if (result.onlyTypos) return `✨ ${t('english.writeTypos')}`;
    if (result.missing > 0 && result.extra.length === 0) {
      return `💪 ${t('english.writeMissing', { n: result.missing })}`;
    }
    return `💪 ${t('english.writeAlmost')}`;
  };

  const renderWriting = (): string => {
    const item = writingDeck[writingIdx];
    if (!item) return '';
    const canSpeak = isSpeechSynthesisSupported();
    const hintWords = item.text.replace(/[.?!]$/, '').split(/\s+/);
    return `
      <article class="question-card english-card" tabindex="-1">
        <div class="question-card-top">
          <span class="badge badge--number">${escapeHtml(t('english.writingBadge'))}</span>
          ${statusBadge(english().writing[item.id])}
          ${streakBadge()}
          ${counter(writingIdx, writingDeck.length)}
        </div>
        <p class="field-hint">${escapeHtml(t('english.writingHelp'))}</p>
        <div class="card-action-group">
          ${
            canSpeak
              ? `<button type="button" class="btn btn--primary btn--lg" data-action="dictate">${ICONS.volume} ${escapeHtml(t('english.playSentence'))}</button>
                 <button type="button" class="btn btn--secondary" data-action="dictate-slow">${escapeHtml(t('english.playSlow'))}</button>
                 <button type="button" class="btn btn--ghost" data-action="dictate-words">${escapeHtml(t('english.wordByWord'))}</button>`
              : `<p class="notice" style="margin:0;">${escapeHtml(t('english.noVoice'))}</p>`
          }
          <button type="button" class="btn btn--ghost" data-action="toggle-hint" aria-expanded="${showHint}">💡 ${escapeHtml(t('english.hint'))}</button>
        </div>
        ${
          showHint
            ? `<p class="english-hint"><span>${escapeHtml(t('english.hintText', { n: hintWords.length }))}</span>
                <span class="english-hint-words" lang="en">${hintWords
                  .map((w) => `<span>${escapeHtml(w.charAt(0))}${'_'.repeat(Math.max(1, w.replace(/[^A-Za-z]/g, '').length - 1))}</span>`)
                  .join(' ')}</span></p>`
            : ''
        }
        <form class="typed-answer-form" data-form="writing" autocomplete="off">
          <label class="visually-hidden" for="writing-input">${escapeHtml(t('english.writeHere'))}</label>
          <input id="writing-input" class="text-input" type="text" lang="en" spellcheck="false" autocapitalize="sentences"
            placeholder="${escapeHtml(t('english.writeHere'))}" value="${escapeHtml(typed)}" />
          <button type="submit" class="btn btn--primary">${ICONS.check} ${escapeHtml(t('english.check'))}</button>
        </form>
        ${
          writingResult
            ? `
          <div class="english-feedback ${writingResult.exact ? 'is-pass' : 'is-retry'}">
            <p class="english-feedback-title">${escapeHtml(writingFeedback(writingResult))}</p>
            <p class="english-sentence english-sentence--small" lang="en">${escapeHtml(item.text)}
              ${canSpeak ? `<button type="button" class="icon-btn" data-say="${escapeHtml(item.text)}" aria-label="${escapeHtml(t('english.hearIt'))}">${ICONS.volume}</button>` : ''}
            </p>
            ${
              writingResult.exact
                ? ''
                : `${wordChips(writingResult.marks, canSpeak)}
                   ${legend(writingResult.marks.some((m) => m.close))}
                   ${
                     writingResult.extra.length
                       ? `<p class="field-hint" style="margin:0;">${escapeHtml(t('english.writeExtra'))} <span lang="en">${escapeHtml(writingResult.extra.join(', '))}</span></p>`
                       : ''
                   }
                   <button type="button" class="btn btn--secondary" data-action="retry-writing">${ICONS.rotate} ${escapeHtml(t('english.tryAgain'))}</button>`
            }
            ${translationBlock(item.es)}
          </div>`
            : writingRevealed
              ? `<div class="answer-panel"><p class="english-sentence english-sentence--small" lang="en">${escapeHtml(item.text)}</p>${translationBlock(item.es)}</div>`
              : `<button type="button" class="btn btn--ghost" data-action="show-sentence">${escapeHtml(t('english.showSentence'))}</button>`
        }
        ${navButtons(writingIdx === 0)}
      </article>`;
  };

  const renderPhrases = (): string => {
    const isEs = getLang() === 'es';
    const canSpeak = isSpeechSynthesisSupported();
    return `
      <details class="surface-card english-phrases">
        <summary><strong>🤝 ${escapeHtml(t('english.phrasesTitle'))}</strong></summary>
        <p class="field-hint">${escapeHtml(t('english.phrasesHelp'))}</p>
        <ul class="english-phrase-list">
          ${HELPFUL_PHRASES.map(
            (p) => `
            <li>
              ${
                canSpeak
                  ? `<button type="button" class="english-phrase" data-say="${escapeHtml(p.text)}">${ICONS.volume} <span lang="en">${escapeHtml(p.text)}</span></button>`
                  : `<span class="english-phrase" lang="en">${escapeHtml(p.text)}</span>`
              }
              ${isEs ? `<span class="english-phrase-es">${escapeHtml(p.es)}</span>` : ''}
            </li>`,
          ).join('')}
        </ul>
      </details>`;
  };

  const renderInterview = (): string => {
    const section = N400_INTERVIEW[sectionIdx];
    const item = section?.items[itemIdx];
    if (!section || !item) return '';
    const isEs = getLang() === 'es';
    const canListen = isSpeechRecognitionSupported();
    const answeredBefore = Boolean(english().interview[item.id]);
    return `
      <div class="pill-bar" role="group" aria-label="${escapeHtml(t('english.sections'))}" style="margin-block-end:1rem;">
        ${N400_INTERVIEW.map(
          (s, i) =>
            `<button type="button" class="pill-btn" data-section="${i}" aria-pressed="${i === sectionIdx}">${escapeHtml(isEs ? s.titleEs : s.title)}</button>`,
        ).join('')}
      </div>
      <article class="question-card english-card" tabindex="-1">
        <div class="question-card-top">
          <span class="badge badge--number">N-400</span>
          ${answeredBefore ? `<span class="english-status english-status--done">${ICONS.check} ${escapeHtml(t('english.doneBadge'))}</span>` : ''}
          ${counter(itemIdx, section.items.length)}
        </div>
        <h2 class="question-stem" lang="en">${escapeHtml(item.question)}</h2>
        <div class="card-action-group">
          ${
            isSpeechSynthesisSupported()
              ? `<button type="button" class="btn btn--secondary" data-action="hear-question">${ICONS.volume} ${escapeHtml(t('english.hearOfficer'))}</button>`
              : ''
          }
          ${
            canListen
              ? `<button type="button" class="btn btn--primary mic-btn ${isListening ? 'is-listening' : ''}" data-action="answer-aloud" aria-pressed="${isListening}">
                  ${ICONS.mic} ${escapeHtml(isListening ? t('english.stopListening') : t('english.answerAloud'))}
                </button>`
              : ''
          }
          <button type="button" class="btn ${showHelp ? 'btn--secondary' : 'btn--ghost'}" data-action="toggle-help" aria-expanded="${showHelp}">
            ${escapeHtml(showHelp ? t('english.hideHelp') : t('english.showHelp'))}
          </button>
        </div>
        ${micError ? `<p class="notice notice--error" style="margin:0;">${escapeHtml(micError)}</p>` : ''}
        ${
          isListening && transcript
            ? `<div class="transcript-box"><span class="transcript-label">${escapeHtml(t('english.weHeard'))}</span>${escapeHtml(transcript)}</div>`
            : ''
        }
        ${
          interviewHeard !== null
            ? interviewHeard
              ? `<div class="english-feedback is-pass">
                  <p class="english-feedback-title">🎉 ${escapeHtml(cheer('english.answerCheer', 3))}</p>
                  <p class="field-hint" style="margin:0;">${escapeHtml(t('english.answerHeard'))}</p>
                  <p class="english-heard" lang="en">“${escapeHtml(interviewHeard)}”</p>
                </div>`
              : `<p class="notice notice--gold" style="margin:0;">💪 ${escapeHtml(t('english.answerNotHeard'))}</p>`
            : ''
        }
        ${
          showHelp
            ? `
          <div class="answer-panel">
            <p class="translation-box"><span class="translation-label">${escapeHtml(t('english.meaning'))}</span>${escapeHtml(item.es)}</p>
            <p class="answer-panel-title">${escapeHtml(t('english.sampleAnswer'))}</p>
            <p class="english-sentence english-sentence--small" lang="en">${escapeHtml(item.sampleAnswer)}
              ${
                isSpeechSynthesisSupported()
                  ? `<button type="button" class="icon-btn" data-action="hear-answer" aria-label="${escapeHtml(t('english.hearAnswer'))}">${ICONS.volume}</button>`
                  : ''
              }
            </p>
            <p class="notice notice--info" style="margin:0;"><strong>${escapeHtml(t('english.tip'))}</strong> ${escapeHtml(item.tip)}</p>
            <p class="field-hint">${escapeHtml(t('english.ownAnswer'))}</p>
          </div>`
            : `<p class="field-hint">${escapeHtml(t('english.interviewHelp'))}</p>`
        }
        ${navButtons(sectionIdx === 0 && itemIdx === 0)}
      </article>
      ${renderPhrases()}
      <p class="notice notice--gold" style="margin-block-start:1rem;">${escapeHtml(t('english.legalNote'))}</p>`;
  };

  const renderVocabGroups = (groups: VocabGroup[]) => {
    const isEs = getLang() === 'es';
    return groups
      .map(
        (g) => `
        <div class="vocab-group">
          <h3>${escapeHtml(isEs ? g.titleEs : g.title)}</h3>
          <div class="vocab-chips">
            ${g.words
              .map(
                (w) =>
                  `<button type="button" class="vocab-chip" data-say="${escapeHtml(w)}" lang="en">${escapeHtml(w)}</button>`,
              )
              .join('')}
          </div>
        </div>`,
      )
      .join('');
  };

  const renderVocab = (): string => `
    <p class="field-hint" style="margin-block-end:1rem;">${escapeHtml(t('english.vocabHelp'))}</p>
    <div class="dashboard-columns">
      <section class="surface-card" aria-labelledby="reading-vocab-heading">
        <h2 id="reading-vocab-heading" style="margin:0 0 1rem;font-size:1.2rem;">${escapeHtml(t('english.readingVocab'))}</h2>
        ${renderVocabGroups(READING_VOCAB)}
      </section>
      <section class="surface-card" aria-labelledby="writing-vocab-heading">
        <h2 id="writing-vocab-heading" style="margin:0 0 1rem;font-size:1.2rem;">${escapeHtml(t('english.writingVocab'))}</h2>
        ${renderVocabGroups(WRITING_VOCAB)}
      </section>
    </div>`;

  const render = () => {
    const body =
      tab === 'reading'
        ? renderReading()
        : tab === 'writing'
          ? renderWriting()
          : tab === 'interview'
            ? renderInterview()
            : tab === 'mock'
              ? '<div id="english-mock-root"></div>'
              : renderVocab();

    cleanupMock?.();
    cleanupMock = null;
    container.innerHTML = `
      <div class="${tab === 'vocab' ? '' : 'study-stage-wrapper'}">
        <div class="view-header">
          <div>
            <h1 id="main-heading" tabindex="-1">${escapeHtml(t('english.title'))}</h1>
            <p class="view-lead">${escapeHtml(t('english.lead'))}</p>
          </div>
        </div>
        ${renderWelcome()}
        <div class="pill-bar" role="group" aria-label="${escapeHtml(t('english.tabs'))}" style="margin-block-end:1.15rem;">
          ${tabButton('reading', t('english.tabReading'))}
          ${tabButton('writing', t('english.tabWriting'))}
          ${tabButton('interview', t('english.tabInterview'))}
          ${tabButton('mock', t('english.tabMock'))}
          ${tabButton('vocab', t('english.tabVocab'))}
        </div>
        ${body}
        ${tab === 'vocab' || tab === 'mock' ? '' : renderProgress()}
      </div>`;

    const mockRoot = container.querySelector<HTMLElement>('#english-mock-root');
    if (mockRoot) {
      cleanupMock = mountEnglishMockInterview(mockRoot, {
        getState: callbacks.getState,
        onRecordAttempt: callbacks.onRecordAttempt,
        onNavigate: callbacks.onNavigate,
      });
    }
  };

  const move = (delta: 1 | -1) => {
    resetAttempt();
    if (tab === 'reading') {
      readingIdx += delta;
      if (readingIdx >= readingDeck.length) {
        readingDeck = buildDeck(READING_SENTENCES, english().reading);
        readingIdx = 0;
      }
      readingIdx = Math.max(0, readingIdx);
    } else if (tab === 'writing') {
      writingIdx += delta;
      if (writingIdx >= writingDeck.length) {
        writingDeck = buildDeck(WRITING_SENTENCES, english().writing);
        writingIdx = 0;
      }
      writingIdx = Math.max(0, writingIdx);
    } else if (tab === 'interview') {
      const section = N400_INTERVIEW[sectionIdx];
      if (!section) return;
      itemIdx += delta;
      if (itemIdx >= section.items.length) {
        sectionIdx = (sectionIdx + 1) % N400_INTERVIEW.length;
        itemIdx = 0;
      } else if (itemIdx < 0) {
        sectionIdx = Math.max(0, sectionIdx - 1);
        itemIdx = Math.max(0, (N400_INTERVIEW[sectionIdx]?.items.length ?? 1) - 1);
      }
    }
    render();
    container.querySelector<HTMLElement>('.english-card')?.focus?.({ preventScroll: true });
  };

  /** Shared microphone flow for reading aloud and answering interview questions. */
  const listen = (onDone: (finalText: string) => void) => {
    if (isListening) {
      listening?.stop();
      return;
    }
    stopSpeaking();
    micError = '';
    transcript = '';
    let finalText = '';
    listening = startListening({
      onStart: () => {
        isListening = true;
        render();
      },
      onInterim: (text) => {
        transcript = text;
        const box = container.querySelector('.transcript-box');
        if (box?.lastChild) box.lastChild.textContent = text;
        else render();
      },
      onFinal: (text) => {
        transcript = text;
        finalText = text;
      },
      onError: (message) => {
        micError = message || t('english.micError');
      },
      onEnd: () => {
        isListening = false;
        listening = null;
        if (!micError) onDone(finalText || transcript);
        render();
      },
    });
    if (!listening) {
      micError = t('english.micError');
      render();
    }
  };

  const startReadAloud = () => {
    const item = readingDeck[readingIdx];
    if (!item) return;
    if (!isListening) readingResult = null;
    listen((text) => {
      transcript = text;
      readingResult = checkReading(item.text, text);
      const passed = readingResult.score >= READING_PASS;
      if (text.trim()) record('reading', item.id, passed);
      announce(
        passed
          ? cheer('english.cheerRead', 4)
          : text.trim()
            ? cheer('english.retryRead', 3, { pct: Math.round(readingResult.score * 100) })
            : t('english.nothingHeard'),
      );
    });
  };

  const startInterviewAnswer = () => {
    const item = N400_INTERVIEW[sectionIdx]?.items[itemIdx];
    if (!item) return;
    if (!isListening) interviewHeard = null;
    listen((text) => {
      interviewHeard = text.trim();
      if (interviewHeard) {
        record('interview', item.id, true);
        announce(cheer('english.answerCheer', 3));
      } else {
        announce(t('english.answerNotHeard'));
      }
    });
  };

  const checkWriting = () => {
    const writing = writingDeck[writingIdx];
    if (!writing || !typed.trim()) return;
    writingResult = compareWriting(writing.text, typed);
    // Small spelling slips that keep the meaning are usually accepted at the interview.
    record('writing', writing.id, writingResult.exact || writingResult.onlyTypos);
    announce(writingFeedback(writingResult));
    render();
  };

  const onClick = (event: Event) => {
    const target = event.target as HTMLElement;
    const tabBtn = target.closest<HTMLButtonElement>('[data-tab]');
    if (tabBtn) {
      tab = tabBtn.dataset.tab as EnglishTab;
      inARow = 0;
      resetAttempt();
      render();
      return;
    }
    const sectionBtn = target.closest<HTMLButtonElement>('[data-section]');
    if (sectionBtn) {
      sectionIdx = Number(sectionBtn.dataset.section);
      itemIdx = 0;
      resetAttempt();
      render();
      return;
    }
    const sayBtn = target.closest<HTMLElement>('[data-say]');
    if (sayBtn) {
      say(sayBtn.dataset.say ?? '', sayBtn.classList.contains('word-mark'));
      return;
    }
    const action = target.closest<HTMLButtonElement>('[data-action]')?.dataset.action;
    if (!action) return;

    const reading = readingDeck[readingIdx];
    const writing = writingDeck[writingIdx];
    const interview = N400_INTERVIEW[sectionIdx]?.items[itemIdx];

    switch (action) {
      case 'next':
        move(1);
        break;
      case 'prev':
        move(-1);
        break;
      case 'hide-welcome':
        showWelcome = false;
        try {
          localStorage.setItem(WELCOME_KEY, '1');
        } catch {
          // Private mode: just hide it for this visit.
        }
        render();
        break;
      case 'hear':
        if (reading) say(reading.text);
        break;
      case 'hear-slow':
        if (reading) say(reading.text, true);
        break;
      case 'read-aloud':
        startReadAloud();
        break;
      case 'answer-aloud':
        startInterviewAnswer();
        break;
      case 'dictate':
        if (writing) say(writing.text);
        break;
      case 'dictate-slow':
        if (writing) say(writing.text, true);
        break;
      case 'dictate-words':
        if (writing) sayWordByWord(writing.text);
        break;
      case 'toggle-hint':
        showHint = !showHint;
        render();
        break;
      case 'retry-writing':
        typed = '';
        writingResult = null;
        render();
        container.querySelector<HTMLInputElement>('#writing-input')?.focus();
        if (writing) say(writing.text, true);
        break;
      case 'show-sentence':
        writingRevealed = true;
        render();
        break;
      case 'hear-question':
        if (interview) say(interview.question);
        break;
      case 'hear-answer':
        if (interview) say(interview.sampleAnswer);
        break;
      case 'toggle-help':
        showHelp = !showHelp;
        render();
        break;
      case 'toggle-translation':
        showTranslation = !showTranslation;
        render();
        break;
      default:
        break;
    }
  };

  const onSubmit = (event: Event) => {
    const form = event.target as HTMLFormElement;
    if (form.dataset.form !== 'writing') return;
    event.preventDefault();
    const input = form.querySelector<HTMLInputElement>('#writing-input');
    if (!input) return;
    typed = input.value;
    checkWriting();
  };

  const onInput = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (input.id === 'writing-input') typed = input.value;
  };

  container.addEventListener('click', onClick);
  container.addEventListener('submit', onSubmit);
  container.addEventListener('input', onInput);
  render();

  return () => {
    cleanupMock?.();
    stopMic();
    stopSpeaking();
    container.removeEventListener('click', onClick);
    container.removeEventListener('submit', onSubmit);
    container.removeEventListener('input', onInput);
  };
}
