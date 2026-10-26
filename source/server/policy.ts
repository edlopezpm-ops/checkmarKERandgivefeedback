import { SERVICE_POLICY, servicePolicyAcknowledgement } from '../src/core/policy.ts';
import { DomainError, object } from '../src/core/domain.ts';
import { json, readJson } from './api.ts';
import type { OwnerPrincipal } from './native-auth.js';

type PolicyEnv = Pick<Env, 'DB' | 'MARKER_ORIGIN' | 'MARKER_AUTH_SECRET'>;
const encoder = new TextEncoder();
type Identity = Pick<OwnerPrincipal, 'userId' | 'tenantId'>;
type Receipt = { terms_version: string; privacy_notice_version: string; cookies_notice_version: string; purpose_version: string; acknowledged_at: number };

export async function policyStatus(db: D1Database, identity?: Identity) {
  const receipt = await db.prepare(`SELECT p.terms_version,p.privacy_notice_version,p.cookies_notice_version,p.purpose_version,p.acknowledged_at
    FROM marker_policy_acknowledgements p JOIN marker_auth_operator o ON o.user_id=p.user_id AND o.tenant_id=p.tenant_id
    WHERE o.id=1${identity ? ' AND p.user_id=? AND p.tenant_id=?' : ''}`).bind(...(identity ? [identity.userId, identity.tenantId] : [])).first<Receipt>();
  const required = !receipt || receipt.terms_version !== SERVICE_POLICY.termsVersion || receipt.privacy_notice_version !== SERVICE_POLICY.privacyNoticeVersion || receipt.cookies_notice_version !== SERVICE_POLICY.cookiesNoticeVersion || receipt.purpose_version !== SERVICE_POLICY.purposeVersion;
  return { required, current: SERVICE_POLICY, receipt: receipt ? { termsVersion: receipt.terms_version, privacyNoticeVersion: receipt.privacy_notice_version, cookiesNoticeVersion: receipt.cookies_notice_version, purposeVersion: receipt.purpose_version, acknowledgedAt: new Date(receipt.acknowledged_at * 1000).toISOString() } : null };
}

export async function assertPolicyAcknowledged(db: D1Database, identity?: Identity): Promise<void> {
  if ((await policyStatus(db, identity)).required) throw new DomainError('POLICY_ACKNOWLEDGEMENT_REQUIRED', 428);
}

export function requireFreshProof(principal: OwnerPrincipal) {
  const age = Math.floor(Date.now() / 1000) - principal.authenticatedAt;
  if (age < 0 || age >= 300) throw new DomainError('FRESH_PROOF_REQUIRED', 403);
}

export async function sessionHash(request: Request, env: PolicyEnv) {
  const values = (request.headers.get('Cookie') ?? '').split(';').map(value => value.trim()).filter(value => value.startsWith('__Host-marker_session='));
  const token = values.length === 1 ? values[0].slice('__Host-marker_session='.length) : '';
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new DomainError('AUTH_REQUIRED', 401);
  const secret = encoder.encode(env.MARKER_AUTH_SECRET ?? '');
  if (secret.length < 32 || secret.length > 512) throw new DomainError('POLICY_UNAVAILABLE', 503);
  const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`session:${token}`))), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function policyApi(request: Request, env: PolicyEnv, principal: OwnerPrincipal): Promise<Response> {
  if (request.method === 'GET') return json(await policyStatus(env.DB, principal));
  if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  if (new URL(request.url).origin !== env.MARKER_ORIGIN || request.headers.get('Origin') !== env.MARKER_ORIGIN || request.headers.get('X-Marker-Auth') !== '1') throw new DomainError('ORIGIN_NOT_ALLOWED', 403);
  const input = object(await readJson(request, 1024)), expected = servicePolicyAcknowledgement();
  if (Object.keys(input).length !== Object.keys(expected).length || Object.entries(expected).some(([key, value]) => input[key] !== value)) throw new DomainError('POLICY_ACKNOWLEDGEMENT_INVALID', 400);
  requireFreshProof(principal);
  const hash = await sessionHash(request, env);
  const gate = `EXISTS(SELECT 1 FROM marker_auth_principals p JOIN marker_auth_sessions s ON s.session_hash=p.session_hash JOIN marker_auth_operator o ON o.id=1 AND o.user_id=p.user_id AND o.tenant_id=p.tenant_id JOIN marker_account_lifecycle a ON a.id=1
      WHERE p.session_hash=? AND p.user_id=? AND p.tenant_id=? AND p.authenticated_at>unixepoch()-300 AND p.authenticated_at<=unixepoch() AND s.expires_at>unixepoch() AND s.last_seen>unixepoch()-1800 AND a.status='active')`;
  const args = [hash, principal.userId, principal.tenantId];
  const results = await env.DB.batch([env.DB.prepare(`INSERT INTO marker_policy_acknowledgements(user_id,tenant_id,terms_version,privacy_notice_version,cookies_notice_version,purpose_version,acknowledged_at)
    SELECT ?,?,?,?,?,?,unixepoch() WHERE ${gate}
    ON CONFLICT(user_id,tenant_id) DO UPDATE SET terms_version=excluded.terms_version,privacy_notice_version=excluded.privacy_notice_version,cookies_notice_version=excluded.cookies_notice_version,purpose_version=excluded.purpose_version,acknowledged_at=excluded.acknowledged_at
    WHERE terms_version!=excluded.terms_version OR privacy_notice_version!=excluded.privacy_notice_version OR cookies_notice_version!=excluded.cookies_notice_version OR purpose_version!=excluded.purpose_version`).bind(principal.userId, principal.tenantId, SERVICE_POLICY.termsVersion, SERVICE_POLICY.privacyNoticeVersion, SERVICE_POLICY.cookiesNoticeVersion, SERVICE_POLICY.purposeVersion, ...args),
    env.DB.prepare(`SELECT 1 allowed WHERE ${gate}`).bind(...args)]);
  if (results.some(result => !result.success)) throw new DomainError('POLICY_UNAVAILABLE', 503);
  if (!results[1].results.length) throw new DomainError('FRESH_PROOF_REQUIRED', 403);
  // Recheck after the conditional write; expiry/races cannot report acceptance.
  const status = await policyStatus(env.DB, principal);
  if (status.required) throw new DomainError('FRESH_PROOF_REQUIRED', 403);
  return json(status);
}

export function policyRequired(origin: string): Response {
  return json({ error: 'policy_ack_required', policyUrl: `${origin}/?policy=terms`, message: 'The account holder must review and acknowledge the current notices in marKER. Agents cannot accept contracts.' }, 428);
}
