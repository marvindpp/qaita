// Фоновая музыка — генерируется в браузере (Web Audio), без файлов и лицензий: тихие аккорды-«подушка»
// и редкие колокольчики пентатоники. Спокойный темп, чтобы не торопить движение. Выключатель — в меню.
const KEY = 'qaita.music.v1';
const CHORDS = [
  [261.63, 329.63, 392.0, 493.88], // Cmaj7
  [220.0, 261.63, 329.63, 392.0], // Am7
  [174.61, 220.0, 261.63, 329.63], // Fmaj7
  [196.0, 246.94, 293.66, 392.0], // G
];
const BELLS = [523.25, 587.33, 659.25, 783.99, 880.0];
const BAR_S = 6;

export function createMusic() {
  let ctx = null, master = null, timer = null, bar = 0, on = false;
  try { on = localStorage.getItem(KEY) === 'on'; } catch { /* приватный режим */ }

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1800;
    master.connect(lp).connect(ctx.destination);
    return true;
  }
  function pad(freq, t, dur) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 1.8);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.1);
  }
  function bell(freq, t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.035, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    o.connect(g).connect(master); o.start(t); o.stop(t + 2.5);
  }
  function scheduleBar() {
    const t = ctx.currentTime + 0.1;
    for (const f of CHORDS[bar % CHORDS.length]) pad(f / 2, t, BAR_S + 1.5);
    for (let i = 0; i < 3; i += 1) if (Math.random() < 0.6) bell(BELLS[Math.floor(Math.random() * BELLS.length)], t + 0.5 + i * 1.9 + Math.random() * 0.4);
    bar += 1;
  }
  function start() {
    if (!ensure()) return;
    ctx.resume?.();
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.linearRampToValueAtTime(1, ctx.currentTime + 2);
    if (!timer) { scheduleBar(); timer = setInterval(scheduleBar, BAR_S * 1000); }
  }
  function stop() {
    if (!ctx) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
    clearInterval(timer); timer = null;
  }
  return {
    get on() { return on; },
    /** Включить/выключить (запоминается). */
    set(v) { on = Boolean(v); try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* */ } if (on) start(); else stop(); },
    /** После первого касания страницы: если музыка была включена — продолжить. */
    unlock() { if (on) start(); },
    /** Пока говорит голос — музыку тише. */
    duck(v) { if (ctx && on) master.gain.setTargetAtTime(v ? 0.35 : 1, ctx.currentTime, 0.3); },
  };
}
