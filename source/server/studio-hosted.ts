/** Authenticated owner adapter. Native D1 batches implement CAS; private R2 stores
 * bytes. Only the bound processor interprets files, never caller metadata. */
import { DomainError, object, type Workspace } from "../src/core/domain.ts";
import { applyStudioCommand, assertStudioExportable, buildRenderSpec, emptyStudio,
  registerStudioAsset, type StudioAsset, type StudioState, type StudioSourceSnapshot,
  type StudioRenderSpec, type TrustedStudioInvocation } from "../src/core/studio.ts";
import { json, readJson } from "./api.ts";
import { assertAccountActive } from "./profile.ts";
import { planStudio, validatePlannedVariant, type StudioPlanInput, type StudioPlannerUse } from "../src/core/studio-planner.ts";
import { ANALYSIS_PROFILE, ANALYSIS_HOSTED_TOOL_VERSION, ANALYSIS_MAX_JSON, ANALYSIS_MAX_THUMB_BYTES,
  validateAnalysisRange, validateAnalysisResult, type StudioAnalysisRange, type StudioAnalysisResult } from "../src/core/studio-analysis.ts";
import { SETTINGS_MAX_BUDGET_CENTS, SETTINGS_MAX_STORAGE_BYTES, validateStudioSettings,
  type StudioSettings, type StudioSettingsResponse } from "../src/core/settings.ts";

