import type { AppView, PersistedState } from '../../domain/types';
import { t } from '../../i18n';
import type { EnglishPart } from '../../services/storage';
import { escapeHtml } from '../dom';
import { mountEnglishMockInterview } from './englishMockInterview';

/**
 * The whole interview in the real order: oath and N-400 questions, the civics
 * test (official rules for the chosen version), then reading and writing.
 */
export interface FullInterviewCallbacks {
  getState: () => PersistedState;
  onRecordAttempt: (part: EnglishPart, id: string, passed: boolean) => void;
  onRecordCivics: (questionId: number, correct: boolean) => void;
  onNavigate: (view: AppView) => void;
}

export function mountFullInterviewView(container: HTMLElement, callbacks: FullInterviewCallbacks): () => void {
  container.innerHTML = `
    <div class="study-stage-wrapper">
      <div class="view-header">
        <div>
          <h1 id="main-heading" tabindex="-1">${escapeHtml(t('title.interview'))}</h1>
          <p class="view-lead">${escapeHtml(t('mock.fullLead'))}</p>
        </div>
      </div>
      <div id="full-interview-root"></div>
    </div>`;
  const root = container.querySelector<HTMLElement>('#full-interview-root')!;
  return mountEnglishMockInterview(root, {
    getState: callbacks.getState,
    onRecordAttempt: callbacks.onRecordAttempt,
    onRecordCivics: callbacks.onRecordCivics,
    onNavigate: callbacks.onNavigate,
    includeCivics: true,
  });
}
