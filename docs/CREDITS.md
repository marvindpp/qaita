# Источники и лицензии

Правило команды: в Qaita нет чужих файлов без явной свободной лицензии (CC0, MIT и т. п.). Всё внешнее — только
в `public/` и только с записью здесь: что, откуда, лицензия.

## Анимации (ветка `night4/motion`)

Внешних анимаций, картинок и библиотек **нет** — всё нарисовано командой в коде:

| Что | Где | Как сделано |
|---|---|---|
| Заставка «звезда из искр» до загрузки приложения | `index.html` (блок `.boot`) | свой SVG + CSS |
| Звезда из искр в кольце приветствия, пока грузится распознавание | `src/ui/motion.js` (`splashStar`), `styles/motion.css` | свой SVG + CSS |
| Переходы между экранами (подъём + размытие) | `src/ui/motion.js` (`screenIn` / `screenOut`) | Web Animations API |
| Падающие звёзды, искры, конфетти, рост растений | `src/ui/motion.js` (`playResult`, `burstAt`, `confetti`) | Web Animations API |
| Ветер в саду, бабочка | `styles/motion.css`, `src/ui/motion.js` (`gardenLife`) | свой SVG + CSS |
| Вспышка новой награды | `src/ui/motion.js` (`celebrateAwards`) | Web Animations API |
| Свечение и всплеск кольца «ладонь» | `styles/motion.css`, `src/ui/components/ring.js` | CSS + Web Animations API |

Все права на код и рисунки — у команды «Хастлеры» (открытой лицензии нет). Звуки синтезируются в браузере (`src/ui/sound.js`, `src/ui/music.js`), файлов нет.

## Модели распознавания

| Что | Где у нас | Откуда | Лицензия |
|---|---|---|---|
| `pose_landmarker_lite.task`, `hand_landmarker.task` | `public/models/` | [MediaPipe Models](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker), Google | Apache 2.0 |
| WebAssembly `@mediapipe/tasks-vision` 1.0.1 | копируется в `public/mediapipe/wasm/` при сборке | npm, Google | Apache 2.0 |

Лежат на нашем сайте, чтобы запуск не зависел от CDN (`src/engine/models.js`, запасной путь — CDN).

## Библиотеки

| Что | Зачем | Лицензия |
|---|---|---|
| [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 2.0.4, Kazuhiko Arase | QR-код «Ссылки для врача» | MIT |

## Картинки мира «Шаңырақ» (`public/shanyrak/`)

Сгенерированы командой 03.10.2026 в [Uniset](https://uniset.ai), модель Nano Banana 2 (Google), 1024×1024 (степь — 2752×1536).
Стиль во всех запросах один: войлочная аппликация со стёжкой по краю, казахский орнамент (ою-өрнек, қошқар мүйіз),
палитра приложения (`#b8412f`, `#e0a33a`, `#2f7d74`, `#f6ecd6`, `#7a4b2a`, `#6f9a5b`), белый фон.
Этапы юрты и все остальные картинки сделаны по образцу первой юрты (`yurt-7`), чтобы стиль и ракурс совпадали.
После генерации: белый фон убран (прозрачность), картинки уменьшены и сохранены в WebP — скрипт в браузере, без внешних сервисов.

| Файл | Что | Запрос (кратко) |
|---|---|---|
| `yurt-7.webp` | юрта целиком, с дымком — «Дом готов» | «A complete traditional Kazakh yurt… felt appliqué… shanyrak crown on top, a thin wisp of felt smoke» |
| `yurt-6.webp` | с шаңырақ, без дыма | «Exactly the same yurt… but WITHOUT the smoke» |
| `yurt-5.webp` | войлок без венца — үзік | «…WITHOUT the shanyrak crown… open round hole in the center» |
| `yurt-4.webp` | стены в войлоке, голые уық — туырлық | «…walls covered with felt… roof is only bare wooden roof poles (uyk)» |
| `yurt-3.webp` | деревянный каркас — уық | «…bare wooden frame… lattice walls (kerege), door, bare roof poles» |
| `yurt-2.webp` | решётка с дверью — есік | «…only the lattice walls (kerege) and the wooden door» |
| `yurt-1.webp` | только решётка — кереге | «…only the lattice walls, with an empty gap where the door will be» |
| `tree-1.webp` … `tree-4.webp` | яблоня: росток → молодая → в цвету → с апортом | «…a small apple sapling / a young apple tree / in bloom / with red aport apples» |
| `apple-red.webp`, `apple-green.webp` | яблоко: чистый повтор / повтор с подсказкой | «one big round red aport apple / green apple, felt appliqué» |
| `shanyrak.webp` | шаңырақ снизу | «the shanyrak — the round wooden crown of a Kazakh yurt seen from directly below» |
| `steppe.webp` | фон: степь, горы, солнце, полоса орнамента | «wide Kazakh steppe landscape… keep the middle calm and empty» |
