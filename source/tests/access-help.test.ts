// Access-help route only: real SQLite transactions and synthetic mail, no live messages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { handleOwnerAuth } from '../server/native-auth.js';

const ORIGIN = 'https://marker.aekr.io';
const OWNER = 'owner@example.invalid';
function fixture(t) {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations-d1/0001_private.sql', import.meta.url), 'utf8'));
  const state = { now: Date.parse('2026-10-23T12:05:00Z'), mailFailure: false, failAt: -1 };
  t.mock.method(Date, 'now', () => state.now);
  t.after(() => db.close());
  const mail = [];
  const env = { MARKER_AUTH_SECRET: 'synthetic-access-help-secret-at-least-32-bytes', MARKER_ORIGIN: ORIGIN,
    MARKER_OWNER_EMAIL: OWNER, MARKER_SENDER_EMAIL: 'marker@aekr.io',
    EMAIL: { async send(value) { if (state.mailFailure) throw new Error('private synthetic provider failure'); mail.push(value); return { messageId: 'synthetic' }; } },
    DB: {
      prepare(sql) { return { bind(...values) { return { execute() {
        const query = db.prepare(sql);
        if (query.columns().length) return { success: true, results: query.all(...values), meta: { changes: 0 } };
        return { success: true, results: [], meta: { changes: Number(query.run(...values).changes) } };
      } }; } }; },
      async batch(statements) {
        db.exec('BEGIN');
        try {
          const result = statements.map((statement, index) => {
            if (index === state.failAt) throw new Error('private synthetic transaction failure');
            return statement.execute();
          });
          db.exec('COMMIT'); return result;
        } catch (error) { db.exec('ROLLBACK'); throw error; }
      },
    },
  };
  async function call(value = { email: OWNER, language: 'en' }, options = {}) {
    const headers = { 'Content-Type': 'application/json', Origin: ORIGIN, 'X-Marker-Auth': '1', 'CF-Connecting-IP': '192.0.2.1',
      Cookie: '__Host-marker_session=' + 'a'.repeat(43) + '; __Host-marker_challenge=' + 'b'.repeat(43), ...options.headers };
    return handleOwnerAuth(new Request((options.origin || ORIGIN) + '/api/auth/help', {
      method: options.method || 'POST', headers,
      ...(options.method === 'GET' ? {} : { body: options.body ?? JSON.stringify(value) }),
    }), options.env || env, undefined);
  }
  return { db, state, env, mail, call };
}
const rows = (db, table) => db.prepare(`SELECT * FROM ${table}`).all();
const noAuthState = f => {
  assert.equal(rows(f.db, 'marker_auth_challenges').length, 0);
  assert.equal(rows(f.db, 'marker_auth_sessions').length, 0);
  assert.equal(rows(f.db, 'marker_workspace').length, 0);
};

test('help sends the English guide only to the configured owner and returns generic responses without cookies', async t => {
  const f = fixture(t);
  const denied = await f.call({ email: 'other@example.invalid', language: 'en' });
  assert.equal(denied.status, 202); assert.equal(f.mail.length, 0);
  const sent = await f.call({ email: ' OWNER@EXAMPLE.INVALID ', language: 'en' });
  assert.equal(sent.status, 202);
  assert.deepEqual(await sent.json(), await denied.json());
  assert.deepEqual(sent.headers.getSetCookie(), []); assert.deepEqual(denied.headers.getSetCookie(), []);
  assert.equal(f.mail.length, 1); assert.equal(f.mail[0].to, OWNER);
  assert.equal(f.mail[0].from.email, f.env.MARKER_SENDER_EMAIL);
  assert.equal(f.mail[0].replyTo, 'marker@aekr.io');
  assert.match(f.mail[0].text, /authorized email/); assert.match(f.mail[0].text, /eight-digit/);
  assert.match(f.mail[0].text, /same browser within five minutes/); assert.match(f.mail[0].text, /spam or junk/);
  assert.match(f.mail[0].text, /rate limit/); assert.match(f.mail[0].text, /does not request passwords or payment/);
  assert.match(f.mail[0].html, /lang="en"/); assert.doesNotMatch(f.mail[0].text, /\b\d{8}\b/);
  noAuthState(f);
});

