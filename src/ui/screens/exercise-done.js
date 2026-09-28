// Экран 7 — Итоги упражнения [E]: ★★★, грядка с цветами и ростками, «+50 за исправление».
// Никаких процентов и градусов: только звёзды, растения и слова.
import { html } from '../dom.js';
import { icons } from '../icons.js';
import { createRing } from '../components/ring.js';
import { EXERCISE_INFO, SESSION_PLAN } from '../exercises.js';

const TITLE = { 3: 'Идеально!', 2: 'Отлично!', 1: 'Хорошее начало!', 0: 'Попробуем ещё' };
const SAY = { 3: 'Три звезды! Идеально, без единой ошибки', 2: 'Две звезды! Отлично', 1: 'Одна звезда. Хорошее начало', 0: 'Ничего страшного, попробуем ещё' };

export default function exerciseDone(ctx, { index = 0, result }) {
  const next = SESSION_PLAN[index + 1];
  const r = result ?? { stars: 0, plants: [], corrected: 0, bonus: 0, score: 0 };
  const el = html(`
    <section class="xdone" aria-labelledby="xdone-title">
      <p class="demo-step">${EXERCISE_INFO[SESSION_PLAN[index]]?.title ?? ''}</p>
      <div class="xdone-stars" aria-label="${r.stars} из 3 звёзд">
        ${[1, 2, 3].map((n) => `<span class="big-star" data-on="${n <= r.stars}">${icons.star}</span>`).join('')}
      </div>
      <h1 id="xdone-title">${TITLE[r.stars]}</h1>
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
        [{ transform: 'translateY(30%) scale(0.5)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 380, delay: 650 + i * 110, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'backwards' },
      ));
      const fix = r.corrected ? ` Плюс ${r.bonus} очков за исправление.` : '';
      ctx.say(`${SAY[r.stars]}.${fix} ${next ? 'Покажите ладонь, чтобы перейти дальше' : 'Покажите ладонь, чтобы увидеть ваш сад'}`, { interrupt: true, hint: true });
    },
    onGesture: (g) => ring.handle(g),
    destroy: () => ring.destroy(),
  };
}
