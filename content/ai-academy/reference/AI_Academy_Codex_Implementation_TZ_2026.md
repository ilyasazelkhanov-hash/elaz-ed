# AI Academy — полное методологическое и техническое ТЗ для Codex

> **Версия:** 1.0 · **Дата постановки:** 18.10.2026 · **Язык интерфейса:** русский (RU), архитектурная готовность к KK/EN.  
> **Статус:** требование на реализацию в существующем проекте. *Не является готовым учебным контентом или правом на копирование сторонних материалов.*

## 0. Непосредственная инструкция Codex (прочитать сначала)

**Твоя задача:** реализовать в существующей LMS/веб-приложении полноценный многоуровневый каталог AI Academy и инструменты сопровождения обучения на основе спецификации ниже. Не ограничиваться картинкой или статической витриной. Требуется работающая модель данных, реальные маршруты, связи, CRUD, прогресс, права и seed-контент.

1. **Сначала изучи репозиторий:** README, package manifests, migrations, текущую БД, роутинг, компоненты, систему авторизации, стили, тесты, CI. Составь короткую карту текущей архитектуры в `docs/ai-academy/integration-audit.md`. Не придумывай новый стек при наличии рабочего.
2. **Не переписывай приложение с нуля.** Следуй существующим паттернам (ORM, backend/API, SSR, CSS, UI library). Новые зависимости — только при явном техническом обосновании.
3. **Проверь имеющиеся сущности** `courses`, `lessons`, `users`, `enrollments`, `progress`, `content`, если они существуют. Добавь недостающие поля, таблицы, миграции и адаптеры с сохранением старых данных. Не удаляй пользовательский контент и не перезаписывай вручную созданные материалы.
4. **Соблюдай иерархию:** направление → уровневый курс → модуль → занятие → блок занятия. Источники/компетенции/пререквизиты должны быть связанными сущностями, пригодными для повторного использования.
5. **Разверни данные** из этого документа. При наличии рядом `AI_Academy_Codex_Curriculum_Seed_2026.json` используй его как машиночитаемый seed. Документ самодостаточен: если JSON не передан, смоделируй записи из разделов 5–12. Не выдумывай содержимое урока сверх перечисленной программы.
6. **Сделай seed идемпотентным:** повторный импорт обновляет только контент, помеченный `seed-managed`, по стабильным `code`, не создаёт дублей и не трогает созданные пользователем занятия.
7. **Сохраняй точные первоисточники:** все URL в реестре; пользовательские видео — с таймкодами как дополнительные ссылки. Не скачивай и не копируй чужие платные курсы или видео; внешние материалы только ссылками, пока права не установлены.
8. **Предотврати фальшивую публикацию:** созданные учебные структуры опубликованы только при наличии утверждённого контента; незаполненные занятия в статусе `outline`/`draft`. В demo можно показывать карточки курсов со статусом «Программа формируется», но не выдавать черновики за завершённые курсы.
9. **Реализуй и проверь:** тесты, доступность, мобильную адаптацию, роли, фильтры, прогресс, реестр ресурсов, связность ссылок. Запиши команды запуска и результаты тестирования.
10. Если чего-то нет в исходном репозитории (например, платёжной системы, хранилища видео, почты), **не имитируй реальную оплату или отправку**. Построй интерфейс/адаптер с feature flag и документируй блокер. Для действительно рискованных решений используй текущие настройки проекта и безопасные значения по умолчанию.

### Definition of Done на верхнем уровне
- [ ] Девять направлений плюс единый AI Core отображаются на главной каталога.
- [ ] 27 уровневых курсов (9 × 3) и CORE-000; 112 модулей; 448 именованных занятий после seed.
- [ ] В карточке курса есть результаты, уровень, требования, модули, длительность, финальный проект, программа и применимые источники.
- [ ] Материал одного источника привязывается к нескольким урокам и курсам без дублей.
- [ ] Поддерживаются минимум 8 форматов занятий и составные блоки контента.
- [ ] Администратор может создавать/редактировать/упорядочивать направление, курс, модуль, занятие, источник.
- [ ] У учащегося работают enrolment, прогресс, получение доступа с учётом prerequisites, тесты/сдача проекта.
- [ ] Обычный пользователь не может менять учебный контент, смотреть закрытые попытки других людей или выставлять себе оценки.
- [ ] Права и статус каждого внешнего материала видны в админке; рабочие URL кликабельны.
- [ ] Migration/seed/test/lint/build выполняются без ошибок в окружении проекта.

## 1. Продуктовая рамка и принципы

**Цель:** практическая AI-академия для предпринимателей, IT/нетехнических специалистов, создателей контента и команд. На каждом этапе обучения студент получает измеримый артефакт, применимый за пределами LMS. Общая образовательная парадигма: *объяснение → демонстрация → самостоятельное действие → проверка → исправление → портфолио*.

**Приоритет:** понятная русскоязычная подача; кейсы, применимые в Казахстане и СНГ; английские первоисточники с собственными русскими пояснениями. Не сводить качество к числу курсов, просмотров или к «диплому».

**Границы:** курс должен воспроизводимо решать задачу, а не быть коллекцией обзоров AI-инструментов. Программы независимы от бренда модели; примеры Cursor/Claude/n8n/Runway могут заменяться без изменения целей обучения.

**Линейка:** AI Core доступен всем; девять направлений независимы; каждое направление имеет курсы Junior, Middle, Senior. Level означает **сложность навыка внутри академии**, а не официальную должность выпускника.

### 1.1. Аудитории и пользовательские сценарии
| Роль | Главная задача | Успешный результат |
|---|---|---|
| Новичок | Выбрать специализацию, пройти CORE, начать Junior | Создал и опубликовал первый проект |
| Опытный специалист | Подтвердить входные знания и перейти на Middle | Обошёл вводные темы через placement test |
| Продвинутый/техлид | Освоить Senior для сложной системы | Защитил архитектуру, риски, качество и затраты |
| Преподаватель | Составить программу занятия, проверять работы | Видит назначенные submissions и оценки |
| Редактор/методолог | Переиспользовать материалы и обновлять учебную карту | Ссылки, модули и цели не продублированы |
| Администратор | Поддерживать каталог, пользователей и доступ | Безопасно управляет публикацией и назначениями |
| Гость | Изучить выбор программ, результаты и фрагменты уроков | Может принять обоснованное решение о записи |

### 1.2. Категории и границы специализаций
| Код | Направление | Что входит | Что **не** включать как основной предмет |
|---|---|---|---|
| `VC` | **Vibe Coding** | Разработка сайтов, приложений, MVP и цифровых продуктов с AI | Проектирование автономного agent harness (это ENG) |
| `ENG` | **AI Engineering & Developer Agents** | AI-native инженерная среда и управляемая разработка | Учить дизайну каждого лендинга (это VC/DS) |
| `AU` | **AI Automation** | Проектирование и внедрение автоматизаций бизнес-процессов | Обучать архитектуре LLM отдельно от интеграций (это AG) |
| `AG` | **AI Agents & RAG** | Ассистенты, поиск по знаниям, инструменты и агентные системы | Обучать Zapier/n8n как самоцель (это AU) |
| `CR` | **AI Creator** | Визуальный, видео-, аудио- и мультимодальный продакшн | Перформанс-маркетинг и ROI (это MK) |
| `DS` | **AI Design & UX** | Исследование опыта, UI/UX, прототипы, дизайн-системы | Генерация рекламных видео как основной предмет (это CR) |
| `MK` | **AI Marketing & Growth** | Продвижение, продажи, аналитика роста и AI-поиск | Постановка светa и постобработка VFX (это CR) |
| `DT` | **AI Data & Research** | Исследования, анализ данных, верификация и BI | Настройка ETL для продаж как единственная цель (это AU) |
| `BI` | **AI Business & Product** | AI-продуктивность, продуктовый менеджмент, внедрение и стратегия | Переучивать все инструменты из соседних специализаций |

### 1.3. Пересечения и reuse
- Один concept skill («MCP», «evals», «контекст», «API», «copyright») живёт в отдельном реестре компетенций и связывается с **несколькими** уроками.
- Один source URL (включая YouTube) создаётся **один раз**, а `source_link` хранит привязку к конкретной теме, роль ссылки, фрагмент `start_seconds`, заметку преподавателя.
- Один контент-блок может переиспользоваться внутри нескольких занятий по явному редакторскому решению; публикация новой версии не должна ломать пройденные попытки.
- Не смешивать внешние **референсы для методолога** и материалы, которые ученик обязан смотреть. У source_link есть `visibility = internal|student`, `usage = methodological|supplementary|required|counterexample`.
- Пересечение допускается и в prerequisites, и в cross-sell: например, после VC-201 предлагаются ENG-201 и DS-201; после AU-201 — AG-201.

## 2. Уровни, форматы и педагогическая модель

| Уровень | Учебный фокус | Подсказки | Практический артефакт | Что необходимо для зачёта |
|---|---|---|---|---|
| **Junior** | Понять и повторить процесс, объяснить ограничения | Полный walk-through и шаблоны | Рабочая простая система/контент | Работает + объясняет + нет критических ошибок |
| **Middle** | Самостоятельно решить небуквальную задачу клиента | Частичные подсказки, набор критериев | Применимый проект с интеграциями | Качество, воспроизводимость, понятная передача |
| **Senior** | Принять архитектурные решения при конфликте требований | Контекст и ограничения без готового решения | Поддерживаемая система/стратегия | Evals, риски, безопасность, стоимость, эксплуатация |

**Переход:** по умолчанию `CORE-000 → *-101 → *-201 → *-301`; допускается зачисление выше по placement test и подтверждённому портфолио. Факт прохождения одного направления не означает автоматический пропуск соседнего. Senior технических направлений может требовать базовый Git/API/Python; обязательно отражать в карточке.

### 2.1. Форматы занятия (enum + пример блока)
| Код | Формат | Ожидаемое действие пользователя | Элементы UI |
|---|---|---|---|
| `microlecture` | Микролекция/текст | Изучить принцип и ответить на проверочный вопрос | Markdown + иллюстрация + short quiz |
| `guided_demo` | Пошаговая демонстрация | Повторить видео/скринкаст или показ преподавателя | video link/player + chapters + checklist |
| `hands_on_lab` | Лабораторная | Создать измеримый артефакт | task steps + files + submission |
| `knowledge_check` | Квиз/диагностика | Выбрать/объяснить правильное решение | MCQ/multi/text/code + retries |
| `case_review` | Кейс-разбор/peer review | Сравнить 2 решения по рубрике | case brief + compare + rubric |
| `live_workshop` | Воркшоп | Пройти совместную практику | meeting link + materials + replay |
| `assignment` | Домашнее задание | Самостоятельно применить навык | deliverable spec + upload/link + review |
| `project_defense` | Защита проекта | Обосновать результат и риски | demo link + presentation + Q&A/rubric |
| `resource` | Справочник/шпаргалка | Вернуться к точной инструкции | Markdown + download + references |

**Занятие — контейнер:** `primary_format` задаёт основной тип, но каждый урок может включать `content_blocks` разных форматов (текст, видео, упражнение, шаблон, тест, ссылка, файл, checkpoint). Не ограничивать урок одним видео. Поддерживать `start_seconds/end_seconds` для внешних видео; если embed запрещён платформой, обычная ссылка.

### 2.2. Урок по умолчанию
1. **Зачем это нужно (1–2 минуты):** контекст, задача, критерий готовности.
2. **Разбор принципа (8–18 минут):** терминология, ограничения, пример.
3. **Демонстрация (15–30 минут):** экран, реальные сбои и исправления.
4. **Лабораторная (30–90 минут):** самостоятельная задача со входными данными.
5. **Проверка (5–20 минут):** чеклист, тест или ревью, ссылку на результат.
6. **Допматериалы:** 1–3 точных ссылки, уровень сложности, альтернативные инструменты.

### 2.3. Оценивание
| Junior | Вес | Middle | Вес | Senior | Вес |
|---|---:|---|---:|---|---:|
| Работающий результат | 40 | Польза решения | 25 | Архитектура | 25 |
| Понимание | 20 | Надёжность | 25 | Риски/безопасность | 25 |
| Точность/безопасность | 20 | Самостоятельность | 30 | Измеримое качество | 25 |
| Документация | 20 | Передача заказчику | 20 | Экономика/эксплуатация | 25 |

По умолчанию проходной порог `70/100`, **с обязательным выполнением критических критериев** (без утечек секретов, опасных действий без подтверждения, фиктивных источников, отсутствия рабочего результата). Рубрика версионируется. Не присваивать Senior только за прохождение видео.

## 3. Каталог направления → курс → модуль → занятие

Этот раздел — **полный curriculum seed**. Названия уроков из предыдущей карты сохранены; новые специализации дополняют их. У всех записей стабильные ID. В таблицах «Л1–Л4» — разные занятия, а не подпункты одной лекции.

### 3.0. Общий курс AI CORE

#### CORE-000 · AI Foundations: единый фундамент

**Уровень:** Core · **Ориентировочная нагрузка:** 10 академических/практических часов (пересчитать при записи контента).  
**Вход:** Нет.  
**Измеримый результат:** Общее владение AI-терминологией и безопасным применением.  
**Capstone:** Пакет промптов и policy безопасного применения.

**CORE-000-M1 — AI-грамотность и сценарии**  
Результат модуля: Карта применимости моделей.

