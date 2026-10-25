import { authRows, authBatch, retainedOperator, sessionPrincipal, boundGoogle } from './tenant-auth.js';
import { verifyAuthCaptcha } from './captcha.js';

const ISSUER = 'https://accounts.google.com', START = '/api/auth/google/start', CALLBACK = '/api/auth/google/callback';
const FLOW_COOKIE = '__Host-marker_oauth', SESSION_COOKIE = '__Host-marker_session', encoder = new TextEncoder();
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
export const GOOGLE_AUTH_ROUTES = [START, CALLBACK];
export async function revokeGoogleFlow(request, config) { const browser = readCookie(request, FLOW_COOKIE); if (browser) await authBatch(config.db, [config.db.prepare('DELETE FROM marker_auth_oauth_flows WHERE browser_hash=?').bind(await config.hash(`oauth:browser:${browser}`))]); }
export function googleConfiguration(env) {
  const clientId = env.MARKER_GOOGLE_CLIENT_ID, secret = env.MARKER_GOOGLE_CLIENT_SECRET;
  if (typeof clientId !== 'string' || !/^\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId) || clientId.length > 256 || typeof secret !== 'string' || secret.length < 16 || secret.length > 512 || /[\s\x00-\x1f]/.test(secret)) return null;
  return { clientId, secret };
}
function b64(bytes) { return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''); }
function bytes(value) { if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid proof'); return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4)), char => char.charCodeAt(0)); }
const random = () => b64(crypto.getRandomValues(new Uint8Array(32)));
function readCookie(request, name) { const parts = (request.headers.get('cookie') || '').split(';').map(value => value.trim()).filter(value => value.startsWith(name + '=')); if (parts.length !== 1) return null; const value = parts[0].slice(name.length + 1); return TOKEN.test(value) ? value : null; }
function flowCookie(value = '', seconds = 0) { return `${FLOW_COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${seconds}`; }
function response(value, status = 200, cookies = []) { const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }); for (const cookie of cookies) headers.append('Set-Cookie', cookie); return new Response(JSON.stringify(value), { status, headers }); }
function redirect(origin, result, cookies = []) { const headers = new Headers({ Location: `${origin}/?auth=${result}`, 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' }); for (const cookie of cookies) headers.append('Set-Cookie', cookie); return new Response(null, { status: 303, headers }); }
async function readBoundedJSON(response, maximum, requireOK = true) { if (requireOK && !response.ok || Number(response.headers.get('content-length')) > maximum || !response.body) throw new Error('Provider unavailable'); const reader = response.body.getReader(), chunks = []; let length = 0; try { while (true) { const result = await reader.read(); if (result.done) break; length += result.value.byteLength; if (length > maximum) throw new Error('Provider response too large'); chunks.push(result.value); } } finally { await reader.cancel().catch(() => { }); reader.releaseLock(); } const buffer = new Uint8Array(length); let position = 0; for (const chunk of chunks) { buffer.set(chunk, position); position += chunk.length; } const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer)); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid provider response'); return value; }
async function verifierKey(config) { const hex = await config.hash('oauth:verifier-encryption:v1'); return crypto.subtle.importKey('raw', Uint8Array.from(hex.match(/../g), part => parseInt(part, 16)), 'AES-GCM', false, ['encrypt', 'decrypt']); }
async function seal(config, value) { const iv = crypto.getRandomValues(new Uint8Array(12)), cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await verifierKey(config), encoder.encode(value))); return `${b64(iv)}.${b64(cipher)}`; }
async function unseal(config, value) { const [iv, cipher] = value.split('.'); return new TextDecoder('utf-8', { fatal: true }).decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(iv) }, await verifierKey(config), bytes(cipher))); }

/** Bounded RS256 verification against Google's fixed JWKS; provider access and
 * refresh tokens never enter app sessions, persistence, logs or responses. */
