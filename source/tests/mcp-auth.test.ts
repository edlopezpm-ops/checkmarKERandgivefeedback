import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { createMcpAuthorization } from '../server/mcp-auth.ts';

const ORIGIN = 'https://marker.example.invalid', RESOURCE = ORIGIN+'/api/mcp';
const CALLBACK = 'https://assistant.example.invalid/callback';
const verifier = 'v'.repeat(43), challenge = createHash('sha256').update(verifier).digest('base64url');
function fixture(t) {
  const sql = new DatabaseSync(':memory:'); sql.exec('PRAGMA foreign_keys=ON');
  for (const file of readdirSync(new URL('../migrations-d1/',import.meta.url)).filter(file=>/^\d+.*\.sql$/.test(file)).sort()) sql.exec(readFileSync(new URL('../migrations-d1/'+file,import.meta.url),'utf8'));
  const operator = sql.prepare('SELECT user_id,tenant_id FROM marker_auth_operator WHERE id=1').get();
  let failAt = -1;
  const db = { prepare(text) { let args = []; const statement = { bind(...values) { args = values; return statement; }, execute() { const query=sql.prepare(text); return query.columns().length ? { success:true, results:query.all(...args), meta:{changes:0} } : { success:true, results:[], meta:{changes:Number(query.run(...args).changes)} }; }, async first() { return statement.execute().results[0]??null; }, async all() { return statement.execute(); }, async run() { return statement.execute(); } }; return statement; }, async batch(statements) { sql.exec('BEGIN IMMEDIATE'); try { const result=statements.map((statement,index)=>{if(index===failAt)throw new Error('synthetic transaction failure');return statement.execute();}); sql.exec('COMMIT');return result;}catch(error){sql.exec('ROLLBACK');throw error;} } };
  const auth = createMcpAuthorization({ db, origin:ORIGIN, async ownerSession(request) { const who=request.headers.get('X-Synthetic-Owner');return !who ? null : {userId:who==='other'?'other-user':operator.user_id,tenantId:who==='other'?'other-tenant':operator.tenant_id,email:'owner@example.invalid'}; } });
  t.after(()=>sql.close());
  async function call(path,data,options={}) { const method=options.method|| (data===undefined?'GET':'POST');const isJson=options.json; const request=new Request((options.origin||ORIGIN)+path,{method,headers:{...(data===undefined?{}:{'Content-Type':isJson?'application/json':'application/x-www-form-urlencoded'}),...(options.owner?{'X-Synthetic-Owner':options.owner}:{}),...options.headers},...(data===undefined?{}:{body:options.raw??(isJson?JSON.stringify(data):new URLSearchParams(data).toString())})});return auth.handle(request); }
  async function register(name='Synthetic assistant',redirect=CALLBACK) { const result=await call('/api/mcp/oauth/register',{client_name:name,redirect_uris:[redirect],token_endpoint_auth_method:'none'},{json:true});assert.equal(result.status,201,await result.clone().text());return result.json(); }
  function authorization(app,extras={}) { return '/api/mcp/oauth/authorize?'+new URLSearchParams({client_id:app.client_id,redirect_uri:CALLBACK,response_type:'code',code_challenge_method:'S256',code_challenge:challenge,resource:RESOURCE,scope:'marker:read marker:write',state:'opaque-state',...extras}); }
  async function consent(app,extras={}) { const result=await call(authorization(app,extras),undefined,{owner:'owner'});assert.equal(result.status,200,await result.clone().text());const html=await result.text();const nonce=/name="request" value="([A-Za-z0-9_-]+)"/.exec(html)?.[1];assert.ok(nonce);return nonce; }
  async function approve(app,extras={}) { const nonce=await consent(app,extras);const result=await call('/api/mcp/oauth/authorize',{request:nonce,decision:'allow'},{owner:'owner',headers:{Origin:ORIGIN}});assert.equal(result.status,303,await result.clone().text());const callback=new URL(result.headers.get('Location'));assert.equal(callback.searchParams.get('state'),'opaque-state');assert.equal(callback.searchParams.get('iss'),ORIGIN);return callback.searchParams.get('code'); }
  async function exchange(app,code,extras={}) { return call('/api/mcp/oauth/token',{grant_type:'authorization_code',client_id:app.client_id,code,redirect_uri:CALLBACK,code_verifier:verifier,resource:RESOURCE,...extras}); }
  async function connect(scope='marker:read marker:write') { const app=await register();const code=await approve(app,{scope});const result=await exchange(app,code);assert.equal(result.status,200,await result.clone().text());return {app,code,...await result.json()}; }
  async function refresh(connection,extras={}) { return call('/api/mcp/oauth/token',{grant_type:'refresh_token',client_id:connection.app.client_id,refresh_token:connection.refresh_token,resource:RESOURCE,...extras}); }
  function authenticate(token,origin=ORIGIN) { return auth.authenticate(new Request(origin+'/api/mcp',{headers:{Authorization:'Bearer '+token}})); }
  return {sql,call,register,authorization,consent,approve,exchange,connect,refresh,authenticate,failBatchAt(value){failAt=value;}};
}

