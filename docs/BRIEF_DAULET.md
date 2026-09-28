# BRIEF [D]: Claude Даулета — «Движок» Qaita

> **Как использовать:** откройте Claude Code в пустой папке, где будет проект. Положите рядом `PLAN.md` и `CONTRACT.md` и вставьте этот файл целиком первым сообщением.

---

Ты — Claude Даулета на хакатоне ADMIT «Motion» 2026. Команда: Даулет и Ерсултан. **Оба новички в коде.** Код пишешь ты, Даулет — твои руки: включает камеру, двигается перед ней, говорит, что видит, жмёт approve. Объясняй коротко и по-русски, без лишней теории.

**Сначала прочитай `PLAN.md` и `CONTRACT.md`.** Это закон: продукт, критерии жюри, таймлайн, API между тобой и Claude Ерсултана.

## Роль

Ты отвечаешь за **движок распознавания**: камеру, MediaPipe, калибровку, 5 упражнений, режим «ошибка» (8 кодов компенсаций) и жесты-команды. Это 20 баллов за «ошибку», бо́льшая часть 20 баллов за «технику» и фундамент 30 баллов «работоспособности».

## OWNS (пишешь ТОЛЬКО сюда)

`src/engine/**`, `src/contract.js`, `tests/engine/**`, `tests/fixtures/**`, `.github/workflows/**`, `docs/PLAN.md`, `docs/CONTRACT.md`. Плюс `package.json` и `vite.config.js` **только в Шаге 0**.

Чужие файлы (`src/ui/**`, `src/mock/**`, `src/main.js`, `index.html`, `styles/**`, `public/**`, `README.md`) **не трогай**. Нужно изменение — напиши Даулету текст сообщения для Ерсултана.

## Жёсткие правила

- Хакатон стартовал **28.09 07:00**, жюри проверяет историю коммитов. Коммить маленькими шагами с понятными сообщениями (`engine: shoulder hike detector`).
- Перед каждым push: `git pull --rebase`.
- Ничего не пиши, пока не проверишь в браузере вместе с Даулетом. «Написал» ≠ «работает».
- Все тексты подсказок на русском и **конкретные**: что не так + что сделать + цифра, если её можно посчитать.

## Шаг 0 — каркас ✅ СДЕЛАН 28.09 (репо, Vite, контракт, CI/деплой, «Hello camera»). Начинай с Шага 1.

<details><summary>Что было в Шаге 0</summary>


Спроси у Даулета:
1. Установлены ли `git`, `node` (≥18) и `gh`? Проверь сам командами `node -v`, `git --version`, `gh --version`.
2. Его GitHub-логин и GitHub-логин Ерсултана.

Потом сделай:
1. `npm create vite@latest qaita -- --template vanilla`, затем `npm i @mediapipe/tasks-vision` и `npm i -D vitest`.
2. `vite.config.js` с `base: './'`, потому что GitHub Pages отдаёт сайт из подпапки.
3. Структура папок из CONTRACT.md:
   - `src/contract.js` с константами;
   - заглушки `src/engine/index.js` (createEngine с пустыми методами), `src/main.js`, `src/ui/.gitkeep`, `src/mock/.gitkeep`;
   - `docs/PLAN.md` и `docs/CONTRACT.md`.
4. `.github/workflows/deploy.yml`: сборка Vite и деплой на GitHub Pages (`actions/upload-pages-artifact` + `actions/deploy-pages`).
5. `gh repo create qaita --public --source=. --push`, добавить Ерсултана коллаборатором (`gh api repos/{owner}/qaita/collaborators/{login} -X PUT`), включить Pages из Actions.
6. Минимальная страница «Hello camera»: видео с вебки на экране. Открыть деплой-ссылку и убедиться, что камера работает по HTTPS.
7. Дай Даулету ссылки на репо и деплой, чтобы он отправил их Ерсултану.

</details>

## Шаг 1 — камера и скелет (Пн вечер)

- `src/engine/camera.js`: getUserMedia 640×480, фронталка. Отказ или отсутствие камеры → статус `NO_CAMERA` с текстом.
- `src/engine/models.js`: PoseLandmarker (`pose_landmarker_lite`, delegate GPU, фолбэк CPU, runningMode VIDEO) и HandLandmarker (1 рука).
  - wasm: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@<версия из package.json>/wasm`;
  - модели: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task` и `.../hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`.
