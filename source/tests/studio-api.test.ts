import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, appendFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { emptyWorkspace } from "../src/core/domain.ts";
import { createStudioApi } from "../server/studio-local.ts";
import type { StudioState } from "../src/core/studio.ts";
import type { MediaTools } from "../server/studio-render.ts";
import { defaultStudioSettings } from "../src/core/settings.ts";

const workspace = emptyWorkspace();
workspace.products.push({ id: "timeker", name: "timeKER", description: "", audience: "", language: "es", tone: "", cta: "", url: "", status: "available" });
const unavailableTools = { ffmpeg: resolve(".local/missing-ffmpeg"), ffprobe: resolve(".local/missing-ffprobe") };
async function fixture(tools: MediaTools = unavailableTools) {
  const directory = await mkdtemp(join(tmpdir(), "marker-studio-api-"));
  let api = createStudioApi({ directory, tools });
  const request = (path: string, method = "GET", data?: unknown, headers = {}) => api.handle(new Request(`http://127.0.0.1:5185/api/studio${path}`, { method, headers: { ...(data !== undefined ? { "content-type": "application/json" } : {}), ...headers }, ...(data !== undefined ? { body: JSON.stringify(data) } : {}) }), workspace) as Promise<Response>;
  const chunk = (id: string, offset: number, value: Uint8Array) => api.handle(new Request(`http://127.0.0.1:5185/api/studio/uploads/${id}`, { method: "PUT", headers: { "content-type": "application/octet-stream", "upload-offset": String(offset) }, body: new Uint8Array(value) }), workspace) as Promise<Response>;
  return { directory, request, chunk, async restart() { await api.close(); api = createStudioApi({ directory, tools }); }, async close() { await api.close(); await rm(directory, { recursive: true, force: true }); } };
}
async function command(f: Awaited<ReturnType<typeof fixture>>, type: string, data: Record<string, unknown>, revision?: number) {
  const current = await (await f.request("")).json() as { state: StudioState };
  const response = await f.request("/commands", "POST", { expectedRevision: revision ?? current.state.revision, command: { type, data } });
  return { response, body: await response.json() as { state: StudioState; error?: string; code?: string } };
}

test("uploads resume after restart, reject conflicting chunks, preserve unsupported originals, and reuse exact duplicates", async () => {
  const f = await fixture();
  try {
    const bytes = new TextEncoder().encode("original bytes; unsupported but retained");
    const initial = await f.request("/uploads", "POST", { name: "clip.mp4", mime: "video/mp4", size: bytes.length });
    assert.equal(initial.status, 201);
    const { upload } = await initial.json();
    assert.equal((await f.request("/uploads", "POST", { name: "other.mp4", mime: "video/mp4", size: 20 })).status, 409);
    assert.equal((await f.chunk(upload.id, 1, bytes.slice(0, 10))).status, 409);
    assert.equal((await f.chunk(upload.id, 0, bytes.slice(0, 10))).status, 200);
    // Simulate bytes flushed immediately before a crash but not committed to SQLite.
    await appendFile(join(f.directory, "uploads", upload.id), "uncommitted trailing bytes");
    await f.restart();
    const progress = await (await f.request(`/uploads/${upload.id}`)).json();
    assert.equal(progress.upload.offset, 10);
    assert.equal((await f.request(`/uploads/${upload.id}/complete`, "POST", {})).status, 409);
    assert.equal((await f.chunk(upload.id, 10, bytes.slice(10))).status, 200);
    const complete = await f.request(`/uploads/${upload.id}/complete`, "POST", {});
    assert.equal(complete.status, 200);
    const saved = await complete.json();
    assert.equal(saved.asset.processing, "unsupported");
    assert.equal(saved.asset.audioTrack, "unknown");
    assert.equal(saved.state.assets.length, 1);
    assert.deepEqual(new Uint8Array(await (await f.request(`/assets/${saved.asset.id}`)).arrayBuffer()), bytes);
    const range = await f.request(`/assets/${saved.asset.id}`, "GET", undefined, { range: "bytes=3-8" });
    assert.equal(range.status, 206);
    assert.equal(range.headers.get("content-range"), `bytes 3-8/${bytes.length}`);
    assert.deepEqual(new Uint8Array(await range.arrayBuffer()), bytes.slice(3, 9));
    assert.equal((await f.request(`/assets/${saved.asset.id}`, "GET", undefined, { range: "bytes=999-" })).status, 416);
    assert.match((await f.request(`/assets/${saved.asset.id}?download=1`)).headers.get("content-disposition")!, /attachment/);
    const second = await (await f.request("/uploads", "POST", { name: "renamed.mp4", mime: "video/mp4", size: bytes.length })).json();
    await f.chunk(second.upload.id, 0, bytes);
    const duplicate = await (await f.request(`/uploads/${second.upload.id}/complete`, "POST", {})).json();
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.asset.id, saved.asset.id);
    assert.equal(duplicate.state.revision, saved.state.revision);
    assert.equal(duplicate.state.assets.length, 1);
    assert.equal((await f.request(`/uploads/${second.upload.id}/complete`, "POST", {})).status, 200);
  } finally { await f.close(); }
});

