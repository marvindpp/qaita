# Как пишут README сильные open-source проекты (исследование для README Qaita)

> Ночь 5, 29→30.09. Задача: понять, что общего у README топовых проектов, и перенести это в наш `README.md`, чтобы жюри за 2 минуты увидело всё главное.

## Что реально прочитано

| Проект | Как читали | Что взяли |
|---|---|---|
| [supabase/supabase](https://github.com/supabase/supabase) | **целиком**, `README.md` через raw.githubusercontent.com | Логотип сверху, одна фраза «что это», **чек-лист возможностей с `[x]`**, скриншот продукта сразу под списком, раздел **How it works** со схемой архитектуры |
| [calcom/cal.com](https://github.com/calcom/cal.com) | **целиком**, `README.md`. Сейчас в этом репо лежит README **Cal.diy** (community-версия), в шапке — предупреждения `[!WARNING]` / `[!TIP]` | Логотип + подзаголовок + ссылки по центру (`<p align="center">`), ряд бейджей shields.io, большой скриншот, «Built With», «Getting Started → Prerequisites», отдельные разделы на каждую проблему запуска |
| [excalidraw/excalidraw](https://github.com/excalidraw/excalidraw) | **целиком** | Обложка-картинка со ссылкой на живой продукт, **ссылки-кнопки по центру** (Editor · Blog · Docs), 2 строки «что это», бейджи, скриншот-витрина, потом Features → Quick start |
| [tldraw/tldraw](https://github.com/tldraw/tldraw) | **целиком** | Hero-картинка, бейджи, одна фраза `<h3>`, ссылки «Docs · Examples · Starter kits»; **Feature highlights** жирными пунктами «**Что** — зачем»; Quick start; Local development; License |
| [PostHog/posthog](https://github.com/PostHog/posthog) | **целиком** | Логотип, бейджи, **оглавление** (Table of Contents), демо-картинка; честный раздел **«Open-source vs. paid»** — что бесплатно и за что платят |
| [google-ai-edge/mediapipe](https://github.com/google-ai-edge/mediapipe) и [mediapipe-samples](https://github.com/google-ai-edge/mediapipe-samples) | **целиком** | «Get started» ведёт сразу к живым демо и гайдам; отдельный раздел **Privacy Notice** |
| [matiassingers/awesome-readme](https://github.com/matiassingers/awesome-readme) | **целиком** (`readme.md`), просмотрены описания примеров из раздела Examples | Самые частые похвалы в описаниях: логотип/баннер, **чёткая фраза «что делает»**, **GIF или скриншот демо**, бейджи, **TOC**, установка «скопировал-вставил», **схема архитектуры (в т.ч. Mermaid)**, «проблема тремя карточками → решение» (пример Bonevane/Bridge) |
| Победители хакатонов, Devpost | **только выдержки из WebSearch**: страницы `info.devpost.com` закрыты нашим прокси (EGRESS_BLOCKED), целиком не читали | См. ниже |

Выдержки из поиска по Devpost ([how to judge](https://help.devpost.com/article/103-how-to-judge-an-online-hackathon), [judging criteria](https://info.devpost.com/blog/understanding-hackathon-submission-and-judging-criteria), [advice from judges](https://info.devpost.com/blog/hackathon-judging-tips), [demo tips](https://info.devpost.com/blog/how-to-present-a-successful-hackathon-demo)):
- жюри смотрит много проектов подряд → **обзор в самом начале**;
- на первом этапе проверяют: **запускается ли и работает ли вообще** → пошаговый запуск и ссылка на деплой;
- победители кладут **понятную схему архитектуры**;
- лучшие страницы — со **скриншотами и видео-демо**;
- «документируй так, чтобы судья мог пройти сам».

## Что общего (паттерн «топового» README)

1. **Шапка по центру:** логотип → название → одна фраза «что это» → 2–4 ссылки-кнопки (живой продукт, документация) → бейджи shields.io.
2. **Картинка сразу** — скриншот/GIF продукта до любого текста о технологиях (у всех 6).
3. **Что умеет — списком с галочками** (Supabase) или жирными «**фича** — зачем» (tldraw).
4. **Быстрый старт в 2–3 команды**, отдельно — требования (Prerequisites) и частые проблемы (cal.com).
5. **Как устроено — схема** (Supabase «How it works», awesome-readme хвалит Mermaid).
6. **Честность о модели денег** (PostHog «Open-source vs. paid»).
7. **Приватность отдельным разделом** (MediaPipe «Privacy Notice»).
8. **Оглавление**, если README длинный (PostHog, многие из awesome-readme).
9. Команда / контрибьюторы / лицензия — в конце.

## Что переносим в Qaita (и почему)

| Паттерн | В нашем README |
|---|---|
| Шапка по центру + кнопки | «▶ Открыть демо» и «Без камеры (`?mock=1`)» — первые два клика жюри |
| Картинка сразу | Коллаж 4 экранов `docs/readme/qaita-collage.jpg` (снят на `?mock=1`, текущий `main`) |
| TOC | Мини-навигация **«критерий жюри → раздел»**: жюри оценивает по 6 критериям, пусть каждый найдёт свой раздел в 1 клик |
| Проблема → решение карточками | «Проблема в цифрах» (только цифры со ссылками из PLAN §1/§9в) → «Решение за 30 секунд» |
| Devpost: «пройди сам» | «Как проверить за 2 минуты»: шаг → что увидите, включая «как вызвать ошибку» |
| How it works | Mermaid-схема: камера → MediaPipe → движок → контракт → UI и голос |
| Чек-лист `[x]` | Бонусы кейса с ✅ |
| Open-source vs paid | «Масштабирование и бизнес» с пометкой **«план, не сделано»** |
| Privacy Notice | «Приватность и безопасность» |
| Prerequisites + частые проблемы | «Запуск локально» (Node 20.19+/22.12+) + «Если не грузится» |

**Чего не берём:** бейджи со звёздами/скачиваниями/Discord (у нас их нет — пустые цифры выглядят хуже, чем их отсутствие); динамические бейджи (картинки с github.com, внешние скрипты) — только статичные shields.io. Бейдж «лицензия» тоже не ставим: **файла LICENSE в репо нет** (решать команде, вне этой задачи).
