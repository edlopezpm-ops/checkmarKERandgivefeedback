import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleOwnerAuth, ownerSession, describeOwnerAuth } from '../server/native-auth.js';

const ORIGIN = 'https://marker.aekr.io', CLIENT = 'syntheticgithubclient123', ISSUER = 'https://github.com';
const readCookie = (response, name) => response.headers.getSetCookie().find(value => value.startsWith(name + '='))?.split(';')[0] || '';
function fixture(t) {
  const sql = new DatabaseSync(':memory:'); sql.exec('PRAGMA foreign_keys=ON'); for (const name of ['0001_private.sql', '0007_single_tenant_auth.sql', '0008_github_auth.sql']) sql.exec(readFileSync(new URL(`../migrations-d1/${name}`, import.meta.url), 'utf8'));
  const state = { now: Date.parse('2026-10-24T16:00:00Z'), requests: [], codes: new Map(), tokens: new Map(), tokenRedirect: false, profileRedirect: false, providerFailure: false, profileDelay: 0 };
  t.mock.method(Date, 'now', () => state.now); t.after(() => sql.close());
  const DB = { prepare(text) { let args = []; const statement = { bind(...values) { args = values; return statement; }, execute() { const prepared = sql.prepare(text); return prepared.columns().length ? { success: true, results: prepared.all(...args), meta: { changes: 0 } } : { success: true, results: [], meta: { changes: Number(prepared.run(...args).changes) } }; } }; return statement; }, async batch(statements) { sql.exec('BEGIN IMMEDIATE'); try { const results = statements.map(statement => statement.execute()); sql.exec('COMMIT'); return results; } catch (error) { sql.exec('ROLLBACK'); throw error; } } };
  const mail = [], jobs = [], warnings = []; const ctx = { waitUntil(job) { jobs.push(job); } }; t.mock.method(console, 'warn', (...values) => warnings.push(values));
  const env = { DB, MARKER_ORIGIN: ORIGIN, MARKER_OWNER_EMAIL: 'owner@example.invalid', MARKER_SENDER_EMAIL: 'marker@aekr.io', MARKER_AUTH_SECRET: 'synthetic-existing-marker-secret-at-least-32-bytes', MARKER_GITHUB_CLIENT_ID: CLIENT, MARKER_GITHUB_CLIENT_SECRET: 'synthetic-dedicated-github-secret', EMAIL: { async send(value) { mail.push(value); } } };
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    assert.equal(options.redirect, 'manual'); state.requests.push(String(url));
    if (String(url) === 'https://challenges.cloudflare.com/turnstile/v0/siteverify') return Response.json({ success: true, hostname: 'marker.aekr.io', action: 'auth_github' });
    if (String(url) === 'https://github.com/login/oauth/access_token') {
      assert.equal(options.method, 'POST'); assert.equal(options.headers.Accept, 'application/json'); const form = options.body;
      assert.equal(form.get('client_id'), CLIENT); assert.equal(form.get('client_secret'), env.MARKER_GITHUB_CLIENT_SECRET); assert.equal(form.get('redirect_uri'), ORIGIN + '/api/auth/github/callback');
      const proof = state.codes.get(form.get('code')); assert.ok(proof);
      const challenge = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(form.get('code_verifier')))).toString('base64url'); assert.equal(challenge, proof.challenge, 'Actual verifier must reproduce this flow PKCE challenge');
      if (state.tokenRedirect) return new Response(null, { status: 302, headers: { Location: 'https://attacker.invalid/token' } });
      if (state.providerFailure) return Response.json({ error: 'bad_verification_code', error_description: 'private-provider-error' });
      const token = 'gho_' + crypto.randomUUID().replaceAll('-', ''); state.tokens.set(token, proof.profile); return Response.json({ access_token: token, token_type: 'bearer', scope: '', refresh_token: 'never-store-refresh-token' });
    }
    assert.equal(String(url), 'https://api.github.com/user'); assert.equal(options.headers.Accept, 'application/vnd.github+json'); assert.equal(options.headers['X-GitHub-Api-Version'], '2026-03-10');
    const token = options.headers.Authorization.match(/^Bearer (.+)$/)?.[1]; assert.ok(state.tokens.has(token)); state.now += state.profileDelay;
    if (state.profileRedirect) return new Response(null, { status: 302, headers: { Location: 'https://attacker.invalid/profile' } });
    return Response.json(state.tokens.get(token));
  });
  async function call(path, data?, cookies = '', options = {}) { const method = options.method ?? (data === undefined ? 'GET' : 'POST'); const response = await handleOwnerAuth(new Request(ORIGIN + '/api/auth/' + path, { method, headers: { Origin: ORIGIN, 'X-Marker-Auth': '1', 'CF-Connecting-IP': '192.0.2.88', 'Content-Type': 'application/json', ...(cookies ? { Cookie: cookies } : {}), ...options.headers }, ...(method === 'GET' ? {} : { body: JSON.stringify(data) }) }), options.env ?? env, ctx); await Promise.all(jobs.splice(0)); return response; }
  async function emailLogin() { const requested = await call('request', { email: 'owner@example.invalid' }); assert.equal(requested.status, 202); const challenge = readCookie(requested, '__Host-marker_challenge'), code = mail.at(-1).text.match(/\b\d{8}\b/)[0], verified = await call('verify', { code }, challenge); assert.equal(verified.status, 200); return readCookie(verified, '__Host-marker_session'); }
  async function start(intent, cookies = '', extra = {}) { const response = await call('github/start', { intent, ...extra }, cookies); assert.equal(response.status, 200, await response.clone().text()); const url = new URL((await response.json()).url); return { url, response, browser: readCookie(response, '__Host-marker_github_oauth') }; }
  async function callback(flow, profile = { id: 123456, type: 'User', login: 'mutable-name', email: null }, options = {}) { const code = crypto.randomUUID(); state.codes.set(code, { profile, challenge: flow.url.searchParams.get('code_challenge') }); return call('github/callback?state=' + encodeURIComponent(flow.url.searchParams.get('state')) + '&code=' + encodeURIComponent(code), undefined, options.cookie ?? flow.browser, { method: 'GET' }); }
  const sessionRequest = cookie => new Request(ORIGIN + '/api/session', { headers: { Cookie: cookie } });
  return { sql, state, env, call, emailLogin, start, callback, sessionRequest, warnings };
}