test("upload bounds, cancellation and origin guards do not mutate library state", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.request("/uploads", "POST", { name: "huge.mp4", mime: "video/mp4", size: 250 * 1024 * 1024 + 1 })).status, 413);
    assert.equal((await f.request("/uploads", "POST", { name: "x.svg", mime: "image/svg+xml", size: 10 })).status, 415);
    assert.equal((await f.request("/uploads", "POST", { name: "x.mp4", mime: "video/mp4", size: 10 }, { origin: "https://other.example" })).status, 403);
    const { upload } = await (await f.request("/uploads", "POST", { name: "x.mp4", mime: "video/mp4", size: 10 })).json();
    assert.equal((await f.chunk(upload.id, 0, new Uint8Array(11))).status, 413);
    assert.equal((await (await f.request(`/uploads/${upload.id}`)).json()).upload.offset, 0);
    assert.equal((await f.request(`/uploads/${upload.id}`, "DELETE")).status, 200);
    assert.equal((await f.chunk(upload.id, 0, new Uint8Array(10))).status, 409);
    const recorded = await f.request("/uploads", "POST", { name: "voice.webm", mime: "audio/webm;codecs=opus", size: 10 });
    assert.equal(recorded.status, 201);
    const recordedValue = await recorded.json();
    assert.equal(recordedValue.upload.mime, "audio/webm");
    await f.request(`/uploads/${recordedValue.upload.id}`, "DELETE");
    const emptyMime = await f.request("/uploads", "POST", { name: "phone.MOV", mime: "", size: 10 });
    assert.equal(emptyMime.status, 201);
    assert.equal((await emptyMime.json()).upload.mime, "video/quicktime");
    assert.equal((await (await f.request("")).json()).state.revision, 0);
  } finally { await f.close(); }
});

test("CAS commands, explicit text approval, editable recipes and rights revocation govern export", async () => {
  const f = await fixture();
  try {
    const results = await Promise.all([
      command(f, "material.save", { kind: "text", text: "Manual source", rights: "owned" }, 0),
      command(f, "material.save", { kind: "idea", text: "Concurrent idea" }, 0),
    ]);
    assert.deepEqual(results.map((entry) => entry.response.status).sort(), [200, 409]);
    const state = (await (await f.request("")).json()).state as StudioState;
    const source = state.materials[0];
    const campaign = await command(f, "campaign.save", { productId: "timeker", title: "Clients" });
    const prepared = await command(f, "variant.save", { campaignId: campaign.body.state.campaigns[0].id, template: "text", platform: "LinkedIn", body: "A manual, developed draft.", sourceIds: [source.id] });
    const variant = prepared.body.state.variants[0];
    assert.equal((await f.request(`/variants/${variant.id}/export`)).status, 409);
    assert.equal((await command(f, "variant.approve", { id: variant.id, confirmed: true })).response.status, 400);
    assert.equal((await f.request(`/variants/${variant.id}/approve`, "POST", { recipeRevision: 1, confirmed: false })).status, 400);
    const approval = await f.request(`/variants/${variant.id}/approve`, "POST", { recipeRevision: 1, confirmed: true });
    assert.equal(approval.status, 200);
    const exported = await f.request(`/variants/${variant.id}/export`);
    assert.equal(exported.status, 200);
    assert.equal(await exported.text(), "A manual, developed draft.");
    await command(f, "material.save", { ...source, rights: "unknown" });
    assert.equal((await f.request(`/variants/${variant.id}/export`)).status, 409);
    await command(f, "material.save", { ...source, rights: "owned" });
    const edited = await command(f, "variant.save", { ...variant, body: "Changed manual draft." });
    assert.equal(edited.body.state.variants[0].recipeRevision, 2);
    assert.equal((await f.request(`/variants/${variant.id}/approve`, "POST", { recipeRevision: 1, confirmed: true })).status, 409);
    assert.equal((await f.request(`/variants/${variant.id}/export`)).status, 409);
    await f.restart();
    assert.equal((await (await f.request("")).json()).state.variants[0].body, "Changed manual draft.");
  } finally { await f.close(); }
});

