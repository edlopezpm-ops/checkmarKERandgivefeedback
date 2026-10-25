import { useEffect, useState, type ReactNode } from "react";
import { ErrorNotice } from "./ErrorNotice";
import { request } from "../core/client";
import type { StudioSettings, StudioSettingsResponse, StudioSettingsValues } from "../core/settings";
import { useLanguage } from "../i18n";
import "./settings.css";
import type { AgentLimits, AgentOverview } from "../core/agents";

type Draft = { monthly: string; processing: string; ai: string; storage: string; duration: string };
const draftKey = "marker-settings-draft";
const asDraft = (s: StudioSettings): Draft => ({ monthly: (s.monthlyBudgetCents / 100).toFixed(2), processing: (s.processingBudgetCents / 100).toFixed(2), ai: (s.aiBudgetCents / 100).toFixed(2), storage: String(s.storageLimitBytes / 1024 ** 3), duration: String(s.defaultDurationSeconds) });
function recovered(): { draft?: Draft; revision?: number } {
  try { const value = JSON.parse(sessionStorage.getItem(draftKey) ?? "null"); if (value && Number.isSafeInteger(value.revision) && ["monthly", "processing", "ai", "storage", "duration"].every(key => typeof value.draft?.[key] === "string")) return value; } catch { /* Browser draft storage is optional. */ }
  return {};
}