test('GitHub optional readiness and explicit fresh-email linking preserve one retained operator with no email match', async t => {
  const f = fixture(t), unconfigured = { ...f.env, MARKER_GITHUB_CLIENT_ID: undefined, MARKER_GITHUB_CLIENT_SECRET: undefined };
  assert.equal((await describeOwnerAuth(f.sessionRequest(''), unconfigured)).methods.github.configured, false); assert.equal((await f.call('github/start', { intent: 'login' }, '', { env: unconfigured })).status, 503);
  assert.equal((await f.call('github/start', { intent: 'login' })).status, 409); assert.equal((await f.call('github/start', { intent: 'link' })).status, 403);
  const native = await f.emailLogin(), before = await ownerSession(f.sessionRequest(native), f.env), flow = await f.start('link', native);
  assert.equal(flow.url.origin, ISSUER); assert.equal(flow.url.searchParams.get('scope'), ''); assert.equal(flow.url.searchParams.get('allow_signup'), 'false'); assert.equal(flow.url.searchParams.get('code_challenge_method'), 'S256'); assert.match(flow.response.headers.get('set-cookie'), /SameSite=Lax/);
  const linked = await f.callback(flow); assert.equal(linked.headers.get('location'), ORIGIN + '/?auth=github-linked'); assert.equal((await describeOwnerAuth(f.sessionRequest(native), f.env)).methods.github.bound, true);
  const login = await f.callback(await f.start('login'), { id: 123456, type: 'User', login: 'renamed-user', email: 'unrelated@example.invalid' }); assert.equal(login.headers.get('location'), ORIGIN + '/?auth=signed-in');
  const principal = await ownerSession(f.sessionRequest(readCookie(login, '__Host-marker_session')), f.env); assert.deepEqual([principal.tenantId, principal.userId], [before.tenantId, before.userId]); assert.equal(principal.method, 'github'); assert.equal(principal.email, 'owner@example.invalid');
  assert.equal((await describeOwnerAuth(f.sessionRequest(readCookie(login, '__Host-marker_session')), f.env)).methods.github.canLink, false);
  const different = await f.callback(await f.start('login'), { id: 654321, type: 'User', login: 'mutable-name', email: 'owner@example.invalid' }); assert.equal(different.headers.get('location'), ORIGIN + '/?auth=failed');
  const persisted = JSON.stringify(f.sql.prepare('SELECT * FROM marker_auth_identities').all()); for (const raw of ['123456', 'mutable-name', 'unrelated@example.invalid', 'never-store-refresh-token', ...f.state.tokens.keys()]) assert.equal(persisted.includes(raw), false);
});

