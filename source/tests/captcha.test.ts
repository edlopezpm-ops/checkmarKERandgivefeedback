import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {authCaptchaConfiguration,verifyAuthCaptcha} from '../server/captcha.js';

const baseEnv={MARKER_ORIGIN:'https://marker.aekr.io',TURNSTILE_SITE_KEY:'0x0000000000000000000000',TURNSTILE_SECRET:'test-secret-not-a-live-secret',TURNSTILE_HOSTNAMES:'marker.aekr.io'};
function fixture(t){
  const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../migrations-d1/0001_private.sql',import.meta.url),'utf8'));t.after(()=>db.close());const state={failSQL:false,failAt:null};
  const DB={prepare(sql){let args=[];const statement={bind(...values){args=values;return statement;},execute(){if(state.failSQL)throw new Error('Private SQL failure must not escape');const query=db.prepare(sql);return query.columns().length?{success:true,results:query.all(...args),meta:{changes:0}}:{success:true,results:[],meta:{changes:Number(query.run(...args).changes)}};}};return statement;},async batch(statements){db.exec('BEGIN IMMEDIATE');try{const result=statements.map((statement,index)=>{if(state.failAt===index)throw new Error('Synthetic transaction failure');return statement.execute();});db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}};
  return{db,state,env:{...baseEnv,MARKER_AUTH_SECRET:'synthetic-existing-marker-auth-secret-for-proof-digests',DB}};
}
const request=(path='/api/auth/request')=>new Request('https://marker.aekr.io'+path,{headers:{'CF-Connecting-IP':'192.0.2.1'}});
const valid={success:true,hostname:'marker.aekr.io',action:'auth_email_request'};

test('completely absent CAPTCHA preserves existing auth; partial configuration fails closed without a request',async t=>{
  const {env}=fixture(t);
  const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('Unexpected call');};
  try {
    assert.deepEqual(authCaptchaConfiguration({}),{required:false,sitekey:null});
    assert.equal(await verifyAuthCaptcha(request(),{},null),true);
    for(const config of [{TURNSTILE_REQUIRED:'1'},{TURNSTILE_REQUIRED:'0'},{TURNSTILE_HOSTNAMES:'marker.aekr.io'},{TURNSTILE_HOSTNAMES:''},{TURNSTILE_SECRET:env.TURNSTILE_SECRET},{TURNSTILE_SITE_KEY:env.TURNSTILE_SITE_KEY},{TURNSTILE_SITE_KEY:''},{TURNSTILE_SECRET:null}]){
      assert.equal(authCaptchaConfiguration(config).required,true);assert.equal(await verifyAuthCaptcha(request(),config,'token'),false);
    }
    assert.equal(await verifyAuthCaptcha(request(),{...env,TURNSTILE_REQUIRED:'false'},'token'),false);
    assert.equal(calls,0);
  }finally{globalThis.fetch=original;}
});

test('canonical verification uses fixed endpoint, action, hostname and local one-use proofs even when provider repeats success',async t=>{
  const {env}=fixture(t);
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async(input,init)=>{
    calls++;assert.equal(input,'https://challenges.cloudflare.com/turnstile/v0/siteverify');assert.equal(init?.method,'POST');assert.equal(init?.redirect,'manual');
    const form=new URLSearchParams(init?.body as URLSearchParams);assert.equal(form.get('secret'),env.TURNSTILE_SECRET);assert.equal(form.get('response'),'single-use-token');assert.equal(form.get('remoteip'),'192.0.2.1');
    return Response.json(valid);
  };
  try {assert.equal(await verifyAuthCaptcha(request(),env,'single-use-token'),true);assert.equal(await verifyAuthCaptcha(request(),env,'single-use-token'),false);assert.equal(calls,2);}finally{globalThis.fetch=original;}
});

