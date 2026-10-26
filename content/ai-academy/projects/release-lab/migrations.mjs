import {DatabaseSync} from 'node:sqlite'
import path from 'node:path'
export function snapshot(source,destination){
 if(path.resolve(source)===path.resolve(destination))throw Error('backup_must_be_separate')
 const db=new DatabaseSync(source,{readOnly:true})
 try{db.prepare('VACUUM INTO ?').run(destination)}finally{db.close()}
}
export function migrate(file){
 const db=new DatabaseSync(file)
 try{
  const version=db.prepare('PRAGMA user_version').get().user_version,columns=db.prepare('PRAGMA table_info(bookings)').all()
  if(!columns.length)throw Error('bookings_schema_required')
  if(version>1)throw Error('future_schema_not_supported')
  const hasNote=columns.some(column=>column.name==='note')
  if(version===1){if(!hasNote)throw Error('schema_history_mismatch');return {version:1,changed:false}}
  db.exec('BEGIN IMMEDIATE')
  try{if(!hasNote)db.exec('ALTER TABLE bookings ADD COLUMN note TEXT');db.exec('PRAGMA user_version=1; COMMIT')}catch(error){db.exec('ROLLBACK');throw error}
  return {version:1,changed:true}
 }finally{db.close()}
}
