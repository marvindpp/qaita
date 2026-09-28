// Звуки [E]: всё синтезируется Web Audio (осцилляторы), файлов нет. Звуки короткие, мягкие, без резких частот:
// для пожилых людей громкий писк — стресс. Если браузер не дал звук без нажатия — тихо ждём первого нажатия.

export function createSound() {
  const AC = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
  let ctx = null, master = null;
  let muted = false;

  function ensure() {
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  /** Одна нота: мягкая атака, экспоненциальное затухание. Гармоника на октаву выше — «колокольчик». */
  function note(freq, { at = 0, dur = 0.5, gain = 0.3, type = 'sine', bell = true } = {}) {
    const c = ensure();
    if (!c || muted || c.state !== 'running') return;
    const t = c.currentTime + at;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(master);
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.05);
    if (bell) {
      const g2 = c.createGain();
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.exponentialRampToValueAtTime(gain * 0.35, t + 0.01);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.6);
      g2.connect(master);
      const o2 = c.createOscillator();
      o2.frequency.setValueAtTime(freq * 2.01, t);
      o2.connect(g2);
      o2.start(t);
      o2.stop(t + dur);
    }
  }

  // Ноты (Гц): до-мажор, спокойный регистр.
  const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, A4 = 440, E4 = 329.63, G4 = 392;

  return {
    /** Кольцо «ладонь» сработало — короткое «да». */
    confirm() { note(G5, { dur: 0.18, gain: 0.22 }); note(C6, { at: 0.08, dur: 0.35, gain: 0.22 }); },
    /** Засчитан повтор — «дзынь». */
    rep() { note(E5, { dur: 0.6, gain: 0.3 }); note(G5 * 1.5, { at: 0.02, dur: 0.4, gain: 0.08 }); },
    /** Комбо ×2 / ×3 — короткое арпеджио вверх, чем выше комбо, тем длиннее. */
    combo(level = 2) {
      const seq = [C5, E5, G5, C6].slice(0, level + 1);
      seq.forEach((f, i) => note(f, { at: i * 0.07, dur: 0.35, gain: 0.2 }));
    },
    /** Новая звезда появилась. */
    star() { note(C6, { dur: 0.25, gain: 0.12 }); note(E5 * 2, { at: 0.06, dur: 0.3, gain: 0.08 }); },
    /** Упражнение закончено — фанфара. */
    done() {
      [C5, E5, G5].forEach((f, i) => note(f, { at: i * 0.12, dur: 0.5, gain: 0.22 }));
      note(C6, { at: 0.36, dur: 1.1, gain: 0.26 });
    },
    /** Ошибка — мягкое низкое «бу», не пугающее. */
    mistake() { note(G4, { dur: 0.22, gain: 0.14, type: 'triangle', bell: false }); note(E4, { at: 0.12, dur: 0.3, gain: 0.12, type: 'triangle', bell: false }); },
    /** Исправился — два светлых тона. */
    fixed() { note(A4 * 2, { dur: 0.25, gain: 0.18 }); note(C6 * 1.12, { at: 0.1, dur: 0.4, gain: 0.18 }); },
    /** Отсчёт калибровки 3-2-1. */
    tick() { note(C5, { dur: 0.12, gain: 0.1, bell: false }); },
    unlock() { ensure(); },
    // Без Web Audio звука нет вовсе — плашку «звук после нажатия» не показываем (нажатие не поможет).
    get blocked() { return Boolean(AC && ctx && ctx.state !== 'running'); },
    setMuted(v) { muted = Boolean(v); },
    get muted() { return muted; },
  };
}
