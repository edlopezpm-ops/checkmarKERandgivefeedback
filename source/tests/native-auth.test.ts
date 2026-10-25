// Adapted from owned analytics auth regression tests; real SQLite, synthetic mail only.
const ANALYTICS_ROUTE = '/';
const AUTH_ROUTE = '/api/auth/';
const DATA_ROUTE = '/analytics/data';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { authorizedOwner, handleOwnerAuth, purgeOwnerAuth } from '../server/native-auth.js';

const ORIGIN = 'https://marker.aekr.io';
const CHALLENGE = '__Host-marker_challenge';
const SESSION = '__Host-marker_session';
function fixture(t) {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations-d1/0001_private.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../migrations-d1/0007_single_tenant_auth.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../migrations-d1/0008_github_auth.sql', import.meta.url), 'utf8'));
  const state = { now: Date.parse('2026-10-21T12:05:00Z'), failAt: null, mailFailure: false };
  t.mock.method(Date, 'now', () => state.now);
  t.after(() => db.close());
  const mail = [], jobs = [];
  const ctx = { waitUntil(job) { jobs.push(job); } };
  const env = { MARKER_AUTH_SECRET: 'synthetic-test-auth-secret-with-at-least-32-bytes', MARKER_ORIGIN: ORIGIN,
    MARKER_OWNER_EMAIL: 'owner@example.invalid', CONTACT_SENDER_EMAIL: 'website@aekr.io', MARKER_SENDER_EMAIL: 'marker@aekr.io',
    EMAIL: { async send(value) { mail.push(value); if (state.mailFailure) throw new Error('synthetic private mail failure'); } },
    DB: {
      prepare(sql) { return { bind(...values) { return { execute() {
        const query = db.prepare(sql);
        if (query.columns().length) return { success: true, results: query.all(...values), meta: { changes: 0 } };
        return { success: true, results: [], meta: { changes: Number(query.run(...values).changes) } };
      } }; } }; },
      async batch(statements) {
        db.exec('BEGIN');
        try {
          const values = statements.map((statement, index) => {
            if (state.failAt === index) throw new Error('synthetic private SQL failure');
            return statement.execute();
          });
          db.exec('COMMIT'); return values;
        } catch (error) { db.exec('ROLLBACK'); throw error; }
      },
    },
  };
  async function call(path, value, cookie = '', options = {}) {
    const headers = { 'Content-Type': 'application/json', Origin: ORIGIN, 'X-Marker-Auth': '1', 'CF-Connecting-IP': '192.0.2.1',
      ...(cookie ? { Cookie: cookie } : {}), ...options.headers };
    const request = new Request((options.origin || ORIGIN) + AUTH_ROUTE + path,
      { method: options.method || 'POST', headers, ...(options.method === 'GET' ? {} : { body: options.body ?? JSON.stringify(value) }) });
    const result = await handleOwnerAuth(request, options.env || env, options.noContext ? undefined : ctx);
    await Promise.all(jobs.splice(0));
    return result;
  }
  return { db, env, state, mail, ctx, call };
}
function receivedCookie(result, name) {
  return result.headers.getSetCookie().find(value => value.startsWith(name + '='))?.split(';')[0] || '';
}
function code(mail) { return mail.at(-1).text.match(/\b\d{8}\b/)[0]; }
function count(db, table) { return db.prepare('SELECT COUNT(*) AS n FROM ' + table).get().n; }
async function login(f, email = 'owner@example.invalid') {
  const requested = await f.call('request', { email });
  assert.equal(requested.status, 202);
  const challenge = receivedCookie(requested, CHALLENGE);
  const verified = await f.call('verify', { code: code(f.mail) }, challenge);
  assert.equal(verified.status, 200);
  return { challenge, session: receivedCookie(verified, SESSION), pin: code(f.mail) };
}

