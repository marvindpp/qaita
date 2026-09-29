// «Мой прогресс и рекорды»: главное доказательство «становится лучше» (боль «дальше не поправлюсь», PLAN §9в).
// Всё из истории в браузере: плитки, календарь 4 недель, график подъёма руки, личные рекорды, награды.
import { html, esc, plural } from '../dom.js';
import { loadSessions, streakDays, dayKey } from '../storage.js';
import { EXERCISE_INFO } from '../exercises.js';
import { lifeFlowers, loadGoal } from '../life.js';
import { amplitudeChart } from './doctor.js';
import { loadProfile } from '../profile.js';

function longestStreak(sessions) {
  const days = [...new Set(sessions.map((s) => s.day))].sort();
  let best = 0, run = 0, prev = null;
  for (const d of days) {
    const cur = new Date(d);
    run = prev && (cur - prev) / 86400000 === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = cur;
  }
  return best;
}

export function computeProgress(sessions) {
  const totalReps = sessions.reduce((s, x) => s + (x.totalReps ?? 0), 0);
  const flowers = sessions.reduce((s, x) => s + (x.beds ?? []).flatMap((b) => b.plants).filter((p) => p === 'flower').length, 0);
  const records = {};
  for (const s of sessions) for (const e of s.exercises ?? []) {
    const r = records[e.id] ?? { best: 0, bestDay: null, first: e.bestRomDeg || 0, reps: 0, sessions: 0 };
    if ((e.bestRomDeg ?? 0) > r.best) { r.best = e.bestRomDeg; r.bestDay = s.day; }
    r.reps += e.reps ?? 0;
    r.sessions += 1;
    records[e.id] = r;
  }
  const clean = sessions.some((s) => s.beds?.length && s.beds.every((b) => b.plants.every((p) => p === 'flower')));
  return { totalReps, flowers, records, streak: streakDays(sessions), longest: longestStreak(sessions), days: new Set(sessions.map((s) => s.day)).size, clean };
}

export default function progress(ctx) {
  const sessions = loadSessions();
  const p = computeProgress(sessions);
  const life = lifeFlowers();
  const goal = loadGoal();
  const prof = loadProfile();
  const trained = new Set(sessions.map((s) => s.day));
  const today = new Date();
  const cal = Array.from({ length: 28 }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() - 27 + i); return d; });
  const badges = [
    { ico: '🌱', t: 'Первый шаг', d: 'Первая тренировка', ok: sessions.length > 0 },
    { ico: '🔥', t: '3 дня подряд', d: 'Привычка начинается', ok: p.longest >= 3 },
    { ico: '🏆', t: 'Неделя', d: '7 дней подряд', ok: p.longest >= 7 },
    { ico: '💯', t: '100 повторов', d: 'Сотня движений', ok: p.totalReps >= 100 },
    { ico: '⭐', t: 'Без компенсаций', d: 'Все повторы чистые', ok: p.clean },
    { ico: '💐', t: 'Рука в жизни', d: 'Задание дня выполнено', ok: life > 0 },
    { ico: '🚀', t: '500 повторов', d: 'Настоящий марафон', ok: p.totalReps >= 500 },
  ];
  const rows = Object.entries(p.records);

  const el = html(`
    <section class="progress" aria-labelledby="progress-title">
      <header class="page-head">
        <p class="demo-step">${esc(prof.avatar)} ${esc(prof.name || 'Мой Qaita')}</p>
        <h1 id="progress-title">Мой прогресс</h1>
        ${goal ? `<p class="lead">${goal.emoji} Цель: ${esc(goal.short)}</p>` : ''}
      </header>
      <div class="page-scroll">
        <div class="stat-tiles">
          <div class="stat"><b>${p.days}</b><span>${plural(p.days, 'день', 'дня', 'дней')} занятий</span></div>
          <div class="stat"><b>${p.streak}</b><span>подряд сейчас · рекорд ${p.longest}</span></div>
          <div class="stat"><b>${p.totalReps}</b><span>${plural(p.totalReps, 'повтор', 'повтора', 'повторов')} всего</span></div>
          <div class="stat"><b>${p.flowers}</b><span>🌸 ${plural(p.flowers, 'цветок', 'цветка', 'цветов')} в саду</span></div>
          <div class="stat"><b>${life}</b><span>💐 раз рука помогла в жизни</span></div>
        </div>

        <section class="card">
          <h2>Последние 4 недели</h2>
          <div class="calendar">${cal.map((d) => `<span class="cal-day" data-on="${trained.has(dayKey(d))}" data-today="${dayKey(d) === dayKey(today)}" title="${d.toLocaleDateString('ru-RU')}">${d.getDate()}</span>`).join('')}</div>
        </section>

        <section class="card">
          <h2>Подъём руки по тренировкам</h2>
          ${amplitudeChart(sessions)}
        </section>

        <section class="card">
          <h2>🏅 Мои рекорды</h2>
          ${rows.length ? `<table class="records">
            <thead><tr><th>Упражнение</th><th>Лучший подъём</th><th>Рост</th><th>Повторов</th></tr></thead>
            <tbody>${rows.map(([id, r]) => `<tr><th scope="row">${EXERCISE_INFO[id]?.title ?? id}</th><td>${r.best ? `<b>${r.best}°</b>` : '—'}</td><td>${r.best && r.best > r.first ? `<span class="up">▲ ${r.best - r.first}°</span>` : '—'}</td><td>${r.reps}</td></tr>`).join('')}</tbody>
          </table>` : '<p class="chart-empty">Рекорды появятся после первой тренировки.</p>'}
        </section>

        <section class="card">
          <h2>Награды</h2>
          <div class="badges">${badges.map((b) => `<div class="award" data-ok="${b.ok}"><span>${b.ico}</span><b>${b.t}</b><small>${b.d}</small></div>`).join('')}</div>
        </section>
      </div>
      <div class="page-actions">
        <button type="button" class="btn-start" data-go="welcome">▶ Начать тренировку</button>
        <button type="button" class="btn-ghost" data-go="doctor">🩺 Отчёт врачу</button>
      </div>
    </section>`);
  el.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => ctx.go(b.dataset.go)));

  return {
    el,
    noFit: true,
    enter() { ctx.say(p.days ? `Ваш прогресс. ${p.days} ${plural(p.days, 'день', 'дня', 'дней')} занятий, ${p.totalReps} повторов.` : 'Здесь появится ваш прогресс после первой тренировки'); },
  };
}
