import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/views.css';
import './styles/vibrant.css';

import { REPO_URL, reportIssueUrl } from './config';
import { setTestVersion } from './domain/questions';
import type { AppView, PersistedState } from './domain/types';
import { applyStaticTranslations, getLang, onLangChange, setLang, t } from './i18n';
import { registerServiceWorker } from './services/pwa';
import { mountEnglishTestView } from './ui/views/englishTestView';
import { closeDialogSmoothly, enhanceModalDialog } from './services/dialogHelper';
import { isSpeechSynthesisSupported } from './services/speech';
import {
  addExamRecord,
  loadState,
  recordEnglishAttempt,
  recordPracticeResult,
  resetProgressOnly,
  restoreBackup,
  setQuestionStatus,
  updateSettings,
} from './services/storage';
import { initThemeSync } from './services/theme';
import { renderSettingsDialogBody } from './ui/components/settingsDialog';
import { mountBankView } from './ui/views/bankView';
import { renderDashboardView } from './ui/views/dashboardView';
import {
  createInitialFlashcardsState,
  mountFlashcardsView,
  type FlashcardFilter,
  type FlashcardsViewState,
} from './ui/views/flashcardsView';
import { mountMockExamView } from './ui/views/mockExamView';
import { mountOralPracticeView } from './ui/views/oralPracticeView';

function viewTitle(view: AppView): string {
  return `${t(`title.${view}`)} | ${t('title.suffix')}`;
}

let appState: PersistedState = loadState();
setTestVersion(appState.settings.testVersion);
let currentView: AppView = 'dashboard';
let cleanupCurrentView: (() => void) | null = null;
let flashcardsState: FlashcardsViewState = createInitialFlashcardsState(appState, 'all');

const mainEl = document.getElementById('app-main') as HTMLElement;
const settingsDialog = document.getElementById('settings-dialog') as HTMLDialogElement;
const settingsBody = document.getElementById('settings-dialog-body') as HTMLElement;
const confirmDialog = document.getElementById('confirm-dialog') as HTMLDialogElement;
const openSettingsBtn = document.getElementById('open-settings-btn') as HTMLButtonElement;

enhanceModalDialog(settingsDialog);
enhanceModalDialog(confirmDialog);

settingsDialog.querySelector('[data-close-dialog]')?.addEventListener('click', () => {
  void closeDialogSmoothly(settingsDialog);
});

function refreshSettingsModal(): void {
  renderSettingsDialogBody(settingsBody, settingsDialog, confirmDialog, {
    getState: () => appState,
    onUpdateSettings: (patch) => {
      const versionChanged =
        patch.testVersion !== undefined && patch.testVersion !== appState.settings.testVersion;
      appState = updateSettings(appState, patch);
      if (versionChanged) {
        setTestVersion(appState.settings.testVersion);
        flashcardsState = createInitialFlashcardsState(appState, 'all');
      }
      applyAppearance();
      renderCurrentView(false);
    },
    onImportBackup: (state) => {
      appState = restoreBackup(state);
      setTestVersion(appState.settings.testVersion);
      flashcardsState = createInitialFlashcardsState(appState, 'all');
      applyAppearance();
      renderCurrentView(false);
    },
    onResetProgress: () => {
      appState = resetProgressOnly(appState);
      flashcardsState = createInitialFlashcardsState(appState, 'all');
      renderCurrentView(false);
    },
  });
}

function openSettings(): void {
  refreshSettingsModal();
  settingsDialog.showModal();
}

openSettingsBtn.addEventListener('click', openSettings);

// Keep settings theme label in sync if OS scheme or another tab changes it.
initThemeSync(() => {
  if (settingsDialog.open) {
    refreshSettingsModal();
  }
});

// Re-populate English voices when browser finishes loading them asynchronously.
if (isSpeechSynthesisSupported()) {
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    if (settingsDialog.open) {
      refreshSettingsModal();
    }
  });
}

function updateNavActive(): void {
  document.querySelectorAll<HTMLButtonElement>('.nav-btn[data-view]').forEach((btn) => {
    if (btn.dataset.view === currentView) {
      btn.setAttribute('aria-current', 'page');
      // On phones the tab row scrolls sideways; keep the active tab visible.
      btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    } else {
      btn.removeAttribute('aria-current');
    }
  });
}

