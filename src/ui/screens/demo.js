// Экран 5 — Демо перед упражнением [E]. Человечек показывает движение, 1 фраза крупно + голос.
// Исследования: пожилым нужна «картинка-превью» движения (docs/PLAN.md §9). Дальше — только по ладони.
import { html } from '../dom.js';
import { createRing } from '../components/ring.js';
import { EXERCISE_INFO, SESSION_PLAN, whyFor } from '../exercises.js';
import { loadGoal } from '../life.js';
import { demoFigure } from '../demo-figure.js';

export default function demo(ctx, { index = 0 } = {}) {
  const id = SESSION_PLAN[index];
  if (!id) return { el: html('<section></section>'), enter: () => queueMicrotask(() => ctx.go('garden')) };
  const info = EXERCISE_INFO[id];
  const side = ctx.state.side ?? 'right';
  const goal = loadGoal();
  const why = goal && whyFor(goal.id, id);

  const el = html(`
    <section class="demo" aria-labelledby="demo-title">
      <div class="demo-card">${demoFigure(id, side)}</div>
      <div class="demo-side stagger">
        <p class="demo-step">Упражнение ${index + 1} из ${SESSION_PLAN.length}</p>
        <h1 id="demo-title">${info.title}</h1>
        <p class="lead">${info.phrase}</p>
        ${why ? `<p class="demo-why"><span aria-hidden="true">${goal.emoji}</span> ${why}</p>` : ''}
        <div class="demo-go">
          <div class="ring-slot"></div>
          <div><p class="ring-label">Покажите ладонь</p><p class="ring-sub">когда будете готовы</p></div>
        </div>
      </div>
    </section>`);

  const ring = createRing({ onFire: () => ctx.go('play', { index }) });
  el.querySelector('.ring-slot').replaceWith(ring.el);

  return {
    el,
    enter() { ctx.say(`${info.say}.${why ? ` Это ${why}.` : ''} Покажите ладонь, когда будете готовы`, { interrupt: true, hint: true }); },
    onGesture: (g) => ring.handle(g),
    destroy: () => ring.destroy(),
  };
}
