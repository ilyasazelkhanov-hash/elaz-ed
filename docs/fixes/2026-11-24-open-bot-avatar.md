# Dots: Open Bot Avatar

По запросу владельца старый персонаж заменён библиотекой Open Bot Avatar 0.4.0. В настройках доступны 23 силуэта из той же галереи, с миниатюрами, четыре цвета и две фактуры. По умолчанию выбран пушистый лавандовый Dots-облачко.

- Локальная галерея скопирована без изменений из upstream `323ce6ab8bc6b0bc9603a418ee3d91442e4996fc`; MIT license и hashes рядом с JSON.
- Старые name/color/shape/accessory читаются. Формы soft/round/spark переходят в cloud/egg/star. Старые аксессуары сохранены в данных для совместимости, но не предлагаются новым renderer. Новые поля avatar/material проверяются по allowlist. Ключ и привязка к аккаунту прежние.
- Подсказки, переходы, голос, датчики и касания принадлежат прежнему OG-компоненту. Рендерер получает мимику, реакцию и взгляд. Покупки, награды и серверные данные не изменены.
- Пауза, системное reduced-motion, уход за пределы экрана, скрытие страницы и overlay переводят персонажа в still; чтение gaze останавливается. Unmount освобождает renderer. SVG fallback создаётся только из локальных проверенных контуров. WebGL2 недоступен: upstream использует гладкую фактуру.

Проверка: 55 companion tests PASS, TypeScript PASS. Headless Chromium, demo, 390×844 и 320×780: новый Canvas-персонаж, сохранение кота/имени/гладкой фактуры и reload, закрытие без сохранения, Back, пауза, reduced-motion disabled control, отсутствие горизонтального overflow, page errors 0. Тёмная тема на 320px и светлая на 390px осмотрены; статичный SVG на паузе не меняется между кадрами. Скриншоты сохранены в `docs/design/open-bot-avatar/`. Инъекция `contextlost` проверена: renderer освобождён, анимация остановлена, статичный SVG виден. Повторяемый browser-check: `scripts/dots-avatar-browser.cjs` (нужен Playwright). Повторяемый browser-check на объединённом коде PASS: `test-results/dots-avatar/qa.json`. Итоговый aggregate на объединённом коде: `npm run test:all` 50/50 PASS, включая production build. Исходный код кандидата `f4c437e`; последующие изменения этого отчёта документационные. Квитанция merge/deploy и live QA фиксируется в PR #33.

Физические Telegram iOS/Android, датчики на устройстве и энергопотребление NOT VERIFIED. Это frontend-изменение; рабочая база и API не требуются. Публикация не подтверждается локальными тестами.

Параллельно обнаружен PR #32 (`cd44376`) с независимой реализацией для трёх форм. Ветка `codex/dots-avatar-gallery-23` сохранена отдельно; PR #32 и его изменения не перезаписаны. Владелец выбрал 23 персонажа. Ветка совмещена с main `527b764`: сохранён event-driven gaze из PR #32, второй RAF-цикл не нужен; полная галерея и две фактуры расширяют уже выпущенную замену.

## Квитанция выпуска

PR #33 влит, main/live `0a5f367a995818bed48835e1aca97660327fb53b`, Vercel success, четыре CI jobs PASS (Published release smoke skipped). Live demo Chromium PASS: 23 персонажа, две фактуры, выбор кота и reload с сохранением, page errors 0. `release.json`: built_at `2026-11-24T16:50:52.056Z`, build_sha256 `de1e1d02e7d79a054f091d1256ee7c95fd3832532832f7bf3cd161d8be38014f`, dirty true. Этот последующий docs-only commit не равен проверенному deployment SHA. Остальные предложения только проверены: [отчёт](../audits/2026-11-24-proposals.md).
