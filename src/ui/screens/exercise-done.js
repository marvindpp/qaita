// Экран 7 — Итоги упражнения [E]: ★★★, грядка с цветами и ростками, «+50 за исправление».
// Никаких процентов и градусов: только звёзды, растения и слова.
// «До / после»: если движок сохранил стоп-кадры (moments), слева ✗ ошибка, справа ✓ «Так правильно!».
import { html } from '../dom.js';
import { icons } from '../icons.js';
import { createRing } from '../components/ring.js';
import { EXERCISE_INFO, SESSION_PLAN } from '../exercises.js';
import { loadGoal, GOAL_EXERCISES } from '../life.js';

const TITLE = { 3: 'Идеально!', 2: 'Отлично!', 1: 'Хорошее начало!', 0: 'Попробуем ещё' };
const SAY = { 3: 'Три звезды! Идеально, без единой ошибки', 2: 'Две звезды! Отлично', 1: 'Одна звезда. Хорошее начало', 0: 'Ничего страшного, попробуем ещё' };

// Первая фраза подсказки движка: «Плечо к уху. Опустите плечо!» → «Плечо к уху».
const firstPhrase = (text = '') => text.split(/(?<=[.!?])\s+/)[0].replace(/[.!]+$/, '');
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const safeImg = (src) => (typeof src === 'string' && src.startsWith('data:image/') ? src : null);

function momentsHtml(m) {
  const bad = safeImg(m?.mistake?.image), good = safeImg(m?.good?.image);
  if (!bad && !good) return '';
  const card = (kind, img, mark, text) => `
    <figure class="moment" data-kind="${kind}">
      <img src="${img}" alt="${esc(text)}">
      <figcaption><span class="moment-mark" aria-hidden="true">${mark}</span>${esc(text)}</figcaption>
    </figure>`;
  return `<div class="xdone-moments">
    ${bad ? card('mistake', bad, '✗', firstPhrase(m.mistake.message) || 'Было так') : ''}
    ${good ? card('good', good, '✓', 'Так правильно!') : ''}
  </div>`;
}

export default function exerciseDone(ctx, { index = 0, result, moments = null }) {
  const next = SESSION_PLAN[index + 1];
  const r = result ?? { stars: 0, plants: [], corrected: 0, bonus: 0, score: 0 };
  const cards = momentsHtml(moments);
  // Упражнение — не ради звёзд, а ради цели из жизни: «ещё шаг к тому, чтобы самим держать чашку».
  const goal = loadGoal();
  const forGoal = goal && r.stars > 0 && GOAL_EXERCISES[goal.id]?.includes(SESSION_PLAN[index]) ? goal : null;
  const el = html(`
    <section class="xdone" aria-labelledby="xdone-title" data-moments="${cards ? 'true' : 'false'}">
      <div class="xdone-main">
      <p class="demo-step">${EXERCISE_INFO[SESSION_PLAN[index]]?.title ?? ''}</p>
      <div class="xdone-stars" aria-label="${r.stars} из 3 звёзд">
        ${[1, 2, 3].map((n) => `<span class="big-star" data-on="${n <= r.stars}">${icons.star}</span>`).join('')}
      </div>
      <h1 id="xdone-title">${TITLE[r.stars]}</h1>
      ${forGoal ? `<p class="xdone-goal"><span aria-hidden="true">${forGoal.emoji}</span> Это ${forGoal.stepText}</p>` : ''}
      <ul class="xdone-bed" aria-label="Грядка">
        ${r.plants.map((p) => `<li data-plant="${p}">${p === 'flower' ? icons.flower : icons.sprout}</li>`).join('')}
      </ul>
      <div class="xdone-points">
        <span class="pill pill-gold">${icons.star}+${r.score} очков</span>
        ${r.corrected ? `<span class="pill pill-green">${icons.check}+${r.bonus} за исправление</span>` : ''}
      </div>
      <div class="xdone-go">
        <div class="ring-slot"></div>
        <div><p class="ring-label">${next ? `Дальше: ${EXERCISE_INFO[next].title}` : 'Посмотреть ваш сад'}</p><p class="ring-sub">покажите ладонь</p></div>
      </div>
      </div>
      ${cards}
    </section>`);

  const ring = createRing({ onFire: () => ctx.go(next ? 'demo' : 'garden', { index: index + 1 }) });
  el.querySelector('.ring-slot').replaceWith(ring.el);

  return {
    el,
    enter() {
      // Звёзды «падают» по одной, растения вырастают следом.
      el.querySelectorAll('.big-star').forEach((s, i) => s.animate(
        [{ transform: 'scale(0.3) rotate(-30deg)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 420, delay: 150 + i * 160, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'backwards' },
      ));
      el.querySelectorAll('.xdone-bed li').forEach((p, i) => p.animate(
        [{ transform: 'scale(0.6, 0.05)', opacity: 0 }, { opacity: 1, offset: 0.3 }, { transform: 'none', opacity: 1 }],
        { duration: 520, delay: 650 + i * 110, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'backwards' },
      ));
      el.querySelectorAll('.moment').forEach((m, i) => m.animate(
        [{ transform: 'translateY(16px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 420, delay: 500 + i * 250, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'backwards' },
      ));
      const fix = r.corrected ? ` Плюс ${r.bonus} очков за исправление.` : '';
      ctx.say(`${SAY[r.stars]}.${fix}${forGoal ? ` Это ${forGoal.stepText}.` : ''} ${next ? 'Покажите ладонь, чтобы перейти дальше' : 'Покажите ладонь, чтобы увидеть ваш сад'}`, { interrupt: true, hint: true });
    },
    onGesture: (g) => ring.handle(g),
    destroy: () => ring.destroy(),
  };
}
