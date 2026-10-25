import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker, { nativeApi } from '../server/worker.ts';
import { assertAccountActive, readAccountLifecycle } from '../server/profile.ts';
import { deriveProfileInitials } from '../src/core/profile.ts';

const ORIGIN = 'https://marker.aekr.io';
const CONFIRM = { confirmation: 'DELETE', confirmAllData: true };
function cookie(response, name) { return response.headers.getSetCookie().find(value => value.startsWith(name + '='))?.split(';')[0] ?? ''; }
function fixture(t, migrate = true) {
  const sql = new DatabaseSync(':memory:'); sql.exec('PRAGMA foreign_keys=ON');
  if (migrate) for (const name of ['0001_private.sql','0002_studio.sql','0003_studio_hosted.sql','0004_studio_analysis.sql','0005_studio_settings.sql','0006_agents.sql','0007_single_tenant_auth.sql','0008_github_auth.sql','0009_profile_account.sql']) sql.exec(readFileSync(new URL('../migrations-d1/' + name, import.meta.url), 'utf8'));
  t.after(() => sql.close());
  let failSql = '', failDelete = false, failAbort = false, blockStop = null, missingMultipartError = Object.assign(new Error('missing'), { code: 10024 });
  const DB = {
    prepare(text) { let args = []; const statement = { bind(...values) { args = values; return statement; }, execute() { if (failSql && text.startsWith(failSql)) throw new Error('synthetic storage fault'); const query = sql.prepare(text); return query.columns().length ? { success: true, results: query.all(...args), meta: { changes: 0 } } : { success: true, results: [], meta: { changes: Number(query.run(...args).changes) } }; }, async run() { return statement.execute(); }, async all() { return statement.execute(); }, async first() { return statement.execute().results[0] ?? null; } }; return statement; },
    async batch(statements) { sql.exec('BEGIN IMMEDIATE'); try { const result = statements.map(statement => statement.execute()); sql.exec('COMMIT'); return result; } catch (error) { sql.exec('ROLLBACK'); throw error; } },
  };
  const objects = new Set(), multiparts = new Map(), outsideBucket = new Set(['other-app/private-file']), calls = { stops: 0, deletes: 0, aborts: 0, lists: 0 }, mails = [], waits = [];
  const MEDIA = {
    async list({ limit }) { calls.lists++; const keys = [...objects].slice(0, limit); return { objects: keys.map(key => ({ key })), truncated: objects.size > limit }; },
    async delete(keys) { calls.deletes++; if (failDelete) throw new Error('synthetic object fault'); for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key); },
    resumeMultipartUpload(key, id) { return { async abort() { calls.aborts++; if (failAbort) throw new Error('synthetic multipart fault'); if (multiparts.get(id) !== key) throw missingMultipartError; multiparts.delete(id); } }; },
  };
  const env = { DB, MEDIA, STUDIO_PROCESSOR: { getByName(name) { assert.equal(name, 'owner'); return { async stopForAccountDeletion() { calls.stops++; if (blockStop) await blockStop; } }; } }, MARKER_ORIGIN: ORIGIN, MARKER_OWNER_EMAIL: 'owner@example.invalid', MARKER_SENDER_EMAIL: 'sender@example.invalid', MARKER_AUTH_SECRET: 'synthetic-profile-secret-at-least-thirty-two-characters', EMAIL: { async send(mail) { mails.push(mail); } } };
  const ctx = { waitUntil(job) { waits.push(job); } };
  async function call(path, data, owner = '', method = data === undefined ? 'GET' : 'POST', extra = {}) {
    const result = await nativeApi(new Request(ORIGIN + path, { method, headers: { Origin: ORIGIN, 'X-Marker-Auth': '1', 'content-type': 'application/json', 'CF-Connecting-IP': '192.0.2.73', Cookie: owner, ...extra }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) }), env, ctx);
    await Promise.all(waits.splice(0)); return result;
  }
  async function login() { const requested = await call('/api/auth/request', { email: env.MARKER_OWNER_EMAIL }); assert.equal(requested.status, 202); const verified = await call('/api/auth/verify', { code: mails.at(-1).text.match(/\b\d{8}\b/)[0] }, cookie(requested, '__Host-marker_challenge')); assert.equal(verified.status, 200); return cookie(verified, '__Host-marker_session'); }
  async function start(owner) { const response = await call('/api/profile', CONFIRM, owner, 'DELETE'); assert.equal(response.status, 202); return cookie(response, '__Host-marker_deletion'); }
  async function finish(capability) { let response; for (let n = 0; n < 20; n++) { response = await call('/api/profile/deletion/resume', {}, capability); assert.ok([200, 202].includes(response.status), await response.clone().text()); if (response.status === 200) return response; } assert.fail('deletion did not finish'); }
  return { sql, env, calls, objects, outsideBucket, multiparts, call, login, start, finish, ctx, waits, faultSql(prefix) { failSql = prefix; }, faultDelete(value) { failDelete = value; }, faultAbort(value) { failAbort = value; }, absentMultipartError(value) { missingMultipartError = value; }, pauseStop(promise) { blockStop = promise; } };
}

