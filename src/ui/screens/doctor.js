// Экран 9 — «Показать врачу» [E]. Здесь можно цифры: повторы, точность, углы, ошибки по кодам, график по сессиям.
// Одна карточка, которую удобно сфотографировать на телефон и показать на приёме.
import { html, esc } from '../dom.js';
import { icons } from '../icons.js';
import { createRing } from '../components/ring.js';
import { EXERCISE_INFO } from '../exercises.js';
import { loadSessions, streakDays, amplitudeOf, dayKey } from '../storage.js';
import '../../../styles/doctor-print.css'; // кнопка «Сохранить PDF» + печатная версия (@media print)

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

/** Название ошибки словами. Неизвестный код не показываем врачу как «SOME_CODE». */
const mistakeName = (code) => MISTAKE_NAMES[code] ?? 'другая ошибка';

// Иконки только этого экрана: принтер на кнопке и «палец вверх» в кольце жеста.
const ICON_PRINTER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/></svg>';
const ICON_THUMB = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10v11"/><path d="M15 5.9 14 10h5.8a2 2 0 0 1 1.9 2.6l-2.3 7A2 2 0 0 1 17.5 21H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h2.8a2 2 0 0 0 1.8-1.1L12 2a3.1 3.1 0 0 1 3 3.9z"/></svg>';

const fmtDate = (iso) => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
const fmtShort = (iso) => new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
const fmtDur = (sec) => `${Math.floor(sec / 60)} мин ${String(sec % 60).padStart(2, '0')} с`;

/** Линия «подъём руки по сессиям»: один ряд — без легенды, название в заголовке, подписи только у ключевых точек. */
function amplitudeChart(sessions) {
  const pts = sessions.map((s) => ({ v: amplitudeOf(s), d: s.date })).filter((p) => p.v != null).slice(-14);
  if (pts.length < 2) {
    return `<p class="chart-empty">${pts.length ? `Сегодня: <b>${pts[0].v}°</b>. ` : ''}График появится после второй тренировки.</p>`;
  }
  // На телефоне SVG сжимается до ширины экрана: берём узкую «бумагу», чтобы подписи не стали мельче 14px.
  const narrow = typeof innerWidth === 'number' && innerWidth < 600;
  const W = narrow ? 440 : 800, H = narrow ? 240 : 260, L = 56, R = narrow ? 40 : 64, T = 28, B = 44;
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

const plural = (n, one, few, many) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};
const sessionDay = (s) => s.day ?? dayKey(new Date(s.date));

/** Печать: лучший угол (bestRomDeg) каждого упражнения по дням — максимум за день, последние 14 дней. */
function romByDays(sessions) {
  const days = new Map();
  for (const s of sessions) {
    const d = sessionDay(s);
    const row = days.get(d) ?? { date: s.date, rom: {} };
    for (const e of s.exercises ?? []) {
      if (e.bestRomDeg > 0) row.rom[e.id] = Math.max(row.rom[e.id] ?? 0, e.bestRomDeg);
    }
    days.set(d, row);
  }
  const rows = [...days.values()].filter((r) => Object.keys(r.rom).length).slice(-14);
  if (!rows.length) return '<p class="print-empty">Углов пока нет.</p>';
  const ids = Object.keys(EXERCISE_INFO).filter((id) => rows.some((r) => r.rom[id]));
  return `
    <table class="print-table">
      <thead><tr><th scope="col">День</th>${ids.map((id) => `<th scope="col">${EXERCISE_INFO[id].title}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r) => `<tr><th scope="row">${fmtShort(r.date)}</th>${ids.map((id) => `<td>${r.rom[id] ? `${r.rom[id]}°` : '—'}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;
}

/** Печать: ошибки по типам — в этой тренировке и за все сохранённые тренировки (hist уже включает s). */
function mistakesByType(s, hist) {
  const count = (list) => {
    const out = {};
    for (const x of list) for (const e of x?.exercises ?? []) {
      for (const [c, n] of Object.entries(e.mistakes ?? {})) if (n > 0) out[c] = (out[c] ?? 0) + n;
    }
    return out;
  };
  const now = count([s]);
  const all = count(hist);
  const total = hist.length;
  const codes = Object.keys(all).sort((a, b) => all[b] - all[a]);
  if (!codes.length) return '<p class="print-empty">Ошибок не было.</p>';
  return `
    <table class="print-table">
      <thead><tr><th scope="col">Что было не так</th><th scope="col">В этой тренировке</th><th scope="col">За ${total} ${plural(total, 'тренировку', 'тренировки', 'тренировок')}</th></tr></thead>
      <tbody>${codes.map((c) => `<tr><th scope="row">${esc(mistakeName(c))}</th><td>${now[c] ?? 0}</td><td>${all[c]}</td></tr>`).join('')}</tbody>
    </table>`;
}

