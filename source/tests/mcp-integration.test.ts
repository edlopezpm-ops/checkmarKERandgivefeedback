import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createLocalMcpApi } from '../server/mcp-local.ts';
import { LocalRepository } from '../server/local.ts';
import { editorialApi } from '../server/api.ts';
import { createStudioApi } from '../server/studio-local.ts';

const ORIGIN = 'http://127.0.0.1:5191';
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'marker-mcp-sdk-'));
  const repository = new LocalRepository(join(directory, 'workspace.json'));
  const studio = createStudioApi({ directory: join(directory, 'studio'), tools: { ffmpeg: '', ffprobe: '' } });
  let calls = 0, faults = false;
  async function backend(request) {
    calls++;
    const response = await studio.handle(request, await repository.read()) ?? await editorialApi(request, repository);
    if (faults && request.method === 'POST') throw new Error('Synthetic lost commit response');
    return response;
  }
  const mcp = createLocalMcpApi({ directory: join(directory, 'authorization'), backend });
  async function call(path, data, headers = {}, method = data === undefined ? 'GET' : 'POST') {
    const result = await mcp.handle(new Request(ORIGIN + path, { method, headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) }));
    assert.ok(result); return result;
  }
  async function grant(scope = 'marker:read marker:write marker:produce marker:delete') {
    const app = await (await call('/api/mcp/oauth/register', { client_name: 'Synthetic SDK assistant', redirect_uris: ['https://assistant.example.invalid/callback'], token_endpoint_auth_method: 'none' })).json();
    assert.ok(app.client_id);
    const verifier = 'v'.repeat(43), challenge = createHash('sha256').update(verifier).digest('base64url');
    const page = await call('/api/mcp/oauth/authorize?' + new URLSearchParams({ client_id: app.client_id, redirect_uri: app.redirect_uris[0], response_type: 'code', code_challenge_method: 'S256', code_challenge: challenge, resource: ORIGIN + '/api/mcp', scope, state: 'test-state' }));
    const nonce = /name="request" value="([A-Za-z0-9_-]+)"/.exec(await page.text())?.[1]; assert.ok(nonce);
    async function form(path, data) { return mcp.handle(new Request(ORIGIN + path, { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data) })); }
    const approved = await form('/api/mcp/oauth/authorize', { request: nonce, decision: 'allow' }); assert.equal(approved.status, 303);
    const code = new URL(approved.headers.get('Location')).searchParams.get('code');
    const token = await form('/api/mcp/oauth/token', { client_id: app.client_id, redirect_uri: app.redirect_uris[0], grant_type: 'authorization_code', code, code_verifier: verifier, resource: ORIGIN + '/api/mcp' });
    assert.equal(token.status, 200, await token.clone().text()); return token.json();
  }
  async function client(accessToken) {
    const client = new Client({ name: 'marker-sdk-test', version: '1' });
    const transport = new StreamableHTTPClientTransport(new URL(ORIGIN + '/api/mcp'), { requestInit: { headers: { Authorization: 'Bearer ' + accessToken } }, fetch: async (url, init) => {
      const result = await mcp.handle(new Request(url, init)); assert.ok(result); return result;
    } });
    await client.connect(transport); t.after(() => client.close()); return client;
  }
  t.after(async () => { await studio.close(); mcp.close(); assert.ok(resolve(directory).startsWith(resolve(join(tmpdir(), 'marker-mcp-sdk-')))); await rm(directory, { recursive: true, force: true }); });
  return { mcp, repository, studio, call, grant, client, backend, get calls() { return calls; }, fault(value) { faults = value; } };
}
const args = (revision, suffix) => ({ expected_revision: revision, request_id: 'request_' + suffix });
function data(result) { assert.equal(result.isError, undefined, JSON.stringify(result)); return result.structuredContent; }

