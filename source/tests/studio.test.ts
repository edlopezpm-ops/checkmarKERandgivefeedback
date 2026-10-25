import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyWorkspace } from "../src/core/domain.ts";
import { applyStudioCommand, assertStudioExportable, buildRenderSpec, emptyStudio, registerStudioAsset, materialUses } from "../src/core/studio.ts";
import type { StudioState, StudioAsset } from "../src/core/studio.ts";

const now = "2026-10-23T20:00:00.000Z";
const workspace = emptyWorkspace();
workspace.products.push({ id: "timeker", name: "timeKER", description: "", audience: "", language: "es", tone: "", cta: "", url: "", status: "available" });
let sequence = 0;
function apply(state: StudioState, type: string, data: Record<string, unknown>, extra = {}) {
  return applyStudioCommand(state, workspace, { type, data }, { now, newId: () => `id-${++sequence}`, ...extra });
}
function asset(id = "video-1", overrides = {}): StudioAsset {
  return { id, name: "kitchen.mp4", mime: "video/mp4", size: 100, sha256: "a".repeat(64), kind: "video", duration: 32, width: 1080, height: 1920, audioTrack: "present", processing: "ready", createdAt: now, ...overrides };
}
function fixture() {
  let state = registerStudioAsset(emptyStudio(), asset());
  state = apply(state, "material.save", { kind: "video", assetId: "video-1", title: "Kitchen", rights: "owned", speech: "absent" });
  const materialId = state.materials[0].id;
  state = apply(state, "campaign.save", { productId: "timeker", title: "Prepare client work" });
  const campaignId = state.campaigns[0].id;
  state = apply(state, "variant.save", { campaignId, platform: "Instagram", template: "overlay", body: "I write down the next step for each client.", hook: "Too many clients?", cta: "Meet timeKER", duration: 20, sourceIds: [materialId], selections: [{ materialId, start: 4, end: 24 }] });
  return { state, materialId, campaignId, variantId: state.variants[0].id };
}

test("capture accepts an unassigned incomplete idea and separates audio from speech", () => {
  const state = apply(emptyStudio(), "material.save", { kind: "idea", text: "motivation working alone" });
  assert.deepEqual(state.materials[0].productIds, []);
  assert.deepEqual(state.materials[0].categories, ["idea"]);
  assert.deepEqual(state.materials[0].roles, ["message"]);
  assert.equal(state.materials[0].review, "unreviewed");
  assert.equal(state.materials[0].speech, "unknown");
  const captured = fixture().state;
  assert.equal(captured.assets[0].audioTrack, "present");
  assert.equal(captured.materials[0].speech, "absent");
});

test("campaign preparation needs a real product but no social account, sources or complete objective", () => {
  const state = apply(emptyStudio(), "campaign.save", { productId: "timeker" });
  assert.equal(state.campaigns.length, 1);
  assert.equal(workspace.accounts.length, 0);
  assert.throws(() => apply(state, "campaign.save", { productId: "missing" }), /existe/);
  const paid = apply(state, "campaign.save", { productId: "timeker", kind: "paid" });
  assert.equal(paid.campaigns[1].status, "paused");
});

test("recipes preserve exact source versions and labels remain editable after reuse", () => {
  let { state, materialId, variantId } = fixture();
  const original = structuredClone(state.variants[0].sourceSnapshots);
  state = apply(state, "material.save", { ...state.materials[0], topics: ["clients", "motivation"], title: "New label" });
  assert.equal(state.materials[0].contentVersion, 1);
  assert.deepEqual(state.variants[0].sourceSnapshots, original);
  state = apply(state, "variant.save", { ...state.variants[0], id: undefined });
  assert.equal(materialUses(state, materialId).length, 2);
  assert.throws(() => apply(state, "material.delete", { id: materialId, confirmed: true }), /uso|referenc|utiliz/);
  assert.throws(() => apply(state, "campaign.delete", { id: state.campaigns[0].id, confirmed: true }), /variante/);
  assert.equal(state.variants.find((item) => item.id === variantId)?.recipeRevision, 1);
});

