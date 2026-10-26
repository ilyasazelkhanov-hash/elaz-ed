import http from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

export function createBookingServer({ database = ':memory:', now = Date.now } = {}) {
  const db = new DatabaseSync(database), sessions = new Map()
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,email TEXT NOT NULL UNIQUE,salt TEXT NOT NULL,hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS bookings(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),slot TEXT NOT NULL UNIQUE,request_key TEXT NOT NULL,UNIQUE(user_id,request_key));
    CREATE TABLE IF NOT EXISTS outbox(id INTEGER PRIMARY KEY,booking_id INTEGER NOT NULL UNIQUE REFERENCES bookings(id),state TEXT NOT NULL DEFAULT 'draft');`)
  const reply = (res, status, body) => { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body)) }
  const fail = (status, code) => { throw Object.assign(new Error(code), {status}) }
  const server = http.createServer(async(req,res) => {
    try {
      const path = new URL(req.url,'http://localhost').pathname
      if(req.method==='GET'&&path==='/') {res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'"});res.end(await readFile(new URL('./index.html',import.meta.url)));return}
      if(req.method==='GET'&&path==='/client.mjs') {res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(await readFile(new URL('./client.mjs',import.meta.url)));return}
      let input={}
      if(req.method==='POST') {
        if(req.headers['content-type']?.split(';')[0]!=='application/json')fail(415,'json_required')
        let length=0;const chunks=[]
        for await(const chunk of req){length+=chunk.length;if(length>8192)fail(413,'body_too_large');chunks.push(chunk)}
        try{input=JSON.parse(Buffer.concat(chunks).toString())}catch{fail(400,'bad_json')}
        if(!input||typeof input!=='object'||Array.isArray(input))fail(400,'object_required')
      }
      if(req.method==='POST'&&['/register','/login'].includes(path)) {
        const email=typeof input.email==='string'?input.email.trim().toLowerCase():''
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof input.password!=='string'||input.password.length<12||input.password.length>128)fail(400,'invalid_credentials_format')
        if(path==='/register') {
          const salt=randomBytes(16).toString('hex'),hash=scryptSync(input.password,salt,64).toString('hex')
          try{db.prepare('INSERT INTO users(email,salt,hash) VALUES(?,?,?)').run(email,salt,hash)}catch(error){if(error.code?.startsWith('ERR_SQLITE'))fail(409,'account_conflict');throw error}
        }
        const user=db.prepare('SELECT * FROM users WHERE email=?').get(email)
        const hash=scryptSync(input.password,user?.salt||'missing-account',64)
        if(!user||!timingSafeEqual(hash,Buffer.from(user.hash,'hex')))fail(401,'invalid_credentials')
        const token=randomBytes(32).toString('hex');sessions.set(token,{userId:user.id,expires:now()+3600000});reply(res,200,{token});return
      }
      const token=req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1],session=sessions.get(token)
      if(!session||session.expires<=now()){if(token)sessions.delete(token);fail(401,'authentication_required')}
      if(req.method==='POST'&&path==='/logout'){sessions.delete(token);reply(res,200,{ok:true});return}
      if(req.method==='GET'&&path==='/bookings'){reply(res,200,{bookings:db.prepare('SELECT id,slot FROM bookings WHERE user_id=? ORDER BY id').all(session.userId)});return}
      if(req.method==='POST'&&path==='/bookings'){
        const {slot,requestKey}=input
        if(typeof slot!=='string'||!/^2030-01-(0[1-9]|[12][0-9]|3[01])T(09|10|11):00$/.test(slot)||typeof requestKey!=='string'||! /^[a-zA-Z0-9-]{8,80}$/.test(requestKey))fail(400,'invalid_booking')
        const previous=db.prepare('SELECT id,slot FROM bookings WHERE user_id=? AND request_key=?').get(session.userId,requestKey)
        if(previous){if(previous.slot!==slot)fail(409,'request_key_conflict');reply(res,200,previous);return}
        let id
        try{db.exec('BEGIN IMMEDIATE');id=db.prepare('INSERT INTO bookings(user_id,slot,request_key) VALUES(?,?,?)').run(session.userId,slot,requestKey).lastInsertRowid;db.prepare('INSERT INTO outbox(booking_id) VALUES(?)').run(id);db.exec('COMMIT')}catch(error){db.exec('ROLLBACK');if(error.code?.startsWith('ERR_SQLITE'))fail(409,'slot_unavailable');throw error}
        reply(res,201,{id:Number(id),slot});return
      }
      if(req.method==='GET'&&/^\/bookings\/\d+$/.test(path)){
        const booking=db.prepare('SELECT id,slot FROM bookings WHERE id=? AND user_id=?').get(Number(path.split('/').pop()),session.userId)
        if(!booking)fail(404,'not_found');reply(res,200,booking);return
      }
      fail(404,'not_found')
    }catch(error){reply(res,error.status||500,{error:error.status?error.message:'server_error'})}
  })
  server.on('close',()=>db.close())
  return server
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const server=createBookingServer({database:process.env.BOOKING_DB||'./booking.sqlite'})
 server.listen(Number(process.env.PORT||5180),'127.0.0.1',()=>console.log('Учебный сервер запущен на порту',server.address().port))
}
