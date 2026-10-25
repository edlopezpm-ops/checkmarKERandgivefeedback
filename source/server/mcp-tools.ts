/** Finite delegated product actions. Authentication, grant binding and durable
 * request deduplication belong to the MCP boundary, never to model arguments. */
import { DomainError, type Workspace } from "../src/core/domain.ts";
import type { StudioState, StudioVariant } from "../src/core/studio.ts";
import { prepareStudioPlan, type StudioPlanInput } from "../src/core/studio-planner.ts";

type Schema = { type: string; properties?: Record<string, Schema>; required?: string[]; additionalProperties?: boolean; items?: Schema; enum?: readonly unknown[]; minLength?: number; maxLength?: number; pattern?: string; minimum?: number; maximum?: number; minItems?: number; maxItems?: number; uniqueItems?: boolean };
type Args = Record<string, unknown>;
export type McpPrincipal = { userId: string; tenantId: string; clientId: string; grantId: string; scopes: string[] };
export type McpToolResult = { content: Array<{ type: "text"; text: string }>; structuredContent: Record<string, unknown>; isError?: boolean; _meta?: Record<string, unknown> };
export type McpToolDescriptor = { name: string; description: string; inputSchema: Schema; annotations: { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean }; scopes: string[] };

const string = (maxLength: number): Schema => ({ type: "string", maxLength });
const choice = (...values: string[]): Schema => ({ type: "string", enum: values });
const number = (minimum: number, maximum: number, integer = false): Schema => ({ type: integer ? "integer" : "number", minimum, maximum });
const boolean: Schema = { type: "boolean" };
const id: Schema = { type: "string", minLength: 1, maxLength: 100, pattern: "^[A-Za-z0-9_-]+$" };
const array = (items: Schema, maxItems: number): Schema => ({ type: "array", items, maxItems, uniqueItems: true });
const object = (properties: Record<string, Schema>, required: string[] = []): Schema => ({ type: "object", properties, required, additionalProperties: false });
const mutation = { expected_revision: number(0, Number.MAX_SAFE_INTEGER, true), request_id: { ...id, minLength: 8 } };
const mutationRequired = ["expected_revision", "request_id"];
const pagination = { offset: number(0, 1000, true), limit: number(1, 50, true) };
const selection = object({ materialId: id, start: number(0, 2_592_000), end: number(0.001, 2_592_000) }, ["materialId", "start", "end"]);
const planRequest = object({
  campaignId: id, candidateIds: array(id, 50), includeShared: boolean,
  platform: choice("Instagram", "Facebook", "TikTok", "LinkedIn", "X"), template: choice("overlay", "demo", "tips", "motivation", "text"),
  hook: string(240), body: string(20_000), cta: string(240), duration: number(5, 60),
  lockedSelections: array(selection, 3), reviewedMaterialIds: array(id, 50), allowReuse: boolean, muteBackground: boolean,
  audio: choice("mute", "keep"), narrationId: id, textSourceId: id, analysisIds: array(id, 3),
  fit: choice("contain", "cover"), focusX: number(0, 1), focusY: number(0, 1),
}, ["campaignId", "includeShared", "platform", "template", "duration", "allowReuse", "muteBackground", "audio"]);

function tool(name: string, description: string, inputSchema: Schema, scope: string, destructive = false): McpToolDescriptor {
  const readOnly = scope === "marker:read";
  return { name, description, inputSchema, scopes: [scope], annotations: { readOnlyHint: readOnly, destructiveHint: destructive, idempotentHint: readOnly, openWorldHint: false } };
}