test('help sends Spanish instructions without changing existing challenges, sessions or login limits', async t => {
  const f = fixture(t), now = Math.floor(f.state.now / 1000);
  f.db.prepare('INSERT INTO marker_auth_challenges VALUES (?,?,?,?,?,?,NULL)').run('a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64), now - 600, now - 300, 0);
  f.db.prepare('INSERT INTO marker_auth_sessions VALUES (?,?,?,?,?)').run('d'.repeat(64), 'b'.repeat(64), now - 22000, now - 400, now - 2000);
  f.db.prepare('INSERT INTO marker_auth_limits VALUES (?,?,?,?,?)').run('e'.repeat(64), now - 86400, 1, now - 86400, 'f'.repeat(64));
  const challenges = rows(f.db, 'marker_auth_challenges'), sessions = rows(f.db, 'marker_auth_sessions');
  const result = await f.call({ email: OWNER, language: 'es' });
  assert.equal(result.status, 202); assert.deepEqual(result.headers.getSetCookie(), []);
  assert.match(f.mail[0].subject, /ayuda de acceso/); assert.match(f.mail[0].text, /ocho dígitos/);
  assert.match(f.mail[0].text, /mismo navegador antes de cinco minutos/); assert.match(f.mail[0].text, /contraseñas ni pagos/);
  assert.match(f.mail[0].html, /lang="es"/);
  assert.deepEqual(rows(f.db, 'marker_auth_challenges'), challenges); assert.deepEqual(rows(f.db, 'marker_auth_sessions'), sessions);
  assert.equal(f.db.prepare('SELECT count FROM marker_auth_limits WHERE key = ?').get('e'.repeat(64)).count, 1);
  assert.equal(rows(f.db, 'marker_auth_limits').length, 5);
});

test('help enforces origin, method, schema, JSON and bounded body before mail or counter writes', async t => {
  const f = fixture(t);
  for (const [value, options, status] of [
    [{ email: OWNER, language: 'en' }, { method: 'GET' }, 405],
    [{ email: OWNER, language: 'en' }, { headers: { Origin: 'https://other.invalid' } }, 403],
    [{ email: OWNER, language: 'en' }, { origin: 'https://other.invalid' }, 403],
    [{ email: OWNER, language: 'en' }, { headers: { 'X-Marker-Auth': '' } }, 403],
    [{ email: OWNER, language: 'en' }, { headers: { 'Content-Type': 'text/plain' } }, 400],
    [{ email: OWNER, language: 'en' }, { body: '{' }, 400],
    [{ email: OWNER }, {}, 400], [{ email: OWNER, language: 'fr' }, {}, 400],
    [{ email: 'bad', language: 'en' }, {}, 400], [{ email: OWNER, language: 'en', extra: true }, {}, 400],
    [{ email: OWNER, language: 'en' }, { body: ' '.repeat(4097) }, 413],
  ]) assert.equal((await f.call(value, options)).status, status);
  assert.equal((await f.call(undefined, { headers: { 'CF-Connecting-IP': '' } })).status, 503);
  assert.equal((await f.call(undefined, { env: { ...f.env, MARKER_OWNER_EMAIL: OWNER + ',other@example.invalid' } })).status, 503);
  assert.equal(f.mail.length, 0); assert.equal(rows(f.db, 'marker_auth_limits').length, 0); noAuthState(f);
});

test('help cooldown and concurrent requests admit one mail, and IP admission is bounded', async t => {
  const f = fixture(t);
  const concurrent = await Promise.all(Array.from({ length: 8 }, () => f.call()));
  assert.ok(concurrent.every(r => r.status === 202)); assert.equal(f.mail.length, 1);
  assert.equal((await f.call()).status, 202); assert.equal((await f.call()).status, 202);
  assert.equal((await f.call()).status, 429); assert.equal(f.mail.length, 1);
  f.state.now += 60_000;
  assert.equal((await f.call(undefined, { headers: { 'CF-Connecting-IP': '192.0.2.2' } })).status, 202);
  assert.equal(f.mail.length, 2); noAuthState(f);
});

test('help global hourly admission limits rotating IP addresses without sending to unknown identities', async t => {
  const f = fixture(t);
  for (let i = 0; i < 100; i++) assert.equal((await f.call({ email: 'other@example.invalid', language: 'en' }, { headers: { 'CF-Connecting-IP': `192.0.2.${i + 1}` } })).status, 202);
  assert.equal((await f.call({ email: 'other@example.invalid', language: 'en' }, { headers: { 'CF-Connecting-IP': '192.0.2.201' } })).status, 429);
  assert.equal(f.mail.length, 0); noAuthState(f);
});

test('help owner hourly and daily limits bound actual mail independently of IP and code requests', async t => {
  const f = fixture(t);
  for (let hour = 0; hour < 6; hour++) {
    f.state.now = Date.parse('2026-10-23T12:05:00Z') + hour * 3_600_000;
    for (let i = 0; i < 5; i++) { assert.equal((await f.call()).status, 202); f.state.now += 60_000; }
    const count = f.mail.length;
    assert.equal((await f.call()).status, 202); assert.equal(f.mail.length, count);
  }
  assert.equal(f.mail.length, 30);
  f.state.now = Date.parse('2026-10-23T19:05:00Z');
  assert.equal((await f.call()).status, 202); assert.equal(f.mail.length, 30); noAuthState(f);
});

test('help provider failure is visible without leaking details or mutating auth state; SQL failure rolls back quotas', async t => {
  const f = fixture(t); f.state.mailFailure = true;
  const failed = await f.call(); assert.equal(failed.status, 503); assert.deepEqual(await failed.json(), { error: 'AUTH_UNAVAILABLE' });
  assert.deepEqual(failed.headers.getSetCookie(), []); noAuthState(f);
  f.state.mailFailure = false; f.state.now += 60_000;
  assert.equal((await f.call()).status, 202); assert.equal(f.mail.length, 1);
  const before = rows(f.db, 'marker_auth_limits'); f.state.failAt = 2; f.state.now += 60_000;
  assert.equal((await f.call()).status, 503); assert.deepEqual(rows(f.db, 'marker_auth_limits'), before);
  assert.equal(f.mail.length, 1); noAuthState(f);
});
