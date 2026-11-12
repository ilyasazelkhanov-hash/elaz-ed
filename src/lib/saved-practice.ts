import { beginnerGuides } from './beginner-content.ts'
import { artifactKey, artifactStatus, readArtifact, removeArtifact, artifactRecovery, artifactRecoveryKey } from './practice-artifact.ts'

export type SavedPractice = { id:string; title:string; path:string; status:'draft'|'self_checked' }
type ReadStorage = Pick<Storage,'getItem'>
/** Only our free-guide allowlist is read. Never enumerate other accounts or Academy work. */
export function savedFreePractice(scope:string|undefined,storage?:ReadStorage): {items:SavedPractice[]; unavailable:boolean} {
 if(!scope)return {items:[],unavailable:false}
 try {
  const source=storage??localStorage
  const items:SavedPractice[]=[]
  for(const guide of beginnerGuides){
   const key=artifactKey(scope,'free-start',guide.id)!
   const raw=source.getItem(key)
   if(!raw)continue
   const value=readArtifact(key,guide.checks.length,JSON.stringify(guide.checks),{getItem:()=>raw})
   const status=artifactStatus(value)
   if(status!=='empty')items.push({id:guide.id,title:guide.title,path:`/start/${guide.id}`,status})
  }
  return {items,unavailable:false}
 }catch{return {items:[],unavailable:true}}
}
/** Removes only a recognised free guide and its in-memory recovery, never progress or XP. */
export function deleteSavedFreePractice(scope:string|undefined,id:string,storage?:Pick<Storage,'removeItem'>):boolean {
 if(!scope||!beginnerGuides.some(guide=>guide.id===id))return false
 if(!removeArtifact(artifactKey(scope,'free-start',id),storage))return false
 artifactRecovery.remove(artifactRecoveryKey(scope,'free-start',id))
 return true
}
