// Фоновая музыка — генерируется в браузере (Web Audio), без файлов и лицензий. Всё мягкое: атаки не короче 30 мс,
// без ударных. В каждом такте: тихий бас на основном тоне, тёплые аккорды в среднем регистре и мелодия «войлочного
// пианино» — не случайные ноты, а мотив, который повторяется через такт и разрешается в конце фразы из 4 тактов.
// Всё идёт через реверберацию (комната генерируется тут же), поэтому звучит объёмно, а не «из пищалки» (29.09).
// Выключатель и выбор настроения — в меню. Смена настроения — плавный кроссфейд (~3 с), без щелчков.
// Пока говорит тренер — музыка тише (duck). До первого нажатия/жеста браузер звук не даёт — музыка ждёт.
const KEY = 'qaita.music.v1';
const MOOD_KEY = 'qaita.music.mood.v1';
const FADE_S = 3;
const MIN_ATTACK = 0.03; // атака не короче 30 мс — без щелчков

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

/**
 * Настроения.
 * chords — аккорды (MIDI) в среднем регистре; бас — основной тон (первая нота аккорда) на октаву ниже.
 * scale — лад мелодии (MIDI-ноты, по которым она ходит), rhythm — ритм мелодии по тактам:
 *   [доля такта 0..1, длительность в долях такта]. level — общий уровень (все три звучат одинаково тихо).
 */
export const MOODS = {
  morning: {
    label: 'Утро', title: 'Спокойное утро', ico: '🌅',
    // До мажор: Cmaj7 · Am7 · Fmaj7 · G6 — светло, неторопливо. Мелодия по пентатонике до мажора.
    chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 64]],
    scale: [67, 69, 72, 74, 76, 79, 81],
    rhythm: [[[0, 0.25], [0.25, 0.25], [0.5, 0.5]], [[0, 0.375], [0.375, 0.125], [0.5, 0.25], [0.75, 0.25]]],
    barS: 6, padWave: 'triangle', padGain: 0.0252, padAttack: 1.4, padCut: 1400, detune: 5,
    bassGain: 0.0275, melGain: 0.095, melDecay: 2.2, reverb: 2.6, wet: 0.32, level: 1.6,
  },
  evening: {
    label: 'Вечер', title: 'Мягкий вечер', ico: '🌙',
    // Ре минор / фа мажор, ниже и медленнее: Dm9 · B♭maj7 · Fmaj7 · Csus — тепло, «убаюкивающе». Меньше нот.
    chords: [[50, 57, 60, 64], [46, 53, 57, 62], [53, 57, 60, 64], [48, 55, 60, 62]],
    scale: [62, 65, 67, 69, 72, 74, 77],
    rhythm: [[[0, 0.5], [0.5, 0.5]], [[0, 0.375], [0.375, 0.375], [0.75, 0.25]]],
    barS: 8, padWave: 'sine', padGain: 0.0336, padAttack: 2.2, padCut: 900, detune: 7,
    bassGain: 0.0303, melGain: 0.0855, melDecay: 3.2, reverb: 3.4, wet: 0.4, level: 1.3,
  },
  bright: {
    label: 'Бодро', title: 'Бодро, но тихо', ico: '🌿',
    // Соль мажор, живее: G · Em7 · Cmaj7 · D — мелодия чаще, с «шкатулкой»-переборами по аккорду.
    chords: [[55, 59, 62, 67], [52, 55, 59, 62], [48, 52, 55, 59], [50, 54, 57, 62]],
    scale: [74, 76, 79, 81, 83, 86, 88],
    rhythm: [[[0, 0.25], [0.25, 0.25], [0.5, 0.25], [0.75, 0.25]], [[0, 0.25], [0.25, 0.125], [0.375, 0.125], [0.5, 0.5]]],
    barS: 4, padWave: 'triangle', padGain: 0.0196, padAttack: 0.9, padCut: 1800, detune: 4,
    bassGain: 0.0248, melGain: 0.076, melDecay: 1.6, reverb: 2.2, wet: 0.28, level: 1.9,
  },
};
export const MOOD_IDS = Object.keys(MOODS);
const DEFAULT_MOOD = 'morning';

/** Маленький детерминированный генератор (для проверки рендером — каждый раз одинаково). */
export function seeded(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Импульс «комнаты» для реверберации: стерео-шум с плавным затуханием (без файлов). */
function roomImpulse(c, seconds) {
  const len = Math.floor(c.sampleRate * seconds);
  const ir = c.createBuffer(2, len, c.sampleRate);
  const rnd = seeded(11);
  for (let ch = 0; ch < 2; ch += 1) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i += 1) {
      const t = i / len;
      lp += 0.35 * ((rnd() * 2 - 1) - lp); // чуть приглушаем верх — «мягкая» комната
      d[i] = lp * (1 - t) ** 2.4 * (i < 64 ? i / 64 : 1);
    }
  }
  return ir;
}

