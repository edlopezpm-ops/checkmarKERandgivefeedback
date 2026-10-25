import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {createLocalProfileApi} from '../server/profile-local.ts';

async function fixture(t:test.TestContext){const root=await mkdtemp(join(tmpdir(),'marker-profile-'));t.after(async()=>{assert.ok(resolve(root).startsWith(resolve(tmpdir())+sep+'marker-profile-'));await rm(root,{recursive:true,force:true});});const path=join(root,'profile.json'),api=createLocalProfileApi(path);const call=(method='GET',body?:unknown)=>api.handle(new Request('http://127.0.0.1:5186/api/profile',{method,headers:{'Content-Type':'application/json','X-Marker-Auth':'1'},...(body===undefined?{}:{body:JSON.stringify(body)})}));return {path,call};}

test('local profile persists optional fields and admits only one concurrent revision',async t=>{
  const f=await fixture(t),initial=await (await f.call())!.json();assert.equal(initial.profile.email,null);assert.equal(initial.canDeleteAccount,false);
  const body={name:'Example Person',country:'Example country',expectedRevision:0};
  const responses=await Promise.all([f.call('PATCH',body),f.call('PATCH',{...body,name:'Conflicting draft'})]);assert.deepEqual(responses.map(r=>r!.status).sort(),[200,409]);
  const saved=JSON.parse(await readFile(f.path,'utf8'));assert.deepEqual(saved,{name:'Example Person',country:'Example country',email:'',revision:1});
});

test('local profile cannot edit access email or delete the local workspace',async t=>{
  const f=await fixture(t),body={name:'',country:''};await writeFile(f.path,JSON.stringify({...body,email:'owner@example.invalid',revision:0}));assert.equal((await f.call('PATCH',body))!.status,200);const before=await readFile(f.path,'utf8');
  assert.equal((await f.call('PATCH',{...body,email:'other@example.invalid'}))!.status,400);assert.equal((await f.call('PATCH',{...body,initials:'OP'}))!.status,400);assert.equal((await f.call('DELETE',{confirmation:'DELETE',confirmAllData:true}))!.status,409);assert.equal(await readFile(f.path,'utf8'),before);const actual=await (await f.call())!.json();assert.equal(actual.profile.email,'owner@example.invalid');assert.equal(actual.profile.initials,'OW');
});

test('local profile omits unrelated stored properties and fails closed on corrupt storage',async t=>{
  const f=await fixture(t);await writeFile(f.path,JSON.stringify({name:'Example',country:'',email:'',revision:0,unrelatedPrivateValue:'not-profile-data'}));const response=await (await f.call())!.json();assert.equal('unrelatedPrivateValue' in response.profile,false);assert.equal(response.profile.initials,'EX');
  await writeFile(f.path,'invalid JSON');assert.equal((await f.call())!.status,503);
});
