// История сессий [E] в localStorage. Всё в try/catch: в приватном окне или при запрете хранилища
// приложение не падает — просто не помнит прошлые сессии.
const KEY = 'qaita.sessions.v1';
const MAX_SESSIONS = 120;

export function loadSessions() {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveSession(session) {
  const list = [...loadSessions(), session].slice(-MAX_SESSIONS);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/** Дата в местном времени: 'YYYY-MM-DD' — для подсчёта дней подряд. */
export function dayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Сколько дней подряд были занятия, считая сегодня (или вчера, если сегодня ещё не занимались). */
export function streakDays(sessions, today = new Date()) {
  const days = new Set(sessions.map((s) => s.day));
  const d = new Date(today);
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(d))) { n += 1; d.setDate(d.getDate() - 1); }
  return n;
}

/** Главная цифра прогресса — насколько высоко поднимается рука (лучший угол «Звезда вверх», иначе «в сторону»). */
export function amplitudeOf(session) {
  const ex = session?.exercises ?? [];
  const up = ex.find((e) => e.id === 'reach_up')?.bestRomDeg;
  const side = ex.find((e) => e.id === 'reach_side')?.bestRomDeg;
  return up || side || null;
}

// «Вы вчера»: лучший повтор каждого упражнения — только путь ладони (числа), без картинок и видео.
const BEST_KEY = 'qaita.best.v1';

export function loadBestReps() {
  try {
    const all = JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}');
    return all && typeof all === 'object' ? all : {};
  } catch {
    return {};
  }
}

/** @returns {{ day, ms, quality, romDeg, side, pts } | null} */
export function bestRepFor(id) {
  const r = loadBestReps()[id];
  return r?.pts?.length && r.ms > 0 ? r : null;
}

/** После упражнения: запомнить путь лучшего повтора (картинки moments сюда НЕ кладём — CONTRACT.md). */
export function saveBestRep(id, rep) {
  if (!rep?.pts?.length) return false;
  const { ms, quality, romDeg, side, pts } = rep;
  const all = loadBestReps();
  all[id] = { day: dayKey(), ms, quality, romDeg, side, pts };
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

/** Подпись тени: сегодняшний — «Ваш лучший», вчерашний — «Вы вчера», старше — «Вы в прошлый раз». */
export function bestRepLabel(rep, today = new Date()) {
  if (!rep?.day || rep.day === dayKey(today)) return 'Ваш лучший';
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  return rep.day === dayKey(y) ? 'Вы вчера' : 'Вы в прошлый раз';
}
