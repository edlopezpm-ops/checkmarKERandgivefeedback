import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { emptyWorkspace, platforms } from "../src/core/domain.ts";
import { emptyStudio } from "../src/core/studio.ts";
import type { StudioMaterial, StudioState, StudioVariant } from "../src/core/studio.ts";
import * as plannerCore from "../src/core/studio-planner.ts";

// Actual component handlers run with synthetic React hooks and fixture fetches.
// These tests do not contact Agents, providers, browsers or an owner workspace.
const compiled = Object.fromEntries(["Studio", "StudioPlanner"].map(name => [name, ts.transpileModule(readFileSync(new URL(`../src/console/${name}.tsx`, import.meta.url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText]));
type Node = { type?: unknown; props?: Record<string, any> };
function nodes(node: any): Node[] { return !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)]; }
function textOf(node: any): string { return node == null || typeof node === "boolean" ? "" : Array.isArray(node) ? node.map(textOf).join("") : typeof node === "object" ? textOf(node.props?.children) : String(node); }
const Planner = () => null, Analysis = () => null, Notice = () => null;
const now = "2026-10-24T20:00:00Z";
function data() {
  const workspace = emptyWorkspace();
  workspace.products.push({ id: "product", name: "Sample", description: "Clear your task list.", cta: "Try Sample", audience: "", language: "en", tone: "", url: "", status: "available" });
  const state = emptyStudio(); state.revision = 7;
  state.campaigns.push({ id: "campaign", productId: "product", title: "Demo campaign", objective: "Make time", audience: "", kind: "organic", status: "draft", createdAt: now, updatedAt: now });
  const material = (id: string, extra: Partial<StudioMaterial> = {}): StudioMaterial => ({ id, title: id, kind: "image", assetId: `asset-${id}`, categories: ["photo"], roles: ["background"], productIds: ["product"], topics: [], review: "ready", rights: "owned", restrictions: "", speech: "unknown", text: "", description: "", contentVersion: 1, createdAt: now, updatedAt: now, ...extra });
  state.materials.push(material("A"), material("B"), material("copy", { kind: "text", assetId: undefined, categories: ["ready-text"], roles: ["message"], text: "Use this literal saved message." }));
  for (const id of ["A", "B"]) state.assets.push({ id: `asset-${id}`, name: `${id}.png`, mime: "image/png", size: 100, sha256: (id === "A" ? "a" : "b").repeat(64), kind: "image", width: 1080, height: 1920, audioTrack: "absent", processing: "ready", createdAt: now });
  const variant: StudioVariant = { id: "variant-A", campaignId: "campaign", platform: "Instagram", template: "text", templateVersion: 1, hook: "Saved hook", body: "Saved message", cta: "Saved CTA", duration: 20, fit: "contain", focusX: .5, focusY: .5, audio: "mute", sourceIds: ["A"], selections: [], sourceSnapshots: [], recipeRevision: 2, status: "draft", createdAt: now, updatedAt: now };
  state.variants.push(variant);
  return { workspace, state, variant };
}
function fixture(component: "Studio" | "StudioPlanner", initialProps: Record<string, any>, stored: Record<string, string> = {}, language = "en") {
  let cursor = 0, output: any, props = initialProps;
  const hooks: any[] = [], effects: Array<() => void> = [], storage = new Map(Object.entries(stored)), calls: Array<{ url: string; options: any }> = [];
  let network = async (_url: string, _options: any): Promise<any> => { throw new Error("Unexpected fixture request"); };
  const react = {
    useState(initial: any) { const index = cursor++; hooks[index] ??= { value: typeof initial === "function" ? initial() : initial }; return [hooks[index].value, (next: any) => { hooks[index].value = typeof next === "function" ? next(hooks[index].value) : next; }]; },
    useRef(initial: any) { const index = cursor++; return hooks[index] ??= { current: initial }; },
    useEffect(effect: () => void | (() => void), dependencies: unknown[]) { const index = cursor++, old = hooks[index]; if (!old || dependencies.some((item, i) => item !== old.dependencies[i])) effects.push(() => { old?.cleanup?.(); hooks[index] = { dependencies, cleanup: effect() }; }); },
  };
  const exports: any = {}, memory = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) };
  runInNewContext(compiled[component], {
    exports, structuredClone, URL, clearTimeout, setTimeout, clearInterval, setInterval, sessionStorage: memory, localStorage: memory,
    window: { addEventListener() {}, removeEventListener() {} },
    fetch: async (url: string, options: any = {}) => { calls.push({ url, options }); if (url.startsWith("/api/agents")) throw new Error("Agents unavailable"); return network(url, options); },
    require(name: string) {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return { jsx: (type: any, props: any) => ({ type, props }), jsxs: (type: any, props: any) => ({ type, props }) };
      if (name === "../i18n") return { useLanguage: () => ({ language }) };
      if (name === "../core/domain") return { platforms };
      if (name === "../core/studio-planner") return plannerCore;
      if (name === "./StudioPlanner") return { default: Planner };
      if (name === "./StudioAnalysis") return { default: Analysis };
      if (name === "./ErrorNotice") return { ErrorNotice: Notice };
      if (name.endsWith(".css")) return {};
      throw new Error(`Unexpected dependency ${name}`);
    },
  });
  function render(next: Record<string, any> = {}) { props = { ...props, ...next }; cursor = 0; output = exports.default(props); while (effects.length) effects.shift()!(); return output; }
  function find(predicate: (node: Node) => boolean) { const result = nodes(output).find(predicate); assert.ok(result, "Expected control is present"); return result; }
  return { storage, calls, render, find, all: () => nodes(output), button: (label: string) => find(node => node.type === "button" && textOf(node) === label), flush: async () => { await new Promise(resolve => setImmediate(resolve)); }, setNetwork: (handler: typeof network) => { network = handler; }, unmount: () => { for (const hook of hooks) hook?.cleanup?.(); } };
}
const ok = (value: unknown) => ({ ok: true, json: async () => value });
function result(state: StudioState) { return { state, jobs: [], uploads: [], capabilities: { local: true, render: true, maxFileBytes: 250_000_000, maxChunkBytes: 8_000_000 } }; }
async function studio(view: "space" | "campaigns", selected = ["B"], language = "en", newDraft?: string) {
  const d = data(), contexts: any[] = [];
  const oldDraft = JSON.stringify({ values: { body: ["Unsaved saved-A message"], cta: ["Unsaved saved-A CTA"] }, baseRevision: 2 });
  const f = fixture("Studio", { view, workspace: d.workspace, onRecordingChange() {}, onContext: (context: any) => contexts.push(context), onOpenCampaigns: () => { f.render({ view: "campaigns" }); } }, { "marker-studio-selection": JSON.stringify({ campaignId: "campaign", variantId: "variant-A", materialIds: selected }), "marker-recipe:campaign:variant-A": oldDraft, ...(newDraft ? { "marker-plan:campaign:new": newDraft } : {}) }, language);
  f.setNetwork(async () => ok(result(d.state))); f.render(); await f.flush(); f.render();
  return { ...f, ...d, contexts, oldDraft };
}
function planner(overrides: Record<string, any> = {}, stored: Record<string, string> = {}) {
  const d = data(), proposals: any[] = [], selections: any[] = [];
  const f = fixture("StudioPlanner", { state: d.state, workspace: d.workspace, campaign: d.state.campaigns[0], initialCandidateIds: [], recipeDirty: false, busy: false, onAnalysisChoiceUsed() {}, onSelectionChange: (ids: string[]) => selections.push([...ids]), onPropose: async (request: any) => { proposals.push(request); return { fingerprint: "test", proposals: [], exclusions: [] }; }, onApply: async () => {}, ...overrides }, stored);
  f.render(); return { ...f, ...d, proposals, selections };
}

