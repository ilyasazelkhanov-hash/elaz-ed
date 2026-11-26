import test from 'node:test'
import assert from 'node:assert/strict'
import {RELEASE,checkRelease,publicApiUrl} from '../scripts/release-contract.mjs'
import {chunkUrls,discoverApi,smoke} from '../scripts/release-smoke.mjs'
import {reconcileRecovery,recoveryFixture} from '../scripts/verify-recovery.mjs'
import {frontendRelease,frontendSourceIdentity,frontendSourceDiagnostics} from '../scripts/frontend-release.mjs'
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import {tmpdir} from 'node:os'
import path from 'node:path'

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
  if(url===app+'runtime.json')return new Response(null,{status:404})
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
test('published runtime metadata avoids crawling the application graph',async()=>{
  const config = async url => {
    assert.equal(url,app+'runtime.json')
    return response({schema:1,api_url:api})
  }
  assert.deepEqual(await discoverApi(app,config),{apiUrl:api,assets:[]})
  await assert.rejects(discoverApi(app,async()=>response({schema:1,api_url:'http://example.com/api'})),/HTTPS/)
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

test('frontend identity hashes built artifacts and exposes only a validated commit',async()=>{
  const base=await mkdtemp(path.join(tmpdir(),'og-release-identity-'))
  try {
    await mkdir(path.join(base,'dist/assets'),{recursive:true})
    await writeFile(path.join(base,'dist/index.html'),'<script src="/assets/app.js"></script>')
    await writeFile(path.join(base,'dist/assets/app.js'),'console.log("build")')
    const commit='a'.repeat(40),first=await frontendRelease(base,{VERCEL_GIT_COMMIT_SHA:commit,UNRELATED_SECRET:'never publish'})
    assert.equal(first.commit,commit)
    assert.equal(first.file_count,2)
    assert.equal(JSON.stringify(first).includes('never publish'),false)
    await writeFile(path.join(base,'dist/release.json'),JSON.stringify(first))
    const second=await frontendRelease(base,{VERCEL_GIT_COMMIT_SHA:commit})
    assert.equal(second.build_sha256,first.build_sha256)
    await writeFile(path.join(base,'dist/assets/app.js'),'console.log("changed")')
    assert.notEqual((await frontendRelease(base,{})).build_sha256,first.build_sha256)
    assert.equal((await frontendRelease(base,{VERCEL_GIT_COMMIT_SHA:'untrusted value'})).commit,null)
  } finally {await rm(base,{recursive:true,force:true})}
})

test('smoke verifies the exact published commit and fails on missing or dirty identity',async()=>{
  const commit='a'.repeat(40)
  let identity={schema:1,commit,dirty:false,build_sha256:'b'.repeat(64),file_count:2}
  const fetcher=async(url,init)=>{
    if(String(url)===app+'release.json')return response(identity)
    if(String(url).endsWith('/health'))return response({ok:true,db:true,release:RELEASE})
    if(init?.body)return new Response('{"error":"no_auth"}',{status:401})
    return deployed(url)
  }
  assert.equal((await smoke({appUrl:app,expectedCommit:commit,fetcher})).pass,true)
  assert.equal((await smoke({appUrl:app,expectedCommit:'c'.repeat(40),fetcher})).pass,false)
  identity={...identity,dirty:true}
  assert.equal((await smoke({appUrl:app,fetcher})).pass,false)
  identity={}
  assert.equal((await smoke({appUrl:app,fetcher})).pass,false)
  await assert.rejects(smoke({apiUrl:api,expectedCommit:commit,fetcher}),/requires an app URL/)
  await assert.rejects(smoke({appUrl:app,expectedCommit:'main',fetcher}),/full Git SHA/)
})


test('Vercel installs the frozen lockfile before capturing source identity',async()=>{
  const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'))
  assert.equal(config.installCommand,'npm ci')
  assert.equal(config.buildCommand,'npm run build')
})

test('source identity remains honest for clean, modified and staged tracked files',async()=>{
  const base=await mkdtemp(path.join(tmpdir(),'og-release-source-'))
  const git=(...args)=>execFileSync('git',args,{cwd:base,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
  try {
    git('init','--quiet')
    await writeFile(path.join(base,'package-lock.json'),'{}\n')
    git('add','package-lock.json')
    git('-c','user.name=Release identity test','-c','user.email=test@example.invalid','commit','--quiet','-m','Fixture')
    const commit=git('rev-parse','HEAD'),env={VERCEL_GIT_COMMIT_SHA:commit}
    assert.deepEqual(frontendSourceIdentity(base,env),{commit,dirty:false})
    await writeFile(path.join(base,'untracked-cache'),'not a source edit')
    assert.equal(frontendSourceIdentity(base,env).dirty,false)
    await writeFile(path.join(base,'package-lock.json'),'{"changed":true}\n')
    assert.equal(frontendSourceIdentity(base,env).dirty,true)
    git('add','package-lock.json')
    assert.equal(frontendSourceIdentity(base,env).dirty,true)
  } finally {await rm(base,{recursive:true,force:true})}
})

test('generated outputs are fingerprinted after capturing the clean source checkout',async()=>{
  const base=await mkdtemp(path.join(tmpdir(),'og-release-generated-'))
  const git=(...args)=>execFileSync('git',args,{cwd:base,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
  try {
    git('init','--quiet')
    await writeFile(path.join(base,'generated-book.md'),'tracked draft\n')
    git('add','generated-book.md')
    git('-c','user.name=Release identity test','-c','user.email=test@example.invalid','commit','--quiet','-m','Fixture')
    const commit=git('rev-parse','HEAD'),env={VERCEL_GIT_COMMIT_SHA:commit}
    const source=frontendSourceIdentity(base,env)
    await writeFile(path.join(base,'generated-book.md'),'generated during build\n')
    await mkdir(path.join(base,'dist'))
    await writeFile(path.join(base,'dist/index.html'),'generated build')
    assert.equal(frontendSourceIdentity(base,env).dirty,true)
    const release=await frontendRelease(base,env,source)
    assert.equal(release.dirty,false)
    assert.equal(release.commit,commit)
    assert.equal(release.file_count,1)
    assert.match(release.build_sha256,/^[a-f0-9]{64}$/)
  } finally {await rm(base,{recursive:true,force:true})}
})


test('source diagnostics expose only tracked relative paths and validated commit metadata',async()=>{
  const base=await mkdtemp(path.join(tmpdir(),'og-diagnostics-'))
  const git=(...args)=>execFileSync('git',args,{cwd:base,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
  try {
    git('init','--quiet')
    await writeFile(path.join(base,'source.txt'),'private source content')
    git('add','source.txt')
    git('-c','user.name=Test','-c','user.email=test@example.invalid','commit','--quiet','-m','Fixture')
    const head=git('rev-parse','HEAD')
    const env={VERCEL_GIT_COMMIT_SHA:'not-a-sha-secret',PRIVATE_TOKEN:'never-log-this'}
    assert.deepEqual(frontendSourceDiagnostics(base,env),{head,declared_commit:null,tracked_changes:[],truncated:false,available:true})
    git('mv','source.txt','renamed.txt')
    await writeFile(path.join(base,'untracked-secret'),'secret')
    const result=frontendSourceDiagnostics(base,{...env,VERCEL_GIT_COMMIT_SHA:'a'.repeat(40)})
    assert.deepEqual(result.tracked_changes,[{status:'R ',path:'renamed.txt',from:'source.txt'}])
    assert.equal(result.declared_commit,'a'.repeat(40))
    const serialized=JSON.stringify(result)
    for(const forbidden of [base,'private source content','untracked-secret','never-log-this','not-a-sha-secret']) assert.ok(!serialized.includes(forbidden))
    assert.equal(frontendSourceIdentity(base,env).dirty,true)
    await mkdir(path.join(base,'dist'))
    await writeFile(path.join(base,'dist/index.html'),'build')
    assert.equal('tracked_changes' in await frontendRelease(base,env),false)
  } finally {await rm(base,{recursive:true,force:true})}
})

test('diagnostics fail closed without leaking Git errors outside a repository',async()=>{
  const base=await mkdtemp(path.join(tmpdir(),'og-no-git-'))
  try {assert.deepEqual(frontendSourceDiagnostics(base,{}),{head:null,declared_commit:null,tracked_changes:[],truncated:false,available:false})}
  finally {await rm(base,{recursive:true,force:true})}
})

test('diagnostics bound large change lists and serialize to a single log line',async()=>{
  const base=await mkdtemp(path.join(tmpdir(),'og-diagnostics-bound-'))
  const git=(...args)=>execFileSync('git',args,{cwd:base,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
  try {
    git('init','--quiet')
    for(let i=0;i<101;i++) await writeFile(path.join(base,`file-${i}.txt`),'original')
    git('add','.')
    git('-c','user.name=Test','-c','user.email=test@example.invalid','commit','--quiet','-m','Fixture')
    for(let i=0;i<101;i++) await writeFile(path.join(base,`file-${i}.txt`),'changed')
    const result=frontendSourceDiagnostics(base,{})
    assert.equal(result.tracked_changes.length,100)
    assert.equal(result.truncated,true)
    assert.ok(!JSON.stringify(result).includes('\n'))
  } finally {await rm(base,{recursive:true,force:true})}
})
