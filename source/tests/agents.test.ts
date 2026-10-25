import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createAgentsApi } from "../server/agents.ts";
import { createLocalAgentStore } from "../server/agents-local.ts";
import { createD1AgentStore } from "../server/agents-store.ts";
import { createStudioApi } from "../server/studio-local.ts";
import { applyCommand, emptyWorkspace } from "../src/core/domain.ts";
import { runBridge, saveReceipt } from "../tools/agent-bridge.mjs";

const ORIGIN = "http://127.0.0.1:5198";
async function fixture(t, d1 = false) {
  const directory = mkdtempSync(join(tmpdir(), "marker-agents-"));
  const workspace = applyCommand(emptyWorkspace(), { type: "product.save", data: { name: "Test product", description: "Server-owned context", status: "preparation" } });
  const productId = workspace.products[0].id;
  const studio = createStudioApi({ directory: join(directory, "studio"), tools: { ffmpeg: "missing", ffprobe: "missing" } });
  let clock = Date.now(), loseResponse = false;
  function agentStore() {
    if (!d1) return createLocalAgentStore(directory);
    const sql = new DatabaseSync(join(directory, "d1.sqlite"));
    sql.exec(readFileSync(new URL("../migrations-d1/0006_agents.sql", import.meta.url), "utf8"));
    const database = {
      prepare(text) {
        let args = [];
        const statement = { bind(...values) { args = values; return statement; }, execute() { const prepared = sql.prepare(text); return prepared.columns().length ? { results: prepared.all(...args), meta: { changes: 0 } } : { results: [], meta: { changes: Number(prepared.run(...args).changes) } }; }, async all() { return statement.execute(); }, async run() { return statement.execute(); } }; return statement;
      },
      async batch(statements) { sql.exec("BEGIN IMMEDIATE"); try { const result = statements.map(statement => statement.execute()); sql.exec("COMMIT"); return result; } catch (error) { sql.exec("ROLLBACK"); throw error; } },
    };
    return { ...createD1AgentStore(database as unknown as D1Database), close() { sql.close(); } };
  }
  const create = () => createAgentsApi({ store: agentStore(), readWorkspace: async () => workspace, studioRequest: async (request, trusted) => {
    const response = await studio.handle(request, workspace, trusted);
    if (loseResponse && trusted?.newId) { loseResponse = false; throw new Error("synthetic lost response after Studio commit"); }
    return response;
  }, now: () => clock });
  let api = create();
  async function call(path = "", body?, options: { method?: string; token?: string; origin?: string; raw?: string } = {}) {
    const method = options.method ?? (body === undefined ? "GET" : "POST");
    const response = await api.handle(new Request(`${ORIGIN}/api/agents${path}`, { method, headers: { origin: options.origin ?? ORIGIN, ...(body === undefined ? {} : { "content-type": "application/json" }), ...(options.token ? { authorization: `Bearer ${options.token}` } : {}) }, ...(method === "GET" ? {} : { body: options.raw ?? JSON.stringify(body) }) }));
    assert.ok(response); const content = response.headers.get("content-type")?.includes("json") ? await response.json() : await response.text();
    return { status: response.status, data: content };
  }
  async function studioCall(path = "", body?) {
    const response = await studio.handle(new Request(`${ORIGIN}/api/studio${path}`, { method: body === undefined ? "GET" : "POST", headers: { origin: ORIGIN, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), workspace);
    assert.ok(response); return { status: response.status, data: await response.json() };
  }
  async function command(type, data) {
    const current = await studioCall();
    const response = await studioCall("/commands", { expectedRevision: current.data.state.revision, command: { type, data } });
    assert.equal(response.status, 200, JSON.stringify(response.data)); return response.data.state;
  }
  const seed = await command("material.save", { title: "Original", kind: "text", text: "An exact selected source", categories: ["ready-text"], productIds: [productId], rights: "owned", review: "ready" });
  const materialId = seed.materials[0].id;
  const campaign = await command("campaign.save", { title: "Studio campaign", productId }); const campaignId = campaign.campaigns[0].id;
  const paired = await call("/connections", {}); assert.equal(paired.status, 201);
  const { connection, token } = paired.data;
  const heartbeat = { accountLabel: "Synthetic account", authMode: "chatgpt", billingMode: "chatgpt_subscription", model: "synthetic-model", capabilities: ["copy", "assembly", "review"] };
  assert.equal((await call("/bridge/heartbeat", heartbeat, { token })).status, 200);
  const selection = { productId, campaignId, materialIds: [materialId] };
  const sessionResult = await call("/sessions", { context: selection }); assert.equal(sessionResult.status, 201); const session = sessionResult.data.session;
  async function run(prompt = "Prepare three product proposals") {
    const queued = await call(`/sessions/${session.id}/runs`, { prompt, task: "copy", connectionId: connection.id, context: selection }); assert.equal(queued.status, 201, JSON.stringify(queued.data));
    const polled = await call("/bridge/poll", {}, { token }); assert.equal(polled.status, 200); const lease = polled.data.leaseToken;
    return { run: polled.data.run, lease, async complete(output = { message: "Three alternatives prepared.", proposals: [{ title: "Direct", hook: "A clear hook", body: "A clear product message", cta: "Try it today" }] }) { return call(`/bridge/runs/${polled.data.run.id}/complete`, { status: "completed", leaseToken: lease, output }, { token }); } };
  }
  t.after(async () => { api.close(); await studio.close(); rmSync(directory, { recursive: true, force: true }); });
  return { call, studioCall, command, run, workspace, productId, materialId, campaignId, connection, token, session, selection, heartbeat,
    reopen() { api.close(); api = create(); }, advance(ms) { clock += ms; }, loseNextResponse() { loseResponse = true; } };
}

test("agent bridge is separate, revocable and subscription-only; context is derived from exact Studio selection", async t => {
  const f = await fixture(t);
  assert.equal((await f.call("/bridge/poll", {})).status, 401);
  assert.equal((await f.call("/bridge/heartbeat", { ...f.heartbeat, billingMode: "api_key" }, { token: f.token })).status, 409);
  const r = await f.run();
  assert.equal(r.run.context.product.description, "Server-owned context");
  assert.equal(r.run.context.campaign.title, "Studio campaign");
  assert.deepEqual(r.run.context.materials.map(item => item.id), [f.materialId]);
  assert.equal(r.run.context.materials[0].text, "An exact selected source");
  assert.equal((await f.call(`/sessions/${f.session.id}/runs`, { connectionId: f.connection.id, prompt: "Concurrent" })).status, 429);
  await r.complete();
  const raw = JSON.stringify((await f.call()).data); assert.ok(!raw.includes(f.token)); assert.ok(!raw.includes("tokenHash"));
  await f.call(`/connections/${f.connection.id}`, {}, { method: "DELETE" });
  assert.equal((await f.call("/bridge/poll", {}, { token: f.token })).status, 401);
});

test("agent proposal/edit/history survives reload; completion and lost material response recover once", async t => {
  const f = await fixture(t), r = await f.run();
  const complete = await r.complete(); assert.equal(complete.status, 200); assert.equal((await r.complete()).status, 200);
  const proposal = complete.data.proposals[0];
  const edited = await f.call(`/proposals/${proposal.id}/edit`, { title: "Edited copy", hook: "Hook", body: "Human-adjusted message", cta: "Call now" }); assert.equal(edited.status, 200);
  f.reopen();
  const history = await f.call(`/sessions/${f.session.id}`); assert.equal(history.data.proposals.length, 1); assert.equal(history.data.proposals[0].body, "Human-adjusted message");
  const snapshot = await f.studioCall();
  f.loseNextResponse();
  const lost = await f.call(`/proposals/${proposal.id}/apply`, { expectedStudioRevision: snapshot.data.state.revision, rights: "owned", review: "ready" }); assert.equal(lost.status, 503);
  f.reopen();
  const retry = await f.call(`/proposals/${proposal.id}/apply`, { expectedStudioRevision: snapshot.data.state.revision, rights: "owned", review: "ready" }); assert.equal(retry.status, 200); assert.equal(retry.data.replayed, true);
  assert.equal(retry.data.state.materials.length, 2);
  const generated = retry.data.state.materials.find(item => item.id === retry.data.materialId);
  assert.equal(generated.text, "Human-adjusted message"); assert.equal(generated.generation.proposalId, proposal.id); assert.equal(generated.generation.model, "synthetic-model");
  const again = await f.call(`/proposals/${proposal.id}/apply`, {}); assert.equal(again.status, 200); assert.equal(again.data.state.materials.length, 2);
  const followup = await f.run("Now convert it to a piece"); assert.ok(followup.run.history.some(turn => turn.text.includes("Human-adjusted message")));
});

test("source metadata changes are detected independently of unrelated Studio revision changes", async t => {
  const f = await fixture(t), r = await f.run(), completed = await r.complete(), proposal = completed.data.proposals[0];
  await f.command("material.save", { title: "Unrelated", text: "Other", kind: "text", productIds: [f.productId] });
  let snapshot = await f.studioCall();
  const wrong = await f.call(`/proposals/${proposal.id}/apply`, { expectedStudioRevision: 0 }); assert.equal(wrong.data.code, "revision_conflict");
  await f.command("material.save", { id: f.materialId, rights: "restricted" });
  snapshot = await f.studioCall();
  const changed = await f.call(`/proposals/${proposal.id}/apply`, { expectedStudioRevision: snapshot.data.state.revision, rights: "owned", review: "ready" });
  assert.equal(changed.status, 409); assert.equal(changed.data.code, "context_conflict");
  assert.equal(snapshot.data.state.materials[0].contentVersion, proposal.sourceRefs[0].contentVersion, "metadata changes need more than contentVersion");
});

test("agent planner applies a recomputed variant once, updates it and records approved text export", async t => {
  const f = await fixture(t), r = await f.run(), completed = await r.complete(), proposal = completed.data.proposals[0];
  let snapshot = await f.studioCall();
  const saved = await f.call(`/proposals/${proposal.id}/apply`, { expectedStudioRevision: snapshot.data.state.revision, rights: "owned", review: "ready" }); assert.equal(saved.status, 200);
  const input = { campaignId: f.campaignId, candidateIds: [saved.data.materialId], textSourceId: saved.data.materialId, includeShared: false, platform: "LinkedIn", template: "text", hook: proposal.hook, body: proposal.body, cta: proposal.cta, duration: 20, lockedSelections: [], reviewedMaterialIds: [], allowReuse: false, muteBackground: true, audio: "mute" };
  let planned = await f.call(`/proposals/${proposal.id}/plan`, { request: input }); assert.equal(planned.status, 200, JSON.stringify(planned.data));
  const apply = { request: input, fingerprint: planned.data.fingerprint, alternative: 0, expectedStudioRevision: saved.data.state.revision };
  const altered = await f.call(`/proposals/${proposal.id}/apply-plan`, { ...apply, fingerprint: "forged" }); assert.equal(altered.status, 409);
  const applied = await f.call(`/proposals/${proposal.id}/apply-plan`, apply); assert.equal(applied.status, 200, JSON.stringify(applied.data)); assert.equal(applied.data.state.variants.length, 1);
  const replay = await f.call(`/proposals/${proposal.id}/apply-plan`, apply); assert.equal(replay.status, 200); assert.equal(replay.data.replayed, true); assert.equal(replay.data.state.variants.length, 1);
  const updatedInput = { ...input, variantId: applied.data.variantId, hook: "A stronger hook" };
  planned = await f.call(`/proposals/${proposal.id}/plan`, { request: updatedInput }); assert.equal(planned.status, 200);
  const update = await f.call(`/proposals/${proposal.id}/apply-plan`, { request: updatedInput, fingerprint: planned.data.fingerprint, alternative: 0, expectedStudioRevision: applied.data.state.revision });
  assert.equal(update.status, 200, JSON.stringify(update.data)); assert.equal(update.data.state.variants.length, 1); assert.equal(update.data.state.variants[0].hook, "A stronger hook");
  const production = await f.call(`/proposals/${proposal.id}/production`); assert.equal(production.status, 200); assert.equal(production.data.variant.id, applied.data.variantId); assert.deepEqual(production.data.jobs, []);
  const staleRender = await f.call(`/proposals/${proposal.id}/render`, { recipeRevision: 0 }); assert.equal(staleRender.status, 409); assert.equal(staleRender.data.code, "recipe_conflict");
  const textRender = await f.call(`/proposals/${proposal.id}/render`, { recipeRevision: update.data.state.variants[0].recipeRevision }); assert.equal(textRender.status, 400, "Canonical render validation must reject a TXT recipe");
  assert.equal((await f.call(`/proposals/${proposal.id}/production`)).data.proposal.renderJobId, undefined, "A refused render cannot be recorded as admitted");
  assert.equal((await f.call(`/proposals/${proposal.id}/export`)).status, 409);
  snapshot = await f.studioCall();
  const approval = await f.studioCall(`/variants/${applied.data.variantId}/approve`, { recipeRevision: update.data.state.variants[0].recipeRevision, confirmed: true }); assert.equal(approval.status, 200, JSON.stringify(approval.data));
  const exported = await f.call(`/proposals/${proposal.id}/export`); assert.equal(exported.status, 200); assert.ok(exported.data.includes("A stronger hook"));
  const history = await f.call(`/sessions/${f.session.id}`); assert.ok(history.data.proposals[0].exportedAt); assert.equal(history.data.proposals[0].exportedRecipeRevision, update.data.state.variants[0].recipeRevision);
});

test("agent cancellation, timeout and daily limits retain completed results without automatic rerun", async t => {
  const f = await fixture(t), r = await f.run();
  assert.equal((await f.call(`/runs/${r.run.id}/cancel`, {})).data.run.cancelRequested, true);
  const cancelled = await r.complete(); assert.equal(cancelled.data.run.status, "cancelled"); assert.equal(cancelled.data.proposals.length, 0);
  await f.call("/limits", { dailyRuns: 2, maxRunSeconds: 30, maxConcurrentRuns: 1, retentionDays: 30 });
  const second = await f.run(); f.advance(31_000);
  const overview = await f.call(); assert.equal(overview.data.usage.activeRuns, 0);
  const detail = await f.call(`/sessions/${f.session.id}`); assert.equal(detail.data.runs.find(run => run.id === second.run.id).status, "failed");
  assert.equal((await f.call(`/sessions/${f.session.id}/runs`, { prompt: "Over daily limit", connectionId: f.connection.id })).status, 429);
});

test("D1 adapter and SQLite preserve concurrent request idempotency and recovery before availability checks", async t => {
  const f = await fixture(t, true), requestId = crypto.randomUUID();
  const submission = { requestId, connectionId: f.connection.id, prompt: "One operation", task: "copy", context: f.selection };
  const results = await Promise.all([f.call(`/sessions/${f.session.id}/runs`, submission), f.call(`/sessions/${f.session.id}/runs`, { ...submission, context: { materialIds: f.selection.materialIds, campaignId: f.campaignId, productId: f.productId } })]);
  assert.deepEqual(results.map(result => result.status).sort(), [200, 201]); assert.equal(results[0].data.run.id, results[1].data.run.id);
  const overview = await f.call(); assert.equal(overview.data.usage.todayRuns, 1); assert.equal(overview.data.usage.activeRuns, 1);
  assert.equal((await f.call(`/sessions/${f.session.id}/runs`, { ...submission, prompt: "Changed request" })).data.code, "request_conflict");
  await f.call(`/connections/${f.connection.id}`, {}, { method: "DELETE" }); f.reopen();
  const recovered = await f.call(`/sessions/${f.session.id}/runs`, submission); assert.equal(recovered.status, 200); assert.equal(recovered.data.replayed, true); assert.equal(recovered.data.run.id, results[0].data.run.id);
});

test("streamed agent deltas preserve exact spaces, whitespace-only chunks and line breaks", async t => {
  const f = await fixture(t), r = await f.run();
  const chunks = ["Hello", " ", "world", "\n", "\n", " Keep ", "spacing."];
  const response = await f.call(`/bridge/runs/${r.run.id}/events`, { leaseToken: r.lease, events: [...chunks.map(text => ({ type: "delta", text })), { type: "activity", text: "  Reading context  " }] }, { token: f.token });
  assert.equal(response.status, 200);
  const history = await f.call(`/sessions/${f.session.id}`);
  const deltas = history.data.events.filter(event => event.type === "delta");
  assert.deepEqual(deltas.map(event => event.text), chunks);
  assert.equal(deltas.map(event => event.text).join(""), "Hello world\n\n Keep spacing.");
  assert.equal(history.data.events.find(event => event.text === "Reading context")?.type, "activity");
  const invalid = await f.call(`/bridge/runs/${r.run.id}/events`, { leaseToken: r.lease, events: [{ type: "delta", text: "bad\0text" }] }, { token: f.token });
  assert.equal(invalid.status, 400);
});

test("offline completed receipts reconcile the original expired run without new inference or proposals", async t => {
  for (const elapsed of [121_000, 301_000]) {
    const f = await fixture(t), r = await f.run();
    const output = { message: "Finished offline", proposals: [0, 1, 2].map(index => ({ title: `Choice ${index}`, hook: "Hook", body: `Original completed copy ${index}`, cta: "Act" })) };
    f.advance(elapsed);
    const timedOut = await f.call(); assert.equal(timedOut.data.usage.activeRuns, 0);
    const failed = await f.call(`/sessions/${f.session.id}`); assert.equal(failed.data.runs[0].status, "failed"); assert.equal(failed.data.runs[0].recoveryReason, undefined);
    f.reopen();
    const wrongLease = await f.call(`/bridge/runs/${r.run.id}/complete`, { status: "completed", leaseToken: "wrong", output }, { token: f.token }); assert.equal(wrongLease.status, 409); assert.equal(wrongLease.data.code, "lease_conflict");
    const invalid = await r.complete({ ...output, proposals: [{ title: "Invalid", hook: "", body: "", cta: "" }] }); assert.equal(invalid.status, 400);
    assert.equal((await f.call(`/sessions/${f.session.id}`)).data.runs[0].status, "failed");
    const recovered = await r.complete(output); assert.equal(recovered.status, 200); assert.equal(recovered.data.recovered, true); assert.equal(recovered.data.run.id, r.run.id); assert.equal(recovered.data.run.status, "completed"); assert.ok(recovered.data.run.resultRecoveredAt); assert.equal(recovered.data.run.error, undefined); assert.equal(recovered.data.proposals.length, 3);
    const duplicate = await r.complete(output); assert.equal(duplicate.status, 200); assert.equal(duplicate.data.recovered, true);
    const restored = await f.call(`/sessions/${f.session.id}`); assert.equal(restored.data.runs.length, 1); assert.equal(restored.data.proposals.length, 3); assert.equal(restored.data.events.filter(event => event.text.includes("no se inició otra inferencia")).length, 1);
    assert.equal((await f.call()).data.usage.todayRuns, 1);
  }
});

test("late reconciliation cannot reopen explicit provider failure, cancellation or revoked connection", async t => {
  const f = await fixture(t), failed = await f.run();
  assert.equal((await f.call(`/bridge/runs/${failed.run.id}/complete`, { status: "failed", leaseToken: failed.lease, error: "Provider refused" }, { token: f.token })).status, 200);
  assert.equal((await failed.complete()).data.code, "run_closed");
  const cancelled = await f.run(); await f.call(`/runs/${cancelled.run.id}/cancel`, {}); f.advance(121_000); await f.call(); f.reopen();
  const replay = await cancelled.complete(); assert.equal(replay.status, 200); assert.equal(replay.data.run.status, "cancelled"); assert.equal(replay.data.recovered, undefined);
  assert.equal((await f.call(`/sessions/${f.session.id}`)).data.proposals.length, 0);
  await f.call("/bridge/heartbeat", f.heartbeat, { token: f.token }); const revoked = await f.run(); f.advance(121_000); await f.call(); await f.call(`/connections/${f.connection.id}`, {}, { method: "DELETE" });
  assert.equal((await revoked.complete()).status, 401);
});

test("actual bridge receipt replay clears an uncommitted timed-out result without invoking inference", async t => {
  const f = await fixture(t), r = await f.run(), receiptDirectory = mkdtempSync(join(tmpdir(), "marker-offline-receipt-")), receiptPath = join(receiptDirectory, "receipt.json");
  t.after(() => rmSync(receiptDirectory, { recursive: true, force: true }));
  const output = { message: "Already completed offline", proposals: [{ title: "Recovered", hook: "Hook", body: "Preserved original model result", cta: "Act" }] };
  await saveReceipt(receiptPath, { runId: r.run.id, result: { status: "completed", leaseToken: r.lease, output } });
  f.advance(301_000); await f.call(); f.reopen();
  let inferenceCount = 0;
  const client = { async request(path, data?) { const response = await f.call(`/bridge${path}`, data, { token: f.token }); if (response.status >= 400) throw new Error(`Backend ${response.status}: ${response.data.code}`); return response.data; } };
  const runtime = { async initialize() { return { ...f.heartbeat, planType: "pro" }; }, async run() { inferenceCount++; throw new Error("Recovery must not call the provider"); } };
  await runBridge({ client, runtime, receiptPath, once: true, log() {} });
  assert.equal(inferenceCount, 0); assert.equal(existsSync(receiptPath), false);
  const history = await f.call(`/sessions/${f.session.id}`); assert.equal(history.data.runs.length, 1); assert.equal(history.data.runs[0].status, "completed"); assert.equal(history.data.proposals[0].body, "Preserved original model result");
});

test("selected variant recipe drift blocks old proposals; unrelated edits and own planner receipts remain valid", async t => {
  const f = await fixture(t);
  const initial = await f.command("variant.save", { campaignId: f.campaignId, template: "text", body: "An exact selected source", sourceIds: [f.materialId] });
  const variantId = initial.variants[0].id; f.selection.variantId = variantId;
  const first = await f.run(), generated = await first.complete(), proposal = generated.data.proposals[0];
  await f.command("variant.save", { campaignId: f.campaignId, template: "text", body: "Unrelated variant", sourceIds: [f.materialId] });
  const approved = await f.studioCall(`/variants/${variantId}/approve`, { recipeRevision: 1, confirmed: true }); assert.equal(approved.status, 200, "Approval alone must preserve the selected recipe");
  let snapshot = await f.studioCall();
  const input = { campaignId: f.campaignId, variantId, candidateIds: [f.materialId], textSourceId: f.materialId, includeShared: false, platform: "LinkedIn", template: "text", hook: "First plan", body: "An exact selected source", cta: "Act", duration: 20, lockedSelections: [], reviewedMaterialIds: [], allowReuse: false, muteBackground: true, audio: "mute" };
  let plan = await f.call(`/proposals/${proposal.id}/plan`, { request: input }); assert.equal(plan.status, 200);
  let applied = await f.call(`/proposals/${proposal.id}/apply-plan`, { request: input, fingerprint: plan.data.fingerprint, alternative: 0, expectedStudioRevision: snapshot.data.state.revision }); assert.equal(applied.status, 200);
  const nextInput = { ...input, hook: "Second plan" }; plan = await f.call(`/proposals/${proposal.id}/plan`, { request: nextInput }); assert.equal(plan.status, 200, "Own recorded planner update must remain eligible");
  applied = await f.call(`/proposals/${proposal.id}/apply-plan`, { request: nextInput, fingerprint: plan.data.fingerprint, alternative: 0, expectedStudioRevision: applied.data.state.revision }); assert.equal(applied.status, 200);
  await f.command("variant.save", { id: variantId, body: "Owner edited recipe" }); snapshot = await f.studioCall();
  const stale = await f.call(`/proposals/${proposal.id}/apply`, { expectedStudioRevision: snapshot.data.state.revision, rights: "owned", review: "ready" }); assert.equal(stale.status, 409); assert.equal(stale.data.code, "context_conflict");
});

test("variant-only context derives its Studio campaign/product and rejects a mismatched explicit product", async t => {
  const f = await fixture(t), state = await f.command("variant.save", { campaignId: f.campaignId, template: "text", body: "Text", sourceIds: [f.materialId] }), variantId = state.variants[0].id;
  const derived = await f.call("/sessions", { context: { variantId, materialIds: [] } }); assert.equal(derived.status, 201); assert.equal(derived.data.session.context.campaignId, f.campaignId); assert.equal(derived.data.session.context.productId, f.productId);
  f.workspace.products.push({ ...f.workspace.products[0], id: "other-product", name: "Other" });
  const mismatched = await f.call("/sessions", { context: { variantId, productId: "other-product", materialIds: [] } }); assert.equal(mismatched.status, 409); assert.equal(mismatched.data.code, "context_conflict");
});
