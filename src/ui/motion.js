// Анимации «как в хорошей игре» [E]: искры, конфетти, падающие звёзды, бабочка в саду, вспышка награды.
// Только свои SVG + CSS / Web Animations API, без библиотек и файлов. Всё уважает prefers-reduced-motion:
// тогда без движения (только появление), и никаких искр/конфетти.
// Производительность: анимируем только transform и opacity (их считает видеокарта), элементы удаляются сами.
// На экране игры (play.js) отсюда ничего не вызывается — там камера и распознавание важнее.
import '../../styles/motion.css';
import { prefersReducedMotion } from './dom.js';

export const reduced = () => { try { return prefersReducedMotion(); } catch { return false; } };

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
const GOLD = ['#ffd66b', '#e7a41f', '#fff4c9'];
const GREEN = ['#2ea36e', '#8fd6ae', '#ffd66b'];
const PARTY = ['#ffd66b', '#e7a41f', '#2ea36e', '#f28fb0', '#8fd6ae', '#e0553f'];

// ——— Переходы между экранами: лёгкий подъём + размытие, ≤300 мс ———
export function screenIn(el) {
  const r = reduced();
  return el.animate(
    r ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ opacity: 0, transform: 'translateY(22px) scale(0.985)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
    { duration: r ? 160 : 280, easing: EASE_OUT },
  );
}
export function screenOut(el) {
  const r = reduced();
  return el.animate(
    r ? [{ opacity: 1 }, { opacity: 0 }]
      : [{ opacity: 1, transform: 'none', filter: 'blur(0)' }, { opacity: 0, transform: 'translateY(-12px) scale(0.99)', filter: 'blur(4px)' }],
    { duration: r ? 120 : 180, easing: 'ease-out', fill: 'forwards' },
  );
}

// ——— Слой эффектов поверх всего (не мешает нажатиям, не влияет на вёрстку и автомасштаб экрана) ———
let layer = null;
function fxLayer() {
  if (!layer || !layer.isConnected) {
    layer = document.createElement('div');
    layer.className = 'fx-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.append(layer);
  }
  return layer;
}
function piece(cls, x, y, color, size) {
  const s = document.createElement('i');
  s.className = cls;
  s.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;background:${color}`;
  fxLayer().append(s);
  return s;
}

/** Искры из центра элемента: звезда «приземлилась», награда получена, кольцо сработало. */
export function burstAt(target, { n = 10, colors = GOLD, dist = 80, size = 10 } = {}) {
  if (reduced() || !target?.isConnected) return;
  const b = target.getBoundingClientRect();
  if (!b.width) return;
  const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const d = dist * (0.6 + Math.random() * 0.6);
    const sz = size * (0.6 + Math.random() * 0.7);
    const s = piece('fx-spark', cx - sz / 2, cy - sz / 2, colors[i % colors.length], sz);
    s.animate(
      [{ transform: 'translate(0,0) scale(0.4)', opacity: 1 },
        { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px) scale(1)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${Math.cos(a) * d * 1.15}px, ${Math.sin(a) * d * 1.15 + 14}px) scale(0.2)`, opacity: 0 }],
      { duration: 620 + Math.random() * 200, easing: EASE_OUT },
    ).finished.then(() => s.remove(), () => s.remove());
  }
}

