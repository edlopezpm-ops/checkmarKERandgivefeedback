import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { hostedStudioApi, readHostedStudio, executeHostedRender, assertProductUnused } from "../server/studio-hosted.ts";
import { applyCommand, emptyWorkspace } from "../src/core/domain.ts";
import { handleOwnerAuth, authorizedOwner } from "../server/native-auth.js";
import { registerHooks } from "node:module";
import { ANALYSIS_LOCAL_TESTED_TOOL_VERSION } from "../src/core/studio-analysis.ts";
import { defaultStudioSettings } from "../src/core/settings.ts";
import { nativeApi } from "../server/worker.ts";

const ORIGIN = "https://marker.aekr.io";
function fixture(t, api = hostedStudioApi) {
  const sql = new DatabaseSync(":memory:");
  for (const file of ["0001_private.sql", "0002_studio.sql", "0003_studio_hosted.sql", "0004_studio_analysis.sql", "0005_studio_settings.sql", "0006_agents.sql", "0007_single_tenant_auth.sql", "0008_github_auth.sql", "0009_profile_account.sql"])
    sql.exec(readFileSync(new URL(`../migrations-d1/${file}`, import.meta.url), "utf8"));
  t.after(() => sql.close());
  let failBatch = -1, failPrefix = "UPDATE marker_studio_meta";
  const DB = {
    prepare(text) {
      let args = [];
      const statement = {
        text,
        bind(...values) { args = values; return statement; },
        execute() { const q = sql.prepare(text); return q.columns().length ? { results: q.all(...args), meta: { changes: 0 }, success: true } : { results: [], meta: { changes: Number(q.run(...args).changes) }, success: true }; },
        async run() { return statement.execute(); }, async all() { return statement.execute(); },
        async first() { return statement.execute().results[0] ?? null; },
      }; return statement;
    },
    async batch(statements) {
      sql.exec("BEGIN");
      try { const result = statements.map((statement, index) => { if (index === failBatch && statements[0].text.startsWith(failPrefix)) throw new Error("synthetic SQL fault"); return statement.execute(); }); sql.exec("COMMIT"); return result; }
      catch (error) { sql.exec("ROLLBACK"); throw error; }
    },
  };
  const blobs = new Map(), multipart = new Map(), queue = [], calls = { probe: 0, render: 0, analysis:0, multipart: 0, failProbe: false, failRender: false, failAnalysis:false, failEnqueue: false, failMultipart: false, failAbort: false }, mails = [];
  const MEDIA = {
    async createMultipartUpload(key) { calls.multipart++; if (calls.failMultipart) throw new Error("synthetic R2 unavailable"); const uploadId = crypto.randomUUID(); multipart.set(uploadId, { key, parts: new Map() }); return MEDIA.resumeMultipartUpload(key, uploadId); },
    resumeMultipartUpload(key, uploadId) {
      return { key, uploadId,
        async uploadPart(partNumber, bytes) { const upload = multipart.get(uploadId); if (!upload || upload.key !== key) throw new Error("no multipart"); upload.parts.set(partNumber, new Uint8Array(bytes)); return { partNumber, etag: "part-" + partNumber }; },
        async complete(parts) { const upload = multipart.get(uploadId); if (!upload) throw new Error("no multipart"); const size = parts.reduce((n, part) => n + upload.parts.get(part.partNumber).byteLength, 0), bytes = new Uint8Array(size); let at = 0; for (const part of parts) { const value = upload.parts.get(part.partNumber); bytes.set(value, at); at += value.byteLength; } blobs.set(key, bytes); multipart.delete(uploadId); return { key, size }; },
        async abort() { if (calls.failAbort) throw new Error("synthetic R2 unavailable"); if (!multipart.has(uploadId)) throw Object.assign(new Error("The multipart upload does not exist. (10024)"), { code: 10024 }); multipart.delete(uploadId); },
      };
    },
    async head(key) { const bytes = blobs.get(key); return bytes ? { key, size: bytes.byteLength } : null; },
    async get(key, options) { const bytes = blobs.get(key); if (!bytes) return null; const data = options?.range ? bytes.slice(options.range.offset, options.range.offset + options.range.length) : bytes; return { key, size: bytes.byteLength, body: new Blob([data]).stream() }; },
    async delete(key) { blobs.delete(key); },
  };
  const processor = {
    async probe(key) { calls.probe++; if (calls.failProbe) throw new Error("synthetic private processor error /secret/path"); const bytes = blobs.get(key); return { kind: "video", mime: "video/mp4", duration: 10, width: 1920, height: 1080, audioTrack: "absent", processing: "ready", sha256: createHash("sha256").update(bytes).digest("hex") }; },
    async enqueue(jobId) { if (calls.failEnqueue) throw new Error("synthetic enqueue failure"); queue.push(jobId); },
    async render(_jobId, spec, _inputs, outputs) { calls.render++; if (calls.failRender) throw new Error("synthetic private error"); blobs.set(outputs.videoKey, new Uint8Array([1, 2, 3, 4])); blobs.set(outputs.coverKey, new Uint8Array([5, 6])); return { duration: spec.duration, width: 1080, height: 1920 }; },
    async analyze(analysisId, _key, range, toolVersion) { calls.analysis++; if(calls.failAnalysis) throw new Error("synthetic private analyzer"); blobs.set(`analysis/${analysisId}/thumb-0.jpg`,new Uint8Array([255,216,255])); return {analysis:{profile:"technical-v1",toolVersion,range,status:"complete",intervals:[],thumbnails:[{name:"thumb-0.jpg",time:range.start}],warnings:[]},thumbnails:[{name:"thumb-0.jpg",size:3}]}; },
  };
  const env = { DB, MEDIA, STUDIO_PROCESSOR: { getByName(name) { assert.equal(name, "owner"); return processor; } }, MARKER_ORIGIN: ORIGIN,
    MARKER_OWNER_EMAIL: "owner@example.invalid", MARKER_SENDER_EMAIL: "marker@aekr.io", MARKER_AUTH_SECRET: "synthetic-auth-secret-at-least-thirty-two-bytes", EMAIL: { async send(mail) { mails.push(mail); } } };
  const workspace = applyCommand(emptyWorkspace(), { type: "product.save", data: { name: "Fixture", status: "preparation" } });
  sql.prepare("INSERT INTO marker_workspace(id,revision,document) VALUES(1,?,?)").run(workspace.revision, JSON.stringify(workspace));
  async function call(path = "", data, options = {}) {
    const method = options.method ?? (data === undefined ? "GET" : "POST");
    const headers = { Origin: ORIGIN, ...(data === undefined ? {} : { "Content-Type": "application/json" }), ...options.headers };
    return api(new Request(ORIGIN + "/api/studio" + path, { method, headers, ...(method === "GET" ? {} : { body: options.raw ?? JSON.stringify(data) }) }), env, options.workspace ?? workspace);
  }
  async function state() { return readHostedStudio(env); }
  async function command(type, data, expectedRevision) { const previous = await state(); return call("/commands", { expectedRevision: expectedRevision ?? previous.revision, command: { type, data } }); }
  async function upload(bytes = new Uint8Array([11, 22, 33]), name = "phone.mov") {
    const created = await call("/uploads", { name, mime: "video/quicktime", size: bytes.length }); assert.equal(created.status, 201);
    const value = (await created.json()).upload;
    const append = await call(`/uploads/${value.id}`, undefined, { method: "PUT", raw: bytes, headers: { "upload-offset": "0" } }); assert.equal(append.status, 200);
    return { id: value.id, complete: () => call(`/uploads/${value.id}/complete`, {}) };
  }
  async function mediaVariant() {
    const uploaded = await upload(); const complete = await uploaded.complete(); assert.equal(complete.status, 200); const asset = (await complete.json()).asset;
    assert.equal((await command("material.save", { id: undefined, title: "Kitchen", kind: "video", assetId: asset.id, rights: "owned", categories: ["broll"] })).status, 200);
    const material = (await state()).materials[0];
    assert.equal((await command("campaign.save", { productId: workspace.products[0].id, title: "Fixture campaign" })).status, 200);
    const campaign = (await state()).campaigns[0];
    assert.equal((await command("variant.save", { campaignId: campaign.id, template: "overlay", body: "Organiza tus clientes", duration: 10, sourceIds: [material.id], selections: [{ materialId: material.id, start: 0, end: 10 }] })).status, 200);
    return { variant: (await state()).variants[0], material, asset };
  }
  return { sql, env, workspace, calls, blobs, queue, processor, mails, call, command, state, upload, mediaVariant, failAt(index, prefix = "UPDATE marker_studio_meta") { failBatch = index; failPrefix = prefix; } };
}

