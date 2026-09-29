// Живые инструменты для фоновой музыки [E]: короткие записи нот (сэмплы) пианино, струнных и арфы.
// Источник: FluidR3_GM (Frank Wen), mp3 из gleitz/midi-js-soundfonts, лицензия CC BY 3.0 — авторы указаны в README.
// Записаны ноты через малую терцию (A2, C3, E♭3 …); остальные — той же записью чуть выше/ниже (±1,5 полутона).
// Файлы лежат в public/music/<инструмент>/<нота>.mp3 и грузятся один раз.

const NOTES = ['A2', 'C3', 'Eb3', 'Gb3', 'A3', 'C4', 'Eb4', 'Gb4', 'A4', 'C5', 'Eb5', 'Gb5', 'A5', 'C6'];
const NAME_TO_MIDI = { A: 9, C: 0, Eb: 3, Gb: 6 };
const midiOf = (name) => {
  const m = name.match(/^([A-G]b?)(\d)$/);
  return NAME_TO_MIDI[m[1]] + 12 * (Number(m[2]) + 1);
};
const MIN_ATTACK = 0.03;

/**
 * Загрузить инструмент: { name, notes: [{ midi, buffer }] }. base — адрес папки с сэмплами.
 * @param {BaseAudioContext} c
 */
export async function loadInstrument(c, name, base) {
  const notes = await Promise.all(NOTES.map(async (n) => {
    const res = await fetch(`${base}${name}/${n}.mp3`);
    if (!res.ok) throw new Error(`sample ${name}/${n}: ${res.status}`);
    return { midi: midiOf(n), buffer: await c.decodeAudioData(await res.arrayBuffer()) };
  }));
  return { name, notes };
}

/** Ближайшая записанная нота и скорость воспроизведения, чтобы получить нужную высоту. */
function pick(inst, midi) {
  const s = inst.notes.reduce((a, b) => (Math.abs(b.midi - midi) < Math.abs(a.midi - midi) ? b : a));
  return { buffer: s.buffer, rate: 2 ** ((midi - s.midi) / 12) };
}

/** Одна нота «как есть» (пианино, арфа): мягкая атака 30 мс, своё естественное затухание, плавный конец. */
export function playNote(c, inst, out, t, midi, gain, { len = 2.5 } = {}) {
  const { buffer, rate } = pick(inst, midi);
  const src = c.createBufferSource();
  src.buffer = buffer; src.playbackRate.value = rate;
  const g = c.createGain();
  const end = Math.min(len, buffer.duration / rate);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + MIN_ATTACK);
  g.gain.setValueAtTime(gain, t + Math.max(MIN_ATTACK, end - 0.6));
  g.gain.linearRampToValueAtTime(0, t + end);
  src.connect(g).connect(out);
  src.start(t); src.stop(t + end + 0.05);
}

/**
 * Долгая нота струнных (запись всего 3 с): начало записи, а дальше — «цепочка» кусков из её середины,
 * каждый плавно перетекает в следующий (равномощный кроссфейд), поэтому нота тянется сколько нужно без щелчков.
 */
export function holdNote(c, inst, out, t, midi, gain, { dur = 6, attack = 1.2, release = 1.5 } = {}) {
  const { buffer, rate } = pick(inst, midi);
  // Всё, что про запись, — в секундах записи; всё, что про звучание, — в секундах звучания (÷ rate).
  const bufFrom = Math.min(0.9, buffer.duration * 0.3);           // середина записи: смычок уже ровно ведёт звук
  const firstLen = buffer.duration / rate;                          // первый кусок — вся запись со вступлением
  const segLen = Math.max(0.8, (buffer.duration - bufFrom - 0.15) / rate);
  const xf = Math.min(0.5, segLen / 3);
  const env = c.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(gain, t + Math.max(MIN_ATTACK, attack));
  env.gain.setValueAtTime(gain, t + dur);
  env.gain.linearRampToValueAtTime(0, t + dur + release);
  env.connect(out);
  const endAt = t + dur + release;
  const fadeIn = equalPower(true), fadeOut = equalPower(false);
  let at = t, first = true;
  while (at < endAt) {
    const len = first ? firstLen : segLen;
    const src = c.createBufferSource();
    src.buffer = buffer; src.playbackRate.value = rate;
    const g = c.createGain();
    if (first) g.gain.setValueAtTime(1, at); else g.gain.setValueCurveAtTime(fadeIn, at, xf);
    g.gain.setValueCurveAtTime(fadeOut, at + len - xf, xf);
    src.connect(g).connect(env);
    src.start(at, first ? 0 : bufFrom); src.stop(at + len + 0.02);
    at += len - xf;
    first = false;
  }
}

/** Равномощный кроссфейд: сумма громкостей двух кусков в стыке не проседает. */
function equalPower(up) {
  const n = 64, a = new Float32Array(n);
  for (let i = 0; i < n; i += 1) { const x = i / (n - 1); a[i] = up ? Math.sin((x * Math.PI) / 2) : Math.cos((x * Math.PI) / 2); }
  return a;
}
