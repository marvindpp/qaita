// Фоновая музыка — генерируется в браузере (Web Audio), без файлов и лицензий: тихие аккорды-«подушка»
// и редкие колокольчики. Три «настроения» (лад, темп, тембр), всё мягкое: атаки не короче 30 мс, без ударных.
// Выключатель и выбор настроения — в меню. Смена настроения — плавный кроссфейд (~3 с), без щелчков.
// Пока говорит тренер — музыка тише (duck). До первого нажатия/жеста браузер звук не даёт — музыка ждёт.
const KEY = 'qaita.music.v1';
const MOOD_KEY = 'qaita.music.mood.v1';
const FADE_S = 3;

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

/**
 * Настроения. chords — MIDI-ноты аккордов (звучат октавой ниже), bells — ноты колокольчиков.
 * level — общий уровень (подобран так, чтобы все три звучали одинаково тихо).
 */
export const MOODS = {
  morning: {
    label: 'Утро', title: 'Спокойное утро', ico: '🌅',
    // До мажор: Cmaj7 · Am7 · Fmaj7 · G — светло, неторопливо (как было раньше).
    chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 67]],
    bells: [72, 74, 76, 79, 81],
    barS: 6, padWave: 'sine', padAttack: 1.8, padGain: 0.05, detune: 0,
    bellWave: 'triangle', bellGain: 0.035, bellProb: 0.6, bellsPerBar: 3, bellDecay: 2.4,
    arp: false, lowpass: 1800, level: 1,
  },
  evening: {
    label: 'Вечер', title: 'Мягкий вечер', ico: '🌙',
    // Ре минор / фа мажор, ниже и медленнее: Dm9 · B♭maj7 · Fmaj7 · C(sus) — тепло, «убаюкивающе».
    chords: [[50, 57, 60, 64], [46, 53, 57, 62], [53, 57, 60, 64], [48, 55, 60, 62]],
    bells: [62, 65, 67, 69, 72],
    barS: 8, padWave: 'sine', padAttack: 2.6, padGain: 0.055, detune: 4,
    bellWave: 'sine', bellGain: 0.03, bellProb: 0.4, bellsPerBar: 3, bellDecay: 3.2,
    arp: false, lowpass: 1100, level: 1.4,
  },
  bright: {
    label: 'Бодро', title: 'Бодро, но тихо', ico: '🌿',
    // Соль мажор, темп живее: G · Em7 · Cmaj7 · D — плюс тихое арпеджио «музыкальной шкатулки».
    chords: [[55, 59, 62, 67], [52, 55, 59, 62], [48, 52, 55, 59], [50, 54, 57, 62]],
    bells: [74, 76, 79, 81, 83],
    barS: 4, padWave: 'triangle', padAttack: 1.2, padGain: 0.04, detune: 0,
    bellWave: 'sine', bellGain: 0.028, bellProb: 0.35, bellsPerBar: 2, bellDecay: 2,
    arp: true, arpGain: 0.022, lowpass: 2200, level: 1.35,
  },
};
export const MOOD_IDS = Object.keys(MOODS);
const DEFAULT_MOOD = 'morning';

/** Маленький детерминированный генератор (для проверки рендером — каждый раз одинаково). */
export function seeded(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Шина настроения: gain (для кроссфейда) → lowpass (тембр) → dest. */
export function createMoodBus(c, dest, id) {
  const mood = MOODS[id];
  const gain = c.createGain();
  gain.gain.value = 0;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = mood.lowpass; lp.Q.value = 0.5;
  gain.connect(lp).connect(dest);
  return { id, mood, gain, lp };
}

function env(c, t, peak, attack, release) {
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.linearRampToValueAtTime(0, t + release);
  return g;
}

/** Один такт настроения в момент t на шину bus. Работает и в обычном, и в OfflineAudioContext. */
export function scheduleMoodBar(c, bus, t, bar, rnd = Math.random) {
  const m = bus.mood;
  const L = m.level;
  const dur = m.barS + 1.5;
  const chord = m.chords[bar % m.chords.length];
  for (const n of chord) {
    const f = hz(n) / 2;
    const detunes = m.detune ? [-m.detune, m.detune] : [0];
    for (const d of detunes) {
      const o = c.createOscillator();
      o.type = m.padWave; o.frequency.value = f; o.detune.value = d;
      const g = env(c, t, (m.padGain * L) / detunes.length, m.padAttack, dur);
      o.connect(g).connect(bus.gain); o.start(t); o.stop(t + dur + 0.1);
    }
  }
  // Колокольчики: мягкая атака 30 мс, долгое затухание.
  const step = m.barS / m.bellsPerBar;
  for (let i = 0; i < m.bellsPerBar; i += 1) {
    if (rnd() >= m.bellProb) continue;
    const bt = t + 0.5 + i * step + rnd() * 0.4;
    const o = c.createOscillator(), g = c.createGain();
    o.type = m.bellWave; o.frequency.value = hz(m.bells[Math.floor(rnd() * m.bells.length)]);
    g.gain.setValueAtTime(0.0001, bt);
    g.gain.exponentialRampToValueAtTime(m.bellGain * L, bt + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, bt + m.bellDecay);
    o.connect(g).connect(bus.gain); o.start(bt); o.stop(bt + m.bellDecay + 0.1);
  }
  // «Шкатулка»: ноты аккорда вверх, по одной в секунду, тихо.
  if (m.arp) {
    const notes = [...chord, chord[0] + 12];
    const gap = m.barS / notes.length;
    notes.forEach((n, i) => {
      const at = t + i * gap;
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = hz(n + 12);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(m.arpGain * L, at + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 1.6);
      o.connect(g).connect(bus.gain); o.start(at); o.stop(at + 1.7);
    });
  }
}

/** Рендер настроения целиком (для проверки в OfflineAudioContext): bars тактов с момента 0. */
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
