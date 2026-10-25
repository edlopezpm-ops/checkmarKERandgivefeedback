import { useEffect, useRef, useState, type FormEvent } from "react";
import { ErrorNotice } from "./ErrorNotice";
import { Help } from "./Help";
import { createPortal } from "react-dom";
import type { Workspace } from "../core/domain";
import type { AgentConnection, AgentContextSelection, AgentCopy, AgentOverview, AgentProposal, AgentSession, AgentSessionDetail } from "../core/agents";
import type { StudioPlanInput, StudioPlanResult } from "../core/studio-planner";
import type { StudioState, StudioVariant } from "../core/studio";
import { useLanguage } from "../i18n";
import StudioPlanner from "./StudioPlanner";
import { progressiveAgentMessage } from "./agent-stream";
import type { AgentStudioUpdate, StudioAgentContext } from "./agent-context";
import { agentVariantDrift } from "./agent-context";
import { McpConnections } from "./McpConnections";

export async function agentApi<T>(path = "", data?: unknown, method = "POST"): Promise<T> {
  const response = await fetch(`/api/agents${path}`, { credentials: "same-origin", cache: "no-store", ...(data === undefined && method === "POST" ? {} : { method, headers: { "Content-Type": "application/json", "X-Marker-Auth": "1" }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result as T;
}

const selection = (context: StudioAgentContext): AgentContextSelection => ({ productId: context.productId, campaignId: context.campaignId, materialIds: context.materialIds, variantId: context.variantId, studioRevision: context.studioRevision });
const selectionKey = (context: AgentContextSelection) => JSON.stringify([context.productId, context.campaignId, context.variantId, [...context.materialIds].sort()]);
const readStored = (key: string) => { try { return sessionStorage.getItem(key) ?? ""; } catch { return ""; } };
const store = (key: string, value: string) => { try { if (value) sessionStorage.setItem(key, value); else sessionStorage.removeItem(key); } catch { /* Server persistence remains available. */ } };
type Props = { open: boolean; context: StudioAgentContext; workspace: Workspace; onClose: () => void; onStudioChange: (update: Omit<AgentStudioUpdate, "nonce">) => void; onOpenStudio: () => void };

export default function Agents({ open, context, workspace, onClose, onStudioChange, onOpenStudio }: Props) {
  const { language } = useLanguage();
  const l = (es: string, en: string) => language === "es" ? es : en;
  const localDevelopment = import.meta.env.DEV && ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  const [developerOpen, setDeveloperOpen] = useState(false);
  const developerActive = open && localDevelopment && developerOpen;
  const [overview, setOverview] = useState<AgentOverview>();
  const [sessionId, setSessionId] = useState(() => readStored("marker-agent-session"));
  const [detail, setDetail] = useState<AgentSessionDetail>();
  const [connectionId, setConnectionId] = useState("");
  const [pairing, setPairing] = useState<{ connection: AgentConnection; token: string }>();
  const [pairCopied, setPairCopied] = useState(false);
  const [task, setTask] = useState<"copy" | "assembly" | "review">("copy");
  const [prompt, setPrompt] = useState(() => readStored("marker-agent-prompt"));
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [mobile, setMobile] = useState(() => matchMedia("(max-width: 1000px)").matches);
  const panel = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [restoredRequest] = useState<{ key: string; id: string } | undefined>(() => { try { const value = JSON.parse(readStored("marker-agent-pending-run") || "null"); if (typeof value?.key === "string" && typeof value?.id === "string") return value; } catch { /* A new request will get a fresh identifier. */ } return undefined; });
  const pendingRequest = useRef(restoredRequest);
  const sessionRef = useRef(sessionId);
  sessionRef.current = sessionId;
  useEffect(() => { const query = matchMedia("(max-width: 1000px)"); const update = () => setMobile(query.matches); query.addEventListener("change", update); return () => query.removeEventListener("change", update); }, []);
  useEffect(() => { if (!open) return; closeRef.current?.focus(); if (!mobile) return; const overflow = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = overflow; }; }, [open, mobile]);
  useEffect(() => { store("marker-agent-prompt", prompt); }, [prompt]);
  useEffect(() => { store("marker-agent-session", sessionId); }, [sessionId]);
  async function loadOverview() {
    const next = await agentApi<AgentOverview>(); setOverview(next);
    setConnectionId(current => next.connections.some(item => item.id === current && item.status !== "revoked") ? current : next.connections.find(item => item.available)?.id ?? next.connections.find(item => item.status !== "revoked")?.id ?? "");
    return next;
  }
  async function loadDetail(id = sessionRef.current) {
    if (!id) { setDetail(undefined); return; }
    const next = await agentApi<AgentSessionDetail>(`/sessions/${encodeURIComponent(id)}`);
    if (sessionRef.current === id) setDetail(next);
  }
  useEffect(() => {
    if (!developerActive) return;
    let active = true, pending = false;
    const refresh = async () => {
      if (pending) return; pending = true;
      try { await loadOverview(); if (active && sessionRef.current) await loadDetail(); }
      catch (e) { if (active) setError((e as Error).message); }
      finally { pending = false; }
    };
    void refresh(); const interval = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 1800);
    return () => { active = false; clearInterval(interval); };
  }, [developerActive]);
  useEffect(() => { setDetail(undefined); if (developerActive && sessionId) void loadDetail(sessionId).catch(e => setError(e.message)); }, [sessionId]);
  async function action(operation: () => Promise<void>) {
    if (busy) return; setBusy(true); setError(""); setNotice("");
    try { await operation(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function createSession(): Promise<AgentSession> {
    const result = await agentApi<{ session: AgentSession }>("/sessions", { context: selection(context), title: context.productName ? `${context.productName} · ${l("Agente", "Agent")}` : l("Nueva conversación", "New conversation") });
    sessionRef.current = result.session.id; setSessionId(result.session.id); setDetail({ session: result.session, runs: [], events: [], proposals: [] }); await loadOverview(); return result.session;
  }
  async function submit(event?: FormEvent, customPrompt?: string) {
    event?.preventDefault(); const text = (customPrompt ?? prompt).trim();
    if (!text || !connection?.available || busy || context.materialIds.length > 30) return;
    await action(async () => {
      const id = sessionId || (await createSession()).id;
      const payload = { prompt: text, task, connectionId: connection.id, context: selection(context) };
      const key = JSON.stringify([id, payload]);
      if (pendingRequest.current?.key !== key) pendingRequest.current = { key, id: crypto.randomUUID() };
      store("marker-agent-pending-run", JSON.stringify(pendingRequest.current));
      await agentApi(`/sessions/${encodeURIComponent(id)}/runs`, { ...payload, requestId: pendingRequest.current.id });
      pendingRequest.current = undefined; store("marker-agent-pending-run", "");
      setPrompt(""); await loadDetail(id); await loadOverview();
    });
  }
  const connection = overview?.connections.find(item => item.id === connectionId);
  const activeRun = detail?.runs.find(run => run.status === "queued" || run.status === "running");
  const latestRun = detail?.runs.at(-1);
  const latestRecipeDrift = agentVariantDrift(latestRun?.context.variant, context.state?.variants);
  const changedContext = !!latestRun && (!!latestRecipeDrift || selectionKey(latestRun.context.selection) !== selectionKey(selection(context)) || latestRun.context.sourceRefs.some(ref => context.state?.materials.find(item => item.id === ref.materialId)?.contentVersion !== ref.contentVersion));
  const psQuote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
  const command = pairing ? `$env:MARKER_ORIGIN = ${psQuote(location.origin)}\n$env:MARKER_BRIDGE_TOKEN = ${psQuote(pairing.token)}\nnpm run agent:bridge` : "";
  const status = (value: string) => ({ pairing: l("Por conectar", "Awaiting bridge"), connected: l("Conectado", "Connected"), offline: l("Desconectado", "Offline"), revoked: l("Revocado", "Revoked"), queued: l("En cola", "Queued"), running: l("Trabajando", "Working"), completed: l("Completado", "Completed"), failed: l("Error", "Failed"), cancelled: l("Cancelado", "Cancelled") })[value] ?? value;
  function keyboard(event: React.KeyboardEvent) {
    if (event.key === "Escape") { event.preventDefault(); onClose(); }
    if (!mobile || event.key !== "Tab") return;
    const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]') ?? []).filter(item => item.getClientRects().length > 0);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  return createPortal(<>
    {open && mobile && <div className="agents-mobile-shade" onClick={onClose} aria-hidden="true" />}
    <aside ref={panel} id="marker-agents" className="agents-panel" hidden={!open} role={mobile ? "dialog" : "complementary"} aria-modal={mobile && open ? true : undefined} aria-labelledby="agents-title" onKeyDown={keyboard}>
      <header><div><h2 id="agents-title">{l("Agentes", "Agents")}</h2><small>{l("Conecta tu asistente", "Connect your assistant")}</small></div><button ref={closeRef} type="button" onClick={onClose} aria-label={l("Cerrar agentes", "Close agents")}>×</button></header>
      <div className="agents-scroll">
        <McpConnections active={open} />
        {localDevelopment && <details className="agents-section" onToggle={event => setDeveloperOpen(event.currentTarget.open)}><summary>{l("Desarrollo · pruebas del bridge local", "Development · local bridge testing")}</summary>{developerOpen && <>
        <p>{l("Herramientas de prueba para desarrolladores. Esta conversación local requiere su propio bridge; la conexión de tu asistente se gestiona arriba.", "Developer test tools. This local conversation requires its own bridge; manage your assistant connection above.")}</p>
        {error && <ErrorNotice message={error}> <button onClick={() => void action(async () => { await loadOverview(); await loadDetail(); onStudioChange({}); })}>{l("Reconciliar estado", "Recover status")}</button></ErrorNotice>}
        {notice && <p role="status">{notice}</p>}
        <details className="agents-section" open><summary>{l("Contexto de Studio", "Studio context")} · {context.materialIds.length} {l("materiales", "materials")}</summary><dl><dt>{l("Producto", "Product")}</dt><dd>{context.productName || l("Sin selección", "None selected")}</dd><dt>{l("Campaña", "Campaign")}</dt><dd>{context.campaignName || l("Sin selección de Studio", "No Studio selection")}</dd><dt>{l("Variante", "Variant")}</dt><dd>{context.variantId ? `${context.variantId} · r${context.state?.variants.find(item => item.id === context.variantId)?.recipeRevision}` : l("Nueva / sin selección", "New / none selected")}</dd></dl>
          <ul className="agents-context-materials">{context.materials.map(item => <li key={item.id}>{item.title} · v{item.contentVersion}</li>)}</ul>
          {context.materialIds.length > 30 && <p role="alert">{l("El agente admite hasta 30 materiales por ejecución. Reduce tu selección para continuar.", "The agent accepts up to 30 materials per run. Reduce your selection to continue.")}</p>}
          {!context.state && <p>{l("Abre Space o Campañas para compartir su selección.", "Open Space or Campaigns to share its selection.")}</p>}
          {context.recipeDirty && <p>{l("Tu receta tiene cambios sin guardar. El agente lee los datos guardados; tus campos se conservan.", "Your recipe has unsaved changes. The agent reads saved data; your fields are preserved.")}</p>}
          <button type="button" onClick={() => onStudioChange({})}>{l("Actualizar datos de Studio", "Refresh Studio data")}</button>
        </details>
        <details className="agents-section" open={!connection?.available}><summary>{l("Conexión", "Connection")} · {connection ? status(connection.available ? "connected" : connection.status) : l("Sin conectar", "Not connected")}</summary>
          {overview && overview.connections.filter(item => item.status !== "revoked").length > 0 && <label className="form-field"><span>{l("Runtime", "Runtime")}</span><select value={connectionId} onChange={e => setConnectionId(e.target.value)}>{overview.connections.filter(item => item.status !== "revoked").map(item => <option key={item.id} value={item.id}>{item.name} · {status(item.available ? "connected" : item.status)}</option>)}</select></label>}
          {connection && <div className="agents-connection"><span className={`agents-status ${connection.available ? "available" : ""}`}>{status(connection.available ? "connected" : connection.status)}</span><p>OpenAI Codex · {l("bridge local", "local bridge")}</p><p>{l("Cuenta", "Account")}: {connection.accountLabel || l("Pendiente de verificar en el bridge", "Awaiting bridge verification")}</p><p>{l("Modelo", "Model")}: {connection.model || l("Lo comunica el runtime al ejecutar", "Reported by the runtime when it runs")}</p><p>{l("Facturación", "Billing")}: {connection.billingMode === "chatgpt_subscription" ? l("Suscripción de ChatGPT; límites de tu cuenta", "ChatGPT subscription; your account limits") : l("Pendiente de verificación", "Awaiting verification")}</p>{connection.capabilities.length > 0 && <small>{connection.capabilities.join(" · ")}</small>}<div className="record-actions"><button disabled={busy || !!activeRun} onClick={() => void action(async () => { await agentApi(`/connections/${encodeURIComponent(connection.id)}`, undefined, "DELETE"); setPairing(undefined); await loadOverview(); })}>{l("Desconectar", "Disconnect")}</button></div></div>}
          <p>{l("El bridge local usa Codex con tu sesión oficial de ChatGPT en este equipo. Abre marKER en localhost; sus límites dependen de tu plan.", "The local bridge uses Codex with your official ChatGPT session on this computer. Open marKER on localhost; limits depend on your plan.")}</p>
          <button disabled={busy} onClick={() => void action(async () => { const result = await agentApi<{ connection: AgentConnection; token: string }>("/connections", { name: l("Codex en mi equipo", "Codex on my computer") }); setPairing(result); setPairCopied(false); setConnectionId(result.connection.id); await loadOverview(); })}>{l("Conectar Codex", "Connect Codex")}</button>
          {pairing && <div><p>{l("En PowerShell, dentro de este proyecto local, ejecuta estos comandos. El token se muestra una sola vez; permite trabajar con esta sesión privada.", "Run these commands in PowerShell in this local project. The token is shown once; it grants access to this private session.")}</p><pre className="agents-command">{command}</pre><div className="record-actions"><button disabled={busy} onClick={() => void action(async () => { await navigator.clipboard.writeText(command); setPairCopied(true); })}>{pairCopied ? l("Copiado", "Copied") : l("Copiar comando", "Copy command")}</button><button onClick={() => setPairing(undefined)}>{l("Ocultar token", "Hide token")}</button></div><small>{l("Si Codex no tiene sesión, ejecuta codex login antes. Mantén el bridge abierto mientras trabajas.", "If Codex has no session, run codex login first. Keep the bridge running while you work.")}</small></div>}
        </details>
        <section className="agents-section"><div className="record-actions"><h3>{l("Conversaciones", "Conversations")}</h3><button disabled={busy || !!activeRun} onClick={() => void action(async () => { await createSession(); })}>{l("Nueva", "New")}</button></div><label className="form-field"><span className="sr-only">{l("Historial", "History")}</span><select value={sessionId} onChange={e => { setSessionId(e.target.value); setError(""); }}><option value="">{l("Nueva conversación", "New conversation")}</option>{overview?.sessions.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>{overview && <small>{overview.usage.todayRuns}/{overview.limits.dailyRuns} {l("ejecuciones hoy", "runs today")} · {overview.limits.maxRunSeconds}s {l("máximo por ejecución", "maximum per run")} · {l("limpieza de historial no aplicado", "unused history cleanup")} {overview.limits.retentionDays}d</small>}</section>
        {changedContext && <p className="agents-message">{latestRecipeDrift && <span>{l("La receta utilizada cambió", "The recipe used has changed")}: r{latestRecipeDrift.capturedRevision} → {latestRecipeDrift.currentRevision === undefined ? l("retirada", "removed") : `r${latestRecipeDrift.currentRevision}`}. </span>}{l("Tu selección cambió. La conversación conserva las fuentes anteriores; tu siguiente mensaje usará el contexto visible arriba.", "Your selection changed. The conversation retains its earlier sources; your next message uses the context shown above.")} {latestRun && <button disabled={busy || !!activeRun} onClick={() => { setTask(latestRun.task); setPrompt(latestRun.prompt); }}>{l("Preparar otra ejecución con este contexto", "Prepare another run with this context")}</button>}</p>}
        <div className="agents-thread">{detail?.runs.map(run => {
          const recipeDrift = agentVariantDrift(run.context.variant, context.state?.variants);
          const currentCapturedVariant = context.state?.variants.find(item => item.id === run.context.variant?.id);
          const events = detail.events.filter(item => item.runId === run.id);
          const live = progressiveAgentMessage(events.filter(item => item.type === "delta").map(item => item.text).join(""));
          const proposals = detail.proposals.filter(item => item.runId === run.id);
          return <section key={run.id}><div className="agents-message user">{run.prompt}</div><p><span className={`agents-status ${run.status === "running" ? "running" : ""}`}>{status(run.status)}</span> <small>{run.model || "Codex"} · {run.context.sourceRefs.length} {l("fuentes", "sources")} · Studio r{run.context.studioRevision}</small></p>
            {events.filter(item => item.type !== "delta").length > 0 && <details open={run.status === "queued" || run.status === "running"}><summary>{l("Actividad", "Activity")}</summary><ol className="agents-activity">{events.filter(item => item.type !== "delta").slice(-10).map(item => <li key={item.id}>{item.text}</li>)}</ol></details>}
            {live && !run.message && ["queued", "running"].includes(run.status) && !proposals.length && <p className="agents-live" aria-live="polite">{live}</p>}{run.message && <p className="agents-message">{run.message}</p>}{run.error && <ErrorNotice message={run.error} />}
            {recipeDrift && <p role="alert" className="agents-message">{l("La receta utilizada cambió", "The recipe used has changed")}: r{recipeDrift.capturedRevision} → {recipeDrift.currentRevision === undefined ? l("retirada", "removed") : `r${recipeDrift.currentRevision}`}. {l("Compara el contexto y prepara otra ejecución antes de aplicar propuestas anteriores.", "Compare the context and prepare another run before applying earlier proposals.")} <button type="button" onClick={() => onStudioChange({})}>{l("Actualizar contexto", "Refresh context")}</button> <button type="button" disabled={busy || !!activeRun} onClick={() => { setTask(run.task); setPrompt(run.prompt); }}>{l("Preparar otra ejecución con este contexto", "Prepare another run with this context")}</button></p>}
            <details><summary>{l("Comparar contexto utilizado", "Compare context used")}</summary><p>{run.context.product?.name} · {run.context.campaign?.title || l("Sin campaña", "No campaign")}</p>{run.context.variant && <p>{l("Variante", "Variant")}: {run.context.variant.id} · {l("capturada", "captured")} r{run.context.variant.recipeRevision} · {l("actual", "current")} {currentCapturedVariant ? `r${currentCapturedVariant.recipeRevision}` : context.state ? l("retirada", "removed") : l("por consultar", "awaiting snapshot")}</p>}{run.context.materials.map(material => <div key={material.id}><p>{material.title} · v{material.contentVersion}</p>{material.text && <p className="agents-live">{material.text}</p>}</div>)}</details>
            {(run.status === "running" || run.status === "queued") && <button disabled={busy || run.cancelRequested} onClick={() => void action(async () => { await agentApi(`/runs/${encodeURIComponent(run.id)}/cancel`, {}); await loadDetail(); })}>{run.cancelRequested ? l("Cancelación solicitada", "Cancellation requested") : l("Cancelar ejecución", "Cancel run")}</button>}
            {proposals.map(proposal => <Proposal key={proposal.id} capturedVariant={run.context.variant} active={developerActive} proposal={proposal} context={context} workspace={workspace} onReload={() => loadDetail()} onStudioChange={onStudioChange} onOpenStudio={onOpenStudio} />)}
          </section>;
        })}</div>
        {!detail?.runs.length && <p>{l("Pide tres propuestas con gancho, mensaje y llamada a la acción. Puedes editar cada campo antes de guardarlo en Studio.", "Ask for three proposals with a hook, message and call to action. Edit each field before saving it to Studio.")}</p>}
        <form className="agents-composer" onSubmit={event => void submit(event)}><label className="form-field"><span>{l("Función", "Role")}</span><select value={task} onChange={e => setTask(e.target.value as typeof task)}><option value="copy">{l("Redactar propuestas", "Write proposals")}</option><option value="assembly">{l("Preparar montaje", "Prepare assembly")}</option><option value="review">{l("Revisar contenido", "Review content")}</option></select></label><label className="form-field"><span>{l("Mensaje", "Message")}</span><textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={4} maxLength={8000} placeholder={l("Con estos materiales, prepara tres propuestas. Tono directo, buen hook y llamada a la acción clara.", "With these materials, prepare three proposals. Direct tone, a strong hook and a clear call to action.")} /></label><div className="record-actions"><button className="primary" disabled={busy || !connection?.available || !!activeRun || !prompt.trim() || !context.state || context.materialIds.length > 30}>{l("Enviar al agente", "Send to agent")}</button>{!connection?.available && <small>{l("Conecta un bridge disponible para comenzar.", "Connect an available bridge to begin.")}</small>}</div></form>
        </>}</details>}
      </div>
      <Help topic="agents" />
    </aside>
  </>, document.body);
}

function Proposal({ active, capturedVariant, proposal, context, workspace, onReload, onStudioChange, onOpenStudio }: { active: boolean; capturedVariant?: StudioVariant; proposal: AgentProposal; context: StudioAgentContext; workspace: Workspace; onReload: () => Promise<void>; onStudioChange: Props["onStudioChange"]; onOpenStudio: () => void }) {
  const { language } = useLanguage();
  const l = (es: string, en: string) => language === "es" ? es : en;
  const key = `marker-agent-copy:${proposal.id}`;
  const copy = ({ title, hook, body, cta }: AgentCopy): AgentCopy => ({ title, hook, body, cta });
  const [draft, setDraft] = useState<AgentCopy>(() => { try { const saved = JSON.parse(readStored(key) || "null"); if (saved && ["title", "hook", "body", "cta"].every(item => typeof saved[item] === "string")) return saved; } catch { /* Use the persisted proposal. */ } return copy(proposal); });
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [rights, setRights] = useState<"unknown" | "owned" | "licensed">("unknown");
  const [reviewed, setReviewed] = useState(false), [ready, setReady] = useState(false), [plannerOpen, setPlannerOpen] = useState(false);
  type Production = { variant: StudioVariant; jobs: Array<{ id: string; variantId: string; recipeRevision: number; status: string; error?: string }> };
  const [production, setProduction] = useState<Production>();
  const [productionRefresh, setProductionRefresh] = useState(0);
  const savedVariant = context.state?.variants.find(item => item.id === proposal.variantId);
  useEffect(() => {
    if (!active || !proposal.variantId) return;
    let current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function refreshProduction() {
      try {
        const result = await agentApi<Production>(`/proposals/${encodeURIComponent(proposal.id)}/production`);
        if (!current) return;
        setProduction(result);
        if (result.jobs.some(job => job.recipeRevision === result.variant.recipeRevision && ["queued", "running"].includes(job.status))) timer = setTimeout(() => void refreshProduction(), 1600);
      } catch (e) { if (current) setError((e as Error).message); }
    }
    void refreshProduction();
    return () => { current = false; clearTimeout(timer); };
  }, [active, proposal.id, proposal.variantId, proposal.renderJobId, savedVariant?.recipeRevision, savedVariant?.status, productionRefresh]);
  const [campaignId, setCampaignId] = useState(proposal.campaignId || context.campaignId || "");
  const state = context.state;
  const campaign = state?.campaigns.find(item => item.id === campaignId);
  const dirty = JSON.stringify(draft) !== JSON.stringify(copy(proposal));
  const outdatedRecipe = proposal.status !== "saved" && !!agentVariantDrift(capturedVariant, state?.variants);
  const changedSources = !!state && proposal.sourceRefs.some(ref => state.materials.find(item => item.id === ref.materialId)?.contentVersion !== ref.contentVersion);
  useEffect(() => { if (dirty) store(key, JSON.stringify(draft)); else store(key, ""); }, [draft, dirty, key]);
  async function perform(operation: () => Promise<void>) { if (busy) return; setBusy(true); setError(""); setMessage(""); try { await operation(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  async function saveEdits() { const result = await agentApi<{ proposal: AgentProposal }>(`/proposals/${encodeURIComponent(proposal.id)}/edit`, draft); setDraft(copy(result.proposal)); store(key, ""); await onReload(); }
  const field = (label: string, name: keyof AgentCopy, max: number, multiline = false) => <label className="form-field"><span>{label}</span>{multiline ? <textarea rows={5} maxLength={max} value={draft[name]} disabled={proposal.status === "saved"} onChange={e => setDraft(current => ({ ...current, [name]: e.target.value }))} /> : <input maxLength={max} value={draft[name]} disabled={proposal.status === "saved"} onChange={e => setDraft(current => ({ ...current, [name]: e.target.value }))} />}</label>;
  const variant = production?.variant ?? savedVariant;
  const currentJob = variant ? production?.jobs.find(job => job.recipeRevision === variant.recipeRevision) ?? (variant.id === context.variantId ? context.job : undefined) : undefined;
  const outputStatus = variant?.status === "approved" && proposal.exportedRecipeRevision === variant.recipeRevision ? l("Exportado", "Exported") : variant?.status === "approved" ? l("Aprobado", "Approved") : variant && (variant.template === "text" || currentJob?.status === "completed") ? l("Listo para revisar", "Ready for review") : variant && ["queued", "running"].includes(currentJob?.status || "") ? l("Renderizando", "Rendering") : variant ? l("Variante guardada", "Variant saved") : proposal.status === "saved" ? l("Guardado en Studio", "Saved to Studio") : dirty || proposal.status === "edited" ? l("Editado", "Edited") : l("Propuesto", "Proposed");
  return <article className="agents-proposal"><p><span className="agents-status">{outputStatus}</span> <small>{proposal.model} · {proposal.sourceRefs.length} {l("fuentes", "sources")}</small></p><div className="editor-fields">{field(l("Título", "Title"), "title", 160)}{field(l("Gancho", "Hook"), "hook", 240)}{field(l("Mensaje", "Message"), "body", 20000, true)}{field(l("Llamada a la acción", "Call to action"), "cta", 240)}</div>
    <details><summary>{l("Procedencia", "Provenance")}</summary><p>Studio r{proposal.studioRevision} · {proposal.productId || l("Sin producto", "No product")}</p>{proposal.sourceRefs.map(ref => <p key={ref.materialId}>{state?.materials.find(item => item.id === ref.materialId)?.title || ref.materialId} · v{ref.contentVersion}</p>)}</details>
    {changedSources && <p role="alert">{l("Una fuente cambió o ya no existe. Actualiza el contexto y solicita otra propuesta antes de aplicarla.", "A source changed or no longer exists. Update the context and request another proposal before applying it.")}</p>}
    {error && <ErrorNotice message={error}> <button disabled={busy} onClick={() => { onStudioChange({}); void onReload(); }}>{l("Actualizar y recuperar", "Refresh and recover")}</button></ErrorNotice>}{message && <p role="status">{message}</p>}
    {proposal.status !== "saved" && <><div className="record-actions"><button disabled={busy || !dirty || !draft.body.trim()} onClick={() => void perform(saveEdits)}>{l("Guardar edición", "Save edits")}</button></div><label className="form-field"><span>{l("Derechos del texto generado", "Rights for the generated text")}</span><select value={rights} onChange={e => setRights(e.target.value as typeof rights)}><option value="unknown">{l("Por verificar", "To verify")}</option><option value="owned">{l("Puedo usarlo como propio", "I can use it as my own")}</option><option value="licensed">{l("Licencia revisada", "License reviewed")}</option></select></label><label className="studio-confirm"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />{l("Revisé los hechos, el texto y sus derechos.", "I reviewed the facts, text and its rights.")}</label><label className="studio-confirm"><input type="checkbox" checked={ready} onChange={e => setReady(e.target.checked)} disabled={!reviewed || rights === "unknown"} />{l("Marcar listo para el planner", "Mark ready for the planner")}</label><button className="primary" disabled={busy || !state || changedSources || outdatedRecipe || !reviewed || !draft.body.trim()} onClick={() => void perform(async () => { if (dirty) await saveEdits(); const result = await agentApi<{ proposal: AgentProposal; state: StudioState; materialId: string }>(`/proposals/${encodeURIComponent(proposal.id)}/apply`, { expectedStudioRevision: state!.revision, rights, review: ready && rights !== "unknown" ? "ready" : "unreviewed" }); store(key, ""); onStudioChange({ materialId: result.materialId }); await onReload(); setMessage(l("Material de texto guardado. Su revisión y sus derechos se conservan en Studio.", "Text material saved. Its review and rights are preserved in Studio.")); })}>{l("Guardar como material de Studio", "Save as Studio material")}</button></>}
    {proposal.status === "saved" && <><p>{l("Texto guardado", "Saved text")}: {proposal.materialId}</p><button disabled={busy || !state} onClick={() => setPlannerOpen(value => !value)} aria-expanded={plannerOpen}>{l("Preparar pieza en el planner", "Prepare a piece in the planner")}</button></>}
    {plannerOpen && state && <div><label className="form-field"><span>{l("Campaña de Studio", "Studio campaign")}</span><select value={campaignId} onChange={e => setCampaignId(e.target.value)}><option value="">{l("Elige una campaña", "Choose a campaign")}</option>{state.campaigns.filter(item => !proposal.productId || item.productId === proposal.productId).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>{!campaign && <button onClick={onOpenStudio}>{l("Crear o abrir campaña en Studio", "Create or open a campaign in Studio")}</button>}{campaign && <StudioPlanner key={`agent:${proposal.id}:${campaign.id}:${proposal.variantId ?? "new"}`} state={state} workspace={workspace} campaign={campaign} variant={variant} initialCandidateIds={[...new Set([...proposal.sourceRefs.map(ref => ref.materialId), ...(proposal.materialId ? [proposal.materialId] : [])])]} draftNamespace={`agent:${proposal.id}`} initialRequest={{ hook: proposal.hook, body: state.materials.find(item => item.id === proposal.materialId)?.text || proposal.body, cta: proposal.cta, textSourceId: proposal.materialId, includeShared: true }} recipeDirty={context.recipeDirty ?? false} busy={busy || changedSources} onAnalysisChoiceUsed={() => {}} onPropose={async request => { const result = await agentApi<StudioPlanResult>(`/proposals/${encodeURIComponent(proposal.id)}/plan`, { request }); await onReload(); return result; }} onApply={async (request: StudioPlanInput, fingerprint, alternative, revision) => { const result = await agentApi<{ proposal: AgentProposal; state: StudioState; variantId: string }>(`/proposals/${encodeURIComponent(proposal.id)}/apply-plan`, { request, fingerprint, alternative, expectedStudioRevision: revision }); onStudioChange({ campaignId: campaign.id, variantId: result.variantId }); await onReload(); setMessage(l("Variante guardada. Continúa por vista previa, revisión, aprobación y exportación de Studio.", "Variant saved. Continue through Studio preview, review, approval and export.")); }} />}</div>}
    {variant && <section aria-label={l("Producción de la variante", "Variant production")}><h3>{l("Producción", "Production")} · r{variant.recipeRevision}</h3>
      {variant.template !== "text" && <button disabled={busy || context.busy || context.recipeDirty || ["queued", "running", "completed"].includes(currentJob?.status || "")} onClick={() => void perform(async () => {
        if (context.busy || context.recipeDirty) return;
        await agentApi(`/proposals/${encodeURIComponent(proposal.id)}/render`, { recipeRevision: variant.recipeRevision });
        setProductionRefresh(value => value + 1); onStudioChange({}); await onReload();
      })}>{busy ? l("Solicitando render…", "Requesting render…") : l("Renderizar variante guardada", "Render saved variant")}</button>}
      {(context.recipeDirty || context.busy) && <p>{l("Termina y guarda tu trabajo en Studio antes de producir o exportar.", "Finish and save your Studio work before rendering or exporting.")}</p>}
      {currentJob && <p role="status">{l("Render", "Render")}: {({ queued: l("En cola", "Queued"), running: l("Renderizando", "Rendering"), completed: l("Listo para revisar", "Ready for review"), failed: l("Error", "Failed") })[currentJob.status] || currentJob.status} {currentJob.error}</p>}
      {currentJob?.status === "completed" && variant.template !== "text" && <video className="studio-render-preview" style={{ width: "100%" }} controls preload="metadata" poster={`/api/studio/jobs/${encodeURIComponent(currentJob.id)}/cover`} src={`/api/studio/jobs/${encodeURIComponent(currentJob.id)}/video`} />}
      <button disabled={busy} onClick={() => setProductionRefresh(value => value + 1)}>{l("Actualizar producción", "Refresh production")}</button>
      <p>{l("Revisa el resultado y aprueba esta versión en Studio antes de exportar.", "Review the result and approve this version in Studio before exporting.")}</p>
    </section>}
    {variant?.status === "approved" && !context.recipeDirty && !context.busy && <a className="button-link" href={`/api/agents/proposals/${encodeURIComponent(proposal.id)}/export`} download>{l("Exportar pieza aprobada", "Export approved piece")}</a>}
    {proposal.variantId && <button onClick={() => { onStudioChange({ campaignId: campaignId || proposal.campaignId, variantId: proposal.variantId }); onOpenStudio(); }}>{l("Abrir variante · renderizar, revisar y exportar", "Open variant · render, review and export")}</button>}
  </article>;
}
