import { McpAuthStore } from './mcp-auth-store.ts';

export const MCP_SCOPES = ['marker:read', 'marker:write', 'marker:produce', 'marker:delete'] as const;
export type McpPrincipal = { userId: string; tenantId: string; clientId: string; grantId: string; scopes: string[] };
type Owner = { userId: string; tenantId: string; email: string };
type Client = { client_id: string; name: string; redirect_uris: string; expires_at: number; authorized_at: number | null };
type Grant = { grant_id: string; client_id: string; user_id: string; tenant_id: string; scopes: string; resource: string; expires_at: number; revoked_at: number | null };
type Consent = { clientId: string; redirectUri: string; challenge: string; scope: string; state: string; resource: string; language: 'es' | 'en' };
type ConsentRow = { document: string; user_id: string; tenant_id: string; expires_at: number; consumed_by: string | null };
type LoginRow = { document: string; client_id: string; expires_at: number; consumed_by: string | null };
type CodeRow = Grant & { redirect_uri: string; challenge: string; code_expires_at: number; consumed_by: string | null };
type TokenRow = Grant & { refresh_expires_at: number; consumed_by: string | null };
const encoder = new TextEncoder(), OPAQUE = /^[A-Za-z0-9_-]{43}$/, PKCE = /^[A-Za-z0-9._~-]{43,128}$/;
const ROUTE = '/api/mcp/oauth/', ACCESS_TTL = 900, FAMILY_TTL = 30 * 86400;
class OAuthError extends Error {
  status: number;
  description?: string;
  constructor(error: string, status = 400, description?: string) { super(error); this.status = status; this.description = description; }
}
function opaque() { return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''); }
async function digest(value: string) { return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))); }
async function hash(value: string) { return Array.from(await digest(value), byte => byte.toString(16).padStart(2, '0')).join(''); }
async function challenge(value: string) { return btoa(String.fromCharCode(...await digest(value))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''); }
const esc = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', 'Pragma': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } });
}
function scopes(value: string) {
  const values = value.trim().split(/ +/);
  if (!values.length || values.length > MCP_SCOPES.length || new Set(values).size !== values.length || values.some(scope => !MCP_SCOPES.includes(scope as typeof MCP_SCOPES[number]))) throw new OAuthError('invalid_scope');
  return values;
}
function params(value: URLSearchParams) {
  const result: Record<string, string> = {};
  for (const [key, item] of value) { if (Object.hasOwn(result, key)) throw new OAuthError('invalid_request'); result[key] = item; }
  return result;
}
async function body(request: Request, json = false): Promise<Record<string, unknown>> {
  if (!(json ? /^application\/json(?:\s*;.*)?$/i : /^application\/x-www-form-urlencoded(?:\s*;.*)?$/i).test(request.headers.get('Content-Type') || '')) throw new OAuthError('invalid_request');
  const length = request.headers.get('Content-Length');
  if (length && (!/^\d+$/.test(length) || Number(length) > 8192)) throw new OAuthError('invalid_request', 413);
  const reader = request.body?.getReader(); if (!reader) throw new OAuthError('invalid_request');
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const text = await Promise.race([new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new OAuthError('invalid_request', 408)), 3000); }), (async () => {
      const chunks: Uint8Array[] = []; let size = 0;
      while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 8192) throw new OAuthError('invalid_request', 413); chunks.push(value); }
      const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    })()]);
    const parsed: unknown = json ? JSON.parse(text) : params(new URLSearchParams(text));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new OAuthError('invalid_request');
    return parsed as Record<string, unknown>;
  } catch (error) { if (error instanceof OAuthError) throw error; throw new OAuthError('invalid_request'); }
  finally { clearTimeout(timeout); void reader.cancel().catch(() => {}); }
}
function text(value: unknown, max = 2048) { if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new OAuthError('invalid_request'); return value; }
function loopback(url: URL) { return ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname); }
function nativeCallback(url: URL) { return url.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(url.hostname); }
function allowedRedirect(value: unknown, origin: URL) {
  const uri = text(value); let url: URL; try { url = new URL(uri); } catch { throw new OAuthError('invalid_redirect_uri'); }
  const allowed = nativeCallback(url) || (url.protocol === 'https:' && !loopback(url)) || (loopback(origin) && loopback(url) && ['http:', 'https:'].includes(url.protocol));
  if (url.href !== uri || url.username || url.password || url.hash || !allowed) throw new OAuthError('invalid_redirect_uri');
  return uri;
}
function matchesRedirect(registered: string, candidate: string) {
  if (registered === candidate) return true;
  const left = new URL(registered), right = new URL(candidate);
  if (!nativeCallback(left) || !nativeCallback(right)) return false;
  left.port = ''; right.port = '';
  return left.href === right.href;
}
function page(language: 'es' | 'en', content: string, status = 200) {
  return new Response(`<!doctype html><html lang="${language}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>marKER</title><style>@font-face{font-family:Montserrat;src:url(/fonts/Montserrat-Variable.woff2) format('woff2');font-weight:100 900;font-display:swap}body{margin:0;background:#f7f6f0;color:#292927;font:16px Montserrat,Arial,sans-serif}main{max-width:480px;margin:5vh auto;padding:24px}img{display:block;width:280px;max-width:100%;height:auto;margin-bottom:24px}h1{font-size:24px}p,li{line-height:1.6}small{overflow-wrap:anywhere}button,a{font:inherit}button{padding:12px 18px;border:1px solid #ccc;background:#fff;border-radius:8px;cursor:pointer;margin:8px 8px 8px 0}button[value=allow]{background:#ffad67;border-color:#ffad67;color:#292927}a{color:#292927}</style><main><img src="/brand/marker-logo-v1.png" alt="marKER">${content}</main></html>`, { headers: {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'none'; img-src 'self'; font-src 'self'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  }, status });
}

