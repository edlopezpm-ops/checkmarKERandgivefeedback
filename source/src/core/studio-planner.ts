import { DomainError, platforms } from "./domain.ts";
import type { Platform, Workspace } from "./domain.ts";
import type { StudioMaterial, StudioSelection, StudioState, StudioTemplate, StudioVariant } from "./studio.ts";

export const STUDIO_PLANNER_VERSION = 1;
export type StudioPlannerUse = { sha256: string; start: number; end: number; variantId?: string; jobId?: string };
export interface StudioPlanInput {
  campaignId: string; variantId?: string; candidateIds: string[]; includeShared: boolean;
  platform: Platform; template: StudioTemplate; hook: string; body: string; cta: string; duration: number;
  lockedSelections: StudioSelection[]; reviewedMaterialIds: string[]; allowReuse: boolean;
  muteBackground: boolean; audio: "mute" | "keep"; narrationId?: string; textSourceId?: string;
  analysisIds?: string[];
  fit?: "contain" | "cover"; focusX?: number; focusY?: number;
}
export type StudioPlanRecipe = Pick<StudioVariant, "campaignId" | "platform" | "template" | "hook" | "body" | "cta" | "duration" | "fit" | "focusX" | "focusY" | "audio" | "sourceIds" | "selections" | "narrationId">;
export interface StudioPlanProvenance {
  plannerVersion: 1; studioRevision: number; inputFingerprint: string; alternative: number;
  productId: string; campaignFacts: string; sourceFacts: Array<{ materialId: string; canonical: string }>;
  candidateIds: string[]; allowReuse: boolean; muteBackground: boolean; reviewedMaterialIds: string[];
  lockedSelections: StudioSelection[]; history: StudioPlannerUse[]; textSourceId?: string; variantId?: string;
  analysisIds?: string[];
}
export interface StudioPlanProposal { alternative: number; recipe: StudioPlanRecipe; provenance: StudioPlanProvenance; reasons: string[]; warnings: string[] }
export interface StudioPlanResult { fingerprint: string; proposals: StudioPlanProposal[]; exclusions: Array<{ materialId: string; reason: string }> }

function fail(message: string, status = 422): never { throw new DomainError(message, status); }
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
function milliseconds(value: number): number { return Math.round(value * 1000); }
function materialFacts(state: StudioState, material: StudioMaterial): string {
  const asset = state.assets.find(item => item.id === material.assetId);
  return canonical({ material, asset });
}
function campaignFacts(state: StudioState, campaignId: string): string {
  const campaign = state.campaigns.find(item => item.id === campaignId);
  if (!campaign) fail("La campaña ya no existe.", 409);
  return canonical(campaign);
}
function inputCheck(input: StudioPlanInput) {
  if (!input || typeof input !== "object" || typeof input.campaignId !== "string" || !input.campaignId
    || !Array.isArray(input.candidateIds) || input.candidateIds.length > 50 || input.candidateIds.some(id => typeof id !== "string" || !id || id.length > 100)
    || new Set(input.candidateIds).size !== input.candidateIds.length
    || !Array.isArray(input.lockedSelections) || input.lockedSelections.length > 3 || input.lockedSelections.some(item => !item || typeof item !== "object" || typeof item.materialId !== "string")
    || !Array.isArray(input.reviewedMaterialIds) || input.reviewedMaterialIds.length > 50 || input.reviewedMaterialIds.some(id => typeof id !== "string")
    || input.analysisIds !== undefined && (!Array.isArray(input.analysisIds) || input.analysisIds.length > 3 || new Set(input.analysisIds).size !== input.analysisIds.length || input.analysisIds.some(id => typeof id !== "string" || !id || id.length > 100))
    || ![input.includeShared, input.allowReuse, input.muteBackground].every(value => typeof value === "boolean")
    || !platforms.includes(input.platform) || !["overlay", "demo", "tips", "motivation", "text"].includes(input.template)
    || !["mute", "keep"].includes(input.audio) || !Number.isFinite(input.duration) || input.duration < 5 || input.duration > 60
    || (input.fit !== undefined && !["contain", "cover"].includes(input.fit))
    || [input.focusX, input.focusY].some(value => value !== undefined && (!Number.isFinite(value) || value < 0 || value > 1))
    || [input.variantId, input.narrationId, input.textSourceId].some(value => value !== undefined && (typeof value !== "string" || !value || value.length > 100))
    || ![input.hook, input.body, input.cta].every(value => typeof value === "string" && !value.includes("\0"))) fail("Revisa los parámetros de la propuesta.");
  if (input.variantId && typeof input.variantId !== "string") fail("La variante no es válida.");
}

