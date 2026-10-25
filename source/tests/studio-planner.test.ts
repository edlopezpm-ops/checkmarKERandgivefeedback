import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyWorkspace } from "../src/core/domain.ts";
import { applyStudioCommand, assertStudioExportable, buildRenderSpec, emptyStudio, registerStudioAsset } from "../src/core/studio.ts";
import { planStudio, prepareStudioPlan, validatePlannedVariant } from "../src/core/studio-planner.ts";
import type { StudioPlanInput, StudioPlannerUse } from "../src/core/studio-planner.ts";
import type { StudioAsset, StudioState } from "../src/core/studio.ts";

const now = "2026-10-23T20:00:00Z";
function fixture(capacities = [30]) {
  const workspace = emptyWorkspace();
  workspace.products.push({ id: "timeker", name: "timeKER", description: "", audience: "", language: "es", tone: "", cta: "", url: "", status: "available" });
  let state = emptyStudio(), sequence = 0;
  const apply = (type: string, data: Record<string, unknown>, extra = {}) => {
    state = applyStudioCommand(state, workspace, { type, data }, { now, newId: () => `id-${++sequence}`, ...extra }); return state;
  };
  for (const [index, duration] of capacities.entries()) {
    const asset: StudioAsset = { id: `asset-${index}`, name: "clip.mp4", mime: "video/mp4", size: 100, sha256: (index + 1).toString(16).padStart(64, "0"), kind: "video", duration, width: 1080, height: 1920, audioTrack: "present", processing: "ready", createdAt: now };
    state = registerStudioAsset(state, asset);
    apply("material.save", { kind: "video", assetId: asset.id, title: `Clip ${index}`, categories: ["broll"], roles: ["background"], review: "ready", rights: "owned", speech: "unknown", usefulStart: 0, usefulEnd: duration });
  }
  apply("campaign.save", { productId: "timeker", title: "Client work" });
  const input: StudioPlanInput = { campaignId: state.campaigns[0].id, candidateIds: state.materials.map(item => item.id), includeShared: true, platform: "Instagram", template: "overlay", hook: "Trabajar solo exige orden", body: "Elige qué cliente necesita tu atención hoy.", cta: "Conoce timeKER", duration: 20, lockedSelections: [], reviewedMaterialIds: [], allowReuse: false, muteBackground: true, audio: "mute" };
  return { workspace, get state() { return state; }, apply, input };
}

test("planner is deterministic and proposes one human-marked cooking background without mutating inputs", async () => {
  const f = fixture(), before = structuredClone(f.state);
  f.input.duration = 20;
  const first = await planStudio(f.state, f.workspace, f.input), second = await planStudio(f.state, f.workspace, structuredClone(f.input));
  assert.deepEqual(first, second); assert.match(first.fingerprint, /^[a-f0-9]{64}$/);
  assert.deepEqual(first.proposals[0].recipe.selections, [{ materialId: f.state.materials[0].id, start: 0, end: 20 }]);
  assert.equal(first.proposals[0].recipe.body, f.input.body);
  assert.equal(first.proposals[0].recipe.fit, "contain");
  assert.deepEqual(f.state, before);
  assert.equal(f.state.materials[0].speech, "unknown"); assert.equal(f.state.assets[0].audioTrack, "present");
});

test("bounded alternatives and integer allocation reserve two seconds for each later segment", async () => {
  const f = fixture([7.125, 9.875, 8.5, 10, 10]);
  const result = await planStudio(f.state, f.workspace, f.input);
  assert.equal(result.proposals.length, 3);
  for (const proposal of result.proposals) {
    assert.ok(proposal.recipe.selections.length <= 3);
    assert.equal(proposal.recipe.selections.reduce((sum, item) => sum + Math.round((item.end - item.start) * 1000), 0), 20_000);
    assert.ok(proposal.recipe.selections.every(item => item.end - item.start >= 2));
  }
});

test("human speech locks preserve exact ranges/order and overfull locks abstain", async () => {
  const f = fixture([30, 30]);
  f.apply("material.save", { ...f.state.materials[0], categories: ["talking"], speech: "present" });
  f.input.audio = "keep"; f.input.lockedSelections = [{ materialId: f.state.materials[0].id, start: 3.125, end: 13.125 }];
  f.apply("material.save", { ...f.state.materials[1], speech: "absent" });
  const proposal = (await planStudio(f.state, f.workspace, f.input)).proposals[0];
  assert.deepEqual(proposal.recipe.selections[0], f.input.lockedSelections[0]);
  f.input.lockedSelections[0].end = 29;
  await assert.rejects(planStudio(f.state, f.workspace, f.input), /fijados superan/);
});

