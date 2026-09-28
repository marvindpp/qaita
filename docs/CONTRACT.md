# CONTRACT — граница между движком [D] и интерфейсом [E]

Это единственное место, где встречаются код Даулета и код Ерсултана.
**Контракт заморожен после Шага 0.** Менять его можно только вдвоём: сначала договорились в чате, потом один коммит `contract: ...`, и второй делает `git pull`.

## Структура репозитория и владельцы

```
qaita/
├─ index.html                 [E]
├─ styles/**                  [E]
├─ src/
│  ├─ main.js                 [E]  — выбирает настоящий движок или mock (?mock=1)
│  ├─ contract.js             [D]  — константы и JSDoc-типы ниже (заморожен)
│  ├─ engine/**               [D]  — камера, модели, калибровка, упражнения, ошибки, жесты
│  ├─ mock/**                 [E]  — mockEngine.js с тем же API
│  └─ ui/**                   [E]  — экраны, canvas-оверлей, голос, звуки, прогресс
├─ tests/engine/**            [D]  — unit-тесты правил на записанных кадрах
├─ tests/fixtures/**          [D]
├─ public/**                  [E]  — иконки, звуки
├─ .github/workflows/**       [D]  — деплой на GitHub Pages (Шаг 0)
├─ package.json, vite.config.js  [D] — только в Шаге 0; дальше [E] просит в чате, [D] добавляет
├─ README.md                  [E]
├─ docs/PLAN.md, docs/CONTRACT.md  [D] — копии этих файлов
└─ docs/SUBMISSION.md        [E] — текст описания для формы
```

## API движка (`src/engine/index.js` экспортирует `createEngine`)

```js
/**
 * @param {{ video: HTMLVideoElement }} opts
 * @returns {Engine}
 */
export async function createEngine(opts) {}

/** @typedef {Object} Engine
 * @property {() => Promise<void>} start      — камера + модели + цикл кадров
 * @property {() => void} stop
 * @property {(side: 'left'|'right') => void} setSide           — рабочая рука
 * @property {() => Promise<Baseline>} calibrate                 — 3 с «сидим ровно» + максимум вверх/в сторону
 * @property {(id: ExerciseId, opts?: {targetReps?: number}) => void} setExercise
 * @property {() => void} pause
 * @property {() => void} resume
 * @property {() => Summary} getSummary
 * @property {(event: EventName, cb: Function) => () => void} on — возвращает unsubscribe
 */
```

## Константы (`src/contract.js`)

```js
export const EXERCISES = ['reach_up', 'reach_side', 'hand_to_mouth', 'reach_across', 'open_hand'];

export const MISTAKES = [
  'TRUNK_LEAN_FORWARD', 'TRUNK_LEAN_SIDE', 'SHOULDER_HIKE', 'ELBOW_BENT',
  'TOO_FAST', 'INCOMPLETE_ROM', 'WRONG_HAND', 'FINGERS_NOT_OPEN',
];

export const STATUSES = ['OK', 'NO_CAMERA', 'NO_PERSON', 'TOO_CLOSE', 'TOO_FAR', 'LOW_VISIBILITY', 'LOW_LIGHT'];

export const GESTURES = ['PALM_HOLD', 'THUMBS_UP', 'PAUSE', 'RAISE_LEFT', 'RAISE_RIGHT'];

export const EVENTS = ['frame', 'status', 'calibration', 'target', 'rep', 'mistake', 'mistake-cleared', 'gesture', 'exercise-done'];
```

## События (payload)

| Событие | Payload | Когда |
|---|---|---|
| `frame` | `{ t, pose: [{x,y,z,visibility}]×33 \| null, hand: [{x,y,z}]×21 \| null, fps }` | Каждый кадр. Координаты нормированы 0..1 и **уже зеркалены** под селфи-вид |
| `status` | `{ code: Status, message: string }` | Изменился статус кадра. `message` — готовый текст на русском |
| `calibration` | `{ phase: 'neutral'\|'max_up'\|'max_side'\|'done', progress: 0..1, message }` | Во время `calibrate()` |
| `target` | `{ x, y, radius }` | Новая цель-звезда для текущего упражнения (нормированные координаты) |
| `rep` | `{ exercise, count, targetReps, quality: 0..1, romDeg }` | Засчитан повтор |
| `mistake` | `{ code: Mistake, message, severity: 1\|2\|3, landmarks: number[], valueCm?: number, valueDeg?: number }` | Началась компенсация. `message` — **конкретная** подсказка на русском, готовая для показа и озвучки. `landmarks` — индексы точек для красной подсветки |
| `mistake-cleared` | `{ code }` | Пользователь исправился: UI показывает «Отлично, так правильно!» |
| `gesture` | `{ type: Gesture, progress: 0..1, fired: boolean }` | `progress` для кольца hold, `fired: true` = команда сработала |
| `exercise-done` | `{ exercise, reps, quality }` | Выполнено `targetReps` |

## `Summary` (для экрана итогов)

```js
{
  side: 'left'|'right',
  durationSec: number,
  exercises: [{ id, reps, quality, bestRomDeg, mistakes: { [code]: count } }],
  totalReps: number,
  accuracy: number,          // 0..1 — доля повторов без ошибок
  mistakesCorrected: number, // сколько раз был mistake → mistake-cleared
}
```

## Правила

1. UI **не считает** углы и ошибки: всё приходит готовым из движка. Движок **не трогает** DOM, кроме своего `<video>`.
2. Тексты подсказок пишет движок: знание о теле в одном месте. UI отвечает за то, как их показать и озвучить.
3. Mock-движок [E] обязан выдавать **те же события с теми же полями**. Если в моке нужно поле, которого нет в контракте, — меняем контракт, а не мок.