const slots = { overlay: [0.22, 0.78, 640], demo: [0.18, 0.82, 470], tips: [0.14, 0.88, 840], motivation: [0.25, 0.85, 680], text: [0.2, 0.85, 1080] } as const;
/** A conservative reading preflight; it does not replace the actual rendered preview. */
export function preflightStudioPlanCopy(template: StudioTemplate, hook: string, body: string, cta: string, duration: number): void {
  if (!body.trim()) fail("Desarrolla el mensaje; una idea incompleta no se convierte en texto automáticamente.");
  if (template === "text") { if (body.length > 20_000 || hook.length > 240 || cta.length > 240) fail("El texto supera el límite de la plantilla."); return; }
  if (body.length > 900 || hook.length > 160 || cta.length > 160) fail("Reduce el texto superpuesto o elige TXT.");
  const [first, last, height] = slots[template];
  const durations = [first * duration, (last - first) * duration, (1 - last) * duration];
  for (const [index, text] of [hook, body, cta].entries()) {
    if (!text.trim()) continue;
    if (durations[index] < 2 - 0.000001 || Array.from(text).length > durations[index] * 15 + 0.000001)
      fail("El texto necesita más tiempo de lectura: aumenta la duración, reduce el texto o elige TXT.");
    const lineCount = text.split(/\r?\n/).reduce((sum, paragraph) => sum + Math.max(1, Math.ceil(Array.from(paragraph).length / 32)), 0);
    if (lineCount * 48 > height - 80) fail("El texto no cabe con un tamaño legible; reduce el texto o elige TXT.");
  }
}

function eligible(state: StudioState, material: StudioMaterial, productId: string, input: Pick<StudioPlanInput, "includeShared" | "reviewedMaterialIds">): string | undefined {
  if (!(material.productIds.includes(productId) || input.includeShared && material.productIds.length === 0)) return "Fuera del producto y fondos compartidos permitidos.";
  if (material.review !== "ready") return "Marca el material listo antes de proponer.";
  if (material.rights !== "owned" && material.rights !== "licensed") return "Derechos sin confirmar.";
  if ((material.rights === "licensed" || material.restrictions.trim()) && !input.reviewedMaterialIds.includes(material.id)) return "Revisa explícitamente licencia y restricciones para esta pieza.";
  if (material.kind === "idea") return "La idea debe desarrollarse manualmente.";
  const asset = state.assets.find(item => item.id === material.assetId);
  if (["video", "image", "audio"].includes(material.kind) && (!asset || asset.processing !== "ready")) return "Original incompatible o pendiente.";
  return undefined;
}

/** Prepare a new native draft from literal known facts; actual planning and every
 * effect still use planStudio and its existing permission/provenance checks. */