test('provider success requires boolean true plus exact action and exact production hostname',async t=>{
  const {env}=fixture(t);
  const original=globalThis.fetch;
  try {
    for(const result of [{...valid,success:1},{...valid,action:'auth_google'},{...valid,hostname:'localhost'},{...valid,hostname:'marker.aekr.io.attacker.invalid'},{}]){
      globalThis.fetch=async()=>Response.json(result);assert.equal(await verifyAuthCaptcha(request(),env,'token'),false);
    }
    for(const [path,action] of [['/api/auth/request','auth_email_request'],['/api/auth/verify','auth_email_verify'],['/api/auth/help','auth_help'],['/api/auth/google/start','auth_google'],['/api/auth/github/start','auth_github']]){
      globalThis.fetch=async()=>Response.json({...valid,action});assert.equal(await verifyAuthCaptcha(request(path),env,'token:'+path),true);
    }
  }finally{globalThis.fetch=original;}
});

test('invalid token, origin, hostname configuration and unknown path do not contact the provider',async t=>{
  const {env}=fixture(t);
  const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return Response.json(valid);};
  try {
    for(const token of [undefined,null,'',123,'x'.repeat(2049)])assert.equal(await verifyAuthCaptcha(request(),env,token),false);
    assert.equal(await verifyAuthCaptcha(new Request('https://other.invalid/api/auth/request'),env,'token'),false);
    assert.equal(await verifyAuthCaptcha(request('/api/auth/logout'),env,'token'),false);
    assert.equal(await verifyAuthCaptcha(request(),{...env,TURNSTILE_HOSTNAMES:'marker.aekr.io,localhost'},'token'),false);
    assert.equal(calls,0);
  }finally{globalThis.fetch=original;}
});

test('transport, malformed, oversized and redirect responses fail closed',async t=>{
  const {env}=fixture(t);
  const original=globalThis.fetch;
  try {
    for(const response of [()=>{throw new Error('Do not log provider details');},()=>new Response('',{status:302,headers:{Location:'https://other.invalid'}}),()=>new Response('not-json'),()=>Response.json({...valid,padding:'x'.repeat(9000)}),()=>new Response(null,{status:503})]){
      globalThis.fetch=async()=>response();assert.equal(await verifyAuthCaptcha(request(),env,'token'),false);
    }
  }finally{globalThis.fetch=original;}
});

test('atomic local proof custody accepts one concurrent request and prevents reuse across every auth route',async t=>{
  const f=fixture(t);t.mock.method(globalThis,'fetch',async()=>Response.json(valid));
  const results=await Promise.all([verifyAuthCaptcha(request(),f.env,'shared-concurrent-proof'),verifyAuthCaptcha(request(),f.env,'shared-concurrent-proof')]);assert.deepEqual(results.sort(),[false,true]);
  const routes=[['/api/auth/verify','auth_email_verify'],['/api/auth/help','auth_help'],['/api/auth/google/start','auth_google'],['/api/auth/github/start','auth_github']];
  for(const [path,action]of routes){t.mock.method(globalThis,'fetch',async()=>Response.json({...valid,action}));assert.equal(await verifyAuthCaptcha(request(path),f.env,'shared-concurrent-proof'),false);}
  const rows=f.db.prepare('SELECT * FROM marker_auth_limits').all();assert.equal(rows.length,1);assert.match(rows[0].key,/^[a-f0-9]{64}$/);assert.match(rows[0].ticket,/^[a-f0-9]{64}$/);assert.notEqual(rows[0].key,rows[0].ticket);assert.equal(JSON.stringify(rows).includes('shared-concurrent-proof'),false);
});

test('proof crossing midnight survives native cleanup until provider expiry has passed',async t=>{
  const f=fixture(t);let now=Date.parse('2026-10-24T23:59:30Z');t.mock.method(Date,'now',()=>now);t.mock.method(globalThis,'fetch',async()=>Response.json(valid));
  assert.equal(await verifyAuthCaptcha(request(),f.env,'midnight-proof'),true);
  const retained=f.db.prepare('SELECT window_start FROM marker_auth_limits').get();assert.equal(retained.window_start,Date.parse('2026-10-25T00:00:00Z')/1000);
  now+=90_000;f.db.prepare('DELETE FROM marker_auth_limits WHERE window_start < ?').run(Math.floor(now/1000/86400)*86400);
  assert.equal(await verifyAuthCaptcha(request(),f.env,'midnight-proof'),false);assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM marker_auth_limits').get().count,1);
  f.db.prepare('DELETE FROM marker_auth_limits WHERE window_start < ?').run(Date.parse('2026-10-26T00:00:00Z')/1000);assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM marker_auth_limits').get().count,0);
});

