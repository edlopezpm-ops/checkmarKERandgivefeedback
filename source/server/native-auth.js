// Adapted from owned aekr-web src/analytics-auth.js at 81436c2f81bde7f39e589c6166d9c28d20465685; namespaced for marKER.
import { reserveChallenge, reserveHelp, challengeOwner, consumeChallenge, touchSession, revokeAuth, purgeAuth } from './native-auth-store.js';
import { sessionPrincipal, boundGoogle, boundProvider, purgeTenantAuth } from './tenant-auth.js';
import { GOOGLE_AUTH_ROUTES, googleConfiguration, handleGoogleAuth, revokeGoogleFlow } from './google-auth.js';
import { GITHUB_AUTH_ROUTES, githubConfiguration, handleGithubAuth, revokeGithubFlow } from './github-auth.js';
import { verifyAuthCaptcha } from './captcha.js';

export const REQUEST_ROUTE = '/api/auth/request';
export const VERIFY_ROUTE = '/api/auth/verify';
export const LOGOUT_ROUTE = '/api/auth/logout';
export const HELP_ROUTE = '/api/auth/help';

const CHALLENGE_COOKIE = '__Host-marker_challenge';
const SESSION_COOKIE = '__Host-marker_session';
const encoder = new TextEncoder();
const EMAIL = /^[a-z0-9.!#$%&'*+\/=\?^_`{|}~-]{1,64}@[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?\.[a-z]{2,63}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const CODE_PATTERN = /^\d{8}$/;
const GENERIC = { ok: true, message: 'If the address is authorized, a code has been sent.' };
const HELP_GENERIC = { ok: true, message: 'If the address is authorized, access instructions have been requested.' };

function accessInstructions(language, origin) {
  const text = language === 'es' ? [
    'Ayuda de acceso a marKER',
    `1. Abre ${origin} y usa únicamente tu correo autorizado.`,
    '2. Selecciona Solicitar código. Recibirás un código de ocho dígitos.',
    '3. Escribe el código en el mismo navegador antes de cinco minutos y selecciona Entrar.',
    '4. Si el correo tarda, espera unos minutos y revisa spam o correo no deseado.',
    '5. Si caduca o ya fue utilizado, selecciona Usar otro correo o solicitar otro código. Espera al menos un minuto entre solicitudes; si aparece un límite de intentos, espera antes de reintentar.',
    '6. marKER no solicita contraseñas ni pagos para entrar. No compartas el código.',
    'Estas instrucciones no crean una sesión ni sustituyen el código de acceso.',
  ].join('\n\n') : [
    'marKER access help',
    `1. Open ${origin} and use only your authorized email.`,
    '2. Select Request code. You will receive an eight-digit code.',
    '3. Enter the code in the same browser within five minutes and select Sign in.',
    '4. If the email is delayed, wait a few minutes and check spam or junk mail.',
    '5. If it expires or was already used, select Use another email or request another code. Wait at least one minute between requests; if a rate limit appears, wait before trying again.',
    '6. marKER does not request passwords or payment to sign in. Do not share the code.',
    'These instructions do not create a session or replace the sign-in code.',
  ].join('\n\n');
  return { subject: language === 'es' ? 'marKER — ayuda de acceso' : 'marKER — access help', text,
    html: `<div lang="${language}">${text.split('\n\n').map(line => `<p>${line}</p>`).join('')}</div>` };
}

function response(value, status = 200, cookies = []) {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, private',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  if (status === 405) headers.set('Allow', 'POST');
  return new Response(JSON.stringify(value), { status, headers });
}
function cookie(name, value, seconds) {
  return `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${seconds}`;
}
function tokenCookie(request, name) {
  const matches = (request.headers.get('Cookie') || '').split(';').map(value => value.trim())
    .filter(value => value.startsWith(`${name}=`));
  if (matches.length !== 1) return null;
  const value = matches[0].slice(name.length + 1);
  return TOKEN_PATTERN.test(value) ? value : null;
}
function randomToken() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
function randomCode() {
  // Rejection sampling avoids modulo bias over the 100,000,000 possible PINs.
  const sample = new Uint32Array(1);
  do { crypto.getRandomValues(sample); } while (sample[0] >= 4200000000);
  return String(sample[0] % 100000000).padStart(8, '0');
}
async function configuration(env) {
  const secret = env.MARKER_AUTH_SECRET;
  const aliases = (env.MARKER_OWNER_EMAIL || '').split(',').map(value => value.trim().toLowerCase());
  const sender = env.MARKER_SENDER_EMAIL;
  // A configuration mistake must not turn a sibling or preview host into an auth origin.
  if (env.MARKER_ORIGIN !== 'https://marker.aekr.io' || typeof secret !== 'string' ||
      encoder.encode(secret).length < 32 || encoder.encode(secret).length > 512 || /[\r\n]/.test(secret) ||
      aliases.length !== 1 || aliases.some(value => !EMAIL.test(value) || value.length > 254) ||
      typeof sender !== 'string' || !EMAIL.test(sender.toLowerCase()) ||
      !env.EMAIL || typeof env.EMAIL.send !== 'function' || !env.DB?.batch || !env.DB?.prepare) return null;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const hash = async value => Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))))
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
  const ownerHashes = await Promise.all(aliases.map(value => hash(`email:${value}`)));
  return { aliases, ownerHashes, hash, sender, origin: env.MARKER_ORIGIN, db: env.DB };
}