test('account deletion freezes and removes all delegated MCP credentials and effect receipts', async t => {
  const f = fixture(t), owner = await f.login();
  f.sql.exec(readFileSync(new URL('../migrations-d1/0010_mcp.sql', import.meta.url), 'utf8'));
  f.sql.exec(readFileSync(new URL('../migrations-d1/0011_mcp_connections.sql', import.meta.url), 'utf8'));
  const operator = f.sql.prepare('SELECT user_id,tenant_id FROM marker_auth_operator').get();
  const expires = Math.floor(Date.now() / 1000) + 1000;
  f.sql.prepare('INSERT INTO marker_mcp_clients(client_id,name,redirect_uris,created_at,expires_at) VALUES(?,?,?,?,?)').run('client', 'Synthetic assistant', '["https://assistant.example.invalid/callback"]', 1, expires);
  f.sql.prepare('INSERT INTO marker_mcp_grants VALUES(?,?,?,?,?,?,?,?,NULL)').run('grant', 'client', operator.user_id, operator.tenant_id, 'marker:read', ORIGIN + '/api/mcp', 1, expires);
  f.sql.prepare('INSERT INTO marker_mcp_requests VALUES(?,?,?,?,?,?,NULL)').run('a'.repeat(64), 'client', operator.user_id, operator.tenant_id, '{}', expires);
  f.sql.prepare('INSERT INTO marker_mcp_codes VALUES(?,?,?,?,?,?,NULL)').run('b'.repeat(64), 'grant', 'client', 'https://assistant.example.invalid/callback', 'c'.repeat(43), expires);
  f.sql.prepare('INSERT INTO marker_mcp_tokens VALUES(?,?,?,?,?,?,NULL)').run('d'.repeat(64), 'e'.repeat(64), 'grant', 'client', expires, expires);
  f.sql.prepare("INSERT INTO marker_mcp_effects VALUES('grant','request_1','digest','completed','{}',1)").run();
  f.sql.prepare("INSERT INTO marker_mcp_limits VALUES('limit',1,1)").run();
  f.sql.prepare('INSERT INTO marker_mcp_login_requests VALUES(?,?,?,?,NULL)').run('f'.repeat(64), 'client', '{}', expires);
  const capability = await f.start(owner);
  assert.equal((await f.call('/api/mcp', {}, '', 'POST', { Authorization: 'Bearer ' + 'x'.repeat(43) })).status, 423);
  assert.throws(() => f.sql.prepare("INSERT INTO marker_mcp_limits VALUES('new',1,1)").run(), /ACCOUNT_CLOSED/);
  assert.throws(() => f.sql.prepare('INSERT INTO marker_mcp_login_requests VALUES(?,?,?,?,NULL)').run('g'.repeat(64), 'client', '{}', expires), /ACCOUNT_CLOSED/);
  await f.finish(capability);
  for (const { name } of f.sql.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'marker_mcp_%'").all()) assert.equal(f.sql.prepare(`SELECT count(*) AS n FROM ${name}`).get().n, 0, name);
});

test('profile derives initials automatically and retains only the readonly access email on owner PATCH with revision CAS', async t => {
  const f = fixture(t), owner = await f.login();
  const operatorBefore = f.sql.prepare('SELECT * FROM marker_auth_operator').get(), principalsBefore = f.sql.prepare('SELECT * FROM marker_auth_principals').all();
  const initial = await (await f.call('/api/profile', undefined, owner)).json();
  assert.deepEqual(initial.profile, { name: '', country: '', initials: 'OW', revision: 0, email: f.env.MARKER_OWNER_EMAIL });
  assert.equal(f.sql.prepare('SELECT email,revision FROM marker_profile').get().email, '');
  assert.equal(f.sql.prepare('PRAGMA table_info(marker_profile)').all().some(column => column.name === 'initials'), false);
  assert.equal(initial.canDeleteAccount, true); assert.equal(initial.requiresFreshProof, false);
  assert.equal((await f.call('/api/profile', { name: ' Ed López ', country: ' País elegido ', expectedRevision: 0 }, owner, 'PATCH')).status, 200);
  const saved = await (await f.call('/api/profile', undefined, owner)).json();
  assert.equal(saved.profile.name, 'Ed López'); assert.equal(saved.profile.country, 'País elegido'); assert.equal(saved.profile.initials, 'EL'); assert.equal(saved.profile.revision, 1);
  assert.equal(f.sql.prepare('SELECT email FROM marker_profile').get().email, f.env.MARKER_OWNER_EMAIL);
  assert.deepEqual(f.sql.prepare('SELECT * FROM marker_auth_operator').get(), operatorBefore);
  assert.deepEqual(f.sql.prepare('SELECT * FROM marker_auth_principals').all(), principalsBefore);
  assert.equal((await f.call('/api/profile', { name: 'Changed', expectedRevision: 0 }, owner, 'PATCH')).status, 409);
  for (const payload of [{ email: 'attacker@example.invalid' }, { name: 'X', email: f.env.MARKER_OWNER_EMAIL }, { tenant_id: 'foreign', name: 'X' }, { name: 'x'.repeat(121) }, { country: 'x'.repeat(81) }, { initials: 'EL' }, { name: 'X', initials: 'XX' }, { name: 'bad\u0000name' }]) assert.equal((await f.call('/api/profile', payload, owner, 'PATCH')).status, 400);
  assert.equal((await f.call('/api/profile', { name: '' }, owner, 'PATCH', { Origin: 'https://other.invalid' })).status, 403);
  assert.equal((await f.call('/api/profile', undefined, owner, 'GET', { 'X-Tenant-ID': 'foreign' })).status, 403);
  assert.equal((await (await f.call('/api/profile', undefined, owner)).json()).profile.name, 'Ed López');
  const renamed = await f.call('/api/profile', { name: 'Ana María Torres', expectedRevision: 1 }, owner, 'PATCH');
  assert.equal((await renamed.json()).profile.initials, 'AT');
  const cleared = await f.call('/api/profile', { name: '', expectedRevision: 2 }, owner, 'PATCH');
  assert.equal((await cleared.json()).profile.initials, 'OW');
  assert.equal(f.sql.prepare('SELECT email FROM marker_profile').get().email, f.env.MARKER_OWNER_EMAIL);
});

test('shared automatic initials follow current name or email without an owner-specific default', () => {
  for (const [name, email, expected] of [[' Ed López ', 'other@example.invalid', 'EL'], ['Ana María Torres', 'other@example.invalid', 'AT'], ['Zoë', 'other@example.invalid', 'ZO'], ['', 'elopez@aekr.io', 'EL'], ['', 'jane.doe@example.invalid', 'JD'], ['  ', 'owner@example.invalid', 'OW'], ['', '', ''], ['', '123@example.invalid', '']]) assert.equal(deriveProfileInitials(name, email), expected);
});

test('deletion requires exact double confirmation, fresh independent email, session, origin and singleton tenant', async t => {
  const f = fixture(t), owner = await f.login();
  assert.equal((await f.call('/api/profile', CONFIRM, '', 'DELETE')).status, 401);
  for (const value of [{ confirmation: 'DELETE MY ACCOUNT', confirmAllData: true }, { confirmation: 'DELETE' }, { ...CONFIRM, extra: true }]) assert.equal((await f.call('/api/profile', value, owner, 'DELETE')).status, 400);
  assert.equal((await f.call('/api/profile', CONFIRM, owner, 'DELETE', { Origin: 'https://other.invalid' })).status, 403);
  assert.equal((await f.call('/api/profile', CONFIRM, owner, 'DELETE', { 'X-Marker-Auth': '0' })).status, 403);
  assert.equal((await f.call('/api/profile', CONFIRM, owner, 'DELETE', { 'X-Tenant-ID': 'foreign' })).status, 403);
  const fresh = Math.floor(Date.now() / 1000);
  f.sql.prepare("UPDATE marker_auth_principals SET auth_method='google'").run();
  assert.equal((await f.call('/api/profile', CONFIRM, owner, 'DELETE')).status, 403);
  f.sql.prepare("UPDATE marker_auth_principals SET auth_method='email',authenticated_at=?").run(fresh - 300);
  const unavailable = await (await f.call('/api/profile', undefined, owner)).json();
  assert.equal(unavailable.canDeleteAccount, true); assert.equal(unavailable.requiresFreshProof, true);
  assert.equal((await f.call('/api/profile', CONFIRM, owner, 'DELETE')).status, 403);
  assert.equal((await readAccountLifecycle(f.env)).status, 'active'); assert.equal(f.calls.stops, 0);
});

test('durable freeze, lost-start retry and same-browser cleanup purge all active D1/R2 rows without recreating owner data', async t => {
  const f = fixture(t), owner = await f.login();
  f.sql.prepare("INSERT INTO marker_workspace VALUES(1,1,'{}')").run();
  f.sql.prepare("INSERT INTO marker_studio_assets VALUES('asset',?,'video',3,'originals/asset','{}')").run('a'.repeat(64));
  f.sql.prepare("INSERT INTO marker_studio_materials VALUES('material','asset',1,'{}')").run();
  f.sql.prepare("INSERT INTO marker_studio_campaigns VALUES('campaign','product','{}')").run();
  f.sql.prepare("INSERT INTO marker_studio_variants VALUES('variant','campaign',1,'{}')").run();
  f.sql.prepare("INSERT INTO marker_studio_jobs(id,variant_id,recipe_revision,status,document) VALUES('job','variant',1,'completed','{}')").run();
  f.sql.prepare("INSERT INTO marker_studio_analysis(id,asset_id,sha256,start_ms,end_ms,profile,tool_version,status,document) VALUES('analysis','asset',?,0,1000,'technical-v1','fixture','completed','{}')").run('a'.repeat(64));
  f.sql.prepare("INSERT INTO marker_studio_uploads(id,status,document) VALUES('upload','uploading',?)").run(JSON.stringify({ key: 'originals/pending', multipartId: 'multipart' })); f.multiparts.set('multipart', 'originals/pending');
  f.sql.prepare("INSERT INTO marker_agent_connections VALUES('connection',0,'ready','2026-10-24','{}')").run();
  for (let n = 0; n < 105; n++) f.objects.add(`originals/fixture-${n}`);
  f.objects.add('renders/job/video.mp4'); f.objects.add('analysis/analysis/thumb-0.jpg');
  const capability = await f.start(owner), retried = await f.call('/api/profile', CONFIRM, owner, 'DELETE');
  assert.equal(cookie(retried, '__Host-marker_deletion'), capability); assert.equal(f.calls.stops, 0);
  assert.equal((await f.call('/api/profile/deletion')).status, 404);
  assert.equal((await f.call('/api/profile/deletion', undefined, '__Host-marker_deletion=forged')).status, 404);
  assert.equal((await f.call('/api/profile/deletion', undefined, capability)).status, 202); assert.equal(f.calls.stops, 0);
  const session = await (await f.call('/api/session', undefined, owner)).json();
  assert.deepEqual(session.account, { status: 'deleting' }); assert.equal(session.authenticated, false); assert.equal('user' in session, false);
  for (const path of ['/api/auth/request', '/api/agents/bridge/poll', '/api/commands']) assert.equal((await f.call(path, {}, owner)).status, 423);
  await assert.rejects(assertAccountActive(f.env), /ACCOUNT_DELETING/);
  assert.throws(() => f.sql.prepare("INSERT INTO marker_agent_connections VALUES('late',0,'ready','2026-10-24','{}')").run(), /ACCOUNT_CLOSED/);
  assert.throws(() => f.sql.prepare("UPDATE marker_profile SET name='late'").run(), /ACCOUNT_CLOSED/);
  assert.equal((await f.call('/api/profile/deletion/resume', {}, capability, 'POST', { Origin: 'https://other.invalid' })).status, 403);
  const complete = await f.finish(capability), result = await complete.json();
  assert.equal(result.deletion.status, 'deleted'); assert.equal(result.deletion.phase, 'done'); assert.equal(result.deletion.deletedObjects, 107);
  assert.equal(f.calls.stops, 1); assert.equal(f.multiparts.size, 0); assert.equal(f.objects.size, 0); assert.deepEqual([...f.outsideBucket], ['other-app/private-file']);
  const tables = f.sql.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'marker_%' AND name!='marker_account_lifecycle'").all();
  for (const { name } of tables) assert.equal(f.sql.prepare(`SELECT COUNT(*) AS n FROM ${name}`).get().n, 0, name);
  assert.equal(f.sql.prepare('PRAGMA foreign_key_check').all().length, 0);
  const tombstone = f.sql.prepare('SELECT * FROM marker_account_lifecycle').get(); assert.equal(tombstone.capability_hash, null); assert.equal(tombstone.lease_token, null);
  assert.equal((await f.call('/api/auth/request', { email: f.env.MARKER_OWNER_EMAIL })).status, 410);
  assert.equal((await f.call('/api/agents/bridge/poll', {})).status, 410);
  assert.deepEqual((await (await f.call('/api/session')).json()).account, { status: 'deleted' });
  assert.throws(() => f.sql.prepare("INSERT INTO marker_workspace VALUES(1,1,'{}')").run(), /ACCOUNT_CLOSED/);
  assert.throws(() => f.sql.prepare("UPDATE marker_account_lifecycle SET status='active',phase='active'").run(), /ACCOUNT_CLOSED/);
});

test('cleanup waits existing write leases and retries multipart/R2 failures without a false completion', async t => {
  const f = fixture(t), owner = await f.login(); let now = Date.now(); t.mock.method(Date, 'now', () => now);
  f.sql.prepare("INSERT INTO marker_studio_uploads(id,status,document,lock_until) VALUES('upload','uploading',?,?)").run(JSON.stringify({ key: 'originals/pending', multipartId: 'multipart' }), now + 600_000); f.multiparts.set('multipart', 'originals/pending'); f.objects.add('originals/retained');
  const cap = await f.start(owner);
  await f.call('/api/profile/deletion/resume', {}, cap); await f.call('/api/profile/deletion/resume', {}, cap);
  assert.equal((await readAccountLifecycle(f.env)).phase, 'waiting'); assert.equal(f.calls.aborts, 0); assert.equal(f.calls.lists, 0);
  now += 600_001; await f.call('/api/profile/deletion/resume', {}, cap);
  f.faultAbort(true); assert.equal((await f.call('/api/profile/deletion/resume', {}, cap)).status, 503); assert.equal((await readAccountLifecycle(f.env)).needsRetry, true); assert.equal(f.multiparts.size, 1);
  f.faultAbort(false); await f.call('/api/profile/deletion/resume', {}, cap); await f.call('/api/profile/deletion/resume', {}, cap);
  f.faultDelete(true); assert.equal((await f.call('/api/profile/deletion/resume', {}, cap)).status, 503); assert.equal(f.objects.size, 1); assert.equal((await readAccountLifecycle(f.env)).status, 'deleting');
  f.faultDelete(false); assert.equal((await f.finish(cap)).status, 200);
});

test('concurrent resumes hold one durable lease and final D1 purge rolls back atomically on failure', async t => {
  const f = fixture(t), owner = await f.login(); f.sql.prepare("INSERT INTO marker_workspace VALUES(1,1,'{}')").run();
  let release; const blocked = new Promise(resolve => { release = resolve; }); f.pauseStop(blocked); const cap = await f.start(owner);
  const first = f.call('/api/profile/deletion/resume', {}, cap);
  while (!f.calls.stops) await new Promise(resolve => setImmediate(resolve));
  const second = await f.call('/api/profile/deletion/resume', {}, cap); assert.equal(second.status, 202); assert.equal(f.calls.stops, 1);
  release(); await first;
  for (let n = 0; n < 5 && (await readAccountLifecycle(f.env)).phase !== 'database'; n++) await f.call('/api/profile/deletion/resume', {}, cap);
  f.faultSql('DELETE FROM marker_workspace'); assert.equal((await f.call('/api/profile/deletion/resume', {}, cap)).status, 503);
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM marker_profile').get().n, 1); assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM marker_workspace').get().n, 1); assert.equal((await readAccountLifecycle(f.env)).status, 'deleting');
  f.faultSql(''); assert.equal((await f.finish(cap)).status, 200);
});

