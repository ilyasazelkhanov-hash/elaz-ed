import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isGifCoverUrl } from '../supabase/functions/_shared/cover-media.ts'
test('GIF media selection handles suffix, signed query strings and explicit CDN formats',()=>{
 for(const url of ['https://example.org/image.gif','https://example.org/IMAGE.GIF?signature=one#two','/image.gif','https://example.org/image?format=gif','https://example.org/image?fm=GIF'])assert.equal(isGifCoverUrl(url),true,url)
 for(const url of [null,undefined,'','https://gif.example.org/image.jpg','https://example.org/image.gif.jpg','https://example.org/image.png?name=image.gif'])assert.equal(isGifCoverUrl(url),false,String(url))
})
test('covers use still canvas frames for reduced motion, controls are not nested in card buttons',()=>{
 const read=p=>readFileSync(new URL(p,import.meta.url),'utf8')
 const cover=read('../src/CoverImage.tsx'),feed=read('../src/screens/home/Feed.tsx')
 assert.match(cover,/prefers-reduced-motion: reduce/);assert.match(cover,/useSyncExternalStore/);assert.match(cover,/getContext\('2d'\)/);assert.match(cover,/drawImage/);assert.match(cover,/setChoice\(!playing\)/);assert.match(cover,/aria-pressed=\{playing\}/)
 assert.match(feed,/<\/Tap>\s*\{card.cover_url && <div[^>]*><CoverImage/)
 for(const p of ['../src/screens/Post.tsx','../src/screens/Lesson.tsx','../src/screens/AdminEditor.tsx'])assert.match(read(p),/<CoverImage/)
})