function mountActiveView(): void {
  cleanupCurrentView?.();
  cleanupCurrentView = null;

  document.title = viewTitle(currentView);
  updateNavActive();

  if (currentView === 'dashboard') {
    renderDashboardView(mainEl, appState, {
      onNavigate: (view, opts) => {
        if (view === 'flashcards') {
          const filter: FlashcardFilter = opts?.filterMissed
            ? 'missed'
            : opts?.filterDue
            ? 'due'
            : opts?.filterReview
            ? 'review'
            : opts?.filter6520
              ? '65-20'
              : 'all';
          flashcardsState = createInitialFlashcardsState(appState, filter);
        }
        navigateTo(view);
      },
      onOpenSettings: openSettings,
    });
    return;
  }

  if (currentView === 'flashcards') {
    cleanupCurrentView = mountFlashcardsView(mainEl, flashcardsState, {
      getState: () => appState,
      onSetStatus: (questionId, status) => {
        appState = setQuestionStatus(appState, questionId, status);
      },
      onOpenSettings: openSettings,
    });
    return;
  }

  if (currentView === 'exam') {
    cleanupCurrentView = mountMockExamView(mainEl, {
      getState: () => appState,
      onRecordQuestionResult: (questionId, correct) => {
        appState = recordPracticeResult(appState, questionId, correct);
      },
      onCompleteExam: (record) => {
        appState = addExamRecord(appState, record);
      },
      onPracticeReview: () => {
        flashcardsState = createInitialFlashcardsState(appState, 'review');
        navigateTo('flashcards');
      },
    });
    return;
  }

  if (currentView === 'english') {
    cleanupCurrentView = mountEnglishTestView(mainEl, {
      getState: () => appState,
      onRecordAttempt: (part, id, passed) => {
        appState = recordEnglishAttempt(appState, part, id, passed);
      },
      onNavigate: (view) => navigateTo(view),
    });
    return;
  }

  if (currentView === 'oral') {
    cleanupCurrentView = mountOralPracticeView(mainEl, {
      getState: () => appState,
      onRecordResult: (questionId, correct) => {
        appState = recordPracticeResult(appState, questionId, correct);
      },
    });
    return;
  }

  cleanupCurrentView = mountBankView(mainEl, {
    getState: () => appState,
    onSetStatus: (questionId, status) => {
      appState = setQuestionStatus(appState, questionId, status);
    },
  });
}

function focusViewHeading(): void {
  const heading = document.getElementById('main-heading');
  heading?.focus({ preventScroll: true });
}

function renderCurrentView(withTransition = false): void {
  const docWithVT = document as Document & {
    startViewTransition?: (update: () => void) => {
      finished: Promise<void>;
      ready: Promise<void>;
      updateCallbackDone: Promise<void>;
    };
  };

  if (!withTransition || typeof docWithVT.startViewTransition !== 'function') {
    mountActiveView();
    if (withTransition) focusViewHeading();
    return;
  }

  const transition = docWithVT.startViewTransition(() => {
    mountActiveView();
  });

  // A quick second tap skips the running animation; that is expected, not an error.
  transition.ready.catch(() => undefined);
  transition.updateCallbackDone.catch(() => undefined);

  // Mandatory accessibility routing after same-document view transitions.
  transition.finished
    .catch(() => undefined)
    .finally(() => {
      focusViewHeading();
    });
}

function navigateTo(view: AppView): void {
  if (view === currentView) {
    focusViewHeading();
    return;
  }
  currentView = view;
  renderCurrentView(true);
}

document.querySelectorAll<HTMLButtonElement>('.nav-btn[data-view]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view as AppView;
    navigateTo(view);
  });
});

/** Text size, test-version subtitle and other settings reflected in the page shell. */
function applyAppearance(): void {
  document.documentElement.style.fontSize = `${Math.round(appState.settings.fontScale * 100)}%`;
  const subtitle = document.getElementById('brand-subtitle');
  if (subtitle) {
    subtitle.textContent = t(
      appState.settings.testVersion === '2008' ? 'app.subtitle2008' : 'app.subtitle2025',
    );
  }
}

// Footer links
const reportLink = document.getElementById('footer-report-link') as HTMLAnchorElement | null;
if (reportLink) reportLink.href = reportIssueUrl();
const codeLink = document.getElementById('footer-code-link') as HTMLAnchorElement | null;
if (codeLink) codeLink.href = REPO_URL;

// Language toggle (English <-> Spanish interface)
const langToggleBtn = document.getElementById('lang-toggle-btn') as HTMLButtonElement | null;
langToggleBtn?.addEventListener('click', () => {
  setLang(getLang() === 'es' ? 'en' : 'es');
});

onLangChange(() => {
  applyStaticTranslations();
  applyAppearance();
  renderCurrentView(false);
  if (settingsDialog.open) refreshSettingsModal();
});

// Offline support + "new version" banner
registerServiceWorker((applyUpdate) => {
  const banner = document.getElementById('update-banner');
  const button = document.getElementById('update-banner-btn');
  if (!banner || !button) return;
  banner.hidden = false;
  button.addEventListener('click', applyUpdate, { once: true });
});

// Initial render
applyStaticTranslations();
applyAppearance();
renderCurrentView(false);