- `CORE-000-M1-L1` · **Микролекция / чтение** · 15 мин — **Основные типы моделей и ограничения**.
- `CORE-000-M1-L2` · **Демонстрация с повторением** · 20 мин — **От простого промпта к хорошему ТЗ**.
- `CORE-000-M1-L3` · **Лабораторная / практикум** · 35 мин — **Эксперимент: одна задача в двух моделях**.
- `CORE-000-M1-L4` · **Квиз / диагностический тест** · 20 мин — **Квиз по критическому мышлению**.
  - **Что сдаёт студент:** Карта применимости моделей. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [F01: OpenAI Prompt Engineering Guide](https://developers.openai.com/api/docs/guides/prompt-engineering); [A20: Google: Prompt Design Strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies); [B01: Andrew Ng: Generative AI for Everyone](https://www.coursera.org/learn/generative-ai-for-everyone).

**CORE-000-M2 — Контекст и безопасность**  
Результат модуля: Правила использования AI.

- `CORE-000-M2-L1` · **Микролекция / чтение** · 15 мин — **Файлы, контекст, RAG — принципиальные отличия**.
- `CORE-000-M2-L2` · **Демонстрация с повторением** · 20 мин — **Конфиденциальность, IP и разрешённые данные**.
- `CORE-000-M2-L3` · **Лабораторная / практикум** · 35 мин — **Практика prompt iteration и self-check**.
- `CORE-000-M2-L4` · **Квиз / диагностический тест** · 20 мин — **Разбор этической ситуации и рисков**.
  - **Что сдаёт студент:** Правила использования AI. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [A20: Google: Prompt Design Strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies); [C31: UNESCO: GenAI in Education and Research](https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research); [F05: OpenAI: ChatGPT Enterprise Prompt Guide](https://developers.openai.com/cookbook/examples/chatgpt/chatgpt_prompt_guide/chatgpt_prompt_guide).

**CORE-000-M3 — Модели, инструменты и стоимость**  
Результат модуля: Выбирает доступный инструмент с учетом качества, бюджета и доступа.

- `CORE-000-M3-L1` · **Микролекция / чтение** · 18 мин — **Модели, подписки и API: различия**.
- `CORE-000-M3-L2` · **Демонстрация с повторением** · 28 мин — **Сравнение двух моделей на одной задаче**.
- `CORE-000-M3-L3` · **Лабораторная / практикум** · 70 мин — **Сделать модельную матрицу стоимости и качества**.
- `CORE-000-M3-L4` · **Защита проекта** · 30 мин — **Кейс: неизвестные цены и лишние токены**.
  - **Что сдаёт студент:** Model selection sheet. **Проверка:** Указаны assumptions, цены не выдуманы.
  - **Точные референсы:** [F01: OpenAI Prompt Engineering Guide](https://developers.openai.com/api/docs/guides/prompt-engineering); [B06: Andrew Ng: AI Prompting for Everyone](https://www.deeplearning.ai/courses/ai-prompting-for-everyone); [A20: Google: Prompt Design Strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies).

**CORE-000-M4 — Право, проверка и учебная этика**  
Результат модуля: Безопасно использует данные и чужие материалы.

- `CORE-000-M4-L1` · **Микролекция / чтение** · 18 мин — **Приватность, персональные данные, авторские права**.
- `CORE-000-M4-L2` · **Демонстрация с повторением** · 28 мин — **Проверить AI-ответ по первоисточникам**.
- `CORE-000-M4-L3` · **Лабораторная / практикум** · 70 мин — **Составить policy и маркировку AI-материалов**.
- `CORE-000-M4-L4` · **Защита проекта** · 30 мин — **Итоговая мини-защита AI Core**.
  - **Что сдаёт студент:** Policy + source ledger. **Проверка:** Нет раскрытия секретов; источники и права учтены.
  - **Точные референсы:** [C31: UNESCO: GenAI in Education and Research](https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research); [G19: Promptfoo Getting Started](https://github.com/promptfoo/promptfoo/blob/main/site/docs/getting-started.md); [B21: Carnegie Mellon: Assessments](https://www.cmu.edu/teaching/designteach/design/assessments.html).

**Дополнительная библиотека курса:** [F01: OpenAI Prompt Engineering Guide](https://developers.openai.com/api/docs/guides/prompt-engineering); [A20: Google: Prompt Design Strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies); [B01: Andrew Ng: Generative AI for Everyone](https://www.coursera.org/learn/generative-ai-for-everyone); [F03: Microsoft: AI for Beginners RU](https://github.com/microsoft/AI-For-Beginners/blob/main/translations/ru/README.md); [C31: UNESCO: GenAI in Education and Research](https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research); [F05: OpenAI: ChatGPT Enterprise Prompt Guide](https://developers.openai.com/cookbook/examples/chatgpt/chatgpt_prompt_guide/chatgpt_prompt_guide); [F06: Learn Prompting: Russian Intro](https://learnprompting.org/ru/docs/introduction); [B06: Andrew Ng: AI Prompting for Everyone](https://www.deeplearning.ai/courses/ai-prompting-for-everyone).

### 3.1. Направление VC — Vibe Coding

**Задача направления:** Разработка сайтов, приложений, MVP и цифровых продуктов с AI.  
**Целевая аудитория:** builders, founders, non-developers.  
**Маршрут:** `VC-101` → `VC-201` → `VC-301`; placement test позволяет ускорить переход.

#### VC-101 · Первое приложение с AI

**Уровень:** Junior · **Ориентировочная нагрузка:** 18 академических/практических часов (пересчитать при записи контента).  
**Вход:** AI Core либо входной тест.  
**Измеримый результат:** Создаёт, тестирует и объясняет работу первого продукта.  
**Capstone:** Опубликованный сайт с формой заявок.

**VC-101-M1 — Задача и продукт**  
Результат модуля: Понятный PRD на одну страницу.

- `VC-101-M1-L1` · **Микролекция / чтение** · 15 мин — **Что такое вайбкодинг и где он полезен**.
- `VC-101-M1-L2` · **Демонстрация с повторением** · 25 мин — **Разбор успешного и провального первого промпта**.
- `VC-101-M1-L3` · **Лабораторная / практикум** · 75 мин — **Формулируем JTBD, сценарии и PRD**.
- `VC-101-M1-L4` · **Квиз / диагностический тест** · 25 мин — **Проверяем требования на ясность**.
  - **Что сдаёт студент:** Понятный PRD на одну страницу. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [V01: Microsoft Learn: Введение в вайбкодинг](https://learn.microsoft.com/ru-ru/training/modules/introduction-vibe-coding/); [V02: DeepLearning.AI: Vibe Coding 101 with Replit](https://www.deeplearning.ai/courses/vibe-coding-101-with-replit); [V03: Яндекс Практикум: Вайбкодинг](https://practicum.yandex.kz/vibe-coding/).

**VC-101-M2 — Дизайн интерфейса**  
Результат модуля: Прототип 3–5 экранов.

- `VC-101-M2-L1` · **Кейс-разбор / peer review** · 20 мин — **Основы UI: экран, состояние, компонент**.
- `VC-101-M2-L2` · **Кейс-разбор / peer review** · 30 мин — **Разбор референсов и быстрый wireframe**.
- `VC-101-M2-L3` · **Лабораторная / практикум** · 75 мин — **Генерируем мобильный и desktop UI**.
- `VC-101-M2-L4` · **Кейс-разбор / peer review** · 25 мин — **Проверка доступности и пользовательского сценария**.
  - **Что сдаёт студент:** Прототип 3–5 экранов. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [V02: DeepLearning.AI: Vibe Coding 101 with Replit](https://www.deeplearning.ai/courses/vibe-coding-101-with-replit); [V06: Нетология: Вайбкодинг](https://netology.ru/programs/ai-coding); [V07: Replit Learn: Build Your Idea](https://learn.replit.com/docs/ai-foundations/lesson-7).

**VC-101-M3 — Сборка приложения**  
Результат модуля: Работающая локальная версия.

- `VC-101-M3-L1` · **Микролекция / чтение** · 15 мин — **Frontend, backend, API: минимум терминов**.
- `VC-101-M3-L2` · **Демонстрация с повторением** · 35 мин — **Демонстрация генерации сайта в Replit/Lovable**.
- `VC-101-M3-L3` · **Домашнее задание** · 90 мин — **Собираем форму, страницу и обработку данных**.
- `VC-101-M3-L4` · **Кейс-разбор / peer review** · 30 мин — **Как отличать баги от плохого промпта**.
  - **Что сдаёт студент:** Работающая локальная версия. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [V02: DeepLearning.AI: Vibe Coding 101 with Replit](https://www.deeplearning.ai/courses/vibe-coding-101-with-replit); [V08: Replit Learn: Your First App](https://learn.replit.com/docs/ai-foundations/lesson-4); [V09: freeCodeCamp: Full Stack Mobile App with AI](https://www.freecodecamp.org/news/build-and-publish-a-full-stack-mobile-app-with-ai).

**VC-101-M4 — Публикация и демо**  
Результат модуля: Публичная ссылка и README.

- `VC-101-M4-L1` · **Микролекция / чтение** · 20 мин — **Что такое деплой и домен**.
- `VC-101-M4-L2` · **Живой воркшоп** · 65 мин — **Демонстрация публикации и изменений**.
- `VC-101-M4-L3` · **Лабораторная / практикум** · 90 мин — **Деплоим и проводим smoke-test**.
- `VC-101-M4-L4` · **Защита проекта** · 35 мин — **Защита: показать ценность за 3 минуты**.
  - **Что сдаёт студент:** Публичная ссылка и README. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [V02: DeepLearning.AI: Vibe Coding 101 with Replit](https://www.deeplearning.ai/courses/vibe-coding-101-with-replit); [V09: freeCodeCamp: Full Stack Mobile App with AI](https://www.freecodecamp.org/news/build-and-publish-a-full-stack-mobile-app-with-ai); [V11: VibeCoding Training](https://github.com/codenjoyme/vibecoding-training).

**Дополнительная библиотека курса:** [V01: Microsoft Learn: Введение в вайбкодинг](https://learn.microsoft.com/ru-ru/training/modules/introduction-vibe-coding/); [V02: DeepLearning.AI: Vibe Coding 101 with Replit](https://www.deeplearning.ai/courses/vibe-coding-101-with-replit); [V03: Яндекс Практикум: Вайбкодинг](https://practicum.yandex.kz/vibe-coding/); [V04: Replit Learn: What is Vibe Coding?](https://learn.replit.com/docs/ai-foundations/lesson-3); [V05: Vibe Code School: учебный репозиторий](https://github.com/dineshxr/vibecodeschool); [V06: Нетология: Вайбкодинг](https://netology.ru/programs/ai-coding); [V07: Replit Learn: Build Your Idea](https://learn.replit.com/docs/ai-foundations/lesson-7); [V08: Replit Learn: Your First App](https://learn.replit.com/docs/ai-foundations/lesson-4).

#### VC-201 · Full-stack MVP с AI

**Уровень:** Middle · **Ориентировочная нагрузка:** 26 академических/практических часов (пересчитать при записи контента).  
**Вход:** Junior-аттестация или HTML/JS, Git, API.  
**Измеримый результат:** Самостоятельно проектирует и выпускает MVP.  
**Capstone:** Рабочая CRM/бронирование с аккаунтами и БД.

**VC-201-M1 — Архитектура приложения**  
Результат модуля: Диаграмма компонентов и модель данных.

- `VC-201-M1-L1` · **Кейс-разбор / peer review** · 20 мин — **От бизнес-сценариев к user stories**.
- `VC-201-M1-L2` · **Кейс-разбор / peer review** · 30 мин — **API, REST, schema, SQL без магии**.
- `VC-201-M1-L3` · **Лабораторная / практикум** · 75 мин — **Создаём ERD и контракты эндпоинтов**.
- `VC-201-M1-L4` · **Кейс-разбор / peer review** · 25 мин — **Архитектурное ревью двух вариантов**.
  - **Что сдаёт студент:** Диаграмма компонентов и модель данных. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [V12: Vibe Coding Master Curriculum](https://github.com/diamitani/vibe-coding-course/blob/main/curriculum/00_MASTER_CURRICULUM.md); [V13: Vibe Coding: 12 week Roadmap](https://github.com/anishutrains/vibe-coding/blob/main/vibe-coding-course/COURSE_ROADMAP.md); [V07: Replit Learn: Build Your Idea](https://learn.replit.com/docs/ai-foundations/lesson-7).

**VC-201-M2 — Разработка в AI IDE**  
Результат модуля: Репозиторий с управляемым контекстом.

- `VC-201-M2-L1` · **Микролекция / чтение** · 15 мин — **Контекст и агенты: когда модель теряет нить**.
- `VC-201-M2-L2` · **Демонстрация с повторением** · 35 мин — **Project rules, AGENTS.md, Git и ветки**.
- `VC-201-M2-L3` · **Домашнее задание** · 90 мин — **Разработка функциональности малыми инкрементами**.
- `VC-201-M2-L4` · **Кейс-разбор / peer review** · 30 мин — **Code review с поиском опасных изменений**.
  - **Что сдаёт студент:** Репозиторий с управляемым контекстом. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [V05: Vibe Code School: учебный репозиторий](https://github.com/dineshxr/vibecodeschool); [V15: Cursor: Project Rules & AGENTS.md](https://docs.cursor.com/context/rules-for-ai); [V16: Anthropic: Claude Code in Action](https://anthropic.skilljar.com/claude-code-in-action).

**VC-201-M3 — Интеграции и доступ**  
Результат модуля: Клиентский сценарий end-to-end.

- `VC-201-M3-L1` · **Микролекция / чтение** · 20 мин — **Авторизация и роли пользователей**.
- `VC-201-M3-L2` · **Живой воркшоп** · 65 мин — **Демонстрация безопасного секрет-хранилища**.
- `VC-201-M3-L3` · **Лабораторная / практикум** · 90 мин — **Подключаем БД, API и уведомления**.
- `VC-201-M3-L4` · **Защита проекта** · 35 мин — **Негативные тесты доступа и данных**.
  - **Что сдаёт студент:** Клиентский сценарий end-to-end. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [V07: Replit Learn: Build Your Idea](https://learn.replit.com/docs/ai-foundations/lesson-7); [V03: Яндекс Практикум: Вайбкодинг](https://practicum.yandex.kz/vibe-coding/); [V12: Vibe Coding Master Curriculum](https://github.com/diamitani/vibe-coding-course/blob/main/curriculum/00_MASTER_CURRICULUM.md).

**VC-201-M4 — Релиз и качество**  
Результат модуля: MVP с тестами и историей версий.

- `VC-201-M4-L1` · **Микролекция / чтение** · 15 мин — **Unit, integration, e2e, smoke: что выбирать**.
- `VC-201-M4-L2` · **Демонстрация с повторением** · 25 мин — **CI/CD и миграции БД на примере**.
- `VC-201-M4-L3` · **Лабораторная / практикум** · 75 мин — **Отлаживаем приложение на реальных ошибках**.
- `VC-201-M4-L4` · **Квиз / диагностический тест** · 25 мин — **Приёмка по чек-листу заказчика**.
  - **Что сдаёт студент:** MVP с тестами и историей версий. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [V11: VibeCoding Training](https://github.com/codenjoyme/vibecoding-training); [V16: Anthropic: Claude Code in Action](https://anthropic.skilljar.com/claude-code-in-action); [V19: Microsoft: Generative AI for Beginners](https://github.com/microsoft/generative-ai-for-beginners/blob/main/translations/ru/README.md).

**Дополнительная библиотека курса:** [V12: Vibe Coding Master Curriculum](https://github.com/diamitani/vibe-coding-course/blob/main/curriculum/00_MASTER_CURRICULUM.md); [V13: Vibe Coding: 12 week Roadmap](https://github.com/anishutrains/vibe-coding/blob/main/vibe-coding-course/COURSE_ROADMAP.md); [V07: Replit Learn: Build Your Idea](https://learn.replit.com/docs/ai-foundations/lesson-7); [V05: Vibe Code School: учебный репозиторий](https://github.com/dineshxr/vibecodeschool); [V15: Cursor: Project Rules & AGENTS.md](https://docs.cursor.com/context/rules-for-ai); [V16: Anthropic: Claude Code in Action](https://anthropic.skilljar.com/claude-code-in-action); [V17: Anthropic: Claude Code Overview](https://docs.anthropic.com/en/docs/claude-code/overview); [V03: Яндекс Практикум: Вайбкодинг](https://practicum.yandex.kz/vibe-coding/).

#### VC-301 · Product-Grade AI SaaS: Architecture & Delivery

**Уровень:** Senior · **Ориентировочная нагрузка:** 34 академических/практических часов (пересчитать при записи контента).  
**Вход:** Middle-аттестация, Git, API, БД и тесты.  
**Измеримый результат:** Развивает и выпускает продукт, разбирается в безопасности, техдолге и экономике; не подменяет специализированную harness-инженерию ENG-301.  
**Capstone:** SaaS MVP с мониторингом, безопасностью и документацией.

**VC-301-M1 — Архитектура и ограничения**  
Результат модуля: ADR и оценка компромиссов.

- `VC-301-M1-L1` · **Микролекция / чтение** · 15 мин — **Надёжность, масштаб и ограничения продукта**.
- `VC-301-M1-L2` · **Демонстрация с повторением** · 35 мин — **Monolith vs services: case teardown**.
- `VC-301-M1-L3` · **Домашнее задание** · 90 мин — **Проектируем границы модулей и модель угроз**.
- `VC-301-M1-L4` · **Кейс-разбор / peer review** · 30 мин — **Защита архитектурного решения**.
  - **Что сдаёт студент:** ADR и оценка компромиссов. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [V13: Vibe Coding: 12 week Roadmap](https://github.com/anishutrains/vibe-coding/blob/main/vibe-coding-course/COURSE_ROADMAP.md); [V20: Microsoft: AI Agents Study Guide](https://github.com/microsoft/ai-agents-for-beginners/blob/main/STUDY_GUIDE.md); [V21: Microsoft: AI Agents repo](https://github.com/microsoft/ai-agents-for-beginners).

**VC-301-M2 — AI-assisted delivery продукта**  
Результат модуля: Релиз продуктовой фичи с AI без внедрения собственного agent harness.

- `VC-301-M2-L1` · **Микролекция / чтение** · 20 мин — **Claude Code, Codex, subagents: роли**.
- `VC-301-M2-L2` · **Живой воркшоп** · 65 мин — **MCP, project rules, skills и контекст**.
- `VC-301-M2-L3` · **Лабораторная / практикум** · 90 мин — **Строим агентный цикл: задача → PR → тест**.
- `VC-301-M2-L4` · **Защита проекта** · 35 мин — **Разбор неудачных агентных изменений**.
  - **Что сдаёт студент:** Воспроизводимый workflow с AI-кодингом. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [V15: Cursor: Project Rules & AGENTS.md](https://docs.cursor.com/context/rules-for-ai); [V17: Anthropic: Claude Code Overview](https://docs.anthropic.com/en/docs/claude-code/overview); [V10: Stepik: Кодовый ИИ-агент Cursor AI](https://stepik.org/course/294150/promo).

**VC-301-M3 — Тесты и безопасность**  
Результат модуля: Набор регрессионных и security тестов.

- `VC-301-M3-L1` · **Микролекция / чтение** · 15 мин — **Threat modeling и OWASP для AI-generated кода**.
- `VC-301-M3-L2` · **Демонстрация с повторением** · 25 мин — **Coverage, property tests, regression**.
- `VC-301-M3-L3` · **Лабораторная / практикум** · 75 мин — **Автоматизируем проверки и ревью diff**.
- `VC-301-M3-L4` · **Квиз / диагностический тест** · 25 мин — **Red team: находим критические дефекты**.
  - **Что сдаёт студент:** Набор регрессионных и security тестов. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [V19: Microsoft: Generative AI for Beginners](https://github.com/microsoft/generative-ai-for-beginners/blob/main/translations/ru/README.md); [V21: Microsoft: AI Agents repo](https://github.com/microsoft/ai-agents-for-beginners); [V20: Microsoft: AI Agents Study Guide](https://github.com/microsoft/ai-agents-for-beginners/blob/main/STUDY_GUIDE.md).

**VC-301-M4 — Production и передача**  
Результат модуля: Runbook и метрики работоспособности.

- `VC-301-M4-L1` · **Кейс-разбор / peer review** · 20 мин — **SLO, ошибки, логи и алерты**.
- `VC-301-M4-L2` · **Кейс-разбор / peer review** · 30 мин — **Инструментируем приложение и расходы**.
- `VC-301-M4-L3` · **Лабораторная / практикум** · 75 мин — **Готовим rollback, резервирование и runbook**.
- `VC-301-M4-L4` · **Кейс-разбор / peer review** · 25 мин — **Финальная защита качества и TCO**.
  - **Что сдаёт студент:** Runbook и метрики работоспособности. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [V11: VibeCoding Training](https://github.com/codenjoyme/vibecoding-training); [V20: Microsoft: AI Agents Study Guide](https://github.com/microsoft/ai-agents-for-beginners/blob/main/STUDY_GUIDE.md); [B04: OpenAI: Small Business Workshop](https://academy.openai.com/en/public/resources/openai-academy-small-business-resource-hub-2026-06-03).

**Дополнительная библиотека курса:** [V13: Vibe Coding: 12 week Roadmap](https://github.com/anishutrains/vibe-coding/blob/main/vibe-coding-course/COURSE_ROADMAP.md); [V20: Microsoft: AI Agents Study Guide](https://github.com/microsoft/ai-agents-for-beginners/blob/main/STUDY_GUIDE.md); [V21: Microsoft: AI Agents repo](https://github.com/microsoft/ai-agents-for-beginners); [V15: Cursor: Project Rules & AGENTS.md](https://docs.cursor.com/context/rules-for-ai); [V17: Anthropic: Claude Code Overview](https://docs.anthropic.com/en/docs/claude-code/overview); [V10: Stepik: Кодовый ИИ-агент Cursor AI](https://stepik.org/course/294150/promo); [V16: Anthropic: Claude Code in Action](https://anthropic.skilljar.com/claude-code-in-action); [V19: Microsoft: Generative AI for Beginners](https://github.com/microsoft/generative-ai-for-beginners/blob/main/translations/ru/README.md).

### 3.2. Направление ENG — AI Engineering & Developer Agents

**Задача направления:** AI-native инженерная среда и управляемая разработка.  
**Целевая аудитория:** developers, tech leads, DevOps.  
**Маршрут:** `ENG-101` → `ENG-201` → `ENG-301`; placement test позволяет ускорить переход.

#### ENG-101 · AI Developer Foundations

**Уровень:** Junior · **Ориентировочная нагрузка:** 20 академических/практических часов (пересчитать при записи контента).  
**Вход:** CORE или входной тест; уверенное пользование ПК.  
**Измеримый результат:** Изменяет существующий проект через AI-IDE и обосновывает правки.  
**Capstone:** Pull request в учебный репозиторий с тестом и README.

**ENG-101-M1 — Рабочая среда и базовая инженерия**  
Результат модуля: Разворачивает локальный проект и объясняет компоненты среды.

- `ENG-101-M1-L1` · **Микролекция / чтение** · 18 мин — **Как связаны репозиторий, runtime, зависимости и тесты**.
- `ENG-101-M1-L2` · **Демонстрация с повторением** · 28 мин — **Git, VS Code, терминал: настройка окружения**.
- `ENG-101-M1-L3` · **Лабораторная / практикум** · 70 мин — **Развернуть starter-repo и зафиксировать baseline**.
- `ENG-101-M1-L4` · **Кейс-разбор / peer review** · 30 мин — **Найти и восстановить сломанное окружение**.
  - **Что сдаёт студент:** Локально работающий starter-repo. **Проверка:** Чистая сборка и задокументированные команды.
  - **Точные референсы:** [U01: Видеоурок: от LLM до Vue/SQLite/Docker + autonomous agent](https://www.youtube.com/watch?v=-q5VabXMWfk); [U03: Практикум: VS Code, Supabase, Vercel](https://www.youtube.com/watch?v=jHB5kr0qAIA); [U06: Практикум Claude Code: настройки, контекст, MCP, skills](https://www.youtube.com/watch?v=Ai9woxKSbKY).

**ENG-101-M2 — Общение с coding-агентом**  
Результат модуля: Пишет проверяемые задачи агенту.

- `ENG-101-M2-L1` · **Микролекция / чтение** · 18 мин — **Agent loop: чтение, правка, исполнение, проверка**.
- `ENG-101-M2-L2` · **Демонстрация с повторением** · 28 мин — **Точный prompt, план изменений и git diff**.
- `ENG-101-M2-L3` · **Лабораторная / практикум** · 70 мин — **Добавить небольшую функцию, не нарушив другие**.
- `ENG-101-M2-L4` · **Квиз / диагностический тест** · 30 мин — **Диагностика плохо ограниченной задачи**.
  - **Что сдаёт студент:** Патч + короткий план изменений. **Проверка:** Diff читаем; затронуты только нужные файлы.
  - **Точные референсы:** [U01: Видеоурок: от LLM до Vue/SQLite/Docker + autonomous agent](https://www.youtube.com/watch?v=-q5VabXMWfk); [U03: Практикум: VS Code, Supabase, Vercel](https://www.youtube.com/watch?v=jHB5kr0qAIA); [U06: Практикум Claude Code: настройки, контекст, MCP, skills](https://www.youtube.com/watch?v=Ai9woxKSbKY).

**ENG-101-M3 — Контекст проекта**  
Результат модуля: Настраивает инструкции и управляет контекстом.

- `ENG-101-M3-L1` · **Микролекция / чтение** · 18 мин — **Роль AGENTS.md, CLAUDE.md, spec.md**.
- `ENG-101-M3-L2` · **Демонстрация с повторением** · 28 мин — **Написать правила репозитория и ограничения**.
- `ENG-101-M3-L3` · **Лабораторная / практикум** · 70 мин — **Провести задачу с контекстом проекта**.
- `ENG-101-M3-L4` · **Кейс-разбор / peer review** · 30 мин — **Разобрать конфликтующие инструкции и утечку контекста**.
  - **Что сдаёт студент:** AGENTS.md + spec.md + PR. **Проверка:** Требования однозначны; нет секретов в контексте.
  - **Точные референсы:** [U02: Владилен Минин: вайбкодинг и Replit](https://www.youtube.com/watch?v=q6w9KiI8URo); [V16: Anthropic: Claude Code in Action](https://anthropic.skilljar.com/claude-code-in-action); [V19: Microsoft: Generative AI for Beginners](https://github.com/microsoft/generative-ai-for-beginners/blob/main/translations/ru/README.md).

**ENG-101-M4 — Тестирование и код-ревью с AI**  
Результат модуля: Не доверяет изменению без проверок.

- `ENG-101-M4-L1` · **Микролекция / чтение** · 18 мин — **Различие unit, integration, e2e, lint, build**.
- `ENG-101-M4-L2` · **Демонстрация с повторением** · 28 мин — **AI-assisted исправление падения теста**.
- `ENG-101-M4-L3` · **Лабораторная / практикум** · 70 мин — **Сделать PR с тестами и самоотчётом**.
- `ENG-101-M4-L4` · **Квиз / диагностический тест** · 30 мин — **Защита изменения и объяснение риска**.
  - **Что сдаёт студент:** Проверенный PR. **Проверка:** Тесты проходят; правки и риски описаны.
  - **Точные референсы:** [U02: Владилен Минин: вайбкодинг и Replit](https://www.youtube.com/watch?v=q6w9KiI8URo); [V16: Anthropic: Claude Code in Action](https://anthropic.skilljar.com/claude-code-in-action); [V19: Microsoft: Generative AI for Beginners](https://github.com/microsoft/generative-ai-for-beginners/blob/main/translations/ru/README.md).

**Дополнительная библиотека курса:** [U01: Видеоурок: от LLM до Vue/SQLite/Docker + autonomous agent](https://www.youtube.com/watch?v=-q5VabXMWfk); [U03: Практикум: VS Code, Supabase, Vercel](https://www.youtube.com/watch?v=jHB5kr0qAIA); [U06: Практикум Claude Code: настройки, контекст, MCP, skills](https://www.youtube.com/watch?v=Ai9woxKSbKY); [U02: Владилен Минин: вайбкодинг и Replit](https://www.youtube.com/watch?v=q6w9KiI8URo); [V16: Anthropic: Claude Code in Action](https://anthropic.skilljar.com/claude-code-in-action); [V19: Microsoft: Generative AI for Beginners](https://github.com/microsoft/generative-ai-for-beginners/blob/main/translations/ru/README.md); [N01: Anthropic: Steering Claude Code (2026)](https://claude.com/resources/articles/steering-claude-code-skills-hooks-rules-subagents-and-more?refid=ep_card_main_event_page).

#### ENG-201 · Agentic Developer Workflows

**Уровень:** Middle · **Ориентировочная нагрузка:** 30 академических/практических часов (пересчитать при записи контента).  
**Вход:** ENG-101 или Git/CLI + ревью кода.  
**Измеримый результат:** Создаёт повторяемую агентную разработку со специализированными ролями.  
**Capstone:** Конвейер issue → план → код → тест → PR → review.

**ENG-201-M1 — Context engineering**  
Результат модуля: Управляет качеством, объёмом и источниками контекста.

- `ENG-201-M1-L1` · **Микролекция / чтение** · 18 мин — **Контекст против памяти, компактация и источники истины**.
- `ENG-201-M1-L2` · **Демонстрация с повторением** · 28 мин — **Архитектура кратких project rules**.
- `ENG-201-M1-L3` · **Лабораторная / практикум** · 70 мин — **Выполнить длинную задачу по PRD без дрейфа требований**.
- `ENG-201-M1-L4` · **Кейс-разбор / peer review** · 30 мин — **Аудит потерь контекста**.
  - **Что сдаёт студент:** Комплект contextual artifacts. **Проверка:** Нет противоречивых инструкций; план сохраняется.
  - **Точные референсы:** [U06: Практикум Claude Code: настройки, контекст, MCP, skills](https://www.youtube.com/watch?v=Ai9woxKSbKY); [U07: Orca IDE: git/worktrees/agents](https://www.youtube.com/watch?v=nL0HxmclDCw); [U08: Herdr: параллельные coding agents](https://www.youtube.com/watch?v=2aedkHEMSKA).

**ENG-201-M2 — Tools, MCP и skills**  
Результат модуля: Отличает вызовы инструментов от статических инструкций.

- `ENG-201-M2-L1` · **Микролекция / чтение** · 18 мин — **API, tool calls, MCP, skills: границы**.
- `ENG-201-M2-L2` · **Демонстрация с повторением** · 28 мин — **Подключить тестовый MCP с минимальными правами**.
- `ENG-201-M2-L3` · **Лабораторная / практикум** · 70 мин — **Создать локальный skill с безопасным вводом**.
- `ENG-201-M2-L4` · **Квиз / диагностический тест** · 30 мин — **Проверка угроз недоверенного MCP**.
  - **Что сдаёт студент:** MCP integration + SKILL.md. **Проверка:** Запросы логируются, права ограничены.
  - **Точные референсы:** [U06: Практикум Claude Code: настройки, контекст, MCP, skills](https://www.youtube.com/watch?v=Ai9woxKSbKY); [U07: Orca IDE: git/worktrees/agents](https://www.youtube.com/watch?v=nL0HxmclDCw); [U08: Herdr: параллельные coding agents](https://www.youtube.com/watch?v=2aedkHEMSKA).

**ENG-201-M3 — Subagents и параллельная работа**  
Результат модуля: Разделяет задачи на безопасные зоны независимости.

- `ENG-201-M3-L1` · **Микролекция / чтение** · 18 мин — **Planner, worker, reviewer; anti-patterns**.
- `ENG-201-M3-L2` · **Демонстрация с повторением** · 28 мин — **Git worktrees и разделённые ветки**.
- `ENG-201-M3-L3` · **Лабораторная / практикум** · 70 мин — **Два параллельных изменения с объединением**.
- `ENG-201-M3-L4` · **Кейс-разбор / peer review** · 30 мин — **Разбор merge-conflict и повторного запуска**.
  - **Что сдаёт студент:** Два PR/изолированные ветки. **Проверка:** Нет потерь изменений; роли не превышают полномочия.
  - **Точные референсы:** [U14: Крестников: Agent Skills, harness, loops](https://www.youtube.com/watch?v=a-NIeMB-Hj8); [N01: Anthropic: Steering Claude Code (2026)](https://claude.com/resources/articles/steering-claude-code-skills-hooks-rules-subagents-and-more?refid=ep_card_main_event_page); [N15: Anthropic: Agent Skills repository](https://github.com/anthropics/skills).

**ENG-201-M4 — Verification loops и hooks**  
Результат модуля: Автоматизирует проверку каждого шага.

- `ENG-201-M4-L1` · **Микролекция / чтение** · 18 мин — **Pre/post hooks, build, lint, tests и sandbox**.
- `ENG-201-M4-L2` · **Демонстрация с повторением** · 28 мин — **Реализовать hook проверки на примере**.
- `ENG-201-M4-L3` · **Лабораторная / практикум** · 70 мин — **Агент исправляет ошибку только после теста**.
- `ENG-201-M4-L4` · **Квиз / диагностический тест** · 30 мин — **Упражнение: сломанный pipeline**.
  - **Что сдаёт студент:** Проверяемый CI-like workflow. **Проверка:** Ошибка воспроизводима; цикл выходит при достижении лимита.
  - **Точные референсы:** [U14: Крестников: Agent Skills, harness, loops](https://www.youtube.com/watch?v=a-NIeMB-Hj8); [N01: Anthropic: Steering Claude Code (2026)](https://claude.com/resources/articles/steering-claude-code-skills-hooks-rules-subagents-and-more?refid=ep_card_main_event_page); [N15: Anthropic: Agent Skills repository](https://github.com/anthropics/skills).

**Дополнительная библиотека курса:** [U06: Практикум Claude Code: настройки, контекст, MCP, skills](https://www.youtube.com/watch?v=Ai9woxKSbKY); [U07: Orca IDE: git/worktrees/agents](https://www.youtube.com/watch?v=nL0HxmclDCw); [U08: Herdr: параллельные coding agents](https://www.youtube.com/watch?v=2aedkHEMSKA); [U14: Крестников: Agent Skills, harness, loops](https://www.youtube.com/watch?v=a-NIeMB-Hj8); [N01: Anthropic: Steering Claude Code (2026)](https://claude.com/resources/articles/steering-claude-code-skills-hooks-rules-subagents-and-more?refid=ep_card_main_event_page); [N15: Anthropic: Agent Skills repository](https://github.com/anthropics/skills); [N16: Agent Skills specification](https://agentskills.io/specification).

#### ENG-301 · Agent Harness & Autonomous Engineering

**Уровень:** Senior · **Ориентировочная нагрузка:** 40 академических/практических часов (пересчитать при записи контента).  
**Вход:** ENG-201 и опыт поддержки сервисов.  
**Измеримый результат:** Проектирует ограниченный, наблюдаемый агентный runtime.  
**Capstone:** Harness с заданием, ролями, аудитом, E2E и бюджетными лимитами.

**ENG-301-M1 — Harness architecture**  
Результат модуля: Определяет контракт agent-runtime, задачи и среды.

- `ENG-301-M1-L1` · **Микролекция / чтение** · 18 мин — **Проектирование событий, состояний и permissions**.
- `ENG-301-M1-L2` · **Демонстрация с повторением** · 28 мин — **Хранилище task state и sandbox lifecycle**.
- `ENG-301-M1-L3` · **Лабораторная / практикум** · 70 мин — **Собрать минимальный harness поверх существующего агента**.
- `ENG-301-M1-L4` · **Кейс-разбор / peer review** · 30 мин — **Architecture review отказов и ролей**.
  - **Что сдаёт студент:** ADR + прототип harness. **Проверка:** Есть границы доверия и recovery strategy.
  - **Точные референсы:** [U04: Владилен Минин: будущее разработки, harness и проверка](https://www.youtube.com/watch?v=WT0yDhfOjaA); [U05: Владилен Минин: Pi coding agent](https://www.youtube.com/watch?v=p3htNgFSPVs); [U08: Herdr: параллельные coding agents](https://www.youtube.com/watch?v=2aedkHEMSKA).

**ENG-301-M2 — Длительные и конкурентные работы**  
Результат модуля: Обеспечивает устойчивость задач к сбоям.

- `ENG-301-M2-L1` · **Микролекция / чтение** · 18 мин — **Durable execution, retries, idempotency**.
- `ENG-301-M2-L2` · **Демонстрация с повторением** · 28 мин — **Спроектировать checkpointing + resume**.
- `ENG-301-M2-L3` · **Лабораторная / практикум** · 70 мин — **Оркестрация нескольких worker/reviewer процессов**.
- `ENG-301-M2-L4` · **Квиз / диагностический тест** · 30 мин — **Chaos test: сбой посередине выполнения**.
  - **Что сдаёт студент:** Восстанавливаемый workflow. **Проверка:** После повтора нет дублирования побочных эффектов.
  - **Точные референсы:** [U04: Владилен Минин: будущее разработки, harness и проверка](https://www.youtube.com/watch?v=WT0yDhfOjaA); [U05: Владилен Минин: Pi coding agent](https://www.youtube.com/watch?v=p3htNgFSPVs); [U08: Herdr: параллельные coding agents](https://www.youtube.com/watch?v=2aedkHEMSKA).

**ENG-301-M3 — E2E, безопасность и observability**  
Результат модуля: Умеет доказать безопасность и качество выполнения.

- `ENG-301-M3-L1` · **Микролекция / чтение** · 18 мин — **Traces, eval suites, security gates**.
- `ENG-301-M3-L2` · **Демонстрация с повторением** · 28 мин — **Playwright E2E и automated reviewer**.
- `ENG-301-M3-L3` · **Лабораторная / практикум** · 70 мин — **Снять traces и сравнить качество двух конфигураций**.
- `ENG-301-M3-L4` · **Кейс-разбор / peer review** · 30 мин — **Adversarial review промпт-инъекций**.
  - **Что сдаёт студент:** Отчёт Evals + E2E + audit log. **Проверка:** Покрыты критические сценарии и отказоустойчивость.
  - **Точные референсы:** [N03: OpenAI: Agents SDK tracing](https://openai.github.io/openai-agents-js/guides/tracing/); [N17: Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents); [G17: OpenAI: Agents improvement loop](https://developers.openai.com/cookbook/examples/agents_sdk/agent_improvement_loop).

**ENG-301-M4 — Бюджет, эксплуатация и governance**  
Результат модуля: Балансирует стоимость, latency, quality и риски.

- `ENG-301-M4-L1` · **Микролекция / чтение** · 18 мин — **Routing моделей и бюджетный контроль**.
- `ENG-301-M4-L2` · **Демонстрация с повторением** · 28 мин — **Настроить алерты, rate limiting и kill switch**.
- `ENG-301-M4-L3` · **Лабораторная / практикум** · 70 мин — **Провести production readiness review**.
- `ENG-301-M4-L4` · **Квиз / диагностический тест** · 30 мин — **Защита trade-off и плана rollback**.
  - **Что сдаёт студент:** Runbook, SLO и cost-sheet. **Проверка:** Лимиты соблюдаются, аварийная остановка работает.
  - **Точные референсы:** [N03: OpenAI: Agents SDK tracing](https://openai.github.io/openai-agents-js/guides/tracing/); [N17: Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents); [G17: OpenAI: Agents improvement loop](https://developers.openai.com/cookbook/examples/agents_sdk/agent_improvement_loop).

**Дополнительная библиотека курса:** [U04: Владилен Минин: будущее разработки, harness и проверка](https://www.youtube.com/watch?v=WT0yDhfOjaA); [U05: Владилен Минин: Pi coding agent](https://www.youtube.com/watch?v=p3htNgFSPVs); [U08: Herdr: параллельные coding agents](https://www.youtube.com/watch?v=2aedkHEMSKA); [U14: Крестников: Agent Skills, harness, loops](https://www.youtube.com/watch?v=a-NIeMB-Hj8); [N02: OpenAI: Agents SDK documentation](https://developers.openai.com/api/docs/guides/agents/sdk); [N03: OpenAI: Agents SDK tracing](https://openai.github.io/openai-agents-js/guides/tracing/); [N17: Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents); [G17: OpenAI: Agents improvement loop](https://developers.openai.com/cookbook/examples/agents_sdk/agent_improvement_loop).

### 3.3. Направление AU — AI Automation

**Задача направления:** Проектирование и внедрение автоматизаций бизнес-процессов.  
**Целевая аудитория:** operators, SMB, automation specialists.  
**Маршрут:** `AU-101` → `AU-201` → `AU-301`; placement test позволяет ускорить переход.

#### AU-101 · Автоматизация без кода

**Уровень:** Junior · **Ориентировочная нагрузка:** 18 академических/практических часов (пересчитать при записи контента).  
**Вход:** AI Core либо входной тест.  
**Измеримый результат:** Собирает простые надёжные сценарии.  
**Capstone:** Обработка заявки из формы до уведомления.

**AU-101-M1 — Логика процессов**  
Результат модуля: Схема AS-IS/TO-BE.

- `AU-101-M1-L1` · **Микролекция / чтение** · 15 мин — **Что стоит автоматизировать, а что нет**.
- `AU-101-M1-L2` · **Демонстрация с повторением** · 25 мин — **Триггер, действие, фильтр на простых примерах**.
- `AU-101-M1-L3` · **Лабораторная / практикум** · 75 мин — **Чертим процесс регистрации заявки**.
- `AU-101-M1-L4` · **Квиз / диагностический тест** · 25 мин — **Квиз: находим узкие места**.
  - **Что сдаёт студент:** Схема AS-IS/TO-BE. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [A01: n8n QS101 Quickstart](https://learn.n8n.io/courses/course-v1:n8n%2BQS101%2B2026H2/about); [A02: Make Academy: Automation to AI Agents](https://academy.make.com/bundles/automation-to-ai-agents-foundation); [A03: n8n N8N101 Essentials](https://learn.n8n.io/courses/course-v1:n8n%2BN8N101%2B2026H2/about).

**AU-101-M2 — Первые сценарии**  
Результат модуля: Рабочая цепочка n8n/Make.

- `AU-101-M2-L1` · **Кейс-разбор / peer review** · 20 мин — **Интерфейс n8n и Make без лишних деталей**.
- `AU-101-M2-L2` · **Кейс-разбор / peer review** · 30 мин — **Демонстрация webhook и таблицы**.
- `AU-101-M2-L3` · **Лабораторная / практикум** · 75 мин — **Собираем форму → таблица → уведомление**.
- `AU-101-M2-L4` · **Кейс-разбор / peer review** · 25 мин — **Читаем историю выполнения и ошибки**.
  - **Что сдаёт студент:** Рабочая цепочка n8n/Make. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [A01: n8n QS101 Quickstart](https://learn.n8n.io/courses/course-v1:n8n%2BQS101%2B2026H2/about); [A05: Zapier Academy: AI Builder Path](https://learn.zapier.com/); [A06: n8n Workflow Templates](https://n8n.io/workflows/).

**AU-101-M3 — LLM в workflow**  
Результат модуля: Классификация и резюмирование входящих.

- `AU-101-M3-L1` · **Микролекция / чтение** · 15 мин — **Что можно доверить модели**.
- `AU-101-M3-L2` · **Демонстрация с повторением** · 35 мин — **Prompt + structured JSON output**.
- `AU-101-M3-L3` · **Домашнее задание** · 90 мин — **Добавляем AI-разбор обращения**.
- `AU-101-M3-L4` · **Кейс-разбор / peer review** · 30 мин — **Тестируем ложные классификации**.
  - **Что сдаёт студент:** Классификация и резюмирование входящих. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [A02: Make Academy: Automation to AI Agents](https://academy.make.com/bundles/automation-to-ai-agents-foundation); [A08: Stepik: ИИ-агенты и автоматизация с n8n](https://stepik.org/course/222232/promo); [A09: n8n N8N103 AI & Testing](https://learn.n8n.io/courses/course-v1:n8n%2BN8N103%2B2026H2/about).

**AU-101-M4 — Первый end-to-end проект**  
Результат модуля: Автоматизация с инструкцией запуска.

- `AU-101-M4-L1` · **Микролекция / чтение** · 20 мин — **Принцип одного владельца процесса**.
- `AU-101-M4-L2` · **Живой воркшоп** · 65 мин — **Демо: email/чат/CRM-уведомление**.
- `AU-101-M4-L3` · **Лабораторная / практикум** · 90 мин — **Собираем, включаем, измеряем экономию**.
- `AU-101-M4-L4` · **Защита проекта** · 35 мин — **Защита и чек-лист ручного восстановления**.
  - **Что сдаёт студент:** Автоматизация с инструкцией запуска. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [A05: Zapier Academy: AI Builder Path](https://learn.zapier.com/); [A10: Skillbox: n8n](https://skillbox.ru/course/n8n/); [A11: Stepik: n8n и ИИ](https://stepik.org/course/252092/promo).

**Дополнительная библиотека курса:** [A01: n8n QS101 Quickstart](https://learn.n8n.io/courses/course-v1:n8n%2BQS101%2B2026H2/about); [A02: Make Academy: Automation to AI Agents](https://academy.make.com/bundles/automation-to-ai-agents-foundation); [A03: n8n N8N101 Essentials](https://learn.n8n.io/courses/course-v1:n8n%2BN8N101%2B2026H2/about); [A04: Карпухин: Полный гайд n8n 5+ часов](https://www.youtube.com/watch?v=tUufFo-JTZQ); [A05: Zapier Academy: AI Builder Path](https://learn.zapier.com/); [A06: n8n Workflow Templates](https://n8n.io/workflows/); [A07: Make: AI Templates](https://www.make.com/en/templates?categories=AI); [A08: Stepik: ИИ-агенты и автоматизация с n8n](https://stepik.org/course/222232/promo).

#### AU-201 · Интеграции и AI Workflows

**Уровень:** Middle · **Ориентировочная нагрузка:** 26 академических/практических часов (пересчитать при записи контента).  
**Вход:** Junior-аттестация или основы n8n.  
**Измеримый результат:** Собирает и отлаживает цепочки между разными системами.  
**Capstone:** Мини-автоматизация CRM, support и контента.

**AU-201-M1 — API, HTTP, webhooks**  
Результат модуля: Интеграция с внешним API.

- `AU-201-M1-L1` · **Кейс-разбор / peer review** · 20 мин — **HTTP методы, коды, body, headers**.
- `AU-201-M1-L2` · **Кейс-разбор / peer review** · 30 мин — **Webhook, OAuth, token и pagination**.
- `AU-201-M1-L3` · **Лабораторная / практикум** · 75 мин — **Подключаем сторонний REST API**.
- `AU-201-M1-L4` · **Кейс-разбор / peer review** · 25 мин — **Диагностируем 401, 429, 500 и таймаут**.
  - **Что сдаёт студент:** Интеграция с внешним API. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [A12: n8n N8N102 Integrations APIs](https://learn.n8n.io/courses/course-v1:n8n%2BN8N102%2B2026H2/about); [A13: Michele Torti: N8N Full Course 12h](https://www.youtube.com/watch?v=7_PeuTsx7UM); [A14: freeCodeCamp: Architect Scalable AI Automations](https://www.youtube.com/watch?v=YY-egxTQirA).

**AU-201-M2 — Данные и маршрутизация**  
Результат модуля: Workflow с ветвлениями и валидацией.

- `AU-201-M2-L1` · **Микролекция / чтение** · 15 мин — **JSON, массивы, типы и выражения**.
- `AU-201-M2-L2` · **Демонстрация с повторением** · 35 мин — **Switch, loop, merge, дедупликация**.
- `AU-201-M2-L3` · **Домашнее задание** · 90 мин — **Чистим и маршрутизируем реальные заявки**.
- `AU-201-M2-L4` · **Кейс-разбор / peer review** · 30 мин — **Ревью ошибок и нестандартных входных данных**.
  - **Что сдаёт студент:** Workflow с ветвлениями и валидацией. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [A12: n8n N8N102 Integrations APIs](https://learn.n8n.io/courses/course-v1:n8n%2BN8N102%2B2026H2/about); [A13: Michele Torti: N8N Full Course 12h](https://www.youtube.com/watch?v=7_PeuTsx7UM); [A15: JustInCache: n8n Workflows](https://github.com/JustInCache/n8n-workflows).

**AU-201-M3 — CRM и коммуникации**  
Результат модуля: Кросс-сервисный сценарий продаж.

- `AU-201-M3-L1` · **Микролекция / чтение** · 20 мин — **Лиды, статусы, SLA, owner**.
- `AU-201-M3-L2` · **Живой воркшоп** · 65 мин — **Референс: поддержка или content pipeline**.
- `AU-201-M3-L3` · **Лабораторная / практикум** · 90 мин — **Реализуем CRM → email → Telegram → лог**.
- `AU-201-M3-L4` · **Защита проекта** · 35 мин — **Проверяем приватность и доставку**.
  - **Что сдаёт студент:** Кросс-сервисный сценарий продаж. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [A04: Карпухин: Полный гайд n8n 5+ часов](https://www.youtube.com/watch?v=tUufFo-JTZQ); [A15: JustInCache: n8n Workflows](https://github.com/JustInCache/n8n-workflows); [A16: Cole Medin: oTTomator Agents](https://github.com/coleam00/ottomator-agents).

**AU-201-M4 — Надёжность и поддержка**  
Результат модуля: Workflow с журналом, retries и документацией.

- `AU-201-M4-L1` · **Микролекция / чтение** · 15 мин — **Наблюдаемость и ошибки интеграций**.
- `AU-201-M4-L2` · **Демонстрация с повторением** · 25 мин — **Демонстрация обработчиков ошибок**.
- `AU-201-M4-L3` · **Лабораторная / практикум** · 75 мин — **Добавляем dead-letter, retries, алерты**.
- `AU-201-M4-L4` · **Квиз / диагностический тест** · 25 мин — **Практическая приёмка и handover**.
  - **Что сдаёт студент:** Workflow с журналом, retries и документацией. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [A03: n8n N8N101 Essentials](https://learn.n8n.io/courses/course-v1:n8n%2BN8N101%2B2026H2/about); [A12: n8n N8N102 Integrations APIs](https://learn.n8n.io/courses/course-v1:n8n%2BN8N102%2B2026H2/about); [A09: n8n N8N103 AI & Testing](https://learn.n8n.io/courses/course-v1:n8n%2BN8N103%2B2026H2/about).

**Дополнительная библиотека курса:** [A12: n8n N8N102 Integrations APIs](https://learn.n8n.io/courses/course-v1:n8n%2BN8N102%2B2026H2/about); [A13: Michele Torti: N8N Full Course 12h](https://www.youtube.com/watch?v=7_PeuTsx7UM); [A14: freeCodeCamp: Architect Scalable AI Automations](https://www.youtube.com/watch?v=YY-egxTQirA); [A15: JustInCache: n8n Workflows](https://github.com/JustInCache/n8n-workflows); [A04: Карпухин: Полный гайд n8n 5+ часов](https://www.youtube.com/watch?v=tUufFo-JTZQ); [A16: Cole Medin: oTTomator Agents](https://github.com/coleam00/ottomator-agents); [A03: n8n N8N101 Essentials](https://learn.n8n.io/courses/course-v1:n8n%2BN8N101%2B2026H2/about); [A09: n8n N8N103 AI & Testing](https://learn.n8n.io/courses/course-v1:n8n%2BN8N103%2B2026H2/about).

#### AU-301 · Automation Systems Architecture

**Уровень:** Senior · **Ориентировочная нагрузка:** 34 академических/практических часов (пересчитать при записи контента).  
**Вход:** Middle-аттестация, API, БД и поддержка.  
**Измеримый результат:** Умеет оценивать стоимость, риски и надёжность.  
**Capstone:** Промышленный процесс с мониторингом и rollback.

**AU-301-M1 — Оркестрация**  
Результат модуля: Архитектура обработки событий.

- `AU-301-M1-L1` · **Микролекция / чтение** · 15 мин — **Синхронные и асинхронные процессы**.
- `AU-301-M1-L2` · **Демонстрация с повторением** · 35 мин — **Workflow engine vs queue: разбор кейса**.
- `AU-301-M1-L3` · **Домашнее задание** · 90 мин — **Проектируем схемы согласованности и retry**.
- `AU-301-M1-L4` · **Кейс-разбор / peer review** · 30 мин — **Ревью failure modes**.
  - **Что сдаёт студент:** Архитектура обработки событий. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [A12: n8n N8N102 Integrations APIs](https://learn.n8n.io/courses/course-v1:n8n%2BN8N102%2B2026H2/about); [A09: n8n N8N103 AI & Testing](https://learn.n8n.io/courses/course-v1:n8n%2BN8N103%2B2026H2/about); [A18: n8n documentation AI Intro](https://docs.n8n.io/advanced-ai/intro-tutorial/).

**AU-301-M2 — Масштаб и устойчивость**  
Результат модуля: Нагрузочное и отказоустойчивое решение.

- `AU-301-M2-L1` · **Микролекция / чтение** · 20 мин — **Идемпотентность, dedup, concurrency**.
- `AU-301-M2-L2` · **Живой воркшоп** · 65 мин — **Rate limits, backoff и circuit breaker**.
- `AU-301-M2-L3` · **Лабораторная / практикум** · 90 мин — **Симулируем ошибки внешних API**.
- `AU-301-M2-L4` · **Защита проекта** · 35 мин — **Проводим chaos-case review**.
  - **Что сдаёт студент:** Нагрузочное и отказоустойчивое решение. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [A13: Michele Torti: N8N Full Course 12h](https://www.youtube.com/watch?v=7_PeuTsx7UM); [A09: n8n N8N103 AI & Testing](https://learn.n8n.io/courses/course-v1:n8n%2BN8N103%2B2026H2/about); [A06: n8n Workflow Templates](https://n8n.io/workflows/).

**AU-301-M3 — Security & Governance**  
Результат модуля: Политики доступа и журнал аудита.

- `AU-301-M3-L1` · **Микролекция / чтение** · 15 мин — **Секреты, доступ, хранение данных**.
- `AU-301-M3-L2` · **Демонстрация с повторением** · 25 мин — **Audit trail, approval и human-in-loop**.
- `AU-301-M3-L3` · **Лабораторная / практикум** · 75 мин — **Строим схему разграничения доступа**.
- `AU-301-M3-L4` · **Квиз / диагностический тест** · 25 мин — **Проверка по чек-листу безопасности**.
  - **Что сдаёт студент:** Политики доступа и журнал аудита. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [A20: Google: Prompt Design Strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies); [A21: OpenAI Agents Evals repo](https://github.com/openai/evals); [V20: Microsoft: AI Agents Study Guide](https://github.com/microsoft/ai-agents-for-beginners/blob/main/STUDY_GUIDE.md).

**AU-301-M4 — Стоимость и эксплуатация**  
Результат модуля: Dashboard KPI и runbook.

- `AU-301-M4-L1` · **Кейс-разбор / peer review** · 20 мин — **Token cost, infra cost, throughput**.
- `AU-301-M4-L2` · **Кейс-разбор / peer review** · 30 мин — **Мониторинг, логирование, alerts**.
- `AU-301-M4-L3` · **Лабораторная / практикум** · 75 мин — **Оптимизируем затраты на модель и сценарий**.
- `AU-301-M4-L4` · **Кейс-разбор / peer review** · 25 мин — **Защищаем SLA и план эксплуатации**.
  - **Что сдаёт студент:** Dashboard KPI и runbook. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [A09: n8n N8N103 AI & Testing](https://learn.n8n.io/courses/course-v1:n8n%2BN8N103%2B2026H2/about); [A18: n8n documentation AI Intro](https://docs.n8n.io/advanced-ai/intro-tutorial/); [B04: OpenAI: Small Business Workshop](https://academy.openai.com/en/public/resources/openai-academy-small-business-resource-hub-2026-06-03).

**Дополнительная библиотека курса:** [A12: n8n N8N102 Integrations APIs](https://learn.n8n.io/courses/course-v1:n8n%2BN8N102%2B2026H2/about); [A09: n8n N8N103 AI & Testing](https://learn.n8n.io/courses/course-v1:n8n%2BN8N103%2B2026H2/about); [A18: n8n documentation AI Intro](https://docs.n8n.io/advanced-ai/intro-tutorial/); [A13: Michele Torti: N8N Full Course 12h](https://www.youtube.com/watch?v=7_PeuTsx7UM); [A06: n8n Workflow Templates](https://n8n.io/workflows/); [A20: Google: Prompt Design Strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies); [A21: OpenAI Agents Evals repo](https://github.com/openai/evals); [V20: Microsoft: AI Agents Study Guide](https://github.com/microsoft/ai-agents-for-beginners/blob/main/STUDY_GUIDE.md).

### 3.4. Направление AG — AI Agents & RAG

**Задача направления:** Ассистенты, поиск по знаниям, инструменты и агентные системы.  
**Целевая аудитория:** agent builders, technical PMs.  
**Маршрут:** `AG-101` → `AG-201` → `AG-301`; placement test позволяет ускорить переход.

#### AG-101 · AI Assistant Foundations

**Уровень:** Junior · **Ориентировочная нагрузка:** 18 академических/практических часов (пересчитать при записи контента).  
**Вход:** AI Core либо входной тест.  
**Измеримый результат:** Понимает отличие чатбота, ассистента и агента.  
**Capstone:** Помощник, отвечающий на типовые вопросы.

**AG-101-M1 — LLM & Agent Basics**  
Результат модуля: Схема жизненного цикла ответа.

- `AG-101-M1-L1` · **Микролекция / чтение** · 15 мин — **LLM, токены, контекст, ограничения**.
- `AG-101-M1-L2` · **Демонстрация с повторением** · 25 мин — **Разбор агента: модель, инструменты, память**.
- `AG-101-M1-L3` · **Лабораторная / практикум** · 75 мин — **Проектируем use case помощника**.
- `AG-101-M1-L4` · **Квиз / диагностический тест** · 25 мин — **Проверка: когда агент не нужен**.
  - **Что сдаёт студент:** Схема жизненного цикла ответа. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [G01: Hugging Face Agents Course RU](https://huggingface.co/learn/agents-course/ru-RU/unit0/introduction); [G02: Microsoft AI Agents Course RU](https://github.com/microsoft/ai-agents-for-beginners/blob/main/translations/ru/README.md); [G03: Stepik: Введение в разработку ИИ-агентов](https://stepik.org/course/272932/promo).

**AG-101-M2 — Инструкции и выход**  
Результат модуля: Стабильные ответы заданного формата.

- `AG-101-M2-L1` · **Кейс-разбор / peer review** · 20 мин — **Роль, задачи и ограничение модели**.
- `AG-101-M2-L2` · **Кейс-разбор / peer review** · 30 мин — **Structured output и few-shot**.
- `AG-101-M2-L3` · **Лабораторная / практикум** · 75 мин — **Создаём промпты на 10 типовых случаев**.
- `AG-101-M2-L4` · **Кейс-разбор / peer review** · 25 мин — **Тестируем противоречивые инструкции**.
  - **Что сдаёт студент:** Стабильные ответы заданного формата. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [A20: Google: Prompt Design Strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies); [F01: OpenAI Prompt Engineering Guide](https://developers.openai.com/api/docs/guides/prompt-engineering); [G01: Hugging Face Agents Course RU](https://huggingface.co/learn/agents-course/ru-RU/unit0/introduction).

**AG-101-M3 — Files and Tools**  
Результат модуля: Агент с одной функцией и документами.

- `AG-101-M3-L1` · **Микролекция / чтение** · 15 мин — **Function/tool calling без сложного кода**.
- `AG-101-M3-L2` · **Демонстрация с повторением** · 35 мин — **Демонстрация поиска по справочнику**.
- `AG-101-M3-L3` · **Домашнее задание** · 90 мин — **Подключаем инструмент и тестовый файл**.
- `AG-101-M3-L4` · **Кейс-разбор / peer review** · 30 мин — **Разбираем ошибки и неверные вызовы**.
  - **Что сдаёт студент:** Агент с одной функцией и документами. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [V20: Microsoft: AI Agents Study Guide](https://github.com/microsoft/ai-agents-for-beginners/blob/main/STUDY_GUIDE.md); [V19: Microsoft: Generative AI for Beginners](https://github.com/microsoft/generative-ai-for-beginners/blob/main/translations/ru/README.md); [G07: OpenAI: GPTs and knowledge RU](https://help.openai.com/ru-ru/articles/8554397-creating-and-editing-gpts).

**AG-101-M4 — Assistant Project**  
Результат модуля: Демо ассистента с тест-кейсами.

- `AG-101-M4-L1` · **Микролекция / чтение** · 20 мин — **Критерии полезности и ограничения**.
- `AG-101-M4-L2` · **Живой воркшоп** · 65 мин — **Показываем агенту реальную пользовательскую задачу**.
- `AG-101-M4-L3` · **Лабораторная / практикум** · 90 мин — **Собираем ассистента и 10 тест-вопросов**.
- `AG-101-M4-L4` · **Защита проекта** · 35 мин — **Защита и описание ограничений**.
  - **Что сдаёт студент:** Демо ассистента с тест-кейсами. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [G01: Hugging Face Agents Course RU](https://huggingface.co/learn/agents-course/ru-RU/unit0/introduction); [G08: Hugging Face Agents Unit 1 RU](https://huggingface.co/learn/agents-course/ru-RU/unit1/introduction); [V21: Microsoft: AI Agents repo](https://github.com/microsoft/ai-agents-for-beginners).

**Дополнительная библиотека курса:** [G01: Hugging Face Agents Course RU](https://huggingface.co/learn/agents-course/ru-RU/unit0/introduction); [G02: Microsoft AI Agents Course RU](https://github.com/microsoft/ai-agents-for-beginners/blob/main/translations/ru/README.md); [G03: Stepik: Введение в разработку ИИ-агентов](https://stepik.org/course/272932/promo); [A20: Google: Prompt Design Strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies); [F01: OpenAI Prompt Engineering Guide](https://developers.openai.com/api/docs/guides/prompt-engineering); [V20: Microsoft: AI Agents Study Guide](https://github.com/microsoft/ai-agents-for-beginners/blob/main/STUDY_GUIDE.md); [V19: Microsoft: Generative AI for Beginners](https://github.com/microsoft/generative-ai-for-beginners/blob/main/translations/ru/README.md); [G07: OpenAI: GPTs and knowledge RU](https://help.openai.com/ru-ru/articles/8554397-creating-and-editing-gpts).

#### AG-201 · RAG & Tool-Using Agents

**Уровень:** Middle · **Ориентировочная нагрузка:** 26 академических/практических часов (пересчитать при записи контента).  
**Вход:** Junior-аттестация и базовые API/Python или no-code.  
**Измеримый результат:** Строит и тестирует агент по закрытым документам.  
**Capstone:** База знаний с источниками и инструментами.

**AG-201-M1 — Embeddings & Search**  
Результат модуля: Поисковый индекс.

- `AG-201-M1-L1` · **Кейс-разбор / peer review** · 20 мин — **Chunking и embeddings**.
- `AG-201-M1-L2` · **Кейс-разбор / peer review** · 30 мин — **Vector DB, hybrid search и BM25**.
- `AG-201-M1-L3` · **Лабораторная / практикум** · 75 мин — **Создаём индекс документов**.
- `AG-201-M1-L4` · **Кейс-разбор / peer review** · 25 мин — **Проверяем релевантность retrieval**.
  - **Что сдаёт студент:** Поисковый индекс. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [G10: LangChain: Learning and RAG examples](https://docs.langchain.com/oss/python/learn); [G11: DeepLearning.AI: Advanced RAG](https://www.deeplearning.ai/alpha/short-courses/building-evaluating-advanced-rag); [G12: Cole Medin: AI Agents Masterclass](https://github.com/coleam00/ai-agents-masterclass).

**AG-201-M2 — RAG pipeline**  
Результат модуля: Ассистент с цитированием источников.

- `AG-201-M2-L1` · **Микролекция / чтение** · 15 мин — **Retrieval, reranking и citation**.
- `AG-201-M2-L2` · **Демонстрация с повторением** · 35 мин — **Разбор ошибок источников и устаревания**.
- `AG-201-M2-L3` · **Домашнее задание** · 90 мин — **Строим RAG по базе знаний**.
- `AG-201-M2-L4` · **Кейс-разбор / peer review** · 30 мин — **Оценка groundedness на контрольном наборе**.
  - **Что сдаёт студент:** Ассистент с цитированием источников. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [G10: LangChain: Learning and RAG examples](https://docs.langchain.com/oss/python/learn); [G13: LangChain Academy: Intro LangGraph](https://academy.langchain.com/courses/intro-to-langgraph); [G01: Hugging Face Agents Course RU](https://huggingface.co/learn/agents-course/ru-RU/unit0/introduction).

**AG-201-M3 — State and Tools**  
Результат модуля: Агент с 2–3 разрешёнными инструментами.

- `AG-201-M3-L1` · **Микролекция / чтение** · 20 мин — **Tool schemas и permissions**.
- `AG-201-M3-L2` · **Живой воркшоп** · 65 мин — **Agent state, memory и маршрутизация**.
- `AG-201-M3-L3` · **Лабораторная / практикум** · 90 мин — **Создаём task workflow и approval**.
- `AG-201-M3-L4` · **Защита проекта** · 35 мин — **Проверяем невыполнимые и опасные запросы**.
  - **Что сдаёт студент:** Агент с 2–3 разрешёнными инструментами. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [V20: Microsoft: AI Agents Study Guide](https://github.com/microsoft/ai-agents-for-beginners/blob/main/STUDY_GUIDE.md); [G15: DeepLearning.AI: AI Agents LangGraph](https://www.deeplearning.ai/courses/ai-agents-in-langgraph); [G16: CrewAI Multi Agent Systems](https://www.deeplearning.ai/courses/multi-ai-agent-systems-with-crewai).

**AG-201-M4 — Evaluation & Release**  
Результат модуля: Пилот с baseline тестов.

- `AG-201-M4-L1` · **Микролекция / чтение** · 15 мин — **Оценки точности, полноты и отказов**.
- `AG-201-M4-L2` · **Демонстрация с повторением** · 25 мин — **Tracing agent runs и error taxonomy**.
- `AG-201-M4-L3` · **Лабораторная / практикум** · 75 мин — **Собираем набор из 30 eval-cases**.
- `AG-201-M4-L4` · **Квиз / диагностический тест** · 25 мин — **Защита RAG-системы по метрикам**.
  - **Что сдаёт студент:** Пилот с baseline тестов. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [G17: OpenAI: Agents improvement loop](https://developers.openai.com/cookbook/examples/agents_sdk/agent_improvement_loop); [A21: OpenAI Agents Evals repo](https://github.com/openai/evals); [G19: Promptfoo Getting Started](https://github.com/promptfoo/promptfoo/blob/main/site/docs/getting-started.md).

**Дополнительная библиотека курса:** [G10: LangChain: Learning and RAG examples](https://docs.langchain.com/oss/python/learn); [G11: DeepLearning.AI: Advanced RAG](https://www.deeplearning.ai/alpha/short-courses/building-evaluating-advanced-rag); [G12: Cole Medin: AI Agents Masterclass](https://github.com/coleam00/ai-agents-masterclass); [G13: LangChain Academy: Intro LangGraph](https://academy.langchain.com/courses/intro-to-langgraph); [G01: Hugging Face Agents Course RU](https://huggingface.co/learn/agents-course/ru-RU/unit0/introduction); [V20: Microsoft: AI Agents Study Guide](https://github.com/microsoft/ai-agents-for-beginners/blob/main/STUDY_GUIDE.md); [G15: DeepLearning.AI: AI Agents LangGraph](https://www.deeplearning.ai/courses/ai-agents-in-langgraph); [G16: CrewAI Multi Agent Systems](https://www.deeplearning.ai/courses/multi-ai-agent-systems-with-crewai).

#### AG-301 · Production Agents & Multi-agent

**Уровень:** Senior · **Ориентировочная нагрузка:** 34 академических/практических часов (пересчитать при записи контента).  
**Вход:** Middle-аттестация, RAG и API.  
**Измеримый результат:** Управляет надёжностью, границами и стоимостью.  
**Capstone:** Агентная система с измеримым качеством и логами.

**AG-301-M1 — Orchestration & Patterns**  
Результат модуля: Выбранная multi-agent архитектура.

- `AG-301-M1-L1` · **Микролекция / чтение** · 15 мин — **Single agent vs team: tradeoffs**.
- `AG-301-M1-L2` · **Демонстрация с повторением** · 35 мин — **Manager, handoff и planner-executor**.
- `AG-301-M1-L3` · **Домашнее задание** · 90 мин — **Спроектируем многошаговый task graph**.
- `AG-301-M1-L4` · **Кейс-разбор / peer review** · 30 мин — **Архитектурный review сложного workflow**.
  - **Что сдаёт студент:** Выбранная multi-agent архитектура. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [G20: CrewAI Documentation](https://docs.crewai.com/core-concepts/Agents); [V20: Microsoft: AI Agents Study Guide](https://github.com/microsoft/ai-agents-for-beginners/blob/main/STUDY_GUIDE.md); [G16: CrewAI Multi Agent Systems](https://www.deeplearning.ai/courses/multi-ai-agent-systems-with-crewai).

**AG-301-M2 — Durable agents**  
Результат модуля: Состояние и управляемое выполнение.

- `AG-301-M2-L1` · **Микролекция / чтение** · 20 мин — **Persistence, checkpoints и memory**.
- `AG-301-M2-L2` · **Живой воркшоп** · 65 мин — **Human approval в долгих операциях**.
- `AG-301-M2-L3` · **Лабораторная / практикум** · 90 мин — **Строим процесс с восстановлением после ошибки**.
- `AG-301-M2-L4` · **Защита проекта** · 35 мин — **Тестируем отмены и повторные вызовы**.
  - **Что сдаёт студент:** Состояние и управляемое выполнение. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [G15: DeepLearning.AI: AI Agents LangGraph](https://www.deeplearning.ai/courses/ai-agents-in-langgraph); [G10: LangChain: Learning and RAG examples](https://docs.langchain.com/oss/python/learn); [G24: OpenAI Agents API Examples](https://github.com/openai/openai-cookbook/blob/main/examples/agents_api/README.md).

**AG-301-M3 — Safety and Evals**  
Результат модуля: Agent eval suite + threat model.

- `AG-301-M3-L1` · **Микролекция / чтение** · 15 мин — **Prompt injection, exfiltration и auth boundaries**.
- `AG-301-M3-L2` · **Демонстрация с повторением** · 25 мин — **Trace analysis, eval datasets и регрессия**.
- `AG-301-M3-L3` · **Лабораторная / практикум** · 75 мин — **Проводим красную команду по агенту**.
- `AG-301-M3-L4` · **Квиз / диагностический тест** · 25 мин — **Калибруем grader и compare baseline**.
  - **Что сдаёт студент:** Agent eval suite + threat model. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [G17: OpenAI: Agents improvement loop](https://developers.openai.com/cookbook/examples/agents_sdk/agent_improvement_loop); [A21: OpenAI Agents Evals repo](https://github.com/openai/evals); [G20: CrewAI Documentation](https://docs.crewai.com/core-concepts/Agents).

**AG-301-M4 — Operations**  
Результат модуля: Runbook, мониторинг и unit economics.

- `AG-301-M4-L1` · **Кейс-разбор / peer review** · 20 мин — **SLA, latency и token economics**.
- `AG-301-M4-L2` · **Кейс-разбор / peer review** · 30 мин — **Telemetry, dashboards и budget alerts**.
- `AG-301-M4-L3` · **Лабораторная / практикум** · 75 мин — **Деплоим и обкатываем инцидент**.
- `AG-301-M4-L4` · **Кейс-разбор / peer review** · 25 мин — **Финальная защита production-плана**.
  - **Что сдаёт студент:** Runbook, мониторинг и unit economics. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [G26: Krish Naik: Agentic AI 11h](https://www.youtube.com/watch?v=rV3HJ4LEZ7k); [G27: Cole Medin: Self-hosted AI Kit](https://github.com/coleam00/ai-agents-masterclass/blob/main/local-ai-packaged/README.md); [B04: OpenAI: Small Business Workshop](https://academy.openai.com/en/public/resources/openai-academy-small-business-resource-hub-2026-06-03).

**Дополнительная библиотека курса:** [G20: CrewAI Documentation](https://docs.crewai.com/core-concepts/Agents); [V20: Microsoft: AI Agents Study Guide](https://github.com/microsoft/ai-agents-for-beginners/blob/main/STUDY_GUIDE.md); [G16: CrewAI Multi Agent Systems](https://www.deeplearning.ai/courses/multi-ai-agent-systems-with-crewai); [G15: DeepLearning.AI: AI Agents LangGraph](https://www.deeplearning.ai/courses/ai-agents-in-langgraph); [G10: LangChain: Learning and RAG examples](https://docs.langchain.com/oss/python/learn); [G24: OpenAI Agents API Examples](https://github.com/openai/openai-cookbook/blob/main/examples/agents_api/README.md); [G17: OpenAI: Agents improvement loop](https://developers.openai.com/cookbook/examples/agents_sdk/agent_improvement_loop); [A21: OpenAI Agents Evals repo](https://github.com/openai/evals).

### 3.5. Направление CR — AI Creator

**Задача направления:** Визуальный, видео-, аудио- и мультимодальный продакшн.  
**Целевая аудитория:** creators, motion/design.  
**Маршрут:** `CR-101` → `CR-201` → `CR-301`; placement test позволяет ускорить переход.

#### CR-101 · AI Content Creator

**Уровень:** Junior · **Ориентировочная нагрузка:** 18 академических/практических часов (пересчитать при записи контента).  
**Вход:** AI Core либо входной тест.  
**Измеримый результат:** Умеет стабильно производить простые материалы.  
**Capstone:** Контент-пакет: 5 изображений + 2 коротких видео.

**CR-101-M1 — Бриф и идея**  
Результат модуля: Moodboard и набор референсов.

- `CR-101-M1-L1` · **Микролекция / чтение** · 15 мин — **Типы AI-контента и выбор инструментов**.
- `CR-101-M1-L2` · **Демонстрация с повторением** · 25 мин — **Целевая аудитория и креативное ТЗ**.
- `CR-101-M1-L3` · **Лабораторная / практикум** · 75 мин — **Создаём moodboard и 3 концепции**.
- `CR-101-M1-L4` · **Квиз / диагностический тест** · 25 мин — **Выбираем концепцию по рубрике**.
  - **Что сдаёт студент:** Moodboard и набор референсов. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [C01: Canva Design School: AI Essentials](https://www.canva.com/design-school/courses/ai-essentials/); [C02: Skillbox: AI-креатор](https://skillbox.ru/course/profession-ai-creator/); [C03: Нетология: ИИ-креатор](https://netology.ru/programs/ai-creator).

**CR-101-M2 — Изображения**  
Результат модуля: Мини-фотосессия бренда.

- `CR-101-M2-L1` · **Кейс-разбор / peer review** · 20 мин — **Композиция, цвет, свет и ракурс**.
- `CR-101-M2-L2` · **Кейс-разбор / peer review** · 30 мин — **Практика text-to-image и image edit**.
- `CR-101-M2-L3` · **Лабораторная / практикум** · 75 мин — **Создаём 5 согласованных визуалов**.
- `CR-101-M2-L4` · **Кейс-разбор / peer review** · 25 мин — **Критика анатомии, текста и фактуры**.
  - **Что сдаёт студент:** Мини-фотосессия бренда. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [C04: Adobe Firefly: realistic photos](https://www.adobe.com/learn/firefly/web/generate-realistic-photos); [C05: Adobe Firefly: Sketch to Video](https://www.adobe.com/learn/firefly/web/sketch-to-video-with-generative-ai); [C06: Adobe Firefly: official help](https://helpx.adobe.com/firefly/web.html).

**CR-101-M3 — Видео и звук**  
Результат модуля: Короткий ролик 10–20 секунд.

- `CR-101-M3-L1` · **Микролекция / чтение** · 15 мин — **Сценарий, кадр и динамика**.
- `CR-101-M3-L2` · **Демонстрация с повторением** · 35 мин — **Text-to-video, image-to-video, voice**.
- `CR-101-M3-L3` · **Домашнее задание** · 90 мин — **Собираем видео с озвучкой и субтитрами**.
- `CR-101-M3-L4` · **Кейс-разбор / peer review** · 30 мин — **Проверяем continuity и права на звук**.
  - **Что сдаёт студент:** Короткий ролик 10–20 секунд. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [C07: Adobe Firefly: генерация видео на русском](https://helpx.adobe.com/ru/firefly/web/work-with-audio-and-video/work-with-video/generate-videos-using-text-prompts.html); [C08: Нетология: ИИ-видео и музыка](https://netology.ru/programs/ai-creative); [C09: Adobe: B-roll from prompts](https://www.adobe.com/learn/firefly/web/generate-video-text-to-video).

**CR-101-M4 — Публикация**  
Результат модуля: Готовый комплект для социальных сетей.

- `CR-101-M4-L1` · **Микролекция / чтение** · 20 мин — **Размеры, форматы и требования платформ**.
- `CR-101-M4-L2` · **Живой воркшоп** · 65 мин — **Разбор кейса рекламного поста**.
- `CR-101-M4-L3` · **Лабораторная / практикум** · 90 мин — **Собираем пакет Reels/Stories/Post**.
- `CR-101-M4-L4` · **Защита проекта** · 35 мин — **Защита и чек-лист публикации**.
  - **Что сдаёт студент:** Готовый комплект для социальных сетей. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [C11: Skillbox: AI Content Manager](https://skillbox.ru/course/ai-content-manager/); [C12: NeuroWiki: нейросети с нуля](https://www.youtube.com/watch?v=rpBdmYvZZwI); [C13: RuTube: Нейросети для работы 2026](https://rutube.ru/video/c5f458b75762220d3c0ac15edb21af02/).

**Дополнительная библиотека курса:** [C01: Canva Design School: AI Essentials](https://www.canva.com/design-school/courses/ai-essentials/); [C02: Skillbox: AI-креатор](https://skillbox.ru/course/profession-ai-creator/); [C03: Нетология: ИИ-креатор](https://netology.ru/programs/ai-creator); [C04: Adobe Firefly: realistic photos](https://www.adobe.com/learn/firefly/web/generate-realistic-photos); [C05: Adobe Firefly: Sketch to Video](https://www.adobe.com/learn/firefly/web/sketch-to-video-with-generative-ai); [C06: Adobe Firefly: official help](https://helpx.adobe.com/firefly/web.html); [C07: Adobe Firefly: генерация видео на русском](https://helpx.adobe.com/ru/firefly/web/work-with-audio-and-video/work-with-video/generate-videos-using-text-prompts.html); [C08: Нетология: ИИ-видео и музыка](https://netology.ru/programs/ai-creative).

#### CR-201 · AI Creative Production

**Уровень:** Middle · **Ориентировочная нагрузка:** 26 академических/практических часов (пересчитать при записи контента).  
**Вход:** Junior-аттестация или портфолио визуалов.  
**Измеримый результат:** Управляет продакшеном и качеством материала.  
**Capstone:** Рекламная кампания с визуальной преемственностью.

**CR-201-M1 — Creative strategy**  
Результат модуля: Creative brief и сценарий.

- `CR-201-M1-L1` · **Кейс-разбор / peer review** · 20 мин — **Цели кампании, инсайт и KPI**.
- `CR-201-M1-L2` · **Кейс-разбор / peer review** · 30 мин — **Сториборд и moodboard рекламного ролика**.
- `CR-201-M1-L3` · **Лабораторная / практикум** · 75 мин — **Готовим сценарий + shot list**.
- `CR-201-M1-L4` · **Кейс-разбор / peer review** · 25 мин — **Разбор трёх креативных направлений**.
  - **Что сдаёт студент:** Creative brief и сценарий. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [C14: Runway Academy: AI for Advertising](https://academy.runwayml.com/course/ai-advertising); [C15: Runway: Storyboard Creator](https://academy.runwayml.com/tutorial/storyboard-featured-workflow); [C16: Adobe: Idea to Title Sequence](https://www.adobe.com/learn/firefly/web/idea-to-title-sequence).

**CR-201-M2 — Consistent Characters**  
Результат модуля: Библиотека персонажей и продукта.

- `CR-201-M2-L1` · **Микролекция / чтение** · 15 мин — **Identity consistency и reference sets**.
- `CR-201-M2-L2` · **Демонстрация с повторением** · 35 мин — **Генерация продуктов под разными ракурсами**.
- `CR-201-M2-L3` · **Домашнее задание** · 90 мин — **Создаём character/product bible**.
- `CR-201-M2-L4` · **Кейс-разбор / peer review** · 30 мин — **Оцениваем стабильность на 20 генерациях**.
  - **Что сдаёт студент:** Библиотека персонажей и продукта. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [C04: Adobe Firefly: realistic photos](https://www.adobe.com/learn/firefly/web/generate-realistic-photos); [C18: Runway: AI Games](https://academy.runwayml.com/course/ai-games); [C19: Adobe: reference motion](https://www.adobe.com/learn/firefly/web/video-motion-reference).

**CR-201-M3 — Cinematic AI Video**  
Результат модуля: Готовый рекламный ролик.

- `CR-201-M3-L1` · **Микролекция / чтение** · 20 мин — **Монтажная логика, планы и переходы**.
- `CR-201-M3-L2` · **Живой воркшоп** · 65 мин — **VFX, camera motion, inpainting**.
- `CR-201-M3-L3` · **Лабораторная / практикум** · 90 мин — **Производим ролик из 8–12 планов**.
- `CR-201-M3-L4` · **Защита проекта** · 35 мин — **Review motion continuity и монтажных ошибок**.
  - **Что сдаёт студент:** Готовый рекламный ролик. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [C20: Runway: AI Visual Effects](https://academy.runwayml.com/course/ai-visual-effects); [C21: Runway: Video Magic Aleph](https://academy.runwayml.com/course/video-magic-aleph); [C22: Adobe: match camera motion](https://helpx.adobe.com/firefly/web/work-with-audio-and-video/work-with-video/match-camera-motion-to-reference-video.html).

**CR-201-M4 — Campaign Assembly**  
Результат модуля: 3 формата креатива на одной концепции.

- `CR-201-M4-L1` · **Микролекция / чтение** · 15 мин — **Адаптация под площадку и аудиторию**.
- `CR-201-M4-L2` · **Демонстрация с повторением** · 25 мин — **Разбор цикла ad iteration**.
- `CR-201-M4-L3` · **Лабораторная / практикум** · 75 мин — **Делаем A/B-версии и варианты форматов**.
- `CR-201-M4-L4` · **Квиз / диагностический тест** · 25 мин — **Клиентская защита с критериями эффективности**.
  - **Что сдаёт студент:** 3 формата креатива на одной концепции. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [C14: Runway Academy: AI for Advertising](https://academy.runwayml.com/course/ai-advertising); [C24: Runway: Product Shot to Social Ad](https://academy.runwayml.com/tutorial/how-to-go-from-product-shot-to-social-ad); [C25: Adobe: Social Video Teaser](https://www.adobe.com/learn/firefly/web/create-social-videos-with-gen-ai).

**Дополнительная библиотека курса:** [C14: Runway Academy: AI for Advertising](https://academy.runwayml.com/course/ai-advertising); [C15: Runway: Storyboard Creator](https://academy.runwayml.com/tutorial/storyboard-featured-workflow); [C16: Adobe: Idea to Title Sequence](https://www.adobe.com/learn/firefly/web/idea-to-title-sequence); [C04: Adobe Firefly: realistic photos](https://www.adobe.com/learn/firefly/web/generate-realistic-photos); [C18: Runway: AI Games](https://academy.runwayml.com/course/ai-games); [C19: Adobe: reference motion](https://www.adobe.com/learn/firefly/web/video-motion-reference); [C20: Runway: AI Visual Effects](https://academy.runwayml.com/course/ai-visual-effects); [C21: Runway: Video Magic Aleph](https://academy.runwayml.com/course/video-magic-aleph).

#### CR-301 · AI Content Studio & Direction

**Уровень:** Senior · **Ориентировочная нагрузка:** 34 академических/практических часов (пересчитать при записи контента).  
**Вход:** Middle-аттестация и рекламный кейс.  
**Измеримый результат:** Стандартизирует производство и управляет рисками.  
**Capstone:** Мини-студия с SOP, бюджетом, QA и выпуском.

**CR-301-M1 — Brand System**  
Результат модуля: Бренд-библиотека и стандарты.

- `CR-301-M1-L1` · **Микролекция / чтение** · 15 мин — **Creative direction и арт-дирекшн**.
- `CR-301-M1-L2` · **Демонстрация с повторением** · 35 мин — **Style guide, prompt presets, references**.
- `CR-301-M1-L3` · **Домашнее задание** · 90 мин — **Формируем генеративную систему бренда**.
- `CR-301-M1-L4` · **Кейс-разбор / peer review** · 30 мин — **Калибровка качества между редакторами**.
  - **Что сдаёт студент:** Бренд-библиотека и стандарты. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [C18: Runway: AI Games](https://academy.runwayml.com/course/ai-games); [C26: Runway: Custom Workflows](https://academy.runwayml.com/course/custom-workflows); [C01: Canva Design School: AI Essentials](https://www.canva.com/design-school/courses/ai-essentials/).

**CR-301-M2 — Creative automation**  
Результат модуля: Полуавтоматический контент-конвейер.

- `CR-301-M2-L1` · **Микролекция / чтение** · 20 мин — **Content ops, asset naming, DAM**.
- `CR-301-M2-L2` · **Живой воркшоп** · 65 мин — **Генерация вариантов через workflow/API**.
- `CR-301-M2-L3` · **Лабораторная / практикум** · 90 мин — **Строим pipeline c human approval**.
- `CR-301-M2-L4` · **Защита проекта** · 35 мин — **Проверка устойчивости на разных брифах**.
  - **Что сдаёт студент:** Полуавтоматический контент-конвейер. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [C28: Adobe: AI Video from Runway in Firefly](https://helpx.adobe.com/firefly/web/firefly-video-editor/generate-videos/generate-videos-using-runway-video-models.html); [C29: Adobe: partner video models](https://helpx.adobe.com/firefly/web/work-with-audio-and-video/work-with-video/generate-videos-using-non-adobe-models.html); [A16: Cole Medin: oTTomator Agents](https://github.com/coleam00/ottomator-agents).

**CR-301-M3 — Права, этика и QA**  
Результат модуля: Политика использования AI-материалов.

- `CR-301-M3-L1` · **Микролекция / чтение** · 15 мин — **Согласия, likeness, IP и лицензирование**.
- `CR-301-M3-L2` · **Демонстрация с повторением** · 25 мин — **Provenance, watermarking, attribution**.
- `CR-301-M3-L3` · **Лабораторная / практикум** · 75 мин — **Разрабатываем чек-лист коммерческого релиза**.
- `CR-301-M3-L4` · **Квиз / диагностический тест** · 25 мин — **Review спорных кейсов и рисков**.
  - **Что сдаёт студент:** Политика использования AI-материалов. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [C30: Adobe: edit videos using text](https://helpx.adobe.com/firefly/web/create-mood-boards/firefly-boards/edit-videos-using-text-prompts.html); [C31: UNESCO: GenAI in Education and Research](https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research); [C18: Runway: AI Games](https://academy.runwayml.com/course/ai-games).

**CR-301-M4 — Studio business**  
Результат модуля: Коммерческая операционная модель.

- `CR-301-M4-L1` · **Кейс-разбор / peer review** · 20 мин — **Цена проекта, маржа, ревизии и ресурсы**.
- `CR-301-M4-L2` · **Кейс-разбор / peer review** · 30 мин — **Разбор клиентского договора и брифа**.
- `CR-301-M4-L3` · **Лабораторная / практикум** · 75 мин — **Считаем бюджет и создаём SOP**.
- `CR-301-M4-L4` · **Кейс-разбор / peer review** · 25 мин — **Финальная защита продуктовой студии**.
  - **Что сдаёт студент:** Коммерческая операционная модель. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [C02: Skillbox: AI-креатор](https://skillbox.ru/course/profession-ai-creator/); [C26: Runway: Custom Workflows](https://academy.runwayml.com/course/custom-workflows); [B04: OpenAI: Small Business Workshop](https://academy.openai.com/en/public/resources/openai-academy-small-business-resource-hub-2026-06-03).

**Дополнительная библиотека курса:** [C18: Runway: AI Games](https://academy.runwayml.com/course/ai-games); [C26: Runway: Custom Workflows](https://academy.runwayml.com/course/custom-workflows); [C01: Canva Design School: AI Essentials](https://www.canva.com/design-school/courses/ai-essentials/); [C28: Adobe: AI Video from Runway in Firefly](https://helpx.adobe.com/firefly/web/firefly-video-editor/generate-videos/generate-videos-using-runway-video-models.html); [C29: Adobe: partner video models](https://helpx.adobe.com/firefly/web/work-with-audio-and-video/work-with-video/generate-videos-using-non-adobe-models.html); [A16: Cole Medin: oTTomator Agents](https://github.com/coleam00/ottomator-agents); [C30: Adobe: edit videos using text](https://helpx.adobe.com/firefly/web/create-mood-boards/firefly-boards/edit-videos-using-text-prompts.html); [C31: UNESCO: GenAI in Education and Research](https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research).

### 3.6. Направление DS — AI Design & UX

**Задача направления:** Исследование опыта, UI/UX, прототипы, дизайн-системы.  
**Целевая аудитория:** product designers, UX/UI.  
**Маршрут:** `DS-101` → `DS-201` → `DS-301`; placement test позволяет ускорить переход.

#### DS-101 · AI-Assisted UI/UX Design

**Уровень:** Junior · **Ориентировочная нагрузка:** 20 академических/практических часов (пересчитать при записи контента).  
**Вход:** CORE или вводный тест.  
**Измеримый результат:** Преобразует пользовательскую проблему в тестируемый прототип.  
**Capstone:** Кликабельный прототип 3–5 экранов и результаты 3 тестов.

**DS-101-M1 — Задача и пользователь**  
Результат модуля: Отделяет пользовательскую проблему от пожеланий заказчика.

- `DS-101-M1-L1` · **Микролекция / чтение** · 18 мин — **JTBD, проблема, целевая аудитория, ограничение**.
- `DS-101-M1-L2` · **Демонстрация с повторением** · 28 мин — **AI как помощник формулирования сценария**.
- `DS-101-M1-L3` · **Лабораторная / практикум** · 70 мин — **Составить brief и карту пользовательского пути**.
- `DS-101-M1-L4` · **Кейс-разбор / peer review** · 30 мин — **Критика искусственных персон и неподтверждённых допущений**.
  - **Что сдаёт студент:** UX brief + flow. **Проверка:** Каждое ключевое предположение отмечено как гипотеза.
  - **Точные референсы:** [N09: Figma Help: Create a Figma Make file](https://help.figma.com/hc/en-us/articles/31304485164695-Create-a-Figma-Make-file); [N10: Figma: 8 ways to build with Figma Make](https://www.figma.com/blog/8-ways-to-build-with-figma-make/); [C01: Canva Design School: AI Essentials](https://www.canva.com/design-school/courses/ai-essentials/).

**DS-101-M2 — Wireframes и информационная архитектура**  
Результат модуля: Создаёт понятную последовательность экранов.

- `DS-101-M2-L1` · **Микролекция / чтение** · 18 мин — **IA, навигация и hierarchy**.
- `DS-101-M2-L2` · **Демонстрация с повторением** · 28 мин — **Собрать wireframes c AI-assisted tools**.
- `DS-101-M2-L3` · **Лабораторная / практикум** · 70 мин — **Нарисовать 3–5 экранов по user flow**.
- `DS-101-M2-L4` · **Квиз / диагностический тест** · 30 мин — **Heuristic review навигации**.
  - **Что сдаёт студент:** Набор wireframes. **Проверка:** Сценарий достижим без логических тупиков.
  - **Точные референсы:** [N09: Figma Help: Create a Figma Make file](https://help.figma.com/hc/en-us/articles/31304485164695-Create-a-Figma-Make-file); [N10: Figma: 8 ways to build with Figma Make](https://www.figma.com/blog/8-ways-to-build-with-figma-make/); [C01: Canva Design School: AI Essentials](https://www.canva.com/design-school/courses/ai-essentials/).

**DS-101-M3 — Визуальный UI и доступность**  
Результат модуля: Создаёт читаемый интерфейс с повторяемыми элементами.

- `DS-101-M3-L1` · **Микролекция / чтение** · 18 мин — **Типографика, сетка, контраст и состояния**.
- `DS-101-M3-L2` · **Демонстрация с повторением** · 28 мин — **Применить визуальные токены к прототипу**.
- `DS-101-M3-L3` · **Лабораторная / практикум** · 70 мин — **Собрать компоненты и состояния ошибок**.
- `DS-101-M3-L4` · **Кейс-разбор / peer review** · 30 мин — **Аудит доступности форм и кнопок**.
  - **Что сдаёт студент:** UI Kit starter. **Проверка:** Текст читаем, ошибки видны, фокус доступен.
  - **Точные референсы:** [N09: Figma Help: Create a Figma Make file](https://help.figma.com/hc/en-us/articles/31304485164695-Create-a-Figma-Make-file); [N10: Figma: 8 ways to build with Figma Make](https://www.figma.com/blog/8-ways-to-build-with-figma-make/); [C01: Canva Design School: AI Essentials](https://www.canva.com/design-school/courses/ai-essentials/).

**DS-101-M4 — Тестирование прототипа**  
Результат модуля: Улучшает UX на основании наблюдений.

- `DS-101-M4-L1` · **Микролекция / чтение** · 18 мин — **Протокол usability-test и задача участника**.
- `DS-101-M4-L2` · **Демонстрация с повторением** · 28 мин — **Показать прототип участнику и записать наблюдения**.
- `DS-101-M4-L3` · **Лабораторная / практикум** · 70 мин — **Провести 3 теста, приоритизировать барьеры**.
- `DS-101-M4-L4` · **Квиз / диагностический тест** · 30 мин — **Защита изменений и evidence**.
  - **Что сдаёт студент:** Отчёт тестирования. **Проверка:** Не выдавать гипотезы AI за реальные данные.
  - **Точные референсы:** [N09: Figma Help: Create a Figma Make file](https://help.figma.com/hc/en-us/articles/31304485164695-Create-a-Figma-Make-file); [N10: Figma: 8 ways to build with Figma Make](https://www.figma.com/blog/8-ways-to-build-with-figma-make/); [C01: Canva Design School: AI Essentials](https://www.canva.com/design-school/courses/ai-essentials/).

**Дополнительная библиотека курса:** [N09: Figma Help: Create a Figma Make file](https://help.figma.com/hc/en-us/articles/31304485164695-Create-a-Figma-Make-file); [N10: Figma: 8 ways to build with Figma Make](https://www.figma.com/blog/8-ways-to-build-with-figma-make/); [C01: Canva Design School: AI Essentials](https://www.canva.com/design-school/courses/ai-essentials/); [B29: CMU: Learning Objectives](https://www.cmu.edu/teaching/designteach/design/learningobjectives.html).

#### DS-201 · AI Product Design & Systems

**Уровень:** Middle · **Ориентировочная нагрузка:** 30 академических/практических часов (пересчитать при записи контента).  
**Вход:** DS-101 или портфолио UX/UI.  
**Измеримый результат:** Проектирует продуктовую систему и готовит передачу разработке.  
**Capstone:** Прототип SaaS-фичи + систематизированная библиотека компонентов.

**DS-201-M1 — AI-assisted UX research**  
Результат модуля: Планирует и анализирует исследование без фиктивных интервью.

- `DS-201-M1-L1` · **Микролекция / чтение** · 18 мин — **Исследовательские вопросы, выборка, согласие**.
- `DS-201-M1-L2` · **Демонстрация с повторением** · 28 мин — **Из заметок исследования извлечь evidence**.
- `DS-201-M1-L3` · **Лабораторная / практикум** · 70 мин — **Построить research synthesis с цитатами**.
- `DS-201-M1-L4` · **Кейс-разбор / peer review** · 30 мин — **Проверка ложных цитат и cherry-picking**.
  - **Что сдаёт студент:** Research repository. **Проверка:** Источник каждой цитаты доступен.
  - **Точные референсы:** [N09: Figma Help: Create a Figma Make file](https://help.figma.com/hc/en-us/articles/31304485164695-Create-a-Figma-Make-file); [N10: Figma: 8 ways to build with Figma Make](https://www.figma.com/blog/8-ways-to-build-with-figma-make/); [N11: Figma: Make Kits and Attachments](https://www.figma.com/blog/introducing-make-kits-and-make-attachments/).

**DS-201-M2 — Дизайн-система**  
Результат модуля: Создаёт повторяемые компоненты и токены.

- `DS-201-M2-L1` · **Микролекция / чтение** · 18 мин — **Color, type, spacing, states, variants**.
- `DS-201-M2-L2` · **Демонстрация с повторением** · 28 мин — **Конвертировать UI Kit в reusable components**.
- `DS-201-M2-L3` · **Лабораторная / практикум** · 70 мин — **Описать токены и библиотеку**.
- `DS-201-M2-L4` · **Квиз / диагностический тест** · 30 мин — **Аудит консистентности компонентов**.
  - **Что сдаёт студент:** Design tokens + components. **Проверка:** Компоненты повторно используются.
  - **Точные референсы:** [N09: Figma Help: Create a Figma Make file](https://help.figma.com/hc/en-us/articles/31304485164695-Create-a-Figma-Make-file); [N10: Figma: 8 ways to build with Figma Make](https://www.figma.com/blog/8-ways-to-build-with-figma-make/); [N11: Figma: Make Kits and Attachments](https://www.figma.com/blog/introducing-make-kits-and-make-attachments/).

**DS-201-M3 — Design-to-code**  
Результат модуля: Снижает потери информации при передаче.

- `DS-201-M3-L1` · **Микролекция / чтение** · 18 мин — **Figma Make и генерация прототипов**.
- `DS-201-M3-L2` · **Демонстрация с повторением** · 28 мин — **Обновить код по design spec**.
- `DS-201-M3-L3` · **Лабораторная / практикум** · 70 мин — **Сравнить UI скриншотами и поправить расхождения**.
- `DS-201-M3-L4` · **Кейс-разбор / peer review** · 30 мин — **Visual regression review**.
  - **Что сдаёт студент:** Prototype + handoff. **Проверка:** Ключевые состояния покрыты и сверены.
  - **Точные референсы:** [N10: Figma: 8 ways to build with Figma Make](https://www.figma.com/blog/8-ways-to-build-with-figma-make/); [N11: Figma: Make Kits and Attachments](https://www.figma.com/blog/introducing-make-kits-and-make-attachments/); [B21: Carnegie Mellon: Assessments](https://www.cmu.edu/teaching/designteach/design/assessments.html).

**DS-201-M4 — UX-метрики и эксперименты**  
Результат модуля: Выбирает измеримые сигналы качества опыта.

- `DS-201-M4-L1` · **Микролекция / чтение** · 18 мин — **Usability metrics, success rate, a11y**.
- `DS-201-M4-L2` · **Демонстрация с повторением** · 28 мин — **Создать гипотезу и эксперимент**.
- `DS-201-M4-L3` · **Лабораторная / практикум** · 70 мин — **Запустить тест двух вариантов прототипа**.
- `DS-201-M4-L4` · **Квиз / диагностический тест** · 30 мин — **Защита экспериментального дизайна**.
  - **Что сдаёт студент:** Experiment plan. **Проверка:** Метрики предопределены, выводы ограничены данными.
  - **Точные референсы:** [N10: Figma: 8 ways to build with Figma Make](https://www.figma.com/blog/8-ways-to-build-with-figma-make/); [N11: Figma: Make Kits and Attachments](https://www.figma.com/blog/introducing-make-kits-and-make-attachments/); [B21: Carnegie Mellon: Assessments](https://www.cmu.edu/teaching/designteach/design/assessments.html).

**Дополнительная библиотека курса:** [N09: Figma Help: Create a Figma Make file](https://help.figma.com/hc/en-us/articles/31304485164695-Create-a-Figma-Make-file); [N10: Figma: 8 ways to build with Figma Make](https://www.figma.com/blog/8-ways-to-build-with-figma-make/); [N11: Figma: Make Kits and Attachments](https://www.figma.com/blog/introducing-make-kits-and-make-attachments/); [B21: Carnegie Mellon: Assessments](https://www.cmu.edu/teaching/designteach/design/assessments.html); [V12: Vibe Coding Master Curriculum](https://github.com/diamitani/vibe-coding-course/blob/main/curriculum/00_MASTER_CURRICULUM.md).

#### DS-301 · AI-Native Design Operations

**Уровень:** Senior · **Ориентировочная нагрузка:** 40 академических/практических часов (пересчитать при записи контента).  
**Вход:** DS-201 и работа с дизайн-системой.  
**Измеримый результат:** Создаёт управляемый дизайн-процесс для команды.  
**Capstone:** DesignOps playbook + QA automation + governance.

**DS-301-M1 — DesignOps architecture**  
Результат модуля: Определяет масштабируемые правила работы с дизайном.

- `DS-301-M1-L1` · **Микролекция / чтение** · 18 мин — **Команды, ownership, библиотека и versioning**.
- `DS-301-M1-L2` · **Демонстрация с повторением** · 28 мин — **Спроектировать workflow изменения компонентов**.
- `DS-301-M1-L3` · **Лабораторная / практикум** · 70 мин — **Распределить ответственность по дизайн-компонентам**.
- `DS-301-M1-L4` · **Кейс-разбор / peer review** · 30 мин — **Review конфликтов дизайн-систем**.
  - **Что сдаёт студент:** DesignOps operating model. **Проверка:** Есть ownership и механизм отката.
  - **Точные референсы:** [N11: Figma: Make Kits and Attachments](https://www.figma.com/blog/introducing-make-kits-and-make-attachments/); [G17: OpenAI: Agents improvement loop](https://developers.openai.com/cookbook/examples/agents_sdk/agent_improvement_loop); [N18: OWASP LLM Top 10](https://genai.owasp.org/llm-top-10/).

**DS-301-M2 — AI-агенты в UX-процессе**  
Результат модуля: Внедряет AI в исследования и прототипирование с проверками.

- `DS-301-M2-L1` · **Микролекция / чтение** · 18 мин — **Agent workflow for synthesis, prototyping, QA**.
- `DS-301-M2-L2` · **Демонстрация с повторением** · 28 мин — **Создать агента аудита UI по скриншотам**.
- `DS-301-M2-L3` · **Лабораторная / практикум** · 70 мин — **Связать issue → макет → проверку**.
- `DS-301-M2-L4` · **Квиз / диагностический тест** · 30 мин — **Оценка ложных замечаний агента**.
  - **Что сдаёт студент:** Design QA agent prototype. **Проверка:** Ни одна критическая правка не публикуется без ревью.
  - **Точные референсы:** [N11: Figma: Make Kits and Attachments](https://www.figma.com/blog/introducing-make-kits-and-make-attachments/); [G17: OpenAI: Agents improvement loop](https://developers.openai.com/cookbook/examples/agents_sdk/agent_improvement_loop); [N18: OWASP LLM Top 10](https://genai.owasp.org/llm-top-10/).

**DS-301-M3 — Визуальная регрессия и accessibility**  
Результат модуля: Стандартизирует проверку визуального поведения.

- `DS-301-M3-L1` · **Микролекция / чтение** · 18 мин — **Snapshot tests, responsive, WCAG fundamentals**.
- `DS-301-M3-L2` · **Демонстрация с повторением** · 28 мин — **Настроить набор визуальных сравнений**.
- `DS-301-M3-L3` · **Лабораторная / практикум** · 70 мин — **Автотест различных viewport и состояний**.
- `DS-301-M3-L4` · **Кейс-разбор / peer review** · 30 мин — **Failure case: ложные срабатывания**.
  - **Что сдаёт студент:** QA report + checks. **Проверка:** Покрыты ключевые размеры и состояния.
  - **Точные референсы:** [N11: Figma: Make Kits and Attachments](https://www.figma.com/blog/introducing-make-kits-and-make-attachments/); [G17: OpenAI: Agents improvement loop](https://developers.openai.com/cookbook/examples/agents_sdk/agent_improvement_loop); [N18: OWASP LLM Top 10](https://genai.owasp.org/llm-top-10/).

**DS-301-M4 — Стратегия и измерение качества дизайна**  
Результат модуля: Связывает UX-продукт с бизнес-метриками.

- `DS-301-M4-L1` · **Микролекция / чтение** · 18 мин — **North star, funnels, UX debt, governance**.
- `DS-301-M4-L2` · **Демонстрация с повторением** · 28 мин — **Оценить UX debt и прогноз ресурсов**.
- `DS-301-M4-L3` · **Лабораторная / практикум** · 70 мин — **Составить 90-дневный roadmap улучшений**.
- `DS-301-M4-L4` · **Квиз / диагностический тест** · 30 мин — **Защита стратегии и рисков**.
  - **Что сдаёт студент:** Roadmap + KPI schema. **Проверка:** Есть baseline, ответственные, измерение эффекта.
  - **Точные референсы:** [N11: Figma: Make Kits and Attachments](https://www.figma.com/blog/introducing-make-kits-and-make-attachments/); [G17: OpenAI: Agents improvement loop](https://developers.openai.com/cookbook/examples/agents_sdk/agent_improvement_loop); [N18: OWASP LLM Top 10](https://genai.owasp.org/llm-top-10/).

**Дополнительная библиотека курса:** [N11: Figma: Make Kits and Attachments](https://www.figma.com/blog/introducing-make-kits-and-make-attachments/); [G17: OpenAI: Agents improvement loop](https://developers.openai.com/cookbook/examples/agents_sdk/agent_improvement_loop); [N18: OWASP LLM Top 10](https://genai.owasp.org/llm-top-10/); [B16: Microsoft: Evaluate AI Costs and Benefits](https://learn.microsoft.com/en-us/training/modules/evaluate-costs-benefits-ai-powered-business-solution/).

### 3.7. Направление MK — AI Marketing & Growth

**Задача направления:** Продвижение, продажи, аналитика роста и AI-поиск.  
**Целевая аудитория:** marketers, founders, growth.  
**Маршрут:** `MK-101` → `MK-201` → `MK-301`; placement test позволяет ускорить переход.

#### MK-101 · AI Marketing Essentials

**Уровень:** Junior · **Ориентировочная нагрузка:** 20 академических/практических часов (пересчитать при записи контента).  
**Вход:** CORE или входной тест.  
**Измеримый результат:** Создаёт маркетинговую основу и согласованный контент-план.  
**Capstone:** Кампанийный brief и календарь 4 недель для продукта.

**MK-101-M1 — Аудитория и исследования рынка**  
Результат модуля: Формулирует проверяемые сегменты и job stories.

- `MK-101-M1-L1` · **Микролекция / чтение** · 18 мин — **ICP/JTBD/рынок: факты против предположений**.
- `MK-101-M1-L2` · **Демонстрация с повторением** · 28 мин — **AI-assisted конкурентный анализ с источниками**.
- `MK-101-M1-L3` · **Лабораторная / практикум** · 70 мин — **Собрать карту 3 сегментов**.
- `MK-101-M1-L4` · **Кейс-разбор / peer review** · 30 мин — **Проверка источников и вымышленных инсайтов**.
  - **Что сдаёт студент:** Market brief. **Проверка:** Ссылки на данные; гипотезы помечены.
  - **Точные референсы:** [N04: HubSpot Academy: AI for Marketing](https://academy.hubspot.com/courses/AI-for-Marketers?content_language=English); [B06: Andrew Ng: AI Prompting for Everyone](https://www.deeplearning.ai/courses/ai-prompting-for-everyone); [C11: Skillbox: AI Content Manager](https://skillbox.ru/course/ai-content-manager/).

**MK-101-M2 — Позиционирование и офферы**  
Результат модуля: Создаёт релевантное обещание ценности.

- `MK-101-M2-L1` · **Микролекция / чтение** · 18 мин — **Value proposition, benefits, proofs**.
- `MK-101-M2-L2` · **Демонстрация с повторением** · 28 мин — **Генерация альтернатив офферов и редактура**.
- `MK-101-M2-L3` · **Лабораторная / практикум** · 70 мин — **Написать сообщения под три сегмента**.
- `MK-101-M2-L4` · **Квиз / диагностический тест** · 30 мин — **Оценка на правдивость и конкретику**.
  - **Что сдаёт студент:** Offer matrix. **Проверка:** Нет недоказуемых обещаний.
  - **Точные референсы:** [N04: HubSpot Academy: AI for Marketing](https://academy.hubspot.com/courses/AI-for-Marketers?content_language=English); [B06: Andrew Ng: AI Prompting for Everyone](https://www.deeplearning.ai/courses/ai-prompting-for-everyone); [C11: Skillbox: AI Content Manager](https://skillbox.ru/course/ai-content-manager/).

**MK-101-M3 — Контент-стратегия**  
Результат модуля: Соединяет рубрики с этапами воронки.

- `MK-101-M3-L1` · **Микролекция / чтение** · 18 мин — **Pillars, funnel, distribution channels**.
- `MK-101-M3-L2` · **Демонстрация с повторением** · 28 мин — **Сделать редакционный план с AI**.
- `MK-101-M3-L3` · **Лабораторная / практикум** · 70 мин — **Создать 4-недельный календарь**.
- `MK-101-M3-L4` · **Кейс-разбор / peer review** · 30 мин — **Критика соответствия каналу**.
  - **Что сдаёт студент:** Контент-календарь. **Проверка:** Каждый материал имеет цель и CTA.
  - **Точные референсы:** [N04: HubSpot Academy: AI for Marketing](https://academy.hubspot.com/courses/AI-for-Marketers?content_language=English); [B06: Andrew Ng: AI Prompting for Everyone](https://www.deeplearning.ai/courses/ai-prompting-for-everyone); [C11: Skillbox: AI Content Manager](https://skillbox.ru/course/ai-content-manager/).

**MK-101-M4 — Пилот кампании**  
Результат модуля: Запускает малый измеримый маркетинговый эксперимент.

- `MK-101-M4-L1` · **Микролекция / чтение** · 18 мин — **UTM, KPI, бюджет, согласие, маркировка**.
- `MK-101-M4-L2` · **Демонстрация с повторением** · 28 мин — **Настроить tracking plan и простую отчётность**.
- `MK-101-M4-L3` · **Лабораторная / практикум** · 70 мин — **Смоделировать кампанию и сделать недельный отчёт**.
- `MK-101-M4-L4` · **Квиз / диагностический тест** · 30 мин — **Case review misleading KPIs**.
  - **Что сдаёт студент:** Пилот + отчёт. **Проверка:** Метрики корректно рассчитаны, соблюдены privacy rules.
  - **Точные референсы:** [N04: HubSpot Academy: AI for Marketing](https://academy.hubspot.com/courses/AI-for-Marketers?content_language=English); [B06: Andrew Ng: AI Prompting for Everyone](https://www.deeplearning.ai/courses/ai-prompting-for-everyone); [C11: Skillbox: AI Content Manager](https://skillbox.ru/course/ai-content-manager/).

**Дополнительная библиотека курса:** [N04: HubSpot Academy: AI for Marketing](https://academy.hubspot.com/courses/AI-for-Marketers?content_language=English); [B06: Andrew Ng: AI Prompting for Everyone](https://www.deeplearning.ai/courses/ai-prompting-for-everyone); [C11: Skillbox: AI Content Manager](https://skillbox.ru/course/ai-content-manager/); [C01: Canva Design School: AI Essentials](https://www.canva.com/design-school/courses/ai-essentials/).

#### MK-201 · AI Growth & Sales Automation

**Уровень:** Middle · **Ориентировочная нагрузка:** 30 академических/практических часов (пересчитать при записи контента).  
**Вход:** MK-101 или опыт рекламы/CRM.  
**Измеримый результат:** Проводит контролируемые эксперименты роста и автоматизирует лиды.  
**Capstone:** Воронка лидогенерации с CRM, сегментацией и аналитикой.

**MK-201-M1 — Performance и эксперименты**  
Результат модуля: Проектирует сравнимые гипотезы.

- `MK-201-M1-L1` · **Микролекция / чтение** · 18 мин — **CAC, LTV, CTR, CVR, cohorts, experiment design**.
- `MK-201-M1-L2` · **Демонстрация с повторением** · 28 мин — **Сформировать 2 рекламные гипотезы с AI**.
- `MK-201-M1-L3` · **Лабораторная / практикум** · 70 мин — **Собрать план A/B-теста**.
- `MK-201-M1-L4` · **Кейс-разбор / peer review** · 30 мин — **Разбор ложных причинно-следственных выводов**.
  - **Что сдаёт студент:** Growth experiment backlog. **Проверка:** Метрики и контроль заданы до запуска.
  - **Точные референсы:** [N04: HubSpot Academy: AI for Marketing](https://academy.hubspot.com/courses/AI-for-Marketers?content_language=English); [N05: HubSpot Academy: AI for Marketing Sales & Service Bootcamp](https://academy.hubspot.com/courses/ai-for-marketing-sales-and-service-bootcamp?hubs_content-cta=achievement-cta-cert-image); [A12: n8n N8N102 Integrations APIs](https://learn.n8n.io/courses/course-v1:n8n%2BN8N102%2B2026H2/about).

**MK-201-M2 — CRM & lead scoring**  
Результат модуля: Связывает этапы воронки с данными.

- `MK-201-M2-L1` · **Микролекция / чтение** · 18 мин — **CRM entities, lead lifecycle, scoring**.
- `MK-201-M2-L2` · **Демонстрация с повторением** · 28 мин — **Схема lead capture и AI qualification**.
- `MK-201-M2-L3` · **Лабораторная / практикум** · 70 мин — **Создать sandbox CRM workflow**.
- `MK-201-M2-L4` · **Квиз / диагностический тест** · 30 мин — **Оценка bias и ошибочных отказов**.
  - **Что сдаёт студент:** CRM workflow. **Проверка:** Есть ручной override и audit trail.
  - **Точные референсы:** [N04: HubSpot Academy: AI for Marketing](https://academy.hubspot.com/courses/AI-for-Marketers?content_language=English); [N05: HubSpot Academy: AI for Marketing Sales & Service Bootcamp](https://academy.hubspot.com/courses/ai-for-marketing-sales-and-service-bootcamp?hubs_content-cta=achievement-cta-cert-image); [A12: n8n N8N102 Integrations APIs](https://learn.n8n.io/courses/course-v1:n8n%2BN8N102%2B2026H2/about).

**MK-201-M3 — Personalization & lifecycle**  
Результат модуля: Создаёт коммуникации с учётом согласия и сегментов.

- `MK-201-M3-L1` · **Микролекция / чтение** · 18 мин — **Segments, triggers, consent, privacy**.
- `MK-201-M3-L2` · **Демонстрация с повторением** · 28 мин — **Настроить event-triggered сообщения**.
- `MK-201-M3-L3` · **Лабораторная / практикум** · 70 мин — **Создать 3 email/мессенджер сценария**.
- `MK-201-M3-L4` · **Кейс-разбор / peer review** · 30 мин — **Ревью навязчивых и непрозрачных цепочек**.
  - **Что сдаёт студент:** Lifecycle flow. **Проверка:** Возможность отписки и consent check.
  - **Точные референсы:** [N05: HubSpot Academy: AI for Marketing Sales & Service Bootcamp](https://academy.hubspot.com/courses/ai-for-marketing-sales-and-service-bootcamp?hubs_content-cta=achievement-cta-cert-image); [A12: n8n N8N102 Integrations APIs](https://learn.n8n.io/courses/course-v1:n8n%2BN8N102%2B2026H2/about); [A02: Make Academy: Automation to AI Agents](https://academy.make.com/bundles/automation-to-ai-agents-foundation).

**MK-201-M4 — Attribution и analytics**  
Результат модуля: Находит узкие места воронки.

- `MK-201-M4-L1` · **Микролекция / чтение** · 18 мин — **UTM, channel attribution, funnel quality**.
- `MK-201-M4-L2` · **Демонстрация с повторением** · 28 мин — **Dashboard кампании в mock dataset**.
- `MK-201-M4-L3` · **Лабораторная / практикум** · 70 мин — **Сделать improvement plan на основании данных**.
- `MK-201-M4-L4` · **Квиз / диагностический тест** · 30 мин — **Разбор недостаточности данных**.
  - **Что сдаёт студент:** Growth dashboard. **Проверка:** Выводы подтверждены метриками.
  - **Точные референсы:** [N05: HubSpot Academy: AI for Marketing Sales & Service Bootcamp](https://academy.hubspot.com/courses/ai-for-marketing-sales-and-service-bootcamp?hubs_content-cta=achievement-cta-cert-image); [A12: n8n N8N102 Integrations APIs](https://learn.n8n.io/courses/course-v1:n8n%2BN8N102%2B2026H2/about); [A02: Make Academy: Automation to AI Agents](https://academy.make.com/bundles/automation-to-ai-agents-foundation).

**Дополнительная библиотека курса:** [N04: HubSpot Academy: AI for Marketing](https://academy.hubspot.com/courses/AI-for-Marketers?content_language=English); [N05: HubSpot Academy: AI for Marketing Sales & Service Bootcamp](https://academy.hubspot.com/courses/ai-for-marketing-sales-and-service-bootcamp?hubs_content-cta=achievement-cta-cert-image); [A12: n8n N8N102 Integrations APIs](https://learn.n8n.io/courses/course-v1:n8n%2BN8N102%2B2026H2/about); [A02: Make Academy: Automation to AI Agents](https://academy.make.com/bundles/automation-to-ai-agents-foundation); [B16: Microsoft: Evaluate AI Costs and Benefits](https://learn.microsoft.com/en-us/training/modules/evaluate-costs-benefits-ai-powered-business-solution/).

#### MK-301 · AI Growth Architecture & GEO

**Уровень:** Senior · **Ориентировочная нагрузка:** 40 академических/практических часов (пересчитать при записи контента).  
**Вход:** MK-201 и экспериментальная аналитика.  
**Измеримый результат:** Выстраивает измеримую growth-систему и стратегию AI discoverability.  
**Capstone:** 90-дневная growth/SEO/GEO программа со сценариями и governance.

**MK-301-M1 — AI Search / GEO / AEO**  
Результат модуля: Сравнивает традиционный поиск и ответы LLM.

- `MK-301-M1-L1` · **Микролекция / чтение** · 18 мин — **Механика AI search и цитирования; ограничения измерения**.
- `MK-301-M1-L2` · **Демонстрация с повторением** · 28 мин — **Аудит присутствия бренда в AI-выдаче**.
- `MK-301-M1-L3` · **Лабораторная / практикум** · 70 мин — **Составить план улучшения источников и структуры**.
- `MK-301-M1-L4` · **Кейс-разбор / peer review** · 30 мин — **Проверка псевдо-метрик AI visibility**.
  - **Что сдаёт студент:** GEO baseline. **Проверка:** Нет обещаний гарантированной выдачи; повторяемость аудита.
  - **Точные референсы:** [N12: Semrush Academy: AI Visibility Essentials](https://www.semrush.com/academy/courses/ai-visibility-essentials-with-semrush/); [N13: HubSpot: SEO in the Age of AI](https://academy.hubspot.com/courses/seo-in-the-age-of-ai-en); [N04: HubSpot Academy: AI for Marketing](https://academy.hubspot.com/courses/AI-for-Marketers?content_language=English).

**MK-301-M2 — Growth measurement**  
Результат модуля: Проектирует честные причинные оценки.

- `MK-301-M2-L1` · **Микролекция / чтение** · 18 мин — **Incrementality, holdouts, cohorts, attribution**.
- `MK-301-M2-L2` · **Демонстрация с повторением** · 28 мин — **Набор метрик для нескольких каналов**.
- `MK-301-M2-L3` · **Лабораторная / практикум** · 70 мин — **Провести анализ экспериментальных данных**.
- `MK-301-M2-L4` · **Квиз / диагностический тест** · 30 мин — **Критика ложных uplift и selection bias**.
  - **Что сдаёт студент:** Evaluation plan. **Проверка:** Есть контрольная группа или честное ограничение.
  - **Точные референсы:** [N12: Semrush Academy: AI Visibility Essentials](https://www.semrush.com/academy/courses/ai-visibility-essentials-with-semrush/); [N13: HubSpot: SEO in the Age of AI](https://academy.hubspot.com/courses/seo-in-the-age-of-ai-en); [N04: HubSpot Academy: AI for Marketing](https://academy.hubspot.com/courses/AI-for-Marketers?content_language=English).

**MK-301-M3 — Multi-channel automation**  
Результат модуля: Управляет связанной сетью каналов и процессов.

- `MK-301-M3-L1` · **Микролекция / чтение** · 18 мин — **Orchestration, human approval, SLA**.
- `MK-301-M3-L2` · **Демонстрация с повторением** · 28 мин — **Связать CRM и campaign reporting**.
- `MK-301-M3-L3` · **Лабораторная / практикум** · 70 мин — **Настроить безопасный workflow рекомендаций**.
- `MK-301-M3-L4` · **Кейс-разбор / peer review** · 30 мин — **Red-team рекламных сообщений**.
  - **Что сдаёт студент:** Growth automation blueprint. **Проверка:** Human approval для публичных отправок.
  - **Точные референсы:** [N12: Semrush Academy: AI Visibility Essentials](https://www.semrush.com/academy/courses/ai-visibility-essentials-with-semrush/); [N13: HubSpot: SEO in the Age of AI](https://academy.hubspot.com/courses/seo-in-the-age-of-ai-en); [N04: HubSpot Academy: AI for Marketing](https://academy.hubspot.com/courses/AI-for-Marketers?content_language=English).

**MK-301-M4 — Стратегия и governance**  
Результат модуля: Приоритизирует портфель growth инициатив.

- `MK-301-M4-L1` · **Микролекция / чтение** · 18 мин — **Unit economics, budgets, brand safety**.
- `MK-301-M4-L2` · **Демонстрация с повторением** · 28 мин — **Смоделировать разные бюджеты и риски**.
- `MK-301-M4-L3` · **Лабораторная / практикум** · 70 мин — **Защитить квартальный growth-roadmap**.
- `MK-301-M4-L4` · **Квиз / диагностический тест** · 30 мин — **Board-style defense с альтернативами**.
  - **Что сдаёт студент:** Roadmap + unit economics. **Проверка:** Есть assumptions, risk budget и rollback.
  - **Точные референсы:** [N12: Semrush Academy: AI Visibility Essentials](https://www.semrush.com/academy/courses/ai-visibility-essentials-with-semrush/); [N13: HubSpot: SEO in the Age of AI](https://academy.hubspot.com/courses/seo-in-the-age-of-ai-en); [N04: HubSpot Academy: AI for Marketing](https://academy.hubspot.com/courses/AI-for-Marketers?content_language=English).

**Дополнительная библиотека курса:** [N12: Semrush Academy: AI Visibility Essentials](https://www.semrush.com/academy/courses/ai-visibility-essentials-with-semrush/); [N13: HubSpot: SEO in the Age of AI](https://academy.hubspot.com/courses/seo-in-the-age-of-ai-en); [N04: HubSpot Academy: AI for Marketing](https://academy.hubspot.com/courses/AI-for-Marketers?content_language=English); [B16: Microsoft: Evaluate AI Costs and Benefits](https://learn.microsoft.com/en-us/training/modules/evaluate-costs-benefits-ai-powered-business-solution/).

### 3.8. Направление DT — AI Data & Research

**Задача направления:** Исследования, анализ данных, верификация и BI.  
**Целевая аудитория:** analysts, researchers, managers.  
**Маршрут:** `DT-101` → `DT-201` → `DT-301`; placement test позволяет ускорить переход.

#### DT-101 · AI Research & Data Literacy

**Уровень:** Junior · **Ориентировочная нагрузка:** 20 академических/практических часов (пересчитать при записи контента).  
**Вход:** CORE или входной тест.  
**Измеримый результат:** Проводит проверяемое исследование с первичными источниками.  
**Capstone:** Исследовательская записка с датасетом и графиками.

**DT-101-M1 — Формулировка вопроса и источники**  
Результат модуля: Отделяет исследовательский вопрос от доказательств.

- `DT-101-M1-L1` · **Микролекция / чтение** · 18 мин — **Hypothesis, scope, источники, поисковые запросы**.
- `DT-101-M1-L2` · **Демонстрация с повторением** · 28 мин — **AI-assisted research plan и источник доказательств**.
- `DT-101-M1-L3` · **Лабораторная / практикум** · 70 мин — **Собрать source ledger на 10 источников**.
- `DT-101-M1-L4` · **Кейс-разбор / peer review** · 30 мин — **Spot-check двух неподтверждённых фактов**.
  - **Что сдаёт студент:** Research plan + source ledger. **Проверка:** У каждой фактической претензии есть источник.
  - **Точные референсы:** [N14: OpenAI Academy: Deep Research](https://academy.openai.com/public/clubs/work-users-ynjqu/resources/deep-research); [N06: DataCamp: AI for Data Analysts](https://www.datacamp.com/courses/ai-for-data-analysts); [B21: Carnegie Mellon: Assessments](https://www.cmu.edu/teaching/designteach/design/assessments.html).

**DT-101-M2 — Табличная грамотность**  
Результат модуля: Понимает grain, единицы и типы данных.

- `DT-101-M2-L1` · **Микролекция / чтение** · 18 мин — **Строки, колонки, уникальные ключи, пропуски**.
- `DT-101-M2-L2` · **Демонстрация с повторением** · 28 мин — **Очистить учебный CSV с AI**.
- `DT-101-M2-L3` · **Лабораторная / практикум** · 70 мин — **Описать структуру таблицы и ограничения**.
- `DT-101-M2-L4` · **Квиз / диагностический тест** · 30 мин — **Найти ложное сравнение разных единиц**.
  - **Что сдаёт студент:** Data dictionary. **Проверка:** Нет необоснованных агрегаций.
  - **Точные референсы:** [N14: OpenAI Academy: Deep Research](https://academy.openai.com/public/clubs/work-users-ynjqu/resources/deep-research); [N06: DataCamp: AI for Data Analysts](https://www.datacamp.com/courses/ai-for-data-analysts); [B21: Carnegie Mellon: Assessments](https://www.cmu.edu/teaching/designteach/design/assessments.html).

**DT-101-M3 — Базовая визуализация**  
Результат модуля: Выбирает диаграмму под вопрос.

- `DT-101-M3-L1` · **Микролекция / чтение** · 18 мин — **Тренды, распределения, сравнения, uncertainty**.
- `DT-101-M3-L2` · **Демонстрация с повторением** · 28 мин — **Построить 3 графика и подписи**.
- `DT-101-M3-L3` · **Лабораторная / практикум** · 70 мин — **Сделать краткую data story**.
- `DT-101-M3-L4` · **Кейс-разбор / peer review** · 30 мин — **Критика неверного масштаба графика**.
  - **Что сдаёт студент:** 3 честных графика. **Проверка:** Подписаны единицы, даты, источники.
  - **Точные референсы:** [N14: OpenAI Academy: Deep Research](https://academy.openai.com/public/clubs/work-users-ynjqu/resources/deep-research); [N06: DataCamp: AI for Data Analysts](https://www.datacamp.com/courses/ai-for-data-analysts); [B21: Carnegie Mellon: Assessments](https://www.cmu.edu/teaching/designteach/design/assessments.html).

**DT-101-M4 — Достоверный отчёт**  
Результат модуля: Пишет выводы со степенью уверенности.

- `DT-101-M4-L1` · **Микролекция / чтение** · 18 мин — **Claim-evidence, caveats, reproducibility**.
- `DT-101-M4-L2` · **Демонстрация с повторением** · 28 мин — **Собрать исследовательскую записку**.
- `DT-101-M4-L3` · **Лабораторная / практикум** · 70 мин — **Защитить два спорных вывода**.
- `DT-101-M4-L4` · **Квиз / диагностический тест** · 30 мин — **Источник против AI-выдумки**.
  - **Что сдаёт студент:** Report + appendix. **Проверка:** Цитаты проверяемы; нет fabricated data.
  - **Точные референсы:** [N14: OpenAI Academy: Deep Research](https://academy.openai.com/public/clubs/work-users-ynjqu/resources/deep-research); [N06: DataCamp: AI for Data Analysts](https://www.datacamp.com/courses/ai-for-data-analysts); [B21: Carnegie Mellon: Assessments](https://www.cmu.edu/teaching/designteach/design/assessments.html).

**Дополнительная библиотека курса:** [N14: OpenAI Academy: Deep Research](https://academy.openai.com/public/clubs/work-users-ynjqu/resources/deep-research); [N06: DataCamp: AI for Data Analysts](https://www.datacamp.com/courses/ai-for-data-analysts); [B21: Carnegie Mellon: Assessments](https://www.cmu.edu/teaching/designteach/design/assessments.html); [B01: Andrew Ng: Generative AI for Everyone](https://www.coursera.org/learn/generative-ai-for-everyone).

#### DT-201 · AI Data Analytics & BI

**Уровень:** Middle · **Ориентировочная нагрузка:** 30 академических/практических часов (пересчитать при записи контента).  
**Вход:** DT-101 или базовые таблицы/SQL.  
**Измеримый результат:** Готовит воспроизводимый аналитический workflow.  
**Capstone:** SQL/Python анализ и интерактивный BI-отчёт.

**DT-201-M1 — SQL с AI и базовая модель данных**  
Результат модуля: Проверяет запросы, grain и joins.

- `DT-201-M1-L1` · **Микролекция / чтение** · 18 мин — **SELECT/JOIN/GROUP BY, grain, duplicates**.
- `DT-201-M1-L2` · **Демонстрация с повторением** · 28 мин — **Написать и проверить SQL-запросы**.
- `DT-201-M1-L3` · **Лабораторная / практикум** · 70 мин — **Собрать 3 KPI с независимой валидацией**.
- `DT-201-M1-L4` · **Кейс-разбор / peer review** · 30 мин — **Debug неверной кратности JOIN**.
  - **Что сдаёт студент:** SQL queries + tests. **Проверка:** Результаты сходятся с контрольной выборкой.
  - **Точные референсы:** [N06: DataCamp: AI for Data Analysts](https://www.datacamp.com/courses/ai-for-data-analysts); [B21: Carnegie Mellon: Assessments](https://www.cmu.edu/teaching/designteach/design/assessments.html); [F10: Google ML Crash Course](https://developers.google.com/machine-learning/crash-course).

**DT-201-M2 — Очистка и качество**  
Результат модуля: Находит риски данных до моделирования.

- `DT-201-M2-L1` · **Микролекция / чтение** · 18 мин — **Missingness, deduplication, type drift**.
- `DT-201-M2-L2` · **Демонстрация с повторением** · 28 мин — **AI-assisted data quality notebook**.
- `DT-201-M2-L3` · **Лабораторная / практикум** · 70 мин — **Найти аномалии в CSV**.
- `DT-201-M2-L4` · **Квиз / диагностический тест** · 30 мин — **Ревью data leakage**.
  - **Что сдаёт студент:** Data quality report. **Проверка:** Тесты отсутствующих и дубликатов воспроизводимы.
  - **Точные референсы:** [N06: DataCamp: AI for Data Analysts](https://www.datacamp.com/courses/ai-for-data-analysts); [B21: Carnegie Mellon: Assessments](https://www.cmu.edu/teaching/designteach/design/assessments.html); [F10: Google ML Crash Course](https://developers.google.com/machine-learning/crash-course).

**DT-201-M3 — Исследовательский анализ и гипотезы**  
Результат модуля: Различает корреляции и объяснения.

- `DT-201-M3-L1` · **Микролекция / чтение** · 18 мин — **EDA, segmentation, confounding**.
- `DT-201-M3-L2` · **Демонстрация с повторением** · 28 мин — **Анализ категорий и трендов**.
- `DT-201-M3-L3` · **Лабораторная / практикум** · 70 мин — **Сформулировать и проверить 3 гипотезы**.
- `DT-201-M3-L4` · **Кейс-разбор / peer review** · 30 мин — **Case: spurious correlations**.
  - **Что сдаёт студент:** EDA notebook. **Проверка:** Выводы связаны с расчётами.
  - **Точные референсы:** [N06: DataCamp: AI for Data Analysts](https://www.datacamp.com/courses/ai-for-data-analysts); [B21: Carnegie Mellon: Assessments](https://www.cmu.edu/teaching/designteach/design/assessments.html); [F10: Google ML Crash Course](https://developers.google.com/machine-learning/crash-course).

**DT-201-M4 — BI-дашборд и сторителлинг**  
Результат модуля: Превращает анализ в решение.

- `DT-201-M4-L1` · **Микролекция / чтение** · 18 мин — **Metric dictionary, stakeholder questions**.
- `DT-201-M4-L2` · **Демонстрация с повторением** · 28 мин — **Разработать макет dashboard**.
- `DT-201-M4-L3` · **Лабораторная / практикум** · 70 мин — **Собрать рабочий дашборд и разбор решения**.
- `DT-201-M4-L4` · **Квиз / диагностический тест** · 30 мин — **Презентация для non-tech аудитории**.
  - **Что сдаёт студент:** Dashboard + data story. **Проверка:** Читаемые единицы; трассируемые формулы.
  - **Точные референсы:** [N06: DataCamp: AI for Data Analysts](https://www.datacamp.com/courses/ai-for-data-analysts); [B21: Carnegie Mellon: Assessments](https://www.cmu.edu/teaching/designteach/design/assessments.html); [F10: Google ML Crash Course](https://developers.google.com/machine-learning/crash-course).

**Дополнительная библиотека курса:** [N06: DataCamp: AI for Data Analysts](https://www.datacamp.com/courses/ai-for-data-analysts); [B21: Carnegie Mellon: Assessments](https://www.cmu.edu/teaching/designteach/design/assessments.html); [F10: Google ML Crash Course](https://developers.google.com/machine-learning/crash-course).

#### DT-301 · Decision Intelligence & Advanced Analytics

**Уровень:** Senior · **Ориентировочная нагрузка:** 40 академических/практических часов (пересчитать при записи контента).  
**Вход:** DT-201 и статистические основы.  
**Измеримый результат:** Проектирует систему управленческой аналитики и проверок.  
**Capstone:** Decision dashboard + эксперимент/прогноз с ограничениями.

**DT-301-M1 — Статистические выводы и эксперименты**  
Результат модуля: Оценивает неопределённость и причинный эффект.

- `DT-301-M1-L1` · **Микролекция / чтение** · 18 мин — **Confidence, power, selection bias, causal limits**.
- `DT-301-M1-L2` · **Демонстрация с повторением** · 28 мин — **A/B-анализ с расчётами и assumptions**.
- `DT-301-M1-L3` · **Лабораторная / практикум** · 70 мин — **Создать экспериментальный протокол**.
- `DT-301-M1-L4` · **Кейс-разбор / peer review** · 30 мин — **Критика p-hacking и множественных сравнений**.
  - **Что сдаёт студент:** Experiment report. **Проверка:** Заранее определены гипотеза и stopping rule.
  - **Точные референсы:** [N06: DataCamp: AI for Data Analysts](https://www.datacamp.com/courses/ai-for-data-analysts); [G17: OpenAI: Agents improvement loop](https://developers.openai.com/cookbook/examples/agents_sdk/agent_improvement_loop); [N03: OpenAI: Agents SDK tracing](https://openai.github.io/openai-agents-js/guides/tracing/).

**DT-301-M2 — Прогнозирование с AI**  
Результат модуля: Сравнивает forecast с простыми baseline.

- `DT-301-M2-L1` · **Микролекция / чтение** · 18 мин — **Time series, leakage, seasonality, backtesting**.
- `DT-301-M2-L2` · **Демонстрация с повторением** · 28 мин — **Базовый прогноз и ошибки**.
- `DT-301-M2-L3` · **Лабораторная / практикум** · 70 мин — **Backtesting и сравнение моделей**.
- `DT-301-M2-L4` · **Квиз / диагностический тест** · 30 мин — **Failure mode: in-sample metrics**.
  - **Что сдаёт студент:** Forecast report. **Проверка:** Out-of-sample результат и uncertainty.
  - **Точные референсы:** [N06: DataCamp: AI for Data Analysts](https://www.datacamp.com/courses/ai-for-data-analysts); [G17: OpenAI: Agents improvement loop](https://developers.openai.com/cookbook/examples/agents_sdk/agent_improvement_loop); [N03: OpenAI: Agents SDK tracing](https://openai.github.io/openai-agents-js/guides/tracing/).

**DT-301-M3 — Semantic layer и управление метриками**  
Результат модуля: Фиксирует единые определения бизнес-метрик.

- `DT-301-M3-L1` · **Микролекция / чтение** · 18 мин — **Data contracts, semantic layer, ownership**.
- `DT-301-M3-L2` · **Демонстрация с повторением** · 28 мин — **Создать metric dictionary и тесты**.
- `DT-301-M3-L3` · **Лабораторная / практикум** · 70 мин — **Ввести наблюдаемость обновлений датасета**.
- `DT-301-M3-L4` · **Кейс-разбор / peer review** · 30 мин — **Review breaking metric changes**.
  - **Что сдаёт студент:** Metric governance pack. **Проверка:** Метрики единообразны между отчётами.
  - **Точные референсы:** [N06: DataCamp: AI for Data Analysts](https://www.datacamp.com/courses/ai-for-data-analysts); [G17: OpenAI: Agents improvement loop](https://developers.openai.com/cookbook/examples/agents_sdk/agent_improvement_loop); [N03: OpenAI: Agents SDK tracing](https://openai.github.io/openai-agents-js/guides/tracing/).

**DT-301-M4 — AI analyst agent + governance**  
Результат модуля: Ограничивает автоматические аналитические рекомендации.

- `DT-301-M4-L1` · **Микролекция / чтение** · 18 мин — **Text-to-SQL risks, Evals, permissions**.
- `DT-301-M4-L2` · **Демонстрация с повторением** · 28 мин — **Построить readonly analyst agent**.
- `DT-301-M4-L3` · **Лабораторная / практикум** · 70 мин — **Проверить ошибки на контрольных вопросах**.
- `DT-301-M4-L4` · **Квиз / диагностический тест** · 30 мин — **Защита решения с затратами и рисками**.
  - **Что сдаёт студент:** Agent eval suite. **Проверка:** Нет write доступов; фальшивые данные блокируются.
  - **Точные референсы:** [N06: DataCamp: AI for Data Analysts](https://www.datacamp.com/courses/ai-for-data-analysts); [G17: OpenAI: Agents improvement loop](https://developers.openai.com/cookbook/examples/agents_sdk/agent_improvement_loop); [N03: OpenAI: Agents SDK tracing](https://openai.github.io/openai-agents-js/guides/tracing/).

**Дополнительная библиотека курса:** [N06: DataCamp: AI for Data Analysts](https://www.datacamp.com/courses/ai-for-data-analysts); [G17: OpenAI: Agents improvement loop](https://developers.openai.com/cookbook/examples/agents_sdk/agent_improvement_loop); [N03: OpenAI: Agents SDK tracing](https://openai.github.io/openai-agents-js/guides/tracing/); [B22: Microsoft: AI Business Architecture](https://learn.microsoft.com/ru-ru/training/paths/architect-agentic-ai-business-solutions/).

### 3.9. Направление BI — AI Business & Product

**Задача направления:** AI-продуктивность, продуктовый менеджмент, внедрение и стратегия.  
**Целевая аудитория:** managers, product owners, executives.  
**Маршрут:** `BI-101` → `BI-201` → `BI-301`; placement test позволяет ускорить переход.

#### BI-101 · AI Productivity

**Уровень:** Junior · **Ориентировочная нагрузка:** 18 академических/практических часов (пересчитать при записи контента).  
**Вход:** AI Core либо входной тест.  
**Измеримый результат:** Экономит время на типовых интеллектуальных задачах.  
**Capstone:** 5 воспроизводимых личных AI-сценариев.

**BI-101-M1 — AI literacy**  
Результат модуля: Карта задач для ИИ.

- `BI-101-M1-L1` · **Микролекция / чтение** · 15 мин — **Что умеет GenAI, а чего не умеет**.
- `BI-101-M1-L2` · **Демонстрация с повторением** · 25 мин — **Промпт как техническое задание**.
- `BI-101-M1-L3` · **Лабораторная / практикум** · 75 мин — **Составляем личный backlog AI-задач**.
- `BI-101-M1-L4` · **Квиз / диагностический тест** · 25 мин — **Проверяем границы и достоверность**.
  - **Что сдаёт студент:** Карта задач для ИИ. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [B01: Andrew Ng: Generative AI for Everyone](https://www.coursera.org/learn/generative-ai-for-everyone); [B02: Andrew Ng: AI for Everyone](https://www.deeplearning.ai/courses/ai-for-everyone); [A20: Google: Prompt Design Strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies).

**BI-101-M2 — Research & documents**  
Результат модуля: Проверенный исследовательский отчёт.

- `BI-101-M2-L1` · **Кейс-разбор / peer review** · 20 мин — **Поиск, источники и фактчекинг**.
- `BI-101-M2-L2` · **Кейс-разбор / peer review** · 30 мин — **Документы, длинный контекст, сводки**.
- `BI-101-M2-L3` · **Лабораторная / практикум** · 75 мин — **Готовим обзор темы с источниками**.
- `BI-101-M2-L4` · **Кейс-разбор / peer review** · 25 мин — **Проверка ссылок и ошибочных выводов**.
  - **Что сдаёт студент:** Проверенный исследовательский отчёт. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [B04: OpenAI: Small Business Workshop](https://academy.openai.com/en/public/resources/openai-academy-small-business-resource-hub-2026-06-03); [B05: Microsoft: Craft Prompts for Copilot](https://learn.microsoft.com/ru-ru/training/paths/craft-effective-prompts-copilot-microsoft-365/); [B06: Andrew Ng: AI Prompting for Everyone](https://www.deeplearning.ai/courses/ai-prompting-for-everyone).

**BI-101-M3 — Communications**  
Результат модуля: Пакет материалов для встречи.

- `BI-101-M3-L1` · **Микролекция / чтение** · 15 мин — **Письма, презентации, summary и agenda**.
- `BI-101-M3-L2` · **Демонстрация с повторением** · 35 мин — **Тон коммуникации и редактура**.
- `BI-101-M3-L3` · **Домашнее задание** · 90 мин — **Создаём пакет для встречи и follow-up**.
- `BI-101-M3-L4` · **Кейс-разбор / peer review** · 30 мин — **Peer review текста и структуры**.
  - **Что сдаёт студент:** Пакет материалов для встречи. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [C01: Canva Design School: AI Essentials](https://www.canva.com/design-school/courses/ai-essentials/); [B08: Microsoft: Transform Business Workflows](https://learn.microsoft.com/ru-ru/training/paths/transform-business-workflows-with-ai/); [C13: RuTube: Нейросети для работы 2026](https://rutube.ru/video/c5f458b75762220d3c0ac15edb21af02/).

**BI-101-M4 — Personal workflows**  
Результат модуля: Готовый персональный AI-набор.

- `BI-101-M4-L1` · **Микролекция / чтение** · 20 мин — **Повторяемые шаблоны и чек-листы**.
- `BI-101-M4-L2` · **Живой воркшоп** · 65 мин — **Демо с набором данных без секретов**.
- `BI-101-M4-L3` · **Лабораторная / практикум** · 90 мин — **Собираем библиотеку 5 рабочих сценариев**.
- `BI-101-M4-L4` · **Защита проекта** · 35 мин — **Защита оценки экономии времени**.
  - **Что сдаёт студент:** Готовый персональный AI-набор. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [B04: OpenAI: Small Business Workshop](https://academy.openai.com/en/public/resources/openai-academy-small-business-resource-hub-2026-06-03); [B10: OpenAI: Abilene Workshop Resource Hub](https://academy.openai.com/public/resources/openai-academy-abilene-resource-hub-2026-04-15); [B11: Microsoft: Business Value Generative AI](https://learn.microsoft.com/ru-ru/training/paths/explore-business-value-generative-ai-solutions/).

**Дополнительная библиотека курса:** [B01: Andrew Ng: Generative AI for Everyone](https://www.coursera.org/learn/generative-ai-for-everyone); [B02: Andrew Ng: AI for Everyone](https://www.deeplearning.ai/courses/ai-for-everyone); [A20: Google: Prompt Design Strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies); [B04: OpenAI: Small Business Workshop](https://academy.openai.com/en/public/resources/openai-academy-small-business-resource-hub-2026-06-03); [B05: Microsoft: Craft Prompts for Copilot](https://learn.microsoft.com/ru-ru/training/paths/craft-effective-prompts-copilot-microsoft-365/); [B06: Andrew Ng: AI Prompting for Everyone](https://www.deeplearning.ai/courses/ai-prompting-for-everyone); [C01: Canva Design School: AI Essentials](https://www.canva.com/design-school/courses/ai-essentials/); [B08: Microsoft: Transform Business Workflows](https://learn.microsoft.com/ru-ru/training/paths/transform-business-workflows-with-ai/).

#### BI-201 · AI Transformation & Product Pilots

**Уровень:** Middle · **Ориентировочная нагрузка:** 26 академических/практических часов (пересчитать при записи контента).  
**Вход:** Junior-аттестация + управление процессами.  
**Измеримый результат:** Проверяет гипотезу AI-пользы на измеримых данных.  
**Capstone:** Пилот внедрения ИИ в команде.

**BI-201-M1 — Process discovery**  
Результат модуля: Карта возможностей AI.

- `BI-201-M1-L1` · **Кейс-разбор / peer review** · 20 мин — **Process mining light: интервью и наблюдение**.
- `BI-201-M1-L2` · **Кейс-разбор / peer review** · 30 мин — **Точки потерь времени и качества**.
- `BI-201-M1-L3` · **Лабораторная / практикум** · 75 мин — **Составляем карту AS-IS/TO-BE**.
- `BI-201-M1-L4` · **Кейс-разбор / peer review** · 25 мин — **Приоритизация сценариев по ценности**.
  - **Что сдаёт студент:** Карта возможностей AI. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [B12: Нетология: AI Manager](https://netology.ru/programs/ai-manager); [B13: Skillbox: AI для бизнеса](https://skillbox.ru/course/nejroseti-dlya-biznesa/); [B08: Microsoft: Transform Business Workflows](https://learn.microsoft.com/ru-ru/training/paths/transform-business-workflows-with-ai/).

**BI-201-M2 — Pilot design**  
Результат модуля: Паспорт AI-пилота и baseline.

- `BI-201-M2-L1` · **Микролекция / чтение** · 15 мин — **Hypothesis, KPIs, data readiness**.
- `BI-201-M2-L2` · **Демонстрация с повторением** · 35 мин — **Build vs buy и стоимость пилота**.
- `BI-201-M2-L3` · **Домашнее задание** · 90 мин — **Разрабатываем план эксперимента**.
- `BI-201-M2-L4` · **Кейс-разбор / peer review** · 30 мин — **Review риска и ограничений**.
  - **Что сдаёт студент:** Паспорт AI-пилота и baseline. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [B15: Google AI Professional Certificate](https://grow.google/intl/ie/google-career-certificates/ai-professional/); [B16: Microsoft: Evaluate AI Costs and Benefits](https://learn.microsoft.com/en-us/training/modules/evaluate-costs-benefits-ai-powered-business-solution/); [B17: Google Cloud: GenAI Leader Certification](https://cloud.google.com/learn/certification/generative-ai-leader).

**BI-201-M3 — Adoption & Change**  
Результат модуля: План вовлечения сотрудников.

- `BI-201-M3-L1` · **Микролекция / чтение** · 20 мин — **Роли, владельцы, champions и onboarding**.
- `BI-201-M3-L2` · **Живой воркшоп** · 65 мин — **Workshops и база промптов для команды**.
- `BI-201-M3-L3` · **Лабораторная / практикум** · 90 мин — **Проводим пилотное обучение**.
- `BI-201-M3-L4` · **Защита проекта** · 35 мин — **Обрабатываем сопротивление и feedback**.
  - **Что сдаёт студент:** План вовлечения сотрудников. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [B10: OpenAI: Abilene Workshop Resource Hub](https://academy.openai.com/public/resources/openai-academy-abilene-resource-hub-2026-04-15); [B04: OpenAI: Small Business Workshop](https://academy.openai.com/en/public/resources/openai-academy-small-business-resource-hub-2026-06-03); [B19: OpenAI SME AI Accelerator](https://academy.openai.com/en/public/clubs/small-business-ipf4m/events/sme-ai-accelerator-2x5j0zqfxj).

**BI-201-M4 — Impact measurement**  
Результат модуля: Отчёт до/после по пилоту.

- `BI-201-M4-L1` · **Микролекция / чтение** · 15 мин — **Метрики времени, качества и риска**.
- `BI-201-M4-L2` · **Демонстрация с повторением** · 25 мин — **Реестры инцидентов и контрольная группа**.
- `BI-201-M4-L3` · **Лабораторная / практикум** · 75 мин — **Считаем ROI с неопределённостью**.
- `BI-201-M4-L4` · **Квиз / диагностический тест** · 25 мин — **Защита решения масштабировать/остановить**.
  - **Что сдаёт студент:** Отчёт до/после по пилоту. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [B16: Microsoft: Evaluate AI Costs and Benefits](https://learn.microsoft.com/en-us/training/modules/evaluate-costs-benefits-ai-powered-business-solution/); [B11: Microsoft: Business Value Generative AI](https://learn.microsoft.com/ru-ru/training/paths/explore-business-value-generative-ai-solutions/); [B21: Carnegie Mellon: Assessments](https://www.cmu.edu/teaching/designteach/design/assessments.html).

**Дополнительная библиотека курса:** [B12: Нетология: AI Manager](https://netology.ru/programs/ai-manager); [B13: Skillbox: AI для бизнеса](https://skillbox.ru/course/nejroseti-dlya-biznesa/); [B08: Microsoft: Transform Business Workflows](https://learn.microsoft.com/ru-ru/training/paths/transform-business-workflows-with-ai/); [B15: Google AI Professional Certificate](https://grow.google/intl/ie/google-career-certificates/ai-professional/); [B16: Microsoft: Evaluate AI Costs and Benefits](https://learn.microsoft.com/en-us/training/modules/evaluate-costs-benefits-ai-powered-business-solution/); [B17: Google Cloud: GenAI Leader Certification](https://cloud.google.com/learn/certification/generative-ai-leader); [B10: OpenAI: Abilene Workshop Resource Hub](https://academy.openai.com/public/resources/openai-academy-abilene-resource-hub-2026-04-15); [B04: OpenAI: Small Business Workshop](https://academy.openai.com/en/public/resources/openai-academy-small-business-resource-hub-2026-06-03).

#### BI-301 · AI Strategy, Product & Governance

**Уровень:** Senior · **Ориентировочная нагрузка:** 34 академических/практических часов (пересчитать при записи контента).  
**Вход:** Middle-аттестация + управление инициативами.  
**Измеримый результат:** Определяет правила внедрения и контроля AI.  
**Capstone:** 12-месячная AI-стратегия и портфель проектов.

**BI-301-M1 — Strategy portfolio**  
Результат модуля: Дорожная карта инициатив.

- `BI-301-M1-L1` · **Микролекция / чтение** · 15 мин — **AI maturity и стратегический аудит**.
- `BI-301-M1-L2` · **Демонстрация с повторением** · 35 мин — **Portfolio selection и зависимости**.
- `BI-301-M1-L3` · **Домашнее задание** · 90 мин — **Строим инвестиционный портфель AI-проектов**.
- `BI-301-M1-L4` · **Кейс-разбор / peer review** · 30 мин — **Защита дорожной карты перед комиссией**.
  - **Что сдаёт студент:** Дорожная карта инициатив. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [B22: Microsoft: AI Business Architecture](https://learn.microsoft.com/ru-ru/training/paths/architect-agentic-ai-business-solutions/); [B17: Google Cloud: GenAI Leader Certification](https://cloud.google.com/learn/certification/generative-ai-leader); [B24: Microsoft: Architect Agentic AI Business](https://learn.microsoft.com/en-us/training/paths/architect-agentic-ai-business-solutions/).

**BI-301-M2 — Data, Ethics & Risk**  
Результат модуля: Реестр рисков и AI policy.

- `BI-301-M2-L1` · **Микролекция / чтение** · 20 мин — **Privacy, security и data governance**.
- `BI-301-M2-L2` · **Живой воркшоп** · 65 мин — **AI governance, transparency и red-team**.
- `BI-301-M2-L3` · **Лабораторная / практикум** · 90 мин — **Создаём policy использования инструментов**.
- `BI-301-M2-L4` · **Защита проекта** · 35 мин — **Кейс-комитет: разбираем инцидент**.
  - **Что сдаёт студент:** Реестр рисков и AI policy. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [C31: UNESCO: GenAI in Education and Research](https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research); [G17: OpenAI: Agents improvement loop](https://developers.openai.com/cookbook/examples/agents_sdk/agent_improvement_loop); [B22: Microsoft: AI Business Architecture](https://learn.microsoft.com/ru-ru/training/paths/architect-agentic-ai-business-solutions/).

**BI-301-M3 — Vendor & TCO**  
Результат модуля: Сравнение трёх технологических вариантов.

- `BI-301-M3-L1` · **Микролекция / чтение** · 15 мин — **Vendor assessment, SLA, IP clauses**.
- `BI-301-M3-L2` · **Демонстрация с повторением** · 25 мин — **TCO/ROI и build-vs-buy**.
- `BI-301-M3-L3` · **Лабораторная / практикум** · 75 мин — **Считаем сценарии и стоимость владения**.
- `BI-301-M3-L4` · **Квиз / диагностический тест** · 25 мин — **Защита закупочного решения**.
  - **Что сдаёт студент:** Сравнение трёх технологических вариантов. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [B17: Google Cloud: GenAI Leader Certification](https://cloud.google.com/learn/certification/generative-ai-leader); [B16: Microsoft: Evaluate AI Costs and Benefits](https://learn.microsoft.com/en-us/training/modules/evaluate-costs-benefits-ai-powered-business-solution/); [B22: Microsoft: AI Business Architecture](https://learn.microsoft.com/ru-ru/training/paths/architect-agentic-ai-business-solutions/).

**BI-301-M4 — Scale & Operating Model**  
Результат модуля: Модель управления AI-программой.

- `BI-301-M4-L1` · **Кейс-разбор / peer review** · 20 мин — **Center of excellence и роль AI lead**.
- `BI-301-M4-L2` · **Кейс-разбор / peer review** · 30 мин — **Мониторинг качества, людей и затрат**.
- `BI-301-M4-L3` · **Лабораторная / практикум** · 75 мин — **Создаём governance dashboard**.
- `BI-301-M4-L4` · **Кейс-разбор / peer review** · 25 мин — **Итоговая защита стратегии**.
  - **Что сдаёт студент:** Модель управления AI-программой. **Проверка:** Проверяемый артефакт, объяснение решения, требования выполнены.
  - **Точные референсы:** [B24: Microsoft: Architect Agentic AI Business](https://learn.microsoft.com/en-us/training/paths/architect-agentic-ai-business-solutions/); [B22: Microsoft: AI Business Architecture](https://learn.microsoft.com/ru-ru/training/paths/architect-agentic-ai-business-solutions/); [B29: CMU: Learning Objectives](https://www.cmu.edu/teaching/designteach/design/learningobjectives.html).

**Дополнительная библиотека курса:** [B22: Microsoft: AI Business Architecture](https://learn.microsoft.com/ru-ru/training/paths/architect-agentic-ai-business-solutions/); [B17: Google Cloud: GenAI Leader Certification](https://cloud.google.com/learn/certification/generative-ai-leader); [B24: Microsoft: Architect Agentic AI Business](https://learn.microsoft.com/en-us/training/paths/architect-agentic-ai-business-solutions/); [C31: UNESCO: GenAI in Education and Research](https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research); [G17: OpenAI: Agents improvement loop](https://developers.openai.com/cookbook/examples/agents_sdk/agent_improvement_loop); [B16: Microsoft: Evaluate AI Costs and Benefits](https://learn.microsoft.com/en-us/training/modules/evaluate-costs-benefits-ai-powered-business-solution/); [B29: CMU: Learning Objectives](https://www.cmu.edu/teaching/designteach/design/learningobjectives.html); [U04: Владилен Минин: будущее разработки, harness и проверка](https://www.youtube.com/watch?v=WT0yDhfOjaA).

## 4. Перекрёстные образовательные карты (между специализациями)

Не дублировать уроки, если лучше сделать перекрёстную ссылку на компетенцию, чеклист или входное знание.

| Сквозной навык | Где нужен | Универсальный проверяемый артефакт |
|---|---|---|
| Prompt & Context Engineering | CORE, VC, ENG, AG, MK, DT, BI | Протокол задания с контекстом и критериями |
| API / Webhooks / MCP | ENG, AU, AG, VC, DT | Тестовый интеграционный контракт, минимальные права |
| Evals & Quality Assurance | ENG, AG, DT, VC, AU, DS | Набор тестовых случаев с baseline и логом ошибок |
| Security & Privacy | Все направления | Чеклист данных, permission scopes, threat model |
| Copyright / Consent / Attribution | CR, DS, MK, BI, CORE | Реестр лицензий и согласий |
| Product Discovery / JTBD | VC, DS, MK, BI | PRD/brief + evidence table |
| Unit Economics / ROI | VC, AU, MK, BI, AG, ENG | Cost/quality/trade-off sheet |
| Accessibility / Localization | VC, DS, CR, BI | Проверка 2 языков и 2 размеров интерфейса |
| Verification of Sources | CORE, DT, MK, BI, AG | Source ledger и выборочная проверка утверждений |
| Portfolio & Commercial Delivery | Все направления | Demo + кейс + инструкция передачи |

**Рекомендательные связки:** VC-101 → DS-101/CR-101; VC-201 → ENG-201/AG-201; AU-101 → AG-101; AU-201 → MK-201/AG-201; CR-201 → MK-201; DT-201 → BI-201; ENG-301 ↔ AG-301. Отображать как рекомендации, а не жёсткую блокировку.

## 5. Информационная архитектура LMS

### 5.1. Маршруты учащегося и каталог

```text
/academy                              — главная: 9 направлений + AI Core
/academy/directions                   — полный каталог направлений
/academy/directions/:slug            — направление, уровни, траектория, курсы
/academy/courses/:slug               — курс, результаты, syllabus, проекты, источники
/academy/courses/:slug/learn         — учебная оболочка курса
/academy/lessons/:lessonId           — занятие с блоками, чеклистом, источниками
/academy/library                     — библиотека источников и референсов
/academy/my-learning                 — зачисления, прогресс, сертификаты
/academy/assessments/:assessmentId   — выполнение теста / сдача работы
/academy/projects/:submissionId      — артефакт, оценка, обратная связь
/academy/admin                       — редактор и дашборд
/academy/admin/directions            — CRUD направлений и сортировка
/academy/admin/courses               — CRUD курсов/уровней
/academy/admin/curriculum/:courseId  — reorder модулей, занятий и блоков
/academy/admin/sources               — единый каталог источников/таймкодов
/academy/admin/review                — очередь на проверку работ
/academy/admin/publications          — предпросмотр, публикация, аудит
```

Маршруты **примерные**: если в существующем проекте другой роутер/соглашения, адаптируй URL, сохранив функциональный смысл и поддержку старых ссылок.

### 5.2. Публичная витрина направлений
- Hero: чёткое обещание «создайте проект», не «изучите 100 нейросетей».
- Девять карточек со значком, описанием, целевым результатом, тремя уровнями; одна карточка AI Core.
- Поиск и фильтры: направление, уровень, язык, бесплатно/платно (если цены реализованы), формат, время, публикационный статус, навыки.
- Каждая карточка **не скрывает различие** между «программа описана», «контент создаётся» и «курс доступен».
- Секции «Начать с нуля», «Перейти на Middle», «Выбрать профессию», «Быстрые практикумы».
- Блок зависимостей на странице направления: Junior → Middle → Senior + боковые рекомендации по смежным направлениям.

### 5.3. Страница курса
**Первый экран:** название + уровень + точное обещание результата + пример финального проекта + длительность + статус + понятный CTA (`Начать`, `Записаться`, `В лист ожидания`).

**Основные секции:** (а) что сможете делать, (б) для кого и требования, (в) программа как раскрывающиеся модули с типами занятий, (г) инструменты и расходы, (д) практические проекты, (е) оценка и правила, (ж) референсы и официальные документы, (з) часто задаваемые вопросы, (и) похожие курсы.

**UX:** минимизировать маркетинговые обещания; все результаты измеримы. У недоступных модулей показывать причину блокировки; пользователь может развернуть syllabus даже без enrollment, если курс публичен.

### 5.4. Учебный интерфейс
- Слева: дерево модулей/уроков с типами, статусами и прогрессом; справа/центром — контент занятия.
- Наверху: breadcrumbs, прогресс курса, `Предыдущее/Следующее`, поиск по урокам.
- Внутри: цель, критерии, основной контент, таймкоды видео, практика, чеклист и submit.
- Внизу: `Сохранить черновик`, `Отметить изученным` только для разрешённых форматов, `Отправить на проверку`, `Открыть источники`.
- После отправки: статус `submitted|needs_revision|passed|failed`, комментарий, версия рубрики и ссылка на результат.
- `lesson_block` может быть Markdown, видео, embed (по политике платформы), ссылка, файл, тест, лабораторная, код, результат, feedback.
- Mobile: sticky нижняя навигация, скрываемый сайдбар, доступный видеоплеер, без переполнения таблиц и кода.

### 5.5. Админка/редактор
- Drag-and-drop + альтернативные кнопки «вверх/вниз» для модулей, занятий, блоков.
- Визуальный редактор урока: название, outcomes, тип, длительность, блоки, материалы, критерии, порядок.
- Источники: поиск URL, один canonical URL, несколько назначений, `source validity`, дата проверки, разрешённое использование, таймкоды.
- Просмотр зависимостей: где используется материал; предупреждение при удалении/изменении многоразового ресурса.
- Предпросмотр от лица гостя/студента/методолога без раскрытия недоступных данных.
- Workflow контента: `outline → draft → in_review → approved → published → archived` с историей версий и reason.
- Массовый импорт seed из JSON, dry-run, diff изменений, rollback миграций по штатным средствам проекта.

## 6. Доменная модель и связи БД

Используй существующую БД и ORM. Следующая **логическая схема**, имена можно адаптировать. Поля `created_at`,`updated_at`, `created_by` и soft-delete/audit там, где требуется, подразумеваются.

| Сущность | Главное | Связи/ограничения |
|---|---|---|
| `directions` | id, code UNIQUE, slug UNIQUE, title, description, order, icon, status, locale | 1:N courses; 9 seeded |
| `courses` | id, code UNIQUE, direction_id NULL for CORE, slug UNIQUE, level, outcome, audience, hours, state, version, capstone | direction_id -> directions; 3 уровневых курса на direction |
| `modules` | id, code UNIQUE, course_id, title, outcome, position, state | course_id -> courses; в MVP по 4 модуля |
| `lessons` | id, code UNIQUE, module_id, title, primary_format, duration_min, outcome, position, state | module_id -> modules; 4 seed-занятия на модуль |
| `lesson_blocks` | id, lesson_id, block_type, position, locale, payload_json, version, state | много блоков в одном уроке; sanitize rich content |
| `skills` | id, code UNIQUE, name, description, domain | N:M lessons/courses via mappings |
| `course_prerequisites` | id, course_id, requires_course_id?, condition_type, min_score, allow_placement | не допускать циклов зависимостей |
| `sources` | id, source_code UNIQUE, canonical_url, title, type, language, provenance, rights_state, checked_at, link_state | canonicalized URL UNIQUE where practical |
| `source_links` | id, source_id, target_type, target_id, usage, visibility, start_seconds, end_seconds, editor_note | N:M; UNIQUE on target, source, segment/usage |
| `assessments` | id, lesson_id or course_id, version, kind, passing_score, attempts_policy, rubric_id | контент и попытки отдельно |
| `questions` | id, assessment_id, type, prompt, choices_json, expected/answer_key secured | ответы не отправлять клиенту до сдачи |
| `rubrics` | id, code, version, criteria_json, critical_gates_json | Junior/Middle/Senior |
| `enrollments` | id, user_id, course_id, state, enrolled_at | UNIQUE(user_id, course_id) |
| `lesson_progress` | id, user_id, lesson_id, state, viewed_at, completed_at | UNIQUE(user_id, lesson_id), серверная проверка |
| `submissions` | id, user_id, assessment_id, artifact_url/file_id, text, version, state, submitted_at | состояние, история и права на файл |
| `reviews` | id, submission_id, reviewer_id, rubric_version, scores_json, feedback, decision | отдельно от submissions, журнал исправлений |
| `certificates` | id, user_id, course_id, code UNIQUE, issued_at, revoked_at | только после успешного capstone и условий |
| `placements` | id, user_id, direction_id, level, evidence_url, status, reviewer_id | входная диагностика/экзамен |
| `audit_logs` | id, actor_id, object_type, object_id, action, before_json, after_json | immutable audit для публикации/оценивания |

**Инварианты данных:**
- ID сущностей могут быть UUID, но `code` **стабилен** и не меняется между seed-обновлениями (`VC-101`, `VC-101-M2`, `VC-101-M2-L3`).
- `direction_id` у AI Core допустимо `NULL` либо вынести Core в тип курса `foundation`; не считать Core десятым направлением.
- Уникальность `(course_id, position)` и `(module_id, position)` проверять при reorder транзакционно; не падать на обмене позиций.
- Все операции изменения published content создают новую версию или revision; выданные оценки продолжают ссылаться на прежнюю версию.
- Нельзя создавать `source_link` на несуществующий урок; нельзя удалить source, если он используется в опубликованном контенте, без замены или soft-delete.
- Видимость материалов/результатов обеспечивается на сервере, а не только скрытием кнопок в UI.
- URLs в source не должны содержать приватных токенов/ключей; хранить URL и timestamps отдельно.

### 6.1. Сущность занятия: минимальный JSON-контракт
```json
{
  "code": "ENG-201-M2-L3",
  "moduleCode": "ENG-201-M2",
  "title": "Создать локальный skill с безопасным вводом",
  "primaryFormat": "hands_on_lab",
  "durationMin": 70,
  "publicationStatus": "draft",
  "locale": "ru",
  "learningOutcome": "Студент пишет SKILL.md с ограниченными действиями и проверяет негативный сценарий",
  "contentBlocks": [
    {
      "type": "markdown",
      "body": "Цель, теория и границы навыка"
    },
    {
      "type": "task",
      "instructions": "Создать SKILL.md, тестовый input и журнал проверок",
      "requirements": [
        "Минимальные права",
        "Нет секретов в файлах",
        "Есть expected output"
      ]
    },
    {
      "type": "external_reference",
      "sourceCode": "N16"
    }
  ],
  "assessment": {
    "rubricLevel": "Middle",
    "criticalGates": [
      "no_exposed_secrets"
    ],
    "submissionKinds": [
      "repo_url",
      "text"
    ]
  }
}
```

### 6.2. Вариант server API / actions
Если у проекта уже есть Next server actions, GraphQL или RPC — **следуй существующему стилю**. Контракт пользовательских сценариев:
```text
GET    /api/academy/directions             filters, pagination, localized titles
GET    /api/academy/directions/:code       nested course levels, outcomes, summary
GET    /api/academy/courses/:code          public course details + curriculum outline
GET    /api/academy/courses/:code/lessons  authorized full course content
POST   /api/academy/courses/:code/enroll   authentication, prerequisites, access policy
GET    /api/academy/me/progress            own enrollments/progress only
POST   /api/academy/lessons/:code/progress server validates progress transition
POST   /api/academy/assessments/:id/submit server checks questions, attempts, owner
POST   /api/academy/submissions/:id/review instructor/admin; audit trail
GET    /api/academy/sources                filters: type, direction, status, locale
POST   /api/academy/admin/sources          content_editor+; URL validation
PUT    /api/academy/admin/curriculum/:code content_editor+; version check
POST   /api/academy/admin/import/preview   dry-run seed diff
POST   /api/academy/admin/import/apply     admin only, transactional, idempotent
```

**Безопасность:** CSRF if applicable; rate limits; schema validation; files only through signed upload/authorization; reject javascript/data protocols; sanitize Markdown/HTML; server checks enrollment before private content; allow `https:` external links; user-provided URL is untrusted input. No secrets in client bundles.

### 6.3. Роли и доступ
| Действие | Guest | Student | Instructor | Editor | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| Просмотр публичного каталога | ✓ | ✓ | ✓ | ✓ | ✓ |
| Просмотр опубликованного урока при доступе | — | ✓ | ✓ | ✓ | ✓ |
| Личный прогресс / сдача задания | — | ✓ | ✓ | — | ✓ |
| Проверять назначенные работы | — | — | ✓ | — | ✓ |
| Редактировать curriculum | — | — | — | ✓ | ✓ |
| Управлять источниками и публикацией | — | — | — | ✓ | ✓ |
| Менять роли и настраивать права | — | — | — | — | ✓ |

Учетная запись с несколькими ролями должна корректно объединять разрешения. При просмотре чужих работ instructors видят только назначенные submissions. Аудит административных действий обязателен.

## 7. Механика курса, прогресса, экзаменов и портфолио

### 7.1. Завершение занятий
- **Микролекция:** фиксировать completion только после доступной проверки понимания; возможность вернуться.
- **Демо:** отмечается после выполнения чеклиста + self-assessment; не считать `video play` доказательством освоения.
- **Лабораторная:** upload / repo URL / workflow JSON / демо + тест критериев; состояния draft, submitted, review, revise, passed.
- **Квиз:** вопросы с правильными и отвлекающими вариантами, ограничения попыток, хранение ответов сервера, версия теста.
- **Разбор кейса:** собственный аргумент и оценка по чеклисту; при peer review — анонимность по настройке.
- **Защита:** демонстрация, архитектурные решения, ограничения, ответы на вопросы; оценка по рубрике уровня.

### 7.2. Course completion
`passed = prerequisites_satisfied && all_required_lessons_passed && capstone_score >= 70 && all_critical_gates_passed`. Для пилотного режима допускается `manual_approval`, но с `reviewer_id` и `reason`. Не выпускать сертификат за создание enrollment.

### 7.3. Портфолио
Каждый курс привязан к capstone. Для проекта хранить: проблема, пользователь, результат, screenshots/demo, инструменты, архитектура/flow, проверка, затраты, ограничения, разрешение на публичный показ, reviewer feedback. По умолчанию портфолио **приватное**, публично только opt-in.

### 7.4. Микросертификаты и бейджи
Отдельные состояния: `module_completed`, `course_passed`, `level_certified`. Текст сертификата должен ясно указывать название курса и внутренний уровень академии (не профессиональную должность, не государственную квалификацию). У сертификата публичный verify endpoint без личных данных сверх согласованного имени.

## 8. Источники и легальное переиспользование

**Ключевое правило:** ссылка на чужой курс ≠ лицензия на копирование. В seed будут названия, точные URL, типы, язык, теги, происхождение и статус проверки. `usage` для студентов по умолчанию supplementary; для платных программ — methodological только в редакторской части. Пользовательские видеоссылки — source-provided, описание тем зафиксировано пользователем, содержание видео независимо не аудировано.

### 8.1. Статусы источников
- `verified_search_2026-10-18` — ссылка найдена через текущий веб-поиск; это не означает право на копирование или вечную доступность.
- `from_previous_workbook_check_before_publication` — прямая ссылка перенесена из предыдущей 112-источниковой карты; перед публикацией нужно проверить HTTP/access/licensing.
- `user_supplied_not_reverified` — видео и таймкоды из пользовательского Markdown; ссылки переданы как есть без заявлений о независимом просмотре.
- `from_prior_chat_unverified` — ссылка из предыдущего обсуждения, требует проверки.

### 8.2. Общая библиотека точных прямых URL
| ID | Название | Тип/язык | Статус | Прямая ссылка |
|---|---|---|---|---|
| `V01` | Microsoft Learn: Введение в вайбкодинг | Курс / RU | `from_previous_workbook_check_before_publication` | [https://learn.microsoft.com/ru-ru/training/modules/introduction-vibe-coding/](https://learn.microsoft.com/ru-ru/training/modules/introduction-vibe-coding/) |
| `V02` | DeepLearning.AI: Vibe Coding 101 with Replit | Курс / EN | `from_previous_workbook_check_before_publication` | [https://www.deeplearning.ai/courses/vibe-coding-101-with-replit](https://www.deeplearning.ai/courses/vibe-coding-101-with-replit) |
| `V03` | Яндекс Практикум: Вайбкодинг | Платная программа / RU | `from_previous_workbook_check_before_publication` | [https://practicum.yandex.kz/vibe-coding/](https://practicum.yandex.kz/vibe-coding/) |
| `V04` | Replit Learn: What is Vibe Coding? | Практический урок / EN | `from_previous_workbook_check_before_publication` | [https://learn.replit.com/docs/ai-foundations/lesson-3](https://learn.replit.com/docs/ai-foundations/lesson-3) |
| `V05` | Vibe Code School: учебный репозиторий | GitHub курс / EN | `from_previous_workbook_check_before_publication` | [https://github.com/dineshxr/vibecodeschool](https://github.com/dineshxr/vibecodeschool) |
| `V06` | Нетология: Вайбкодинг | Платная программа / RU | `from_previous_workbook_check_before_publication` | [https://netology.ru/programs/ai-coding](https://netology.ru/programs/ai-coding) |
| `V07` | Replit Learn: Build Your Idea | Практический урок / EN | `from_previous_workbook_check_before_publication` | [https://learn.replit.com/docs/ai-foundations/lesson-7](https://learn.replit.com/docs/ai-foundations/lesson-7) |
| `V08` | Replit Learn: Your First App | Практический урок / EN | `from_previous_workbook_check_before_publication` | [https://learn.replit.com/docs/ai-foundations/lesson-4](https://learn.replit.com/docs/ai-foundations/lesson-4) |
| `V09` | freeCodeCamp: Full Stack Mobile App with AI | YouTube/статья / EN | `from_previous_workbook_check_before_publication` | [https://www.freecodecamp.org/news/build-and-publish-a-full-stack-mobile-app-with-ai](https://www.freecodecamp.org/news/build-and-publish-a-full-stack-mobile-app-with-ai) |
| `V10` | Stepik: Кодовый ИИ-агент Cursor AI | Курс / RU | `from_previous_workbook_check_before_publication` | [https://stepik.org/course/294150/promo](https://stepik.org/course/294150/promo) |
| `V11` | VibeCoding Training | GitHub курс / RU/EN | `from_previous_workbook_check_before_publication` | [https://github.com/codenjoyme/vibecoding-training](https://github.com/codenjoyme/vibecoding-training) |
| `V12` | Vibe Coding Master Curriculum | Curriculum / EN | `from_previous_workbook_check_before_publication` | [https://github.com/diamitani/vibe-coding-course/blob/main/curriculum/00_MASTER_CURRICULUM.md](https://github.com/diamitani/vibe-coding-course/blob/main/curriculum/00_MASTER_CURRICULUM.md) |
| `V13` | Vibe Coding: 12 week Roadmap | Roadmap / EN | `from_previous_workbook_check_before_publication` | [https://github.com/anishutrains/vibe-coding/blob/main/vibe-coding-course/COURSE_ROADMAP.md](https://github.com/anishutrains/vibe-coding/blob/main/vibe-coding-course/COURSE_ROADMAP.md) |
| `V15` | Cursor: Project Rules & AGENTS.md | Документация / EN | `from_previous_workbook_check_before_publication` | [https://docs.cursor.com/context/rules-for-ai](https://docs.cursor.com/context/rules-for-ai) |
| `V16` | Anthropic: Claude Code in Action | Курс / EN | `from_previous_workbook_check_before_publication` | [https://anthropic.skilljar.com/claude-code-in-action](https://anthropic.skilljar.com/claude-code-in-action) |
| `V17` | Anthropic: Claude Code Overview | Документация / EN | `from_previous_workbook_check_before_publication` | [https://docs.anthropic.com/en/docs/claude-code/overview](https://docs.anthropic.com/en/docs/claude-code/overview) |
| `V19` | Microsoft: Generative AI for Beginners | Открытый курс / RU | `from_previous_workbook_check_before_publication` | [https://github.com/microsoft/generative-ai-for-beginners/blob/main/translations/ru/README.md](https://github.com/microsoft/generative-ai-for-beginners/blob/main/translations/ru/README.md) |
| `V20` | Microsoft: AI Agents Study Guide | Study guide / EN | `from_previous_workbook_check_before_publication` | [https://github.com/microsoft/ai-agents-for-beginners/blob/main/STUDY_GUIDE.md](https://github.com/microsoft/ai-agents-for-beginners/blob/main/STUDY_GUIDE.md) |
| `V21` | Microsoft: AI Agents repo | GitHub курс / EN | `from_previous_workbook_check_before_publication` | [https://github.com/microsoft/ai-agents-for-beginners](https://github.com/microsoft/ai-agents-for-beginners) |
| `A01` | n8n QS101 Quickstart | Официальный курс / EN | `from_previous_workbook_check_before_publication` | [https://learn.n8n.io/courses/course-v1:n8n%2BQS101%2B2026H2/about](https://learn.n8n.io/courses/course-v1:n8n%2BQS101%2B2026H2/about) |
| `A02` | Make Academy: Automation to AI Agents | Официальный курс / EN | `from_previous_workbook_check_before_publication` | [https://academy.make.com/bundles/automation-to-ai-agents-foundation](https://academy.make.com/bundles/automation-to-ai-agents-foundation) |
| `A03` | n8n N8N101 Essentials | Официальный курс / EN | `from_previous_workbook_check_before_publication` | [https://learn.n8n.io/courses/course-v1:n8n%2BN8N101%2B2026H2/about](https://learn.n8n.io/courses/course-v1:n8n%2BN8N101%2B2026H2/about) |
| `A04` | Карпухин: Полный гайд n8n 5+ часов | YouTube / RU | `from_previous_workbook_check_before_publication` | [https://www.youtube.com/watch?v=tUufFo-JTZQ](https://www.youtube.com/watch?v=tUufFo-JTZQ) |
| `A05` | Zapier Academy: AI Builder Path | Курс/академия / EN | `from_previous_workbook_check_before_publication` | [https://learn.zapier.com/](https://learn.zapier.com/) |
| `A06` | n8n Workflow Templates | Шаблоны / EN | `from_previous_workbook_check_before_publication` | [https://n8n.io/workflows/](https://n8n.io/workflows/) |
| `A07` | Make: AI Templates | Шаблоны / EN | `from_previous_workbook_check_before_publication` | [https://www.make.com/en/templates?categories=AI](https://www.make.com/en/templates?categories=AI) |
| `A08` | Stepik: ИИ-агенты и автоматизация с n8n | Курс / RU | `from_previous_workbook_check_before_publication` | [https://stepik.org/course/222232/promo](https://stepik.org/course/222232/promo) |
| `A09` | n8n N8N103 AI & Testing | Официальный курс / EN | `from_previous_workbook_check_before_publication` | [https://learn.n8n.io/courses/course-v1:n8n%2BN8N103%2B2026H2/about](https://learn.n8n.io/courses/course-v1:n8n%2BN8N103%2B2026H2/about) |
| `A10` | Skillbox: n8n | Платная программа / RU | `from_previous_workbook_check_before_publication` | [https://skillbox.ru/course/n8n/](https://skillbox.ru/course/n8n/) |
| `A11` | Stepik: n8n и ИИ | Курс / RU | `from_previous_workbook_check_before_publication` | [https://stepik.org/course/252092/promo](https://stepik.org/course/252092/promo) |
| `A12` | n8n N8N102 Integrations APIs | Официальный курс / EN | `from_previous_workbook_check_before_publication` | [https://learn.n8n.io/courses/course-v1:n8n%2BN8N102%2B2026H2/about](https://learn.n8n.io/courses/course-v1:n8n%2BN8N102%2B2026H2/about) |
| `A13` | Michele Torti: N8N Full Course 12h | YouTube / EN | `from_previous_workbook_check_before_publication` | [https://www.youtube.com/watch?v=7_PeuTsx7UM](https://www.youtube.com/watch?v=7_PeuTsx7UM) |
| `A14` | freeCodeCamp: Architect Scalable AI Automations | YouTube / EN | `from_previous_workbook_check_before_publication` | [https://www.youtube.com/watch?v=YY-egxTQirA](https://www.youtube.com/watch?v=YY-egxTQirA) |
| `A15` | JustInCache: n8n Workflows | GitHub/шаблоны / EN | `from_previous_workbook_check_before_publication` | [https://github.com/JustInCache/n8n-workflows](https://github.com/JustInCache/n8n-workflows) |
| `A16` | Cole Medin: oTTomator Agents | GitHub/шаблоны / EN | `from_previous_workbook_check_before_publication` | [https://github.com/coleam00/ottomator-agents](https://github.com/coleam00/ottomator-agents) |
| `A18` | n8n documentation AI Intro | Документация / EN | `from_previous_workbook_check_before_publication` | [https://docs.n8n.io/advanced-ai/intro-tutorial/](https://docs.n8n.io/advanced-ai/intro-tutorial/) |
| `A20` | Google: Prompt Design Strategies | Документация / EN | `from_previous_workbook_check_before_publication` | [https://ai.google.dev/gemini-api/docs/prompting-strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies) |
| `A21` | OpenAI Agents Evals repo | GitHub / EN | `from_previous_workbook_check_before_publication` | [https://github.com/openai/evals](https://github.com/openai/evals) |
| `C01` | Canva Design School: AI Essentials | Официальный курс / EN | `from_previous_workbook_check_before_publication` | [https://www.canva.com/design-school/courses/ai-essentials/](https://www.canva.com/design-school/courses/ai-essentials/) |
| `C02` | Skillbox: AI-креатор | Платная программа / RU | `from_previous_workbook_check_before_publication` | [https://skillbox.ru/course/profession-ai-creator/](https://skillbox.ru/course/profession-ai-creator/) |
| `C03` | Нетология: ИИ-креатор | Платная программа / RU | `from_previous_workbook_check_before_publication` | [https://netology.ru/programs/ai-creator](https://netology.ru/programs/ai-creator) |
| `C04` | Adobe Firefly: realistic photos | Практический урок / EN | `from_previous_workbook_check_before_publication` | [https://www.adobe.com/learn/firefly/web/generate-realistic-photos](https://www.adobe.com/learn/firefly/web/generate-realistic-photos) |
| `C05` | Adobe Firefly: Sketch to Video | Практический урок / EN | `from_previous_workbook_check_before_publication` | [https://www.adobe.com/learn/firefly/web/sketch-to-video-with-generative-ai](https://www.adobe.com/learn/firefly/web/sketch-to-video-with-generative-ai) |
| `C06` | Adobe Firefly: official help | Документация / EN | `from_previous_workbook_check_before_publication` | [https://helpx.adobe.com/firefly/web.html](https://helpx.adobe.com/firefly/web.html) |
| `C07` | Adobe Firefly: генерация видео на русском | Практический урок / RU | `from_previous_workbook_check_before_publication` | [https://helpx.adobe.com/ru/firefly/web/work-with-audio-and-video/work-with-video/generate-videos-using-text-prompts.html](https://helpx.adobe.com/ru/firefly/web/work-with-audio-and-video/work-with-video/generate-videos-using-text-prompts.html) |
| `C08` | Нетология: ИИ-видео и музыка | Платная программа / RU | `from_previous_workbook_check_before_publication` | [https://netology.ru/programs/ai-creative](https://netology.ru/programs/ai-creative) |
| `C09` | Adobe: B-roll from prompts | Практический урок / EN | `from_previous_workbook_check_before_publication` | [https://www.adobe.com/learn/firefly/web/generate-video-text-to-video](https://www.adobe.com/learn/firefly/web/generate-video-text-to-video) |
| `C10` | ElevenLabs: First AI Short Film | YouTube / EN | `from_previous_workbook_check_before_publication` | [https://www.youtube.com/watch?v=47DH_VUa67A](https://www.youtube.com/watch?v=47DH_VUa67A) |
| `C11` | Skillbox: AI Content Manager | Платная программа / RU | `from_previous_workbook_check_before_publication` | [https://skillbox.ru/course/ai-content-manager/](https://skillbox.ru/course/ai-content-manager/) |
| `C12` | NeuroWiki: нейросети с нуля | YouTube / RU | `from_previous_workbook_check_before_publication` | [https://www.youtube.com/watch?v=rpBdmYvZZwI](https://www.youtube.com/watch?v=rpBdmYvZZwI) |
| `C13` | RuTube: Нейросети для работы 2026 | Видео / RU | `from_previous_workbook_check_before_publication` | [https://rutube.ru/video/c5f458b75762220d3c0ac15edb21af02/](https://rutube.ru/video/c5f458b75762220d3c0ac15edb21af02/) |
| `C14` | Runway Academy: AI for Advertising | Официальный курс / EN | `from_previous_workbook_check_before_publication` | [https://academy.runwayml.com/course/ai-advertising](https://academy.runwayml.com/course/ai-advertising) |
| `C15` | Runway: Storyboard Creator | Практический урок / EN | `from_previous_workbook_check_before_publication` | [https://academy.runwayml.com/tutorial/storyboard-featured-workflow](https://academy.runwayml.com/tutorial/storyboard-featured-workflow) |
| `C16` | Adobe: Idea to Title Sequence | Практический урок / EN | `from_previous_workbook_check_before_publication` | [https://www.adobe.com/learn/firefly/web/idea-to-title-sequence](https://www.adobe.com/learn/firefly/web/idea-to-title-sequence) |
| `C18` | Runway: AI Games | Официальный курс / EN | `from_previous_workbook_check_before_publication` | [https://academy.runwayml.com/course/ai-games](https://academy.runwayml.com/course/ai-games) |
| `C19` | Adobe: reference motion | Практический урок / EN | `from_previous_workbook_check_before_publication` | [https://www.adobe.com/learn/firefly/web/video-motion-reference](https://www.adobe.com/learn/firefly/web/video-motion-reference) |
| `C20` | Runway: AI Visual Effects | Официальный курс / EN | `from_previous_workbook_check_before_publication` | [https://academy.runwayml.com/course/ai-visual-effects](https://academy.runwayml.com/course/ai-visual-effects) |
| `C21` | Runway: Video Magic Aleph | Официальный курс / EN | `from_previous_workbook_check_before_publication` | [https://academy.runwayml.com/course/video-magic-aleph](https://academy.runwayml.com/course/video-magic-aleph) |
| `C22` | Adobe: match camera motion | Документация / EN | `from_previous_workbook_check_before_publication` | [https://helpx.adobe.com/firefly/web/work-with-audio-and-video/work-with-video/match-camera-motion-to-reference-video.html](https://helpx.adobe.com/firefly/web/work-with-audio-and-video/work-with-video/match-camera-motion-to-reference-video.html) |
| `C23` | Adobe: Firefly video editor | Документация / EN | `from_previous_workbook_check_before_publication` | [https://helpx.adobe.com/firefly/web/firefly-video-editor/about-firefly-video-editor/about-firefly-video-editor.html](https://helpx.adobe.com/firefly/web/firefly-video-editor/about-firefly-video-editor/about-firefly-video-editor.html) |
| `C24` | Runway: Product Shot to Social Ad | Практический урок / EN | `from_previous_workbook_check_before_publication` | [https://academy.runwayml.com/tutorial/how-to-go-from-product-shot-to-social-ad](https://academy.runwayml.com/tutorial/how-to-go-from-product-shot-to-social-ad) |
| `C25` | Adobe: Social Video Teaser | Практический урок / EN | `from_previous_workbook_check_before_publication` | [https://www.adobe.com/learn/firefly/web/create-social-videos-with-gen-ai](https://www.adobe.com/learn/firefly/web/create-social-videos-with-gen-ai) |
| `C26` | Runway: Custom Workflows | Официальный курс / EN | `from_previous_workbook_check_before_publication` | [https://academy.runwayml.com/course/custom-workflows](https://academy.runwayml.com/course/custom-workflows) |
| `C28` | Adobe: AI Video from Runway in Firefly | Документация / EN | `from_previous_workbook_check_before_publication` | [https://helpx.adobe.com/firefly/web/firefly-video-editor/generate-videos/generate-videos-using-runway-video-models.html](https://helpx.adobe.com/firefly/web/firefly-video-editor/generate-videos/generate-videos-using-runway-video-models.html) |
| `C29` | Adobe: partner video models | Документация / EN | `from_previous_workbook_check_before_publication` | [https://helpx.adobe.com/firefly/web/work-with-audio-and-video/work-with-video/generate-videos-using-non-adobe-models.html](https://helpx.adobe.com/firefly/web/work-with-audio-and-video/work-with-video/generate-videos-using-non-adobe-models.html) |
| `C30` | Adobe: edit videos using text | Документация / EN | `from_previous_workbook_check_before_publication` | [https://helpx.adobe.com/firefly/web/create-mood-boards/firefly-boards/edit-videos-using-text-prompts.html](https://helpx.adobe.com/firefly/web/create-mood-boards/firefly-boards/edit-videos-using-text-prompts.html) |
| `C31` | UNESCO: GenAI in Education and Research | Методология / EN | `from_previous_workbook_check_before_publication` | [https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research](https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research) |
| `G01` | Hugging Face Agents Course RU | Открытый курс / RU | `from_previous_workbook_check_before_publication` | [https://huggingface.co/learn/agents-course/ru-RU/unit0/introduction](https://huggingface.co/learn/agents-course/ru-RU/unit0/introduction) |
| `G02` | Microsoft AI Agents Course RU | GitHub курс / RU | `from_previous_workbook_check_before_publication` | [https://github.com/microsoft/ai-agents-for-beginners/blob/main/translations/ru/README.md](https://github.com/microsoft/ai-agents-for-beginners/blob/main/translations/ru/README.md) |
| `G03` | Stepik: Введение в разработку ИИ-агентов | Курс / RU | `from_previous_workbook_check_before_publication` | [https://stepik.org/course/272932/promo](https://stepik.org/course/272932/promo) |
| `G07` | OpenAI: GPTs and knowledge RU | Документация / RU | `from_previous_workbook_check_before_publication` | [https://help.openai.com/ru-ru/articles/8554397-creating-and-editing-gpts](https://help.openai.com/ru-ru/articles/8554397-creating-and-editing-gpts) |
| `G08` | Hugging Face Agents Unit 1 RU | Открытый курс / RU | `from_previous_workbook_check_before_publication` | [https://huggingface.co/learn/agents-course/ru-RU/unit1/introduction](https://huggingface.co/learn/agents-course/ru-RU/unit1/introduction) |
| `G10` | LangChain: Learning and RAG examples | Документация/уроки / EN | `from_previous_workbook_check_before_publication` | [https://docs.langchain.com/oss/python/learn](https://docs.langchain.com/oss/python/learn) |
| `G11` | DeepLearning.AI: Advanced RAG | Курс / EN | `from_previous_workbook_check_before_publication` | [https://www.deeplearning.ai/alpha/short-courses/building-evaluating-advanced-rag](https://www.deeplearning.ai/alpha/short-courses/building-evaluating-advanced-rag) |
| `G12` | Cole Medin: AI Agents Masterclass | GitHub курс / EN | `from_previous_workbook_check_before_publication` | [https://github.com/coleam00/ai-agents-masterclass](https://github.com/coleam00/ai-agents-masterclass) |
| `G13` | LangChain Academy: Intro LangGraph | Курс / EN | `from_previous_workbook_check_before_publication` | [https://academy.langchain.com/courses/intro-to-langgraph](https://academy.langchain.com/courses/intro-to-langgraph) |
| `G15` | DeepLearning.AI: AI Agents LangGraph | Курс / EN | `from_previous_workbook_check_before_publication` | [https://www.deeplearning.ai/courses/ai-agents-in-langgraph](https://www.deeplearning.ai/courses/ai-agents-in-langgraph) |
| `G16` | CrewAI Multi Agent Systems | Курс / EN | `from_previous_workbook_check_before_publication` | [https://www.deeplearning.ai/courses/multi-ai-agent-systems-with-crewai](https://www.deeplearning.ai/courses/multi-ai-agent-systems-with-crewai) |
| `G17` | OpenAI: Agents improvement loop | Практикум / EN | `from_previous_workbook_check_before_publication` | [https://developers.openai.com/cookbook/examples/agents_sdk/agent_improvement_loop](https://developers.openai.com/cookbook/examples/agents_sdk/agent_improvement_loop) |
| `G19` | Promptfoo Getting Started | Документация / EN | `from_previous_workbook_check_before_publication` | [https://github.com/promptfoo/promptfoo/blob/main/site/docs/getting-started.md](https://github.com/promptfoo/promptfoo/blob/main/site/docs/getting-started.md) |
| `G20` | CrewAI Documentation | Документация / EN | `from_previous_workbook_check_before_publication` | [https://docs.crewai.com/core-concepts/Agents](https://docs.crewai.com/core-concepts/Agents) |
| `G24` | OpenAI Agents API Examples | GitHub примеры / EN | `from_previous_workbook_check_before_publication` | [https://github.com/openai/openai-cookbook/blob/main/examples/agents_api/README.md](https://github.com/openai/openai-cookbook/blob/main/examples/agents_api/README.md) |
| `G26` | Krish Naik: Agentic AI 11h | YouTube / EN | `from_previous_workbook_check_before_publication` | [https://www.youtube.com/watch?v=rV3HJ4LEZ7k](https://www.youtube.com/watch?v=rV3HJ4LEZ7k) |
| `G27` | Cole Medin: Self-hosted AI Kit | GitHub / EN | `from_previous_workbook_check_before_publication` | [https://github.com/coleam00/ai-agents-masterclass/blob/main/local-ai-packaged/README.md](https://github.com/coleam00/ai-agents-masterclass/blob/main/local-ai-packaged/README.md) |
| `B01` | Andrew Ng: Generative AI for Everyone | Курс / EN | `from_previous_workbook_check_before_publication` | [https://www.coursera.org/learn/generative-ai-for-everyone](https://www.coursera.org/learn/generative-ai-for-everyone) |
| `B02` | Andrew Ng: AI for Everyone | Курс / EN | `from_previous_workbook_check_before_publication` | [https://www.deeplearning.ai/courses/ai-for-everyone](https://www.deeplearning.ai/courses/ai-for-everyone) |
| `B04` | OpenAI: Small Business Workshop | Материалы воркшопа / EN | `from_previous_workbook_check_before_publication` | [https://academy.openai.com/en/public/resources/openai-academy-small-business-resource-hub-2026-06-03](https://academy.openai.com/en/public/resources/openai-academy-small-business-resource-hub-2026-06-03) |
| `B05` | Microsoft: Craft Prompts for Copilot | Учебный путь / RU | `from_previous_workbook_check_before_publication` | [https://learn.microsoft.com/ru-ru/training/paths/craft-effective-prompts-copilot-microsoft-365/](https://learn.microsoft.com/ru-ru/training/paths/craft-effective-prompts-copilot-microsoft-365/) |
| `B06` | Andrew Ng: AI Prompting for Everyone | Курс / EN | `from_previous_workbook_check_before_publication` | [https://www.deeplearning.ai/courses/ai-prompting-for-everyone](https://www.deeplearning.ai/courses/ai-prompting-for-everyone) |
| `B08` | Microsoft: Transform Business Workflows | Учебный путь / RU | `from_previous_workbook_check_before_publication` | [https://learn.microsoft.com/ru-ru/training/paths/transform-business-workflows-with-ai/](https://learn.microsoft.com/ru-ru/training/paths/transform-business-workflows-with-ai/) |
| `B10` | OpenAI: Abilene Workshop Resource Hub | Материалы / EN | `from_previous_workbook_check_before_publication` | [https://academy.openai.com/public/resources/openai-academy-abilene-resource-hub-2026-04-15](https://academy.openai.com/public/resources/openai-academy-abilene-resource-hub-2026-04-15) |
| `B11` | Microsoft: Business Value Generative AI | Учебный путь / RU | `from_previous_workbook_check_before_publication` | [https://learn.microsoft.com/ru-ru/training/paths/explore-business-value-generative-ai-solutions/](https://learn.microsoft.com/ru-ru/training/paths/explore-business-value-generative-ai-solutions/) |
| `B12` | Нетология: AI Manager | Платная программа / RU | `from_previous_workbook_check_before_publication` | [https://netology.ru/programs/ai-manager](https://netology.ru/programs/ai-manager) |
| `B13` | Skillbox: AI для бизнеса | Платная программа / RU | `from_previous_workbook_check_before_publication` | [https://skillbox.ru/course/nejroseti-dlya-biznesa/](https://skillbox.ru/course/nejroseti-dlya-biznesa/) |
| `B15` | Google AI Professional Certificate | Сертификация / EN | `from_previous_workbook_check_before_publication` | [https://grow.google/intl/ie/google-career-certificates/ai-professional/](https://grow.google/intl/ie/google-career-certificates/ai-professional/) |
| `B16` | Microsoft: Evaluate AI Costs and Benefits | Учебный модуль / EN | `from_previous_workbook_check_before_publication` | [https://learn.microsoft.com/en-us/training/modules/evaluate-costs-benefits-ai-powered-business-solution/](https://learn.microsoft.com/en-us/training/modules/evaluate-costs-benefits-ai-powered-business-solution/) |
| `B17` | Google Cloud: GenAI Leader Certification | Сертификация / EN | `from_previous_workbook_check_before_publication` | [https://cloud.google.com/learn/certification/generative-ai-leader](https://cloud.google.com/learn/certification/generative-ai-leader) |
| `B19` | OpenAI SME AI Accelerator | Запись воркшопа / EN | `from_previous_workbook_check_before_publication` | [https://academy.openai.com/en/public/clubs/small-business-ipf4m/events/sme-ai-accelerator-2x5j0zqfxj](https://academy.openai.com/en/public/clubs/small-business-ipf4m/events/sme-ai-accelerator-2x5j0zqfxj) |
| `B21` | Carnegie Mellon: Assessments | Методология / EN | `from_previous_workbook_check_before_publication` | [https://www.cmu.edu/teaching/designteach/design/assessments.html](https://www.cmu.edu/teaching/designteach/design/assessments.html) |
| `B22` | Microsoft: AI Business Architecture | Учебный путь / RU | `from_previous_workbook_check_before_publication` | [https://learn.microsoft.com/ru-ru/training/paths/architect-agentic-ai-business-solutions/](https://learn.microsoft.com/ru-ru/training/paths/architect-agentic-ai-business-solutions/) |
| `B24` | Microsoft: Architect Agentic AI Business | Учебный путь / EN | `from_previous_workbook_check_before_publication` | [https://learn.microsoft.com/en-us/training/paths/architect-agentic-ai-business-solutions/](https://learn.microsoft.com/en-us/training/paths/architect-agentic-ai-business-solutions/) |
| `B29` | CMU: Learning Objectives | Методология / EN | `from_previous_workbook_check_before_publication` | [https://www.cmu.edu/teaching/designteach/design/learningobjectives.html](https://www.cmu.edu/teaching/designteach/design/learningobjectives.html) |
| `F01` | OpenAI Prompt Engineering Guide | Документация / EN | `from_previous_workbook_check_before_publication` | [https://developers.openai.com/api/docs/guides/prompt-engineering](https://developers.openai.com/api/docs/guides/prompt-engineering) |
| `F03` | Microsoft: AI for Beginners RU | GitHub курс / RU | `from_previous_workbook_check_before_publication` | [https://github.com/microsoft/AI-For-Beginners/blob/main/translations/ru/README.md](https://github.com/microsoft/AI-For-Beginners/blob/main/translations/ru/README.md) |
| `F05` | OpenAI: ChatGPT Enterprise Prompt Guide | Документация / EN | `from_previous_workbook_check_before_publication` | [https://developers.openai.com/cookbook/examples/chatgpt/chatgpt_prompt_guide/chatgpt_prompt_guide](https://developers.openai.com/cookbook/examples/chatgpt/chatgpt_prompt_guide/chatgpt_prompt_guide) |
| `F06` | Learn Prompting: Russian Intro | Открытые учебные материалы / RU/EN | `from_previous_workbook_check_before_publication` | [https://learnprompting.org/ru/docs/introduction](https://learnprompting.org/ru/docs/introduction) |
| `F09` | Google for Education AI teaching prompts | Методология / EN | `from_previous_workbook_check_before_publication` | [https://edu.google.com/resources/ai-for-k-12-educators/](https://edu.google.com/resources/ai-for-k-12-educators/) |
| `F10` | Google ML Crash Course | Открытый курс / EN | `from_previous_workbook_check_before_publication` | [https://developers.google.com/machine-learning/crash-course](https://developers.google.com/machine-learning/crash-course) |
| `F11` | Class Central: Vibe Coding Courses review | Обзор / EN | `from_previous_workbook_check_before_publication` | [https://www.classcentral.com/report/best-vibe-coding-courses/](https://www.classcentral.com/report/best-vibe-coding-courses/) |
| `F12` | Replit AI Developer Course shilovtech | Видео / RU | `from_previous_workbook_check_before_publication` | [https://rutube.ru/video/dee75af12266fe29a5e955c9b2b79e03/](https://rutube.ru/video/dee75af12266fe29a5e955c9b2b79e03/) |
| `F13` | Shilovtech Example Code | GitHub / RU | `from_previous_workbook_check_before_publication` | [https://github.com/eugeneshilow/bonafide-overhaul](https://github.com/eugeneshilow/bonafide-overhaul) |
| `F15` | Google Cloud GenAI Leader Path Blog | Силлабус / EN | `from_previous_workbook_check_before_publication` | [https://cloud.google.com/blog/topics/training-certifications/new-google-cloud-certification-in-generative-ai](https://cloud.google.com/blog/topics/training-certifications/new-google-cloud-certification-in-generative-ai) |
| `U01` | Видеоурок: от LLM до Vue/SQLite/Docker + autonomous agent | user_video / RU | `user_supplied_not_reverified` | [https://www.youtube.com/watch?v=-q5VabXMWfk](https://www.youtube.com/watch?v=-q5VabXMWfk) |
| `U02` | Владилен Минин: вайбкодинг и Replit | user_video / RU | `user_supplied_not_reverified` | [https://www.youtube.com/watch?v=q6w9KiI8URo](https://www.youtube.com/watch?v=q6w9KiI8URo) |
| `U03` | Практикум: VS Code, Supabase, Vercel | user_video / RU | `user_supplied_not_reverified` | [https://www.youtube.com/watch?v=jHB5kr0qAIA](https://www.youtube.com/watch?v=jHB5kr0qAIA) |
| `U04` | Владилен Минин: будущее разработки, harness и проверка | user_video / RU | `user_supplied_not_reverified` | [https://www.youtube.com/watch?v=WT0yDhfOjaA](https://www.youtube.com/watch?v=WT0yDhfOjaA) |
| `U05` | Владилен Минин: Pi coding agent | user_video / RU | `user_supplied_not_reverified` | [https://www.youtube.com/watch?v=p3htNgFSPVs](https://www.youtube.com/watch?v=p3htNgFSPVs) |
| `U06` | Практикум Claude Code: настройки, контекст, MCP, skills | user_video / RU | `user_supplied_not_reverified` | [https://www.youtube.com/watch?v=Ai9woxKSbKY](https://www.youtube.com/watch?v=Ai9woxKSbKY) |
| `U07` | Orca IDE: git/worktrees/agents | user_video / RU | `user_supplied_not_reverified` | [https://www.youtube.com/watch?v=nL0HxmclDCw](https://www.youtube.com/watch?v=nL0HxmclDCw) |
| `U08` | Herdr: параллельные coding agents | user_video / RU | `user_supplied_not_reverified` | [https://www.youtube.com/watch?v=2aedkHEMSKA](https://www.youtube.com/watch?v=2aedkHEMSKA) |
| `U09` | Claude Code: Telegram-боты и сайт с админкой | user_video / RU | `user_supplied_not_reverified` | [https://www.youtube.com/watch?v=PZKCYLfOVh0](https://www.youtube.com/watch?v=PZKCYLfOVh0) |
| `U10` | Roadmap вайбкодинга 2026 | user_video / RU | `user_supplied_not_reverified` | [https://www.youtube.com/watch?v=27btHDffb_Q](https://www.youtube.com/watch?v=27btHDffb_Q) |
| `U11` | Архитектура AI agents, Claude Code workflows | user_video / RU | `user_supplied_not_reverified` | [https://www.youtube.com/watch?v=EHrqzvKmszo](https://www.youtube.com/watch?v=EHrqzvKmszo) |
| `U12` | MCP простыми словами | user_video / RU | `user_supplied_not_reverified` | [https://www.youtube.com/watch?v=jgMmmMyW_B8](https://www.youtube.com/watch?v=jgMmmMyW_B8) |
| `U13` | Создание AI-агента на Strands/Python/Ollama | user_video / RU | `user_supplied_not_reverified` | [https://www.youtube.com/watch?v=yQwtdUtaBQw](https://www.youtube.com/watch?v=yQwtdUtaBQw) |
| `U14` | Крестников: Agent Skills, harness, loops | user_video / RU | `user_supplied_not_reverified` | [https://www.youtube.com/watch?v=a-NIeMB-Hj8](https://www.youtube.com/watch?v=a-NIeMB-Hj8) |
| `U15` | Hermes Agent: настройки, MCP, память, cron | user_video / RU | `user_supplied_not_reverified` | [https://www.youtube.com/watch?v=XNcKUSL1CTE](https://www.youtube.com/watch?v=XNcKUSL1CTE) |
| `N01` | Anthropic: Steering Claude Code (2026) | official_guide / EN | `verified_search_2026-10-18` | [https://claude.com/resources/articles/steering-claude-code-skills-hooks-rules-subagents-and-more?refid=ep_card_main_event_page](https://claude.com/resources/articles/steering-claude-code-skills-hooks-rules-subagents-and-more?refid=ep_card_main_event_page) |
| `N02` | OpenAI: Agents SDK documentation | official_guide / EN | `verified_search_2026-10-18` | [https://developers.openai.com/api/docs/guides/agents/sdk](https://developers.openai.com/api/docs/guides/agents/sdk) |
| `N03` | OpenAI: Agents SDK tracing | official_guide / EN | `verified_search_2026-10-18` | [https://openai.github.io/openai-agents-js/guides/tracing/](https://openai.github.io/openai-agents-js/guides/tracing/) |
| `N04` | HubSpot Academy: AI for Marketing | course / EN | `verified_search_2026-10-18` | [https://academy.hubspot.com/courses/AI-for-Marketers?content_language=English](https://academy.hubspot.com/courses/AI-for-Marketers?content_language=English) |
| `N05` | HubSpot Academy: AI for Marketing Sales & Service Bootcamp | course / EN | `verified_search_2026-10-18` | [https://academy.hubspot.com/courses/ai-for-marketing-sales-and-service-bootcamp?hubs_content-cta=achievement-cta-cert-image](https://academy.hubspot.com/courses/ai-for-marketing-sales-and-service-bootcamp?hubs_content-cta=achievement-cta-cert-image) |
| `N06` | DataCamp: AI for Data Analysts | course / EN | `verified_search_2026-10-18` | [https://www.datacamp.com/courses/ai-for-data-analysts](https://www.datacamp.com/courses/ai-for-data-analysts) |
| `N07` | n8n Education: Foundations | learning_catalog / EN | `verified_search_2026-10-18` | [https://n8n.io/education/](https://n8n.io/education/) |
| `N08` | n8n Academy | learning_catalog / EN | `verified_search_2026-10-18` | [https://learn.n8n.io/](https://learn.n8n.io/) |
| `N09` | Figma Help: Create a Figma Make file | official_guide / EN | `from_prior_chat_unverified` | [https://help.figma.com/hc/en-us/articles/31304485164695-Create-a-Figma-Make-file](https://help.figma.com/hc/en-us/articles/31304485164695-Create-a-Figma-Make-file) |
| `N10` | Figma: 8 ways to build with Figma Make | guide / EN | `from_prior_chat_unverified` | [https://www.figma.com/blog/8-ways-to-build-with-figma-make/](https://www.figma.com/blog/8-ways-to-build-with-figma-make/) |
| `N11` | Figma: Make Kits and Attachments | guide / EN | `from_prior_chat_unverified` | [https://www.figma.com/blog/introducing-make-kits-and-make-attachments/](https://www.figma.com/blog/introducing-make-kits-and-make-attachments/) |
| `N12` | Semrush Academy: AI Visibility Essentials | course / EN | `from_prior_chat_unverified` | [https://www.semrush.com/academy/courses/ai-visibility-essentials-with-semrush/](https://www.semrush.com/academy/courses/ai-visibility-essentials-with-semrush/) |
| `N13` | HubSpot: SEO in the Age of AI | course / EN | `from_prior_chat_unverified` | [https://academy.hubspot.com/courses/seo-in-the-age-of-ai-en](https://academy.hubspot.com/courses/seo-in-the-age-of-ai-en) |
| `N14` | OpenAI Academy: Deep Research | guide / EN | `from_prior_chat_unverified` | [https://academy.openai.com/public/clubs/work-users-ynjqu/resources/deep-research](https://academy.openai.com/public/clubs/work-users-ynjqu/resources/deep-research) |
| `N15` | Anthropic: Agent Skills repository | source_code / EN | `from_prior_chat_unverified` | [https://github.com/anthropics/skills](https://github.com/anthropics/skills) |
| `N16` | Agent Skills specification | specification / EN | `from_prior_chat_unverified` | [https://agentskills.io/specification](https://agentskills.io/specification) |
| `N17` | Anthropic: Effective harnesses for long-running agents | guide / EN | `from_prior_chat_unverified` | [https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) |
| `N18` | OWASP LLM Top 10 | standards / EN | `from_prior_chat_unverified` | [https://genai.owasp.org/llm-top-10/](https://genai.owasp.org/llm-top-10/) |
| `N19` | Google Responsible AI | guide / EN | `from_prior_chat_unverified` | [https://developers.google.com/machine-learning/guides/intro-responsible-ai](https://developers.google.com/machine-learning/guides/intro-responsible-ai) |
| `N20` | AI Product Management (Coursera) | course / EN | `from_prior_chat_unverified` | [https://www.coursera.org/learn/ai-product-management](https://www.coursera.org/learn/ai-product-management) |

### 8.3. Таймкоды из пользовательских видео (доступны для разных курсов)

**U01 — [Видеоурок: от LLM до Vue/SQLite/Docker + autonomous agent](https://www.youtube.com/watch?v=-q5VabXMWfk)** · Темы: VC,ENG,AG.
- [05:04: LLM и токены](https://www.youtube.com/watch?v=-q5VabXMWfk&t=304s)
- [54:52: окружение](https://www.youtube.com/watch?v=-q5VabXMWfk&t=3292s)
- [01:33:57: Vue/SQLite/Docker](https://www.youtube.com/watch?v=-q5VabXMWfk&t=5637s)
- [02:43:31: agent skills](https://www.youtube.com/watch?v=-q5VabXMWfk&t=9811s)
- [03:17:11: E2E и субагенты](https://www.youtube.com/watch?v=-q5VabXMWfk&t=11831s)
- [04:06:37: деплой](https://www.youtube.com/watch?v=-q5VabXMWfk&t=14797s)

**U02 — [Владилен Минин: вайбкодинг и Replit](https://www.youtube.com/watch?v=q6w9KiI8URo)** · Темы: VC,ENG.
- [01:25: основы](https://www.youtube.com/watch?v=q6w9KiI8URo&t=85s)
- [03:42: декомпозиция](https://www.youtube.com/watch?v=q6w9KiI8URo&t=222s)
- [11:46: Replit](https://www.youtube.com/watch?v=q6w9KiI8URo&t=706s)
- [16:15: 5 ключевых навыков](https://www.youtube.com/watch?v=q6w9KiI8URo&t=975s)
- [34:10: SEO-анализатор](https://www.youtube.com/watch?v=q6w9KiI8URo&t=2050s)

**U03 — [Практикум: VS Code, Supabase, Vercel](https://www.youtube.com/watch?v=jHB5kr0qAIA)** · Темы: VC,ENG.
- [05:20: терминал](https://www.youtube.com/watch?v=jHB5kr0qAIA&t=320s)
- [11:21: frontend/backend](https://www.youtube.com/watch?v=jHB5kr0qAIA&t=681s)
- [13:48: БД](https://www.youtube.com/watch?v=jHB5kr0qAIA&t=828s)
- [21:15: Supabase](https://www.youtube.com/watch?v=jHB5kr0qAIA&t=1275s)
- [39:11: GitHub/Vercel](https://www.youtube.com/watch?v=jHB5kr0qAIA&t=2351s)

**U04 — [Владилен Минин: будущее разработки, harness и проверка](https://www.youtube.com/watch?v=WT0yDhfOjaA)** · Темы: ENG,BI.
- [21:57: verification tax](https://www.youtube.com/watch?v=WT0yDhfOjaA&t=1317s)
- [26:34: harness](https://www.youtube.com/watch?v=WT0yDhfOjaA&t=1594s)
- [32:10: context, MCP, RAG](https://www.youtube.com/watch?v=WT0yDhfOjaA&t=1930s)
- [40:40: evals](https://www.youtube.com/watch?v=WT0yDhfOjaA&t=2440s)
- [50:57: maturity](https://www.youtube.com/watch?v=WT0yDhfOjaA&t=3057s)

**U05 — [Владилен Минин: Pi coding agent](https://www.youtube.com/watch?v=p3htNgFSPVs)** · Темы: ENG,AG.
- [00:26: harness](https://www.youtube.com/watch?v=p3htNgFSPVs&t=26s)
- [03:07: AGENTS.md](https://www.youtube.com/watch?v=p3htNgFSPVs&t=187s)
- [08:31: subagents](https://www.youtube.com/watch?v=p3htNgFSPVs&t=511s)
- [11:43: Playwright MCP](https://www.youtube.com/watch?v=p3htNgFSPVs&t=703s)

**U06 — [Практикум Claude Code: настройки, контекст, MCP, skills](https://www.youtube.com/watch?v=Ai9woxKSbKY)** · Темы: ENG,VC,AG.
- [00:36: установка](https://www.youtube.com/watch?v=Ai9woxKSbKY&t=36s)
- [19:18: CLAUDE.md/spec.md](https://www.youtube.com/watch?v=Ai9woxKSbKY&t=1158s)
- [30:28: MCP](https://www.youtube.com/watch?v=Ai9woxKSbKY&t=1828s)
- [35:26: subagents](https://www.youtube.com/watch?v=Ai9woxKSbKY&t=2126s)
- [43:43: skills](https://www.youtube.com/watch?v=Ai9woxKSbKY&t=2623s)

**U07 — [Orca IDE: git/worktrees/agents](https://www.youtube.com/watch?v=nL0HxmclDCw)** · Темы: ENG,DS.
- [04:01: permissions](https://www.youtube.com/watch?v=nL0HxmclDCw&t=241s)
- [06:50: worktrees](https://www.youtube.com/watch?v=nL0HxmclDCw&t=410s)
- [11:13: refactoring](https://www.youtube.com/watch?v=nL0HxmclDCw&t=673s)

**U08 — [Herdr: параллельные coding agents](https://www.youtube.com/watch?v=2aedkHEMSKA)** · Темы: ENG.
- [04:37: параллельные агенты](https://www.youtube.com/watch?v=2aedkHEMSKA&t=277s)
- [11:22: две миграции](https://www.youtube.com/watch?v=2aedkHEMSKA&t=682s)

**U09 — [Claude Code: Telegram-боты и сайт с админкой](https://www.youtube.com/watch?v=PZKCYLfOVh0)** · Темы: VC,ENG,BI.
- [13:43: Telegram bot](https://www.youtube.com/watch?v=PZKCYLfOVh0&t=823s)
- [53:28: лендинг](https://www.youtube.com/watch?v=PZKCYLfOVh0&t=3208s)
- [01:04:51: MCP](https://www.youtube.com/watch?v=PZKCYLfOVh0&t=3891s)
- [01:34:33: Whisper API](https://www.youtube.com/watch?v=PZKCYLfOVh0&t=5673s)

**U10 — [Roadmap вайбкодинга 2026](https://www.youtube.com/watch?v=27btHDffb_Q)** · Темы: VC,ENG.
- [12:08: stack и docs](https://www.youtube.com/watch?v=27btHDffb_Q&t=728s)
- [23:39: security](https://www.youtube.com/watch?v=27btHDffb_Q&t=1419s)
- [30:29: deploy](https://www.youtube.com/watch?v=27btHDffb_Q&t=1829s)

**U11 — [Архитектура AI agents, Claude Code workflows](https://www.youtube.com/watch?v=EHrqzvKmszo)** · Темы: AG,ENG,AU.
- [11:13: архитектура](https://www.youtube.com/watch?v=EHrqzvKmszo&t=673s)
- [16:44: agent patterns](https://www.youtube.com/watch?v=EHrqzvKmszo&t=1004s)
- [23:00: workspaces](https://www.youtube.com/watch?v=EHrqzvKmszo&t=1380s)

**U12 — [MCP простыми словами](https://www.youtube.com/watch?v=jgMmmMyW_B8)** · Темы: AG,AU,ENG.
- [02:58: API vs MCP](https://www.youtube.com/watch?v=jgMmmMyW_B8&t=178s)
- [08:10: настройка](https://www.youtube.com/watch?v=jgMmmMyW_B8&t=490s)
- [12:18: безопасность](https://www.youtube.com/watch?v=jgMmmMyW_B8&t=738s)

**U13 — [Создание AI-агента на Strands/Python/Ollama](https://www.youtube.com/watch?v=yQwtdUtaBQw)** · Темы: AG,ENG.
- [05:10: Ollama](https://www.youtube.com/watch?v=yQwtdUtaBQw&t=310s)
- [08:40: Python agent](https://www.youtube.com/watch?v=yQwtdUtaBQw&t=520s)
- [15:30: testing](https://www.youtube.com/watch?v=yQwtdUtaBQw&t=930s)

**U14 — [Крестников: Agent Skills, harness, loops](https://www.youtube.com/watch?v=a-NIeMB-Hj8)** · Темы: AG,ENG.
- [08:04: harness](https://www.youtube.com/watch?v=a-NIeMB-Hj8&t=484s)
- [20:33: skills](https://www.youtube.com/watch?v=a-NIeMB-Hj8&t=1233s)
- [43:19: cycles](https://www.youtube.com/watch?v=a-NIeMB-Hj8&t=2599s)

**U15 — [Hermes Agent: настройки, MCP, память, cron](https://www.youtube.com/watch?v=XNcKUSL1CTE)** · Темы: AG,AU,BI.
- [01:59: VPS](https://www.youtube.com/watch?v=XNcKUSL1CTE&t=119s)
- [31:42: MCP](https://www.youtube.com/watch?v=XNcKUSL1CTE&t=1902s)
- [50:55: memory](https://www.youtube.com/watch?v=XNcKUSL1CTE&t=3055s)
- [01:04:02: cron](https://www.youtube.com/watch?v=XNcKUSL1CTE&t=3842s)
- [01:25:03: multi-agent](https://www.youtube.com/watch?v=XNcKUSL1CTE&t=5103s)

**Неполный референс:** в пользовательском файле есть большой тематический блок про `AGENTS.md`, skills, MCP, Git Worktrees, hooks и Verification Loop без отдельного URL перед заголовком. Не создавать вымышленную ссылку; все темы уже включены в ENG-201 и ENG-301.

### 8.4. Правила качества ссылок
1. Преобразовать YouTube `youtu.be/ID?si=tracking` → `https://www.youtube.com/watch?v=ID`, хранить начало фрагмента отдельно (`start_seconds`).
2. Проверять URL хотя бы при админском запуске отдельной задачи или периодически: статус, redirect, последний HTTP-код, запрет embed, дата проверки. Не выполнять сетевые проверки на каждом рендере страницы.
3. Если ресурс недоступен: показывать «требует проверки», не выкидывать из методологической базы; назначить редакторскую задачу на замену.
4. Для сайтов с логином или платным доступом отображать `external_paid_or_registration` и не обещать бесплатное прохождение.
5. Хранить notes «что перенять» отдельно от описаний урока; не переносить буквально авторские слайды/видео/тексты.
6. Для GitHub соблюдать LICENSE каждого проекта; отсутствие LICENSE **не** означает свободное коммерческое копирование.

## 9. Импорт, сохранность данных и исходная Excel-карта

Предыдущая карта (`AI_Academy_2026_методологическая_карта.xlsx`) содержала 5 направлений, 16 курсов вместе с Core, 62 модуля, 248 занятий, 112 источников и 506 lesson-source-привязок. Новая версия расширяет её до 9 направлений, 28 курсов с Core, 112 модулей и 448 занятий. **Не присваивать старые ID новым направлениям; перенести исходные стабильно.**

**Seed с данными:** `AI_Academy_Codex_Curriculum_Seed_2026.json`. Используй `source_code`, `course_code`, `module_code`, `lesson_code` как stable upsert keys. Для `lesson_source_links` уникальный ключ `(source_id, lesson_id, role, segment_start)`. Seed содержит ссылки и уроки, но не полноценный текст каждой лекции. Он предназначен для **структурирования**, а не для выдачи 448 готовых полноценных уроков.

```text
1. backup существующей БД / snapshot, verify permissions
2. audit existing schema; decide ALTER vs new tables
3. create migration, rollback strategy, unique indexes
4. transform seed (validate ids → validate refs → upsert directions)
5. upsert courses → modules → lessons → sources → source_links
6. fill lesson outlines + placeholders in unpublished state
7. dry-run import on staging, check counts and duplicates
8. only then apply to production with backups and logs
```

**Не выполнять автоматическую публикацию** всех курсов после seed. Отображать каталог и структуру можно, но кнопки начала занятий должны учитывать фактическое наличие содержимого и статусы.

## 10. UX, локализация, аналитика, доступность

### 10.1. Базовые принципы UI
- Стили — продолжение текущего дизайн-системы проекта, без случайных новых цветов/шрифтов; если дизайн-системы нет — нейтральная профессиональная LMS.
- На desktop каталог минимум 3 карточки в строку при подходящей ширине; tablet 2; mobile 1. Это ориентир, не фиксированная сетка без тестирования.
- Не перегружать баннерами и декоративными бейджами; показывать уровни только в маршруте и карточках.
- На странице занятия обеспечить legible code, responsive video, keyboard navigation, visible focus и доступные сообщения об ошибках.
- Пустые состояния: нет записанных курсов, нет результатов по фильтру, нет источников, курс в разработке, нет прав, нет доступных попыток.

### 10.2. Локализация
- RU — исходные заголовки и контент; KK и EN — подготовить схему localized translations, fallback RU.
- В учебных заданиях примеры форм и интерфейсов могут быть на русском и казахском; не генерировать машинный перевод в продакшен без ревью.
- Времена/деньги форматировать по locale; цены на внешние сервисы не захардкодить в курсовой текст без даты и региона.

### 10.3. Product analytics
**События:** `academy_direction_view`, `course_view`, `enrollment_start`, `enrollment_completed`, `lesson_open`, `lesson_started`, `lesson_completed`, `quiz_submitted`, `assignment_submitted`, `assignment_reviewed`, `course_completed`, `source_clicked`, `search_used`, `placement_passed`. События не должны содержать произвольный текст промптов, секреты, ответы экзамена или персональные данные. Отдельно считать time-to-first-result, completion rate, dropout-by-module и источники привлечения.

## 11. Административные сценарии и предотвращение ошибок

1. Методолог добавляет урок `AG-201-M2-L4`, связывает его со старым source `G10`, новым source `U12`, задаёт `start_seconds=178`, публикует. В библиотеке source не появляется дубль.
2. Контент-редактор меняет исходный URL source `U12` после проверки. Ссылка обновляется во всех отображениях без изменения содержания и оценок.
3. Преподаватель возвращает работу `DS-101` на доработку, студент прикрепляет версию №2. Старый отзыв остаётся доступным в истории.
4. Студент с placement test проходит прямо в `VC-201`, но видит незакрытые навыки из CORE для самостоятельного восполнения.
5. На сайте есть платный источник с `methodological/internal`: студент не видит скрытых редакторских заметок и не получает несанкционированный файл.
6. Редактор пытается удалить модуль с progress: система предупреждает и предлагает архивировать вместо физического удаления.
7. Одновременное редактирование одного урока: optimistic locking/version и сообщение о конфликте; чужие изменения не перетираются.

## 12. Приёмочные сценарии для автоматических и ручных тестов

| № | Область | Проверка |
|---:|---|---|
| 1 | Seed | После первого импорта 9 направлений, 27 специальных курсов + CORE; 112 модулей; 448 уроков |
| 2 | Idempotency | Повторный seed не меняет количества, user-owned данные сохраняются |
| 3 | Referential integrity | Нет уроков без модуля, модулей без курса, source links на удалённые объекты |
| 4 | Catalog | Фильтр Junior показывает ровно 9 специализированных Junior-курсов |
| 5 | Search | Запросы «вайбкодинг», «MCP», «Runway», «RAG» находят нужные записи |
| 6 | Multi-source | У одного видео есть links в ENG и AG, без дублирования sources |
| 7 | YouTube chapter | Ссылка по клику открывает корректную позицию t=seconds |
| 8 | RBAC | Student не может PATCH курс, выставить оценку себе или просмотреть submission другого студента |
| 9 | Course state | Outline не выдаётся за доступный полноценный курс |
| 10 | Lesson formats | Рендер текст/видео/lab/quiz/case/live/assignment/defense |
| 11 | Quiz | Ответы не раскрываются до проверки; повторные попытки учитываются |
| 12 | Submissions | История V1 → needs_revision → V2 → passed корректна |
| 13 | Progress | Прогресс вычисляется сервером из обязательных требований и сохраняется между сессиями |
| 14 | Localization | Русский fallback работает при отсутствии KZ/EN |
| 15 | Responsive | 360px mobile, tablet, desktop: не ломаются карточки, видеоблоки, редактор |
| 16 | Accessibility | Tab/focus, aria, contrast, keyboard alternative reorder проверены |
| 17 | Security | Нет arbitrary embeds, XSS из Markdown, открытого upload, незащищённых admin endpoints |
| 18 | Links | Ссылки URL конкретные, сохранены исходники/дата проверки, нет выдуманных |
| 19 | Performance | Пагинация/поиск серверные, нет N+1 для каталога и курса |
| 20 | Build | Lint/typecheck/tests/build штатными командами проекта завершаются успешно |

## 13. Поэтапный план Codex и обязательные отчёты

**Этап 0 — Audit.** Инвентаризация репозитория, ограничения текущих схем и UI. Создать `docs/ai-academy/integration-audit.md` с решением по миграциям и маршрутам.

**Этап 1 — Schema + seed.** Создать таблицы, индексы, relations, методы миграции, валидатор JSON. Импортировать каталог + курсы + модули + занятия + источники. Сначала сухой запуск и тесты.

**Этап 2 — Public UX.** Каталог направлений, страница направления, карточки уровня, страница курса, фильтры, поиск, SEO и responsive.

**Этап 3 — Learning UX.** Составные занятия, дерево навигации, progress, enrollment, quizzes, submissions, rubric evaluation.

**Этап 4 — Admin CMS.** CRUD, reorder, редактор блоков, source library, preview, контент workflow, audit log.

**Этап 5 — QA.** Auth/RBAC, seed repeat, i18n, accessibility, mobile, performance, ссылка с таймкодом, публичный статус, E2E.

**Отчёт после работы Codex:** файл `docs/ai-academy/implementation-report.md`, перечислить реальные изменения по путям файлов, миграции и данные, фактически выполненные команды, тесты, скриншоты при возможности, remaining TODO и точные причины несделанного. **Не утверждать, что что-то протестировано, если не запускалось.**

### Входное задание для Codex, когда этот файл будет добавлен в репозиторий
```text
Изучи ./AI_Academy_Codex_Implementation_TZ_2026.md и соседний
./AI_Academy_Codex_Curriculum_Seed_2026.json (если он есть).
Реализуй архитектуру AI Academy внутри ТЕКУЩЕГО приложения:
9 направлений, CORE, Junior/Middle/Senior, курсы/модули/занятия,
составные уроки, каталог источников с cross-links,
админку, роли, прогресс, тесты и сдачу проектов.
Сначала проверь стек и БД. Не переписывай приложение и не удаляй
имеющиеся данные. Делай миграции/seed идемпотентными.
Создавай только авторские placeholders для контента, не копируй чужие курсы.
Выполни тесты и создай implementation-report.md с фактами и TODO.
Если часть системы требует внешних credential/provider integrations,
сделай безопасную адаптацию с feature flag, не имитируй работающие платежи.
```

## 14. Примечания о качестве данных

- Новые модули ENG/DS/MK/DT спроектированы методологически на основе предыдущей беседы и дополнительных источников; это **предложенный curriculum**, а не цитата или точный план внешних школ.
- Темы старых VC/AU/CR/AG/BI преимущественно перенесены из ранее созданной карты; при производстве контента провести методологическую ревизию длительности, прав и устаревающих названий UI.
- Подробности пользовательских роликов и таймкодов происходят из переданного пользователем конспекта; ссылки в приложении нужно подтвердить перед публикацией.
- Все ресурсы в реестре — **ссылки-референсы**, а не разрешение публично переопубликовать оригинальные видео, репозитории, курсы или слайды.
- Начальные 448 записей уроков представляют **подробные планы занятий**; полного лекционного текста и файлов проектов в этом ТЗ нет, и Codex не должен заявлять обратное.

---

**Конец ТЗ.** Сначала реализовать достоверную структуру и статусы, затем наполнить практические уроки качественным авторским контентом и провести review перед публикацией.
