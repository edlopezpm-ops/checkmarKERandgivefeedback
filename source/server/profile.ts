import { json, readJson } from './api.ts';
import { DomainError, object } from '../src/core/domain.ts';
import { ownerSession, type OwnerPrincipal } from './native-auth.js';
import { deriveProfileInitials } from '../src/core/profile.ts';

type LifecycleStatus = 'active' | 'deleting' | 'deleted';
type Phase = 'active' | 'processor' | 'waiting' | 'uploads' | 'media' | 'database' | 'done';
type LifecycleRow = { status: LifecycleStatus; phase: Phase; capability_hash: string | null; lease_token: string | null; lease_until: number; deleted_objects: number; needs_retry: number };
type ProfileEnvironment = Pick<Env, 'DB' | 'MARKER_AUTH_SECRET' | 'MARKER_ORIGIN' | 'MARKER_OWNER_EMAIL' | 'MARKER_SENDER_EMAIL' | 'EMAIL'> & Partial<Pick<Env, 'MEDIA' | 'STUDIO_PROCESSOR'>>;
const CAPABILITY_COOKIE = '__Host-marker_deletion';
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const encoder = new TextEncoder();
const PURGE_TABLES = ['marker_agent_events', 'marker_agent_proposals', 'marker_agent_runs', 'marker_agent_sessions', 'marker_agent_connections', 'marker_agent_meta', 'marker_studio_jobs', 'marker_studio_variants', 'marker_studio_campaigns', 'marker_studio_analysis', 'marker_studio_materials', 'marker_studio_assets', 'marker_studio_uploads', 'marker_studio_compute', 'marker_studio_settings', 'marker_studio_limits', 'marker_studio_meta', 'marker_workspace', 'marker_profile', 'marker_auth_oauth_flows', 'marker_auth_identities', 'marker_auth_principals', 'marker_auth_sessions', 'marker_auth_challenges', 'marker_auth_oauth_limits', 'marker_auth_limits', 'marker_auth_operator'] as const;

