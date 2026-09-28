// Мелкие помощники для DOM [E]: без фреймворка, экраны собираются из шаблонных строк.

/** Элемент из HTML-строки (один корневой узел). */
export function html(str) {
  const t = document.createElement('template');
  t.innerHTML = str.trim();
  return /** @type {HTMLElement} */ (t.content.firstElementChild);
}

export const $ = (root, sel) => root.querySelector(sel);

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Экранировать текст движка перед вставкой в HTML. */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