export function prepareStudioPlan(state: StudioState, workspace: Workspace, supplied: StudioPlanInput): StudioPlanInput {
  inputCheck(supplied);
  const input = structuredClone(supplied);
  if (input.variantId) fail("La preparación automática es sólo para una pieza nueva; conserva la receta guardada.", 409);
  const campaign = state.campaigns.find(item => item.id === input.campaignId), product = workspace.products.find(item => item.id === campaign?.productId);
  if (!campaign || !product) fail("Selecciona una campaña y un producto existentes.", 409);
  const allowed = (id: string) => {
    const material = state.materials.find(item => item.id === id);
    if (!material) fail("Una fuente ya no existe; vuelve a preparar.", 409);
    const reason = eligible(state, material, product.id, input);
    if (reason) fail(reason, 409);
    return material;
  };
  if (input.candidateIds.length) input.candidateIds.forEach(allowed);
  else {
    const explicit = [...new Set([...input.lockedSelections.map(item => item.materialId), ...[input.narrationId, input.textSourceId].filter((id): id is string => !!id)])];
    explicit.forEach(allowed);
    const usable = state.materials.filter(material => {
      if (eligible(state, material, product.id, input)) return false;
      if (material.kind === "text") return material.categories.includes("ready-text");
      if (input.template === "text") return false;
      if (material.kind === "image") return material.categories.includes("photo");
      if (material.kind !== "video" || !material.categories.includes("broll")) return false;
      if (input.audio === "keep" && !input.narrationId && material.speech !== "absent") return false;
      const asset = state.assets.find(item => item.id === material.assetId);
      return (material.usefulEnd ?? asset?.duration ?? 0) - (material.usefulStart ?? 0) >= 2;
    }).map(item => item.id).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
    input.candidateIds = [...new Set([...explicit, ...usable])].slice(0, 50);
  }
  const materials = input.candidateIds.map(allowed);
  if (!input.body.trim()) {
    const texts = materials.filter(material => material.kind === "text" && material.categories.includes("ready-text"));
    const chosen = input.textSourceId ? texts.find(material => material.id === input.textSourceId) : texts.length === 1 ? texts[0] : undefined;
    if (input.textSourceId && !chosen) fail("Elige un texto listo y permitido de la selección.", 409);
    if (!chosen && texts.length > 1) fail("Hay varios textos listos: elige uno o escribe el mensaje antes de preparar.");
    if (chosen) { input.body = chosen.text; input.textSourceId = chosen.id; }
    else input.body = product.description;
  }
  if (!input.hook.trim()) input.hook = product.name;
  if (!input.cta.trim()) input.cta = product.cta;
  preflightStudioPlanCopy(input.template, input.hook, input.body, input.cta, input.duration);
  return input;
}
function liveUses(state: StudioState): StudioPlannerUse[] {
  return state.variants.flatMap(variant => variant.selections.flatMap(selection => {
    const source = variant.sourceSnapshots.find(item => item.materialId === selection.materialId);
    const asset = state.assets.find(item => item.id === source?.assetId);
    return asset ? [{ sha256: asset.sha256, start: selection.start, end: selection.end, variantId: variant.id }] : [];
  }));
}
function validateHistory(history: StudioPlannerUse[]) {
  if (!Array.isArray(history) || history.length > 10_000 || history.some(use => !use || !/^[a-f0-9]{64}$/i.test(use.sha256) || !Number.isFinite(use.start) || !Number.isFinite(use.end) || use.start < 0 || use.end <= use.start))
    fail("No se pudo comprobar el historial acotado de reutilización.", 409);
}
function overlaps(sha: string, start: number, end: number, uses: StudioPlannerUse[], variantId?: string): boolean {
  return uses.some(use => (!variantId || use.variantId !== variantId) && use.sha256 === sha && milliseconds(start) < milliseconds(use.end) && milliseconds(end) > milliseconds(use.start));
}
type Candidate = { material: StudioMaterial; sha: string; start: number; capacity: number; rank: number[]; warnings: string[] };
function rank(a: Candidate, b: Candidate): number {
  for (let index = 0; index < a.rank.length; index++) if (a.rank[index] !== b.rank[index]) return a.rank[index] - b.rank[index];
  return a.material.id < b.material.id ? -1 : a.material.id > b.material.id ? 1 : a.start - b.start;
}
function unusedIntervals(start: number, end: number, sha: string, uses: StudioPlannerUse[], variantId?: string): Array<[number, number]> {
  const occupied = uses.filter(use => use.sha256 === sha && (!variantId || use.variantId !== variantId))
    .map(use => [Math.max(start, milliseconds(use.start)), Math.min(end, milliseconds(use.end))] as const)
    .filter(([from, to]) => to > from).sort(([a], [b]) => a - b);
  const result: Array<[number, number]> = []; let cursor = start;
  for (const [from, to] of occupied) {
    if (from > cursor) result.push([cursor, from]);
    cursor = Math.max(cursor, to);
  }
  if (cursor < end) result.push([cursor, end]);
  return result;
}
function* combinations<T>(items: T[], count: number, offset = 0, prefix: T[] = []): Generator<T[]> {
  if (prefix.length === count) { yield prefix; return; }
  for (let index = offset; index <= items.length - (count - prefix.length); index++) yield* combinations(items, count, index + 1, [...prefix, items[index]]);
}