test("restart marks incomplete local jobs failed and the prepared D1 migration stays independent of workspace JSON", async () => {
  const f = await fixture();
  try {
    await f.restart();
    const db = new DatabaseSync(join(f.directory, "studio.sqlite"));
    const job = { id: "interrupted", variantId: "variant", recipeRevision: 1, status: "running", createdAt: "2026-10-23T00:00:00Z", updatedAt: "2026-10-23T00:00:00Z" };
    db.prepare("INSERT INTO studio_jobs VALUES(?,?,?,?)").run(job.id, job.variantId, 1, JSON.stringify(job));
    db.close();
    await f.restart();
    const loaded = await (await f.request("/jobs/interrupted")).json();
    assert.equal(loaded.job.status, "failed");
    assert.match(loaded.job.error, /interrumpido/);
    assert.equal(loaded.job.provenance, "unknown");
    assert.deepEqual(loaded.job.sourceRefs, []);
    assert.equal(loaded.receipt, undefined);
    const sql = await readFile(new URL("../migrations-d1/0002_studio.sql", import.meta.url), "utf8");
    const memory = new DatabaseSync(":memory:");
    memory.exec(sql);
    const tables = memory.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    assert.ok(tables.some((row) => row.name === "marker_studio_assets"));
    assert.ok(tables.some((row) => row.name === "marker_studio_variants"));
    assert.ok(!tables.some((row) => row.name === "marker_workspace"));
    memory.close();
  } finally { await f.close(); }
});