test("Space Prepare starts new B while ordinary campaign opening keeps saved A and its unsaved draft", async () => {
  const f = await studio("campaigns");
  assert.equal(f.find(node => node.type === Planner).props!.variant.id, "variant-A");
  const ordinary = planner(f.find(node => node.type === Planner).props!);
  assert.deepEqual(JSON.parse(ordinary.storage.get("marker-plan:campaign:variant-A")!).request.candidateIds, ["A"]);
  assert.throws(() => ordinary.button("Prepare from my library"));
  f.render({ view: "space" }); f.button("Prepare campaign from selection").props!.onClick(); f.render({ view: "campaigns" });
  const next = f.find(node => node.type === Planner).props!;
  assert.equal(next.variant, undefined); assert.deepEqual([...next.initialCandidateIds], ["B"]);
  const prepared = planner(next); assert.deepEqual(JSON.parse(prepared.storage.get("marker-plan:campaign:new")!).request.candidateIds, ["B"]);
  assert.equal(f.storage.get("marker-recipe:campaign:variant-A"), f.oldDraft);
  assert.equal(f.state.variants[0].body, "Saved message"); assert.equal(f.state.variants[0].sourceIds[0], "A");
  assert.equal(f.contexts.at(-1).variantId, undefined); assert.deepEqual([...f.contexts.at(-1).materialIds], ["B"]);
  assert.deepEqual(f.calls.map(call => call.url), ["/api/studio"]);
});

