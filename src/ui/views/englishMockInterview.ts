import { checkReading, compareWriting, type WordMark } from '../../domain/englishCheck';
import { shuffleArray } from '../../domain/examEngine';
import {
  N400_INTERVIEW,
  READING_SENTENCES,
  WRITING_SENTENCES,
  type InterviewItem,
  type PracticeSentence,
} from '../../domain/englishTest';
import type { AppView, PersistedState } from '../../domain/types';
import { t } from '../../i18n';
import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  speakText,
  startListening,
  stopSpeaking,
  type ListeningSession,
} from '../../services/speech';
import type { EnglishPart } from '../../services/storage';
import { announce } from '../announcer';
import { escapeHtml, ICONS } from '../dom';
import { mascotSvg } from '../mascot';

/**
 * A full run of the English part of the interview, with the official rules:
 * a few N-400 questions, then up to 3 sentences to read (one correct is enough)
 * and up to 3 sentences to write (one correct is enough).
 */
export interface MockInterviewCallbacks {
  getState: () => PersistedState;
  onRecordAttempt: (part: EnglishPart, id: string, passed: boolean) => void;
  onNavigate?: (view: AppView) => void;
}

type Stage = 'intro' | 'n400' | 'reading' | 'writing' | 'done';

const MAX_TRIES = 3;
const READING_PASS = 0.8;

interface Run {
  n400: InterviewItem[];
  reading: PracticeSentence[];
  writing: PracticeSentence[];
}

/** Oath first, then questions about the application and one yes/no question. */
export function buildMockRun(): Run {
  const [start, application, eligibility] = N400_INTERVIEW;
  const oath = start?.items[0];
  const fromApplication = shuffleArray(application?.items ?? []).slice(0, 3);
  const fromEligibility = shuffleArray(eligibility?.items ?? []).slice(0, 1);
  return {
    n400: [...(oath ? [oath] : []), ...fromApplication, ...fromEligibility],
    reading: shuffleArray(READING_SENTENCES).slice(0, MAX_TRIES),
    writing: shuffleArray(WRITING_SENTENCES).slice(0, MAX_TRIES),
  };
}

