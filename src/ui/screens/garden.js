// Экран 8 — Итоги сессии «Ваш сад» [E]. Слова вместо цифр: «рука поднялась выше, чем в прошлый раз».
// Каждое упражнение — грядка: чистый повтор = цветок, с исправлением = росток. Прошлые дни растут на заднем плане.
import { html, esc } from '../dom.js';
import { icons } from '../icons.js';
import { createRing } from '../components/ring.js';
import { EXERCISE_INFO } from '../exercises.js';
import { loadSessions, saveSession, streakDays, dayKey, amplitudeOf } from '../storage.js';

const plural = (n, one, few, many) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};

function compareWords(now, prev, first) {
  if (first) return 'Первая тренировка — сад посажен!';
  if (prev == null || now == null) return 'Вы снова занимались — сад растёт!';
  if (now > prev + 2) return 'Рука поднялась выше, чем в прошлый раз!';
  if (now >= prev - 2) return 'Рука поднимается так же высоко — стабильно!';
  return 'Сегодня чуть ниже — это нормально. Главное — без боли';
}

/** Собрать и сохранить сессию один раз (повторный вход на экран не дублирует запись). */
function recordSession(ctx) {
  const session = ctx.state.session ?? { results: [] };
  const history = loadSessions();
  if (session.record) return { record: session.record, history: session.history };
  const summary = ctx.engine.getSummary();
  const results = session.results ?? [];
  const record = {
    date: new Date().toISOString(),
    day: dayKey(),
    side: summary.side,
    durationSec: summary.durationSec,
    totalReps: summary.totalReps,
    accuracy: summary.accuracy,
    mistakesCorrected: summary.mistakesCorrected,
    exercises: summary.exercises,
    score: results.reduce((s, r) => s + r.score, 0),
    stars: results.reduce((s, r) => s + r.stars, 0),
    maxStars: results.length * 3,
    beds: results.map((r) => ({ id: r.exercise, plants: r.plants })),
  };
  if (results.length) saveSession(record); // пустую сессию (сразу открыли экран) в историю не пишем
  session.record = record;
  session.history = history;
  ctx.state.session = session;
  return { record, history };
}

export default function garden(ctx) {
  const { record, history } = recordSession(ctx);
  const all = [...history, record];
  const prev = history[history.length - 1];
  const streak = streakDays(all);
  const clean = record.beds.length > 0 && record.beds.every((b) => b.plants.every((p) => p === 'flower'));
  const badges = [
    history.length === 0 && { icon: icons.flower, title: 'Первый шаг', text: 'Первая тренировка' },
    clean && { icon: icons.star, title: 'Без компенсаций', text: 'Ни одной ошибки' },
    streak >= 3 && { icon: icons.sun, title: `${streak} ${plural(streak, 'день', 'дня', 'дней')} подряд`, text: 'Сад растёт каждый день' },
  ].filter(Boolean);
  // Прошлые дни: последние ростки/цветы из истории — «сад пышнее с каждым днём».
  const old = history.flatMap((s) => (s.beds ?? []).flatMap((b) => b.plants)).slice(-16);

  const el = html(`
    <section class="garden" aria-labelledby="garden-title">
      <div class="garden-head stagger">
        <h1 id="garden-title">Ваш сад</h1>
        <p class="lead">${esc(compareWords(amplitudeOf(record), amplitudeOf(prev), !prev))}</p>
      </div>
      <div class="garden-scene">
        ${old.length ? `<div class="garden-old" aria-hidden="true">${old.map((p) => (p === 'flower' ? icons.flower : icons.sprout)).join('')}</div>` : ''}
        <div class="garden-beds">
          ${record.beds.map((b) => `
            <figure class="garden-bed">
              <div class="garden-plants">${b.plants.map((p) => `<span data-plant="${p}">${p === 'flower' ? icons.flower : icons.sprout}</span>`).join('')}</div>
              <figcaption>${EXERCISE_INFO[b.id]?.title ?? b.id}</figcaption>
            </figure>`).join('')}
        </div>
      </div>
      <div class="garden-chips">
        <span class="pill pill-gold">${icons.star}${record.stars} из ${record.maxStars} звёзд</span>
        ${streak < 3 ? `<span class="pill pill-green">${icons.sun}${streak} ${plural(streak, 'день', 'дня', 'дней')} подряд</span>` : ''}
        ${badges.map((b) => `<span class="badge">${b.icon}<span><b>${b.title}</b><small>${b.text}</small></span></span>`).join('')}
      </div>
      <div class="garden-go">
        <div class="ring-slot"></div>
        <div><p class="ring-label">Показать врачу</p><p class="ring-sub">покажите ладонь</p></div>
      </div>
    </section>`);

  const ring = createRing({ onFire: () => ctx.go('doctor') });
  el.querySelector('.ring-slot').replaceWith(ring.el);

  return {
    el,
    enter() {
      let i = 0;
      el.querySelectorAll('.garden-plants span').forEach((p) => p.animate(
        [{ transform: 'translateY(35%) scale(0.4)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 420, delay: 300 + (i++) * 70, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'backwards' },
      ));
      el.querySelectorAll('.badge').forEach((b, k) => b.animate(
        [{ transform: 'scale(0.8)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 360, delay: 500 + i * 70 + k * 140, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'backwards' },
      ));
      ctx.sound.done();
      const words = compareWords(amplitudeOf(record), amplitudeOf(prev), !prev);
      ctx.say(`Ваш сад. ${words}. ${record.stars} ${plural(record.stars, 'звезда', 'звезды', 'звёзд')}. Покажите ладонь, чтобы открыть отчёт для врача`, { interrupt: true, hint: true });
    },
    onGesture: (g) => ring.handle(g),
    destroy: () => ring.destroy(),
  };
}