test('GitHub flow browser/provider binding, replay, native proof freshness and revocation fail closed', async t => {
  const f = fixture(t), native = await f.emailLogin(); let flow = await f.start('link', native);
  assert.equal((await f.callback(flow, undefined, { cookie: '' })).headers.get('location'), ORIGIN + '/?auth=failed');
  const first = await f.callback(flow); assert.equal(first.headers.get('location'), ORIGIN + '/?auth=github-linked'); assert.equal((await f.callback(flow)).headers.get('location'), ORIGIN + '/?auth=failed');
  flow = await f.start('link', native); f.sql.prepare("UPDATE marker_auth_oauth_flows SET provider='google' WHERE provider='github'").run();
  const requests = f.state.requests.length; assert.equal((await f.callback(flow)).headers.get('location'), ORIGIN + '/?auth=failed'); assert.equal(f.state.requests.length, requests, 'A cross-provider flow must not reach token exchange');
  f.sql.prepare("DELETE FROM marker_auth_oauth_flows WHERE provider='google'").run();
  flow = await f.start('link', native); f.state.profileDelay = 300_000; assert.equal((await f.callback(flow)).headers.get('location'), ORIGIN + '/?auth=failed'); f.state.profileDelay = 0;
  assert.equal((await f.call('github/start', { intent: 'link' }, native)).status, 403);
  f.state.now += 61_000; const fresh = await f.emailLogin(); flow = await f.start('link', fresh); await f.call('logout', {}, fresh); assert.equal((await f.callback(flow)).headers.get('location'), ORIGIN + '/?auth=failed');
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM marker_auth_identities').get().n, 1);
});

test('GitHub requires authenticated positive safe numeric User identity and rejects redirects or provider error bodies', async t => {
  const f = fixture(t); let native = await f.emailLogin();
  for (const profile of [{ id: '123', type: 'User' }, { id: 0, type: 'User' }, { id: 1.5, type: 'User' }, { id: Number.MAX_SAFE_INTEGER + 1, type: 'User' }, { id: 123, type: 'Organization' }]) {
    assert.equal((await f.callback(await f.start('link', native), profile)).headers.get('location'), ORIGIN + '/?auth=failed');
    assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM marker_auth_identities').get().n, 0);
  }
  f.state.tokenRedirect = true; let requestCount = f.state.requests.length; await f.callback(await f.start('link', native)); assert.equal(f.state.requests.length, requestCount + 1); f.state.tokenRedirect = false;
  f.state.profileRedirect = true; await f.callback(await f.start('link', native)); f.state.profileRedirect = false;
  f.state.providerFailure = true; await f.callback(await f.start('link', native)); assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM marker_auth_identities').get().n, 0);
  const logs = JSON.stringify(f.warnings); for (const raw of ['private-provider-error', f.env.MARKER_GITHUB_CLIENT_SECRET, ...f.state.tokens.keys()]) assert.equal(logs.includes(raw), false);
});