test("unconfirmed speech and unclassified raw video are never auto-cut while keeping audio", async () => {
  const f = fixture(); f.input.audio = "keep";
  await assert.rejects(planStudio(f.state, f.workspace, f.input), /No hay material/);
  f.input.audio = "mute";
  f.apply("material.save", { ...f.state.materials[0], categories: ["demo"] });
  await assert.rejects(planStudio(f.state, f.workspace, f.input), /No hay material/);
});

test("muted background requires explicit consent even when speech was not detected", async () => {
  const f = fixture(); f.input.muteBackground = false;
  await assert.rejects(planStudio(f.state, f.workspace, f.input), /fondo silenciado/);
});

test("ready status, product scope, rights and explicit license review are server-side eligibility", async () => {
  const f = fixture(); f.input.includeShared = false;
  await assert.rejects(planStudio(f.state, f.workspace, f.input), /No hay material/);
  f.input.includeShared = true;
  f.apply("material.save", { ...f.state.materials[0], review: "classified" });
  await assert.rejects(planStudio(f.state, f.workspace, f.input), /No hay material/);
  f.apply("material.save", { ...f.state.materials[0], review: "ready", rights: "licensed", restrictions: "Only this review" });
  await assert.rejects(planStudio(f.state, f.workspace, f.input), /No hay material/);
  f.input.reviewedMaterialIds = [f.state.materials[0].id];
  assert.equal((await planStudio(f.state, f.workspace, f.input)).proposals.length, 1);
  f.apply("material.save", { ...f.state.materials[0], rights: "unknown" });
  await assert.rejects(planStudio(f.state, f.workspace, f.input), /No hay material/);
});

test("reuse uses original SHA and interval across duplicate entries and historical deleted variants", async () => {
  const f = fixture(); const material = f.state.materials[0];
  f.apply("material.save", { ...material, id: undefined, title: "Intentional duplicate" });
  f.input.candidateIds = [f.state.materials[1].id];
  const history: StudioPlannerUse[] = [{ sha256: f.state.assets[0].sha256, start: 0, end: 30, variantId: "deleted", jobId: "old" }];
  await assert.rejects(planStudio(f.state, f.workspace, f.input, history), /No hay material/);
  f.input.allowReuse = true;
  const result = await planStudio(f.state, f.workspace, f.input, history);
  assert.match(result.proposals[0].warnings.join(" "), /Reutilización/);
  assert.notEqual(result.fingerprint, (await planStudio(f.state, f.workspace, f.input)).fingerprint);
});

test("overlapping copies cannot silently loop within a single recipe", async () => {
  const f = fixture([12, 12]);
  f.state.assets[1].sha256 = f.state.assets[0].sha256;
  f.input.allowReuse = true;
  await assert.rejects(planStudio(f.state, f.workspace, f.input), /No hay material/);
});

test("planner does not develop vague ideas and preserves ready text literally", async () => {
  const f = fixture();
  f.apply("material.save", { kind: "idea", text: "Motivación cuando trabajas solo", review: "ready", rights: "owned" });
  f.input.candidateIds.push(f.state.materials[1].id); f.input.textSourceId = f.state.materials[1].id;
  await assert.rejects(planStudio(f.state, f.workspace, f.input), /texto listo/);
  f.input.textSourceId = undefined; f.input.body = "";
  await assert.rejects(planStudio(f.state, f.workspace, f.input), /idea incompleta/);
  f.apply("material.save", { kind: "text", text: "Manual approved copy", review: "ready", categories: ["ready-text"], rights: "owned" });
  f.input.candidateIds.push(f.state.materials[2].id); f.input.textSourceId = f.state.materials[2].id; f.input.body = "Manual approved copy";
  assert.equal((await planStudio(f.state, f.workspace, f.input)).proposals[0].recipe.body, "Manual approved copy");
  f.input.body += " changed";
  await assert.rejects(planStudio(f.state, f.workspace, f.input), /literalmente/);
});

