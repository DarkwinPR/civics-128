import { DEFAULT_OFFICIALS } from '../../domain/questions';
import { findJurisdiction, JURISDICTIONS, noSenatorsAnswer } from '../../domain/states';
import type { PersistedState, StudySettings, TestVersion } from '../../domain/types';
import { getLang, setLang, t, type Lang } from '../../i18n';
import { districtLabel, loadCongressIndex, type StateDelegation } from '../../services/congressLookup';
import { closeDialogSmoothly, enhanceModalDialog } from '../../services/dialogHelper';
import { installMode, promptInstall } from '../../services/install';
import { announce } from '../announcer';
import { escapeHtml } from '../dom';
import { mascotSvg } from '../mascot';
import { bindReminderPicker, renderReminderPicker } from './reminderPicker';

/**
 * First-run welcome: language and test version, your state, your interview
 * date, then a friendly "ready" screen with a daily reminder and install tips.
 * Every step can be skipped; everything can be changed later in Settings.
 */
const DONE_KEY = 'civics128:welcomeDone:v1';

export function isWelcomeDone(): boolean {
  try {
    return localStorage.getItem(DONE_KEY) === '1';
  } catch {
    return true;
  }
}

function markWelcomeDone(): void {
  try {
    localStorage.setItem(DONE_KEY, '1');
  } catch {
    // ignore
  }
}

/** Show the welcome only to people who have not studied yet. */
export function shouldShowWelcome(state: PersistedState): boolean {
  if (isWelcomeDone()) return false;
  const fresh =
    Object.keys(state.progress).length === 0 && state.examHistory.length === 0 && !state.settings.homeState;
  if (!fresh) markWelcomeDone();
  return fresh;
}

export interface WelcomeHandlers {
  getState: () => PersistedState;
  onUpdateSettings: (patch: Partial<StudySettings>) => void;
  onStartPath: () => void;
}

const STEPS = 4;

