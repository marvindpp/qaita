// Экран 3 — Выбор руки [E]. «Поднимите руку, которую тренируем»: жест RAISE_LEFT / RAISE_RIGHT.
// Видео зеркальное, поэтому левая рука человека — слева на экране: карточки стоят там же, где рука.
import { html } from '../dom.js';
import { icons } from '../icons.js';
import { createRing } from '../components/ring.js';

const NAME = { left: 'Левую', right: 'Правую' };

export default function hand(ctx) {
  const el = html(`
    <section class="hand" aria-labelledby="hand-title">
      <div class="hand-head">
        <h1 id="hand-title">Какую руку тренируем?</h1>
        <p class="lead">Поднимите её вверх и подержите</p>
      </div>
      <div class="hand-main">
        <div class="hand-pick" data-side="left"><div class="ring-slot"></div><p class="ring-label">Левую</p></div>
        <div class="cam-slot"></div>
        <div class="hand-pick" data-side="right"><div class="ring-slot"></div><p class="ring-label">Правую</p></div>
      </div>
    </section>`);

  const rings = {};
  for (const side of ['left', 'right']) {
    const ring = createRing({
      gesture: side === 'left' ? 'RAISE_LEFT' : 'RAISE_RIGHT',
      icon: icons.armUp(side),
      onFire: () => pick(side),
    });
    rings[side] = ring;
    el.querySelector(`.hand-pick[data-side="${side}"] .ring-slot`).replaceWith(ring.el);
  }

  function pick(side) {
    ctx.state.side = side;
    ctx.engine.setSide(side);
    ctx.say(`Тренируем ${NAME[side].toLowerCase()} руку`, { force: true });
    ctx.go('calibration');
  }

  return {
    el,
    wantsStatus: true,
    enter() {
      ctx.camera.mount(el.querySelector('.cam-slot'));
      ctx.say('Какую руку тренируем? Поднимите её вверх и подержите');
    },
    onGesture(g) {
      const side = g.type === 'RAISE_LEFT' ? 'left' : g.type === 'RAISE_RIGHT' ? 'right' : null;
      if (!side) return false;
      el.querySelector(`.hand-pick[data-side="${side}"]`).dataset.active = String(g.progress > 0 && !g.fired);
      return rings[side].handle(g);
    },
    destroy() { rings.left.destroy(); rings.right.destroy(); },
  };
}