test("readability rejects valid-length copy that cannot be read in its time slot", async () => {
  const f = fixture(); f.input.duration = 5;
  await assert.rejects(planStudio(f.state, f.workspace, f.input), /lectura/);
  f.input.duration = 20; f.input.body = "x".repeat(200);
  await assert.rejects(planStudio(f.state, f.workspace, f.input), /lectura/);
});

test("client provenance is ignored; only trusted current-revision plan may be persisted", async () => {
  const f = fixture(), result = await planStudio(f.state, f.workspace, f.input), proposal = result.proposals[0];
  assert.throws(() => f.apply("variant.plan", { recipe: proposal.recipe, provenance: proposal.provenance }), /servidor/);
  f.apply("variant.plan", {}, { trustedPlan: proposal });
  assert.equal(f.state.variants[0].planner?.inputFingerprint, result.fingerprint);
  assert.equal(buildRenderSpec(f.state, f.state.variants[0].id).duration, 20);
  assert.throws(() => f.apply("variant.plan", {}, { trustedPlan: proposal }), /actual/);
});

test("human classification changes invalidate planned rendering even without contentVersion changes", async () => {
  const f = fixture(), proposal = (await planStudio(f.state, f.workspace, f.input)).proposals[0];
  f.apply("variant.plan", {}, { trustedPlan: proposal }); const id = f.state.variants[0].id;
  const contentVersion = f.state.materials[0].contentVersion;
  f.apply("material.save", { ...f.state.materials[0], speech: "present", topics: ["changed"] });
  assert.equal(f.state.materials[0].contentVersion, contentVersion);
  assert.throws(() => buildRenderSpec(f.state, id), /fuente/);
  assert.throws(() => f.apply("variant.approve", { id, confirmed: true }), /fuente/);
  assert.throws(() => assertStudioExportable(f.state, id), /fuente/);
});

test("manual edits retain trusted provenance and fresh historical reuse still blocks effects", async () => {
  const f = fixture(), proposal = (await planStudio(f.state, f.workspace, f.input)).proposals[0];
  f.apply("variant.plan", {}, { trustedPlan: proposal }); const variant = f.state.variants[0];
  f.apply("variant.save", { ...variant, planner: undefined, body: "A revised manual message." });
  assert.ok(f.state.variants[0].planner);
  assert.throws(() => validatePlannedVariant(f.state, f.state.variants[0], [{ sha256: f.state.assets[0].sha256, start: 1, end: 2, variantId: "another" }]), /ya se utiliza/);
  assert.doesNotThrow(() => validatePlannedVariant(f.state, f.state.variants[0], [{ sha256: f.state.assets[0].sha256, start: 1, end: 2, variantId: variant.id }]));
});

test("invalid pools and incompatible locks fail with bounded domain errors", async () => {
  const f = fixture(); f.input.candidateIds = Array.from({ length: 51 }, (_, n) => `candidate-${n}`);
  await assert.rejects(planStudio(f.state, f.workspace, f.input), /parámetros/);
  f.input.candidateIds = [f.state.materials[0].id]; f.input.lockedSelections = [{ materialId: "outside", start: 0, end: 20 }];
  await assert.rejects(planStudio(f.state, f.workspace, f.input), /fijado/);
});

test("replanning an existing variant refreshes replaced originals and invalidates its old approval", async () => {
  const f = fixture();
  const initial = (await planStudio(f.state, f.workspace, f.input)).proposals[0];
  f.apply("variant.plan", {}, { trustedPlan: initial }); const id = f.state.variants[0].id;
  f.apply("variant.approve", { id, confirmed: true }, { trustedRender: { variantId: id, recipeRevision: 1, jobId: "completed" } });
  const replacement = { ...f.state.assets[0], id: "replacement", sha256: "f".repeat(64) };
  const state = registerStudioAsset(f.state, replacement);
  let changed = applyStudioCommand(state, f.workspace, { type: "material.save", data: { ...state.materials[0], assetId: replacement.id } }, { now });
  const request = { ...f.input, variantId: id };
  const plan = (await planStudio(changed, f.workspace, request)).proposals[0];
  changed = applyStudioCommand(changed, f.workspace, { type: "variant.plan", data: { id } }, { now, trustedPlan: plan });
  assert.equal(changed.variants[0].sourceSnapshots[0].assetId, replacement.id);
  assert.equal(changed.variants[0].status, "draft");
  assert.equal(changed.variants[0].approvedJobId, undefined);
  assert.equal(buildRenderSpec(changed, id).clips[0].assetId, replacement.id);
});