test('concurrent GitHub first-link flows retain one binding and deny the other durable ID', async t => {
  const f = fixture(t), native = await f.emailLogin(), flows = await Promise.all([f.start('link', native), f.start('link', native)]);
  const results = await Promise.all(flows.map((flow, index) => f.callback(flow, { id: 123456 + index, type: 'User', email: 'owner@example.invalid' })));
  assert.deepEqual(results.map(result => result.headers.get('location')).sort(), [ORIGIN + '/?auth=failed', ORIGIN + '/?auth=github-linked']);
  assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM marker_auth_identities WHERE issuer='https://github.com'").get().n, 1);
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM marker_auth_operator').get().n, 1);
});

test('GitHub CAPTCHA gate runs before any flow reservation and refuses partial or failed configuration', async t => {
  const f = fixture(t), native = await f.emailLogin(); Object.assign(f.env, { TURNSTILE_SITE_KEY: 'synthetic-site-key-123', TURNSTILE_SECRET: 'synthetic-captcha-secret', TURNSTILE_HOSTNAMES: 'marker.aekr.io', TURNSTILE_REQUIRED: '1' });
  assert.equal((await f.call('github/start', { intent: 'link' }, native)).status, 403); assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM marker_auth_oauth_flows').get().n, 0);
  const started = await f.start('link', native, { captchaToken: 'synthetic-response' }); assert.ok(started.url); assert.deepEqual(f.state.requests, ['https://challenges.cloudflare.com/turnstile/v0/siteverify']);
  assert.equal((await f.call('github/start', { intent: 'link', captchaToken: 'synthetic-response' }, native, { env: { ...f.env, TURNSTILE_SECRET: undefined } })).status, 403);
});

test('migration 0008 preserves existing Google/email principals, identity, active Google flow and business bytes', () => {
  const db = new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys=ON');
  try {
    for (const name of ['0001_private.sql', '0007_single_tenant_auth.sql']) db.exec(readFileSync(new URL(`../migrations-d1/${name}`, import.meta.url), 'utf8'));
    const operator = db.prepare('SELECT * FROM marker_auth_operator').get(); db.prepare('UPDATE marker_auth_operator SET owner_hash=?').run('a'.repeat(64));
    for (const [index, method] of ['email', 'google'].entries()) { const session = String(index + 1).repeat(64); db.prepare('INSERT INTO marker_auth_sessions VALUES(?,?,?,?,?)').run(session, 'a'.repeat(64), 100, 21700, 100); db.prepare('INSERT INTO marker_auth_principals VALUES(?,?,?,?,?)').run(session, operator.tenant_id, operator.user_id, method, 100); }
    db.prepare('INSERT INTO marker_auth_identities VALUES(?,?,?,?,?)').run('https://accounts.google.com', 'b'.repeat(64), operator.tenant_id, operator.user_id, 100);
    db.prepare('INSERT INTO marker_auth_oauth_flows VALUES(?,?,?,?,?,?,?,?,?,?)').run('c'.repeat(64), 'd'.repeat(64), 'e'.repeat(64), 'encrypted', 'link', '1'.repeat(64), 'a'.repeat(64), 'f'.repeat(64), 100, 700);
    db.prepare('INSERT INTO marker_workspace VALUES(1,1,?)').run('{"existing":"exact business bytes"}');
    const before = { operator: db.prepare('SELECT * FROM marker_auth_operator').all(), principals: db.prepare('SELECT * FROM marker_auth_principals').all(), identities: db.prepare('SELECT * FROM marker_auth_identities').all(), workspace: db.prepare('SELECT * FROM marker_workspace').all() };
    db.exec(readFileSync(new URL('../migrations-d1/0008_github_auth.sql', import.meta.url), 'utf8'));
    for (const [key, table] of [['operator', 'marker_auth_operator'], ['principals', 'marker_auth_principals'], ['identities', 'marker_auth_identities'], ['workspace', 'marker_workspace']]) assert.deepEqual(db.prepare('SELECT * FROM ' + table).all(), before[key]);
    assert.equal(db.prepare('SELECT provider FROM marker_auth_oauth_flows').get().provider, 'google'); assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { db.close(); }
});
