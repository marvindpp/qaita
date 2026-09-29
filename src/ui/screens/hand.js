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
        <button class="btn-mirror" type="button" aria-pressed="false">
          <span class="mirror-ico" aria-hidden="true">🪞</span>
          <span><b>Рука совсем не поднимается?</b><small>Зеркальная тренировка: двигайте здоровой — на экране двигается больная</small></span>
        </button>
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

  // Зеркальная терапия (PLAN §9г): человек двигает ЗДОРОВОЙ рукой, на экране её отражение — на месте больной.
  // Движок отслеживает здоровую руку, камера отражает картинку. Для тех, кто иначе выпал бы из любого тренажёра.
  let mirror = false;
  const btn = el.querySelector('.btn-mirror');
  function toggleMirror() {
    mirror = !mirror;
    btn.setAttribute('aria-pressed', String(mirror));
    el.querySelector('#hand-title').textContent = mirror ? 'Какая рука ЗДОРОВАЯ?' : 'Какую руку тренируем?';
    el.querySelector('.hand-head .lead').textContent = mirror ? 'Поднимите здоровую руку — на экране она станет больной' : 'Поднимите её вверх и подержите';
    ctx.say(mirror ? 'Зеркальная тренировка. Поднимите здоровую руку и подержите' : 'Какую руку тренируем? Поднимите её вверх и подержите', { interrupt: true, force: true });
  }
  btn.addEventListener('click', toggleMirror);
  // ?mirror=1 — сразу в зеркальный режим (для демо и видео).
  if (new URLSearchParams(location.search).has('mirror')) queueMicrotask(toggleMirror);

  function pick(side) {
    ctx.state.side = side;
    ctx.state.mirror = mirror;
    ctx.engine.setSide(side);
    ctx.camera.setMirror(mirror ? side : null);
    const other = side === 'left' ? 'right' : 'left';
    ctx.say(mirror ? `Зеркало включено. Двигайте ${NAME[side].toLowerCase()} рукой — мозг увидит, что работает ${NAME[other].toLowerCase()}` : `Тренируем ${NAME[side].toLowerCase()} руку`, { force: true });
    ctx.go('goal');
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
