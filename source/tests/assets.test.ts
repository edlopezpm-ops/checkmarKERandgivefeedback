import test from 'node:test';
import assert from 'node:assert/strict';
import { DecorativeAssets, boundedBlob, CACHE_NAME, MAX_BYTES } from '../src/decoration/assets.ts';

function fakeStorage(){
  const stores=new Map<string,Map<string,Response>>();let writes=0;
  const storage={keys:async()=>[...stores.keys()],delete:async(name:string)=>stores.delete(name),open:async(name:string)=>{
    if(!stores.has(name))stores.set(name,new Map());const cache=stores.get(name)!;
    return {match:async(key:string)=>cache.get(key)?.clone(),put:async(key:string,value:Response)=>{writes++;cache.set(key,value.clone());}};
  }} as unknown as CacheStorage;
  return {storage,stores,writes:()=>writes};
}
const fetchAsset=(async()=>new Response('<svg/>')) as typeof fetch;
test('default/rejected consent loads once in memory with no persistent writes',async()=>{
  const f=fakeStorage();let fetches=0;const a=new DecorativeAssets(()=>f.storage,(async()=>{fetches++;return new Response('<svg/>');}) as typeof fetch);
  await a.load();await a.load();assert.equal(fetches,1);assert.equal(f.writes(),0);assert.equal(f.stores.size,0);await a.setConsent(false);assert.equal(f.stores.size,0);
});
test('acceptance caches resource, cleans old versions and revocation preserves other caches',async()=>{
  const f=fakeStorage();f.stores.set('marker-decoration-v0',new Map());f.stores.set('business-cache',new Map());
  const a=new DecorativeAssets(()=>f.storage,fetchAsset);await a.setConsent(true);assert.equal(f.writes(),1);assert.ok(f.stores.has(CACHE_NAME));assert.ok(!f.stores.has('marker-decoration-v0'));
  await a.setConsent(false);assert.deepEqual([...f.stores.keys()],['business-cache']);
});
test('unavailable storage and quota failure fall back to host',async()=>{
  const a=new DecorativeAssets(()=>{throw new Error('denied');},fetchAsset);assert.match(await a.setConsent(true),/no disponible/);assert.equal((await a.load()).size,6);
  const storage={keys:async()=>[],open:async()=>({put:async()=>{throw new Error('quota');},match:async()=>undefined})} as unknown as CacheStorage;
  const b=new DecorativeAssets(()=>storage,fetchAsset);assert.match(await b.setConsent(true),/no disponible/);assert.equal((await b.load()).size,6);
});
test('revocation during network load never leaves an optional copy',async()=>{
  const f=fakeStorage();let release!:(response:Response)=>void;const response=new Promise<Response>(resolve=>release=resolve);
  const a=new DecorativeAssets(()=>f.storage,(()=>response) as typeof fetch);const accept=a.setConsent(true);
  await new Promise(resolve=>setImmediate(resolve));const revoke=a.setConsent(false);release(new Response('<svg/>'));await Promise.all([accept,revoke]);assert.equal(f.stores.size,0);assert.equal(f.writes(),0);
});
test('oversized declared and streaming bodies are rejected',async()=>{
  await assert.rejects(boundedBlob(new Response('x',{headers:{'content-length':String(MAX_BYTES+1)}})));
  await assert.rejects(boundedBlob(new Response(new Uint8Array(20)),10));
});
test('network failure clears failed memoization for recovery',async()=>{
  let attempts=0;const a=new DecorativeAssets(()=>undefined,(async()=>{if(!attempts++)throw new Error('offline');return new Response('<svg/>');}) as typeof fetch);
  await assert.rejects(a.load());assert.equal((await a.load()).size,6);assert.equal(attempts,2);
});
