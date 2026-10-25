const ACTIONS = new Map([
  ['/api/auth/request', 'auth_email_request'],
  ['/api/auth/verify', 'auth_email_verify'],
  ['/api/auth/help', 'auth_help'],
  ['/api/auth/google/start', 'auth_google'],
  ['/api/auth/github/start', 'auth_github'],
]);

export function authCaptchaConfiguration(env) {
  const required = ['TURNSTILE_SITE_KEY','TURNSTILE_SECRET','TURNSTILE_HOSTNAMES','TURNSTILE_REQUIRED'].some(key => env[key] !== undefined);
  const sitekey = typeof env.TURNSTILE_SITE_KEY === 'string' && /^[A-Za-z0-9_-]{16,256}$/.test(env.TURNSTILE_SITE_KEY) ? env.TURNSTILE_SITE_KEY : null;
  return { required, sitekey };
}

async function boundedJSON(response) {
  if (!response.ok || !response.body || Number(response.headers.get('content-length')) > 8192) throw new Error('Verification unavailable');
  const reader=response.body.getReader(), chunks=[]; let length=0;
  try {
    while (true) { const {done,value}=await reader.read(); if(done)break; length+=value.byteLength; if(length>8192)throw new Error('Verification unavailable'); chunks.push(value); }
  } finally { await reader.cancel().catch(()=>{}); reader.releaseLock(); }
  const buffer=new Uint8Array(length);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.byteLength;}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer));
}

async function consumeCaptchaProof(env,token) {
  const encoder=new TextEncoder(),secret=env.MARKER_AUTH_SECRET;
  if(typeof secret!=='string'||encoder.encode(secret).length<32||encoder.encode(secret).length>512||/[\r\n]/.test(secret)||typeof env.DB?.prepare!=='function'||typeof env.DB?.batch!=='function')return false;
  const signingKey=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const digest=async purpose=>Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',signingKey,encoder.encode(purpose+token)))).map(value=>value.toString(16).padStart(2,'0')).join('');
  const now=Math.floor(Date.now()/1000),day=Math.floor(now/86400)*86400,window=Math.floor((now+300)/86400)*86400;
  // Retain a proof crossing midnight through the native auth cleanup window.
  // Cleanup and the guarded INSERT share one transaction, including failure.
  const results=await env.DB.batch([
    env.DB.prepare('DELETE FROM marker_auth_limits WHERE window_start < ?').bind(day),
    env.DB.prepare(`INSERT OR IGNORE INTO marker_auth_limits(key,window_start,count,last_at,ticket)
    SELECT ?,?,1,?,? WHERE (SELECT COUNT(*) FROM marker_auth_limits)<1000`).bind(await digest('captcha:used:'),window,now,await digest('captcha:receipt:'))]);
  return results.length===2&&results.every(result=>result.success!==false)&&Number(results[1].meta?.changes)===1;
}

/** Gate the existing auth handler. Only keyed one-use proof digests are retained. */
export async function verifyAuthCaptcha(request, env, token) {
  const config=authCaptchaConfiguration(env);
  if (!config.required) return true;
  const action=ACTIONS.get(new URL(request.url).pathname);
  const hostnames=typeof env.TURNSTILE_HOSTNAMES==='string' ? env.TURNSTILE_HOSTNAMES.split(',').map(value=>value.trim()).filter(Boolean) : [];
  if (!config.sitekey || env.TURNSTILE_REQUIRED!==undefined && env.TURNSTILE_REQUIRED!=='1' || typeof env.TURNSTILE_SECRET!=='string' || !/^\S{16,2048}$/.test(env.TURNSTILE_SECRET) ||
      env.MARKER_ORIGIN!=='https://marker.aekr.io' || new URL(request.url).origin!==env.MARKER_ORIGIN ||
      hostnames.length!==1 || hostnames[0]!=='marker.aekr.io' || !action ||
      typeof token!=='string' || !token || token.length>2048) return false;
  const form=new URLSearchParams({secret:env.TURNSTILE_SECRET,response:token});
  const ip=request.headers.get('CF-Connecting-IP');if(ip && ip.length<=45 && /^[0-9a-f:.]+$/i.test(ip))form.set('remoteip',ip);
  try {
    const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
      method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form,
      redirect:'manual',signal:AbortSignal.timeout(10000),
    });
    const result=await boundedJSON(response);
    if(result?.success!==true || result.action!==action || result.hostname!=='marker.aekr.io')return false;
    return await consumeCaptchaProof(env,token);
  } catch { return false; }
}