test('native SQLite keeps owner auth separate, sends only allowlisted aliases and stores no raw identities, PINs or cookies', async t => {
  const f = fixture(t);
  const known = await f.call('request', { email: 'OWNER@example.invalid' });
  const unknown = await f.call('request', { email: 'stranger@example.invalid' });
  assert.equal(known.status, 202); assert.equal(unknown.status, 202);
  assert.deepEqual(await known.json(), await unknown.json());
  assert.equal(f.mail.length, 1); assert.equal(f.mail[0].to, 'owner@example.invalid');
  assert.deepEqual(f.mail[0].from, { email: 'marker@aekr.io', name: 'marKER' }, 'PIN sender is independent from the contact sender');
  assert.equal(f.mail[0].replyTo, 'marker@aekr.io');
  assert.equal((await f.call('request', { email: 'marker@aekr.io' })).status, 202);
  assert.equal(f.mail.length, 1, 'The product contact alias does not become an authorized login');
  for (const result of [known, unknown]) {
    assert.equal(result.headers.get('Cache-Control'), 'no-store, private');
    assert.equal(result.headers.get('Access-Control-Allow-Origin'), null);
    assert.match(result.headers.get('Set-Cookie'), /; Path=\/; Secure; HttpOnly; SameSite=Strict; Max-Age=300$/);
    assert.match(receivedCookie(result, CHALLENGE), /=.{43}$/);
  }
  const tables = f.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map(row => row.name);
  assert.deepEqual(tables, ['marker_auth_challenges', 'marker_auth_identities', 'marker_auth_limits', 'marker_auth_oauth_flows', 'marker_auth_oauth_limits', 'marker_auth_operator', 'marker_auth_principals', 'marker_auth_sessions', 'marker_workspace']);
  const persisted = JSON.stringify(tables.flatMap(table => f.db.prepare('SELECT * FROM ' + table).all()));
  for (const privateValue of ['owner@example.invalid', 'stranger@example.invalid', '192.0.2.1', code(f.mail), receivedCookie(known, CHALLENGE).split('=')[1]]) {
    assert.equal(persisted.includes(privateValue), false);
  }
  assert.equal((await f.call('verify', { code: code(f.mail) }, receivedCookie(unknown, CHALLENGE))).status, 401);
});

test('PIN requires its browser cookie, allows the fifth attempt, consumes once and logout revokes the opaque server session', async t => {
  const f = fixture(t);
  const requested = await f.call('request', { email: 'owner@example.invalid' });
  const challenge = receivedCookie(requested, CHALLENGE), pin = code(f.mail);
  assert.equal((await f.call('verify', { code: pin })).status, 401);
  const wrong = pin === '00000000' ? '11111111' : '00000000';
  for (let i = 0; i < 4; i++) assert.equal((await f.call('verify', { code: wrong }, challenge)).status, 401);
  const verified = await f.call('verify', { code: pin }, challenge);
  assert.equal(verified.status, 200);
  const session = receivedCookie(verified, SESSION);
  assert.match(verified.headers.getSetCookie().find(value => value.startsWith(SESSION + '=')), /Max-Age=21600$/);
  assert.equal(await authorizedOwner(new Request(ORIGIN + ANALYTICS_ROUTE, { headers: { Cookie: session } }), f.env), true);
  assert.equal((await f.call('verify', { code: pin }, challenge)).status, 401);
  assert.equal(count(f.db, 'marker_auth_sessions'), 1);
  const logout = await f.call('logout', {}, session);
  assert.equal(logout.status, 200); assert(logout.headers.getSetCookie().every(value => value.endsWith('Max-Age=0')));
  assert.equal(await authorizedOwner(new Request(ORIGIN + ANALYTICS_ROUTE, { headers: { Cookie: session } }), f.env), false);
  assert.equal(count(f.db, 'marker_auth_sessions'), 0);
});

test('locked, expired, cross-browser and duplicate-cookie challenges never create a session', async t => {
  const f = fixture(t);
  const requested = await f.call('request', { email: 'owner@example.invalid' });
  const challenge = receivedCookie(requested, CHALLENGE), pin = code(f.mail);
  const wrong = pin === '00000000' ? '11111111' : '00000000';
  assert.equal((await f.call('verify', { code: pin }, `${challenge}; ${challenge}`)).status, 401);
  for (let i = 0; i < 5; i++) assert.equal((await f.call('verify', { code: wrong }, challenge)).status, 401);
  assert.equal((await f.call('verify', { code: pin }, challenge)).status, 401);
  assert.equal(count(f.db, 'marker_auth_sessions'), 0);
  assert.equal(f.db.prepare('SELECT attempts FROM marker_auth_challenges').get().attempts, 5);
  f.state.now += 300000;
  const next = await f.call('request', { email: 'owner@example.invalid' });
  f.state.now += 300000;
  assert.equal((await f.call('verify', { code: code(f.mail) }, receivedCookie(next, CHALLENGE))).status, 401);
  assert.equal(count(f.db, 'marker_auth_sessions'), 0);
});

