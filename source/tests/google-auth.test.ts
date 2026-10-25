import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleOwnerAuth, ownerSession, describeOwnerAuth, authorizedOwner } from '../server/native-auth.js';

const ORIGIN = 'https://marker.aekr.io', CLIENT = '123456789-syntheticclient.apps.googleusercontent.com', ISSUER = 'https://accounts.google.com';
const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const publicKey = { ...await crypto.subtle.exportKey('jwk', pair.publicKey), kid: 'synthetic-key', use: 'sig', alg: 'RS256' };
const encode = value => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
async function jwt(claims, header = { alg: 'RS256', kid: 'synthetic-key' }) { const content = `${encode(header)}.${encode(claims)}`; return `${content}.${Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(content))).toString('base64url')}`; }
function cookie(response, name) { return response.headers.getSetCookie().find(value => value.startsWith(name + '='))?.split(';')[0] || ''; }
function fixture(t) {
  const sql = new DatabaseSync(':memory:'); sql.exec('PRAGMA foreign_keys=ON');
  for (const name of ['0001_private.sql', '0007_single_tenant_auth.sql', '0008_github_auth.sql']) sql.exec(readFileSync(new URL(`../migrations-d1/${name}`, import.meta.url), 'utf8'));
  const state = { now: Date.parse('2026-10-24T12:00:00Z'), claims: {}, token: null, tokensByCode: new Map(), tokenCalls: 0, jwksCalls: 0, requestURLs: [], tokenRedirect: false, jwksRedirect: false, failToken: false, tokenError: null, tokenStatus: 400, failTransport: false, delayMs: 0, tokenTransform: null };
  t.mock.method(Date, 'now', () => state.now); t.after(() => sql.close());
  const DB = {
    prepare(text) {
      let args = [];
      const statement = {
        bind(...values) { args = values; return statement; },
        execute() { const prepared = sql.prepare(text); return prepared.columns().length ? { success: true, results: prepared.all(...args), meta: { changes: 0 } } : { success: true, results: [], meta: { changes: Number(prepared.run(...args).changes) } }; },
      };
      return statement;
    },
    async batch(statements) { sql.exec('BEGIN IMMEDIATE'); try { const results = statements.map(statement => statement.execute()); sql.exec('COMMIT'); return results; } catch (error) { sql.exec('ROLLBACK'); throw error; } },
  };
  const mail = [], jobs = [], warnings = []; const ctx = { waitUntil(job) { jobs.push(job); } };
  t.mock.method(console,'warn',(...values)=>warnings.push(values));
  const env = { DB, MARKER_ORIGIN: ORIGIN, MARKER_OWNER_EMAIL: 'owner@example.invalid', MARKER_SENDER_EMAIL: 'marker@aekr.io', MARKER_AUTH_SECRET: 'synthetic-existing-marker-secret-at-least-32-bytes', MARKER_GOOGLE_CLIENT_ID: CLIENT, MARKER_GOOGLE_CLIENT_SECRET: 'synthetic-dedicated-google-secret', EMAIL: { async send(value) { mail.push(value); } } };
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    if(options.redirect==='error')throw new TypeError('Workers does not implement the error redirect mode');
    assert.equal(options.redirect, 'manual');state.requestURLs.push(String(url));
    if (String(url) === 'https://www.googleapis.com/oauth2/v3/certs') { state.jwksCalls++; return state.jwksRedirect?new Response(null,{status:302,headers:{Location:'https://attacker.invalid/keys'}}):Response.json({ keys: [publicKey] }); }
    assert.equal(String(url), 'https://oauth2.googleapis.com/token'); state.tokenCalls++; state.now += state.delayMs;
    const form = options.body; assert.equal(form.get('client_id'), CLIENT); assert.equal(form.get('redirect_uri'), ORIGIN + '/api/auth/google/callback'); assert.equal(form.get('grant_type'), 'authorization_code'); assert.match(form.get('code_verifier'), /^[A-Za-z0-9_-]{43}$/);
    if(state.tokenRedirect)return new Response(null,{status:302,headers:{Location:'https://attacker.invalid/token'}});
    if (state.failTransport) throw new Error('Untrusted raw network details must not be logged');
    if (state.failToken || state.tokenError) return Response.json({ error: state.tokenError ?? 'synthetic_provider_failure', error_description: 'never-log-private-provider-description' }, { status: state.tokenStatus });
    const token = state.tokensByCode.get(form.get('code')) ?? state.token;
    return Response.json({ id_token: state.tokenTransform ? state.tokenTransform(token) : token, access_token: 'never-persist-this-access-token', refresh_token: 'never-persist-this-refresh-token' });
  });
  async function call(path, data?, cookies = '', options = {}) { const method = options.method ?? (data === undefined ? 'GET' : 'POST'); const response = await handleOwnerAuth(new Request((options.origin ?? ORIGIN) + '/api/auth/' + path, { method, headers: { Origin: ORIGIN, 'X-Marker-Auth': '1', 'CF-Connecting-IP': '192.0.2.24', 'Content-Type': 'application/json', ...(cookies ? { Cookie: cookies } : {}), ...options.headers }, ...(method === 'GET' ? {} : { body: JSON.stringify(data) }) }), options.env ?? env, ctx); await Promise.all(jobs.splice(0)); return response; }
  async function emailLogin() { const requested = await call('request', { email: 'owner@example.invalid' }); assert.equal(requested.status, 202); const challenge = cookie(requested, '__Host-marker_challenge'), code = mail.at(-1).text.match(/\b\d{8}\b/)[0]; const verified = await call('verify', { code }, challenge); assert.equal(verified.status, 200); return cookie(verified, '__Host-marker_session'); }
  async function start(intent, cookies = '') { const response = await call('google/start', { intent }, cookies); assert.equal(response.status, 200, await response.clone().text()); const url = new URL((await response.json()).url); return { response, url, browser: cookie(response, '__Host-marker_oauth') }; }
  async function callback(flow, overrides = {}, options = {}) { const now = Math.floor(state.now / 1000); state.token = await jwt({ iss: ISSUER, sub: 'immutable-google-subject-123', aud: CLIENT, email: 'different-google-account@example.invalid', email_verified: true, nonce: flow.url.searchParams.get('nonce'), iat: now, exp: now + 3600, ...overrides }); const code = options.code ?? 'one-use-code'; state.tokensByCode.set(code,state.token); const issuerQuery=options.issuer===null?'':'&iss='+encodeURIComponent(options.issuer??ISSUER)+(options.duplicateIssuer?'&iss='+encodeURIComponent(ISSUER):''); return call('google/callback?state=' + encodeURIComponent(flow.url.searchParams.get('state')) + '&code=' + encodeURIComponent(code)+issuerQuery, undefined, options.cookie ?? flow.browser, { method: 'GET' }); }
  const sessionRequest = cookies => new Request(ORIGIN + '/api/session', { headers: { Cookie: cookies } });
  return { sql, state, env, call, emailLogin, start, callback, sessionRequest, warnings };
}