export type HostedStudioEnv = Pick<Env, "DB" | "MEDIA" | "MARKER_ORIGIN" | "STUDIO_PROCESSOR">;
export type HostedMediaMetadata = {
  kind: "video" | "image" | "audio"; mime: string; duration: number | null;
  width: number | null; height: number | null; audioTrack: "present" | "absent" | "unknown";
  processing: "ready" | "unsupported"; sha256: string;
};
export interface StudioProcessor {
  probe(key: string, mimeHint?: string): Promise<HostedMediaMetadata>;
  enqueue(jobId: string): Promise<void>;
  render(jobId: string, spec: StudioRenderSpec, inputs: Array<{ assetId: string; key: string }>,
    outputs: { videoKey: string; coverKey: string }): Promise<{ duration: number; width: number; height: number }>;
  analyze?(analysisId: string, key: string, range: StudioAnalysisRange, expectedToolVersion: string): Promise<{ analysis: StudioAnalysisResult; thumbnails: Array<{ name: string; size: number }> }>;
}
const MAX_FILE = 250 * 1024 * 1024, MAX_CHUNK = 8 * 1024 * 1024, MIN_PART = 5 * 1024 * 1024;
const RENDER_RESERVE = 270 * 1024 * 1024;
const MAX_STATE_BYTES = 8 * 1024 * 1024, MAX_ROW_BYTES = 1500 * 1024;
const LEASE_MS = 600_000, ID = /^[a-zA-Z0-9_-]{1,100}$/;
const ANALYSIS_META_RESERVE = ANALYSIS_MAX_JSON + 8192;
type HostedAnalysis = {
  id: string; assetId: string; sha256: string; range: StudioAnalysisRange; profile: typeof ANALYSIS_PROFILE;
  toolVersion: string; status: "queued" | "running" | "completed" | "failed";
  createdAt: string; updatedAt: string; result?: StudioAnalysisResult;
  thumbnails?: Array<{ name: string; size: number }>; error?: string;
};
type Upload = {
  id: string; name: string; mime: string; size: number; offset: number;
  status: "uploading" | "completed" | "cancelled"; createdAt: string;
  assetId?: string; duplicateOf?: string; phase?: "uploading" | "uploaded" | "probing" | "probe-failed";
  multipartId: string; key: string; parts: R2UploadedPart[];
  probe?: HostedMediaMetadata;
};
type PublicJob = {
  id: string; variantId: string; recipeRevision: number; kind: "render" | "text-approval";
  status: "queued" | "running" | "completed" | "failed"; createdAt: string; updatedAt: string;
  error?: string; errorCode?: string; width?: number; height?: number; duration?: number;
};
type TextRecipe = { variantId: string; recipeRevision: number; template: "text"; platform: string; campaignId: string; hook: string; body: string; cta: string };
type JobReceipt = { recipe: StudioRenderSpec | TextRecipe; sourceSnapshots: StudioSourceSnapshot[]; planner?: StudioState["variants"][number]["planner"] };
type Job = PublicJob & { videoKey?: string; coverKey?: string; bytes?: number; receipt: JobReceipt; inputs?: Array<{ assetId: string; key: string }> };
type Limits = { stored_bytes: number; reserved_bytes: number; compute_token: string | null; compute_until: number };
class ApiError extends Error {
  status: number; code: string;
  constructor(message: string, status = 400, code = "invalid_request") { super(message); this.status = status; this.code = code; }
}
function id(value: string): string { if (!ID.test(value)) throw new ApiError("Identificador inválido."); return value; }
function integer(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new ApiError(`${label} inválido.`); return Number(value);
}
function fail(error: unknown): Response {
  if (error instanceof ApiError) return json({ error: error.message, code: error.code }, error.status);
  if (error instanceof DomainError) return json({ error: error.message, code: error.status === 409 ? "revision_conflict" : "invalid_command" }, error.status);
  return json({ error: "No se pudo completar la operación. El trabajo guardado se conserva.", code: "studio_unavailable" }, 503);
}
function uploadPublic(value: Upload) {
  const { key: _key, multipartId: _multipartId, parts: _parts, probe: _probe, ...result } = value; return result;
}
function jobPublic(value: Job) {
  const { videoKey: _video, coverKey: _cover, receipt, inputs: _inputs, bytes: _bytes, ...result } = value;
  return { ...result, provenance: "recorded", sourceRefs: receipt.sourceSnapshots.map(({ materialId, contentVersion, assetId, kind }) => ({ materialId, contentVersion, ...(assetId ? { assetId } : {}), kind })) };
}
async function first<T>(env: HostedStudioEnv, sql: string, ...args: (string | number | null)[]): Promise<T | null> {
  return env.DB.prepare(sql).bind(...args).first<T>();
}
async function all<T>(env: HostedStudioEnv, sql: string, ...args: (string | number | null)[]): Promise<T[]> {
  return (await env.DB.prepare(sql).bind(...args).all<T>()).results;
}
async function readUpload(env: HostedStudioEnv, value: string): Promise<Upload> {
  const row = await first<{ document: string }>(env, "SELECT document FROM marker_studio_uploads WHERE id=?", id(value));
  if (!row) throw new ApiError("Subida no encontrada.", 404, "not_found"); return JSON.parse(row.document);
}
async function readJob(env: HostedStudioEnv, value: string): Promise<Job> {
  const row = await first<{ document: string }>(env, "SELECT document FROM marker_studio_jobs WHERE id=?", id(value));
  if (!row) throw new ApiError("Montaje no encontrado.", 404, "not_found"); return JSON.parse(row.document);
}
export async function readHostedStudio(env: HostedStudioEnv): Promise<StudioState> {
  // A D1 batch reads one consistent snapshot, including its revision.
  const results = await env.DB.batch([
    env.DB.prepare("SELECT revision FROM marker_studio_meta WHERE id=1"),
    ...["assets", "materials", "campaigns", "variants"].map(table => env.DB.prepare(`SELECT document FROM marker_studio_${table} ORDER BY rowid`)),
  ]);
  const state = emptyStudio(); state.revision = Number((results[0].results[0] as { revision: number }).revision);
  (["assets", "materials", "campaigns", "variants"] as const).forEach((table, index) => {
    (state[table] as unknown[]) = results[index + 1].results.map(row => JSON.parse((row as { document: string }).document));
  }); return state;
}
async function saveState(env: HostedStudioEnv, next: StudioState, previous: StudioState, workspaceRevision?: number,
  extra: Array<(token: string) => D1PreparedStatement> = []): Promise<void> {
  const analysisBytes = await first<{ bytes: number }>(env, "SELECT COALESCE(SUM(length(CAST(document AS BLOB))+metadata_reserved),0) AS bytes FROM marker_studio_analysis");
  if (new TextEncoder().encode(JSON.stringify(next)).byteLength + Number(analysisBytes?.bytes ?? 0) > MAX_STATE_BYTES)
    throw new ApiError("Space alcanzó el límite inicial de 8 MiB de fichas y recetas. Los originales se conservan.", 413, "metadata_limit");
  for (const collection of [next.assets, next.materials, next.campaigns, next.variants]) for (const entry of collection)
    if (new TextEncoder().encode(JSON.stringify(entry)).byteLength > MAX_ROW_BYTES)
      throw new ApiError("La ficha o receta contiene demasiado texto copiado. Reduce sus fuentes.", 413, "metadata_limit");
  const token = crypto.randomUUID(), guard = "EXISTS(SELECT 1 FROM marker_studio_meta WHERE id=1 AND write_token=?)";
  const statements = [env.DB.prepare(`UPDATE marker_studio_meta SET revision=?,write_token=? WHERE id=1 AND revision=?
    AND (SELECT COALESCE(SUM(length(CAST(document AS BLOB))+metadata_reserved),0) FROM marker_studio_analysis)+?<=?
    ${workspaceRevision === undefined ? "" : "AND COALESCE((SELECT revision FROM marker_workspace WHERE id=1),0)=?"}`)
    .bind(next.revision, token, previous.revision, new TextEncoder().encode(JSON.stringify(next)).byteLength, MAX_STATE_BYTES, ...(workspaceRevision === undefined ? [] : [workspaceRevision]))];
  // Referential deletion order matters. Asset originals have no deletion route.
  for (const table of ["variants", "materials", "campaigns"] as const) {
    const retained = new Set(next[table].map(entry => entry.id)), removed = previous[table].filter(entry => !retained.has(entry.id)).map(entry => entry.id);
    if (removed.length) statements.push(env.DB.prepare(`DELETE FROM marker_studio_${table} WHERE ${guard} AND id IN (SELECT value FROM json_each(?))`).bind(token, JSON.stringify(removed)));
  }
  const changed = <T extends { id: string }>(current: T[], before: T[]): T[] => {
    const old = new Map(before.map(entry => [entry.id, JSON.stringify(entry)])); return current.filter(entry => old.get(entry.id) !== JSON.stringify(entry));
  };
  for (const asset of changed(next.assets, previous.assets)) statements.push(env.DB.prepare(`INSERT INTO marker_studio_assets(id,sha256,kind,size_bytes,storage_key,document)
    SELECT ?,?,?,?,?,? WHERE ${guard} ON CONFLICT(id) DO UPDATE SET document=excluded.document`).bind(asset.id, asset.sha256, asset.kind, asset.size, `originals/${asset.id}`, JSON.stringify(asset), token));
  for (const material of changed(next.materials, previous.materials)) statements.push(env.DB.prepare(`INSERT INTO marker_studio_materials(id,asset_id,content_version,document)
    SELECT ?,?,?,? WHERE ${guard} ON CONFLICT(id) DO UPDATE SET asset_id=excluded.asset_id,content_version=excluded.content_version,document=excluded.document`).bind(material.id, material.assetId ?? null, material.contentVersion, JSON.stringify(material), token));
  for (const campaign of changed(next.campaigns, previous.campaigns)) statements.push(env.DB.prepare(`INSERT INTO marker_studio_campaigns(id,product_id,document)
    SELECT ?,?,? WHERE ${guard} ON CONFLICT(id) DO UPDATE SET product_id=excluded.product_id,document=excluded.document`).bind(campaign.id, campaign.productId, JSON.stringify(campaign), token));
  for (const variant of changed(next.variants, previous.variants)) statements.push(env.DB.prepare(`INSERT INTO marker_studio_variants(id,campaign_id,recipe_revision,document)
    SELECT ?,?,?,? WHERE ${guard} ON CONFLICT(id) DO UPDATE SET campaign_id=excluded.campaign_id,recipe_revision=excluded.recipe_revision,document=excluded.document`).bind(variant.id, variant.campaignId, variant.recipeRevision, JSON.stringify(variant), token));
  statements.push(...extra.map(build => build(token)));
  if (statements.length > 900) throw new ApiError("Esta operación afecta demasiadas recetas a la vez. Conserva el material y revisa su uso antes de continuar.", 413, "mutation_limit");
  const results = await env.DB.batch(statements);
  if (results[0].meta.changes !== 1) throw new ApiError("Space o el producto cambió. Recarga antes de guardar.", 409, "revision_conflict");
}
export async function assertProductUnused(env: HostedStudioEnv, productId: string): Promise<void> {
  const used = await first(env, `SELECT id FROM marker_studio_campaigns WHERE product_id=? UNION ALL
    SELECT id FROM marker_studio_materials WHERE EXISTS(SELECT 1 FROM json_each(document,'$.productIds') WHERE value=?) LIMIT 1`, productId, productId);
  if (used) throw new ApiError("El producto tiene materiales o campañas en Space. Conserva sus fuentes.", 409, "product_in_use");
}
async function usage(env: HostedStudioEnv) {
  const rows = await all<{ material_id: string; uses: number }>(env, `SELECT material_id,COUNT(DISTINCT variant_id) AS uses FROM (
    SELECT marker_studio_variants.id AS variant_id,source.value AS material_id
      FROM marker_studio_variants,json_each(marker_studio_variants.document,'$.sourceIds') source
    UNION ALL SELECT variant_id,json_extract(source.value,'$.materialId') AS material_id
      FROM marker_studio_jobs,json_each(marker_studio_jobs.document,'$.receipt.sourceSnapshots') source WHERE status='completed'
    ) GROUP BY material_id`);
  return Object.fromEntries(rows.map(row => [row.material_id, row.uses]));
}
async function plannerHistory(env: HostedStudioEnv, state: StudioState): Promise<StudioPlannerUse[]> {
  const uses: StudioPlannerUse[] = [];
  for (const variant of state.variants) for (const selection of variant.selections) {
    const snapshot = variant.sourceSnapshots.find(source => source.materialId === selection.materialId);
    const asset = state.assets.find(source => source.id === snapshot?.assetId);
    if (asset) uses.push({ sha256: asset.sha256, start: selection.start, end: selection.end, variantId: variant.id });
  }
  const rows = await all<{ sha256: string; start: number; end: number; variant_id: string; job_id: string }>(env, `SELECT a.sha256,json_extract(c.value,'$.start') AS start,json_extract(c.value,'$.end') AS end,j.variant_id,j.id AS job_id
    FROM marker_studio_jobs j,json_each(j.document,'$.receipt.recipe.clips') c
    JOIN marker_studio_assets a ON a.id=json_extract(c.value,'$.assetId')
    WHERE j.status='completed' LIMIT 5001`);
  if (rows.length > 5000) throw new ApiError("El historial necesita una revisión antes de proponer más montajes.", 413, "planner_history_limit");
  for (const row of rows) uses.push({ sha256: row.sha256, start: row.start, end: row.end, variantId: row.variant_id, jobId: row.job_id });
  return uses;
}
async function validateAnalysisReferences(env: HostedStudioEnv, state: StudioState, input: {analysisIds?:string[];candidateIds:string[];lockedSelections:Array<{materialId:string;start:number;end:number}>}): Promise<void> {
  if (!input.analysisIds?.length) return;
  if (!Array.isArray(input.analysisIds) || input.analysisIds.length>3 || !Array.isArray(input.candidateIds) || !Array.isArray(input.lockedSelections)) throw new ApiError("Revisa los análisis seleccionados.");
  for (const analysisId of input.analysisIds) {
    const row=await first<{document:string}>(env,"SELECT document FROM marker_studio_analysis WHERE id=?",id(analysisId));
    const entry=row ? JSON.parse(row.document) as HostedAnalysis : undefined;
    if (!entry || entry.status!=="completed" || !entry.result || !["complete","partial"].includes(entry.result.status) || entry.profile!==ANALYSIS_PROFILE || entry.toolVersion!==ANALYSIS_HOSTED_TOOL_VERSION
      || !input.lockedSelections.some(selection=>{const material=state.materials.find(item=>item.id===selection.materialId);const asset=state.assets.find(item=>item.id===material?.assetId);return input.candidateIds.includes(selection.materialId)&&asset?.sha256===entry.sha256&&selection.start>=entry.range.start&&selection.end<=entry.range.end;}))
      throw new ApiError("El análisis ya no corresponde a un tramo fijado de las fuentes seleccionadas.",409,"analysis_mismatch");
  }
}
async function jobSummaries(env: HostedStudioEnv) {
  const rows = await all<{ summary: string }>(env, `SELECT json_set(json_remove(document,'$.receipt','$.videoKey','$.coverKey','$.inputs','$.bytes'),
    '$.provenance','recorded','$.sourceRefs',json((SELECT json_group_array(json_object(
      'materialId',json_extract(source.value,'$.materialId'),'contentVersion',json_extract(source.value,'$.contentVersion'),
      'assetId',json_extract(source.value,'$.assetId'),'kind',json_extract(source.value,'$.kind')))
      FROM json_each(marker_studio_jobs.document,'$.receipt.sourceSnapshots') source))) AS summary
    FROM marker_studio_jobs ORDER BY rowid DESC LIMIT 100`);
  return rows.map(row => JSON.parse(row.summary));
}
async function capabilities(env: HostedStudioEnv) {
  const current = await settingsResponse(env), { settings, usage } = current;
  return { local: false, render: true, analysis: ANALYSIS_HOSTED_TOOL_VERSION !== null,
    analysisReason: ANALYSIS_HOSTED_TOOL_VERSION === null ? "hosted_toolchain_verification_pending" : undefined,
    analysisCents: 5, maxAnalysisRangeSeconds: 120, maxFileBytes: MAX_FILE, maxChunkBytes: MAX_CHUNK,
    storageBytes: usage.storageBytes, reservedBytes: usage.reservedBytes, maxStorageBytes: settings.storageLimitBytes,
    monthlyUsedCents: usage.processingUsedCents, monthlyBudgetCents: settings.processingBudgetCents, month: usage.month,
    defaultDurationSeconds: settings.defaultDurationSeconds };
}
async function readSettings(env: HostedStudioEnv): Promise<StudioSettings> {
  const settings = await first<StudioSettings>(env, `SELECT revision,monthly_budget_cents AS monthlyBudgetCents,
    processing_budget_cents AS processingBudgetCents,ai_budget_cents AS aiBudgetCents,
    storage_limit_bytes AS storageLimitBytes,default_duration_seconds AS defaultDurationSeconds FROM marker_studio_settings WHERE id=1`);
  if (!settings) throw new ApiError("La configuración no está disponible.",503,"settings_unavailable");
  return settings;
}
async function settingsResponse(env: HostedStudioEnv): Promise<StudioSettingsResponse> {
  const month=new Date().toISOString().slice(0,7);
  const [settings,limits,compute] = await Promise.all([readSettings(env),first<Limits>(env,"SELECT * FROM marker_studio_limits WHERE id=1"),first<{used_cents:number}>(env,"SELECT used_cents FROM marker_studio_compute WHERE month=?",month)]);
  return {settings,usage:{month,processingUsedCents:compute?.used_cents??0,aiUsedCents:0,storageBytes:limits?.stored_bytes??0,reservedBytes:limits?.reserved_bytes??0},limits:{maxBudgetCents:SETTINGS_MAX_BUDGET_CENTS,maxStorageBytes:SETTINGS_MAX_STORAGE_BYTES},ai:{connected:false}};
}
async function saveSettings(request:Request,env:HostedStudioEnv):Promise<Response> {
  const body=object(await readJson(request));
  if(Object.keys(body).length!==2||Object.keys(body).some(key=>key!=="expectedRevision"&&key!=="settings"))throw new ApiError("Revisa los campos de configuración.");
  const expected=integer(body.expectedRevision,"Revisión"),settings=validateStudioSettings(body.settings);
  const updated=await env.DB.prepare(`UPDATE marker_studio_settings SET revision=revision+1,monthly_budget_cents=?,processing_budget_cents=?,ai_budget_cents=?,storage_limit_bytes=?,default_duration_seconds=?
    WHERE id=1 AND revision=? AND EXISTS(SELECT 1 FROM marker_studio_limits WHERE id=1 AND upload_token IS NULL AND compute_token IS NULL)
    AND NOT EXISTS(SELECT 1 FROM marker_studio_uploads WHERE status='uploading')
    AND NOT EXISTS(SELECT 1 FROM marker_studio_jobs WHERE status IN ('queued','running'))
    AND NOT EXISTS(SELECT 1 FROM marker_studio_analysis WHERE status IN ('queued','running'))`)
    .bind(settings.monthlyBudgetCents,settings.processingBudgetCents,settings.aiBudgetCents,settings.storageLimitBytes,settings.defaultDurationSeconds,expected).run();
  if(updated.meta.changes!==1){
    if((await readSettings(env)).revision!==expected)throw new ApiError("La configuración cambió. Compara los valores antes de guardar.",409,"settings_conflict");
    throw new ApiError("Termina o cancela la subida o procesamiento antes de cambiar estos límites.",409,"settings_busy");
  }
  return json(await settingsResponse(env));
}
async function claimCompute(env: HostedStudioEnv, token: string, cents: number, reserve = 0,
  admission?: { revision: number; job?: Job; analysis?: HostedAnalysis; stateBytes?: number }): Promise<void> {
  const now = Date.now(), month = new Date(now).toISOString().slice(0, 7);
  const results = await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO marker_studio_compute(month) VALUES(?)").bind(month),
    env.DB.prepare(`UPDATE marker_studio_limits SET compute_token=?,compute_until=?,reserved_bytes=reserved_bytes+?
      WHERE id=1 AND (compute_token IS NULL OR compute_until<?) AND stored_bytes+reserved_bytes+?<=(SELECT storage_limit_bytes FROM marker_studio_settings WHERE id=1)
      AND EXISTS(SELECT 1 FROM marker_studio_compute WHERE month=? AND used_cents+?<=(SELECT MIN(processing_budget_cents,monthly_budget_cents) FROM marker_studio_settings WHERE id=1))
      ${admission ? "AND EXISTS(SELECT 1 FROM marker_studio_meta WHERE id=1 AND revision=?)" : ""}
      ${admission?.analysis ? "AND upload_token IS NULL AND NOT EXISTS(SELECT 1 FROM marker_studio_uploads WHERE status='uploading') AND (SELECT COUNT(*) FROM marker_studio_analysis)<1000 AND (SELECT COALESCE(SUM(length(CAST(document AS BLOB))+metadata_reserved),0) FROM marker_studio_analysis)+?+?<=?" : ""}`)
      .bind(token, now + LEASE_MS, reserve, now, reserve, month, cents,
        ...(admission ? [admission.revision] : []), ...(admission?.analysis ? [admission.stateBytes ?? MAX_STATE_BYTES, ANALYSIS_META_RESERVE + new TextEncoder().encode(JSON.stringify(admission.analysis)).byteLength, MAX_STATE_BYTES] : [])),
    env.DB.prepare(`UPDATE marker_studio_compute SET used_cents=used_cents+?,last_token=? WHERE month=?
      AND EXISTS(SELECT 1 FROM marker_studio_limits WHERE id=1 AND compute_token=?)`).bind(cents, token, month, token),
    ...(admission?.job ? [env.DB.prepare(`INSERT INTO marker_studio_jobs(id,variant_id,recipe_revision,status,document,reserved_bytes)
      SELECT ?,?,?,'queued',?,? WHERE EXISTS(SELECT 1 FROM marker_studio_limits WHERE id=1 AND compute_token=?)`)
      .bind(admission.job.id, admission.job.variantId, admission.job.recipeRevision, JSON.stringify(admission.job), reserve, token)] : []),
    ...(admission?.analysis ? [env.DB.prepare(`INSERT INTO marker_studio_analysis(id,asset_id,sha256,start_ms,end_ms,profile,tool_version,status,document,reserved_bytes,metadata_reserved)
      SELECT ?,?,?,?,?,?,?,'queued',?,?,? WHERE EXISTS(SELECT 1 FROM marker_studio_limits WHERE id=1 AND compute_token=?)`)
      .bind(admission.analysis.id, admission.analysis.assetId, admission.analysis.sha256, Math.round(admission.analysis.range.start * 1000), Math.round(admission.analysis.range.end * 1000), admission.analysis.profile, admission.analysis.toolVersion,
        JSON.stringify(admission.analysis), reserve, ANALYSIS_META_RESERVE, token)] : []),
  ]);
  if (results[1].meta.changes !== 1) {
    if (admission && (await readHostedStudio(env)).revision !== admission.revision) throw new ApiError("La receta cambió. Vuelve a generar.", 409, "recipe_conflict");
    const cap = await capabilities(env);
    if (cap.monthlyUsedCents + cents > cap.monthlyBudgetCents) throw new ApiError("Se alcanzó el límite mensual de procesamiento. No se activó otro gasto.", 429, "compute_budget_exceeded");
    if (cap.storageBytes + cap.reservedBytes + reserve > cap.maxStorageBytes) throw new ApiError("Space alcanzó el límite de almacenamiento.", 413, "storage_limit");
    if (admission?.analysis) {
      const metadata = await first<{bytes:number;count:number}>(env, "SELECT COALESCE(SUM(length(CAST(document AS BLOB))+metadata_reserved),0) AS bytes,COUNT(*) AS count FROM marker_studio_analysis");
      if ((metadata?.count ?? 0) >= 1000 || Number(metadata?.bytes ?? 0) + (admission.stateBytes ?? 0) + ANALYSIS_META_RESERVE + new TextEncoder().encode(JSON.stringify(admission.analysis)).byteLength > MAX_STATE_BYTES)
        throw new ApiError("Space alcanzó el límite de metadatos de análisis. Los originales se conservan.", 413, "metadata_limit");
    }
    throw new ApiError("Hay un procesamiento en curso. Espera a que termine.", 409, "processor_busy");
  }
}
async function releaseCompute(env: HostedStudioEnv, token: string, reserved = 0, stored = 0) {
  await env.DB.prepare(`UPDATE marker_studio_limits SET compute_token=NULL,compute_until=0,
    reserved_bytes=reserved_bytes-?,stored_bytes=stored_bytes+? WHERE id=1 AND compute_token=?`).bind(reserved, stored, token).run();
}
async function releaseJobResources(env: HostedStudioEnv, jobId: string, stored = 0, analysis = false) {
  // The per-job reservation is consumed once even if its compute lease expired
  // and another explicit operation has acquired the singleton in the meantime.
  const table = analysis ? "marker_studio_analysis" : "marker_studio_jobs";
  await env.DB.batch([
    env.DB.prepare(`UPDATE marker_studio_limits SET reserved_bytes=reserved_bytes-(SELECT reserved_bytes FROM ${table} WHERE id=?),stored_bytes=stored_bytes+?
      WHERE id=1 AND EXISTS(SELECT 1 FROM ${table} WHERE id=? AND reserved_bytes>0)`).bind(jobId, stored, jobId),
    env.DB.prepare(`UPDATE ${table} SET reserved_bytes=0${analysis ? ",metadata_reserved=0" : ""} WHERE id=?`).bind(jobId),
    env.DB.prepare("UPDATE marker_studio_limits SET compute_token=NULL,compute_until=0 WHERE id=1 AND compute_token=?").bind(jobId),
  ]);
}
function publicAnalysis(value: HostedAnalysis) {
  return { ...value, thumbnails: (value.result?.thumbnails ?? []).map(thumb => ({ ...thumb, url: `/api/studio/analyses/${value.id}/${thumb.name}` })) };
}
async function analysisBytes(env: HostedStudioEnv, analysisId: string): Promise<number> {
  const objects = await Promise.all(Array.from({ length: 6 }, (_, index) => env.MEDIA.head(`analysis/${analysisId}/thumb-${index}.jpg`)));
  return objects.reduce((sum, object) => sum + (object?.size ?? 0), 0);
}
async function queueAnalysis(request: Request, env: HostedStudioEnv): Promise<Response> {
  if (ANALYSIS_HOSTED_TOOL_VERSION === null) throw new ApiError("El análisis remoto necesita verificar primero su versión y filtros. El montaje manual sigue disponible.", 503, "analysis_toolchain_unverified");
  const body = object(await readJson(request));
  if (body.confirmed !== true) throw new ApiError("Confirma el análisis de este tramo y sus 5 centavos de crédito interno.");
  let range: StudioAnalysisRange;
  try { range = validateAnalysisRange(body); } catch { throw new ApiError("Selecciona un tramo de hasta 120 segundos."); }
  const state = await readHostedStudio(env), asset = state.assets.find(item => item.id === body.assetId);
  if (!asset || !["video", "audio"].includes(asset.kind) || asset.processing !== "ready" || !asset.duration || range.end > asset.duration + 0.001) throw new ApiError("El tramo necesita un original compatible de video o audio.");
  const existing = await first<{document:string}>(env, "SELECT document FROM marker_studio_analysis WHERE sha256=? AND start_ms=? AND end_ms=? AND profile=? AND tool_version=? AND status!='failed' ORDER BY rowid DESC LIMIT 1", asset.sha256, Math.round(range.start * 1000), Math.round(range.end * 1000), ANALYSIS_PROFILE, ANALYSIS_HOSTED_TOOL_VERSION);
  if (existing) {
    const saved = JSON.parse(existing.document) as HostedAnalysis;
    if (saved.status === "queued") await env.STUDIO_PROCESSOR.getByName("owner").enqueue(saved.id);
    return json({ analysis: publicAnalysis(saved), cached: saved.status === "completed", chargedCents: 0 });
  }
  const timestamp = new Date().toISOString(), value: HostedAnalysis = { id: crypto.randomUUID(), assetId: asset.id, sha256: asset.sha256, range, profile: ANALYSIS_PROFILE, toolVersion: ANALYSIS_HOSTED_TOOL_VERSION, status: "queued", createdAt: timestamp, updatedAt: timestamp };
  await claimCompute(env, value.id, 5, ANALYSIS_MAX_THUMB_BYTES, { revision: state.revision, analysis: value, stateBytes: new TextEncoder().encode(JSON.stringify(state)).byteLength });
  await env.STUDIO_PROCESSOR.getByName("owner").enqueue(value.id);
  return json({ analysis: publicAnalysis(value), cached: false, chargedCents: 5 }, 202);
}
async function executeHostedAnalysis(env: HostedStudioEnv, original: HostedAnalysis, processor: StudioProcessor): Promise<void> {
  if (original.status === "completed" || original.status === "failed") { await releaseJobResources(env, original.id, await analysisBytes(env, original.id), true); return; }
  if (original.status === "running") {
    const lease = await first<{lock_until:number}>(env, "SELECT lock_until FROM marker_studio_analysis WHERE id=?", original.id);
    if (lease && lease.lock_until > Date.now()) return;
    const failed = { ...original, status: "failed", error: "Análisis interrumpido. Solicita otro intento explícitamente.", updatedAt: new Date().toISOString() };
    await env.DB.prepare("UPDATE marker_studio_analysis SET status='failed',document=?,lock_token=NULL,lock_until=0 WHERE id=? AND status='running'").bind(JSON.stringify(failed), original.id).run();
    await releaseJobResources(env, original.id, await analysisBytes(env, original.id), true); return;
  }
  const token = crypto.randomUUID(), running = { ...original, status: "running", updatedAt: new Date().toISOString() };
  const claim = await env.DB.prepare(`UPDATE marker_studio_analysis SET status='running',document=?,lock_token=?,lock_until=? WHERE id=? AND status='queued'
    AND EXISTS(SELECT 1 FROM marker_studio_limits WHERE id=1 AND compute_token=? AND compute_until>?)`).bind(JSON.stringify(running), token, Date.now() + LEASE_MS, original.id, original.id, Date.now()).run();
  if (claim.meta.changes !== 1) {
    const failed = { ...original, status: "failed", error: "La espera del análisis expiró. Solicita otro intento explícitamente.", updatedAt: new Date().toISOString() };
    const expired = await env.DB.prepare("UPDATE marker_studio_analysis SET status='failed',document=? WHERE id=? AND status='queued'").bind(JSON.stringify(failed), original.id).run();
    if (expired.meta.changes === 1) await releaseJobResources(env, original.id, 0, true); return;
  }
  try {
    const asset = await first<{storage_key:string}>(env, "SELECT storage_key FROM marker_studio_assets WHERE id=? AND sha256=?", original.assetId, original.sha256);
    if (!asset || !processor.analyze || !ANALYSIS_HOSTED_TOOL_VERSION || original.toolVersion !== ANALYSIS_HOSTED_TOOL_VERSION) throw new Error("unverified analyzer");
    const returned = await processor.analyze(original.id, asset.storage_key, original.range, original.toolVersion);
    const result = validateAnalysisResult(returned.analysis, original.range);
    if (result.toolVersion !== original.toolVersion) throw new Error("toolchain mismatch");
    const bytes = await analysisBytes(env, original.id);
    if (bytes > ANALYSIS_MAX_THUMB_BYTES) throw new Error("thumbnail limit");
    const complete: HostedAnalysis = { ...original, status: "completed", result, thumbnails: returned.thumbnails, updatedAt: new Date().toISOString() };
    if (new TextEncoder().encode(JSON.stringify(complete)).byteLength > ANALYSIS_META_RESERVE) throw new Error("analysis metadata limit");
    await env.DB.prepare("UPDATE marker_studio_analysis SET status='completed',document=?,lock_token=NULL,lock_until=0 WHERE id=? AND lock_token=?").bind(JSON.stringify(complete), original.id, token).run();
  } catch {
    const failed: HostedAnalysis = { ...original, status: "failed", error: "No se pudo analizar este tramo. El original y el flujo manual se conservan.", updatedAt: new Date().toISOString() };
    await env.DB.prepare("UPDATE marker_studio_analysis SET status='failed',document=?,lock_token=NULL,lock_until=0 WHERE id=? AND lock_token=?").bind(JSON.stringify(failed), original.id, token).run();
  } finally { await releaseJobResources(env, original.id, await analysisBytes(env, original.id), true); }
}
function checkRevision(body: Record<string, unknown>, state: StudioState) {
  if (integer(body.expectedRevision, "Revisión") !== state.revision) throw new ApiError("Space cambió. Recarga antes de guardar.", 409, "revision_conflict");
}
async function createUpload(request: Request, env: HostedStudioEnv): Promise<Response> {
  const body = object(await readJson(request)), size = integer(body.size, "Tamaño");
  if (!size || size > MAX_FILE) throw new ApiError("El archivo debe pesar entre 1 byte y 250 MiB.", 413, "file_too_large");
  if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 240 || /[\x00-\x1f]/.test(body.name)) throw new ApiError("Nombre de archivo inválido.");
  const name = body.name.replaceAll("\\", "/").split("/").at(-1)!;
  const extensions: Record<string, string> = { mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", mkv: "video/x-matroska", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif", m4a: "audio/mp4", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", aac: "audio/aac", flac: "audio/flac" };
  let mime = typeof body.mime === "string" ? body.mime.split(";", 1)[0].trim().toLowerCase() : "";
  if (!mime || mime === "application/octet-stream") mime = extensions[name.split(".").at(-1)?.toLowerCase() ?? ""] ?? "";
  if (!/^(video|image|audio)\/[a-z0-9.+-]{1,80}$/.test(mime) || mime === "image/svg+xml") throw new ApiError("Selecciona un video, una foto o un audio.", 415, "unsupported_media");
  const token = crypto.randomUUID(), key = `originals/${token}`;
  const value: Upload = { id: token, name, mime, size, offset: 0, status: "uploading", createdAt: new Date().toISOString(), phase: "uploading", multipartId: "", key, parts: [] };
  // Admission and the recoverable owner-visible session are one D1 transaction.
  // Multipart creation is lazy: interruption can leave only a resumable session,
  // never an unowned reservation that permanently blocks future captures.
  const reserved = await env.DB.batch([env.DB.prepare(`UPDATE marker_studio_limits SET reserved_bytes=reserved_bytes+?,upload_token=? WHERE id=1
    AND upload_token IS NULL AND stored_bytes+reserved_bytes+?<=(SELECT storage_limit_bytes FROM marker_studio_settings WHERE id=1) AND (compute_token IS NULL OR compute_until<?)
    AND NOT EXISTS(SELECT 1 FROM marker_studio_uploads WHERE status='uploading')`).bind(size, token, size, Date.now()),
    env.DB.prepare(`INSERT INTO marker_studio_uploads(id,status,document) SELECT ?,'uploading',?
      WHERE EXISTS(SELECT 1 FROM marker_studio_limits WHERE id=1 AND upload_token=?)`).bind(value.id, JSON.stringify(value), token)]);
  if (reserved[0].meta.changes !== 1) throw new ApiError("Reanuda la subida pendiente o espera al procesamiento. Revisa el espacio disponible.", 409, "upload_busy");
  return json({ upload: uploadPublic(value) }, 201);
}
async function lockUpload(env: HostedStudioEnv, value: Upload): Promise<string> {
  const token = crypto.randomUUID();
  const claim = await env.DB.prepare(`UPDATE marker_studio_uploads SET lock_token=?,lock_until=?
    WHERE id=? AND status='uploading' AND json_extract(document,'$.offset')=? AND (lock_token IS NULL OR lock_until<?)`)
    .bind(token, Date.now() + LEASE_MS, value.id, value.offset, Date.now()).run();
  if (claim.meta.changes !== 1) throw new ApiError("La subida cambió o tiene un tramo en curso.", 409, "upload_offset_conflict"); return token;
}
async function saveUpload(env: HostedStudioEnv, value: Upload, token: string): Promise<void> {
  const result = await env.DB.prepare("UPDATE marker_studio_uploads SET status=?,document=?,lock_token=NULL,lock_until=0 WHERE id=? AND lock_token=?")
    .bind(value.status, JSON.stringify(value), value.id, token).run();
  if (result.meta.changes !== 1) throw new ApiError("La subida cambió. Consulta su avance.", 409, "upload_offset_conflict");
}
async function requireUploadAccount(env: HostedStudioEnv, value: Upload): Promise<void> {
  try { await assertAccountActive(env); }
  catch (error) {
    if (value.multipartId) await env.MEDIA.resumeMultipartUpload(value.key, value.multipartId).abort().catch(() => undefined);
    throw error;
  }
}
async function appendChunk(request: Request, env: HostedStudioEnv, value: Upload): Promise<Response> {
  if (value.status !== "uploading" || value.phase !== "uploading") throw new ApiError("Subida cerrada.", 409, "upload_closed");
  const offset = request.headers.get("upload-offset");
  if (!offset || !/^\d+$/.test(offset) || Number(offset) !== value.offset) throw new ApiError("El tramo cambió. Consulta el avance antes de reintentar.", 409, "upload_offset_conflict");
  const token = await lockUpload(env, value);
  try {
    if (!request.body) throw new ApiError("Falta el tramo.");
    const reader = request.body.getReader(), chunks: Uint8Array[] = []; let bytes = 0, expired = false;
    const timeout = setTimeout(() => { expired = true; void reader.cancel().catch(() => undefined); }, 30_000);
    try {
      for (;;) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength;
        if (bytes > MAX_CHUNK || value.offset + bytes > value.size) { await reader.cancel(); throw new ApiError("Tramo demasiado grande.", 413, "chunk_too_large"); } chunks.push(part.value); }
    } finally { clearTimeout(timeout); reader.releaseLock(); }
    if (expired) throw new ApiError("Reanuda el tramo interrumpido.", 408, "upload_timeout");
    if (!bytes || (bytes < MIN_PART && value.offset + bytes !== value.size)) throw new ApiError("El tramo debe tener 5 MiB como mínimo, salvo el último.", 400, "chunk_too_small");
    const payload = new Uint8Array(bytes); let position = 0; for (const chunk of chunks) { payload.set(chunk, position); position += chunk.byteLength; }
    await requireUploadAccount(env, value);
    if (!value.multipartId) {
      const multipart = await env.MEDIA.createMultipartUpload(value.key, { httpMetadata: { contentType: value.mime } });
      value = { ...value, multipartId: multipart.uploadId };
      try {
        const saved = await env.DB.prepare("UPDATE marker_studio_uploads SET document=? WHERE id=? AND lock_token=?").bind(JSON.stringify(value), value.id, token).run();
        if (saved.meta.changes !== 1) throw new ApiError("La subida cambió. Consulta el avance.", 409, "upload_offset_conflict");
      } catch (error) { await multipart.abort().catch(() => undefined); throw error; }
    }
    await requireUploadAccount(env, value);
    const part = await env.MEDIA.resumeMultipartUpload(value.key, value.multipartId).uploadPart(value.parts.length + 1, payload);
    await requireUploadAccount(env, value);
    const next = { ...value, offset: value.offset + bytes, parts: [...value.parts, part] }; await saveUpload(env, next, token);
    return json({ upload: uploadPublic(next) });
  } finally { await env.DB.prepare("UPDATE marker_studio_uploads SET lock_token=NULL,lock_until=0 WHERE id=? AND lock_token=?").bind(value.id, token).run(); }
}
async function completeUpload(env: HostedStudioEnv, value: Upload): Promise<Response> {
  if (value.status === "completed") { const state = await readHostedStudio(env); return json({ state, asset: state.assets.find(asset => asset.id === value.assetId), upload: uploadPublic(value), duplicate: !!value.duplicateOf }); }
  if (value.status !== "uploading" || value.offset !== value.size) throw new ApiError("La subida todavía no está completa.", 409, "upload_incomplete");
  const lock = await lockUpload(env, value), computeToken = crypto.randomUUID(); let claimed = false;
  try {
    await requireUploadAccount(env, value);
    let original = await env.MEDIA.head(value.key);
    if (!original) {
      await requireUploadAccount(env, value);
      await env.MEDIA.resumeMultipartUpload(value.key, value.multipartId).complete(value.parts);
      try { await requireUploadAccount(env, value); }
      catch (error) { await env.MEDIA.delete(value.key); throw error; }
      original = await env.MEDIA.head(value.key);
    }
    if (!original || original.size !== value.size) throw new ApiError("El tamaño del original no coincide. Conserva la subida para revisarla.", 409, "upload_size_mismatch");
    value = { ...value, phase: "uploaded" };
    await env.DB.prepare("UPDATE marker_studio_uploads SET document=? WHERE id=? AND lock_token=?").bind(JSON.stringify(value), value.id, lock).run();
    let metadata = value.probe;
    if (!metadata) {
      await claimCompute(env, computeToken, 5); claimed = true;
      metadata = await env.STUDIO_PROCESSOR.getByName("owner").probe(value.key, value.mime);
      if (!/^[a-f0-9]{64}$/.test(metadata.sha256)) throw new ApiError("No se pudo verificar el original.", 503, "probe_failed");
      // Cache trusted successful work before library CAS. A competing edit or a
      // lost completion response must not charge another probe on resume.
      value = { ...value, probe: metadata };
      const cached = await env.DB.prepare("UPDATE marker_studio_uploads SET document=? WHERE id=? AND lock_token=?").bind(JSON.stringify(value), value.id, lock).run();
      if (cached.meta.changes !== 1) throw new ApiError("La subida cambió. Consulta el avance.", 409, "upload_offset_conflict");
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const previous = await readHostedStudio(env), duplicate = previous.assets.find(asset => asset.sha256 === metadata.sha256 && asset.size === value.size);
      const asset: StudioAsset = duplicate ?? { id: value.id, name: value.name, mime: metadata.mime, size: value.size, sha256: metadata.sha256,
        kind: metadata.kind, processing: metadata.processing, audioTrack: metadata.audioTrack,
        ...(metadata.duration === null ? {} : { duration: metadata.duration }), ...(metadata.width === null ? {} : { width: metadata.width }),
        ...(metadata.height === null ? {} : { height: metadata.height }), createdAt: new Date().toISOString() };
      const completed = { ...value, status: "completed" as const, assetId: asset.id, ...(duplicate ? { duplicateOf: asset.id } : {}) };
      const next = duplicate ? { ...previous, revision: previous.revision + 1 } : registerStudioAsset(previous, asset);
      try {
        await saveState(env, next, previous, undefined, [token => env.DB.prepare(`UPDATE marker_studio_uploads SET status='completed',document=?,lock_token=NULL,lock_until=0 WHERE id=? AND lock_token=? AND EXISTS(SELECT 1 FROM marker_studio_meta WHERE write_token=?)`).bind(JSON.stringify(completed), value.id, lock, token),
          token => env.DB.prepare(`UPDATE marker_studio_limits SET reserved_bytes=reserved_bytes-?,stored_bytes=stored_bytes+?,upload_token=NULL WHERE id=1 AND upload_token=? AND EXISTS(SELECT 1 FROM marker_studio_meta WHERE write_token=?)`).bind(value.size, value.size, value.id, token)]);
        if (duplicate) {
          // Quota is released only after deletion is confirmed. If cleanup is
          // unavailable, conservatively retain its bytes in stored accounting.
          try { await env.MEDIA.delete(value.key); await env.DB.prepare("UPDATE marker_studio_limits SET stored_bytes=stored_bytes-? WHERE id=1").bind(value.size).run(); } catch { /* recoverable private duplicate remains counted */ }
        }
        return json({ state: next, asset, upload: uploadPublic(completed), duplicate: !!duplicate });
      } catch (error) { if (!(error instanceof ApiError) || error.code !== "revision_conflict" || attempt === 2) throw error; }
    }
    throw new ApiError("Space cambió. Vuelve a consultar el original.", 409, "revision_conflict");
  } catch (error) {
    if (claimed) await env.DB.prepare("UPDATE marker_studio_uploads SET document=? WHERE id=? AND lock_token=?").bind(JSON.stringify({ ...value, phase: "probe-failed" }), value.id, lock).run();
    throw error;
  } finally {
    if (claimed) await releaseCompute(env, computeToken);
    await env.DB.prepare("UPDATE marker_studio_uploads SET lock_token=NULL,lock_until=0 WHERE id=? AND lock_token=?").bind(value.id, lock).run();
  }
}
async function mediaResponse(request: Request, env: HostedStudioEnv, key: string, mime: string, download?: string): Promise<Response> {
  const info = await env.MEDIA.head(key); if (!info) throw new ApiError("Archivo no disponible.", 404, "not_found");
  let offset = 0, end = info.size - 1, partial = false;
  const headers: Record<string, string> = { "Content-Type": mime, "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff", "Accept-Ranges": "bytes", "Content-Security-Policy": "default-src 'none'; sandbox" };
  if (download) headers["Content-Disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(download).replaceAll("'", "%27")}`;
  const range = request.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${info.size}` } });
    if (!match[1]) offset = Math.max(0, info.size - Number(match[2])); else { offset = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(end) || offset < 0 || offset > end || offset >= info.size) return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${info.size}` } });
    partial = true; headers["Content-Range"] = `bytes ${offset}-${end}/${info.size}`;
  }
  const result = await env.MEDIA.get(key, { range: { offset, length: end - offset + 1 } });
  if (!result) throw new ApiError("Archivo no disponible.", 404, "not_found");
  headers["Content-Length"] = String(end - offset + 1); return new Response(result.body, { status: partial ? 206 : 200, headers });
}
async function queueRender(env: HostedStudioEnv, state: StudioState, variantId: string, request: Request, workspace: Workspace): Promise<Response> {
  const variant = state.variants.find(entry => entry.id === variantId)!, body = object(await readJson(request));
  if (integer(body.recipeRevision, "Receta") !== variant.recipeRevision) throw new ApiError("La receta cambió. Guarda y vuelve a generar.", 409, "recipe_conflict");
  validatePlannedVariant(state, variant, variant.planner ? await plannerHistory(env, state) : [], workspace);
  if (variant.planner) await validateAnalysisReferences(env,state,{analysisIds:variant.planner.analysisIds,candidateIds:variant.sourceIds,lockedSelections:variant.selections});
  const spec = buildRenderSpec(state, variantId), inputs: Array<{ assetId: string; key: string }> = [];
  const existing = await first<{ document: string }>(env, "SELECT document FROM marker_studio_jobs WHERE variant_id=? AND recipe_revision=? AND status!='failed' AND json_extract(document,'$.kind')='render' ORDER BY rowid DESC LIMIT 1", variantId, variant.recipeRevision);
  if (existing) {
    const saved = JSON.parse(existing.document) as Job;
    const current = JSON.stringify(saved.receipt.recipe) === JSON.stringify(spec) && JSON.stringify(saved.receipt.sourceSnapshots) === JSON.stringify(variant.sourceSnapshots);
    if (current && (body.regenerate !== true || saved.status !== "completed")) {
      if (saved.status === "queued") await env.STUDIO_PROCESSOR.getByName("owner").enqueue(saved.id);
      return json({ job: jobPublic(saved), reused: saved.status === "completed" });
    }
  }
  for (const assetId of new Set([...spec.clips.map(clip => clip.assetId), ...(spec.narrationAssetId ? [spec.narrationAssetId] : [])])) {
    const asset = await first<{ storage_key: string }>(env, "SELECT storage_key FROM marker_studio_assets WHERE id=?", assetId);
    if (!asset) throw new ApiError("Original no encontrado.", 404, "not_found"); inputs.push({ assetId, key: asset.storage_key });
  }
  const jobId = crypto.randomUUID();
  const timestamp = new Date().toISOString(), job: Job = { id: jobId, variantId, recipeRevision: variant.recipeRevision, kind: "render", status: "queued", createdAt: timestamp, updatedAt: timestamp,
    receipt: structuredClone({ recipe: spec, sourceSnapshots: variant.sourceSnapshots, ...(variant.planner ? {planner:variant.planner} : {}) }), inputs };
  if (new TextEncoder().encode(JSON.stringify(job)).byteLength > MAX_ROW_BYTES) throw new ApiError("La receta contiene demasiado texto copiado. Reduce sus fuentes.", 413, "metadata_limit");
  await claimCompute(env, jobId, 10, RENDER_RESERVE, { revision: state.revision, job });
  // Persist before enqueue. A lost response can enqueue this same ID again without
  // another budget charge; the execution lease prevents a second actual render.
  await env.STUDIO_PROCESSOR.getByName("owner").enqueue(job.id);
  return json({ job: jobPublic(job) }, 202);
}
export async function executeHostedRender(env: HostedStudioEnv, jobId: string, processor: StudioProcessor): Promise<void> {
  const analysis = await first<{document:string}>(env, "SELECT document FROM marker_studio_analysis WHERE id=?", jobId);
  if (analysis) return executeHostedAnalysis(env, JSON.parse(analysis.document), processor);
  const original = await readJob(env, jobId);
  if (original.status === "completed" || original.status === "failed") {
    const row = await first<{ reserved_bytes: number }>(env, "SELECT reserved_bytes FROM marker_studio_jobs WHERE id=?", jobId);
    if (row && row.reserved_bytes > 0) {
      const [video, cover] = await Promise.all([env.MEDIA.head(`renders/${jobId}/video.mp4`), env.MEDIA.head(`renders/${jobId}/cover.png`)]);
      await releaseJobResources(env, jobId, (video?.size ?? 0) + (cover?.size ?? 0));
    }
    return;
  }
  // Never repeat interrupted paid work. A durable alarm may be redelivered.
  if (original.status === "running") {
    const row = await first<{ lock_until: number }>(env, "SELECT lock_until FROM marker_studio_jobs WHERE id=?", jobId);
    if (row && row.lock_until > Date.now()) return;
    const failed = { ...original, status: "failed" as const, error: "Procesamiento interrumpido. Genera otra vez explícitamente.", errorCode: "render_interrupted", updatedAt: new Date().toISOString() };
    await env.DB.prepare("UPDATE marker_studio_jobs SET status='failed',document=?,lock_token=NULL,lock_until=0 WHERE id=? AND status='running'").bind(JSON.stringify(failed), jobId).run();
    const [video, cover] = await Promise.all([env.MEDIA.head(`renders/${jobId}/video.mp4`), env.MEDIA.head(`renders/${jobId}/cover.png`)]);
    await releaseJobResources(env, jobId, (video?.size ?? 0) + (cover?.size ?? 0)); return;
  }
  const token = crypto.randomUUID(), running = { ...original, status: "running" as const, updatedAt: new Date().toISOString() };
  const claim = await env.DB.prepare(`UPDATE marker_studio_jobs SET status='running',document=?,lock_token=?,lock_until=? WHERE id=? AND status='queued'
    AND EXISTS(SELECT 1 FROM marker_studio_limits WHERE id=1 AND compute_token=? AND compute_until>?)`)
    .bind(JSON.stringify(running), token, Date.now() + LEASE_MS, jobId, jobId, Date.now()).run();
  if (claim.meta.changes !== 1) {
    const interrupted: Job = { ...original, status: "failed", error: "La espera de procesamiento expiró. Genera otra vez explícitamente.", errorCode: "render_interrupted", updatedAt: new Date().toISOString() };
    const expired = await env.DB.prepare("UPDATE marker_studio_jobs SET status='failed',document=? WHERE id=? AND status='queued'").bind(JSON.stringify(interrupted), jobId).run();
    if (expired.meta.changes === 1) await releaseJobResources(env, jobId); return;
  }
  let bytes = 0;
  try {
    if (original.receipt.recipe.template === "text" || !original.inputs) throw new Error("invalid recipe");
    const outputs = { videoKey: `renders/${jobId}/video.mp4`, coverKey: `renders/${jobId}/cover.png` };
    const rendered = await processor.render(jobId, original.receipt.recipe, original.inputs, outputs);
    const [video, cover] = await Promise.all([env.MEDIA.head(outputs.videoKey), env.MEDIA.head(outputs.coverKey)]);
    if (!video || !cover || video.size > MAX_FILE || cover.size > 20 * 1024 * 1024 || video.size + cover.size > RENDER_RESERVE || rendered.width !== 1080 || rendered.height !== 1920 || Math.abs(rendered.duration - original.receipt.recipe.duration) > 0.2) throw new Error("invalid render receipt");
    bytes = video.size + cover.size;
    const complete: Job = { ...original, ...outputs, ...rendered, bytes, status: "completed", updatedAt: new Date().toISOString() };
    await env.DB.prepare("UPDATE marker_studio_jobs SET status='completed',document=?,lock_token=NULL,lock_until=0 WHERE id=? AND lock_token=?")
      .bind(JSON.stringify(complete), jobId, token).run();
  } catch {
    // Retain original inputs and the immutable receipt; no automatic paid retry.
    const failed: Job = { ...original, status: "failed", error: "No se pudo montar esta receta. Revisa formatos y tramos antes de generar otra vez.", errorCode: "render_failed", updatedAt: new Date().toISOString() };
    await env.DB.prepare("UPDATE marker_studio_jobs SET status='failed',document=?,lock_token=NULL,lock_until=0 WHERE id=? AND lock_token=?")
      .bind(JSON.stringify(failed), jobId, token).run();
    // Account partial output bytes too, even though they cannot be exported.
    const [video, cover] = await Promise.all([env.MEDIA.head(`renders/${jobId}/video.mp4`), env.MEDIA.head(`renders/${jobId}/cover.png`)]);
    bytes = (video?.size ?? 0) + (cover?.size ?? 0);
  } finally { await releaseJobResources(env, jobId, bytes); }
}
async function route(request: Request, env: HostedStudioEnv, workspace: Workspace, trusted: TrustedStudioInvocation = {}): Promise<Response | null> {
  const url = new URL(request.url), path = url.pathname, method = request.method;
  if (path !== "/api/studio" && !path.startsWith("/api/studio/")) return null;
  if (url.origin !== env.MARKER_ORIGIN || (request.headers.has("origin") && request.headers.get("origin") !== env.MARKER_ORIGIN) || request.headers.get("sec-fetch-site") === "cross-site") throw new ApiError("Origen no permitido.", 403, "origin_denied");
  if (!["GET", "POST", "PUT", "DELETE"].includes(method)) throw new ApiError("Método no permitido.", 405, "method_denied");
  if (method !== "GET" && request.headers.get("origin") !== env.MARKER_ORIGIN) throw new ApiError("Se requiere el origen de marKER.", 403, "origin_denied");
  if(path==="/api/studio/settings"&&method==="GET")return json(await settingsResponse(env));
  if(path==="/api/studio/settings"&&method==="POST")return saveSettings(request,env);
  if (path === "/api/studio" && method === "GET") {
    const state = await readHostedStudio(env);
    const uploads = await all<{ document: string }>(env, "SELECT document FROM marker_studio_uploads WHERE status='uploading' ORDER BY rowid DESC");
    return json({ state, jobs: await jobSummaries(env), usage: await usage(env), uploads: uploads.map(row => uploadPublic(JSON.parse(row.document))), capabilities: await capabilities(env) });
  }
  if (path === "/api/studio/plan" && method === "POST") {
    const state = await readHostedStudio(env), input = object(await readJson(request)) as unknown as StudioPlanInput;
    await validateAnalysisReferences(env,state,input);
    return json(await planStudio(state, workspace, input, await plannerHistory(env, state)));
  }
  if (path === "/api/studio/analyses" && method === "POST") return queueAnalysis(request, env);
  if (path === "/api/studio/analyses" && method === "GET") {
    const assetId = id(url.searchParams.get("assetId") ?? "");
    const rows = await all<{document:string}>(env, "SELECT document FROM marker_studio_analysis WHERE asset_id=? ORDER BY rowid DESC LIMIT 20", assetId);
    return json({ analyses: rows.map(row => { const value = publicAnalysis(JSON.parse(row.document)); const { result: _result, ...summary } = value; return summary; }) });
  }
  const analysisMatch = /^\/api\/studio\/analyses\/([^/]+)(\/(thumb-[0-5]\.jpg))?$/.exec(path);
  if (analysisMatch && method === "GET") {
    const row = await first<{document:string}>(env, "SELECT document FROM marker_studio_analysis WHERE id=?", id(analysisMatch[1]));
    if (!row) throw new ApiError("Análisis no encontrado.", 404, "not_found");
    const value = JSON.parse(row.document) as HostedAnalysis;
    if (!analysisMatch[2]) return json({ analysis: publicAnalysis(value) });
    if (value.status !== "completed" || !value.result?.thumbnails.some(thumb => thumb.name === analysisMatch[3])) throw new ApiError("Miniatura no disponible.", 404, "not_found");
    return mediaResponse(request, env, `analysis/${value.id}/${analysisMatch[3]}`, "image/jpeg");
  }
  if (path === "/api/studio/commands" && method === "POST") {
    const body = object(await readJson(request)), previous = await readHostedStudio(env); checkRevision(body, previous);
    const command = object(body.command);
    if (typeof command.type !== "string" || command.type === "variant.approve") throw new ApiError("Usa la revisión de borrador para aprobar.");
    if (command.type === "material.delete") {
      const data = object(command.data), used = await first(env, `SELECT id FROM marker_studio_jobs WHERE status!='failed'
        AND EXISTS(SELECT 1 FROM json_each(document,'$.receipt.sourceSnapshots') WHERE json_extract(value,'$.materialId')=?) LIMIT 1`, String(data.id ?? ""));
      if (used) throw new ApiError("El material conserva usos históricos o un montaje en curso. Conserva sus fuentes.", 409, "material_historical_use");
    }
    if (command.type === "variant.delete" && await first(env, "SELECT id FROM marker_studio_jobs WHERE variant_id=? LIMIT 1", String(object(command.data).id ?? ""))) throw new ApiError("La variante conserva un historial. Conserva su receta.", 409, "variant_historical_use");
    const data = object(command.data);
    if(command.type==="variant.save"&&!data.id&&data.duration===undefined)data.duration=(await readSettings(env)).defaultDurationSeconds;
    let trustedPlan;
    if (command.type === "variant.plan") {
      const input=object(data.request) as unknown as StudioPlanInput;
      await validateAnalysisReferences(env,previous,input);
      const planned = await planStudio(previous, workspace, input, await plannerHistory(env, previous));
      if (data.fingerprint !== planned.fingerprint) throw new ApiError("La propuesta cambió. Vuelve a proponer conservando tu edición.", 409, "plan_conflict");
      trustedPlan = planned.proposals.find(proposal => proposal.alternative === data.alternative);
      if (!trustedPlan) throw new ApiError("La alternativa ya no está disponible.", 409, "plan_conflict");
    }
    const next = applyStudioCommand(previous, workspace, { type: command.type, data }, { trustedPlan, ...(trusted.newId ? { newId: () => trusted.newId! } : {}), generation: trusted.generation }); await saveState(env, next, previous, workspace.revision); return json({ state: next });
  }
  if (path === "/api/studio/uploads" && method === "POST") return createUpload(request, env);
  const uploadMatch = /^\/api\/studio\/uploads\/([^/]+)(\/complete)?$/.exec(path);
  if (uploadMatch) {
    const value = await readUpload(env, uploadMatch[1]);
    if (method === "GET" && !uploadMatch[2]) return json({ upload: uploadPublic(value) });
    if (method === "PUT" && !uploadMatch[2]) return appendChunk(request, env, value);
    if (method === "POST" && uploadMatch[2]) return completeUpload(env, value);
    if (method === "DELETE" && !uploadMatch[2]) {
      if (value.status === "completed") throw new ApiError("El original ya está guardado.", 409, "upload_closed");
      if (value.status === "cancelled") return json({ upload: uploadPublic(value) });
      const token = await lockUpload(env, value);
      try {
        if (await env.MEDIA.head(value.key)) await env.MEDIA.delete(value.key);
        else if (value.multipartId) {
          try { await env.MEDIA.resumeMultipartUpload(value.key, value.multipartId).abort(); }
          catch (error) {
            // R2 documents 10024/NoSuchUpload as already absent or aborted.
            // Service/permission failures retain the reservation for retry.
            const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
            const knownMissing = code === 10024 || code === "NoSuchUpload" || error instanceof Error && /(?:\bNoSuchUpload\b|\(10024\))/.test(error.message);
            if (!knownMissing) throw error;
          }
        }
        const next = { ...value, status: "cancelled" as const };
        await env.DB.batch([env.DB.prepare("UPDATE marker_studio_uploads SET status='cancelled',document=?,lock_token=NULL,lock_until=0 WHERE id=? AND lock_token=?").bind(JSON.stringify(next), value.id, token),
          env.DB.prepare("UPDATE marker_studio_limits SET reserved_bytes=reserved_bytes-?,upload_token=NULL WHERE id=1 AND upload_token=? AND EXISTS(SELECT 1 FROM marker_studio_uploads WHERE id=? AND status='cancelled')").bind(value.size, value.id, value.id)]);
        return json({ upload: uploadPublic(next) });
      } finally { await env.DB.prepare("UPDATE marker_studio_uploads SET lock_token=NULL,lock_until=0 WHERE id=? AND lock_token=?").bind(value.id, token).run(); }
    }
  }
  const assetMatch = /^\/api\/studio\/assets\/([^/]+)$/.exec(path);
  if (assetMatch && method === "GET") {
    const row = await first<{ document: string; storage_key: string }>(env, "SELECT document,storage_key FROM marker_studio_assets WHERE id=?", id(assetMatch[1]));
    if (!row) throw new ApiError("Original no encontrado.", 404, "not_found"); const asset = JSON.parse(row.document) as StudioAsset;
    return mediaResponse(request, env, row.storage_key, asset.mime, url.searchParams.get("download") === "1" ? asset.name : undefined);
  }
  const jobMatch = /^\/api\/studio\/jobs\/([^/]+)(\/(video|cover))?$/.exec(path);
  if (jobMatch && method === "GET") {
    const value = await readJob(env, jobMatch[1]); if (!jobMatch[2]) return json({ job: jobPublic(value), receipt: value.receipt });
    if (value.status !== "completed") throw new ApiError("Montaje todavía no disponible.", 409, "render_incomplete");
    const key = jobMatch[3] === "video" ? value.videoKey : value.coverKey; if (!key) throw new ApiError("Archivo no disponible.", 404, "not_found");
    return mediaResponse(request, env, key, jobMatch[3] === "video" ? "video/mp4" : "image/png");
  }
  const variantMatch = /^\/api\/studio\/variants\/([^/]+)\/(render|approve|export)$/.exec(path);
  if (variantMatch) {
    const variantId = id(variantMatch[1]), operation = variantMatch[2], state = await readHostedStudio(env), variant = state.variants.find(entry => entry.id === variantId);
    if (!variant) throw new ApiError("Borrador no encontrado.", 404, "not_found");
    if (operation === "render" && method === "POST") return queueRender(env, state, variantId, request, workspace);
    if (operation === "approve" && method === "POST") {
      if (variant.planner) await validateAnalysisReferences(env,state,{analysisIds:variant.planner.analysisIds,candidateIds:variant.sourceIds,lockedSelections:variant.selections});
      validatePlannedVariant(state, variant, variant.planner ? await plannerHistory(env, state) : [], workspace);
      const body = object(await readJson(request));
      if (integer(body.recipeRevision, "Receta") !== variant.recipeRevision) throw new ApiError("La receta cambió. Vuelve a previsualizar.", 409, "recipe_conflict");
      const rendered = variant.template !== "text" && typeof body.jobId === "string" ? await readJob(env, body.jobId) : undefined;
      if (rendered && (rendered.status !== "completed" || rendered.variantId !== variantId || rendered.recipeRevision !== variant.recipeRevision || !rendered.videoKey || !await env.MEDIA.head(rendered.videoKey))) throw new ApiError("El montaje no corresponde a esta receta o ya no está disponible.", 409, "render_mismatch");
      const next = applyStudioCommand(state, workspace, { type: "variant.approve", data: { id: variantId, confirmed: body.confirmed } }, { trustedRender: rendered ? { variantId, recipeRevision: rendered.recipeRevision, jobId: rendered.id } : undefined });
      let receipt: Job | undefined;
      if (variant.template === "text") {
        const existing = await first<{ document: string }>(env, "SELECT document FROM marker_studio_jobs WHERE variant_id=? AND recipe_revision=? AND json_extract(document,'$.kind')='text-approval' LIMIT 1", variantId, variant.recipeRevision);
        receipt = existing ? JSON.parse(existing.document) : { id: crypto.randomUUID(), variantId, recipeRevision: variant.recipeRevision, kind: "text-approval", status: "completed", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), receipt: structuredClone({ recipe: { variantId, recipeRevision: variant.recipeRevision, template: "text", platform: variant.platform, campaignId: variant.campaignId, hook: variant.hook, body: variant.body, cta: variant.cta }, sourceSnapshots: variant.sourceSnapshots, ...(variant.planner ? {planner:variant.planner} : {}) }) };
      }
      const savedReceipt = receipt;
      if (savedReceipt && new TextEncoder().encode(JSON.stringify(savedReceipt)).byteLength > MAX_ROW_BYTES) throw new ApiError("La receta contiene demasiado texto copiado. Reduce sus fuentes.", 413, "metadata_limit");
      await saveState(env, next, state, workspace.revision, savedReceipt ? [token => env.DB.prepare(`INSERT OR IGNORE INTO marker_studio_jobs(id,variant_id,recipe_revision,status,document)
        SELECT ?,?,?,'completed',? WHERE EXISTS(SELECT 1 FROM marker_studio_meta WHERE write_token=?)`).bind(savedReceipt.id, variantId, variant.recipeRevision, JSON.stringify(savedReceipt), token)] : []);
      return json({ state: next, ...(receipt ? { job: jobPublic(receipt) } : {}) });
    }
    if (operation === "export" && method === "GET") {
      if (variant.planner) await validateAnalysisReferences(env,state,{analysisIds:variant.planner.analysisIds,candidateIds:variant.sourceIds,lockedSelections:variant.selections});
      validatePlannedVariant(state, variant, variant.planner ? await plannerHistory(env, state) : [], workspace);
      assertStudioExportable(state, variantId, variant.approvedJobId);
      if (variant.template === "text") return new Response([variant.hook, variant.body, variant.cta].filter(Boolean).join("\n\n"), { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="marker-${variantId}.txt"`, "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" } });
      if (!variant.approvedJobId) throw new ApiError("Falta el montaje aprobado.", 409, "render_missing");
      const rendered = await readJob(env, variant.approvedJobId);
      if (rendered.status !== "completed" || rendered.variantId !== variantId || rendered.recipeRevision !== variant.recipeRevision || !rendered.videoKey) throw new ApiError("Falta el montaje aprobado.", 409, "render_mismatch");
      return mediaResponse(request, env, rendered.videoKey, "video/mp4", `marker-${variantId}.mp4`);
    }
  }
  return json({ error: "Ruta de studio no disponible.", code: "not_found" }, 404);
}
/** The Worker must authenticate its sole owner before calling this adapter. */
export async function hostedStudioApi(request: Request, env: HostedStudioEnv, workspace: Workspace, trusted: TrustedStudioInvocation = {}): Promise<Response | null> {
  try { return await route(request, env, workspace, trusted); } catch (error) { return fail(error); }
}
