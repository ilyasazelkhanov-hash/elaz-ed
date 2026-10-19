interface JsonStorage { getItem(key:string):string|null; setItem(key:string,value:string):void }

/** Immutable snapshots are reused between requests. Mutations commit only after durable storage succeeds. */
export function createAcademySnapshotStorage<T>(storage:JsonStorage,key:string){
 let loaded=false,snapshot:T|undefined
 return {
  load(){
   if(!loaded){try{snapshot=JSON.parse(storage.getItem(key)||'null')??undefined}catch{snapshot=undefined}loaded=true}
   return snapshot
  },
  save(value:T){storage.setItem(key,JSON.stringify(value));snapshot=value;loaded=true},
  invalidate(){loaded=false;snapshot=undefined},
 }
}
