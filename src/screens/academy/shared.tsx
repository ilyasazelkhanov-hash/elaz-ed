import { courseGuide } from '../../lib/academy-guidance'
import { academyText, localizedEntity, useAcademyLocale, useAcademyTranslation, type AcademyLocale } from '../../lib/academy-i18n'
import { ArrowUpRight, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { academyRequest } from '../../lib/academy'
import type { AcademyEntity, AcademySourceLink } from '../../lib/academy-types'
import { safeAcademyUrl } from '../../lib/academy-types'
import { openLink } from '../../lib/tg'
import { Cta, Tap } from '../../ui'
import { Cover } from './Visual'
import { useReducedMotion } from 'motion/react'

export type Entity = AcademyEntity
export type Navigate = (path: string) => void
export const panel = 'academy-panel'
export const formatLabel = (value: unknown) => academyText(({ microlecture: 'Микролекция / чтение', guided_demo: 'Демонстрация с повторением', hands_on_lab: 'Лабораторная / практикум', knowledge_check: 'Квиз / диагностика', case_review: 'Кейс-разбор / ревью', live_workshop: 'Живой воркшоп', assignment: 'Домашнее задание', project_defense: 'Защита проекта', resource: 'Материал для изучения' } as Record<string,string>)[String(value)] || text(value))
export const states: Record<string, string> = { outline: 'Программа формируется', draft: 'Контент создаётся', in_review: 'На редактуре', approved: 'Готов к публикации', published: 'Доступен', archived: 'В архиве', waiting: 'Лист ожидания', submitted: 'На проверке', needs_revision: 'Нужна доработка', passed: 'Зачтено', failed: 'Не зачтено', active: 'Обучение открыто', enrolled: 'Вы зачислены', completed: 'Пройдено', draft_saved: 'Черновик сохранён' }
export const text = (value: unknown): string => Array.isArray(value) ? value.map(text).filter(Boolean).join('\n') : typeof value === 'string' || typeof value === 'number' ? String(value) : ''
export const list = (value: unknown): string[] => Array.isArray(value) ? value.map(text).filter(Boolean) : text(value).split('\n').filter(Boolean)
export const safeUrl = safeAcademyUrl
export function Status({ state }: { state?: string }) { const t=useAcademyTranslation(); return <span className={`academy-status ${state === 'published' || state === 'passed' ? 'is-ready' : ''}`}>{t(states[state || 'outline'] || state || '')}</span> }
export function Empty({ title, children }: { title: string; children?: ReactNode }) { const t=useAcademyTranslation(); return <section className="academy-empty"><span className="academy-empty-mark" aria-hidden="true">↗</span><h2 className="font-display text-[18px]">{t(title)}</h2>{children && <div className="mt-3 text-sm leading-relaxed text-mute">{children}</div>}</section> }
export function useAcademy<T = any>(action: string, payload: Record<string, unknown> = {}, enabled = true) {
  const locale=useAcademyLocale()
  const key = JSON.stringify(payload)
  const [data, setData] = useState<T | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0)
  useEffect(() => { if (!enabled) { setLoading(false); setData(null); return }; let alive = true; setLoading(true); setError(''); setData(null); academyRequest<T>(action, JSON.parse(key)).then((d) => { if (alive) setData(d) }).catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Не удалось загрузить данные') }).finally(() => { if (alive) setLoading(false) }); return () => { alive = false } }, [action, key, revision, enabled])
  const display=useMemo(()=>action.startsWith('admin_')?data:localizeResponse(data,locale),[data,locale,action])
  return { data: display as T|null, error, loading, refresh: () => setRevision((x) => x + 1) }
}
export function ProgramNotice({ preview, refresh }: { preview?: boolean; refresh: () => void }) {
  if (!preview) return null
  return <section role="status" className={panel}><h2 className="font-semibold text-sm">Программы курсов</h2><p className="mt-2 text-sm leading-relaxed text-mute">Сейчас доступна программа с подсказками. Учебные материалы и запись на курс появятся после подключения обучения.</p><Tap onClick={refresh} className="academy-chip mt-3"><RefreshCw size={15}/>Обновить</Tap></section>
}
export function FetchState({ loading, error, refresh }: { loading: boolean; error: string; refresh: () => void }) { const t=useAcademyTranslation(); return <>{loading && <div role="status" aria-label={t('Загрузка')} className="space-y-3 py-5">{[1, 2, 3].map((x) => <div key={x} className="skeleton h-24 rounded-[24px]" />)}<span className="sr-only">{t("Загружаем академию…")}</span></div>}{error && <section role="alert" className={panel}><h2 className="font-semibold">{t("Не удалось загрузить")}</h2><p className="mt-2 text-sm text-mute">{error}</p><Tap onClick={refresh} className="mt-4 flex items-center gap-2 text-violet"><RefreshCw size={16} />{t("Попробовать ещё раз")}</Tap></section>}</> }
export function useAction(refresh?: () => void) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('')
  async function run(action: string, payload: Record<string, unknown>, success = 'Сохранено') { if (busy) return; setBusy(true); setMessage(''); setError(''); try { const result = await academyRequest<any>(action, payload); setMessage(success); refresh?.(); return result } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось выполнить действие') } finally { setBusy(false) } }
  return { busy, message, error, run, fail: setError, feedback: <>{message && <p role="status" className="academy-notice">{message}</p>}{error && <p role="alert" className="academy-notice text-rose">{error}</p>}</> }
}
export function External({ url, children }: { url: unknown; children: ReactNode }) { const t=useAcademyTranslation(); const safe = safeUrl(url); return safe ? <Tap className="academy-external" onClick={() => openLink(safe)}>{children}<ArrowUpRight size={16} className="shrink-0" /></Tap> : <p className="text-xs text-mute">{t("Ссылка недоступна или ожидает проверки")}</p> }
export function Sources({ sources }: { sources: (AcademySourceLink | Entity)[] }) { const t=useAcademyTranslation(); return <div className="space-y-3">{sources.map((item: any, i) => { const source = item.source || item; const d = source.data || {}; const seconds = item.start_seconds; const url = safeAcademyUrl(d.canonical_url || d.url, Number.isFinite(seconds) && seconds > 0 ? seconds : undefined); return <section key={`${source.code}-${i}`} className="academy-source"><div className="mb-2 flex flex-wrap items-center gap-2"><span className="academy-kicker">{source.code || item.source_code}</span>{d.language && <span className="text-xs text-mute">{d.language}</span>}{d.access && <span className="text-xs text-mute">{text(d.access)}</span>}</div><External url={url}>{source.title || item.source_code || 'Источник'}</External>{(d.author || d.provider) && <p className="mt-2 text-xs text-mute">{text(d.author || d.provider)}</p>}{seconds !== undefined && <p className="mt-2 text-xs text-violet">Фрагмент {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}{item.end_seconds !== undefined && `–${Math.floor(item.end_seconds / 60)}:${String(item.end_seconds % 60).padStart(2, '0')}`}</p>}{(item.note || d.description) && <p className="mt-2 text-xs leading-relaxed text-mute">{text(item.note || d.description)}</p>}<p className="mt-2 text-[11px] text-mute">{text(d.allowed_use || d.usage_rights) || 'Внешний материал: открывается у правообладателя.'}{(d.checked_at || d.last_checked_at) ? ` Проверен: ${text(d.checked_at || d.last_checked_at).slice(0, 10)}.` : ' Доступность источника требует проверки.'}</p></section> })}</div> }
export function CourseCard({ course, go }: { course: Entity; go: Navigate }) {
  const t=useAcademyTranslation(), reduce=useReducedMotion(), d=course.data
  return <Tap onClick={() => go(`/courses/${course.code}`)} className="academy-course text-left" whileTap={reduce ? { scale: 1 } : { scale: .98 }} initial={reduce ? false : { opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: .25 }}>
    <Cover code={course.code}/><div className="academy-course-copy"><div className="mb-3 flex items-center justify-between gap-3"><span className="academy-kicker">{text(d.level) || 'Core'} <span className="text-faint">/ {course.code}</span></span><span className="academy-card-arrow" aria-hidden="true">↗</span></div><h3 className="font-display text-[19px] font-semibold leading-snug">{course.title}</h3><p className="mt-3 text-[13px] leading-relaxed text-mute">{courseGuide(course.code)?.summary || text(d.outcome || d.outcomes || d.description)}</p><div className="mt-5 flex flex-wrap items-center gap-2"><Status state={course.state}/>{(d.hours || d.duration_hours) && <span className="text-xs text-mute">~{text(d.hours || d.duration_hours)} {t('ч')}</span>}</div></div>
  </Tap>
}export function More({ count, total, onClick }: { count: number; total: number; onClick: () => void }) { const t=useAcademyTranslation(); return count < total ? <Cta className="mt-4" onClick={onClick}>{t('Показать ещё')} · {count} {t('из')} {total}</Cta> : null }
export function Pager({ offset, count, total, setOffset }: { offset: number; count: number; total: number; setOffset: (offset: number) => void }) { const t=useAcademyTranslation(); return <nav className="flex flex-wrap items-center justify-between gap-2 pt-3" aria-label={t('Страницы результатов')}><Tap className="academy-chip" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 20))}>{t("← Назад")}</Tap><span className="text-xs text-mute">{count ? offset + 1 : 0}–{offset + count} {t('из')} {total}</span><Tap className="academy-chip" disabled={offset + count >= total || count === 0} onClick={() => setOffset(offset + 20)}>{t("Далее →")}</Tap></nav> }




function localizeResponse(value:unknown,locale:AcademyLocale):unknown {
 if(locale==='ru'||value===null||typeof value!=='object')return value
 if(Array.isArray(value))return value.map(item=>localizeResponse(item,locale))
 const object=value as Record<string,any>
 if(typeof object.code==='string'&&typeof object.title==='string'&&typeof object.state==='string'&&object.data&&typeof object.data==='object'&&['direction','course','module','lesson','source','skill','assessment','rubric'].includes(object.kind))return localizedEntity(object as Entity,locale)
 return Object.fromEntries(Object.entries(object).map(([key,item])=>[key,localizeResponse(item,locale)]))
}
