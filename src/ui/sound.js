// Звуки [E]: всё синтезируется Web Audio (осцилляторы), файлов нет. Звуки короткие, мягкие, без резких частот:
// для пожилых людей громкий писк — стресс. Если браузер не дал звук без нажатия — тихо ждём первого нажатия.
// Каждое событие звучит по-своему: повтор — «дзынь», чистый повтор — «дзынь» с искоркой, рекорд — длинная
// лесенка вверх, награда — «звон» колокольчика, «Отдохните» — тёплый выдох вниз, послание близких — шкатулка.
// Рецепты (RECIPES) вынесены отдельно, чтобы их можно было отрендерить в OfflineAudioContext и проверить пик.

const MASTER = 0.55;

/** Одна нота: мягкая атака, экспоненциальное затухание. Гармоника на октаву выше — «колокольчик». */
export function playNote(c, dest, freq, { at = 0, dur = 0.5, gain = 0.3, type = 'sine', bell = true, attack = 0.012 } = {}) {
  const t = c.currentTime + at;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(dest);
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.connect(g);
  o.start(t);
  o.stop(t + dur + 0.05);
  if (bell) {
    const g2 = c.createGain();
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(gain * 0.35, t + Math.max(0.01, attack * 0.8));
    g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.6);
    g2.connect(dest);
    const o2 = c.createOscillator();
    o2.frequency.setValueAtTime(freq * 2.01, t);
    o2.connect(g2);
    o2.start(t);
    o2.stop(t + dur);
  }
}

// Ноты (Гц): до-мажор, спокойный регистр.
const C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99, A5 = 880, C6 = 1046.5, E6 = 1318.51;
const A4 = 440, E4 = 329.63, G4 = 392, C4 = 261.63, F4 = 349.23, A3 = 220;

/** Рецепты звуков: n(freq, opts) — сыграть ноту. Имена совпадают с методами createSound(). */
export const RECIPES = {
  /** Кольцо «ладонь» сработало — короткое «да». */
  confirm: (n) => { n(G5, { dur: 0.18, gain: 0.22 }); n(C6, { at: 0.08, dur: 0.35, gain: 0.22 }); },
  /** Засчитан повтор — «дзынь». */
  rep: (n) => { n(E5, { dur: 0.6, gain: 0.3 }); n(G5 * 1.5, { at: 0.02, dur: 0.4, gain: 0.08 }); },
  /** Чистый повтор (без ошибок) — тот же «дзынь» и маленькая искорка сверху. */
  repClean: (n) => { n(E5, { dur: 0.6, gain: 0.28 }); n(G5 * 1.5, { at: 0.02, dur: 0.4, gain: 0.07 }); n(E6, { at: 0.11, dur: 0.45, gain: 0.07, attack: 0.02 }); },
  /** Комбо ×2 / ×3 — короткое арпеджио вверх, чем выше комбо, тем длиннее. */
  combo: (n, level = 2) => { [C5, E5, G5, C6].slice(0, level + 1).forEach((f, i) => n(f, { at: i * 0.07, dur: 0.35, gain: 0.2 })); },
  /** Новая звезда появилась. */
  star: (n) => { n(C6, { dur: 0.25, gain: 0.12 }); n(E5 * 2, { at: 0.06, dur: 0.3, gain: 0.08 }); },
  /** Упражнение закончено — фанфара. */
  done: (n) => { [C5, E5, G5].forEach((f, i) => n(f, { at: i * 0.12, dur: 0.5, gain: 0.22 })); n(C6, { at: 0.36, dur: 1.1, gain: 0.26 }); },
  /** Новый рекорд — длинная лесенка вверх по мажору и долгий светлый аккорд (отличается от «готово»). */
  record: (n) => {
    [C5, D5, E5, G5, A5].forEach((f, i) => n(f, { at: i * 0.09, dur: 0.4, gain: 0.15 }));
    [C6, G5, E5].forEach((f) => n(f, { at: 0.5, dur: 1.6, gain: 0.11, attack: 0.03 }));
  },
  /** Новая награда — «звон»: два колокольчика в кварту, долгий хвост. */
  award: (n) => { n(G5, { dur: 1.4, gain: 0.18, attack: 0.02 }); n(C6, { at: 0.16, dur: 1.8, gain: 0.16, attack: 0.02 }); },
  /** «Отдохните» — тёплый тихий «выдох» вниз, медленная атака, без колокольчика. */
  rest: (n) => {
    n(F4, { dur: 1.2, gain: 0.13, attack: 0.18, bell: false });
    n(C4, { at: 0.45, dur: 1.6, gain: 0.12, attack: 0.2, bell: false });
    n(A3, { at: 0.45, dur: 1.6, gain: 0.07, attack: 0.2, bell: false });
  },
  /** Послание близких — «музыкальная шкатулка»: тихий мотив перед голосом. */
  family: (n) => { [G4, C5, E5, D5, C5].forEach((f, i) => n(f, { at: i * 0.16, dur: 0.7, gain: 0.12, attack: 0.02 })); },
  /** Ошибка — мягкое низкое «бу», не пугающее. */
  mistake: (n) => { n(G4, { dur: 0.22, gain: 0.14, type: 'triangle', bell: false }); n(E4, { at: 0.12, dur: 0.3, gain: 0.12, type: 'triangle', bell: false }); },
  /** Исправился — два светлых тона. */
  fixed: (n) => { n(A4 * 2, { dur: 0.25, gain: 0.18 }); n(C6 * 1.12, { at: 0.1, dur: 0.4, gain: 0.18 }); },
  /** Отсчёт калибровки 3-2-1. */
  tick: (n) => { n(C5, { dur: 0.12, gain: 0.1, bell: false }); },
};

/** Для проверки: сыграть рецепт name в любой контекст (в т.ч. OfflineAudioContext) через общий уровень MASTER. */
export function renderRecipe(c, name, arg) {
  const m = c.createGain();
  m.gain.value = MASTER;
  m.connect(c.destination);
  RECIPES[name]((f, o) => playNote(c, m, f, o), arg);
}

export function createSound() {
  const AC = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
  let ctx = null, master = null;
  let muted = false;

  function ensure() {
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = MASTER;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function note(freq, opts) {
    const c = ensure();
    if (!c || muted || c.state !== 'running') return;
    playNote(c, master, freq, opts);
  }
  const play = (name, arg) => RECIPES[name](note, arg);

  return {
    confirm() { play('confirm'); },
    rep() { play('rep'); },
    /** Повтор без ошибок. */
    repClean() { play('repClean'); },
    combo(level = 2) { play('combo', level); },
    star() { play('star'); },
    done() { play('done'); },
    /** Новый рекорд. */
    record() { play('record'); },
    /** Новая награда (для «Мой прогресс»). */
    award() { play('award'); },
    /** Пауза «Отдохните». */
    rest() { play('rest'); },
    /** Перед посланием близких. */
    family() { play('family'); },
    mistake() { play('mistake'); },
    fixed() { play('fixed'); },
    tick() { play('tick'); },
    unlock() { ensure(); },
    // Без Web Audio звука нет вовсе — плашку «звук после нажатия» не показываем (нажатие не поможет).
    get blocked() { return Boolean(AC && ctx && ctx.state !== 'running'); },
    setMuted(v) { muted = Boolean(v); },
    get muted() { return muted; },
  };
}
