import { compareWriting, readingScore, type WordMark } from '../../domain/englishCheck';
import { shuffleArray } from '../../domain/examEngine';
import {
  N400_INTERVIEW,
  READING_SENTENCES,
  READING_VOCAB,
  WRITING_SENTENCES,
  WRITING_VOCAB,
  type PracticeSentence,
  type VocabGroup,
} from '../../domain/englishTest';
import type { PersistedState } from '../../domain/types';
import { getLang, t } from '../../i18n';
import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  speakText,
  startListening,
  stopSpeaking,
  type ListeningSession,
} from '../../services/speech';
import { announce } from '../announcer';
import { escapeHtml, ICONS } from '../dom';

type EnglishTab = 'reading' | 'writing' | 'interview' | 'vocab';

export interface EnglishTestCallbacks {
  getState: () => PersistedState;
}

export function mountEnglishTestView(
  container: HTMLElement,
  callbacks: EnglishTestCallbacks,
): () => void {
  let tab: EnglishTab = 'reading';
  let readingDeck: PracticeSentence[] = shuffleArray(READING_SENTENCES);
  let writingDeck: PracticeSentence[] = shuffleArray(WRITING_SENTENCES);
  let readingIdx = 0;
  let writingIdx = 0;
  let sectionIdx = 0;
  let itemIdx = 0;
  let showHelp = false;
  let showTranslation = false;

  let typed = '';
  let writingResult: { exact: boolean; marks: WordMark[] } | null = null;
  let transcript = '';
  let readingResult: number | null = null;
  let listening: ListeningSession | null = null;
  let isListening = false;
  let micError = '';

  const speechOpts = () => {
    const settings = callbacks.getState().settings;
    return { rate: settings.speechRate, voiceURI: settings.voiceURI };
  };

  const say = (text: string, slower = false) => {
    const opts = speechOpts();
    speakText(text, { ...opts, rate: slower ? Math.max(0.7, opts.rate - 0.15) : opts.rate });
  };

  const stopMic = () => {
    listening?.abort();
    listening = null;
    isListening = false;
  };

  const resetAttempt = () => {
    typed = '';
    writingResult = null;
    transcript = '';
    readingResult = null;
    micError = '';
    showHelp = false;
    showTranslation = false;
    stopMic();
    stopSpeaking();
  };

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

  const renderReading = (): string => {
    const item = readingDeck[readingIdx];
    if (!item) return '';
    const canListen = isSpeechRecognitionSupported();
    const passed = readingResult !== null && readingResult >= 0.8;
    return `
      <article class="question-card english-card">
        <div class="question-card-top">
          <span class="badge badge--number">${escapeHtml(t('english.readingBadge'))}</span>
          ${counter(readingIdx, readingDeck.length)}
        </div>
        <p class="field-hint">${escapeHtml(t('english.readingHelp'))}</p>
        <p class="english-sentence" lang="en">${escapeHtml(item.text)}</p>
        ${translationBlock(item.es)}
        <div class="card-action-group">
          ${
            canListen
              ? `<button type="button" class="btn btn--primary mic-btn ${isListening ? 'is-listening' : ''}" data-action="read-aloud" aria-pressed="${isListening}">
                  ${ICONS.mic} ${escapeHtml(isListening ? t('english.stopListening') : t('english.readAloud'))}
                </button>`
              : `<p class="notice" style="margin:0;">${escapeHtml(t('english.noMic'))}</p>`
          }
          ${
            isSpeechSynthesisSupported()
              ? `<button type="button" class="btn btn--secondary" data-action="hear">${ICONS.volume} ${escapeHtml(t('english.hearIt'))}</button>`
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
            ? `<p class="notice ${passed ? 'notice--success' : 'notice--gold'}" style="margin:0;">
                ${escapeHtml(passed ? t('english.readingPass') : t('english.readingRetry', { pct: Math.round(readingResult * 100) }))}
              </p>`
            : ''
        }
        <div class="card-actions">
          <div class="card-action-group">
            <button type="button" class="btn btn--ghost" data-action="prev" ${readingIdx === 0 ? 'disabled' : ''}>${ICONS.arrowLeft} ${escapeHtml(t('english.prev'))}</button>
          </div>
          <div class="card-action-group">
            <button type="button" class="btn btn--primary" data-action="next">${escapeHtml(t('english.next'))} ${ICONS.arrowRight}</button>
          </div>
        </div>
      </article>`;
  };

  const renderWriting = (): string => {
    const item = writingDeck[writingIdx];
    if (!item) return '';
    const revealed = writingResult !== null;
    return `
      <article class="question-card english-card">
        <div class="question-card-top">
          <span class="badge badge--number">${escapeHtml(t('english.writingBadge'))}</span>
          ${counter(writingIdx, writingDeck.length)}
        </div>
        <p class="field-hint">${escapeHtml(t('english.writingHelp'))}</p>
        <div class="card-action-group">
          ${
            isSpeechSynthesisSupported()
              ? `<button type="button" class="btn btn--primary btn--lg" data-action="dictate">${ICONS.volume} ${escapeHtml(t('english.playSentence'))}</button>
                 <button type="button" class="btn btn--secondary" data-action="dictate-slow">${escapeHtml(t('english.playSlow'))}</button>`
              : `<p class="notice" style="margin:0;">${escapeHtml(t('english.noVoice'))}</p>`
          }
        </div>
        <form class="typed-answer-form" data-form="writing" autocomplete="off">
          <label class="visually-hidden" for="writing-input">${escapeHtml(t('english.writeHere'))}</label>
          <input id="writing-input" class="text-input" type="text" lang="en" spellcheck="false" autocapitalize="sentences"
            placeholder="${escapeHtml(t('english.writeHere'))}" value="${escapeHtml(typed)}" />
          <button type="submit" class="btn btn--primary">${ICONS.check} ${escapeHtml(t('english.check'))}</button>
        </form>
        ${
          revealed && writingResult
            ? `
          <div class="answer-panel">
            <p class="answer-panel-title">${escapeHtml(writingResult.exact ? t('english.writingPass') : t('english.writingRetry'))}</p>
            <p class="english-sentence english-sentence--small" lang="en">${escapeHtml(item.text)}</p>
            ${
              writingResult.exact
                ? ''
                : `<p class="word-marks" aria-label="${escapeHtml(t('english.wordCheck'))}">${writingResult.marks
                    .map((m) => `<span class="word-mark ${m.ok ? 'is-ok' : 'is-wrong'}">${escapeHtml(m.word)}</span>`)
                    .join(' ')}</p>`
            }
            ${translationBlock(item.es)}
          </div>`
            : `<button type="button" class="btn btn--ghost" data-action="show-sentence">${escapeHtml(t('english.showSentence'))}</button>`
        }
        <div class="card-actions">
          <div class="card-action-group">
            <button type="button" class="btn btn--ghost" data-action="prev" ${writingIdx === 0 ? 'disabled' : ''}>${ICONS.arrowLeft} ${escapeHtml(t('english.prev'))}</button>
          </div>
          <div class="card-action-group">
            <button type="button" class="btn btn--primary" data-action="next">${escapeHtml(t('english.next'))} ${ICONS.arrowRight}</button>
          </div>
        </div>
      </article>`;
  };

  const renderInterview = (): string => {
    const section = N400_INTERVIEW[sectionIdx];
    const item = section?.items[itemIdx];
    if (!section || !item) return '';
    const isEs = getLang() === 'es';
    return `
      <div class="pill-bar" role="group" aria-label="${escapeHtml(t('english.sections'))}" style="margin-block-end:1rem;">
        ${N400_INTERVIEW.map(
          (s, i) =>
            `<button type="button" class="pill-btn" data-section="${i}" aria-pressed="${i === sectionIdx}">${escapeHtml(isEs ? s.titleEs : s.title)}</button>`,
        ).join('')}
      </div>
      <article class="question-card english-card">
        <div class="question-card-top">
          <span class="badge badge--number">N-400</span>
          ${counter(itemIdx, section.items.length)}
        </div>
        <h2 class="question-stem" lang="en">${escapeHtml(item.question)}</h2>
        <div class="card-action-group">
          ${
            isSpeechSynthesisSupported()
              ? `<button type="button" class="btn btn--secondary" data-action="hear-question">${ICONS.volume} ${escapeHtml(t('english.hearOfficer'))}</button>`
              : ''
          }
          <button type="button" class="btn ${showHelp ? 'btn--secondary' : 'btn--primary'}" data-action="toggle-help" aria-expanded="${showHelp}">
            ${escapeHtml(showHelp ? t('english.hideHelp') : t('english.showHelp'))}
          </button>
        </div>
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
        <div class="card-actions">
          <div class="card-action-group">
            <button type="button" class="btn btn--ghost" data-action="prev" ${sectionIdx === 0 && itemIdx === 0 ? 'disabled' : ''}>${ICONS.arrowLeft} ${escapeHtml(t('english.prev'))}</button>
          </div>
          <div class="card-action-group">
            <button type="button" class="btn btn--primary" data-action="next">${escapeHtml(t('english.next'))} ${ICONS.arrowRight}</button>
          </div>
        </div>
      </article>
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
                  `<button type="button" class="vocab-chip" data-word="${escapeHtml(w)}" lang="en">${escapeHtml(w)}</button>`,
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
            : renderVocab();

    container.innerHTML = `
      <div class="${tab === 'vocab' ? '' : 'study-stage-wrapper'}">
        <div class="view-header">
          <div>
            <h1 id="main-heading" tabindex="-1">${escapeHtml(t('english.title'))}</h1>
            <p class="view-lead">${escapeHtml(t('english.lead'))}</p>
          </div>
        </div>
        <div class="pill-bar" role="group" aria-label="${escapeHtml(t('english.tabs'))}" style="margin-block-end:1.15rem;">
          ${tabButton('reading', t('english.tabReading'))}
          ${tabButton('writing', t('english.tabWriting'))}
          ${tabButton('interview', t('english.tabInterview'))}
          ${tabButton('vocab', t('english.tabVocab'))}
        </div>
        ${body}
      </div>`;
  };

  const move = (delta: 1 | -1) => {
    resetAttempt();
    if (tab === 'reading') {
      readingIdx += delta;
      if (readingIdx >= readingDeck.length) {
        readingDeck = shuffleArray(READING_SENTENCES);
        readingIdx = 0;
      }
      readingIdx = Math.max(0, readingIdx);
    } else if (tab === 'writing') {
      writingIdx += delta;
      if (writingIdx >= writingDeck.length) {
        writingDeck = shuffleArray(WRITING_SENTENCES);
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
    container.querySelector<HTMLElement>('.english-card')?.focus?.();
  };

  const startReadAloud = () => {
    const item = readingDeck[readingIdx];
    if (!item) return;
    if (isListening) {
      listening?.stop();
      return;
    }
    stopSpeaking();
    micError = '';
    transcript = '';
    readingResult = null;
    listening = startListening({
      onStart: () => {
        isListening = true;
        render();
      },
      onInterim: (text) => {
        transcript = text;
        const box = container.querySelector('.transcript-box');
        if (box) box.lastChild!.textContent = text;
      },
      onFinal: (text) => {
        transcript = text;
        readingResult = readingScore(item.text, text);
        announce(readingResult >= 0.8 ? t('english.readingPass') : t('english.readingRetry', { pct: Math.round(readingResult * 100) }));
      },
      onError: (message) => {
        micError = message || t('english.micError');
      },
      onEnd: () => {
        isListening = false;
        listening = null;
        render();
      },
    });
    if (!listening) {
      micError = t('english.micError');
      render();
    }
  };

  const onClick = (event: Event) => {
    const target = event.target as HTMLElement;
    const tabBtn = target.closest<HTMLButtonElement>('[data-tab]');
    if (tabBtn) {
      tab = tabBtn.dataset.tab as EnglishTab;
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
    const chip = target.closest<HTMLButtonElement>('[data-word]');
    if (chip) {
      say(chip.dataset.word ?? '');
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
      case 'hear':
        if (reading) say(reading.text);
        break;
      case 'read-aloud':
        startReadAloud();
        break;
      case 'dictate':
        if (writing) say(writing.text);
        break;
      case 'dictate-slow':
        if (writing) say(writing.text, true);
        break;
      case 'show-sentence':
        if (writing) {
          writingResult = compareWriting(writing.text, typed);
          render();
        }
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
    const writing = writingDeck[writingIdx];
    const input = form.querySelector<HTMLInputElement>('#writing-input');
    if (!writing || !input) return;
    typed = input.value;
    writingResult = compareWriting(writing.text, typed);
    announce(writingResult.exact ? t('english.writingPass') : t('english.writingRetry'));
    render();
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
    stopMic();
    stopSpeaking();
    container.removeEventListener('click', onClick);
    container.removeEventListener('submit', onSubmit);
    container.removeEventListener('input', onInput);
  };
}
