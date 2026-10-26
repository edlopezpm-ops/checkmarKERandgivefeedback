import { DomainError } from '../src/core/domain.ts';
import type { OwnerPrincipal } from './native-auth.js';
import { json } from './api.ts';
import { requireFreshProof, sessionHash } from './policy.ts';

type ExportEnv = Pick<Env, 'DB' | 'MARKER_ORIGIN' | 'MARKER_AUTH_SECRET'>;
const LIMIT = 25, MAX_BYTES = 2 * 1024 * 1024;
const tables = {
  assets: 'marker_studio_assets', materials: 'marker_studio_materials', campaigns: 'marker_studio_campaigns',
  variants: 'marker_studio_variants', renders: 'marker_studio_jobs', analyses: 'marker_studio_analysis',
  conversations: 'marker_agent_sessions', runs: 'marker_agent_runs', proposals: 'marker_agent_proposals', events: 'marker_agent_events',
} as const;
const categories = ['core', ...Object.keys(tables)];
const excluded = ['Original media and rendered/analysis binary files', 'Operational settings, quotas and connection descriptors', 'Incomplete upload parts', 'Authentication, cookies, tokens, credentials and security infrastructure records', 'Provider logs and recovery copies', 'Independent local workspaces and downloaded copies'];
// Stored product documents contain user content, not authentication tables.
// Remove private execution fields defensively if a future writer adds one.
function productData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(productData);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !/(?:token|secret|credential|cookie|password|authorization|owner_hash|code_hash|subject_hash|session_hash)/i.test(key)).map(([key, child]) => [key, productData(child)]));
}

export async function privacyDataApi(request: Request, env: ExportEnv, principal: OwnerPrincipal): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  const url = new URL(request.url), origin = request.headers.get('Origin');
  if (url.origin !== env.MARKER_ORIGIN || origin !== null && origin !== env.MARKER_ORIGIN || request.headers.get('X-Marker-Auth') !== '1' || request.headers.get('Sec-Fetch-Site') === 'cross-site') throw new DomainError('ORIGIN_NOT_ALLOWED', 403);
  requireFreshProof(principal);
  const category = url.searchParams.get('category') ?? 'core', after = url.searchParams.get('after') ?? '';
  if (!categories.includes(category) || after.length > 100 || /[\u0000-\u001f]/.test(after) || [...url.searchParams.keys()].some(key => !['category', 'after'].includes(key))) throw new DomainError('EXPORT_REQUEST_INVALID', 400);
  const hash = await sessionHash(request, env);
  // Every returned row is selected with the live session, immutable singleton
  // binding, fresh proof and lifecycle in the same database snapshot. No Terms
  // or optional-storage receipt is required to exercise this right.
  const gate = `EXISTS(SELECT 1 FROM marker_auth_principals p JOIN marker_auth_sessions s ON s.session_hash=p.session_hash JOIN marker_auth_operator o ON o.id=1 AND o.user_id=p.user_id AND o.tenant_id=p.tenant_id JOIN marker_account_lifecycle a ON a.id=1
    WHERE p.session_hash=? AND p.user_id=? AND p.tenant_id=? AND p.authenticated_at>unixepoch()-300 AND p.authenticated_at<=unixepoch() AND s.expires_at>unixepoch() AND s.last_seen>unixepoch()-1800 AND a.status='active')`;
  const args = [hash, principal.userId, principal.tenantId];
  const statements = [env.DB.prepare(`SELECT 1 AS allowed WHERE ${gate}`).bind(...args)];
  if (category === 'core') {
    if (after) throw new DomainError('EXPORT_REQUEST_INVALID', 400);
    statements.push(env.DB.prepare(`SELECT name,country,revision FROM marker_profile WHERE id=1 AND ${gate}`).bind(...args));
    statements.push(env.DB.prepare(`SELECT revision,document FROM marker_workspace WHERE id=1 AND ${gate}`).bind(...args));
    statements.push(env.DB.prepare(`SELECT terms_version,privacy_notice_version,cookies_notice_version,purpose_version,acknowledged_at FROM marker_policy_acknowledgements WHERE user_id=? AND tenant_id=? AND ${gate}`).bind(principal.userId, principal.tenantId, ...args));
  } else {
    const table = tables[category as keyof typeof tables];
    const size = await env.DB.prepare(`SELECT COALESCE(SUM(bytes),0) bytes FROM (SELECT length(CAST(document AS BLOB)) bytes FROM ${table} WHERE id>? AND ${gate} ORDER BY id LIMIT ?)`).bind(after, ...args, LIMIT + 1).first<{ bytes: number }>();
    if (!size || size.bytes > MAX_BYTES) throw new DomainError('EXPORT_PAGE_TOO_LARGE_CONTACT_OPERATOR', 413);
    statements.push(env.DB.prepare(`SELECT id,CASE WHEN length(CAST(document AS BLOB))<=${MAX_BYTES} THEN document ELSE NULL END document FROM ${table} WHERE id>? AND ${gate} ORDER BY id LIMIT ?`).bind(after, ...args, LIMIT + 1));
  }
  const results = await env.DB.batch(statements);
  if (results.length !== statements.length || results.some(result => !result.success)) throw new DomainError('EXPORT_UNAVAILABLE', 503);
  if (!results[0].results.length) throw new DomainError('FRESH_PROOF_REQUIRED', 403);
  let data: unknown, next: string | null = null;
  if (category === 'core') {
    const workspace = results[2].results[0] as { revision: number; document: string } | undefined;
    data = { account: { userId: principal.userId, tenantId: principal.tenantId, email: principal.email }, profile: results[1].results[0] ?? null, workspace: workspace ? { ...JSON.parse(workspace.document), revision: workspace.revision } : null, policyAcknowledgement: results[3].results[0] ?? null };
  } else {
    const rows = results[1].results as Array<{ id: string; document: string | null }>;
    if (rows.some(row => row.document === null)) throw new DomainError('EXPORT_PAGE_TOO_LARGE_CONTACT_OPERATOR', 413);
    if (rows.length > LIMIT) next = rows[LIMIT - 1].id;
    data = rows.slice(0, LIMIT).map(row => ({ id: row.id, record: JSON.parse(row.document!) }));
  }
  const payload = { format: 'marker-own-data-v1', subject: { userId: principal.userId, tenantId: principal.tenantId }, category, data: productData(data), next, completeCategory: next === null, categories, excluded, limits: { rowsPerPage: LIMIT, bytesPerPage: MAX_BYTES }, consistency: 'Each page is a live database snapshot; pages do not form a frozen archive. Retry after edits or contact the operator for a coordinated export.' };
  if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > MAX_BYTES) throw new DomainError('EXPORT_PAGE_TOO_LARGE_CONTACT_OPERATOR', 413);
  const response = json(payload);
  response.headers.set('Content-Disposition', `attachment; filename="marker-${category}.json"`);
  return response;
}
