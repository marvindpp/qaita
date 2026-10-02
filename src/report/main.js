// Кабинет врача [D]: report.html#doctor=… — история пациента приходит в ссылке (src/ui/report-link.js).
// Камеры, движка и сервера здесь нет: только расшифровать ссылку и показать прогресс понятными цифрами.
import '../../styles/main.css';
import '../../styles/report.css';
import { decodeReport } from '../ui/report-link.js';
import { amplitudeChart, MISTAKE_NAMES } from '../ui/screens/doctor.js';
import { EXERCISE_INFO } from '../ui/exercises.js';
import { GOALS } from '../ui/life.js';
import { amplitudeOf } from '../ui/storage.js';
import { esc, plural } from '../ui/dom.js';
import { rxUrl, rxAdherence, RX_REPS, RX_PER_DAY } from '../ui/rx.js';
import { qrSvg } from '../ui/qr.js';
import { EXERCISES } from '../contract.js';

const root = document.getElementById('report');
const fmt = (day, o = { day: 'numeric', month: 'long' }) => new Date(`${day}T12:00:00`).toLocaleDateString('ru-RU', o);
const short = (day) => fmt(day, { day: '2-digit', month: '2-digit' });

/** Компенсации: первая половина тренировок против второй — стали реже или чаще (на повтор). */
function trend(sessions) {
  const half = Math.floor(sessions.length / 2);
  if (half < 1) return '';
  const rate = (list) => {
    const reps = list.reduce((a, s) => a + s.totalReps, 0) || 1;
    const out = {};
    for (const s of list) for (const e of s.exercises) for (const [c, n] of Object.entries(e.mistakes)) out[c] = (out[c] ?? 0) + n;
    return Object.fromEntries(Object.entries(out).map(([c, n]) => [c, n / reps]));
  };
  const a = rate(sessions.slice(0, half));
  const b = rate(sessions.slice(half));
  const codes = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((c) => MISTAKE_NAMES[c]);
  if (!codes.length) return '<p class="muted">Компенсаций не было.</p>';
  const rows = codes.map((c) => {
    const x = a[c] ?? 0, y = b[c] ?? 0;
    const dir = y < x * 0.8 ? ['down', '↓ реже'] : y > x * 1.25 ? ['up', '↑ чаще'] : ['same', '≈ так же'];
    return `<tr><th scope="row">${esc(MISTAKE_NAMES[c])}</th><td>${Math.round(x * 100)}%</td><td>${Math.round(y * 100)}%</td><td class="cab-trend" data-dir="${dir[0]}">${dir[1]}</td></tr>`;
  }).join('');
  return `<table class="cab-table">
    <thead><tr><th scope="col">Компенсация</th><th scope="col">Первые ${half} ${plural(half, 'тренировка', 'тренировки', 'тренировок')}</th><th scope="col">Последние ${sessions.length - half}</th><th scope="col">Динамика</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <p class="cab-small">Доля повторов, в которых Qaita заметила компенсацию.</p>`;
}

const ROM_IDS = { reach_up: 'сгибание в плечевом (рука вверх)', reach_side: 'отведение в плечевом (рука в сторону)' };
const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);