test("planner opens without selection and one library action proposes literal ready copy without Agents", async () => {
  const f = planner(); assert.equal(f.find(node => node.type === "details" && node.props?.className === "studio-planner").props!.open, true);
  f.button("Prepare from my library").props!.onClick(); await f.flush(); f.render();
  assert.equal(f.proposals.length, 1); const request = f.proposals[0];
  assert.deepEqual(request.candidateIds, ["A", "B", "copy"]); assert.equal(request.body, "Use this literal saved message."); assert.equal(request.textSourceId, "copy");
  assert.equal(request.hook, "Sample"); assert.equal(request.cta, "Try Sample");
  assert.equal(request.includeShared, false); assert.equal(request.muteBackground, false); assert.deepEqual(request.reviewedMaterialIds, []); assert.equal(f.calls.length, 0);
});

test("explicit Space selection overrides empty or old new-draft candidates while keeping copy and consent", async () => {
  for (const candidateIds of [[], ["A"]]) {
    const request = { campaignId: "campaign", candidateIds, includeShared: true, platform: "Instagram", template: "overlay", hook: "My hook", body: "Keep my edited message.", cta: "My closing", duration: 20, lockedSelections: [{ materialId: "A", start: 0, end: 20 }], textSourceId: "copy", reviewedMaterialIds: ["A"], allowReuse: true, muteBackground: true, audio: "mute" };
    const cached = JSON.stringify({ request, revision: 7 });
    const f = await studio("space", ["B", "copy"], "en", cached);
    f.button("Prepare campaign from selection").props!.onClick(); f.render({ view: "campaigns" });
    const props = f.find(node => node.type === Planner).props!;
    const p = planner(props, { "marker-plan:campaign:new": f.storage.get("marker-plan:campaign:new")! });
    const saved = JSON.parse(p.storage.get("marker-plan:campaign:new")!).request;
    assert.deepEqual(saved.candidateIds, ["B", "copy"]); assert.deepEqual(saved.lockedSelections, []);
    assert.equal(saved.body, request.body); assert.equal(saved.cta, request.cta); assert.equal(saved.textSourceId, "copy");
    assert.equal(saved.includeShared, true); assert.equal(saved.allowReuse, true); assert.equal(saved.muteBackground, true); assert.deepEqual(saved.reviewedMaterialIds, ["A"]);
    assert.equal(f.storage.get("marker-recipe:campaign:variant-A"), f.oldDraft);
    f.render(); assert.equal(f.find(node => node.type === Planner).props!.selectionIntent, undefined);
    const onlyB = planner({ ...props, selectionIntent: ["B"] }, { "marker-plan:campaign:new": cached });
    const clean = JSON.parse(onlyB.storage.get("marker-plan:campaign:new")!).request;
    assert.equal(clean.textSourceId, undefined); assert.equal(clean.body, request.body); assert.deepEqual(clean.candidateIds, ["B"]);
  }
});