async function lifecycle(env: Pick<Env, 'DB'>): Promise<LifecycleRow> {
  try {
    const row = await env.DB.prepare('SELECT status,phase,capability_hash,lease_token,lease_until,deleted_objects,needs_retry FROM marker_account_lifecycle WHERE id=1').first<LifecycleRow>();
    if (!row || !['active', 'deleting', 'deleted'].includes(row.status)) throw new Error('missing lifecycle');
    return row;
  } catch { throw new DomainError('ACCOUNT_UNAVAILABLE', 503); }
}
function progress(row: LifecycleRow) {
  return { status: row.status, phase: row.phase, deletedObjects: row.deleted_objects, needsRetry: row.needs_retry === 1 };
}
export async function readAccountLifecycle(env: Pick<Env, 'DB'>) {
  return progress(await lifecycle(env));
}
export async function assertAccountActive(env: Pick<Env, 'DB'>): Promise<void> {
  const row = await lifecycle(env);
  if (row.status !== 'active') throw new DomainError(row.status === 'deleted' ? 'ACCOUNT_DELETED' : 'ACCOUNT_DELETING', row.status === 'deleted' ? 410 : 423);
}
function tokenCookie(request: Request, name: string): string | null {
  const cookies = (request.headers.get('Cookie') ?? '').split(';').map(value => value.trim()).filter(value => value.startsWith(`${name}=`));
  const value = cookies.length === 1 ? cookies[0].slice(name.length + 1) : '';
  return TOKEN.test(value) ? value : null;
}
function cookie(token = '', seconds = 0) {
  return `${CAPABILITY_COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${seconds}`;
}
async function hmac(env: ProfileEnvironment, value: string): Promise<string> {
  const secret = typeof env.MARKER_AUTH_SECRET === 'string' ? encoder.encode(env.MARKER_AUTH_SECRET) : new Uint8Array();
  if (secret.length < 32 || secret.length > 512 || /[\r\n]/.test(env.MARKER_AUTH_SECRET)) throw new DomainError('ACCOUNT_UNAVAILABLE', 503);
  const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
async function capabilityForSession(request: Request, env: ProfileEnvironment): Promise<string | null> {
  const token = tokenCookie(request, '__Host-marker_session');
  if (!token) return null;
  const hex = await hmac(env, `account-deletion-capability:${token}`);
  return btoa(String.fromCharCode(...hex.match(/../g)!.map(pair => parseInt(pair, 16)))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
async function hasCapability(request: Request, env: ProfileEnvironment, row: LifecycleRow): Promise<boolean> {
  const token = tokenCookie(request, CAPABILITY_COOKIE);
  return !!token && !!row.capability_hash && await hmac(env, `account-deletion-receipt:${token}`) === row.capability_hash;
}
function requireMutation(request: Request, env: ProfileEnvironment) {
  if (request.headers.get('Origin') !== env.MARKER_ORIGIN || new URL(request.url).origin !== env.MARKER_ORIGIN || request.headers.get('X-Marker-Auth') !== '1') throw new DomainError('ORIGIN_NOT_ALLOWED', 403);
}
function fresh(principal: OwnerPrincipal) {
  const age = Math.floor(Date.now() / 1000) - principal.authenticatedAt;
  return principal.method === 'email' && age >= 0 && age < 300;
}
async function profile(env: ProfileEnvironment, principal: OwnerPrincipal) {
  const row = await env.DB.prepare('SELECT name,country,email,revision FROM marker_profile WHERE id=1').first<{ name: string; country: string; email: string; revision: number }>();
  if (!row) throw new DomainError('PROFILE_UNAVAILABLE', 503);
  return { profile: { name: row.name, country: row.country, revision: row.revision, email: principal.email, initials: deriveProfileInitials(row.name, principal.email) }, canDeleteAccount: !!(env.MEDIA && env.STUDIO_PROCESSOR), requiresFreshProof: !fresh(principal) };
}
function field(value: unknown, max: number) {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new DomainError('PROFILE_INVALID', 400);
  return value.trim();
}
function deletionResponse(row: LifecycleRow, token?: string) {
  const response = json({ deletion: progress(row), ...(row.status === 'deleting' ? { resumeAfterMs: 1000 } : {}) }, row.status === 'deleted' ? 200 : 202);
  if (token) {
    response.headers.append('Set-Cookie', cookie(token, 21_600));
    response.headers.append('Set-Cookie', '__Host-marker_session=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0');
  } else if (row.status === 'deleted') response.headers.append('Set-Cookie', cookie());
  return response;
}

export async function profileApi(request: Request, env: ProfileEnvironment): Promise<Response> {
  try {
    const path = new URL(request.url).pathname, row = await lifecycle(env);
    if (path === '/api/profile/deletion' || path === '/api/profile/deletion/resume') {
      if (row.status === 'active' || !await hasCapability(request, env, row)) return json({ error: 'DELETION_NOT_FOUND' }, 404);
      if (path.endsWith('/resume')) {
        if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
        requireMutation(request, env);
        if (Object.keys(object(await readJson(request, 256))).length) throw new DomainError('INVALID_REQUEST', 400);
        return deletionResponse(await advanceAccountDeletion(env));
      }
      if (request.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
      return deletionResponse(row);
    }
    if (path !== '/api/profile') return json({ error: 'NOT_FOUND' }, 404);
    if (request.method === 'DELETE') {
      requireMutation(request, env);
      const input = object(await readJson(request, 256));
      if (Object.keys(input).length !== 2 || input.confirmation !== 'DELETE' || input.confirmAllData !== true) throw new DomainError('CONFIRMATION_REQUIRED', 400);
      const token = await capabilityForSession(request, env);
      const hash = token && await hmac(env, `account-deletion-receipt:${token}`);
      // A lost initial response may be retried by its original opaque session.
      if (row.status === 'deleting' && hash && row.capability_hash === hash) return deletionResponse(row, token!);
      await assertAccountActive(env);
      const principal = await ownerSession(request, env);
      if (!principal) throw new DomainError('AUTH_REQUIRED', 401);
      const requestedTenant = request.headers.get('X-Tenant-ID') ?? new URL(request.url).searchParams.get('tenant_id');
      if (requestedTenant !== null && requestedTenant !== principal.tenantId) throw new DomainError('ACCESS_DENIED', 403);
      if (!fresh(principal)) throw new DomainError('FRESH_EMAIL_PROOF_REQUIRED', 403);
      if (!(env.MEDIA && env.STUDIO_PROCESSOR) || !hash) throw new DomainError('DELETION_UNAVAILABLE', 503);
      const rawSession = tokenCookie(request, '__Host-marker_session')!, sessionHash = await hmac(env, `session:${rawSession}`), now = Math.floor(Date.now() / 1000);
      const result = await env.DB.prepare(`UPDATE marker_account_lifecycle SET status='deleting',phase='processor',capability_hash=?,needs_retry=0 WHERE id=1 AND status='active'
        AND EXISTS(SELECT 1 FROM marker_auth_principals p JOIN marker_auth_sessions s ON s.session_hash=p.session_hash WHERE p.session_hash=? AND p.auth_method='email' AND p.authenticated_at>? AND p.authenticated_at<=? AND p.tenant_id=? AND p.user_id=? AND s.expires_at>? AND s.last_seen>?)`).bind(hash, sessionHash, now - 300, now, principal.tenantId, principal.userId, now, now - 1800).run();
      if (!result.success) throw new DomainError('DELETION_UNAVAILABLE', 503);
      const started = await lifecycle(env);
      if (started.status !== 'deleting' || started.capability_hash !== hash) throw new DomainError('FRESH_EMAIL_PROOF_REQUIRED', 403);
      return deletionResponse(started, token!);
    }
    await assertAccountActive(env);
    const principal = await ownerSession(request, env);
    if (!principal) throw new DomainError('AUTH_REQUIRED', 401);
    const requestedTenant = request.headers.get('X-Tenant-ID') ?? new URL(request.url).searchParams.get('tenant_id');
    if (requestedTenant !== null && requestedTenant !== principal.tenantId) throw new DomainError('ACCESS_DENIED', 403);
    if (request.method === 'GET') return json(await profile(env, principal));
    if (request.method !== 'PATCH') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
    requireMutation(request, env);
    const data = object(await readJson(request, 2048));
    if (Object.keys(data).some(key => !['name', 'country', 'expectedRevision'].includes(key)) || !['name', 'country'].some(key => key in data)) throw new DomainError('PROFILE_INVALID', 400);
    const current = await profile(env, principal), value = current.profile;
    const name = data.name === undefined ? value.name : field(data.name, 120), country = data.country === undefined ? value.country : field(data.country, 80);
    if (principal.email.length > 254) throw new DomainError('PROFILE_UNAVAILABLE', 503);
    if (data.expectedRevision !== undefined && data.expectedRevision !== value.revision) throw new DomainError('REVISION_CONFLICT', 409);
    const result = await env.DB.prepare('UPDATE marker_profile SET name=?,country=?,email=?,revision=revision+1 WHERE id=1 AND revision=?').bind(name, country, principal.email, value.revision).run();
    if (!result.success) throw new DomainError('PROFILE_UNAVAILABLE', 503);
    if (result.meta.changes !== 1) throw new DomainError('REVISION_CONFLICT', 409);
    return json(await profile(env, principal));
  } catch (error) { return json({ error: error instanceof DomainError ? error.message : 'PROFILE_UNAVAILABLE' }, error instanceof DomainError ? error.status : 503); }
}

// R2 effects are idempotent and bounded. A durable lease serializes requests and
// cron recovery; a failed effect never advances the phase or reports completion.
export async function advanceAccountDeletion(env: ProfileEnvironment): Promise<LifecycleRow> {
  const row = await lifecycle(env);
  if (row.status !== 'deleting') return row;
  if (!(env.MEDIA && env.STUDIO_PROCESSOR)) throw new DomainError('DELETION_UNAVAILABLE', 503);
  const lease = crypto.randomUUID(), now = Date.now();
  const claimed = await env.DB.prepare("UPDATE marker_account_lifecycle SET lease_token=?,lease_until=?,needs_retry=0 WHERE id=1 AND status='deleting' AND lease_until<=?").bind(lease, now + 600_000, now).run();
  if (!claimed.success) throw new DomainError('DELETION_UNAVAILABLE', 503);
  if (claimed.meta.changes !== 1) return lifecycle(env);
  async function setPhase(phase: Phase, objects = 0) {
    const changed = await env.DB.prepare("UPDATE marker_account_lifecycle SET phase=?,deleted_objects=deleted_objects+? WHERE id=1 AND status='deleting' AND lease_token=?").bind(phase, objects, lease).run();
    if (!changed.success || changed.meta.changes !== 1) throw new DomainError('DELETION_RETRY', 503);
  }
  try {
    const current = await lifecycle(env);
    if (current.phase === 'processor') {
      await env.STUDIO_PROCESSOR.getByName('owner').stopForAccountDeletion();
      await setPhase('waiting');
    } else if (current.phase === 'waiting') {
      const locks = await env.DB.prepare(`SELECT MAX(until_at) AS until_at FROM (
        SELECT lock_until AS until_at FROM marker_studio_uploads UNION ALL SELECT lock_until FROM marker_studio_jobs UNION ALL SELECT lock_until FROM marker_studio_analysis UNION ALL SELECT compute_until FROM marker_studio_limits)`).first<{ until_at: number | null }>();
      if ((locks?.until_at ?? 0) <= Date.now()) await setPhase('uploads');
    } else if (current.phase === 'uploads') {
      const uploads = await env.DB.prepare('SELECT id,document FROM marker_studio_uploads LIMIT 20').all<{ id: string; document: string }>();
      if (!uploads.success) throw new Error('storage unavailable');
      for (const upload of uploads.results) {
        const data = object(JSON.parse(upload.document));
        if (typeof data.multipartId === 'string' && typeof data.key === 'string') {
          try { await env.MEDIA.resumeMultipartUpload(data.key, data.multipartId).abort(); }
          catch (error) {
            const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
            // R2 may expose its documented NoSuchUpload code in the Error text.
            // Only confirmed absence is idempotent; dependency errors stop cleanup.
            if (!(code === 10024 || code === 'NoSuchUpload' || error instanceof Error && /(?:\bNoSuchUpload\b|\(10024\))/.test(error.message))) throw error;
          }
        }
        const removed = await env.DB.prepare("DELETE FROM marker_studio_uploads WHERE id=? AND EXISTS(SELECT 1 FROM marker_account_lifecycle WHERE id=1 AND lease_token=? AND status='deleting')").bind(upload.id, lease).run();
        if (!removed.success || removed.meta.changes !== 1) throw new Error('storage unavailable');
      }
      if (uploads.results.length === 0) await setPhase('media');
    } else if (current.phase === 'media') {
      const listed = await env.MEDIA.list({ limit: 100 });
      if (listed.objects.length) {
        await env.MEDIA.delete(listed.objects.map(entry => entry.key));
        await setPhase('media', listed.objects.length);
      } else if (!listed.truncated) await setPhase('database');
    } else if (current.phase === 'database') {
      // Recheck emptiness after all known multipart and processor work settled.
      const listed = await env.MEDIA.list({ limit: 1 });
      if (listed.objects.length || listed.truncated) await setPhase('media');
      else {
        // Upgrade-safe: account deletion also removes every connector credential
        // and effect receipt, including deployments before MCP was activated.
        const mcpOrder = ['marker_mcp_effects', 'marker_mcp_tokens', 'marker_mcp_codes', 'marker_mcp_requests', 'marker_mcp_grants', 'marker_mcp_clients', 'marker_mcp_limits'];
        const present = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'marker_mcp_%'").all<{ name: string }>();
        if (!present.success) throw new Error('storage unavailable');
        const tables = [...mcpOrder.filter(table => present.results.some(row => row.name === table)), ...PURGE_TABLES];
        const statements = tables.map(table => env.DB.prepare(`DELETE FROM ${table} WHERE EXISTS(SELECT 1 FROM marker_account_lifecycle WHERE id=1 AND lease_token=? AND status='deleting' AND phase='database')`).bind(lease));
        statements.push(env.DB.prepare("UPDATE marker_account_lifecycle SET status='deleted',phase='done',capability_hash=NULL,lease_token=NULL,lease_until=0,needs_retry=0 WHERE id=1 AND lease_token=? AND status='deleting' AND phase='database'").bind(lease));
        const results = await env.DB.batch(statements);
        if (results.length !== statements.length || results.some(result => !result.success) || results.at(-1)?.meta.changes !== 1) throw new Error('storage unavailable');
      }
    }
  } catch {
    await env.DB.prepare("UPDATE marker_account_lifecycle SET needs_retry=1 WHERE id=1 AND status='deleting' AND lease_token=?").bind(lease).run();
    throw new DomainError('DELETION_RETRY', 503);
  } finally {
    await env.DB.prepare('UPDATE marker_account_lifecycle SET lease_token=NULL,lease_until=0 WHERE id=1 AND lease_token=?').bind(lease).run();
  }
  return lifecycle(env);
}