test('MCP discovery names exact resource and PKCE public-client endpoints without owner cookies',async t=>{
  const f=fixture(t), resource=await(await f.call('/.well-known/oauth-protected-resource/api/mcp')).json();
  assert.equal(resource.resource,RESOURCE);assert.deepEqual(resource.authorization_servers,[ORIGIN]);
  const result=await f.call('/.well-known/oauth-authorization-server');const issuer=await result.json();
  assert.equal(issuer.issuer,ORIGIN);assert.deepEqual(issuer.code_challenge_methods_supported,['S256']);assert.deepEqual(issuer.token_endpoint_auth_methods_supported,['none']);
  assert.equal(issuer.client_id_metadata_document_supported,false);assert.equal(result.headers.get('Cache-Control'),'no-store');
  assert.equal(await f.call('/api/something-else'),null);
});

test('DCR bounds public metadata and requires exact HTTPS redirects in hosted mode',async t=>{
  const f=fixture(t);
  for(const uri of ['http://assistant.example.invalid/callback','http://127.0.0.1:3000/callback','https://127.0.0.1:3000/callback','https://a:b@assistant.example.invalid/callback',CALLBACK+'#fragment','javascript:alert(1)']) {
    const result=await f.call('/api/mcp/oauth/register',{client_name:'Test',redirect_uris:[uri]},{json:true});assert.equal(result.status,400);
  }
  for(const data of [{redirect_uris:[CALLBACK],token_endpoint_auth_method:'client_secret_basic'},{redirect_uris:[CALLBACK],grant_types:['password']},{redirect_uris:[]},{redirect_uris:[CALLBACK],client_name:'x'.repeat(101)}])assert.equal((await f.call('/api/mcp/oauth/register',data,{json:true})).status,400);
  const app=await f.register('<script>untrusted name</script>');assert.equal(app.client_secret,undefined);
  assert.equal(f.sql.prepare('SELECT count(*) AS n FROM marker_mcp_clients').get().n,1);
});

test('anonymous authorize requests do not grant access; signed-in consent escapes names and preserves original logo',async t=>{
  const f=fixture(t),app=await f.register('<script>alert(1)</script>');
  const anonymous=await f.call(f.authorization(app));assert.equal(anonymous.status,200);assert.match(await anonymous.text(),/Sign in to marKER/);
  assert.equal(f.sql.prepare('SELECT count(*) AS n FROM marker_mcp_requests').get().n,0);
  const result=await f.call(f.authorization(app,{ui_locales:'es'}),undefined,{owner:'owner'}),html=await result.text();
  assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);assert.match(html,/\/brand\/marker-logo-v1\.png/);assert.match(html,/Permitir/);
  assert.equal(result.headers.get('X-Frame-Options'),'DENY');assert.equal(f.sql.prepare('SELECT count(*) AS n FROM marker_mcp_grants').get().n,0);
});

test('authorize rejects redirect substitution, duplicate parameters, unbound resources, PKCE downgrade and unknown scopes',async t=>{
  const f=fixture(t),app=await f.register();
  for(const extra of [{redirect_uri:'https://other.example.invalid/callback'},{resource:'https://other.example.invalid/api/mcp'},{code_challenge_method:'plain'},{response_type:'token'},{scope:'marker:read account:delete'},{scope:'marker:read marker:read'},{state:'x'.repeat(1025)}])assert.equal((await f.call(f.authorization(app,extra),undefined,{owner:'owner'})).status,400);
  assert.equal((await f.call(f.authorization(app)+'&client_id='+app.client_id,undefined,{owner:'owner'})).status,400);
  assert.equal(f.sql.prepare('SELECT count(*) AS n FROM marker_mcp_requests').get().n,0);
});

