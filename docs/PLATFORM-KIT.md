# Новые модули OG CRE8R²

Самостоятельная версия расположена в `src/platform-kit`. Она не импортирует `Azelkhanov-master`. В профиле демо доступен пункт «Больше возможностей OG»; прямой адрес — `/?demo&platform`. Стрелка в шапке возвращает к существующим урокам.

В production раздел включается после настройки сервера: `VITE_PLATFORM_ENABLED=true`, `VITE_PLATFORM_API_URL=/platform-api`. До этого пункт скрыт у действующих участников. Старые курсы, платежи, адвент, бренд и таблицы сохранены. Новые операции используют отдельные `az_*`; XP старых уроков и нового пространства ведётся раздельно, без перезаписи прежнего прогресса.

## Подключение

1. Сделайте backup. Примените на стенде `20261016195015_az_master.sql` и `20261016201213_ordinary_quiz_attempts.sql` после прежних миграций.
2. Разверните обновлённую `api` и новую `az-master-api`, обе с `verify_jwt=false`: собственная Telegram/сессионная проверка выполняется кодом.
3. Задайте серверные APP_URL, ADMIN_TELEGRAM_IDS, OIDC и cron secrets. Для браузерной админки: `API_PUBLIC_PATH=/platform-api`, `ADMIN_RETURN_PATH=/space/admin`. Callback — `https://DOMAIN/platform-api/v1/auth/callback`.
4. Настройте same-origin proxy `/platform-api/v1/:path*` на `https://PROJECT.supabase.co/functions/v1/az-master-api/v1/:path*`. Инструмент `Azelkhanov-master/scripts/configure-hosting.mjs` подготавливает vercel.json; runtime от него не зависит.
5. Скопируйте `server/platform-kit/rules.example.json` в приватный файл `rules.og.json` внутри `src/platform-kit`. Укажите реальный `channelId` (отрицательный ID или `@username`) и остальные правила. Owner provisioning: `node server/platform-kit/provision.mjs --root src/platform-kit --url https://DOMAIN/platform-api --rules rules.og.json`. Нужны свежая `AZ_INIT_DATA` владельца и настроенный botUsername. Каталог ответов — `src/platform-kit/content/catalog.json`, не public. Приватный файл правил не добавляйте в публичные материалы или клиентские выгрузки.
6. Scheduler вызывает `/platform-api/v1/jobs/run` раз в минуту с `Authorization: Bearer CRON_SECRET`. До включения раздела пройдите сценарии ролей, приватных материалов, оплаты и кассы.

У бота остаётся один webhook — прежний `api/webhook`. Обработчик направляет UUID invoice payload новых модулей в общий серверный обработчик; course: и catchup: продолжают прежний путь. Не заменяйте webhook OG адресом standalone-мастера.

Обычные квизы OG используют сохранённую попытку: запрос с выдуманным массивом правильных ответов не выдаёт XP. Обновите frontend и API вместе с миграцией.

## Проверки и обновления

`npm run build`, `npm run test:api`, `npm run test:database`. Автономный прогон: `node scripts/verify-og-portable.mjs` создаёт временную копию без мастера и устанавливает свои зависимости.

Манифест .platform-kit-og.json хранит базовую версию. Sync сначала выдаёт отчёт; изменённые файлы, конфиги, контент и миграции требуют проверки. Применённую миграцию не перезаписывают: выпускают следующую. Новые миграции этой поставки к облаку не применялись.
