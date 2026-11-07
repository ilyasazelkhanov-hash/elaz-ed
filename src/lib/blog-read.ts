import { useSyncExternalStore } from 'react'
const event='og:blog-read',memory=new Map<string,string>(),pending=new Map<string,number[]>()
const key=(user:number)=>`og:blog:read:${user}`
export function parseReadPosts(value:string|null):number[]{
  try { const ids=JSON.parse(value||'[]');return Array.isArray(ids)?[...new Set(ids.filter((id:unknown)=>typeof id==='number'&&Number.isSafeInteger(id)&&id>0))].slice(-500) as number[]:[] } catch {return []}
}
function snapshot(user:number){
  try{
    const stored=localStorage.getItem(key(user)),unsaved=pending.get(key(user))
    // Keep failed session writes without hiding newer marks from another tab.
    return unsaved?JSON.stringify([...new Set([...parseReadPosts(stored),...unsaved])].slice(-500)):stored||memory.get(key(user))||'[]'
  }catch{return memory.get(key(user))||'[]'}
}
export function markPostRead(user:number,id:number){
  const ids=parseReadPosts(snapshot(user));if(ids.includes(id))return
  const value=JSON.stringify([...ids,id].slice(-500));memory.set(key(user),value)
  try{localStorage.setItem(key(user),value);pending.delete(key(user))}catch{pending.set(key(user),[...(pending.get(key(user))||[]),id].slice(-500))}
  window.dispatchEvent(new Event(event))
}
function subscribe(listener:()=>void){window.addEventListener(event,listener);window.addEventListener('storage',listener);return()=>{window.removeEventListener(event,listener);window.removeEventListener('storage',listener)}}
export function useReadPosts(user:number){const value=useSyncExternalStore(subscribe,()=>snapshot(user),()=> '[]');return parseReadPosts(value)}