/** Delegated account access, independent from email/Google/GitHub owner login. */
export function createMcpAuthorization(options: { db: D1Database; origin: string; ownerSession: (request: Request) => Promise<Owner | null>; assertActive?: () => Promise<void> }) {
  const origin = new URL(options.origin);
  if (origin.origin !== options.origin || !(origin.protocol === 'https:' || (origin.protocol === 'http:' && loopback(origin)))) throw new Error('MCP requires a canonical HTTPS origin or local loopback');
  const resource = origin.origin + '/api/mcp', store = new McpAuthStore(options.db);
  const now = () => Math.floor(Date.now() / 1000);
  async function active() {
    await options.assertActive?.();
    if ((await store.first<{ status: string }>('SELECT status FROM marker_account_lifecycle WHERE id=1'))?.status !== 'active') throw new OAuthError('access_denied', 403);
  }
  async function owner(request: Request) { const value = await options.ownerSession(request); if (!value) throw new OAuthError('access_denied', 401); return value; }
  function sameOrigin(request: Request) { if (request.headers.get('Origin') !== origin.origin) throw new OAuthError('access_denied', 403); }
  async function client(id: unknown) {
    if (typeof id !== 'string' || !OPAQUE.test(id)) throw new OAuthError('invalid_client');
    const value = await store.first<Client>('SELECT * FROM marker_mcp_clients WHERE client_id=? AND (authorized_at IS NOT NULL OR expires_at>?)', id, now());
    if (!value) throw new OAuthError('invalid_client'); return value;
  }
  function redirect(consent: Consent, values: Record<string, string>) {
    const url = new URL(consent.redirectUri); for (const [key, value] of Object.entries(values)) url.searchParams.set(key, value);
    if (consent.state) url.searchParams.set('state', consent.state); url.searchParams.set('iss', origin.origin);
    return new Response(null, { status: 303, headers: { Location: url.href, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  }
  async function register(request: Request) {
    const data = await body(request, true);
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    await store.cleanup(now());
    if (!await store.rate(await hash('registration:' + ip), now(), 20, 3600)) throw new OAuthError('slow_down', 429);
    if (data.token_endpoint_auth_method !== undefined && data.token_endpoint_auth_method !== 'none') throw new OAuthError('invalid_client_metadata');
    for (const [key, allowed] of [['grant_types', ['authorization_code', 'refresh_token']], ['response_types', ['code']]] as const) {
      const values = data[key]; if (values !== undefined && (!Array.isArray(values) || !values.length || values.some(value => !(allowed as readonly unknown[]).includes(value)))) throw new OAuthError('invalid_client_metadata');
    }
    if (!Array.isArray(data.redirect_uris) || data.redirect_uris.length < 1 || data.redirect_uris.length > 5) throw new OAuthError('invalid_redirect_uri');
    const redirects = [...new Set(data.redirect_uris.map(uri => allowedRedirect(uri, origin)))];
    const name = text(data.client_name ?? 'MCP client', 100).trim(); if (!name) throw new OAuthError('invalid_client_metadata');
    if (data.scope !== undefined) scopes(text(data.scope, 200));
    const id = opaque(), issued = now();
    const result = await store.run(`INSERT INTO marker_mcp_clients(client_id,name,redirect_uris,created_at,expires_at)
      SELECT ?,?,?,?,? WHERE (SELECT count(*) FROM marker_mcp_clients)<200`, id, name, JSON.stringify(redirects), issued, issued+90*86400);
    if (result.meta.changes !== 1) throw new OAuthError('temporarily_unavailable', 429, 'Connection capacity reached. Try again later or contact marKER.');
    return response({ client_id: id, client_id_issued_at: issued, client_name: name, redirect_uris: redirects, token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], scope: MCP_SCOPES.join(' ') }, 201);
  }
  async function openConsent(consent: Consent, app: Client, principal: Owner, loginHash?: string) {
    await store.cleanup(now());
    if (!await store.rate(await hash('consent:' + principal.userId), now(), 30, 600)) throw new OAuthError('slow_down', 429);
    const nonce = opaque(), nonceHash = await hash(nonce), expires = now()+600;
    if (loginHash) {
      const tag = opaque();
      const result = await store.batch([
        store.statement('UPDATE marker_mcp_login_requests SET consumed_by=? WHERE request_hash=? AND consumed_by IS NULL AND expires_at>? RETURNING request_hash', tag, loginHash, now()),
        store.statement(`INSERT INTO marker_mcp_requests(request_hash,client_id,user_id,tenant_id,document,expires_at)
          SELECT ?,client_id,?,?,document,? FROM marker_mcp_login_requests WHERE request_hash=? AND consumed_by=?`, nonceHash, principal.userId, principal.tenantId, expires, loginHash, tag),
      ]);
      if (!result[0].results.length) throw new OAuthError('access_denied', 403);
    } else {
      await store.run('INSERT INTO marker_mcp_requests(request_hash,client_id,user_id,tenant_id,document,expires_at) VALUES(?,?,?,?,?,?)', nonceHash, app.client_id, principal.userId, principal.tenantId, JSON.stringify(consent), expires);
    }
    const es = consent.language === 'es';
    const labels: Record<string, string> = es ? { 'marker:read': 'Consultar productos, biblioteca y campañas', 'marker:write': 'Crear y editar materiales, campañas y propuestas', 'marker:produce': 'Preparar renders y exportar versiones aprobadas', 'marker:delete': 'Eliminar elementos que marKER permita borrar' } : { 'marker:read': 'Read products, library and campaigns', 'marker:write': 'Create and edit materials, campaigns and proposals', 'marker:produce': 'Prepare renders and export approved versions', 'marker:delete': 'Delete items that marKER allows to be deleted' };
    return page(consent.language, `<h1>${es ? 'Conectar' : 'Connect'} ${esc(app.name)}</h1><p>${esc(principal.email)}</p><ul>${scopes(consent.scope).map(scope => `<li>${labels[scope]}</li>`).join('')}</ul><small>${es ? 'Volverás a' : 'Return address'}: ${esc(new URL(consent.redirectUri).origin)}</small><form method="post" action="${ROUTE}authorize"><input type="hidden" name="request" value="${nonce}"><button name="decision" value="allow">${es ? 'Permitir' : 'Allow'}</button><button name="decision" value="deny">${es ? 'Cancelar' : 'Cancel'}</button></form>`);
  }
  async function startLogin(request: Request, consent: Consent) {
    await store.cleanup(now());
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!await store.rate(await hash('login:' + ip), now(), 20, 600)) throw new OAuthError('slow_down', 429);
    const handle = opaque();
    const result = await store.run(`INSERT INTO marker_mcp_login_requests(request_hash,client_id,document,expires_at)
      SELECT ?,?,?,? WHERE (SELECT count(*) FROM marker_mcp_login_requests)<2000`, await hash(handle), consent.clientId, JSON.stringify(consent), now()+600);
    if (result.meta.changes !== 1) throw new OAuthError('temporarily_unavailable', 429);
    return new Response(null, { status: 303, headers: { Location: origin.origin+'/?mcp_resume='+handle, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  }
  async function resume(request: Request, url: URL) {
    const data = params(url.searchParams);
    if (!OPAQUE.test(data.request || '')) throw new OAuthError('invalid_request');
    const loginHash = await hash(data.request);
    const row = await store.first<LoginRow>('SELECT * FROM marker_mcp_login_requests WHERE request_hash=?', loginHash);
    if (!row || row.consumed_by || row.expires_at <= now()) throw new OAuthError('access_denied', 403);
    const consent = JSON.parse(row.document) as Consent, app = await client(row.client_id);
    if (consent.clientId !== app.client_id || consent.resource !== resource || !(JSON.parse(app.redirect_uris) as string[]).some(uri => matchesRedirect(uri, allowedRedirect(consent.redirectUri, origin)))) throw new OAuthError('access_denied', 403);
    const principal = await options.ownerSession(request);
    if (!principal) return new Response(null, { status: 303, headers: { Location: origin.origin+'/?mcp_resume='+data.request, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
    return openConsent(consent, app, principal, loginHash);
  }
  async function authorize(request: Request, url: URL) {
    if (request.method === 'GET') {
      if (url.search.length > 8192) throw new OAuthError('invalid_request', 413);
      const data = params(url.searchParams), app = await client(data.client_id);
      const redirectUri = allowedRedirect(data.redirect_uri, origin);
      if (!(JSON.parse(app.redirect_uris) as string[]).some(uri => matchesRedirect(uri, redirectUri))) throw new OAuthError('invalid_redirect_uri');
      if (data.response_type !== 'code' || data.code_challenge_method !== 'S256' || !OPAQUE.test(data.code_challenge || '')) throw new OAuthError('invalid_request');
      if (data.resource !== resource) throw new OAuthError('invalid_target');
      const consent: Consent = { clientId: app.client_id, redirectUri, challenge: data.code_challenge, scope: scopes(data.scope || 'marker:read').join(' '), state: text(data.state || '', 1024), resource, language: /^(es)(?:\b|[-_])/i.test(data.ui_locales || request.headers.get('Accept-Language') || '') ? 'es' : 'en' };
      const principal = await options.ownerSession(request);
      return principal ? openConsent(consent, app, principal) : startLogin(request, consent);
    }
    sameOrigin(request); const principal = await owner(request), data = await body(request);
    if (!OPAQUE.test(String(data.request)) || !['allow', 'deny'].includes(String(data.decision))) throw new OAuthError('invalid_request');
    const requestHash = await hash(String(data.request));
    const row = await store.first<ConsentRow>('SELECT * FROM marker_mcp_requests WHERE request_hash=?', requestHash);
    if (!row || row.consumed_by || row.expires_at <= now() || row.user_id !== principal.userId || row.tenant_id !== principal.tenantId) throw new OAuthError('access_denied', 403);
    const consent = JSON.parse(row.document) as Consent; await client(consent.clientId);
    const tag = opaque();
    const consume = store.statement('UPDATE marker_mcp_requests SET consumed_by=? WHERE request_hash=? AND consumed_by IS NULL AND expires_at>? AND user_id=? AND tenant_id=? RETURNING request_hash', tag, requestHash, now(), principal.userId, principal.tenantId);
    if (data.decision === 'deny') {
      const results = await store.batch([consume]); if (!results[0].results.length) throw new OAuthError('access_denied', 403);
      return redirect(consent, { error: 'access_denied' });
    }
    const grantId = opaque(), code = opaque(), issued = now();
    const result = await store.batch([consume,
      store.statement(`INSERT INTO marker_mcp_grants(grant_id,client_id,user_id,tenant_id,scopes,resource,created_at,expires_at)
        SELECT ?,client_id,user_id,tenant_id,?,?,?,? FROM marker_mcp_requests WHERE request_hash=? AND consumed_by=?`, grantId, consent.scope, resource, issued, issued+FAMILY_TTL, requestHash, tag),
      store.statement(`INSERT INTO marker_mcp_codes(code_hash,grant_id,client_id,redirect_uri,challenge,expires_at)
        SELECT ?,grant_id,client_id,?,?,? FROM marker_mcp_grants WHERE grant_id=?`, await hash(code), consent.redirectUri, consent.challenge, issued+120, grantId),
      store.statement(`UPDATE marker_mcp_clients SET authorized_at=COALESCE(authorized_at,?) WHERE client_id=? AND EXISTS(SELECT 1 FROM marker_mcp_requests WHERE request_hash=? AND consumed_by=?)`, issued, consent.clientId, requestHash, tag),
    ]);
    if (!result[0].results.length) throw new OAuthError('access_denied', 403);
    return redirect(consent, { code });
  }
  async function tokens(request: Request) {
    const data = await body(request); await client(data.client_id);
    if (data.resource !== resource) throw new OAuthError('invalid_target');
    if (request.headers.has('Authorization') || data.client_secret !== undefined) throw new OAuthError('invalid_client');
    const issued = now(), access = opaque(), refresh = opaque(), accessHash = await hash(access), refreshHash = await hash(refresh), tag = opaque();
    let grant: Grant, results: D1Result[];
    if (data.grant_type === 'authorization_code') {
      if (!OPAQUE.test(String(data.code)) || !PKCE.test(String(data.code_verifier))) throw new OAuthError('invalid_grant');
      const codeHash = await hash(String(data.code));
      const row = await store.first<CodeRow>(`SELECT g.*,c.redirect_uri,c.challenge,c.expires_at AS code_expires_at,c.consumed_by FROM marker_mcp_codes c JOIN marker_mcp_grants g USING(grant_id) WHERE c.code_hash=?`, codeHash);
      if (!row || row.client_id !== data.client_id || row.redirect_uri !== data.redirect_uri || row.challenge !== await challenge(String(data.code_verifier)) || row.resource !== resource || row.revoked_at !== null || row.expires_at <= issued || row.code_expires_at <= issued || row.consumed_by) throw new OAuthError('invalid_grant');
      grant = row;
      results = await store.batch([
        store.statement(`UPDATE marker_mcp_codes SET consumed_by=? WHERE code_hash=? AND consumed_by IS NULL AND expires_at>? AND EXISTS(SELECT 1 FROM marker_mcp_grants g WHERE g.grant_id=marker_mcp_codes.grant_id AND g.revoked_at IS NULL AND g.expires_at>?) RETURNING grant_id`, tag, codeHash, issued, issued),
        store.statement(`INSERT INTO marker_mcp_tokens(access_hash,refresh_hash,grant_id,client_id,access_expires_at,refresh_expires_at)
          SELECT ?,?,grant_id,client_id,?,? FROM marker_mcp_codes WHERE code_hash=? AND consumed_by=?`, accessHash, refreshHash, issued+ACCESS_TTL, row.expires_at, codeHash, tag),
      ]);
    } else if (data.grant_type === 'refresh_token') {
      if (!OPAQUE.test(String(data.refresh_token))) throw new OAuthError('invalid_grant');
      const oldHash = await hash(String(data.refresh_token));
      const row = await store.first<TokenRow>(`SELECT g.*,t.refresh_expires_at,t.consumed_by FROM marker_mcp_tokens t JOIN marker_mcp_grants g USING(grant_id) WHERE t.refresh_hash=?`, oldHash);
      if (!row || row.client_id !== data.client_id || row.resource !== resource || row.revoked_at !== null || row.expires_at <= issued || row.refresh_expires_at <= issued) throw new OAuthError('invalid_grant');
      if (row.consumed_by) { await store.run('UPDATE marker_mcp_grants SET revoked_at=? WHERE grant_id=?', issued, row.grant_id); throw new OAuthError('invalid_grant'); }
      if (data.scope !== undefined && scopes(text(data.scope, 200)).join(' ') !== row.scopes) throw new OAuthError('invalid_scope');
      grant = row;
      results = await store.batch([
        store.statement(`UPDATE marker_mcp_tokens SET consumed_by=? WHERE refresh_hash=? AND consumed_by IS NULL AND refresh_expires_at>? AND EXISTS(SELECT 1 FROM marker_mcp_grants g WHERE g.grant_id=marker_mcp_tokens.grant_id AND g.revoked_at IS NULL AND g.expires_at>?) RETURNING grant_id`, tag, oldHash, issued, issued),
        store.statement(`INSERT INTO marker_mcp_tokens(access_hash,refresh_hash,grant_id,client_id,access_expires_at,refresh_expires_at)
          SELECT ?,?,grant_id,client_id,?,refresh_expires_at FROM marker_mcp_tokens WHERE refresh_hash=? AND consumed_by=?`, accessHash, refreshHash, issued+ACCESS_TTL, oldHash, tag),
      ]);
      if (!results[0].results.length) { await store.run('UPDATE marker_mcp_grants SET revoked_at=? WHERE grant_id=?', issued, row.grant_id); throw new OAuthError('invalid_grant'); }
    } else throw new OAuthError('unsupported_grant_type');
    if (!results[0].results.length || results[1].meta.changes !== 1) throw new OAuthError('invalid_grant');
    return response({ access_token: access, token_type: 'Bearer', expires_in: Math.min(ACCESS_TTL, grant.expires_at-issued), refresh_token: refresh, scope: grant.scopes });
  }
  async function revoke(request: Request) {
    const data = await body(request); await client(data.client_id);
    if (request.headers.has('Authorization') || data.client_secret !== undefined) throw new OAuthError('invalid_client');
    if (typeof data.token === 'string' && OPAQUE.test(data.token)) {
      const tokenHash = await hash(data.token);
      await store.run(`UPDATE marker_mcp_grants SET revoked_at=? WHERE client_id=? AND grant_id IN(SELECT grant_id FROM marker_mcp_tokens WHERE access_hash=? OR refresh_hash=?)`, now(), data.client_id, tokenHash, tokenHash);
    }
    return response({});
  }
  async function connections(request: Request) {
    const principal = await owner(request);
    if (request.method === 'GET') {
      const rows = await store.all<Grant & { name: string; created_at: number }>(`SELECT g.*,c.name FROM marker_mcp_grants g JOIN marker_mcp_clients c USING(client_id) WHERE g.user_id=? AND g.tenant_id=? AND g.revoked_at IS NULL AND g.expires_at>? ORDER BY g.created_at DESC LIMIT 100`, principal.userId, principal.tenantId, now());
      return response({ connections: rows.results.map(row => ({ id: row.grant_id, clientName: row.name, scopes: scopes(row.scopes), createdAt: row.created_at, expiresAt: row.expires_at })) });
    }
    sameOrigin(request); if (request.headers.get('X-Marker-MCP') !== '1') throw new OAuthError('access_denied', 403);
    const data = await body(request, true); if (!OPAQUE.test(String(data.grantId))) throw new OAuthError('invalid_request');
    await store.run('UPDATE marker_mcp_grants SET revoked_at=? WHERE grant_id=? AND user_id=? AND tenant_id=?', now(), data.grantId, principal.userId, principal.tenantId);
    return response({ ok: true });
  }
  return {
    async handle(request: Request): Promise<Response | null> {
      const url = new URL(request.url), path = url.pathname;
      const known = [ROUTE+'register', ROUTE+'authorize', ROUTE+'resume', ROUTE+'token', ROUTE+'revoke', '/api/mcp/connections', '/.well-known/oauth-protected-resource/api/mcp', '/.well-known/oauth-authorization-server'];
      if (!known.includes(path)) return null;
      try {
        if (url.origin !== origin.origin) throw new OAuthError('access_denied', 403);
        await active();
        if (path.startsWith('/.well-known/')) {
          if (request.method !== 'GET') throw new OAuthError('invalid_request', 405);
          return response(path.includes('oauth-protected-resource') ? { resource, authorization_servers: [origin.origin], scopes_supported: ['marker:read'], bearer_methods_supported: ['header'] } : {
            issuer: origin.origin, authorization_endpoint: origin.origin+ROUTE+'authorize', token_endpoint: origin.origin+ROUTE+'token', registration_endpoint: origin.origin+ROUTE+'register', revocation_endpoint: origin.origin+ROUTE+'revoke',
            response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'], code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['none'], revocation_endpoint_auth_methods_supported: ['none'], scopes_supported: MCP_SCOPES,
            authorization_response_iss_parameter_supported: true, client_id_metadata_document_supported: false,
          });
        }
        const methods = path === ROUTE+'resume' ? ['GET'] : path === ROUTE+'authorize' || path === '/api/mcp/connections' ? ['GET', 'POST'] : ['POST'];
        if (!methods.includes(request.method)) throw new OAuthError('invalid_request', 405);
        if (path === ROUTE+'register') return await register(request);
        if (path === ROUTE+'authorize') return await authorize(request, url);
        if (path === ROUTE+'resume') return await resume(request, url);
        if (path === ROUTE+'token') return await tokens(request);
        if (path === ROUTE+'revoke') return await revoke(request);
        return await connections(request);
      } catch (error) {
        if (path === ROUTE+'resume' && request.method === 'GET') {
          const es = /^es\b/i.test(request.headers.get('Accept-Language') || '');
          return page(es ? 'es' : 'en', `<h1>${es ? 'Vuelve a conectar marKER' : 'Reconnect marKER'}</h1><p>${es ? 'Esta conexión venció o no pudo completarse. Vuelve al asistente e inicia la conexión de nuevo.' : 'This connection expired or could not be completed. Return to your assistant and start connecting again.'}</p><a href="${origin.origin}">${es ? 'Abrir marKER' : 'Open marKER'}</a>`, error instanceof OAuthError ? error.status : 503);
        }
        return error instanceof OAuthError ? response({ error: error.message, ...(error.description ? { error_description: error.description } : {}) }, error.status) : response({ error: 'temporarily_unavailable' }, 503);
      }
    },
    async authenticate(request: Request): Promise<McpPrincipal | null> {
      try {
        if (new URL(request.url).origin !== origin.origin) return null;
        await active();
        const match = /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(request.headers.get('Authorization') || ''); if (!match) return null;
        const row = await store.first<Grant>(`SELECT g.* FROM marker_mcp_tokens t JOIN marker_mcp_grants g USING(grant_id) JOIN marker_auth_operator o ON o.user_id=g.user_id AND o.tenant_id=g.tenant_id WHERE t.access_hash=? AND t.access_expires_at>? AND t.consumed_by IS NULL AND g.revoked_at IS NULL AND g.expires_at>? AND g.resource=?`, await hash(match[1]), now(), now(), resource);
        return row ? { userId: row.user_id, tenantId: row.tenant_id, clientId: row.client_id, grantId: row.grant_id, scopes: scopes(row.scopes) } : null;
      } catch { return null; }
    },
  };
}
