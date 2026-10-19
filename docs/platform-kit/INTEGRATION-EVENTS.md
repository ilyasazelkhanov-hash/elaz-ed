# Подписанные события внешних систем

Endpoint — `POST /api/v1/integrations/events`. Секрет INTEGRATION_WEBHOOK_SECRET хранится только у владельца и серверного адаптера CRM/кассы/HR.

```json
{"id":"pos:purchase:12345","type":"purchase.confirmed","data":{"userId":"123456789","amount":10000,"currency":"KZT"}}
```

Заголовки: Content-Type application/json; X-Az-Timestamp — Unix seconds; X-Az-Signature — hex HMAC-SHA256 от `timestamp + '.' + rawBody`. Разница времени — до пяти минут. Подписывайте отправляемые байты JSON; используйте HTTPS.

| type | data | Серверное действие |
|---|---|---|
| visit.confirmed | userId | Один визит в локальную дату, отметка и баллы по правилам. |
| purchase.confirmed | userId, amount, currency | Баллы по rules.loyalty.purchasePointsPerUnit; валюта должна совпадать. |
| employee.approved | userId, teamId? | Подтверждение сотрудника без права внешней системы назначать роли. |
| order.status | orderId, status | Допустимый accepted/ready/completed/cancelled и транзакционные проверки. |

Inbox хранит ID, событие, результат, число попыток и безопасный код ошибки. Успешный повтор возвращает duplicate: true; изменённое тело с прежним ID — 409 event_id_conflict. Неизвестный участник оставляет failed; после исправления повторите прежнее событие с новой временной подписью. Нельзя менять сумму и переиспользовать ID. Включайте название источника в идентификатор.

Подпись не заменяет адаптер конкретного поставщика: согласуйте поля, единицы цены, возвраты, retries и журнал доставки. Исходящий экспорт — CSV и v1 API; автоматическая доставка в произвольную CRM подключается отдельно.
