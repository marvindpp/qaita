// Назначение врача по QR: врач в кабинете (report.html) выбирает упражнения, число повторов и сколько раз в день —
// получается ссылка index.html?rx=… Пациент сканирует QR, и Qaita сама занимается по этому плану (вместо плана «под цель»).
// Сервера нет: назначение живёт в ссылке и в localStorage пациента.
import { EXERCISES } from '../contract.js';
import { packJson, unpackJson } from './report-link.js';
import { dayKey, loadSessions } from './storage.js';

const KEY = 'qaita.rx.v1';
export const RX_REPS = [3, 5, 8, 10];
export const RX_PER_DAY = [1, 2, 3];

/** Проверка и нормализация: из ссылки может прийти что угодно. */
export function normalizeRx(r) {
  if (!r || typeof r !== 'object') return null;
  const ex = (Array.isArray(r.ex) ? r.ex : []).filter((id) => EXERCISES.includes(id));
  if (!ex.length) return null;
  return {
    ex: [...new Set(ex)].slice(0, 5),
    reps: RX_REPS.includes(r.reps) ? r.reps : 5,
    perDay: RX_PER_DAY.includes(r.perDay) ? r.perDay : 1,
    note: String(r.note ?? '').slice(0, 160),
    doctor: String(r.doctor ?? '').slice(0, 40),
    at: typeof r.at === 'string' ? r.at.slice(0, 10) : dayKey(),
  };
}

export function loadRx() {
  try { return normalizeRx(JSON.parse(localStorage.getItem(KEY) ?? 'null')); } catch { return null; }
}
export function saveRx(rx) {
  const n = normalizeRx(rx);
  try { if (n) localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* приватный режим */ }
  return n;
}
export function clearRx() {
  try { localStorage.removeItem(KEY); } catch { /* приватный режим */ }
}

export const encodeRx = (rx) => packJson({ v: 1, ...normalizeRx(rx) });
export async function decodeRx(payload) {
  const d = await unpackJson(payload);
  return d?.v === 1 ? normalizeRx(d) : null;
}

/** Ссылка для пациента (index.html рядом с report.html). */
export async function rxUrl(rx, base = location.href) {
  return `${new URL('./', base).href}?rx=${await encodeRx(rx)}`;
}

/** Пришли по ссылке врача (?rx=…): сохранить назначение и убрать его из адресной строки. @returns назначение или null */
export async function takeRxFromUrl() {
  const q = new URLSearchParams(location.search);
  const payload = q.get('rx');
  if (!payload) return null;
  const rx = await decodeRx(payload);
  q.delete('rx');
  history.replaceState(null, '', `${location.pathname}${q.toString() ? `?${q}` : ''}${location.hash}`);
  return rx ? saveRx(rx) : null;
}

/** Сколько тренировок сегодня и сколько назначено. */
export function rxToday(rx = loadRx(), sessions = loadSessions()) {
  if (!rx) return null;
  const today = dayKey();
  return { done: sessions.filter((s) => s.day === today).length, need: rx.perDay };
}

/** Выполнение назначения за дни с даты назначения (для кабинета врача): сделано / назначено тренировок, 0..1. */
export function rxAdherence(rx, sessions, until) {
  if (!rx) return null;
  const from = new Date(`${rx.at}T12:00:00`);
  const to = new Date(`${until}T12:00:00`);
  const days = Math.max(1, Math.round((to - from) / 86400000) + 1);
  const byDay = {};
  for (const s of sessions) if (s.day >= rx.at && s.day <= until) byDay[s.day] = (byDay[s.day] ?? 0) + 1;
  const done = Object.values(byDay).reduce((a, n) => a + Math.min(n, rx.perDay), 0);
  const need = days * rx.perDay;
  return { done, need, days, share: Math.min(1, done / need) };
}
