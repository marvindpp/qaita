// Debounce + приоритет: превращает «сырые» ошибки кадра в редкие понятные события.
// Повторную озвучку одной и той же подсказки глушит UI (voice.js), движок показывает всегда — иначе экран врёт.
import { PRIORITY } from './mistakes.js';

export const TRACKER_TIMING = { onMs: 300, offMs: 500 };
// Кадры не шли дольше этого (пауза, человек вышел) — неподтверждённые нарушения начинаем отсчитывать заново.
const MAX_GAP_MS = 250;

export function createMistakeTracker({ onMs, offMs } = TRACKER_TIMING) {
  const state = new Map(); // code → { since, falseSince, active, payload }
  let current = null;
  let corrected = 0;
  let lastT = null;
  const counts = {};

  return {
    get current() { return current; },
    get corrected() { return corrected; },
    get counts() { return { ...counts }; },
    activeCodes() { return [...state.entries()].filter(([, s]) => s.active).map(([c]) => c); },
    reset() { state.clear(); current = null; },

    /** @returns {Array<{type:'mistake'|'mistake-cleared', payload:object}>} */
    update(candidates, t) {
      const events = [];
      const seen = new Set();
      if (lastT != null && t - lastT > MAX_GAP_MS) {
        for (const s of state.values()) if (!s.active) s.since = t;
      }
      lastT = t;
      for (const c of candidates) {
        seen.add(c.code);
        const s = state.get(c.code) ?? { since: t, falseSince: null, active: false, payload: c };
        s.falseSince = null;
        s.payload = c;
        if (!s.active && t - s.since >= onMs) {
          s.active = true;
          counts[c.code] = (counts[c.code] ?? 0) + 1;
        }
        state.set(c.code, s);
      }
      for (const [code, s] of state) {
        if (seen.has(code)) continue;
        if (!s.active) { state.delete(code); continue; }
        s.falseSince ??= t;
        if (t - s.falseSince >= offMs) state.delete(code);
      }

      if (current && !state.get(current)?.active) {
        events.push({ type: 'mistake-cleared', payload: { code: current } });
        corrected += 1;
        current = null;
      }
      const best = PRIORITY.find((code) => state.get(code)?.active);
      if (best && best !== current) {
        current = best;
        events.push({ type: 'mistake', payload: state.get(best).payload });
      }
      return events;
    },
  };
}
