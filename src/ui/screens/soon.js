// Заглушка [E] для экранов, которые ещё строим. Ладонь — вернуться в начало.
import { html } from '../dom.js';
import { createRing } from '../components/ring.js';

export default function soon(ctx) {
  const el = html(`
    <section style="align-items:center;justify-content:center;gap:24px;text-align:center">
      <h1 style="font-size:var(--fs-title)">Скоро здесь будет следующий шаг</h1>
      <div class="ring-slot"></div>
      <p class="ring-label">Ладонь — в начало</p>
    </section>`);
  const ring = createRing({ onFire: () => ctx.go('welcome') });
  el.querySelector('.ring-slot').replaceWith(ring.el);
  return { el, onGesture: (g) => ring.handle(g), destroy: () => ring.destroy() };
}
