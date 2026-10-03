// Напоминание «пора заниматься» без сервера: файл календаря .ics с ежедневным повтором и сигналом.
// Телефон (iPhone, Android) и ноутбук открывают его в своём календаре — дальше напоминает сам календарь.
// Главная причина, почему бросают упражнения, — забывают (PLAN §9в), а пуш-уведомлений без сервера не сделать.
const SITE = 'https://marvindpp.github.io/qaita/';
const pad = (n) => String(n).padStart(2, '0');

/** Текст .ics: каждый день в `time` ('HH:MM'), 15 минут, сигнал в момент начала. */
export function icsText(time = '10:00', from = new Date()) {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(from);
  const day = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m + 15);
  const stamp = d.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Qaita//Reminder//RU', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:qaita-daily-${pad(h)}${pad(m)}@marvindpp.github.io`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${day}T${pad(h)}${pad(m)}00`, // «плавающее» местное время — 10:00 там, где телефон
    `DTEND:${day}T${pad(end.getHours())}${pad(end.getMinutes())}00`,
    'RRULE:FREQ=DAILY',
    'SUMMARY:Qaita — упражнения для руки',
    `DESCRIPTION:10 минут для руки. Откройте ссылку и покажите ладонь в камеру: ${SITE}`,
    `URL:${SITE}`,
    'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:Пора заниматься — Qaita', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
}

/** Скачать .ics (телефон предложит «Добавить в календарь»). */
export function downloadReminder(time) {
  const blob = new Blob([icsText(time)], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'qaita-napominanie.ics';
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/** Кнопка с выбором времени — для «Профиля» и «Безопасность и данные». */
export function reminderHtml() {
  return `<div class="reminder"><label class="reminder-time">⏰ Каждый день в <input type="time" value="10:00" step="900" aria-label="Время напоминания"></label>
    <button type="button" class="btn-family" data-act="remind">Добавить в календарь</button></div>
    <p class="hint-small">Откроется календарь телефона — он сам напомнит «Пора заниматься» со ссылкой на Qaita.</p>`;
}
export function wireReminder(root) {
  root.querySelector('[data-act="remind"]')?.addEventListener('click', (e) => {
    downloadReminder(root.querySelector('.reminder input')?.value || '10:00');
    e.currentTarget.textContent = 'Готово ✓ — сохраните в календаре';
  });
}
