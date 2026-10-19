# Отчёт: генератор, обновления, OG-копия и CSV

Дата: 17 октября 2026. Этот отчёт относится к инструментам и документам. Итоговые интеграционные результаты всей поставки находятся в [VERIFICATION.md](VERIFICATION.md).

## Реализовано

- `scripts/client.mjs create`: обязательные name/preset/brand/modules/out, проверка опций и брендбука, зависимости из действующего TypeScript-реестра, фильтрация навигации/главной, сохранение бренд-конфига. Отдельная папка со своими исходниками, сервером, Supabase, public, content, инструментами, тестами, конфигами и документацией. Клиентский `.env.example` получает `VITE_DEMO=false`; local Supabase project_id — client id. Копируемый lock-файл согласуется с именем пакета.
- Файловая allowlist корней/манифестов, исключение окружения и известных секретных форматов, зависимостей, сборок, выгрузок и клиентских папок. Вложенные генерации с `.platform-kit.json` исключаются. Symlink/junction и небезопасные относительные пути запрещены. Источник не обходится через Git и не зависит от tracked-статуса файлов.
- `.platform-kit.json`: версия формата, версия источника, client id, время и SHA-256 каждого поставленного файла. Собственный манифест в хешируемую карту не включается.
- `update`/`upgrade`: отчёт без записи по умолчанию, запись только при `--apply`. Конфликтные/неизвестные файлы, локальные удаления, конфиги, контент, зависимости и существующие миграции сохраняются. Удалённые upstream файлы не удаляются. Хеши меняются после записи безопасных файлов; в манифесте сохраняется summary последнего применения. Версия источника не означает, что ручные конфликты уже разрешены.
- `scripts/sync-og.mjs`: только отчёт по умолчанию, отдельная SHA-база `.platform-kit-og.json`, явный target. Копирует implementation/config/content в `src/platform-kit`, art в `public/platform-assets`, server в `server/platform-kit`, edge function в `az-master-api`, миграции — с исходными уникальными именами. Пересчитывает относительные импорты, пути каталога, app id/OG-бренд. Существующие чужие файлы без базы не заменяет. Root package/config/router не меняет.
- `src/platform/csv.ts`: ограниченный CSV parse/encode, BOM, кириллица, quoted commas/newlines, doubled quotes, JSON data column при экспорте, защита экспортируемых формул апострофом, строгие заголовки и размерные лимиты. Серверные права и domain mapping остаются обязательными.
- Русские инструкции: README, AGENTS, BRANDING, MODULES, AI-RECIPES, OPERATIONS, DEPLOYMENT, BACKUP-RESTORE, UPGRADES, INTEGRATIONS, DELIVERY, LIMITS. `vercel.json` задаёт frontend build и SPA fallback; API proxy в нём не создаётся.

## Фактически выполненные проверки

На Node.js `v24.19.0`:

```sh
node --experimental-strip-types --test tests/csv.test.mjs tests/generator.test.mjs
```

Результат: 13 тестов, 13 passed, 0 failed, 0 skipped. Проверены outside-root temp output, полный фактический inventory мастера, все SHA выходных файлов, запуск config-тестов в копии, замыкание зависимостей, nav/home filtering, сохранение бренда, client demo=false, exclusion секретных/клиентских файлов, read-only dry-run, безопасное apply, protected/config/content и local-edit conflict, недопустимые параметры, traversal, реальные junction/symlink, независимый OG-copy и пересчёт backend imports. CSV: quoted Unicode/multiline/JSON round-trip, malformed input, prototype headers, formula neutralization, byte/cell/row/column limits.

```sh
node node_modules/typescript/bin/tsc --ignoreConfig --noEmit --target ES2022 --module ESNext --moduleResolution bundler --lib ES2022,DOM --skipLibCheck src/platform/csv.ts
```

Результат: exit 0. Полная сборка приложения находится в ответственности интеграционного прогона; этот отчёт её не подменяет.

## Ограничения и оставшаяся интеграция

Общий код выключенных модулей физически остаётся в поставке; runtime- и серверные gates должны быть проверены на конечном стенде. Фильтры имён не распознают реальные секреты, спрятанные в произвольном разрешённом исходнике. Source inventory должен оставаться чистым от клиентских данных.

Обновление не является транзакцией всего файлового дерева, Git merge, SQL deploy или авторазрешением конфликтов. Нужны backup, ручная адаптация конфигов/зависимостей и тесты конечной копии. Генератор не копирует внешние brand assets автоматически по ссылке на JSON.

Финальная интеграция выполнена и в настоящем OG checkout: самостоятельные исходники, маршрут, зависимости, edge function, новые миграции и документация. Отдельная копия OG без мастера устанавливается и собирается со своими зависимостями. Облачное развёртывание и production-seed не выполнялись. Динамически собранные runtime URL в произвольном будущем коде не преобразуются универсально.

CSV helper не создаёт пользователей и не отменяет серверную валидацию. UI импорта/экспорта подключён в админке; member update относится к существующей серверной записи. Формульные строки получают апостроф, что намеренно меняет их текст. Облачные deploy, настоящий Telegram/OIDC, платежи, бот-доставка и восстановление облачного backup не запускались; локальные проверки backend и конкурентных транзакций перечислены в итоговом протоколе.
