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

// Живая запись 29.09 (плейтест Ерса): девушка в очках, камера ноутбука снизу, сидит на кровати.
// После калибровки чуть отодвинулась и осела (лицо −20%, нос ниже на 0,2 ширины плеч) — это НЕ наклон.
describe('live recording 29.09 (glasses, laptop camera from below)', () => {
  const rec2 = JSON.parse(readFileSync(new URL('../fixtures/rec-2026-09-29-glasses.json', import.meta.url), 'utf8'));
  const r2 = replay(rec2);
  it('no false «lean forward» (was 13 in reach_up and 4 in open_hand)', () => {
    const n = r2.events.filter((e) => e.type === 'mistake' && e.payload.code === 'TRUNK_LEAN_FORWARD').length;
    expect(n).toBe(0);
  });
  it('all 5 exercises get their 3 reps', () => {
    for (const r of r2.summary) expect(r.reps, r.id).toBe(3);
  });
});

describe('sat closer after calibration (Ersultan lean-fix)', () => {
  it('sitting still but 25% closer → no lean; a real lean after that → still caught', async () => {
    const { measure } = await import('../../src/engine/body.js');
    const { createCalibration } = await import('../../src/engine/calibration.js');
    const { createExerciseSession } = await import('../../src/engine/session.js');
    const { makePose, frames, ASPECT } = await import('./synth.js');
    const calib = createCalibration('right'); let c;
    for (const [pose, t] of frames([[makePose(), 6200], [makePose({ wrist: { out: 0.2, up: 1.5 } }), 6200], [makePose({ wrist: { out: 1.5, up: 0.1 } }), 6200]])) c = calib.push(measure(pose, 'right', ASPECT), t);
    const s = createExerciseSession('reach_up', c.baseline, ASPECT, { targetReps: 5 });
    const t = s.targetEvent(), sh = { x: ASPECT / 2 + 0.15, y: 0.62 };
    const d = { out: t.x * ASPECT - sh.x, up: sh.y - t.y }, n = Math.hypot(d.out, d.up);
    const at = (extra = {}) => makePose({ wrist: { out: (d.out / n) * 1.6, up: (d.up / n) * 1.6 }, ...extra });
    const close = { scale: 1.25 };
    const ev = [];
    const seq = [[makePose(close), 900], [at(close), 1500], [makePose(close), 600], [at({ scale: 1.25 * 1.2, noseDrop: 0.3 }), 1500], [makePose(close), 600]];
    for (const [pose, tt] of frames(seq, 20000)) ev.push(...s.step(measure(pose, 'right', ASPECT), tt).events);
    const leans = ev.filter((e) => e.type === 'mistake' && e.payload.code === 'TRUNK_LEAN_FORWARD');
    const firstRep = ev.find((e) => e.type === 'rep');
    expect(firstRep).toBeTruthy();                       // первый повтор (просто сел ближе) засчитан
    expect(leans.length).toBe(1);                         // наклон пойман только во втором
  });
});

// Плейтест 29.09 (Ерсултан): настоящий «палец вверх» на 9–11 с записи не засчитывался (порог 0,6, а было 0,36–0,50).
describe('thumbs up on a live recording', () => {
  it('a real thumbs-up is recognized in most frames', async () => {
    const { isThumbsUp } = await import('../../src/engine/gestures.js');
    const rec3 = JSON.parse(readFileSync(new URL('../fixtures/rec-2026-09-29-thumbs.json', import.meta.url), 'utf8'));
    const t0 = rec3.frames[0][0];
    const hands = rec3.frames.filter(([t]) => (t - t0) / 1000 >= 9 && (t - t0) / 1000 < 11.5).flatMap(([, , hs]) => hs.map((h) => h.map(([x, y]) => ({ x, y }))));
    const yes = hands.filter(isThumbsUp).length;
    expect(yes / hands.length).toBeGreaterThan(0.6);
  });
});

