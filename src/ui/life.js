// «Из тренажёра — в жизнь» (PLAN §9г). Цель жизни, задание дня (CIMT «пакет переноса»), дневная доза повторов,
// голос близких. Всё хранится только в этом браузере; localStorage/IndexedDB — в try/catch.

/** Цели из жизни: то, о чём человек думает на самом деле («смогу ли я снова сам…»). */
export const GOALS = [
  { id: 'cup', emoji: '🍵', title: 'Держать чашку', short: 'сами держать чашку',
    task: 'Возьмите чашку больной рукой 3 раза (можно пустую)', stepText: 'ещё шаг к тому, чтобы самим держать чашку' },
  { id: 'hair', emoji: '💇', title: 'Причесаться', short: 'самим причёсываться',
    task: 'Проведите расчёской по волосам больной рукой 5 раз', stepText: 'ещё шаг к тому, чтобы самим причёсываться' },
  { id: 'dress', emoji: '👕', title: 'Одеться сам', short: 'одеваться самостоятельно',
    task: 'Проденьте больную руку в рукав сами', stepText: 'ещё шаг к тому, чтобы одеваться самостоятельно' },
  { id: 'hug', emoji: '🤗', title: 'Обнять внуков', short: 'обнять внуков двумя руками',
    task: 'Обнимите близкого двумя руками', stepText: 'ещё шаг к тому, чтобы обнять внуков двумя руками' },
];
export const goalById = (id) => GOALS.find((g) => g.id === id) ?? null;

// Какие упражнения тренируют какую цель — чтобы в итогах упражнения сказать «это для чашки».
export const GOAL_EXERCISES = {
  cup: ['hand_to_mouth', 'open_hand'],
  hair: ['reach_up', 'hand_to_mouth'],
  dress: ['reach_side', 'reach_across'],
  hug: ['reach_side', 'reach_across'],
};

const GOAL_KEY = 'qaita.goal.v1';
const TASK_KEY = 'qaita.task.v1';
const DOSE_KEY = 'qaita.dose.v1';
export const DAILY_DOSE = 100; // ориентир повторов в день: исследования говорят о сотнях (PLAN §9г), начинаем мягко

const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

export const loadGoal = () => goalById(read(GOAL_KEY, null));
export const saveGoal = (id) => write(GOAL_KEY, id);

const today = () => new Date().toISOString().slice(0, 10);

/** Задание дня: выдаётся в конце занятия, спрашиваем о нём на следующем занятии (в другой день). */
export function giveTask(goal) {
  if (!goal) return null;
  const t = { goal: goal.id, text: goal.task, day: today(), answered: null };
  write(TASK_KEY, t);
  return t;
}
/** Задание прошлого дня, на которое ещё не ответили. */
export function pendingTask() {
  const t = read(TASK_KEY, null);
  return t && t.answered == null && t.day !== today() ? t : null;
}
export function answerTask(done) {
  const t = read(TASK_KEY, null);
  if (!t) return;
  t.answered = done ? 'yes' : 'no';
  write(TASK_KEY, t);
  if (done) { const n = read('qaita.lifeFlowers.v1', 0) + 1; write('qaita.lifeFlowers.v1', n); }
}
/** Сколько раз человек сделал задание в жизни — «цветы из жизни» в саду. */
export const lifeFlowers = () => read('qaita.lifeFlowers.v1', 0);

/** Повторы за сегодня (все занятия дня). */
export function addDose(reps) {
  const d = read(DOSE_KEY, {});
  const k = today();
  const next = { [k]: (d[k] ?? 0) + reps };
  write(DOSE_KEY, next);
  return next[k];
}
export const doseToday = () => read(DOSE_KEY, {})[today()] ?? 0;

// ——— Голос близких: запись один раз, звучит после каждого занятия. IndexedDB, только в этом браузере. ———
function db() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('qaita', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('voice');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function saveVoice(blob) {
  try {
    const d = await db();
    await new Promise((res, rej) => { const tx = d.transaction('voice', 'readwrite'); tx.objectStore('voice').put(blob, 'family'); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    return true;
  } catch { return false; }
}
export async function loadVoice() {
  try {
    const d = await db();
    return await new Promise((res) => { const q = d.transaction('voice').objectStore('voice').get('family'); q.onsuccess = () => res(q.result ?? null); q.onerror = () => res(null); });
  } catch { return null; }
}

/** Записать голос с микрофона. @returns {{stop: () => Promise<Blob|null>}} */
export async function recordVoice(maxMs = 15000) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream);
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  let done;
  const finished = new Promise((r) => { done = r; });
  rec.onstop = () => { stream.getTracks().forEach((t) => t.stop()); done(chunks.length ? new Blob(chunks, { type: rec.mimeType }) : null); };
  rec.start();
  const timer = setTimeout(() => rec.state === 'recording' && rec.stop(), maxMs);
  return { stop: () => { clearTimeout(timer); if (rec.state === 'recording') rec.stop(); return finished; } };
}