test('final empty-bucket recheck catches late objects; scheduled recovery completes only an owner-started deletion', async t => {
  const f = fixture(t), owner = await f.login(); const cap = await f.start(owner);
  for (let n = 0; n < 8 && (await readAccountLifecycle(f.env)).phase !== 'database'; n++) await f.call('/api/profile/deletion/resume', {}, cap);
  f.objects.add('originals/late-settled'); await f.call('/api/profile/deletion/resume', {}, cap);
  assert.equal((await readAccountLifecycle(f.env)).phase, 'media'); assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM marker_auth_operator').get().n, 1);
  worker.scheduled({}, f.env, f.ctx); await Promise.all(f.waits.splice(0));
  assert.equal((await readAccountLifecycle(f.env)).status, 'deleted'); assert.equal(f.objects.size, 0);
});

test('missing lifecycle migration fails closed before any auth, bridge, or profile effect', async t => {
  const f = fixture(t, false);
  for (const path of ['/api/session','/api/profile','/api/auth/request','/api/agents/bridge/poll']) assert.equal((await f.call(path, path.includes('request') || path.includes('poll') ? {} : undefined)).status, 503);
  await assert.rejects(assertAccountActive(f.env), /ACCOUNT_UNAVAILABLE/); assert.equal(f.calls.stops, 0);
});