// Живая запись 29.09 14:49 — ЛЕВАЯ рука, все 5 упражнений, человек делает правильно.
describe('live recording 29.09 14:49 (left hand)', () => {
  const r4 = replay(JSON.parse(readFileSync(new URL('../fixtures/rec-2026-09-29-left.json', import.meta.url), 'utf8')));
  it('left hand: all 5 exercises get their 3 reps, almost all clean', () => {
    for (const r of r4.summary) {
      expect(r.reps, r.id).toBe(3);
      expect(r.quality, r.id).toBeGreaterThan(0.9);
    }
  });
  it('no false trunk / shoulder hints on a clean left-hand session', () => {
    const bad = r4.events.filter((e) => e.type === 'mistake' && ['TRUNK_LEAN_FORWARD', 'TRUNK_LEAN_SIDE', 'SHOULDER_HIKE', 'TOO_FAST', 'WRONG_HAND'].includes(e.payload.code));
    expect(bad).toHaveLength(0);
  });
});

// ── Ночь 3 (30.09): после дневных коммитов 29.09 («Отдохните», «Новый рекорд») — регрессия на той же записи ──
describe('live 28.09 на main после 29.09: новых подсказок нет', () => {
  // Таймлайн replay побайтно совпал с тем, что был после PR 15 (commit 051b2da).
  it('нет «Отдохните» (rest): двух тяжёлых повторов подряд нет, попытки короче 12 с', () => {
    expect(events.filter((e) => e.type === 'rest')).toEqual([]);
  });
  it('подсказки ровно те же, что после ночи 2: локоть ×3, плечо ×4, больше ничего', () => {
    const codes = {};
    for (const e of events) if (e.type === 'mistake') codes[e.payload.code] = (codes[e.payload.code] ?? 0) + 1;
    expect(codes).toEqual({ ELBOW_BENT: 3, SHOULDER_HIKE: 4 });
  });
});

describe('replay: перекалибровка посреди упражнения (кнопка «Ещё раз» на плейтесте)', () => {
  // Движок (index.js calibrate()) закрывает текущее упражнение; replay раньше продолжал кормить его кадрами.
  it('после метки calibrate упражнение закрыто: его событий больше нет, итог сохранён', () => {
    // Склейка: начало reach_side (3 с) → вставляем кадры настоящей калибровки → остаток записи.
    const markT = (type, id) => rec.marks.find((mk) => mk.type === type && (!id || mk.id === id)).t;
    const at = markT('exercise', 'reach_side') + 3000;
    const [c0, c1] = [markT('calibrate'), markT('calibrated') + 500];
    const calFrames = rec.frames.filter(([t]) => t >= c0 && t <= c1).map(([t, ...r]) => [t - c0 + at + 1, ...r]);
    const shift = c1 - c0 + 1;
    const frames = [...rec.frames.filter(([t]) => t <= at), ...calFrames, ...rec.frames.filter(([t]) => t > at).map(([t, ...r]) => [t + shift, ...r])];
    const marks = [...rec.marks.filter((mk) => mk.t <= at), { t: at + 1, type: 'calibrate' }, ...rec.marks.filter((mk) => mk.t > at).map((mk) => ({ ...mk, t: mk.t + shift }))];
    const r2 = replay({ ...rec, frames, marks });
    expect(r2.lines.filter((l) => l.includes('✔ calibrated'))).toHaveLength(2);
    const late = r2.events.filter((e) => e.ex === 'reach_side' && e.t > at - rec.frames[0][0]);
    expect(late).toEqual([]);
    expect(r2.summary.map((s) => s.id)).toEqual(['reach_up', 'reach_side', 'hand_to_mouth', 'reach_across', 'open_hand']);
  });
});

describe('replay-all: сводная таблица по всем записям', () => {
  it('строка на каждое упражнение, подсказки по кодам, человек из имени файла', async () => {
    const { rowsOf, personOf, table } = await import('../replay-all.mjs');
    expect(personOf('tests/fixtures/rec-mama-54.json')).toBe('mama-54');
    expect(personOf('qaita-rec-2026-09-29-16-10.json')).toBe('2026-09-29-16-10');
    const { rows } = rowsOf(rec, 'daulet');
    expect(rows.map((r) => [r.ex, r.reps, r.target])).toEqual([['reach_up', 3, 3], ['reach_side', 3, 3], ['hand_to_mouth', 3, 3], ['reach_across', 3, 3], ['open_hand', 3, 3]]);
    expect(rows[0].hints).toEqual({ ELBOW_BENT: 2, SHOULDER_HIKE: 4 });
    expect(table(rows)).toContain('| daulet | reach_up | 3/3 |');
  });
});