/** Конфетти сверху на весь экран (только ★★★). ~2,5 с, потом элементы удаляются. */
export function confetti({ n = 70 } = {}) {
  if (reduced()) return;
  const w = window.innerWidth, h = window.innerHeight;
  const count = w < 600 ? Math.round(n * 0.6) : n;
  for (let i = 0; i < count; i += 1) {
    const x = Math.random() * w, sz = 8 + Math.random() * 8;
    const c = piece('fx-confetti', x, -20, PARTY[i % PARTY.length], sz);
    if (i % 3 === 0) c.style.borderRadius = '50%';
    const drift = (Math.random() - 0.5) * 220, spin = (Math.random() - 0.5) * 900;
    c.animate(
      [{ transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${drift * 0.6}px, ${h * 0.6}px) rotate(${spin * 0.6}deg)`, opacity: 1, offset: 0.7 },
        { transform: `translate(${drift}px, ${h + 40}px) rotate(${spin}deg)`, opacity: 0.2 }],
      { duration: 2000 + Math.random() * 1400, delay: Math.random() * 500, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', fill: 'backwards' },
    ).finished.then(() => c.remove(), () => c.remove());
  }
}

/**
 * Итоги упражнения: звёзды падают с отскоком (на каждой — искры и «дзынь»), растения вырастают из земли,
 * на ★★★ — конфетти. Возвращает функцию отмены (экран ушёл раньше — таймеры не стреляют).
 */
export function playResult(el, { stars = 0, sound = null } = {}) {
  const r = reduced();
  const timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  const STAR_DUR = 720, STAR_GAP = 240, STAR_START = 150;
  el.querySelectorAll('.big-star').forEach((s, i) => {
    const on = s.dataset.on === 'true';
    const delay = STAR_START + i * STAR_GAP;
    s.animate(
      r ? [{ opacity: 0 }, { opacity: 1 }]
        : on ? [
          { transform: 'translateY(-160px) scale(0.5) rotate(-40deg)', opacity: 0 },
          { transform: 'translateY(0) scale(1.1, 0.9) rotate(0deg)', opacity: 1, offset: 0.55 },
          { transform: 'translateY(-22px) scale(0.96, 1.04)', offset: 0.72 },
          { transform: 'translateY(0) scale(1.04, 0.96)', offset: 0.86 },
          { transform: 'none', opacity: 1 }]
          : [{ transform: 'scale(0.6)', opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: r ? 200 : STAR_DUR, delay, easing: on && !r ? 'cubic-bezier(0.33, 0, 0.3, 1)' : EASE_OUT, fill: 'backwards' },
    );
    if (on) later(delay + STAR_DUR * 0.55, () => { burstAt(s, { n: 12, dist: 90 }); sound?.star?.(); });
  });
  const landed = STAR_START + 2 * STAR_GAP + STAR_DUR * 0.6;
  el.querySelectorAll('.xdone-bed li').forEach((p, i) => p.animate(
    r ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ transform: 'translateY(30%) scale(0.3, 0)', opacity: 0 },
        { transform: 'translateY(0) scale(0.9, 1.18)', opacity: 1, offset: 0.55 },
        { transform: 'scale(1.06, 0.94) rotate(3deg)', offset: 0.78 },
        { transform: 'none', opacity: 1 }],
    { duration: r ? 200 : 680, delay: landed + i * 130, easing: EASE_OUT, fill: 'backwards' },
  ));
  if (stars >= 3) later(landed + 150, () => confetti());
  return () => timers.forEach(clearTimeout);
}

/**
 * Сад: растения качаются от ветра (CSS, motion.css). Если все повторы чистые — пролетает бабочка.
 * Возвращает функцию отмены.
 */
export function gardenLife(el, { clean = false } = {}) {
  el.classList.add('garden-wind');
  if (!clean || reduced()) return () => {};
  const scene = el.querySelector('.garden-scene');
  if (!scene) return () => {};
  const t = setTimeout(() => {
    const b = document.createElement('div');
    b.className = 'butterfly';
    b.setAttribute('aria-hidden', 'true');
    b.innerHTML = `<svg viewBox="0 0 60 48"><g class="bf-wing bf-l"><path d="M29 22C22 4 6 0 3 9s8 18 26 15z" fill="#f28fb0"/><path d="M29 26C18 28 8 38 13 44s14-4 16-16z" fill="#f6b7cc"/><circle cx="12" cy="11" r="3" fill="#fff4c9"/></g><g class="bf-wing bf-r"><path d="M31 22C38 4 54 0 57 9s-8 18-26 15z" fill="#f28fb0"/><path d="M31 26c11 2 21 12 16 18s-14-4-16-16z" fill="#f6b7cc"/><circle cx="48" cy="11" r="3" fill="#fff4c9"/></g><rect x="28" y="14" width="4" height="22" rx="2" fill="#5b3b2a"/><path d="M30 15l-5-8M30 15l5-8" stroke="#5b3b2a" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`;
    scene.append(b);
    b.addEventListener('animationend', (e) => { if (e.target === b) b.remove(); });
  }, 2600);
  return () => clearTimeout(t);
}

/** Кольцо «ладонь» сработало: волна от кольца и искры. */
export function ringBurst(ringEl) {
  if (reduced() || !ringEl?.isConnected) return;
  for (let k = 0; k < 2; k += 1) {
    const w = document.createElement('span');
    w.className = 'ring-wave';
    w.setAttribute('aria-hidden', 'true');
    ringEl.append(w);
    w.animate(
      [{ transform: 'scale(0.9)', opacity: 0.7 }, { transform: `scale(${1.5 + k * 0.25})`, opacity: 0 }],
      { duration: 520, delay: k * 110, easing: EASE_OUT, fill: 'backwards' },
    ).finished.then(() => w.remove(), () => w.remove());
  }
  const d = ringEl.getBoundingClientRect().width * 0.62;
  burstAt(ringEl, { n: 12, colors: GREEN, dist: d || 90, size: 9 });
}

// ——— Награды в «Мой прогресс»: новая — вспышка, искры и «звон» (один раз, запоминаем в браузере) ———
const SEEN_KEY = 'qaita.awardsSeen.v1';
function loadSeen() { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]')); } catch { return new Set(); } }
function saveSeen(set) { try { localStorage.setItem(SEEN_KEY, JSON.stringify([...set])); } catch { /* приватное окно — не страшно */ } }

export function celebrateAwards(el, sound) {
  const seen = loadSeen();
  const fresh = [...el.querySelectorAll('.award[data-ok="true"]')].filter((a) => {
    const id = a.querySelector('b')?.textContent?.trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  if (!fresh.length) return () => {};
  saveSeen(seen);
  const r = reduced();
  const timers = [];
  let order = 0;
  // Награда может быть ниже края экрана — празднуем, когда человек до неё долистал.
  const celebrate = (a) => {
    const k = order++;
    timers.push(setTimeout(() => {
      if (!a.isConnected) return;
      a.dataset.new = 'true';
      if (!r) {
        a.animate(
          [{ transform: 'scale(0.85)', filter: 'brightness(1.6)' }, { transform: 'scale(1.14)', filter: 'brightness(1.25)', offset: 0.45 }, { transform: 'none', filter: 'none' }],
          { duration: 700, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
        );
        burstAt(a, { n: 14, dist: 100 });
      }
      if (sound?.award) sound.award(); else sound?.star?.();
    }, 350 + k * 420));
  };
  let io = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); celebrate(e.target); }
    }, { threshold: 0.6 });
    fresh.forEach((a) => io.observe(a));
  } else fresh.forEach(celebrate);
  return () => { io?.disconnect(); timers.forEach(clearTimeout); };
}

/** Заставка «звезда собирается из искр» (для кольца на приветствии, пока грузится распознавание). */
export function splashStar() {
  const sparks = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return `<circle class="sp-spark" style="--dx:${(Math.cos(a) * 34).toFixed(1)}px;--dy:${(Math.sin(a) * 34).toFixed(1)}px;--d:${i * 70}ms" cx="32" cy="31" r="2.6"/>`;
  }).join('');
  const d = document.createElement('div');
  d.className = 'ring-splash';
  d.setAttribute('aria-hidden', 'true');
  d.innerHTML = `<svg viewBox="0 0 64 64">${sparks}<path class="sp-star" d="M32 13l5.4 11 12.1 1.8-8.8 8.5 2.1 12L32 40.6 21.2 46.3l2.1-12-8.8-8.5 12.1-1.8z"/></svg>`;
  return d;
}
