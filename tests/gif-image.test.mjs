import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {validateGifImage,GIF_IMAGE_LIMITS} from '../scripts/lib/gif-image.mjs'
import {verifyNewsImage} from '../scripts/publish-news.mjs'

const u16=value=>[value&255,value>>8]
const palette=Buffer.from([0,0,0,255,255,255])
function header({version='GIF89a',width=1,height=1,globalPalette=true}={}){
 return Buffer.concat([Buffer.from(version),Buffer.from([...u16(width),...u16(height),globalPalette?0x80:0,0,0]),globalPalette?palette:Buffer.alloc(0)])
}
function pack(entries){
 const bytes=Buffer.alloc(Math.ceil(entries.reduce((sum,[,size])=>sum+size,0)/8))
 let position=0
 for(const [code,size] of entries)for(let bit=0;bit<size;bit++,position++)bytes[position>>3]|=((code>>bit)&1)<<(position&7)
 return bytes
}
function blocks(data,size=255){
 const result=[]
 for(let i=0;i<data.length;i+=size){const chunk=data.subarray(i,i+size);result.push(Buffer.from([chunk.length]),chunk)}
 return Buffer.concat([...result,Buffer.from([0])])
}
const singlePixel=()=>pack([[4,3],[0,3],[5,3]])
function frame({left=0,top=0,width=1,height=1,flags=0,minimum=2,data=singlePixel(),blockSize=255}={}){
 return Buffer.concat([Buffer.from([0x2c,...u16(left),...u16(top),...u16(width),...u16(height),flags]),flags&0x80?palette:Buffer.alloc(0),Buffer.from([minimum]),blocks(data,blockSize)])
}
const gce=(delay=5,flags=0,index=0)=>Buffer.from([0x21,0xf9,4,flags,...u16(delay),index,0])
const gif=(parts=[frame()],options={})=>Buffer.concat([header(options),...parts,Buffer.from([0x3b])])
const app=(name='NETSCAPE2.0',data=Buffer.from([1,0,0]))=>Buffer.concat([Buffer.from([0x21,0xff,11]),Buffer.from(name),blocks(data)])
const comment=text=>Buffer.concat([Buffer.from([0x21,0xfe]),blocks(Buffer.from(text))])
const publicDns=async()=>[{address:'93.184.216.34',family:4}]
const response=(bytes,type='image/gif',options={})=>new Response(bytes,{...options,headers:{'content-type':type,'content-length':String(bytes.length),...options.headers}})
const verify=(bytes,options={})=>verifyNewsImage('https://cdn.example.org/cover.gif',{resolveHost:publicDns,fetcher:async()=>response(bytes),...options})

test('GIF87a and GIF89a parse fully, including small, local-palette and interlaced images',()=>{
 for(const version of ['GIF87a','GIF89a'])assert.deepEqual(validateGifImage(gif(undefined,{version})),{width:1,height:1,frames:1,durationMs:0,totalFramePixels:1})
 assert.equal(validateGifImage(gif([frame({flags:0xc0})],{globalPalette:false})).frames,1)
 assert.equal(validateGifImage(gif([frame({data:singlePixel(),blockSize:1})])).frames,1)
})

test('animation controls, comments and loop extensions are parsed with single-cycle duration',()=>{
 const bytes=gif([app(),comment('An animated news cover'),gce(5,5,1),frame(),gce(20,12),frame()])
 assert.deepEqual(validateGifImage(bytes),{width:1,height:1,frames:2,durationMs:250,totalFramePixels:2})
 assert.equal(validateGifImage(gif([app('ANIMEXTS1.0'),frame()])).frames,1)
 // Unknown application payloads are bounded and skipped, not interpreted as images.
 assert.equal(validateGifImage(gif([app('EXAMPLE1.00',Buffer.from([1,2,3,4])),frame()])).frames,1)
 const text=Buffer.from([0x21,1,12,0,0,0,0,1,0,1,0,1,1,1,0,1,65,0])
 assert.equal(validateGifImage(gif([gce(10),text,frame()])).durationMs,100)
})

test('truncation at every byte, missing frames, trailer junk and spoofed GIF headers fail closed',()=>{
 const bytes=gif([app(),comment('cover'),gce(),frame(),gce(),frame()])
 for(let end=0;end<bytes.length;end++)assert.throws(()=>validateGifImage(bytes.subarray(0,end)),/cover_image_gif_/)
 for(const bad of [gif([]),Buffer.concat([gif(),Buffer.from('<html>')]),Buffer.from('GIF89a'+'x'.repeat(500))])assert.throws(()=>validateGifImage(bad),/cover_image_gif_/)
 const highBits=gif();highBits[0]|=0x80
 assert.throws(()=>validateGifImage(highBits),/gif_signature/)
})

