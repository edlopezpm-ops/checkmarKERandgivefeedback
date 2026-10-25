import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createMcpTools, MCP_TOOLS, type McpPrincipal } from "../server/mcp-tools.ts";
import { editorialApi, json } from "../server/api.ts";
import { LocalRepository } from "../server/local.ts";
import { createStudioApi } from "../server/studio-local.ts";
import { emptyStudio } from "../src/core/studio.ts";

const origin = "http://127.0.0.1:5199";
const principal: McpPrincipal = { userId: "synthetic-user", tenantId: "synthetic-tenant", clientId: "synthetic-client", grantId: "synthetic-grant", scopes: ["marker:read", "marker:write", "marker:produce", "marker:delete"] };
let requestSequence = 0;
const mutation = (revision: number) => ({ expected_revision: revision, request_id: `synthetic-${++requestSequence}` });

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "marker-mcp-tools-"));
  const repository = new LocalRepository(join(directory, "workspace.json"));
  const api = createStudioApi({ directory: join(directory, "studio"), tools: { ffmpeg: resolve(directory, "no-ffmpeg"), ffprobe: resolve(directory, "no-ffprobe") } });
  const calls: Array<{ path: string; method: string }> = [];
  async function backend(request: Request) {
    calls.push({ path: new URL(request.url).pathname, method: request.method });
    return await api.handle(request, await repository.read()) ?? editorialApi(request, repository);
  }
  async function human(path: string, body?: object) {
    return backend(new Request(origin + "/api/studio" + path, { method: body ? "POST" : "GET", headers: { Origin: origin, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }));
  }
  t.after(async () => { await api.close(); assert.ok(resolve(directory).startsWith(resolve(join(tmpdir(), "marker-mcp-tools-")))); await rm(directory, { recursive: true, force: true }); });
  return { tools: createMcpTools({ origin, backend, principal }), repository, api, calls, backend, human, async state() { return (await (await human("")).json()).state; } };
}

test("finite descriptors require bounded closed schemas and declare the business effects", () => {
  assert.equal(MCP_TOOLS.length, 15);
  assert.equal(new Set(MCP_TOOLS.map(tool => tool.name)).size, MCP_TOOLS.length);
  for (const descriptor of MCP_TOOLS) {
    assert.match(descriptor.name, /^marker_[a-z_]+$/);
    assert.ok(descriptor.description.length > 80);
    assert.equal(descriptor.inputSchema.additionalProperties, false);
    assert.equal(descriptor.annotations.openWorldHint, false);
    assert.equal(descriptor.scopes.length, 1);
    if (!descriptor.annotations.readOnlyHint) assert.deepEqual(descriptor.inputSchema.required?.slice(0, 2), ["expected_revision", "request_id"]);
  }
  assert.ok(!MCP_TOOLS.some(tool => /approve|publish|account|execute|command|fetch/.test(tool.name)));
  const planner = MCP_TOOLS.find(tool => tool.name === "marker_prepare_plan")!;
  assert.equal(planner.inputSchema.properties?.request.additionalProperties, false);
});

