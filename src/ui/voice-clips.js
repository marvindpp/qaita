// Записи живого голоса тренера [E]. Два источника:
//  1) записи, сделанные в «Студии голоса» на этом устройстве, — в IndexedDB (сразу слышны в приложении);
//  2) общие записи для всех — public/voice/manifest.json + файлы (их кладём в проект из выгрузки студии).
// Своя база 'qaita-voice', чтобы не трогать версию базы 'qaita' (life.js, family.js).
import { lineKey } from './voice-lines.js';

const DB = 'qaita-voice', STORE = 'clips';
const SR = 22050; // голосу хватает; файлы в 2 раза меньше, чем 44,1 кГц

function db() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

/** Сохранить запись предложения (WAV Blob). */
export const saveClip = (text, blob) => tx('readwrite', (s) => s.put({ text, blob, at: Date.now() }, lineKey(text)));
/** Удалить запись предложения. */
export const deleteClip = (text) => tx('readwrite', (s) => s.delete(lineKey(text)));
/** Все записи этого устройства: Map ключ → { text, blob }. Без IndexedDB (приватный режим) — пусто. */
export async function localClips() {
  try {
    const d = await db();
    return await new Promise((resolve) => {
      const out = new Map();
      const cur = d.transaction(STORE).objectStore(STORE).openCursor();
      cur.onsuccess = () => { const c = cur.result; if (!c) { resolve(out); return; } out.set(c.key, c.value); c.continue(); };
      cur.onerror = () => resolve(out);
    });
  } catch {
    return new Map();
  }
}

/** Общие записи из проекта: Map ключ → url. Нет файла — пусто (всё скажет голос браузера). */
export async function sharedClips(base) {
  try {
    const res = await fetch(`${base}voice/manifest.json`, { cache: 'no-cache' });
    if (!res.ok) return new Map();
    const m = await res.json();
    return new Map(Object.entries(m.files ?? {}).map(([k, f]) => [k, `${base}voice/${f}`]));
  } catch {
    return new Map();
  }
}

/**
 * Запись с микрофона → чистый короткий WAV: моно, 22 кГц, тишина по краям обрезана (с запасом 80 мс),
 * громкость выровнена (пик −3 дБ), края 10 мс плавные — без щелчков. Так все фразы звучат одинаково громко.
 * @param {Blob} blob — то, что дал MediaRecorder (webm/ogg/mp4)
 */
export async function cleanRecording(blob) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC();
  let src;
  try { src = await ac.decodeAudioData(await blob.arrayBuffer()); } finally { ac.close?.(); }
  // Моно.
  const n = src.length, mono = new Float32Array(n);
  for (let ch = 0; ch < src.numberOfChannels; ch += 1) { const d = src.getChannelData(ch); for (let i = 0; i < n; i += 1) mono[i] += d[i] / src.numberOfChannels; }
  // Обрезать тишину: окно 20 мс, порог −45 дБ от пика.
  let peak = 0; for (let i = 0; i < n; i += 1) peak = Math.max(peak, Math.abs(mono[i]));
  if (peak < 0.003) throw new Error('Тишина — микрофон ничего не услышал');
  const win = Math.round(src.sampleRate * 0.02), thr = peak * 10 ** (-45 / 20);
  const loud = (i) => { let m = 0; for (let j = i; j < Math.min(n, i + win); j += 1) m = Math.max(m, Math.abs(mono[j])); return m > thr; };
  let a = 0; while (a < n && !loud(a)) a += win;
  let z = n - win; while (z > a && !loud(z)) z -= win;
  const pad = Math.round(src.sampleRate * 0.08);
  a = Math.max(0, a - pad); z = Math.min(n, z + win + pad);
  // Пересэмплировать в 22 кГц.
  const cut = new AudioBuffer({ length: z - a, numberOfChannels: 1, sampleRate: src.sampleRate });
  cut.copyToChannel(mono.subarray(a, z), 0);
  const off = new OfflineAudioContext(1, Math.ceil(((z - a) / src.sampleRate) * SR), SR);
  const s = off.createBufferSource(); s.buffer = cut; s.connect(off.destination); s.start();
  const out = (await off.startRendering()).getChannelData(0);
  // Громкость и мягкие края.
  let pk = 0; for (let i = 0; i < out.length; i += 1) pk = Math.max(pk, Math.abs(out[i]));
  const gain = pk ? 0.707 / pk : 1, edge = Math.round(SR * 0.01);
  for (let i = 0; i < out.length; i += 1) {
    const f = Math.min(1, i / edge, (out.length - 1 - i) / edge);
    out[i] *= gain * f;
  }
  return wavBlob(out, SR);
}

/** 16-битный моно WAV. */
export function wavBlob(samples, rate) {
  const buf = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const w = (o, s) => { for (let i = 0; i < s.length; i += 1) buf.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); buf.setUint32(4, 36 + samples.length * 2, true); w(8, 'WAVEfmt ');
  buf.setUint32(16, 16, true); buf.setUint16(20, 1, true); buf.setUint16(22, 1, true);
  buf.setUint32(24, rate, true); buf.setUint32(28, rate * 2, true); buf.setUint16(32, 2, true); buf.setUint16(34, 16, true);
  w(36, 'data'); buf.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i += 1) buf.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 32767, true);
  return new Blob([buf.buffer], { type: 'audio/wav' });
}