export async function planStudio(state: StudioState, workspace: Workspace, supplied: StudioPlanInput, history: StudioPlannerUse[] = []): Promise<StudioPlanResult> {
  inputCheck(supplied); validateHistory(history);
  const input = structuredClone(supplied), campaign = state.campaigns.find(item => item.id === input.campaignId);
  if (!campaign || !workspace.products.some(product => product.id === campaign.productId)) fail("Selecciona una campaña y un producto existentes.", 409);
  if (input.variantId && !state.variants.some(variant => variant.id === input.variantId && variant.campaignId === campaign.id)) fail("La variante no pertenece a esta campaña.", 409);
  preflightStudioPlanCopy(input.template, input.hook, input.body, input.cta, input.duration);
  const materials = input.candidateIds.map(id => { const material = state.materials.find(item => item.id === id); if (!material) fail("Una fuente ya no existe; vuelve a proponer.", 409); return material; });
  const exclusions: StudioPlanResult["exclusions"] = [], available = new Map<string, StudioMaterial>();
  for (const material of materials) {
    const reason = eligible(state, material, campaign.productId, input);
    if (reason) exclusions.push({ materialId: material.id, reason }); else available.set(material.id, material);
  }
  if (input.textSourceId) {
    const source = available.get(input.textSourceId);
    if (!source || source.kind !== "text" || !source.categories.includes("ready-text") || source.text !== input.body) fail("Elige un texto listo y úsalo literalmente como mensaje; las ideas no se redactan automáticamente.");
  }
  const uses = [...history, ...liveUses(state)];
  const locked: StudioSelection[] = [], chosenUses: StudioPlannerUse[] = [];
  for (const selection of input.lockedSelections) {
    const material = available.get(selection.materialId), asset = state.assets.find(item => item.id === material?.assetId);
    if (!material || !asset || !["video", "image"].includes(material.kind) || !Number.isFinite(selection.start) || !Number.isFinite(selection.end)
      || selection.start < 0 || selection.end <= selection.start || selection.end - selection.start > 120 || asset.kind === "image" && selection.start !== 0
      || asset.kind === "video" && (!asset.duration || selection.end > asset.duration + 0.001)) fail("Un tramo fijado es incompatible o no pertenece a las fuentes permitidas.");
    const start = milliseconds(selection.start), end = milliseconds(selection.end);
    if (overlaps(asset.sha256, start / 1000, end / 1000, chosenUses) || !input.allowReuse && overlaps(asset.sha256, start / 1000, end / 1000, uses, input.variantId)) fail("Un tramo fijado repite un intervalo; permite su reutilización explícitamente o cámbialo.");
    chosenUses.push({ sha256: asset.sha256, start: start / 1000, end: end / 1000 }); locked.push({ materialId: material.id, start: start / 1000, end: end / 1000 });
  }
  const remaining = milliseconds(input.duration) - locked.reduce((sum, item) => sum + milliseconds(item.end) - milliseconds(item.start), 0);
  if (remaining < 0) fail("Los tramos fijados superan la duración; no se recortan automáticamente.");
  if (input.template === "text" && (locked.length || input.narrationId)) fail("TXT no usa tramos ni narración.");
  const candidates: Candidate[] = [];
  if (input.template !== "text") for (const material of available.values()) {
    if (!(material.kind === "image" || material.kind === "video" && material.categories.includes("broll"))) continue;
    const asset = state.assets.find(item => item.id === material.assetId)!;
    if (input.audio === "keep" && !input.narrationId && material.kind === "video" && material.speech !== "absent") { exclusions.push({ materialId: material.id, reason: "Conserva el habla sólo con un tramo fijado por ti." }); continue; }
    const start = material.kind === "image" ? 0 : milliseconds(material.usefulStart ?? 0);
    const end = material.kind === "image" ? milliseconds(input.duration) : milliseconds(material.usefulEnd ?? asset.duration ?? 0);
    const blocked = [...chosenUses, ...(!input.allowReuse ? uses.filter(use => !input.variantId || use.variantId !== input.variantId) : [])];
    // Subtract known usage; these windows remain inside the human useful range.
    // A photo has no source timeline, so it always starts at zero and is not split.
    const intervals: Array<[number, number]> = material.kind === "image"
      ? overlaps(asset.sha256, 0, end / 1000, blocked) ? [] : [[0, end]]
      : unusedIntervals(start, end, asset.sha256, blocked);
    const windows = intervals.filter(([from, to]) => to - from >= 2000);
    if (!windows.length) { exclusions.push({ materialId: material.id, reason: "No dispone de dos segundos de fondo sin reutilización." }); continue; }
    // At most three windows per original can contribute to a three-segment recipe.
    const rankedWindows = [...windows].sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]) || a[0] - b[0]).slice(0, 3);
    for (const [from, to] of rankedWindows) candidates.push({ material, sha: asset.sha256, start: from, capacity: to - from, rank: [material.roles.includes("background") ? 0 : 1, material.usefulStart !== undefined && material.usefulEnd !== undefined ? 0 : 1, to - from >= remaining ? 0 : 1, asset.width && asset.height && Math.abs(asset.width / asset.height - 9 / 16) < 0.01 ? 0 : 1], warnings: material.kind === "video" && (material.usefulStart === undefined || material.usefulEnd === undefined) ? ["Tramo de fondo sin revisar: compruébalo antes de aprobar."] : [] });
  }
  candidates.sort(rank);
  if (input.template !== "text" && remaining > 0 && candidates.map(item => item.capacity).sort((a, b) => b - a).slice(0, 3 - locked.length).reduce((sum, value) => sum + value, 0) < remaining)
    fail("No hay material suficiente sin alterar tramos fijados o repetir intervalos. Reduce la duración, añade fondos listos o permite reutilización.");
  const recipes: Array<{ selections: StudioSelection[]; warnings: string[] }> = [];
  if (input.template === "text" || remaining === 0) recipes.push({ selections: locked, warnings: [] });
  else for (let count = 1; count <= 3 - locked.length && recipes.length < 3; count++) {
    if (remaining < count * 2000) continue;
    for (const group of combinations(candidates, count)) {
      if (group.reduce((sum, item) => sum + item.capacity, 0) < remaining) continue;
      let rest = remaining; const selections = [...locked], assignedUses = [...chosenUses]; let valid = true;
      for (const [index, candidate] of group.entries()) {
        const duration = Math.min(candidate.capacity, rest - (group.length - index - 1) * 2000), start = candidate.start / 1000, end = (candidate.start + duration) / 1000;
        if (overlaps(candidate.sha, start, end, assignedUses) || !input.allowReuse && overlaps(candidate.sha, start, end, uses, input.variantId)) { valid = false; break; }
        selections.push({ materialId: candidate.material.id, start, end }); assignedUses.push({ sha256: candidate.sha, start, end }); rest -= duration;
      }
      if (valid && rest === 0) recipes.push({ selections, warnings: group.flatMap(item => item.warnings) });
      if (recipes.length === 3) break;
    }
  }
  if (!recipes.length) fail("No hay material suficiente sin alterar tramos fijados o repetir intervalos. Reduce la duración, añade fondos listos o permite reutilización.");
  const facts = materials.map(material => ({ materialId: material.id, canonical: materialFacts(state, material) })).sort((a, b) => a.materialId < b.materialId ? -1 : 1);
  const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical({ plannerVersion: STUDIO_PLANNER_VERSION, revision: state.revision, campaign: campaignFacts(state, campaign.id), input, facts, history: [...history].sort((a, b) => canonical(a) < canonical(b) ? -1 : 1) }))))).map(byte => byte.toString(16).padStart(2, "0")).join("");
  const proposals = recipes.map(({ selections, warnings }, alternative): StudioPlanProposal => {
    const sourceIds = [...new Set([...selections.map(item => item.materialId), ...[input.narrationId, input.textSourceId].filter((id): id is string => !!id)])];
    for (const id of sourceIds) if (!available.has(id)) fail("Una fuente de narración o texto necesita revisión y permisos para esta pieza.");
    const recipe: StudioPlanRecipe = { campaignId: campaign.id, platform: input.platform, template: input.template, hook: input.hook, body: input.body, cta: input.cta, duration: milliseconds(input.duration) / 1000, fit: input.fit ?? "contain", focusX: input.focusX ?? 0.5, focusY: input.focusY ?? 0.5, audio: input.audio, sourceIds, selections, ...(input.narrationId ? { narrationId: input.narrationId } : {}) };
    // Persist only overlapping evidence for these selected originals. Fresh trusted
    // history is rechecked by adapters at effects; do not copy the whole ledger.
    const relevantHistory = history.filter(use => (!input.variantId || use.variantId !== input.variantId) && selections.some(selection => {
      const material = available.get(selection.materialId)!;
      return state.assets.find(asset => asset.id === material.assetId)!.sha256 === use.sha256 && selection.start < use.end && selection.end > use.start;
    }));
    const provenance: StudioPlanProvenance = { plannerVersion: 1, studioRevision: state.revision, inputFingerprint: fingerprint, alternative, productId: campaign.productId, campaignFacts: campaignFacts(state, campaign.id), sourceFacts: facts.filter(fact => sourceIds.includes(fact.materialId)), candidateIds: input.candidateIds, allowReuse: input.allowReuse, muteBackground: input.muteBackground, reviewedMaterialIds: input.reviewedMaterialIds, lockedSelections: locked, history: relevantHistory, ...(input.textSourceId ? { textSourceId: input.textSourceId } : {}), ...(input.variantId ? { variantId: input.variantId } : {}), ...(input.analysisIds?.length ? { analysisIds: [...input.analysisIds] } : {}) };
    const variant = { ...recipe, id: input.variantId ?? "", planner: provenance } as StudioVariant;
    validatePlannedVariant(state, variant, history, workspace);
    if (input.allowReuse && selections.some(selection => { const material = available.get(selection.materialId)!; return overlaps(state.assets.find(asset => asset.id === material.assetId)!.sha256, selection.start, selection.end, uses, input.variantId); })) warnings.push("Reutilización de intervalos permitida explícitamente para esta pieza.");
    return { alternative, recipe, provenance, reasons: ["Fuentes listas y permitidas para el producto.", "Tramos fijados conservados en su orden; fondos añadidos por reglas estables.", "Texto conservado literalmente; sin interpretación semántica."], warnings: [...new Set(warnings)] };
  });
  return { fingerprint, proposals, exclusions };
}

