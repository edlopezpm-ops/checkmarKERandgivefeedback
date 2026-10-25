import { DomainError, object, platforms } from "./domain.ts";
import type { Command, Platform, Workspace } from "./domain.ts";
import { validatePlannedVariant } from "./studio-planner.ts";
import type { StudioPlanProposal, StudioPlanProvenance } from "./studio-planner.ts";
import { classifyStudioMaterial } from "./studio-classification.ts";

// The studio is separate from legacy Post delivery. No account, provider or
// publication side effect is involved in preparing or exporting a variant.
export const materialCategories = ["broll", "talking", "demo", "photo", "voice", "idea", "ready-text", "testimonial"] as const;
export const materialRoles = ["background", "narration", "message", "hook", "cta"] as const;
export const studioTemplates = ["overlay", "demo", "tips", "motivation", "text"] as const;
export const STUDIO_MAX_FILE_BYTES = 250 * 1024 * 1024;
export type MaterialKind = "video" | "image" | "audio" | "text" | "idea";
export type MaterialCategory = (typeof materialCategories)[number];
export type MaterialRole = (typeof materialRoles)[number];
export type StudioTemplate = (typeof studioTemplates)[number];
export type StudioAsset = {
  id: string; name: string; mime: string; size: number; sha256: string;
  kind: "video" | "image" | "audio";
  duration?: number; width?: number; height?: number;
  audioTrack: "present" | "absent" | "unknown";
  processing: "ready" | "unsupported";
  createdAt: string;
};
export type StudioMaterialOrigin = {
  kind: "legacy-source"; sourceId: string; productId: string; title: string;
  text: string; declaredDate: string; createdAt: string;
};
/** Immutable generation receipt, attached only by the trusted agent service. */
export type StudioGenerationOrigin = {
  kind: "agent"; runId: string; proposalId: string; connectionId: string;
  provider: "openai-codex"; model: string; createdAt: string;
  sourceRefs: Array<{ materialId: string; contentVersion: number }>;
};
export type StudioMaterial = {
  id: string; title: string; kind: MaterialKind; productIds: string[];
  categories: MaterialCategory[]; topics: string[]; roles: MaterialRole[];
  review: "unreviewed" | "classified" | "ready";
  text: string; description: string; speech: "unknown" | "present" | "absent";
  rights: "unknown" | "owned" | "licensed" | "restricted";
  restrictions: string; usefulStart?: number; usefulEnd?: number; assetId?: string;
  origin?: StudioMaterialOrigin;
  generation?: StudioGenerationOrigin;
  contentVersion: number; createdAt: string; updatedAt: string;
};
export type StudioCampaign = {
  id: string; productId: string; title: string; objective: string; audience: string;
  kind: "organic" | "paid"; status: "draft" | "paused";
  createdAt: string; updatedAt: string;
};
export type StudioSelection = { materialId: string; start: number; end: number };
export type StudioSourceSnapshot = {
  materialId: string; contentVersion: number; assetId?: string; kind: MaterialKind;
  title: string; text: string; speech: StudioMaterial["speech"];
  rights: StudioMaterial["rights"]; restrictions: string;
  origin?: StudioMaterialOrigin;
  generation?: StudioGenerationOrigin;
};
export type StudioVariant = {
  id: string; campaignId: string; platform: Platform; template: StudioTemplate;
  templateVersion: 1;
  hook: string; body: string; cta: string; duration: number;
  fit: "contain" | "cover"; focusX: number; focusY: number; audio: "mute" | "keep";
  sourceIds: string[]; selections: StudioSelection[]; narrationId?: string;
  sourceSnapshots: StudioSourceSnapshot[]; recipeRevision: number;
  planner?: StudioPlanProvenance;
  status: "draft" | "approved"; approvedRecipeRevision?: number; approvedJobId?: string;
  createdAt: string; updatedAt: string;
};
export type StudioState = {
  version: 1; revision: number; assets: StudioAsset[]; materials: StudioMaterial[];
  campaigns: StudioCampaign[]; variants: StudioVariant[];
};
export type TrustedStudioRender = { variantId: string; recipeRevision: number; jobId: string };
export type StudioCommandContext = { now?: string; newId?: () => string; trustedRender?: TrustedStudioRender; trustedPlan?: StudioPlanProposal; generation?: StudioGenerationOrigin };
/** Not parsed from HTTP; only product services may supply these values. */
export type TrustedStudioInvocation = { newId?: string; generation?: StudioGenerationOrigin };
export type StudioRenderSpec = {
  variantId: string; recipeRevision: number; template: StudioTemplate;
  templateVersion: 1;
  duration: number; hook: string; body: string; cta: string;
  fit: "contain" | "cover"; focusX: number; focusY: number; audio: "mute" | "keep";
  clips: Array<{ assetId: string; kind: "video" | "image" | "audio"; start: number; end: number }>;
  narrationAssetId?: string;
};

