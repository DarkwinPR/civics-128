import { describe, expect, it } from 'vitest';
import { buildReminderIcs, firstOccurrence, googleCalendarUrl, parseTime } from '../src/domain/reminder';

const opts = {
  time: '19:30',
  title: 'Study, today; please',
  description: 'Open the app',
  url: 'https://example.org/app/',
  now: new Date(2026, 10, 26, 20, 0, 0),
};

describe('daily calendar reminder', () => {
  it('starts today if the time is ahead, otherwise tomorrow', () => {
    expect(firstOccurrence('21:00', opts.now).getDate()).toBe(26);
    expect(firstOccurrence('19:30', opts.now).getDate()).toBe(27);
    expect(parseTime('bad')).toEqual({ h: 19, m: 0 });
  });

  it('builds a valid repeating iCalendar event', () => {
    const ics = buildReminderIcs(opts);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART:20261127T193000\r\n');
    expect(ics).toContain('DTEND:20261127T194500\r\n');
    expect(ics).toContain('RRULE:FREQ=DAILY\r\n');
    expect(ics).toContain('SUMMARY:Study\\, today\; please\r\n');
    expect(ics).toContain('BEGIN:VALARM');
    ics.split('\r\n').forEach((line) => expect(line.length).toBeLessThanOrEqual(75));
  });

  it('builds a Google Calendar link with a daily repeat', () => {
    const url = new URL(googleCalendarUrl(opts));
    expect(url.hostname).toBe('calendar.google.com');
    expect(url.searchParams.get('recur')).toBe('RRULE:FREQ=DAILY');
    expect(url.searchParams.get('dates')).toBe('20261127T193000/20261127T194500');
  });
});