test("hosted normalized D1 stores text campaign, version receipts and permission-bound export without media compute", async t => {
  const f = fixture(t), productId = f.workspace.products[0].id;
  assert.equal((await f.command("material.save", { title: "Saved copy", kind: "text", text: "Three ideas", productIds: [productId], rights: "owned" })).status, 200);
  const material = (await f.state()).materials[0];
  assert.equal((await f.command("campaign.save", { productId, title: "Text campaign" })).status, 200);
  const campaign = (await f.state()).campaigns[0];
  assert.equal((await f.command("variant.save", { campaignId: campaign.id, template: "text", body: "Manual developed message", sourceIds: [material.id] })).status, 200);
  const variant = (await f.state()).variants[0];
  assert.equal((await f.call(`/variants/${variant.id}/export`)).status, 409);
  assert.equal((await f.call(`/variants/${variant.id}/approve`, { recipeRevision: 1, confirmed: true })).status, 200);
  const exported = await f.call(`/variants/${variant.id}/export`); assert.equal(exported.status, 200); assert.match(await exported.text(), /Manual developed/);
  const list = await (await f.call()).json(); assert.equal(list.jobs[0].kind, "text-approval"); assert.equal(list.usage[material.id], 1); assert.equal(list.capabilities.local, false); assert.equal(list.capabilities.monthlyUsedCents, 0);
  const receipt = await (await f.call(`/jobs/${list.jobs[0].id}`)).json(); assert.equal(receipt.receipt.sourceSnapshots[0].text, "Three ideas");
  assert.equal((await f.command("material.save", { id: material.id, text: "New version" })).status, 200);
  const historical = await (await f.call(`/jobs/${list.jobs[0].id}`)).json(); assert.equal(historical.receipt.sourceSnapshots[0].text, "Three ideas");
  assert.equal((await f.command("material.delete", { id: material.id, confirmed: true })).status, 409);
  assert.equal(f.calls.probe, 0); assert.equal(f.calls.render, 0);
  await assert.rejects(assertProductUnused(f.env, productId), /materiales o campañas/);
});