test("real local repository and SQLite: create → literal library plan → save → human approval → TXT export", async t => {
  let networkCalls = 0;
  t.mock.method(globalThis, "fetch", async () => { networkCalls++; throw new Error("Network/provider calls are forbidden in this synthetic fixture"); });
  const f = await fixture(t);
  const savedProduct = await f.tools.call("marker_save_product", { ...mutation(0), name: "Demo cuaderno", description: "Descripción literal.", cta: "Guarda tu idea", language: "es" });
  assert.equal(savedProduct.isError, undefined);
  assert.equal(savedProduct.structuredContent.revision, 1);
  const productId = (savedProduct.structuredContent.record as any).id;
  assert.equal((savedProduct.structuredContent.record as any).status, "preparation");
  const campaign = await f.tools.call("marker_save_campaign", { ...mutation(0), product_id: productId, title: "Demo campaign" });
  assert.equal(campaign.isError, undefined);
  const campaignId = (campaign.structuredContent.record as any).id;
  const literal = "  Un texto escrito por la persona.\nSegunda línea intacta.  ";
  const text = await f.tools.call("marker_save_material", { ...mutation(1), kind: "text", title: "Demo text", text: literal, product_ids: [productId], rights: "owned", review: "ready" });
  assert.equal(text.isError, undefined);
  const textId = (text.structuredContent.record as any).id;
  assert.equal((text.structuredContent.record as any).text, literal);
  const idea = await f.tools.call("marker_save_material", { ...mutation(2), kind: "idea", title: "Idea sin revisar" });
  assert.equal((idea.structuredContent.record as any).rights, "unknown");
  assert.equal((idea.structuredContent.record as any).review, "unreviewed");
  const classified = await f.tools.call("marker_classify_materials", { ...mutation(3), ids: [textId] });
  assert.equal(classified.isError, undefined);
  assert.equal(classified.structuredContent.revision, 3, "classification no-op preserves native revision semantics");
  const search = await f.tools.call("marker_search", { collection: "materials", query: "Demo text", product_id: productId, limit: 1 });
  assert.equal((search.structuredContent.items as any[]).length, 1);
  assert.equal((search.structuredContent.items as any[])[0].text, undefined, "search yields summaries, not all source bodies");
  const read = await f.tools.call("marker_get_material", { id: textId });
  assert.equal((read.structuredContent.material as any).text, literal);
  const request = { campaignId, candidateIds: [textId], includeShared: false, platform: "LinkedIn", template: "text", duration: 20, allowReuse: false, muteBackground: false, audio: "mute" };
  const before = await f.state();
  const prepared = await f.tools.call("marker_prepare_plan", { request });
  assert.equal(prepared.isError, undefined, JSON.stringify(prepared));
  assert.deepEqual(await f.state(), before, "preparation and proposal are read-only");
  const preparedRequest = prepared.structuredContent.request as any;
  assert.equal(preparedRequest.body, literal);
  assert.equal(preparedRequest.textSourceId, textId);
  assert.equal(preparedRequest.hook, "Demo cuaderno");
  const stale = await f.tools.call("marker_save_plan", { ...mutation(3), request: preparedRequest, fingerprint: "0".repeat(64), alternative: 0 });
  assert.equal(stale.structuredContent.status, 409);
  assert.equal(stale.structuredContent.code, "plan_conflict");
  const saved = await f.tools.call("marker_save_plan", { ...mutation(3), request: preparedRequest, fingerprint: prepared.structuredContent.fingerprint, alternative: 0 });
  assert.equal(saved.isError, undefined, JSON.stringify(saved));
  const variant = saved.structuredContent.record as any;
  assert.equal(variant.status, "draft");
  assert.equal(variant.planner.inputFingerprint, prepared.structuredContent.fingerprint);
  assert.equal(variant.sourceRefs[0].materialId, textId);
  assert.equal((await f.state()).variants[0].sourceSnapshots[0].text, literal);
  const beforeApproval = await f.tools.call("marker_export", { ...mutation(4), id: variant.id, recipe_revision: 1 });
  assert.equal(beforeApproval.structuredContent.status, 409);
  assert.equal(f.calls.some(call => call.path.endsWith("/approve")), false, "tools cannot approve a campaign");
  const approval = await f.human(`/variants/${variant.id}/approve`, { recipeRevision: 1, confirmed: true });
  assert.equal(approval.status, 200);
  const approved = await approval.json();
  const exported = await f.tools.call("marker_export", { ...mutation(5), id: variant.id, recipe_revision: 1 });
  assert.equal(exported.isError, undefined);
  assert.ok(String(exported.structuredContent.text).includes(literal));
  const job = await f.tools.call("marker_get_job", { id: approved.job.id });
  assert.equal((job.structuredContent.job as any).status, "completed");
  assert.equal((job.structuredContent.receipt as any).recipe.body, literal);
  const edited = await f.tools.call("marker_edit_variant", { ...mutation(5), id: variant.id, recipe_revision: 1, cta: "Otro cierre" });
  assert.equal(edited.isError, undefined);
  assert.equal((edited.structuredContent.record as any).status, "draft");
  assert.equal((edited.structuredContent.record as any).recipeRevision, 2);
  assert.deepEqual((edited.structuredContent.record as any).planner, variant.planner, "native provenance is preserved");
  assert.equal((await f.tools.call("marker_export", { ...mutation(6), id: variant.id, recipe_revision: 2 })).structuredContent.status, 409);
  assert.equal((await f.tools.call("marker_edit_variant", { ...mutation(6), id: variant.id, recipe_revision: 1, body: "stale" })).structuredContent.status, 409);
  const linkedDelete = await f.tools.call("marker_delete", { ...mutation(1), resource: "product", id: productId, confirmation_id: productId });
  assert.equal(linkedDelete.structuredContent.status, 409);
  const campaignRead = await f.tools.call("marker_get_campaign", { id: campaignId });
  assert.equal((campaignRead.structuredContent.variants as any[]).length, 1);
  assert.equal((await f.tools.call("marker_delete", { ...mutation(6), resource: "variant", id: variant.id, confirmation_id: variant.id })).isError, undefined);
  const historyProtected = await f.tools.call("marker_delete", { ...mutation(7), resource: "material", id: textId, confirmation_id: textId });
  assert.equal(historyProtected.structuredContent.status, 409);
  assert.equal(historyProtected.structuredContent.code, "material_historical_use");
  assert.equal(networkCalls, 0);
  assert.equal(f.calls.some(call => /agents|auth|settings|uploads|analyses/.test(call.path)), false);
});

