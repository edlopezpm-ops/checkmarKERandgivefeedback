import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { createLocalMcpApi } from '../server/mcp-local.ts';

test('native consent forms retain same-origin validation without leaking cross-origin referrers', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'marker-consent-policy-'));
  const api = createLocalMcpApi({ directory, async backend() { throw new Error('Consent must not reach product data'); } });
  t.after(async () => {
    api.close();
    assert.ok(resolve(directory).startsWith(resolve(join(tmpdir(), 'marker-consent-policy-'))));
    await rm(directory, { recursive: true, force: true });
  });
  const origin = 'http://127.0.0.1:5191', callback = 'https://assistant.example.invalid/callback';
  const registered = await api.handle(new Request(origin + '/api/mcp/oauth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_name: 'Synthetic consent test', redirect_uris: [callback], token_endpoint_auth_method: 'none' }),
  }));
  assert.equal(registered.status, 201);
  assert.equal(registered.headers.get('Referrer-Policy'), 'no-referrer');
  for (const unsafeCallback of [
    'https://*.example.invalid/callback', 'https://semi;colon.example.invalid/callback',
    "https://quote'host.example.invalid/callback", 'https://quote"host.example.invalid/callback',
    'https://space host.example.invalid/callback',
  ]) {
    const rejected = await api.handle(new Request(origin + '/api/mcp/oauth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ redirect_uris: [unsafeCallback] }),
    }));
    assert.equal(rejected.status, 400);
    assert.equal((await rejected.json()).error, 'invalid_redirect_uri');
  }
  const client = await registered.json(), verifier = 'v'.repeat(43);
  const consent = await api.handle(new Request(origin + '/api/mcp/oauth/authorize?' + new URLSearchParams({
    client_id: client.client_id, redirect_uri: callback, response_type: 'code',
    code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    resource: origin + '/api/mcp', scope: 'marker:read', state: 'synthetic-state',
  })));
  assert.equal(consent.status, 200);
  // no-referrer makes browsers send Origin:null for native non-CORS form POSTs.
  // same-origin preserves the CSRF header and suppresses cross-origin referrers.
  assert.equal(consent.headers.get('Referrer-Policy'), 'same-origin');
  const policy = consent.headers.get('Content-Security-Policy');
  assert.equal(policy.split(';').map(value => value.trim()).find(value => value.startsWith('form-action ')), "form-action 'self' https://assistant.example.invalid");
  assert.ok(policy.includes("frame-ancestors 'none'")); assert.ok(policy.includes("base-uri 'none'"));
  assert.equal(consent.headers.get('X-Frame-Options'), 'DENY');
  const html = await consent.text();
  assert.match(html, /<form method="post" action="\/api\/mcp\/oauth\/authorize">/);
  const nonce = /name="request" value="([A-Za-z0-9_-]+)"/.exec(html)?.[1]; assert.ok(nonce);
  async function submit(requestOrigin) {
    return api.handle(new Request(origin + '/api/mcp/oauth/authorize', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(requestOrigin === undefined ? {} : { Origin: requestOrigin }) },
      body: new URLSearchParams({ request: nonce, decision: 'allow' }),
    }));
  }
  for (const invalidOrigin of [undefined, 'null', 'https://foreign.example.invalid']) {
    const rejected = await submit(invalidOrigin); assert.equal(rejected.status, 403);
  }
  const allowed = await submit(origin); assert.equal(allowed.status, 303);
  assert.equal(allowed.headers.get('Referrer-Policy'), 'no-referrer');
  const redirect = new URL(allowed.headers.get('Location'));
  const exchanged = await api.handle(new Request(origin + '/api/mcp/oauth/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', client_id: client.client_id, redirect_uri: callback,
      code: redirect.searchParams.get('code'), code_verifier: verifier, resource: origin + '/api/mcp' }),
  }));
  assert.equal(exchanged.status, 200);
  assert.equal(exchanged.headers.get('Referrer-Policy'), 'no-referrer');
  assert.equal((await submit(origin)).status, 403, 'Consent remains single-use');
  const errorPage = await api.handle(new Request(origin + '/api/mcp/oauth/resume?request=invalid'));
  assert.equal(errorPage.status, 400);
  assert.match(errorPage.headers.get('Content-Security-Policy'), /form-action 'self';/);

  const ipv6Callback = 'http://[::1]:5678/callback';
  const ipv6Registered = await api.handle(new Request(origin + '/api/mcp/oauth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ redirect_uris: [ipv6Callback] }),
  }));
  assert.equal(ipv6Registered.status, 201);
  const ipv6Client = await ipv6Registered.json();
  const ipv6Consent = await api.handle(new Request(origin + '/api/mcp/oauth/authorize?' + new URLSearchParams({
    client_id: ipv6Client.client_id, redirect_uri: ipv6Callback, response_type: 'code',
    code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    resource: origin + '/api/mcp', scope: 'marker:read',
  })));
  assert.equal(ipv6Consent.status, 200);
  assert.match(ipv6Consent.headers.get('Content-Security-Policy'), /form-action 'self';/);
  assert.ok(!ipv6Consent.headers.get('Content-Security-Policy').includes('[::1]'));
});