test("changing source content versions does not rewrite an existing recipe", () => {
  const originalText = "  Original words\n\nwith spacing.  ";
  let state = apply(emptyStudio(), "material.save", { kind: "text", text: originalText, rights: "owned" });
  const materialId = state.materials[0].id;
  state = apply(state, "campaign.save", { productId: "timeker" });
  state = apply(state, "variant.save", { campaignId: state.campaigns[0].id, template: "text", platform: "LinkedIn", sourceIds: [materialId], body: originalText });
  assert.equal(state.materials[0].text, originalText);
  assert.equal(state.variants[0].body, originalText);
  state = apply(state, "material.save", { ...state.materials[0], text: "New words" });
  assert.equal(state.materials[0].contentVersion, 2);
  assert.equal(state.variants[0].sourceSnapshots[0].text, originalText);
  assert.equal(state.variants[0].sourceSnapshots[0].contentVersion, 1);
});

test("video approval requires a trusted exact-revision render and invalidates on editing", () => {
  let { state, variantId } = fixture();
  assert.throws(() => apply(state, "variant.approve", { id: variantId, confirmed: true, jobId: "forged" }), /render/);
  assert.throws(() => apply(state, "variant.approve", { id: variantId, confirmed: true }, { trustedRender: { variantId, recipeRevision: 0, jobId: "stale" } }), /render/);
  state = apply(state, "variant.approve", { id: variantId, confirmed: true }, { trustedRender: { variantId, recipeRevision: 1, jobId: "render-1" } });
  assert.equal(state.variants[0].status, "approved");
  assert.equal(state.variants[0].approvedJobId, "render-1");
  assert.equal(assertStudioExportable(state, variantId, "render-1").id, variantId);
  assert.throws(() => assertStudioExportable(state, variantId, "other-render"), /render/);
  state = apply(state, "variant.save", { ...state.variants[0] });
  assert.equal(state.variants[0].recipeRevision, 1);
  assert.equal(state.variants[0].status, "approved");
  state = apply(state, "variant.save", { ...state.variants[0], body: "Changed manual copy" });
  assert.equal(state.variants[0].recipeRevision, 2);
  assert.equal(state.variants[0].status, "draft");
  assert.equal(state.variants[0].approvedJobId, undefined);
  assert.throws(() => assertStudioExportable(state, variantId, "render-1"), /Aprueba/);
});

test("unknown rights, undeveloped ideas and absent manual copy cannot be approved", () => {
  let { state, variantId } = fixture();
  state = apply(state, "material.save", { ...state.materials[0], rights: "unknown" });
  assert.throws(() => apply(state, "variant.approve", { id: variantId, confirmed: true }, { trustedRender: { variantId, recipeRevision: 1, jobId: "job" } }), /derecho/);
  state = apply(state, "variant.save", { ...state.variants[0], template: "text", body: "" });
  assert.throws(() => apply(state, "variant.approve", { id: variantId, confirmed: true }), /texto/);
  state = apply(state, "variant.save", { ...state.variants[0], template: "text", body: "Manually developed idea", sourceIds: [], selections: [] });
  state = apply(state, "variant.approve", { id: variantId, confirmed: true });
  assert.equal(state.variants[0].status, "approved");
});

test("render specs preserve explicit ranges and do not treat silence as semantic classification", () => {
  const { state, variantId } = fixture();
  const spec = buildRenderSpec(state, variantId);
  assert.equal(spec.templateVersion, 1);
  assert.equal(state.variants[0].templateVersion, 1);
  assert.deepEqual(spec.clips, [{ assetId: "video-1", kind: "video", start: 4, end: 24 }]);
  assert.equal(spec.duration, 20);
  assert.equal(spec.audio, "mute");
  assert.deepEqual(state.materials[0].categories, []);
});

