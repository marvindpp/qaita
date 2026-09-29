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

Лицензия — как у всего проекта. Звуки синтезируются в браузере (`src/ui/sound.js`, `src/ui/music.js`), файлов нет.