test('consent requires same-origin authenticated owner and single-use explicit Allow or Deny',async t=>{
  const f=fixture(t),app=await f.register(),nonce=await f.consent(app);
  assert.equal((await f.call('/api/mcp/oauth/authorize',{request:nonce,decision:'allow'},{owner:'owner',headers:{Origin:'https://other.invalid'}})).status,403);
  assert.equal((await f.call('/api/mcp/oauth/authorize',{request:nonce,decision:'allow'},{owner:'other',headers:{Origin:ORIGIN}})).status,403);
  assert.equal((await f.call('/api/mcp/oauth/authorize',{request:nonce,decision:'allow'},{headers:{Origin:ORIGIN}})).status,401);
  const denied=await f.call('/api/mcp/oauth/authorize',{request:nonce,decision:'deny'},{owner:'owner',headers:{Origin:ORIGIN}});assert.equal(denied.status,303);assert.equal(new URL(denied.headers.get('Location')).searchParams.get('error'),'access_denied');
  assert.equal((await f.call('/api/mcp/oauth/authorize',{request:nonce,decision:'allow'},{owner:'owner',headers:{Origin:ORIGIN}})).status,403);
  assert.equal(f.sql.prepare('SELECT count(*) AS n FROM marker_mcp_grants').get().n,0);
});

test('real SQLite code exchange binds PKCE, client, redirect, resource and opaque hashed credentials',async t=>{
  const f=fixture(t);t.mock.method(globalThis,'fetch',async()=>{throw new Error('No provider or remote metadata calls permitted');});
  const app=await f.register(),other=await f.register('Other'),code=await f.approve(app);
  for(const extra of [{client_id:other.client_id},{code_verifier:'w'.repeat(43)},{redirect_uri:'https://other.example.invalid/callback'},{resource:'https://other.invalid/api/mcp'}])assert.equal((await f.exchange(app,code,extra)).status,400);
  const result=await f.exchange(app,code);assert.equal(result.status,200,await result.clone().text());const token=await result.json();
  const principal=await f.authenticate(token.access_token);assert.deepEqual(principal.scopes,['marker:read','marker:write']);assert.equal(principal.clientId,app.client_id);
  assert.equal(await f.authenticate(token.refresh_token),null);assert.equal(await f.authenticate(token.access_token,'https://sibling.invalid'),null);
  const stored=JSON.stringify(f.sql.prepare('SELECT * FROM marker_mcp_tokens').all());assert.ok(!stored.includes(token.access_token));assert.ok(!stored.includes(token.refresh_token));
  assert.equal(f.sql.prepare('SELECT code_hash FROM marker_mcp_codes').get().code_hash,createHash('sha256').update(code).digest('hex'));
  assert.equal((await f.exchange(app,code)).status,400);
});