export function openWelcome(handlers: WelcomeHandlers): void {
  const dialog = document.createElement('dialog');
  dialog.className = 'modal-dialog welcome-dialog';
  dialog.setAttribute('aria-labelledby', 'welcome-title');
  document.body.append(dialog);
  enhanceModalDialog(dialog);

  let step = 0;
  let version: TestVersion = handlers.getState().settings.testVersion;
  let stateCode = handlers.getState().settings.homeState;
  let district = handlers.getState().settings.homeDistrict;
  let date = handlers.getState().settings.interviewDate;
  let delegation: StateDelegation | null = null;
  let lookup: 'idle' | 'loading' | 'ok' | 'offline' = 'idle';
  let token = 0;

  const close = () => {
    markWelcomeDone();
    void closeDialogSmoothly(dialog).then(() => dialog.remove());
  };

  const dots = () =>
    `<div class="welcome-dots" aria-hidden="true">${Array.from({ length: STEPS }, (_, i) => `<span class="${i === step ? 'is-on' : i < step ? 'is-done' : ''}"></span>`).join('')}</div>`;

  const nav = (nextLabel: string, canBack = true) => `
    <div class="welcome-nav">
      ${canBack ? `<button type="button" class="btn btn--ghost" data-w="back">${escapeHtml(t('welcome.back'))}</button>` : '<span></span>'}
      <button type="button" class="btn btn--primary btn--lg" data-w="next">${escapeHtml(nextLabel)}</button>
    </div>`;

  const langBtn = (l: Lang, label: string) =>
    `<button type="button" class="pill-btn" data-lang="${l}" aria-pressed="${getLang() === l}" lang="${l}">${label}</button>`;

  const stepVersion = () => `
    <div class="welcome-hero">${mascotSvg('wave', 110)}
      <div>
        <h2 id="welcome-title">${escapeHtml(t('welcome.title'))}</h2>
        <p>${escapeHtml(t('welcome.lead'))}</p>
      </div>
    </div>
    <div class="pill-bar welcome-lang" role="group" aria-label="${escapeHtml(t('welcome.language'))}">
      ${langBtn('es', 'Español')}${langBtn('en', 'English')}
    </div>
    <fieldset class="welcome-field">
      <legend>${escapeHtml(t('welcome.versionQ'))}</legend>
      <label class="welcome-choice"><input type="radio" name="w-version" value="2025" ${version === '2025' ? 'checked' : ''} />
        <span><strong>${escapeHtml(t('welcome.v2025'))}</strong><span>${escapeHtml(t('welcome.v2025Sub'))}</span></span></label>
      <label class="welcome-choice"><input type="radio" name="w-version" value="2008" ${version === '2008' ? 'checked' : ''} />
        <span><strong>${escapeHtml(t('welcome.v2008'))}</strong><span>${escapeHtml(t('welcome.v2008Sub'))}</span></span></label>
    </fieldset>
    ${nav(t('welcome.next'), false)}`;

  const districtOptions = () => {
    const reps = delegation?.representatives ?? [];
    if (lookup === 'loading') return `<option value="">${escapeHtml(t('welcome.loading'))}</option>`;
    if (!reps.length) return `<option value="">${escapeHtml(lookup === 'offline' ? t('welcome.offline') : t('settings.chooseStateFirst'))}</option>`;
    const ph = reps.length > 1 ? `<option value="">${escapeHtml(t('settings.chooseDistrict'))}</option>` : '';
    return ph + reps.map((r) => `<option value="${r.district}" ${String(r.district) === district ? 'selected' : ''}>${escapeHtml(districtLabel(r))} — ${escapeHtml(r.name)}</option>`).join('');
  };

  const stepState = () => `
    <h2 id="welcome-title">${escapeHtml(t('welcome.stateTitle'))}</h2>
    <p>${escapeHtml(t('welcome.stateLead'))}</p>
    <label class="field"><span class="field-label">${escapeHtml(t('settings.homeState'))}</span>
      <select id="w-state" class="select-input">
        <option value="">${escapeHtml(t('welcome.chooseState'))}</option>
        ${JURISDICTIONS.map((j) => `<option value="${j.code}" ${j.code === stateCode ? 'selected' : ''}>${escapeHtml(j.name)}</option>`).join('')}
      </select></label>
    <label class="field"><span class="field-label">${escapeHtml(t('welcome.district'))}</span>
      <select id="w-district" class="select-input" ${(delegation?.representatives.length ?? 0) > 1 ? '' : 'disabled'}>${districtOptions()}</select>
      <span class="field-hint">${escapeHtml(t('welcome.districtHint'))}</span></label>
    ${nav(stateCode ? t('welcome.next') : t('welcome.skipStep'))}`;

  const stepDate = () => `
    <h2 id="welcome-title">${escapeHtml(t('welcome.dateTitle'))}</h2>
    <p>${escapeHtml(t('welcome.dateLead'))}</p>
    <label class="field"><span class="field-label">${escapeHtml(t('settings.interviewDate'))}</span>
      <input id="w-date" type="date" class="text-input" value="${escapeHtml(date)}" /></label>
    ${nav(date ? t('welcome.next') : t('welcome.noDateYet'))}`;

  const stepReady = () => {
    const mode = installMode();
    return `
    <div class="welcome-hero">${mascotSvg('flag', 110)}
      <div>
        <h2 id="welcome-title">${escapeHtml(t('welcome.readyTitle'))}</h2>
        <p>${escapeHtml(t('welcome.readyLead'))}</p>
      </div>
    </div>
    <section class="welcome-box">
      <h3>⏰ ${escapeHtml(t('reminder.title'))}</h3>
      ${renderReminderPicker('welcome')}
    </section>
    ${
      mode !== 'none'
        ? `<section class="welcome-box"><h3>📲 ${escapeHtml(t('install.title'))}</h3>
            <p class="field-hint" style="margin:0;">${escapeHtml(mode === 'ios' ? t('install.iosSteps') : t('install.lead'))}</p>
            ${mode === 'prompt' ? `<button type="button" class="btn btn--secondary" data-w="install">${escapeHtml(t('install.button'))}</button>` : ''}
          </section>`
        : ''
    }
    <div class="welcome-nav">
      <button type="button" class="btn btn--ghost" data-w="back">${escapeHtml(t('welcome.back'))}</button>
      <button type="button" class="btn btn--primary btn--lg" data-w="start">${escapeHtml(t('welcome.start'))}</button>
    </div>`;
  };

  const render = () => {
    const body = [stepVersion, stepState, stepDate, stepReady][step]!();
    dialog.innerHTML = `
      <div class="welcome-top">${dots()}<button type="button" class="btn btn--ghost welcome-skip" data-w="skip">${escapeHtml(t('welcome.skipAll'))}</button></div>
      <div class="dialog-body welcome-body">${body}</div>`;
    if (step === 3) bindReminderPicker(dialog);
    dialog.querySelector<HTMLElement>('#welcome-title')?.setAttribute('tabindex', '-1');
    dialog.querySelector<HTMLElement>('#welcome-title')?.focus();
  };

  const loadDelegation = async () => {
    const my = ++token;
    delegation = null;
    if (!stateCode) {
      lookup = 'idle';
      render();
      return;
    }
    lookup = 'loading';
    render();
    try {
      const index = await loadCongressIndex();
      if (my !== token) return;
      delegation = index[stateCode] ?? { senators: [], representatives: [] };
      lookup = 'ok';
      if (delegation.representatives.length === 1) district = String(delegation.representatives[0]!.district);
    } catch {
      if (my !== token) return;
      lookup = 'offline';
    }
    render();
  };

  /** Save state, governor, capital and (when known) senators and representative. */
  const saveState = () => {
    const place = findJurisdiction(stateCode);
    if (!place) return;
    const current = handlers.getState().settings.officials;
    const rep = delegation?.representatives.find((r) => String(r.district) === district);
    handlers.onUpdateSettings({
      homeState: stateCode,
      homeDistrict: district,
      officials: {
        ...DEFAULT_OFFICIALS,
        ...current,
        governor: place.governor,
        stateCapital: place.capital,
        senator: delegation
          ? delegation.senators.length
            ? delegation.senators.join(', ')
            : noSenatorsAnswer(place)
          : current.senator,
        representative: rep?.name ?? current.representative,
      },
    });
  };

  dialog.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const lang = target.closest<HTMLElement>('[data-lang]')?.dataset.lang as Lang | undefined;
    if (lang) {
      setLang(lang);
      render();
      return;
    }
    const action = target.closest<HTMLElement>('[data-w]')?.dataset.w;
    switch (action) {
      case 'skip':
        close();
        break;
      case 'back':
        step = Math.max(0, step - 1);
        render();
        break;
      case 'next':
        if (step === 0) {
          handlers.onUpdateSettings({ testVersion: version });
        } else if (step === 1 && stateCode) {
          saveState();
        } else if (step === 2) {
          handlers.onUpdateSettings({ interviewDate: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '' });
        }
        step = Math.min(STEPS - 1, step + 1);
        render();
        break;
      case 'install':
        void promptInstall().then(() => render());
        break;
      case 'start':
        close();
        announce(t('welcome.readyTitle'));
        handlers.onStartPath();
        break;
      default:
        break;
    }
  });

  dialog.addEventListener('change', (event) => {
    const el = event.target as HTMLInputElement | HTMLSelectElement;
    if (el.name === 'w-version') version = el.value === '2008' ? '2008' : '2025';
    if (el.id === 'w-state') {
      stateCode = el.value;
      district = '';
      void loadDelegation();
    }
    if (el.id === 'w-district') district = el.value;
    if (el.id === 'w-date') {
      date = el.value;
      render();
    }
  });

  dialog.addEventListener('close', () => {
    markWelcomeDone();
    dialog.remove();
  });

  render();
  dialog.showModal();
  dialog.querySelector<HTMLElement>('#welcome-title')?.focus();
  if (stateCode) void loadDelegation();
}
