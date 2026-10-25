import { DomainError, object, type Workspace } from "../src/core/domain.ts";
import { DEFAULT_AGENT_LIMITS, validateAgentCopy, validateAgentLimits, type AgentConnection, type AgentContext,
  type AgentContextSelection, type AgentEvent, type AgentLimits, type AgentProposal, type AgentRun, type AgentSession } from "../src/core/agents.ts";
import type { StudioState, StudioGenerationOrigin } from "../src/core/studio.ts";
import type { StudioPlanInput } from "../src/core/studio-planner.ts";
import { json, readJson } from "./api.ts";
import type { AgentSql, AgentStore } from "./agents-store.ts";

export type AgentStudio = (request: Request, trusted?: { newId?: string; generation?: StudioGenerationOrigin }) => Promise<Response | null>;
export type AgentsApiOptions = { store: AgentStore; readWorkspace: () => Promise<Workspace>; studioRequest: AgentStudio; now?: () => number };
type Connection = AgentConnection & { tokenHash: string };
type Run = AgentRun & { leaseToken?: string; leaseUntil?: number; outputHash?: string; requestId?: string; requestFingerprint?: string; recoveryReason?: "lease_expired" | "deadline_expired" };
type Proposal = AgentProposal & { plan?: { request: StudioPlanInput; fingerprint: string }; planApplied?: { fingerprint: string; alternative: number; variantId: string; recipeRevision: number }; applying?: { token: string; until: number; kind: "material" | "variant" } };
type Stored<T> = { revision: number; document: string; value: T };
const ID = /^[a-zA-Z0-9_-]{1,100}$/, ACTIVE = "('queued','running')", MAX_ROW_BYTES = 120_000;
const terminal = (status: string) => ["completed", "failed", "cancelled"].includes(status);
class AgentError extends DomainError { code: string; constructor(message: string, status = 400, code = "invalid_request") { super(message, status); this.code = code; } }
function validId(value: unknown): string { if (typeof value !== "string" || !ID.test(value)) throw new AgentError("Identificador inválido."); return value; }
function textField(value: unknown, maximum: number, required = false, trim = true): string {
  if (typeof value !== "string" || value.length > maximum || value.includes("\0") || required && !value.trim()) throw new AgentError("Revisa el texto del agente.");
  return trim ? value.trim() : value;
}
function document(value: unknown): string {
  const result = JSON.stringify(value); if (new TextEncoder().encode(result).byteLength > MAX_ROW_BYTES) throw new AgentError("Reduce el contexto o la respuesta del agente.", 413, "record_limit"); return result;
}
async function digest(value: string): Promise<string> { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map(byte => byte.toString(16).padStart(2, "0")).join(""); }
const secret = () => crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
function publicRun(run: Run): AgentRun { const { leaseToken: _lease, leaseUntil: _until, outputHash: _hash, requestId: _request, requestFingerprint: _fingerprint, recoveryReason: _reason, ...result } = run; return result; }
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
function publicProposal(value: Proposal): AgentProposal { const { plan: _plan, planApplied: _applied, applying: _applying, ...result } = value; return result; }

/** Owner routes require the existing owner boundary. Bridge routes authenticate
 * a separate revocable capability that can only lease work and submit results. */