test("real local jobs are idempotent, preserve stale previews, require exact-recipe approval and export playable MP4", { timeout: 120_000 }, async () => {
  const f = await fixture({
    ffmpeg: process.env.MARKER_FFMPEG ?? resolve(".local/tools/ffmpeg/bin/ffmpeg.exe"),
    ffprobe: process.env.MARKER_FFPROBE ?? resolve(".local/tools/ffmpeg/bin/ffprobe.exe"),
    font: process.env.MARKER_FONT ?? resolve("Font/Montserrat_Complete/Fonts/WEB/fonts/Montserrat-Medium.ttf"),
  });
  try {
    // A synthetic 2x2 BMP is a real decodable photo, independent of network/files.
    const bitmap = Buffer.alloc(70, 0);
    bitmap.write("BM", 0); bitmap.writeUInt32LE(70, 2); bitmap.writeUInt32LE(54, 10);
    bitmap.writeUInt32LE(40, 14); bitmap.writeInt32LE(2, 18); bitmap.writeInt32LE(2, 22);
    bitmap.writeUInt16LE(1, 26); bitmap.writeUInt16LE(24, 28); bitmap.writeUInt32LE(16, 34);
    for (const at of [54, 57, 62, 65]) bitmap[at + 2] = 255;
    const created = await (await f.request("/uploads", "POST", { name: "synthetic.bmp", mime: "image/bmp", size: bitmap.length })).json();
    await f.chunk(created.upload.id, 0, bitmap);
    const completed = await (await f.request(`/uploads/${created.upload.id}/complete`, "POST", {})).json();
    assert.equal(completed.asset.processing, "ready");
    assert.equal(completed.asset.width, 2);
    const material = await command(f, "material.save", { kind: "image", assetId: completed.asset.id, rights: "owned" });
    const materialId = material.body.state.materials[0].id;
    const campaign = await command(f, "campaign.save", { productId: "timeker", title: "Synthetic campaign" });
    const prepared = await command(f, "variant.save", { campaignId: campaign.body.state.campaigns[0].id, template: "overlay", platform: "Instagram", duration: 5, body: "A manual test.", sourceIds: [materialId], selections: [{ materialId, start: 0, end: 5 }] });
    const variant = prepared.body.state.variants[0];
    const first = await f.request(`/variants/${variant.id}/render`, "POST", { recipeRevision: 1 });
    assert.equal(first.status, 202);
    const firstJob = (await first.json()).job;
    const replay = await (await f.request(`/variants/${variant.id}/render`, "POST", { recipeRevision: 1 })).json();
    assert.equal(replay.job.id, firstJob.id);
    const changed = await command(f, "variant.save", { ...variant, body: "Changed text requires a new preview." });
    assert.equal(changed.body.state.variants[0].recipeRevision, 2);
    async function waitJob(id: string) {
      const deadline = Date.now() + 60_000;
      while (Date.now() < deadline) {
        const loaded = await (await f.request(`/jobs/${id}`)).json();
        if (loaded.job.status === "completed" || loaded.job.status === "failed") return loaded.job;
        await new Promise((resolveWait) => setTimeout(resolveWait, 50));
      }
      throw new Error("Synthetic render exceeded its test deadline");
    }
    const stale = await waitJob(firstJob.id);
    assert.equal(stale.status, "completed", stale.error);
    assert.equal((await f.request(`/variants/${variant.id}/approve`, "POST", { recipeRevision: 2, jobId: firstJob.id, confirmed: true })).status, 409);
    assert.equal((await f.request(`/variants/${variant.id}/render`, "POST", { recipeRevision: 1 })).status, 409);
    const next = await (await f.request(`/variants/${variant.id}/render`, "POST", { recipeRevision: 2 })).json();
    assert.notEqual(next.job.id, firstJob.id);
    const rendered = await waitJob(next.job.id);
    assert.equal(rendered.status, "completed", rendered.error);
    assert.equal(rendered.width, 1080); assert.equal(rendered.height, 1920);
    assert.equal((await f.request(`/variants/${variant.id}/export`)).status, 409);
    assert.equal((await f.request(`/variants/${variant.id}/approve`, "POST", { recipeRevision: 2, jobId: next.job.id, confirmed: true })).status, 200);
    const video = await f.request(`/variants/${variant.id}/export`);
    assert.equal(video.status, 200);
    const mp4 = Buffer.from(await video.arrayBuffer());
    assert.match(mp4.subarray(0, 32).toString("latin1"), /ftyp/);
    const cover = await f.request(`/jobs/${next.job.id}/cover`);
    assert.equal(cover.headers.get("content-type"), "image/png");
    assert.equal(Buffer.from(await cover.arrayBuffer()).subarray(1, 4).toString(), "PNG");
    assert.equal((await f.request(`/jobs/${firstJob.id}/video`)).status, 200);
    assert.equal((await command(f, "material.delete", { id: materialId, confirmed: true })).response.status, 409);
    const receipt = (await (await f.request(`/jobs/${firstJob.id}`)).json()).receipt;
    assert.equal(receipt.recipe.body, "A manual test.");
    assert.deepEqual(receipt.sourceSnapshots.map((source: { materialId: string }) => source.materialId), [materialId]);
    const saved = (await (await f.request("")).json()).state as StudioState;
    await command(f, "variant.save", { ...saved.variants[0], template: "text", sourceIds: [], selections: [], body: "New recipe without the old original." });
    const historical = await f.request(`/jobs/${firstJob.id}`);
    assert.deepEqual((await historical.json()).receipt, receipt);
    const blocked = await command(f, "material.delete", { id: materialId, confirmed: true });
    assert.equal(blocked.response.status, 409);
    assert.equal(blocked.body.code, "material_historical_use");
    await f.restart();
    assert.deepEqual((await (await f.request(`/jobs/${firstJob.id}`)).json()).receipt, receipt);
  } finally { await f.close(); }
});

