import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { analyticsApi, deleteAnalyticsSubject } from '../server/analytics.ts';
import { nativeApi } from '../server/worker.ts';
import { isCurrentAnalyticsGrant } from '../src/core/analytics.ts';

const ORIGIN = 'https://marker.aekr.io';
const SOURCE = 'marker-owner-production';
const TOKEN = 'synthetic_source_credential_0123456789012345';
const principal = { userId: 'fixture-user', tenantId: 'fixture-tenant' };
const time = Date.parse('2026-10-25T18:00:00Z');
const config = () => ({ schema_version: 1, source_id: SOURCE, product: 'marker', environment: 'production', version: 3, issued_at: new Date(time).toISOString(), expires_at: new Date(time + 300000).toISOString(), enabled: true, events: ['commercial_interest_selected'], fields: ['category'], purposes: ['optional_analytics', 'onsite_personalized_ads', 'partner_intro', 'audience_licensing'], retention_days: 30, destinations: ['partner_a'], restriction_reason: null });
const preference = () => ({ purpose: 'onsite_personalized_ads', status: 'granted', categories: ['marketing'], recipients: [], gpc: false });
const interest = () => ({ event_id: '98d6c775-41bc-4c16-9252-8b47fbd82cd3', event: 'commercial_interest_selected', purpose: 'onsite_personalized_ads', permission_ref: 'permission_1', source_configuration_version: 3, category: 'marketing' });