async function body(request) {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('Content-Type') || '')) throw 400;
  const declared = request.headers.get('Content-Length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > 4096)) throw 413;
  const reader = request.body?.getReader();
  if (!reader) throw 400;
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(408), 3000); });
  try {
    return await Promise.race([timeout, (async () => {
      const chunks = []; let size = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 4096) throw 413;
        chunks.push(value);
      }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      let value;
      try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw 400; }
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw 400;
      return value;
    })()]);
  } finally {
    clearTimeout(timer);
    // A timed-out or oversized stream must not continue consuming request bytes.
    reader.cancel().catch(() => {});
  }
}

export async function authorizedOwner(request, env) {
  return Boolean(await ownerSession(request, env));
}

export async function ownerSession(request, env) {
  try {
    const config = await configuration(env);
    if (!config || new URL(request.url).origin !== config.origin) return null;
    const token = tokenCookie(request, SESSION_COOKIE);
    if (!token) return null;
    const principal = await sessionPrincipal(config, await config.hash(`session:${token}`), Math.floor(Date.now() / 1000));
    return principal ? { tenantId: principal.tenant_id, userId: principal.user_id, email: config.aliases[0], authenticatedAt: principal.authenticated_at, method: principal.auth_method } : null;
  } catch { return null; }
}

export async function describeOwnerAuth(request, env) {
  const config = await configuration(env), configured = Boolean(config && googleConfiguration(env));
  const principal = config ? await ownerSession(request, env) : null;
  let bound = false;
  try { bound = Boolean(config && await boundGoogle(config)); } catch { /* Missing migration fails closed. */ }
  const githubConfigured=Boolean(config&&githubConfiguration(env));let githubBound=false;
  try {githubBound=Boolean(config&&await boundProvider(config,'https://github.com'));}catch{/* Missing migration fails closed. */}
  const fresh = principal?.method === 'email' && Math.floor(Date.now() / 1000) - principal.authenticatedAt >= 0 && Math.floor(Date.now() / 1000) - principal.authenticatedAt < 300;
  return { authFlow: 'code', methods: { email: { configured: Boolean(config) }, google: { configured, bound, canLink: configured && Boolean(fresh), linkRequiresEmailVerification: !fresh }, github:{configured:githubConfigured,bound:githubBound,canLink:githubConfigured&&Boolean(fresh),linkRequiresEmailVerification:!fresh} }, ...(principal ? { principal } : {}) };
}