test("text approval atomically records immutable usage and older-than-list history remains counted", async () => {
  const f = await fixture();
  try {
    let state = (await command(f, "material.save", { kind: "text", text: "Original source copy", rights: "owned" })).body.state;
    const source = state.materials[0];
    state = (await command(f, "material.save", { kind: "text", text: "Replacement source", rights: "owned" })).body.state;
    const replacement = state.materials[1];
    state = (await command(f, "campaign.save", { productId: "timeker" })).body.state;
    state = (await command(f, "variant.save", { campaignId: state.campaigns[0].id, template: "text", platform: "LinkedIn", sourceIds: [source.id], body: "Exact approved manual copy." })).body.state;
    const variant = state.variants[0];
    const failedApproval = await f.request(`/variants/${variant.id}/approve`, "POST", { recipeRevision: 1, confirmed: false });
    assert.equal(failedApproval.status, 400);
    assert.equal((await (await f.request("")).json()).jobs.length, 0);
    const approved = await f.request(`/variants/${variant.id}/approve`, "POST", { recipeRevision: 1, confirmed: true });
    assert.equal(approved.status, 200);
    const approval = await approved.json();
    assert.equal(approval.state.variants[0].status, "approved");
    assert.equal(approval.job.kind, "text-approval");
    const receiptId = approval.job.id;
    const detail = await (await f.request(`/jobs/${receiptId}`)).json();
    assert.equal(detail.receipt.recipe.body, "Exact approved manual copy.");
    assert.equal(detail.receipt.sourceSnapshots[0].text, "Original source copy");
    const repeated = await (await f.request(`/variants/${variant.id}/approve`, "POST", { recipeRevision: 1, confirmed: true })).json();
    assert.equal(repeated.job.id, receiptId);
    await command(f, "variant.save", { ...variant, sourceIds: [replacement.id], body: "Changed recipe copy." });
    await command(f, "material.save", { ...source, text: "Source edited later" });
    assert.deepEqual((await (await f.request(`/jobs/${receiptId}`)).json()).receipt, detail.receipt);
    const deletion = await command(f, "material.delete", { id: source.id, confirmed: true });
    assert.equal(deletion.response.status, 409);
    assert.equal(deletion.body.code, "material_historical_use");
    // Populate bounded synthetic receipts to move the real approval off the
    // 100-summary window, without pretending these fixtures are rendered files.
    const db = new DatabaseSync(join(f.directory, "studio.sqlite"));
    db.exec("BEGIN");
    const insert = db.prepare("INSERT INTO studio_jobs VALUES(?,?,?,?)");
    for (let index = 0; index < 101; index++) {
      const seeded = { id: `summary-fixture-${index}`, variantId: `summary-variant-${index}`, recipeRevision: 1, kind: "text-approval", status: "completed", createdAt: "2026-10-23T00:00:00Z", updatedAt: "2026-10-23T00:00:00Z", receipt: { recipe: { variantId: `summary-variant-${index}`, recipeRevision: 1, template: "text", platform: "LinkedIn", campaignId: "fixture", hook: "", body: "Synthetic history fixture", cta: "" }, sourceSnapshots: [] } };
      insert.run(seeded.id, seeded.variantId, 1, JSON.stringify(seeded));
    }
    db.exec("COMMIT"); db.close();
    const listed = await (await f.request("")).json();
    assert.equal(listed.jobs.length, 100);
    assert.ok(!listed.jobs.some((job: { id: string }) => job.id === receiptId));
    assert.equal(listed.usage[source.id], 1);
    assert.equal(listed.usage[replacement.id], 1);
    assert.ok(listed.jobs.every((job: Record<string, unknown>) => !Object.hasOwn(job, "receipt")));
    await f.restart();
    assert.deepEqual((await (await f.request(`/jobs/${receiptId}`)).json()).receipt, detail.receipt);
    assert.equal((await (await f.request("")).json()).usage[source.id], 1);
  } finally { await f.close(); }
});

