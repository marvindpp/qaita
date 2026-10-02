// Экран 8 — Итоги сессии «Ваш сад» [E]. Слова вместо цифр: «рука поднялась выше, чем в прошлый раз».
// Каждое упражнение — грядка: чистый повтор = цветок, с исправлением = росток. Прошлые дни растут на заднем плане.
import { html, esc, prefersReducedMotion } from '../dom.js';
import { icons } from '../icons.js';
import { createRing } from '../components/ring.js';
import { EXERCISE_INFO } from '../exercises.js';
import { loadSessions, saveSession, streakDays, dayKey, amplitudeOf } from '../storage.js';
import { loadGoal, giveTask, addDose, doseToday, DAILY_DOSE, lifeFlowers } from '../life.js';
import { makeCard } from '../share.js';
import { gardenLife } from '../motion.js';
import { openShareSheet, shareText, openVoiceStudio, playMessageCard, listMessages } from '../family.js';
import { shanyrakScene, yurtCaption, YURT_STAGES, YURT_FULL } from '../shanyrak.js';

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
  if (results.length) {
    saveSession(record); // пустую сессию (сразу открыли экран) в историю не пишем
    addDose(record.totalReps);
    giveTask(loadGoal()); // задание из жизни на сегодня — спросим о нём на следующем занятии
  }
  session.record = record;
  session.history = history;
  ctx.state.session = session;
  return { record, history };
}

