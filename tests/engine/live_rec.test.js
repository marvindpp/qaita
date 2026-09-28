// Регрессия на ЖИВОЙ записи Даулета 28.09 (tests/fixtures/rec-2026-09-28-daulet.json, ?rec=1).
// Движения нормальные, ошибки в 1–2 повторах — нарочно.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { replay } from '../replay.mjs';

const rec = JSON.parse(readFileSync(new URL('../fixtures/rec-2026-09-28-daulet.json', import.meta.url), 'utf8'));
const { summary, events } = replay(rec);

describe('live recording 28.09', () => {
  it('all 5 exercises get their 3 reps', () => {
    expect(summary.map((r) => r.id)).toEqual(['reach_up', 'reach_side', 'hand_to_mouth', 'reach_across', 'open_hand']);
    for (const r of summary) expect(r.reps, r.id).toBe(3);
  });
  it('normal-speed movement is not "too fast" (was 12 times, lowering the arm counted too)', () => {
    const n = events.filter((e) => e.type === 'mistake' && e.payload.code === 'TOO_FAST').length;
    expect(n).toBeLessThanOrEqual(1);
  });
  it('engine is silent after exercise-done (no hints while the next one is being picked)', () => {
    const doneAt = new Map();
    for (const e of events) {
      if (e.type === 'exercise-done') doneAt.set(e.ex, e.t);
      else expect(doneAt.has(e.ex), `${e.type} ${e.payload.code ?? ''} after done in ${e.ex}`).toBe(false);
    }
  });
  it('the reach_up star is up at the top edge, not at 2/3 of the arm (was y=0.227)', () => {
    const start = events.find((e) => e.type === 'start' && e.ex === 'reach_up');
    expect(start.payload.y).toBeLessThan(0.17);
  });
});

describe('hints without centimeters (28.09: camera does not know the real distance)', () => {
  it('no "см" in any hint of the live recording', () => {
    for (const e of events) if (e.type === 'mistake') expect(e.payload.message).not.toMatch(/\d\s*см/);
  });
});

describe('«вы вчера»: путь лучшего повтора', () => {
  it('each arm exercise keeps its best rep path, starting near the rest pose and going up', () => {
    for (const r of summary.filter((x) => x.id !== 'open_hand')) {
      const b = r.bestRep;
      expect(b, r.id).toBeTruthy();
      expect(b.pts.length, r.id).toBeGreaterThan(10);
      expect(b.ms, r.id).toBeGreaterThan(500);
      const maxUp = Math.max(...b.pts.map((p) => p[2]));
      expect(maxUp, r.id).toBeGreaterThan(b.pts[0][2]); // рука поднималась
    }
  });
});

// ── Ночь 2 (29→30.09): разбор ложных срабатываний по сырым точкам записи ──
// Время — секунды от первого кадра записи (как в `node tests/replay.mjs`).
const mistakesOf = (ex) => events.filter((e) => e.type === 'mistake' && e.ex === ex);
const repsOf = (ex) => events.filter((e) => e.type === 'rep' && e.ex === ex);

describe('live 28.09: упражнение начинается с поднятой руки (жест «✋ готов?»)', () => {
  // Упражнение стартует, когда ладонь поднята (жест ОК держат 1 с). В 64–66 с рука вверху 171°,
  // 66,1 с — старт reach_up, рука опущена только к 68,1 с. Это не повтор: ни подсказок, ни «не дотянулся».
  it('reach_up: до первого опускания руки ни одной подсказки (было: наклон 66,4 · плечо 67,1 · быстро 68,3 · «Почти» 69,3)', () => {
    expect(mistakesOf('reach_up').filter((e) => e.t / 1000 < 70.0)).toEqual([]);
  });
  it('reach_side: жест (локоть 64°, рука вверх) не даёт «Далеко до звезды» на 106,4 с', () => {
    expect(mistakesOf('reach_side').filter((e) => e.t / 1000 < 107.0)).toEqual([]);
  });
  it('амплитуда первого повтора — от самого повтора, а не от поднятой для жеста руки (reach_side: было 152°)', () => {
    expect(repsOf('reach_side')[0].payload.romDeg).toBeLessThan(130);
  });
});

describe('live 28.09: «наклон влево» = человек сидел левее, чем на калибровке, а не наклонялся', () => {
  // 70,9 с (рука опущена): левое плечо уже −0,14 ширины плеч от нормы, нос −0,10.
  // 72,2 с (рука вверху): левое плечо −0,13, нос −0,10 → за повтор корпус не сдвинулся.
  // То же в reach_side: 111–113 с в покое −0,14…−0,15, на 114,8 и 117,6 с — −0,14.
  it('ни одного TRUNK_LEAN_SIDE в записи', () => {
    expect(events.filter((e) => e.type === 'mistake' && e.payload.code === 'TRUNK_LEAN_SIDE')).toEqual([]);
  });
  it('настоящая ошибка 1-го повтора reach_up — согнутый локоть (72–73 с, 109–133°) — теперь видна', () => {
    const e = mistakesOf('reach_up').find((x) => x.payload.code === 'ELBOW_BENT');
    expect(e).toBeTruthy();
    expect(e.t / 1000).toBeGreaterThan(71.5);
    expect(e.t / 1000).toBeLessThan(73.5);
  });
});

describe('live 28.09: кисть у рта закрывает лицо', () => {
  // hand_to_mouth, 145,4–146,1 с: локоть 1–12°, кисть у лица; нос «прыгает» на −0,22…−0,38 ширины плеч,
  // ширина лица по уголкам глаз падает до 0,63 (глаза закрыты рукой), а левое плечо стоит (+0,02…+0,04).
  // Это не наклон корпуса, но сырой сигнал съедал качество: 3-й повтор был 0,85 («не чистый»).
  it('все 3 повтора hand_to_mouth чистые (≥ 0,9)', () => {
    for (const e of repsOf('hand_to_mouth')) expect(e.payload.quality).toBeGreaterThanOrEqual(0.9);
  });
});

describe('live 28.09: «Почти! Ещё чуть-чуть!», когда ладонь была у звезды', () => {
  // 79,8–81,7 и 90,4–93,2 с: фаза HOLD (ладонь у звезды), удержание не засчитано из-за плеча/локтя,
  // человек опустил руку → раньше выходило «Почти!». Он дотянулся — ошибка была другая, и её уже показали.
  it('reach_up: нет INCOMPLETE_ROM (все попытки доходили до звезды)', () => {
    expect(mistakesOf('reach_up').filter((e) => e.payload.code === 'INCOMPLETE_ROM')).toEqual([]);
  });
});
