import { useState } from 'react'
import { useAcademyLocale, useAcademyTranslation, localizedEntity } from '../../lib/academy-i18n'
import { Tap } from '../../ui'
import { Empty, FetchState, panel, useAcademy, useAction } from './shared'
export function Competencies() {
 const t = useAcademyTranslation(), locale = useAcademyLocale(), [q,setQ] = useState('')
 const catalog = useAcademy('skills', {q}), progress = useAcademy('skill_progress')
 const skills: any[] = (catalog.data?.skills || []).filter((skill:any)=>`${skill.code} ${localizedEntity(skill,locale).title}`.toLocaleLowerCase().includes(q.toLocaleLowerCase()))
 return <><h1 className="font-display text-[27px] font-semibold">{t('Мои компетенции')}</h1><label className="block"><span className="academy-label">{t('Поиск навыков')}</span><input className="academy-field" value={q} onChange={e=>setQ(e.target.value)}/></label><FetchState {...catalog}/><FetchState {...progress}/>{skills.map(raw=>{const skill=localizedEntity(raw,locale), mastery=progress.data?.skills?.find((p:any)=>p.code===skill.code); return <section className={panel} key={skill.code}><p className="academy-kicker">{skill.code}</p><h2 className="mt-2 font-semibold">{skill.title}</h2><p className="mt-3 text-sm text-mute">{mastery?.verified ? t('Подтверждено') : t('Навык пока не подтверждён')}</p>{mastery && <><progress className="mt-3 w-full accent-violet" max={100} value={mastery.percent || 0} aria-label={skill.title}/><p className="mt-2 text-xs text-mute">{mastery.completed} / {mastery.required} · {mastery.percent}%</p></>}</section>})}{catalog.data && !skills.length && <Empty title={t('Навыков нет')}/>}</>
}
export function SkillMapping({targetCode}:{targetCode:string}) {
 const t=useAcademyTranslation(), resource=useAcademy('skills'), [codes,setCodes]=useState<string|null>(null), action=useAction(resource.refresh)
 const current: string=(resource.data?.links||[]).filter((link:any)=>link.target_code===targetCode).map((link:any)=>link.skill_code).join(', ')
 return <details className="rounded-xl border border-line p-3"><summary className="text-sm font-semibold">{t('Связать компетенции')}</summary><FetchState {...resource}/><label className="mt-3 block"><span className="academy-label">{t('Коды навыков через запятую')}</span><input className="academy-field" value={codes ?? current} onChange={e=>setCodes(e.target.value)}/></label><p className="mt-2 text-xs text-mute">{(resource.data?.skills||[]).map((s:any)=>s.code).join(' · ')}</p><Tap className="academy-chip mt-3" disabled={action.busy||!resource.data} onClick={()=>void action.run('skill_map',{target_code:targetCode,skill_codes:[...new Set((codes ?? current).split(',').map(s=>s.trim()).filter(Boolean))]},t('Связи сохранены'))}>{t('Сохранить связи')}</Tap>{action.feedback}</details>
}