export function mountEnglishMockInterview(
  container: HTMLElement,
  callbacks: MockInterviewCallbacks,
): () => void {
  let run = buildMockRun();
  let stage: Stage = 'intro';
  let idx = 0;
  let n400Answered = 0;
  let readingPassed: boolean | null = null;
  let writingPassed: boolean | null = null;
  let readingTries = 0;
  let writingTries = 0;

  // Per-step feedback
  let heard = '';
  let readingMarks: WordMark[] | null = null;
  let stepPassed: boolean | null = null;
  let typed = '';
  let writingMarks: WordMark[] | null = null;
  let micError = '';
  let listening: ListeningSession | null = null;
  let isListening = false;

  const canSpeak = isSpeechSynthesisSupported();
  const canListen = isSpeechRecognitionSupported();

  const say = (text: string, slow = false) => {
    const s = callbacks.getState().settings;
    speakText(text, { rate: slow ? Math.max(0.6, s.speechRate - 0.25) : s.speechRate, voiceURI: s.voiceURI });
  };

  const stopMic = () => {
    listening?.abort();
    listening = null;
    isListening = false;
  };

  const resetStep = () => {
    heard = '';
    readingMarks = null;
    stepPassed = null;
    typed = '';
    writingMarks = null;
    micError = '';
    stopMic();
    stopSpeaking();
  };

  const stepsTotal = run.n400.length + 2;
  const stepNumber = () =>
    stage === 'n400' ? idx + 1 : stage === 'reading' ? run.n400.length + 1 : run.n400.length + 2;

  const progressBar = () =>
    stage === 'intro' || stage === 'done'
      ? ''
      : `<div class="mock-progress">
          <span>${escapeHtml(t('mock.step', { n: stepNumber(), total: stepsTotal }))}</span>
          <progress class="progress-track" max="${stepsTotal}" value="${stepNumber() - 1}"></progress>
        </div>`;

  const marksHtml = (marks: WordMark[]) =>
    `<p class="word-marks">${marks
      .map((m) => `<span class="word-mark ${m.ok ? 'is-ok' : m.close ? 'is-close' : 'is-wrong'}" lang="en">${escapeHtml(m.display)}</span>`)
      .join(' ')}</p>`;

  const micButton = (action: string, label: string) =>
    canListen
      ? `<button type="button" class="btn btn--primary mic-btn ${isListening ? 'is-listening' : ''}" data-mock="${action}" aria-pressed="${isListening}">
          ${ICONS.mic} ${escapeHtml(isListening ? t('english.stopListening') : label)}
        </button>`
      : '';

  const renderIntro = () => `
    <div class="mock-intro">
      <p class="mock-officer" aria-hidden="true">🧑‍💼</p>
      <h2>${escapeHtml(t('mock.introTitle'))}</h2>
      <p>${escapeHtml(t('mock.introBody'))}</p>
      <ul class="mock-steps">
        <li>🗣️ ${escapeHtml(t('mock.introN400', { n: run.n400.length }))}</li>
        <li>📖 ${escapeHtml(t('mock.introReading'))}</li>
        <li>✍️ ${escapeHtml(t('mock.introWriting'))}</li>
      </ul>
      <p class="field-hint">${escapeHtml(t('mock.introCivics'))}</p>
      <button type="button" class="btn btn--primary btn--lg" data-mock="start">${ICONS.play} ${escapeHtml(t('mock.start'))}</button>
    </div>`;

  const renderN400 = () => {
    const item = run.n400[idx];
    if (!item) return '';
    return `
      <p class="mock-officer-line"><span aria-hidden="true">🧑‍💼</span> ${escapeHtml(t('mock.officerSays'))}</p>
      <h2 class="question-stem" lang="en">${escapeHtml(item.question)}</h2>
      <div class="card-action-group">
        ${canSpeak ? `<button type="button" class="btn btn--secondary" data-mock="hear-question">${ICONS.volume} ${escapeHtml(t('english.hearOfficer'))}</button>` : ''}
        ${micButton('answer', t('english.answerAloud'))}
      </div>
      ${micError ? `<p class="notice notice--error" style="margin:0;">${escapeHtml(micError)}</p>` : ''}
      ${heard ? `<div class="english-feedback is-pass"><p class="english-feedback-title">${escapeHtml(t('english.answerHeard'))}</p><p class="english-heard" lang="en">“${escapeHtml(heard)}”</p></div>` : ''}
      <details class="mock-help">
        <summary>${escapeHtml(t('english.showHelp'))}</summary>
        <p class="translation-box"><span class="translation-label">${escapeHtml(t('english.meaning'))}</span>${escapeHtml(item.es)}</p>
        <p lang="en"><strong>${escapeHtml(t('english.sampleAnswer'))}:</strong> ${escapeHtml(item.sampleAnswer)}</p>
      </details>
      <div class="card-actions">
        <span></span>
        <button type="button" class="btn btn--primary" data-mock="n400-next">${escapeHtml(heard ? t('english.next') : t('mock.answeredOutLoud'))} ${ICONS.arrowRight}</button>
      </div>`;
  };

  const renderReading = () => {
    const item = run.reading[readingTries];
    if (!item) return '';
    return `
      <p class="mock-officer-line"><span aria-hidden="true">🧑‍💼</span> ${escapeHtml(readingTries === 0 ? t('mock.readingAsk') : t('mock.readingAnother'))}</p>
      <p class="field-hint">${escapeHtml(t('mock.tryOf', { n: readingTries + 1, total: MAX_TRIES }))}</p>
      <p class="english-sentence" lang="en">${escapeHtml(item.text)}</p>
      <div class="card-action-group">
        ${
          stepPassed === null
            ? canListen
              ? micButton('read', t('english.readAloud'))
              : `<button type="button" class="btn btn--primary" data-mock="self-read-ok">${ICONS.check} ${escapeHtml(t('mock.selfReadOk'))}</button>
                 <button type="button" class="btn btn--secondary" data-mock="self-read-bad">${escapeHtml(t('mock.selfReadBad'))}</button>`
            : ''
        }
      </div>
      ${!canListen && stepPassed === null ? `<p class="field-hint">${escapeHtml(t('mock.selfReadHelp'))}</p>` : ''}
      ${micError ? `<p class="notice notice--error" style="margin:0;">${escapeHtml(micError)}</p>` : ''}
      ${isListening && heard ? `<div class="transcript-box"><span class="transcript-label">${escapeHtml(t('english.weHeard'))}</span>${escapeHtml(heard)}</div>` : ''}
      ${
        stepPassed !== null
          ? `<div class="english-feedback ${stepPassed ? 'is-pass' : 'is-retry'}">
              <p class="english-feedback-title">${escapeHtml(stepPassed ? `🎉 ${t('mock.readingPass')}` : `💪 ${t('mock.readingRetry')}`)}</p>
              ${readingMarks ? marksHtml(readingMarks) : ''}
            </div>
            <div class="card-actions"><span></span>
              <button type="button" class="btn btn--primary" data-mock="reading-next">${escapeHtml(t('english.next'))} ${ICONS.arrowRight}</button>
            </div>`
          : ''
      }`;
  };

  const renderWriting = () => {
    const item = run.writing[writingTries];
    if (!item) return '';
    return `
      <p class="mock-officer-line"><span aria-hidden="true">🧑‍💼</span> ${escapeHtml(writingTries === 0 ? t('mock.writingAsk') : t('mock.writingAnother'))}</p>
      <p class="field-hint">${escapeHtml(t('mock.tryOf', { n: writingTries + 1, total: MAX_TRIES }))}</p>
      ${
        canSpeak
          ? `<div class="card-action-group">
              <button type="button" class="btn btn--secondary" data-mock="dictate">${ICONS.volume} ${escapeHtml(t('english.playSentence'))}</button>
              <button type="button" class="btn btn--ghost" data-mock="dictate-slow">${escapeHtml(t('english.playSlow'))}</button>
            </div>`
          : `<p class="english-sentence english-sentence--small" lang="en">${escapeHtml(item.text)}</p>`
      }
      <form class="typed-answer-form" data-form="mock-writing" autocomplete="off">
        <label class="visually-hidden" for="mock-writing-input">${escapeHtml(t('english.writeHere'))}</label>
        <input id="mock-writing-input" class="text-input" type="text" lang="en" spellcheck="false" autocapitalize="sentences"
          placeholder="${escapeHtml(t('english.writeHere'))}" value="${escapeHtml(typed)}" ${stepPassed !== null ? 'disabled' : ''} />
        ${stepPassed === null ? `<button type="submit" class="btn btn--primary">${ICONS.check} ${escapeHtml(t('mock.hand'))}</button>` : ''}
      </form>
      ${
        stepPassed !== null
          ? `<div class="english-feedback ${stepPassed ? 'is-pass' : 'is-retry'}">
              <p class="english-feedback-title">${escapeHtml(stepPassed ? `🎉 ${t('mock.writingPass')}` : `💪 ${t('mock.writingRetry')}`)}</p>
              <p class="english-sentence english-sentence--small" lang="en">${escapeHtml(item.text)}</p>
              ${writingMarks && !stepPassed ? marksHtml(writingMarks) : ''}
            </div>
            <div class="card-actions"><span></span>
              <button type="button" class="btn btn--primary" data-mock="writing-next">${escapeHtml(t('english.next'))} ${ICONS.arrowRight}</button>
            </div>`
          : ''
      }`;
  };

  const resultRow = (label: string, passed: boolean | null, detail: string) => `
    <li class="mock-result ${passed ? 'is-pass' : 'is-retry'}">
      <span class="mock-result-icon" aria-hidden="true">${passed ? '✅' : '🔁'}</span>
      <span><strong>${escapeHtml(label)}</strong><br /><span class="field-hint">${escapeHtml(detail)}</span></span>
    </li>`;

  const renderDone = () => {
    const allGood = Boolean(readingPassed && writingPassed);
    return `
      <div class="mock-intro">
        ${mascotSvg(allGood ? 'flag' : 'stand', 110)}
        <h2>${escapeHtml(allGood ? t('mock.doneGreat') : t('mock.doneKeepGoing'))}</h2>
        <ul class="mock-results">
          ${resultRow(t('mock.resultN400'), true, t('mock.resultN400Detail', { n: n400Answered, total: run.n400.length }))}
          ${resultRow(t('english.tabReading'), readingPassed, readingPassed ? t('mock.resultPassTries', { n: readingTries + 1 }) : t('mock.resultPracticeMore'))}
          ${resultRow(t('english.tabWriting'), writingPassed, writingPassed ? t('mock.resultPassTries', { n: writingTries + 1 }) : t('mock.resultPracticeMore'))}
        </ul>
        <p>${escapeHtml(allGood ? t('mock.doneGreatBody') : t('mock.doneKeepGoingBody'))}</p>
        <div class="card-action-group" style="justify-content:center;">
          <button type="button" class="btn btn--primary" data-mock="again">${ICONS.rotate} ${escapeHtml(t('mock.again'))}</button>
          ${callbacks.onNavigate ? `<button type="button" class="btn btn--secondary" data-mock="civics">${escapeHtml(t('mock.toCivics'))}</button>` : ''}
        </div>
      </div>`;
  };

  const render = () => {
    const body =
      stage === 'intro'
        ? renderIntro()
        : stage === 'n400'
          ? renderN400()
          : stage === 'reading'
            ? renderReading()
            : stage === 'writing'
              ? renderWriting()
              : renderDone();
    container.innerHTML = `
      <article class="question-card english-card mock-card" tabindex="-1">
        ${progressBar()}
        ${body}
      </article>`;
  };

  const focusCard = () => container.querySelector<HTMLElement>('.mock-card')?.focus({ preventScroll: true });

  const goStage = (next: Stage) => {
    stage = next;
    idx = 0;
    resetStep();
    render();
    focusCard();
    if (next === 'n400') {
      const q = run.n400[0];
      if (q && canSpeak) say(q.question);
    } else if (next === 'writing') {
      const w = run.writing[0];
      if (w && canSpeak) window.setTimeout(() => say(w.text), 300);
    } else if (next === 'done') {
      announce(readingPassed && writingPassed ? t('mock.doneGreat') : t('mock.doneKeepGoing'));
    }
  };

  const listen = (onDone: (text: string) => void) => {
    if (isListening) {
      listening?.stop();
      return;
    }
    micError = '';
    heard = '';
    let finalText = '';
    listening = startListening({
      onStart: () => {
        isListening = true;
        render();
      },
      onInterim: (text) => {
        heard = text;
        const box = container.querySelector('.transcript-box');
        if (box?.lastChild) box.lastChild.textContent = text;
        else render();
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
        if (!micError) onDone((finalText || heard).trim());
        render();
      },
    });
    if (!listening) {
      micError = t('english.micError');
      render();
    }
  };

  const finishReadingTry = (passed: boolean) => {
    const item = run.reading[readingTries];
    if (item) callbacks.onRecordAttempt('reading', item.id, passed);
    stepPassed = passed;
    if (passed) readingPassed = true;
    announce(passed ? t('mock.readingPass') : t('mock.readingRetry'));
    render();
  };

  const onClick = (event: Event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-mock]')?.dataset.mock;
    if (!action) return;
    switch (action) {
      case 'start':
        run = buildMockRun();
        n400Answered = 0;
        readingPassed = null;
        writingPassed = null;
        readingTries = 0;
        writingTries = 0;
        goStage('n400');
        break;
      case 'hear-question': {
        const q = run.n400[idx];
        if (q) say(q.question);
        break;
      }
      case 'answer':
        listen((text) => {
          heard = text;
          const q = run.n400[idx];
          if (text && q) callbacks.onRecordAttempt('interview', q.id, true);
          if (!text) micError = t('english.answerNotHeard');
        });
        break;
      case 'n400-next': {
        n400Answered += 1;
        idx += 1;
        resetStep();
        if (idx >= run.n400.length) {
          goStage('reading');
        } else {
          render();
          focusCard();
          const q = run.n400[idx];
          if (q && canSpeak) say(q.question);
        }
        break;
      }
      case 'read': {
        const item = run.reading[readingTries];
        if (!item) return;
        listen((text) => {
          heard = text;
          if (!text) {
            micError = t('english.nothingHeard');
            return;
          }
          const result = checkReading(item.text, text);
          readingMarks = result.marks;
          finishReadingTry(result.score >= READING_PASS);
        });
        break;
      }
      case 'self-read-ok':
        finishReadingTry(true);
        break;
      case 'self-read-bad':
        finishReadingTry(false);
        break;
      case 'reading-next':
        if (readingPassed || readingTries + 1 >= MAX_TRIES) {
          if (!readingPassed) readingPassed = false;
          goStage('writing');
        } else {
          readingTries += 1;
          resetStep();
          render();
          focusCard();
        }
        break;
      case 'dictate': {
        const w = run.writing[writingTries];
        if (w) say(w.text);
        break;
      }
      case 'dictate-slow': {
        const w = run.writing[writingTries];
        if (w) say(w.text, true);
        break;
      }
      case 'writing-next':
        if (writingPassed || writingTries + 1 >= MAX_TRIES) {
          if (!writingPassed) writingPassed = false;
          goStage('done');
        } else {
          writingTries += 1;
          resetStep();
          render();
          focusCard();
          const w = run.writing[writingTries];
          if (w && canSpeak) window.setTimeout(() => say(w.text), 300);
        }
        break;
      case 'again':
        goStage('intro');
        break;
      case 'civics':
        callbacks.onNavigate?.('exam');
        break;
      default:
        break;
    }
  };

  const onSubmit = (event: Event) => {
    const form = event.target as HTMLFormElement;
    if (form.dataset.form !== 'mock-writing') return;
    event.preventDefault();
    const item = run.writing[writingTries];
    const input = form.querySelector<HTMLInputElement>('#mock-writing-input');
    if (!item || !input || !input.value.trim()) return;
    typed = input.value;
    const result = compareWriting(item.text, typed);
    const passed = result.exact || result.onlyTypos;
    writingMarks = result.marks;
    stepPassed = passed;
    if (passed) writingPassed = true;
    callbacks.onRecordAttempt('writing', item.id, passed);
    announce(passed ? t('mock.writingPass') : t('mock.writingRetry'));
    render();
  };

  container.addEventListener('click', onClick);
  container.addEventListener('submit', onSubmit);
  render();

  return () => {
    stopMic();
    stopSpeaking();
    container.removeEventListener('click', onClick);
    container.removeEventListener('submit', onSubmit);
  };
}