test("input and grant rejection precede backend effects; no path, tenant, approval or provenance injection", async () => {
  let effects = 0;
  const backend = async () => { effects++; return json({}); };
  const readOnly = createMcpTools({ origin, backend, principal: { ...principal, scopes: ["marker:read"] } });
  assert.equal((await readOnly.call("marker_save_product", { ...mutation(0), name: "No permission" })).structuredContent.status, 403);
  const tools = createMcpTools({ origin, backend, principal });
  for (const [name, args] of [
    ["marker_get_material", { id: "../auth" }],
    ["marker_search", { collection: "materials", limit: 51 }],
    ["marker_get_profile", { tenant_id: "another-tenant" }],
    ["marker_save_material", { ...mutation(0), generation: { kind: "agent" } }],
    ["marker_save_material", { ...mutation(0), origin: { kind: "legacy-source" } }],
    ["marker_edit_variant", { ...mutation(0), id: "v", recipe_revision: 1, status: "approved" }],
    ["marker_save_plan", { ...mutation(0), request: { campaignId: "c", includeShared: false, platform: "X", template: "text", duration: 20, allowReuse: false, muteBackground: false, audio: "mute", planner: {} }, fingerprint: "a".repeat(64), alternative: 0 }],
    ["marker_delete", { ...mutation(0), resource: "account", id: "a", confirmation_id: "a" }],
    ["marker_get_job", { id: "job", path: "/api/auth" }],
  ] as const) assert.equal((await tools.call(name, args)).structuredContent.status, 400, name);
  assert.equal((await tools.call("marker_approve", {})).structuredContent.status, 404);
  assert.equal(effects, 0);
});

test("native rights, CAS, immutable source history and precise deletion confirmation remain enforced", async t => {
  const f = await fixture(t);
  const p = (await f.tools.call("marker_save_product", { ...mutation(0), name: "Demo", description: "Known copy" })).structuredContent.record as any;
  const c = (await f.tools.call("marker_save_campaign", { ...mutation(0), product_id: p.id, title: "Demo", kind: "paid" })).structuredContent.record as any;
  assert.equal(c.status, "paused");
  const unknown = await f.tools.call("marker_save_material", { ...mutation(1), kind: "text", product_ids: [p.id], text: "Unknown rights" });
  const material = unknown.structuredContent.record as any;
  const input = { campaignId: c.id, candidateIds: [material.id], includeShared: false, platform: "LinkedIn", template: "text", duration: 20, allowReuse: false, muteBackground: false, audio: "mute" };
  assert.equal((await f.tools.call("marker_prepare_plan", { request: input })).structuredContent.status, 409);
  const stale = await f.tools.call("marker_save_material", { ...mutation(1), id: material.id, text: "Stale replacement" });
  assert.equal(stale.structuredContent.status, 409);
  assert.equal((await f.state()).materials[0].text, "Unknown rights");
  const mismatch = await f.tools.call("marker_delete", { ...mutation(2), resource: "material", id: material.id, confirmation_id: "other" });
  assert.equal(mismatch.structuredContent.status, 400);
  assert.equal((await f.state()).materials.length, 1);
  const deleted = await f.tools.call("marker_delete", { ...mutation(2), resource: "material", id: material.id, confirmation_id: material.id });
  assert.equal(deleted.isError, undefined);
  assert.equal(deleted.structuredContent.deleted_id, material.id);
  assert.equal((await f.state()).materials.length, 0);
  const noPermission = createMcpTools({ origin, backend: f.backend, principal: { ...principal, scopes: ["marker:read", "marker:write"] } });
  assert.equal((await noPermission.call("marker_delete", { ...mutation(3), resource: "campaign", id: c.id, confirmation_id: c.id })).structuredContent.status, 403);
  assert.equal((await f.state()).campaigns.length, 1);
});