export function createAgentsApi(options: AgentsApiOptions) {
  const store = options.store, now = options.now ?? Date.now, iso = () => new Date(now()).toISOString();
  async function get<T>(table: string, id: string): Promise<Stored<T>> {
    const rows = await store.all<{ revision: number; document: string }>(`SELECT revision,document FROM marker_agent_${table} WHERE id=?`, [validId(id)]);
    if (!rows[0]) throw new AgentError("Registro del agente no encontrado.", 404, "not_found");
    return { ...rows[0], value: JSON.parse(rows[0].document) as T };
  }
  async function list<T>(table: string, where = "", args: Array<string | number | null> = [], limit = 200): Promise<T[]> {
    return (await store.all<{ document: string }>(`SELECT document FROM marker_agent_${table} ${where} ORDER BY updated_at DESC LIMIT ${limit}`, args)).map(row => JSON.parse(row.document) as T);
  }
  function insert(table: string, value: { id: string; updatedAt: string; status?: string }): AgentSql {
    return { sql: `INSERT INTO marker_agent_${table}(id,revision,status,updated_at,document) VALUES(?,0,?,?,?)`, args: [value.id, value.status ?? "open", value.updatedAt, document(value)] };
  }
  async function save<T extends { id: string; updatedAt: string; status?: string }>(table: string, value: T, revision: number): Promise<void> {
    const changes = await store.run(`UPDATE marker_agent_${table} SET revision=revision+1,status=?,updated_at=?,document=? WHERE id=? AND revision=?`, [value.status ?? "open", value.updatedAt, document(value), value.id, revision]);
    if (changes !== 1) throw new AgentError("El agente cambió. Recarga para recuperar su estado.", 409, "revision_conflict");
  }
  async function limits(): Promise<AgentLimits> {
    const rows = await store.all<{ document: string }>("SELECT document FROM marker_agent_meta WHERE id=1");
    return rows[0] ? JSON.parse(rows[0].document) as AgentLimits : { ...DEFAULT_AGENT_LIMITS };
  }
  function connectionPublic(connection: Connection): AgentConnection {
    const { tokenHash: _hash, ...result } = connection;
    const available = result.status !== "revoked" && result.status !== "pairing" && !!result.lastSeenAt && now() - Date.parse(result.lastSeenAt) < 45_000;
    return { ...result, available, status: result.status === "revoked" || result.status === "pairing" ? result.status : available ? "connected" : "offline" };
  }
  async function studio(request: Request, path = "/api/studio", body?: unknown, trusted?: Parameters<AgentStudio>[1]) {
    const response = await options.studioRequest(new Request(new URL(path, request.url), { method: body === undefined ? "GET" : "POST", headers: { origin: new URL(request.url).origin, ...(body === undefined ? {} : { "content-type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), trusted);
    if (!response) throw new AgentError("Studio no está disponible.", 503, "studio_unavailable");
    const result = object(await response.json());
    if (!response.ok) throw new AgentError(typeof result.error === "string" ? result.error : "No se pudo completar la herramienta.", response.status, typeof result.code === "string" ? result.code : "studio_error");
    return result;
  }
  async function capture(request: Request, supplied: unknown): Promise<AgentContext> {
    const selection = object(supplied ?? { materialIds: [] });
    const rawIds = selection.materialIds ?? [];
    if (!Array.isArray(rawIds) || rawIds.length > 30) throw new AgentError("Selecciona hasta 30 materiales.");
    const materialIds = [...new Set(rawIds.map(validId))], [workspace, snapshot] = await Promise.all([options.readWorkspace(), studio(request)]);
    const state = snapshot.state as StudioState, productId = selection.productId ? validId(selection.productId) : undefined;
    const variantId = selection.variantId ? validId(selection.variantId) : undefined;
    const variant = variantId ? state.variants.find(item => item.id === variantId) : undefined;
    const campaignId = selection.campaignId ? validId(selection.campaignId) : variant?.campaignId;
    const campaign = campaignId ? state.campaigns.find(item => item.id === campaignId) : undefined;
    const effectiveProductId = productId ?? campaign?.productId;
    const product = effectiveProductId ? workspace.products.find(item => item.id === effectiveProductId) : undefined;
    if (effectiveProductId && !product || campaignId && (!campaign || campaign.productId !== effectiveProductId) || variantId && (!variant || campaignId && variant.campaignId !== campaignId)) throw new AgentError("El contexto seleccionado cambió. Actualiza la selección.", 409, "context_conflict");
    const materials = materialIds.map(id => { const found = state.materials.find(item => item.id === id); if (!found) throw new AgentError("Un material ya no existe.", 409, "context_conflict"); return found; })
      .map(item => { if (product && item.productIds.length && !item.productIds.includes(product.id)) throw new AgentError("Un material no pertenece al producto seleccionado.", 409, "context_conflict"); return structuredClone(item); });
    const result: AgentContext = { selection: { ...(product ? { productId: product.id } : {}), ...(campaign ? { campaignId: campaign.id } : {}), materialIds: materials.map(item => item.id), ...(variant ? { variantId: variant.id } : {}), studioRevision: state.revision }, studioRevision: state.revision, capturedAt: iso(), ...(product ? { product } : {}), ...(campaign ? { campaign } : {}), materials, assets: state.assets.filter(asset => materials.some(material => material.assetId === asset.id)), ...(variant ? { variant } : {}), sourceRefs: materials.map(({ id, contentVersion }) => ({ materialId: id, contentVersion })) };
    document(result); return result;
  }
  function event(run: Run, type: AgentEvent["type"], text: string): AgentSql {
    const value: AgentEvent = { id: crypto.randomUUID(), runId: run.id, sessionId: run.sessionId, type, text, createdAt: iso() };
    return { sql: "INSERT INTO marker_agent_events(id,run_id,session_id,created_at,document) VALUES(?,?,?,?,?)", args: [value.id, value.runId, value.sessionId, value.createdAt, document(value)] };
  }
  async function recover(): Promise<void> {
    const active = await list<Run>("runs", `WHERE status IN ${ACTIVE}`);
    for (const run of active) {
      if (Date.parse(run.deadlineAt) > now() && !(run.status === "running" && (run.leaseUntil ?? 0) < now())) continue;
      const current = await get<Run>("runs", run.id); if (terminal(current.value.status)) continue;
      const next: Run = { ...current.value, status: current.value.cancelRequested ? "cancelled" : "failed", ...(!current.value.cancelRequested ? { recoveryReason: Date.parse(current.value.deadlineAt) <= now() ? "deadline_expired" as const : "lease_expired" as const } : {}), error: "El runtime se desconectó o alcanzó el tiempo máximo. El historial guardado se conserva; una respuesta ya terminada puede recuperarse al reconectar el bridge.", updatedAt: iso() };
      try { await save("runs", next, current.revision); await store.batch([event(next, next.status === "cancelled" ? "cancelled" : "failed", next.error!)]); } catch (error) { if (!(error instanceof AgentError && error.status === 409)) throw error; }
    }
  }
  async function usage() {
    const day = iso().slice(0, 10), rows = await store.all<{ today: number; active: number }>(`SELECT SUM(CASE WHEN json_extract(document,'$.createdAt')>=? THEN 1 ELSE 0 END) AS today,SUM(CASE WHEN status IN ${ACTIVE} THEN 1 ELSE 0 END) AS active FROM marker_agent_runs`, [day]);
    return { todayRuns: Number(rows[0]?.today ?? 0), activeRuns: Number(rows[0]?.active ?? 0) };
  }
  async function retention(): Promise<void> {
    const config = await limits(), cutoff = new Date(now() - config.retentionDays * 86_400_000).toISOString();
    // Applied proposals and their full run/context records remain available for
    // provenance and idempotency after the unused-history cleanup horizon.
    await store.batch([
      { sql: "DELETE FROM marker_agent_events WHERE run_id IN (SELECT id FROM marker_agent_runs WHERE status NOT IN ('queued','running') AND updated_at<?)", args: [cutoff] },
      { sql: "DELETE FROM marker_agent_proposals WHERE status!='saved' AND updated_at<?", args: [cutoff] },
      { sql: "DELETE FROM marker_agent_runs WHERE status NOT IN ('queued','running') AND updated_at<? AND NOT EXISTS(SELECT 1 FROM marker_agent_proposals WHERE json_extract(document,'$.runId')=marker_agent_runs.id)", args: [cutoff] },
      { sql: "DELETE FROM marker_agent_sessions WHERE updated_at<? AND NOT EXISTS(SELECT 1 FROM marker_agent_runs WHERE json_extract(document,'$.sessionId')=marker_agent_sessions.id) AND NOT EXISTS(SELECT 1 FROM marker_agent_proposals WHERE json_extract(document,'$.sessionId')=marker_agent_sessions.id)", args: [cutoff] },
    ]);
  }
  async function staleSources(request: Request, proposal: Proposal) {
    const [snapshot, original, workspace] = await Promise.all([studio(request), get<Run>("runs", proposal.runId), options.readWorkspace()]), state = snapshot.state as StudioState;
    const sourceChanged = original.value.context.materials.some(source => JSON.stringify(state.materials.find(item => item.id === source.id)) !== JSON.stringify(source));
    const productChanged = original.value.context.product && JSON.stringify(workspace.products.find(item => item.id === original.value.context.product!.id)) !== JSON.stringify(original.value.context.product);
    const campaignChanged = original.value.context.campaign && JSON.stringify(state.campaigns.find(item => item.id === original.value.context.campaign!.id)) !== JSON.stringify(original.value.context.campaign);
    const capturedVariant = original.value.context.variant;
    const currentVariant = capturedVariant ? state.variants.find(item => item.id === capturedVariant.id) : undefined;
    const ownAppliedVariant = currentVariant && proposal.planApplied?.variantId === currentVariant.id && proposal.planApplied.recipeRevision === currentVariant.recipeRevision;
    const variantChanged = capturedVariant && (!currentVariant || currentVariant.recipeRevision !== capturedVariant.recipeRevision && !ownAppliedVariant);
    if (sourceChanged || productChanged || campaignChanged || variantChanged) throw new AgentError("El producto, la campaña, la variante o los materiales fuente cambiaron. Actualiza el contexto y compara una nueva propuesta.", 409, "context_conflict");
    return state;
  }
  async function bridgeConnection(request: Request): Promise<Stored<Connection>> {
    const token = request.headers.get("authorization")?.match(/^Bearer ([a-zA-Z0-9_-]{32,200})$/)?.[1];
    if (!token) throw new AgentError("Conexión del bridge requerida.", 401, "bridge_auth_required");
    const hash = await digest(token), rows = await store.all<{ id: string }>("SELECT id FROM marker_agent_connections WHERE json_extract(document,'$.tokenHash')=? AND status!='revoked' LIMIT 1", [hash]);
    if (!rows[0]) throw new AgentError("Conexión del bridge inválida o revocada.", 401, "bridge_auth_required");
    const connection = await get<Connection>("connections", rows[0].id);
    if (connection.value.status === "pairing" && now() - Date.parse(connection.value.createdAt) > 600_000) throw new AgentError("El código de conexión caducó. Crea otro.", 401, "pairing_expired");
    return connection;
  }
  async function bridge(request: Request, path: string): Promise<Response> {
    const connection = await bridgeConnection(request), method = request.method;
    if (path === "/api/agents/bridge/heartbeat" && method === "POST") {
      const data = object(await readJson(request, 16_000));
      if (data.authMode !== "chatgpt" || data.billingMode !== "chatgpt_subscription") throw new AgentError("Esta conexión requiere la sesión oficial de ChatGPT/Codex, sin API de pago.", 409, "billing_mode_denied");
      const accountLabel = textField(data.accountLabel, 200, true), model = textField(data.model, 100, true), caps = data.capabilities;
      if (!Array.isArray(caps) || caps.length > 20 || caps.some(cap => typeof cap !== "string" || cap.length > 100)) throw new AgentError("Capacidades inválidas.");
      const value: Connection = { ...connection.value, status: data.available === false ? "offline" : "connected", available: data.available !== false, accountLabel, model, authMode: "chatgpt", billingMode: "chatgpt_subscription", capabilities: caps as string[], lastSeenAt: data.available === false ? undefined : iso(), updatedAt: iso() };
      await save("connections", value, connection.revision);
      if (data.runId) {
        const row = await get<Run>("runs", validId(data.runId));
        if (row.value.connectionId !== value.id || row.value.leaseToken !== data.leaseToken) throw new AgentError("Lease inválido.", 409, "lease_conflict");
        if (row.value.status === "running") await save("runs", { ...row.value, leaseUntil: now() + 120_000, updatedAt: iso() }, row.revision);
      }
      return json({ connection: connectionPublic(value), limits: await limits() });
    }
    await recover();
    if (path === "/api/agents/bridge/poll" && method === "POST") {
      if (!connectionPublic(connection.value).available) return json({ run: null });
      const queued = await list<Run>("runs", "WHERE status='queued' AND json_extract(document,'$.connectionId')=?", [connection.value.id], 1);
      if (!queued[0]) return json({ run: null });
      const row = await get<Run>("runs", queued[0].id), leaseToken = secret();
      if (row.value.status !== "queued") return json({ run: null });
      const value: Run = { ...row.value, status: "running", leaseToken, leaseUntil: now() + 120_000, updatedAt: iso() };
      try { await save("runs", value, row.revision); } catch (error) { if (error instanceof AgentError && error.status === 409) return json({ run: null }); throw error; }
      await store.batch([event(value, "activity", "Codex recibió el contexto seleccionado.")]);
      const previous = (await list<Run>("runs", "WHERE json_extract(document,'$.sessionId')=? AND id!=? AND status='completed'", [value.sessionId, value.id], 4)).reverse();
      const history: Array<{ role: string; text: string }> = [];
      let historyRemaining = 12_000;
      for (const item of previous) {
        const copies = await list<Proposal>("proposals", "WHERE json_extract(document,'$.runId')=?", [item.id], 3);
        for (const turn of [{ role: "user", text: item.prompt }, { role: "assistant", text: [item.message ?? "", ...copies.map(copy => JSON.stringify({ title: copy.title, hook: copy.hook, body: copy.body, cta: copy.cta, materialId: copy.materialId, variantId: copy.variantId }))].join("\n") }]) {
          const text = turn.text.slice(0, Math.min(3000, historyRemaining)); if (text) history.push({ role: turn.role, text }); historyRemaining -= text.length;
        }
      }
      return json({ run: { ...publicRun(value), history, leaseToken }, leaseToken });
    }
    const match = /^\/api\/agents\/bridge\/runs\/([a-zA-Z0-9_-]+)(?:\/(events|complete))?$/.exec(path);
    if (!match) throw new AgentError("Ruta no disponible.", 404);
    const row = await get<Run>("runs", match[1]), run = row.value;
    if (run.connectionId !== connection.value.id) throw new AgentError("Ejecución no disponible.", 403);
    if (!match[2] && method === "GET") return json({ run: { id: run.id, status: run.status, cancelRequested: run.cancelRequested, deadlineAt: run.deadlineAt } });
    if (method !== "POST") throw new AgentError("Método no permitido.", 405);
    const data = object(await readJson(request, 90_000));
    if (!run.leaseToken || data.leaseToken !== run.leaseToken) throw new AgentError("Lease inválido.", 409, "lease_conflict");
    if (match[2] === "events") {
      if (terminal(run.status)) return json({ run: publicRun(run) });
      const count = await store.all<{ count: number }>("SELECT COUNT(*) AS count FROM marker_agent_events WHERE run_id=?", [run.id]);
      if (!Array.isArray(data.events) || data.events.length > 20 || count[0].count + data.events.length > 500) throw new AgentError("Límite de actividad alcanzado.", 413, "event_limit");
      const statements = data.events.map(supplied => { const value = object(supplied); if (value.type !== "activity" && value.type !== "delta") throw new AgentError("Evento inválido."); return event(run, value.type, textField(value.text, 4000, value.type !== "delta", value.type !== "delta")); });
      await store.batch(statements); return json({ run: publicRun(run) });
    }
    if (!["completed", "failed", "cancelled"].includes(String(data.status))) throw new AgentError("Estado inválido.");
    const hash = await digest(JSON.stringify({ status: data.status, output: data.output ?? null, error: data.error ?? null }));
    const recoverable = run.status === "failed" && (run.recoveryReason === "lease_expired" || run.recoveryReason === "deadline_expired") && !run.cancelRequested && data.status === "completed";
    if (terminal(run.status)) {
      if (run.outputHash === hash || run.status === "cancelled") return json({ run: publicRun(run), ...(run.resultRecoveredAt ? { recovered: true } : {}) });
      if (!recoverable) throw new AgentError("La ejecución ya terminó; se conserva el resultado anterior.", 409, "run_closed");
    }
    const output = data.output === undefined ? {} : object(data.output), message = textField(output.message ?? "", 20_000);
    const proposed = output.proposals ?? [];
    if (!Array.isArray(proposed) || proposed.length > 3) throw new AgentError("Devuelve hasta tres propuestas.");
    const status = run.cancelRequested ? "cancelled" : data.status as Run["status"];
    const value: Run = { ...run, status, message, ...(data.error ? { error: textField(data.error, 1000) } : {}), ...(recoverable ? { resultRecoveredAt: iso() } : {}), outputHash: hash, updatedAt: iso() };
    if (recoverable) { delete value.recoveryReason; delete value.error; }
    const proposals: Proposal[] = status === "completed" ? proposed.map((copy, index) => ({ ...validateAgentCopy(copy), id: `proposal_${run.id}_${index}`, kind: "copy", status: "proposed", revision: 0, sessionId: run.sessionId, runId: run.id, connectionId: run.connectionId, model: run.model ?? connection.value.model ?? "unknown", sourceRefs: run.context.sourceRefs, productId: run.context.product?.id, campaignId: run.context.campaign?.id, studioRevision: run.context.studioRevision, createdAt: iso(), updatedAt: iso() })) : [];
    const guardCondition = `id=? AND revision=? AND status=?${recoverable ? " AND json_extract(document,'$.recoveryReason')=?" : ""}`;
    const guardArgs = [run.id, row.revision, recoverable ? "failed" : "running", ...(recoverable ? [run.recoveryReason!] : [])];
    const guard = `EXISTS(SELECT 1 FROM marker_agent_runs WHERE ${guardCondition})`;
    const statements: AgentSql[] = proposals.map(proposal => ({ sql: `INSERT INTO marker_agent_proposals(id,revision,status,updated_at,document) SELECT ?,0,?,?,? WHERE ${guard}`, args: [proposal.id, proposal.status, proposal.updatedAt, document(proposal), ...guardArgs] }));
    const completionEvent = event(value, status as "completed" | "failed" | "cancelled", message || value.error || status);
    completionEvent.sql = completionEvent.sql.replace("VALUES(?,?,?,?,?)", `SELECT ?,?,?,?,? WHERE ${guard}`); completionEvent.args!.push(...guardArgs); statements.push(completionEvent);
    if (recoverable) {
      const recoveredEvent = event(value, "activity", "Se recuperó la respuesta ya terminada del bridge; no se inició otra inferencia.");
      recoveredEvent.sql = recoveredEvent.sql.replace("VALUES(?,?,?,?,?)", `SELECT ?,?,?,?,? WHERE ${guard}`); recoveredEvent.args!.push(...guardArgs); statements.push(recoveredEvent);
    }
    statements.push({ sql: `UPDATE marker_agent_runs SET revision=revision+1,status=?,updated_at=?,document=? WHERE ${guardCondition}`, args: [status, value.updatedAt, document(value), ...guardArgs] });
    const changes = await store.batch(statements);
    if (changes.at(-1) !== 1) throw new AgentError("La ejecución cambió; recupera su resultado.", 409, "revision_conflict");
    return json({ run: publicRun(value), proposals: proposals.map(publicProposal), ...(recoverable ? { recovered: true } : {}) });
  }
  async function route(request: Request): Promise<Response | null> {
    const url = new URL(request.url), path = url.pathname, method = request.method;
    if (path !== "/api/agents" && !path.startsWith("/api/agents/")) return null;
    if (path.startsWith("/api/agents/bridge/")) return bridge(request, path);
    if (request.headers.get("origin") && request.headers.get("origin") !== url.origin || request.headers.get("sec-fetch-site") === "cross-site") throw new AgentError("Origen no permitido.", 403, "origin_denied");
    await recover();
    if (path === "/api/agents" && method === "GET") { await retention(); return json({ connections: (await list<Connection>("connections")).map(connectionPublic), sessions: await list<AgentSession>("sessions"), limits: await limits(), usage: await usage() }); }
    if (path === "/api/agents/limits" && method === "POST") { const value = validateAgentLimits(await readJson(request, 5000)); await store.run("UPDATE marker_agent_meta SET revision=revision+1,document=? WHERE id=1", [document(value)]); return json({ limits: value }); }
    if ((path === "/api/agents/connections" || path === "/api/agents/pair") && method === "POST") {
      const data = object(await readJson(request, 5000));
      const existing = await list<Connection>("connections", "WHERE status!='revoked'"); if (existing.length >= 5) throw new AgentError("Revoca una conexión anterior antes de añadir otra.", 409, "connection_limit");
      const token = secret(), value: Connection = { id: crypto.randomUUID(), name: textField(data.name ?? "Codex local", 100, true), provider: "openai-codex", runtime: "local-bridge", status: "pairing", available: false, capabilities: [], tokenHash: await digest(token), createdAt: iso(), updatedAt: iso() };
      await store.batch([insert("connections", value)]); return json({ connection: connectionPublic(value), token }, 201);
    }
    const connectionMatch = /^\/api\/agents\/connections\/([^/]+)$/.exec(path);
    if (connectionMatch && method === "DELETE") { const row = await get<Connection>("connections", connectionMatch[1]); const value: Connection = { ...row.value, status: "revoked", available: false, updatedAt: iso() }; await save("connections", value, row.revision); return json({ connection: connectionPublic(value) }); }
    if (path === "/api/agents/sessions" && method === "POST") {
      const data = object(await readJson(request, 20_000)), context = await capture(request, data.context);
      if ((await list<AgentSession>("sessions")).length >= 200) throw new AgentError("Límite de conversaciones alcanzado.", 413, "session_limit");
      const value: AgentSession = { id: crypto.randomUUID(), title: textField(data.title ?? context.product?.name ?? "Studio", 160, true), context: context.selection, createdAt: iso(), updatedAt: iso() };
      await store.batch([insert("sessions", value)]); return json({ session: value }, 201);
    }
    const sessionMatch = /^\/api\/agents\/sessions\/([^/]+)(?:\/(runs))?$/.exec(path);
    if (sessionMatch) {
      const session = await get<AgentSession>("sessions", sessionMatch[1]);
      if (method === "GET" && !sessionMatch[2]) {
        const [runs, proposals, events] = await Promise.all([list<Run>("runs", "WHERE json_extract(document,'$.sessionId')=?", [session.value.id]), list<Proposal>("proposals", "WHERE json_extract(document,'$.sessionId')=?", [session.value.id]), store.all<{ document: string }>("SELECT document FROM (SELECT rowid,document,created_at FROM marker_agent_events WHERE session_id=? ORDER BY rowid DESC LIMIT 1000) ORDER BY rowid", [session.value.id])]);
        return json({ session: session.value, runs: runs.reverse().map(publicRun), proposals: proposals.reverse().map(publicProposal), events: events.map(row => JSON.parse(row.document)) });
      }
      if (method === "POST" && sessionMatch[2]) {
        const data = object(await readJson(request, 32_000));
        const requestId = data.requestId === undefined ? undefined : validId(data.requestId);
        const requestFingerprint = requestId ? await digest(canonical({ prompt: data.prompt, task: data.task ?? "copy", connectionId: data.connectionId, context: data.context ?? null })) : undefined;
        const runId = requestId ? `run_${(await digest(`${session.value.id}\0${requestId}`)).slice(0, 48)}` : crypto.randomUUID();
        async function replayRequest(): Promise<Response | null> {
          const rows = await store.all<{ document: string }>("SELECT document FROM marker_agent_runs WHERE id=?", [runId]);
          if (!rows[0]) return null;
          const prior = JSON.parse(rows[0].document) as Run;
          if (prior.sessionId !== session.value.id || prior.requestFingerprint !== requestFingerprint) throw new AgentError("El identificador de envío ya tiene otro contenido. Inicia una solicitud nueva.", 409, "request_conflict");
          return json({ run: publicRun(prior), replayed: true });
        }
        if (requestId) { const repeated = await replayRequest(); if (repeated) return repeated; }
        const connection = await get<Connection>("connections", validId(data.connectionId)), available = connectionPublic(connection.value);
        if (!available.available || available.authMode !== "chatgpt" || available.billingMode !== "chatgpt_subscription") throw new AgentError("Conecta Codex con tu sesión de ChatGPT antes de ejecutar.", 409, "connection_unavailable");
        if (!["copy", "assembly", "review"].includes(String(data.task ?? "copy"))) throw new AgentError("Función del agente inválida.");
        const context = await capture(request, data.context ?? session.value.context), config = await limits();
        const value: Run = { id: runId, sessionId: session.value.id, connectionId: available.id, task: (data.task ?? "copy") as Run["task"], prompt: textField(data.prompt, 8000, true), context, ...(requestId ? { requestId, requestFingerprint } : {}), model: available.model, status: "queued", cancelRequested: false, createdAt: iso(), updatedAt: iso(), deadlineAt: new Date(now() + config.maxRunSeconds * 1000).toISOString() };
        const statement = insert("runs", value); statement.sql = statement.sql.replace("INSERT INTO", "INSERT OR IGNORE INTO").replace("VALUES(?,0,?,?,?)", `SELECT ?,0,?,?,? WHERE (SELECT COUNT(*) FROM marker_agent_runs WHERE status IN ${ACTIVE})<? AND (SELECT COUNT(*) FROM marker_agent_runs WHERE json_extract(document,'$.createdAt')>=?)<? AND (SELECT COUNT(*) FROM marker_agent_runs)<1000`);
        statement.args!.push(config.maxConcurrentRuns, iso().slice(0, 10), config.dailyRuns);
        if ((await store.batch([statement]))[0] !== 1) { if (requestId) { const repeated = await replayRequest(); if (repeated) return repeated; } throw new AgentError("Se alcanzó el límite diario, de historial o de ejecuciones simultáneas. Revisa Settings.", 429, "agent_limit"); }
        await save("sessions", { ...session.value, context: context.selection, updatedAt: iso() }, session.revision);
        await store.batch([event(value, "queued", "Esperando al bridge local de Codex.")]); return json({ run: publicRun(value) }, 201);
      }
    }
    const cancelMatch = /^\/api\/agents\/runs\/([^/]+)\/cancel$/.exec(path);
    if (cancelMatch && method === "POST") { const row = await get<Run>("runs", cancelMatch[1]), value: Run = terminal(row.value.status) ? row.value : { ...row.value, cancelRequested: true, status: row.value.status === "queued" ? "cancelled" : row.value.status, updatedAt: iso() }; await save("runs", value, row.revision); return json({ run: publicRun(value) }); }
    const proposalMatch = /^\/api\/agents\/proposals\/([^/]+)(?:\/(edit|apply|plan|apply-plan|production|render|export))?$/.exec(path);
    if (proposalMatch) {
      let row = await get<Proposal>("proposals", proposalMatch[1]); let proposal = row.value;
      if ((method === "GET" && proposalMatch[2] === "production") || (method === "POST" && proposalMatch[2] === "render")) {
        if (!proposal.variantId) throw new AgentError("Guarda una variante antes de producir.", 409, "variant_required");
        const snapshot = await studio(request), state = snapshot.state as StudioState, variant = state.variants.find(item => item.id === proposal.variantId);
        if (!variant) throw new AgentError("La variante ya no existe.", 404, "not_found");
        if (method === "GET") {
          const jobs = Array.isArray(snapshot.jobs) ? snapshot.jobs.filter(item => object(item).variantId === variant.id) : [];
          return json({ proposal: publicProposal(proposal), variant, jobs });
        }
        const data = object(await readJson(request, 5000));
        if (!Number.isSafeInteger(data.recipeRevision) || data.recipeRevision !== variant.recipeRevision) throw new AgentError("La receta cambió. Revisa la variante guardada.", 409, "recipe_conflict");
        // Canonical render admission owns rights, source/recipe recomputation,
        // budget, storage reservation and the existing job's idempotent reuse.
        const result = await studio(request, `/api/studio/variants/${encodeURIComponent(variant.id)}/render`, { recipeRevision: data.recipeRevision });
        const job = object(result.job), value: Proposal = { ...proposal, renderJobId: validId(job.id), updatedAt: iso() };
        await save("proposals", value, row.revision);
        const run = (await get<Run>("runs", proposal.runId)).value; await store.batch([event(run, "tool", "Studio admitió o recuperó el render de la receta guardada.")]);
        return json({ ...result, proposal: publicProposal(value), variant }, job.status === "completed" ? 200 : 202);
      }
      if (method === "GET" && proposalMatch[2] === "export") {
        if (!proposal.variantId) throw new AgentError("Guarda una variante antes de exportar.", 409, "variant_required");
        const snapshot = await studio(request), variant = (snapshot.state as StudioState).variants.find(item => item.id === proposal.variantId);
        if (!variant) throw new AgentError("La variante ya no existe.", 404, "not_found");
        const response = await options.studioRequest(new Request(new URL(`/api/studio/variants/${encodeURIComponent(variant.id)}/export`, request.url), { headers: { origin: url.origin } }));
        if (!response) throw new AgentError("Studio no está disponible.", 503, "studio_unavailable");
        if (!response.ok) return response;
        const value: Proposal = { ...proposal, exportedAt: iso(), exportedRecipeRevision: variant.recipeRevision, updatedAt: iso() };
        await save("proposals", value, row.revision);
        const run = (await get<Run>("runs", proposal.runId)).value; await store.batch([event(run, "tool", "Studio preparó la exportación aprobada de la variante.")]);
        return response;
      }
      if ((method === "PATCH" && !proposalMatch[2]) || method === "POST" && proposalMatch[2] === "edit") {
        if (proposal.status === "saved" || proposal.applying) throw new AgentError("La propuesta ya se guardó. Edita el material en Space.", 409, "proposal_saved");
        const value: Proposal = { ...proposal, ...validateAgentCopy(await readJson(request, 30_000)), status: "edited", revision: proposal.revision + 1, updatedAt: iso() };
        await save("proposals", value, row.revision); return json({ proposal: publicProposal(value) });
      }
      if (method === "POST" && proposalMatch[2] === "plan") {
        const data = object(await readJson(request, 30_000)), requestInput = object(data.request) as unknown as StudioPlanInput;
        if (proposal.campaignId && requestInput.campaignId !== proposal.campaignId) throw new AgentError("La campaña no corresponde al contexto de la propuesta.", 409, "context_conflict");
        await staleSources(request, proposal);
        const planned = await studio(request, "/api/studio/plan", requestInput);
        proposal = { ...proposal, plan: { request: requestInput, fingerprint: String(planned.fingerprint) }, updatedAt: iso() }; await save("proposals", proposal, row.revision);
        return json({ ...planned, proposal: publicProposal(proposal) });
      }
      if (method === "POST" && (proposalMatch[2] === "apply" || proposalMatch[2] === "apply-plan")) {
        const data = object(await readJson(request, 35_000)), isPlan = proposalMatch[2] === "apply-plan";
        const requestInput = isPlan ? object(data.request) as unknown as StudioPlanInput : undefined;
        if (isPlan && (!proposal.plan || proposal.plan.fingerprint !== data.fingerprint || JSON.stringify(proposal.plan.request) !== JSON.stringify(requestInput))) throw new AgentError("Vuelve a consultar el planner antes de aplicar.", 409, "plan_conflict");
        const effectId = isPlan && requestInput?.variantId ? validId(requestInput.variantId) : `agent_${proposal.id}${isPlan ? "_variant" : ""}`;
        const current = await studio(request), state = current.state as StudioState;
        const existing = isPlan ? state.variants.find(item => item.id === effectId) : state.materials.find(item => item.id === effectId);
        const appliedReceipt = proposal.planApplied;
        const recorded = isPlan ? appliedReceipt && appliedReceipt.fingerprint === data.fingerprint && appliedReceipt.alternative === data.alternative ? appliedReceipt.variantId : undefined : proposal.materialId;
        const reconciled = isPlan ? existing && "planner" in existing && existing.planner?.inputFingerprint === data.fingerprint && existing.planner?.alternative === data.alternative : existing;
        if (recorded || reconciled) {
          proposal = { ...proposal, status: "saved", ...(isPlan ? { variantId: recorded ?? effectId } : { materialId: recorded ?? effectId }), updatedAt: iso() };
          if (isPlan && existing && "recipeRevision" in existing) proposal.planApplied = { fingerprint: String(data.fingerprint), alternative: Number(data.alternative), variantId: effectId, recipeRevision: existing.recipeRevision };
          delete proposal.applying;
          if (!recorded) await save("proposals", proposal, row.revision);
          return json({ proposal: publicProposal(proposal), state, ...(isPlan ? { variantId: proposal.variantId } : { materialId: proposal.materialId }), replayed: true });
        }
        if (proposal.applying && proposal.applying.until > now()) throw new AgentError("La propuesta se está guardando. Recupera su resultado en unos segundos.", 409, "apply_busy");
        const verified = await staleSources(request, proposal);
        if (!Number.isInteger(data.expectedStudioRevision) || data.expectedStudioRevision !== verified.revision) throw new AgentError("Studio cambió. Recarga conservando tu propuesta.", 409, "revision_conflict");
        const token = secret(); proposal = { ...proposal, applying: { token, until: now() + 30_000, kind: isPlan ? "variant" : "material" }, updatedAt: iso() };
        await save("proposals", proposal, row.revision); row = await get<Proposal>("proposals", proposal.id);
        try {
          let response: Record<string, unknown>;
          if (isPlan) {
            response = await studio(request, "/api/studio/commands", { expectedRevision: verified.revision, command: { type: "variant.plan", data: { ...(requestInput!.variantId ? { id: effectId } : {}), request: requestInput, fingerprint: data.fingerprint, alternative: data.alternative } } }, { newId: effectId });
          } else {
            if (!proposal.productId) throw new AgentError("Selecciona un producto antes de guardar el copy.", 409, "product_required");
            const rights = data.rights ?? "unknown", review = data.review ?? "unreviewed";
            if (!["unknown", "owned", "licensed"].includes(String(rights)) || !["unreviewed", "ready"].includes(String(review))) throw new AgentError("Revisa derechos y estado del texto.");
            if (verified.materials.some(material => proposal.sourceRefs.some(ref => ref.materialId === material.id) && (material.rights === "restricted" || material.rights === "unknown")) && (rights !== "unknown" || review === "ready")) throw new AgentError("Confirma primero los derechos de las fuentes; el agente no los concede.", 409, "source_rights");
            const generation: StudioGenerationOrigin = { kind: "agent", runId: proposal.runId, proposalId: proposal.id, connectionId: proposal.connectionId, provider: "openai-codex", model: proposal.model, createdAt: proposal.createdAt, sourceRefs: proposal.sourceRefs };
            response = await studio(request, "/api/studio/commands", { expectedRevision: verified.revision, command: { type: "material.save", data: { title: proposal.title || proposal.hook || "Copy", kind: "text", productIds: [proposal.productId], categories: ["ready-text"], roles: ["message"], review, rights, text: proposal.body, description: [proposal.hook, proposal.cta].filter(Boolean).join("\n"), restrictions: "", topics: [], speech: "absent" } } }, { newId: effectId, generation });
          }
          const latest = await get<Proposal>("proposals", proposal.id);
          const value: Proposal = { ...latest.value, status: "saved", ...(isPlan ? { variantId: effectId } : { materialId: effectId }), appliedRevision: proposal.revision, updatedAt: iso() }; delete value.applying;
          if (isPlan) { const variant = (response.state as StudioState).variants.find(item => item.id === effectId)!; value.planApplied = { fingerprint: String(data.fingerprint), alternative: Number(data.alternative), variantId: effectId, recipeRevision: variant.recipeRevision }; }
          await save("proposals", value, latest.revision);
          const run = (await get<Run>("runs", proposal.runId)).value; await store.batch([event(run, "tool", isPlan ? "planner.apply creó una variante de Studio." : "material.save guardó el copy en Space.")]);
          return json({ proposal: publicProposal(value), ...response, ...(isPlan ? { variantId: effectId } : { materialId: effectId }) });
        } catch (error) {
          // A response may be lost after Studio committed. Keep the deterministic
          // effect id; the next apply reads Studio before attempting another write.
          const latest = await get<Proposal>("proposals", proposal.id);
          if (latest.value.applying?.token === token) { const value = { ...latest.value, updatedAt: iso() }; delete value.applying; await save("proposals", value, latest.revision); }
          throw error;
        }
      }
    }
    throw new AgentError("Ruta no disponible.", 404, "not_found");
  }
  return {
    async handle(request: Request): Promise<Response | null> {
      try { return await route(request); }
      catch (error) {
        if (error instanceof DomainError) return json({ error: error.message, code: error instanceof AgentError ? error.code : error.status === 409 ? "revision_conflict" : "invalid_request" }, error.status);
        return json({ error: "El agente no está disponible. Las propuestas guardadas se conservan.", code: "agents_unavailable" }, 503);
      }
    },
    close() { store.close?.(); },
  };
}