test("private R2 resumable uploads deduplicate actual streamed processor hash and retain technical audio semantics", async t => {
  const f = fixture(t), uploaded = await f.upload(), done = await uploaded.complete(); assert.equal(done.status, 200);
  const first = await done.json(); assert.equal(first.asset.audioTrack, "absent"); assert.equal(first.asset.kind, "video"); assert.equal(first.asset.name, "phone.mov"); assert.equal("speech" in first.asset, false); assert.equal("key" in first.upload, false);
  const duplicate = await f.upload(); const repeated = await (await duplicate.complete()).json(); assert.equal(repeated.duplicate, true); assert.equal(repeated.asset.id, first.asset.id);
  assert.equal((await f.state()).assets.length, 1); assert.equal(f.blobs.size, 1);
  assert.equal((await duplicate.complete()).status, 200); assert.equal(f.calls.probe, 2, "completed response retry does not spend another probe");
  const cap = (await (await f.call()).json()).capabilities; assert.equal(cap.storageBytes, 3); assert.equal(cap.reservedBytes, 0); assert.equal(cap.monthlyUsedCents, 10);
  const range = await f.call(`/assets/${first.asset.id}`, undefined, { headers: { Range: "bytes=1-2" } }); assert.equal(range.status, 206); assert.deepEqual([...new Uint8Array(await range.arrayBuffer())], [22, 33]);
  assert.equal(range.headers.get("Cache-Control"), "no-store, private");
  assert.equal((await f.call(`/assets/${first.asset.id}`, undefined, { headers: { Range: "bytes=100-200" } })).status, 416);
});

test('account freeze aborts a late multipart part and removes an original completed after deletion began',async t=>{
  const partFixture=fixture(t),resumePart=partFixture.env.MEDIA.resumeMultipartUpload;let aborted=0;
  partFixture.env.MEDIA.resumeMultipartUpload=(...args)=>{const upload=resumePart(...args);return {...upload,async uploadPart(...values){const result=await upload.uploadPart(...values);partFixture.sql.prepare("UPDATE marker_account_lifecycle SET status='deleting',phase='processor' WHERE id=1").run();return result;},async abort(){aborted++;return upload.abort();}};};
  const created=await partFixture.call('/uploads',{name:'fixture.mp4',mime:'video/mp4',size:3}),id=(await created.json()).upload.id;
  const part=await partFixture.call(`/uploads/${id}`,undefined,{method:'PUT',raw:new Uint8Array([1,2,3]),headers:{'upload-offset':'0'}});assert.equal(part.status,503);assert.equal(aborted,1);assert.equal(partFixture.blobs.size,0);
  const completeFixture=fixture(t),uploaded=await completeFixture.upload(),resumeComplete=completeFixture.env.MEDIA.resumeMultipartUpload;
  completeFixture.env.MEDIA.resumeMultipartUpload=(...args)=>{const upload=resumeComplete(...args);return {...upload,async complete(...values){const result=await upload.complete(...values);completeFixture.sql.prepare("UPDATE marker_account_lifecycle SET status='deleting',phase='processor' WHERE id=1").run();return result;}};};
  const complete=await uploaded.complete();assert.equal(complete.status,503);assert.equal(completeFixture.blobs.size,0);assert.equal(completeFixture.sql.prepare('SELECT COUNT(*) AS count FROM marker_studio_assets').get().count,0);
});

test("D1 upload claim prevents duplicate chunks, rejects short nonfinal parts and resumes committed offsets", async t => {
  const f = fixture(t), size = 8 * 1024 * 1024 + 3;
  const created = await f.call("/uploads", { name: "big.mp4", mime: "video/mp4", size }); const upload = (await created.json()).upload;
  assert.equal((await f.call("/uploads", { name: "other.mp4", mime: "video/mp4", size: 1 })).status, 409);
  assert.equal((await f.call(`/uploads/${upload.id}`, undefined, { method: "PUT", raw: new Uint8Array(5), headers: { "upload-offset": "0" } })).status, 400);
  const chunk = new Uint8Array(8 * 1024 * 1024);
  const results = await Promise.all([1, 2].map(() => f.call(`/uploads/${upload.id}`, undefined, { method: "PUT", raw: chunk, headers: { "upload-offset": "0" } })));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  const progress = await (await f.call(`/uploads/${upload.id}`)).json(); assert.equal(progress.upload.offset, chunk.length);
  assert.equal((await f.call(`/uploads/${upload.id}`, undefined, { method: "PUT", raw: new Uint8Array([1, 2, 3]), headers: { "upload-offset": String(chunk.length) } })).status, 200);
  assert.equal((await f.call(`/uploads/${upload.id}/complete`, {})).status, 200);
});

test("render admission, durable execution, revision-specific approval and historical export use immutable receipts", async t => {
  const f = fixture(t), { variant, material } = await f.mediaVariant();
  assert.equal((await f.call(`/variants/${variant.id}/approve`, { recipeRevision: 1, confirmed: true, jobId: "forged" })).status, 404);
  const queued = await f.call(`/variants/${variant.id}/render`, { recipeRevision: 1 }); assert.equal(queued.status, 202); const job = (await queued.json()).job;
  const repeated = await (await f.call(`/variants/${variant.id}/render`, { recipeRevision: 1 })).json(); assert.equal(repeated.job.id, job.id);
  assert.equal((await (await f.call()).json()).capabilities.monthlyUsedCents, 15);
  await Promise.all([executeHostedRender(f.env, job.id, f.processor), executeHostedRender(f.env, job.id, f.processor)]); assert.equal(f.calls.render, 1);
  const done = await (await f.call(`/jobs/${job.id}`)).json(); assert.equal(done.job.status, "completed"); assert.equal(done.receipt.sourceSnapshots[0].materialId, material.id); assert.equal("videoKey" in done.job, false);
  assert.equal((await f.call(`/variants/${variant.id}/approve`, { recipeRevision: 1, confirmed: true, jobId: job.id })).status, 200);
  const exported = await f.call(`/variants/${variant.id}/export`); assert.equal(exported.status, 200); assert.equal(exported.headers.get("Content-Type"), "video/mp4");
  assert.equal((await f.command("variant.save", { id: variant.id, body: "Edited copy" })).status, 200);
  assert.equal((await f.call(`/variants/${variant.id}/export`)).status, 409);
  assert.equal((await f.call(`/variants/${variant.id}/approve`, { recipeRevision: 2, confirmed: true, jobId: job.id })).status, 409);
  assert.equal((await f.call(`/jobs/${job.id}/video`)).status, 200);
  const cap = (await (await f.call()).json()).capabilities; assert.equal(cap.reservedBytes, 0); assert.equal(cap.storageBytes, 9);
});

