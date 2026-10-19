import { safeAcademyUrl, type AcademyEntity, type AcademySeed, type AcademySourceLink } from './academy-types.ts'
import { gradeAcademyAnswer, validAcademyQuestion } from './academy-quiz.ts'

type Actor = { id: number; is_admin: boolean; commerce?: {id:number;title:string;price_stars:number;access:boolean}[] }
type Row = Record<string, any>
interface DemoState extends AcademySeed {
  enrollments: Row[]; progress: Row[]; submissions: Row[]; attempts: Row[]
  placements: Row[]; certificates: Row[]; audit: Row[]
  roles?: Row[]
  skillLinks?: {target_code:string;skill_code:string}[]; blockVersions?: Row[]; events?: Row[]; portfolio?: Row[]
  content_revision?: string
  content_node_versions?: Record<string,number>
}
interface Persistence { load(): DemoState | undefined; save(state: DemoState): void }
const copy = <T>(value: T): T => structuredClone(value)
const failure = (code: string): never => { throw new Error(code) }
const kinds = new Set(['direction','course','module','lesson','source','skill','assessment','rubric'])
const states = new Set(['outline','draft','in_review','approved','published','archived'])
const formats = new Set(['microlecture','guided_demo','hands_on_lab','knowledge_check','case_review','live_workshop','assignment','project_defense','resource'])
const reviewed = new Set(['hands_on_lab','case_review','assignment','project_defense'])
const now = () => new Date().toISOString()
const uid = () => globalThis.crypto.randomUUID()
const readActions=new Set(['permissions','skills','skill_progress','block_list','analytics','portfolio_list','portfolio_public','certificate_public','certificate_verify','audit','admin_audit','catalog','course','lesson','library','my','submission','review_queue','admin_list'])
const publicFields = new Set(['description','slug','level','outcome','outcomes','audience','hours','capstone','prerequisites','minutes','format','primary_format','duration_min','locale','translations','tags','icon','url','canonical_url','type','kind','language','rights_state','link_state','checked_at','required','artifact','acceptance','chapters','source_type','author','provider','price_stars','free_preview'])
function publicBlocks(value: any): any {
  if (Array.isArray(value)) return value.map(publicBlocks)
  if (value && typeof value==='object') return Object.fromEntries(Object.entries(value).filter(([key])=>!['answer','answers','answerkey','correct','correctindex','expected','expectedanswer','acceptedanswers','questions','editornote','internalnotes','privatenotes'].includes(key.toLowerCase().replaceAll('_',''))).map(([key,item])=>[key,publicBlocks(item)]))
  return value
}
function translationMetadata(value:any):any{
 if(Array.isArray(value))return value.map(translationMetadata)
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>key==='title'||key==='data'||publicFields.has(key)&&!['translations','url','canonical_url','chapters'].includes(key)).map(([key,item])=>[key,translationMetadata(item)]))
 return value
}