test("invalid ranges, excessive clips, unsupported originals and injected enums fail closed", () => {
  let { state } = fixture();
  const variant = state.variants[0];
  assert.throws(() => apply(state, "variant.save", { ...variant, selections: [{ materialId: state.materials[0].id, start: 10, end: 50 }] }), /tramo|duración/);
  assert.throws(() => apply(state, "variant.save", { ...variant, duration: 61 }), /duration/);
  assert.throws(() => apply(state, "variant.save", { ...variant, selections: Array(4).fill(variant.selections[0]) }), /tres/);
  assert.throws(() => apply(state, "material.save", { kind: "video", assetId: "video-1", categories: ["guessed-broll"] }), /categories/);
  assert.throws(() => apply(state, "variant.save", { ...variant, focusX: Number.NaN }), /focusX/);
  state = registerStudioAsset(state, asset("unsupported", { sha256: "b".repeat(64), processing: "unsupported" }));
  state = apply(state, "material.save", { kind: "video", assetId: "unsupported", rights: "owned" });
  const source = state.materials.at(-1)!;
  state = apply(state, "variant.save", { ...variant, sourceIds: [source.id], selections: [{ materialId: source.id, start: 0, end: 20 }] });
  assert.throws(() => buildRenderSpec(state, variant.id), /compatible|proces/);
});

test("old recipes retain their original file even if the material is replaced by a different type", () => {
  let { state, materialId, variantId } = fixture();
  state = registerStudioAsset(state, asset("photo", { kind: "image", sha256: "c".repeat(64), duration: undefined }));
  state = apply(state, "material.save", { ...state.materials[0], kind: "image", assetId: "photo" });
  assert.equal(state.materials[0].contentVersion, 2);
  state = apply(state, "variant.save", { id: variantId, body: "Revised manual words" });
  assert.equal(buildRenderSpec(state, variantId).clips[0].assetId, "video-1");
  assert.equal(state.variants[0].sourceSnapshots[0].contentVersion, 1);
  assert.throws(() => apply(state, "variant.save", { id: variantId, refreshSources: true }), /tramo/);
  assert.equal(state.assets.some((entry) => entry.id === "video-1"), true);
  assert.equal(materialUses(state, materialId).length, 1);
});

test("rights revocation removes approval and export access without changing saved source bytes", () => {
  let { state, variantId } = fixture();
  state = apply(state, "variant.approve", { id: variantId, confirmed: true }, { trustedRender: { variantId, recipeRevision: 1, jobId: "job-1" } });
  const snapshots = structuredClone(state.variants[0].sourceSnapshots);
  state = apply(state, "material.save", { id: state.materials[0].id, rights: "restricted", restrictions: "Do not distribute" });
  assert.equal(state.variants[0].status, "draft");
  assert.deepEqual(state.variants[0].sourceSnapshots, snapshots);
  assert.throws(() => assertStudioExportable(state, variantId, "job-1"), /derecho/);
});

test("narrated demo requires confirmed voice or a sufficiently long uploaded narration", () => {
  let { state, variantId } = fixture();
  state = apply(state, "variant.save", { id: variantId, template: "demo" });
  assert.throws(() => buildRenderSpec(state, variantId), /narración|voz/);
  state = apply(state, "material.save", { id: state.materials[0].id, speech: "present" });
  state = apply(state, "variant.save", { id: variantId, audio: "keep" });
  assert.equal(buildRenderSpec(state, variantId).template, "demo");
  state = registerStudioAsset(state, asset("voice", { kind: "audio", sha256: "d".repeat(64), duration: 25, width: undefined, height: undefined }));
  state = apply(state, "material.save", { kind: "audio", assetId: "voice", rights: "owned" });
  state = apply(state, "variant.save", { id: variantId, narrationId: state.materials.at(-1)!.id, audio: "mute" });
  assert.equal(buildRenderSpec(state, variantId).narrationAssetId, "voice");
});

test("asset registration is immutable, malformed requests do not mutate previous state", () => {
  const previous = registerStudioAsset(emptyStudio(), asset());
  const baseline = structuredClone(previous);
  assert.throws(() => registerStudioAsset(previous, asset("video-1", { size: 200 })), /inmutable|existe/);
  assert.throws(() => apply(previous, "material.save", { kind: "video", assetId: "missing" }), /existe/);
  assert.deepEqual(previous, baseline);
  assert.throws(() => apply(previous, "asset.register", { ...asset() }), /admitida/);
  assert.throws(() => apply(previous, "material.save", { kind: "idea", topics: ["ok", 3] }), /topics/);
});

