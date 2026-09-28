# Дизайн-кит Qaita (черновик для `src/ui`)

Положено в `docs/`, чтобы не конфликтовать с `src/ui/**`. Ерсултан переносит, что нужно.

| Файл | Что это |
|---|---|
| `tokens.css` | Палитра «тёплая медицина» (светлая + тёмная), шрифт, размеры (текст ≥ 24px, подсказка 32px), отступы, кольцо |
| `check-contrast.mjs` | `node docs/design/check-contrast.mjs` — пересчитать контраст WCAG после смены цветов |
| `demos/*.svg` | 5 анимированных человечков (SMIL, без JS, цикл 3 с): `reach_up`, `reach_side`, `hand_to_mouth`, `reach_across`, `open_hand` |
| `demos-preview.png` | Раскадровка демо: 5 моментов цикла (0 / 0,75 / 1,2 / 1,9 / 2,4 с) |
| `garden/flower.svg`, `garden/sprout.svg` | 🌸 и 🌱 для «Сада Qaita», сами «вырастают» при появлении |
| `garden.md` | Как показывать игру: грядка, сад, ачивки |
| `screens.md` | Макеты 9 экранов словами и ASCII |

## Как вставить демо

```html
<!-- проще всего: анимация SMIL работает и внутри <img> -->
<img src="/demos/reach_up.svg" alt="Поднимите прямую руку к звезде" style="height:40vh">
<!-- левая рука: отражаем -->
<img src="/demos/reach_up.svg" alt="" style="height:40vh; transform: scaleX(-1)">
```

Цвета в SVG заданы через `var(--demo-arm, #1F7A4D)` и т.п. Если вставить SVG **инлайном** в HTML, их можно перекрасить CSS-переменными (`--demo-arm`, `--demo-body`, `--demo-star`, `--demo-chair`, `--demo-skin`). Внутри `<img>` работают цвета по умолчанию.

Шрифт Nunito (кириллица есть) — Google Fonts, строка подключения в `tokens.css`. Без интернета — системный шрифт.
