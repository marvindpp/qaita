// Язык интерфейса: русский (исходный) и қазақша. Переводим на уровне страницы: MutationObserver подменяет русский текст
// на казахский в узлах и атрибутах (aria-label, placeholder, title), голос получает перевод через tr().
// Так все 20 экранов не нужно переписывать: словарь — i18n-kk.js, ключ — русская фраза (числа → #).
import { KK, KK_PATTERNS } from './i18n-kk.js';

const KEY = 'qaita.lang.v1';
export const LANGS = { ru: 'Русский', kk: 'Қазақша' };
let lang = 'ru';
try { lang = localStorage.getItem(KEY) === 'kk' ? 'kk' : 'ru'; } catch { /* приватный режим */ }
const listeners = new Set();

export const getLang = () => lang;
export function setLang(l) {
  lang = l === 'kk' ? 'kk' : 'ru';
  try { localStorage.setItem(KEY, lang); } catch { /* приватный режим */ }
  document.documentElement.lang = lang;
  for (const cb of listeners) cb(lang);
}
export const onLang = (cb) => { listeners.add(cb); return () => listeners.delete(cb); };

const CY = /[А-Яа-яЁё]/;
// Префикс/суффикс без букв (эмодзи, стрелки, знаки) переносим как есть, переводим середину.
const EDGES = /^([^\p{L}\d«]*)([\s\S]*?)([^\p{L}\d»)]*)$/u;

function lookup(s) {
  if (KK[s]) return KK[s];
  const nums = s.match(/\d+/g);
  if (nums) {
    const v = KK[s.replace(/\d+/g, '#')];
    if (v) { let i = 0; return v.replace(/#/g, () => nums[i++] ?? ''); }
  }
  for (const [re, fn] of KK_PATTERNS) { const m = s.match(re); if (m) return fn(m, trCore); }
  return null;
}

function trCore(s) {
  const whole = lookup(s);
  if (whole) return whole;
  const [, pre, core, post] = s.match(EDGES) ?? [null, '', s, ''];
  if ((pre || post) && core !== s) { const c = lookup(core); if (c) return pre + c + post; }
  // Составные фразы: по предложениям, потом по « · ».
  for (const [re, joiner] of [[/(?<=[.!?…])\s+/, ' '], [/\s·\s/, ' · ']]) {
    const parts = s.split(re);
    if (parts.length < 2) continue;
    const out = parts.map((p) => trCore(p));
    if (out.some((x, i) => x !== parts[i])) return out.join(joiner);
  }
  return s;
}

/** Перевод строки на текущий язык (для русского — как есть). */
export function tr(text) {
  if (lang !== 'kk' || !text || !CY.test(text)) return text;
  const lead = text.match(/^\s*/)[0], tail = text.match(/\s*$/)[0];
  const core = text.trim();
  const out = trCore(core);
  return out === core ? text : lead + out + tail;
}

// ——— Перевод страницы ———
const ORIG = new WeakMap(); // узел → русский оригинал (чтобы вернуть русский и не переводить дважды)
const ATTRS = ['aria-label', 'placeholder', 'title', 'alt'];
const SKIP = 'script, style, textarea, .mock-panel, [data-no-tr]';

function fixText(n) {
  if (n.parentElement?.closest(SKIP)) return;
  const cur = n.textContent;
  const prev = ORIG.get(n);
  // Текст поменял сам экран (не мы) — это новый оригинал.
  const orig = prev && prev.out === cur ? prev.ru : cur;
  if (!CY.test(orig) && !prev) return;
  const out = tr(orig);
  ORIG.set(n, { ru: orig, out });
  if (out !== cur) n.textContent = out;
}
function fixAttrs(el) {
  if (el.closest?.(SKIP)) return;
  for (const a of ATTRS) {
    const v = el.getAttribute?.(a);
    if (!v) continue;
    const key = `__ru_${a}`;
    const orig = el[key] && el[`__out_${a}`] === v ? el[key] : v;
    const out = tr(orig);
    el[key] = orig; el[`__out_${a}`] = out;
    if (out !== v) el.setAttribute(a, out);
  }
}
function walk(root) {
  if (!root) return;
  if (root.nodeType === 3) return fixText(root);
  if (root.nodeType !== 1 && root.nodeType !== 9) return;
  if (root.nodeType === 1) fixAttrs(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = w.nextNode(); n; n = w.nextNode()) n.nodeType === 3 ? fixText(n) : fixAttrs(n);
}

let observer = null;
/** Включить перевод страницы (вызывается один раз при старте). */
export function startPageTranslation(root = document.body) {
  document.documentElement.lang = lang;
  observer = new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.type === 'characterData') fixText(m.target);
      else if (m.type === 'attributes') fixAttrs(m.target);
      else m.addedNodes.forEach(walk);
    }
  });
  observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  walk(root);
  onLang(() => walk(root)); // переключили язык — перевести (или вернуть русский) всё, что уже на экране
}