test('concurrent code exchanges admit exactly one token pair',async t=>{
  const f=fixture(t),app=await f.register(),code=await f.approve(app);
  const results=await Promise.all([f.exchange(app,code),f.exchange(app,code)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);assert.equal(f.sql.prepare('SELECT count(*) AS n FROM marker_mcp_tokens').get().n,1);
});

test('failed token transaction rolls back code consumption and permits a correct retry',async t=>{
  const f=fixture(t),app=await f.register(),code=await f.approve(app);f.failBatchAt(1);
  assert.equal((await f.exchange(app,code)).status,503);assert.equal(f.sql.prepare('SELECT consumed_by FROM marker_mcp_codes').get().consumed_by,null);
  f.failBatchAt(-1);assert.equal((await f.exchange(app,code)).status,200);
});

test('refresh rotates once; replay revokes whole grant family including latest access token',async t=>{
  const f=fixture(t),connection=await f.connect(),rotated=await f.refresh(connection);assert.equal(rotated.status,200);
  const next=await rotated.json();assert.notEqual(next.refresh_token,connection.refresh_token);assert.equal(await f.authenticate(connection.access_token),null);assert.ok(await f.authenticate(next.access_token));
  assert.equal((await f.refresh(connection)).status,400);assert.equal(await f.authenticate(next.access_token),null);
  assert.equal((await f.refresh({...connection,...next})).status,400);
});

test('concurrent refresh races revoke the family rather than leaving replayable credentials',async t=>{
  const f=fixture(t),connection=await f.connect();const results=await Promise.all([f.refresh(connection),f.refresh(connection)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);const token=await results.find(r=>r.status===200).json();assert.equal(await f.authenticate(token.access_token),null);
});

test('cross-client refresh/revoke and scope escalation fail without revoking valid owner grant',async t=>{
  const f=fixture(t),connection=await f.connect('marker:read'),other=await f.register('Other');
  assert.equal((await f.refresh(connection,{client_id:other.client_id})).status,400);
  assert.equal((await f.refresh(connection,{scope:'marker:read marker:delete'})).status,400);
  assert.equal((await f.call('/api/mcp/oauth/revoke',{client_id:other.client_id,token:connection.access_token})).status,200);
  assert.deepEqual((await f.authenticate(connection.access_token)).scopes,['marker:read']);
});

test('owner can list and revoke delegated connections; another owner and cross-origin requests cannot',async t=>{
  const f=fixture(t),connection=await f.connect();
  assert.equal((await f.call('/api/mcp/connections')).status,401);
  const rows=await(await f.call('/api/mcp/connections',undefined,{owner:'owner'})).json();assert.equal(rows.connections.length,1);const grantId=rows.connections[0].id;
  assert.deepEqual((await(await f.call('/api/mcp/connections',undefined,{owner:'other'})).json()).connections,[]);
  assert.equal((await f.call('/api/mcp/connections',{grantId},{json:true,owner:'owner',headers:{Origin:ORIGIN}})).status,403);
  assert.equal((await f.call('/api/mcp/connections',{grantId},{json:true,owner:'owner',headers:{Origin:'https://evil.invalid','X-Marker-MCP':'1'}})).status,403);
  assert.equal((await f.call('/api/mcp/connections',{grantId},{json:true,owner:'other',headers:{Origin:ORIGIN,'X-Marker-MCP':'1'}})).status,200);assert.ok(await f.authenticate(connection.access_token));
  assert.equal((await f.call('/api/mcp/connections',{grantId},{json:true,owner:'owner',headers:{Origin:ORIGIN,'X-Marker-MCP':'1'}})).status,200);assert.equal(await f.authenticate(connection.access_token),null);
});

test('RFC revocation accepts access or refresh credentials and makes authentication fail',async t=>{
  const f=fixture(t),connection=await f.connect();
  assert.equal((await f.call('/api/mcp/oauth/revoke',{client_id:connection.app.client_id,token:connection.refresh_token})).status,200);
  assert.equal(await f.authenticate(connection.access_token),null);
  assert.equal((await f.call('/api/mcp/oauth/revoke',{client_id:connection.app.client_id,token:'unknown'})).status,200);
});

test('expiry and durable account freeze deny access; migration blocks already-admitted writes',async t=>{
  const f=fixture(t),connection=await f.connect();
  f.sql.prepare('UPDATE marker_mcp_tokens SET access_expires_at=0').run();assert.equal(await f.authenticate(connection.access_token),null);
  f.sql.prepare("UPDATE marker_account_lifecycle SET status='deleting',phase='processor' WHERE id=1").run();
  assert.equal((await f.call('/.well-known/oauth-authorization-server')).status,403);assert.equal(await f.authenticate(connection.access_token),null);
  assert.throws(()=>f.sql.prepare('UPDATE marker_mcp_grants SET expires_at=expires_at+1').run(),/ACCOUNT_CLOSED/);
});

test('endpoints bound methods, bodies, registration rate and do not accept client-secret auth',async t=>{
  const f=fixture(t),app=await f.register();
  assert.equal((await f.call('/api/mcp/oauth/token')).status,405);
  assert.equal((await f.call('/api/mcp/oauth/token',{}, {raw:'a'.repeat(8193)})).status,413);
  assert.equal((await f.call('/api/mcp/oauth/register',{}, {json:true,raw:'{'})).status,400);
  assert.equal((await f.call('/api/mcp/oauth/token',{client_id:app.client_id,resource:RESOURCE,client_secret:'forbidden'})).status,400);
  for(let i=0;i<19;i++)await f.register('Rate '+i);
  assert.equal((await f.call('/api/mcp/oauth/register',{redirect_uris:[CALLBACK]},{json:true})).status,429);
});