test('malformed blocks, palettes and frame bounds are rejected',()=>{
 const cases=[
  gif([frame()],{globalPalette:false}),
  gif([frame({left:1})]),gif([frame({top:1})]),gif([frame({width:0})]),gif([frame({height:0})]),gif([frame({flags:0x08})]),
  gif([gce(5,0x80),frame()]),gif([gce(5,16),frame()]),gif([gce(),gce(),frame()]),gif([frame(),gce()]),
  gif([Buffer.from([0x21,0xf9,3,0,0,0,0,0]),frame()]),gif([Buffer.from([0x21,0xf9,4,0,0,0,0,1]),frame()]),
  gif([Buffer.from([0x21,0xff,10]),frame()]),gif([app('NETSCAPE2.0',Buffer.from([0,0,0])),frame()]),
  gif([Buffer.from([0x21,0xee,0]),frame()]),gif([Buffer.from([0x21,1,0]),frame()]),
 ]
 const background=gif();background[11]=2;cases.push(background)
 for(const bytes of cases)assert.throws(()=>validateGifImage(bytes),/cover_image_gif_/)
})

test('LZW validates clear/end codes, dictionary references, palette indices and exact pixel counts',()=>{
 const bad=[
  frame({minimum:1}),frame({minimum:9}),frame({data:Buffer.alloc(0)}),
  frame({data:pack([[0,3],[5,3]])}), // No initial clear code.
  frame({data:pack([[4,3],[5,3]])}), // No pixels.
  frame({data:pack([[4,3],[0,3]])}), // No end code.
  frame({data:pack([[4,3],[7,3],[5,3]])}), // Nonexistent dictionary entry.
  frame({data:pack([[4,3],[2,3],[5,3]])}), // Index outside the color table.
  frame({data:pack([[4,3],[0,3],[0,3],[5,3]])}), // Too many pixels.
  frame({width:2}), // Too few pixels.
  frame({data:Buffer.concat([singlePixel(),Buffer.from([0,0])])}), // Hidden data after EOI.
 ]
 for(const value of bad)assert.throws(()=>validateGifImage(gif([value],{width:2})),/gif_(lzw|palette)/)
 // Transparent literals are never looked up in the color table.
 assert.equal(validateGifImage(gif([gce(5,1,2),frame({data:pack([[4,3],[2,3],[5,3]])})])).frames,1)
 assert.throws(()=>validateGifImage(gif([gce(5,1,3),frame({data:pack([[4,3],[2,3],[5,3]])})])),/gif_palette/)
 // A valid reference to the entry being created, followed by a code-width increase.
 assert.equal(validateGifImage(gif([frame({width:6,data:pack([[4,3],[0,3],[6,3],[7,3],[5,4]])})],{width:6})).width,6)
 // Multiple clear codes reset the dictionary and width without losing output pixels.
 assert.equal(validateGifImage(gif([frame({width:2,data:pack([[4,3],[0,3],[4,3],[4,3],[1,3],[5,3]])})],{width:2})).width,2)
 // Common encoder flush: EOI ends exactly on a byte boundary, then one zero byte.
 const exact=pack([[4,3],[0,3],[1,3],[0,3],[1,4],[0,4],[5,4]])
 assert.equal(exact.length,3)
 assert.equal(validateGifImage(gif([frame({width:5,data:Buffer.concat([exact,Buffer.from([0])])})],{width:5})).width,5)
 assert.throws(()=>validateGifImage(gif([frame({width:5,data:Buffer.concat([exact,Buffer.from([1])])})],{width:5})),/gif_lzw/)
})

test('LZW handles every code width, a full 4096-entry dictionary and a late reset',()=>{
 const entries=[[256,9]]
 for(const [count,size] of [[255,9],[512,10],[1024,11],[2048,12],[10,12]])for(let i=0;i<count;i++)entries.push([0,size])
 entries.push([256,12],[1,9],[257,9])
 const pixels=3850
 assert.equal(validateGifImage(gif([frame({width:pixels,minimum:8,data:pack(entries)})],{width:pixels})).width,pixels)
})

test('GIF resource limits bound bytes, canvas size, frames, composited pixels and duration',()=>{
 assert.throws(()=>validateGifImage(Buffer.alloc(GIF_IMAGE_LIMITS.maxBytes+1)),/gif_size/)
 for(const options of [{width:0},{height:0},{width:4097},{height:4097},{width:4096,height:4096}])assert.throws(()=>validateGifImage(gif(undefined,options)),/gif_dimensions/)
 assert.equal(validateGifImage(gif(Array.from({length:300},()=>frame()))).frames,300)
 assert.throws(()=>validateGifImage(gif(Array.from({length:301},()=>frame()))),/gif_frames/)
 // Even tiny optimized rectangles require full canvas compositing surfaces.
 assert.equal(validateGifImage(gif(Array.from({length:100},()=>frame()),{width:1000,height:1000})).totalFramePixels,100_000_000)
 assert.throws(()=>validateGifImage(gif(Array.from({length:101},()=>frame()),{width:1000,height:1000})),/gif_pixels/)
 assert.equal(validateGifImage(gif([gce(6000),frame()])).durationMs,60_000)
 assert.throws(()=>validateGifImage(gif([gce(6001),frame()])),/gif_duration/)
 assert.throws(()=>validateGifImage(gif([gce(4000),frame(),gce(2001),frame()])),/gif_duration/)
})