test("compute failures keep originals, return safe errors, charge once and require an explicit new operation", async t => {
  const f = fixture(t), uploaded = await f.upload(); f.calls.failProbe = true;
  const failed = await uploaded.complete(); assert.equal(failed.status, 503); assert.equal((await failed.text()).includes("secret/path"), false); assert.equal(f.blobs.size, 1);
  assert.equal((await (await f.call()).json()).capabilities.monthlyUsedCents, 5);
  f.calls.failProbe = false; assert.equal((await uploaded.complete()).status, 200);
  assert.equal((await (await f.call()).json()).capabilities.monthlyUsedCents, 10);
  // A deliberately denied compute operation never invokes the processor.
  f.sql.prepare("UPDATE marker_studio_compute SET used_cents=1000").run(); const pending = await f.upload(new Uint8Array([8, 9]));
  const denied = await pending.complete(); assert.equal(denied.status, 429); assert.equal((await denied.json()).code, "compute_budget_exceeded"); assert.equal(f.calls.probe, 2);
  assert.equal((await f.call(`/uploads/${pending.id}`, undefined, { method: "DELETE" })).status, 200);
  assert.equal((await (await f.call()).json()).capabilities.reservedBytes, 0);
});

test("failed and expired render leases never repeat paid work and release reservations exactly once", async t => {
  const f = fixture(t), { variant } = await f.mediaVariant();
  f.calls.failRender = true; const value = await (await f.call(`/variants/${variant.id}/render`, { recipeRevision: 1 })).json();
  await executeHostedRender(f.env, value.job.id, f.processor); await executeHostedRender(f.env, value.job.id, f.processor);
  assert.equal(f.calls.render, 1); assert.equal((await (await f.call(`/jobs/${value.job.id}`)).json()).job.status, "failed");
  assert.equal((await (await f.call()).json()).capabilities.reservedBytes, 0);
  const next = await (await f.call(`/variants/${variant.id}/render`, { recipeRevision: 1 })).json();
  f.sql.prepare("UPDATE marker_studio_limits SET compute_until=0").run();
  await executeHostedRender(f.env, next.job.id, f.processor); await executeHostedRender(f.env, next.job.id, f.processor);
  assert.equal(f.calls.render, 1); assert.equal((await (await f.call(`/jobs/${next.job.id}`)).json()).job.errorCode, "render_interrupted");
  assert.equal((await (await f.call()).json()).capabilities.reservedBytes, 0);
});

test("successful probe is reused after a failed state commit and lost enqueue acknowledgement reuses one reservation", async t => {
  const f = fixture(t), uploaded = await f.upload(); f.failAt(2);
  assert.equal((await uploaded.complete()).status, 503); assert.equal(f.calls.probe, 1);
  f.failAt(-1); assert.equal((await uploaded.complete()).status, 200); assert.equal(f.calls.probe, 1);
  assert.equal((await (await f.call()).json()).capabilities.monthlyUsedCents, 5);
  const asset = (await f.state()).assets[0];
  assert.equal((await f.command("material.save", { kind: "video", assetId: asset.id, rights: "owned" })).status, 200); const material = (await f.state()).materials[0];
  assert.equal((await f.command("campaign.save", { productId: f.workspace.products[0].id })).status, 200); const campaign = (await f.state()).campaigns[0];
  assert.equal((await f.command("variant.save", { campaignId: campaign.id, body: "Manual copy", duration: 10, sourceIds: [material.id], selections: [{ materialId: material.id, start: 0, end: 10 }] })).status, 200); const variant = (await f.state()).variants[0];
  f.calls.failEnqueue = true; assert.equal((await f.call(`/variants/${variant.id}/render`, { recipeRevision: 1 })).status, 503);
  f.calls.failEnqueue = false; const retried = await f.call(`/variants/${variant.id}/render`, { recipeRevision: 1 }); assert.equal(retried.status, 200);
  assert.equal((await (await f.call()).json()).capabilities.monthlyUsedCents, 15);
  const job = (await retried.json()).job; await executeHostedRender(f.env, job.id, f.processor); assert.equal(f.calls.render, 1);
});

test("state CAS, cross-store workspace revision and atomic rollback preserve the last committed library", async t => {
  const f = fixture(t), previous = await f.state();
  const responses = await Promise.all(["A", "B"].map(title => f.command("material.save", { title, kind: "idea" }, previous.revision)));
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]); assert.equal((await f.state()).materials.length, 1);
  const oldWorkspace = structuredClone(f.workspace); f.sql.prepare("UPDATE marker_workspace SET revision=revision+1").run();
  assert.equal((await f.call("/commands", { expectedRevision: 1, command: { type: "campaign.save", data: { productId: f.workspace.products[0].id } } }, { workspace: oldWorkspace })).status, 409);
  assert.equal((await f.state()).campaigns.length, 0);
  f.sql.prepare("UPDATE marker_workspace SET revision=revision-1").run(); f.failAt(1);
  assert.equal((await f.command("material.save", { title: "Rollback", kind: "idea" })).status, 503); f.failAt(-1);
  assert.equal((await f.state()).revision, 1); assert.equal((await f.state()).materials.length, 1);
});

