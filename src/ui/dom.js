// Мелкие помощники для DOM [E]: без фреймворка, экраны собираются из шаблонных строк.

/** Элемент из HTML-строки (один корневой узел). */
export function html(str) {
  const t = document.createElement('template');
  t.innerHTML = str.trim();
  return /** @type {HTMLElement} */ (t.content.firstElementChild);
}

export const $ = (root, sel) => root.querySelector(sel);

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Склонение по числу: plural(5, 'день', 'дня', 'дней') → «дней». */
export const plural = (n, one, few, many) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};

/** Экранировать текст движка перед вставкой в HTML. */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
