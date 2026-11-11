import test from 'node:test'
import assert from 'node:assert/strict'
import { setImmediate } from 'node:timers/promises'
import { telegramRequest, withDeadline, TELEGRAM_TIMEOUT_MS, CHECKOUT_TIMEOUT_MS } from '../supabase/functions/api/telegram.ts'
const never = () => new Promise(() => {})

for (const phase of ['headers','body']) test(`Telegram deadline bounds stalled ${phase}, aborts and does not retry`, async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let signal, calls = 0
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    signal = init.signal; calls++
    return phase === 'headers' ? never() : { ok: true, json: never }
  })
  const pending = telegramRequest('test', 'refundStarPayment', {})
  await setImmediate()
  t.mock.timers.tick(TELEGRAM_TIMEOUT_MS)
  assert.equal((await pending).ok, false)
  assert.equal(signal.aborted, true)
  assert.equal(calls, 1)
})

test('checkout shares one deadline across DB checks and Telegram acknowledgement', async t => {
  assert.ok(CHECKOUT_TIMEOUT_MS < 10000)
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const pending = withDeadline(async signal => {
    await new Promise(resolve => setTimeout(resolve, 6000))
    return await telegramRequest('test','answerPreCheckoutQuery',{},signal)
  }, CHECKOUT_TIMEOUT_MS)
  const result = assert.rejects(pending, /request_timeout/)
  let signal
  t.mock.method(globalThis,'fetch',async (_url,init)=>{signal=init.signal;return never()})
  await setImmediate(); t.mock.timers.tick(6000); await setImmediate()
  t.mock.timers.tick(2000)
  await result
  assert.equal(signal.aborted,true)
})

test('Telegram handles unsuccessful, malformed and network responses without success', async t => {
  for (const response of [new Response(JSON.stringify({ok:false,description:'temporary'}),{status:500}),new Response('not-json'),new Response('null'),new Response(JSON.stringify({ok:true}),{status:503})]) {
    const mock=t.mock.method(globalThis,'fetch',async()=>response)
    assert.equal((await telegramRequest('test','sendMessage')).ok,false)
    mock.mock.restore()
  }
})

test('deadline cleans timers, respects prior aborts and cancels DB stalls', async t => {
  t.mock.timers.enable({apis:['setTimeout']})
  let signal
  assert.equal(await withDeadline(async s=>{signal=s;return 1},100),1)
  t.mock.timers.tick(200);assert.equal(signal.aborted,false)
  const controller=new AbortController();controller.abort(new Error('cancelled'))
  let ran=false
  await assert.rejects(withDeadline(async()=>{ran=true},100,controller.signal),/cancelled/)
  assert.equal(ran,false)
  const pending=withDeadline(never,100), rejected=assert.rejects(pending,/request_timeout/)
  t.mock.timers.tick(100);await rejected
})
