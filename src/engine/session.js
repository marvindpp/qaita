// Одно упражнение от начала до конца: оценка кадра → ошибки → повторы → события контракта.
// Чистый модуль без DOM: его же гоняют unit-тесты.
import { detectMistakes } from './mistakes.js';
import { createMistakeTracker } from './tracker.js';
import { createRepCounter } from './reps.js';
import { createExercise } from './exercises.js';

export function createExerciseSession(id, baseline, aspect, { targetReps = 5 } = {}) {
  const ex = createExercise(id, baseline, aspect);
  if (!ex) throw new Error(`Упражнение ещё не реализовано: ${id}`);
  const tracker = createMistakeTracker();
  const reps = createRepCounter();
  let count = 0, qualitySum = 0, bestRomDeg = 0, peakRom = 0, done = false;
  let peakReach = 0, cleanStreak = 0;
  const startLen = ex.targetLen();
  // Адаптивная сложность: цель «догоняет» реальную руку и растёт за чистые повторы,
  // но не больше +40% от калибровки за сессию (пожилым резкий рост сложности мешает — PLAN §9).
  const MAX_GROWTH = 1.4;

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
      const raw = detectMistakes(m, baseline, { exercise: id, phase: phaseNow });
      for (const e of tracker.update(raw, now)) events.push(e);
      // Подсказку показываем после debounce, а удержание блокируем сразу по «сырому» сигналу —
      // иначе быстрый повтор с компенсацией успевает засчитаться за 300 мс фильтра.
      const r = reps.update({ ...f, blocked: raw.length > 0 || tracker.activeCodes().length > 0, t: now });
      if (r.phase !== 'REST' && m?.elevationDeg != null) peakRom = Math.max(peakRom, Math.round(m.elevationDeg));
      if (r.phase !== 'REST' && raw.length === 0 && tracker.activeCodes().length === 0) peakReach = Math.max(peakReach, ex.reachOf(m));

      if (r.rep && !done) {
        count += 1;
        qualitySum += r.rep.quality;
        bestRomDeg = Math.max(bestRomDeg, peakRom);
        events.push({ type: 'rep', payload: { exercise: id, count, targetReps, quality: r.rep.quality, romDeg: peakRom } });
        peakRom = 0;
        cleanStreak = r.rep.quality >= 0.9 ? cleanStreak + 1 : 0;
        // Дотянулся дальше звезды без компенсаций → следующая звезда там, где рука реально была.
        // Три чистых подряд → ещё +5%.
        let want = ex.targetLen();
        if (peakReach > want) want = peakReach * 1.02;
        if (cleanStreak > 0 && cleanStreak % 3 === 0) want *= 1.05;
        want = Math.min(want, startLen * MAX_GROWTH);
        if (!done && count < targetReps && ex.moveTo(want)) events.push({ type: 'target', payload: ex.targetEvent() });
        peakReach = 0;
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