test("local explicit audio analysis caches actual bounded signals without changing human classifications",{timeout:30000},async()=>{
  const f=await fixture({ffmpeg:process.env.MARKER_FFMPEG??resolve(".local/tools/ffmpeg/bin/ffmpeg.exe"),ffprobe:process.env.MARKER_FFPROBE??resolve(".local/tools/ffmpeg/bin/ffprobe.exe")});
  try{
    const samples=16000*4, wav=Buffer.alloc(44+samples*2); wav.write("RIFF");wav.writeUInt32LE(wav.length-8,4);wav.write("WAVEfmt ",8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(16000,24);wav.writeUInt32LE(32000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write("data",36);wav.writeUInt32LE(samples*2,40);
    const upload=await(await f.request("/uploads","POST",{name:"synthetic-silence.wav",mime:"audio/wav",size:wav.length})).json();await f.chunk(upload.upload.id,0,wav);
    const completed=await(await f.request(`/uploads/${upload.upload.id}/complete`,"POST",{})).json();assert.equal(completed.asset.processing,"ready");
    const asset=completed.asset, before=completed.state;
    assert.equal((await f.request("/analyses","POST",{assetId:asset.id,start:0,end:4})).status,400);
    const started=await f.request("/analyses","POST",{assetId:asset.id,start:0,end:4,confirmed:true});assert.equal(started.status,202);const entry=(await started.json()).analysis;
    let result;const deadline=Date.now()+10000;
    while(Date.now()<deadline){result=(await(await f.request(`/analyses/${entry.id}`)).json()).analysis;if(["completed","failed"].includes(result.status))break;await new Promise(resolveWait=>setTimeout(resolveWait,20));}
    assert.equal(result.status,"completed",result.error);assert.ok(result.result.intervals.some(interval=>interval.kind==="silence"));assert.equal("speech" in result.result,false);
    const cached=await(await f.request("/analyses","POST",{assetId:asset.id,start:0,end:4,confirmed:true})).json();assert.equal(cached.cached,true);assert.equal(cached.analysis.id,entry.id);assert.equal(cached.chargedCents,0);
    assert.deepEqual((await(await f.request("")).json()).state,before);
    assert.equal((await f.request(`/analyses/${entry.id}/thumb-0.jpg`)).status,404);
    await f.restart();const retained=(await(await f.request(`/analyses/${entry.id}`)).json()).analysis;assert.deepEqual(retained.result,result.result);
  }finally{await f.close();}
});

test("local owner settings persist defaults and revisions while storage caps preserve saved originals",async()=>{
  const f=await fixture();
  try{
    const initial=await(await f.request("/settings")).json();assert.deepEqual(initial.settings,defaultStudioSettings());assert.equal(initial.usage.processingUsedCents,0);assert.equal(initial.ai.connected,false);
    const {revision:_revision,...values}=initial.settings;
    const started=await(await f.request("/uploads","POST",{name:"original.mp4",mime:"video/mp4",size:3})).json();
    const busy=await f.request("/settings","POST",{expectedRevision:0,settings:{...values,storageLimitBytes:0}});assert.equal(busy.status,409);assert.equal((await busy.json()).code,"settings_busy");
    await f.chunk(started.upload.id,0,new Uint8Array([1,2,3]));const completed=await(await f.request(`/uploads/${started.upload.id}/complete`,"POST",{})).json();
    const saved=await f.request("/settings","POST",{expectedRevision:0,settings:{...values,aiBudgetCents:500,storageLimitBytes:0,defaultDurationSeconds:30}});assert.equal(saved.status,200);
    const snapshot=await saved.json();assert.equal(snapshot.settings.revision,1);assert.equal(snapshot.usage.storageBytes,3);assert.equal(snapshot.ai.connected,false);
    assert.equal((await f.request("/settings","POST",{expectedRevision:0,settings:values})).status,409);
    assert.equal((await f.request("/settings","POST",{expectedRevision:1,settings:{...values,aiBudgetCents:2001}})).status,400);
    assert.equal((await f.request("/uploads","POST",{name:"blocked.mp4",mime:"video/mp4",size:1})).status,413);
    assert.equal((await f.request(`/assets/${completed.asset.id}?download=1`)).status,200);
    assert.equal((await(await f.request("")).json()).capabilities.defaultDurationSeconds,30);
    await f.restart();assert.deepEqual((await(await f.request("/settings")).json()).settings,snapshot.settings);assert.deepEqual((await(await f.request("")).json()).state,completed.state);
  }finally{await f.close();}
});