test('publisher accepts complete GIFs, requests their MIME and preserves the verified byte hash',async()=>{
 for(const version of ['GIF87a','GIF89a']){
  const bytes=gif([gce(),frame(),gce(),frame()],{version})
  const result=await verify(bytes,{fetcher:async(url,options)=>{
   assert.equal(url,'https://cdn.example.org/cover.gif')
   assert.match(options.headers.Accept,/(?:^|,)image\/gif(?:,|$)/)
   assert.equal(options.headers.Range,'bytes=0-2097151')
   assert.deepEqual(options.addresses,[{address:'93.184.216.34',family:4}])
   return response(bytes,'IMAGE/GIF; charset=binary')
  }})
  assert.deepEqual(result,{mime:'image/gif',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')})
 }
})

test('publisher rejects spoofed, malformed, oversized and partial GIF responses',async()=>{
 const good=gif([comment('x'.repeat(300)),frame()])
 for(const bytes of [good.subarray(0,-1),Buffer.from('GIF89a'+'.'.repeat(300)),gif([frame({data:pack([[4,3],[7,3],[5,3]])})]),Buffer.alloc(GIF_IMAGE_LIMITS.maxBytes+1)])await assert.rejects(verify(bytes),/cover_image_/)
 for(const type of ['image/jpeg','image/png','image/webp','image/svg+xml','text/html'])await assert.rejects(verify(good,{fetcher:async()=>response(good,type)}),/cover_image_(gif_url|mime)/)
 await assert.rejects(verify(good,{fetcher:async()=>response(good,'image/gif',{status:206,headers:{'content-range':`bytes 0-${good.length-1}/${good.length+1}`}})}),/cover_image_range/)
 await assert.rejects(verify(good,{fetcher:async()=>response(good,'image/gif',{headers:{'content-length':String(good.length+1)}})}),/cover_image_size/)
 await assert.rejects(verify(good,{fetcher:async()=>response(gif([frame()],{width:65535}))}),/gif_dimensions/)
})

test('GIF support preserves private-address, redirect and timeout protections',async()=>{
 const good=gif()
 let requests=0
 await assert.rejects(verify(good,{resolveHost:async()=>[{address:'127.0.0.1',family:4}],fetcher:async()=>{requests++;return response(good)}}),/cover_image_private_address/)
 assert.equal(requests,0)
 await assert.rejects(verify(good,{fetcher:async()=>new Response(null,{status:302,headers:{location:'https://127.0.0.1/cover.gif'}})}),/cover_image_private_address/)
 await assert.rejects(verify(good,{timeoutMs:10,fetcher:async()=>new Promise(()=>{})}),/cover_image_timeout/)
 const partial=new ReadableStream({start(controller){controller.enqueue(good.subarray(0,13))}})
 await assert.rejects(verify(good,{timeoutMs:10,fetcher:async()=>new Response(partial,{headers:{'content-type':'image/gif'}})}),/cover_image_timeout/)
})

// Independent Pillow encoder fixture: 96×64, four colors, growing LZW dictionary.
test('validates an independently encoded GIF rather than only test-built code streams',()=>{
 const bytes=Buffer.from('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','base64')
 assert.deepEqual(validateGifImage(bytes),{width:96,height:64,frames:1,durationMs:0,totalFramePixels:6144})
})


test('the persisted URL must identify GIF media regardless of the redirect target',async()=>{
 const good=gif(),options={resolveHost:publicDns,fetcher:async()=>response(good)}
 await assert.rejects(verifyNewsImage('https://cdn.example.org/opaque',options),/cover_image_gif_url/)
 for(const url of ['https://cdn.example.org/a.GIF?signature=keep','https://cdn.example.org/opaque?fm=gif','https://cdn.example.org/opaque?format=gif'])assert.equal((await verifyNewsImage(url,options)).mime,'image/gif')
 let requests=0
 assert.equal((await verifyNewsImage('https://cdn.example.org/cover.gif',{resolveHost:publicDns,fetcher:async url=>{
  requests++
  if(requests===1)return new Response(null,{status:302,headers:{location:'https://assets.example.org/opaque'}})
  assert.equal(url,'https://assets.example.org/opaque')
  return response(good)
 }})).mime,'image/gif')
 const jpeg=Buffer.alloc(512,1);Buffer.from([255,216,255]).copy(jpeg);jpeg[510]=255;jpeg[511]=217
 await assert.rejects(verify(good,{fetcher:async()=>response(jpeg,'image/jpeg')}),/cover_image_gif_url/)
 // Redirects must not disguise an originally static URL as safe animated media.
 requests=0
 await assert.rejects(verifyNewsImage('https://cdn.example.org/opaque',{resolveHost:publicDns,fetcher:async()=>++requests===1?new Response(null,{status:302,headers:{location:'https://assets.example.org/cover.gif'}}):response(good)}),/cover_image_gif_url/)
})