test("upload admission is atomic with a recoverable session before any R2 call, including interruption and unavailable multipart creation", async t => {
  const f = fixture(t), input = { name: "pending.mp4", mime: "video/mp4", size: 3 };
  f.failAt(1, "UPDATE marker_studio_limits"); assert.equal((await f.call("/uploads", input)).status, 503); f.failAt(-1);
  let summary = await (await f.call()).json(); assert.equal(summary.uploads.length, 0); assert.equal(summary.capabilities.reservedBytes, 0); assert.equal(f.calls.multipart, 0);
  const created = await f.call("/uploads", input); assert.equal(created.status, 201); const upload = (await created.json()).upload;
  summary = await (await f.call()).json(); assert.equal(summary.uploads[0].id, upload.id); assert.equal(summary.capabilities.reservedBytes, 3); assert.equal(f.calls.multipart, 0);
  f.calls.failMultipart = true;
  assert.equal((await f.call(`/uploads/${upload.id}`, undefined, { method: "PUT", raw: new Uint8Array([1, 2, 3]), headers: { "upload-offset": "0" } })).status, 503);
  assert.equal((await f.call(`/uploads/${upload.id}`, undefined, { method: "DELETE" })).status, 200);
  summary = await (await f.call()).json(); assert.equal(summary.capabilities.reservedBytes, 0); assert.equal(summary.uploads.length, 0);
});

test("cancellation retries known already-aborted multipart after database rollback while retaining reservations on service failure", async t => {
  const f = fixture(t), uploaded = await f.upload(); f.calls.failAbort = true;
  assert.equal((await f.call(`/uploads/${uploaded.id}`, undefined, { method: "DELETE" })).status, 503);
  assert.equal((await (await f.call()).json()).capabilities.reservedBytes, 3);
  f.calls.failAbort = false; f.failAt(1, "UPDATE marker_studio_uploads");
  assert.equal((await f.call(`/uploads/${uploaded.id}`, undefined, { method: "DELETE" })).status, 503); f.failAt(-1);
  assert.equal((await (await f.call()).json()).uploads.length, 1);
  assert.equal((await f.call(`/uploads/${uploaded.id}`, undefined, { method: "DELETE" })).status, 200);
  assert.equal((await (await f.call()).json()).capabilities.reservedBytes, 0);
});

test("render admission commits budget, storage reservation and recoverable job atomically before enqueue", async t => {
  const f = fixture(t), { variant } = await f.mediaVariant();
  f.failAt(3, "INSERT OR IGNORE INTO marker_studio_compute");
  assert.equal((await f.call(`/variants/${variant.id}/render`, { recipeRevision: 1 })).status, 503); f.failAt(-1);
  let summary = await (await f.call()).json(); assert.equal(summary.jobs.length, 0); assert.equal(summary.capabilities.monthlyUsedCents, 5); assert.equal(summary.capabilities.reservedBytes, 0); assert.equal(f.queue.length, 0);
  f.calls.failEnqueue = true; assert.equal((await f.call(`/variants/${variant.id}/render`, { recipeRevision: 1 })).status, 503);
  summary = await (await f.call()).json(); assert.equal(summary.jobs.length, 1); assert.equal(summary.jobs[0].status, "queued"); assert.equal(summary.capabilities.monthlyUsedCents, 15); assert.equal(summary.capabilities.reservedBytes, 270 * 1024 * 1024);
  f.calls.failEnqueue = false; assert.equal((await f.call(`/variants/${variant.id}/render`, { recipeRevision: 1 })).status, 200);
  assert.equal((await (await f.call()).json()).capabilities.monthlyUsedCents, 15);
});

test("method/origin/storage gates reject before consuming media or budget", async t => {
  const f = fixture(t);
  assert.equal((await f.call("", undefined, { method: "PATCH", raw: "{}" })).status, 405);
  assert.equal((await f.call("/uploads", { name: "x.mp4", size: 1, mime: "video/mp4" }, { headers: { Origin: "https://evil.invalid" } })).status, 403);
  assert.equal((await f.call("", undefined, { headers: { "Sec-Fetch-Site": "cross-site" } })).status, 403);
  assert.equal((await f.call("/uploads", { name: "x.svg", size: 1, mime: "image/svg+xml" })).status, 415);
  assert.equal((await f.call("/uploads", { name: "x.mp4", size: 262144001, mime: "video/mp4" })).status, 413);
  f.sql.prepare("UPDATE marker_studio_limits SET stored_bytes=2147483648").run();
  assert.equal((await f.call("/uploads", { name: "x.mp4", size: 1, mime: "video/mp4" })).status, 409);
  assert.equal(f.calls.probe, 0); assert.equal(f.calls.render, 0);
});

