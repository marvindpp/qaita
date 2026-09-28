// Экран 9 — «Показать врачу» [E]. Здесь можно цифры: повторы, точность, углы, ошибки по кодам, график по сессиям.
// Одна карточка, которую удобно сфотографировать на телефон и показать на приёме.
import { html, esc } from '../dom.js';
import { icons } from '../icons.js';
import { createRing } from '../components/ring.js';
import { EXERCISE_INFO } from '../exercises.js';
import { loadSessions, streakDays, amplitudeOf } from '../storage.js';

export const MISTAKE_NAMES = {
  TRUNK_LEAN_FORWARD: 'наклон корпуса вперёд',
  TRUNK_LEAN_SIDE: 'наклон корпуса вбок',
  SHOULDER_HIKE: 'подъём плеча к уху',
  ELBOW_BENT: 'согнутый локоть',
  TOO_FAST: 'слишком быстро',
  INCOMPLETE_ROM: 'неполная амплитуда',
  WRONG_HAND: 'помогала другая рука',
  FINGERS_NOT_OPEN: 'пальцы не раскрыты',
};

const fmtDate = (iso) => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
const fmtShort = (iso) => new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
const fmtDur = (sec) => `${Math.floor(sec / 60)} мин ${String(sec % 60).padStart(2, '0')} с`;

/** Линия «подъём руки по сессиям»: один ряд — без легенды, название в заголовке, подписи только у ключевых точек. */
function amplitudeChart(sessions) {
  const pts = sessions.map((s) => ({ v: amplitudeOf(s), d: s.date })).filter((p) => p.v != null).slice(-14);
  if (pts.length < 2) {
    return `<p class="chart-empty">${pts.length ? `Сегодня: <b>${pts[0].v}°</b>. ` : ''}График появится после второй тренировки.</p>`;
  }
  const W = 800, H = 260, L = 56, R = 64, T = 28, B = 44;
  const vals = pts.map((p) => p.v);
  const lo = Math.max(0, Math.floor((Math.min(...vals) - 10) / 10) * 10);
  const hi = Math.min(180, Math.ceil((Math.max(...vals) + 10) / 10) * 10);
  const x = (i) => L + (i * (W - L - R)) / (pts.length - 1);
  const y = (v) => T + ((hi - v) * (H - T - B)) / (hi - lo || 1);
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  const best = vals.indexOf(Math.max(...vals));
  const last = pts.length - 1;
  return `
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Подъём руки по тренировкам, от ${vals[0]}° до ${vals[last]}°">
      ${ticks.map((t) => `<g class="chart-grid"><line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text x="${L - 10}" y="${y(t)}" text-anchor="end" dominant-baseline="middle">${t}°</text></g>`).join('')}
      <polyline class="chart-line" points="${pts.map((p, i) => `${x(i)},${y(p.v)}`).join(' ')}"/>
      ${pts.map((p, i) => `<g class="chart-pt"><circle cx="${x(i)}" cy="${y(p.v)}" r="7"/><title>${fmtShort(p.d)}: ${p.v}°</title></g>`).join('')}
      ${[...new Set([best, last])].map((i) => `<text class="chart-label" x="${x(i)}" y="${y(pts[i].v) - 16}" text-anchor="middle">${pts[i].v}°</text>`).join('')}
      <text class="chart-axis" x="${x(0)}" y="${H - 12}" text-anchor="start">${fmtShort(pts[0].d)}</text>
      <text class="chart-axis" x="${x(last)}" y="${H - 12}" text-anchor="end">${fmtShort(pts[last].d)}</text>
    </svg>`;
}

export default function doctor(ctx) {
  const sessions = loadSessions();
  const s = ctx.state.session?.record ?? sessions[sessions.length - 1];
  const streak = streakDays(sessions);

  const rows = (s?.exercises ?? []).map((e) => {
    const m = Object.entries(e.mistakes ?? {}).filter(([, n]) => n > 0).map(([c, n]) => `${MISTAKE_NAMES[c] ?? c} ×${n}`);
    return `<tr><th scope="row">${EXERCISE_INFO[e.id]?.title ?? e.id}</th><td>${e.reps}</td><td>${e.bestRomDeg ? `${e.bestRomDeg}°` : '—'}</td><td>${m.length ? esc(m.join(', ')) : 'без ошибок'}</td></tr>`;
  }).join('');

  const el = html(`
    <section class="doctor" aria-labelledby="doctor-title">
      <article class="report">
        <header class="report-head">
          <div>
            <p class="demo-step">Qaita · отчёт для врача</p>
            <h1 id="doctor-title">${s ? fmtDate(s.date) : 'Нет данных'}</h1>
            <p class="muted">${s ? `${s.side === 'left' ? 'Левая' : 'Правая'} рука · ${fmtDur(s.durationSec)} · занятий подряд: ${streak}` : 'Пройдите тренировку, и здесь появится отчёт'}</p>
          </div>
          <div class="doctor-go">
            <div class="ring-slot"></div>
            <div><p class="ring-label">Новая тренировка</p><p class="ring-sub">покажите ладонь</p></div>
          </div>
        </header>
        ${s ? `
        <div class="tiles">
          <div class="tile"><b>${s.totalReps}</b><span>повторов</span></div>
          <div class="tile"><b>${Math.round(s.accuracy * 100)}%</b><span>точность</span></div>
          <div class="tile"><b>${s.mistakesCorrected}</b><span>ошибок исправлено</span></div>
          <div class="tile"><b>${amplitudeOf(s) ?? '—'}${amplitudeOf(s) ? '°' : ''}</b><span>подъём руки</span></div>
        </div>
        <div class="report-grid">
          <figure class="chart-box">
            <figcaption>Подъём руки по тренировкам</figcaption>
            ${amplitudeChart(sessions)}
          </figure>
          <table class="report-table">
            <thead><tr><th scope="col">Упражнение</th><th scope="col">Повт.</th><th scope="col">Угол</th><th scope="col">Компенсации</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>` : ''}
        <p class="report-note">${icons.lock}Данные хранятся только на этом устройстве. Qaita не ставит диагноз и не заменяет врача.</p>
      </article>
    </section>`);

  // Новая тренировка = перезагрузка: движок копит итоги с запуска страницы, а так сессия начнётся с нуля.
  // Разрешение на камеру браузер помнит — второй раз не спросит.
  const ring = createRing({
    onFire: () => {
      const q = new URLSearchParams(location.search);
      q.delete('screen');
      location.search = q.toString();
    },
  });
  el.querySelector('.ring-slot').replaceWith(ring.el);

  return {
    el,
    enter() { ctx.say('Отчёт для врача. Сфотографируйте экран и покажите на приёме. Чтобы начать новую тренировку, покажите ладонь', { interrupt: true, hint: true }); },
    onGesture: (g) => ring.handle(g),
    destroy: () => ring.destroy(),
  };
}
