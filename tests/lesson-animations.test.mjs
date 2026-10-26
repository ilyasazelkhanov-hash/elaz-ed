import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {lessonAnimations, lessonAnimationByKey} from '../src/lib/lesson-animations.ts'

test('course animation markers resolve to complete, readable teaching scenes',async()=>{
 const content=JSON.parse(await readFile(new URL('../content/ai-practice-2026-10-25/training.json',import.meta.url),'utf8'))
 const animated=content.lessons.filter(l=>l.body.includes('```lesson-animation'))
 assert.equal(animated.length,10)
 for(const lesson of animated){
  const markers=[...lesson.body.matchAll(/```lesson-animation\n([a-z-]+)\n```/g)]
  assert.equal(markers.length,1,lesson.key)
  const id=markers[0][1];assert.equal(lessonAnimationByKey[lesson.key],id)
  const scene=lessonAnimations[id];assert(scene,lesson.key)
  assert(scene.stages.length>=3&&scene.stages.length<=5)
  assert(scene.title.length>10);assert(scene.takeaway.length>30)
  for(const stage of scene.stages){assert(stage.label.length>2);assert(stage.why.length>25);assert(stage.artifact.length>15)}
  assert(!lesson.body.includes('.gif)'), 'No uncontrolled GIF alongside a controlled animation')
 }
})

test('examples teach failure handling instead of showing only a happy path',()=>{
 const flow=lessonAnimations.workflow
 assert(flow.stages.some(s=>s.frame?.branch==='invalid'))
 assert(flow.stages.some(s=>s.frame?.branch==='duplicate'))
 const form=lessonAnimations.form
 assert(form.stages.some(s=>s.frame?.status==='error'))
 assert(form.stages.some(s=>s.frame?.status==='success'))
 assert(lessonAnimations.schedule.stages.some(s=>s.frame?.status==='paused'))
 const mix=lessonAnimations.mix.stages
 assert(mix.at(-1).frame.music < mix[1].frame.music)
 assert.equal(mix.at(-1).frame.voice,mix[1].frame.voice)
})