/** Сводка за 30 секунд: врачу на приёме 15 минут — сначала главное и красные флажки, потом детали. */
export function brief(r) {
  const s = r.sessions;
  const lastDay = s.at(-1).day;
  const since = daysBetween(lastDay, r.at);
  const window14 = s.filter((x) => daysBetween(x.day, r.at) < 14);
  const days14 = new Set(window14.map((x) => x.day)).size;
  const reps = s.reduce((a, x) => a + x.totalReps, 0);
  const flags = [];
  const rom = [];
  for (const [id, name] of Object.entries(ROM_IDS)) {
    const vals = s.map((x) => x.exercises.find((e) => e.id === id)?.bestRomDeg).filter((v) => v > 0);
    if (vals.length < 1) continue;
    const a = vals[0], b = vals.at(-1), d = b - a;
    rom.push(`${name}: ${a}° → ${b}°${vals.length > 1 ? ` (${d >= 0 ? '+' : ''}${d}°)` : ''}`);
    if (vals.length > 2 && d <= -10) flags.push({ lvl: 'red', t: `Подъём руки снизился: ${name.split(' (')[0]} ${a}° → ${b}°` });
    else if (vals.length > 1 && d >= 10) flags.push({ lvl: 'ok', t: `Рука поднимается выше: +${d}° (${name.split(' (')[0]})` });
  }
  if (since >= 3) flags.push({ lvl: 'red', t: `Не занимается ${since} ${plural(since, 'день', 'дня', 'дней')} (последняя тренировка ${short(lastDay)})` });
  if (days14 >= 10) flags.push({ lvl: 'ok', t: `Регулярно: ${days14} из 14 дней` });
  else if (days14 <= 4) flags.push({ lvl: 'warn', t: `Редко: ${days14} из 14 дней — обсудите, что мешает` });
  const half = Math.floor(s.length / 2);
  const rate = (list) => list.reduce((a, x) => a + x.exercises.reduce((b, e) => b + Object.values(e.mistakes).reduce((c, n) => c + n, 0), 0), 0) / (list.reduce((a, x) => a + x.totalReps, 0) || 1);
  let comp = '';
  if (half >= 1) {
    const x = rate(s.slice(0, half)), y = rate(s.slice(half));
    comp = `компенсации: ${Math.round(x * 100)}% → ${Math.round(y * 100)}% повторов`;
    if (y > x * 1.25 && y > 0.2) flags.push({ lvl: 'warn', t: `Компенсаций больше: ${Math.round(x * 100)}% → ${Math.round(y * 100)}% повторов — возможно, нагрузка велика` });
    else if (y < x * 0.8 && x > 0.1) flags.push({ lvl: 'ok', t: `Компенсаций меньше: ${Math.round(x * 100)}% → ${Math.round(y * 100)}% повторов` });
  }
  const side = s.at(-1).side === 'left' ? 'левая' : 'правая';
  const text = [
    `Домашние упражнения для руки (Qaita, оценка по веб-камере), ${short(s[0].day)}–${short(lastDay)}.`,
    `Рабочая рука: ${side}. Тренировок: ${s.length}, дней с занятиями за 14 дн.: ${days14}, повторов: ${reps}.`,
    rom.length ? `Активный объём движений: ${rom.join('; ')}.` : '',
    comp ? `Динамика: ${comp}.` : '',
    `Углы — оценка по видео, не гониометрия.`,
  ].filter(Boolean).join(' ');
  return { flags, text };
}

function calendar(sessions, at) {
  const days = new Set(sessions.map((s) => s.day));
  const end = new Date(`${at}T12:00:00`);
  const cells = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(end);
    d.setDate(d.getDate() - 13 + i);
    const key = d.toISOString().slice(0, 10);
    return `<span class="cab-day" data-on="${days.has(key)}" title="${d.toLocaleDateString('ru-RU')}">${d.getDate()}</span>`;
  });
  return `<div class="cab-cal">${cells.join('')}</div>`;
}

/** Было ли назначение и как выполняется: «назначено / сделано» — главный вопрос врача на приёме. */
function rxBlock(r) {
  if (!r.rx) return '';
  const a = rxAdherence(r.rx, r.sessions, r.at);
  const pct = Math.round(a.share * 100);
  const names = r.rx.ex.map((id) => EXERCISE_INFO[id]?.title ?? id).join(', ');
  return `<section class="cab-card"><h2>Ваше назначение от ${fmt(r.rx.at)}</h2>
    <p>${esc(names)} — по ${r.rx.reps} повт., ${r.rx.perDay} р. в день${r.rx.note ? ` · «${esc(r.rx.note)}»` : ''}</p>
    <div class="cab-adh"><div class="cab-adh-bar"><span style="width:${pct}%"></span></div><b>${pct}%</b></div>
    <p class="cab-small">Выполнено ${a.done} из ${a.need} назначенных тренировок за ${a.days} ${plural(a.days, 'день', 'дня', 'дней')}.</p></section>`;
}

