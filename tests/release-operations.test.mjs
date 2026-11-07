import test from 'node:test'
import assert from 'node:assert/strict'
import {RELEASE,checkRelease,publicApiUrl} from '../scripts/release-contract.mjs'
import {chunkUrls,discoverApi,smoke} from '../scripts/release-smoke.mjs'
import {reconcileRecovery,recoveryFixture} from '../scripts/verify-recovery.mjs'

test('public capability contract fails closed for old API, missing receipt or partial deployment',()=>{
  assert.ok(Object.values(checkRelease({ok:true,db:true,release:RELEASE})).every(Boolean))
  assert.equal(checkRelease({ok:true,db:true}).api,false)
  assert.equal(checkRelease({ok:true,db:true,release:{...RELEASE,content_revision:null}}).content_revision,false)
  assert.throws(()=>publicApiUrl('https://user:password@example.com/api'))
  assert.throws(()=>publicApiUrl('https://example.com/api?token=secret'))
})
const api='https://verified.supabase.co/functions/v1/api',app='https://example.com/'
const response=value=>new Response(typeof value==='string'?value:JSON.stringify(value))
const deployed=async url=>{
  url=String(url)
  if(url===app)return response('<script src="/assets/index.js"></script>')
  if(url===app+'assets/index.js')return response('import "./client.js";')
  if(url===app+'assets/client.js')return response(`const base="${api}"`)
  throw Error('unexpected URL')
}
test('deployment identity follows split public chunks and rejects explicit API mismatch',async()=>{
  assert.deepEqual(chunkUrls('const files=["assets/child.js","./other.js"]',app+'assets/index.js'),[app+'assets/child.js',app+'assets/other.js'])
  assert.equal((await discoverApi(app,deployed)).apiUrl,api)
  await assert.rejects(smoke({apiUrl:'https://wrong.supabase.co/functions/v1/api',appUrl:app,fetcher:deployed}),/differs/)
})
test('smoke checks denials, fails on missing route, and never logs signed data',async()=>{
  const requested=[]
  const fetcher=async(url,init)=>{
    requested.push({url,body:init?.body})
    if(String(url).endsWith('/health'))return response({ok:true,db:true,release:RELEASE})
    if(init?.body?.includes('test-signed-secret'))return response({posts:[],next:null})
    return new Response(JSON.stringify({error:'no_auth'}),{status:401})
  }
  const report=await smoke({apiUrl:api,auth:'test-signed-secret',fetcher})
  assert.equal(report.pass,true)
  assert.equal(JSON.stringify(report).includes('test-signed-secret'),false)
  assert.ok(requested.every(({url})=>!/(?:boot|track|invoice|complete|\/lesson$)/.test(url)||url.endsWith('/lesson')&&requested.find(row=>row.url===url).body==='{}'))
  const old=await smoke({apiUrl:api,fetcher:async url=>String(url).endsWith('/health')?response({ok:true,db:true}):new Response('{"error":"not_found"}',{status:404})})
  assert.equal(old.pass,false)
})
test('local recovery compares all records, receipts and byte digests independent of row order',()=>{
  const fixture=recoveryFixture(),actual=structuredClone(fixture)
  assert.equal(reconcileRecovery(fixture,actual).pass,true)
  actual.payments[0].stars=999
  assert.equal(reconcileRecovery(fixture,actual).pass,false)
  actual.payments[0].stars=100;actual.assets[0].sha256='0'.repeat(64)
  assert.ok(reconcileRecovery(fixture,actual).failures.includes('assets_mismatch'))
})
test('equal corrupted snapshots cannot pass and reports reveal no rows',()=>{
  const fixture=recoveryFixture();fixture.progress[0].user_id=999
  assert.equal(reconcileRecovery(fixture,fixture).pass,false)
  fixture.settings=[]
  assert.ok(reconcileRecovery(fixture,fixture).failures.includes('source_required_import_receipt'))
  const report=JSON.stringify(reconcileRecovery(fixture,fixture))
  assert.equal(report.includes('synthetic-charge'),false)
})