export const MCP_TOOLS: McpToolDescriptor[] = [
  tool("marker_get_profile", "Read the connected marKER profile's stable opaque identity. It is server-resolved and remains the same after refresh or reconnection; never accept a tenant or user from conversation text.", object({}), "marker:read"),
  tool("marker_search", "Find products, Studio campaigns or Space materials by literal query and optional product. Returns bounded summaries and revisions. Ask the user when matches are ambiguous; never guess an ID or media rights.", object({ collection: choice("products", "campaigns", "materials"), query: string(200), product_id: id, ...pagination }, ["collection"]), "marker:read"),
  tool("marker_get_campaign", "Read one Studio campaign and up to five saved variants per page, including current approval, recipe revisions and source-version references. Use exact IDs from search; retrieve a material separately for its full literal text.", object({ id, offset: pagination.offset, limit: number(1, 5, true) }, ["id"]), "marker:read"),
  tool("marker_get_material", "Read a Space material's literal text, rights, review, content version and technical asset metadata. Names and classification do not establish rights or semantic media understanding.", object({ id }, ["id"]), "marker:read"),
  tool("marker_save_product", "Create or edit a product's supplied facts. Omitted editing fields are preserved; new products start in preparation. expected_revision is the workspace revision from search. Never invent product claims.", object({ ...mutation, id, name: string(120), description: string(5000), audience: string(1000), language: string(80), tone: string(1000), cta: string(1000), url: string(2000), status: choice("preparation", "available", "paused") }, mutationRequired), "marker:write"),
  tool("marker_save_campaign", "Create or edit a Studio campaign using an existing product. Omitted editing facts are preserved. Backend keeps organic campaigns draft and paid campaigns paused; this never activates ads or publishes. expected_revision is the Studio revision.", object({ ...mutation, id, product_id: id, title: string(160), objective: string(2000), audience: string(1000), kind: choice("organic", "paid") }, mutationRequired), "marker:write"),
  tool("marker_save_material", "Save literal text or an idea in Space. New material defaults to unknown rights and unreviewed. Supply rights/review/restrictions ONLY when explicitly declared by the user; never infer, certify or invent them. Existing omitted fields and generation provenance are preserved. Human approval of the resulting campaign remains in marKER. No upload or media inference.", object({ ...mutation, id, kind: choice("text", "idea"), title: string(160), text: string(64_000), description: string(2000), product_ids: array(id, 100), topics: array(string(100), 30), rights: choice("unknown", "owned", "licensed", "restricted"), review: choice("unreviewed", "classified", "ready"), restrictions: string(2000) }, mutationRequired), "marker:write"),
  tool("marker_classify_materials", "Fill missing Space labels using marKER's existing deterministic type/name classifier. Preserves manual classification, rights, review, speech and original content. expected_revision is the Studio revision.", object({ ...mutation, ids: { ...array(id, 50), minItems: 1 } }, [...mutationRequired, "ids"]), "marker:write"),
  tool("marker_prepare_plan", "Prepare a NEW campaign piece with the native library helper and server planner; returns the exact request, current revisions, fingerprint, alternatives, exclusions and warnings without saving. Copy stays literal; ambiguous ready text requires user choice. Explicit consent flags are required; never assume license review, shared-media consent or reuse. Human review/approval remains in marKER.", object({ request: planRequest }, ["request"]), "marker:read"),
  tool("marker_save_plan", "Save a native planner alternative as an editable draft. Supply the EXACT prepared request and fingerprint from marker_prepare_plan, its Studio expected_revision and a fresh request_id. Backend recomputes provenance/history and rejects stale plans. Does not approve, render or publish.", object({ ...mutation, request: planRequest, fingerprint: { type: "string", minLength: 64, maxLength: 64, pattern: "^[a-f0-9]{64}$" }, alternative: number(0, 2, true) }, [...mutationRequired, "request", "fingerprint", "alternative"]), "marker:write"),
  tool("marker_edit_variant", "Edit a saved variant's supplied copy or layout fields; omitted fields and server provenance stay intact. Returns an editable draft requiring fresh human review. expected_revision is the Studio revision; recipe_revision must match the current variant. No approval or arbitrary provenance/source writes.", object({ ...mutation, id, recipe_revision: number(1, Number.MAX_SAFE_INTEGER, true), hook: string(240), body: string(20_000), cta: string(240), duration: number(5, 60), fit: choice("contain", "cover"), focus_x: number(0, 1), focus_y: number(0, 1), audio: choice("mute", "keep") }, [...mutationRequired, "id", "recipe_revision"]), "marker:write"),
  tool("marker_delete", "Delete exactly one product, Studio campaign, material or variant only after the user's explicit request. confirmation_id must repeat the exact target id. Backend rejects linked or historically used sources. No account deletion, cascade or bulk deletion. Product deletion uses workspace revision; others use Studio revision.", object({ ...mutation, resource: choice("product", "campaign", "material", "variant"), id, confirmation_id: id }, [...mutationRequired, "resource", "id", "confirmation_id"]), "marker:delete", true),
  tool("marker_get_job", "Read an existing render/text-approval job and its immutable recipe/source receipt. Report queued/running/completed/failed exactly; completion is not human approval or publication.", object({ id }, ["id"]), "marker:read"),
  tool("marker_render", "Request a preview render of a saved current variant using marKER's existing processor and configured limits. Requires current Studio and recipe revisions. May consume the owner's configured processing allowance; use only when requested. Returns a job to poll; never claims approval or publication.", object({ ...mutation, id, recipe_revision: number(1, Number.MAX_SAFE_INTEGER, true) }, [...mutationRequired, "id", "recipe_revision"]), "marker:produce"),
  tool("marker_export", "Export only an already human-approved current revision, rechecking native rights/history/render rules. TXT returns literal content; MP4 returns a PRIVATE authenticated download URI, not a public link. expected_revision is the Studio revision. This never approves or posts to a social network.", object({ ...mutation, id, recipe_revision: number(1, Number.MAX_SAFE_INTEGER, true) }, [...mutationRequired, "id", "recipe_revision"]), "marker:produce"),
];