/** Шина настроения: gain (для кроссфейда) → lowpass → сухой + реверберация → dest. */
export function createMoodBus(c, dest, id) {
  const mood = MOODS[id];
  const gain = c.createGain();
  gain.gain.value = 0;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 5200; lp.Q.value = 0.4;
  const dry = c.createGain(); dry.gain.value = 1 - mood.wet * 0.5;
  const wet = c.createGain(); wet.gain.value = mood.wet;
  const verb = c.createConvolver(); verb.buffer = roomImpulse(c, mood.reverb);
  gain.connect(lp);
  lp.connect(dry).connect(dest);
  lp.connect(verb).connect(wet).connect(dest);
  return { id, mood, gain, lp, state: { last: null, motif: null } };
}

/** Огибающая: атака → удержание → плавный спад. */
function env(c, t, peak, attack, hold, release) {
  const g = c.createGain();
  const a = Math.max(MIN_ATTACK, attack);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.setValueAtTime(peak, t + a + hold);
  g.gain.linearRampToValueAtTime(0, t + a + hold + release);
  return g;
}

/** Нота «войлочного пианино»: основной тон + 2-я и 3-я гармоники, которые гаснут быстрее — мягко, без писка. */
function feltNote(c, out, t, midi, gain, decay) {
  const f = hz(midi);
  const partials = [[1, 1, decay], [2, 0.28, decay * 0.45], [3, 0.08, decay * 0.25]];
  for (const [mul, amp, dec] of partials) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = f * mul;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain * amp, t + MIN_ATTACK);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    o.connect(g).connect(out); o.start(t); o.stop(t + dec + 0.05);
  }
}

/** Ближайшая к midi нота лада. */
const nearest = (scale, midi) => scale.reduce((a, b) => (Math.abs(b - midi) < Math.abs(a - midi) ? b : a));
/** Нота лада, ближайшая к одному из звуков аккорда (перенесённому в регистр лада). */
function chordToneIn(scale, chord, near) {
  const lo = scale[0], hi = scale[scale.length - 1];
  const cands = [];
  for (const n of chord) for (let o = -24; o <= 24; o += 12) { const m = n + o; if (m >= lo && m <= hi) cands.push(nearest(scale, m)); }
  return cands.reduce((a, b) => (Math.abs(b - near) < Math.abs(a - near) ? b : a), cands[0] ?? scale[2]);
}

/** Один такт настроения в момент t на шину bus. Работает и в обычном, и в OfflineAudioContext. */
export function scheduleMoodBar(c, bus, t, bar, rnd = Math.random) {
  const m = bus.mood, L = m.level, S = bus.state;
  const chord = m.chords[bar % m.chords.length];
  const dur = m.barS;

  // Бас: основной тон октавой ниже, долго и тихо.
  {
    const o = c.createOscillator();
    o.type = 'sine'; o.frequency.value = hz(chord[0] - 12);
    const g = env(c, t, m.bassGain * L, 0.4, dur * 0.55, dur * 0.6);
    o.connect(g).connect(bus.gain); o.start(t); o.stop(t + dur * 1.25);
  }
  // Аккорд: каждый звук — пара чуть расстроенных осцилляторов через мягкий фильтр (тепло, «хор»).
  const padLp = c.createBiquadFilter();
  padLp.type = 'lowpass'; padLp.frequency.value = m.padCut; padLp.Q.value = 0.3;
  padLp.connect(bus.gain);
  for (const n of chord) {
    for (const d of [-m.detune, m.detune]) {
      const o = c.createOscillator();
      o.type = m.padWave; o.frequency.value = hz(n); o.detune.value = d;
      const g = env(c, t, (m.padGain * L) / 2, m.padAttack, dur * 0.5, dur * 0.75);
      o.connect(g).connect(padLp); o.start(t); o.stop(t + dur * 1.35);
    }
  }
  // Мелодия: фраза из 4 тактов. Такты 0 и 2 — мотив (такт 2 повторяет рисунок такта 0 от своего аккорда),
  // такт 1 — ответ, такт 3 — разрешение на звук аккорда. Ноты ходят по ладу шагами — поётся, а не «рассыпается».
  const inPhrase = bar % 4;
  const rhythm = m.rhythm[inPhrase === 1 || inPhrase === 3 ? 1 : 0];
  let note = S.last ?? chordToneIn(m.scale, chord, m.scale[3]);
  if (inPhrase === 0 || S.motif == null) {
    note = chordToneIn(m.scale, chord, note);
    S.motif = rhythm.slice(1).map(() => (rnd() < 0.5 ? -1 : 1) * (rnd() < 0.7 ? 1 : 2));
  }
  const steps = inPhrase === 2 ? S.motif : rhythm.slice(1).map(() => (rnd() < 0.5 ? -1 : 1) * (rnd() < 0.75 ? 1 : 2));
  if (inPhrase === 2) note = chordToneIn(m.scale, chord, note);
  rhythm.forEach(([at, len], i) => {
    if (i > 0) {
      const idx = m.scale.indexOf(nearest(m.scale, note));
      note = m.scale[Math.max(0, Math.min(m.scale.length - 1, idx + steps[i - 1]))];
    }
    if (inPhrase === 3 && i === rhythm.length - 1) note = chordToneIn(m.scale, chord, note); // разрешение
    feltNote(c, bus.gain, t + at * dur, note, m.melGain * L, Math.max(m.melDecay * 0.6, len * dur * 1.6));
  });
  S.last = note;
}

