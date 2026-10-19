import test from'node:test'
import assert from'node:assert/strict'
import{readServiceKey}from'../supabase/functions/_shared/env.ts'
test('server credential resolver supports current and legacy Supabase environments and fails closed on malformed JSON',()=>{
 const env=data=>key=>data[key]
 assert.equal(readServiceKey(env({SUPABASE_SECRET_KEY:'sb_secret_local_test',SUPABASE_SERVICE_ROLE_KEY:'legacy'})),'sb_secret_local_test')
 assert.equal(readServiceKey(env({SUPABASE_SERVICE_ROLE_KEY:'legacy'})),'legacy')
 assert.equal(readServiceKey(env({SUPABASE_SECRET_KEYS:'{"default":"sb_secret_local_test"}'})),'sb_secret_local_test')
 assert.equal(readServiceKey(env({SUPABASE_SECRET_KEYS:'invalid',SUPABASE_PUBLISHABLE_KEY:'public'})),'')
})