test('proof store SQL failure, missing custody configuration and row capacity fail closed',async t=>{
  const f=fixture(t);t.mock.method(globalThis,'fetch',async()=>Response.json(valid));
  f.state.failSQL=true;assert.equal(await verifyAuthCaptcha(request(),f.env,'sql-failed-proof'),false);f.state.failSQL=false;
  for(const env of [{...f.env,DB:undefined},{...f.env,MARKER_AUTH_SECRET:undefined},{...f.env,MARKER_AUTH_SECRET:'short'}])assert.equal(await verifyAuthCaptcha(request(),env,'uncustodied-proof'),false);
  const day=Math.floor(Date.now()/1000/86400)*86400,insert=f.db.prepare('INSERT INTO marker_auth_limits(key,window_start,count,last_at,ticket) VALUES(?,?,1,0,?)');for(let index=0;index<1000;index++){const hash=index.toString(16).padStart(64,'0');insert.run(hash,day,hash);}
  assert.equal(await verifyAuthCaptcha(request(),f.env,'capacity-proof'),false);assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM marker_auth_limits').get().count,1000);
});

test('capacity recovers on the next day while preserving a crossing-midnight proof and current quotas',async t=>{
  const f=fixture(t);let now=Date.parse('2026-10-24T23:59:30Z');t.mock.method(Date,'now',()=>now);t.mock.method(globalThis,'fetch',async()=>Response.json(valid));
  const day=Math.floor(now/1000/86400)*86400,insert=f.db.prepare('INSERT INTO marker_auth_limits(key,window_start,count,last_at,ticket) VALUES(?,?,1,0,?)');
  for(let index=0;index<998;index++){const hash=index.toString(16).padStart(64,'0');insert.run(hash,day,hash);}
  assert.equal(await verifyAuthCaptcha(request(),f.env,'retained-midnight-proof'),true);
  insert.run('a'.repeat(64),day,'a'.repeat(64));assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM marker_auth_limits').get().count,1000);
  assert.equal(await verifyAuthCaptcha(request(),f.env,'full-today-proof'),false);
  now+=90_000;const nextDay=Math.floor(now/1000/86400)*86400;insert.run('b'.repeat(64),nextDay,'b'.repeat(64));
  assert.equal(await verifyAuthCaptcha(request(),f.env,'new-day-proof'),true);assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM marker_auth_limits').get().count,3);
  assert.equal(f.db.prepare('SELECT window_start FROM marker_auth_limits WHERE key=?').get('b'.repeat(64)).window_start,nextDay,'Current quota must remain');
  assert.equal(await verifyAuthCaptcha(request(),f.env,'retained-midnight-proof'),false);assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM marker_auth_limits').get().count,3);
});

test('proof admission transaction rolls back expired-row cleanup when insertion fails',async t=>{
  const f=fixture(t);t.mock.method(globalThis,'fetch',async()=>Response.json(valid));
  f.db.prepare('INSERT INTO marker_auth_limits(key,window_start,count,last_at,ticket) VALUES(?,0,1,0,?)').run('c'.repeat(64),'c'.repeat(64));
  f.state.failAt=1;assert.equal(await verifyAuthCaptcha(request(),f.env,'failed-insert-proof'),false);assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM marker_auth_limits').get().count,1,'Expired row cleanup must roll back with the failed INSERT');
  f.state.failAt=null;assert.equal(await verifyAuthCaptcha(request(),f.env,'failed-insert-proof'),true);assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM marker_auth_limits').get().count,1);
  assert.equal(f.db.prepare('SELECT 1 FROM marker_auth_limits WHERE key=?').get('c'.repeat(64)),undefined);
});