test('official SDK negotiates Streamable HTTP and persists real tools; duplicate requests never duplicate products', async t => {
  const f = await fixture(t), grant = await f.grant(), client = await f.client(grant.access_token);
  const tools = await client.listTools(); assert.equal(tools.tools.length, 15); assert.ok(!tools.tools.some(tool => /approve|publish|account_delete/.test(tool.name)));
  assert.equal(tools.tools.find(tool => tool.name === 'marker_get_profile')._meta['openai/profile'], true);
  const create = { ...args(0, 'create_product'), name: 'Demo MCP cuaderno', description: 'Guarda una idea cada día.', cta: 'Guarda tu idea' };
  const first = await client.callTool({ name: 'marker_save_product', arguments: create }); const product = data(first).record;
  assert.deepEqual(await client.callTool({ name: 'marker_save_product', arguments: create }), first);
  assert.equal((await f.repository.read()).products.length, 1);
  const conflict = await client.callTool({ name: 'marker_save_product', arguments: { ...create, name: 'Changed payload' } }); assert.equal(conflict.structuredContent.code, 'REQUEST_ID_CONFLICT');
  const campaign = data(await client.callTool({ name: 'marker_save_campaign', arguments: { ...args(0, 'campaign'), product_id: product.id, title: 'Demo campaign' } })).record;
  const plan = data(await client.callTool({ name: 'marker_prepare_plan', arguments: { request: { campaignId: campaign.id, candidateIds: [], includeShared: false, platform: 'LinkedIn', template: 'text', duration: 20, allowReuse: false, muteBackground: false, audio: 'mute' } } }));
  const saved = data(await client.callTool({ name: 'marker_save_plan', arguments: { ...args(1, 'save_plan'), request: plan.request, fingerprint: plan.fingerprint, alternative: 0 } }));
  const variant = saved.record; assert.equal(variant.body, create.description);
  const rejected = await client.callTool({ name: 'marker_export', arguments: { ...args(saved.revision, 'early_export'), id: variant.id, recipe_revision: variant.recipeRevision } }); assert.equal(rejected.structuredContent.status, 409);
  // Human review is a separate first-party action; the MCP client has no tool to approve.
  const reviewed = await f.backend(new Request(`${ORIGIN}/api/studio/variants/${variant.id}/approve`, { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ recipeRevision: variant.recipeRevision, confirmed: true }) })); assert.equal(reviewed.status, 200);
  const state = (await (await f.backend(new Request(ORIGIN + '/api/studio'))).json()).state;
  const exported = data(await client.callTool({ name: 'marker_export', arguments: { ...args(state.revision, 'export'), id: variant.id, recipe_revision: variant.recipeRevision } })); assert.ok(exported.text.includes(create.description));
  const privateUrl = `/api/mcp/artifacts/${variant.id}?recipe_revision=${variant.recipeRevision}`;
  assert.equal(await (await f.call(privateUrl, undefined, { Authorization: 'Bearer ' + grant.access_token })).text(), exported.text);
  assert.equal((await f.call(`/api/mcp/artifacts/${variant.id}?recipe_revision=999`, undefined, { Authorization: 'Bearer ' + grant.access_token })).status, 409);
});

test('transport rejects missing/invalid identity, cross-origin and caller-selected tenant before product effects', async t => {
  const f = await fixture(t);
  const denied = await f.call('/api/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/list' }); assert.equal(denied.status, 401); assert.match(denied.headers.get('WWW-Authenticate'), /oauth-protected-resource/);
  const grant = await f.grant('marker:read'); const client = await f.client(grant.access_token);
  assert.ok((await client.listTools()).tools.every(tool => tool.annotations.readOnlyHint));
  const before = f.calls;
  const write = await client.callTool({ name: 'marker_save_product', arguments: { ...args(0, 'forbidden'), name: 'Forbidden' } }); assert.equal(write.structuredContent.status, 403);
  for (const headers of [{ Authorization: 'Bearer ' + grant.access_token, Origin: 'https://evil.example.invalid' }, { Authorization: 'Bearer ' + grant.access_token, 'X-Tenant-ID': 'foreign' }]) assert.equal((await f.call('/api/mcp', {}, headers)).status, 403);
  assert.equal(f.calls, before); assert.equal((await f.repository.read()).products.length, 0);
});

test('concurrent identical writes admit once and uncertain committed effects never automatically run again', async t => {
  const f = await fixture(t), grant = await f.grant(), client = await f.client(grant.access_token);
  const create = { ...args(0, 'concurrent'), name: 'Concurrent' };
  const results = await Promise.all([client.callTool({ name: 'marker_save_product', arguments: create }), client.callTool({ name: 'marker_save_product', arguments: create })]);
  assert.ok(results.some(result => !result.isError)); assert.equal((await f.repository.read()).products.length, 1);
  f.fault(true);
  const lost = { ...args(1, 'uncertain'), name: 'Committed before reply failed' };
  const result = await client.callTool({ name: 'marker_save_product', arguments: lost }); assert.equal(result.structuredContent.status, 503);
  assert.equal((await f.repository.read()).products.length, 2); f.fault(false);
  const before = f.calls;
  const replay = await client.callTool({ name: 'marker_save_product', arguments: lost }); assert.equal(replay.structuredContent.code, 'EFFECT_UNCERTAIN'); assert.equal(f.calls, before);
});

test('owner revocation invalidates established SDK connections and local authorization persists across factories', async t => {
  const f = await fixture(t), grant = await f.grant(), client = await f.client(grant.access_token);
  const identity = data(await client.callTool({ name: 'marker_get_profile', arguments: {} })); assert.equal(identity.id.length, 32); assert.deepEqual(Object.keys(identity), ['id']);
  const connections = await (await f.call('/api/mcp/connections')).json(); assert.equal(connections.connections.length, 1);
  const revoked = await f.call('/api/mcp/connections', { grantId: connections.connections[0].id }, { Origin: ORIGIN, 'X-Marker-MCP': '1' }); assert.equal(revoked.status, 200);
  const response = await f.call('/api/mcp', {}, { Authorization: 'Bearer ' + grant.access_token }); assert.equal(response.status, 401);
  const replacement = await f.grant(), reconnected = await f.client(replacement.access_token);
  assert.deepEqual(data(await reconnected.callTool({ name: 'marker_get_profile', arguments: {} })), identity);
});
