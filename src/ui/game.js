// Игра «Сад Qaita» [E] — правила из docs/TASKS.md. Чистая логика без DOM (её гоняет тест).
// Очки: повтор = 100 × quality; исправился после подсказки = +50. Комбо: чистые подряд (quality ≥ 0.9):
// с 3-го ×2, с 5-го ×3; повтор с ошибкой сбрасывает. Звёзды: ★ хоть один повтор, ★★ все, ★★★ все чистые.
// Сад: чистый повтор = цветок, повтор с исправлением = росток.

export const CLEAN_QUALITY = 0.9;
export const FIX_BONUS = 50;

export const comboMultiplier = (streak) => (streak >= 5 ? 3 : streak >= 3 ? 2 : 1);

export function createGame(exercise, targetReps) {
  let score = 0, streak = 0, corrected = 0;
  let mistakeInRep = false;
  const reps = []; // { quality, clean, points, plant: 'flower' | 'sprout' }

  return {
    get score() { return score; },
    get streak() { return streak; },
    get multiplier() { return comboMultiplier(streak); },
    get reps() { return reps.slice(); },
    get corrected() { return corrected; },

    /** Движок заметил компенсацию: этот повтор уже не чистый. */
    mistake() { mistakeInRep = true; },

    /** Исправился после подсказки — хвалим за исправление. @returns начисленные очки */
    cleared() {
      corrected += 1;
      score += FIX_BONUS;
      return FIX_BONUS;
    },

    /** Засчитан повтор. @returns {{ points:number, multiplier:number, clean:boolean, plant:string, comboUp:boolean }} */
    rep({ quality }) {
      const clean = quality >= CLEAN_QUALITY && !mistakeInRep;
      const before = comboMultiplier(streak);
      streak = clean ? streak + 1 : 0;
      const multiplier = comboMultiplier(streak);
      const points = Math.round(100 * quality) * multiplier;
      score += points;
      const plant = clean ? 'flower' : 'sprout';
      reps.push({ quality, clean, points, plant });
      mistakeInRep = false;
      return { points, multiplier, clean, plant, comboUp: multiplier > before };
    },

    /** Итог упражнения для экрана «звёзды» и для сада. */
    result() {
      const n = reps.length;
      const allClean = n > 0 && reps.every((r) => r.clean);
      const stars = n === 0 ? 0 : n < targetReps ? 1 : allClean ? 3 : 2;
      return {
        exercise, targetReps, reps: n, stars, score, corrected,
        plants: reps.map((r) => r.plant),
        bonus: corrected * FIX_BONUS,
      };
    },
  };
}
