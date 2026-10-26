import {spawn, execFileSync} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const root=resolve(dirname(fileURLToPath(import.meta.url)), '..');
const run=process.env.BACKEND_AUDIT_RUN??'';
if(!/^[A-Za-z0-9_-]*$/.test(run))throw Error('Use a simple optional fresh run suffix');
const source=process.env.BACKEND_AUDIT_SOURCE??resolve(root,'../../source');
const data=join(root,'backend','native-data'+run);
const out=join(root,'evidence','backend-native'+run);
const ffmpeg=process.env.MARKER_FFMPEG ?? 'ffmpeg';
const ffprobe=process.env.MARKER_FFPROBE ?? 'ffprobe';
const origin='http://127.0.0.1:5194';
const checks=[], requests=[]; let child, log='',state, workspace;
const hash=b=>createHash('sha256').update(b).digest('hex');
async function start(){
 child=spawn(process.execPath,[join(source,'node_modules','vite','bin','vite.js'),'--host','127.0.0.1','--port','5194','--strictPort'],{cwd:source,env:{...process.env,MARKER_LOCAL_DATA:join(data,'workspace.json'),MARKER_STUDIO_DIR:join(data,'studio'),MARKER_AGENTS_DIR:join(data,'agents'),MARKER_MCP_DIR:join(data,'mcp'),MARKER_FFMPEG:ffmpeg,MARKER_FFPROBE:ffprobe},windowsHide:true,stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',b=>log+=b.toString()); child.stderr.on('data',b=>log+=b.toString());
 for(let i=0;i<120;i++){try{const r=await fetch(origin+'/api/workspace');if(r.ok)return;}catch{} await new Promise(r=>setTimeout(r,250));}
 throw Error('Vite did not start');
}
async function stop(){if(!child)return;child.kill();await new Promise(r=>child.once('exit',r));child=undefined;}
async function req(path,body,method=body===undefined?'GET':'POST',extra={}){
 const r=await fetch(origin+path,{method,headers:{Origin:origin,...(body===undefined?{}:{'Content-Type':'application/json'}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const bytes=Buffer.from(await r.arrayBuffer());const json=(r.headers.get('content-type')??'').includes('application/json')?JSON.parse(bytes):undefined;
 requests.push({method,path,status:r.status,...(json?.error?{error:json.error}:{}),bytes:bytes.length});return{r,json,bytes};
}
function pass(name,details={}){checks.push({name,status:'PASS',...details});}
async function editorial(type,data){const p=await req('/api/commands',{revision:workspace.revision,type,data});assert.equal(p.r.status,200,JSON.stringify(p.json));workspace=p.json;return workspace;}
async function command(type,data,expected=state.revision){const p=await req('/api/studio/commands',{expectedRevision:expected,command:{type,data}});if(p.r.ok)state=p.json.state;return p;}

await mkdir(data,{recursive:true});await mkdir(out,{recursive:true});
try{
 await start(); workspace=(await req('/api/workspace')).json; assert.equal(workspace.revision,0);
 await editorial('product.save',{name:'AUDIT Ñ 20261026',description:'Mensaje audit Ñ',audience:'synthetic',language:'es',tone:'literal',cta:'',url:'',status:'preparation'});
 const productId=workspace.products[0].id;
 const conflict=await req('/api/commands',{revision:0,type:'product.save',data:{name:'Lost update',status:'preparation'}});assert.equal(conflict.r.status,409);
 await editorial('account.save',{name:'Synthetic LinkedIn',platform:'LinkedIn',url:'https://example.invalid/audit',productIds:[productId],timezone:'America/New_York',language:'es'});
 await editorial('source.save',{productId,title:'Legacy literal',text:'Contenido literal inédita Ñ 26',declaredDate:'2026-10-26'});
 await editorial('campaign.create',{productId,title:'Legacy audit',objective:'API path proof',audience:'synthetic',sourceIds:[workspace.sources[0].id],accountIds:[workspace.accounts[0].id],kind:'organic',currency:'',budget:''});
 assert.equal(workspace.posts.length,1);assert.equal(workspace.posts[0].text,'');
 pass('C01 API editorial creates real source/campaign/post and rejects stale CAS',{workspaceRevision:workspace.revision,posts:1});
 state=(await req('/api/studio')).json.state;
 const input=join(out,'synthetic-broll-blue.mp4');
 execFileSync(ffmpeg,['-hide_banner','-v','error','-nostdin','-n','-f','lavfi','-i','color=c=blue:s=320x180:r=30:d=8','-an','-c:v','libx264','-pix_fmt','yuv420p',input],{windowsHide:true,timeout:30000});
 const original=await readFile(input);
 const begun=await req('/api/studio/uploads',{name:'AUDIT-broll-blue.mp4',mime:'video/mp4',size:original.length});assert.equal(begun.r.status,201);
 const uploadId=begun.json.upload.id;
 const put=await fetch(origin+'/api/studio/uploads/'+uploadId,{method:'PUT',headers:{Origin:origin,'Upload-Offset':'0','Content-Type':'application/octet-stream'},body:original});assert.equal(put.status,200);await put.body.cancel();
 const completed=await req('/api/studio/uploads/'+uploadId+'/complete',{});assert.equal(completed.r.status,200);state=completed.json.state;
 const asset=completed.json.asset;assert.equal(asset.sha256,hash(original));assert.equal(asset.processing,'ready');
 const downloaded=await req('/api/studio/assets/'+asset.id);assert.equal(hash(downloaded.bytes),hash(original));
 pass('C02 original upload hashes and fresh HTTP bytes match independent SHA256',{sha256:hash(original),size:original.length});
 let p=await command('material.save',{assetId:asset.id,kind:'video',title:'B-roll azul',productIds:[productId],review:'ready',rights:'owned',speech:'absent',categories:[],roles:[],topics:[],restrictions:'',description:'',text:''});assert.equal(p.r.status,200);
 const material=state.materials[0];assert.deepEqual(material.categories,['broll']);assert.equal(material.rights,'owned');
 const before=structuredClone(state);p=await command('material.classify',{ids:[material.id]});assert.equal(p.r.status,200);assert.deepEqual(state,before);pass('C02 classification is idempotent and preserves rights/revision');
 p=await command('campaign.save',{productId,title:'Native audit',objective:'Real file',kind:'organic'});assert.equal(p.r.status,200);const campaignId=state.campaigns[0].id;
 const plan={campaignId,candidateIds:[material.id],includeShared:false,platform:'Instagram',template:'overlay',hook:'',body:'Mensaje audit Ñ',cta:'',duration:5,lockedSelections:[],reviewedMaterialIds:[],allowReuse:false,muteBackground:true,audio:'mute'};
 const planned=await req('/api/studio/plan',plan);assert.equal(planned.r.status,200,JSON.stringify(planned.json));const proposal=planned.json.proposals[0];assert.equal(proposal.recipe.selections.reduce((n,x)=>n+x.end-x.start,0),5);assert.equal(proposal.recipe.body,plan.body);
 p=await command('variant.plan',{request:plan,fingerprint:'0'.repeat(64),alternative:0});assert.equal(p.r.status,409);
 p=await command('variant.plan',{request:plan,fingerprint:planned.json.fingerprint,alternative:0});assert.equal(p.r.status,200,JSON.stringify(p.json));
 const variant=state.variants[0];pass('C03 planner selects exact duration/literal copy and rejects forged fingerprint',{variantId:variant.id,recipeRevision:variant.recipeRevision});
 let exported=await req('/api/studio/variants/'+variant.id+'/export');assert.equal(exported.r.status,409);
 let render=await req('/api/studio/variants/'+variant.id+'/render',{recipeRevision:variant.recipeRevision});assert.equal(render.r.status,202);const jobId=render.json.job.id;
 let job;for(let i=0;i<600;i++){const polled=await req('/api/studio/jobs/'+jobId);job=polled.json.job;if(['completed','failed'].includes(job.status))break;await new Promise(r=>setTimeout(r,200));}
 assert.equal(job.status,'completed',JSON.stringify(job));
 let approve=await req('/api/studio/variants/'+variant.id+'/approve',{recipeRevision:variant.recipeRevision,jobId,confirmed:false});assert.equal(approve.r.status,400);
 approve=await req('/api/studio/variants/'+variant.id+'/approve',{recipeRevision:variant.recipeRevision+1,jobId,confirmed:true});assert.equal(approve.r.status,409);
 approve=await req('/api/studio/variants/'+variant.id+'/approve',{recipeRevision:variant.recipeRevision,jobId,confirmed:true});assert.equal(approve.r.status,200);state=approve.json.state;
 exported=await req('/api/studio/variants/'+variant.id+'/export');assert.equal(exported.r.status,200);const exportedHash=hash(exported.bytes),target=join(out,'exported.mp4');await writeFile(target,exported.bytes);
 const probed=JSON.parse(execFileSync(ffprobe,['-v','error','-show_streams','-show_format','-of','json',target],{encoding:'utf8',windowsHide:true,timeout:30000}));const video=probed.streams.find(x=>x.codec_type==='video');assert.equal(video.width,1080);assert.equal(video.height,1920);assert.equal(video.codec_name,'h264');assert.ok(Math.abs(Number(probed.format.duration)-5)<0.15);
 execFileSync(ffmpeg,['-hide_banner','-v','error','-nostdin','-i',target,'-f','null','-'],{windowsHide:true,timeout:30000});
 pass('C04 native MP4 renders, decodes fully, and exact human-approved revision exports',{sha256:exportedHash,size:exported.bytes.length,width:video.width,height:video.height,duration:Number(probed.format.duration)});
 const savedWorkspace=structuredClone(workspace),savedStudio=structuredClone(state);
 await stop(); await start();workspace=(await req('/api/workspace')).json;state=(await req('/api/studio')).json.state;assert.deepEqual(workspace,savedWorkspace);assert.deepEqual(state,savedStudio);
 exported=await req('/api/studio/variants/'+variant.id+'/export');assert.equal(hash(exported.bytes),exportedHash);pass('C01/C02/C03/C04 new process reads same durable records and MP4 bytes');
 p=await command('variant.save',{id:variant.id,body:'Texto cambiado Ñ'});assert.equal(p.r.status,200);assert.equal(state.variants[0].recipeRevision,variant.recipeRevision+1);assert.equal(state.variants[0].status,'draft');
 exported=await req('/api/studio/variants/'+variant.id+'/export');assert.equal(exported.r.status,409);pass('C04 recipe edit invalidates approval and export');
 const settings=(await req('/api/studio/settings')).json;const updated={...settings.settings};delete updated.revision;updated.defaultDurationSeconds=59;
 const saved=await req('/api/studio/settings',{expectedRevision:settings.settings.revision,settings:updated});assert.equal(saved.r.status,200);const stale=await req('/api/studio/settings',{expectedRevision:settings.settings.revision,settings:updated});assert.equal(stale.r.status,409);
 const invalid=await req('/api/studio/settings',{expectedRevision:saved.json.settings.revision,settings:{...updated,processingBudgetCents:2001}});assert.equal(invalid.r.status,400);pass('C10 settings enforce installed bounds and independent CAS');
 await writeFile(join(out,'ffprobe.json'),JSON.stringify(probed,null,2));
}catch(error){checks.push({status:'FAIL',error:String(error),stack:error.stack});process.exitCode=1;}
finally{await stop();await writeFile(join(out,'result.json'),JSON.stringify({source,checks,requests},null,2));await writeFile(join(out,'vite.log'),log);}
console.log(JSON.stringify({checks,requests:requests.length}));