/** Рендер настроения целиком (для проверки в OfflineAudioContext): такты с момента 0. */
export function renderMood(c, id, seconds, { seed = 7, fadeIn = 0.5 } = {}) {
  const bus = createMoodBus(c, c.destination, id);
  bus.gain.gain.setValueAtTime(0, 0);
  bus.gain.gain.linearRampToValueAtTime(1, fadeIn);
  const rnd = seeded(seed);
  for (let t = 0, bar = 0; t < seconds; t += bus.mood.barS, bar += 1) scheduleMoodBar(c, bus, t, bar, rnd);
  return bus;
}

/** Плавный переход громкости узла к value за s секунд (без скачка: от текущего значения). */
function glide(param, c, value, s) {
  const now = c.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(value, now + s);
}

/** Кроссфейд с настроения from на to (для проверки рендером). Такты to начинаются в момент at. */
export function renderCrossfade(c, from, to, seconds, at, { seed = 7 } = {}) {
  const a = renderMood(c, from, seconds, { seed });
  const b = createMoodBus(c, c.destination, to);
  a.gain.gain.setValueAtTime(1, at);
  a.gain.gain.linearRampToValueAtTime(0, at + FADE_S);
  b.gain.gain.setValueAtTime(0, at);
  b.gain.gain.linearRampToValueAtTime(1, at + FADE_S);
  const rnd = seeded(seed + 1);
  for (let t = at, bar = 0; t < seconds; t += b.mood.barS, bar += 1) scheduleMoodBar(c, b, t, bar, rnd);
}

export function createMusic() {
  let ctx = null, master = null, duckGain = null, bus = null, timer = null, bar = 0, on = false, started = false;
  let mood = DEFAULT_MOOD;
  try { on = localStorage.getItem(KEY) === 'on'; } catch { /* приватный режим */ }
  try { const m = localStorage.getItem(MOOD_KEY); if (m && MOODS[m]) mood = m; } catch { /* */ }

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch { return false; }
    master = ctx.createGain();   // вкл/выкл
    duckGain = ctx.createGain(); // тише, пока говорит тренер
    master.gain.value = 0;
    master.connect(duckGain).connect(ctx.destination);
    return true;
  }
  function tick() {
    // Пока браузер не разрешил звук, часы стоят — не копим такты (иначе потом всё прозвучит разом).
    if (!ctx || ctx.state !== 'running' || !bus) return;
    scheduleMoodBar(ctx, bus, ctx.currentTime + 0.1, bar);
    bar += 1;
  }
  function loop() {
    clearInterval(timer);
    tick();
    timer = setInterval(tick, bus.mood.barS * 1000);
  }
  function begin() {
    if (!on || started || !ctx || ctx.state !== 'running') return;
    started = true;
    if (!bus) { bus = createMoodBus(ctx, master, mood); bus.gain.gain.value = 1; }
    glide(master.gain, ctx, 1, 2);
    loop();
  }
  function start() {
    if (!ensure()) return;
    if (ctx.state === 'running') begin();
    else ctx.resume?.().then(begin, () => {});
  }
  function stop() {
    started = false;
    clearInterval(timer); timer = null;
    if (ctx) glide(master.gain, ctx, 0, 1);
  }
  function switchMood(id) {
    if (!ctx || !bus || bus.id === id) return;
    const old = bus;
    glide(old.gain.gain, ctx, 0, FADE_S);
    setTimeout(() => { try { old.gain.disconnect(); } catch { /* */ } }, (FADE_S + 12) * 1000);
    bus = createMoodBus(ctx, master, id);
    glide(bus.gain.gain, ctx, 1, FADE_S);
    bar = 0;
    if (started) loop();
  }
  return {
    get on() { return on; },
    /** Включить/выключить (запоминается). */
    set(v) { on = Boolean(v); try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* */ } if (on) start(); else stop(); },
    /** Текущее настроение: 'morning' | 'evening' | 'bright'. */
    get mood() { return mood; },
    /** Сменить настроение (запоминается); если музыка играет — плавный переход. */
    setMood(id) {
      if (!MOODS[id]) return;
      mood = id;
      try { localStorage.setItem(MOOD_KEY, id); } catch { /* */ }
      switchMood(id);
    },
    /** После первого касания страницы: если музыка была включена — продолжить. */
    unlock() { if (on) start(); },
    /** Пока говорит голос — музыку тише. */
    duck(v) { if (ctx && on) duckGain.gain.setTargetAtTime(v ? 0.35 : 1, ctx.currentTime, 0.3); },
  };
}
