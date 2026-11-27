import { appUrl } from '../../config';
import { buildReminderIcs, googleCalendarUrl } from '../../domain/reminder';
import { t } from '../../i18n';
import { isIos } from '../../services/install';
import { announce } from '../announcer';
import { escapeHtml } from '../dom';

const TIME_KEY = 'civics128:reminderTime';

function savedTime(): string {
  try {
    const v = localStorage.getItem(TIME_KEY);
    return v && /^\d{2}:\d{2}$/.test(v) ? v : '19:00';
  } catch {
    return '19:00';
  }
}

/** Time picker + "add to calendar" buttons. Bind with bindReminderPicker. */
export function renderReminderPicker(prefix: string): string {
  const ios = isIos();
  const google = `<button type="button" class="btn ${ios ? 'btn--secondary' : 'btn--primary'}" data-reminder="google">${escapeHtml(t('reminder.google'))}</button>`;
  const ics = `<button type="button" class="btn ${ios ? 'btn--primary' : 'btn--secondary'}" data-reminder="ics">${escapeHtml(t('reminder.ics'))}</button>`;
  return `
    <div class="reminder-picker" data-reminder-root="${prefix}">
      <label class="field">
        <span class="field-label">${escapeHtml(t('reminder.time'))}</span>
        <input type="time" class="text-input reminder-time" id="${prefix}-reminder-time" value="${savedTime()}" />
      </label>
      <div class="reminder-buttons">${ios ? ics + google : google + ics}</div>
      <p class="field-hint" style="margin:0;">${escapeHtml(t('reminder.hint'))}</p>
    </div>`;
}

export function bindReminderPicker(container: HTMLElement): void {
  container.querySelectorAll<HTMLElement>('[data-reminder-root]').forEach((root) => {
    const input = root.querySelector<HTMLInputElement>('.reminder-time');
    const options = () => {
      const time = input?.value || '19:00';
      try {
        localStorage.setItem(TIME_KEY, time);
      } catch {
        // ignore
      }
      return {
        time,
        title: t('reminder.eventTitle'),
        description: t('reminder.eventBody'),
        url: appUrl(),
      };
    };
    root.querySelector('[data-reminder="google"]')?.addEventListener('click', () => {
      window.open(googleCalendarUrl(options()), '_blank', 'noopener');
      announce(t('reminder.opened'));
    });
    root.querySelector('[data-reminder="ics"]')?.addEventListener('click', () => {
      const blob = new Blob([buildReminderIcs(options())], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'civics-128-recordatorio.ics';
      document.body.append(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      announce(t('reminder.downloaded'));
    });
  });
}
