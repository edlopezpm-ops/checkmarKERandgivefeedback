import assert from 'node:assert/strict';
import {resolve,join,dirname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
import {randomBytes,createHash} from 'node:crypto';
const suffix=process.env.BACKEND_AUDIT_RUN??'';
if(!/^[A-Za-z0-9_-]*$/.test(suffix))throw Error('Use a simple optional fresh run suffix');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),source=resolve(root,'../../source'),directory=join(root,'backend','mcp-sandbox'+suffix),out=join(root,'evidence','backend-mcp'+suffix+'.json');
const {createLocalMcpApi}=await import(pathToFileURL(join(source,'server/mcp-local.ts')).href);
const {LocalRepository}=await import(pathToFileURL(join(source,'server/local.ts')).href);
const {editorialApi}=await import(pathToFileURL(join(source,'server/api.ts')).href);
const {createStudioApi}=await import(pathToFileURL(join(source,'server/studio-local.ts')).href);
await mkdir(directory,{recursive:true});
const origin='http://127.0.0.1:5196',checks=[];let api,studio;
const repository=new LocalRepository(join(directory,'workspace.json'));
async function backend(request){const work=await repository.read();return(await studio.handle(request,work))??editorialApi(request,repository);}
function start(){studio=createStudioApi({directory:join(directory,'studio'),tools:{ffmpeg:'missing',ffprobe:'missing'}});api=createLocalMcpApi({directory:join(directory,'authorization'),backend});}
async function stop(){api.close();await studio.close();}
async function oauth(path,data,method=data===undefined?'GET':'POST'){const json=path.endsWith('/register');return api.handle(new Request(origin+path,{method,headers:{Origin:origin,...(data===undefined?{}:{'Content-Type':json?'application/json':'application/x-www-form-urlencoded'})},...(data===undefined?{}:{body:json?JSON.stringify(data):new URLSearchParams(data).toString()})}));}
let callId=0;
async function rpc(token,method,params){const response=await api.handle(new Request(origin+'/api/mcp',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-11-25'},body:JSON.stringify({jsonrpc:'2.0',id:++callId,method,params})}));const data=await response.json();return{response,data,result:data.result};}
start();
try{
 const registered=await oauth('/api/mcp/oauth/register',{client_name:'Independent functional audit',redirect_uris:['http://127.0.0.1:48117/audit'],token_endpoint_auth_method:'none'});assert.equal(registered.status,201);const client=await registered.json();
 const verifier=randomBytes(32).toString('base64url'),challenge=createHash('sha256').update(verifier).digest('base64url');
 const query=new URLSearchParams({client_id:client.client_id,redirect_uri:client.redirect_uris[0],response_type:'code',code_challenge_method:'S256',code_challenge:challenge,resource:origin+'/api/mcp',scope:'marker:read marker:write marker:produce',state:'audit-correlation'});
 const consent=await oauth('/api/mcp/oauth/authorize?'+query);assert.equal(consent.status,200);const html=await consent.text(),nonce=/name="request" value="([^"]+)"/.exec(html)?.[1];assert.ok(nonce);
 const allow=await oauth('/api/mcp/oauth/authorize',{request:nonce,decision:'allow'});assert.equal(allow.status,303);const redirect=new URL(allow.headers.get('Location'));assert.equal(redirect.searchParams.get('state'),'audit-correlation');
 const exchanged=await oauth('/api/mcp/oauth/token',{client_id:client.client_id,grant_type:'authorization_code',code:redirect.searchParams.get('code'),redirect_uri:client.redirect_uris[0],code_verifier:verifier,resource:origin+'/api/mcp'});assert.equal(exchanged.status,200);const tokens=await exchanged.json();
 const listed=await rpc(tokens.access_token,'tools/list',{});assert.equal(listed.response.status,200);assert.equal(listed.result.tools.length,14);assert.equal(listed.result.tools.some(t=>t.name==='marker_delete'),false);
 checks.push({name:'C08 real local OAuth DCR+PKCE+explicit consent+token exchange exposes 14 non-delete tools',status:'PASS'});
 const profile=await rpc(tokens.access_token,'tools/call',{name:'marker_get_profile',arguments:{}});assert.equal(profile.result.isError,undefined);const stableId=profile.result.structuredContent.id;
 const args={expected_revision:0,request_id:'audit_write_20261026_a',name:'Producto nuevo MCP Ñ',description:'Hecho declarado por auditor',status:'preparation'};
 const saved=await rpc(tokens.access_token,'tools/call',{name:'marker_save_product',arguments:args});assert.equal(saved.result.isError,undefined);assert.equal(saved.result.structuredContent.revision,1);
 const fresh=new LocalRepository(join(directory,'workspace.json'));const readback=await fresh.read();assert.equal(readback.products[0].name,args.name);assert.equal(readback.products[0].description,args.description);
 const replay=await rpc(tokens.access_token,'tools/call',{name:'marker_save_product',arguments:args});assert.deepEqual(replay.result,saved.result);assert.equal((await fresh.read()).products.length,1);
 const conflict=await rpc(tokens.access_token,'tools/call',{name:'marker_save_product',arguments:{...args,name:'Conflicting facts'}});assert.equal(conflict.result.isError,true);assert.equal(conflict.result.structuredContent.code,'REQUEST_ID_CONFLICT');assert.equal((await fresh.read()).products[0].name,args.name);
 checks.push({name:'C08 tool traverses native backend to durable product; replay preserves one effect; changed arguments reject same operation ID',status:'PASS'});
 const denied=await rpc(tokens.access_token,'tools/call',{name:'marker_delete',arguments:{request_id:'audit_delete_20261026_a',expected_revision:1,resource:'product',id:readback.products[0].id,confirmation_id:readback.products[0].id}});assert.equal(denied.result.isError,true);assert.equal(denied.result.structuredContent.code,'INSUFFICIENT_SCOPE');assert.ok(denied.result._meta['mcp/www_authenticate']);assert.equal((await fresh.read()).products.length,1);
 checks.push({name:'C08 missing delete scope returns explicit auth challenge and leaves durable product unchanged',status:'PASS'});
 await stop();start();const rereadProfile=await rpc(tokens.access_token,'tools/call',{name:'marker_get_profile',arguments:{}});assert.equal(rereadProfile.result.structuredContent.id,stableId);const replayAfter=await rpc(tokens.access_token,'tools/call',{name:'marker_save_product',arguments:args});assert.deepEqual(replayAfter.result,saved.result);
 checks.push({name:'C08 new MCP/Studio instances preserve identity, grant and effect receipt',status:'PASS'});
 const revoked=await oauth('/api/mcp/oauth/revoke',{client_id:client.client_id,token:tokens.access_token});assert.equal(revoked.status,200);const rejected=await rpc(tokens.access_token,'tools/list',{});assert.equal(rejected.response.status,401);assert.equal((await fresh.read()).products.length,1);
 checks.push({name:'C08 revoked access token loses authorization while product remains in ordinary custody',status:'PASS'});
}catch(error){checks.push({status:'FAIL',error:String(error),stack:error.stack});process.exitCode=1;}
finally{await stop();await writeFile(out,JSON.stringify({scope:'Local protocol/SQLite/native product tools, synthetic owner and OAuth credentials. No real assistant host, hosted OAuth or inference claimed.',checks},null,2));}
console.log(JSON.stringify({checks}));