export default function garden(ctx) {
  const { record, history } = recordSession(ctx);
  const all = [...history, record];
  // «Выше, чем в прошлый раз» — сравниваем с прошлым занятием ТОЙ ЖЕ рукой, а не с другой.
  const prev = history.filter((s) => !s.side || !record.side || s.side === record.side).at(-1);
  const streak = streakDays(all);
  const goal = loadGoal();
  const dose = doseToday();
  const life = lifeFlowers();
  const clean = record.beds.length > 0 && record.beds.every((b) => b.plants.every((p) => p === 'flower'));
  const badges = [
    history.length === 0 && { icon: icons.flower, title: 'Первый шаг', text: 'Первая тренировка' },
    clean && { icon: icons.star, title: 'Без компенсаций', text: 'Ни одной ошибки' },
    streak >= 3 && { icon: icons.sun, title: `${streak} ${plural(streak, 'день', 'дня', 'дней')} подряд`, text: 'Дом растёт каждый день' },
  ].filter(Boolean);
  // Прошлые дни: последние ростки/цветы из истории — «сад пышнее с каждым днём».
  const old = history.flatMap((s) => (s.beds ?? []).flatMap((b) => b.plants)).slice(-30);
  // «Шаңырақ»: каждый новый день занятий добавляет часть юрты (shanyrak.js).
  const days = new Set(all.map((s) => s.day)).size;
  const newToday = !history.some((s) => s.day === record.day);

  const el = html(`
    <section class="garden" aria-labelledby="garden-title">
      <div class="garden-head stagger">
        <h1 id="garden-title">Ваш дом и сад</h1>
        <p class="lead">${esc(compareWords(amplitudeOf(record), amplitudeOf(prev), !prev))}</p>
      </div>
      <div class="garden-scene sh-wrap">
        ${shanyrakScene({ days, newToday, todayPlants: record.beds.flatMap((b) => b.plants), oldPlants: old, streak })}
      </div>
      <p class="sh-caption">${newToday && days < YURT_FULL ? `✨ Сегодня: ${esc(YURT_STAGES[days])} · ` : ''}${esc(yurtCaption(days))}</p>
      <div class="garden-chips">
        ${record.maxStars ? `<span class="pill pill-gold">${icons.star}${record.stars} из ${record.maxStars} ${plural(record.maxStars, 'звезды', 'звёзд', 'звёзд')}</span>` : ''}
        ${streak < 3 ? `<span class="pill pill-green">${icons.sun}${streak} ${plural(streak, 'день', 'дня', 'дней')} подряд</span>` : ''}
        ${badges.map((b) => `<span class="badge">${b.icon}<span><b>${b.title}</b><small>${b.text}</small></span></span>`).join('')}
      </div>
      <div class="garden-life">
        ${goal ? `<p class="life-task"><span class="life-ico" aria-hidden="true">${goal.emoji}</span><span><b>Задание на сегодня</b>${esc(goal.task)}</span></p>` : ''}
        <p class="life-dose"><span class="dose-bar" style="--p:${Math.min(1, dose / DAILY_DOSE)}"></span><span><b>${dose} из ${DAILY_DOSE}</b> повторов сегодня${dose < DAILY_DOSE ? ' — ещё 3 минуты после обеда' : ' — норма дня!'}</span></p>
        ${life ? `<p class="pill pill-green">💐 ${life} ${plural(life, 'раз', 'раза', 'раз')} рука помогла в жизни</p>` : ''}
        <div class="life-family">
          <button type="button" class="btn-family" data-act="share">📤 Отправить детям</button>
          <button type="button" class="btn-family" data-act="voice">💌 Голос близких</button>
        </div>
      </div>
      <div class="garden-go">
        <div class="ring-slot"></div>
        <div><p class="ring-label">Показать врачу</p><p class="ring-sub">покажите ладонь</p></div>
      </div>
    </section>`);

  const ring = createRing({ onFire: () => ctx.go('doctor') });
  let alive = true, stopFx = null;

  // ——— Семья (PLAN §9г) ———
  const plantsAll = record.beds.flatMap((b) => b.plants);
  const flowers = plantsAll.filter((p) => p === 'flower').length;
  const words = compareWords(amplitudeOf(record), amplitudeOf(prev), !prev);
  el.querySelector('[data-act="share"]').addEventListener('click', () => openShareSheet(el, {
    text: shareText({ reps: record.totalReps, flowers, words, goal, streak }),
    makeBlob: () => makeCard({ flowers, sprouts: plantsAll.length - flowers, reps: record.totalReps, words, goal, streak, lifeDone: life }),
    onSent: () => ctx.say('Отправлено. Близкие будут рады', { interrupt: true }),
  }));

  // Голос близких: открывается студия записи (записывает внук/дочь), послание звучит в конце каждого занятия.
  const voiceBtn = el.querySelector('[data-act="voice"]');
  let closeStudio = null;
  const syncVoice = () => listMessages().then((l) => { if (alive) voiceBtn.textContent = l.length ? `💌 Голос близких · ${l.length}` : '💌 Записать голос близких'; });
  syncVoice();
  voiceBtn.addEventListener('click', () => {
    closeStudio = openVoiceStudio(el, { onSaved: () => { syncVoice(); ctx.say('Послание сохранено. Оно прозвучит в конце следующего занятия', { interrupt: true }); } });
  });
  el.querySelector('.ring-slot').replaceWith(ring.el);

  return {
    el,
    enter() {
      // Сначала встаёт солнце (чем больше дней подряд, тем выше), потом из земли по одному растут растения.
      const reduce = prefersReducedMotion();
      el.querySelector('.sh-sun')?.animate(
        reduce ? [{ opacity: 0 }, { opacity: 1 }] : [{ transform: 'translateY(60%)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: reduce ? 200 : 900, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'backwards' },
      );
      let i = 0;
      el.querySelectorAll('.garden-plants span').forEach((p) => p.animate( // (грядки теперь на экране итогов упражнения)
        reduce ? [{ opacity: 0 }, { opacity: 1 }] : [{ transform: 'scale(0.6, 0.05)', opacity: 0 }, { opacity: 1, offset: 0.3 }, { transform: 'none', opacity: 1 }],
        { duration: reduce ? 200 : 560, delay: 450 + (i++) * 80, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'backwards' },
      ));
      el.querySelectorAll('.badge').forEach((b, k) => b.animate(
        [{ transform: 'scale(0.8)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 360, delay: 500 + i * 70 + k * 140, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'backwards' },
      ));
      ctx.sound.done();
      stopFx = gardenLife(el, { clean }); // ветер качает растения; все повторы чистые — пролетает бабочка
      // Если близкие записали послание — оно звучит после слов тренера (самое тёплое — в конце).
      setTimeout(() => { if (alive) playMessageCard(el, ctx); }, 9000);
      ctx.say(`Ваш сад. ${/[.!?]$/.test(words) ? words : `${words}.`} ${record.stars} ${plural(record.stars, 'звезда', 'звезды', 'звёзд')}. Покажите ладонь, чтобы открыть отчёт для врача`, { interrupt: true, hint: true });
    },
    // Пока открыто окно «Отправить» / «Голос близких» — жесты не уводят с экрана.
    onGesture: (g) => (el.querySelector('.sheet') ? true : ring.handle(g)),
    destroy: () => { alive = false; stopFx?.(); closeStudio?.(); ring.destroy(); },
  };
}
