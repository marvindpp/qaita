// Одно упражнение от начала до конца: оценка кадра → ошибки → повторы → события контракта.
// Чистый модуль без DOM: его же гоняют unit-тесты.
import { detectMistakes, THRESHOLDS, SHOULDER_CM } from './mistakes.js';
import { FINGER_NAMES } from './body.js';
import { LM, sideIndex } from './geometry.js';

const HAND_NAME = { left: 'левую', right: 'правую' };
// Эти подсказки не мешают засчитать следующий повтор: они про прошлое движение или про другую руку.
const NON_BLOCKING = new Set(['INCOMPLETE_ROM', 'WRONG_HAND']);
import { createMistakeTracker } from './tracker.js';
import { createRepCounter } from './reps.js';
import { createExercise } from './exercises.js';

export function createExerciseSession(id, baseline, aspect, { targetReps = 5 } = {}) {
  const ex = createExercise(id, baseline, aspect);
  if (!ex) throw new Error(`Упражнение ещё не реализовано: ${id}`);
  const tracker = createMistakeTracker();
  const reps = createRepCounter();
  let count = 0, qualitySum = 0, bestRomDeg = 0, peakRom = 0, done = false;
  let peakPoint = null, cleanStreak = 0;
  // Адаптивная сложность: цель «догоняет» реальную руку и растёт за чистые повторы,
  // но не больше +40% от калибровки за сессию (пожилым резкий рост сложности мешает — PLAN §9).
  const MAX_STEP_DEG = 25; // за один повтор звезда не прыгает больше чем на 25° (плавная сложность, PLAN §9)
  let peakAny = 0;                 // максимум досягаемости за повтор (для «не хватило N см»)
  let lastWrist = null;
  const speeds = [];               // скорости запястья за последние 5 кадров, ширин плеч в секунду
  let tooFastUntil = -Infinity, incomplete = null, reachingSince = null;
  const idx = sideIndex(baseline.side);
  const otherSide = baseline.side === 'left' ? 'right' : 'left';

  // Ошибки, которые видны не по позе одного кадра, а по времени, скорости или другой руке.
  function extraMistakes(m, f, phaseNow, now) {
    const out = [];
    const moving = phaseNow === 'REACHING' || phaseNow === 'HOLD';

    if (!ex.handExercise && m?.wrist) {
      if (lastWrist) {
        const dt = (now - lastWrist.t) / 1000;
        if (dt > 0 && dt < 0.2) {
          speeds.push(Math.hypot(m.wrist.x - lastWrist.x, m.wrist.y - lastWrist.y) / baseline.S / dt);
          if (speeds.length > 5) speeds.shift();
        }
      }
      lastWrist = { ...m.wrist, t: now };
      // Рывок = быстро 3 кадра из 5. Одиночный скачок точки (глюк трекинга) — не рывок.
      const fastFrames = speeds.filter((v) => v > THRESHOLDS.tooFastSpeed).length;
      if (moving && fastFrames >= 3) tooFastUntil = now + 700; // «липкая»: рывок короткий, а debounce 300 мс
    } else { lastWrist = null; speeds.length = 0; }
    if (now < tooFastUntil) {
      out.push({ code: 'TOO_FAST', severity: 1, landmarks: [idx.sh, idx.el, idx.wr], message: 'Слишком быстро. Медленнее!' });
    }

    if (incomplete && now < incomplete.until) out.push(incomplete.payload);

    // Не та рука: другая рука поднята, а рабочая отдыхает.
    if (!ex.handExercise && m?.otherWrist && f.atRest) {
      const otherSh = otherSide === 'left' ? m.lsh : m.rsh;
      if ((otherSh.y - m.otherWrist.y) / m.S > THRESHOLDS.wrongHandUp) {
        out.push({ code: 'WRONG_HAND', severity: 3, landmarks: [sideIndex(otherSide).wr], message: `Не та рука! Тренируем ${HAND_NAME[baseline.side]}` });
      }
    }

    // Ладонь раскрыта не полностью: называем, какие пальцы согнуты.
    if (ex.handExercise && m?.fingers) {
      const open = m.fingers.filter(Boolean).length;
      if (phaseNow === 'REACHING' && open >= 2 && open < 4) {
        reachingSince ??= now;
        if (now - reachingSince > THRESHOLDS.fingersGraceMs) {
          const bent = FINGER_NAMES.filter((_, i) => !m.fingers[i]);
          const what = bent.length === 1 ? `${cap(bent[0])} согнут` : `${cap(bent.join(' и '))} согнуты`;
          out.push({ code: 'FINGERS_NOT_OPEN', severity: 1, landmarks: [idx.wr], message: `${what}. Раскройте ладонь!` });
        }
      } else if (phaseNow !== 'REACHING') reachingSince = null;
    }
    return out;
  }
  const cap = (s) => s[0].toUpperCase() + s.slice(1);

  return {
    id,
    get done() { return done; },
    targetEvent: () => ex.targetEvent(),
    get tracker() { return tracker; },
    /** @returns {{events: Array<{type:string,payload:object}>, info: object}} */
    step(m, now) {
      const events = [];
      const f = ex.evaluate(m);
      // Фаза для детекторов — по ТЕКУЩЕМУ кадру: рука уже пошла, значит проверяем с первого кадра движения.
      const phaseNow = !f.atRest && reps.phase === 'REST' ? 'REACHING' : reps.phase;
      if (phaseNow === 'REACHING' && reps.phase === 'REST') incomplete = null; // новый повтор — старую подсказку снимаем
      const raw = [...detectMistakes(m, baseline, { exercise: id, phase: phaseNow }), ...extraMistakes(m, f, phaseNow, now)];
      for (const e of tracker.update(raw, now)) events.push(e);
      // Подсказку показываем после debounce, а удержание блокируем сразу по «сырому» сигналу —
      // иначе быстрый повтор с компенсацией успевает засчитаться за 300 мс фильтра.
      const blocking = raw.some((c) => !NON_BLOCKING.has(c.code)) || tracker.activeCodes().some((c) => !NON_BLOCKING.has(c));
      const r = reps.update({ ...f, blocked: blocking, t: now });
      if (r.phase !== 'REST') peakAny = Math.max(peakAny, ex.reachOf(m));
      if (r.incomplete && !ex.handExercise) {
        const cm = Math.min(THRESHOLDS.maxShownCm, Math.max(0, ((ex.targetLen() - ex.radius - peakAny) / baseline.S) * SHOULDER_CM));
        incomplete = {
          until: now + 1800,
          payload: { code: 'INCOMPLETE_ROM', severity: 1, landmarks: [idx.wr], valueCm: Math.round(cm), message: cm >= 3 ? `Не хватило ${Math.round(cm)} см. Ещё чуть-чуть!` : 'Почти! Ещё чуть-чуть!' },
        };
      }
      if (r.phase === 'REST') peakAny = 0;
      if (r.phase !== 'REST' && m?.elevationDeg != null) peakRom = Math.max(peakRom, Math.round(m.elevationDeg));
      // Самая «амплитудная» точка чистого движения (без компенсаций) — туда может переехать звезда.
      if (r.phase !== 'REST' && m?.wrist && raw.length === 0 && tracker.activeCodes().length === 0 && (!peakPoint || ex.romOf(m.wrist) > ex.romOf(peakPoint))) peakPoint = { ...m.wrist };

      if (r.rep && !done) {
        count += 1;
        qualitySum += r.rep.quality;
        bestRomDeg = Math.max(bestRomDeg, peakRom);
        events.push({ type: 'rep', payload: { exercise: id, count, targetReps, quality: r.rep.quality, romDeg: peakRom } });
        peakRom = 0;
        cleanStreak = r.rep.quality >= 0.9 ? cleanStreak + 1 : 0;
        // Звезда всегда на длине прямой руки, поэтому «сложнее» = выше по углу, а не дальше.
        // Прямой рукой без компенсаций поднял выше звезды → звезда переезжает туда (+3° за 3 чистых подряд).
        if (ex.adaptive && !done && count < targetReps && peakPoint) {
          const bonus = cleanStreak > 0 && cleanStreak % 3 === 0 ? 3 : 0;
          const gain = ex.romOf(peakPoint) - ex.romOf(ex.target);
          if (gain > 3 && gain <= MAX_STEP_DEG && ex.rotateToward(peakPoint)) events.push({ type: 'target', payload: ex.targetEvent() });
          else if (bonus && ex.rotateBy(bonus)) events.push({ type: 'target', payload: ex.targetEvent() });
        }
        peakPoint = null;
        if (count >= targetReps) {
          done = true;
          events.push({ type: 'exercise-done', payload: { exercise: id, reps: count, quality: qualitySum / count } });
        }
      }
      return {
        events,
        info: { ex: id, phase: r.phase, hold: r.holdProgress, reps: `${count}/${targetReps}`, mistake: tracker.current ?? '—' },
      };
    },
    result() {
      return { id, reps: count, quality: count ? qualitySum / count : 0, bestRomDeg, mistakes: tracker.counts, corrected: tracker.corrected };
    },
  };
}
