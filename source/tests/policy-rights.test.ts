import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { nativeApi } from '../server/worker.ts';
import { servicePolicyAcknowledgement } from '../src/core/policy.ts';
import { policyApi } from '../server/policy.ts';
import { ownerSession } from '../server/native-auth.js';

const origin = 'https://marker.aekr.io', acknowledgement = servicePolicyAcknowledgement();
function fixture(t, suffix = 'first') {
  const sql = new DatabaseSync(':memory:'); sql.exec('PRAGMA foreign_keys=ON');
  for (const name of readdirSync(new URL('../migrations-d1/', import.meta.url)).filter(name => name.endsWith('.sql')).sort()) sql.exec(readFileSync(new URL('../migrations-d1/' + name, import.meta.url), 'utf8'));
  t.after(() => sql.close());
  let fail = false, beforeBatch = () => {};
  const DB = {
    prepare(text) { let args = []; const statement = { bind(...values) { args = values; return statement; }, execute() { if (fail) throw new Error('synthetic outage'); const query = sql.prepare(text); return query.columns().length ? { success: true, results: query.all(...args), meta: { changes: 0 } } : { success: true, results: [], meta: { changes: Number(query.run(...args).changes) } }; }, async run() { return statement.execute(); }, async all() { return statement.execute(); }, async first() { return statement.execute().results[0] ?? null; } }; return statement; },
    async batch(statements) { beforeBatch(); sql.exec('BEGIN IMMEDIATE'); try { const results = statements.map(statement => statement.execute()); sql.exec('COMMIT'); return results; } catch (error) { sql.exec('ROLLBACK'); throw error; } },
  };
  const mails = [], waits = [], env = { DB, MARKER_ORIGIN: origin, MARKER_OWNER_EMAIL: `${suffix}@example.invalid`, MARKER_SENDER_EMAIL: 'sender@example.invalid', MARKER_AUTH_SECRET: 'synthetic-policy-proof-' + suffix + '-at-least-thirty-two-characters', EMAIL: { async send(mail) { mails.push(mail); } } };
  async function call(path, body = undefined, cookie = '', extra = {}, method = body === undefined ? 'GET' : 'POST') {
    const response = await nativeApi(new Request(origin + path, { method, headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Marker-Auth': '1', 'CF-Connecting-IP': '192.0.2.20', Cookie: cookie, ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env, { waitUntil(job) { waits.push(job); } });
    await Promise.all(waits.splice(0)); return response;
  }
  const cookie = (response, name) => response.headers.getSetCookie().find(value => value.startsWith(name + '='))?.split(';')[0] ?? '';
  async function login() { const challenge = await call('/api/auth/request', { email: env.MARKER_OWNER_EMAIL }); const verified = await call('/api/auth/verify', { code: mails.at(-1).text.match(/\b\d{8}\b/)[0] }, cookie(challenge, '__Host-marker_challenge')); assert.equal(verified.status, 200); return cookie(verified, '__Host-marker_session'); }
  return { sql, env, call, login, outage(value) { fail = value; }, race(callback) { beforeBatch = callback; } };
}

test('new migration and sign-in never backfill acceptance; all protected routes require a native deliberate acknowledgement', async t => {
  const f = fixture(t), owner = await f.login();
  for (let i = 0; i < 3; i++) assert.equal((await (await f.call('/api/session', undefined, owner)).json()).policy.required, true);
  assert.equal((await (await f.call('/api/policy', undefined, owner)).json()).receipt, null);
  assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM marker_policy_acknowledgements').get().n, 0);
  for (const path of ['/api/workspace','/api/studio','/api/agents','/api/agents/bridge/poll']) {
    const blocked = await f.call(path, undefined, owner); assert.equal(blocked.status, 428, path);
    assert.equal((await blocked.json()).error, 'policy_ack_required');
  }
  const exported = await f.call('/api/privacy/data', undefined, owner); assert.equal(exported.status, 200);
  const analytics = await f.call('/api/analytics', undefined, owner); assert.equal(analytics.status, 200); assert.equal((await analytics.json()).status, 'not_configured');
  assert.equal((await f.call('/api/analytics', undefined, owner, { 'X-Tenant-ID': 'foreign' })).status, 403);
  const data = await exported.json(); assert.equal(data.data.policyAcknowledgement, null); assert.equal(data.category, 'core');
  assert.ok(data.excluded.some(value => value.includes('Original media')));
  assert.equal((await f.call('/api/profile', undefined, owner)).status, 200);
  assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM marker_policy_acknowledgements').get().n, 0);
});

test('acknowledgement validates exact versions, affirmative fields, origin, session, tenant and five-minute proof', async t => {
  const f = fixture(t), owner = await f.login();
  for (const body of [{}, { ...acknowledgement, cookiesNoticeAcknowledged: false }, { ...acknowledgement, privacyNoticeAcknowledged: false }, { ...acknowledgement, termsAccepted: false }, { ...acknowledgement, termsVersion: 'old' }, { ...acknowledgement, extra: true }]) assert.equal((await f.call('/api/policy', body, owner)).status, 400);
  for (const extra of [{ Origin: 'https://foreign.invalid' }, { 'X-Marker-Auth': '0' }, { 'X-Tenant-ID': 'foreign' }]) assert.equal((await f.call('/api/policy', acknowledgement, owner, extra)).status, 403);
  assert.equal((await f.call('/api/policy', acknowledgement)).status, 401);
  const now = Math.floor(Date.now()/1000);
  for (const timestamp of [now - 300, now + 60]) { f.sql.prepare('UPDATE marker_auth_principals SET authenticated_at=?').run(timestamp); assert.equal((await f.call('/api/policy', acknowledgement, owner)).status, 403); }
  assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM marker_policy_acknowledgements').get().n, 0);
});

test('receipt uses database time, preserves idempotent acknowledgement time and never changes optional storage', async t => {
  const f = fixture(t), owner = await f.login(), databaseTime = Math.floor(Date.now()/1000) + 10;
  f.sql.function('unixepoch', () => databaseTime);
  assert.equal((await f.call('/api/policy', acknowledgement, owner)).status, 200);
  const receipt = f.sql.prepare('SELECT * FROM marker_policy_acknowledgements').get(); assert.equal(receipt.acknowledged_at, databaseTime);
  assert.equal((await f.call('/api/policy', acknowledgement, owner)).status, 200);
  assert.deepEqual(f.sql.prepare('SELECT * FROM marker_policy_acknowledgements').get(), receipt);
  assert.equal((await f.call('/api/workspace', undefined, owner)).status, 200);
  f.sql.prepare("UPDATE marker_policy_acknowledgements SET terms_version='old'").run();
  assert.equal((await (await f.call('/api/session', undefined, owner)).json()).policy.required, true);
  assert.equal((await f.call('/api/privacy/data', undefined, owner)).status, 200);
  assert.equal(f.sql.prepare('SELECT terms_version FROM marker_policy_acknowledgements').get().terms_version, 'old');
});

test('two separate synthetic owners cannot exchange proofs or export another workspace; export requires CSRF and recent proof', async t => {
  const a = fixture(t, 'one'), b = fixture(t, 'two'), ownerA = await a.login(), ownerB = await b.login();
  a.sql.prepare("UPDATE marker_profile SET name='Only first'").run(); b.sql.prepare("UPDATE marker_profile SET name='Only second'").run();
  assert.equal((await b.call('/api/privacy/data', undefined, ownerA)).status, 401);
  assert.equal((await a.call('/api/privacy/data', undefined, ownerB)).status, 401);
  const own = await (await a.call('/api/privacy/data', undefined, ownerA)).text(); assert.match(own, /Only first/); assert.doesNotMatch(own, /Only second|session_hash|MARKER_AUTH_SECRET/);
  for (const extra of [{ Origin: 'https://foreign.invalid' }, { 'X-Marker-Auth': '0' }, { 'Sec-Fetch-Site': 'cross-site' }, { 'X-Tenant-ID': 'foreign' }]) assert.equal((await a.call('/api/privacy/data', undefined, ownerA, extra)).status, 403);
  a.sql.prepare('UPDATE marker_auth_principals SET authenticated_at=?').run(Math.floor(Date.now()/1000)-300);
  assert.equal((await a.call('/api/privacy/data', undefined, ownerA)).status, 403);
});

test('record export pages are bounded, sanitized and explicit about media exclusions; unknown categories and oversized pages fail', async t => {
  const f = fixture(t), owner = await f.login();
  for (let i = 0; i < 26; i++) f.sql.prepare('INSERT INTO marker_studio_materials VALUES(?,NULL,1,?)').run(String(i).padStart(3,'0'), JSON.stringify({ title: `Fictional ${i}`, tokenHash: 'excluded-secret-hash', nested: { credential: 'excluded' } }));
  const first = await (await f.call('/api/privacy/data?category=materials', undefined, owner)).json(); assert.equal(first.data.length,25); assert.equal(first.next,'024'); assert.equal(first.completeCategory,false); assert.doesNotMatch(JSON.stringify(first),/excluded-secret-hash|"credential"/);
  const second = await (await f.call('/api/privacy/data?category=materials&after=024', undefined, owner)).json(); assert.equal(second.data.length,1); assert.equal(second.next,null); assert.equal(second.completeCategory,true);
  assert.equal((await f.call('/api/privacy/data?category=marker_auth_sessions', undefined, owner)).status,400);
  f.sql.prepare('UPDATE marker_studio_materials SET document=? WHERE id=?').run(JSON.stringify({ text: 'x'.repeat(2*1024*1024) }), '000');
  assert.equal((await f.call('/api/privacy/data?category=materials', undefined, owner)).status,413);
});

test('database failure and revoked-session race never create acknowledgements or return own data', async t => {
  const f = fixture(t), owner = await f.login();
  f.sql.exec("CREATE TRIGGER synthetic_fail BEFORE INSERT ON marker_policy_acknowledgements BEGIN SELECT RAISE(ABORT,'fixture'); END;");
  assert.equal((await f.call('/api/policy', acknowledgement, owner)).status,503);
  assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM marker_policy_acknowledgements').get().n,0);
  f.sql.exec('DROP TRIGGER synthetic_fail');
  const request = new Request(origin+'/api/policy',{method:'POST',headers:{Origin:origin,Cookie:owner,'Content-Type':'application/json','X-Marker-Auth':'1'},body:JSON.stringify(acknowledgement)});
  const principal = await ownerSession(request,f.env); assert.ok(principal);
  await assert.rejects(policyApi(request, f.env, { ...principal, userId:'f'.repeat(32) }),/FRESH_PROOF_REQUIRED/);
  f.race(()=>{f.sql.exec('DELETE FROM marker_auth_sessions');});
  assert.ok([401,403].includes((await f.call('/api/privacy/data',undefined,owner)).status));
  assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM marker_policy_acknowledgements').get().n,0);
  f.outage(true); assert.equal((await f.call('/api/privacy/data',undefined,owner)).status,503);
});