export default function doctor(ctx) {
  const sessions = loadSessions();
  const s = ctx.state.session?.record ?? sessions[sessions.length - 1];
  const streak = streakDays(sessions);
  // Текущая сессия уже в истории (garden.js сохраняет её), но это копия из localStorage — сверяем по дате.
  const hist = s && !sessions.some((x) => x.date === s.date) ? [...sessions, s] : sessions;

  const rows = (s?.exercises ?? []).map((e) => {
    const m = Object.entries(e.mistakes ?? {}).filter(([, n]) => n > 0).map(([c, n]) => `${mistakeName(c)} ×${n}`);
    return `<tr><th scope="row">${EXERCISE_INFO[e.id]?.title ?? e.id}</th><td>${e.reps}</td><td>${e.bestRomDeg ? `${e.bestRomDeg}°` : '—'}</td><td>${m.length ? esc(m.join(', ')) : 'без ошибок'}</td></tr>`;
  }).join('');

  const el = html(`
    <section class="doctor" data-fit="scroll" aria-labelledby="doctor-title">
      <article class="report">
        <header class="report-head">
          <div>
            <p class="demo-step">Qaita · отчёт для врача</p>
            <h1 id="doctor-title">${s ? fmtDate(s.date) : 'Нет данных'}</h1>
            <p class="muted">${s ? `Рабочая рука: ${s.side === 'left' ? 'левая' : 'правая'} · ${fmtDur(s.durationSec)} · занятий подряд: ${streak}` : 'Пройдите тренировку, и здесь появится отчёт'}</p>
          </div>
          <div class="doctor-actions">
            <div class="doctor-go">
              <div class="ring-slot"></div>
              <div><p class="ring-label">Новая тренировка</p><p class="ring-sub">покажите ладонь</p></div>
            </div>
            ${s ? `
            <button type="button" class="doctor-pdf">
              <span class="pdf-ring-slot"></span>
              <span><span class="ring-label">${ICON_PRINTER}Сохранить PDF</span><span class="ring-sub">нажмите или покажите палец вверх</span></span>
            </button>` : ''}
          </div>
        </header>
        <p class="print-only print-disclaimer">Qaita — не медицинское изделие. Цифры — оценка по обычной веб-камере. Это не диагноз и не замена осмотра врача или реабилитолога.</p>
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
        </div>
        <section class="print-only print-block">
          <h2>Лучший угол по дням</h2>
          ${romByDays(hist)}
          <p class="print-small">Максимум за день по каждому упражнению. Угол — оценка по веб-камере, не замер гониометром.</p>
        </section>
        <section class="print-only print-block">
          <h2>Ошибки по типам</h2>
          ${mistakesByType(s, hist)}
        </section>` : ''}
        <aside class="stroke-signs" aria-label="Признаки инсульта">
          <h2>Признаки инсульта — звоните <b>103</b></h2>
          <p><b>Лицо</b> перекосилось · <b>Рука</b> не поднимается · <b>Речь</b> невнятная · <b>Время</b> — звонить сразу, не ждать</p>
        </aside>
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

  // «Сохранить PDF»: окно печати браузера → «Сохранить как PDF». Кнопку можно нажать мышью,
  // а можно показать «палец вверх» (на этом экране палец занят печатью, а не повтором подсказки).
  const pdfBtn = el.querySelector('.doctor-pdf');
  let pdfRing = null;
  const savePdf = () => {
    ctx.voice.stop?.();
    window.print();
    pdfRing?.reset();
  };
  if (pdfBtn) {
    pdfRing = createRing({ gesture: 'THUMBS_UP', icon: ICON_THUMB, onFire: savePdf });
    el.querySelector('.pdf-ring-slot').replaceWith(pdfRing.el);
    pdfBtn.addEventListener('click', savePdf);
  }

  return {
    el,
    enter() {
      const pdf = pdfBtn ? ' Чтобы сохранить отчёт, покажите палец вверх.' : '';
      ctx.say(`Отчёт для врача. Сфотографируйте экран и покажите на приёме.${pdf} Чтобы начать новую тренировку, покажите ладонь`, { interrupt: true, hint: true });
    },
    onGesture: (g) => ring.handle(g) || Boolean(pdfRing?.handle(g)),
    destroy: () => { ring.destroy(); pdfRing?.destroy(); },
  };
}