test("library preparation preserves restored copy, selected sources, ranges and consent", async () => {
  const input = { campaignId: "campaign", candidateIds: ["B"], includeShared: false, platform: "Instagram", template: "overlay", hook: "My hook", body: "My exact draft message.", cta: "My CTA", duration: 20, lockedSelections: [{ materialId: "B", start: 0, end: 20 }], reviewedMaterialIds: ["B"], allowReuse: true, muteBackground: true, audio: "mute", fit: "cover", focusX: .2, focusY: .7 };
  const stored = JSON.stringify({ request: input, revision: 7 });
  const f = planner({}, { "marker-plan:campaign:new": stored });
  f.button("Prepare from my library").props!.onClick(); await f.flush(); f.render();
  assert.deepEqual(f.proposals[0], input); assert.deepEqual(JSON.parse(f.storage.get("marker-plan:campaign:new")!).request, input);
  assert.deepEqual(f.selections.at(-1), ["B"]); assert.equal(f.calls.length, 0);
});

test("unsaved manual recipe and active operations block library preparation even if its handler is invoked", async () => {
  for (const blocked of [{ recipeDirty: true }, { busy: true }]) {
    const f = planner(blocked); const button = f.button("Prepare from my library"); assert.equal(button.props!.disabled, true);
    button.props!.onClick(); await f.flush(); assert.equal(f.proposals.length, 0); assert.equal(f.calls.length, 0);
  }
});

test("classification uses selected IDs and CAS; failed revision keeps selection and source state", async () => {
  const f = await studio("space"); let reject: (error: Error) => void = () => {};
  f.setNetwork(async () => await new Promise((_resolve, fail) => { reject = fail; }));
  f.button("Classify selection").props!.onClick(); f.render(); assert.equal(f.button("Classify selection").props!.disabled, true);
  assert.deepEqual(JSON.parse(f.calls[1].options.body), { expectedRevision: 7, command: { type: "material.classify", data: { ids: ["B"] } } });
  reject(new Error("revision_conflict")); await f.flush(); f.render();
  assert.equal(f.find(node => node.type === Notice).props!.message, "revision_conflict");
  assert.equal(f.find(node => node.type === "input" && node.props?.["aria-label"] === "Select for campaign: B").props!.checked, true);
  assert.equal(f.contexts.at(-1).state.revision, 7); assert.equal(f.state.materials[1].review, "ready");
  assert.equal(f.button("Classify selection").props!.disabled, false); assert.ok(!f.all().some(node => textOf(node) === "Selection classified."));
  f.button("Clear selection").props!.onClick(); f.render(); assert.equal(f.button("Classify selection").props!.disabled, true);
});

test("automatic upload classification is default and manual category remains selectable in both languages", async () => {
  for (const [language, label, automatic] of [["en", "Quick classification (optional)", "Automatic"], ["es", "Clasificación rápida (opcional)", "Automática"]]) {
    const f = await studio("space", [], language);
    const field = () => f.find(node => node.type === "label" && textOf(node).startsWith(label));
    const select = () => nodes(field()).find(node => node.type === "select")!;
    assert.equal(select().props!.value, ""); assert.equal(textOf(nodes(select()).find(node => node.type === "option" && node.props?.value === "")), automatic);
    select().props!.onChange({ target: { value: "demo" } }); f.render(); assert.equal(select().props!.value, "demo"); assert.equal(f.calls.length, 1);
  }
});
