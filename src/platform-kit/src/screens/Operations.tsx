import { useCallback, useEffect, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { usePlatform } from '../platform/store.ts'
import type { Data } from '../platform/contracts.ts'
import { encodeCsv } from '../platform/csv.ts'
import { createLatestRequest, type LatestRequestState } from '../platform/latest-request.ts'
import { Button, Empty } from '../components/ui.tsx'

const status: Record<string, string> = {
  pending: 'В очереди',
  leased: 'В обработке',
  succeeded: 'Выполнено',
  sent: 'Доставлено',
  dead: 'Нужна проверка',
  paid: 'Оплачено',
  refunded: 'Возвращено',
  checkout: 'Ожидает оплаты',
  cancelled: 'Отменено',
}
export default function Operations({ payments = false }: { payments?: boolean }) {
  const { act, busy, snapshot: s, message } = usePlatform()
  const [kind, setKind] = useState('notification')
  const filterKey = payments ? 'payments' : `queue:${kind}`
  const [state, setState] = useState<LatestRequestState<Data[]>>({ key: '', loading: true, error: '' })
  const [request] = useState(() => createLatestRequest<Data[]>(setState))
  // The identity check also hides old rows during the render before the next effect runs.
  const current = state.key === filterKey
  const rows = current ? state.value ?? [] : []
  const loading = !current || state.loading
  const error = current ? state.error : ''
  const load = useCallback(() => request.run(filterKey, async () => {
    const result = await act(payments ? 'admin.payments' : 'queue.list', payments ? { limit: 100 } : { kind })
    return result ? (result[payments ? 'payments' : 'jobs'] ?? []) as Data[] : undefined
  }), [act, filterKey, kind, payments, request])
  useEffect(() => {
    request.select(filterKey)
    void load()
    return () => request.invalidate()
  }, [filterKey, load, request])
  const exportRows = () => {
    const url = URL.createObjectURL(new Blob([encodeCsv(rows)], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = payments ? 'payments.csv' : 'delivery-queue.csv'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <>
      <div className="az-admin-toolbar">
        {!payments && (
          <label>
            Очередь
            <select aria-label="Вид очереди" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="notification">Уведомления</option>
              {['owner', 'admin'].includes(s!.me.role) && <option value="refund">Возвраты Stars</option>}
            </select>
          </label>
        )}
        <Button tone="soft" disabled={busy} onClick={() => void load()}>
          <RefreshCw size={16} />
          Обновить
        </Button>
        <Button tone="soft" disabled={!rows.length} onClick={exportRows}>
          <Download size={16} />
          Экспорт CSV
        </Button>
      </div>
      {error ? (
        <div className="az-panel" role="alert">
          <p>{error}</p>
          <Button tone="soft" disabled={busy} onClick={() => void load()}>Повторить обновление</Button>
        </div>
      ) : loading ? (
        <p role="status">Загружаем операции…</p>
      ) : !rows.length ? (
        <Empty
          title={payments ? 'Оплат пока нет' : 'Очередь пуста'}
          body={
            payments
              ? 'Подтверждённые Telegram Stars появятся здесь.'
              : 'Здесь появятся задания отправки и сведения о повторных попытках.'
          }
        />
      ) : (
        rows.map((row) => (
          <div className="az-panel" key={String(row.invoiceId ?? row.id)}>
            <span className="az-eyebrow">{status[String(row.status)] ?? String(row.status)}</span>
            <h3>{String(row.title ?? row.invoiceId ?? 'Возврат оплаты')}</h3>
            <p>
              {payments
                ? `${String(row.name ?? row.userId)} · ${String(row.amount)} Stars`
                : `Участник ${String(row.userId ?? '-')} · попыток: ${String(row.attempts ?? 0)}`}
            </p>
            <small>{new Date(String(row.createdAt)).toLocaleString('ru', { timeZone: s!.config.timezone })}</small>
            {row.lastError && <p role="alert">{String(row.lastError)}</p>}
            {payments && row.refund && (
              <p>Возврат: {status[String((row.refund as Data).status)] ?? String((row.refund as Data).status)}</p>
            )}
            {payments && row.status === 'paid' && (
              <Button
                tone="soft"
                disabled={busy}
                onClick={async () => {
                  if (
                    !confirm(
                      `Вернуть ${String(row.amount)} Stars за «${String(row.title)}»? Доступ к продукту будет отозван.`,
                    )
                  )
                    return
                  if (
                    await act('admin.refund', { invoiceId: row.invoiceId, reason: 'Возврат по обращению участника' })
                  ) {
                    message('Запрос возврата обработан. Проверьте его статус.')
                    await load()
                  }
                }}
              >
                Вернуть Stars
              </Button>
            )}
            {!payments && ['dead', 'pending'].includes(String(row.status)) && (
              <Button
                tone="soft"
                disabled={busy}
                onClick={async () => {
                  if (await act('queue.retry', { jobId: row.id, kind })) await load()
                }}
              >
                Повторить обработку
              </Button>
            )}
          </div>
        ))
      )}
      <p className="az-admin-hint">
        {payments
          ? 'Последние 100 операций. Повторный запрос возврата использует ту же операцию.'
          : 'Последние 200 заданий. Учитываются отписка, тихие часы и ограничение повторных попыток.'}
      </p>
    </>
  )
}