export async function verifyGoogleToken(idToken, clientId, nonceHash, hash, now) {
  if (typeof idToken !== 'string' || idToken.length > 24_000) throw new Error('Invalid proof');
  const parts = idToken.split('.'); if (parts.length !== 3) throw new Error('Invalid proof');
  const header = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes(parts[0])));
  if (!header || header.alg !== 'RS256' || typeof header.kid !== 'string' || header.kid.length > 200 || header.jku || header.jwk || header.crit) throw new Error('Invalid proof');
  const jwks = await readBoundedJSON(await fetch('https://www.googleapis.com/oauth2/v3/certs', { redirect: 'manual', signal: AbortSignal.timeout(10_000) }), 100_000);
  if (!Array.isArray(jwks.keys) || jwks.keys.length > 20) throw new Error('Invalid keys');
  const matching = jwks.keys.filter(key => key && key.kid === header.kid && key.kty === 'RSA' && (!key.alg || key.alg === 'RS256') && (!key.use || key.use === 'sig'));
  if (matching.length !== 1) throw new Error('Invalid keys');
  const key = await crypto.subtle.importKey('jwk', matching[0], { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, bytes(parts[2]), encoder.encode(`${parts[0]}.${parts[1]}`))) throw new Error('Invalid signature');
  now = Math.max(now, Math.floor(Date.now() / 1000));
  const claims = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes(parts[1])));
  if (!claims || ![ISSUER, 'accounts.google.com'].includes(claims.iss) || typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 255 || /[\s\x00-\x1f]/.test(claims.sub) || claims.email_verified !== true) throw new Error('Invalid identity');
  const audience = typeof claims.aud === 'string' ? [claims.aud] : claims.aud;
  if (!Array.isArray(audience) || !audience.length || audience.length > 5 || audience.some(value => typeof value !== 'string') || !audience.includes(clientId) || audience.length > 1 && claims.azp !== clientId || claims.azp !== undefined && claims.azp !== clientId) throw new Error('Invalid audience');
  if (!Number.isSafeInteger(claims.exp) || !Number.isSafeInteger(claims.iat) || claims.exp <= now || claims.iat > now + 60 || claims.iat < now - 600 || claims.exp <= claims.iat || claims.exp > now + 7200 || claims.nbf !== undefined && (!Number.isSafeInteger(claims.nbf) || claims.nbf > now + 60)) throw new Error('Expired proof');
  if (typeof claims.nonce !== 'string' || await hash(`oauth:nonce:${claims.nonce}`) !== nonceHash) throw new Error('Invalid nonce');
  return { issuer: ISSUER, subject: claims.sub };
}