test("MP4 export verifies the backend and cancels its media stream, returning only an authenticated URI", async () => {
  const state = emptyStudio(); state.revision = 7;
  state.variants.push({ id: "variant", campaignId: "campaign", recipeRevision: 2 } as any);
  let cancelled = false, readBytes = 0;
  const calls: string[] = [];
  const backend = async (request: Request) => {
    const path = new URL(request.url).pathname; calls.push(path);
    if (path === "/api/studio") return json({ state });
    assert.equal(path, "/api/studio/variants/variant/export");
    return new Response(new ReadableStream({ pull(controller) { readBytes += 4; controller.enqueue(new Uint8Array(4)); }, cancel() { cancelled = true; } }), { headers: { "Content-Type": "video/mp4" } });
  };
  const tools = createMcpTools({ origin, backend, principal });
  const exported = await tools.call("marker_export", { ...mutation(7), id: "variant", recipe_revision: 2 });
  assert.equal(exported.isError, undefined);
  assert.equal(exported.structuredContent.uri, origin + "/api/mcp/artifacts/variant?recipe_revision=2");
  assert.equal(exported.structuredContent.authentication_required, true);
  assert.equal(cancelled, true);
  assert.ok(readBytes <= 4, "does not buffer an entire MP4");
  assert.deepEqual(calls, ["/api/studio", "/api/studio/variants/variant/export", "/api/studio"]);
});

test("render returns the exact backend job and preserves backend limit/error status without approval", async () => {
  const state = emptyStudio(); state.revision = 4;
  state.variants.push({ id: "variant", campaignId: "campaign", recipeRevision: 3 } as any);
  let renderRequests = 0;
  const tools = createMcpTools({ origin, principal, backend: async request => {
    if (new URL(request.url).pathname === "/api/studio") return json({ state });
    assert.equal(new URL(request.url).pathname, "/api/studio/variants/variant/render");
    assert.deepEqual(await request.json(), { recipeRevision: 3 }); renderRequests++;
    return json({ error: "Configured storage limit", code: "storage_limit" }, 413);
  } });
  const stale = await tools.call("marker_render", { ...mutation(3), id: "variant", recipe_revision: 3 });
  assert.equal(stale.structuredContent.status, 409); assert.equal(renderRequests, 0);
  const failed = await tools.call("marker_render", { ...mutation(4), id: "variant", recipe_revision: 3 });
  assert.equal(failed.structuredContent.status, 413); assert.equal(failed.structuredContent.code, "storage_limit");
  assert.equal(renderRequests, 1);
});

test("material editing preserves trusted generation provenance while external arguments cannot forge it", async t => {
  const f = await fixture(t);
  const generation = { kind: "agent" as const, runId: "existing-run", proposalId: "existing-proposal", connectionId: "existing-connection", provider: "openai-codex" as const, model: "test-model", createdAt: "2026-10-24T00:00:00.000Z", sourceRefs: [] };
  const response = await f.api.handle(new Request(origin + "/api/studio/commands", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify({ expectedRevision: 0, command: { type: "material.save", data: { kind: "text", text: "Previously generated copy", rights: "unknown", review: "unreviewed" } } }) }), await f.repository.read(), { generation });
  assert.equal(response!.status, 200);
  const material = (await response!.json()).state.materials[0];
  const edited = await f.tools.call("marker_save_material", { ...mutation(1), id: material.id, text: "Human-requested corrected copy" });
  assert.equal(edited.isError, undefined);
  assert.deepEqual((edited.structuredContent.record as any).generation, generation);
  assert.equal((edited.structuredContent.record as any).contentVersion, 2);
  assert.equal((edited.structuredContent.record as any).rights, "unknown");
  assert.equal((await f.tools.call("marker_save_material", { ...mutation(2), id: material.id, generation: { ...generation, runId: "forged" } })).structuredContent.status, 400);
  assert.deepEqual((await f.state()).materials[0].generation, generation);
});

test("editing checks the initial read revision before merging facts, and concurrent export cancels without delivery", async () => {
  let writes = 0, reads = 0;
  const tools = createMcpTools({ origin, principal, backend: async request => {
    if (request.method !== "GET") writes++;
    reads++;
    return json({ version: 1, revision: reads === 1 ? 0 : 1, products: [{ id: "p", name: "Previous name" }], accounts: [], sources: [], campaigns: [], posts: [] });
  } });
  assert.equal((await tools.call("marker_save_product", { ...mutation(1), id: "p", cta: "New CTA" })).structuredContent.status, 409);
  assert.equal(reads, 1); assert.equal(writes, 0);
  const state = emptyStudio(); state.revision = 3; state.variants.push({ id: "v", recipeRevision: 1 } as any);
  let studioReads = 0, cancelled = false;
  const exporting = createMcpTools({ origin, principal, backend: async request => {
    if (new URL(request.url).pathname === "/api/studio") {
      studioReads++;
      return json({ state: { ...state, revision: studioReads === 1 ? 3 : 4 } });
    }
    return new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { "Content-Type": "video/mp4" } });
  } });
  const response = await exporting.call("marker_export", { ...mutation(3), id: "v", recipe_revision: 1 });
  assert.equal(response.structuredContent.status, 409);
  assert.equal(response.structuredContent.uri, undefined); assert.equal(cancelled, true);
});
