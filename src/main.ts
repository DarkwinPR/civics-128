import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/views.css';
import './styles/vibrant.css';

import type { AppView, PersistedState } from './domain/types';
import { closeDialogSmoothly, enhanceModalDialog } from './services/dialogHelper';
import { isSpeechSynthesisSupported } from './services/speech';
import {
  addExamRecord,
  loadState,
  recordPracticeResult,
  resetProgressOnly,
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

const VIEW_TITLES: Record<AppView, string> = {
  dashboard: 'Overview | U.S. Civics 128 Practice (2025)',
  flashcards: 'Flashcards | U.S. Civics 128 Practice (2025)',
  exam: 'Mock Exam | U.S. Civics 128 Practice (2025)',
  oral: 'Oral Voice Coach | U.S. Civics 128 Practice (2025)',
  bank: 'All 128 Questions | U.S. Civics 128 Practice (2025)',
};

let appState: PersistedState = loadState();
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
      appState = updateSettings(appState, patch);
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
    } else {
      btn.removeAttribute('aria-current');
    }
  });
}

function mountActiveView(): void {
  cleanupCurrentView?.();
  cleanupCurrentView = null;

  document.title = VIEW_TITLES[currentView];
  updateNavActive();

  if (currentView === 'dashboard') {
    renderDashboardView(mainEl, appState, {
      onNavigate: (view, opts) => {
        if (view === 'flashcards') {
          const filter: FlashcardFilter = opts?.filterReview
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
    startViewTransition?: (update: () => void) => { finished: Promise<void> };
  };

  if (!withTransition || typeof docWithVT.startViewTransition !== 'function') {
    mountActiveView();
    if (withTransition) focusViewHeading();
    return;
  }

  const transition = docWithVT.startViewTransition(() => {
    mountActiveView();
  });

  // Mandatory accessibility routing after same-document view transitions.
  void transition.finished.finally(() => {
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

// Initial render
renderCurrentView(false);
