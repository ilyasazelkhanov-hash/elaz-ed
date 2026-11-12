import {readFile,writeFile,mkdir,readdir,lstat} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'

export const freshnessLabs = ['mcp-authorization-lab','voice-confirmation-lab']
const root=fileURLToPath(new URL('../',import.meta.url))
const crc32=buffer=>{
 let crc=0xffffffff
 for(const byte of buffer){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}
 return (crc^0xffffffff)>>>0
}

/** Small, dependency-free ZIP writer. Fixed timestamps and sorted paths make releases reproducible. */
export function storedZip(entries){
 const locals=[],central=[];let offset=0
 for(const {name,data}of entries){
  if(!/^[a-zA-Z0-9_.\/-]+$/.test(name)||name.startsWith('/')||name.split('/').some(part=>part==='..'||!part))throw Error('Unsafe archive path')
  const filename=Buffer.from(name),body=Buffer.from(data),crc=crc32(body)
  if(body.length>1024*1024)throw Error('Teaching archive entry too large')
  const header=Buffer.alloc(30)
  header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6)
  header.writeUInt16LE(33+(20<<9),12) // 2000-01-01, 00:00:00
  header.writeUInt32LE(crc,14);header.writeUInt32LE(body.length,18);header.writeUInt32LE(body.length,22);header.writeUInt16LE(filename.length,26)
  locals.push(header,filename,body)
  const record=Buffer.alloc(46)
  record.writeUInt32LE(0x02014b50);record.writeUInt16LE(20,4);record.writeUInt16LE(20,6);record.writeUInt16LE(0x800,8)
  record.writeUInt16LE(33+(20<<9),14);record.writeUInt32LE(crc,16);record.writeUInt32LE(body.length,20);record.writeUInt32LE(body.length,24);record.writeUInt16LE(filename.length,28);record.writeUInt32LE(offset,42)
  central.push(record,filename);offset+=header.length+filename.length+body.length
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22)
 end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16)
 return Buffer.concat([...locals,directory,end])
}

export async function readLabEntries(folder){
 const entries=[]
 async function walk(relative=''){
  const directory=path.join(folder,relative)
  for(const name of (await readdir(directory)).sort()){
   const file=path.join(directory,name),local=relative?relative+'/'+name:name,stat=await lstat(file)
   if(stat.isSymbolicLink())throw Error('Teaching archives cannot contain symlinks')
   if(stat.isDirectory()){if(name==='node_modules'||name.startsWith('.'))throw Error('Unexpected teaching archive directory');await walk(local)}
   else if(stat.isFile()){
    if(!/\.(?:mjs|md|json)$/.test(name)||name.startsWith('.'))throw Error('Unexpected teaching archive file')
    entries.push({name:local,data:await readFile(file)})
   }else throw Error('Unexpected teaching archive entry')
  }
 }
 await walk()
 if(!entries.length||entries.length>100||!entries.some(e=>e.name==='README.md')||!entries.some(e=>e.name==='SOURCES.md'))throw Error('Incomplete teaching archive')
 return entries.sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)
}

export async function writeFreshnessLabs(base=root){
 const folder=path.join(base,'public/learning/academy');await mkdir(folder,{recursive:true})
 for(const name of freshnessLabs){
  const expected=storedZip(await readLabEntries(path.join(base,'content/ai-academy/projects',name)))
  const file=path.join(folder,name+'.zip'),previous=await readFile(file).catch(e=>{if(e.code==='ENOENT')return null;throw e})
  if(!previous?.equals(expected))await writeFile(file,expected)
 }
 return freshnessLabs.length
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)console.log('Reproducible teaching archives:',await writeFreshnessLabs())
