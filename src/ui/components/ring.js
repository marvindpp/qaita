// Кольцо hold-to-confirm [E]: заполняется от `gesture.progress` движка, на `fired` — «галочка» и действие.
// Кнопок нет: это единственный способ «нажать» в приложении.
import { html } from '../dom.js';
import { icons } from '../icons.js';

const R = 46;
const C = 2 * Math.PI * R;
const FIRE_DELAY_MS = 260; // дать увидеть полное кольцо и галочку, прежде чем сменится экран

// Общий звук «да» для всех колец — подключает app.js.
let onAnyFire = null;
export const setRingFireHook = (fn) => { onAnyFire = fn; };
// Кольцо «оживает» не сразу: пока голос договаривает фразу экрана (и минимум ARM_MIN_MS), жест не срабатывает.
// Иначе поднятая ладонь «пролетала» экраны один за другим, а голос не успевал (живой тест 29.09).
// Ладонь, поднятая ещё на прошлом экране, не считается — её нужно опустить и показать снова.
// НО новый жест, начатый на этом экране, не теряем (живой тест 29.09, вечер: «рука выбирается не с первого раза,
// на ладонь не реагирует»): кольцо заполняется сразу, а если движок засчитал жест раньше времени — кольцо
// срабатывает, как только оживёт. Ждём голос не дольше ARM_MAX_MS: длинная фраза не должна «глушить» жест.
const ARM_MIN_MS = 1500, ARM_MAX_MS = 3000, RELEASE_GAP_MS = 400, CARRIED_MS = 350;
let isBusy = () => false;
export const setRingBusyHook = (fn) => { isBusy = fn; };

/**
 * @param {{ gesture?: string, icon?: string, center?: HTMLElement, onFire?: () => void, onProgress?: (p:number) => void }} opts
 */
export function createRing({ gesture = 'PALM_HOLD', icon = icons.palm, center = null, onFire, onProgress } = {}) {
  const el = html(`
    <div class="ring" data-active="false" data-fired="false" data-disabled="false">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle class="ring-track" cx="50" cy="50" r="${R}" stroke-width="7" fill="none"/>
        <circle class="ring-fill" cx="50" cy="50" r="${R}" stroke-width="7" fill="none"
          stroke-dasharray="${C}" stroke-dashoffset="${C}"/>
      </svg>
      <div class="ring-core">${icon}</div>
    </div>`);
  const fill = el.querySelector('.ring-fill');
  if (center) el.querySelector('.ring-core').replaceWith(center);

  let disabled = false, fired = false, progress = 0, timer = null;
  const createdAt = performance.now();
  let armed = false, carried = false, pending = false, armTimer = null, lastEventAt = -Infinity, seen = false;
  const canArm = (now) => now - createdAt >= ARM_MIN_MS && (!isBusy() || now - createdAt >= ARM_MAX_MS);

  function fire() {
    fired = true;
    draw(1);
    el.dataset.fired = 'true';
    onAnyFire?.();
    timer = setTimeout(() => onFire?.(), FIRE_DELAY_MS);
  }
  // Жест засчитан движком до того, как кольцо ожило: ждём и срабатываем, как только можно.
  function waitArm() {
    clearTimeout(armTimer);
    armTimer = setTimeout(() => {
      if (fired || disabled) return;
      if (!canArm(performance.now())) { waitArm(); return; }
      armed = true;
      if (pending) fire();
    }, 150);
  }

  function draw(p) {
    progress = p;
    fill.style.strokeDashoffset = String(C * (1 - p));
    el.dataset.active = String(p > 0 && !fired);
  }

  return {
    el,
    /** Передать событие `gesture`. Возвращает true, если жест предназначен этому кольцу. */
    handle(g) {
      if (g.type !== gesture) return false;
      if (disabled || fired) return true;
      const now = performance.now();
      if (!armed) {
        const released = g.progress === 0 || (seen && now - lastEventAt >= RELEASE_GAP_MS);
        // Первое же событие пришло сразу после появления экрана с поднятой ладонью — это ладонь с прошлого экрана.
        if (!seen && g.progress > 0 && now - createdAt < CARRIED_MS) carried = true;
        seen = true;
        lastEventAt = now;
        if (carried) {
          if (!released || g.fired) return true; // ждём, пока старую ладонь опустят
          carried = false;
        }
        if (!canArm(now)) {
          // Новый жест: кольцо заполняется сразу (человек видит, что его заметили), срабатывает — когда оживёт.
          el.dataset.draining = String(g.progress === 0);
          if (g.fired) { pending = true; draw(1); waitArm(); return true; }
          pending = false;
          draw(g.progress);
          onProgress?.(g.progress);
          return true;
        }
        armed = true;
      }
      lastEventAt = now;
      el.dataset.draining = String(g.progress === 0);
      if (g.fired) { fire(); return true; }
      draw(g.progress);
      onProgress?.(g.progress);
      return true;
    },
    setDisabled(v) {
      disabled = Boolean(v);
      el.dataset.disabled = String(disabled);
      if (disabled && progress > 0) { el.dataset.draining = 'true'; draw(0); }
    },
    reset() {
      clearTimeout(timer);
      pending = false;
      fired = false;
      el.dataset.fired = 'false';
      el.dataset.draining = 'true';
      draw(0);
    },
    get progress() { return progress; },
    destroy() { clearTimeout(timer); clearTimeout(armTimer); },
  };
}
