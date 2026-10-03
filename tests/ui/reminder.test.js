import { describe, it, expect } from 'vitest';
import { icsText } from '../../src/ui/reminder.js';

describe('напоминание в календарь', () => {
  const ics = icsText('09:45', new Date(2026, 9, 4, 8, 0));
  it('каждый день, в нужное время, со ссылкой', () => {
    expect(ics).toContain('RRULE:FREQ=DAILY');
    expect(ics).toContain('DTSTART:20261004T094500');
    expect(ics).toContain('DTEND:20261004T100000');
    expect(ics).toContain('https://marvindpp.github.io/qaita/');
    expect(ics).toContain('BEGIN:VALARM');
  });
  it('строки через CRLF, как требует формат', () => {
    expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR');
    expect(ics.includes('\n') && !ics.replace(/\r\n/g, '').includes('\n')).toBe(true);
  });
});