test("actual owner auth denies a distinct non-owner actor and forged session before hosted Studio access", async t => {
  const f = fixture(t), pending = [], ctx = { waitUntil(promise) { pending.push(promise); } };
  async function auth(path, body, cookie = "") { const response = await handleOwnerAuth(new Request(ORIGIN + "/api/auth/" + path, { method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json", "X-Marker-Auth": "1", "CF-Connecting-IP": "192.0.2.3", Cookie: cookie }, body: JSON.stringify(body) }), f.env, ctx); await Promise.all(pending.splice(0)); return response; }
  const outsider = await auth("request", { email: "outsider@example.invalid" }); assert.equal(outsider.status, 202); assert.equal(f.mails.length, 0);
  const owner = await auth("request", { email: "owner@example.invalid" }); assert.equal(f.mails.length, 1);
  const challenge = owner.headers.getSetCookie().find(value => value.startsWith("__Host-marker_challenge="))?.split(";")[0];
  const verified = await auth("verify", { code: f.mails[0].text.match(/\b\d{8}\b/)[0] }, challenge); assert.equal(verified.status, 200);
  const session = verified.headers.getSetCookie().find(value => value.startsWith("__Host-marker_session="))?.split(";")[0];
  const request = cookie => new Request(ORIGIN + "/api/studio", { headers: { Origin: ORIGIN, Cookie: cookie } });
  assert.equal(await authorizedOwner(request("__Host-marker_session=forged"), f.env), false);
  assert.equal(await authorizedOwner(request(""), f.env), false);
  assert.equal(await authorizedOwner(request(session), f.env), true);
  const result = await hostedStudioApi(request(session), f.env, f.workspace); assert.equal(result.status, 200);
});

test("planner previews are free, server-recomputed saves reject stale fingerprints and preserve trusted provenance", async t => {
  const f=fixture(t), {variant,material}=await f.mediaVariant();
  await f.command("material.save",{id:material.id,review:"ready",speech:"absent",roles:["background"]});
  const input={campaignId:variant.campaignId,variantId:variant.id,candidateIds:[material.id],includeShared:true,platform:"Instagram",template:"overlay",hook:"",body:"Orden",cta:"",duration:10,lockedSelections:[],reviewedMaterialIds:[],allowReuse:false,muteBackground:true,audio:"mute"};
  const before=(await (await f.call()).json()).capabilities.monthlyUsedCents;
  const preview=await f.call("/plan",input); assert.equal(preview.status,200); const planned=await preview.json(); assert.ok(planned.proposals.length);
  assert.equal((await (await f.call()).json()).capabilities.monthlyUsedCents,before);
  const stale=await f.command("variant.plan",{id:variant.id,request:input,fingerprint:"forged",alternative:0}); assert.equal(stale.status,409);
  const saved=await f.command("variant.plan",{id:variant.id,request:input,fingerprint:planned.fingerprint,alternative:0,recipe:{body:"injected"}}); assert.equal(saved.status,200);
  const next=(await saved.json()).state.variants[0]; assert.equal(next.body,"Orden"); assert.equal(next.planner.inputFingerprint,planned.fingerprint);
  const render=await f.call(`/variants/${variant.id}/render`,{recipeRevision:next.recipeRevision}); assert.equal(render.status,202); const queued=(await render.json()).job;
  await executeHostedRender(f.env,queued.id,f.processor);
  const receipt=(await (await f.call(`/jobs/${queued.id}`)).json()).receipt; assert.equal(receipt.planner.inputFingerprint,planned.fingerprint);
  const reused=await f.call(`/variants/${variant.id}/render`,{recipeRevision:next.recipeRevision}); assert.equal((await reused.json()).job.id,queued.id); assert.equal(f.calls.render,1);
  const regenerated=await f.call(`/variants/${variant.id}/render`,{recipeRevision:next.recipeRevision,regenerate:true}); assert.equal(regenerated.status,202); assert.notEqual((await regenerated.json()).job.id,queued.id);
});

test("hosted analysis remains disabled until a reviewed native toolchain is pinned", async t=>{
  const f=fixture(t),{asset}=await f.mediaVariant(); const before=(await (await f.call()).json()).capabilities;
  assert.equal(before.analysis,false);
  const denied=await f.call("/analyses",{assetId:asset.id,start:0,end:5,confirmed:true}); assert.equal(denied.status,503); assert.equal((await denied.json()).code,"analysis_toolchain_unverified");
  assert.equal((await (await f.call()).json()).capabilities.monthlyUsedCents,before.monthlyUsedCents); assert.equal(f.calls.analysis,0);
});

// This separate module instance changes only the test source's hosted version pin.
// No application configuration or deployed capability is changed by the fixture.
async function verifiedAnalysisModule() {
  const hook=registerHooks({
    resolve(specifier,context,next){if(specifier==="../src/core/studio-analysis.ts"&&context.parentURL?.includes("analysis-fixture"))return{url:new URL("../src/core/studio-analysis.ts?analysis-fixture",context.parentURL).href,shortCircuit:true};return next(specifier,context);},
    load(url,context,next){if(url.endsWith("/src/core/studio-analysis.ts?analysis-fixture"))return{format:"module-typescript",source:readFileSync(new URL(url),"utf8").replace("ANALYSIS_HOSTED_TOOL_VERSION: string | null = null",`ANALYSIS_HOSTED_TOOL_VERSION: string | null = ${JSON.stringify(ANALYSIS_LOCAL_TESTED_TOOL_VERSION)}`),shortCircuit:true};return next(url,context);},
  });
  try{return await import("../server/studio-hosted.ts?analysis-fixture");}finally{hook.deregister();}
}

test("prepared analysis admission is atomic, cache hits are free and reservations reconcile once",async t=>{
  const verified=await verifiedAnalysisModule(), f=fixture(t,verified.hostedStudioApi),{asset}=await f.mediaVariant();
  const before=(await (await f.call()).json()).capabilities;
  f.failAt(3,"INSERT OR IGNORE INTO marker_studio_compute");
  assert.equal((await f.call("/analyses",{assetId:asset.id,start:0,end:5,confirmed:true})).status,503);
  assert.equal(Number(f.sql.prepare("SELECT COUNT(*) AS n FROM marker_studio_analysis").get().n),0);
  assert.equal((await (await f.call()).json()).capabilities.monthlyUsedCents,before.monthlyUsedCents);
  f.failAt(-1);
  const admitted=await f.call("/analyses",{assetId:asset.id,start:0,end:5,confirmed:true}); assert.equal(admitted.status,202); const entry=(await admitted.json()).analysis;
  assert.equal((await (await f.call()).json()).capabilities.monthlyUsedCents,before.monthlyUsedCents+5);
  const replay=await f.call("/analyses",{assetId:asset.id,start:0,end:5,confirmed:true}); assert.equal((await replay.json()).analysis.id,entry.id);
  await verified.executeHostedRender(f.env,entry.id,f.processor); await verified.executeHostedRender(f.env,entry.id,f.processor); assert.equal(f.calls.analysis,1);
  const loaded=(await (await f.call(`/analyses/${entry.id}`)).json()).analysis; assert.equal(loaded.status,"completed"); assert.equal(loaded.result.toolVersion,ANALYSIS_LOCAL_TESTED_TOOL_VERSION); assert.ok(loaded.thumbnails[0].url.startsWith("/api/studio/analyses/"));
  const current=await f.state(), material=current.materials[0],variant=current.variants[0];
  await f.command("material.save",{id:material.id,review:"ready",speech:"absent"});
  const planInput={campaignId:variant.campaignId,variantId:variant.id,candidateIds:[material.id],includeShared:true,platform:"Instagram",template:"overlay",hook:"",body:"Orden",cta:"",duration:5,lockedSelections:[{materialId:material.id,start:0,end:5}],reviewedMaterialIds:[material.id],allowReuse:false,muteBackground:true,audio:"mute",analysisIds:[entry.id]};
  assert.equal((await f.call("/plan",{...planInput,analysisIds:["missing"]})).status,409);
  assert.equal((await f.call("/plan",{...planInput,duration:6,lockedSelections:[{materialId:material.id,start:0,end:6}]})).status,409);
  const linked=await f.call("/plan",planInput);assert.equal(linked.status,200);assert.deepEqual((await linked.json()).proposals[0].provenance.analysisIds,[entry.id]);
  const cached=await (await f.call("/analyses",{assetId:asset.id,start:0,end:5,confirmed:true})).json(); assert.equal(cached.cached,true); assert.equal(cached.chargedCents,0);
  const cap=(await (await f.call()).json()).capabilities; assert.equal(cap.reservedBytes,0); assert.equal(cap.storageBytes,before.storageBytes+3); assert.equal(cap.monthlyUsedCents,before.monthlyUsedCents+5);
  assert.equal((await f.call(`/analyses/${entry.id}/thumb-0.jpg`)).headers.get("Content-Type"),"image/jpeg");
  assert.equal((await f.call(`/analyses/${entry.id}/thumb-5.jpg`)).status,404);
  f.calls.failAnalysis=true;
  const retry=(await (await f.call("/analyses",{assetId:asset.id,start:1,end:6,confirmed:true})).json()).analysis;
  await verified.executeHostedRender(f.env,retry.id,f.processor); await verified.executeHostedRender(f.env,retry.id,f.processor); assert.equal(f.calls.analysis,2);
  assert.equal((await (await f.call(`/analyses/${retry.id}`)).json()).analysis.status,"failed");
  f.sql.prepare("UPDATE marker_studio_compute SET used_cents=1000").run();
  assert.equal((await f.call("/analyses",{assetId:asset.id,start:2,end:7,confirmed:true})).status,429);
  f.sql.prepare("UPDATE marker_studio_compute SET used_cents=0").run();f.sql.prepare("UPDATE marker_studio_limits SET stored_bytes=?").run(2*1024**3);
  const full=await f.call("/analyses",{assetId:asset.id,start:2,end:7,confirmed:true});assert.equal(full.status,413);assert.equal((await full.json()).code,"storage_limit");
});

test("historical planner ceiling never blocks manual render, approval or export",async t=>{
  const f=fixture(t),{variant,asset,material}=await f.mediaVariant();
  const document=JSON.stringify({kind:"text-approval",status:"completed",receipt:{recipe:{clips:[{assetId:asset.id,start:0,end:1}]},sourceSnapshots:[]}});
  const insert=f.sql.prepare("INSERT INTO marker_studio_jobs(id,variant_id,recipe_revision,status,document) VALUES(?,?,1,'completed',?)");
  f.sql.exec("BEGIN");for(let index=0;index<5001;index++)insert.run(`history-${index}`,variant.id,document);f.sql.exec("COMMIT");
  const denied=await f.call("/plan",{campaignId:variant.campaignId,candidateIds:[material.id]});assert.equal(denied.status,413);assert.equal((await denied.json()).code,"planner_history_limit");
  const render=await f.call(`/variants/${variant.id}/render`,{recipeRevision:1});assert.equal(render.status,202);const job=(await render.json()).job;
  await executeHostedRender(f.env,job.id,f.processor);assert.equal((await f.call(`/variants/${variant.id}/approve`,{recipeRevision:1,jobId:job.id,confirmed:true})).status,200);assert.equal((await f.call(`/variants/${variant.id}/export`)).status,200);
});

test("analysis admission rejects an active upload atomically while its completion probe retains ownership",async t=>{
  const verified=await verifiedAnalysisModule(),f=fixture(t,verified.hostedStudioApi),{asset}=await f.mediaVariant();
  const uploading=await f.upload(new Uint8Array([44,55,66,77]),"next-phone.mov");
  const before=(await (await f.call()).json()).capabilities;
  const limitsBefore=f.sql.prepare("SELECT upload_token,compute_token,reserved_bytes FROM marker_studio_limits WHERE id=1").get();
  const queueBefore=[...f.queue],probesBefore=f.calls.probe;
  const rejected=await f.call("/analyses",{assetId:asset.id,start:0,end:5,confirmed:true});
  assert.equal(rejected.status,409);assert.equal((await rejected.json()).code,"processor_busy");
  assert.deepEqual(f.sql.prepare("SELECT upload_token,compute_token,reserved_bytes FROM marker_studio_limits WHERE id=1").get(),limitsBefore);
  assert.equal(Number(f.sql.prepare("SELECT COUNT(*) AS n FROM marker_studio_analysis").get().n),0);
  assert.equal((await (await f.call()).json()).capabilities.monthlyUsedCents,before.monthlyUsedCents);
  assert.deepEqual(f.queue,queueBefore);assert.equal(f.calls.analysis,0);
  const completed=await uploading.complete();assert.equal(completed.status,200);assert.equal(f.calls.probe,probesBefore+1);
  const afterProbe=(await (await f.call()).json()).capabilities;assert.equal(afterProbe.monthlyUsedCents,before.monthlyUsedCents+5);assert.equal(afterProbe.reservedBytes,0);
  const admitted=await f.call("/analyses",{assetId:asset.id,start:0,end:5,confirmed:true});assert.equal(admitted.status,202);
  await verified.executeHostedRender(f.env,(await admitted.json()).analysis.id,f.processor);assert.equal(f.calls.analysis,1);
});

test("owner settings validate exact fields, preserve usage and apply budget/storage caps without deleting originals",async t=>{
  const f=fixture(t),{variant,asset}=await f.mediaVariant(), defaults=defaultStudioSettings();
  const values=(({revision:_revision,...rest})=>rest)(defaults);
  const before=await(await f.call("/settings")).json();assert.equal(before.settings.revision,0);assert.equal(before.usage.processingUsedCents,5);assert.equal(before.ai.connected,false);
  assert.deepEqual(await(await f.call("/settings")).json(),before);
  for(const change of [{monthlyBudgetCents:2001},{processingBudgetCents:-1},{aiBudgetCents:0.5},{storageLimitBytes:2147483649},{defaultDurationSeconds:4},{defaultDurationSeconds:61},{processingBudgetCents:1500,aiBudgetCents:1000},{apiKey:"forbidden"},{monthlyBudgetCents:"20"}]){
    assert.equal((await f.call("/settings",{expectedRevision:0,settings:{...values,...change}})).status,400);
  }
  const budget={...values,monthlyBudgetCents:1000,processingBudgetCents:5,aiBudgetCents:500,defaultDurationSeconds:30};
  const saved=await f.call("/settings",{expectedRevision:0,settings:budget});assert.equal(saved.status,200);const snapshot=await saved.json();assert.equal(snapshot.settings.revision,1);assert.deepEqual(snapshot.usage,before.usage);
  const draft=await f.command("variant.save",{campaignId:variant.campaignId,template:"text",body:"Saved default"});assert.equal(draft.status,200);assert.equal((await draft.json()).state.variants.at(-1).duration,30);
  assert.equal((await f.call("/settings",{expectedRevision:0,settings:values})).status,409);
  assert.equal((await f.call(`/variants/${variant.id}/render`,{recipeRevision:1})).status,429);assert.equal(f.calls.render,0);
  const restricted={...values,processingBudgetCents:20,aiBudgetCents:1000,storageLimitBytes:0};
  assert.equal((await f.call("/settings",{expectedRevision:1,settings:restricted})).status,200);
  assert.equal((await f.call(`/variants/${variant.id}/render`,{recipeRevision:1})).status,413);
  assert.equal((await f.call("/uploads",{name:"blocked.mp4",mime:"video/mp4",size:1})).status,409);
  assert.equal((await f.call(`/assets/${asset.id}?download=1`)).status,200);assert.equal(f.blobs.size,1);
  const current=await(await f.call("/settings")).json();assert.equal(current.usage.processingUsedCents,5);assert.equal(current.usage.storageBytes,before.usage.storageBytes);assert.equal(current.settings.storageLimitBytes,0);assert.equal(current.ai.connected,false);
  assert.equal((await(await f.call()).json()).capabilities.monthlyBudgetCents,20);
});

test("settings CAS and upload admission serialize against current limits; active work prevents policy changes",async t=>{
  const f=fixture(t),defaults=defaultStudioSettings(),{revision:_revision,...values}=defaults;
  const [settings,upload]=await Promise.all([
    f.call("/settings",{expectedRevision:0,settings:{...values,storageLimitBytes:0}}),
    f.call("/uploads",{name:"race.mp4",mime:"video/mp4",size:3}),
  ]);
  assert.ok(settings.status===200&&upload.status===409||settings.status===409&&upload.status===201);
  if(upload.status===201){const pending=(await upload.json()).upload;assert.equal((await settings.json()).code,"settings_busy");assert.equal((await f.call(`/uploads/${pending.id}`,undefined,{method:"DELETE"})).status,200);}
  const current=(await(await f.call("/settings")).json()).settings;
  assert.equal((await f.call("/settings",{expectedRevision:current.revision,settings:values})).status,200);
  const media=await f.mediaVariant();const queued=await f.call(`/variants/${media.variant.id}/render`,{recipeRevision:1});const job=(await queued.json()).job;
  const at=(await(await f.call("/settings")).json()).settings;
  const denied=await f.call("/settings",{expectedRevision:at.revision,settings:{...values,processingBudgetCents:0}});assert.equal(denied.status,409);assert.equal((await denied.json()).code,"settings_busy");
  await executeHostedRender(f.env,job.id,f.processor);
  assert.equal((await f.call("/settings",{expectedRevision:at.revision,settings:{...values,processingBudgetCents:0}})).status,200);
  const guest=await nativeApi(new Request(ORIGIN+"/api/studio/settings",{headers:{Origin:ORIGIN}}),f.env,{waitUntil(){}});assert.equal(guest.status,401);
});
