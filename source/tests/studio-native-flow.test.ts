import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { emptyWorkspace } from '../src/core/domain.ts';
import { prepareStudioPlan, type StudioPlanInput } from '../src/core/studio-planner.ts';
import { createStudioApi } from '../server/studio-local.ts';
import { hostedStudioApi } from '../server/studio-hosted.ts';

const workspace=emptyWorkspace(); workspace.revision=1;
workspace.products.push({id:'native-demo',name:'Demo',description:'Descripción literal del producto.',audience:'',language:'es',tone:'',cta:'Conoce el proyecto',url:'https://example.invalid/demo',status:'available'});
async function fixture(t,mode) {
  if(mode==='local') {
    const directory=await mkdtemp(join(tmpdir(),'marker-native-flow-'));
    const api=createStudioApi({directory,tools:{ffmpeg:resolve(directory,'unavailable-ffmpeg'),ffprobe:resolve(directory,'unavailable-ffprobe')}});
    t.after(async()=>{await api.close();assert.ok(resolve(directory).startsWith(resolve(join(tmpdir(),'marker-native-flow-'))));await rm(directory,{recursive:true,force:true});});
    return {async handle(request){return api.handle(request,workspace);},processorCalls:()=>0};
  }
  const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
  for(const name of ['0001_private.sql','0002_studio.sql','0003_studio_hosted.sql','0004_studio_analysis.sql','0005_studio_settings.sql','0006_agents.sql','0007_single_tenant_auth.sql','0008_github_auth.sql','0009_profile_account.sql','0012_policy_acknowledgements.sql'])sql.exec(readFileSync(new URL('../migrations-d1/'+name,import.meta.url),'utf8'));
  sql.prepare('INSERT INTO marker_workspace VALUES(1,1,?)').run(JSON.stringify(workspace)); t.after(()=>sql.close());
  const DB={prepare(text){let args=[];const statement={bind(...values){args=values;return statement;},execute(){const query=sql.prepare(text);return query.columns().length?{success:true,results:query.all(...args),meta:{changes:0}}:{success:true,results:[],meta:{changes:Number(query.run(...args).changes)}};},async run(){return statement.execute();},async all(){return statement.execute();},async first(){return statement.execute().results[0]??null;}};return statement;},async batch(statements){sql.exec('BEGIN IMMEDIATE');try{const result=statements.map(statement=>statement.execute());sql.exec('COMMIT');return result;}catch(error){sql.exec('ROLLBACK');throw error;}}};
  let processorCalls=0;
  const env={DB,MARKER_ORIGIN:'https://marker.example.invalid',MEDIA:{async get(){throw new Error('No media expected for TXT');}},STUDIO_PROCESSOR:{getByName(){processorCalls++;throw new Error('No processor expected for TXT');}}};
  return {async handle(request){return hostedStudioApi(request,env,workspace);},processorCalls:()=>processorCalls};
}

for(const mode of ['local','hosted'])test(`native ${mode} classify → prepare → plan → persist → approve → TXT export uses existing CAS adapters with no agent/provider`,async t=>{
  let networkCalls=0;t.mock.method(globalThis,'fetch',async()=>{networkCalls++;throw new Error('No provider or network is allowed in this native fixture');});
  const adapter=await fixture(t,mode),origin=mode==='local'?'http://127.0.0.1:5190':'https://marker.example.invalid';
  async function call(path='',data){return adapter.handle(new Request(origin+'/api/studio'+path,{method:data===undefined?'GET':'POST',headers:{Origin:origin,...(data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})}));}
  async function state(){return (await(await call()).json()).state;}
  async function command(type,data,expectedRevision){const current=await state();return call('/commands',{expectedRevision:expectedRevision??current.revision,command:{type,data}});}
  const literal='  Un texto literal preparado por una persona.\nSegunda línea conservada.  ';
  assert.equal((await command('material.save',{kind:'text',title:'Demo ready text',text:literal,productIds:['native-demo'],rights:'owned',review:'ready'})).status,200);
  let current=await state();const textId=current.materials[0].id;assert.deepEqual(current.materials[0].categories,['ready-text']);
  await command('material.save',{id:textId,categories:[],roles:[]});
  await command('material.save',{kind:'idea',title:'Una idea sin desarrollar'});
  current=await state();const ideaId=current.materials[1].id;
  await command('material.save',{id:ideaId,categories:[],roles:[]}); current=await state();
  const before=current;
  assert.equal((await command('material.classify',{ids:[textId,'missing']},before.revision)).status,404);assert.deepEqual(await state(),before);
  const classified=await command('material.classify',{ids:[textId,ideaId]},before.revision);assert.equal(classified.status,200);
  current=(await classified.json()).state;assert.equal(current.revision,before.revision+1);assert.equal(current.materials[1].review,'unreviewed');assert.equal(current.materials[1].rights,'unknown');
  const replay=await command('material.classify',{ids:[textId,ideaId]},current.revision);assert.equal(replay.status,200);assert.deepEqual((await replay.json()).state,current);
  assert.equal((await command('material.classify',{ids:[textId]},before.revision)).status,409);
  await command('campaign.save',{productId:'native-demo',title:'Demo native campaign'});current=await state();
  const input:StudioPlanInput={campaignId:current.campaigns[0].id,candidateIds:[textId],includeShared:false,platform:'LinkedIn',template:'text',hook:'',body:'',cta:'',duration:20,lockedSelections:[],reviewedMaterialIds:[],allowReuse:false,muteBackground:false,audio:'mute'};
  const prepared=prepareStudioPlan(current,workspace,input);assert.equal(prepared.body,literal);assert.equal(prepared.textSourceId,textId);
  const planned=await call('/plan',prepared);assert.equal(planned.status,200);const plan=await planned.json();assert.deepEqual(await state(),current);
  assert.equal((await command('variant.plan',{request:prepared,fingerprint:'stale',alternative:0})).status,409);
  const saved=await command('variant.plan',{request:prepared,fingerprint:plan.fingerprint,alternative:0});assert.equal(saved.status,200);
  const variant=(await saved.json()).state.variants[0];assert.equal(variant.planner.inputFingerprint,plan.fingerprint);assert.equal(variant.sourceSnapshots[0].text,literal);
  assert.equal((await call(`/variants/${variant.id}/export`)).status,409);
  const approved=await call(`/variants/${variant.id}/approve`,{recipeRevision:1,confirmed:true});assert.equal(approved.status,200);
  const approval=await approved.json();assert.equal(approval.job.kind,'text-approval');
  const receiptBefore=(await(await call(`/jobs/${approval.job.id}`)).json()).receipt;
  const exported=await call(`/variants/${variant.id}/export`);assert.equal(exported.status,200);assert.match(exported.headers.get('content-type'),/text\/plain/);assert.ok((await exported.text()).includes(literal));
  await command('material.save',{id:textId,rights:'restricted'});assert.equal((await call(`/variants/${variant.id}/export`)).status,409);
  assert.deepEqual((await(await call(`/jobs/${approval.job.id}`)).json()).receipt,receiptBefore);
  assert.equal(adapter.processorCalls(),0);assert.equal(networkCalls,0);
});