test('two concurrent correct verifications consume one challenge and create exactly one session', async t => {
  const f = fixture(t);
  const requested = await f.call('request', { email: 'owner@example.invalid' });
  const challenge = receivedCookie(requested, CHALLENGE), pin = code(f.mail);
  const results = await Promise.all([f.call('verify', { code: pin }, challenge), f.call('verify', { code: pin }, challenge)]);
  assert.deepEqual(results.map(value => value.status).sort(), [200, 401]);
  assert.equal(count(f.db, 'marker_auth_sessions'), 1);
  assert.notEqual(f.db.prepare('SELECT consumed_at FROM marker_auth_challenges').get().consumed_at, null);
});

test('an immediate resend preserves the existing browser challenge and the original PIN remains usable', async t => {
  const f = fixture(t);
  const first = await f.call('request', { email: 'owner@example.invalid' });
  const challenge = receivedCookie(first, CHALLENGE), pin = code(f.mail);
  const resend = await f.call('request', { email: 'owner@example.invalid' }, challenge);
  assert.equal(resend.status, 202); assert.equal(f.mail.length, 1);
  assert.equal(receivedCookie(resend, CHALLENGE), challenge);
  assert.equal((await f.call('verify', { code: pin }, receivedCookie(resend, CHALLENGE))).status, 200);
});

test('creation and verification failures roll back challenge, budget and session writes atomically', async t => {
  const f = fixture(t);
  f.state.failAt = 7;
  assert.equal((await f.call('request', { email: 'owner@example.invalid' })).status, 503);
  assert.equal(f.mail.length, 0); assert.equal(count(f.db, 'marker_auth_challenges'), 0); assert.equal(count(f.db, 'marker_auth_limits'), 0);
  f.state.failAt = null;
  const requested = await f.call('request', { email: 'owner@example.invalid' });
  const challenge = receivedCookie(requested, CHALLENGE), pin = code(f.mail);
  f.state.failAt = 2;
  assert.equal((await f.call('verify', { code: pin }, challenge)).status, 503);
  assert.equal(count(f.db, 'marker_auth_sessions'), 0);
  assert.equal(f.db.prepare('SELECT attempts FROM marker_auth_challenges').get().attempts, 0);
  f.state.failAt = null;
  assert.equal((await f.call('verify', { code: pin }, challenge)).status, 200);
});

test('session checks enforce canonical origin, allowlist, duplicated cookies, thirty-minute idle and six-hour absolute expiry', async t => {
  const f = fixture(t), signedIn = await login(f);
  const request = (origin = ORIGIN, cookie = signedIn.session) => new Request(origin + DATA_ROUTE, { headers: { Cookie: cookie } });
  for (const origin of ['https://kommibo.aekr.io', 'https://timeker.aekr.io', 'https://preview.workers.dev']) {
    assert.equal(await authorizedOwner(request(origin), f.env), false);
  }
  assert.equal(await authorizedOwner(request(ORIGIN, `${signedIn.session}; ${signedIn.session}`), f.env), false);
  assert.equal(await authorizedOwner(request(), { ...f.env, MARKER_OWNER_EMAIL: 'other@example.invalid' }), false);
  f.state.now += 1799000; assert.equal(await authorizedOwner(request(), f.env), true);
  f.state.now += 1800000; assert.equal(await authorizedOwner(request(), f.env), false);
  const row = f.db.prepare('SELECT created_at FROM marker_auth_sessions').get();
  f.db.prepare('UPDATE marker_auth_sessions SET last_seen = ?').run(row.created_at + 21599);
  f.state.now = (row.created_at + 21600) * 1000;
  assert.equal(await authorizedOwner(request(), f.env), false);
  await purgeOwnerAuth(f.env); assert.equal(count(f.db, 'marker_auth_sessions'), 0);
});

test('the global hourly request quota is atomic and bounds attacker-created limiter rows', async t => {
  const f = fixture(t);
  const results = await Promise.all(Array.from({ length: 101 }, (_, index) => f.call('request', { email: 'stranger@example.invalid' }, '',
    { headers: { 'CF-Connecting-IP': `192.0.2.${index}` } })));
  assert.equal(results.filter(value => value.status === 202).length, 100);
  assert.equal(results.filter(value => value.status === 429).length, 1);
  assert.equal(count(f.db, 'marker_auth_limits'), 102);
  assert.equal(count(f.db, 'marker_auth_challenges'), 1);
  assert.equal(f.mail.length, 0);
});

