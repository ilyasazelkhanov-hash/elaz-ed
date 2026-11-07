import test from 'node:test'
import assert from 'node:assert/strict'
import { discoveryEvent, guideEvent, guideStartParam, parseGuideStartParam, normalizeDiscoverySource } from '../src/lib/discovery-events.ts'

test('guide telemetry contains identity and explicit revision, never learner text', () => {
 assert.deepEqual(guideEvent('open','first-request','free_start'), {name:'guide_open',props:{guide_id:'first-request',content_version:'free-guides-v1',source:'free_start'}})
 assert.equal(guideEvent('try','unknown','free_start'),null)
 assert.deepEqual(discoveryEvent('guide_feedback',{guide_id:'first-request',source:'home',useful:false,prompt:'private',answer:'secret',email:'person@example.org'}),{name:'guide_feedback',props:{guide_id:'first-request',content_version:'free-guides-v1',source:'home',useful:false}})
 assert.equal(discoveryEvent('guide_feedback',{guide_id:'first-request',useful:'yes'}),null)
})

test('course, save and checkout events reject invalid identities and unbounded values',()=>{
 assert.deepEqual(discoveryEvent('checkout_result',{course_id:7,status:'pending',source:'course',content_version:'course-v2',text:'secret'}),{name:'checkout_result',props:{source:'course',course_id:7,content_version:'course-v2',status:'pending'}})
 for(const course_id of [0,-1,Infinity,1.5,'7']) assert.equal(discoveryEvent('course_view',{course_id}),null)
 assert.equal(discoveryEvent('checkout_result',{course_id:7,status:'success'}),null)
 assert.deepEqual(discoveryEvent('blog_save',{saved:true,source:'post',content_version:'x'.repeat(100),title:'private'},42),{name:'blog_save',lesson_id:42,props:{source:'post',saved:true}})
 assert.equal(discoveryEvent('blog_save',{saved:true},-1),null)
 assert.equal(discoveryEvent('blog_save',{saved:true,content_version:'v1\n'},42).props.content_version,undefined)
 assert.equal(discoveryEvent('guide_open',{guide_id:'first-request',source:'private arbitrary source'}).props.source,'direct')
})

test('only exact known guide start parameters produce a source or route',()=>{
 assert.equal(guideStartParam('check-answer'),'g_check-answer')
 assert.deepEqual(parseGuideStartParam('g_first-request'),{guideId:'first-request',source:'telegram_guide'})
 for(const input of ['g_unknown','g_first-request_person@example.org','x_g_first-request','g_first-request\n','g_first-request?email=x',null,{},'g_'+ 'a'.repeat(10000)]) assert.equal(parseGuideStartParam(input),null)
 assert.equal(guideStartParam('unknown'),null)
 assert.equal(normalizeDiscoverySource('home'),'home')
 assert.equal(normalizeDiscoverySource('g_first-request'),'direct')
})