test("explicit narration replaces unknown source audio but must cover the full recipe", async () => {
  const f = fixture();
  const audio: StudioAsset = { ...f.state.assets[0], id: "narration", kind: "audio", mime: "audio/wav", duration: 30, sha256: "e".repeat(64) };
  let state = registerStudioAsset(f.state, audio);
  state = applyStudioCommand(state, f.workspace, { type: "material.save", data: { kind: "audio", assetId: audio.id, rights: "owned", review: "ready", categories: ["voice"] } }, { now, newId: () => "voice" });
  const request = { ...f.input, candidateIds: [...f.input.candidateIds, "voice"], narrationId: "voice", template: "demo" as const, audio: "keep" as const, muteBackground: false };
  assert.equal((await planStudio(state, f.workspace, request)).proposals[0].recipe.narrationId, "voice");
  state.assets.find(asset => asset.id === audio.id)!.duration = 10;
  await assert.rejects(planStudio(state, f.workspace, request), /narración/);
});

test("used intervals leave deterministic unused windows without copying unrelated history into provenance", async () => {
  const f = fixture();
  const history: StudioPlannerUse[] = [{ sha256: f.state.assets[0].sha256, start: 0, end: 5, variantId: "old" }, { sha256: "f".repeat(64), start: 0, end: 30, variantId: "irrelevant" }];
  const proposal = (await planStudio(f.state, f.workspace, f.input, history)).proposals[0];
  assert.deepEqual(proposal.recipe.selections, [{ materialId: f.state.materials[0].id, start: 5, end: 25 }]);
  assert.deepEqual(proposal.provenance.history, []);
  f.input.allowReuse = true;
  const permitted = (await planStudio(f.state, f.workspace, f.input, history)).proposals[0];
  assert.equal(permitted.provenance.history.length, 1);
  assert.equal(permitted.provenance.history[0].variantId, "old");
});

test("optional analysis references are bounded provenance and do not silently change cuts or human speech", async () => {
  const f = fixture(), ordinary = await planStudio(f.state, f.workspace, f.input);
  f.input.analysisIds = ["trusted-analysis-id"];
  const referenced = await planStudio(f.state, f.workspace, f.input);
  assert.deepEqual(referenced.proposals[0].provenance.analysisIds, f.input.analysisIds);
  assert.deepEqual(referenced.proposals[0].recipe.selections, ordinary.proposals[0].recipe.selections);
  assert.notEqual(referenced.fingerprint, ordinary.fingerprint);
  assert.equal(f.state.materials[0].speech, "unknown");
  f.input.analysisIds = ["one", "two", "three", "four"];
  await assert.rejects(planStudio(f.state, f.workspace, f.input), /parámetros/);
});

test('native preparation chooses stable allowed material and literal ready text without changing its inputs', async () => {
  const f=fixture(); f.workspace.products[0].cta='Conoce timeKER';
  f.apply('material.save',{kind:'text',text:'Un mensaje literal y aprobado.',review:'ready',rights:'owned',productIds:['timeker']});
  const input={...f.input,candidateIds:[],hook:'',body:'',cta:''}, before=structuredClone({state:f.state,workspace:f.workspace,input});
  const prepared=prepareStudioPlan(f.state,f.workspace,input);
  assert.deepEqual(prepared.candidateIds,f.state.materials.map(item=>item.id).sort());
  assert.equal(prepared.body,'Un mensaje literal y aprobado.'); assert.equal(prepared.textSourceId,f.state.materials[1].id);
  assert.equal(prepared.hook,'timeKER'); assert.equal(prepared.cta,'Conoce timeKER');
  assert.deepEqual({state:f.state,workspace:f.workspace,input},before); assert.notEqual(prepared.lockedSelections,input.lockedSelections);
  assert.equal((await planStudio(f.state,f.workspace,prepared)).proposals[0].recipe.body,prepared.body);
});

