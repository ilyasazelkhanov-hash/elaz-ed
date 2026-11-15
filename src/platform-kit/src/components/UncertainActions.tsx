import { useState } from 'react'
import { usePlatform } from '../platform/store.ts'
import { Button } from './ui.tsx'
import type { UncertainAction } from '../platform/uncertain-action.ts'
const labels: Record<string, string> = {
  'order.create': 'Создание заказа', 'gift.send': 'Отправка подарка', 'post.create': 'Публикация',
  'comment.create': 'Комментарий', 'event.book': 'Запись на мероприятие', 'homework.submit': 'Отправка работы',
}
export default function UncertainActions() {
  const { uncertain, checkingOutcome, refreshOutcomes, resolveOutcome } = usePlatform()
  const [selected, setSelected] = useState<UncertainAction | null>(null)
  const [outcome, setOutcome] = useState<'done' | 'not-done' | ''>('')
  const [confirmed, setConfirmed] = useState(false)
  if (!Object.keys(uncertain).length) return null
  const current = selected && uncertain[selected.action] === selected
  return <section className="az-card az-uncertain" role="status" aria-live="polite">
    <strong>{checkingOutcome ? 'Проверяем результат…' : 'Результат действия не подтверждён'}</strong>
    <p>Запрос мог выполниться. Проверьте историю операций или уточните результат у организатора. Отсутствие записи само по себе не подтверждает отмену.</p>
    <p>Автоматического повтора нет. Заказ или подарок можно повторить только с прежним номером запроса после сверки данных.</p>
    <Button tone="soft" disabled={checkingOutcome} onClick={() => void refreshOutcomes()}>Обновить данные</Button>
    {Object.values(uncertain).map((entry) => <div key={entry.action}>
      <p>{labels[entry.action] ?? `Действие: ${entry.action}`}</p>
      <Button tone="ghost" disabled={checkingOutcome} onClick={() => {setSelected(entry);setOutcome('');setConfirmed(false)}}>Уточнить результат вручную</Button>
    </div>)}
    {current && <fieldset>
      <legend>Ручная проверка: {labels[selected.action] ?? selected.action}</legend>
      <p>Это ваша отметка, не подтверждение сервера. Для ответа «не выполнено» уточните у организатора, что исходный запрос больше не выполняется.</p>
      <label><input type="radio" name="manual-outcome" checked={outcome === 'done'} onChange={() => setOutcome('done')} /> Действие выполнено</label>
      <label><input type="radio" name="manual-outcome" checked={outcome === 'not-done'} onChange={() => setOutcome('not-done')} /> Организатор подтвердил: действие не выполнено и запрос завершён</label>
      <label><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> Я проверил именно этот запрос; одного отсутствия записи в истории недостаточно</label>
      <Button disabled={!outcome || !confirmed || checkingOutcome} onClick={() => {
        if (outcome && confirmed) resolveOutcome(selected, outcome)
        setSelected(null)
      }}>Снять блокировку без повтора запроса</Button>
      <Button tone="ghost" onClick={() => setSelected(null)}>Отмена</Button>
    </fieldset>}
  </section>
}
