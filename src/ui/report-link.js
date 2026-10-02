// «Кабинет врача по ссылке»: история тренировок упаковывается прямо в ссылку (после #), сервера нет.
// Врач открывает ссылку или QR у себя — видит прогресс пациента. Всё, что после #, браузер на сервер не отправляет.
// Формат v1: JSON с короткими ключами → deflate-raw → base64url. 14 последних тренировок ≈ 0,5–1 КБ.
import { EXERCISES, MISTAKES } from '../contract.js';

export const REPORT_VERSION = 1;
const MAX_SESSIONS = 14;
// Порядок списков в контракте заморожен — индексы в старых ссылках не «съедут».
const EX_IDS = EXERCISES;
const MISTAKE_CODES = MISTAKES;

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function pipe(bytes, stream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}
const canZip = () => typeof CompressionStream === 'function';

/** Сессии → компактный массив: [день, рука(0/1), секунды, точность%, исправлено, [[упр, повторы, угол, {ошибка: n}]]]. */
export function packSessions(sessions) {
  return sessions.slice(-MAX_SESSIONS).map((s) => [
    s.day ?? String(s.date).slice(0, 10),
    s.side === 'left' ? 0 : 1,
    s.durationSec ?? 0,
    Math.round((s.accuracy ?? 0) * 100),
    s.mistakesCorrected ?? 0,
    (s.exercises ?? []).map((e) => {
      const m = {};
      for (const [code, n] of Object.entries(e.mistakes ?? {})) {
        const i = MISTAKE_CODES.indexOf(code);
        if (i >= 0 && n > 0) m[i] = n;
      }
      return [EX_IDS.indexOf(e.id), e.reps ?? 0, e.bestRomDeg ?? 0, m];
    }),
  ]);
}

export function unpackSessions(rows) {
  return rows.map(([day, side, durationSec, acc, mistakesCorrected, ex]) => {
    const exercises = ex.map(([i, reps, bestRomDeg, m]) => ({
      id: EX_IDS[i] ?? 'unknown',
      reps,
      bestRomDeg,
      mistakes: Object.fromEntries(Object.entries(m).map(([k, n]) => [MISTAKE_CODES[k] ?? 'OTHER', n])),
    }));
    return {
      day, date: `${day}T12:00:00`, side: side ? 'right' : 'left', durationSec, accuracy: acc / 100, mistakesCorrected,
      exercises, totalReps: exercises.reduce((a, e) => a + e.reps, 0),
    };
  });
}

/** @returns {Promise<string>} строка для `#doctor=`: «z» + сжатое или «j» + несжатое (старый браузер). */
export async function encodeReport({ sessions, name = '', goal = '' }) {
  const json = JSON.stringify({ v: REPORT_VERSION, n: name.slice(0, 30), g: goal, at: new Date().toISOString().slice(0, 10), s: packSessions(sessions) });
  const bytes = new TextEncoder().encode(json);
  return canZip() ? `z${b64url(await pipe(bytes, new CompressionStream('deflate-raw')))}` : `j${b64url(bytes)}`;
}

/** @returns {Promise<{name, goal, at, sessions} | null>} null — ссылка битая или от другой версии. */
export async function decodeReport(payload) {
  try {
    const kind = payload[0];
    let bytes = unb64url(payload.slice(1));
    if (kind === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    else if (kind !== 'j') return null;
    const d = JSON.parse(new TextDecoder().decode(bytes));
    if (d.v !== REPORT_VERSION || !Array.isArray(d.s)) return null;
    return { name: d.n ?? '', goal: d.g ?? '', at: d.at, sessions: unpackSessions(d.s) };
  } catch {
    return null;
  }
}

/** Полная ссылка на кабинет врача (report.html рядом с приложением). */
export async function reportUrl(data, base = location.href) {
  return `${new URL('./report.html', base).href}#doctor=${await encodeReport(data)}`;
}
