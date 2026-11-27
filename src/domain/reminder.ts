/**
 * Daily study reminder as a calendar event: works on any phone without a
 * server or push notifications. Times are "floating" (no time zone), so the
 * calendar keeps the hour the person chose wherever they are.
 */
export interface ReminderOptions {
  /** HH:MM, 24-hour clock. */
  time: string;
  title: string;
  description: string;
  url: string;
  /** First day of the reminder (defaults to tomorrow if today's time has passed). */
  now?: Date;
  durationMinutes?: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

function stamp(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

export function parseTime(time: string): { h: number; m: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  const h = match ? Math.min(23, Number(match[1])) : 19;
  const m = match ? Math.min(59, Number(match[2])) : 0;
  return { h, m };
}

/** First occurrence: today at that time if it is still ahead, otherwise tomorrow. */
export function firstOccurrence(time: string, now = new Date()): Date {
  const { h, m } = parseTime(time);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
  if (start.getTime() <= now.getTime()) start.setDate(start.getDate() + 1);
  return start;
}

/** RFC 5545 text escaping. */
function esc(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Fold lines longer than 75 octets (approximated by characters) as RFC 5545 asks. */
function fold(line: string): string {
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    parts.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  parts.push(rest);
  return parts.join('\r\n');
}

export function buildReminderIcs(opts: ReminderOptions): string {
  const start = firstOccurrence(opts.time, opts.now);
  const end = new Date(start.getTime() + (opts.durationMinutes ?? 15) * 60_000);
  const created = opts.now ?? new Date();
  const uid = `civics128-daily-${start.getTime()}@civics-128`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Civics 128//Daily reminder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp(created)}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    'RRULE:FREQ=DAILY',
    `SUMMARY:${esc(opts.title)}`,
    `DESCRIPTION:${esc(`${opts.description}\n${opts.url}`)}`,
    `URL:${esc(opts.url)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(opts.title)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** "Add to Google Calendar" link with a daily repeat. */
export function googleCalendarUrl(opts: ReminderOptions): string {
  const start = firstOccurrence(opts.time, opts.now);
  const end = new Date(start.getTime() + (opts.durationMinutes ?? 15) * 60_000);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: opts.title,
    details: `${opts.description}\n${opts.url}`,
    dates: `${stamp(start)}/${stamp(end)}`,
    recur: 'RRULE:FREQ=DAILY',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
