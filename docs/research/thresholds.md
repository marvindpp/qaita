# Пороги режима «ошибка»: наш код vs научная литература

> Ночное исследование 28→29.09. **Пороги в коде не менял** — это решают люди после плейтеста.
> Код: `src/engine/mistakes.js` → `THRESHOLDS` (состояние `main` на 28.09 21:10, коммит `19040ee`).

## ⚠️ Честно об источниках

Сетевой доступ ночью был ограничен: полные тексты статей (PubMed, PMC, Springer, AHA) не открывались. Все цифры ниже взяты из **аннотаций и выдержек**, которые показывает поиск. Каждая цифра — со ссылкой. Где цифру подтвердить не удалось, так и написано. Перед питчем проверьте 2–3 ключевые цифры в полном тексте.

## Как пересчитаны наши пороги

Код меряет всё в «ширинах плеч» S и переводит в сантиметры через `SHOULDER_CM = 37`. Наклон к камере меряется по росту ширины лица (внешние уголки глаз), а в сантиметры переводится через `CAMERA_CM = 60`.
Градусы наклона вбок я посчитал сам: смещение делим на высоту точки над сиденьем. Взял плечи ≈ 48 см, нос ≈ 65 см — это **оценка**, а не измерение.

## Главная таблица

| Ошибка | Наш порог (код) | ≈ в см / градусах | Что в литературе | Ссылка | Рекомендация |
|---|---|---|---|---|---|
| `TRUNK_LEAN_FORWARD` (лицо ближе) | `leanForwardHeadRatio: 1.12` | ≈ 6,4 см при камере в 60 см, **≈ 11 см при камере в 1 м** (как требует PLAN §10) | Шкала RPS (Levin): смещение корпуса **≤ 4,9 см — допустимо, ≥ 5 см — избыточно** | [RPSS, корейская валидация (PMC10019161)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10019161/); [Levin et al., RPS](https://www.semanticscholar.org/paper/Development-and-validation-of-a-scale-for-rating-in-Levin-Desrosiers/80d472779d6830296722fc4bb4be3a3d6f305885/figure/1) | Порог близок к **границе 5 см** при камере в 60 см. Но на 1 м ловится только ~11 см, то есть заметно мягче литературы. Это нормально для старта: ложные срабатывания хуже (см. ниже). **Баг в пересчёте:** `CAMERA_CM = 60`, а PLAN §10 просит ставить камеру в 1 м → показываемые см занижены примерно в 1,5 раза. См. «Рекомендация 1» |
| `TRUNK_LEAN_FORWARD` (нос опустился) | `leanForwardNoseDrop: 0.15` | 0,15 × 37 ≈ **5,6 см** | Тот же ориентир 5 см (RPS). У Alt Murphy **клинически значимое улучшение** смещения корпуса — **2–5 см** | [Alt Murphy 2013, NNR](https://journals.sagepub.com/doi/full/10.1177/1545968313491008) | Оставить. Совпадает с литературой |
| `TRUNK_LEAN_FORWARD` (запасной признак: плечи шире) | `leanForwardWidthRatio: 1.15` | ≈ 8 см (60 см) / ≈ 13 см (1 м) | — | — | Оставить мягким: точка плеча «едет» за рукой (регрессия 28.09) |
| `TRUNK_LEAN_SIDE` (центр плеч) | `leanSideShift: 0.12` | ≈ **4,4 см** ≈ 5° | Инсульт: корпус участвует во всех трёх плоскостях, **включая боковой наклон**. Цифры-порога в аннотациях не нашёл | [Robertson / Roby-Brami: trunk as part of kinematic chain (PubMed 21276425)](https://pubmed.ncbi.nlm.nih.gov/21276425); [Kinect: валидность наклона корпуса (PMC7763626)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7763626/) | Порог **строгий** (≈5°). В PLAN §9 сказано, что в Kinect-системе для пожилых допуск наклона ослабили с 5° до 20° ([PMC7827281](https://pmc.ncbi.nlm.nih.gov/articles/PMC7827281/)), но **конкретные 5° → 20° в аннотации я не нашёл** — проверьте в полном тексте. Если на плейтесте будут ложные «заваливаетесь», поднимите до 0,18–0,20 (≈ 7–8°) |
| `TRUNK_LEAN_SIDE` (голова) | `leanSideNoseShift: 0.18` | ≈ 6,7 см ≈ 6° | см. выше | см. выше | Оставить. Голова качается сама по себе (человек смотрит на звезду), поэтому порог у неё мягче — это правильно |
| `SHOULDER_HIKE` | `shoulderHikeDrop: 0.20` + до `0.15` наверху | ухо–плечо короче на 20% (у руки выше 90° — до 35%) ≈ 2,5–5 см | У здоровых при подъёме с грузом лопатка поднимается всего на **3,2–3,9°** больше. После инсульта при «рука ко рту» больше подъём плечевого пояса и отведение плеча: **+17,6°** отведения при питье | [Нагрузка и подъём лопатки (PMC10953777)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10953777/); [Alt Murphy 2011, NNR](https://doi.org/10.1177/1545968310370748); [JMIR Rehab 2023: компенсации при reach-to-mouth](https://rehab.jmir.org/2023/1/e50571) | Прямого порога «на сколько см плечо к уху = компенсация» в литературе **не нашёл**. Наш допуск «+15% наверху» совпадает с тем, что здоровое плечо само поднимается при подъёме руки. Оставить, настроить на плейтесте |
| `ELBOW_BENT` | `elbowBentDeg: 150` | локоть < 150° | После инсульта максимальное разгибание локтя при дотягивании **на 10,6° меньше**, чем у здоровых. Именно недоразгибание локтя **запускает** компенсацию корпусом | [Alt Murphy 2011](https://doi.org/10.1177/1545968310370748); [Cirstea & Levin 2000, Brain](https://academic.oup.com/brain/article-abstract/123/5/940/288135) | Оставить 150°. Важно: 2D-угол надёжен только во фронтальной плоскости (`reach_side`). Для движений к камере ошибка ~8° против ~1° вбок ([PMC12527045](https://pmc.ncbi.nlm.nih.gov/articles/PMC12527045/), из PLAN §9). В `19040ee` локоть в `reach_across` уже не проверяется ✅. Для `reach_up` можно смягчить до 140° |
| `TOO_FAST` | `tooFastSpeed: 4.5` ширины плеч/с в 3 кадрах из 5 | ≈ 1,7 м/с (4,5 × 37 см) | Время движения и плавность (число «единиц движения») **лучше всего** отличают здоровых от пациентов. Клинически значимое улучшение — **2,5–5 с** времени и **3–7** единиц движения | [Alt Murphy 2011](https://doi.org/10.1177/1545968310370748), [Alt Murphy 2013](https://journals.sagepub.com/doi/full/10.1177/1545968313491008) | ≈ 1,7 м/с — это явный рывок, спокойное движение намного медленнее. Порог мягкий, и так и надо: цель — «не рывком», а не «медленно». «3 кадра из 5» защищает от скачков точки |
| `INCOMPLETE_ROM` | рука прошла > 25% пути и вернулась, не дойдя до круга звезды | — | Нет прямого аналога. Наша цель ставится на 105% **личного** максимума — это согласуется с идеей персональной нормы | — | Оставить. Хорошо, что подсказка **не блокирует** следующий повтор. На плейтесте проверить, не «придирается» ли она к очень слабой руке |

## Что ещё говорит литература (для питча и README)

- **Корпус компенсирует, потому что локоть не разгибается.** Пациенты используют наклон корпуса вперёд как замену укороченной «функциональной длине» руки ([Cirstea & Levin 2000](https://academic.oup.com/brain/article-abstract/123/5/940/288135)). Поэтому связка «Корпус наклонился → выпрямите руку» в наших подсказках — по делу.
- **У пациентов корпус начинает двигаться раньше и вклад его больше**, чем у здоровых ([Levin et al. 2002, Exp Brain Res](https://link.springer.com/article/10.1007/s00221-001-0976-6)). Значит, детектор надо включать уже в фазе `REACHING`, а не только у цели. Так в коде и сделано: `moving = REACHING || HOLD`.
- **Тренировка с ограничением корпуса** (ремень на спинке) даёт больше разгибания локтя и меньше наклона ([Michaelsen et al. 2001, Stroke](https://www.ahajournals.org/doi/10.1161/01.str.32.8.1875)). Наша подсказка голосом — «мягкий» аналог ремня.
- **Вебкамера + MediaPipe годятся:** на 4 участниках классификатор компенсаций дал точность 0,92 ([J NeuroEng Rehab 2025](https://link.springer.com/article/10.1186/s12984-025-01808-4)).
- ⚠️ **Общая модель на чужих людях работает плохо:** на сырых точках MediaPipe точность ~50%, на ручных признаках ~70% ([Unger et al. 2025, Frontiers in Medicine](https://www.frontiersin.org/journals/medicine/articles/10.3389/fmed.2025.1645369/full)). Это аргумент за **личную калибровку**. Но цифры «0,83–0,95 при персональной калибровке» из PLAN §1 я в аннотациях **не нашёл** — проверьте, откуда они, прежде чем говорить на питче.

## Рекомендации (решают люди)

1. **`CAMERA_CM` — оценивать, а не брать константу.** Сейчас это 60 см, а PLAN §10 ставит камеру в 1 м. Лучше посчитать расстояние из калибровки: `d ≈ 37 / shoulderFrac / (2·tan(HFOV/2))`. Для типичной ноутбучной камеры HFOV ≈ 65° получится: плечи 30% ширины кадра → d ≈ 97 см, 40% → ≈ 73 см, 20% → ≈ 145 см. HFOV ≈ 65° — предположение, у камер он разный. Меняются **только показываемые сантиметры**, момент срабатывания остаётся прежним. Порог наклона вперёд тоже можно задать в сантиметрах (5–7 см), тогда он будет одинаковым на любом расстоянии.
2. **Наклон вбок** — первый кандидат на ослабление, если на плейтесте будут ложные срабатывания (0,12 → 0,18).
3. **Не ужесточать ничего до плейтеста.** Литература про пожилых однозначна: строгие допуски раздражают (PLAN §9). Ложная подсказка хуже пропущенной.
4. На плейтесте записывать `?debug=1`: `widthRatio`, `earSh`, `elbow` у каждого человека. Это готовые данные для настройки порогов по реальным людям.

## Источники

1. Levin MF, Michaelsen SM, Cirstea CM, Roby-Brami A. Use of the trunk for reaching targets placed within and beyond the reach in adult hemiparesis. *Exp Brain Res* 2002;143:171–180. <https://link.springer.com/article/10.1007/s00221-001-0976-6>
2. Cirstea MC, Levin MF. Compensatory strategies for reaching in stroke. *Brain* 2000;123(5):940–953. <https://academic.oup.com/brain/article-abstract/123/5/940/288135>
3. Michaelsen SM, Luta A, Roby-Brami A, Levin MF. Effect of trunk restraint on the recovery of reaching movements in hemiparetic patients. *Stroke* 2001;32:1875–1883. <https://www.ahajournals.org/doi/10.1161/01.str.32.8.1875>
4. Alt Murphy M, Willén C, Sunnerhagen KS. Kinematic variables quantifying upper-extremity performance after stroke during reaching and drinking from a glass. *Neurorehabil Neural Repair* 2011;25(1):71–80. <https://doi.org/10.1177/1545968310370748>
5. Alt Murphy M, Willén C, Sunnerhagen KS. Responsiveness of upper extremity kinematic measures and clinical improvement during the first three months after stroke. *NNR* 2013. <https://journals.sagepub.com/doi/full/10.1177/1545968313491008>
6. Reaching Performance Scale for Stroke — корейская версия, валидность. <https://pmc.ncbi.nlm.nih.gov/articles/PMC10019161/>
7. Levin MF et al. Development and validation of a scale for rating motor compensations used for reaching in patients with hemiparesis: the reaching performance scale. <https://www.semanticscholar.org/paper/Development-and-validation-of-a-scale-for-rating-in-Levin-Desrosiers/80d472779d6830296722fc4bb4be3a3d6f305885/figure/1>
8. The trunk as a part of the kinematic chain for reaching movements in healthy subjects and hemiparetic patients. <https://pubmed.ncbi.nlm.nih.gov/21276425>
9. The Validity and Reliability of the Microsoft Kinect for Measuring Trunk Compensation during Reaching. *Sensors* 2020. <https://pmc.ncbi.nlm.nih.gov/articles/PMC7763626/>
10. External handheld loads affect scapular elevation and upward rotation during shoulder elevation tasks. <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10953777/>
11. Movement Component Analysis of Reaching Strategies in Individuals With Stroke. *JMIR Rehabil Assist Technol* 2023. <https://rehab.jmir.org/2023/1/e50571>
12. Using MediaPipe to track upper-limb reaching movements after stroke. *J NeuroEng Rehabil* 2025. <https://link.springer.com/article/10.1186/s12984-025-01808-4>
13. Unger et al. Using deep learning to detect upper limb compensation in individuals post-stroke using consumer-grade webcams. *Front Med* 2025. <https://www.frontiersin.org/journals/medicine/articles/10.3389/fmed.2025.1645369/full>
14. A Kinect-Based Interactive System for Home-Assisted Active Aging. *Sensors* 2021. <https://pmc.ncbi.nlm.nih.gov/articles/PMC7827281/>