function fixture(t) {
  const sql = new DatabaseSync(':memory:');
  sql.exec("CREATE TABLE marker_account_lifecycle(id INTEGER PRIMARY KEY,status TEXT); INSERT INTO marker_account_lifecycle VALUES(1,'active')");
  sql.exec(readFileSync(new URL('../migrations-d1/0013_analytics_subject.sql', import.meta.url), 'utf8'));
  t.after(() => sql.close());
  const db = { prepare(text) { let args = []; const statement = { bind(...values) { args = values; return statement; }, async run() { return { success: true, meta: { changes: Number(sql.prepare(text).run(...args).changes) } }; }, async first() { return sql.prepare(text).get(...args) ?? null; } }; return statement; } };
  const calls = [];
  let configuration = config(), fail = '', response = null;
  const options = { token: TOKEN, subjectSecret: 'synthetic_subject_secret_at_least_thirty_two_characters', db, now: () => time, async fetcher(url, init) {
    const path = new URL(url).pathname.split('/').at(-1);
    const data = init?.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, init, data });
    if (path === fail) throw new Error('private fixture detail must never escape');
    if (response) return response;
    if (path === 'config') return Response.json(configuration);
    if (path === 'preferences' && init.method === 'GET') return Response.json({ preferences: [] });
    if (path === 'preferences') return Response.json({ permission_ref: 'permission_1' });
    if (path === 'events') return Response.json({ accepted: true, duplicate: false });
    if (path === 'audiences') return Response.json({ audiences: [{ audience_id: 'authorized_marketing', version: 1, eligible_count: 0, as_of: new Date(time).toISOString(), mode: 'production', members: ['must-not-escape'], contact: 'private@example.invalid' }] });
    if (path === 'rights') return Response.json({ receipt_id: 'delete_1', local_state: 'local_deleted', recipient_state: 'check_delivery_receipts' });
    if (path === 'ack') return Response.json({ acknowledged: true });
    throw new Error('Unexpected transport');
  } };
  async function call(path = '', body, headers = {}, actor = principal) {
    const request = new Request(ORIGIN + '/api/analytics' + path, { method: body === undefined ? 'GET' : 'POST', headers: { Origin: ORIGIN, 'X-Marker-Auth': '1', 'Content-Type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await analyticsApi(request, actor, options);
    return { status: result.status, body: await result.json() };
  }
  return { sql, options, calls, call, configure(value) { configuration = value; }, fail(path) { fail = path; }, respond(value) { response = value; } };
}

test('missing source credential sends no requests or identities and leaves the main API outside Analytics', async t => {
  const f = fixture(t); f.options.token = undefined;
  const result = await f.call();
  assert.equal(result.status, 200); assert.equal(result.body.status, 'not_configured'); assert.equal(result.body.configuration, null);
  assert.equal((await f.call('/events', interest())).status, 503); assert.equal(f.calls.length, 0);
  assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM marker_analytics_subject').get().n, 0);
});

test('versioned configuration is applied and acknowledged; pause stops optional events at the producer', async t => {
  const f = fixture(t);
  const result = await f.call();
  assert.equal(result.body.status, 'active'); assert.equal(result.body.desired_version, 3); assert.equal(result.body.applied_version, 3);
  assert.deepEqual(f.calls[1].data, { source_configuration_version: 3 });
  f.configure({ ...config(), version: 4, enabled: false }); f.calls.length = 0;
  assert.equal((await f.call()).body.status, 'paused');
  assert.equal((await f.call('/events', { ...interest(), source_configuration_version: 4 })).status, 409);
  assert.equal(f.calls.some(call => call.url.endsWith('/events')), false);
});

test('unconfirmed, expired, wrong-source and malformed configurations never claim applied state', async t => {
  const f = fixture(t); f.fail('ack');
  const pending = await f.call(); assert.equal(pending.body.status, 'confirmation_pending'); assert.equal(pending.body.applied_version, null);
  f.fail('');
  for (const bad of [{ expires_at: new Date(time).toISOString() }, { expires_at: new Date(time + 600000).toISOString() }, { source_id: 'accreatio-production' }, { product: 'timeker' }, { environment: 'demo' }, { events: ['private_campaign_saved'] }, { fields: ['email'] }, { purposes: ['sell_everything'] }, { retention_days: 365 }, { issued_at: new Date(time + 60000).toISOString() }]) {
    f.configure({ ...config(), ...bad }); f.calls.length = 0;
    const result = await f.call(); assert.equal(result.body.status, 'unavailable'); assert.equal(result.body.applied_version, null); assert.equal(f.calls.length, 1);
  }
});

test('preference subjects are derived server-side and do not cross tenants or forward private metadata', async t => {
  const f = fixture(t);
  assert.equal((await f.call('/preferences', preference())).status, 200);
  const first = f.calls.find(call => call.url.endsWith('/preferences')).data;
  assert.match(first.subject_ref, /^[a-f0-9]{64}$/); assert.equal(first.notice_version, '2026-10-25');
  assert.deepEqual(Object.keys(first).sort(), ['purpose', 'status', 'categories', 'recipients', 'gpc', 'notice_version', 'subject_ref'].sort());
  assert.ok(!JSON.stringify(first).includes(principal.userId)); assert.ok(!JSON.stringify(first).includes(principal.tenantId));
  assert.equal(f.sql.prepare('SELECT subject_ref FROM marker_analytics_subject').get().subject_ref, first.subject_ref);
  const other = await f.call('/preferences', preference(), {}, { ...principal, tenantId: 'foreign-tenant' });
  assert.equal(other.status, 503); assert.equal(f.calls.filter(call => call.url.endsWith('/preferences')).length, 1);
  for (const key of ['subject_ref', 'source_id', 'product', 'tenant_id', 'email', 'consent', 'provenance_ref', 'url', 'campaign']) {
    assert.equal((await f.call('/preferences', { ...preference(), [key]: 'private?query=payload' })).status, 400);
  }
});

test('analytics-only permission cannot manufacture commercial interest, conversion, sale or payment events', async t => {
  const f = fixture(t);
  assert.equal((await f.call('/preferences', { ...preference(), purpose: 'optional_analytics' })).status, 200);
  for (const event of [{ ...interest(), purpose: 'optional_analytics' }, { ...interest(), event: 'sale_confirmed' }, { ...interest(), event: 'lead_accepted' }, { ...interest(), event: 'payment_received' }, { ...interest(), event: 'public_product_viewed' }]) assert.equal((await f.call('/events', event)).status, 400);
  assert.equal(f.calls.some(call => call.url.endsWith('/events')), false);
});

test('GPC prevents covered grants and events while analytics and withdrawal remain possible', async t => {
  const f = fixture(t);
  assert.equal((await f.call('/preferences', preference(), { 'Sec-GPC': '1' })).status, 409);
  assert.equal((await f.call('/events', interest(), { 'Sec-GPC': '1' })).status, 409);
  const analytics = await f.call('/preferences', { ...preference(), purpose: 'optional_analytics' }, { 'Sec-GPC': '1' }); assert.equal(analytics.status, 200);
  assert.equal(f.calls.filter(call => call.url.endsWith('/preferences')).at(-1).data.gpc, true);
  f.configure({ ...config(), enabled: false });
  assert.equal((await f.call('/preferences', { ...preference(), status: 'withdrawn' })).status, 200);
  assert.equal((await f.call('/preferences', { ...preference(), status: 'denied' })).status, 200);
});

test('observed GPC propagates centrally on reads and event rejection without a manual preference click', async t => {
  const f = fixture(t);
  for (const path of ['', '/preferences', '/audiences']) {
    f.calls.length = 0;
    assert.equal((await f.call(path, undefined, { 'Sec-GPC': '1' })).status, 200);
    const first = f.calls[0];
    assert.equal(new URL(first.url).pathname, '/api/collection/preferences');
    assert.match(new URL(first.url).searchParams.get('subject_ref'), /^[a-f0-9]{64}$/);
    assert.equal(first.init.headers['Sec-GPC'], '1');
    assert.equal(first.init.method, 'GET');
  }
  f.calls.length = 0;
  assert.equal((await f.call('/events', interest(), { 'Sec-GPC': '1' })).status, 409);
  assert.equal(new URL(f.calls[0].url).pathname, '/api/collection/preferences');
  assert.equal(f.calls[0].init.headers['Sec-GPC'], '1');
  assert.equal(f.calls.some(call => call.url.endsWith('/events')), false);
  f.calls.length = 0;
  assert.equal((await f.call('/preferences', { ...preference(), status: 'withdrawn', gpc: true })).status, 200);
  assert.equal(f.calls[0].init.headers['Sec-GPC'], '1', 'navigator-only GPC is forwarded before the central choice');
});

test('expired preferences remain readable and never become an active grant', async t => {
  const f = fixture(t);
  const expired = { ...preference(), status: 'expired', permission_ref: 'permission_expired', expires_at: new Date(time - 1).toISOString() };
  f.respond(Response.json({ preferences: [expired] }));
  const result = await f.call('/preferences');
  assert.equal(result.status, 200); assert.equal(result.body.preferences[0].status, 'expired');
  assert.equal(isCurrentAnalyticsGrant(result.body.preferences[0], time), false);
  assert.equal(isCurrentAnalyticsGrant({ ...expired, status: 'granted' }, time), false);
  assert.equal(isCurrentAnalyticsGrant({ ...expired, status: 'granted', expires_at: new Date(time + 1).toISOString() }, time), true);
});

test('recipient and category validation prevents Partner A choices from authorizing Partner B', async t => {
  const f = fixture(t);
  assert.equal((await f.call('/preferences', { ...preference(), purpose: 'partner_intro', recipients: [] })).status, 400);
  assert.equal((await f.call('/preferences', { ...preference(), purpose: 'partner_intro', recipients: ['partner_b'] })).status, 409);
  assert.equal((await f.call('/preferences', { ...preference(), purpose: 'partner_intro', recipients: ['partner_a'] })).status, 200);
  assert.equal((await f.call('/preferences', { ...preference(), categories: ['private_repo_name'] })).status, 400);
  const sent = f.calls.filter(call => call.url.endsWith('/preferences')); assert.equal(sent.length, 1); assert.deepEqual(sent[0].data.recipients, ['partner_a']);
});

test('explicit interest is bounded and source version is revalidated before every forward', async t => {
  const f = fixture(t);
  assert.equal((await f.call('/events', interest())).status, 202);
  const event = f.calls.find(call => call.url.endsWith('/events')).data;
  assert.equal(event.schema_version, 1); assert.equal(event.occurred_at, new Date(time).toISOString()); assert.match(event.subject_ref, /^[a-f0-9]{64}$/);
  assert.equal(event.source_id, undefined); assert.equal(event.provenance_ref, undefined);
  const forwarded = f.calls.filter(call => call.url.endsWith('/events')).length;
  for (const invalid of [{ ...interest(), category: 'https://private.invalid?secret=1' }, { ...interest(), source_configuration_version: 2 }, { ...interest(), email: 'private@example.invalid' }, { ...interest(), campaign: 'private draft' }, { ...interest(), provider: 'google_workspace' }, { ...interest(), origin: 'derived_gmail' }]) assert.ok([400, 409].includes((await f.call('/events', invalid)).status));
  assert.equal(f.calls.filter(call => call.url.endsWith('/events')).length, forwarded);
});

test('fixed destination, redirect rejection, bounded responses and errors never disclose transport details', async t => {
  const f = fixture(t);
  await f.call('/events', interest());
  assert.ok(f.calls.every(call => new URL(call.url).origin === 'https://aekr.io' && call.init.redirect === 'error' && call.init.cache === 'no-store' && call.init.signal instanceof AbortSignal));
  assert.ok(f.calls.every(call => call.init.headers.Authorization === 'Bearer ' + TOKEN));
  f.fail('config'); assert.equal((await f.call()).body.status, 'unavailable');
  const outage = await f.call('/events', interest()); assert.equal(outage.status, 503); assert.equal(outage.body.error, 'ANALYTICS_UNAVAILABLE');
  f.fail(''); f.respond(Response.json({ huge: 'p'.repeat(32768) }));
  assert.equal((await f.call()).body.status, 'unavailable');
});

test('campaign audience consumer exposes only approved references and counts', async t => {
  const f = fixture(t);
  const result = await f.call('/audiences'); assert.equal(result.status, 200);
  assert.equal(result.body.audiences.length, 1); assert.equal(result.body.audiences[0].eligible_count, 0);
  assert.equal(result.body.audiences[0].members, undefined); assert.equal(result.body.audiences[0].contact, undefined);
  f.respond(Response.json({ audiences: [{ audience_id: 'unsafe', eligible_count: -1 }] }));
  assert.equal((await f.call('/audiences')).status, 503);
});

test('mutations require the same-origin action header and reject oversized bodies', async t => {
  const f = fixture(t);
  assert.equal((await f.call('/preferences', preference(), { Origin: 'https://foreign.invalid' })).status, 403);
  assert.equal((await f.call('/preferences', preference(), { 'X-Marker-Auth': '0' })).status, 403);
  assert.equal((await f.call('/preferences', { ...preference(), unknown: 'x'.repeat(5000) })).status, 413);
  assert.equal(f.calls.length, 0);
});

test('durable rights link precedes central mutation; erasure requires evidence and retries without reporting remote deletion', async t => {
  const f = fixture(t); f.fail('preferences');
  assert.equal((await f.call('/preferences', preference())).status, 503);
  const link = f.sql.prepare('SELECT * FROM marker_analytics_subject').get(); assert.ok(link); assert.equal(link.delete_receipt_id, null);
  f.sql.prepare("UPDATE marker_account_lifecycle SET status='deleting'").run();
  await assert.rejects(deleteAnalyticsSubject(f.options.db, undefined, f.options.fetcher), /ANALYTICS_DELETION_RETRY/);
  f.fail('rights'); await assert.rejects(deleteAnalyticsSubject(f.options.db, TOKEN, f.options.fetcher));
  assert.equal(f.sql.prepare('SELECT delete_receipt_id FROM marker_analytics_subject').get().delete_receipt_id, null);
  f.fail(''); await deleteAnalyticsSubject(f.options.db, TOKEN, f.options.fetcher);
  assert.equal(f.sql.prepare('SELECT delete_receipt_id FROM marker_analytics_subject').get().delete_receipt_id, 'delete_1');
  const rights = f.calls.filter(call => call.url.endsWith('/rights')); assert.equal(rights.at(-1).data.subject_ref, link.subject_ref); assert.deepEqual(Object.keys(rights.at(-1).data).sort(), ['action', 'subject_ref']);
  await deleteAnalyticsSubject(f.options.db, TOKEN, f.options.fetcher); assert.equal(f.calls.filter(call => call.url.endsWith('/rights')).length, rights.length);
  assert.equal((await f.call('/preferences', preference())).status, 503);
});

test('native router denies anonymous inventory and mutation requests before Analytics transport', async t => {
  const sql = new DatabaseSync(':memory:'); t.after(() => sql.close());
  sql.exec("CREATE TABLE marker_account_lifecycle(id INTEGER PRIMARY KEY,status TEXT,phase TEXT,capability_hash TEXT,lease_token TEXT,lease_until INTEGER,deleted_objects INTEGER,needs_retry INTEGER); INSERT INTO marker_account_lifecycle VALUES(1,'active','active',NULL,NULL,0,0,0)");
  const DB = { prepare(query) { return { async first() { return sql.prepare(query).get() ?? null; } }; } };
  const env = { DB, MARKER_AUTH_SECRET: 'synthetic_secret_at_least_thirty_two_characters', MARKER_ORIGIN: ORIGIN };
  for (const path of ['/api/analytics', '/api/analytics/audiences', '/api/analytics/preferences', '/api/analytics/events']) {
    const response = await nativeApi(new Request(ORIGIN + path), env, { waitUntil() {} }); assert.equal(response.status, 401);
  }
});