test('dedicated optional Google configuration is honest and never creates a first identity from email equality', async t => {
  const f = fixture(t), disabled = { ...f.env, MARKER_GOOGLE_CLIENT_ID: undefined, MARKER_GOOGLE_CLIENT_SECRET: undefined };
  const metadata = await describeOwnerAuth(f.sessionRequest(''), disabled); assert.equal(metadata.methods.email.configured, true); assert.deepEqual(metadata.methods.google, { configured: false, bound: false, canLink: false, linkRequiresEmailVerification: true });
  assert.equal((await f.call('google/start', { intent: 'login' }, '', { env: disabled })).status, 503);
  assert.equal((await f.call('google/start', { intent: 'login' })).status, 409);
  assert.equal((await f.call('google/start', { intent: 'link' })).status, 403);
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM marker_auth_identities').get().n, 0); assert.equal(f.state.tokenCalls, 0);
});

test('fresh email proof links immutable Google subject; Google signs in to the retained singleton without the Strict cookie', async t => {
  const f = fixture(t), native = await f.emailLogin(), before = await ownerSession(f.sessionRequest(native), f.env);
  assert.ok(before); assert.equal(before.method, 'email'); assert.equal((await describeOwnerAuth(f.sessionRequest(native), f.env)).methods.google.canLink, true);
  const flow = await f.start('link', native); assert.equal(flow.url.origin, 'https://accounts.google.com'); assert.equal(flow.url.searchParams.get('code_challenge_method'), 'S256'); assert.equal(flow.url.searchParams.get('scope'), 'openid email profile'); assert.match(flow.response.headers.get('set-cookie'), /SameSite=Lax; Max-Age=600/);
  const linked = await f.callback(flow); assert.equal(linked.status, 303); assert.equal(linked.headers.get('location'), ORIGIN + '/?auth=google-linked');
  const metadata = await describeOwnerAuth(f.sessionRequest(native), f.env); assert.equal(metadata.methods.google.bound, true);
  const loginFlow = await f.start('login'); const signedIn = await f.callback(loginFlow); assert.equal(signedIn.headers.get('location'), ORIGIN + '/?auth=signed-in'); assert.match(signedIn.headers.getSetCookie().find(value => value.startsWith('__Host-marker_session=')), /SameSite=Strict; Max-Age=21600/);
  const googleCookie = cookie(signedIn, '__Host-marker_session'), after = await ownerSession(f.sessionRequest(googleCookie), f.env); assert.deepEqual([after.tenantId, after.userId], [before.tenantId, before.userId]); assert.equal(after.email, 'owner@example.invalid'); assert.equal(after.method, 'google');
  assert.equal((await describeOwnerAuth(f.sessionRequest(googleCookie), f.env)).methods.google.canLink, false);
  const wrongIdentity = await f.start('login'); assert.equal((await f.callback(wrongIdentity, { sub: 'another-subject', email: 'owner@example.invalid' })).headers.get('location'), ORIGIN + '/?auth=failed', 'Email equality cannot replace immutable subject binding');
  const persisted = JSON.stringify(f.sql.prepare("SELECT * FROM marker_auth_identities").all()); for (const raw of ['immutable-google-subject-123', 'different-google-account@example.invalid', 'never-persist-this-access-token', 'never-persist-this-refresh-token']) assert.equal(persisted.includes(raw), false);
  assert.equal((await f.callback(flow)).headers.get('location'), ORIGIN + '/?auth=failed', 'Callback must consume its state once');
});

