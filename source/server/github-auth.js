import { authRows, authBatch, retainedOperator, sessionPrincipal, boundProvider } from './tenant-auth.js';
import { verifyAuthCaptcha } from './captcha.js';

const ISSUER = 'https://github.com', START = '/api/auth/github/start', CALLBACK = '/api/auth/github/callback';
const BROWSER_COOKIE = '__Host-marker_github_oauth', SESSION_COOKIE = '__Host-marker_session', TOKEN = /^[A-Za-z0-9_-]{43}$/, encoder = new TextEncoder();
export const GITHUB_AUTH_ROUTES = [START, CALLBACK];
export function githubConfiguration(env) { const clientId = env.MARKER_GITHUB_CLIENT_ID, secret = env.MARKER_GITHUB_CLIENT_SECRET; if (typeof clientId !== 'string' || !/^[A-Za-z0-9_.-]{10,128}$/.test(clientId) || typeof secret !== 'string' || secret.length < 16 || secret.length > 512 || /[\s\x00-\x1f]/.test(secret)) return null; return { clientId, secret }; }
const b64 = value => btoa(String.fromCharCode(...value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
const random = () => b64(crypto.getRandomValues(new Uint8Array(32)));
function bytes(value) { if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid custody'); return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4)), char => char.charCodeAt(0)); }
function cookieValue(request, name) { const parts = (request.headers.get('cookie') || '').split(';').map(value => value.trim()).filter(value => value.startsWith(name + '=')); if (parts.length !== 1) return null; const value = parts[0].slice(name.length + 1); return TOKEN.test(value) ? value : null; }
const browserCookie = (value = '', seconds = 0) => `${BROWSER_COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${seconds}`;
function response(value, status = 200, cookies = []) { const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' }); for (const value of cookies) headers.append('Set-Cookie', value); return new Response(JSON.stringify(value), { status, headers }); }
function redirect(origin, outcome, cookies = []) { const headers = new Headers({ Location: `${origin}/?auth=${outcome}`, 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' }); for (const value of cookies) headers.append('Set-Cookie', value); return new Response(null, { status: 303, headers }); }
async function readJSON(response, maximum) { if (!response.ok || Number(response.headers.get('content-length')) > maximum || !response.body) throw new Error('Provider unavailable'); const reader = response.body.getReader(), chunks = []; let length = 0; try { while (true) { const value = await reader.read(); if (value.done) break; length += value.value.byteLength; if (length > maximum) throw new Error('Provider response limit'); chunks.push(value.value); } } finally { await reader.cancel().catch(() => { }); reader.releaseLock(); } const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; } const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid provider response'); return value; }
async function key(config) { const hash = await config.hash('github:verifier-encryption:v1'); return crypto.subtle.importKey('raw', Uint8Array.from(hash.match(/../g), part => parseInt(part, 16)), 'AES-GCM', false, ['encrypt', 'decrypt']); }
async function seal(config, value) { const iv = crypto.getRandomValues(new Uint8Array(12)), cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(config), encoder.encode(value))); return `${b64(iv)}.${b64(cipher)}`; }
async function unseal(config, value) { const [iv, cipher] = value.split('.'); return new TextDecoder('utf-8', { fatal: true }).decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(iv) }, await key(config), bytes(cipher))); }
export async function revokeGithubFlow(request, config) { const browser = cookieValue(request, BROWSER_COOKIE); if (browser) await authBatch(config.db, [config.db.prepare("DELETE FROM marker_auth_oauth_flows WHERE provider='github' AND browser_hash=?").bind(await config.hash(`github:browser:${browser}`))]); }

/** Each callback revalidates the token's current owner at the fixed API. No email,
 * login name, repository permission, access token or refresh token is retained. */
export async function handleGithubAuth(request, env, config, readBody) {
  const url = new URL(request.url), provider = githubConfiguration(env), now = Math.floor(Date.now() / 1000);
  if (url.pathname === START) {
    if (request.method !== 'POST') return response({ error: 'METHOD_NOT_ALLOWED' }, 405);
    if (url.origin !== config.origin || request.headers.get('Origin') !== config.origin || request.headers.get('X-Marker-Auth') !== '1' || request.headers.get('Sec-Fetch-Site') === 'cross-site') return response({ error: 'ORIGIN_NOT_ALLOWED' }, 403);
    if (!provider) return response({ error: 'GITHUB_NOT_CONFIGURED' }, 503);
    const data = await readBody(request);
    if (Object.keys(data).some(name => !['intent', 'captchaToken'].includes(name)) || !['link', 'login'].includes(data.intent)) return response({ error: 'INVALID_REQUEST' }, 400);
    if (!await verifyAuthCaptcha(request, env, data.captchaToken)) return response({ error: 'CAPTCHA_REQUIRED' }, 403);
    const bound = await boundProvider(config, ISSUER), sessionToken = cookieValue(request, SESSION_COOKIE), sessionHash = sessionToken ? await config.hash(`session:${sessionToken}`) : null;
    if (data.intent === 'link') {
      const principal = sessionHash ? await sessionPrincipal(config, sessionHash, now) : null;
      if (!principal || principal.auth_method !== 'email' || principal.authenticated_at > now || now - principal.authenticated_at >= 300) return response({ error: 'FRESH_EMAIL_PROOF_REQUIRED' }, 403);
    } else if (!bound) return response({ error: 'GITHUB_NOT_LINKED' }, 409);
    const ip = request.headers.get('CF-Connecting-IP'); if (!ip || ip.length > 45 || !/^[0-9a-f:.]+$/i.test(ip)) return response({ error: 'AUTH_UNAVAILABLE' }, 503);
    const state = random(), browser = random(), verifier = random(), stateHash = await config.hash(`github:state:${state}`), ipHash = await config.hash(`github:ip:${ip.toLowerCase()}`), hour = Math.floor(now / 3600) * 3600;
    const challenge = b64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(verifier))));
    const changes = await authBatch(config.db, [
      config.db.prepare('DELETE FROM marker_auth_oauth_flows WHERE expires_at<=?').bind(now),
      config.db.prepare(`INSERT INTO marker_auth_oauth_flows(state_hash,browser_hash,nonce_hash,sealed_verifier,intent,session_hash,owner_hash,client_id_hash,created_at,expires_at,provider)
        SELECT ?,?,?,?,?,?,?,?,?,?,'github' WHERE (SELECT COUNT(*) FROM marker_auth_oauth_flows)<100
        AND COALESCE((SELECT count FROM marker_auth_oauth_limits WHERE ip_hash=? AND window_start=?),0)<10`).bind(stateHash, await config.hash(`github:browser:${browser}`), await config.hash(`github:nonce-unused:${random()}`), await seal(config, verifier), data.intent, data.intent === 'link' ? sessionHash : null, config.ownerHashes[0], await config.hash(`github:client:${provider.clientId}`), now, now + 600, ipHash, hour),
      config.db.prepare(`INSERT INTO marker_auth_oauth_limits(ip_hash,window_start,count) SELECT ?,?,1 WHERE EXISTS(SELECT 1 FROM marker_auth_oauth_flows WHERE state_hash=?)
        ON CONFLICT(ip_hash) DO UPDATE SET window_start=excluded.window_start,count=CASE WHEN window_start=excluded.window_start THEN count+1 ELSE 1 END`).bind(ipHash, hour, stateHash),
    ]);
    if (changes[1].meta.changes !== 1) return response({ error: 'RATE_LIMITED' }, 429);
    const destination = new URL('https://github.com/login/oauth/authorize');
    for (const [name, value] of Object.entries({ client_id: provider.clientId, redirect_uri: config.origin + CALLBACK, state, code_challenge: challenge, code_challenge_method: 'S256', scope: '', allow_signup: 'false', prompt: 'select_account' })) destination.searchParams.set(name, value);
    return response({ url: destination.href }, 200, [browserCookie(browser, 600)]);
  }
  if (url.pathname !== CALLBACK) return response({ error: 'NOT_FOUND' }, 404);
  if (request.method !== 'GET') return response({ error: 'METHOD_NOT_ALLOWED' }, 405);
  if (url.origin !== config.origin || !provider) return redirect(config.origin, 'failed', [browserCookie()]);
  let stage = 'callback';
  try {
    if ([...url.searchParams.keys()].some(name => !['state', 'code', 'error', 'error_description', 'error_uri', 'iss'].includes(name)) || url.searchParams.getAll('state').length !== 1 || url.searchParams.getAll('code').length > 1 || url.searchParams.getAll('iss').length > 1 || url.searchParams.has('iss') && url.searchParams.get('iss') !== ISSUER) throw new Error('Invalid callback');
    stage = 'browser'; const state = url.searchParams.get('state'), browser = cookieValue(request, BROWSER_COOKIE); if (!TOKEN.test(state || '') || !browser) throw new Error('Invalid browser');
    stage = 'flow'; const [flow] = await authRows(config.db, `DELETE FROM marker_auth_oauth_flows WHERE provider='github' AND state_hash=? AND browser_hash=? AND expires_at>? RETURNING *`, await config.hash(`github:state:${state}`), await config.hash(`github:browser:${browser}`), now);
    if (!flow || flow.owner_hash !== config.ownerHashes[0] || flow.client_id_hash !== await config.hash(`github:client:${provider.clientId}`)) throw new Error('Invalid flow');
    stage = 'provider-denied'; const code = url.searchParams.get('code'); if (url.searchParams.has('error') || typeof code !== 'string' || !code || code.length > 4096 || /[\x00-\x20]/.test(code)) throw new Error('Provider denied');
    stage = 'verifier'; const verifier = await unseal(config, flow.sealed_verifier);
    stage = 'token-request'; const tokenResponse = await fetch('https://github.com/login/oauth/access_token', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: provider.clientId, client_secret: provider.secret, code, redirect_uri: config.origin + CALLBACK, code_verifier: verifier }), redirect: 'manual', signal: AbortSignal.timeout(10_000) });
    stage = 'token-response'; const token = await readJSON(tokenResponse, 32_000);
    if (token.error || token.token_type?.toLowerCase() !== 'bearer' || typeof token.access_token !== 'string' || !/^[A-Za-z0-9_-]{20,16384}$/.test(token.access_token)) throw new Error('Invalid token');
    stage = 'identity-request'; const profileResponse = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10', 'User-Agent': 'marKER-private-auth' }, redirect: 'manual', signal: AbortSignal.timeout(10_000) });
    stage = 'identity-response'; const profile = await readJSON(profileResponse, 64_000);
    if (!Number.isSafeInteger(profile.id) || profile.id <= 0 || profile.type !== 'User') throw new Error('Invalid identity');
    const subjectHash = await config.hash(`identity:${ISSUER}:${profile.id}`), operator = await retainedOperator(config.db, config.ownerHashes[0]), verifiedNow = Math.floor(Date.now() / 1000);
    stage = 'operator'; if (!operator) throw new Error('Operator unavailable');
    if (flow.intent === 'link') {
      stage = 'link'; const principal = flow.session_hash ? await sessionPrincipal(config, flow.session_hash, verifiedNow, false) : null;
      if (!principal || principal.auth_method !== 'email' || principal.authenticated_at > verifiedNow || verifiedNow - principal.authenticated_at >= 300) throw new Error('Fresh proof required');
      const existing = await boundProvider(config, ISSUER); if (existing && existing.subject_hash !== subjectHash) throw new Error('Identity already bound');
      const changes = await authBatch(config.db, [config.db.prepare(`INSERT OR IGNORE INTO marker_auth_identities(issuer,subject_hash,tenant_id,user_id,linked_at)
        SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM marker_auth_sessions s JOIN marker_auth_principals p ON p.session_hash=s.session_hash
        WHERE s.session_hash=? AND s.owner_hash=? AND s.expires_at>? AND s.last_seen>? AND p.auth_method='email' AND p.authenticated_at>? AND p.tenant_id=? AND p.user_id=?)`).bind(ISSUER, subjectHash, operator.tenant_id, operator.user_id, verifiedNow, flow.session_hash, operator.owner_hash, verifiedNow, verifiedNow - 1800, verifiedNow - 300, operator.tenant_id, operator.user_id)]);
      if (changes[0].meta.changes !== 1 && !(existing && existing.subject_hash === subjectHash)) throw new Error('Identity binding rejected');
      return redirect(config.origin, 'github-linked', [browserCookie()]);
    }
    stage = 'login'; const bound = await boundProvider(config, ISSUER); if (!bound || bound.subject_hash !== subjectHash) throw new Error('Identity not bound');
    const sessionToken = random(), sessionHash = await config.hash(`session:${sessionToken}`);
    const changes = await authBatch(config.db, [config.db.prepare(`INSERT INTO marker_auth_sessions(session_hash,owner_hash,created_at,expires_at,last_seen)
      SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM marker_auth_identities WHERE issuer=? AND subject_hash=? AND tenant_id=? AND user_id=?)`).bind(sessionHash, operator.owner_hash, verifiedNow, verifiedNow + 21600, verifiedNow, ISSUER, subjectHash, operator.tenant_id, operator.user_id),
    config.db.prepare(`INSERT INTO marker_auth_principals(session_hash,tenant_id,user_id,auth_method,authenticated_at)
        SELECT session_hash,?,?,'github',? FROM marker_auth_sessions WHERE session_hash=? AND owner_hash=?`).bind(operator.tenant_id, operator.user_id, verifiedNow, sessionHash, operator.owner_hash)]);
    if (changes[0].meta.changes !== 1 || changes[1].meta.changes !== 1) throw new Error('Session rejected');
    return redirect(config.origin, 'signed-in', [`${SESSION_COOKIE}=${sessionToken}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=21600`, browserCookie()]);
  } catch { console.warn('marker-github-auth-failed', stage); return redirect(config.origin, 'failed', [browserCookie()]); }
}
