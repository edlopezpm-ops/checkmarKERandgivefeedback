/** Loopback-only studio adapter. The Vite boundary authenticates the local caller.
 * Originals and normalized metadata deliberately live outside workspace.json. */
import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, existsSync, mkdirSync } from "node:fs";
import { open, rename, stat, unlink } from "node:fs/promises";
import { resolve, join } from "node:path";
import { Readable } from "node:stream";
import { DomainError, object, type Workspace } from "../src/core/domain.ts";
import {
  applyStudioCommand, assertStudioExportable, buildRenderSpec, emptyStudio,
  registerStudioAsset, type StudioAsset, type StudioState, type StudioSourceSnapshot, type TrustedStudioInvocation,
} from "../src/core/studio.ts";
import { json, readJson } from "./api.ts";
import { probeMedia, renderMedia, runTool, StudioMediaError, type MediaTools } from "./studio-render.ts";
import { planStudio, validatePlannedVariant, type StudioPlanInput, type StudioPlannerUse } from "../src/core/studio-planner.ts";
import { analyzeMedia } from "./studio-analysis.ts";
import { ANALYSIS_PROFILE, ANALYSIS_LOCAL_TESTED_TOOL_VERSION, ANALYSIS_MAX_JSON, ANALYSIS_MAX_THUMB_BYTES,
  validateAnalysisRange, validateAnalysisResult, type StudioAnalysisRange, type StudioAnalysisResult } from "../src/core/studio-analysis.ts";
import { defaultStudioSettings, SETTINGS_MAX_BUDGET_CENTS, SETTINGS_MAX_STORAGE_BYTES, validateStudioSettings,
  type StudioSettings, type StudioSettingsResponse } from "../src/core/settings.ts";

const MAX_FILE = 250 * 1024 * 1024;
const MAX_CHUNK = 8 * 1024 * 1024;
const ID = /^[a-zA-Z0-9_-]{1,100}$/;
const MAX_METADATA = 8 * 1024 * 1024, ANALYSIS_META_RESERVE = ANALYSIS_MAX_JSON + 8192, RENDER_RESERVE=270*1024*1024;
type LocalAnalysis = {
  id: string; assetId: string; sha256: string; range: StudioAnalysisRange; profile: typeof ANALYSIS_PROFILE;
  toolVersion: string; status: "queued" | "running" | "completed" | "failed"; createdAt: string; updatedAt: string;
  result?: StudioAnalysisResult; thumbnails?: Array<{name:string;size:number}>; error?: string;
};
type Upload = {
  id: string; name: string; mime: string; size: number; offset: number;
  status: "uploading" | "completed" | "cancelled";
  createdAt: string; assetId?: string; duplicateOf?: string;
};
export type StudioJob = {
  id: string; variantId: string; recipeRevision: number;
  status: "queued" | "running" | "completed" | "failed";
  createdAt: string; updatedAt: string; error?: string; errorCode?: string;
  width?: number; height?: number; duration?: number;
  kind?: "render" | "text-approval";
  provenance?: "recorded" | "unknown";
  sourceRefs?: Array<{ materialId: string; contentVersion: number; assetId?: string; kind: StudioSourceSnapshot["kind"] }>;
};
type TextRecipe = { variantId: string; recipeRevision: number; template: "text"; platform: string; campaignId: string; hook: string; body: string; cta: string };
type JobReceipt = { recipe: ReturnType<typeof buildRenderSpec> | TextRecipe; sourceSnapshots: StudioSourceSnapshot[]; planner?: StudioState["variants"][number]["planner"] };
type StoredJob = StudioJob & { videoKey?: string; coverKey?: string; receipt?: JobReceipt };
export type StudioApiOptions = { directory: string; tools: MediaTools };

class ApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = "invalid_request") {
    super(message); this.status = status; this.code = code;
  }
}
function requiredId(value: string): string {
  if (!ID.test(value)) throw new ApiError("Identificador inválido.");
  return value;
}
function integer(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0)
    throw new ApiError(`${label} inválido.`);
  return Number(value);
}
function safeName(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 240 || /[\x00-\x1f]/.test(value))
    throw new ApiError("Nombre de archivo inválido.");
  return value.replaceAll("\\", "/").split("/").at(-1)!;
}
function mediaMime(value: unknown, name: string): string {
  const known: Record<string, string> = { mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", mkv: "video/x-matroska", avi: "video/x-msvideo", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", bmp: "image/bmp", heic: "image/heic", heif: "image/heif", m4a: "audio/mp4", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", flac: "audio/flac", aac: "audio/aac" };
  const supplied = typeof value === "string" ? value.trim() : "";
  if (!supplied || supplied.toLowerCase() === "application/octet-stream") {
    const inferred = known[name.split(".").at(-1)?.toLowerCase() ?? ""];
    if (inferred) return inferred;
  }
  // MediaRecorder reports parameters (e.g. audio/webm;codecs=opus).
  // Store only the validated container MIME; probing still determines actual data.
  if (supplied.length > 200 || !/^(video|image|audio)\/[a-z0-9.+-]+(?:;\s*(?:codecs|rate|channels)=(?:[a-z0-9._,+-]+|"[a-z0-9._,+ -]+"))*$/i.test(supplied))
    throw new ApiError("Selecciona un video, una foto o un audio.", 415, "unsupported_media");
  const base = supplied.split(";", 1)[0].toLowerCase();
  if (base === "image/svg+xml") throw new ApiError("Usa una foto en formato raster.", 415, "unsupported_media");
  return base;
}
function publicJob(job: StoredJob): StudioJob {
  const { videoKey: _videoKey, coverKey: _coverKey, receipt, ...result } = job;
  return { ...result, provenance: receipt ? "recorded" : "unknown", sourceRefs: receipt?.sourceSnapshots.map(source => ({ materialId: source.materialId, contentVersion: source.contentVersion, assetId: source.assetId, kind: source.kind })) ?? [] };
}
function failure(error: unknown): Response {
  if (error instanceof ApiError) return json({ error: error.message, code: error.code }, error.status);
  if (error instanceof DomainError) return json({ error: error.message, code: error.status === 409 ? "revision_conflict" : "invalid_command" }, error.status);
  // No paths, SQL, uploaded content or subprocess output cross the API boundary.
  return json({ error: "No se pudo completar la operación. El trabajo guardado se conserva.", code: "studio_unavailable" }, 503);
}

/** This API does not bind a network interface. Use only behind the local origin gate. */
export function createStudioApi(options: StudioApiOptions) {
  const directory = resolve(options.directory);
  mkdirSync(join(directory, "originals"), { recursive: true });
  mkdirSync(join(directory, "uploads"), { recursive: true });
  mkdirSync(join(directory, "renders"), { recursive: true });
  mkdirSync(join(directory, "analysis"), { recursive: true });
  const db = new DatabaseSync(join(directory, "studio.sqlite"));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000;
    CREATE TABLE IF NOT EXISTS studio_meta(id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL);
    INSERT OR IGNORE INTO studio_meta VALUES(1,0);
    CREATE TABLE IF NOT EXISTS studio_assets(id TEXT PRIMARY KEY,sha256 TEXT NOT NULL,document TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS studio_assets_hash ON studio_assets(sha256);
    CREATE TABLE IF NOT EXISTS studio_materials(id TEXT PRIMARY KEY,document TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS studio_campaigns(id TEXT PRIMARY KEY,document TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS studio_variants(id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL,document TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS studio_asset_files(asset_id TEXT PRIMARY KEY REFERENCES studio_assets(id),storage_key TEXT NOT NULL UNIQUE);
    CREATE TABLE IF NOT EXISTS studio_uploads(id TEXT PRIMARY KEY,document TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS studio_jobs(id TEXT PRIMARY KEY,variant_id TEXT NOT NULL,recipe_revision INTEGER NOT NULL,document TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS studio_jobs_recipe ON studio_jobs(variant_id,recipe_revision);
    CREATE TABLE IF NOT EXISTS studio_analysis(id TEXT PRIMARY KEY,asset_id TEXT NOT NULL REFERENCES studio_assets(id),sha256 TEXT NOT NULL,start_ms INTEGER NOT NULL,end_ms INTEGER NOT NULL,profile TEXT NOT NULL,tool_version TEXT NOT NULL,status TEXT NOT NULL,document TEXT NOT NULL,reserved_bytes INTEGER NOT NULL DEFAULT 0,metadata_reserved INTEGER NOT NULL DEFAULT 0);
    CREATE UNIQUE INDEX IF NOT EXISTS studio_analysis_cache ON studio_analysis(sha256,start_ms,end_ms,profile,tool_version) WHERE status!='failed';
    CREATE TABLE IF NOT EXISTS studio_settings(id INTEGER PRIMARY KEY CHECK(id=1),document TEXT NOT NULL CHECK(json_valid(document)));`);
  db.prepare("INSERT OR IGNORE INTO studio_settings(id,document) VALUES(1,?)").run(JSON.stringify(defaultStudioSettings()));
  let closed = false;
  let queue: Promise<unknown> = Promise.resolve();
  let activeRender: Promise<void> | undefined;
  let activeAnalysis: Promise<void> | undefined;
  const tables = ["assets", "materials", "campaigns", "variants"] as const;
  function serialize<T>(operation: () => Promise<T> | T): Promise<T> {
    const next = queue.then(() => {
      if (closed) throw new ApiError("Estudio cerrado.", 503, "studio_closed");
      return operation();
    });
    queue = next.catch(() => undefined);
    return next;
  }
  function readState(): StudioState {
    const state = emptyStudio();
    state.revision = Number((db.prepare("SELECT revision FROM studio_meta WHERE id=1").get() as { revision: number }).revision);
    for (const table of tables) {
      const rows = db.prepare(`SELECT document FROM studio_${table} ORDER BY rowid`).all() as { document: string }[];
      (state[table] as unknown[]) = rows.map((row) => JSON.parse(row.document));
    }
    return state;
  }
  function saveState(state: StudioState, expectedRevision: number, assetFile?: { id: string; key: string }, completedUpload?: Upload, usageReceipt?: StoredJob): void {
    db.exec("BEGIN IMMEDIATE");
    try {
      if (new TextEncoder().encode(JSON.stringify(state)).byteLength + analysisMetadata() > MAX_METADATA) throw new ApiError("Space alcanzó el límite de metadatos; conserva sus originales.", 413, "metadata_limit");
      const revision = db.prepare("UPDATE studio_meta SET revision=? WHERE id=1 AND revision=?").run(state.revision, expectedRevision);
      if (Number(revision.changes) !== 1) throw new ApiError("Space cambió. Recarga antes de guardar.", 409, "revision_conflict");
      for (const table of tables) {
        const ids = new Set(state[table].map((entry) => entry.id));
        const old = db.prepare(`SELECT id FROM studio_${table}`).all() as { id: string }[];
        for (const row of old) if (!ids.has(row.id)) db.prepare(`DELETE FROM studio_${table} WHERE id=?`).run(row.id);
        for (const entry of state[table]) {
          if (table === "assets") {
            const asset = entry as StudioAsset;
            db.prepare("INSERT INTO studio_assets(id,sha256,document) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document").run(asset.id, asset.sha256, JSON.stringify(asset));
          } else if (table === "variants") {
            const variant = entry as StudioState["variants"][number];
            db.prepare("INSERT INTO studio_variants(id,campaign_id,document) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET campaign_id=excluded.campaign_id,document=excluded.document").run(variant.id, variant.campaignId, JSON.stringify(variant));
          } else {
            db.prepare(`INSERT INTO studio_${table}(id,document) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document`).run(entry.id, JSON.stringify(entry));
          }
        }
      }
      if (assetFile) db.prepare("INSERT INTO studio_asset_files(asset_id,storage_key) VALUES(?,?)").run(assetFile.id, assetFile.key);
      if (completedUpload) saveUpload(completedUpload);
      if (usageReceipt) saveJob(usageReceipt);
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  }
  function uploads(): Upload[] {
    return (db.prepare("SELECT document FROM studio_uploads ORDER BY rowid DESC").all() as { document: string }[]).map((row) => JSON.parse(row.document));
  }
  function upload(id: string): Upload {
    const row = db.prepare("SELECT document FROM studio_uploads WHERE id=?").get(requiredId(id)) as { document: string } | undefined;
    if (!row) throw new ApiError("Subida no encontrada.", 404, "not_found");
    return JSON.parse(row.document);
  }
  function saveUpload(value: Upload): void {
    db.prepare("INSERT INTO studio_uploads(id,document) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document").run(value.id, JSON.stringify(value));
  }
  function jobs(): StoredJob[] {
    return (db.prepare("SELECT document FROM studio_jobs ORDER BY rowid DESC").all() as { document: string }[]).map((row) => JSON.parse(row.document));
  }
  function jobSummaries(): StudioJob[] {
    // SQL projects references before crossing into JS; list polling never loads
    // every historical source text or full recipe into the response.
    const rows = db.prepare(`SELECT json_set(json_remove(document,'$.receipt','$.videoKey','$.coverKey'),
      '$.provenance',CASE WHEN json_type(document,'$.receipt')='object' THEN 'recorded' ELSE 'unknown' END,
      '$.sourceRefs',json((SELECT json_group_array(json_object(
        'materialId',json_extract(source.value,'$.materialId'),
        'contentVersion',json_extract(source.value,'$.contentVersion'),
        'assetId',json_extract(source.value,'$.assetId'),
        'kind',json_extract(source.value,'$.kind')))
        FROM json_each(studio_jobs.document,'$.receipt.sourceSnapshots') source))) AS summary
      FROM studio_jobs ORDER BY rowid DESC LIMIT 100`).all() as { summary: string }[];
    return rows.map(row => {
      const summary = JSON.parse(row.summary) as StudioJob;
      summary.sourceRefs = summary.sourceRefs?.map(({ assetId, ...source }) => ({ ...source, ...(typeof assetId === "string" ? { assetId } : {}) }));
      return summary;
    });
  }
  function materialUsage(state: StudioState): Record<string, number> {
    const used = new Map<string, Set<string>>();
    const add = (materialId: string, variantId: string) => {
      const variants = used.get(materialId) ?? new Set<string>();
      variants.add(variantId); used.set(materialId, variants);
    };
    for (const variant of state.variants) for (const materialId of variant.sourceIds) add(materialId, variant.id);
    const rows = db.prepare(`SELECT variant_id,json_extract(source.value,'$.materialId') AS material_id
      FROM studio_jobs,json_each(studio_jobs.document,'$.receipt.sourceSnapshots') source
      WHERE json_extract(studio_jobs.document,'$.status')='completed'`).all() as { variant_id: string; material_id: string }[];
    for (const row of rows) add(row.material_id, row.variant_id);
    return Object.fromEntries([...used].map(([materialId, variants]) => [materialId, variants.size]));
  }
  function plannerHistory(state: StudioState): StudioPlannerUse[] {
    const uses: StudioPlannerUse[] = [];
    for (const variant of state.variants) for (const selection of variant.selections) {
      const snapshot = variant.sourceSnapshots.find(source => source.materialId === selection.materialId);
      const asset = state.assets.find(source => source.id === snapshot?.assetId);
      if (asset) uses.push({ sha256: asset.sha256, start: selection.start, end: selection.end, variantId: variant.id });
    }
    const rows = db.prepare(`SELECT a.sha256,json_extract(c.value,'$.start') AS start,json_extract(c.value,'$.end') AS end,j.variant_id,j.id AS job_id
      FROM studio_jobs j,json_each(j.document,'$.receipt.recipe.clips') c
      JOIN studio_assets a ON a.id=json_extract(c.value,'$.assetId')
      WHERE json_extract(j.document,'$.status')='completed' LIMIT 5001`).all() as Array<{sha256:string;start:number;end:number;variant_id:string;job_id:string}>;
    if (rows.length > 5000) throw new ApiError("El historial necesita una revisión antes de proponer más montajes.", 413, "planner_history_limit");
    for (const row of rows) uses.push({sha256:row.sha256,start:row.start,end:row.end,variantId:row.variant_id,jobId:row.job_id});
    return uses;
  }
  function analysisMetadata(): number {
    return Number((db.prepare("SELECT COALESCE(SUM(length(CAST(document AS BLOB))+metadata_reserved),0) AS bytes FROM studio_analysis").get() as {bytes:number}).bytes);
  }
  function validateAnalysisReferences(state: StudioState,input:{analysisIds?:string[];candidateIds:string[];lockedSelections:Array<{materialId:string;start:number;end:number}>}):void {
    if (!input.analysisIds?.length) return;
    if (!Array.isArray(input.analysisIds)||input.analysisIds.length>3||!Array.isArray(input.candidateIds)||!Array.isArray(input.lockedSelections)) throw new ApiError("Revisa los análisis seleccionados.");
    for(const analysisId of input.analysisIds){
      const row=db.prepare("SELECT document FROM studio_analysis WHERE id=?").get(requiredId(analysisId)) as {document:string}|undefined;
      const entry=row?JSON.parse(row.document) as LocalAnalysis:undefined;
      if(!entry||entry.status!=="completed"||!entry.result||!["complete","partial"].includes(entry.result.status)||entry.profile!==ANALYSIS_PROFILE||entry.toolVersion!==ANALYSIS_LOCAL_TESTED_TOOL_VERSION
        ||!input.lockedSelections.some(selection=>{const material=state.materials.find(item=>item.id===selection.materialId);const asset=state.assets.find(item=>item.id===material?.assetId);return input.candidateIds.includes(selection.materialId)&&asset?.sha256===entry.sha256&&selection.start>=entry.range.start&&selection.end<=entry.range.end;}))
        throw new ApiError("El análisis ya no corresponde a un tramo fijado de las fuentes seleccionadas.",409,"analysis_mismatch");
    }
  }
  function analysisJobs(): LocalAnalysis[] {
    return (db.prepare("SELECT document FROM studio_analysis ORDER BY rowid DESC").all() as Array<{document:string}>).map(row => JSON.parse(row.document));
  }
  function publicAnalysis(value: LocalAnalysis) {
    return { ...value, thumbnails: (value.result?.thumbnails ?? []).map(thumb => ({...thumb,url:`/api/studio/analyses/${value.id}/${thumb.name}`})) };
  }
  async function storageUsage(state: StudioState): Promise<{storageBytes:number;reservedBytes:number}> {
    let bytes = state.assets.reduce((sum, asset) => sum + asset.size, 0);
    for (const entry of jobs()) for (const key of [entry.videoKey, entry.coverKey]) if (key) bytes += await stat(jobPath(key)).then(info => info.size).catch(() => 0);
    for (const entry of analysisJobs()) for (let index = 0; index < 6; index++) bytes += await stat(join(directory,"analysis",entry.id,`thumb-${index}.jpg`)).then(info => info.size).catch(() => 0);
    const reserved = db.prepare("SELECT COALESCE(SUM(reserved_bytes),0) AS bytes FROM studio_analysis").get() as {bytes:number};
    const pendingUploads=uploads().filter(entry=>entry.status==="uploading").reduce((sum,entry)=>sum+entry.size,0);
    const pendingRenders=jobs().filter(entry=>entry.status==="queued"||entry.status==="running").length*RENDER_RESERVE;
    return {storageBytes:bytes,reservedBytes:Number(reserved.bytes)+pendingUploads+pendingRenders};
  }
  function readSettings():StudioSettings {
    return JSON.parse((db.prepare("SELECT document FROM studio_settings WHERE id=1").get() as {document:string}).document);
  }
  async function settingsResponse():Promise<StudioSettingsResponse> {
    return {settings:readSettings(),usage:{month:new Date().toISOString().slice(0,7),processingUsedCents:0,aiUsedCents:0,...await storageUsage(readState())},limits:{maxBudgetCents:SETTINGS_MAX_BUDGET_CENTS,maxStorageBytes:SETTINGS_MAX_STORAGE_BYTES},ai:{connected:false}};
  }
  async function saveSettings(request:Request):Promise<Response> {
    const body=object(await readJson(request));
    if(Object.keys(body).length!==2||Object.keys(body).some(key=>key!=="expectedRevision"&&key!=="settings"))throw new ApiError("Revisa los campos de configuración.");
    const expected=integer(body.expectedRevision,"Revisión"),values=validateStudioSettings(body.settings),previous=readSettings();
    if(expected!==previous.revision)throw new ApiError("La configuración cambió. Compara los valores antes de guardar.",409,"settings_conflict");
    if(uploads().some(entry=>entry.status==="uploading")||jobs().some(entry=>entry.status==="queued"||entry.status==="running")||analysisJobs().some(entry=>entry.status==="queued"||entry.status==="running"))throw new ApiError("Termina o cancela la subida o procesamiento antes de cambiar estos límites.",409,"settings_busy");
    const next:StudioSettings={...values,revision:expected+1};
    const changed=db.prepare("UPDATE studio_settings SET document=? WHERE id=1 AND json_extract(document,'$.revision')=?").run(JSON.stringify(next),expected);
    if(Number(changed.changes)!==1)throw new ApiError("La configuración cambió. Compara los valores antes de guardar.",409,"settings_conflict");
    return json(await settingsResponse());
  }
  function saveAnalysis(value: LocalAnalysis, finished = false): void {
    db.prepare(`UPDATE studio_analysis SET status=?,document=?${finished ? ",reserved_bytes=0,metadata_reserved=0" : ""} WHERE id=?`).run(value.status,JSON.stringify(value),value.id);
  }
  async function executeAnalysis(entry: LocalAnalysis): Promise<void> {
    try {
      await serialize(() => saveAnalysis({...entry,status:"running",updatedAt:new Date().toISOString()}));
      const returned = await analyzeMedia(assetPath(entry.assetId),entry.range,join(directory,"analysis",entry.id),options.tools,{expectedToolVersion:entry.toolVersion});
      const result = validateAnalysisResult(returned.analysis,entry.range);
      if (result.toolVersion !== entry.toolVersion) throw new Error("analysis toolchain mismatch");
      const value: LocalAnalysis = {...entry,status:"completed",result,thumbnails:returned.thumbnails.map(({name,size})=>({name,size})),updatedAt:new Date().toISOString()};
      if (new TextEncoder().encode(JSON.stringify(value)).byteLength > ANALYSIS_META_RESERVE || returned.thumbnails.reduce((sum,thumb)=>sum+thumb.size,0)>ANALYSIS_MAX_THUMB_BYTES) throw new Error("analysis result limit");
      await serialize(() => saveAnalysis(value,true));
    } catch {
      await serialize(() => saveAnalysis({...entry,status:"failed",error:"No se pudo analizar este tramo. El original y el flujo manual se conservan.",updatedAt:new Date().toISOString()},true));
    }
  }
  async function queueAnalysis(request: Request): Promise<Response> {
    const body = object(await readJson(request));
    if (body.confirmed !== true) throw new ApiError("Confirma analizar este tramo.");
    let range: StudioAnalysisRange;
    try { range = validateAnalysisRange(body); } catch { throw new ApiError("Selecciona un tramo positivo de hasta 120 segundos."); }
    const state = readState(), asset = state.assets.find(item=>item.id===body.assetId);
    if (!asset || !["video","audio"].includes(asset.kind) || asset.processing!=="ready" || !asset.duration || range.end>asset.duration+0.001) throw new ApiError("El tramo necesita un original compatible de video o audio.");
    const version = (await runTool(options.tools.ffmpeg,["-version"],undefined,5000,16384)).split(/\r?\n/,1)[0];
    if (version !== ANALYSIS_LOCAL_TESTED_TOOL_VERSION) throw new ApiError("Esta versión multimedia necesita validación antes del análisis. El montaje manual sigue disponible.",503,"analysis_toolchain_unverified");
    const row = db.prepare("SELECT document FROM studio_analysis WHERE sha256=? AND start_ms=? AND end_ms=? AND profile=? AND tool_version=? AND status!='failed' ORDER BY rowid DESC LIMIT 1").get(asset.sha256,Math.round(range.start*1000),Math.round(range.end*1000),ANALYSIS_PROFILE,version) as {document:string}|undefined;
    if (row) { const saved=JSON.parse(row.document) as LocalAnalysis; return json({analysis:publicAnalysis(saved),cached:saved.status==="completed",chargedCents:0}); }
    if (uploads().some(item=>item.status==="uploading") || jobs().some(item=>item.status==="queued"||item.status==="running") || analysisJobs().some(item=>item.status==="queued"||item.status==="running")) throw new ApiError("Espera a que termine el procesamiento actual.",409,"processor_busy");
    if (analysisJobs().length>=1000 || analysisMetadata()+new TextEncoder().encode(JSON.stringify(state)).byteLength+ANALYSIS_META_RESERVE+2048>MAX_METADATA) throw new ApiError("Space alcanzó el límite de metadatos de análisis.",413,"metadata_limit");
    const usage=await storageUsage(state);
    if (usage.storageBytes+usage.reservedBytes+ANALYSIS_MAX_THUMB_BYTES>readSettings().storageLimitBytes) throw new ApiError("Space alcanzó el límite de almacenamiento.",413,"storage_limit");
    const timestamp=new Date().toISOString(), value:LocalAnalysis={id:randomUUID(),assetId:asset.id,sha256:asset.sha256,range,profile:ANALYSIS_PROFILE,toolVersion:version,status:"queued",createdAt:timestamp,updatedAt:timestamp};
    db.prepare("INSERT INTO studio_analysis(id,asset_id,sha256,start_ms,end_ms,profile,tool_version,status,document,reserved_bytes,metadata_reserved) VALUES(?,?,?,?,?,?,?,'queued',?,?,?)").run(value.id,value.assetId,value.sha256,Math.round(range.start*1000),Math.round(range.end*1000),value.profile,value.toolVersion,JSON.stringify(value),ANALYSIS_MAX_THUMB_BYTES,ANALYSIS_META_RESERVE);
    activeAnalysis=executeAnalysis(value); return json({analysis:publicAnalysis(value),cached:false,chargedCents:0},202);
  }
  function job(id: string): StoredJob {
    const row = db.prepare("SELECT document FROM studio_jobs WHERE id=?").get(requiredId(id)) as { document: string } | undefined;
    if (!row) throw new ApiError("Montaje no encontrado.", 404, "not_found");
    return JSON.parse(row.document);
  }
  function saveJob(value: StoredJob): void {
    const existing = db.prepare("SELECT document FROM studio_jobs WHERE id=?").get(value.id) as { document: string } | undefined;
    if (existing && JSON.stringify((JSON.parse(existing.document) as StoredJob).receipt ?? null) !== JSON.stringify(value.receipt ?? null))
      throw new ApiError("El recibo de fuentes de un montaje es inmutable.", 409, "receipt_immutable");
    db.prepare("INSERT INTO studio_jobs(id,variant_id,recipe_revision,document) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document").run(value.id, value.variantId, value.recipeRevision, JSON.stringify(value));
  }
  // A local process is not a durable cloud runner. Interrupted work is explicit.
  for (const entry of jobs()) if (entry.status === "running" || entry.status === "queued")
    saveJob({ ...entry, status: "failed", error: "Montaje interrumpido al cerrar el servidor. Vuelve a generarlo.", updatedAt: new Date().toISOString() });
  for (const entry of analysisJobs()) if (entry.status === "running" || entry.status === "queued")
    saveAnalysis({...entry,status:"failed",error:"Análisis interrumpido. Solicita otro intento explícitamente.",updatedAt:new Date().toISOString()},true);

  function assetPath(id: string): string {
    const row = db.prepare("SELECT storage_key FROM studio_asset_files WHERE asset_id=?").get(requiredId(id)) as { storage_key: string } | undefined;
    if (!row) throw new ApiError("Original no encontrado.", 404, "not_found");
    // storage_key is generated here, never supplied by a caller or filename.
    return join(directory, "originals", requiredId(row.storage_key));
  }
  function checkRevision(body: Record<string, unknown>, state: StudioState): void {
    if (integer(body.expectedRevision, "Revisión") !== state.revision)
      throw new ApiError("Space cambió. Recarga antes de guardar.", 409, "revision_conflict");
  }
  async function completeUpload(id: string): Promise<Response> {
    const current = upload(id);
    if (current.status === "completed") {
      const state = readState(), asset = state.assets.find((entry) => entry.id === current.assetId);
      return json({ state, asset, upload: current, duplicate: !!current.duplicateOf });
    }
    if (current.status !== "uploading" || current.offset !== current.size)
      throw new ApiError("La subida todavía no está completa.", 409, "upload_incomplete");
    const temporary = join(directory, "uploads", current.id);
    const original = join(directory, "originals", current.id);
    const pendingFile = existsSync(temporary) ? temporary : original;
    const digest = createHash("sha256");
    for await (const chunk of createReadStream(pendingFile)) digest.update(chunk);
    const sha256 = digest.digest("hex"), previous = readState();
    const duplicate = previous.assets.find((entry) => entry.sha256 === sha256 && entry.size === current.size);
    if (duplicate) {
      saveUpload({ ...current, status: "completed", assetId: duplicate.id, duplicateOf: duplicate.id });
      await unlink(pendingFile).catch(() => undefined);
      return json({ state: previous, asset: duplicate, upload: upload(id), duplicate: true });
    }
    let technical: Awaited<ReturnType<typeof probeMedia>>;
    try { technical = await probeMedia(pendingFile, options.tools); }
    catch {
      // Originals survive an unsupported codec or absent local tool. No semantic labels inferred.
      const kind = current.mime.startsWith("image/") ? "image" : current.mime.startsWith("audio/") ? "audio" : "video";
      technical = { kind, mime: current.mime, duration: null, width: null, height: null, audioTrack: "unknown", processing: "unsupported" };
    }
    const asset: StudioAsset = { id: current.id, name: current.name, size: current.size, sha256,
      kind: technical.kind, mime: technical.mime, audioTrack: technical.audioTrack, processing: technical.processing,
      ...(technical.duration !== null ? { duration: technical.duration } : {}),
      ...(technical.width !== null ? { width: technical.width } : {}),
      ...(technical.height !== null ? { height: technical.height } : {}),
      createdAt: new Date().toISOString() };
    const key = current.id;
    if (pendingFile === temporary) await rename(temporary, original);
    // If the database fails, the original remains recoverable rather than deleted.
    const next = registerStudioAsset(previous, asset);
    saveState(next, previous.revision, { id: asset.id, key }, { ...current, status: "completed", assetId: asset.id });
    return json({ state: next, asset, upload: upload(id), duplicate: false });
  }
  async function appendChunk(request: Request, id: string): Promise<Response> {
    const current = upload(id);
    if (current.status !== "uploading") throw new ApiError("Subida cerrada.", 409, "upload_closed");
    const offsetHeader = request.headers.get("upload-offset");
    if (!offsetHeader || !/^\d+$/.test(offsetHeader) || Number(offsetHeader) !== current.offset)
      throw new ApiError("El tramo ya cambió. Consulta el avance antes de reintentar.", 409, "upload_offset_conflict");
    const contentLength = request.headers.get("content-length");
    if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_CHUNK))
      throw new ApiError("Tramo demasiado grande.", 413, "chunk_too_large");
    if (!request.body) throw new ApiError("Falta el tramo.");
    const reader = request.body.getReader(), chunks: Uint8Array[] = [];
    let size = 0;
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; void reader.cancel("upload timeout").catch(() => undefined); }, 30_000);
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_CHUNK || current.offset + size > current.size) {
          await reader.cancel(); throw new ApiError("El tramo supera el tamaño permitido.", 413, "chunk_too_large");
        }
        chunks.push(value);
      }
    } finally { clearTimeout(timeout); reader.releaseLock(); }
    if (timedOut) throw new ApiError("La subida tardó demasiado. Reanuda el tramo.", 408, "upload_timeout");
    if (!size) throw new ApiError("Tramo vacío.");
    if (contentLength && Number(contentLength) !== size) throw new ApiError("El tamaño del tramo no coincide.");
    const path = join(directory, "uploads", current.id);
    const file = await open(path, "r+");
    try {
      const info = await file.stat();
      if (info.size < current.offset) throw new ApiError("El archivo parcial necesita volver a subirse.", 409, "upload_corrupt");
      // A crash after fsync and before SQLite commit is recovered from its committed offset.
      await file.truncate(current.offset);
      const payload = Buffer.concat(chunks);
      let written = 0;
      while (written < payload.byteLength) {
        const result = await file.write(payload, written, payload.byteLength - written, current.offset + written);
        if (!result.bytesWritten) throw new ApiError("No se pudo guardar el tramo.", 503, "upload_write_failed");
        written += result.bytesWritten;
      }
      await file.sync();
    } finally { await file.close(); }
    const next = { ...current, offset: current.offset + size };
    saveUpload(next);
    return json({ upload: next });
  }
  async function mediaResponse(request: Request, path: string, mime: string, name?: string): Promise<Response> {
    let info;
    try { info = await stat(path); } catch { throw new ApiError("Archivo no disponible.", 404, "not_found"); }
    let start = 0, end = info.size - 1, partial = false;
    const range = request.headers.get("range");
    const headers: Record<string, string> = {
      "Content-Type": mime, "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store", "Accept-Ranges": "bytes",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    };
    if (name) headers["Content-Disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(name).replaceAll("'", "%27")}`;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${info.size}` } });
      if (!match[1]) { start = Math.max(0, info.size - Number(match[2])); }
      else { start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), end) : end; }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= info.size)
        return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${info.size}` } });
      partial = true; headers["Content-Range"] = `bytes ${start}-${end}/${info.size}`;
    }
    headers["Content-Length"] = String(end - start + 1);
    const stream = Readable.toWeb(createReadStream(path, { start, end }));
    return new Response(stream as ReadableStream<Uint8Array>, { status: partial ? 206 : 200, headers });
  }
  async function executeRender(entry: StoredJob, spec: ReturnType<typeof buildRenderSpec>, paths: Record<string, string>): Promise<void> {
    try {
      await serialize(() => saveJob({ ...entry, status: "running", updatedAt: new Date().toISOString() }));
      const result = await renderMedia(spec, paths, join(directory, "renders", entry.id), options.tools);
      await serialize(() => saveJob({ ...entry, status: "completed", updatedAt: new Date().toISOString(), width: result.width, height: result.height, duration: result.duration,
        // Generated paths are normalized to our private job directory, not exposed to callers.
        videoKey: `${entry.id}/${result.videoPath.split(/[\\/]/).at(-1)}`, coverKey: `${entry.id}/${result.coverPath.split(/[\\/]/).at(-1)}`,
      }));
    } catch (error) {
      await serialize(() => saveJob({ ...entry, status: "failed", updatedAt: new Date().toISOString(),
        error: error instanceof StudioMediaError ? error.message : "No se pudo montar esta receta. Revisa los formatos, tramos y herramientas locales.",
        errorCode: error instanceof StudioMediaError ? error.code : "render_failed",
      }));
    }
  }
  function jobPath(key: string): string {
    const parts = key.split("/");
    if (parts.length !== 2 || !ID.test(parts[0]) || !/^[a-zA-Z0-9_.-]{1,100}$/.test(parts[1]) || parts[1].includes(".."))
      throw new ApiError("Archivo de montaje inválido.", 503);
    return join(directory, "renders", ...parts);
  }
  async function route(request: Request, workspace: Workspace, trusted: TrustedStudioInvocation = {}): Promise<Response | null> {
    const url = new URL(request.url), path = url.pathname, method = request.method;
    if (!path.startsWith("/api/studio")) return null;
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin) throw new ApiError("Origen no permitido.", 403, "origin_denied");
    if(path==="/api/studio/settings"&&method==="GET")return json(await settingsResponse());
    if(path==="/api/studio/settings"&&method==="POST")return saveSettings(request);
    if (path === "/api/studio" && method === "GET") {
      const state = readState();
      return json({ state, jobs: jobSummaries(), usage: materialUsage(state), uploads: uploads().filter((entry) => entry.status === "uploading"), capabilities: { local: true, render: existsSync(options.tools.ffmpeg) && existsSync(options.tools.ffprobe), analysis: existsSync(options.tools.ffmpeg) && existsSync(options.tools.ffprobe), analysisCents:0,maxAnalysisRangeSeconds:120,maxFileBytes: MAX_FILE, maxChunkBytes: MAX_CHUNK,defaultDurationSeconds:readSettings().defaultDurationSeconds } });
    }
    if (path === "/api/studio/plan" && method === "POST") {
      const state = readState();
      const input=object(await readJson(request)) as unknown as StudioPlanInput;
      validateAnalysisReferences(state,input);
      return json(await planStudio(state, workspace, input, plannerHistory(state)));
    }
    if (path === "/api/studio/analyses" && method === "POST") return queueAnalysis(request);
    if (path === "/api/studio/analyses" && method === "GET") {
      const assetId=requiredId(url.searchParams.get("assetId")??"");
      return json({analyses:analysisJobs().filter(entry=>entry.assetId===assetId).slice(0,20).map(entry=>{const {result:_result,...summary}=publicAnalysis(entry);return summary;})});
    }
    const analysisMatch=/^\/api\/studio\/analyses\/([^/]+)(\/(thumb-[0-5]\.jpg))?$/.exec(path);
    if (analysisMatch && method==="GET") {
      const row=db.prepare("SELECT document FROM studio_analysis WHERE id=?").get(requiredId(analysisMatch[1])) as {document:string}|undefined;
      if (!row) throw new ApiError("Análisis no encontrado.",404,"not_found");
      const value=JSON.parse(row.document) as LocalAnalysis;
      if (!analysisMatch[2]) return json({analysis:publicAnalysis(value)});
      if (value.status!=="completed" || !value.result?.thumbnails.some(thumb=>thumb.name===analysisMatch[3])) throw new ApiError("Miniatura no disponible.",404,"not_found");
      return mediaResponse(request,join(directory,"analysis",value.id,analysisMatch[3]),"image/jpeg");
    }
    if (path === "/api/studio/commands" && method === "POST") {
      const body = object(await readJson(request)), previous = readState();
      checkRevision(body, previous);
      const command = object(body.command);
      if (typeof command.type !== "string" || command.type === "variant.approve")
        throw new ApiError("Usa la revisión de borrador para aprobar.");
      if (command.type === "material.delete") {
        const materialId = object(command.data).id;
        if (jobs().some(entry => entry.status !== "failed" && entry.receipt?.sourceSnapshots.some(source => source.materialId === materialId)))
          throw new ApiError("El material conserva usos históricos o un montaje en curso. Conserva sus fuentes.", 409, "material_historical_use");
      }
      const data = object(command.data);
      if(command.type==="variant.save"&&!data.id&&data.duration===undefined)data.duration=readSettings().defaultDurationSeconds;
      let trustedPlan;
      if (command.type === "variant.plan") {
        const input=object(data.request) as unknown as StudioPlanInput;
        validateAnalysisReferences(previous,input);
        const planned = await planStudio(previous, workspace, input, plannerHistory(previous));
        if (data.fingerprint !== planned.fingerprint) throw new ApiError("La propuesta cambió. Vuelve a proponer conservando tu edición.", 409, "plan_conflict");
        trustedPlan = planned.proposals.find(proposal => proposal.alternative === data.alternative);
        if (!trustedPlan) throw new ApiError("La alternativa ya no está disponible.", 409, "plan_conflict");
      }
      const next = applyStudioCommand(previous, workspace, { type: command.type, data }, { trustedPlan, ...(trusted.newId ? { newId: () => trusted.newId! } : {}), generation: trusted.generation });
      saveState(next, previous.revision); return json({ state: next });
    }
    if (path === "/api/studio/uploads" && method === "POST") {
      if (analysisJobs().some(entry=>entry.status==="queued"||entry.status==="running")) throw new ApiError("Espera a que termine el análisis actual.",409,"processor_busy");
      const body = object(await readJson(request)), size = integer(body.size, "Tamaño"), name = safeName(body.name);
      if (!size || size > MAX_FILE) throw new ApiError("El archivo debe pesar entre 1 byte y 250 MiB.", 413, "file_too_large");
      const usage=await storageUsage(readState());
      if(usage.storageBytes+usage.reservedBytes+size>readSettings().storageLimitBytes)throw new ApiError("Space alcanzó el límite de almacenamiento.",413,"storage_limit");
      const mime = mediaMime(body.mime, name);
      if (uploads().some((entry) => entry.status === "uploading")) throw new ApiError("Reanuda o cancela la subida pendiente.", 409, "upload_busy");
      const value: Upload = { id: randomUUID(), name, mime, size, offset: 0, status: "uploading", createdAt: new Date().toISOString() };
      const file = await open(join(directory, "uploads", value.id), "wx"); await file.close(); saveUpload(value);
      return json({ upload: value }, 201);
    }
    const uploadMatch = /^\/api\/studio\/uploads\/([^/]+)(\/complete)?$/.exec(path);
    if (uploadMatch) {
      if (method === "GET" && !uploadMatch[2]) return json({ upload: upload(uploadMatch[1]) });
      if (method === "PUT" && !uploadMatch[2]) return appendChunk(request, uploadMatch[1]);
      if (method === "POST" && uploadMatch[2]) return completeUpload(uploadMatch[1]);
      if (method === "DELETE" && !uploadMatch[2]) {
        const value = upload(uploadMatch[1]);
        if (value.status === "completed") throw new ApiError("El original ya está guardado.", 409, "upload_closed");
        saveUpload({ ...value, status: "cancelled" });
        await unlink(join(directory, "uploads", value.id)).catch(() => undefined);
        return json({ upload: upload(value.id) });
      }
    }
    const assetMatch = /^\/api\/studio\/assets\/([^/]+)$/.exec(path);
    if (assetMatch && method === "GET") {
      const asset = readState().assets.find((entry) => entry.id === requiredId(assetMatch[1]));
      if (!asset) throw new ApiError("Original no encontrado.", 404, "not_found");
      return mediaResponse(request, assetPath(asset.id), asset.mime, url.searchParams.get("download") === "1" ? asset.name : undefined);
    }
    const jobMatch = /^\/api\/studio\/jobs\/([^/]+)(\/(video|cover))?$/.exec(path);
    if (jobMatch && method === "GET") {
      const value = job(jobMatch[1]);
      if (!jobMatch[2]) return json({ job: publicJob(value), ...(value.receipt ? { receipt: value.receipt } : {}) });
      if (value.status !== "completed") throw new ApiError("Montaje todavía no disponible.", 409, "render_incomplete");
      const key = jobMatch[3] === "video" ? value.videoKey : value.coverKey;
      if (!key) throw new ApiError("Archivo no disponible.", 404, "not_found");
      return mediaResponse(request, jobPath(key), jobMatch[3] === "video" ? "video/mp4" : "image/png");
    }
    const variantMatch = /^\/api\/studio\/variants\/([^/]+)\/(render|approve|export)$/.exec(path);
    if (variantMatch) {
      const id = requiredId(variantMatch[1]), operation = variantMatch[2], state = readState();
      const variant = state.variants.find((entry) => entry.id === id);
      if (!variant) throw new ApiError("Borrador no encontrado.", 404, "not_found");
      if (operation === "render" && method === "POST") {
        const body = object(await readJson(request));
        if (integer(body.recipeRevision, "Receta") !== variant.recipeRevision) throw new ApiError("La receta cambió. Guarda y vuelve a generar.", 409, "recipe_conflict");
        validatePlannedVariant(state, variant, variant.planner ? plannerHistory(state) : [], workspace);
        if(variant.planner)validateAnalysisReferences(state,{analysisIds:variant.planner.analysisIds,candidateIds:variant.sourceIds,lockedSelections:variant.selections});
        const spec = buildRenderSpec(state, id);
        const existing = jobs().find((entry) => entry.kind !== "text-approval" && entry.variantId === id && entry.recipeRevision === variant.recipeRevision && entry.status !== "failed");
        if (existing && JSON.stringify(existing.receipt?.recipe) === JSON.stringify(spec) && JSON.stringify(existing.receipt?.sourceSnapshots) === JSON.stringify(variant.sourceSnapshots) && (body.regenerate !== true || existing.status !== "completed")) return json({ job: publicJob(existing), reused: existing.status === "completed" });
        if (jobs().some((entry) => entry.status === "queued" || entry.status === "running")) throw new ApiError("Hay un montaje en curso.", 409, "render_busy");
        if (analysisJobs().some(entry=>entry.status==="queued"||entry.status==="running")) throw new ApiError("Hay un análisis en curso.",409,"processor_busy");
        const usage=await storageUsage(state);
        if(usage.storageBytes+usage.reservedBytes+RENDER_RESERVE>readSettings().storageLimitBytes)throw new ApiError("Space alcanzó el límite de almacenamiento.",413,"storage_limit");
        const paths: Record<string, string> = {};
        for (const clip of spec.clips) paths[clip.assetId] = assetPath(clip.assetId);
        if (spec.narrationAssetId) paths[spec.narrationAssetId] = assetPath(spec.narrationAssetId);
        const value: StoredJob = { id: randomUUID(), variantId: id, recipeRevision: variant.recipeRevision, kind: "render", status: "queued", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), receipt: structuredClone({ recipe: spec, sourceSnapshots: variant.sourceSnapshots, ...(variant.planner ? {planner:variant.planner} : {}) }) };
        saveJob(value);
        activeRender = executeRender(value, spec, paths);
        return json({ job: publicJob(value) }, 202);
      }
      if (operation === "approve" && method === "POST") {
        if(variant.planner)validateAnalysisReferences(state,{analysisIds:variant.planner.analysisIds,candidateIds:variant.sourceIds,lockedSelections:variant.selections});
        validatePlannedVariant(state, variant, variant.planner ? plannerHistory(state) : [], workspace);
        const body = object(await readJson(request));
        if (integer(body.recipeRevision, "Receta") !== variant.recipeRevision) throw new ApiError("La receta cambió. Vuelve a previsualizar.", 409, "recipe_conflict");
        const rendered = variant.template !== "text" && typeof body.jobId === "string" ? job(body.jobId) : undefined;
        if (rendered && (rendered.status !== "completed" || rendered.variantId !== id || rendered.recipeRevision !== variant.recipeRevision)) throw new ApiError("El montaje no corresponde a esta receta.", 409, "render_mismatch");
        if (rendered && (!rendered.videoKey || !existsSync(jobPath(rendered.videoKey)))) throw new ApiError("El montaje ya no está disponible.", 409, "render_missing");
        const next = applyStudioCommand(state, workspace, { type: "variant.approve", data: { id, confirmed: body.confirmed } }, { trustedRender: rendered ? { variantId: id, recipeRevision: rendered.recipeRevision, jobId: rendered.id } : undefined });
        let usageReceipt: StoredJob | undefined;
        if (variant.template === "text") {
          usageReceipt = jobs().find(entry => entry.kind === "text-approval" && entry.variantId === id && entry.recipeRevision === variant.recipeRevision && entry.status === "completed");
          usageReceipt ??= { id: randomUUID(), variantId: id, recipeRevision: variant.recipeRevision, kind: "text-approval", status: "completed", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            receipt: structuredClone({ recipe: { variantId: id, recipeRevision: variant.recipeRevision, template: "text" as const, platform: variant.platform, campaignId: variant.campaignId, hook: variant.hook, body: variant.body, cta: variant.cta }, sourceSnapshots: variant.sourceSnapshots, ...(variant.planner ? {planner:variant.planner} : {}) }) };
        }
        saveState(next, state.revision, undefined, undefined, usageReceipt); return json({ state: next, ...(usageReceipt ? { job: publicJob(usageReceipt) } : {}) });
      }
      if (operation === "export" && method === "GET") {
        if(variant.planner)validateAnalysisReferences(state,{analysisIds:variant.planner.analysisIds,candidateIds:variant.sourceIds,lockedSelections:variant.selections});
        validatePlannedVariant(state, variant, variant.planner ? plannerHistory(state) : [], workspace);
        assertStudioExportable(state, id, variant.approvedJobId);
        if (variant.template === "text") {
          const content = [variant.hook, variant.body, variant.cta].filter(Boolean).join("\n\n");
          return new Response(content, { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="marker-${id}.txt"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
        }
        if (!variant.approvedJobId) throw new ApiError("Falta el montaje aprobado.", 409, "render_missing");
        const rendered = job(variant.approvedJobId);
        if (rendered.status !== "completed" || rendered.variantId !== id || rendered.recipeRevision !== variant.recipeRevision || !rendered.videoKey) throw new ApiError("Falta el montaje aprobado.", 409, "render_mismatch");
        return mediaResponse(request, jobPath(rendered.videoKey), "video/mp4", `marker-${id}.mp4`);
      }
    }
    return json({ error: "Ruta de studio no disponible.", code: "not_found" }, 404);
  }
  return {
    handle(request: Request, workspace: Workspace, trusted: TrustedStudioInvocation = {}): Promise<Response | null> {
      if (!new URL(request.url).pathname.startsWith("/api/studio")) return Promise.resolve(null);
      return serialize(() => route(request, workspace, trusted)).catch(failure);
    },
    async close(): Promise<void> {
      await activeRender;
      await activeAnalysis;
      await queue;
      closed = true; db.close();
    },
  };
}
