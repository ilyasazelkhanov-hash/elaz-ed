import {useCallback,useEffect,useRef,useState} from 'react'
import {api,errorText} from './api'
import {useStore} from '../store'
import type {BlogCursor,Card} from './types'

/** One request at a time; stale/unmounted responses cannot overwrite a new feed. */
export function useBlogFeed(enabled:boolean,user:number,revision:string){
 const [posts,setPosts]=useState<Card[]|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[more,setMore]=useState(true)
 const cursor=useRef<BlogCursor|null>(null),pending=useRef(false),ended=useRef(false),failed=useRef(false),generation=useRef(0)
 const load=useCallback(async(retry=false)=>{
  if(!enabled||pending.current||ended.current||(failed.current&&!retry))return
  failed.current=false
  const current=generation.current;pending.current=true;setBusy(true);setError('')
  try{
   const page=await api.blogPage(cursor.current)
   if(current!==generation.current)return
   cursor.current=page.next;ended.current=!page.next;setMore(!!page.next)
   setPosts(previous=>[...new Map([...(previous??[]),...page.posts].map(post=>[post.id,post])).values()])
  }catch(e){if(current===generation.current){failed.current=true;useStore.getState().guard(e);setError(errorText(e))}}
  finally{if(current===generation.current){pending.current=false;setBusy(false)}}
 },[enabled,user,revision])
 useEffect(()=>{
  generation.current++;cursor.current=null;pending.current=false;ended.current=false;failed.current=false;setPosts(null);setMore(true);setError('');void load()
  return()=>{generation.current++}
 },[load])
 return {posts,busy,error,more,load}
}