test('completed or previously aborted multipart uploads permit cleanup only for documented NoSuchUpload errors', async t => {
  const f = fixture(t), owner = await f.login();
  f.sql.prepare("INSERT INTO marker_studio_uploads(id,status,document) VALUES('finished','completed',?)").run(JSON.stringify({ key: 'originals/finished', multipartId: 'already-completed' }));
  f.absentMultipartError(new Error('The multipart upload does not exist. (10024)'));
  const cap = await f.start(owner); assert.equal((await f.finish(cap)).status, 200); assert.equal(f.calls.aborts, 1);
});

test('additive profile migration preserves existing Google identity, owner/session and workspace bytes; absent lifecycle also freezes D1 writes', async t => {
  const f = fixture(t, false);
  for (const name of ['0001_private.sql','0002_studio.sql','0003_studio_hosted.sql','0004_studio_analysis.sql','0005_studio_settings.sql','0006_agents.sql','0007_single_tenant_auth.sql','0008_github_auth.sql']) f.sql.exec(readFileSync(new URL('../migrations-d1/' + name, import.meta.url), 'utf8'));
  const now = Math.floor(Date.now() / 1000), operator = f.sql.prepare('SELECT * FROM marker_auth_operator').get();
  f.sql.prepare('INSERT INTO marker_auth_sessions VALUES(?,?,?,?,?)').run('a'.repeat(64), 'b'.repeat(64), now, now + 21_600, now);
  f.sql.prepare("INSERT INTO marker_auth_principals VALUES(?,?,?,'google',?)").run('a'.repeat(64), operator.tenant_id, operator.user_id, now);
  f.sql.prepare("INSERT INTO marker_auth_identities VALUES('https://accounts.google.com',?,?,?,?)").run('c'.repeat(64), operator.tenant_id, operator.user_id, now);
  f.sql.prepare("INSERT INTO marker_workspace VALUES(1,3,?)").run('{"preserve":"exact existing bytes"}');
  const before = ['marker_auth_operator','marker_auth_sessions','marker_auth_principals','marker_auth_identities','marker_workspace'].map(name => ({ name, rows: f.sql.prepare(`SELECT * FROM ${name}`).all() }));
  f.sql.exec(readFileSync(new URL('../migrations-d1/0009_profile_account.sql', import.meta.url), 'utf8'));
  for (const { name, rows } of before) assert.deepEqual(f.sql.prepare(`SELECT * FROM ${name}`).all(), rows, name);
  assert.equal(f.sql.prepare('PRAGMA foreign_key_check').all().length, 0);
  f.sql.exec('DELETE FROM marker_account_lifecycle');
  assert.throws(() => f.sql.prepare("UPDATE marker_profile SET name='late'").run(), /ACCOUNT_CLOSED/);
  assert.throws(() => f.sql.prepare("INSERT INTO marker_agent_events VALUES('late','run','session','date','{}')").run(), /ACCOUNT_CLOSED/);
  await assert.rejects(assertAccountActive(f.env), /ACCOUNT_UNAVAILABLE/);
});
