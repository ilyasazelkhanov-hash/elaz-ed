import {mkdir,writeFile} from 'node:fs/promises'
const dir=new URL('../../public/learning/ai-practice/ui/',import.meta.url)
await mkdir(dir,{recursive:true})
const shots=[
 ['claude-desktop.jpg','https://assets.claude.com/e0035a095d8888c9739f8acb305f517b25d469eb.jpg','https://claude.com/product/cowork'],
 ['chatgpt-scheduled.webp','https://images.ctfassets.net/j22is2dtoxu1/lbas_img_VqHYGe5lZn0eoenRKTbB9wuviX0oORyEaVsb1Oluqz8/8efb42534fa6d0fa57f98ac16edbcba4/lbas_img_VqHYGe5lZn0eoenRKTbB9wuviX0oORyEaVsb1Oluqz8.png?fm=webp&q=80&w=1344','https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt'],
 ['chatgpt-controls.webp','https://images.ctfassets.net/j22is2dtoxu1/lbas_img_M6A3vtN-CoMiHqGxTZ4aQqy2bGEC8oOzSYweAVAihYg/60408b6cca009983ebb1512d1f42ffdf/lbas_img_M6A3vtN-CoMiHqGxTZ4aQqy2bGEC8oOzSYweAVAihYg.png?fm=webp&q=80&w=1344','https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt'],
 ['runway-apps.png','https://help.runwayml.com/hc/article_attachments/50021344329619','https://help.runwayml.com/hc/en-us/articles/46974685288467-Creating-with-Gen-4-5'],
 ['runway-settings.png','https://help.runwayml.com/hc/article_attachments/49602653261331','https://help.runwayml.com/hc/en-us/articles/46974685288467-Creating-with-Gen-4-5'],
 ['n8n-personal.png','https://2446198290-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FCxSeOtVxqqhfxMSac0AV%2Fuploads%2Fgit-blob-85c3edcf10180966c40f0f826da0a4ab7679beec%2Fbuild-your-first-workflow-create-workflow-01.png?alt=media','https://docs.n8n.io/build-your-first-workflow'],
 ['n8n-create.png','https://2446198290-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FCxSeOtVxqqhfxMSac0AV%2Fuploads%2Fgit-blob-55758edc996be986a974008c1ead88254fb638ab%2Fbuild-your-first-workflow-create-workflow-02.png?alt=media','https://docs.n8n.io/build-your-first-workflow'],
 ['firefly-results.jpg','https://helpx-prod.scene7.com/is/image/HelpxProd/create-images-from-text-prompts-42-firefly?%24pjpeg%24=&jpegSize=200&wid=1200','https://helpx.adobe.com/firefly/web/work-with-images/generate-images/generate-images-from-text-descriptions.html'],
]
const manifest=[]
for(const [file,url,page] of shots){
 const r=await fetch(url,{signal:AbortSignal.timeout(25000)})
 if(!r.ok||!r.headers.get('content-type')?.startsWith('image/'))throw Error(`${file}: ${r.status}`)
 const data=Buffer.from(await r.arrayBuffer());await writeFile(new URL(file,dir),data)
 manifest.push({file,url,page,bytes:data.length,content_type:r.headers.get('content-type'),checked_at:'2026-10-26'})
}
await writeFile(new URL('walkthrough-images.json',import.meta.url),JSON.stringify(manifest,null,2)+'\n')
console.log(JSON.stringify({screenshots:manifest.length,bytes:manifest.reduce((s,r)=>s+r.bytes,0)}))
