import {inflateSync,deflateSync} from 'node:zlib'
const signature=Buffer.from('89504e470d0a1a0a','hex')
function crc32(bytes){let n=0xffffffff;for(const byte of bytes){n^=byte;for(let k=0;k<8;k++)n=(n>>>1)^((n&1)?0xedb88320:0)}return(n^0xffffffff)>>>0}
function chunk(type,data){const name=Buffer.from(type),length=Buffer.alloc(4),crc=Buffer.alloc(4);length.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([length,name,data,crc])}
export function pngFixture(width,height,rgba,note=''){
 const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6
 const rows=[];for(let y=0;y<height;y++)rows.push(Buffer.from([0]),Buffer.from(rgba.slice(y*width*4,(y+1)*width*4)))
 return Buffer.concat([signature,chunk('IHDR',header),...(note?[chunk('tEXt',Buffer.from('note\0'+note))]:[]),chunk('IDAT',deflateSync(Buffer.concat(rows))),chunk('IEND',Buffer.alloc(0))])
}
export function readPixels(buffer){
 if(!buffer.subarray(0,8).equals(signature))throw Error('invalid_png')
 let cursor=8,width,height,channels,ended=false;const compressed=[]
 while(cursor<buffer.length){if(cursor+12>buffer.length)throw Error('invalid_chunk');const size=buffer.readUInt32BE(cursor),end=cursor+12+size;if(end>buffer.length)throw Error('invalid_chunk');const kind=buffer.subarray(cursor+4,cursor+8).toString(),data=buffer.subarray(cursor+8,cursor+8+size);if(crc32(buffer.subarray(cursor+4,cursor+8+size))!==buffer.readUInt32BE(cursor+8+size))throw Error('invalid_crc')
  if(kind==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);if(!width||!height||width*height>20e6||data[8]!==8||![2,6].includes(data[9])||data[10]||data[11]||data[12])throw Error('unsupported_png');channels=data[9]===6?4:3}
  if(kind==='IDAT')compressed.push(data);if(kind==='IEND'){ended=true;break}cursor=end
 }
 if(!ended||!channels)throw Error('invalid_png')
 const stride=width*channels,raw=inflateSync(Buffer.concat(compressed),{maxOutputLength:(stride+1)*height}),pixels=Buffer.alloc(width*height*4);if(raw.length!==(stride+1)*height)throw Error('invalid_png_rows');let previous=Buffer.alloc(stride)
 const paeth=(a,b,c)=>{const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);return da<=db&&da<=dc?a:db<=dc?b:c}
 for(let y=0;y<height;y++){const filter=raw[y*(stride+1)],row=Buffer.from(raw.subarray(y*(stride+1)+1,(y+1)*(stride+1)));if(filter>4)throw Error('unsupported_filter');for(let x=0;x<stride;x++){const a=x>=channels?row[x-channels]:0,b=previous[x],c=x>=channels?previous[x-channels]:0;row[x]=(row[x]+(filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c)))&255}for(let x=0;x<width;x++){const out=(y*width+x)*4;pixels[out]=row[x*channels];pixels[out+1]=row[x*channels+1];pixels[out+2]=row[x*channels+2];pixels[out+3]=channels===4?row[x*channels+3]:255}previous=row}
 return{width,height,pixels}
}
export function pixelDiff(first,second,{threshold=8,allowedRatio=.005,masks=[]}={}){
 const a=readPixels(first),b=readPixels(second)
 if(a.width!==b.width||a.height!==b.height)return{passed:false,reason:'dimensions_changed'}
 if(!Number.isFinite(threshold)||threshold<0||threshold>255||!Number.isFinite(allowedRatio)||allowedRatio<0||allowedRatio>.1)throw Error('invalid_diff_options')
 const masked=new Set()
 for(const box of masks){if(![box.x,box.y,box.width,box.height].every(Number.isInteger)||box.x<0||box.y<0||box.width<1||box.height<1||box.x+box.width>a.width||box.y+box.height>a.height)throw Error('invalid_mask');for(let y=box.y;y<box.y+box.height;y++)for(let x=box.x;x<box.x+box.width;x++)masked.add(y*a.width+x)}
 if(masked.size/(a.width*a.height)>.1)throw Error('mask_budget')
 let changed=0;for(let p=0;p<a.width*a.height;p++)if(!masked.has(p)&&[0,1,2,3].some(c=>Math.abs(a.pixels[p*4+c]-b.pixels[p*4+c])>threshold))changed++
 const compared=a.width*a.height-masked.size,ratio=changed/compared
 return{passed:ratio<=allowedRatio,changed,compared,masked:masked.size,ratio,threshold,allowedRatio}
}
