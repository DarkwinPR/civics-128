import { DEFAULT_OFFICIALS, OFFICIAL_LABELS } from '../../domain/questions';
import type {
  DynamicOfficialKey,
  OfficialOverrides,
  PersistedState,
  StudySettings,
  TestVersion,
  ThemePreference,
} from '../../domain/types';
import {
  findJurisdiction,
  GOVERNORS_VERIFIED_ON,
  JURISDICTIONS,
  noSenatorsAnswer,
} from '../../domain/states';
import { districtLabel, loadCongressIndex } from '../../services/congressLookup';
import { closeDialogSmoothly, openConfirmDialog } from '../../services/dialogHelper';
import {
  getEnglishVoices,
  isSpeechSynthesisSupported,
  speakText,
  stopSpeaking,
} from '../../services/speech';
import { applyThemePreference, getStoredTheme, getSystemTheme } from '../../services/theme';
import { announce } from '../announcer';
import { escapeHtml, ICONS } from '../dom';

export interface SettingsDialogHandlers {
  getState: () => PersistedState;
  onUpdateSettings: (patch: Partial<StudySettings>) => void;
  onResetProgress: () => void;
}

export function renderSettingsDialogBody(
  container: HTMLElement,
  dialog: HTMLDialogElement,
  confirmDialog: HTMLDialogElement,
  handlers: SettingsDialogHandlers,
): void {
  const state = handlers.getState();
  const currentTheme = getStoredTheme();
  const systemTheme = getSystemTheme();
  const voices = getEnglishVoices();
  const ttsSupported = isSpeechSynthesisSupported();

  const federalKeys: DynamicOfficialKey[] = [
    'president',
    'vicePresident',
    'speaker',
    'chiefJustice',
  ];
  const stateKeys: DynamicOfficialKey[] = [
    'senator',
    'representative',
    'governor',
    'stateCapital',
  ];

  const renderOfficialField = (key: DynamicOfficialKey): string => {
    const meta = OFFICIAL_LABELS[key];
    const value = state.settings.officials[key];
    return `
      <div class="field">
        <label for="official-${key}">${escapeHtml(meta.label)}</label>
        <input
          id="official-${key}"
          name="${key}"
          type="text"
          class="text-input"
          value="${escapeHtml(value)}"
          placeholder="${escapeHtml(meta.placeholder)}"
        />
      </div>
    `;
  };

  const renderPlaceOptions = (group: 'state' | 'other'): string =>
    JURISDICTIONS.filter((j) => (group === 'state' ? j.kind === 'state' : j.kind !== 'state'))
      .map(
        (j) =>
          `<option value="${j.code}" ${state.settings.homeState === j.code ? 'selected' : ''}>${escapeHtml(j.name)}</option>`,
      )
      .join('');

  const goalOptions = [5, 10, 15, 20, 30];
  const sizeOptions: { value: number; label: string }[] = [
    { value: 1, label: 'A' },
    { value: 1.15, label: 'A+' },
    { value: 1.3, label: 'A++' },
  ];

  container.innerHTML = `
    <section class="settings-section">
      <h3>Your Test</h3>
      <p class="field-hint">Which version of the civics test will you take? It depends on the date you filed your Form N-400.</p>
      <fieldset class="segmented-group segmented-group--two" aria-label="Civics test version">
        <div class="segmented-option">
          <input type="radio" name="test-version" id="version-2025" value="2025" ${state.settings.testVersion === '2025' ? 'checked' : ''} />
          <label for="version-2025">
            <span>2025 test · 128 questions</span>
            <span class="segmented-sub">Filed on or after Oct 20, 2025</span>
          </label>
        </div>
        <div class="segmented-option">
          <input type="radio" name="test-version" id="version-2008" value="2008" ${state.settings.testVersion === '2008' ? 'checked' : ''} />
          <label for="version-2008">
            <span>2008 test · 100 questions</span>
            <span class="segmented-sub">Filed before Oct 20, 2025</span>
          </label>
        </div>
      </fieldset>
      <div class="officials-grid">
        <div class="field">
          <label for="daily-goal">Daily goal</label>
          <select id="daily-goal" class="select-input">
            ${goalOptions
              .map(
                (n) =>
                  `<option value="${n}" ${state.settings.dailyGoal === n ? 'selected' : ''}>${n} questions per day</option>`,
              )
              .join('')}
          </select>
        </div>
        <div class="field">
          <span class="field-label" id="text-size-label">Text size</span>
          <div class="size-toggle" role="group" aria-labelledby="text-size-label">
            ${sizeOptions
              .map(
                (o) =>
                  `<button type="button" class="pill-btn" data-font-scale="${o.value}" aria-pressed="${Math.abs(state.settings.fontScale - o.value) < 0.01}" style="font-size:${o.value}rem;">${o.label}</button>`,
              )
              .join('')}
          </div>
        </div>
      </div>
    </section>

    <section class="settings-section">
      <h3>Appearance</h3>
      <fieldset class="segmented-group" aria-label="Color theme">
        <div class="segmented-option">
          <input type="radio" name="theme" id="theme-system" value="system" ${currentTheme === 'system' ? 'checked' : ''} />
          <label for="theme-system">
            <span>System</span>
            <span class="segmented-sub">Currently ${systemTheme}</span>
          </label>
        </div>
        <div class="segmented-option">
          <input type="radio" name="theme" id="theme-light" value="light" ${currentTheme === 'light' ? 'checked' : ''} />
          <label for="theme-light">
            <span>Light</span>
            <span class="segmented-sub">Paper light</span>
          </label>
        </div>
        <div class="segmented-option">
          <input type="radio" name="theme" id="theme-dark" value="dark" ${currentTheme === 'dark' ? 'checked' : ''} />
          <label for="theme-dark">
            <span>Dark</span>
            <span class="segmented-sub">Deep navy</span>
          </label>
        </div>
      </fieldset>
    </section>

    <section class="settings-section">
      <h3>Officer Voice &amp; Audio</h3>
      ${
        ttsSupported
          ? `
        <div class="officials-grid">
          <div class="field">
            <label for="voice-select">English Voice</label>
            <select id="voice-select" class="select-input">
              <option value="">Default U.S. English Voice</option>
              ${voices
                .map(
                  (v) => `
                <option value="${escapeHtml(v.voiceURI)}" ${state.settings.voiceURI === v.voiceURI ? 'selected' : ''}>
                  ${escapeHtml(v.name)} (${escapeHtml(v.lang)})
                </option>
              `,
                )
                .join('')}
            </select>
          </div>
          <div class="field">
            <label for="speech-rate">Speaking Speed: <strong id="speech-rate-val">${state.settings.speechRate.toFixed(2)}x</strong></label>
            <input
              id="speech-rate"
              type="range"
              min="0.75"
              max="1.25"
              step="0.05"
              value="${state.settings.speechRate}"
            />
          </div>
        </div>
        <div class="voice-controls-row">
          <label style="display:inline-flex;align-items:center;gap:0.5rem;font-size:0.9rem;cursor:pointer;">
            <input id="auto-speak-toggle" type="checkbox" ${state.settings.autoSpeak ? 'checked' : ''} />
            Auto-read questions aloud in Flashcards &amp; Mock Exam
          </label>
          <button type="button" id="test-voice-btn" class="btn btn--secondary" style="margin-inline-start:auto;">
            ${ICONS.volume} Test Voice
          </button>
        </div>
      `
          : `<p class="notice">Text-to-Speech is not supported in this browser.</p>`
      }
    </section>

    <form id="officials-form" class="settings-section">
      <h3>Your Current Officials (Time-Sensitive &amp; State Answers)</h3>
      <p class="field-hint">
        Governors last verified ${GOVERNORS_VERIFIED_ON}; senators and representatives load live from the official list of current members of Congress.
        Customize these answers to match your state and current officeholders at
        <a href="https://www.uscis.gov/citizenship/testupdates" target="_blank" rel="noopener noreferrer">uscis.gov/citizenship/testupdates</a>.
        Separate multiple acceptable names with commas (for example, both of your state's U.S. senators).
      </p>
      <div class="officials-grid">
        ${federalKeys.map(renderOfficialField).join('')}
      </div>
      <div class="state-picker">
        <div class="state-picker-head">
          <span class="state-picker-icon" aria-hidden="true">${ICONS.flag}</span>
          <div>
            <strong>Auto-fill your state answers</strong>
            <p class="field-hint">Pick your state and we fill in your senators, governor and capital with current data.</p>
          </div>
        </div>
        <div class="officials-grid">
          <div class="field">
            <label for="home-state">Your state or territory</label>
            <select id="home-state" class="select-input">
              <option value="">Choose your state…</option>
              <optgroup label="States">
                ${renderPlaceOptions('state')}
              </optgroup>
              <optgroup label="D.C. &amp; Territories">
                ${renderPlaceOptions('other')}
              </optgroup>
            </select>
          </div>
          <div class="field">
            <label for="home-district">Congressional district</label>
            <select id="home-district" class="select-input" disabled>
              <option value="">Choose your state first</option>
            </select>
            <p class="field-hint">
              Don't know it?
              <a href="https://www.house.gov/representatives/find-your-representative" target="_blank" rel="noopener noreferrer">Find your district by ZIP code</a>.
            </p>
          </div>
        </div>
        <p id="state-lookup-status" class="field-hint state-lookup-status" role="status" aria-live="polite"></p>
      </div>
      <div class="officials-grid">
        ${stateKeys.map(renderOfficialField).join('')}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:0.6rem;justify-content:space-between;align-items:center;">
        <button type="button" id="restore-federal-btn" class="btn btn--ghost">Restore Default Federal Officials</button>
        <button type="submit" class="btn btn--primary">Save Officials</button>
      </div>
    </form>

    <section class="settings-section" style="border-block-start:1px solid var(--border);padding-block-start:1rem;">
      <h3>Study Data</h3>
      <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:0.75rem;">
        <p class="field-hint" style="max-inline-size:34ch;">
          All study progress is stored locally in your browser. Nothing is sent to a server.
        </p>
        <button type="button" id="reset-progress-btn" class="btn btn--soft-danger">
          Reset Study Progress
        </button>
      </div>
    </section>
  `;

  // Theme radio changes
  container.querySelectorAll<HTMLInputElement>('input[name="theme"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      const pref = radio.value as ThemePreference;
      applyThemePreference(pref);
      announce(`Theme set to ${pref}.`);
    });
  });

  // Test version, daily goal & text size
  container.querySelectorAll<HTMLInputElement>('input[name="test-version"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      handlers.onUpdateSettings({ testVersion: radio.value as TestVersion });
      announce(`Now studying the ${radio.value} civics test.`);
    });
  });

  const goalSelect = container.querySelector<HTMLSelectElement>('#daily-goal');
  goalSelect?.addEventListener('change', () => {
    handlers.onUpdateSettings({ dailyGoal: Number(goalSelect.value) });
  });

  container.querySelectorAll<HTMLButtonElement>('[data-font-scale]').forEach((btn) => {
    btn.addEventListener('click', () => {
      handlers.onUpdateSettings({ fontScale: Number(btn.dataset.fontScale) });
      container.querySelectorAll<HTMLButtonElement>('[data-font-scale]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b === btn));
      });
    });
  });

  // Voice & speech rate controls
  const voiceSelect = container.querySelector<HTMLSelectElement>('#voice-select');
  voiceSelect?.addEventListener('change', () => {
    handlers.onUpdateSettings({ voiceURI: voiceSelect.value });
  });

  const rateInput = container.querySelector<HTMLInputElement>('#speech-rate');
  const rateVal = container.querySelector<HTMLElement>('#speech-rate-val');
  rateInput?.addEventListener('input', () => {
    const val = Number(rateInput.value);
    if (rateVal) rateVal.textContent = `${val.toFixed(2)}x`;
    handlers.onUpdateSettings({ speechRate: val });
  });

  const autoSpeakToggle = container.querySelector<HTMLInputElement>('#auto-speak-toggle');
  autoSpeakToggle?.addEventListener('change', () => {
    handlers.onUpdateSettings({ autoSpeak: autoSpeakToggle.checked });
  });

  container.querySelector<HTMLButtonElement>('#test-voice-btn')?.addEventListener('click', () => {
    const latest = handlers.getState().settings;
    speakText('What is the supreme law of the land?', {
      rate: latest.speechRate,
      voiceURI: latest.voiceURI,
    });
  });

  // State picker: auto-fill senators, representative, governor & capital
  const homeStateSelect = container.querySelector<HTMLSelectElement>('#home-state');
  const homeDistrictSelect = container.querySelector<HTMLSelectElement>('#home-district');
  const lookupStatus = container.querySelector<HTMLElement>('#state-lookup-status');
  let lookupToken = 0;
  let districtNames = new Map<string, string>();

  const setOfficialInput = (key: DynamicOfficialKey, value: string) => {
    const input = container.querySelector<HTMLInputElement>(`#official-${key}`);
    if (!input) return;
    input.value = value;
    input.classList.remove('is-autofilled');
    void input.offsetWidth; // restart the highlight animation
    if (value) input.classList.add('is-autofilled');
  };

  const setStatus = (text: string, tone: 'info' | 'ok' | 'error' = 'info') => {
    if (!lookupStatus) return;
    lookupStatus.textContent = text;
    lookupStatus.dataset.tone = tone;
  };

  const resetDistrictSelect = () => {
    if (!homeDistrictSelect) return;
    homeDistrictSelect.innerHTML = '<option value="">Choose your state first</option>';
    homeDistrictSelect.disabled = true;
  };

  const applyState = async (code: string, fill: boolean, keepDistrict: string) => {
    const token = ++lookupToken;
    districtNames = new Map();
    resetDistrictSelect();
    const place = findJurisdiction(code);
    if (!place) {
      setStatus('');
      return;
    }
    if (fill) {
      setOfficialInput('governor', place.governor);
      setOfficialInput('stateCapital', place.capital);
    }
    setStatus('Loading current members of Congress…');

    try {
      const index = await loadCongressIndex();
      if (token !== lookupToken) return;
      const delegation = index[code] ?? { senators: [], representatives: [] };
      const reps = delegation.representatives;

      if (homeDistrictSelect) {
        districtNames = new Map(reps.map((r) => [String(r.district), r.name]));
        const placeholder = reps.length > 1 ? '<option value="">Choose your district…</option>' : '';
        homeDistrictSelect.innerHTML =
          placeholder +
          reps
            .map(
              (r) =>
                `<option value="${r.district}">${escapeHtml(districtLabel(r))} — ${escapeHtml(r.name)}</option>`,
            )
            .join('');
        homeDistrictSelect.disabled = reps.length === 0;
        if (reps.length === 1) {
          homeDistrictSelect.value = String(reps[0]?.district ?? '');
        } else if (keepDistrict && districtNames.has(keepDistrict)) {
          homeDistrictSelect.value = keepDistrict;
        }
      }

      if (!fill) {
        setStatus(`Current data for ${place.name} is ready. Change the state or district to refill.`);
        return;
      }

      setOfficialInput(
        'senator',
        delegation.senators.length ? delegation.senators.join(', ') : noSenatorsAnswer(place),
      );
      setOfficialInput('representative', districtNames.get(homeDistrictSelect?.value ?? '') ?? '');

      const needsDistrict = reps.length > 1 && !homeDistrictSelect?.value;
      setStatus(
        needsDistrict
          ? `✓ Senators, governor and capital filled for ${place.name}. Now choose your district to get your Representative, then click Save Officials.`
          : `✓ All state answers filled for ${place.name}. Click Save Officials to keep them.`,
        'ok',
      );
    } catch {
      if (token !== lookupToken) return;
      setStatus(
        fill
          ? 'Governor and capital filled, but the live Congress list could not load (are you offline?). Type your senators and representative manually.'
          : 'Could not load the live Congress list right now.',
        'error',
      );
    }
  };

  homeStateSelect?.addEventListener('change', () => {
    void applyState(homeStateSelect.value, true, '');
  });

  homeDistrictSelect?.addEventListener('change', () => {
    const name = districtNames.get(homeDistrictSelect.value) ?? '';
    setOfficialInput('representative', name);
    if (name) setStatus(`✓ Representative set to ${name}. Click Save Officials to keep it.`, 'ok');
  });

  if (state.settings.homeState) {
    void applyState(state.settings.homeState, false, state.settings.homeDistrict);
  }

  // Officials save form
  const officialsForm = container.querySelector<HTMLFormElement>('#officials-form');
  officialsForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(officialsForm);
    const updated: OfficialOverrides = {
      president: String(formData.get('president') ?? '').trim(),
      vicePresident: String(formData.get('vicePresident') ?? '').trim(),
      speaker: String(formData.get('speaker') ?? '').trim(),
      chiefJustice: String(formData.get('chiefJustice') ?? '').trim(),
      senator: String(formData.get('senator') ?? '').trim(),
      representative: String(formData.get('representative') ?? '').trim(),
      governor: String(formData.get('governor') ?? '').trim(),
      stateCapital: String(formData.get('stateCapital') ?? '').trim(),
    };
    handlers.onUpdateSettings({
      officials: updated,
      homeState: homeStateSelect?.value ?? '',
      homeDistrict: homeDistrictSelect?.value ?? '',
    });
    announce('Saved custom official answers.');
    void closeDialogSmoothly(dialog);
  });

  container
    .querySelector<HTMLButtonElement>('#restore-federal-btn')
    ?.addEventListener('click', () => {
      for (const key of federalKeys) {
        const input = container.querySelector<HTMLInputElement>(`#official-${key}`);
        if (input) input.value = DEFAULT_OFFICIALS[key];
      }
      announce('Restored default federal officials. Click Save Officials to keep changes.');
    });

  // Reset study progress
  container
    .querySelector<HTMLButtonElement>('#reset-progress-btn')
    ?.addEventListener('click', async () => {
      stopSpeaking();
      const confirmed = await openConfirmDialog(confirmDialog, {
        title: 'Reset Study Progress?',
        message:
          'This clears all mastered cards, review flags, and mock exam history saved in this browser. Your custom officials will remain saved.',
        confirmLabel: 'Reset Progress',
      });
      if (confirmed) {
        handlers.onResetProgress();
        announce('Study progress has been reset.');
        void closeDialogSmoothly(dialog);
      }
    });
}
