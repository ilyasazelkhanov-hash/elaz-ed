import { editorialReviewStatus, normalizeEditorial } from './lib/editorial'

const displayDate = (date: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))

/** Reader-facing provenance; no guessed dates or inferred checks for legacy articles. */
export function EditorialMetadata({ metadata, section = 'summary', today }: { metadata?: unknown; section?: 'summary' | 'sources'; today?: string }) {
  let details
  try { details = normalizeEditorial(metadata, { today }) } catch { return null }
  if (!details) return null
  if (section === 'sources') {
    if (!details.sources?.length && !details.correction_note) return null
    return <section aria-label="Источники и исправления" className="mt-7 space-y-4 rounded-2xl border border-line bg-card p-4 text-sm leading-relaxed" style={{ overflowWrap: 'anywhere' }}>
      {details.sources?.length ? <div><h2 className="font-semibold">Первоисточники</h2><ul className="mt-2 space-y-1">{details.sources.map((source, index) => <li key={`${source.url}-${index}`}><a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-block min-h-11 py-2.5 text-violet underline underline-offset-4">{source.title}</a></li>)}</ul></div> : null}
      {details.correction_note && <div><h2 className="font-semibold">Что исправлено</h2><p className="mt-1 whitespace-pre-line text-mute">{details.correction_note}</p></div>}
    </section>
  }
  const due = editorialReviewStatus(details, today) === 'due'
  return <section aria-label="О материале" className="mt-5 space-y-2 rounded-2xl border border-line bg-card p-4 text-sm leading-relaxed" style={{ overflowWrap: 'anywhere' }}>
    <p className="font-semibold">{details.kind === 'update' ? 'Обновление инструмента' : 'Практический разбор'}</p>
    {details.audience && <p className="text-mute"><b className="font-medium text-ink">Для кого: </b>{details.audience}</p>}
    {details.outcome && <p className="text-mute"><b className="font-medium text-ink">Результат: </b>{details.outcome}</p>}
    {details.access_note && <p className="whitespace-pre-line text-mute"><b className="font-medium text-ink">Что понадобится: </b>{details.access_note}</p>}
    {details.checked_on && <p className="text-mute">Проверено: <time dateTime={details.checked_on}>{displayDate(details.checked_on)}</time>{details.reviewer ? ` · ${details.reviewer}` : ''}</p>}
    {details.review_due && <p className="text-mute">Следующая проверка: <time dateTime={details.review_due}>{displayDate(details.review_due)}</time></p>}
    {due && <p className="text-mute">Условия могли измениться. Перед повторением сверь их с первоисточником.</p>}
  </section>
}
