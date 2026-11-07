import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanDiscoveryEvent } from '../supabase/functions/api/discovery-events.ts'
import { discoveryEvent } from '../src/lib/discovery-events.ts'

test('server discovery allowlist preserves client contract and drops sensitive/forged properties',()=>{
 for(const name of ['guide_open','guide_copy','guide_try','guide_feedback','blog_save','course_view','course_preview','checkout_start','checkout_result','discovery_open']){
  const event=discoveryEvent(name,{guide_id:'first-request',source:'telegram_guide',useful:true,saved:true,course_id:1,status:'paid'},11)
  assert.ok(event,name)
  assert.deepEqual(cleanDiscoveryEvent({...event,props:{...event.props,prompt:'PRIVATE',answer:'SECRET',user_id:999}}),{name:event.name,lesson_id:event.lesson_id??null,props:event.props})
 }
 assert.equal(cleanDiscoveryEvent({name:'purchase',props:{course_id:1}}),null)
 assert.equal(cleanDiscoveryEvent({name:'guide_try',props:{guide_id:'invented',content_version:'v1'}}),null)
 assert.equal(cleanDiscoveryEvent({name:'checkout_result',props:{course_id:1,status:'success'}}),null)
 assert.equal(cleanDiscoveryEvent({name:'blog_save',lesson_id:-1,props:{saved:true}}),null)
})
