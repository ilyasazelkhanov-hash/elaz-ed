import { Bell, Target } from 'lucide-react'
import { useEffect, useId, useState, useSyncExternalStore } from 'react'
import { api, isDemo } from '../../lib/api'
import { createLearningSettings, learningSettingsChanged } from '../../lib/profile-learning'
import { inTelegram, requestWriteAccess } from '../../lib/tg'
import { Tap } from '../../ui'
import { useStore } from '../../store'

const DAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']

export function LearningGoalCard({ onOpenLesson }: { onOpenLesson: (id: number) => void }) {
  const [settings] = useState(() => createLearningSettings({
    load: api.learningGoal, save: api.saveLearningGoal, requestPermission: requestWriteAccess,
    onError: error => useStore.getState().guard(error),
  }))
  const state = useSyncExternalStore(settings.subscribe, settings.getSnapshot, settings.getSnapshot)
  const { saved, draft, busy, error, notice, writePending, needsReconcile, saveUncertain } = state
  const blocked = !!writePending || !!needsReconcile || error === 'save'
  const id = useId()
  const [deviceTimezone] = useState(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' }
  })
  const dirty = learningSettingsChanged(saved, draft)
  const readOnly = isDemo || !inTelegram
  useEffect(() => { void settings.load(); return settings.cancel }, [settings])

  return <section className="mx-5 mt-3 rounded-[24px] border border-line bg-card/80 p-4" aria-labelledby={`${id}-title`} aria-busy={!!busy}>
    <div className="flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-violet/10 text-violet"><Target size={19} aria-hidden="true" /></span>
      <div className="min-w-0 flex-1"><h3 id={`${id}-title`} className="text-[15px] font-semibold">Цель недели</h3><p className="mt-0.5 text-xs leading-relaxed text-mute">Уроки OG и напоминания в Telegram</p></div>
    </div>
    {!saved && busy && <p role="status" className="mt-3 text-sm text-mute">Загрузка настроек…</p>}
    {error && <div role="alert" className="mt-3 rounded-xl border border-line bg-card2 p-3">
      <p className="text-sm leading-relaxed">{error === 'permission' ? 'Не удалось получить ответ Telegram. Изменения не отправлены. Попробуй сохранить ещё раз.' : writePending ? 'Ответ сервера задерживается. Запрос ещё выполняется: пока нельзя отменить, проверить или повторить запись. Дождись ответа, не закрывая настройки.' : error === 'load' ? 'Не удалось загрузить настройки. Проверь соединение и попробуй снова.' : 'Не удалось подтвердить сохранение. Сначала проверь настройки; отмена и новая запись пока недоступны.'}</p>
      {dirty && !writePending && error !== 'permission' && <p className="mt-2 text-xs text-mute">При проверке черновик будет заменён настройками с сервера.</p>}
      {error !== 'permission' && <Tap disabled={!!busy || !!writePending} onClick={() => void settings.load()} className="mt-2 min-h-11 text-sm font-semibold text-violet disabled:opacity-50">{writePending ? 'Ожидаем ответ сервера' : needsReconcile || error === 'save' ? 'Проверить сохранение' : 'Повторить загрузку'}</Tap>}
    </div>}
    {saved && draft && <form onSubmit={event => { event.preventDefault(); if (!readOnly) void settings.save() }}>
      {isDemo ? <><p className="mt-4 text-sm font-semibold">Пример недельной цели</p><p className="mt-1 text-xs leading-relaxed text-mute">Это демонстрационные настройки, а не статистика пройденных тобой уроков.</p></> : <>
        <p className="mt-4 text-sm font-semibold">{saved.completed} из {saved.goal} уроков на этой неделе</p>
        <p className="mt-1 text-xs text-mute">По последней загрузке. После занятия обнови прогресс.</p>
        <Tap disabled={!!busy || dirty || blocked} onClick={() => void settings.load(true)} className="mt-1 min-h-11 text-left text-sm font-semibold text-violet disabled:opacity-50">{busy === 'loading' ? 'Обновление…' : 'Обновить прогресс'}</Tap>
        {dirty && !blocked && <p className="text-xs leading-relaxed text-mute">Чтобы обновить прогресс, сначала сохрани или отмени изменения настроек.</p>}
      </>}
      <p className="mt-1 text-xs leading-relaxed text-mute">Учитываются завершённые уроки OG-курсов и ленты. Прогресс отдельной Академии сюда не входит.</p>
      <p className="mt-1 text-xs leading-relaxed text-mute">Напоминания {saved.enabled ? 'включены' : 'выключены'}. Не чаще одного раза в неделю.</p>
      {saved.nextLesson && <Tap onClick={() => onOpenLesson(saved.nextLesson!.id)} className="mt-3 min-h-11 w-full rounded-xl border border-line bg-card2 px-3 py-2 text-left text-sm font-semibold">Продолжить: {saved.nextLesson.title}</Tap>}
      {saveUncertain && !needsReconcile && !writePending && <p role="status" className="mt-3 text-xs leading-relaxed text-mute">Данные показаны на момент проверки. Предыдущая запись могла дойти до сервера позже; если настройки изменятся, проверь их ещё раз.</p>}
      <fieldset disabled={!!busy || readOnly || blocked} className="mt-4 min-w-0 disabled:opacity-60">
        <legend className="sr-only">Настройки недельной цели</legend>
        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-medium">
          Напоминать о занятиях
          <input type="checkbox" checked={draft.enabled} onChange={event => settings.edit({ enabled: event.target.checked })} className="h-5 w-5 shrink-0 accent-violet" />
        </label>
        <div className="mt-3 grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
          <label className="min-[400px]:col-span-2 text-xs font-medium text-mute">Уроков в неделю<select value={draft.goal} onChange={event => settings.edit({ goal: Number(event.target.value) })} className="mt-1 min-h-11 w-full rounded-xl border border-line bg-card2 px-3 text-sm text-ink">{[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
          <label className="min-w-0 text-xs font-medium text-mute">День<select value={draft.day} onChange={event => settings.edit({ day: Number(event.target.value) })} className="mt-1 min-h-11 w-full rounded-xl border border-line bg-card2 px-2 text-sm text-ink">{DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
          <label className="min-w-0 text-xs font-medium text-mute">Время<select value={draft.hour} onChange={event => settings.edit({ hour: Number(event.target.value) })} className="mt-1 min-h-11 w-full rounded-xl border border-line bg-card2 px-2 text-sm text-ink">{Array.from({ length: 14 }, (_, index) => index + 8).map(hour => <option key={hour} value={hour}>{String(hour).padStart(2, '0')}:00</option>)}</select></label>
        </div>
        <p className="mt-3 break-words text-xs leading-relaxed text-mute">Часовой пояс: {draft.timezone}. Время указано в этом поясе.</p>
        {deviceTimezone !== draft.timezone && <Tap onClick={() => settings.edit({ timezone: deviceTimezone })} className="mt-1 min-h-11 text-left text-xs font-semibold text-violet">Использовать пояс устройства: {deviceTimezone}</Tap>}
      </fieldset>
      {readOnly ? <p className="mt-3 text-xs leading-relaxed text-mute">Это просмотр настроек. Менять цель и включать напоминания можно в Telegram.</p> : <>
        {dirty && <p className="mt-3 text-xs text-mute">Есть несохранённые изменения.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Tap type="submit" disabled={!!busy || blocked || !dirty || (!!error && error !== 'permission')} className="min-h-11 flex-1 rounded-xl bg-violet px-4 text-sm font-semibold text-on-violet disabled:opacity-50">{busy === 'saving' ? 'Сохранение…' : 'Сохранить'}</Tap>
          {dirty && <Tap disabled={!!busy || blocked} onClick={settings.reset} className="min-h-11 rounded-xl border border-line px-4 text-sm font-semibold disabled:opacity-50">Отменить</Tap>}
        </div>
      </>}
      <p role="status" className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-mute"><Bell size={14} className="mt-0.5 shrink-0" aria-hidden="true" />{notice || (busy === 'loading' ? 'Проверяем настройки…' : 'Отключить напоминания можно здесь в любой момент.')}</p>
    </form>}
  </section>
}
