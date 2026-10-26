import {DatabaseSync} from 'node:sqlite'
export class JobQueue{
 constructor(file=':memory:'){
  this.db=new DatabaseSync(file);this.db.exec(`PRAGMA busy_timeout=1000; CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,payload TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,max_attempts INTEGER NOT NULL,available_at INTEGER NOT NULL,lease_until INTEGER,lease_owner TEXT,last_error TEXT);`)
 }
 enqueue(id,payload,{now=0,maxAttempts=3}={}){
  if(typeof id!=='string'||!/^JOB-[A-Z0-9-]{1,60}$/.test(id)||!Number.isSafeInteger(maxAttempts)||maxAttempts<1||maxAttempts>10)throw Error('invalid_job')
  const json=JSON.stringify(payload);if(typeof json!=='string'||json.length>8192)throw Error('invalid_payload')
  const prior=this.db.prepare('SELECT * FROM jobs WHERE id=?').get(id)
  if(prior){if(prior.payload!==json)throw Error('job_id_conflict');return prior}
  this.db.prepare('INSERT INTO jobs(id,payload,max_attempts,available_at) VALUES(?,?,?,?)').run(id,json,maxAttempts,now);return this.get(id)
 }
 get(id){return this.db.prepare('SELECT * FROM jobs WHERE id=?').get(id)}
 claim(worker,{now=0,leaseMs=1000}={}){
  if(typeof worker!=='string'||!worker||!Number.isSafeInteger(leaseMs)||leaseMs<1)throw Error('invalid_lease')
  this.db.exec('BEGIN IMMEDIATE')
  try{
   this.db.prepare("UPDATE jobs SET state=CASE WHEN attempts>=max_attempts THEN 'dead' ELSE 'pending' END,lease_owner=NULL,lease_until=NULL,last_error='lease_expired' WHERE state='running' AND lease_until<=?").run(now)
   const job=this.db.prepare("SELECT * FROM jobs WHERE state='pending' AND available_at<=? AND attempts<max_attempts ORDER BY available_at,id LIMIT 1").get(now)
   if(!job){this.db.exec('COMMIT');return null}
   this.db.prepare("UPDATE jobs SET state='running',attempts=attempts+1,lease_owner=?,lease_until=? WHERE id=?").run(worker,now+leaseMs,job.id);this.db.exec('COMMIT');return this.get(job.id)
  }catch(error){this.db.exec('ROLLBACK');throw error}
 }
 ack(id,worker,{now=0,attempt}={}){if(!Number.isSafeInteger(attempt)||attempt<1)throw Error('invalid_lease_token');const r=this.db.prepare("UPDATE jobs SET state='done',lease_owner=NULL,lease_until=NULL WHERE id=? AND state='running' AND lease_owner=? AND lease_until>? AND attempts=?").run(id,worker,now,attempt);if(r.changes!==1)throw Error('lease_not_owned');return this.get(id)}
 fail(id,worker,{now=0,attempt,retryable=true,reason='server_error',baseDelayMs=100}={}){
  if(!Number.isSafeInteger(attempt)||attempt<1)throw Error('invalid_lease_token')
  if(!['server_error','rate_limit','timeout','unauthorized','validation'].includes(reason)||typeof retryable!=='boolean'||!Number.isFinite(baseDelayMs)||baseDelayMs<0)throw Error('invalid_failure')
  const job=this.get(id);if(!job||job.state!=='running'||job.lease_owner!==worker||job.lease_until<=now||job.attempts!==attempt)throw Error('lease_not_owned')
  const state=!retryable||job.attempts>=job.max_attempts?'dead':'pending',available=now+Math.min(30000,baseDelayMs*2**(job.attempts-1))
  const result=this.db.prepare("UPDATE jobs SET state=?,available_at=?,lease_owner=NULL,lease_until=NULL,last_error=? WHERE id=? AND state='running' AND lease_owner=? AND attempts=? AND lease_until>?").run(state,available,reason,id,worker,attempt,now);if(result.changes!==1)throw Error('lease_not_owned');return this.get(id)
 }
 metrics(){const result={pending:0,running:0,done:0,dead:0};for(const row of this.db.prepare('SELECT state,count(*) n FROM jobs GROUP BY state').all())result[row.state]=row.n;return result}
 close(){this.db.close()}
}
export class CircuitBreaker{
 constructor({threshold=2,cooldownMs=1000}={}){if(!Number.isInteger(threshold)||threshold<1||!Number.isFinite(cooldownMs)||cooldownMs<1)throw Error('invalid_breaker');this.threshold=threshold;this.cooldownMs=cooldownMs;this.state='closed';this.failures=0;this.openUntil=0}
 allow(now){if(this.state==='closed')return true;if(this.state==='open'&&now>=this.openUntil){this.state='half-open';return true}return false}
 success(){this.failures=0;this.state='closed'}
 failure(now){this.failures++;if(this.state==='half-open'||this.failures>=this.threshold){this.state='open';this.openUntil=now+this.cooldownMs}}
}