export async function handleOwnerAuth(request, env, ctx) {
  const path = new URL(request.url).pathname;
  if (GOOGLE_AUTH_ROUTES.includes(path)) {
    try { const config = await configuration(env); if (!config) return response({ error: 'AUTH_UNAVAILABLE' }, 503); return await handleGoogleAuth(request, env, config, body); }
    catch (error) { if ([400, 408, 413].includes(error)) return response({ error: error === 408 ? 'REQUEST_TIMEOUT' : 'INVALID_REQUEST' }, error); return response({ error: 'AUTH_UNAVAILABLE' }, 503); }
  }
  if (GITHUB_AUTH_ROUTES.includes(path)) {
    try { const config=await configuration(env);if(!config)return response({error:'AUTH_UNAVAILABLE'},503);return await handleGithubAuth(request,env,config,body); }
    catch(error){if([400,408,413].includes(error))return response({error:error===408?'REQUEST_TIMEOUT':'INVALID_REQUEST'},error);return response({error:'AUTH_UNAVAILABLE'},503);}
  }
  if (![REQUEST_ROUTE, VERIFY_ROUTE, LOGOUT_ROUTE, HELP_ROUTE].includes(path)) return response({ error: 'NOT_FOUND' }, 404);
  if (request.method !== 'POST') return response({ error: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    const config = await configuration(env);
    if (!config) return response({ error: 'AUTH_UNAVAILABLE' }, 503);
    if (new URL(request.url).origin !== config.origin || request.headers.get('Origin') !== config.origin ||
        request.headers.get('X-Marker-Auth') !== '1') return response({ error: 'ORIGIN_NOT_ALLOWED' }, 403);
    const value = await body(request);
    const captchaToken=value.captchaToken;delete value.captchaToken;
    const now = Math.floor(Date.now() / 1000);
    if (path === HELP_ROUTE) {
      if (Object.keys(value).length !== 2 || typeof value.email !== 'string' || value.email.length > 254 ||
          !EMAIL.test(value.email.trim().toLowerCase()) || !['en', 'es'].includes(value.language)) return response({ error: 'INVALID_REQUEST' }, 400);
      if(!await verifyAuthCaptcha(request,env,captchaToken))return response({error:'CAPTCHA_REQUIRED'},403);
      const address = request.headers.get('CF-Connecting-IP');
      if (!address || address.length > 45 || !/^[0-9a-f:.]+$/i.test(address)) return response({ error: 'AUTH_UNAVAILABLE' }, 503);
      const email = value.email.trim().toLowerCase(), known = config.aliases.includes(email);
      const reserved = await reserveHelp(config.db, {
        ticket: await config.hash(`help:ticket:${randomToken()}`), now, known,
        globalKey: await config.hash('help:limit:global'), dayKey: await config.hash('help:limit:day'),
        ipKey: await config.hash(`help:limit:ip:${address.toLowerCase()}`), ownerKey: await config.hash(known ? 'help:limit:owner' : 'help:limit:unknown'),
      });
      if (reserved === 'rate') return response({ error: 'RATE_LIMITED' }, 429);
      if (known && reserved === 'reserved') {
        await env.EMAIL.send({ to: email, from: { email: config.sender, name: 'marKER' }, replyTo: config.sender, ...accessInstructions(value.language, config.origin) });
      }
      return response(HELP_GENERIC, 202);
    }
    if (path === REQUEST_ROUTE) {
      if (typeof ctx?.waitUntil !== 'function') return response({ error: 'AUTH_UNAVAILABLE' }, 503);
      if (Object.keys(value).length !== 1 || typeof value.email !== 'string' || value.email.length > 254 ||
          !EMAIL.test(value.email.trim().toLowerCase())) return response({ error: 'INVALID_REQUEST' }, 400);
      if(!await verifyAuthCaptcha(request,env,captchaToken))return response({error:'CAPTCHA_REQUIRED'},403);
      const email = value.email.trim().toLowerCase();
      const address = request.headers.get('CF-Connecting-IP');
      if (!address || address.length > 45 || !/^[0-9a-f:.]+$/i.test(address)) return response({ error: 'AUTH_UNAVAILABLE' }, 503);
      const token = randomToken(), code = randomCode();
      const challengeHash = await config.hash(`challenge:${token}`);
      const ownerHash = await config.hash(`email:${email}`);
      const known = config.aliases.includes(email);
      const reserved = await reserveChallenge(config.db, {
        challengeHash, ownerHash, codeHash: await config.hash(`code:${challengeHash}:${ownerHash}:${code}`), now, known,
        globalKey: await config.hash('limit:global'), dayKey: await config.hash('limit:day'), ipKey: await config.hash(`limit:ip:${address.toLowerCase()}`),
        ownerKey: await config.hash(known ? 'limit:owner' : 'limit:unknown'),
      });
      if (reserved === 'rate') return response({ error: 'RATE_LIMITED' }, 429);
      if (reserved === 'created' && known) {
        // Delivery stays outside HTTP timing so provider latency cannot enumerate owner aliases.
        ctx.waitUntil(Promise.resolve().then(async () => {
          try {
            await env.EMAIL.send({ to: email, from: { email: config.sender, name: 'marKER' }, replyTo: config.sender, subject: 'marKER sign-in code',
              text: `Your marKER sign-in code is ${code}. It expires in five minutes. If you did not request it, ignore this message.` });
          } catch {
            console.error('marker-auth: delivery failed');
            await revokeAuth(config.db, null, challengeHash);
          }
        }).catch(() => { console.error('marker-auth: challenge invalidation unavailable'); }));
      }
      // A resend inside the cooldown must preserve the browser binding of the PIN already sent.
      const responseToken = reserved === 'created' ? token : tokenCookie(request, CHALLENGE_COOKIE) || token;
      return response(GENERIC, 202, [cookie(CHALLENGE_COOKIE, responseToken, 300)]);
    }
    if (path === VERIFY_ROUTE) {
      if (Object.keys(value).length !== 1 || typeof value.code !== 'string' || !CODE_PATTERN.test(value.code)) return response({ error: 'INVALID_REQUEST' }, 400);
      if(!await verifyAuthCaptcha(request,env,captchaToken))return response({error:'CAPTCHA_REQUIRED'},403);
      const token = tokenCookie(request, CHALLENGE_COOKIE);
      if (!token) return response({ error: 'INVALID_CODE' }, 401, [cookie(CHALLENGE_COOKIE, '', 0)]);
      const challengeHash = await config.hash(`challenge:${token}`);
      const ownerHash = await challengeOwner(config.db, challengeHash);
      if (!ownerHash) return response({ error: 'INVALID_CODE' }, 401, [cookie(CHALLENGE_COOKIE, '', 0)]);
      const sessionToken = randomToken();
      const result = await consumeChallenge(config.db, {
        challengeHash, codeHash: await config.hash(`code:${challengeHash}:${ownerHash}:${value.code}`),
        sessionHash: await config.hash(`session:${sessionToken}`), ownerHashes: config.ownerHashes, now,
      });
      if (!result.accepted) return response({ error: 'INVALID_CODE' }, 401, result.usable ? [] : [cookie(CHALLENGE_COOKIE, '', 0)]);
      if (!await sessionPrincipal(config, await config.hash(`session:${sessionToken}`), now, false)) return response({ error: 'AUTH_UNAVAILABLE' }, 503);
      return response({ ok: true }, 200, [cookie(SESSION_COOKIE, sessionToken, 21600), cookie(CHALLENGE_COOKIE, '', 0)]);
    }
    if (Object.keys(value).length) return response({ error: 'INVALID_REQUEST' }, 400);
    const session = tokenCookie(request, SESSION_COOKIE), challenge = tokenCookie(request, CHALLENGE_COOKIE);
    await revokeAuth(config.db, session ? await config.hash(`session:${session}`) : null, challenge ? await config.hash(`challenge:${challenge}`) : null);
    await revokeGoogleFlow(request, config);
    await revokeGithubFlow(request,config);
    return response({ ok: true }, 200, [cookie(SESSION_COOKIE, '', 0), cookie(CHALLENGE_COOKIE, '', 0), '__Host-marker_oauth=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0','__Host-marker_github_oauth=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0']);
  } catch (error) {
    if ([400, 408, 413].includes(error)) return response({ error: error === 408 ? 'REQUEST_TIMEOUT' : 'INVALID_REQUEST' }, error);
    return response({ error: 'AUTH_UNAVAILABLE' }, 503);
  }
}

export async function purgeOwnerAuth(env) {
  if (!env.DB) throw new Error('Owner authentication unavailable');
  const now = Math.floor(Date.now() / 1000);
  await purgeAuth(env.DB, now);
  return purgeTenantAuth(env.DB, now);
}
