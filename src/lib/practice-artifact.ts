/** Local evidence is a learner's self-report, never a graded or verified skill. */
export const PRACTICE_LIMIT = 12000
export type PracticeArtifact = {result: string; evidence: string; revision: string; checks: boolean[]}
export const emptyArtifact = (count: number): PracticeArtifact => ({result:'', evidence:'', revision:'', checks:Array.from({length:count},()=>false)})
export function artifactKey(scope: string | number | undefined, course: string, lesson: string) {
 return scope === undefined ? null : `og-artifact-v1:${[String(scope),course,lesson].map(encodeURIComponent).join(':')}`
}
export function artifactStatus(value: PracticeArtifact): 'empty' | 'draft' | 'self_checked' {
 if (!value.result.trim() && !value.evidence.trim() && !value.revision.trim()) return 'empty'
 return value.result.trim() && value.evidence.trim() && value.revision.trim() && value.checks.length > 0 && value.checks.every(Boolean) ? 'self_checked' : 'draft'
}
export function readArtifact(key: string | null, count: number, rubric: string, storage?: Pick<Storage,'getItem'>): PracticeArtifact {
 if (!key) return emptyArtifact(count)
 try {
  const raw = JSON.parse((storage ?? localStorage).getItem(key) || 'null')
  if (!raw || raw.version !== 1 || typeof raw.value !== 'object' || !raw.value) return emptyArtifact(count)
  const value = raw.value
  const text = (field:string) => typeof value[field] === 'string' ? value[field].slice(0,PRACTICE_LIMIT) : ''
  return {result:text('result'),evidence:text('evidence'),revision:text('revision'),checks:Array.from({length:count},(_,i)=>raw.rubric===rubric && value.checks?.[i]===true)}
 } catch {return emptyArtifact(count)}
}
export function saveArtifact(key: string | null, value: PracticeArtifact, rubric: string, storage?: Pick<Storage,'setItem'>): boolean {
 if (!key) return false
 try {(storage ?? localStorage).setItem(key,JSON.stringify({version:1,rubric,value}));return true} catch {return false}
}
export function artifactFeedback(value: PracticeArtifact, criteria: readonly string[]): string[] {
 return [
  ...(!value.result.trim()?['Добавь результат: текст, план или описание созданной работы.']:[]),
  ...(!value.evidence.trim()?['Укажи, как проверил результат: источник, тест или сравнение с условием.']:[]),
  ...(!value.revision.trim()?['Запиши, что исправил после проверки. Если ошибок не нашёл, объясни, что именно проверил.']:[]),
  ...criteria.filter((_,i)=>!value.checks[i]).map(text=>`Пока не отмечено: ${text}`),
 ]
}
export function exportArtifact(title: string, task: string, value: PracticeArtifact, criteria: readonly string[]) {
 return `${title}\n\nЗадание\n${task}\n\nМой результат\n${value.result}\n\nКак проверил\n${value.evidence}\n\nЧто исправил\n${value.revision}\n\nСамопроверка\n${criteria.map((text,i)=>`${value.checks[i]?'[x]':'[ ]'} ${text}`).join('\n')}\n\nСтатус: ${artifactStatus(value)==='self_checked'?'самопроверка выполнена':'черновик'}. Это не оценка преподавателя и не подтверждение навыка.\n`
}

export function removeArtifact(key: string | null, storage?: Pick<Storage,'removeItem'>): boolean {
 if (!key) return true
 try {(storage ?? localStorage).removeItem(key);return true} catch {return false}
}

export const ARTIFACT_RECOVERY_LIMIT = 12
const RECOVERY_CHECK_LIMIT = 64
export type ArtifactSession = {value: PracticeArtifact; dirty: boolean}
/** Bounded JS-memory cache only. No local/sessionStorage, network or hidden autosave. */
export function createArtifactRecovery() {
 const entries = new Map<string,{rubric:string;session:ArtifactSession}>()
 const copy = (value:PracticeArtifact,count=value.checks.length):PracticeArtifact => ({
  result:value.result.slice(0,PRACTICE_LIMIT),evidence:value.evidence.slice(0,PRACTICE_LIMIT),revision:value.revision.slice(0,PRACTICE_LIMIT),
  checks:Array.from({length:Math.min(count,RECOVERY_CHECK_LIMIT)},(_,i)=>value.checks[i]===true),
 })
 return {
  put(key:string,rubric:string,session:ArtifactSession) {
   if(key.length>1024 || rubric.length>8192)return
   entries.delete(key)
   entries.set(key,{rubric,session:{value:copy(session.value),dirty:session.dirty}})
   while(entries.size>ARTIFACT_RECOVERY_LIMIT)entries.delete(entries.keys().next().value!)
  },
  get(key:string,rubric:string,count:number):ArtifactSession|null {
   const entry=entries.get(key)
   if(!entry)return null
   entries.delete(key);entries.set(key,entry)
   const value=copy(entry.session.value,count),changed=entry.rubric!==rubric
   if(changed)value.checks=value.checks.map(()=>false)
   return {value,dirty:entry.session.dirty || changed}
  },
  remove(key:string){entries.delete(key)},
 }
}
export const artifactRecovery = createArtifactRecovery()
export function artifactRecoveryKey(scope:string|number|undefined,course:string,lesson:string) {
 return JSON.stringify([scope===undefined?'guest':'account',scope??null,course,lesson])
}
export function readArtifactSession(recoveryKey:string,key:string|null,count:number,rubric:string):ArtifactSession {
 return artifactRecovery.get(recoveryKey,rubric,count) ?? {value:readArtifact(key,count,rubric),dirty:false}
}
