// Production checks intentionally never call boot, lesson, track, purchase or write routes.
import {mkdir,writeFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import {checkRelease,publicApiUrl} from './release-contract.mjs'

export function chunkUrls(source, base) {
  const urls = new Set()
  for (const match of source.matchAll(/(?:["'])(\.?\.?\/[\w./-]+\.js|\/?assets\/[\w.-]+\.js)(?:["'])/g)) {
    const url = new URL(match[1].startsWith('assets/')?`/${match[1]}`:match[1], base)
    if (url.origin === new URL(base).origin) urls.add(url.href)
  }
  return [...urls]
}

export async function discoverApi(appUrl, fetcher = fetch) {
  const app = new URL(appUrl)
  if (app.protocol !== 'https:' || app.username || app.password || app.search || app.hash) throw Error('Use a public HTTPS app URL')
  const response = await fetcher(app, {signal:AbortSignal.timeout(15000),redirect:'error'})
  if (!response.ok) throw Error('Frontend unavailable')
  const html = await response.text(), queue = []
  for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)) {
    const url = new URL(match[1],app)
    if (url.origin === app.origin) queue.push(url.href)
  }
  const seen = new Set(), found = new Set(), assets = []
  let totalBytes = 0
  while (queue.length && seen.size < 80) {
    const url = queue.shift()
    if (seen.has(url)) continue
    seen.add(url)
    const result = await fetcher(url,{signal:AbortSignal.timeout(15000),redirect:'error'})
    if (!result.ok) throw Error('Frontend chunk unavailable')
    const source = await result.text()
    totalBytes += Buffer.byteLength(source)
    if (totalBytes > 12_000_000) throw Error('Frontend discovery exceeded size limit')
    assets.push(new URL(url).pathname)
    for (const match of source.matchAll(/https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\/api\b/g)) found.add(match[0])
    queue.push(...chunkUrls(source,url))
  }
  if (queue.some(url=>!seen.has(url))) throw Error('Frontend discovery exceeded chunk limit')
  if (found.size !== 1) throw Error('Cannot identify exactly one deployed API; supply RELEASE_API_URL explicitly')
  return {apiUrl:[...found][0],assets:assets.sort()}
}

export async function smoke({apiUrl,appUrl,auth,fetcher=fetch}) {
  const discovery = appUrl ? await discoverApi(appUrl,fetcher) : null
  const api = publicApiUrl(apiUrl || discovery?.apiUrl || '')
  if (discovery && api !== discovery.apiUrl) throw Error('Configured API differs from deployed frontend')
  const checks = [], request = async(route,body) => {
    try {
      const response = await fetcher(`${api}/${route}`,{method:body?'POST':'GET',...(body?{headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000),redirect:'error'})
      const data = await response.json().catch(()=>null)
      return {status:response.status,data}
    } catch { return {status:0,data:null} }
  }
  const health = await request('health')
  const contract = checkRelease(health.data)
  checks.push({name:'health',status:health.status,pass:health.status===200&&contract.healthy})
  for (const [name,pass] of Object.entries(contract).filter(([name])=>name!=='healthy')) checks.push({name:`release_${name}`,pass})
  for (const route of ['blog_feed','lesson','admin_analytics']) {
    const result = await request(route,{})
    checks.push({name:`deny_unauthenticated_${route}`,status:result.status,pass:result.status===401&&result.data?.error==='no_auth'})
  }
  // Optional existing signed test member: feed reads only. member() can refresh its subscription cache.
  if (auth) {
    let cursor = null, previous = null, pages = 0, seen = new Set(), pass = true
    do {
      const result = await request('blog_feed',{auth,order:'newest',cursor})
      if (result.status!==200 || !Array.isArray(result.data?.posts)) {pass=false;break}
      for (const post of result.data.posts) {
        const date = post.published_at===null ? -Infinity : Date.parse(post.published_at)
        if (!Number.isFinite(date) && date!==-Infinity) pass=false
        if (seen.has(post.id)||post.course_id!=null||post.published!==true||date>Date.now()) pass=false
        if (previous && (date>previous.date || date===previous.date&&post.id>=previous.id)) pass=false
        seen.add(post.id);previous={date,id:post.id}
      }
      cursor=result.data.next;pages++
    } while(cursor && pages<3)
    checks.push({name:'signed_newest_feed',pass,pages,posts:seen.size})
  }
  return {checked_at:new Date().toISOString(),app_url:appUrl||null,api_url:api,frontend_assets:discovery?.assets||[],signed_feed:auth?'checked':'not_supplied',checks,pass:checks.every(check=>check.pass)}
}

if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    const report=await smoke({apiUrl:process.env.RELEASE_API_URL,appUrl:process.env.RELEASE_APP_URL||'https://elaz-ed.vercel.app',auth:process.env.RELEASE_INIT_DATA})
    await mkdir('test-results',{recursive:true})
    await writeFile('test-results/release-smoke.json',JSON.stringify(report,null,2)+'\n')
    console.log(JSON.stringify(report,null,2))
    process.exitCode=report.pass?0:1
  } catch { console.error('Release smoke failed: check public URLs, network and deployment identity. No credentials or response bodies were logged.');process.exitCode=1 }
}