test('binding requires same browser, a still-active original email session and proof younger than five minutes', async t => {
  const f = fixture(t), native = await f.emailLogin();
  let flow = await f.start('link', native); assert.equal((await f.callback(flow, {}, { cookie: '' })).headers.get('location'), ORIGIN + '/?auth=failed');
  const stored = f.sql.prepare('SELECT sealed_verifier FROM marker_auth_oauth_flows').get(); assert.match(stored.sealed_verifier, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  flow = await f.start('link', native); f.state.now += 300_000; assert.equal((await f.callback(flow)).headers.get('location'), ORIGIN + '/?auth=failed');
  assert.equal((await f.call('google/start', { intent: 'link' }, native)).status, 403);
  f.state.now += 61_000; const fresh = await f.emailLogin(); flow = await f.start('link', fresh); await f.call('logout', {}, fresh); assert.equal((await f.callback(flow)).headers.get('location'), ORIGIN + '/?auth=failed');
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM marker_auth_identities').get().n, 0);
});

test('provider proof validates signature issuer audience azp nonce timestamps and verified identity before binding', async t => {
  const f = fixture(t); let native = await f.emailLogin();
  const cases = [() => ({ iss: 'https://attacker.invalid' }), () => ({ aud: 'another-client' }), () => ({ aud: [CLIENT, 'another-client'] }), () => ({ azp: 'another-client' }), () => ({ nonce: 'wrong-nonce' }), now => ({ exp: now - 1 }), now => ({ iat: now + 61 }), now => ({ iat: now - 601 }), now => ({ nbf: now + 61 }), () => ({ email_verified: false }), () => ({ sub: '' })];
  for (const buildClaims of cases) {
    const claims = buildClaims(Math.floor(f.state.now / 1000));
    const flow = await f.start('link', native); const result = await f.callback(flow, claims); assert.equal(result.headers.get('location'), ORIGIN + '/?auth=failed', JSON.stringify(claims));
    assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM marker_auth_identities').get().n, 0);
    f.state.now += 3601_000; // Reset this IP's bounded hourly quota, then obtain fresh independent email proof.
    native = await f.emailLogin();
  }
  f.state.tokenTransform = value => { const parts = value.split('.'); parts[2] = (parts[2][0] === 'A' ? 'B' : 'A') + parts[2].slice(1); return parts.join('.'); };
  const tampered = await f.start('link', native); assert.equal((await f.callback(tampered)).headers.get('location'), ORIGIN + '/?auth=failed');
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM marker_auth_identities').get().n, 0);
});

test('single-tenant identity upgrades retained sessions without moving data and rejects client-selected tenant or changed operator', async t => {
  const f = fixture(t), native = await f.emailLogin();
  const original = await ownerSession(f.sessionRequest(native), f.env); assert.ok(original); assert.match(original.tenantId, /^[a-f0-9]{32}$/); assert.match(original.userId, /^[a-f0-9]{32}$/);
  const nativeRow = f.sql.prepare('SELECT * FROM marker_auth_sessions').get();
  f.sql.prepare('DELETE FROM marker_auth_principals').run();
  const legacy = await ownerSession(f.sessionRequest(native), f.env); assert.deepEqual([legacy.tenantId, legacy.userId, legacy.authenticatedAt], [original.tenantId, original.userId, nativeRow.created_at]);
  f.sql.prepare('INSERT INTO marker_workspace(id,revision,document) VALUES(1,1,?)').run(JSON.stringify({ version: 1, revision: 1, products: [{ id: 'existing-data' }] }));
  const workspace = f.sql.prepare('SELECT document FROM marker_workspace').get().document;
  assert.equal((await f.call('google/start', { intent: 'link', tenant_id: 'caller-selected' }, native)).status, 400);
  assert.equal(await authorizedOwner(f.sessionRequest(native), { ...f.env, MARKER_OWNER_EMAIL: 'replacement@example.invalid' }), false);
  assert.equal(f.sql.prepare('SELECT document FROM marker_workspace').get().document, workspace);
  const flow = await f.start('link', native); await f.callback(flow);
  const count = f.sql.prepare('SELECT COUNT(*) AS n FROM marker_auth_operator').get().n; assert.equal(count, 1);
  assert.equal(f.sql.prepare('SELECT document FROM marker_workspace').get().document, workspace);
});

test('Google linking rechecks fresh proof after provider latency and fails closed on state, CSRF and provider errors', async t => {
  const f = fixture(t), native = await f.emailLogin();
  assert.equal((await f.call('google/start', { intent: 'link' }, native, { headers: { Origin: 'https://attacker.invalid' } })).status, 403);
  assert.equal((await f.call('google/start', { intent: 'link' }, native, { headers: { 'X-Marker-Auth': '0' } })).status, 403);
  assert.equal((await f.call('google/start', { intent: 'link' }, native, { method: 'GET' })).status, 405);
  let flow = await f.start('link', native); f.state.failToken = true; assert.equal((await f.callback(flow)).headers.get('location'), ORIGIN + '/?auth=failed'); f.state.failToken = false;
  flow = await f.start('link', native); f.state.delayMs = 300_000; assert.equal((await f.callback(flow)).headers.get('location'), ORIGIN + '/?auth=failed'); f.state.delayMs = 0;
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM marker_auth_identities').get().n, 0);
  const invalid = await f.call('google/callback?state=unrecognized&code=code', undefined, '', { method: 'GET' }); assert.equal(invalid.headers.get('location'), ORIGIN + '/?auth=failed'); assert.equal(f.state.tokenCalls, 2);
});

test('concurrent first-link flows retain exactly one immutable Google identity and deny the losing subject', async t => {
  const f=fixture(t),native=await f.emailLogin();
  const original=await ownerSession(f.sessionRequest(native),f.env);
  const flows=await Promise.all([f.start('link',native),f.start('link',native)]);
  assert.notEqual(flows[0].browser,flows[1].browser);
  const subjects=['concurrent-google-subject-a','concurrent-google-subject-b'];
  const results=await Promise.all(flows.map((flow,index)=>f.callback(flow,{sub:subjects[index]},{code:`concurrent-proof-${index}`})));
  const destinations=results.map(result=>result.headers.get('location'));
  assert.deepEqual([...destinations].sort(),[ORIGIN+'/?auth=failed',ORIGIN+'/?auth=google-linked']);
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM marker_auth_identities').get().n,1);
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM marker_auth_operator').get().n,1);
  const winner=destinations.indexOf(ORIGIN+'/?auth=google-linked'),loser=1-winner;
  const winningLogin=await f.callback(await f.start('login'),{sub:subjects[winner]},{code:'winning-login'});
  assert.equal(winningLogin.headers.get('location'),ORIGIN+'/?auth=signed-in');
  const principal=await ownerSession(f.sessionRequest(cookie(winningLogin,'__Host-marker_session')),f.env);
  assert.deepEqual([principal.tenantId,principal.userId],[original.tenantId,original.userId]);
  const losingLogin=await f.callback(await f.start('login'),{sub:subjects[loser],email:'owner@example.invalid'},{code:'losing-login'});
  assert.equal(losingLogin.headers.get('location'),ORIGIN+'/?auth=failed');
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM marker_auth_identities').get().n,1);
});

test('Google authorization response accepts one canonical issuer or legacy omission and rejects mismatched or duplicate issuers before exchange',async t=>{
  const f=fixture(t),native=await f.emailLogin();
  const linked=await f.callback(await f.start('link',native));assert.equal(linked.headers.get('location'),ORIGIN+'/?auth=google-linked');
  const legacy=await f.callback(await f.start('login'),{}, {issuer:null});assert.equal(legacy.headers.get('location'),ORIGIN+'/?auth=signed-in');
  const exchanges=f.state.tokenCalls;
  const wrong=await f.callback(await f.start('login'),{}, {issuer:'https://attacker.invalid'});assert.equal(wrong.headers.get('location'),ORIGIN+'/?auth=failed');
  const duplicate=await f.callback(await f.start('login'),{}, {duplicateIssuer:true});assert.equal(duplicate.headers.get('location'),ORIGIN+'/?auth=failed');
  assert.equal(f.state.tokenCalls,exchanges);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM marker_auth_identities').get().n,1);
  assert.deepEqual(f.warnings,[['marker-google-auth-failed','callback'],['marker-google-auth-failed','callback']]);
});

test('token-exchange diagnostics expose only fixed substages, known error classifiers and HTTP status',async t=>{
  const f=fixture(t),native=await f.emailLogin();
  for (const [index,error] of ['invalid_client','invalid_grant','invalid_request','unauthorized_client','untrusted-secret-like-provider-error'].entries()) {
    f.state.tokenError=error;f.state.tokenStatus=index===0?401:400;
    const failed=await f.callback(await f.start('link',native));assert.equal(failed.headers.get('location'),ORIGIN+'/?auth=failed');
    assert.deepEqual(f.warnings.at(-1),['marker-google-auth-failed','token-response',index<4?error:'other',f.state.tokenStatus]);
  }
  f.state.tokenError=null;f.state.failTransport=true;
  await f.callback(await f.start('link',native));assert.deepEqual(f.warnings.at(-1),['marker-google-auth-failed','token-request']);
  f.state.failTransport=false;
  const corrupted=await f.start('link',native);f.sql.prepare('UPDATE marker_auth_oauth_flows SET sealed_verifier=?').run('corrupted');
  const exchanges=f.state.tokenCalls;await f.callback(corrupted);assert.deepEqual(f.warnings.at(-1),['marker-google-auth-failed','verifier']);assert.equal(f.state.tokenCalls,exchanges);
  const logs=JSON.stringify(f.warnings);for(const privateValue of ['untrusted-secret-like-provider-error','never-log-private-provider-description','Untrusted raw network details',f.env.MARKER_GOOGLE_CLIENT_SECRET,f.env.MARKER_AUTH_SECRET])assert.equal(logs.includes(privateValue),false);
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM marker_auth_identities').get().n,0);
});

test('Workers manual redirect mode supports successful auth and rejects token or JWKS redirects without following them',async t=>{
  const f=fixture(t),native=await f.emailLogin();
  f.state.tokenRedirect=true;
  const tokenRedirect=await f.callback(await f.start('link',native));assert.equal(tokenRedirect.headers.get('location'),ORIGIN+'/?auth=failed');
  assert.deepEqual(f.state.requestURLs,['https://oauth2.googleapis.com/token']);assert.equal(f.state.jwksCalls,0);
  assert.deepEqual(f.warnings.at(-1),['marker-google-auth-failed','token-response','other',302]);
  f.state.tokenRedirect=false;f.state.jwksRedirect=true;
  const keyRedirect=await f.callback(await f.start('link',native));assert.equal(keyRedirect.headers.get('location'),ORIGIN+'/?auth=failed');
  assert.deepEqual(f.state.requestURLs,['https://oauth2.googleapis.com/token','https://oauth2.googleapis.com/token','https://www.googleapis.com/oauth2/v3/certs']);
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM marker_auth_identities').get().n,0);
  f.state.jwksRedirect=false;
  const successful=await f.callback(await f.start('link',native));assert.equal(successful.headers.get('location'),ORIGIN+'/?auth=google-linked');
});

test('configured CAPTCHA denies Google flow admission before persistence and accepts only its action',async t=>{
  const f=fixture(t),native=await f.emailLogin();
  Object.assign(f.env,{TURNSTILE_SITE_KEY:'0x0000000000000000000000',TURNSTILE_SECRET:'synthetic-turnstile-secret',TURNSTILE_HOSTNAMES:'marker.aekr.io'});
  const before=f.sql.prepare('SELECT COUNT(*) AS n FROM marker_auth_oauth_flows').get().n;
  const denied=await f.call('google/start',{intent:'link'},native);assert.equal(denied.status,403);assert.equal((await denied.json()).error,'CAPTCHA_REQUIRED');
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM marker_auth_oauth_flows').get().n,before);assert.equal(f.state.requestURLs.length,0);
  let action='auth_github';const transport=globalThis.fetch;
  t.mock.method(globalThis,'fetch',async(url,options)=>String(url)==='https://challenges.cloudflare.com/turnstile/v0/siteverify'?Response.json({success:true,hostname:'marker.aekr.io',action}):transport(url,options));
  assert.equal((await f.call('google/start',{intent:'link',captchaToken:'fresh-token'},native)).status,403);
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM marker_auth_oauth_flows').get().n,before);
  action='auth_google';assert.equal((await f.call('google/start',{intent:'link',captchaToken:'fresh-token'},native)).status,200);
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM marker_auth_oauth_flows').get().n,before+1);
});