/** Форма «Назначить упражнения»: врач выбирает — пациент сканирует QR, и Qaita занимается по этому плану. */
function prescribeForm(r) {
  const cur = r.rx ?? { ex: [...new Set(r.sessions.flatMap((s) => s.exercises.map((e) => e.id)))], reps: 5, perDay: 1, note: '' };
  return `<section class="cab-card cab-rx" id="prescribe"><h2>${r.rx ? 'Изменить назначение' : 'Назначить упражнения'}</h2>
    <p class="cab-small">Пациент отсканирует QR своим телефоном или откроет ссылку — Qaita сама будет заниматься с ним по этому плану.</p>
    <form class="cab-form">
      <fieldset><legend>Упражнения</legend>${EXERCISES.map((id) => `<label class="cab-check"><input type="checkbox" name="ex" value="${id}" ${cur.ex.includes(id) ? 'checked' : ''}> ${EXERCISE_INFO[id].title}</label>`).join('')}</fieldset>
      <fieldset><legend>Повторов каждого</legend>${RX_REPS.map((n) => `<label class="cab-pill"><input type="radio" name="reps" value="${n}" ${n === cur.reps ? 'checked' : ''}><span>${n}</span></label>`).join('')}</fieldset>
      <fieldset><legend>Раз в день</legend>${RX_PER_DAY.map((n) => `<label class="cab-pill"><input type="radio" name="perDay" value="${n}" ${n === cur.perDay ? 'checked' : ''}><span>${n}</span></label>`).join('')}</fieldset>
      <label class="cab-field">Врач (необязательно)<input name="doctor" maxlength="40" placeholder="Например, д-р Ахметова" value="${esc(cur.doctor ?? '')}"></label>
      <label class="cab-field">Комментарий пациенту<input name="note" maxlength="160" placeholder="Например, медленно, без боли" value="${esc(cur.note ?? '')}"></label>
      <button type="submit" class="cab-print">📲 Получить QR для пациента</button>
    </form>
    <div class="cab-rx-out" hidden></div>
  </section>`;
}