/** Revalidate planned variants at every effect boundary; manual legacy recipes are unaffected. */
export function validatePlannedVariant(state: StudioState, variant: StudioVariant, history: StudioPlannerUse[] = [], workspace?: Workspace): void {
  const proof = variant.planner;
  if (!proof) return;
  validateHistory(history);
  if (proof.plannerVersion !== 1 || proof.campaignFacts !== campaignFacts(state, variant.campaignId)) fail("La campaña cambió; vuelve a proponer el montaje.", 409);
  if (workspace && !workspace.products.some(product => product.id === proof.productId)) fail("El producto ya no está disponible.", 409);
  preflightStudioPlanCopy(variant.template, variant.hook, variant.body, variant.cta, variant.duration);
  for (const id of variant.sourceIds) {
    const material = state.materials.find(item => item.id === id), fact = proof.sourceFacts.find(item => item.materialId === id);
    if (!material || !fact || fact.canonical !== materialFacts(state, material)) fail("Una fuente o sus permisos cambió; vuelve a proponer el montaje.", 409);
    const reason = eligible(state, material, proof.productId, { includeShared: true, reviewedMaterialIds: proof.reviewedMaterialIds });
    if (reason) fail(reason, 409);
  }
  if (variant.template === "text") return;
  const uses = [...proof.history, ...history, ...liveUses(state)], assigned: StudioPlannerUse[] = [];
  let total = 0;
  for (const selection of variant.selections) {
    const material = state.materials.find(item => item.id === selection.materialId), asset = state.assets.find(item => item.id === material?.assetId);
    if (!material || !asset || !variant.sourceIds.includes(material.id) || !Number.isFinite(selection.start) || !Number.isFinite(selection.end) || selection.start < 0 || selection.end <= selection.start || selection.end - selection.start > 120 || asset.kind === "video" && (!asset.duration || selection.end > asset.duration + 0.001) || asset.kind === "image" && selection.start !== 0) fail("Revisa los tramos propuestos.");
    const fixed = proof.lockedSelections.some(item => canonical(item) === canonical(selection));
    if (!fixed && !(material.kind === "image" || material.kind === "video" && material.categories.includes("broll"))) fail("El habla y las demos requieren tramos fijados por ti.");
    if (!fixed && milliseconds(selection.end) - milliseconds(selection.start) < 2000) fail("Cada fondo propuesto necesita al menos dos segundos.");
    if (variant.audio === "mute" && !variant.narrationId && !proof.muteBackground) fail("Confirma usar los materiales como fondo silenciado.");
    if (variant.audio === "keep" && !variant.narrationId && material.kind === "video" && material.speech !== "absent" && !fixed) fail("Conserva el habla sólo con un tramo fijado por ti.");
    if (overlaps(asset.sha256, selection.start, selection.end, assigned) || !proof.allowReuse && overlaps(asset.sha256, selection.start, selection.end, uses, variant.id)) fail("Este intervalo ya se utiliza; permite su reutilización o vuelve a proponer.", 409);
    assigned.push({ sha256: asset.sha256, start: selection.start, end: selection.end }); total += milliseconds(selection.end) - milliseconds(selection.start);
  }
  if (!variant.selections.length || variant.selections.length > 3 || total !== milliseconds(variant.duration)) fail("Los tramos deben sumar exactamente la duración propuesta.");
  if (variant.narrationId) {
    const material = state.materials.find(item => item.id === variant.narrationId), asset = state.assets.find(item => item.id === material?.assetId);
    if (material?.kind !== "audio" || !asset?.duration || asset.duration + 0.001 < variant.duration) fail("La narración elegida debe cubrir toda la duración.");
  }
  if (variant.template === "demo" && !variant.narrationId && !(variant.audio === "keep" && variant.selections.some(selection => { const material = state.materials.find(item => item.id === selection.materialId)!; return material.speech === "present" && state.assets.find(item => item.id === material.assetId)?.audioTrack === "present"; }))) fail("La demo necesita narración o voz confirmada y conservada.");
}
