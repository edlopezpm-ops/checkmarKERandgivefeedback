import { json, readJson } from './api.ts';
import { DomainError, object } from '../src/core/domain.ts';
import { analyticsCategories, analyticsEvents, analyticsPurposes, type AnalyticsConfiguration, type AnalyticsOverview } from '../src/core/analytics.ts';

const source = 'marker-owner-production';
const central = 'https://aekr.io';
const gpcPurposes = ['onsite_personalized_ads', 'external_ad_audiences', 'audience_licensing'];
type Principal = { userId: string; tenantId: string };
type Options = { token?: unknown; subjectSecret: string; db?: D1Database; fetcher?: typeof fetch; now?: () => number };

function sourceToken(value: unknown) { return typeof value === 'string' && /^[A-Za-z0-9_-]{32,256}$/.test(value) ? value : ''; }
async function centralRequest(token: string, fetcher: typeof fetch, pathname: string, data?: unknown, gpc = false) {
  const response = await fetcher(central + '/api/collection/' + pathname, {
    method: data === undefined ? 'GET' : 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(2500),
    headers: { Authorization: 'Bearer ' + token, ...(gpc ? { 'Sec-GPC': '1' } : {}), ...(data === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  if (!response.ok) throw new DomainError(response.status === 429 ? 'ANALYTICS_RATE_LIMITED' : 'ANALYTICS_UNAVAILABLE', response.status === 429 ? 429 : 503);
  return object(await readJson(new Request(central, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: response.body, duplex: 'half' } as RequestInit), 32_768));
}

/** The existing deletion lease retries this effect before purging identity. */
export async function deleteAnalyticsSubject(db: D1Database, rawToken: unknown, fetcher: typeof fetch = fetch) {
  const table = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='marker_analytics_subject'").first();
  if (!table) return;
  const link = await db.prepare('SELECT subject_ref,delete_receipt_id FROM marker_analytics_subject WHERE id=1').first<{ subject_ref: string; delete_receipt_id: string | null }>();
  if (!link || link.delete_receipt_id) return;
  const token = sourceToken(rawToken);
  if (!token) throw new DomainError('ANALYTICS_DELETION_RETRY', 503);
  const receipt = await centralRequest(token, fetcher, 'rights', { subject_ref: link.subject_ref, action: 'delete' });
  if (receipt.local_state !== 'local_deleted' || typeof receipt.receipt_id !== 'string' || !/^[a-zA-Z0-9_-]{1,96}$/.test(receipt.receipt_id) || receipt.recipient_state !== 'check_delivery_receipts') throw new DomainError('ANALYTICS_DELETION_RETRY', 503);
  const saved = await db.prepare('UPDATE marker_analytics_subject SET delete_receipt_id=? WHERE id=1 AND subject_ref=?').bind(receipt.receipt_id, link.subject_ref).run();
  if (!saved.success || saved.meta.changes !== 1) throw new DomainError('ANALYTICS_DELETION_RETRY', 503);
}

function strings(value: unknown, allowed?: readonly string[], limit = 20): value is string[] {
  return Array.isArray(value) && value.length <= limit && new Set(value).size === value.length && value.every(item => typeof item === 'string' && item.length <= 96 && /^[a-z0-9_-]+$/.test(item) && (!allowed || allowed.includes(item)));
}
function exactKeys(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).some(key => !keys.includes(key))) throw new DomainError('ANALYTICS_INVALID_FIELDS');
}
function validConfiguration(value: unknown, now: number): value is AnalyticsConfiguration {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  const issued = Date.parse(String(c.issued_at)), expires = Date.parse(String(c.expires_at));
  return c.schema_version === 1 && c.source_id === source && c.product === 'marker' && c.environment === 'production'
    && Number.isSafeInteger(c.version) && Number(c.version) > 0 && typeof c.enabled === 'boolean'
    && Number.isFinite(issued) && issued <= now + 30_000 && issued >= now - 300_000
    && Number.isFinite(expires) && expires > now && expires <= issued + 300_000
    && strings(c.events, analyticsEvents) && strings(c.fields, ['category', 'offer_id'])
    && strings(c.purposes, analyticsPurposes) && strings(c.destinations)
    && Number.isSafeInteger(c.retention_days) && Number(c.retention_days) >= 1 && Number(c.retention_days) <= 30
    && (c.restriction_reason === null || typeof c.restriction_reason === 'string' && c.restriction_reason.length <= 300);
}
async function subjectRef(principal: Principal, secret: string) {
  if (secret.length < 32) throw new DomainError('ANALYTICS_UNAVAILABLE', 503);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(JSON.stringify([source, principal.tenantId, principal.userId])));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Called only after native owner authentication, tenant binding and policy gates. */
export async function analyticsApi(request: Request, principal: Principal, options: Options): Promise<Response> {
  const path = new URL(request.url).pathname;
  const token = sourceToken(options.token);
  const base: AnalyticsOverview = { console_url: central + '/analytics', source_id: source, status: 'not_configured', desired_version: null, applied_version: null, configuration: null };
  const now = options.now ?? Date.now;
  const requestGpc = request.headers.get('Sec-GPC') === '1';
  async function call(pathname: string, data?: unknown, gpc = requestGpc) {
    return centralRequest(token, options.fetcher ?? fetch, pathname, data, gpc);
  }
  async function configuration() {
    const c = await call('config?source_id=' + source);
    if (!validConfiguration(c, now())) throw new DomainError('ANALYTICS_UNAVAILABLE', 503);
    return c;
  }
  async function registerSubject(subject_ref: string) {
    if (!options.db) throw new DomainError('ANALYTICS_UNAVAILABLE', 503);
    const stored = await options.db.prepare("INSERT INTO marker_analytics_subject(id,subject_ref) SELECT 1,? WHERE EXISTS(SELECT 1 FROM marker_account_lifecycle WHERE id=1 AND status='active') ON CONFLICT(id) DO NOTHING").bind(subject_ref).run();
    if (!stored.success) throw new DomainError('ANALYTICS_UNAVAILABLE', 503);
    const link = await options.db.prepare("SELECT subject_ref FROM marker_analytics_subject WHERE id=1 AND delete_receipt_id IS NULL AND EXISTS(SELECT 1 FROM marker_account_lifecycle WHERE id=1 AND status='active')").first<{ subject_ref: string }>();
    if (link?.subject_ref !== subject_ref) throw new DomainError('ANALYTICS_UNAVAILABLE', 503);
  }
  async function propagateGpc(subject_ref: string) {
    await registerSubject(subject_ref);
    // Central exclusion also invalidates audiences and cancels queued covered
    // advertising. A producer-only rejection would leave earlier jobs active.
    await call('preferences?subject_ref=' + subject_ref, undefined, true);
  }
  try {
    if (request.method !== 'GET' && (request.method !== 'POST' || request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('X-Marker-Auth') !== '1')) return json({ error: 'ORIGIN_NOT_ALLOWED' }, 403);
    if (!token) return request.method === 'GET' && path === '/api/analytics' ? json(base) : json({ error: 'ANALYTICS_NOT_CONFIGURED' }, 503);
    if (path === '/api/analytics' && request.method === 'GET') {
      if (requestGpc) await propagateGpc(await subjectRef(principal, options.subjectSecret));
      const c = await configuration();
      const overview: AnalyticsOverview = { ...base, configuration: c, desired_version: c.version, status: c.enabled ? 'active' : 'paused' };
      try { await call('ack', { source_configuration_version: c.version }); overview.applied_version = c.version; }
      catch { overview.status = 'confirmation_pending'; }
      return json(overview);
    }
    const subject_ref = await subjectRef(principal, options.subjectSecret);
    if (requestGpc && !(path === '/api/analytics/preferences' && request.method === 'GET')) await propagateGpc(subject_ref);
    if (path === '/api/analytics/preferences' && request.method === 'GET') {
      if (requestGpc) await registerSubject(subject_ref);
      const data = await call('preferences?subject_ref=' + subject_ref);
      if (!Array.isArray(data.preferences) || data.preferences.length > 50) throw new DomainError('ANALYTICS_UNAVAILABLE', 503);
      const preferences = data.preferences.map(item => {
        const p = object(item);
        if (!analyticsPurposes.includes(p.purpose as never) || !['granted', 'denied', 'withdrawn', 'expired'].includes(String(p.status)) || typeof p.permission_ref !== 'string' || p.permission_ref.length > 96 || !strings(p.categories, analyticsCategories) || !strings(p.recipients) || typeof p.gpc !== 'boolean' || !(p.expires_at === null || typeof p.expires_at === 'string' && Number.isFinite(Date.parse(p.expires_at)))) throw new DomainError('ANALYTICS_UNAVAILABLE', 503);
        return { purpose: p.purpose, status: p.status, permission_ref: p.permission_ref, categories: p.categories, recipients: p.recipients, gpc: p.gpc, expires_at: p.expires_at };
      });
      return json({ preferences });
    }
    if (path === '/api/analytics/preferences' && request.method === 'POST') {
      const body = object(await readJson(request, 4096));
      exactKeys(body, ['purpose', 'status', 'categories', 'recipients', 'gpc']);
      if (!analyticsPurposes.includes(body.purpose as never) || !['granted', 'denied', 'withdrawn'].includes(String(body.status)) || !strings(body.categories, analyticsCategories) || !strings(body.recipients) || typeof body.gpc !== 'boolean') throw new DomainError('ANALYTICS_INVALID_PREFERENCE');
      const gpc = body.gpc || requestGpc;
      if (body.gpc && !requestGpc) await propagateGpc(subject_ref);
      if (body.status === 'granted') {
        const c = await configuration();
        if (!c.enabled || !c.purposes.includes(String(body.purpose)) || body.recipients.some(recipient => !c.destinations.includes(recipient)) || gpc && gpcPurposes.includes(String(body.purpose))) throw new DomainError('ANALYTICS_PURPOSE_UNAVAILABLE', 409);
        if (['partner_intro', 'external_ad_audiences', 'audience_licensing'].includes(String(body.purpose)) && body.recipients.length === 0) throw new DomainError('ANALYTICS_RECIPIENT_REQUIRED');
      }
      await registerSubject(subject_ref);
      const receipt = await call('preferences', { ...body, gpc, subject_ref, notice_version: '2026-10-25' });
      if (typeof receipt.permission_ref !== 'string' || receipt.permission_ref.length > 96) throw new DomainError('ANALYTICS_UNAVAILABLE', 503);
      return json({ purpose: body.purpose, status: body.status, permission_ref: receipt.permission_ref, gpc });
    }
    if (path === '/api/analytics/events' && request.method === 'POST') {
      const body = object(await readJson(request, 2048));
      exactKeys(body, ['event_id', 'event', 'purpose', 'permission_ref', 'category', 'source_configuration_version']);
      // This private owner surface only produces an explicitly selected interest.
      // It cannot describe a public visitor, sale, conversion or campaign result.
      if (body.event !== 'commercial_interest_selected' || body.purpose !== 'onsite_personalized_ads' || typeof body.permission_ref !== 'string' || !/^[a-zA-Z0-9_-]{1,96}$/.test(body.permission_ref) || typeof body.event_id !== 'string' || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(body.event_id) || !analyticsCategories.includes(body.category as never)) throw new DomainError('ANALYTICS_INVALID_EVENT');
      const c = await configuration();
      if (!c.enabled || body.source_configuration_version !== c.version || !c.events.includes(body.event) || !c.purposes.includes(String(body.purpose)) || !c.fields.includes('category') || request.headers.get('Sec-GPC') === '1' && gpcPurposes.includes(String(body.purpose))) throw new DomainError('ANALYTICS_EVENT_PAUSED', 409);
      await registerSubject(subject_ref);
      const receipt = await call('events', { ...body, subject_ref, schema_version: 1, occurred_at: new Date(now()).toISOString() });
      return json({ accepted: receipt.accepted === true, duplicate: receipt.duplicate === true }, 202);
    }
    if (path === '/api/analytics/audiences' && request.method === 'GET') {
      const data = await call('audiences');
      if (!Array.isArray(data.audiences) || data.audiences.length > 50) throw new DomainError('ANALYTICS_UNAVAILABLE', 503);
      const audiences = data.audiences.map(item => {
        const a = object(item);
        if (typeof a.audience_id !== 'string' || !/^[a-z0-9_-]{1,96}$/.test(a.audience_id) || !Number.isSafeInteger(a.version) || Number(a.version) < 1 || !Number.isSafeInteger(a.eligible_count) || Number(a.eligible_count) < 0 || typeof a.as_of !== 'string' || !Number.isFinite(Date.parse(a.as_of)) || !['demo', 'production'].includes(String(a.mode))) throw new DomainError('ANALYTICS_UNAVAILABLE', 503);
        return { audience_id: a.audience_id, version: a.version, eligible_count: a.eligible_count, as_of: a.as_of, mode: a.mode };
      });
      return json({ audiences });
    }
    return json({ error: 'NOT_FOUND' }, 404);
  } catch (error) {
    if (request.method === 'GET' && path === '/api/analytics') return json({ ...base, status: 'unavailable' });
    return json({ error: error instanceof DomainError ? error.message : 'ANALYTICS_UNAVAILABLE' }, error instanceof DomainError ? error.status : 503);
  }
}