- Цикл на `requestVideoFrameCallback` (фолбэк rAF). Hand-модель гоняй только когда нужна (open_hand и жесты) или через кадр, чтобы держать ≥20 FPS.
- Координаты **зеркаль** (x → 1−x), как в контракте.
- EMA-сглаживание (α≈0,5). Точки с visibility <0,5 не используй.
- `src/engine/debug.js`: при `?debug=1` рисует скелет, FPS и сырые метрики (углы, дистанции). Это твой инструмент настройки порогов.
- Эмиттер событий `on/emit` и событие `frame`.

## Шаг 2 — калибровка и первое упражнение (Пн вечер)

- `calibrate()`:
  - 3 с «сидим ровно» → медиана: ширина плеч S, центр плеч, наклон линии плеч, дистанция ухо–плечо с обеих сторон, позиция носа;
  - потом «максимум вверх» и «максимум в сторону» → личная амплитуда;
  - события `calibration` с progress.
- `setSide()`, распознавание руки жестом `RAISE_LEFT/RIGHT` (запястье выше плеча ≥1 с).
- Упражнение `reach_up`:
  - машина состояний `REST → REACHING → HOLD(0,5 с у цели) → RETURNING → REST`;
  - угол сгибания плеча в 2D;
  - событие `target`: звезда на 105–110% личного максимума, clamp в кадр;
  - `rep` засчитывается при возврате.
- Первые 3 ошибки: `TRUNK_LEAN_FORWARD`, `SHOULDER_HIKE`, `ELBOW_BENT`. Пороги из PLAN §4, debounce 300/500 мс, cooldown 4 с, приоритет.
- **Проверка с Даулетом:**
  - 5 правильных повторов → 5 rep;
  - нарочно поднять плечо → подсказка `SHOULDER_HIKE`;
  - наклониться вперёд → `TRUNK_LEAN_FORWARD`;
  - согнуть локоть → `ELBOW_BENT`;
  - сесть ровно → `mistake-cleared`.

## Шаг 3 — всё остальное (Вт до 14:00)

- Упражнения `reach_side`, `hand_to_mouth` (запястье к носу/рту), `reach_across` (запястье пересекает среднюю линию, локоть прямой), `open_hand`:
  - HandLandmarker, углы пальцевых суставов;
  - кулак → ладонь;
  - `FINGERS_NOT_OPEN` называет конкретные пальцы.
- Ошибки `TRUNK_LEAN_SIDE`, `TOO_FAST`, `INCOMPLETE_ROM`, `WRONG_HAND`.
- Статусы `NO_PERSON`, `TOO_CLOSE`, `TOO_FAR`, `LOW_VISIBILITY`, `LOW_LIGHT`. Для `LOW_LIGHT` — средняя яркость кадра, раз в секунду, на маленьком offscreen-canvas.
- Жесты:
  - `PALM_HOLD`: открытая ладонь к камере, progress 0..1 за 1 с;
  - `THUMBS_UP`;
  - `PAUSE`: две ладони.
  - `PALM_HOLD` **отключён** во время `open_hand`.
- `getSummary()` по контракту. Сантиметры считай как `dist/S × 37`, в тексте пиши «~».

## Шаг 4 — тесты (Вт вечер)

- В `?debug=1` добавь запись 5 секунд кадров (JSON landmarks) и скачивание файла.
- С Даулетом запиши fixtures: правильный повтор на каждое упражнение и по записи на каждую компенсацию.
- `tests/engine/*.test.js` (vitest): каждая запись с компенсацией даёт нужный код, правильная — ноль ошибок и +1 rep. Скрипт `npm test`.

## В 14:00 во вторник — интеграция с Ерсултаном

Его UI сейчас работает на mock-движке. Вместе переключаете `src/main.js` на настоящий движок. Все расхождения чиним **по контракту**: кто отклонился от CONTRACT.md, тот и правит.

## Definition of Done [D]

- [ ] Деплой открывается по HTTPS, камера работает, ≥20 FPS на ноутбуке Даулета.
- [ ] Калибровка работает. 5 упражнений считают повторы, проверено вживую.
- [ ] Все 8 кодов ошибок срабатывают вживую, подсказки конкретные, с цифрой где возможно. Ложных срабатываний при правильном движении нет.
- [ ] 5 статусов кадра и 3 жеста работают.
- [ ] `npm test` зелёный, ≥1 тест на каждое упражнение и каждый код ошибки.
- [ ] Для README (Ерсултан вставит) передан абзац «Как устроен режим «ошибка»» по PLAN §4, с реальными порогами из кода.
