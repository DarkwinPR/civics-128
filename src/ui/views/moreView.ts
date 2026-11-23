import type { AppView } from '../../domain/types';
import { t } from '../../i18n';
import { escapeHtml } from '../dom';

/** Secondary study tools, so the main menu stays short. */
export function renderMoreView(container: HTMLElement, onNavigate: (view: AppView) => void): void {
  const items: Array<{ view: AppView; icon: string; title: string; body: string }> = [
    { view: 'flashcards', icon: '🃏', title: t('nav.flashcards'), body: t('more.flashcards') },
    { view: 'oral', icon: '🎤', title: t('nav.oral'), body: t('more.oral') },
    { view: 'audio', icon: '🎧', title: t('nav.audio'), body: t('more.audio') },
    { view: 'bank', icon: '📚', title: t('nav.bank'), body: t('more.bank') },
  ];
  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1 id="main-heading" tabindex="-1">${escapeHtml(t('title.more'))}</h1>
        <p class="view-lead">${escapeHtml(t('more.lead'))}</p>
      </div>
    </div>
    <ul class="more-grid" role="list">
      ${items
        .map(
          (i) => `
        <li>
          <button type="button" class="more-card" data-go="${i.view}">
            <span class="more-icon" aria-hidden="true">${i.icon}</span>
            <span><strong>${escapeHtml(i.title)}</strong><span>${escapeHtml(i.body)}</span></span>
          </button>
        </li>`,
        )
        .join('')}
    </ul>`;
  container.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((btn) =>
    btn.addEventListener('click', () => onNavigate(btn.dataset.go as AppView)),
  );
}
