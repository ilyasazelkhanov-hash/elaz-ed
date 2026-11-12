# Интерактивные уроки: реализованный срез и миграция

Дата: 12 ноября 2026. База реализации: 31a2b67.

## Что уже меняется

Все пять бесплатных разборов FreeStart используют короткий пошаговый player по умолчанию. Каждый содержит три исходных смысловых шага и три авторских упражнения, затем собственную практическую работу. Это 15 упражнений, а не автоматически сгенерированный тест из заголовков.

| Разбор | Интерактив |
| --- | --- |
| Первый запрос | Проверяемый бриф, вымышленная ссылка, порядок улучшения черновика |
| Проверка ответа | Фактические детали, источник без подтверждения, расчёт на новых числах |
| Выбор инструмента | Актуальный документ, сервис против модели, сопоставимый тест |
| Обложка | Композиция для телефона, точный текст, порядок проверки |
| Рабочая привычка | Вымышленные данные, воспроизводимость, повтор с другим условием |

Три механики: выбор с объяснением конкретного варианта, ввод числового ответа с формулой, порядок действий кнопками вверх/вниз. Никакого обязательного drag-and-drop. Верный ответ открывает следующий учебный шаг. Неверный показывает причину и даёт неограниченный повтор; изменение ответа снимает прежний статус. Есть явный альтернативный режим «Весь материал» с доступом к практике без принудительного прохождения тренажёра.

Переходы не являются зачётом. Результаты клиентских упражнений не защищены от просмотра в исходниках и не используются для сертификата, XP, оплаты или server completion. Это formative practice, не экзамен. Собственная работа остаётся в существующем PracticeArtifact с честной самооценкой. Academy submissions/review не заменены.

## Контракт и доступность

`GuideChallenge` хранит тип, prompt и авторские варианты/эталон/объяснение. Типы `choice`, `number`, `order` проверяются детерминированно. Числовое поле принимает десятичную запятую/точку, не исполняет выражения. Выбор объясняет конкретную ошибку, а не только «неправильно».

Радиокнопки и fieldset/legend нативные. Порядок доступен с клавиатуры, кнопки не меньше 44 px. После перехода фокус и прокрутка переходят к заголовку. Feedback имеет role=status. Progress bar означает место в уроке, не процент навыка. Движение не требуется. Данные тренажёра удерживаются только в JS памяти: максимум 20 маршрутов, namespace account/demo/guide/version. Перезагрузка очищает тренировочные ответы; это явно написано. Никаких запросов к ИИ, новых permissions, backend или записи БД.

Полка сохранённых работ открывает явный маршрут `/start/<guide>/work` сразу на собственной практике, без повторного прохождения тренажёра. Обычный вход в разбор сохраняет учебный маршрут. Этот переход не меняет ответы, зачёт или данные работы; явное сохранение и восстановление несохранённого черновика продолжают работать отдельно.

## Реальный охват: не скрывать незавершённую миграцию

Срезы взяты из локальных content-файлов, не из production SQL:

| Семейство | Объём | Текущий движок | Изменено здесь |
| --- | --- | --- | --- |
| Бесплатный старт | 5 разборов | FreeStart | 5 пошаговых уроков, 15 упражнений, final artifact |
| OG Practice | 5 курсов, 33 урока в paths.json | PracticeReader: разделы/разбор ответа/работа | Нет нового authored player; текущая практика сохранена |
| AI Academy | 28 курсов, 448 lesson и 448 assessment в catalog.learning.json | LessonReading/Quiz/Assignment/versioned review | Не мигрированы; существующий server grading сохранён |
| Legacy lessons | Динамические данные БД | Lesson/Quiz | Не менялись, production охват не проверен |

Наличие assessment в seed не доказывает, что production-урок опубликован или качественно проверен. Без такого различия утверждение «каждый урок теперь интерактивный» было бы неверным.

## Следующий этап

1. Для каждого урока определить наблюдаемое действие и артефакт. Не подменять цель количеством кликов.
2. Разметить content-version: короткий концепт → worked example → decision/production → объяснение → новая попытка → transfer → собственная работа.
3. Добавить авторские упражнения только после предметной проверки. Источники, эталон, rubric version и ограничения должны быть видимы автору.
4. В Academy использовать существующий Quiz API для настоящего зачёта; не переносить защищённые answer keys в открытый client. Локальные тренировочные ответы явно отделять от проверяемого assessment.
5. Мигрировать пилотный курс, провести UI/контент QA, затем другие. Сохранить коды уроков, progress и historical submission versions. Не переписывать БД массово без dry-run/diff и разрешённого deploy.
6. Для визуальных навыков добавить реальный annotated screenshot/сравнение, для данных - проверяемый расчёт, для workflow - порядок/ветвление. Не добавлять одинаковый quiz в каждый урок ради галочки.

## Проверки

Unit: все 5 guide покрыты; ответы, edge cases, формат числа, порядок, namespace и bounded memory. Actual-handler regression: неверный ответ → feedback → исправление → успешная проверка → следующий шаг → unmount/remount, режим полного материала. Existing FreeStart SSR и TypeScript.

До выпуска нужен integrated browser QA 320/390 px, обе темы, keyboard/focus, длинные варианты, order controls, полный материал и собственная работа. Физический Telegram WebView отдельно не проверен.

## Основание

Исследование Coursiv/Brilliant/Duolingo показывает полезность короткого следующего действия и проверки понимания. Подробные параметры платного Coursiv runtime не подтверждены. Этот player является оригинальной реализацией OG, а не заявлением о скопированной внутренней технологии Coursiv.

- https://support.coursiv.io/en/support/solutions/articles/73000622400-how-does-coursiv-work-
- https://brilliant.org/about/
- https://blog.duolingo.com/

## Package 2: two OG lessons (v1, local candidate)

Inspected the 33 source lessons in paths.json by course and content shape; closely
read foundations/block-1 and foundations/foundations-context. These two now have
three short authored concepts and three formative checks each in the authorized
PracticeReader. Correct answers unlock the next training step; incorrect choices
explain the actual error and allow retry. Final step links to the existing real
assignment and PracticeArtifact. Full original lesson, resources and own-answer
self-check remain available through existing tabs. No paid payload is imported
into public code; the supplemental examples are deliberately public and ungraded.

Coverage: 2/33 OG lessons, 6 exercises, plus the earlier 5/5 free guides.
Remaining: 31 OG lessons and 448 Academy lessons have NOT been migrated.
No production database or content import has been performed. Browser verification
and publication are pending. Source lessons may differ from live database copies.

Next batches: text/report calculations with a frozen fixture; coding/spec state
and acceptance checks; automation duplicate/error scenarios. Each needs explicit
answer evidence and task-specific feedback, not generic quizzes derived from
headings. Academy retains its existing server assessment engine. The blocker to
claiming full coverage is actual authoring/review of all remaining lesson data,
not an absent UI component.
