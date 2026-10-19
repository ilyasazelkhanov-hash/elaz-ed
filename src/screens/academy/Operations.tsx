import { useAcademyTranslation } from '../../lib/academy-i18n'
import { useState, type ChangeEvent } from 'react'
import { Cta, Tap } from '../../ui'
import { FetchState, Pager, panel, text, useAcademy, useAction } from './shared'

export function ImportSeed() {
 const t=useAcademyTranslation()
  const [payload, setPayload] = useState<Record<string, any> | null>(null), [fileError, setFileError] = useState(''), [report, setReport] = useState<any>(null), [applied, setApplied] = useState(false), action = useAction()
  async function choose(event: ChangeEvent<HTMLInputElement>) {
    setPayload(null); setReport(null); setFileError(''); setApplied(false)
    const file = event.target.files?.[0]; if (!file) return
    if (file.size > 4 * 1024 * 1024) { setFileError('Максимальный размер JSON — 4 МБ.'); return }
    try { const parsed = JSON.parse(await file.text()); if (!parsed || !Array.isArray(parsed.entities) || !parsed.entities.every((e: any) => e && typeof e.code === 'string' && typeof e.kind === 'string' && typeof e.data === 'object') || !Array.isArray(parsed.links) || !Array.isArray(parsed.prerequisites)) throw new Error(); setPayload({ version: parsed.version, entities: parsed.entities, links: parsed.links, prerequisites: parsed.prerequisites }) } catch { setFileError('Нужен нормализованный JSON с массивами entities, links, prerequisites. Исходный curriculum JSON сначала обработай штатным CLI нормализации.') }
  }
  async function preview() { if (!payload) return; const result = await action.run('admin_import', { ...payload, dry_run: true }, 'Проверка импорта завершена'); if (result) { setReport(result); setApplied(false) } }
  async function apply() { if (!payload || !report) return; const result = await action.run('admin_import', { ...payload, dry_run: false }, 'Импорт применён. Обнови список контента.'); if (result) { setReport(result); setApplied(true) } }
  return <details className={panel}><summary className="font-semibold text-sm">{t("Импорт нормализованного seed")}</summary><p className="mt-3 text-xs leading-relaxed text-mute">{t("Выбери JSON, проверь изменения без записи, затем примени проверенный импорт. Авторские изменения защищаются сервером. Откат миграции выполняется штатными средствами проекта.")}</p><label className="mt-4 block"><span className="academy-label">{t("Нормализованный JSON · до 4 МБ")}</span><input aria-label="Файл импорта академии" type="file" accept="application/json,.json" className="academy-field" onChange={(e) => void choose(e)}/></label>{fileError && <p className="mt-3 text-xs text-rose" role="alert">{fileError}</p>}{payload && <div className="mt-4"><p className="text-xs text-mute">Записей: {payload.entities.length}, связей: {payload.links.length}, зависимостей: {payload.prerequisites.length}</p><Tap className="academy-chip mt-4" disabled={action.busy} onClick={() => void preview()}>{t("Проверить без записи")}</Tap></div>}{report && <><pre className="mt-4 max-h-72 overflow-auto rounded-xl bg-bg p-3 text-[11px] leading-relaxed" aria-label="Отчёт импорта">{JSON.stringify(report, null, 2)}</pre>{!applied && <Cta className="mt-4" busy={action.busy} onClick={() => void apply()}>{t("Применить проверенный импорт")}</Cta>}</>}{action.feedback}</details>
}

export function Audit() {
 const t=useAcademyTranslation()
  const [open, setOpen] = useState(false), [offset, setOffset] = useState(0), [code, setCode] = useState('')
  const resource = useAcademy('admin_audit', { offset, limit: 20, code: code || undefined }, open)
  const entries: any[] = resource.data?.entries || resource.data?.events || resource.data?.audit || []
  return <details className={panel} onToggle={(e) => setOpen(e.currentTarget.open)}><summary className="font-semibold text-sm">{t("История изменений и публикаций")}</summary><label className="mt-4 block"><span className="academy-label">{t("Код записи")}</span><input className="academy-field" value={code} onChange={(e) => { setCode(e.target.value); setOffset(0) }} placeholder="Все записи"/></label><FetchState {...resource}/>{entries.map((entry, i) => <details key={entry.id || i} className="mt-4 rounded-xl border border-line p-3"><summary className="text-xs leading-relaxed"><b>{text(entry.action)}</b> · {text(entry.object_code) || 'Академия'}<span className="mt-1 block text-mute">{entry.created_at ? new Date(entry.created_at).toLocaleString('ru-RU') : ''} · сотрудник {entry.actor_id || '—'}</span></summary><pre className="mt-3 max-h-64 overflow-auto text-[10px] leading-relaxed">{JSON.stringify({ before: entry.before_json, after: entry.after_json }, null, 2)}</pre></details>)}{resource.data && !entries.length && <p className="mt-4 text-xs text-mute">{t("В истории пока нет изменений.")}</p>}{resource.data && <Pager offset={offset} count={entries.length} total={resource.data.total || entries.length} setOffset={setOffset}/>}</details>
}
