import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ErrorNotice } from "./ErrorNotice";
import { platforms, type Workspace } from "../core/domain";
import type { StudioState, StudioMaterial, StudioVariant } from "../core/studio";
import type { StudioPlanInput, StudioPlanResult } from "../core/studio-planner";
import { useLanguage } from "../i18n";
import StudioPlanner from "./StudioPlanner";
import StudioAnalysis from "./StudioAnalysis";
import "./studio.css";
import type { StudioAgentContext, AgentStudioUpdate } from "./agent-context";

type Job = { id: string; variantId: string; recipeRevision: number; status: string; error?: string; sourceRefs?: Array<{ materialId: string; contentVersion: number; assetId?: string }> };
type Result = { state: StudioState; jobs: Job[]; usage?: Record<string, number>; uploads: Array<Upload & { name: string; size: number }>; capabilities: { local: boolean; render: boolean; analysis?: boolean; analysisCents?: number; defaultDurationSeconds?: number; maxFileBytes: number; maxChunkBytes: number; monthlyBudgetCents?: number; monthlyUsedCents?: number; storageBytes?: number; maxStorageBytes?: number } };
type Upload = { id: string; offset: number; status: string };
const categories = ["broll", "talking", "demo", "photo", "voice", "idea", "ready-text", "testimonial"];
const roles = ["background", "narration", "message", "hook", "cta"];
const comma = (value: unknown) => String(value ?? "").split(",").map(x => x.trim()).filter(Boolean);
const assetUrl = (id: string) => `/api/studio/assets/${encodeURIComponent(id)}`;
function DraftForm({ draftKey, baseRevision, onDirty, onSubmit, className, children }: { draftKey: string; baseRevision?: number; onDirty?: (dirty: boolean) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; className: string; children: ReactNode }) {
  const ref = useRef<HTMLFormElement>(null);
  const savedRevision = useRef(baseRevision);
  const [conflict, setConflict] = useState(false);
  const [override, setOverride] = useState(false);
  const { language } = useLanguage();
  useEffect(() => {
    onDirty?.(false);
    try {
      const saved = sessionStorage.getItem(draftKey);
      if (!saved || !ref.current) return;
      const stored = JSON.parse(saved) as { values: Record<string, string[]>; baseRevision?: number };
      const values = stored.values;
      savedRevision.current = stored.baseRevision;
      setConflict(stored.baseRevision !== undefined && baseRevision !== undefined && stored.baseRevision !== baseRevision);
      for (const element of Array.from(ref.current.elements)) {
        if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) || !element.name) continue;
        if (element instanceof HTMLInputElement && ["checkbox", "radio"].includes(element.type)) element.checked = (values[element.name] ?? []).includes(element.value);
        else if (values[element.name]) element.value = values[element.name][0] ?? "";
      }
      onDirty?.(true);
    } catch { /* Browser storage is optional; the visible form stays usable. */ }
  }, [draftKey]);
  return <form ref={ref} className={className} onSubmit={event => { if (conflict && !override) { event.preventDefault(); return; } onSubmit(event); }} onChange={event => {
    if (!(event.target instanceof HTMLElement) || !event.target.getAttribute("name")) return;
    onDirty?.(true);
    if (!ref.current) return;
    const values: Record<string, string[]> = {};
    for (const [key, value] of new FormData(ref.current)) if (typeof value === "string") (values[key] ??= []).push(value);
    try { sessionStorage.setItem(draftKey, JSON.stringify({ baseRevision: savedRevision.current, values })); } catch { /* No silent server write. */ }
  }}>{conflict && <p role="alert">{language === "es" ? "Recuperamos tu edición local de una versión anterior. Compara el mensaje con la vista previa guardada antes de guardar." : "Your local edit from an earlier version was recovered. Compare it with the saved preview before saving."}<label className="studio-confirm"><input type="checkbox" checked={override} onChange={e => setOverride(e.target.checked)} required />{language === "es" ? "Confirmo guardar mi edición sobre la versión actual." : "I confirm saving my edit over the current version."}</label></p>}{children}</form>;
}
async function api<T>(path = "", body?: unknown, method = "POST"): Promise<T> {
  const res = await fetch(`/api/studio${path}`, body === undefined ? undefined : {
    method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as T;
}
export default function Studio({ view, workspace, onRecordingChange, onOpenCampaigns, onContext, agentUpdate }: { view: "space" | "campaigns"; workspace: Workspace; onRecordingChange: (active: boolean) => void; onOpenCampaigns?: () => void; onContext?: (context: StudioAgentContext) => void; agentUpdate?: AgentStudioUpdate }) {
  const { language } = useLanguage();
  const l = (es: string, en: string) => language === "es" ? es : en;
  const categoryLabels = [l("B-roll", "B-roll"), l("Hablando a cámara", "Talking to camera"), l("Demo de producto", "Product demo"), l("Foto", "Photo"), l("Nota de voz", "Voice note"), l("Idea", "Idea"), l("Texto listo", "Ready text"), l("Testimonio propio", "Own testimonial")];
  const roleLabels = [l("Fondo visual", "Visual background"), l("Narración", "Narration"), l("Mensaje principal", "Main message"), l("Gancho", "Hook"), l("Llamada a la acción", "Call to action")];
  const [result, setResult] = useState<Result>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [storedSelection] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("marker-studio-selection") ?? "null") as { product?: string; captureProduct?: string; campaignId?: string; variantId?: string; materialIds?: string[] } | null; } catch { return null; }
  });
  const [search, setSearch] = useState("");
  const [product, setProduct] = useState(storedSelection?.product ?? "");
  const [category, setCategory] = useState("");
  const [review, setReview] = useState("");
  const [sourceSearch, setSourceSearch] = useState("");
  const [sourceCategory, setSourceCategory] = useState("");
  const [editing, setEditing] = useState<StudioMaterial>();
  const [capturing, setCapturing] = useState(false);
  const [captureCategory, setCaptureCategory] = useState("");
  const [captureProduct, setCaptureProduct] = useState(storedSelection?.captureProduct ?? "");
  const [campaignId, setCampaignId] = useState(storedSelection?.campaignId ?? "");
  const [variantId, setVariantId] = useState(storedSelection?.variantId ?? "");
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>(() => Array.isArray(storedSelection?.materialIds) ? storedSelection.materialIds.filter(id => typeof id === "string").slice(0, 50) : []);
  const [recipeSources, setRecipeSources] = useState<string[] | undefined>();
  const [selectionIntent, setSelectionIntent] = useState<string[] | undefined>();
  useEffect(() => { try { sessionStorage.setItem("marker-studio-selection", JSON.stringify({ product, captureProduct, campaignId, variantId, materialIds: selectedMaterials })); } catch { /* Selection remains available in the mounted Studio. */ } }, [product, captureProduct, campaignId, variantId, selectedMaterials]);
  const [regenerate, setRegenerate] = useState(false);
  const [analysisActive, setAnalysisActive] = useState(false);
  const [analysisChoice, setAnalysisChoice] = useState<{ analysisId: string; assetId: string; start: number; end: number }>();
  const [recorderActive, setRecorderActive] = useState(false);
  const [pendingRecording, setPendingRecording] = useState<File>();
  const [recordingUrl, setRecordingUrl] = useState("");
  useEffect(() => { if (!pendingRecording) { setRecordingUrl(""); return; } const url = URL.createObjectURL(pendingRecording); setRecordingUrl(url); return () => URL.revokeObjectURL(url); }, [pendingRecording]);
  useEffect(() => {
    onRecordingChange(recorderActive || !!pendingRecording);
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    if (recorderActive || pendingRecording) window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [recorderActive, pendingRecording, onRecordingChange]);
  const [recipeDirty, setRecipeDirty] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const recordingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [uploadKey, setUploadKey] = useState(0);
  const state = result?.state;
  useEffect(() => { setRegenerate(false); }, [variantId, state?.revision]);
  async function refresh() { const next = await api<Result>(); setResult(next); return next; }
  useEffect(() => { void refresh().catch(e => setError(e.message)); return () => { clearTimeout(recordingTimer.current); const r = recorder.current; if (r) { r.onstop = null; if (r.state !== "inactive") r.stop(); r.stream.getTracks().forEach(t => t.stop()); } }; }, []);
  useEffect(() => {
    if (!agentUpdate) return;
    let active = true;
    void refresh().then(() => {
      if (!active) return;
      if (agentUpdate.materialId) {
        setSelectedMaterials(ids => [...new Set([...ids, agentUpdate.materialId!])].slice(0, 50));
        setRecipeSources(ids => ids ? [...new Set([...ids, agentUpdate.materialId!])].slice(0, 50) : undefined);
      }
      if (agentUpdate.campaignId) setCampaignId(agentUpdate.campaignId);
      if (agentUpdate.variantId) { setVariantId(agentUpdate.variantId); setRecipeSources(undefined); }
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [agentUpdate?.nonce]);
  useEffect(() => { setRecipeSources(undefined); }, [variantId, campaignId]);
  useEffect(() => {
    if (!state) return;
    const campaign = state.campaigns.find(item => item.id === campaignId);
    const variant = state.variants.find(item => item.id === variantId && item.campaignId === campaignId);
    const productId = view === "campaigns" ? campaign?.productId : product && product !== "shared" ? product : captureProduct || undefined;
    const materialIds = view === "space" ? selectedMaterials : recipeSources ?? (variant?.sourceIds ?? selectedMaterials);
    onContext?.({ productId, campaignId: view === "campaigns" ? campaign?.id : undefined, variantId: view === "campaigns" ? variant?.id : undefined,
      materialIds: materialIds.filter(id => state.materials.some(item => item.id === id)), studioRevision: state.revision,
      productName: workspace.products.find(item => item.id === productId)?.name, campaignName: view === "campaigns" ? campaign?.title : undefined,
      materials: state.materials.filter(item => materialIds.includes(item.id)).map(({ id, title, contentVersion }) => ({ id, title, contentVersion })),
      state, recipeDirty, busy: busy || recorderActive || !!pendingRecording || analysisActive, job: variant ? result?.jobs.find(item => item.variantId === variant.id && item.recipeRevision === variant.recipeRevision) : undefined });
  }, [state, result?.jobs, workspace.products, view, product, captureProduct, campaignId, variantId, selectedMaterials, recipeSources, recipeDirty, busy, recorderActive, pendingRecording, analysisActive, onContext]);
  const activeJob = result?.jobs.some(j => ["queued", "running"].includes(j.status));
  useEffect(() => {
    if (!activeJob) return;
    const interval = setInterval(() => { void refresh().catch(e => setError(e.message)); }, 1600);
    return () => clearInterval(interval);
  }, [activeJob]);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    if (recorder.current?.state === "recording") { setError(l("Detén y guarda la grabación primero.", "Stop and save the recording first.")); return; }
    setBusy(true); setError(""); setNotice("");
    try { await action(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); setProgress(0); }
  }
  async function command(type: string, data: unknown) {
    if (!state) throw new Error("Studio unavailable");
    const next = await api<{ state: StudioState }>("/commands", { expectedRevision: state.revision, command: { type, data } });
    setResult(r => r ? { ...r, state: next.state } : r);
    return next.state;
  }
  const field = (label: string, children: ReactNode, wide = false) => <label className={`form-field${wide ? " wide" : ""}`}><span>{label}</span>{children}</label>;
  async function upload(file: File) {
    if (analysisActive) throw new Error(l("Espera a que termine el análisis antes de subir otro original.", "Wait for analysis to finish before uploading another original."));
    if (!result || !file.size) throw new Error(l("Archivo vacío.", "Empty file."));
    if (file.size > result.capabilities.maxFileBytes) throw new Error(l("Máximo 250 MB por archivo.", "Maximum 250 MB per file."));
    const key = `marker-upload:${file.name}:${file.size}:${file.lastModified}`;
    let session: Upload;
    const remembered = localStorage.getItem(key);
    try { session = remembered ? (await api<{ upload: Upload }>(`/uploads/${remembered}`)).upload : (await api<{ upload: Upload }>("/uploads", { name: file.name, mime: file.type, size: file.size })).upload; }
    catch (e) { localStorage.removeItem(key); throw e; }
    localStorage.setItem(key, session.id);
    while (session.offset < file.size) {
      const end = Math.min(file.size, session.offset + Math.min(result.capabilities.maxChunkBytes, 8 * 1024 * 1024));
      const response = await fetch(`/api/studio/uploads/${session.id}`, { method: "PUT", headers: { "Content-Type": "application/octet-stream", "Upload-Offset": String(session.offset) }, body: file.slice(session.offset, end) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      session = data.upload; setProgress(Math.round(100 * session.offset / file.size));
    }
    const completed = await api<{ state: StudioState; asset: StudioState["assets"][number]; duplicate: boolean }>(`/uploads/${session.id}/complete`, {});
    localStorage.removeItem(key);
    const materialResult = await api<{ state: StudioState }>("/commands", {
      expectedRevision: completed.state.revision,
      command: { type: "material.save", data: { title: file.name.slice(0, 160), kind: completed.asset.kind, assetId: completed.asset.id, categories: captureCategory ? [captureCategory] : [], productIds: captureProduct ? [captureProduct] : [], topics: [], roles: [], review: "unreviewed", speech: "unknown", rights: "unknown" } },
    });
    setResult(r => r ? { ...r, state: materialResult.state } : r);
    setNotice(l("Material guardado.", "Material saved."));
    setUploadKey(x => x + 1);
    await refresh();
  }
  async function record() {
    if (recorderActive) { recorder.current?.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error(l("Este navegador no admite grabación. Sube un audio.", "Recording unavailable in this browser. Upload audio instead."));
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find(x => MediaRecorder.isTypeSupported(x));
    let instance: MediaRecorder;
    try { instance = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); } catch (e) { stream.getTracks().forEach(t => t.stop()); throw e; }
    const chunks: BlobPart[] = []; let size = 0;
    instance.ondataavailable = e => { if (e.data.size) { chunks.push(e.data); size += e.data.size; if (size > 24 * 1024 * 1024 && instance.state !== "inactive") instance.stop(); } };
    instance.onstop = () => {
      clearTimeout(recordingTimer.current); stream.getTracks().forEach(t => t.stop()); setRecorderActive(false); recorder.current = null;
      const blob = new Blob(chunks, { type: instance.mimeType });
      const extension = instance.mimeType.includes("mp4") ? "m4a" : instance.mimeType.includes("ogg") ? "ogg" : "webm";
      const file = new File([blob], `voice-${Date.now()}.${extension}`, { type: blob.type });
      setPendingRecording(file);
      void run(async () => { await upload(file); setPendingRecording(undefined); });
    };
    recorder.current = instance; instance.start(1000); setRecorderActive(true);
    recordingTimer.current = setTimeout(() => { if (instance.state !== "inactive") instance.stop(); }, 120_000);
  }
  function saveMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    void run(async () => {
      await command("material.save", { id: editing?.id, assetId: editing?.assetId,
        kind: editing?.kind ?? data.get("kind"), title: data.get("title"), text: data.get("text"),
        productIds: data.getAll("products"), categories: data.getAll("categories"), topics: comma(data.get("topics")), roles: data.getAll("roles"),
        review: data.get("review") ?? "unreviewed", speech: data.get("speech") ?? "unknown", rights: data.get("rights") ?? "unknown", description: data.get("description"), restrictions: data.get("restrictions"),
        usefulStart: data.get("usefulStart") ? Number(data.get("usefulStart")) : undefined, usefulEnd: data.get("usefulEnd") ? Number(data.get("usefulEnd")) : undefined,
      }); sessionStorage.removeItem(`marker-material:${editing?.id ?? "new"}`); setEditing(undefined); setCapturing(false); setNotice(l("Material guardado.", "Material saved."));
    });
  }
  if (!state) return <section className="surface"><p role={error ? "alert" : "status"}>{error || l("Abriendo biblioteca…", "Opening library…")}</p></section>;
  const campaign = state.campaigns.find(c => c.id === campaignId);
  const variant = state.variants.find(v => v.id === variantId && v.campaignId === campaignId);
  const recipeKey = `marker-recipe:${campaignId}:${variant?.id ?? "new"}`;
  const currentJob = variant ? result!.jobs.find(j => j.variantId === variant.id && j.recipeRevision === variant.recipeRevision) : undefined;
  const compatible = state.materials.filter(m => !campaign || !m.productIds.length || m.productIds.includes(campaign.productId));
  const visibleSources = compatible.filter(m => (!sourceSearch || `${m.title} ${m.description} ${m.topics.join(" ")}`.toLowerCase().includes(sourceSearch.toLowerCase())) && (!sourceCategory || m.categories.includes(sourceCategory as never)) || !!variant?.sourceIds.includes(m.id));
  const useCount = (id: string) => result!.usage?.[id] ?? new Set([...state.variants.filter(v => v.sourceIds.includes(id) || v.narrationId === id).map(v => v.id), ...result!.jobs.filter(j => j.status === "completed" && j.sourceRefs?.some(ref => ref.materialId === id)).map(j => j.variantId)]).size;
  const filtered = state.materials.filter(m => (!search || `${m.title} ${m.text} ${m.description} ${m.topics.join(" ")}`.toLowerCase().includes(search.toLowerCase())) && (!product || (product === "shared" ? !m.productIds.length : m.productIds.includes(product))) && (!category || m.categories.includes(category as never)) && (!review || (review === "used" ? useCount(m.id) > 0 : m.review === review)));
  const rangeField = (kind: "start" | "end", id: string, index: number) => `${kind}:${id}${index ? `:${index}` : ""}`;
  function variantForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); const ids = data.getAll("sources").map(String);
    const visualIds = ids.filter(id => { const material = state!.materials.find(m => m.id === id); return material?.kind === "video" || material?.kind === "image"; });
    const retained = variant?.selections.filter(s => visualIds.includes(s.materialId)) ?? [];
    const ordered = [...retained, ...visualIds.filter(id => !retained.some(s => s.materialId === id)).map(materialId => ({ materialId, start: 0, end: 0 }))];
    const indices = new Map<string, number>();
    const selections = ordered.map(s => { const index = indices.get(s.materialId) ?? 0; indices.set(s.materialId, index + 1); return { materialId: s.materialId, start: Number(data.get(rangeField("start", s.materialId, index)) || 0), end: Number(data.get(rangeField("end", s.materialId, index)) || 0) }; });
    void run(async () => {
      const next = await command("variant.save", { id: variant?.id, campaignId, platform: data.get("platform"), template: data.get("template"),
        hook: data.get("hook"), body: data.get("body"), cta: data.get("cta"), duration: Number(data.get("duration")), fit: data.get("fit"), focusX: Number(data.get("focusX")), focusY: Number(data.get("focusY")), audio: data.get("audio"), narrationId: data.get("narrationId") || undefined,
        sourceIds: ids, selections,
        refreshSources: data.get("refreshSources") === "on",
      }); sessionStorage.removeItem(recipeKey); setRecipeDirty(false); setVariantId(variant?.id ?? next.variants.at(-1)!.id); setNotice(l("Receta guardada. Genera una nueva vista previa.", "Recipe saved. Generate a new preview."));
    });
  }
  async function applyPlan(request: StudioPlanInput, fingerprint: string, alternative: number, revision: number) {
    if (busy) throw new Error(l("Espera a que termine la operación actual.", "Wait for the current operation to finish."));
    setBusy(true); setError("");
    try {
      const next = await api<{ state: StudioState }>("/commands", { expectedRevision: revision, command: { type: "variant.plan", data: { id: variant?.id, request, fingerprint, alternative } } });
      sessionStorage.removeItem(recipeKey); setRecipeDirty(false);
      setResult(r => r ? { ...r, state: next.state } : r);
      setVariantId(variant?.id ?? next.state.variants.at(-1)!.id);
      setSelectedMaterials([]); setNotice(l("Propuesta guardada como borrador editable. Revisa y genera cuando quieras.", "Proposal saved as an editable draft. Review and generate when ready."));
    } finally { setBusy(false); }
  }
  return <div className="studio">
    <p className="studio-scope">{result!.capabilities.local ? l("Estudio local · archivos en este equipo · publicación manual", "Local studio · files on this computer · manual publishing") : l("Estudio privado · originales y montaje remoto · publicación manual", "Private studio · originals and remote assembly · manual publishing")}</p>
    {!result!.capabilities.local && result!.capabilities.monthlyBudgetCents !== undefined && <p className="studio-hint">{l("Reserva de procesamiento del mes", "Monthly processing reservation")}: US${((result!.capabilities.monthlyUsedCents ?? 0) / 100).toFixed(2)} / US${(result!.capabilities.monthlyBudgetCents / 100).toFixed(2)} · {l("Almacenamiento", "Storage")}: {((result!.capabilities.storageBytes ?? 0) / 1024 ** 3).toFixed(2)} / {((result!.capabilities.maxStorageBytes ?? 0) / 1024 ** 3).toFixed(0)} GiB</p>}
    {error && <ErrorNotice message={error}> <button type="button" onClick={() => void run(async () => { await refresh(); })}>{l("Actualizar estado", "Refresh state")}</button></ErrorNotice>}
    {notice && <p role="status" className="success-message">{notice}</p>}
    {busy && <p role="status">{progress ? `${l("Subiendo", "Uploading")} ${progress}%` : l("Procesando…", "Processing…")}</p>}
    {view === "space" ? <>
      <section className="surface studio-capture">
        <h2>{l("Captura ahora. Ordena después.", "Capture now. Organize later.")}</h2>
        <div className="editor-fields">
          {field(l("Clasificación rápida (opcional)", "Quick classification (optional)"), <select value={captureCategory} onChange={e => setCaptureCategory(e.target.value)}><option value="">{l("Automática", "Automatic")}</option>{categories.map((x, i) => <option key={x} value={x}>{categoryLabels[i]}</option>)}</select>)}
          {field(l("Producto (opcional)", "Product (optional)"), <select value={captureProduct} onChange={e => setCaptureProduct(e.target.value)}><option value="">{l("Compartido / sin asignar", "Shared / unassigned")}</option>{workspace.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>)}
        </div>
        <div className="record-actions">
          <label className="studio-file-button">{l("Subir video, foto o audio", "Upload video, photo or audio")}<input key={uploadKey} type="file" accept="video/*,image/*,audio/*,.mov,.m4a,.heic" disabled={busy || recorderActive || analysisActive} onChange={e => { const file = e.target.files?.[0]; e.currentTarget.value = ""; if (file) void run(() => upload(file)); }} /></label>
          <button disabled={busy} onClick={() => { setEditing(undefined); setCapturing(true); }}>{l("Escribir idea o texto", "Write idea or text")}</button>
          <button disabled={busy || !!pendingRecording || analysisActive} onClick={() => { void record().catch(e => setError(e.message)); }}>{recorderActive ? l("Detener y guardar audio", "Stop and save audio") : l("Grabar nota de voz", "Record voice note")}</button>
        </div>
        <p className="studio-hint">{l("250 MB por archivo. Si se interrumpe, elige de nuevo el mismo archivo para reanudar. Audio: máximo 2 minutos. Mantén abierta esta pestaña.", "250 MB per file. If interrupted, select the same file again to resume. Audio: up to 2 minutes. Keep this tab open.")}</p>
        {pendingRecording && <div role="status"><p>{l("Grabación local pendiente de guardar. Puedes reintentar o descargar una copia antes de salir.", "Local recording awaiting save. Retry or download a copy before leaving.")}</p><div className="record-actions"><button disabled={busy} onClick={() => void run(async () => { await upload(pendingRecording); setPendingRecording(undefined); })}>{l("Reintentar guardar audio", "Retry saving audio")}</button><a href={recordingUrl} download={pendingRecording.name}>{l("Descargar grabación", "Download recording")}</a><button disabled={busy} onClick={() => setPendingRecording(undefined)}>{l("Descartar grabación local", "Discard local recording")}</button></div></div>}
        {result!.uploads?.map(u => <p key={u.id}>{l("Subida pendiente", "Pending upload")}: {u.name} ({Math.round(100 * u.offset / u.size)}%) <button disabled={busy} onClick={() => void run(async () => { await api(`/uploads/${u.id}`, {}, "DELETE"); await refresh(); })}>{l("Cancelar subida", "Cancel upload")}</button></p>)}
        {state.assets.filter(a => !state.materials.some(m => m.assetId === a.id)).map(a => <p key={a.id}>{l("Original sin ficha", "Original without entry")}: {a.name} <button disabled={busy} onClick={() => void run(async () => { await command("material.save", { title: a.name.slice(0, 160), kind: a.kind, assetId: a.id }); })}>{l("Recuperar ficha", "Recover entry")}</button></p>)}
      </section>
      {(capturing || editing) && <DraftForm className="surface" key={editing?.id ?? "capture"} draftKey={`marker-material:${editing?.id ?? "new"}`} onSubmit={saveMaterial}>
        <h2>{editing ? l("Editar material", "Edit material") : l("Nueva idea o texto", "New idea or text")}</h2>
        <div className="editor-fields">
          {field(l("Título breve", "Short title"), <input name="title" required maxLength={160} defaultValue={editing?.title} />)}
          {!editing?.assetId && field(l("Tipo", "Type"), <select name="kind" defaultValue={editing?.kind ?? "idea"}><option value="idea">{l("Idea por desarrollar", "Idea to develop")}</option><option value="text">{l("Texto listo", "Ready text")}</option></select>)}
          {field(l("Texto / idea", "Text / idea"), <textarea name="text" rows={4} maxLength={20_000} defaultValue={editing?.text} />, true)}
          {field(l("Descripción breve", "Short description"), <input name="description" maxLength={1000} defaultValue={editing?.description} />, true)}
          {field(l("Temas separados por comas", "Topics separated by commas"), <input name="topics" defaultValue={editing?.topics.join(", ")} placeholder="timeKER, freelancing, motivación" />, true)}
          <fieldset className="studio-options"><legend>{l("Productos (ninguno = compartido)", "Products (none = shared)")}</legend>{workspace.products.map(p => <label key={p.id}><input type="checkbox" name="products" value={p.id} defaultChecked={editing ? editing.productIds.includes(p.id) : captureProduct === p.id} />{p.name}</label>)}</fieldset>
          <fieldset className="studio-options"><legend>{l("Clasificación", "Classification")}</legend>{categories.map((x, i) => <label key={x}><input type="checkbox" name="categories" value={x} defaultChecked={editing ? editing.categories.includes(x as never) : captureCategory === x} />{categoryLabels[i]}</label>)}</fieldset>
          <fieldset className="studio-options"><legend>{l("Función", "Role")}</legend>{roles.map((x, i) => <label key={x}><input type="checkbox" name="roles" value={x} defaultChecked={editing?.roles.includes(x as never)} />{roleLabels[i]}</label>)}</fieldset>
          {field(l("Estado", "Review state"), <select name="review" defaultValue={editing?.review ?? "unreviewed"}><option value="unreviewed">{l("Sin revisar", "Unreviewed")}</option><option value="classified">{l("Clasificado", "Classified")}</option><option value="ready">{l("Listo para usar", "Ready to use")}</option></select>)}
          {field(l("Presencia de voz humana", "Human speech"), <select name="speech" defaultValue={editing?.speech ?? "unknown"}><option value="unknown">{l("Sin confirmar", "Unknown")}</option><option value="present">{l("Con voz", "Speech present")}</option><option value="absent">{l("Sin voz (puede tener sonido)", "No speech (may contain sound)")}</option></select>)}
          {field(l("Derechos de uso", "Usage rights"), <select name="rights" defaultValue={editing?.rights ?? "unknown"}><option value="unknown">{l("Sin confirmar", "Unconfirmed")}</option><option value="owned">{l("Propio", "Owned")}</option><option value="licensed">{l("Con licencia", "Licensed")}</option><option value="restricted">{l("Restringido", "Restricted")}</option></select>)}
          {field(l("Restricciones", "Restrictions"), <input name="restrictions" maxLength={2000} defaultValue={editing?.restrictions} />)}
          {editing?.assetId && <>{field(l("Tramo útil desde (s)", "Useful range from (s)"), <input name="usefulStart" type="number" min="0" step="0.1" defaultValue={editing.usefulStart} />)}{field(l("Hasta (s)", "To (s)"), <input name="usefulEnd" type="number" min="0" step="0.1" defaultValue={editing.usefulEnd} />)}</>}
        </div>
        <div className="record-actions"><button className="primary" disabled={busy}>{l("Guardar material", "Save material")}</button><button type="button" onClick={() => { setCapturing(false); setEditing(undefined); }}>{l("Cancelar", "Cancel")}</button></div>
      </DraftForm>}
      <div className="studio-filters">
        {field(l("Buscar material", "Search materials"), <input type="search" value={search} onChange={e => setSearch(e.target.value)} />)}
        {field(l("Producto", "Product"), <select value={product} onChange={e => setProduct(e.target.value)}><option value="">{l("Todos", "All")}</option><option value="shared">{l("Compartido / sin asignar", "Shared / unassigned")}</option>{workspace.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>)}
        {field(l("Clasificación", "Classification"), <select value={category} onChange={e => setCategory(e.target.value)}><option value="">{l("Todas", "All")}</option>{categories.map((x, i) => <option key={x} value={x}>{categoryLabels[i]}</option>)}</select>)}
        {field(l("Estado", "State"), <select value={review} onChange={e => setReview(e.target.value)}><option value="">{l("Todos", "All")}</option>{["unreviewed", "classified", "ready", "used"].map((x, i) => <option key={x} value={x}>{[l("Sin revisar", "Unreviewed"), l("Clasificado", "Classified"), l("Listo para usar", "Ready"), l("Usado", "Used")][i]}</option>)}</select>)}
      </div>
      <div className="surface studio-selection-actions"><p>{selectedMaterials.length}/50 {l("materiales para preparar una campaña", "materials for preparing a campaign")}</p><div className="record-actions"><button type="button" disabled={!selectedMaterials.length || selectedMaterials.length > 50 || busy || recorderActive || !!pendingRecording || analysisActive} onClick={() => { const ids = [...selectedMaterials]; void run(async () => { await command("material.classify", { ids }); setNotice(l("Selección clasificada.", "Selection classified.")); }); }}>{l("Clasificar selección", "Classify selection")}</button><button type="button" disabled={!selectedMaterials.length || busy || recorderActive || !!pendingRecording || !onOpenCampaigns} onClick={() => { setVariantId(""); setRecipeSources(undefined); setSelectionIntent([...selectedMaterials]); onOpenCampaigns?.(); setNotice(l("Selección lista para una pieza nueva.", "Selection ready for a new piece.")); }}>{l("Preparar campaña con la selección", "Prepare campaign from selection")}</button><button type="button" disabled={!selectedMaterials.length} onClick={() => setSelectedMaterials([])}>{l("Vaciar selección", "Clear selection")}</button></div></div>
      <div className="record-grid">{filtered.map(m => { const asset = state.assets.find(a => a.id === m.assetId); return <article key={m.id} className="surface studio-material">
        <label className="studio-confirm"><input type="checkbox" aria-label={`${l("Seleccionar para campaña", "Select for campaign")}: ${m.title}`} checked={selectedMaterials.includes(m.id)} disabled={!selectedMaterials.includes(m.id) && selectedMaterials.length >= 50} onChange={e => setSelectedMaterials(ids => e.target.checked ? [...ids, m.id] : ids.filter(id => id !== m.id))} />{l("Para una campaña", "For a campaign")}</label>
        {asset?.kind === "video" ? <video controls preload="metadata" src={assetUrl(asset.id)} /> : asset?.kind === "image" && asset.processing === "ready" ? <img src={assetUrl(asset.id)} alt={m.description || m.title} loading="lazy" /> : asset?.kind === "audio" ? <audio controls preload="metadata" src={assetUrl(asset.id)} /> : null}
        <h3>{m.title}</h3><p>{m.description || m.text?.slice(0, 240)}</p><p className="studio-hint">{m.categories.map(x => categoryLabels[categories.indexOf(x)]).join(" · ") || l("Sin clasificar", "Unclassified")} · {m.topics.join(", ")}</p>
        {asset && <p className="studio-hint">{(asset.size / 1_000_000).toFixed(1)} MB · {asset.duration?.toFixed(1) ?? "—"} s · {asset.width ?? "—"} × {asset.height ?? "—"} · {asset.width && asset.height ? asset.width === asset.height ? l("Cuadrado", "Square") : asset.width > asset.height ? l("Horizontal", "Landscape") : l("Vertical", "Portrait") : "—"} · {asset.mime}<br />{l("Pista de audio", "Audio track")}: {asset.audioTrack} · {l("Voz", "Speech")}: {m.speech}{asset.processing !== "ready" && <strong> · {l("Original guardado; formato no procesable", "Original saved; unsupported format")}</strong>}</p>}
        <p className="studio-hint">{useCount(m.id) ? `${l("Usado en", "Used in")} ${useCount(m.id)} ${l("variantes", "variants")}` : l("Sin usos", "Unused")} · v{m.contentVersion}</p>
        <div className="record-actions"><button disabled={busy} onClick={() => { setEditing(m); setCapturing(false); }}>{l("Editar", "Edit")}</button>{asset && <a href={`${assetUrl(asset.id)}?download=1`} download>{l("Original", "Original")}</a>}<button disabled={busy || !!useCount(m.id)} onClick={() => void run(async () => { await command("material.delete", { id: m.id, confirmed: true }); })}>{l("Eliminar ficha", "Delete entry")}</button></div>
      </article>; })}</div>
      {!filtered.length && <p className="empty-state">{l("Guarda un clip cotidiano, una foto o una idea. El producto y las etiquetas pueden esperar.", "Save an everyday clip, photo or idea. Product and tags can wait.")}</p>}
      {workspace.sources.length > 0 && <details className="surface"><summary>{l("Textos del Space anterior", "Texts from earlier Space")} ({workspace.sources.length})</summary>{workspace.sources.map(s => <div className="studio-legacy" key={s.id}><span>{s.title}</span><button disabled={busy} onClick={() => void run(async () => { await command("material.save", { importSourceId: s.id, title: s.title, text: s.text, kind: "text", productIds: [s.productId], categories: ["ready-text"], rights: "unknown" }); })}>{state.materials.some(m => m.origin?.sourceId === s.id) ? l("Ya copiado · copiar otra vez", "Already copied · copy again") : l("Copiar como texto editable", "Copy as editable text")}</button></div>)}</details>}
    </> : <>
      <section className="surface"><h2>{l("Arma una campaña con lo que ya tienes", "Build a campaign from what you already have")}</h2>
        <p>{l("Producto → objetivo y plataforma → material → plantilla y texto → borrador → aprobación → exportación", "Product → objective and platform → materials → template and text → draft → approval → export")}</p>
        <DraftForm draftKey="marker-new-studio-campaign" className="editor-fields" onSubmit={e => { e.preventDefault(); const d = new FormData(e.currentTarget); void run(async () => { const next = await command("campaign.save", { productId: d.get("productId"), title: d.get("title"), objective: d.get("objective"), kind: d.get("kind") }); setCampaignId(next.campaigns.at(-1)!.id); setVariantId(""); sessionStorage.removeItem("marker-new-studio-campaign"); }); }}>
          {field(l("Producto", "Product"), <select name="productId" required><option value="">{l("Elegir producto", "Choose product")}</option>{workspace.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>)}
          {field(l("Campaña", "Campaign"), <input name="title" required maxLength={160} placeholder={l("Organizar clientes", "Organize clients")} />)}
          {field(l("Objetivo", "Objective"), <input name="objective" maxLength={2000} placeholder={l("Una idea útil para quien trabaja solo", "A useful idea for a solo builder")} />)}
          {field(l("Modalidad", "Mode"), <select name="kind"><option value="organic">{l("Orgánica", "Organic")}</option><option value="paid">{l("Pagada (permanece pausada)", "Paid (remains paused)")}</option></select>)}
          <button className="primary" disabled={busy || !workspace.products.length}>{l("Crear campaña", "Create campaign")}</button>
        </DraftForm>
      </section>
      {field(l("Abrir campaña", "Open campaign"), <select value={campaignId} onChange={e => { setCampaignId(e.target.value); setVariantId(""); }}><option value="">{l("Seleccionar", "Select")}</option>{state.campaigns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select>)}
      {campaign && <section className="surface"><h2>{campaign.title}</h2><p>{campaign.objective}</p>{campaign.kind === "paid" && <p>{l("Campaña pagada pausada. Exportar no activa anuncios.", "Paid campaign paused. Exporting does not activate ads.")}</p>}
        <details><summary>{l("Editar objetivo y nombre", "Edit objective and name")}</summary><DraftForm draftKey={`marker-campaign:${campaign.id}`} className="editor-fields" onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); void run(async () => { await command("campaign.save", { id: campaign.id, title: data.get("title"), objective: data.get("objective") }); sessionStorage.removeItem(`marker-campaign:${campaign.id}`); }); }}>{field(l("Nombre", "Name"), <input name="title" maxLength={160} defaultValue={campaign.title} />)}{field(l("Objetivo", "Objective"), <textarea name="objective" maxLength={2000} defaultValue={campaign.objective} />)}<button disabled={busy}>{l("Guardar campaña", "Save campaign")}</button></DraftForm></details>
        <div className="record-actions"><button onClick={() => setVariantId("")}>{l("Nueva pieza", "New piece")}</button>{state.variants.filter(v => v.campaignId === campaign.id).map(v => <button key={v.id} aria-pressed={v.id === variantId} onClick={() => setVariantId(v.id)}>{v.platform} · {v.template} · r{v.recipeRevision}</button>)}</div>
        <StudioPlanner key={`planner:${campaignId}:${variantId}`} state={state} workspace={workspace} campaign={campaign} variant={variant} initialCandidateIds={selectedMaterials} selectionIntent={selectionIntent} onSelectionIntentUsed={() => setSelectionIntent(undefined)} onSelectionChange={setRecipeSources} recipeDirty={recipeDirty} busy={busy} defaultDurationSeconds={result!.capabilities.defaultDurationSeconds} analysisChoice={analysisChoice} onAnalysisChoiceUsed={() => setAnalysisChoice(undefined)} onPropose={async request => { await refresh(); return api<StudioPlanResult>("/plan", request); }} onApply={applyPlan} />
        <DraftForm key={`${recipeKey}:${variant?.recipeRevision ?? 0}`} draftKey={recipeKey} baseRevision={variant?.recipeRevision ?? 0} onDirty={setRecipeDirty} onSubmit={variantForm} className="studio-recipe">
          <h3>{l("1. Plataforma y plantilla", "1. Platform and template")}</h3><div className="editor-fields">
            {field(l("Plataforma", "Platform"), <select name="platform" defaultValue={variant?.platform ?? "Instagram"}>{platforms.map(x => <option key={x}>{x}</option>)}</select>)}
            {field(l("Plantilla", "Template"), <select name="template" defaultValue={variant?.template ?? "overlay"}>{["overlay", "demo", "tips", "motivation", "text"].map((x, i) => <option key={x} value={x}>{[l("Reel con texto", "Text overlay reel"), l("Demo narrada", "Narrated demo"), l("Consejos", "Tips"), l("Motivación", "Motivation"), l("Publicación de texto", "Text post")][i]}</option>)}</select>)}
          </div>
          <h3>{l("2. Material (máximo 3 tramos visuales)", "2. Materials (up to 3 visual segments)")}</h3><p className="studio-hint">{l("Los clips personales compartidos pueden servir de fondo. Las ideas siguen siendo ideas hasta que escribas el texto.", "Shared personal clips can serve as backgrounds. Ideas remain ideas until you write the text.")}</p>
          <div className="editor-fields">{field(l("Filtrar fuentes por título o tema", "Filter sources by title or topic"), <input value={sourceSearch} onChange={e => setSourceSearch(e.target.value)} />)}{field(l("Filtrar por clasificación", "Filter by classification"), <select value={sourceCategory} onChange={e => setSourceCategory(e.target.value)}><option value="">{l("Todas", "All")}</option>{categories.map((x, i) => <option key={x} value={x}>{categoryLabels[i]}</option>)}</select>)}</div>
          <div className="studio-source-list">{compatible.map(m => { const a = state.assets.find(a => a.id === m.assetId); const ranges = variant?.selections.filter(s => s.materialId === m.id) ?? []; const rows = ranges.length ? ranges : [{ materialId: m.id, start: m.kind === "image" ? 0 : m.usefulStart ?? 0, end: m.usefulEnd ?? Math.min(a?.duration ?? 10, (m.usefulStart ?? 0) + 10) }]; return <div key={m.id} hidden={!visibleSources.some(v => v.id === m.id)} className="studio-source">
            <label><input type="checkbox" name="sources" value={m.id} defaultChecked={variant?.sourceIds.includes(m.id)} onChange={e => { const form = e.currentTarget.form; if (form) setRecipeSources(new FormData(form).getAll("sources").map(String)); }} />{m.title} <small>({m.kind} · {useCount(m.id) ? l("ya usado", "already used") : l("sin usos", "unused")})</small></label>
            {a && ["video", "image"].includes(m.kind) && rows.map((range, index) => <div key={index}>{rows.length > 1 && <p className="studio-hint">{l("Tramo", "Segment")} {(variant?.selections.indexOf(range) ?? index) + 1}</p>}<div className="studio-range">{field(l("Desde (s)", "From (s)"), <input type="number" name={rangeField("start", m.id, index)} min="0" step="0.001" defaultValue={range.start} />)}{field(l("Hasta (s)", "To (s)"), <input type="number" name={rangeField("end", m.id, index)} min="0" step="0.001" defaultValue={range.end} />)}</div></div>)}
          </div>; })}</div>
          <h3>{l("3. Escribe el mensaje", "3. Write the message")}</h3>
          {field(l("Usar texto guardado", "Use saved text"), <select name="savedTextChoice" defaultValue="" onChange={e => { const m = state.materials.find(m => m.id === e.target.value); const form = e.target.form; if (m && form) { (form.elements.namedItem("body") as HTMLTextAreaElement).value = m.text; (form.elements.namedItem("refreshSources") as HTMLInputElement).checked = true; form.querySelectorAll<HTMLInputElement>('input[name="sources"]').forEach(input => { if (input.value === m.id) input.checked = true; }); setRecipeSources(new FormData(form).getAll("sources").map(String)); } }}><option value="">{l("Elegir texto listo", "Choose ready text")}</option>{compatible.filter(m => m.kind === "text").map(m => <option key={m.id} value={m.id}>{m.title}</option>)}</select>)}
          <div className="editor-fields">
            {field(l("Gancho", "Hook"), <input name="hook" maxLength={140} defaultValue={variant?.hook} />, true)}
            {field(l("Mensaje desarrollado", "Developed message"), <textarea name="body" rows={5} maxLength={3000} defaultValue={variant?.body} />, true)}
            {field(l("Cierre / llamada a la acción", "Closing / call to action"), <input name="cta" maxLength={180} defaultValue={variant?.cta} />, true)}
          </div>
          <details><summary>{l("4. Montaje y sonido", "4. Assembly and sound")}</summary><p className="studio-hint">{l("La suma de los tramos visuales debe coincidir con la duración. No se recorta ni congela material silenciosamente. El texto es superposición: no genera subtítulos.", "Visual ranges must add up to the duration. Material is never silently trimmed or frozen. Text is an overlay; it does not generate subtitles.")}</p><div className="editor-fields">
            {field(l("Duración total (5–60 s)", "Total duration (5–60 s)"), <input type="number" min="5" max="60" step="0.1" name="duration" defaultValue={variant?.duration ?? result!.capabilities.defaultDurationSeconds ?? 20} />)}
            {field(l("Encuadre vertical", "Vertical framing"), <select name="fit" defaultValue={variant?.fit ?? "contain"}><option value="contain">{l("Completo, con márgenes", "Whole image, with margins")}</option><option value="cover">{l("Llenar y recortar", "Fill and crop")}</option></select>)}
            {field(l("Foco horizontal (0 izquierda, 1 derecha)", "Horizontal focus (0 left, 1 right)"), <input type="number" min="0" max="1" step="0.1" name="focusX" defaultValue={variant?.focusX ?? 0.5} />)}
            {field(l("Foco vertical (0 arriba, 1 abajo)", "Vertical focus (0 top, 1 bottom)"), <input type="number" min="0" max="1" step="0.1" name="focusY" defaultValue={variant?.focusY ?? 0.5} />)}
            {field(l("Sonido original", "Original sound"), <select name="audio" defaultValue={variant?.audio ?? "mute"}><option value="mute">{l("Silenciar", "Mute")}</option><option value="keep">{l("Conservar", "Keep")}</option></select>)}
            {field(l("Narración grabada (reemplaza sonido original)", "Recorded narration (replaces original sound)"), <select name="narrationId" defaultValue={variant?.narrationId ?? ""}><option value="">{l("Sin narración adicional", "No additional narration")}</option>{compatible.filter(m => m.kind === "audio").map(m => <option key={m.id} value={m.id}>{m.title}</option>)}</select>)}
            <label><input type="checkbox" name="refreshSources" />{l("Actualizar instantáneas a las versiones actuales de las fuentes", "Refresh snapshots to current source versions")}</label>
          </div></details>
          <button className="primary" disabled={busy}>{l("Guardar borrador editable", "Save editable draft")}</button>
        </DraftForm>
        {variant && <div className="studio-output">
          <h3>{l("5. Previsualizar y aprobar", "5. Preview and approve")}</h3><p className="studio-hint">{l("Receta", "Recipe")} r{variant.recipeRevision} · {variant.status} · {l("Fuentes conservadas por versión", "Sources preserved by version")}</p>
          {recipeDirty && <p role="status">{l("Hay cambios sin guardar. Guarda el borrador antes de generar, aprobar o exportar.", "There are unsaved changes. Save the draft before rendering, approving or exporting.")}</p>}
          {recipeDirty && <details open><summary>{l("Texto guardado actualmente para comparar", "Current saved text for comparison")}</summary><article className="studio-text-preview"><h4>{variant.hook}</h4><p>{variant.body}</p><strong>{variant.cta}</strong></article></details>}
          {variant.template === "text" ? <article className="studio-text-preview"><h4>{variant.hook}</h4><p>{variant.body}</p><strong>{variant.cta}</strong></article> : <>
            {currentJob?.status === "completed" && <><p className="studio-hint">{l("Ya existe una vista previa para esta receta. Puedes revisarla sin otro montaje.", "A preview already exists for this recipe. Review it without another render.")}</p><label className="studio-confirm"><input type="checkbox" checked={regenerate} onChange={e => setRegenerate(e.target.checked)} />{l("Solicitar otro montaje de esta receta y reservar nuevo crédito de procesamiento", "Request another render of this recipe and reserve new processing credit")}</label></>}
            <button disabled={busy || recipeDirty || !!activeJob || analysisActive || (currentJob?.status === "completed" && !regenerate)} onClick={() => void run(async () => { await api(`/variants/${variant.id}/render`, { recipeRevision: variant.recipeRevision, regenerate }); await refresh(); })}>{currentJob?.status === "completed" ? l("Regenerar vista previa MP4", "Regenerate MP4 preview") : l("Generar vista previa MP4", "Generate MP4 preview")}</button>
            {currentJob && <p role="status">{l("Montaje", "Render")}: {currentJob.status} {currentJob.error}</p>}
            {currentJob?.status === "queued" && <button disabled={busy || recipeDirty} onClick={() => void run(async () => { await api(`/variants/${variant.id}/render`, { recipeRevision: variant.recipeRevision }); await refresh(); })}>{l("Reanudar espera del montaje guardado", "Resume waiting for saved render")}</button>}
            {currentJob?.status === "completed" && <video className="studio-render-preview" controls preload="metadata" poster={`/api/studio/jobs/${currentJob.id}/cover`} src={`/api/studio/jobs/${currentJob.id}/video`} />}
          </>}
          <form onSubmit={e => { e.preventDefault(); void run(async () => { const next = await api<{ state: StudioState }>(`/variants/${variant.id}/approve`, { recipeRevision: variant.recipeRevision, jobId: currentJob?.id, confirmed: true }); setResult(r => r ? { ...r, state: next.state } : r); }); }}>
            <label className="studio-confirm"><input type="checkbox" required />{l("Revisé el contenido, el encuadre y las restricciones. Confirmo los derechos de las fuentes y autorizo esta exportación.", "I reviewed the content, framing and restrictions. I confirm source rights and approve this export.")}</label>
            <button disabled={busy || recipeDirty || (variant.template !== "text" && currentJob?.status !== "completed")}>{l("Aprobar esta versión", "Approve this version")}</button>
          </form>
          {variant.status === "approved" && !recipeDirty && <a className="studio-export" href={`/api/studio/variants/${variant.id}/export`} download>{l("Exportar pieza aprobada", "Export approved piece")}</a>}
          <details><summary>{l("Trazabilidad de fuentes", "Source traceability")}</summary><pre className="studio-provenance">{JSON.stringify(variant.sourceSnapshots, null, 2)}</pre></details>
          <details><summary>{l("Historial de montajes y aprobaciones", "Render and approval history")}</summary>{result!.jobs.filter(j => j.variantId === variant.id).map(j => <p key={j.id}>r{j.recipeRevision} · {j.status} · <a href={`/api/studio/jobs/${j.id}`} target="_blank" rel="noreferrer">{l("Ver fuentes y receta conservadas", "View preserved sources and recipe")}</a></p>)}</details>
          <p className="studio-hint">{l("Exportar descarga un archivo. La publicación y las cuentas de redes se gestionan por separado.", "Exporting downloads a file. Publishing and social accounts are managed separately.")}</p>
        </div>}
      </section>}
    </>}
    <StudioAnalysis state={state} available={result!.capabilities.analysis === true} local={result!.capabilities.local} cents={result!.capabilities.analysisCents ?? 5} busy={busy || !!activeJob || recorderActive || !!pendingRecording} onRequest={range => api("/analyses", { ...range, confirmed: true })} onRead={id => api(`/analyses/${encodeURIComponent(id)}`)} onList={assetId => api(`/analyses?assetId=${encodeURIComponent(assetId)}`)} onUsageRefresh={refresh} onActiveChange={setAnalysisActive} onUseRange={choice => { setAnalysisChoice(choice); onOpenCampaigns?.(); setNotice(l("Rango elegido. Abre una campaña y confirma la ficha y el tramo en el planificador.", "Range chosen. Open a campaign and confirm the entry and range in the planner.")); }} />
  </div>;
}