test('preparation preserves explicit source order and all entered copy, duration, framing and consent', () => {
  const f=fixture([30,30]);
  const input={...f.input,candidateIds:[f.state.materials[1].id,f.state.materials[0].id],hook:'Human hook',body:'  Human message with intentional spaces.  ',cta:'Own CTA',duration:20,fit:'cover' as const,focusX:0.2,focusY:0.8,allowReuse:true};
  const prepared=prepareStudioPlan(f.state,f.workspace,input); assert.deepEqual(prepared,input);
  assert.notEqual(prepared.candidateIds,input.candidateIds);
  assert.throws(()=>prepareStudioPlan(f.state,f.workspace,{...input,variantId:'saved-variant'}),/pieza nueva/);
});

test('preparation abstains on ambiguous text and never truncates long product facts or develops an idea', () => {
  const f=fixture(); f.workspace.products[0].description='Descripción literal del producto.';
  const empty={...f.input,body:'',hook:'',cta:''};
  assert.equal(prepareStudioPlan(f.state,f.workspace,empty).body,f.workspace.products[0].description);
  for(const text of ['Primer texto listo.','Segundo texto listo.']) f.apply('material.save',{kind:'text',text,review:'ready',rights:'owned'});
  const input={...empty,candidateIds:[]};
  assert.throws(()=>prepareStudioPlan(f.state,f.workspace,input),/varios textos/);
  const chosen=prepareStudioPlan(f.state,f.workspace,{...input,textSourceId:f.state.materials[1].id}); assert.equal(chosen.body,'Primer texto listo.');
  assert.equal(prepareStudioPlan(f.state,f.workspace,{...input,body:'Mensaje humano completo.'}).body,'Mensaje humano completo.');
  f.workspace.products[0].description='x'.repeat(1000);
  assert.throws(()=>prepareStudioPlan(f.state,f.workspace,empty),/texto|lectura/i);
  f.workspace.products[0].description='';
  assert.throws(()=>prepareStudioPlan(f.state,f.workspace,empty),/idea incompleta/);
});

test('automatic preparation never grants rights, shared scope or B-roll eligibility to generic video', async () => {
  const f=fixture(); const material=f.state.materials[0];
  f.apply('material.save',{...material,categories:[],roles:['background'],rights:'unknown'});
  const input={...f.input,candidateIds:[]}, prepared=prepareStudioPlan(f.state,f.workspace,input);
  assert.deepEqual(prepared.candidateIds,[]); assert.equal(f.state.materials[0].rights,'unknown');
  await assert.rejects(planStudio(f.state,f.workspace,prepared),/No hay material/);
  assert.throws(()=>prepareStudioPlan(f.state,f.workspace,{...f.input,candidateIds:[material.id]}),/Derechos/);
  f.apply('material.save',{...f.state.materials[0],rights:'owned',categories:['broll']});
  assert.deepEqual(prepareStudioPlan(f.state,f.workspace,{...input,includeShared:false}).candidateIds,[]);
  f.apply('material.save',{...f.state.materials[0],rights:'licensed',restrictions:'Explicit review required'});
  assert.deepEqual(prepareStudioPlan(f.state,f.workspace,input).candidateIds,[]);
  assert.deepEqual(prepareStudioPlan(f.state,f.workspace,{...input,reviewedMaterialIds:[material.id]}).candidateIds,[material.id]);
  assert.equal(f.state.materials[0].speech,'unknown');
});

test('preparation retains manually locked talking ranges and bounds automatic candidates at fifty', async () => {
  const f=fixture(); f.apply('material.save',{...f.state.materials[0],categories:['talking'],speech:'present'});
  const input={...f.input,candidateIds:[],audio:'keep' as const,lockedSelections:[{materialId:f.state.materials[0].id,start:2,end:22}]};
  const prepared=prepareStudioPlan(f.state,f.workspace,input); assert.deepEqual(prepared.lockedSelections,input.lockedSelections);
  assert.deepEqual((await planStudio(f.state,f.workspace,prepared)).proposals[0].recipe.selections,input.lockedSelections);
  for(let i=0;i<55;i++) f.apply('material.save',{kind:'text',text:'Literal text '+i,review:'ready',rights:'owned'});
  const many=prepareStudioPlan(f.state,f.workspace,{...f.input,candidateIds:[]}); assert.equal(many.candidateIds.length,50);
});
