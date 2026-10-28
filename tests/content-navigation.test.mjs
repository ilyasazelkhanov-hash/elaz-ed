import test from 'node:test'
import assert from 'node:assert/strict'
import {isBlogPost,blogPostEntry,postDate} from '../src/lib/content.ts'
import {parseReadPosts} from '../src/lib/blog-read.ts'

test('blog classification keeps original storage compatible while separating posts from course lessons',()=>{
 assert.equal(isBlogPost({kind:'lesson',course_id:null}),true)
 assert.equal(isBlogPost({kind:'lesson'}),true)
 assert.equal(isBlogPost({kind:'lesson',course_id:17}),false)
 assert.equal(isBlogPost({kind:'story',course_id:null}),false)
 assert.equal(isBlogPost(undefined),false)
})
test('blog links reject malformed IDs and dates never break an article card',()=>{
 assert.equal(blogPostEntry('#/blog/17'),17)
 for(const hash of ['#/blog/0','#/blog/01','#/blog/-1','#/blog/9007199254740992','#/blog/1/extra','#/blog'])assert.equal(blogPostEntry(hash),null)
 assert.equal(postDate('invalid date'),'');assert.equal(postDate(null),'')
 assert.match(postDate('2026-10-28T12:00:00Z'),/28/)
})
test('local read markers tolerate corrupt storage and remain bounded',()=>{
 assert.deepEqual(parseReadPosts('[1,1,0,"2",2,-1,null,9007199254740992]'),[1,2])
 assert.deepEqual(parseReadPosts('{"wrong":"shape"}'),[])
 assert.deepEqual(parseReadPosts('broken'),[])
 assert.deepEqual(parseReadPosts(null),[])
 const ids=parseReadPosts(JSON.stringify(Array.from({length:600},(_,i)=>i+1)))
 assert.equal(ids.length,500);assert.equal(ids[0],101)
})
