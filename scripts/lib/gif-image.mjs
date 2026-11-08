// Bound both the download and the decoded/composited animation. Looping is allowed;
// duration is for one pass, not multiplied by the (possibly infinite) loop count.
export const GIF_IMAGE_LIMITS=Object.freeze({
 maxBytes:2*1024*1024,
 maxDimension:4096,
 maxCanvasPixels:8*1024*1024,
 maxTotalFramePixels:100_000_000,
 maxFrames:300,
 maxDurationMs:60_000,
})

const invalid=reason=>{throw Error(`cover_image_gif_${reason}`)}

/** Validate LZW codes without allocating decoded frames or expanding strings. */
function validateLzw(data,minimumCodeSize,pixels,paletteSize,transparent){
 if(minimumCodeSize<2||minimumCodeSize>8||!data.length)invalid('lzw')
 const clear=1<<minimumCodeSize,end=clear+1
 const lengths=new Uint16Array(4096)
 lengths.fill(1,0,clear)
 let position=0,size=minimumCodeSize+1,next=end+1,previous=-1,decoded=0,started=false
 while(position+size<=data.length*8){
  let code=0
  for(let bit=0;bit<size;bit++,position++)code|=((data[position>>3]>>(position&7))&1)<<bit
  if(!started&&code!==clear)invalid('lzw')
  started=true
  if(code===clear){size=minimumCodeSize+1;next=end+1;previous=-1;continue}
  if(code===end){
   // Encoders may flush one zero padding byte when EOI ends on a byte boundary.
   // Otherwise only the unused bits in the last byte may follow EOI.
   const used=Math.ceil(position/8),zeroFlush=position%8===0&&data.length===used+1&&data[used]===0
   if(decoded!==pixels||used!==data.length&&!zeroFlush)invalid('lzw')
   return
  }
  let length
  if(code<clear){
   // A transparent index need not have a physical color-table entry: it never
   // dereferences the palette. Pillow uses this when optimizing delta frames.
   if(code>=paletteSize&&code!==transparent)invalid('palette')
   length=1
  }else if(code<next&&previous!==-1){
   length=lengths[code]
  }else if(code===next&&next<4096&&previous!==-1){
   // The valid KwKwK case references the entry being created by this code.
   length=lengths[previous]+1
  }else invalid('lzw')
  decoded+=length
  if(decoded>pixels)invalid('lzw')
  if(previous!==-1&&next<4096){
   lengths[next]=lengths[previous]+1
   next++
   if(next===(1<<size)&&size<12)size++
  }
  previous=code
 }
 invalid('lzw') // Missing EOI, incomplete code, or a truncated image stream.
}

/** Strict, bounded GIF87a/GIF89a validation, including every frame's LZW data. */
export function validateGifImage(input){
 const bytes=Buffer.isBuffer(input)?input:Buffer.from(input)
 const limits=GIF_IMAGE_LIMITS
 if(bytes.length>limits.maxBytes)invalid('size')
 if(bytes.length<13||!['GIF87a','GIF89a'].includes(bytes.subarray(0,6).toString('latin1')))invalid('signature')
 let position=6
 const requireBytes=count=>{if(position+count>bytes.length)invalid('structure')}
 const byte=()=>{requireBytes(1);return bytes[position++]}
 const word=()=>{requireBytes(2);const value=bytes.readUInt16LE(position);position+=2;return value}
 const skip=count=>{requireBytes(count);position+=count}
 const width=word(),height=word(),packed=byte(),background=byte()
 byte() // Pixel aspect ratio does not affect the decoded size.
 const canvasPixels=width*height
 if(!width||!height||width>limits.maxDimension||height>limits.maxDimension||canvasPixels>limits.maxCanvasPixels)invalid('dimensions')
 const globalPalette=packed&0x80?1<<((packed&7)+1):0
 if(globalPalette){skip(3*globalPalette);if(background>=globalPalette)invalid('palette')}
 const subblocks=()=>{
  const start=position
  let length,total=0
  while((length=byte())){skip(length);total+=length}
  // Avoid an array of up to a million tiny slices from adversarial subblocks.
  const data=Buffer.allocUnsafe(total)
  for(let source=start,target=0;bytes[source];){
   const length=bytes[source++]
   bytes.copy(data,target,source,source+length)
   source+=length;target+=length
  }
  return data
 }
 let frames=0,rasterFrames=0,durationMs=0,control=null
 const countFrame=()=>{
  frames++
  if(frames>limits.maxFrames)invalid('frames')
  // Count full canvas surfaces, including optimized frames with tiny rectangles.
  if(canvasPixels*frames>limits.maxTotalFramePixels)invalid('pixels')
  durationMs+=control?.delayMs??0
  if(durationMs>limits.maxDurationMs)invalid('duration')
 }
 for(;;){
  const marker=byte()
  if(marker===0x3b){
   if(!rasterFrames||control||position!==bytes.length)invalid('structure')
   return {width,height,frames,durationMs,totalFramePixels:canvasPixels*frames}
  }
  if(marker===0x2c){
   const left=word(),top=word(),frameWidth=word(),frameHeight=word(),flags=byte()
   if(!frameWidth||!frameHeight||left+frameWidth>width||top+frameHeight>height)invalid('dimensions')
   if(flags&0x18)invalid('structure')
   const localPalette=flags&0x80?1<<((flags&7)+1):0
   if(localPalette)skip(3*localPalette)
   const palette=localPalette||globalPalette
   if(!palette)invalid('palette')
   countFrame()
   const minimumCodeSize=byte(),data=subblocks()
   validateLzw(data,minimumCodeSize,frameWidth*frameHeight,palette,control?.transparent)
   rasterFrames++;control=null
   continue
  }
  if(marker!==0x21)invalid('structure')
  const extension=byte()
  if(extension===0xf9){
   if(control||byte()!==4)invalid('structure')
   const flags=byte(),delayMs=word()*10,transparent=byte()
   if(flags&0xe0||((flags>>2)&7)>3||byte()!==0)invalid('structure')
   control={delayMs,transparent:flags&1?transparent:null}
  }else if(extension===0xfe){
   subblocks() // Comment.
  }else if(extension===0xff){
   if(byte()!==11)invalid('structure')
   requireBytes(11)
   const application=bytes.subarray(position,position+11).toString('latin1')
   skip(11)
   const data=subblocks()
   if(['NETSCAPE2.0','ANIMEXTS1.0'].includes(application)&&(data.length!==3||data[0]!==1))invalid('structure')
  }else if(extension===0x01){
   // Plain-text is also a graphic rendering block and consumes its pending GCE.
   if(byte()!==12||!globalPalette)invalid('structure')
   const left=word(),top=word(),textWidth=word(),textHeight=word(),cellWidth=byte(),cellHeight=byte(),foreground=byte(),background=byte()
   if(!textWidth||!textHeight||left+textWidth>width||top+textHeight>height||!cellWidth||!cellHeight)invalid('dimensions')
   if(foreground>=globalPalette&&foreground!==control?.transparent||background>=globalPalette&&background!==control?.transparent)invalid('palette')
   countFrame();subblocks();control=null
  }else invalid('structure')
 }
}