export function emptyStudio(): StudioState {
  return { version: 1, revision: 0, assets: [], materials: [], campaigns: [], variants: [] };
}
function str(data: Record<string, unknown>, key: string, max = 1000, required = false, trim = true): string {
  const value = data[key] ?? "";
  if (typeof value !== "string" || value.length > max || value.includes("\0") || (required && !value.trim()))
    throw new DomainError(`Revisa el campo ${key} (máximo ${max}).`);
  return trim ? value.trim() : value;
}
function num(data: Record<string, unknown>, key: string, min: number, max: number): number {
  const value = data[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
    throw new DomainError(`Revisa el campo ${key} (${min}–${max}).`);
  return value;
}
function pick<T extends string>(data: Record<string, unknown>, key: string, values: readonly T[]): T {
  if (!values.includes(data[key] as T)) throw new DomainError(`Valor inválido: ${key}.`);
  return data[key] as T;
}
function list(data: Record<string, unknown>, key: string, max = 100): string[] {
  const values = data[key];
  if (!Array.isArray(values) || values.length > max || values.some((value) => typeof value !== "string" || !value.trim() || value.length > 100 || value.includes("\0")))
    throw new DomainError(`Selección inválida: ${key}.`);
  return [...new Set((values as string[]).map((value) => value.trim()))];
}
function options<T extends string>(data: Record<string, unknown>, key: string, values: readonly T[]): T[] {
  const selected = list(data, key, 20);
  if (selected.some((value) => !values.includes(value as T))) throw new DomainError(`Selección inválida: ${key}.`);
  return selected as T[];
}
function find<T extends { id: string }>(items: readonly T[], id: string): T {
  const item = items.find((entry) => entry.id === id);
  if (!item) throw new DomainError("El registro ya no existe. Recarga la vista.", 404);
  return item;
}
function store<T extends { id: string }>(items: T[], item: T, previous?: T) {
  if (previous) items[items.findIndex((entry) => entry.id === previous.id)] = item;
  else {
    if (items.length >= 1000) throw new DomainError("Límite de 1.000 registros por colección.");
    if (items.some((entry) => entry.id === item.id)) throw new DomainError("El identificador ya existe.", 409);
    items.push(item);
  }
}
function verifiedState(state: StudioState) {
  if (state.version !== 1 || !Number.isSafeInteger(state.revision) || state.revision < 0)
    throw new DomainError("Versión de biblioteca inválida.", 409);
}
function changedState(state: StudioState): StudioState {
  state.revision++;
  if (new TextEncoder().encode(JSON.stringify(state)).byteLength > 8 * 1024 * 1024)
    throw new DomainError("La biblioteca supera el límite local de 8 MiB de metadatos.");
  return state;
}
function unapprove(variant: StudioVariant) {
  variant.status = "draft";
  delete variant.approvedRecipeRevision;
  delete variant.approvedJobId;
}
function confirm(data: Record<string, unknown>) {
  if (data.confirmed !== true) throw new DomainError("Confirma la revisión o el borrado explícitamente.");
}
function snapshot(material: StudioMaterial): StudioSourceSnapshot {
  return { materialId: material.id, contentVersion: material.contentVersion, assetId: material.assetId,
    kind: material.kind, title: material.title, text: material.text, speech: material.speech,
    rights: material.rights, restrictions: material.restrictions,
    ...(material.origin ? { origin: structuredClone(material.origin) } : {}),
    ...(material.generation ? { generation: structuredClone(material.generation) } : {}) };
}
export function materialUses(state: StudioState, materialId: string): StudioVariant[] {
  return state.variants.filter((variant) => variant.sourceIds.includes(materialId));
}

// Only the trusted storage adapter calls this after storing and probing a file.
// There is deliberately no corresponding browser command for asset metadata.
export function registerStudioAsset(previous: StudioState, supplied: StudioAsset): StudioState {
  verifiedState(previous);
  const state = structuredClone(previous), data = object(supplied);
  const asset: StudioAsset = {
    id: str(data, "id", 100, true), name: str(data, "name", 240, true), mime: str(data, "mime", 100, true),
    size: num(data, "size", 1, STUDIO_MAX_FILE_BYTES), sha256: str(data, "sha256", 64, true),
    kind: pick(data, "kind", ["video", "image", "audio"]),
    audioTrack: pick(data, "audioTrack", ["present", "absent", "unknown"]),
    processing: pick(data, "processing", ["ready", "unsupported"]), createdAt: str(data, "createdAt", 40, true),
  };
  if (!/^[a-f0-9]{64}$/i.test(asset.sha256) || !Number.isSafeInteger(asset.size) || !Number.isFinite(Date.parse(asset.createdAt)))
    throw new DomainError("Metadatos de archivo inválidos.");
  if (data.duration !== undefined) asset.duration = num(data, "duration", 0.001, 86_400 * 30);
  if (data.width !== undefined) asset.width = num(data, "width", 1, 65_536);
  if (data.height !== undefined) asset.height = num(data, "height", 1, 65_536);
  if (asset.processing === "ready" && ((asset.kind !== "image" && !asset.duration) || (asset.kind !== "audio" && (!asset.width || !asset.height))))
    throw new DomainError("Faltan datos técnicos para procesar el original.");
  if (state.assets.some((existing) => existing.id === asset.id))
    throw new DomainError("El original es inmutable y su identificador ya existe.", 409);
  store(state.assets, asset);
  return changedState(state);
}

function saveMaterial(state: StudioState, workspace: Workspace, data: Record<string, unknown>, id: string, old: StudioMaterial | undefined, now: string) {
  const values: Record<string, unknown> = { kind: "idea", productIds: [], categories: [], topics: [], roles: [], review: "unreviewed", speech: "unknown", rights: "unknown", ...old, ...data };
  const importSourceId = str(data, "importSourceId", 100);
  let origin = old?.origin;
  if (importSourceId) {
    if (old && old.origin?.sourceId !== importSourceId)
      throw new DomainError("La procedencia del material es inmutable. Crea una ficha nueva.", 409);
    if (!old) {
      const source = find(workspace.sources, importSourceId);
      if (!list(values, "productIds").includes(source.productId))
        throw new DomainError("La importación debe incluir el producto de su fuente original.");
      origin = { kind: "legacy-source", sourceId: source.id, productId: source.productId,
        title: source.title, text: source.text, declaredDate: source.declaredDate, createdAt: source.createdAt };
      if (data.kind === undefined) values.kind = "text";
      if (data.text === undefined) values.text = source.text;
      if (data.title === undefined) values.title = source.title;
    }
  }
  const kind = pick(values, "kind", ["video", "image", "audio", "text", "idea"]);
  const assetId = str(values, "assetId", 100) || undefined;
  const asset = assetId ? find(state.assets, assetId) : undefined;
  if ((kind === "video" || kind === "image" || kind === "audio") && (!asset || asset.kind !== kind))
    throw new DomainError("Selecciona un original del tipo indicado.");
  if ((kind === "text" || kind === "idea") && asset) throw new DomainError("Un texto o idea no admite un original multimedia.");
  const productIds = list(values, "productIds");
  productIds.forEach((productId) => find(workspace.products, productId));
  const material: StudioMaterial = {
    id, kind, assetId, title: str(values, "title", 160) || asset?.name || (kind === "idea" ? "Idea" : "Texto"),
    productIds, categories: options(values, "categories", materialCategories), topics: list(values, "topics", 30),
    roles: options(values, "roles", materialRoles), review: pick(values, "review", ["unreviewed", "classified", "ready"]),
    text: str(values, "text", 64_000, false, false), description: str(values, "description", 2000),
    speech: pick(values, "speech", ["unknown", "present", "absent"]), rights: pick(values, "rights", ["unknown", "owned", "licensed", "restricted"]),
    restrictions: str(values, "restrictions", 2000), contentVersion: old?.contentVersion ?? 1, createdAt: old?.createdAt ?? now, updatedAt: now,
    ...(origin ? { origin: structuredClone(origin) } : {}),
    ...(old?.generation ? { generation: structuredClone(old.generation) } : {}),
  };
  if (!asset && !material.text && !material.description && !str(values, "title", 160))
    throw new DomainError("Escribe una idea, un título o una descripción antes de guardar.");
  if (values.usefulStart !== undefined && values.usefulStart !== null && values.usefulStart !== "")
    material.usefulStart = num(values, "usefulStart", 0, asset?.duration ?? 120);
  if (values.usefulEnd !== undefined && values.usefulEnd !== null && values.usefulEnd !== "")
    material.usefulEnd = num(values, "usefulEnd", 0.001, asset?.duration ?? 120);
  if (material.usefulEnd !== undefined && (material.usefulEnd <= (material.usefulStart ?? 0) || material.usefulEnd - (material.usefulStart ?? 0) > 120))
    throw new DomainError("El tramo útil debe ser positivo y no superar 120 segundos.");
  if (old && (old.kind !== material.kind || old.assetId !== material.assetId || old.text !== material.text)) material.contentVersion++;
  if (old && (old.rights !== material.rights || old.restrictions !== material.restrictions))
    materialUses(state, id).forEach(unapprove);
  if (!old) Object.assign(material, classifyStudioMaterial(material, asset));
  store(state.materials, material, old);
}

function selections(data: Record<string, unknown>, sourceIds: string[], sourceSnapshots: StudioSourceSnapshot[]): StudioSelection[] {
  const supplied = data.selections;
  if (!Array.isArray(supplied) || supplied.length > 3) throw new DomainError("Selecciona un máximo de tres clips visuales.");
  const result: StudioSelection[] = supplied.map((value) => {
    const entry = object(value), materialId = str(entry, "materialId", 100, true);
    if (!sourceIds.includes(materialId)) throw new DomainError("El tramo no pertenece a la selección de fuentes.");
    const material = sourceSnapshots.find((source) => source.materialId === materialId)!;
    if (material.kind !== "video" && material.kind !== "image") throw new DomainError("El tramo visual necesita un video o una imagen.");
    const start = num(entry, "start", 0, 86_400 * 30), end = num(entry, "end", 0.001, 86_400 * 30);
    if (end <= start || end - start > 120 || (material.kind === "image" && start !== 0))
      throw new DomainError("Revisa el tramo: máximo 120 segundos; imágenes desde cero.");
    return { materialId, start, end };
  });
  return result;
}

function saveVariant(state: StudioState, data: Record<string, unknown>, id: string, old: StudioVariant | undefined, now: string) {
  const values = { platform: "Instagram", template: "overlay", duration: 20, fit: "contain", focusX: 0.5, focusY: 0.5, audio: "mute", sourceIds: [], selections: [], ...old, ...data };
  const campaignId = str(values, "campaignId", 100, true);
  find(state.campaigns, campaignId);
  const sourceIds = list(values, "sourceIds", 20);
  const narrationId = str(values, "narrationId", 100) || undefined;
  if (narrationId && !sourceIds.includes(narrationId)) sourceIds.push(narrationId);
  const sourceSnapshots = sourceIds.map((sourceId) => {
    const material = find(state.materials, sourceId);
    const previous = old?.sourceSnapshots.find((item) => item.materialId === sourceId);
    return previous && data.refreshSources !== true ? structuredClone(previous) : snapshot(material);
  });
  const variant: StudioVariant = {
    id, campaignId, platform: pick(values, "platform", platforms), template: pick(values, "template", studioTemplates), templateVersion: 1,
    hook: str(values, "hook", 240), body: str(values, "body", 20_000, false, false), cta: str(values, "cta", 240),
    duration: num(values, "duration", 5, 60), fit: pick(values, "fit", ["contain", "cover"]),
    focusX: num(values, "focusX", 0, 1), focusY: num(values, "focusY", 0, 1), audio: pick(values, "audio", ["mute", "keep"]),
    sourceIds, selections: selections(values, sourceIds, sourceSnapshots), narrationId, sourceSnapshots,
    recipeRevision: old?.recipeRevision ?? 1, status: "draft", createdAt: old?.createdAt ?? now, updatedAt: now,
    ...(old?.planner ? { planner: structuredClone(old.planner) } : {}),
  };
  for (const selection of variant.selections) {
    const source = sourceSnapshots.find((item) => item.materialId === selection.materialId)!;
    const asset = source.assetId ? find(state.assets, source.assetId) : undefined;
    if (!asset || asset.kind !== source.kind || (asset.kind === "video" && asset.duration !== undefined && selection.end > asset.duration + 0.001))
      throw new DomainError("El tramo supera la duración del original o no coincide con la fuente.");
  }
  if (narrationId && sourceSnapshots.find((source) => source.materialId === narrationId)?.kind !== "audio")
    throw new DomainError("La narración necesita un original de audio.");
  if (old) {
    const recipe = (item: StudioVariant) => {
      const { recipeRevision: _revision, status: _status, approvedRecipeRevision: _approved, approvedJobId: _job, updatedAt: _updated, ...rest } = item;
      return rest;
    };
    if (JSON.stringify(recipe(old)) === JSON.stringify(recipe(variant))) {
      variant.status = old.status;
      variant.approvedRecipeRevision = old.approvedRecipeRevision;
      variant.approvedJobId = old.approvedJobId;
    } else variant.recipeRevision++;
  }
  store(state.variants, variant, old);
}

function assertRights(state: StudioState, variant: StudioVariant) {
  for (const sourceId of variant.sourceIds) {
    const source = find(state.materials, sourceId);
    if (source.rights !== "owned" && source.rights !== "licensed")
      throw new DomainError("Confirma los derechos de todas las fuentes antes de aprobar o exportar.", 409);
    const selected = variant.sourceSnapshots.find((entry) => entry.materialId === sourceId);
    if (!selected) throw new DomainError("Revisa la versión seleccionada de la fuente antes de aprobar o exportar.", 409);
    const historical = source.contentVersion !== selected.contentVersion || source.kind !== selected.kind || source.assetId !== selected.assetId;
    if (historical && selected.rights !== "owned" && selected.rights !== "licensed")
      throw new DomainError("Los derechos actuales pertenecen a otra versión. Revisa o actualiza la versión seleccionada de la fuente.", 409);
  }
}
function assertCopy(variant: StudioVariant) {
  if (!variant.body.trim()) throw new DomainError("Completa el texto desarrollado antes de generar o aprobar.");
  if (variant.template !== "text" && (variant.body.length > 900 || variant.hook.length > 160 || variant.cta.length > 160))
    throw new DomainError("Reduce el texto superpuesto: mensaje 900, gancho y cierre 160 caracteres.");
}

export function buildRenderSpec(state: StudioState, variantId: string): StudioRenderSpec {
  const variant = find(state.variants, variantId);
  validatePlannedVariant(state, variant);
  assertCopy(variant);
  if (variant.template === "text") throw new DomainError("La plantilla de texto se exporta como TXT, sin render multimedia.");
  const clips = variant.selections.map((selection) => {
    const source = variant.sourceSnapshots.find((item) => item.materialId === selection.materialId);
    if (!source?.assetId) throw new DomainError("La receta necesita un original visual.");
    const asset = find(state.assets, source.assetId);
    if (asset.processing !== "ready") throw new DomainError("El original todavía no tiene un formato compatible para procesar.", 409);
    if (asset.kind !== "video" && asset.kind !== "image") throw new DomainError("La receta necesita un video o imagen.");
    if (selection.end <= selection.start || selection.end - selection.start > 120 || (asset.kind === "video" && (!asset.duration || selection.end > asset.duration + 0.001)))
      throw new DomainError("El tramo no corresponde a la duración del original.");
    return { assetId: asset.id, kind: asset.kind, start: selection.start, end: selection.end };
  });
  if (!clips.length || clips.length > 3) throw new DomainError("Selecciona de uno a tres clips visuales.");
  const total = clips.reduce((sum, clip) => sum + clip.end - clip.start, 0);
  if (Math.abs(total - variant.duration) > 0.05)
    throw new DomainError(`La suma de tramos (${total.toFixed(2)} s) debe coincidir con la duración (${variant.duration} s).`);
  let narrationAssetId: string | undefined;
  if (variant.narrationId) {
    const source = variant.sourceSnapshots.find((entry) => entry.materialId === variant.narrationId);
    const asset = source?.assetId ? find(state.assets, source.assetId) : undefined;
    if (!asset || asset.kind !== "audio" || asset.processing !== "ready") throw new DomainError("La narración no está lista para procesar.", 409);
    if (!asset.duration || asset.duration + 0.05 < variant.duration) throw new DomainError("La narración es más corta que la pieza. Ajusta su duración.");
    narrationAssetId = asset.id;
  }
  if (variant.template === "demo" && !narrationAssetId && !(variant.audio === "keep" && variant.selections.some((selection) => {
    const source = variant.sourceSnapshots.find((entry) => entry.materialId === selection.materialId)!;
    const asset = find(state.assets, source.assetId!);
    return source.kind === "video" && find(state.materials, source.materialId).speech === "present" && asset.audioTrack === "present";
  }))) throw new DomainError("La demostración narrada necesita narración o voz confirmada con audio conservado.");
  return { variantId: variant.id, recipeRevision: variant.recipeRevision, template: variant.template, templateVersion: 1,
    duration: variant.duration, hook: variant.hook, body: variant.body, cta: variant.cta,
    fit: variant.fit, focusX: variant.focusX, focusY: variant.focusY, audio: variant.audio, clips, narrationAssetId };
}

export function assertStudioExportable(state: StudioState, variantId: string, jobId?: string): StudioVariant {
  const variant = find(state.variants, variantId);
  validatePlannedVariant(state, variant);
  assertCopy(variant);
  assertRights(state, variant);
  if (variant.status !== "approved" || variant.approvedRecipeRevision !== variant.recipeRevision)
    throw new DomainError("Aprueba la revisión actual antes de exportar.", 409);
  if (variant.template !== "text" && (!jobId || variant.approvedJobId !== jobId))
    throw new DomainError("La exportación necesita el render aprobado de esta revisión.", 409);
  return variant;
}

export function applyStudioCommand(previous: StudioState, workspace: Workspace, command: Command, context: StudioCommandContext = {}): StudioState {
  verifiedState(previous);
  const state = structuredClone(previous), data = object(command.data);
  const now = context.now ?? new Date().toISOString(), newId = context.newId ?? (() => crypto.randomUUID());
  const editingId = str(data, "id", 100), id = editingId || newId();
  switch (command.type) {
    case "material.classify": {
      if (Object.keys(data).length !== 1 || !Array.isArray(data.ids) || !data.ids.length)
        throw new DomainError("Selecciona de uno a 50 materiales para clasificar.");
      const materialIds = list(data, "ids", 50);
      const materials = materialIds.map(materialId => find(state.materials, materialId));
      let changed = false;
      for (const material of materials) {
        const labels = classifyStudioMaterial(material, state.assets.find(asset => asset.id === material.assetId));
        if (JSON.stringify(labels.categories) === JSON.stringify(material.categories) && JSON.stringify(labels.roles) === JSON.stringify(material.roles)) continue;
        Object.assign(material, labels, { updatedAt: now }); changed = true;
      }
      if (!changed) return previous;
      break;
    }
    case "material.save":
      saveMaterial(state, workspace, data, id, editingId ? find(state.materials, id) : undefined, now);
      if (!editingId && context.generation) find(state.materials, id).generation = structuredClone(context.generation);
      break;
    case "material.delete":
      find(state.materials, id); confirm(data);
      if (materialUses(state, id).length) throw new DomainError("El material está en uso por una variante; conserva sus fuentes.", 409);
      state.materials = state.materials.filter((item) => item.id !== id);
      break;
    case "campaign.save": {
      const old = editingId ? find(state.campaigns, id) : undefined;
      const values = { kind: "organic", ...old, ...data }, productId = str(values, "productId", 100, true);
      find(workspace.products, productId);
      if (old && old.productId !== productId && state.variants.some((variant) => variant.campaignId === id))
        throw new DomainError("La campaña ya tiene variantes; conserva su producto.", 409);
      const kind = pick(values, "kind", ["organic", "paid"]);
      store(state.campaigns, { id, productId, title: str(values, "title", 160), objective: str(values, "objective", 2000), audience: str(values, "audience", 1000), kind, status: kind === "paid" ? "paused" : "draft", createdAt: old?.createdAt ?? now, updatedAt: now }, old);
      break;
    }
    case "campaign.delete":
      find(state.campaigns, id); confirm(data);
      if (state.variants.some((variant) => variant.campaignId === id)) throw new DomainError("La campaña tiene variantes. Retíralas explícitamente primero.", 409);
      state.campaigns = state.campaigns.filter((item) => item.id !== id);
      break;
    case "variant.save":
      saveVariant(state, data, id, editingId ? find(state.variants, id) : undefined, now);
      break;
    case "variant.plan": {
      const proposal = context.trustedPlan;
      if (!proposal || proposal.provenance.studioRevision !== previous.revision || proposal.provenance.variantId !== (editingId || undefined))
        throw new DomainError("La propuesta necesita verificación actual del servidor; vuelve a proponer.", 409);
      const old = editingId ? find(state.variants, id) : undefined;
      saveVariant(state, { ...proposal.recipe, refreshSources: true }, id, old, now);
      const variant = find(state.variants, id);
      // Provenance comes exclusively from the server's recomputed proposal.
      variant.planner = structuredClone(proposal.provenance);
      if (old && JSON.stringify(old.planner) !== JSON.stringify(variant.planner)) {
        if (variant.recipeRevision === old.recipeRevision) variant.recipeRevision++;
        unapprove(variant);
      }
      validatePlannedVariant(state, variant, [], workspace);
      break;
    }
    case "variant.approve": {
      const variant = find(state.variants, id);
      validatePlannedVariant(state, variant, [], workspace);
      confirm(data); assertCopy(variant); assertRights(state, variant);
      if (variant.template !== "text") {
        buildRenderSpec(state, id);
        const render = context.trustedRender;
        if (!render || render.variantId !== id || render.recipeRevision !== variant.recipeRevision || !render.jobId)
          throw new DomainError("Revisa un render completo de la revisión actual antes de aprobar.", 409);
        variant.approvedJobId = render.jobId;
      }
      variant.status = "approved"; variant.approvedRecipeRevision = variant.recipeRevision; variant.updatedAt = now;
      break;
    }
    case "variant.delete":
      find(state.variants, id); confirm(data);
      state.variants = state.variants.filter((item) => item.id !== id);
      break;
    default: throw new DomainError("Operación no admitida.");
  }
  return changedState(state);
}