/** An explicitly local demo adapter. Production authority lives in PostgreSQL. */
export function createAcademyEngine(seed: AcademySeed, storage: Persistence) {
  return async (actor: Actor, action: string, payload: Row = {}): Promise<any> => {
    const stored=storage.load()
    const contentRevision=(seed as AcademySeed&{content_revision?:string}).content_revision
    const needsContentUpgrade=!!contentRevision&&stored?.content_revision!==contentRevision
    // Reads share immutable content; only their tiny event array is mutable.
    // Writes and content upgrades keep a private full snapshot for rollback on failure.
    const db: DemoState = stored&&readActions.has(action)&&!needsContentUpgrade
      ? {...stored,events:[...stored.events??[]]}
      : copy(stored??{ ...seed, enrollments: [], progress: [], submissions: [], attempts: [], placements: [], certificates: [], audit: [] })
    db.roles ??= []
    db.skillLinks??=[];db.blockVersions??=[];db.events??=[];db.portfolio??=[]
    // Upgrade only the original outline or an untouched authored revision.
    // Manual CMS changes and all learner history remain in place.
    if(contentRevision&&db.content_revision!==contentRevision){
      const updatedCodes=new Set<string>()
      db.content_node_versions??={}
      for(const node of seed.entities.filter(n=>n.data.authored_pack)){
        const index=db.entities.findIndex(n=>n.code===node.code),old=db.entities[index]
        if(!old||(old.seed_managed&&old.state==='outline')||(old.data.authored_pack&&old.version===(db.content_node_versions[node.code]??1))){
          const next=copy(node),same=old&&old.title===node.title&&old.state===node.state&&JSON.stringify(old.data)===JSON.stringify(node.data)
          next.version=old?(same?old.version:old.version+1):1
          if(index<0)db.entities.push(next);else db.entities[index]=next
          db.content_node_versions[node.code]=next.version
          updatedCodes.add(node.code)
        }
      }
      const keys=new Set(db.links.map(l=>`${l.source_code}:${l.target_code}:${l.usage}:${l.start_seconds??0}`))
      for(const link of seed.links.filter(l=>updatedCodes.has(l.source_code))){const key=`${link.source_code}:${link.target_code}:${link.usage}:${link.start_seconds??0}`;if(!keys.has(key)){db.links.push(copy(link));keys.add(key)}}
      db.content_revision=contentRevision;storage.save(db)
    }
    const canEdit = actor.is_admin || db.roles.some(r=>r.user_id===actor.id && r.role==='editor')
    const canReview = actor.is_admin || db.roles.some(r=>r.user_id===actor.id && r.role==='instructor')
    const admin = () => actor.is_admin || failure('forbidden')
    const editor = () => canEdit || failure('forbidden')
    const reviewer = () => canReview || failure('forbidden')
    const find = (code: unknown, kind?: string): AcademyEntity => db.entities.find(n => n.code === code && (!kind || n.kind === kind)) ?? failure('not_found')
    const ordered = (nodes: AcademyEntity[]) => nodes.sort((a,b) => a.position-b.position || a.code.localeCompare(b.code))
    const children = (code: string, kind?: string) => ordered(db.entities.filter(n => n.parent_code === code && (!kind || n.kind === kind) && n.state !== 'archived'))
    const courseFor = (node: AcademyEntity): AcademyEntity => node.kind === 'course' ? node : node.parent_code ? courseFor(find(node.parent_code)) : failure('course_required')
    const offerFor=(course:AcademyEntity)=>{const id=Number(course.data.legacy_course_id);if(!id)return null;const product=actor.commerce?.find(c=>c.id===id);return product?{legacy_course_id:id,title:product.title,price_stars:product.price_stars,has_access:product.access||product.price_stars===0,purchasable:product.price_stars>0}:failure('product_not_found')}
    const resolveBlocks=(blocks:Row[])=>blocks.map(b=>{if(b.type!=='reference')return b;const version=db.blockVersions!.find(v=>v.code===b.ref_code&&v.version===b.ref_version&&v.state==='published');return version?copy(version.payload):failure('block_not_published')})
    const localizedBlocks=(data:Row)=>{
      const result:Record<string,Row[]>={}
      for(const locale of ['en','kk']){
        const translation=data.translations?.[locale]??data.translations?.[locale.toUpperCase()]
        if(!translation||typeof translation!=='object'||Array.isArray(translation))continue
        const fields={...translation,...(translation.data&&typeof translation.data==='object'&&!Array.isArray(translation.data)?translation.data:{})}
        let blocks=fields.content_blocks??fields.blocks??fields.contentBlocks
        if(blocks==null){const body=fields.body??fields.text??fields.content;if(typeof body==='string'&&body.trim())blocks=[{type:'markdown',body}]}
        if(blocks==null)continue
        if(!Array.isArray(blocks))failure('invalid_blocks')
        if(blocks.length)result[locale]=publicBlocks(resolveBlocks(copy(blocks)))
      }
      return result
    }
    const assessmentAccess = (code: string) => {
      const entity = find(code)
      if (entity.kind==='lesson') return {lesson:access(code,true),config:entity.data.assessment,code:entity.code,version:entity.version}
      if (entity.kind!=='assessment' || entity.state!=='published') failure('assessment_not_configured')
      const parent=find(entity.parent_code)
      if (parent.kind==='lesson') return {lesson:access(parent.code,true),config:entity.data,code:entity.code,version:entity.version}
      const course=courseFor(entity)
      if (course.state!=='published') failure('not_published')
      if (!['active','completed'].includes(enrolled(course.code)?.state)) failure('enrollment_required')
      if (!eligible(course.code)) failure('prerequisite_required')
      return {lesson:undefined,config:entity.data,code:entity.code,version:entity.version}
    }
    const courseLessons = (code: string) => children(code, 'module').flatMap(m => children(m.code, 'lesson'))
    const completed = (code: string, user = actor.id) => db.progress.some(p => p.user_id === user && p.lesson_code === code && p.state === 'completed')
    const summary = (code: string, user = actor.id) => {
      const lessons = courseLessons(code).filter(l => l.data.required !== false)
      const done = lessons.filter(l => completed(l.code,user)).length
      return { course_code: code, completed: done, total: lessons.length, percent: lessons.length ? Math.round(done / lessons.length * 100) : 0, state: lessons.length && done === lessons.length ? 'completed' : 'in_progress' }
    }
    const enrolled = (code: string) => db.enrollments.find(e => e.user_id === actor.id && e.course_code === code)
    const eligible = (code: string) => db.placements.some(p=>p.user_id===actor.id&&p.course_code===code&&['approved','passed'].includes(p.state??p.status)) || db.prerequisites.filter(p=>p.course_code===code).every(p=>summary(p.requires_code).state==='completed'||db.certificates.some(c=>c.user_id===actor.id&&c.course_code===p.requires_code&&!c.revoked_at))
    const actionNode=payload.code?db.entities.find(n=>n.code===payload.code):['quiz_submit','submission_submit'].includes(action)?db.entities.find(n=>n.code===(action==='quiz_submit'?db.attempts.find(a=>a.id===payload.attempt_id&&a.user_id===actor.id)?.assessment_code:db.submissions.find(s=>s.id===payload.submission_id&&s.user_id===actor.id)?.assessment_code)):null
    if(actionNode&&['lesson','enroll','complete','quiz_start','quiz_submit','submission_save','submission_submit','certificate'].includes(action)){
      const course=courseFor(actionNode),offer=offerFor(course)
      if(offer&&!offer.has_access&&!(canEdit&&action==='lesson'))failure('payment_required')
    }
    const access = (code: string, writing = false): AcademyEntity => {
      const lesson = find(code,'lesson'), course = courseFor(lesson)
      if (lesson.state !== 'published' || find(lesson.parent_code).state !== 'published' || course.state !== 'published') {
        if (!writing && canEdit) return lesson
        failure('not_published')
      }
      if ((!canEdit || writing) && !['active','completed'].includes(enrolled(course.code)?.state)) failure('enrollment_required')
      if ((!canEdit || writing) && !eligible(course.code)) failure('prerequisite_required')
      return lesson
    }
    const visibleSource = (source: AcademyEntity) => source.state !== 'archived' && (canEdit || (source.state==='published' && ['approved','owned','licensed','public_link'].includes(source.data.rights_state) && source.data.link_state==='verified' && !!source.data.checked_at && db.links.some(link => link.source_code===source.code && ['student','public'].includes(link.visibility) && !['methodological','internal'].includes(link.usage))))
    const sourcesFor = (code: string) => db.links.filter(link => link.target_code === code && (actor.is_admin || ['student','public'].includes(link.visibility))).flatMap(link => {
      const source = db.entities.find(n => n.kind === 'source' && n.code === link.source_code)
      if (!source || !visibleSource(source)) return []
      if (!actor.is_admin && ['methodological','internal'].includes(link.usage)) return []
      return [{ ...copy(link), ...(actor.is_admin ? {} : { note: undefined }), source: sanitize(source) }]
    })
    const sanitize = (node: AcademyEntity, full = false): AcademyEntity => {
      const item = copy(node)
      if (!canEdit) {
        item.data=Object.fromEntries(Object.entries(item.data).filter(([key])=>publicFields.has(key)))
        if(item.data.translations){
          item.data.translations=Object.fromEntries(Object.entries(item.data.translations).map(([locale,value])=>[locale,full?publicBlocks(value):translationMetadata(value)]))
        }
        item.data=publicBlocks(item.data)
      }
      return item
    }
    const record = (kind: string, target: string, before: unknown, after: unknown) => db.audit.push({ id: uid(), actor_id: actor.id, action: kind, code: target, before, after, created_at: now() })
    const finishLesson = (lesson: AcademyEntity) => {
      let row = db.progress.find(p => p.user_id === actor.id && p.lesson_code === lesson.code)
      if (!row) { row = { user_id: actor.id, lesson_code: lesson.code }; db.progress.push(row) }
      row.state='completed';row.version??=lesson.version;row.completed_at??=now()
      row.content_snapshot??=publicBlocks(resolveBlocks(copy(lesson.data.content_blocks??lesson.data.blocks??lesson.data.contentBlocks??[])))
      const course = courseFor(lesson), progress = summary(course.code)
      if (progress.state === 'completed') {
        const enrollment = enrolled(course.code)
        if (enrollment) enrollment.state = 'completed'
      }
      return { ...row, progress }
    }
    const page = (rows: any[]) => {
      const offset = Math.max(0, Number(payload.offset) || 0), limit = Math.min(100, Math.max(1, Number(payload.limit) || 30))
      return { rows: rows.slice(offset, offset+limit), total: rows.length }
    }
    const matches = (node: AcademyEntity) => {
      const text = `${node.title} ${node.code} ${JSON.stringify(node.data)} ${node.code.startsWith('VC') ? 'вайбкодинг' : ''}`.toLowerCase()
      return !payload.q || text.includes(String(payload.q).trim().toLowerCase())
    }
    let result: any
    let changed = false
    switch(action) {
      case 'permissions': result={admin:actor.is_admin,editor:canEdit,instructor:canReview};break
      case 'skills': result={skills:db.entities.filter(n=>n.kind==='skill'&&(canEdit||n.state==='published')).map(n=>sanitize(n)),links:db.skillLinks.filter(l=>canEdit||find(l.target_code).state==='published')};break
      case 'skill_map':{
        editor();const target=find(payload.target_code);if(!['lesson','course'].includes(target.kind)||!Array.isArray(payload.skill_codes)||new Set(payload.skill_codes).size!==payload.skill_codes.length)failure('invalid_skills')
        for(const code of payload.skill_codes)find(code,'skill')
        db.skillLinks=db.skillLinks.filter(l=>l.target_code!==target.code);db.skillLinks.push(...payload.skill_codes.map((skill_code:string)=>({target_code:target.code,skill_code})))
        record('skill_map',target.code,null,payload.skill_codes);result={target_code:target.code,skill_codes:payload.skill_codes};changed=true;break
      }
      case 'skill_progress':{
        result={skills:db.entities.filter(n=>n.kind==='skill'&&n.state==='published').map(n=>{
          const codes=new Set<string>();for(const link of db.skillLinks!.filter(l=>l.skill_code===n.code)){const target=find(link.target_code);for(const l of target.kind==='lesson'?[target]:courseLessons(target.code))if(l.data.required!==false&&l.state!=='archived')codes.add(l.code)}
          const required=codes.size,done=[...codes].filter(code=>completed(code)).length;return{code:n.code,title:n.title,required,completed:done,percent:required?Math.round(done/required*100):0,verified:required>0&&done===required}
        })};break
      }
      case 'block_list':editor();result={blocks:db.blockVersions.filter(b=>!payload.code||b.code===payload.code)};break
      case 'block_save':{
        editor();const old=db.blockVersions.filter(b=>b.code===payload.code).at(-1)
        if((old?.version??0)!==payload.expected_version)failure('version_conflict')
        if(!/^[A-Za-z0-9_-]{1,100}$/.test(payload.code)||!payload.payload||typeof payload.payload!=='object'||Array.isArray(payload.payload)||payload.payload.type==='reference'||!['draft','approved','published'].includes(payload.state))failure('invalid_block')
        if(payload.state==='published'&&(old?.state!=='approved'||JSON.stringify(old.payload)!==JSON.stringify(payload.payload)))failure('approval_required')
        result={code:payload.code,version:(old?.version??0)+1,state:payload.state,payload:copy(payload.payload),created_at:now()};db.blockVersions.push(result);changed=true;break
      }
      case 'analytics':{
        editor();const names=[...new Set(db.events.map(e=>e.event))]
        const funnel=names.map(event=>{const rows=db.events!.filter(e=>e.event===event);return{event,count:rows.length,learners:new Set(rows.map(r=>r.user_id)).size}})
        const eventCourse=(event:Row)=>{const entity=db.entities.find(n=>n.code===event.entity_code);return entity&&['course','module','lesson','assessment'].includes(entity.kind)?courseFor(entity).code:null}
        const dropout=db.entities.filter(e=>e.kind==='course').map(course=>{
          const es=db.enrollments.filter(e=>e.course_code===course.code)
          const activity=(user:number)=>db.events!.filter(v=>v.user_id===user&&eventCourse(v)===course.code)
          return {course_code:course.code,enrolled:es.length,started:es.filter(e=>activity(e.user_id).some(v=>['lesson_open','quiz_started'].includes(v.event))).length,completed:es.filter(e=>summary(course.code,e.user_id).state==='completed').length,inactive:es.filter(e=>summary(course.code,e.user_id).state!=='completed'&&Date.now()-Math.max(new Date(e.created_at??e.enrolled_at).getTime(),...activity(e.user_id).map(v=>new Date(v.created_at).getTime()))>7*86400000).length}
        })
        const delays:number[]=[]
        for(const user of new Set(db.events.map(e=>e.user_id))){
          const events=db.events.filter(e=>e.user_id===user),enrollments=events.filter(e=>e.event==='enrolled').map(e=>new Date(e.created_at).getTime()),results=events.filter(e=>['quiz_passed','lesson_completed'].includes(e.event)).map(e=>new Date(e.created_at).getTime())
          if(enrollments.length&&results.length){const enrollment=Math.min(...enrollments),first=Math.min(...results);if(first>=enrollment)delays.push((first-enrollment)/1000)}
        }
        delays.sort((a,b)=>a-b);const middle=Math.floor(delays.length/2),median=delays.length?(delays.length%2?delays[middle]:(delays[middle-1]+delays[middle])/2):null
        result={funnel,dropout,time_to_first_result:{learners:delays.length,median_seconds:median}};break
      }
      case 'file_upload':case 'file_finalize':case 'file_download':failure('storage_unavailable')
      case 'portfolio_list':result={entries:db.portfolio.filter(p=>p.owner_id===actor.id).map(({owner_id,...rest})=>rest)};break
      case 'portfolio_public':{
        const entry=db.portfolio.find(p=>p.slug===payload.slug&&!p.revoked_at&&db.submissions.some(s=>s.id===p.submission_id&&s.state==='passed'))??failure('not_found');result={slug:entry.slug,title:entry.title,artifact:entry.artifact,published_at:entry.consent_at};break
      }
      case 'portfolio_publish':case 'portfolio_revoke':{
        const submission=db.submissions.find(s=>String(s.id)===String(payload.submission_id)&&s.user_id===actor.id)??failure('forbidden')
        let entry=db.portfolio.find(p=>p.submission_id===submission.id)
        if(action==='portfolio_revoke'){if(entry)entry.revoked_at=now();result={revoked:true};changed=true;break}
        if(payload.consent!==true||submission.state!=='passed')failure('consent_required')
        const candidate=safeAcademyUrl(submission.artifact?.url??submission.artifact_url)
        const publicUrl=candidate&&!new URL(candidate).search&&!new URL(candidate).hash?candidate:null
        const artifact={text:submission.artifact?.text??submission.text,url:publicUrl}
        if(!artifact.text&&!artifact.url)failure('artifact_required')
        if(!entry){entry={submission_id:submission.id,owner_id:actor.id,slug:uid().replaceAll('-','')};db.portfolio.push(entry)}
        Object.assign(entry,{consent_at:now(),revoked_at:null,artifact,title:find(submission.assessment_code??submission.lesson_code).title});result=entry;changed=true;break
      }
      case 'audit': case 'admin_audit': {
        editor();const p=page([...db.audit].reverse().filter(row=>!payload.code || row.code===payload.code));result={entries:p.rows,total:p.total};break
      }
      case 'admin_assign': {
        admin();const row=db.submissions.find(s=>s.id===payload.submission_id)??failure('not_found')
        const user=Number(payload.user_id??payload.assigned_to)
        if(!db.roles.some(r=>r.user_id===user&&r.role==='instructor'))failure('invalid_role')
        if(row.user_id===user)failure('self_review_forbidden')
        row.assigned_to=user;result=row;changed=true;break
      }
      case 'certificate_public':case 'certificate_verify': {
        const certificate=db.certificates.find(c=>c.code===payload.code)
        result=certificate ? {code:certificate.code,course_title:find(certificate.course_code).title,issued_at:certificate.issued_at,valid:!certificate.revoked_at} : {valid:false};break
      }
      case 'admin_roles': {
        admin();if(payload.user_id==null&&payload.role==null){result={roles:db.roles};break}const user=Number(payload.user_id)
        if (!Number.isSafeInteger(user)||user<=0||!['editor','instructor'].includes(payload.role)) failure('invalid_role')
        db.roles=db.roles.filter(r=>r.user_id!==user||r.role!==payload.role)
        if(payload.enabled)db.roles.push({user_id:user,role:payload.role})
        result={ok:true};changed=true;break
      }
      case 'catalog': {
        const courses = ordered(db.entities.filter(n => n.kind === 'course' && n.state !== 'archived' && (!payload.level || n.data.level === payload.level) && (!payload.direction || n.parent_code === payload.direction) && matches(n)))
        const p = page(courses)
        result = { directions: ordered(db.entities.filter(n => n.kind === 'direction' && n.state !== 'archived')).map(n=>sanitize(n)), courses: p.rows.map(n=>sanitize(n)), total: p.total }; break
      }
      case 'course': {
        const course = find(payload.code,'course')
        if (course.state === 'archived' && !actor.is_admin) failure('not_found')
        const modules = children(course.code,'module'), lessons = modules.flatMap(m => children(m.code,'lesson'))
        result = { course: sanitize(course),offer:offerFor(course), modules: modules.map(n=>sanitize(n)), lessons: lessons.map(n=>sanitize(n)), assessments:children(course.code,'assessment').filter(a=>a.state==='published').map(n=>sanitize(n)),sources: sourcesFor(course.code), enrollment: enrolled(course.code) ?? null, progress: summary(course.code), eligible:eligible(course.code), prerequisites: db.prerequisites.filter(p => p.course_code === course.code) }; break
      }
      case 'lesson': {
        const requested=find(payload.code)
        if(requested.kind==='assessment'){
          const resolved=assessmentAccess(requested.code)
          result={lesson:sanitize(requested),blocks:requested.data.instructions?[{type:'markdown',text:requested.data.instructions}]:[],sources:sourcesFor(requested.code),assessment:{code:requested.code,kind:requested.data.kind,rubric_code:requested.data.rubric_code,passing_score:requested.data.passing_score??70},progress:null,submissions:db.submissions.filter(s=>s.user_id===actor.id&&s.assessment_code===resolved.code)}
          break
        }
        const lesson = access(payload.code), data = lesson.data
        const blocks = publicBlocks(resolveBlocks(copy(data.content_blocks ?? data.blocks ?? data.contentBlocks ?? [])))
        const localized_blocks=localizedBlocks(data),localizedLesson=sanitize(lesson,true)
        if(data.translations){
          const translations=Object.fromEntries(Object.entries(data.translations).map(([locale,value])=>[locale,translationMetadata(value)]))
          for(const [locale,content_blocks] of Object.entries(localized_blocks))translations[locale]={...(translations[locale]??translations[locale.toUpperCase()]??{}),content_blocks}
          localizedLesson.data.translations=publicBlocks(translations)
        }
        const node=children(lesson.code,'assessment').find(n=>n.state==='published')
        const assessment=node ? {code:node.code,kind:node.data.kind,passing_score:node.data.passing_score??70,rubric_code:node.data.rubric_code,instructions:node.data.instructions} : data.assessment ? {code:lesson.code,kind:data.assessment.kind??'quiz',passing_score:data.assessment.passing_score??70} : null
        const siblings=courseLessons(courseFor(lesson).code), index=siblings.findIndex(l=>l.code===lesson.code)
        result = { lesson: localizedLesson, blocks, localized_blocks, sources: sourcesFor(lesson.code), assessment, progress: db.progress.find(p => p.user_id === actor.id && p.lesson_code === lesson.code) ?? null, submissions: db.submissions.filter(s => s.user_id === actor.id && s.lesson_code === lesson.code), previous:siblings[index-1]?sanitize(siblings[index-1]):null,next:siblings[index+1]?sanitize(siblings[index+1]):null }; break
      }
      case 'library': {
        const p = page(ordered(db.entities.filter(n => n.kind === 'source' && visibleSource(n) && matches(n) && (!payload.language || n.data.language===payload.language) && (!payload.source_type || (n.data.source_type ?? n.data.kind ?? n.data.type)===payload.source_type))))
        result = { sources: p.rows.map(n=>sanitize(n)), total: p.total }; break
      }
      case 'my': {
        const enrollments = db.enrollments.filter(e => e.user_id === actor.id).map(e => ({ ...e, course: sanitize(find(e.course_code)), progress: summary(e.course_code) }))
        result = { enrollments, progress: db.progress.filter(p => p.user_id === actor.id), submissions: db.submissions.filter(s => s.user_id === actor.id), certificates: db.certificates.filter(c => c.user_id === actor.id), placements: db.placements.filter(p => p.user_id === actor.id) }; break
      }
      case 'enroll': {
        const course = find(payload.code,'course')
        if (course.state === 'archived') failure('not_found')
        const existing = enrolled(course.code)
        if (existing?.state === 'active' || existing?.state === 'completed') { result = existing; break }
        const ready = course.state === 'published'
        if (ready&&!eligible(course.code)) failure('prerequisite_required')
        result = existing ?? { id: uid(), user_id: actor.id, course_code: course.code, enrolled_at: now() }
        result.state = ready ? 'active' : 'waiting'
        if (!existing) db.enrollments.push(result)
        changed = true; break
      }
      case 'complete': {
        const lesson = access(payload.code,true)
        const assessments=children(lesson.code,'assessment').filter(n=>n.state==='published')
        if (assessments.some(a=>!db.attempts.some(t=>t.user_id===actor.id&&t.assessment_code===a.code&&t.version===a.version&&t.state==='passed')&&!db.submissions.some(s=>s.user_id===actor.id&&s.assessment_code===a.code&&s.assessment_version===a.version&&s.state==='passed'))) failure('assessment_required')
        if (!assessments.length && reviewed.has(lesson.data.format ?? lesson.data.primary_format)) failure('review_required')
        if (!assessments.length && ((lesson.data.format ?? lesson.data.primary_format) === 'knowledge_check' || lesson.data.assessment)) failure('quiz_required')
        if (!(lesson.data.content_blocks ?? lesson.data.blocks)?.length) failure('content_required')
        result = finishLesson(lesson); changed = true; break
      }
      case 'quiz_start': {
        const resolved=assessmentAccess(payload.code),lesson=resolved.lesson,assessment=resolved.config
        if (!assessment?.questions?.length) failure('assessment_not_configured')
        const limit = Number(assessment.max_attempts) || 3
        const all = db.attempts.filter(a => a.user_id === actor.id && a.assessment_code === resolved.code)
        let attempt = all.find(a => a.state === 'started' && a.version===resolved.version)
        if (!attempt) {
          if (all.length >= limit) failure('attempt_limit')
          attempt = { id: uid(), user_id: actor.id, lesson_code: lesson?.code, assessment_code:resolved.code,state: 'started', version: resolved.version, assessment: copy(assessment), created_at: now() }; db.attempts.push(attempt)
        }
        result = { id:attempt.id,attempt_id: attempt.id, questions: assessment.questions.map((q: Row) => ({id:q.id,prompt:q.prompt ?? q.q, choices:q.choices ?? q.options, type:q.type ?? 'mcq' })), passing_score: assessment.passing_score ?? 70 }
        changed = true; break
      }
      case 'quiz_submit': {
        const attempt = db.attempts.find(a => a.id === payload.attempt_id && a.user_id === actor.id) ?? failure('not_found')
        assessmentAccess(attempt.assessment_code ?? attempt.lesson_code)
        if (attempt.state !== 'started') { result = attempt.result; break }
        const questions = attempt.assessment.questions
        if (!Array.isArray(payload.answers) || payload.answers.length !== questions.length) failure('invalid_answers')
        const hits = questions.map((q: Row,i: number) => gradeAcademyAnswer(q,payload.answers[i]))
        const score = Math.round(hits.filter(Boolean).length/questions.length*100), passed = score >= (attempt.assessment.passing_score ?? 70)
        attempt.state = passed ? 'passed' : 'failed'
        attempt.result = { id:attempt.id,attempt_id: attempt.id, state: attempt.state, score, passed }
        result = attempt.result; changed = true; break
      }
      case 'submission_save': case 'submission_submit': {
        if(action==='submission_submit' && payload.submission_id){
          const row=db.submissions.find(s=>s.id===payload.submission_id && s.user_id===actor.id)??failure('not_found')
          assessmentAccess(row.assessment_code ?? row.lesson_code)
          if(row.state!=='draft')failure('already_submitted')
          if(!row.artifact?.text?.trim()&&!row.artifact?.url)failure('artifact_required')
          row.state='submitted';row.submitted_at=now();result=row;changed=true;break
        }
        const resolved=assessmentAccess(payload.code),lesson=resolved.lesson
        if (!['assignment','capstone'].includes(resolved.config?.kind) && (!lesson || !reviewed.has(lesson.data.format ?? lesson.data.primary_format))) failure('submission_not_allowed')
        const text = String(payload.artifact?.text ?? payload.text ?? '').trim(), rawUrl=payload.artifact?.url ?? payload.artifact_url, artifact = rawUrl ? safeAcademyUrl(rawUrl) : null
        if (text.length > 20000 || (rawUrl && !artifact)) failure('invalid_submission')
        if (action === 'submission_submit' && !text && !artifact) failure('artifact_required')
        const old = db.submissions.filter(s => s.user_id === actor.id && s.assessment_code === resolved.code)
        if (old.some(s => s.state === 'submitted')) failure('already_submitted')
        let row = old.find(s => s.state === 'draft')
        const rubric=resolved.config?.rubric_code ? find(resolved.config.rubric_code,'rubric').data : lesson?.data.rubric ?? {}
        if (!row) { row = { id:uid(),user_id:actor.id,assessment_code:resolved.code,lesson_code:lesson?.code,course_code:courseFor(find(resolved.code)).code,version:old.length+1,assessment_version:resolved.version,rubric_snapshot:copy(rubric),rubric:copy(rubric),reviews:[],created_at:now() };db.submissions.push(row) }
        Object.assign(row,{text,artifact_url:artifact,artifact:{text,url:artifact},state:action === 'submission_submit' ? 'submitted':'draft',submitted_at:action === 'submission_submit' ? now():null})
        result = row; changed = true; break
      }
      case 'submission': {
        const submission = db.submissions.find(s => s.id === payload.id && (s.user_id === actor.id || actor.is_admin)) ?? failure('not_found')
        result = submission; break
      }
      case 'review_queue': {
        reviewer(); result = { submissions:db.submissions.filter(s => s.state === 'submitted'&&(actor.is_admin||s.assigned_to===actor.id)),rubrics:db.entities.filter(e => e.kind === 'rubric'),placements:actor.is_admin?db.placements.filter(p => (p.status??p.state) === 'pending'):[] }; break
      }
      case 'review': {
        reviewer()
        const submission = db.submissions.find(s => s.id === payload.submission_id) ?? failure('not_found')
        if (submission.state !== 'submitted') failure('submission_not_pending')
        if (submission.user_id === actor.id) failure('self_review_forbidden')
        if(!actor.is_admin&&submission.assigned_to!==actor.id)failure('forbidden')
        if (!['passed','needs_revision','failed'].includes(payload.decision)) failure('invalid_decision')
        const values = Object.values(payload.scores ?? {})
        if (!values.length || values.some(v => typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100)) failure('invalid_scores')
        const criteria = submission.rubric.criteria ?? []
        let score = values.reduce<number>((a,b) => a+Number(b),0)/values.length
        if (criteria.length) {
          if (criteria.some((c: Row) => typeof payload.scores[c.code ?? c.key] !== 'number')) failure('invalid_scores')
          const weight = criteria.reduce((a: number,c: Row) => a+Number(c.max_score ?? c.weight ?? 100),0)
          score = criteria.reduce((a: number,c: Row) => a+payload.scores[c.code ?? c.key],0)/weight*100
          if (criteria.some((c:Row)=>payload.scores[c.code??c.key]>(c.max_score??100)))failure('invalid_scores')
          if (payload.decision === 'passed' && criteria.some((c: Row) => c.critical && payload.scores[c.code ?? c.key] < (c.max_score ?? c.min_score ?? 100))) failure('critical_gate_failed')
        }
        if (payload.decision === 'passed' && score < 70) failure('passing_score_required')
        if(payload.decision==='passed'&&(submission.rubric.critical_gates??[]).some((g:string)=>payload.gates?.[g]!==true))failure('critical_gate_failed')
        const before = copy(submission)
        submission.state = payload.decision
        submission.reviews.push({id:uid(),reviewer_id:actor.id,decision:payload.decision,scores:copy(payload.scores),score,feedback:String(payload.feedback ?? '').slice(0,20000),rubric_version:submission.rubric.version ?? 1,created_at:now()})
        record('review',submission.id,before,copy(submission)); result = submission; changed = true; break
      }
      case 'placement': {
        if(payload.placement_id){
          admin();const row=db.placements.find(p=>p.id===payload.placement_id)??failure('not_found')
          if(row.user_id===actor.id||!['passed','failed'].includes(payload.state))failure('forbidden')
          row.state=payload.state;row.status=payload.state==='passed'?'approved':'rejected';row.reviewer_id=actor.id;result=row;changed=true;break
        }
        payload.course_code??=payload.code
        find(payload.course_code,'course')
        if (!safeAcademyUrl(payload.evidence_url)) failure('evidence_required')
        if (db.placements.some(p => p.user_id === actor.id && p.course_code === payload.course_code && p.status === 'pending')) failure('already_submitted')
        result = {id:uid(),user_id:actor.id,course_code:payload.course_code,evidence_url:safeAcademyUrl(payload.evidence_url),status:'pending',created_at:now()};db.placements.push(result);changed=true;break
      }
      case 'placement_review': {
        admin(); const row = db.placements.find(p => p.id === payload.id) ?? failure('not_found')
        if (row.user_id === actor.id) failure('self_review_forbidden')
        if (!['approved','rejected'].includes(payload.status)) failure('invalid_status')
        row.status=payload.status;row.reviewer_id=actor.id;result=row;changed=true;break
      }
      case 'certificate': {
        const course = find(payload.code,'course')
        if(course.state!=='published')failure('not_published')
        if(!eligible(course.code))failure('prerequisite_required')
        if (summary(course.code).state !== 'completed') failure('course_incomplete')
        const capstones=db.entities.filter(e=>e.kind==='assessment'&&e.data.kind==='capstone'&&courseFor(e).code===course.code)
        if (!capstones.length || capstones.some(l => !db.submissions.some(s => s.user_id === actor.id && s.assessment_code === l.code && s.state === 'passed'))) failure('capstone_required')
        let certificate=db.certificates.find(c => c.user_id === actor.id && c.course_code === course.code)
        if (!certificate) {certificate={code:uid(),user_id:actor.id,course_code:course.code,course_version:course.version,issued_at:now()};db.certificates.push(certificate)}
        result=certificate;changed=true;break
      }
      case 'admin_list': {
        editor();const p=page(ordered(db.entities.filter(n => (!payload.kind || n.kind === payload.kind) && (!payload.parent_code || n.parent_code === payload.parent_code) && matches(n))))
        result={entities:p.rows,total:p.total};break
      }
      case 'admin_save': {
        editor();const entity=copy(payload.entity) as AcademyEntity
        if (!entity || !/^[A-Za-z0-9][A-Za-z0-9:_-]{0,99}$/.test(entity.code) || !kinds.has(entity.kind) || !states.has(entity.state) || !entity.title?.trim() || entity.title.length>300) failure('invalid_entity')
        const old=db.entities.find(n => n.code === entity.code)
        if (old && (old.version !== payload.expected_version || old.kind !== entity.kind)) failure('version_conflict')
        if (!old && Number(payload.expected_version)!==0) failure('version_conflict')
        const parentKind={course:'direction',module:'course',lesson:'module'}[entity.kind as 'course'|'module'|'lesson']
        if(entity.kind==='assessment'){
          if(!entity.parent_code||!['lesson','course'].includes(find(entity.parent_code).kind))failure('invalid_parent')
        }else if ((parentKind && entity.kind !== 'course') || entity.parent_code) {
          if (!entity.parent_code || find(entity.parent_code).kind !== parentKind) failure('invalid_parent')
        }
        entity.data ??= {}
        if(entity.kind==='lesson')localizedBlocks(entity.data)
        if (entity.kind==='lesson' && !formats.has(entity.data.format ?? entity.data.primary_format)) failure('invalid_format')
        if (entity.kind==='source' && !safeAcademyUrl(entity.data.url ?? entity.data.canonical_url)) failure('invalid_url')
        if (entity.kind==='lesson' && entity.state==='published') {
          const blocks=entity.data.content_blocks ?? entity.data.blocks
          if (!Array.isArray(blocks) || !blocks.length || resolveBlocks(blocks).every((b: Row) => !String(b.text ?? b.body ?? b.markdown ?? b.content ?? b.url ?? b.task ?? '').trim())) failure('content_required')
          for (const block of blocks) if (['video','link','file','embed'].includes(block.type) && !safeAcademyUrl(block.url)) failure('invalid_url')
          if ((entity.data.format ?? entity.data.primary_format)==='knowledge_check' && !entity.data.assessment?.questions?.length && !children(entity.code,'assessment').some(a=>a.state==='published'&&a.data.kind==='quiz')) failure('assessment_required')
        }
        if(entity.kind==='assessment' && entity.state==='published'){
          if(['quiz','placement'].includes(entity.data.kind)){
            const questions=entity.data.questions
            if(!Array.isArray(questions)||!questions.length||questions.some(q=>!validAcademyQuestion(q)))failure('assessment_required')
          }else if(['assignment','capstone'].includes(entity.data.kind)){
            if(!entity.data.rubric_code||find(entity.data.rubric_code,'rubric').state!=='published')failure('rubric_required')
          }else failure('assessment_required')
        }
        if(payload.links){
          if(!Array.isArray(payload.links))failure('invalid_links')
          for(const link of payload.links){
            find(link.source_code,'source')
            if(!['internal','student','public'].includes(link.visibility)||Number(link.start_seconds??0)<0)failure('invalid_links')
            const target={...copy(link),target_code:link.target_code||entity.code}
            const targetNode=target.target_code===entity.code?entity:find(target.target_code)
            if(!['lesson','module','course'].includes(targetNode.kind))failure('invalid_links')
            db.links=db.links.filter(l=>!(l.source_code===target.source_code&&l.target_code===target.target_code&&l.usage===target.usage&&(l.start_seconds??0)===(target.start_seconds??0)))
            db.links.push(target)
          }
        }
        entity.seed_managed=false;entity.version=(old?.version ?? 0)+1;entity.position=Number(entity.position)||0
        const before=old ? copy(old):null
        if (old) db.entities.splice(db.entities.indexOf(old),1,entity);else db.entities.push(entity)
        record('save',entity.code,before,copy(entity));result=entity;changed=true;break
      }
      case 'admin_reorder': {
        editor();const siblings=children(payload.parent_code,payload.kind)
        if (!Array.isArray(payload.codes) || new Set(payload.codes).size!==payload.codes.length || payload.codes.length!==siblings.length || payload.codes.some((code: string) => !siblings.some(s => s.code===code))) failure('invalid_order')
        for (let i=0;i<payload.codes.length;i++) {const entity=find(payload.codes[i]);entity.position=i+1;entity.version++;entity.seed_managed=false}
        record('reorder',payload.parent_code,null,payload.codes);result={ok:true};changed=true;break
      }
      case 'admin_import': {
        admin();const incoming=payload as AcademySeed
        if (!Array.isArray(incoming.entities) || !Array.isArray(incoming.links) || !Array.isArray(incoming.prerequisites)) failure('invalid_import')
        const codes=new Set(incoming.entities.map(n => n.code))
        if (codes.size!==incoming.entities.length) failure('duplicate_code')
        const graph=new Map<string,string[]>()
        for(const edge of incoming.prerequisites){
          if(!incoming.entities.some(n=>n.kind==='course'&&n.code===edge.course_code)&&!db.entities.some(n=>n.kind==='course'&&n.code===edge.course_code))failure('invalid_prerequisite')
          if(!incoming.entities.some(n=>n.kind==='course'&&n.code===edge.requires_code)&&!db.entities.some(n=>n.kind==='course'&&n.code===edge.requires_code))failure('invalid_prerequisite')
          graph.set(edge.course_code,[...(graph.get(edge.course_code)??[]),edge.requires_code])
        }
        const visited=new Set<string>(),active=new Set<string>()
        const visit=(code:string)=>{if(active.has(code))failure('prerequisite_cycle');if(visited.has(code))return;active.add(code);for(const parent of graph.get(code)??[])visit(parent);active.delete(code);visited.add(code)}
        for(const code of graph.keys())visit(code)
        let inserted=0,updated=0,skipped=0
        for (const item of incoming.entities) {
          if (!kinds.has(item.kind) || !states.has(item.state) || !item.title || (item.parent_code && !codes.has(item.parent_code) && !db.entities.some(n => n.code===item.parent_code))) failure('invalid_import')
          const existing=db.entities.find(n => n.code===item.code)
          if (existing && !existing.seed_managed) {skipped++;continue}
          const next={...copy(item),seed_managed:true,state:'outline' as const,version:existing?.version ?? 1}
          if (existing) {db.entities.splice(db.entities.indexOf(existing),1,next);updated++}else{db.entities.push(next);inserted++}
        }
        for (const link of incoming.links) {find(link.source_code,'source');find(link.target_code)}
        const linkKeys=new Set(db.links.map(l=>JSON.stringify([l.source_code,l.target_code,l.usage,l.start_seconds??0])))
        for(const link of incoming.links){const key=JSON.stringify([link.source_code,link.target_code,link.usage,link.start_seconds??0]);if(!linkKeys.has(key)){db.links.push({...copy(link),visibility:'internal'});linkKeys.add(key)}}
        db.prerequisites=copy(incoming.prerequisites)
        result={inserted,updated,skipped,dry_run:!!payload.dry_run};changed=!payload.dry_run
        if (changed) record('import','curriculum',null,result)
        break
      }
      default: failure('unknown_action')
    }
    const event=({catalog:'catalog_view',course:'course_view',enroll:'enrolled',lesson:'lesson_open',quiz_start:'quiz_started',quiz_submit:'quiz_passed',submission_submit:'submission_submitted',complete:'lesson_completed',certificate:'certificate_issued'} as Record<string,string>)[action]
    if(event&&!(action==='quiz_submit'&&!result.passed)&&!db.events.some(e=>e.user_id===actor.id&&e.event===event&&e.entity_code===(action==='catalog'?'catalog':actionNode?.code??null))){db.events.push({user_id:actor.id,event,entity_code:action==='catalog'?'catalog':actionNode?.code??null,created_at:now()});changed=true}
    if (changed) storage.save(db)
    return copy(result)
  }
}
