// Кольцо hold-to-confirm [E]: заполняется от `gesture.progress` движка, на `fired` — «галочка» и действие.
// Кнопок нет: это единственный способ «нажать» в приложении.
import { html } from '../dom.js';
import { icons } from '../icons.js';

const R = 46;
const C = 2 * Math.PI * R;
const FIRE_DELAY_MS = 260; // дать увидеть полное кольцо и галочку, прежде чем сменится экран

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
      el.dataset.draining = String(g.progress === 0);
      if (g.fired) {
        fired = true;
        draw(1);
        el.dataset.fired = 'true';
        timer = setTimeout(() => onFire?.(), FIRE_DELAY_MS);
        return true;
      }
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
      fired = false;
      el.dataset.fired = 'false';
      el.dataset.draining = 'true';
      draw(0);
    },
    get progress() { return progress; },
    destroy() { clearTimeout(timer); },
  };
}
