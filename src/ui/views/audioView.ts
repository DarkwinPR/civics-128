import { buildPath, easiestAnswers, findNextStep, joinAnswers, sectionTitle } from '../../domain/learningPath';
import {
  CIVICS_QUESTIONS,
  displayNumber,
  findQuestionById,
  getTestVersion,
  isDynamicUnconfigured,
} from '../../domain/questions';
import type { CivicsQuestion, PersistedState } from '../../domain/types';
import { getLang, t } from '../../i18n';
import { isSpeechSynthesisSupported, speakText, stopSpeaking } from '../../services/speech';
import { getMostMissed, getPathProgress } from '../../services/storage';
import { escapeHtml, ICONS } from '../dom';

/**
 * Hands-free listening: the app reads a question, waits, then reads the
 * easiest answer, and moves on. Meant for driving, cooking or walking.
 */
export interface AudioCallbacks {
  getState: () => PersistedState;
}

type Playlist = 'unit' | 'missed' | '6520' | 'all';
const PAUSES = [3, 5, 8];

export function mountAudioView(container: HTMLElement, callbacks: AudioCallbacks): () => void {
  let playlist: Playlist = 'unit';
  let pauseSec = 5;
  let playing = false;
  let index = 0;
  let phase: 'question' | 'pause' | 'answer' = 'question';
  let timer: number | undefined;
  let token = 0;
  let items: CivicsQuestion[] = [];
  let disposed = false;

  const officials = () => callbacks.getState().settings.officials;

  const buildList = (): CivicsQuestion[] => {
    const usable = (q: CivicsQuestion | undefined): q is CivicsQuestion => Boolean(q && !isDynamicUnconfigured(q, officials()));
    if (playlist === 'missed') {
      return getMostMissed(callbacks.getState(), CIVICS_QUESTIONS.map((q) => q.id), 20)
        .map((m) => findQuestionById(m.id))
        .filter(usable);
    }
    if (playlist === '6520') return CIVICS_QUESTIONS.filter((q) => q.is6520).filter(usable);
    if (playlist === 'unit') {
      const units = buildPath(CIVICS_QUESTIONS, getTestVersion());
      const next = findNextStep(units, getPathProgress(callbacks.getState()));
      const unit = units[next?.unitIndex ?? 0];
      return (unit?.questionIds ?? []).map((id) => findQuestionById(id)).filter(usable);
    }
    return CIVICS_QUESTIONS.filter(usable);
  };

  const currentUnitName = () => {
    const units = buildPath(CIVICS_QUESTIONS, getTestVersion());
    const next = findNextStep(units, getPathProgress(callbacks.getState()));
    const unit = units[next?.unitIndex ?? 0];
    return unit ? sectionTitle(unit.section, getLang()) : '';
  };

  const speak = (text: string, onEnd: () => void) => {
    const s = callbacks.getState().settings;
    const my = token;
    speakText(text, {
      rate: s.speechRate,
      voiceURI: s.voiceURI,
      onEnd: () => {
        if (my === token) onEnd();
      },
      onError: () => {
        if (my === token) onEnd();
      },
    });
  };

  const clearTimer = () => {
    window.clearTimeout(timer);
    timer = undefined;
  };

  const updateMediaSession = (q: CivicsQuestion | undefined) => {
    if (!('mediaSession' in navigator) || !q) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `${displayNumber(q)}. ${q.question}`,
        artist: 'Civics 128',
        album: t('audio.title'),
      });
    } catch {
      // MediaMetadata is not available everywhere.
    }
  };

  const playStep = () => {
    const q = items[index];
    if (!playing || !q) return;
    updateMediaSession(q);
    render();
    if (phase === 'question') {
      speak(q.question, () => {
        phase = 'pause';
        render();
        timer = window.setTimeout(() => {
          phase = 'answer';
          playStep();
        }, pauseSec * 1000);
      });
    } else if (phase === 'answer') {
      speak(joinAnswers(easiestAnswers(q, officials())), () => {
        timer = window.setTimeout(() => goTo(index + 1), 1500);
      });
    }
  };

  const goTo = (i: number) => {
    token += 1;
    clearTimer();
    stopSpeaking();
    if (items.length === 0) return;
    index = (i + items.length) % items.length;
    phase = 'question';
    if (playing) playStep();
    else render();
  };

  const play = () => {
    if (!items.length) items = buildList();
    if (!items.length) return;
    playing = true;
    token += 1;
    phase = 'question';
    playStep();
  };

  const pause = () => {
    playing = false;
    token += 1;
    clearTimer();
    stopSpeaking();
    render();
  };

  const setupMediaHandlers = () => {
    if (!('mediaSession' in navigator)) return;
    const set = (action: MediaSessionAction, fn: (() => void) | null) => {
      try {
        navigator.mediaSession.setActionHandler(action, fn);
      } catch {
        // Unsupported action.
      }
    };
    set('play', play);
    set('pause', pause);
    set('nexttrack', () => goTo(index + 1));
    set('previoustrack', () => goTo(index - 1));
    return () => {
      (['play', 'pause', 'nexttrack', 'previoustrack'] as MediaSessionAction[]).forEach((a) => set(a, null));
    };
  };
  const removeMediaHandlers = setupMediaHandlers();

  const option = (id: Playlist, label: string) =>
    `<button type="button" class="pill-btn" data-playlist="${id}" aria-pressed="${playlist === id}">${escapeHtml(label)}</button>`;

  const render = () => {
    if (disposed) return;
    const q = items[index];
    const supported = isSpeechSynthesisSupported();
    container.innerHTML = `
      <div class="study-stage-wrapper">
        <div class="view-header">
          <div>
            <h1 id="main-heading" tabindex="-1">🎧 ${escapeHtml(t('audio.title'))}</h1>
            <p class="view-lead">${escapeHtml(t('audio.lead'))}</p>
          </div>
        </div>
        ${
          !supported
            ? `<p class="notice notice--error">${escapeHtml(t('audio.unsupported'))}</p>`
            : `
        <div class="pill-bar" role="group" aria-label="${escapeHtml(t('audio.listLabel'))}" style="margin-block-end:0.75rem;">
          ${option('unit', t('audio.listUnit', { unit: currentUnitName() }))}
          ${option('missed', t('audio.listMissed'))}
          ${option('6520', t('audio.list6520'))}
          ${option('all', t('audio.listAll'))}
        </div>
        <div class="pill-bar" role="group" aria-label="${escapeHtml(t('audio.pauseLabel'))}" style="margin-block-end:1.15rem;">
          <span class="field-hint" style="align-self:center;">${escapeHtml(t('audio.pauseLabel'))}</span>
          ${PAUSES.map((p) => `<button type="button" class="pill-btn" data-pause="${p}" aria-pressed="${pauseSec === p}">${p} s</button>`).join('')}
        </div>
        <article class="question-card audio-card">
          ${
            q
              ? `<p class="question-section-label">${escapeHtml(t('audio.position', { n: index + 1, total: items.length }))}</p>
                 <h2 class="question-stem" lang="en"><span class="badge badge--number">${displayNumber(q)}</span> ${escapeHtml(q.question)}</h2>
                 <p class="audio-phase">${escapeHtml(playing ? t(`audio.phase.${phase}`) : t('audio.paused'))}</p>
                 ${phase === 'answer' ? `<p class="easiest-answer"><span class="easiest-label">💡 ${escapeHtml(t('path.easiest'))}</span> <span lang="en">${escapeHtml(joinAnswers(easiestAnswers(q, callbacks.getState().settings.officials)))}</span></p>` : ''}`
              : `<p>${escapeHtml(items.length === 0 && playlist === 'missed' ? t('audio.emptyMissed') : t('audio.ready'))}</p>`
          }
          <div class="audio-controls">
            <button type="button" class="btn btn--secondary" data-audio="prev" aria-label="${escapeHtml(t('audio.prev'))}" ${q ? '' : 'disabled'}>${ICONS.arrowLeft}</button>
            <button type="button" class="btn btn--primary btn--lg audio-play" data-audio="${playing ? 'pause' : 'play'}">
              ${playing ? `${ICONS.stop} ${escapeHtml(t('audio.pause'))}` : `${ICONS.play} ${escapeHtml(t('audio.play'))}`}
            </button>
            <button type="button" class="btn btn--secondary" data-audio="next" aria-label="${escapeHtml(t('audio.next'))}" ${q ? '' : 'disabled'}>${ICONS.arrowRight}</button>
          </div>
        </article>
        <p class="field-hint" style="margin-block-start:1rem;">${escapeHtml(t('audio.tip'))}</p>`
        }
      </div>`;
  };

  const onClick = (event: Event) => {
    const target = event.target as HTMLElement;
    const pl = target.closest<HTMLElement>('[data-playlist]');
    if (pl) {
      playlist = pl.dataset.playlist as Playlist;
      const wasPlaying = playing;
      pause();
      items = buildList();
      index = 0;
      if (wasPlaying) play();
      else render();
      return;
    }
    const ps = target.closest<HTMLElement>('[data-pause]');
    if (ps) {
      pauseSec = Number(ps.dataset.pause);
      render();
      return;
    }
    const action = target.closest<HTMLElement>('[data-audio]')?.dataset.audio;
    if (action === 'play') play();
    else if (action === 'pause') pause();
    else if (action === 'next') goTo(index + 1);
    else if (action === 'prev') goTo(index - 1);
  };

  items = buildList();
  container.addEventListener('click', onClick);
  render();

  return () => {
    disposed = true;
    pause();
    removeMediaHandlers?.();
    container.removeEventListener('click', onClick);
  };
}