export async function handleGoogleAuth(request, env, config, readBody) {
  const url = new URL(request.url), provider = googleConfiguration(env), now = Math.floor(Date.now() / 1000);
  if (url.pathname === START) {
    if (request.method !== 'POST') return response({ error: 'METHOD_NOT_ALLOWED' }, 405);
    if (url.origin !== config.origin || request.headers.get('Origin') !== config.origin || request.headers.get('X-Marker-Auth') !== '1' || request.headers.get('Sec-Fetch-Site') === 'cross-site') return response({ error: 'ORIGIN_NOT_ALLOWED' }, 403);
    if (!provider) return response({ error: 'GOOGLE_NOT_CONFIGURED' }, 503);
    const data = await readBody(request); if (Object.keys(data).some(key => !['intent','captchaToken'].includes(key)) || !['login', 'link'].includes(data.intent)) return response({ error: 'INVALID_REQUEST' }, 400);
    if (!await verifyAuthCaptcha(request, env, data.captchaToken)) return response({ error: 'CAPTCHA_REQUIRED' }, 403);
    const bound = await boundGoogle(config), sessionToken = readCookie(request, SESSION_COOKIE), sessionHash = sessionToken ? await config.hash(`session:${sessionToken}`) : null;
    let principal = null;
    if (data.intent === 'link') {
      principal = sessionHash ? await sessionPrincipal(config, sessionHash, now) : null;
      if (!principal || principal.auth_method !== 'email' || principal.authenticated_at > now || now - principal.authenticated_at >= 300) return response({ error: 'FRESH_EMAIL_PROOF_REQUIRED' }, 403);
    } else if (!bound) return response({ error: 'GOOGLE_NOT_LINKED' }, 409);
    const ip = request.headers.get('CF-Connecting-IP'); if (!ip || ip.length > 45 || !/^[0-9a-f:.]+$/i.test(ip)) return response({ error: 'AUTH_UNAVAILABLE' }, 503);
    const state = random(), browser = random(), nonce = random(), verifier = random(), stateHash = await config.hash(`oauth:state:${state}`), ipHash = await config.hash(`oauth:ip:${ip.toLowerCase()}`), hour = Math.floor(now / 3600) * 3600;
    const challenge = b64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(verifier))));
    const statements = [config.db.prepare('DELETE FROM marker_auth_oauth_flows WHERE expires_at<=?').bind(now),
    config.db.prepare(`INSERT INTO marker_auth_oauth_flows(state_hash,browser_hash,nonce_hash,sealed_verifier,intent,session_hash,owner_hash,client_id_hash,created_at,expires_at)
        SELECT ?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM marker_auth_oauth_flows)<100
        AND COALESCE((SELECT count FROM marker_auth_oauth_limits WHERE ip_hash=? AND window_start=?),0)<10`).bind(stateHash, await config.hash(`oauth:browser:${browser}`), await config.hash(`oauth:nonce:${nonce}`), await seal(config, verifier), data.intent, data.intent === 'link' ? sessionHash : null, config.ownerHashes[0], await config.hash(`oauth:client:${provider.clientId}`), now, now + 600, ipHash, hour),
    config.db.prepare(`INSERT INTO marker_auth_oauth_limits(ip_hash,window_start,count) SELECT ?,?,1 WHERE EXISTS(SELECT 1 FROM marker_auth_oauth_flows WHERE state_hash=?)
        ON CONFLICT(ip_hash) DO UPDATE SET window_start=excluded.window_start,count=CASE WHEN window_start=excluded.window_start THEN count+1 ELSE 1 END`).bind(ipHash, hour, stateHash)];
    if ((await authBatch(config.db, statements))[1].meta.changes !== 1) return response({ error: 'RATE_LIMITED' }, 429);
    const destination = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    for (const [key, value] of Object.entries({ client_id: provider.clientId, redirect_uri: config.origin + CALLBACK, response_type: 'code', scope: 'openid email profile', state, nonce, code_challenge: challenge, code_challenge_method: 'S256', prompt: 'select_account' })) destination.searchParams.set(key, value);
    return response({ url: destination.href }, 200, [flowCookie(browser, 600)]);
  }
  if (url.pathname !== CALLBACK) return response({ error: 'NOT_FOUND' }, 404);
  if (request.method !== 'GET') return response({ error: 'METHOD_NOT_ALLOWED' }, 405);
  if (url.origin !== config.origin || !provider) return redirect(config.origin, 'failed', [flowCookie()]);
  let stage = 'callback';
  let providerError = null, providerStatus = null;
  try {
    if ([...url.searchParams.keys()].some(key => !['state', 'code', 'scope', 'authuser', 'prompt', 'error', 'error_description', 'error_uri', 'hd', 'iss'].includes(key)) || url.searchParams.getAll('state').length !== 1 || url.searchParams.getAll('code').length > 1 || url.searchParams.getAll('iss').length > 1 || url.searchParams.has('iss') && url.searchParams.get('iss') !== ISSUER) throw new Error('Invalid callback');
    stage = 'browser';
    const state = url.searchParams.get('state'), browser = readCookie(request, FLOW_COOKIE); if (!TOKEN.test(state || '') || !browser) throw new Error('Invalid browser');
    const stateHash = await config.hash(`oauth:state:${state}`), browserHash = await config.hash(`oauth:browser:${browser}`);
    stage = 'flow';
    const [flow] = await authRows(config.db, `DELETE FROM marker_auth_oauth_flows WHERE state_hash=? AND browser_hash=? AND expires_at>? AND provider='google' RETURNING *`, stateHash, browserHash, now);
    if (!flow || flow.owner_hash !== config.ownerHashes[0] || flow.client_id_hash !== await config.hash(`oauth:client:${provider.clientId}`)) throw new Error('Invalid flow');
    stage = 'provider-denied';
    const code = url.searchParams.get('code'); if (url.searchParams.has('error') || typeof code !== 'string' || !code || code.length > 4096 || /[\x00-\x20]/.test(code)) throw new Error('Provider denied');
    stage = 'verifier';
    const verifier = await unseal(config, flow.sealed_verifier);
    const form = new URLSearchParams({ client_id: provider.clientId, client_secret: provider.secret, code, code_verifier: verifier, grant_type: 'authorization_code', redirect_uri: config.origin + CALLBACK });
    stage = 'token-request';
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: form, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, redirect: 'manual', signal: AbortSignal.timeout(10_000) });
    stage = 'token-response';
    if (!tokenResponse.ok) {
      providerError = 'other'; providerStatus = tokenResponse.status;
      try { const failure = await readBoundedJSON(tokenResponse, 8192, false); if (['invalid_client', 'invalid_grant', 'invalid_request', 'unauthorized_client'].includes(failure.error)) providerError = failure.error; } catch { /* Keep the fixed fallback classifier; never log provider content. */ }
      throw new Error('Token exchange rejected');
    }
    const result = await readBoundedJSON(tokenResponse, 32_000);
    stage = 'token';
    const identity = await verifyGoogleToken(result.id_token, provider.clientId, flow.nonce_hash, config.hash, Math.floor(Date.now() / 1000)), subjectHash = await config.hash(`identity:${identity.issuer}:${identity.subject}`);
    stage = 'operator';
    const operator = await retainedOperator(config.db, config.ownerHashes[0]);
    const verifiedNow = Math.floor(Date.now() / 1000);
    if (!operator) throw new Error('Operator unavailable');
    if (flow.intent === 'link') {
      stage = 'link';
      const principal = flow.session_hash ? await sessionPrincipal(config, flow.session_hash, verifiedNow, false) : null;
      if (!principal || principal.auth_method !== 'email' || principal.authenticated_at > verifiedNow || verifiedNow - principal.authenticated_at >= 300) throw new Error('Fresh proof required');
      const existing = await boundGoogle(config); if (existing && existing.subject_hash !== subjectHash) throw new Error('Identity already bound');
      const changes = await authBatch(config.db, [config.db.prepare(`INSERT OR IGNORE INTO marker_auth_identities(issuer,subject_hash,tenant_id,user_id,linked_at)
        SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM marker_auth_sessions s JOIN marker_auth_principals p ON p.session_hash=s.session_hash
        WHERE s.session_hash=? AND s.owner_hash=? AND s.expires_at>? AND s.last_seen>? AND p.auth_method='email' AND p.authenticated_at>? AND p.tenant_id=? AND p.user_id=?)`).bind(ISSUER, subjectHash, operator.tenant_id, operator.user_id, verifiedNow, flow.session_hash, operator.owner_hash, verifiedNow, verifiedNow - 1800, verifiedNow - 300, operator.tenant_id, operator.user_id)]);
      if (changes[0].meta.changes !== 1 && !(existing && existing.subject_hash === subjectHash)) throw new Error('Identity binding rejected');
      return redirect(config.origin, 'google-linked', [flowCookie()]);
    }
    stage = 'login';
    const bound = await boundGoogle(config); if (!bound || bound.subject_hash !== subjectHash) throw new Error('Identity not bound');
    const token = random(), sessionHash = await config.hash(`session:${token}`);
    const changes = await authBatch(config.db, [config.db.prepare(`INSERT INTO marker_auth_sessions(session_hash,owner_hash,created_at,expires_at,last_seen)
      SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM marker_auth_identities WHERE issuer=? AND subject_hash=? AND tenant_id=? AND user_id=?)`).bind(sessionHash, operator.owner_hash, verifiedNow, verifiedNow + 21600, verifiedNow, ISSUER, subjectHash, operator.tenant_id, operator.user_id),
    config.db.prepare(`INSERT INTO marker_auth_principals(session_hash,tenant_id,user_id,auth_method,authenticated_at)
        SELECT session_hash,?,?,'google',? FROM marker_auth_sessions WHERE session_hash=? AND owner_hash=?`).bind(operator.tenant_id, operator.user_id, verifiedNow, sessionHash, operator.owner_hash)]);
    if (changes[0].meta.changes !== 1 || changes[1].meta.changes !== 1) throw new Error('Session rejected');
    return redirect(config.origin, 'signed-in', [`${SESSION_COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=21600`, flowCookie()]);
  } catch { if (providerError) console.warn('marker-google-auth-failed', stage, providerError, providerStatus); else console.warn('marker-google-auth-failed', stage); return redirect(config.origin, 'failed', [flowCookie()]); }
}
