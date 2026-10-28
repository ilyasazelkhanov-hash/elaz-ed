# Аудит курсов OG CRE8R

Первоначально проверен HEAD `cc14551` без изменения продукта. По последующему поручению исправлены C1/C2 в рабочей копии; рабочая база и пользовательские данные не менялись.

## Подтверждено

- `npm run test:academy`: **198/198**, fail 0, ~17.4 s. Журнал: `courses/academy-tests.log`.
- Все **28 книг / 112 модулей / 448 уроков** присутствуют. Книги побайтно/структурно сверяются тестом с генератором; в каждом уроке есть содержательный блок >500 символов, результат и критерии практики.
- Независимый скан всех локальных ссылок `/learning/…` в публичных книгах: отсутствующих файлов **0** (`courses/resource-scan.json`). Это проверка наличия файлов в repo, не HTTP-доступности deployment.
- Последовательность модулей/уроков, переход 4→5, protected completion, private grading/quiz fields, course/demo separation и сохранение черновиков покрыты проходящими существующими тестами.
- Тесты проверяют, что публичные книги не включают rubric/question/answer/learner fields и paid/mapped/draft courses. Чтение не подменяет запись/официальный прогресс.

## Найдено

### C1 · P2 · Исправлено: публичные уроки теряли ссылки на первоисточники

`scripts/course-materials.mjs:22–24` строит книги только из lesson data и не включает разрешённые `catalog.links`/source nodes. `src/screens/courses/Material.tsx:18–29` не выводит раздел источников, хотя protected reader выводит его в `src/screens/academy/Learning.tsx:89`.

В текущем curriculum 851 student/public source links, из них 786 относятся к **всем 448 авторским урокам**. У источников в metadata стоят `published`, `link_state=verified`, разрешённые public rights. Это состояние авторского пакета, а не новая сетевая проверка ссылок.

Пример: у `CORE-000-M1-L1` есть student-ссылка `AUTH-SRC-CORE-NIST` → `https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf`, но ни этого URL, ни source node нет в `public/learning/courses/materials/CORE-000.json`. В режиме чтения, который сейчас работает независимо от сервера, ученик не может открыть проверенный первоисточник и дополнительное объяснение.

Первоначальное доказательство: `courses/public-sources.json`. Исправление выполнено в рабочей копии: книги теперь содержат 851 разрешённую source reference, а reader выводит ссылки урока и курса. Проекция проверяет published/права/verified/checked_at, HTTPS, отсутствие credentials/token/signed URL; raw source bodies и notes исключены. Целевой набор тестов — 5/5. Рекомендуемое устройство исправления: включать отдельную безопасную проекцию опубликованных student/public source references (название, URL, права, checked_at, chapter/time) и отрисовать Sources, сохранив исключение internal/methodological/private fields.

### C2 · P2 · Исправлено: в первых двух курсах второй пример не показывался

`src/screens/courses/Material.tsx:16–17` выбирает один `beginner` study, затем исключает **все** blocks со study из reading. `:24` выводит только выбранный study. В каждом из 32 уроков `CORE-000`/`VC-101` есть и beginner, и отдельный module_example. В результате module_example нельзя открыть в публичном reader, хотя он есть в скачанной книге. Protected reader показывает его через details «Ещё один пример для всего модуля» (`src/screens/academy/Learning.tsx:63`).

Пример CORE-000-M1-L1: виден «Мини-пример», скрыт «Подобрать инструмент под вопрос». Доказательство перечня: `courses/secondary-examples.json` (32 записи). Влияние: потеря подготовленных объяснений именно в курсах для начинающих. Исправление выполнено в рабочей копии: Material отображает все study-примеры, сначала beginner, затем module_example, сохраняя объяснение каждого. Второй пример больше не удаляется фильтром. Для окончательного подтверждения UI рекомендован браузерный сценарий CORE-000-M1-L1: видны оба заголовка «Мини-пример» и «Подобрать инструмент под вопрос».

### C3 · P2 · При двух проверках одного урока интерфейс не позволяет завершить его

**Условная конфигурация:** в текущем авторском корпусе у уроков по одной проверке, поэтому это не утверждение о массовой блокировке нынешних 448 занятий. Административный API допускает несколько assessments, и существующие database tests используют такое устройство.

`supabase/migrations/20261028091000_academy_version_policy.sql:84` возвращает только один `assessment` с `LIMIT 1`; `:89` требует пройти **все** опубликованные assessments этого урока. `src/screens/academy/Learning.tsx:43–47` и `Quiz.tsx` работают только с единственной проверкой. Второй assessment не возвращается в lesson response и не предлагается в интерфейсе курса (список program.assessments включает только course-level capstones).

Воспроизведено на реальных PostgreSQL-функциях в PGlite с актуальными миграциями: урок L, два опубликованных квиза Q1/Q2. Пройти Q1 → запрос complete получает `academy_assessment_required`; повторное чтение L всё ещё возвращает Q1 и passed receipt 100, Q2 отсутствует в response. Доказательство: `courses/multiple-assessments.mjs`, `courses/multiple-assessments.json`. Скрипт выполнился успешно.

Исправление: вернуть массив assessments с явными состояниями и отрисовать все проверки/следующую незавершённую. Альтернатива: валидатор публикации должен запрещать более одного assessment на lesson, если это намеренное ограничение продукта.

## Ограничения

Рабочие Telegram, Supabase и публикация curriculum не подтверждены. Тесты используют синтетические данные и локальный PostgreSQL, пользовательские зачисления/работы не запрашивались. Сетевая доступность сторонних источников заново не проверялась. Учебные материалы не оцениваются как экспертная аккредитация; проверены наличие, доставка, порядок и поведение функций. P0/P1 в исследованной области не подтверждены.

## Проверка исправлений C1/C2

`npm run academy:content` завершён успешно без DB writes. 28 книг перегенерированы; metadata manifest остаётся без source bodies и refs для компактной основной сборки. `node --test tests/course-materials.test.mjs`: **5/5**. Проверены полный набор 851 внешней ссылки, NIST в первом CORE уроке, unsafe protocols/credentials/token/signed URLs, internal/methodological/draft/unverified/unlicensed sources и исключение приватных source/link полей. Журнал: `courses/materials-fixes-tests.log`. LMS multiassessment C3 не изменялся.