export default function Settings({ environment }: { environment?: ReactNode }) {
  const { language } = useLanguage();
  const l = (es: string, en: string) => language === "es" ? es : en;
  const [stored] = useState(recovered);
  const [result, setResult] = useState<StudioSettingsResponse>();
  const [draft, setDraft] = useState<Draft | undefined>(stored.draft);
  const [revision, setRevision] = useState<number | undefined>(stored.revision);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [confirmCurrent, setConfirmCurrent] = useState(false);
  const stale = !!result && revision !== undefined && revision !== result.settings.revision;
  const dirty = !!draft && !!result && JSON.stringify(draft) !== JSON.stringify(asDraft(result.settings));
  useEffect(() => {
    let active = true;
    void request<StudioSettingsResponse>("/api/studio/settings").then(value => {
      if (!active) return;
      setResult(value); if (!stored.draft) { setDraft(asDraft(value.settings)); setRevision(value.settings.revision); }
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!draft || revision === undefined) return;
    try { if (dirty || !result) sessionStorage.setItem(draftKey, JSON.stringify({ draft, revision })); else sessionStorage.removeItem(draftKey); } catch { /* No autosave to the server. */ }
  }, [draft, revision, dirty, result]);
  async function refresh(discard = false) {
    setBusy(true); setError(""); setNotice(""); setConfirmCurrent(false);
    try {
      const value = await request<StudioSettingsResponse>("/api/studio/settings"); setResult(value);
      if (discard || !draft) { setDraft(asDraft(value.settings)); setRevision(value.settings.revision); }
      setNotice(discard ? l("Se restauraron los valores guardados.", "Saved values restored.") : l("Estado actualizado. Tus campos sin guardar se conservan.", "Status refreshed. Your unsaved fields are preserved."));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function change(key: keyof Draft, value: string) { setDraft(current => current && { ...current, [key]: value }); setNotice(""); setConfirmCurrent(false); }
  function values(): StudioSettingsValues {
    if (!draft || !result) throw new Error(l("Espera a cargar los ajustes.", "Wait for settings to load."));
    const cents = (text: string) => /^\d+(?:\.\d{1,2})?$/.test(text) ? Math.round(Number(text) * 100) : NaN;
    const value: StudioSettingsValues = { monthlyBudgetCents: cents(draft.monthly), processingBudgetCents: cents(draft.processing), aiBudgetCents: cents(draft.ai), storageLimitBytes: Math.round(Number(draft.storage) * 1024 ** 3), defaultDurationSeconds: Number(draft.duration) };
    if ([value.monthlyBudgetCents, value.processingBudgetCents, value.aiBudgetCents].some(n => !Number.isSafeInteger(n) || n < 0 || n > result.limits.maxBudgetCents) || value.processingBudgetCents + value.aiBudgetCents > value.monthlyBudgetCents) throw new Error(l("Usa importes de 0 a US$20 con hasta dos decimales. Procesamiento + IA no puede superar el total mensual.", "Use amounts from 0 to US$20 with up to two decimals. Processing + AI cannot exceed the monthly total."));
    if (!draft.storage.trim() || !Number.isFinite(Number(draft.storage)) || !Number.isSafeInteger(value.storageLimitBytes) || value.storageLimitBytes < 0 || value.storageLimitBytes > result.limits.maxStorageBytes) throw new Error(l("El almacenamiento debe estar entre 0 y 2 GiB.", "Storage must be between 0 and 2 GiB."));
    if (!Number.isSafeInteger(value.defaultDurationSeconds) || value.defaultDurationSeconds < 5 || value.defaultDurationSeconds > 60) throw new Error(l("La duración debe ser un entero entre 5 y 60 segundos.", "Duration must be a whole number between 5 and 60 seconds."));
    return value;
  }
  async function save() {
    if (busy || !result || revision === undefined || stale && !confirmCurrent) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const next = await request<StudioSettingsResponse>("/api/studio/settings", { expectedRevision: stale ? result.settings.revision : revision, settings: values() });
      setResult(next); setDraft(asDraft(next.settings)); setRevision(next.settings.revision); setConfirmCurrent(false);
      try { sessionStorage.removeItem(draftKey); } catch { /* Saving settings does not depend on browser draft storage. */ }
      setNotice(l("Ajustes guardados. Los nuevos borradores usarán la duración elegida.", "Settings saved. New drafts will use the selected duration."));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const usd = (cents: number) => `US$${(cents / 100).toFixed(2)}`;
  const field = (label: string, key: keyof Draft, min: string, max: string, step: string) => <label className="form-field"><span>{label}</span><input name={key} type="number" inputMode={step === "1" ? "numeric" : "decimal"} min={min} max={max} step={step} required value={draft?.[key] ?? ""} onChange={e => change(key, e.target.value)} /></label>;
  return <div className="settings-page">
    <section className="surface"><div className="settings-heading"><h2>{l("Presupuesto y límites", "Budget and limits")}</h2></div>
      <p>{l("Son límites internos de marKER. El presupuesto mensual organiza tu objetivo de US$20; no limita la factura ni cambia tu plan con Cloudflare.", "These are marKER's internal limits. The monthly budget organizes your US$20 target; it does not cap the bill or change your Cloudflare plan.")}</p>
      {error && <ErrorNotice message={error} />}{notice && <p role="status" className="success-message">{notice}</p>}
      {!result && <p role="status">{l("Cargando ajustes…", "Loading settings…")}</p>}
      {result && draft && <>
        <div className="settings-usage"><p><strong>{l("Procesamiento este mes", "Processing this month")}</strong><span>{usd(result.usage.processingUsedCents)} / {usd(result.settings.processingBudgetCents)} · {result.usage.month}</span></p><p><strong>{l("Almacenamiento", "Storage")}</strong><span>{(result.usage.storageBytes / 1024 ** 3).toFixed(3)} GiB + {(result.usage.reservedBytes / 1024 ** 3).toFixed(3)} GiB {l("reservados", "reserved")} / {(result.settings.storageLimitBytes / 1024 ** 3).toFixed(2)} GiB</span></p><p><strong>{l("IA", "AI")}</strong><span>{l("Consulta Agentes para ver tu conexión", "See Agents for your connection")} · {usd(result.usage.aiUsedCents)} {l("consumidos", "used")}</span></p></div>
        <form onSubmit={event => { event.preventDefault(); void save(); }}>
          <fieldset className="settings-fields" disabled={busy}>
            <legend className="sr-only">{l("Límites generales", "General limits")}</legend>
            {field(l("Presupuesto mensual interno (US$)", "Internal monthly budget (US$)"), "monthly", "0", "20", "0.01")}
            {field(l("Crédito mensual de procesamiento (US$)", "Monthly processing credit (US$)"), "processing", "0", "20", "0.01")}
            {field(l("Reserva interna de IA por API (US$)", "Internal API AI allocation (US$)"), "ai", "0", "20", "0.01")}
            {field(l("Límite de almacenamiento (GiB)", "Storage limit (GiB)"), "storage", "0", "2", "any")}
            {field(l("Duración inicial de nuevas piezas (s)", "Default duration for new pieces (s)"), "duration", "5", "60", "1")}
          </fieldset>
          <p className="setting-note">{l("Procesamiento + IA debe caber en el total. La reserva de IA por API sólo prepara un límite. El bridge de Codex utiliza la suscripción y los límites propios de tu cuenta. El procesamiento se detiene al agotar sus créditos; los archivos existentes se conservan al reducir límites.", "Processing + AI must fit within the total. API AI allocation only prepares a limit. The Codex bridge uses your account subscription and its own limits. Processing stops when its credits run out; existing files are retained when limits are reduced.")}</p>
          <p className="setting-note">{l("Tope actual: US$20 internos y 2 GiB. Guardar no borra archivos, modifica piezas existentes ni activa servicios.", "Current ceiling: US$20 internal and 2 GiB. Saving does not delete files, modify existing pieces or activate services.")}</p>
          {stale && <div role="alert"><p>{l("Los ajustes guardados cambiaron. Compara sus valores actuales antes de sustituirlos por tus campos.", "Saved settings changed. Compare their current values before replacing them with your fields.")}</p><p className="setting-note">{l("Guardado actualmente", "Currently saved")}: {usd(result.settings.monthlyBudgetCents)} · {l("procesamiento", "processing")} {usd(result.settings.processingBudgetCents)} · IA {usd(result.settings.aiBudgetCents)} · {(result.settings.storageLimitBytes / 1024 ** 3).toFixed(2)} GiB · {result.settings.defaultDurationSeconds} s</p><label className="studio-confirm"><input type="checkbox" checked={confirmCurrent} onChange={e => setConfirmCurrent(e.target.checked)} />{l("Revisé los valores actuales y confirmo guardar mis campos sobre esa versión.", "I reviewed current values and confirm saving my fields over that version.")}</label></div>}
          <div className="record-actions"><button className="primary" disabled={busy || !dirty || stale && !confirmCurrent}>{l("Guardar ajustes", "Save settings")}</button><button type="button" disabled={busy} onClick={() => void refresh(false)}>{l("Actualizar estado sin perder mis cambios", "Refresh status and keep my changes")}</button><button type="button" disabled={busy || !dirty} onClick={() => void refresh(true)}>{l("Restaurar valores guardados", "Restore saved values")}</button></div>
        </form>
      </>}
      {!result && <button type="button" disabled={busy} onClick={() => void refresh()}>{l("Reintentar carga", "Retry loading")}</button>}
    </section>
    <AgentSettings />
    {environment && <section className="surface"><h2>{l("Ambiente de este navegador", "Environment in this browser")}</h2>{environment}</section>}
  </div>;
}


function AgentSettings() {
  const { language } = useLanguage();
  const l = (es: string, en: string) => language === "es" ? es : en;
  const [result, setResult] = useState<AgentOverview>();
  const [draft, setDraft] = useState<AgentLimits>();
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  async function load() { const value = await request<AgentOverview>("/api/agents"); setResult(value); setDraft(value.limits); }
  useEffect(() => { void load().catch(e => setError(e.message)); }, []);
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!draft || busy) return; setBusy(true); setError(""); setNotice("");
    try { await request("/api/agents/limits", draft); await load(); setNotice(l("Límites del agente guardados.", "Agent limits saved.")); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const field = (label: string, key: keyof AgentLimits, min: number, max: number) => <label className="form-field"><span>{label}</span><input type="number" min={min} max={max} step="1" required value={draft?.[key] ?? ""} onChange={e => setDraft(current => current && { ...current, [key]: Number(e.target.value) })} /></label>;
  return <section className="surface"><h2>{l("Agentes · conexión y límites", "Agents · connection and limits")}</h2><p>{l("Codex trabaja mediante un bridge local y la sesión oficial de ChatGPT de tu equipo. La suscripción y las cuotas se gestionan en tu cuenta; esta conexión no selecciona facturación por API.", "Codex works through a local bridge and the official ChatGPT session on your computer. Your account manages the subscription and quotas; this connection does not select API billing.")}</p>
    {error && <ErrorNotice message={error}> <button disabled={busy} onClick={() => void load().catch(e => setError(e.message))}>{l("Reintentar", "Retry")}</button></ErrorNotice>}{notice && <p role="status">{notice}</p>}
    {result && <p>{l("Disponibles", "Available")}: {result.connections.filter(item => item.available).length} · {l("Ejecuciones hoy", "Runs today")}: {result.usage.todayRuns} · {l("Activas", "Active")}: {result.usage.activeRuns}</p>}
    {draft && <form onSubmit={event => void save(event)}><fieldset disabled={busy} className="agents-settings-grid"><legend className="sr-only">{l("Límites del agente", "Agent limits")}</legend>{field(l("Máximo de ejecuciones al día", "Maximum runs per day"), "dailyRuns", 1, 200)}{field(l("Tiempo máximo por ejecución (s)", "Maximum run duration (s)"), "maxRunSeconds", 30, 900)}{field(l("Ejecuciones simultáneas", "Concurrent runs"), "maxConcurrentRuns", 1, 1)}{field(l("Limpieza de historial no aplicado (días)", "Unused history cleanup (days)"), "retentionDays", 1, 90)}</fieldset><p className="setting-note">{l("El tiempo máximo solicita la cancelación del proceso. Los límites de marKER no limitan la factura ni sustituyen los límites de tu suscripción. La limpieza elimina actividad antigua y conversaciones sin resultados aplicados. Las propuestas guardadas, su contexto de origen y sus registros se conservan para trazabilidad y recuperación; los materiales y variantes siguen en Studio.", "The duration limit requests process cancellation. marKER limits do not cap billing or replace your subscription limits. Cleanup removes old activity and conversations without applied results. Saved proposals, their original context and associated records remain for traceability and recovery; Studio keeps saved materials and variants.")}</p><button className="primary" disabled={busy || JSON.stringify(draft) === JSON.stringify(result?.limits)}>{l("Guardar límites del agente", "Save agent limits")}</button></form>}
  </section>;
}