test("legacy import captures trusted immutable source provenance, including original spacing", () => {
  const source = { id: "legacy-1", productId: "timeker", title: "Original title", text: "  Original source\n\nwith spacing  ", declaredDate: "2026-10-20", createdAt: now };
  const imports = { ...workspace, sources: [source] };
  let state = applyStudioCommand(emptyStudio(), imports, { type: "material.save", data: { importSourceId: source.id, productIds: ["timeker"], rights: "owned", origin: { sourceId: "forged" } } }, { now, newId: () => "imported" });
  const origin = { kind: "legacy-source", sourceId: source.id, productId: source.productId, title: source.title, text: source.text, declaredDate: source.declaredDate, createdAt: source.createdAt };
  assert.equal(state.materials[0].kind, "text");
  assert.equal(state.materials[0].text, source.text);
  assert.deepEqual(state.materials[0].origin, origin);
  state = apply(state, "material.save", { id: "imported", text: "Manual adaptation", title: "New label", productIds: [], origin: { sourceId: "forged" } });
  assert.deepEqual(state.materials[0].origin, origin);
  state = apply(state, "campaign.save", { productId: "timeker" });
  state = apply(state, "variant.save", { campaignId: state.campaigns[0].id, template: "text", sourceIds: ["imported"], body: "Manual adaptation" });
  assert.deepEqual(state.variants[0].sourceSnapshots[0].origin, origin);
  assert.equal(state.variants[0].sourceSnapshots[0].text, "Manual adaptation");
  assert.throws(() => applyStudioCommand(emptyStudio(), imports, { type: "material.save", data: { importSourceId: "missing", productIds: ["timeker"] } }), /existe/);
  assert.throws(() => applyStudioCommand(emptyStudio(), imports, { type: "material.save", data: { importSourceId: source.id, productIds: [] } }), /producto/);
  assert.throws(() => apply(state, "material.save", { id: "imported", importSourceId: "other" }), /inmutable/);
  const plain = apply(emptyStudio(), "material.save", { kind: "text", text: "Own words", origin });
  assert.equal(plain.materials[0].origin, undefined);
});

test("replacement rights cannot authorize a restricted historical original", () => {
  let { state, materialId, variantId } = fixture();
  state = apply(state, "material.save", { id: materialId, rights: "restricted" });
  state = apply(state, "variant.save", { id: variantId, refreshSources: true });
  const recipeRevision = state.variants[0].recipeRevision;
  state = registerStudioAsset(state, asset("replacement", { kind: "image", duration: undefined, sha256: "e".repeat(64) }));
  state = apply(state, "material.save", { id: materialId, kind: "image", assetId: "replacement", rights: "owned" });
  assert.equal(buildRenderSpec(state, variantId).clips[0].assetId, "video-1");
  assert.equal(state.variants[0].sourceSnapshots[0].rights, "restricted");
  assert.throws(() => apply(state, "variant.approve", { id: variantId, confirmed: true }, { trustedRender: { variantId, recipeRevision, jobId: "old-file-render" } }), /versión|fuente/);
  const previouslyApproved = structuredClone(state);
  Object.assign(previouslyApproved.variants[0], { status: "approved", approvedRecipeRevision: recipeRevision, approvedJobId: "old-file-render" });
  assert.throws(() => assertStudioExportable(previouslyApproved, variantId, "old-file-render"), /versión|fuente/);
});

test("an owned historical original remains intentional while current revocation still prevents export", () => {
  let { state, materialId, variantId } = fixture();
  state = registerStudioAsset(state, asset("replacement-owned", { kind: "image", duration: undefined, sha256: "f".repeat(64) }));
  state = apply(state, "material.save", { id: materialId, kind: "image", assetId: "replacement-owned", rights: "owned" });
  state = apply(state, "variant.approve", { id: variantId, confirmed: true }, { trustedRender: { variantId, recipeRevision: 1, jobId: "owned-old-render" } });
  assert.equal(assertStudioExportable(state, variantId, "owned-old-render").id, variantId);
  assert.equal(state.variants[0].sourceSnapshots[0].assetId, "video-1");
  state = apply(state, "material.save", { id: materialId, rights: "restricted" });
  assert.throws(() => assertStudioExportable(state, variantId, "owned-old-render"), /derecho/);
});
