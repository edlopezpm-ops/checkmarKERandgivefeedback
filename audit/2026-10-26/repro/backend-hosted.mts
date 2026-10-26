import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const source=resolve(root,'../../source');
const suffix=process.env.BACKEND_AUDIT_RUN??'';
if(!/^[A-Za-z0-9_-]*$/.test(suffix))throw Error('Use a simple optional fresh run suffix');
const {hostedStudioApi,executeHostedRender}=await import(pathToFileURL(join(source,'server/studio-hosted.ts')).href);
const out=join(root,'evidence','backend-hosted'+suffix);mkdirSync(out,{recursive:true});
const path=join(out,'sandbox.sqlite');let sql=new DatabaseSync(path);
sql.exec('PRAGMA foreign_keys=ON;');
for(const name of ['0001_private.sql','0002_studio.sql','0003_studio_hosted.sql','0004_studio_analysis.sql','0005_studio_settings.sql','0006_agents.sql','0007_single_tenant_auth.sql','0008_github_auth.sql','0009_profile_account.sql','0010_mcp.sql','0011_mcp_connections.sql','0012_policy_acknowledgements.sql','0013_analytics_subject.sql'])sql.exec(readFileSync(join(source,'migrations-d1',name),'utf8'));
const work={version:1,revision:1,products:[{id:'audit_product',name:'Audit hosted',description:'',audience:'',language:'es',tone:'',cta:'',url:'',status:'available'}],accounts:[],sources:[],campaigns:[],posts:[]};
sql.prepare('INSERT INTO marker_workspace VALUES(1,1,?)').run(JSON.stringify(work));
const DB={prepare(text){let args=[];const p={bind(...v){args=v;return p;},execute(){const q=sql.prepare(text);if(q.columns().length){const results=q.all(...args);return{success:true,results,meta:{changes:Number(sql.prepare('SELECT changes() AS n').get().n)}}}return{success:true,results:[],meta:{changes:Number(q.run(...args).changes)}}},async run(){return p.execute();},async all(){return p.execute();},async first(){return p.execute().results[0]??null;}};return p;},async batch(statements){sql.exec('BEGIN IMMEDIATE');try{const results=statements.map(p=>p.execute());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const blobs=new Map(),parts=new Map();const queue=[];let failEnqueue=true,failRender=false,renderCalls=0,probeCalls=0;
const actualVideo=readFileSync(join(root,'evidence','backend-native'+suffix,'exported.mp4'));
const actualOriginal=readFileSync(join(root,'evidence','backend-native'+suffix,'synthetic-broll-blue.mp4'));
const MEDIA={async head(k){return blobs.has(k)?{size:blobs.get(k).length}:null;},async get(k,o){const b=blobs.get(k);return b?{body:new Blob([o?.range?b.subarray(o.range.offset,o.range.offset+o.range.length):b]).stream(),size:b.length}:null;},async delete(k){blobs.delete(k);},async createMultipartUpload(key){const uploadId=crypto.randomUUID();parts.set(uploadId,{key,items:new Map()});return MEDIA.resumeMultipartUpload(key,uploadId);},resumeMultipartUpload(key,uploadId){return{uploadId,async uploadPart(i,b){parts.get(uploadId).items.set(i,Buffer.from(b));return{partNumber:i,etag:'synthetic-part-'+i};},async complete(items){blobs.set(key,Buffer.concat(items.map(x=>parts.get(uploadId).items.get(x.partNumber))));parts.delete(uploadId);},async abort(){parts.delete(uploadId);}}}};
const processor={async probe(key){probeCalls++;return{kind:'video',mime:'video/mp4',duration:8,width:320,height:180,audioTrack:'absent',processing:'ready',sha256:createHash('sha256').update(blobs.get(key)).digest('hex')};},async enqueue(id){if(failEnqueue)throw Error('controlled queue dependency failure');queue.push(id);},async render(id,spec,inputs,outputs){renderCalls++;if(failRender)throw Error('controlled rendering dependency failure');blobs.set(outputs.videoKey,actualVideo);blobs.set(outputs.coverKey,Buffer.from([137,80,78,71]));return{width:1080,height:1920,duration:spec.duration};}};
const env={DB,MEDIA,STUDIO_PROCESSOR:{getByName(){return processor;}},MARKER_ORIGIN:'https://audit.example.invalid'};
const checks=[],requests=[];
async function call(path='',data,method=data===undefined?'GET':'POST',bodyOverride){const r=await hostedStudioApi(new Request(env.MARKER_ORIGIN+'/api/studio'+path,{method,headers:{Origin:env.MARKER_ORIGIN,...(data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:bodyOverride??JSON.stringify(data)})}),env,work);const value=await r.json();requests.push({path,status:r.status});return{r,value};}
const state=async()=>(await call()).value.state;
async function cmd(type,data){return call('/commands',{expectedRevision:(await state()).revision,command:{type,data}});}
const ledger=()=>sql.prepare('SELECT * FROM marker_studio_limits').get();
const credit=()=>Number(sql.prepare('SELECT used_cents FROM marker_studio_compute').get()?.used_cents??0);
try{
 const init=await call('/uploads',{name:'Independent audit blue.mp4',mime:'video/mp4',size:actualOriginal.length});assert.equal(init.r.status,201);const uploadId=init.value.upload.id;
 const append=await hostedStudioApi(new Request(env.MARKER_ORIGIN+'/api/studio/uploads/'+uploadId,{method:'PUT',headers:{Origin:env.MARKER_ORIGIN,'Upload-Offset':'0'},body:actualOriginal}),env,work);assert.equal(append.status,200);await append.body.cancel();
 const completed=await call('/uploads/'+uploadId+'/complete',{});assert.equal(completed.r.status,200);assert.equal(credit(),5);assert.equal(probeCalls,1);assert.equal(ledger().stored_bytes,actualOriginal.length);assert.equal(ledger().reserved_bytes,0);
 await call('/uploads/'+uploadId+'/complete',{});assert.equal(credit(),5);assert.equal(probeCalls,1);
 checks.push({name:'C05 uploaded original converts reservation once and completion replay does not reprobe/recharge',status:'PASS'});
 const materialSaved=await cmd('material.save',{kind:'video',assetId:completed.value.asset.id,title:'Audit blue',rights:'owned',review:'ready',speech:'absent',productIds:['audit_product']});assert.equal(materialSaved.r.status,200);
 const m=materialSaved.value.state.materials[0];const campaign=await cmd('campaign.save',{productId:'audit_product',title:'Audit hosted ledger'});assert.equal(campaign.r.status,200);
 const c=campaign.value.state.campaigns[0];const saved=await cmd('variant.save',{campaignId:c.id,template:'overlay',body:'Audit original Ñ',duration:5,sourceIds:[m.id],selections:[{materialId:m.id,start:0,end:5}]});assert.equal(saved.r.status,200);let variant=saved.value.state.variants[0];
 const failedQueue=await call('/variants/'+variant.id+'/render',{recipeRevision:1});assert.equal(failedQueue.r.status,503);assert.equal(credit(),15);assert.equal(ledger().reserved_bytes,270*1024*1024);
 const queuedRow=sql.prepare("SELECT * FROM marker_studio_jobs WHERE status='queued'").get();assert.ok(queuedRow);failEnqueue=false;
 const resumed=await call('/variants/'+variant.id+'/render',{recipeRevision:1});assert.equal(resumed.r.status,200);assert.equal(resumed.value.job.id,queuedRow.id);assert.equal(credit(),15);assert.equal(queue[0],queuedRow.id);
 await executeHostedRender(env,queuedRow.id,processor);assert.equal(renderCalls,1);assert.equal(sql.prepare('SELECT status FROM marker_studio_jobs WHERE id=?').get(queuedRow.id).status,'completed');assert.equal(ledger().reserved_bytes,0);assert.equal(ledger().stored_bytes,actualOriginal.length+actualVideo.length+4);
 await call('/variants/'+variant.id+'/render',{recipeRevision:1});assert.equal(credit(),15);assert.equal(renderCalls,1);
 checks.push({name:'C05 enqueue failure leaves a durable queued receipt; explicit resume retains job ID and 10-cent charge; exact complete job reuses without new effect',status:'PASS'});
 await cmd('variant.save',{id:variant.id,body:'Otro mensaje Ñ'});variant=(await state()).variants[0];failRender=true;
 const second=await call('/variants/'+variant.id+'/render',{recipeRevision:variant.recipeRevision});assert.equal(second.r.status,202);assert.equal(credit(),25);await executeHostedRender(env,second.value.job.id,processor);
 const failure=sql.prepare('SELECT * FROM marker_studio_jobs WHERE id=?').get(second.value.job.id);assert.equal(failure.status,'failed');assert.equal(ledger().reserved_bytes,0);assert.equal(ledger().compute_token,null);assert.equal(credit(),25);
 const exportDenied=await call('/variants/'+variant.id+'/export');assert.equal(exportDenied.r.status,409);assert.equal(blobs.get('originals/'+uploadId).length,actualOriginal.length);
 checks.push({name:'C05 rendering dependency failure is terminal failed, preserves original, releases storage reservation once, retains charged credit and denies export',status:'PASS'});
 sql.close();sql=new DatabaseSync(path);sql.exec('PRAGMA foreign_keys=ON');assert.equal(credit(),25);assert.equal(sql.prepare('SELECT status FROM marker_studio_jobs WHERE id=?').get(second.value.job.id).status,'failed');
 checks.push({name:'C05 ledger and job outcomes persist through a new SQLite connection',status:'PASS'});
}catch(error){checks.push({status:'FAIL',error:String(error),stack:error.stack});process.exitCode=1;}
finally{writeFileSync(join(out,'result.json'),JSON.stringify({scope:'Real SQLite/native SQL with synthetic R2/processor for admission/failure semantics only; not Cloudflare or native hosted toolchain verification',checks,requests,ledger:ledger(),credits:credit(),renderCalls,probeCalls},null,2));sql.close();}
console.log(JSON.stringify({checks,requests:requests.length}));