test('mail failure has the generic response, invalidates the challenge and does not block HTTP on provider latency', async t => {
  const f = fixture(t);
  f.state.mailFailure = true;
  const failed = await f.call('request', { email: 'owner@example.invalid' });
  const unknown = await f.call('request', { email: 'stranger@example.invalid' });
  assert.equal(failed.status, 202); assert.deepEqual(await failed.json(), await unknown.json());
  assert.equal((await f.call('verify', { code: code(f.mail) }, receivedCookie(failed, CHALLENGE))).status, 401);
  f.state.now += 60000;
  let release;
  f.env.EMAIL.send = () => new Promise(resolve => { release = resolve; });
  const request = new Request(ORIGIN + AUTH_ROUTE + 'request', { method: 'POST', headers: {
    Origin: ORIGIN, 'Content-Type': 'application/json', 'X-Marker-Auth': '1', 'CF-Connecting-IP': '192.0.2.2',
  }, body: JSON.stringify({ email: 'owner@example.invalid' }) });
  const result = await handleOwnerAuth(request, f.env, f.ctx);
  assert.equal(result.status, 202); assert.equal(typeof release, 'function');
  release();
});

test('missing configuration, unavailable database/mail and CSRF or oversized input fail closed', async t => {
  const f = fixture(t);
  for (const key of ['MARKER_AUTH_SECRET', 'MARKER_ORIGIN', 'MARKER_OWNER_EMAIL', 'DB', 'EMAIL', 'MARKER_SENDER_EMAIL']) {
    const env = { ...f.env }; delete env[key];
    assert.equal((await f.call('request', { email: 'owner@example.invalid' }, '', { env })).status, 503, key);
  }
  assert.equal((await f.call('request', { email: 'owner@example.invalid' }, '', { noContext: true })).status, 503);
  for (const headers of [{ Origin: 'https://accreatio.example' }, { 'X-Marker-Auth': '' }]) {
    assert.equal((await f.call('request', { email: 'owner@example.invalid' }, '', { headers })).status, 403);
  }
  assert.equal((await f.call('request', {}, '', { origin: 'https://timeker.aekr.io' })).status, 403);
  assert.equal((await f.call('request', {}, '', { method: 'GET' })).status, 405);
  assert.equal((await f.call('request', {}, '', { body: 'x'.repeat(4097) })).status, 413);
  assert.equal((await f.call('request', {}, '', { body: '{broken' })).status, 400);
  assert.equal(f.mail.length, 0); assert.equal(count(f.db, 'marker_auth_challenges'), 0);
  f.db.exec('DROP TABLE marker_auth_limits');
  assert.equal((await f.call('request', { email: 'owner@example.invalid' })).status, 503);
});

test('a stalled JSON stream is cancelled at the three-second deadline before any auth state is written', async t => {
  const f = fixture(t);
  let cancelled = false;
  const stream = new ReadableStream({ cancel() { cancelled = true; } });
  const request = new Request(ORIGIN + AUTH_ROUTE + 'request', { method: 'POST', duplex: 'half', headers: {
    Origin: ORIGIN, 'Content-Type': 'application/json', 'X-Marker-Auth': '1', 'CF-Connecting-IP': '192.0.2.1',
  }, body: stream });
  const result = await handleOwnerAuth(request, f.env, f.ctx);
  assert.equal(result.status, 408); assert.equal(cancelled, true);
  assert.equal(count(f.db, 'marker_auth_challenges'), 0); assert.equal(f.mail.length, 0);
});

test('configured CAPTCHA refusal precedes native request, verification and access-help writes', async t => {
  const f=fixture(t);
  Object.assign(f.env,{TURNSTILE_SITE_KEY:'synthetic-site-key-123',TURNSTILE_SECRET:'synthetic-captcha-secret',TURNSTILE_HOSTNAMES:'marker.aekr.io',TURNSTILE_REQUIRED:'1'});
  for(const [route,value]of [['request',{email:'owner@example.invalid'}],['verify',{code:'12345678'}],['help',{email:'owner@example.invalid',language:'en'}]]){
    const result=await f.call(route,value);assert.equal(result.status,403);assert.deepEqual(await result.json(),{error:'CAPTCHA_REQUIRED'});
  }
  assert.equal(f.mail.length,0);
  for(const table of ['marker_auth_challenges','marker_auth_sessions','marker_auth_limits'])assert.equal(count(f.db,table),0);
});