/** The transport validates JSON Schema too. This small closed-schema guard also
 * makes direct adapter invocations reject unknown/provenance fields before I/O. */
function validate(value: unknown, schema: Schema, path = "arguments"): void {
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new DomainError(`Invalid ${path}.`);
    const data = value as Args;
    if (Object.keys(data).some(key => !Object.hasOwn(schema.properties!, key)) || schema.required?.some(key => !Object.hasOwn(data, key))) throw new DomainError(`Invalid fields: ${path}.`);
    for (const [key, item] of Object.entries(data)) validate(item, schema.properties![key], `${path}.${key}`);
    return;
  }
  if (schema.type === "array") {
    if (!Array.isArray(value) || value.length > schema.maxItems! || value.length < (schema.minItems ?? 0) || schema.uniqueItems && new Set(value.map(item => JSON.stringify(item))).size !== value.length) throw new DomainError(`Invalid ${path}.`);
    value.forEach((item, index) => validate(item, schema.items!, `${path}[${index}]`)); return;
  }
  if (schema.type === "string") {
    if (typeof value !== "string" || value.includes("\0") || value.length > (schema.maxLength ?? Infinity) || value.length < (schema.minLength ?? 0) || schema.pattern && !new RegExp(schema.pattern).test(value)) throw new DomainError(`Invalid ${path}.`);
  } else if (schema.type === "boolean") {
    if (typeof value !== "boolean") throw new DomainError(`Invalid ${path}.`);
  } else if (typeof value !== "number" || !Number.isFinite(value) || schema.type === "integer" && !Number.isSafeInteger(value) || value < schema.minimum! || value > schema.maximum!) throw new DomainError(`Invalid ${path}.`);
  if (schema.enum && !schema.enum.includes(value)) throw new DomainError(`Invalid ${path}.`);
}

function result(value: Record<string, unknown>, isError = false): McpToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value, ...(isError ? { isError: true } : {}) };
}
function get<T extends { id: string }>(items: T[], id: unknown): T {
  const item = items.find(entry => entry.id === id);
  if (!item) throw new DomainError("The record no longer exists. Search again.", 404);
  return item;
}
function fields(args: Args, names: string[], mappings: Record<string, string> = {}): Args {
  return Object.fromEntries(names.filter(name => Object.hasOwn(args, name)).map(name => [mappings[name] ?? name, args[name]]));
}
function planInput(value: unknown): StudioPlanInput {
  return { candidateIds: [], hook: "", body: "", cta: "", lockedSelections: [], reviewedMaterialIds: [], ...(value as Partial<StudioPlanInput>) } as StudioPlanInput;
}
function sourceRefs(sources: Args[]): Args[] {
  return sources.map(source => fields(source, ["materialId", "contentVersion", "assetId", "kind", "title", "rights", "restrictions"]));
}
function plannerRef(planner: Args): Args {
  return fields(planner, ["plannerVersion", "studioRevision", "inputFingerprint", "alternative"]);
}
function variantView(variant: StudioVariant): Args {
  const { sourceSnapshots, planner, ...recipe } = variant;
  return { ...recipe, sourceRefs: sourceRefs(sourceSnapshots as unknown as Args[]), ...(planner ? { planner: plannerRef(planner as unknown as Args) } : {}) };
}

