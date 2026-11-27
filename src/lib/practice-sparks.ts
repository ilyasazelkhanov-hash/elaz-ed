/**
 * «Искры»: local practice points for formative exercises.
 * They live in this browser only and are never XP: levels, streaks, rating, access and certificates
 * come from the server alone. A spark total is not evidence of a skill.
 */
export const SPARK_RULES = {first:10, retry:5, comboFrom:3, comboBonus:5, finish:20} as const
/**
 * One switch for the whole layer: local points, their counters and the celebration effects.
 * Build with VITE_PRACTICE_SPARKS=off to ship the exercises without it; nothing else depends on sparks.
 */
let enabled = (import.meta as ImportMeta & {env?:Record<string,string|undefined>}).env?.VITE_PRACTICE_SPARKS !== 'off'
export const sparksEnabled = () => enabled
/** Test hook. The application reads the build setting only. */
export function configureSparks(options:{enabled:boolean}) {enabled = options.enabled}
export type Sparks = {total:number; best:number}
export type SparkScore = {gained:number; bonus:number; combo:number; total:number; repeat:boolean}
type Stored = {version:1; total:number; best:number; awards:Record<string,number>; misses:string[]}
type SparkStorage = Pick<Storage,'getItem'|'setItem'>

const MAX_AWARDS = 400, MAX_MISSES = 120, MAX_TOTAL = 1_000_000, MAX_BYTES = 120_000
const memory = new Map<string,Stored>(), combos = new Map<string,number>()
const listeners = new Map<string,Set<() => void>>()
const empty = (): Stored => ({version:1,total:0,best:0,awards:{},misses:[]})
const storeKey = (scope:string) => `og:practice-sparks:v1:${scope}`
const count = (value:unknown,max:number) => typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&value<=max ? value : null

function hash(text:string) {
 let value = 0x811c9dc5
 for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 0x01000193)
 return (value >>> 0).toString(36)
}
/** Idempotency key of one exercise inside one exact content revision. A changed task can be earned again. */
export function sparkKey(id:string, revision:unknown, part:number|'finish') {
 return `${id.slice(0,80)}#${hash(JSON.stringify(revision) ?? '')}#${part}`
}
function parse(raw:string|null|undefined):Stored|null {
 if (!raw || raw.length > MAX_BYTES) return null
 let value:unknown
 try {value = JSON.parse(raw)} catch {return null}
 if (!value || typeof value !== 'object' || Array.isArray(value)) return null
 const row = value as Record<string,unknown>, total = count(row.total,MAX_TOTAL), best = count(row.best,1000)
 if (row.version !== 1 || total === null || best === null || !row.awards || typeof row.awards !== 'object' || Array.isArray(row.awards) || !Array.isArray(row.misses)) return null
 const awards:Record<string,number> = {}
 for (const [key,amount] of Object.entries(row.awards as Record<string,unknown>).slice(-MAX_AWARDS)) {
  const safe = count(amount,1000)
  if (key.length <= 160 && safe !== null) awards[key] = safe
 }
 return {version:1,total,best,awards,misses:row.misses.filter((key):key is string => typeof key==='string'&&key.length<=160).slice(-MAX_MISSES)}
}
function storageOf(storage?:SparkStorage):SparkStorage|undefined {
 try {return storage ?? globalThis.localStorage} catch {return undefined}
}
function load(scope:string, storage?:SparkStorage):Stored {
 let durable:Stored|null = null
 try {durable = parse(storageOf(storage)?.getItem(storeKey(scope)))} catch {/* denied storage: memory only */}
 const session = memory.get(scope)
 // A blocked write leaves newer progress in memory; never fall back to an older durable total.
 return structuredClone(session && (!durable || session.total >= durable.total) ? session : durable ?? empty())
}
function save(scope:string, state:Stored, storage?:SparkStorage):boolean {
 const keys = Object.keys(state.awards)
 for (const key of keys.slice(0,Math.max(0,keys.length-MAX_AWARDS))) delete state.awards[key]
 state.misses = state.misses.slice(-MAX_MISSES)
 memory.set(scope,structuredClone(state))
 let durable = false
 try {const target = storageOf(storage); if (target) {target.setItem(storeKey(scope),JSON.stringify(state)); durable = true}} catch {/* quota or private mode */}
 for (const listener of listeners.get(scope) ?? []) listener()
 return durable
}
export function readSparks(scope:string, storage?:SparkStorage):Sparks {
 const {total,best} = load(scope,storage)
 return {total,best}
}
/** Current run of first-try correct answers. Session memory only: it never survives a reload. */
export const sparkCombo = (scope:string) => combos.get(scope) ?? 0
/**
 * Call once per checked answer. A wrong check before the first success halves that task's award.
 * A task that was already earned gives nothing again, so repeating a lesson cannot farm points.
 */
export function scoreAnswer(scope:string, key:string, correct:boolean, storage?:SparkStorage):SparkScore {
 if (!enabled) return {gained:0,bonus:0,combo:0,total:0,repeat:false}
 const state = load(scope,storage), earned = key in state.awards
 if (!correct) {
  combos.set(scope,0)
  if (!earned && !state.misses.includes(key)) {state.misses.push(key); save(scope,state,storage)}
  return {gained:0,bonus:0,combo:0,total:state.total,repeat:earned}
 }
 // A repeat neither pays nor extends the run, so it cannot be used to reach the bonus.
 if (earned) return {gained:0,bonus:0,combo:sparkCombo(scope),total:state.total,repeat:true}
 const missed = state.misses.includes(key), combo = missed ? 0 : sparkCombo(scope) + 1
 combos.set(scope,combo)
 const bonus = !missed && combo >= SPARK_RULES.comboFrom ? SPARK_RULES.comboBonus : 0
 const gained = (missed ? SPARK_RULES.retry : SPARK_RULES.first) + bonus
 state.awards[key] = gained
 state.total = Math.min(MAX_TOTAL,state.total + gained)
 state.best = Math.max(state.best,combo)
 state.misses = state.misses.filter(item => item !== key)
 save(scope,state,storage)
 return {gained,bonus,combo,total:state.total,repeat:false}
}
/** One bonus for answering every task of an exercise set. */
export function scoreFinish(scope:string, key:string, storage?:SparkStorage):{gained:number; total:number} {
 if (!enabled) return {gained:0,total:0}
 const state = load(scope,storage)
 if (key in state.awards) return {gained:0,total:state.total}
 state.awards[key] = SPARK_RULES.finish
 state.total = Math.min(MAX_TOTAL,state.total + SPARK_RULES.finish)
 save(scope,state,storage)
 return {gained:SPARK_RULES.finish,total:state.total}
}
export function subscribeSparks(scope:string, listener:() => void) {
 const set = listeners.get(scope) ?? new Set<() => void>()
 listeners.set(scope,set); set.add(listener)
 const other = (event:StorageEvent) => {if (event.key === storeKey(scope)) listener()}
 globalThis.addEventListener?.('storage',other as EventListener)
 return () => {set.delete(listener); if (!set.size) listeners.delete(scope); globalThis.removeEventListener?.('storage',other as EventListener)}
}
export const sparksWord = (n:number) => {
 const a = Math.abs(n) % 100, b = a % 10
 return a > 10 && a < 20 ? 'искр' : b === 1 ? 'искра' : b > 1 && b < 5 ? 'искры' : 'искр'
}
