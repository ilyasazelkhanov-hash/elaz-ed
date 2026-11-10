import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { transformWithOxc } from 'vite'

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
async function compile(path, imports = {}) {
  const file = new URL(path, import.meta.url)
  let { code } = await transformWithOxc(await readFile(file, 'utf8'), file.pathname, { lang: path.endsWith('.tsx') ? 'tsx' : 'ts' })
  code = code.replaceAll('import.meta.env', '({DEV:false})').replace(/from (["'])([^"']+)\1/g, (_, quote, name) => `from ${JSON.stringify(imports[name] ?? import.meta.resolve(name))}`)
  return moduleUrl(code)
}
const apiUrl = moduleUrl('export const api = {}; export class ApiError extends Error { constructor(code,status) { super(code);this.code=code;this.status=status } } export const isDemo=false')
const { api, ApiError } = await import(apiUrl)
const storeUrl = await compile('../src/store.ts', {
  './lib/api': apiUrl,
  './lib/game': moduleUrl('export const achievement=()=>null'),
  './lib/journey': moduleUrl('export const projectProgress=me=>me'),
  './lib/experience': moduleUrl('export const demoPlatformXp=()=>0'),
})
const { useStore } = await import(storeUrl)
const { RefreshNotice } = await import(await compile('../src/RefreshNotice.tsx', {
  './store': moduleUrl(`import { useStore as store } from ${JSON.stringify(storeUrl)}; export const useStore=selector=>selector(store.getState());useStore.getState=store.getState`),
}))
const deferred = () => { let resolve, reject; const promise = new Promise((yes,no)=>{resolve=yes;reject=no}); return {promise,resolve,reject} }
const initial = () => ({phase:'ok',errorCode:null,refreshErrorCode:null,refreshing:false,me:{id:1,xp:100},feed:[{id:2,completed:true}],courses:[{id:3,access:true}],stack:[{type:'lesson',id:2}],reward:{lessonId:2},tab:'courses'})
const success = state => ({status:'ok',...state,channel:{},bot:{}})

test('a confirmed result survives background read failure; retry only reads boot', async () => {
  const state=initial();useStore.setState(state)
  let reads=0
  api.boot=async()=>{reads++;throw new ApiError('timeout',0)}
  assert.equal(await useStore.getState().boot(),'error')
  for (const key of ['phase','me','feed','courses','stack','reward','tab']) assert.equal(useStore.getState()[key],state[key])
  assert.equal(useStore.getState().refreshErrorCode,'timeout')
  assert.equal(useStore.getState().errorCode,null)
  assert.equal(reads,1)
  const notice=RefreshNotice(), retry=notice.props.children[1]
  assert.match(retry.props.children,/только обновление/)
  const gate=deferred();api.boot=async()=>{reads++;return gate.promise}
  retry.props.onClick()
  assert.equal(useStore.getState().refreshing,true)
  assert.equal(RefreshNotice().props.children[1].props.disabled,true)
  assert.equal(useStore.getState().phase,'ok')
  gate.resolve(success(state));await new Promise(setImmediate)
  assert.equal(reads,2)
  assert.equal(useStore.getState().refreshErrorCode,null)
  assert.equal(useStore.getState().refreshing,false)
  assert.equal(RefreshNotice(),null)
  assert.equal(useStore.getState().stack,state.stack)
  assert.equal(useStore.getState().reward,state.reward)
})
test('initial boot error still shows fatal error; confirmed access denial removes protected UI', async () => {
  useStore.setState({...initial(),phase:'loading',me:null})
  api.boot=async()=>{throw new ApiError('network',0)}
  await useStore.getState().boot();assert.equal(useStore.getState().phase,'error');assert.equal(useStore.getState().errorCode,'network')
  for (const [code,status,phase] of [['locked',403,'locked'],['bad_auth',401,'error'],['forbidden',403,'error']]) {
    useStore.setState(initial());api.boot=async()=>{throw new ApiError(code,status)}
    await useStore.getState().boot();assert.equal(useStore.getState().phase,phase);assert.deepEqual(useStore.getState().stack,[]);assert.equal(useStore.getState().reward,null);assert.equal(useStore.getState().refreshErrorCode,null)
  }
  useStore.setState(initial());api.boot=async()=>({status:'locked',channel:{},bot:{}})
  await useStore.getState().boot();assert.equal(useStore.getState().phase,'locked');assert.deepEqual(useStore.getState().stack,[])
})
test('late boot responses cannot replace newer data or undo an access guard', async () => {
  const state=initial();useStore.setState(state)
  const old=deferred();api.boot=()=>old.promise
  const first=useStore.getState().boot()
  api.boot=async()=>success({...state,me:{id:1,xp:200}})
  await useStore.getState().boot()
  old.resolve(success(state));await first
  assert.equal(useStore.getState().me.xp,200)
  const pending=deferred();api.boot=()=>pending.promise
  const last=useStore.getState().boot();useStore.getState().guard(new ApiError('locked',403))
  pending.resolve(success(state));await last
  assert.equal(useStore.getState().phase,'locked');assert.deepEqual(useStore.getState().stack,[])
})