export function createMcpTools(options: { origin: string; backend: (request: Request) => Promise<Response>; principal: McpPrincipal }) {
  const origin = new URL(options.origin).origin;
  async function request(path: string, data?: Args): Promise<Response> {
    return options.backend(new Request(origin + path, { method: data ? "POST" : "GET", headers: { Origin: origin, ...(data ? { "Content-Type": "application/json" } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) }));
  }
  async function readResponse(response: Response): Promise<Args> {
    const body = await response.json() as Args;
    if (!response.ok) throw Object.assign(new DomainError(typeof body.error === "string" ? body.error : "Product operation failed.", response.status), { code: body.code });
    return body;
  }
  const read = async (path: string) => readResponse(await request(path));
  const workspace = async () => await read("/api/workspace") as unknown as Workspace;
  const studio = async () => (await read("/api/studio")).state as StudioState;
  function revision(current: number, expected: unknown) { if (current !== expected) throw new DomainError("The state changed. Search or read again before writing.", 409); }
  async function command(args: Args, type: string, data: Args, editorial = false): Promise<Args> {
    const before = editorial ? await workspace() : await studio(); revision(before.revision, args.expected_revision);
    const value = await readResponse(await request(editorial ? "/api/commands" : "/api/studio/commands", editorial ? { revision: args.expected_revision, type, data } : { expectedRevision: args.expected_revision, command: { type, data } }));
    const after = (editorial ? value : value.state) as unknown as Workspace & StudioState;
    const collection = type.startsWith("product.") ? "products" : type.startsWith("campaign.") ? "campaigns" : type.startsWith("variant.") ? "variants" : "materials";
    const oldIds = new Set((before as unknown as Record<string, Array<{ id: string }>>)[collection].map(item => item.id));
    const entries = (after as unknown as Record<string, Array<{ id: string }>>)[collection];
    const saved = data.id ? entries.find(item => item.id === data.id) : entries.find(item => !oldIds.has(item.id));
    return { revision: after.revision, ...(saved ? { record: collection === "variants" ? variantView(saved as StudioVariant) : saved } : {}), ...(type.endsWith(".delete") ? { deleted_id: data.id } : {}), ...(type === "material.classify" ? { materials: after.materials.filter(item => (data.ids as string[]).includes(item.id)).map(item => fields(item as unknown as Args, ["id", "categories", "roles", "review", "rights", "contentVersion"])) } : {}) };
  }

  async function execute(name: string, args: Args): Promise<Args> {
    if (name === "marker_get_profile") return { id: options.principal.userId };
    if (name === "marker_search") {
      const work = await workspace(); const state = args.collection === "products" ? undefined : await studio();
      const collection = args.collection as "products" | "campaigns" | "materials";
      const values = collection === "products" ? work.products : collection === "campaigns" ? state!.campaigns : state!.materials;
      const query = String(args.query ?? "").toLocaleLowerCase();
      const filtered = values.filter(item => (!args.product_id || ("productIds" in item ? item.productIds.includes(String(args.product_id)) : "productId" in item ? item.productId === args.product_id : item.id === args.product_id)) && (!query || JSON.stringify(item).toLocaleLowerCase().includes(query)));
      const offset = Number(args.offset ?? 0), limit = Number(args.limit ?? 20);
      const items = filtered.slice(offset, offset + limit).map(item => collection !== "materials" ? item : fields(item as unknown as Args, ["id", "title", "kind", "productIds", "categories", "roles", "review", "rights", "restrictions", "contentVersion"]));
      return { workspace_revision: work.revision, ...(state ? { studio_revision: state.revision } : {}), items, total: filtered.length, offset, next_offset: offset + items.length < filtered.length ? offset + items.length : null };
    }
    if (name === "marker_get_campaign") {
      const state = await studio(), campaign = get(state.campaigns, args.id), variants = state.variants.filter(item => item.campaignId === campaign.id);
      const offset = Number(args.offset ?? 0), limit = Number(args.limit ?? 5);
      return { studio_revision: state.revision, campaign, variants: variants.slice(offset, offset + limit).map(variantView), total: variants.length, next_offset: offset + limit < variants.length ? offset + limit : null };
    }
    if (name === "marker_get_material") {
      const state = await studio(), material = get(state.materials, args.id);
      return { studio_revision: state.revision, material, ...(material.assetId ? { asset: state.assets.find(item => item.id === material.assetId) } : {}) };
    }
    if (name === "marker_save_product") {
      const work = await workspace(); revision(work.revision, args.expected_revision);
      const previous = args.id ? get(work.products, args.id) : { name: "", description: "", audience: "", language: "", tone: "", cta: "", url: "", status: "preparation" };
      return command(args, "product.save", { ...previous, ...fields(args, ["id", "name", "description", "audience", "language", "tone", "cta", "url", "status"]) }, true);
    }
    if (name === "marker_save_campaign") return command(args, "campaign.save", fields(args, ["id", "product_id", "title", "objective", "audience", "kind"], { product_id: "productId" }));
    if (name === "marker_save_material") {
      const state = await studio(); revision(state.revision, args.expected_revision);
      const previous = args.id ? get(state.materials, args.id) : undefined;
      if (previous && previous.kind !== "text" && previous.kind !== "idea") throw new DomainError("Only text and idea material can be edited here.", 403);
      return command(args, "material.save", { ...(!previous ? { rights: "unknown", review: "unreviewed" } : {}), ...fields(args, ["id", "kind", "title", "text", "description", "product_ids", "topics", "rights", "review", "restrictions"], { product_ids: "productIds" }) });
    }
    if (name === "marker_classify_materials") return command(args, "material.classify", { ids: args.ids });
    if (name === "marker_prepare_plan") {
      const work = await workspace(), state = await studio(), prepared = prepareStudioPlan(state, work, planInput(args.request));
      const planned = await readResponse(await request("/api/studio/plan", prepared as unknown as Args));
      const proposals = (planned.proposals as Args[]).map(proposal => fields(proposal, ["alternative", "recipe", "reasons", "warnings"]));
      return { workspace_revision: work.revision, studio_revision: state.revision, request: prepared, fingerprint: planned.fingerprint, proposals, exclusions: planned.exclusions };
    }
    if (name === "marker_save_plan") return command(args, "variant.plan", { request: planInput(args.request), fingerprint: args.fingerprint, alternative: args.alternative });
    if (name === "marker_edit_variant") {
      const state = await studio(); revision(state.revision, args.expected_revision);
      const variant = get(state.variants, args.id); revision(variant.recipeRevision, args.recipe_revision);
      return command(args, "variant.save", fields(args, ["id", "hook", "body", "cta", "duration", "fit", "focus_x", "focus_y", "audio"], { focus_x: "focusX", focus_y: "focusY" }));
    }
    if (name === "marker_delete") {
      if (args.confirmation_id !== args.id) throw new DomainError("Repeat the exact resource id to confirm deletion.");
      if (args.resource === "product") {
        const state = await studio();
        if (state.materials.some(item => item.productIds.includes(String(args.id))) || state.campaigns.some(item => item.productId === args.id)) throw new DomainError("The product has Space materials or Studio campaigns. Preserve linked records.", 409);
      }
      return command(args, `${args.resource}.delete`, { id: args.id, confirmed: true }, args.resource === "product");
    }
    if (name === "marker_get_job") {
      const response = await read(`/api/studio/jobs/${args.id}`), receipt = response.receipt as Args | undefined;
      if (!receipt) return response;
      return { ...response, receipt: { recipe: receipt.recipe, sourceRefs: sourceRefs(receipt.sourceSnapshots as Args[]), ...(receipt.planner ? { planner: plannerRef(receipt.planner as Args) } : {}) } };
    }
    const state = await studio(), variant = get(state.variants, args.id); revision(state.revision, args.expected_revision); revision(variant.recipeRevision, args.recipe_revision);
    if (name === "marker_render") return readResponse(await request(`/api/studio/variants/${variant.id}/render`, { recipeRevision: args.recipe_revision }));
    const response = await request(`/api/studio/variants/${variant.id}/export`);
    if (!response.ok) return readResponse(response);
    const latest = await studio();
    if (latest.revision !== args.expected_revision || get(latest.variants, args.id).recipeRevision !== args.recipe_revision) {
      await response.body?.cancel(); throw new DomainError("The state changed during export. Read the current campaign again.", 409);
    }
    const mime = response.headers.get("content-type") ?? "application/octet-stream";
    if (mime.startsWith("text/plain")) return { variant_id: variant.id, recipe_revision: variant.recipeRevision, mime_type: mime, text: await response.text() };
    await response.body?.cancel();
    return { variant_id: variant.id, recipe_revision: variant.recipeRevision, mime_type: mime, uri: `${origin}/api/mcp/artifacts/${variant.id}?recipe_revision=${variant.recipeRevision}`, authentication_required: true, publication_status: "not_published" };
  }

  return { async call(name: string, supplied: unknown): Promise<McpToolResult> {
    try {
      const descriptor = MCP_TOOLS.find(item => item.name === name);
      if (!descriptor) throw new DomainError("Unknown marKER tool.", 404);
      if (!descriptor.scopes.every(scope => options.principal.scopes.includes(scope))) throw new DomainError("The connected grant does not permit this action.", 403);
      validate(supplied, descriptor.inputSchema);
      return result(await execute(name, supplied as Args));
    } catch (error) {
      if (error instanceof DomainError) return result({ error: error.message, status: error.status, ...("code" in error && typeof error.code === "string" ? { code: error.code } : {}) }, true);
      return result({ error: "marKER could not complete this operation. Saved work is preserved.", status: 503 }, true);
    }
  } };
}