function wirePrescribe() {
  const form = root.querySelector('.cab-form');
  const out = root.querySelector('.cab-rx-out');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const rx = { ex: f.getAll('ex'), reps: Number(f.get('reps')), perDay: Number(f.get('perDay')), note: f.get('note'), doctor: f.get('doctor'), at: new Date().toISOString().slice(0, 10) };
    if (!rx.ex.length) { out.hidden = false; out.innerHTML = '<p class="cab-warn">Выберите хотя бы одно упражнение.</p>'; return; }
    const url = await rxUrl(rx);
    out.hidden = false;
    out.innerHTML = `<div class="cab-rx-qr">${qrSvg(url)}</div><div><p><b>Покажите QR пациенту</b> — пусть наведёт камеру телефона. Или отправьте ссылку:</p>
      <p class="cab-link">${esc(url)}</p><button type="button" class="cab-copy-btn">📋 Скопировать ссылку</button></div>`;
    out.querySelector('.cab-copy-btn').addEventListener('click', async (ev) => {
      try { await navigator.clipboard.writeText(url); ev.currentTarget.textContent = 'Скопировано ✓'; } catch { prompt('Скопируйте ссылку', url); }
    });
    out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

function render(r) {
  const s = r.sessions;
  const goal = GOALS.find((g) => g.id === r.goal);
  const amps = s.map(amplitudeOf).filter(Boolean);
  const first = amps[0], best = amps.length ? Math.max(...amps) : null;
  const reps = s.reduce((a, x) => a + x.totalReps, 0);
  const days = new Set(s.map((x) => x.day)).size;
  const b = brief(r);
  const rows = [...s].reverse().map((x) => {
    const comp = x.exercises.flatMap((e) => Object.entries(e.mistakes).map(([c, n]) => `${MISTAKE_NAMES[c] ?? 'другое'} ×${n}`));
    const ex = x.exercises.map((e) => `${EXERCISE_INFO[e.id]?.title ?? e.id}${e.bestRomDeg ? ` ${e.bestRomDeg}°` : ''}`);
    return `<tr><th scope="row">${short(x.day)}</th><td>${x.side === 'left' ? 'левая' : 'правая'}</td><td>${Math.round(x.durationSec / 60)} мин</td><td>${x.totalReps}</td><td>${Math.round(x.accuracy * 100)}%</td><td>${esc(ex.join(', '))}</td><td>${comp.length ? esc(comp.join(', ')) : '—'}</td></tr>`;
  }).join('');

  root.innerHTML = `
    <header class="cab-head">
      <div>
        <p class="cab-kicker">Qaita · кабинет врача</p>
        <h1>${esc(r.name || 'Пациент')}</h1>
        <p class="muted">${s.length ? `${fmt(s[0].day)} — ${fmt(s.at(-1).day)}` : ''}${goal ? ` · цель: ${goal.emoji} ${esc(goal.short)}` : ''} · ссылка от ${fmt(r.at)}</p>
      </div>
      <button type="button" class="cab-print">🖨 Сохранить PDF</button>
    </header>
    <section class="cab-card cab-brief">
      <h2>Главное за 30 секунд</h2>
      <ul class="cab-flags">${b.flags.map((f) => `<li data-lvl="${f.lvl}">${esc(f.t)}</li>`).join('') || '<li data-lvl="ok">Без тревожных изменений</li>'}</ul>
      <div class="cab-copy">
        <p class="cab-copy-text">${esc(b.text)}</p>
        <button type="button" class="cab-copy-btn">📋 Скопировать в медкарту</button>
      </div>
    </section>
    <div class="cab-tiles">
      <div class="cab-tile"><b>${s.length}</b><span>${plural(s.length, 'тренировка', 'тренировки', 'тренировок')}</span></div>
      <div class="cab-tile"><b>${days}</b><span>${plural(days, 'день', 'дня', 'дней')} с занятиями</span></div>
      <div class="cab-tile"><b>${reps}</b><span>${plural(reps, 'повтор', 'повтора', 'повторов')}</span></div>
      <div class="cab-tile"><b>${best ? `${best}°` : '—'}</b><span>лучший подъём руки${best && first && best > first ? ` · <em>+${best - first}°</em>` : ''}</span></div>
    </div>
    <div class="cab-grid">
      <section class="cab-card"><h2>Подъём руки по тренировкам</h2>${amplitudeChart(s)}</section>
      <section class="cab-card"><h2>Регулярность · 14 дней</h2>${calendar(s, r.at)}</section>
    </div>
    ${rxBlock(r)}
    <section class="cab-card"><h2>Компенсации: стало лучше?</h2>${trend(s)}</section>
    <section class="cab-card cab-wide"><h2>Тренировки</h2>
      <div class="cab-scroll"><table class="cab-table">
        <thead><tr><th scope="col">Дата</th><th scope="col">Рука</th><th scope="col">Время</th><th scope="col">Повт.</th><th scope="col">Точность</th><th scope="col">Упражнения и лучший угол</th><th scope="col">Компенсации</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </section>
    ${prescribeForm(r)}
    <p class="cab-note">🔒 Данные пришли в самой ссылке и хранятся только у вас в браузере — сервера у Qaita нет. Углы — оценка по обычной веб-камере, не замер гониометром. Qaita не медицинское изделие и не ставит диагноз.</p>`;
  root.querySelector('.cab-print').addEventListener('click', () => window.print());
  wirePrescribe();
  root.querySelector('.cab-copy-btn').addEventListener('click', async (e) => {
    try { await navigator.clipboard.writeText(b.text); e.currentTarget.textContent = 'Скопировано ✓'; } catch { prompt('Скопируйте текст', b.text); }
  });
}

const payload = new URLSearchParams(location.hash.slice(1)).get('doctor');
const data = payload ? await decodeReport(payload) : null;
if (data?.sessions.length) render(data);
else {
  // Без ссылки — врач пришёл назначить упражнения новому пациенту; битая ссылка — честно говорим.
  root.innerHTML = payload
    ? `<section class="cab-empty"><p class="cab-kicker">Qaita · кабинет врача</p><h1>Ссылка не открылась</h1>
      <p class="muted">Попросите пациента ещё раз нажать «Ссылка для врача» в Qaita и прислать её целиком — или отсканировать QR-код с его экрана.</p></section>`
    : `<section class="cab-empty"><p class="cab-kicker">Qaita · кабинет врача</p><h1>Назначьте упражнения пациенту</h1>
      <p class="muted">Выберите упражнения ниже и покажите пациенту QR — Qaita будет заниматься с ним дома по вашему плану и подсказывать, если он компенсирует корпусом. Прогресс пациент пришлёт вам кнопкой «Ссылка для врача».</p></section>`;
  root.insertAdjacentHTML('beforeend', prescribeForm({ sessions: [], rx: null }));
  wirePrescribe();
}
