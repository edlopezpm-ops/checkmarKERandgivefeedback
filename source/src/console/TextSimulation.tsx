import { useEffect, useRef, useState } from "react";
import { ErrorNotice } from "./ErrorNotice";
import type { Workspace } from "../core/domain";
import { sendCommand } from "../core/client";
import { createTextSimulation, type SimulatedTextResult } from "../core/generation";
import { useLanguage } from "../i18n";

/** Development/local-session review only; never an OpenAI connection. */
export default function TextSimulation({ workspace, disabled, onSaved }: {
  workspace: Workspace;
  disabled: boolean;
  onSaved: (workspace: Workspace) => void;
}) {
  const { t } = useLanguage();
  const simulation = useRef(createTextSimulation());
  const cancellation = useRef<AbortController | null>(null);
  const [productId, setProductId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [postId, setPostId] = useState("");
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [result, setResult] = useState<SimulatedTextResult>();
  const [copy, setCopy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => () => {
    cancellation.current?.abort();
    simulation.current.clear();
  }, []);
  useEffect(() => {
    if (!result) return;
    const expiry = setTimeout(() => {
      setResult(undefined);
      setCopy("");
      setError("La respuesta simulada venció. Genera otra solicitud.");
    }, Math.max(0, result.expiresAt - Date.now()));
    return () => clearTimeout(expiry);
  }, [result]);
  const campaign = workspace.campaigns.find(item => item.id === campaignId);
  const sources = workspace.sources.filter(item => campaign?.sourceIds.includes(item.id));
  const posts = workspace.posts.filter(item => item.campaignId === campaignId && item.status === "draft");
  function resetResult() {
    setResult(undefined);
    setCopy("");
    setError("");
    setMessage("");
  }
  async function generate() {
    if (busy || disabled) return;
    setBusy(true);
    resetResult();
    const controller = new AbortController();
    cancellation.current = controller;
    try {
      const generated = await simulation.current.generate(workspace, {
        requestId: crypto.randomUUID(), revision: workspace.revision,
        campaignId, postId, sourceIds,
      }, { signal: controller.signal });
      setResult(generated);
      setCopy(generated.text);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      cancellation.current = null;
      setBusy(false);
    }
  }
  async function save() {
    if (!result || busy || disabled) return;
    setBusy(true);
    setError("");
    try {
      const prepared = simulation.current.prepareSave(workspace, result, copy);
      const saved = await sendCommand(prepared.revision, prepared.command);
      onSaved(saved);
      setResult(undefined);
      setCopy("");
      setMessage("Borrador simulado guardado. Puedes seguir editándolo en la cola.");
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return <details className="surface" aria-label={t("Simulación local de texto")}>
    <summary>{t("Simulación local de texto")}</summary>
    <p className="muted">{t("Respuesta simulada sin consumo de OpenAI. El acceso Pro sigue pendiente. Revisa el texto antes de guardarlo.")}</p>
    <p className="muted">{t("Las respuestas sin guardar caducan a los cinco minutos y se pierden al salir o recargar. Hasta 16 solicitudes retenidas a la vez.")}</p>
    <fieldset disabled={busy || disabled} className="editor-fields" style={{ border: 0, padding: 0, minWidth: 0 }}>
      <label className="form-field"><span>{t("Producto")}</span><select aria-label={t("Producto para simulación")} value={productId} onChange={event => {
        setProductId(event.target.value); setCampaignId(""); setPostId(""); setSourceIds([]); resetResult();
      }}><option value="">{t("Selecciona un producto")}</option>{workspace.products.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="form-field"><span>{t("Campaña")}</span><select aria-label={t("Campaña para simulación")} value={campaignId} onChange={event => {
        setCampaignId(event.target.value); setPostId(""); setSourceIds([]); resetResult();
      }}><option value="">{t("Selecciona una campaña")}</option>{workspace.campaigns.filter(item => item.productId === productId).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <label className="form-field wide"><span>{t("Borrador de destino")}</span><select aria-label={t("Borrador de destino")} value={postId} onChange={event => { setPostId(event.target.value); resetResult(); }}>
        <option value="">{t("Selecciona un borrador")}</option>{posts.map(item => {
          const account = workspace.accounts.find(account => account.id === item.accountId);
          return <option key={item.id} value={item.id}>{account?.platform} · {account?.name}</option>;
        })}
      </select></label>
      <div className="wide"><span>{t("Fuentes seleccionadas")}</span>{sources.map(source => <label className="check-field" key={source.id}>
        <input type="checkbox" checked={sourceIds.includes(source.id)} onChange={event => {
          setSourceIds(event.target.checked ? [...sourceIds, source.id] : sourceIds.filter(id => id !== source.id)); resetResult();
        }} />{source.title}
      </label>)}</div>
      <div className="record-actions"><button type="button" disabled={!postId || !sourceIds.length} onClick={() => void generate()}>{t("Generar texto simulado")}</button></div>
      {result && <>
        <p className="muted">{t("SIMULADO · fuentes:")} {sources.filter(source => result.sourceIds.includes(source.id)).map(source => source.title).join(" · ")}</p>
        <label className="form-field wide"><span>{t("Revisar texto simulado")}</span><textarea rows={10} maxLength={20000} value={copy} onChange={event => setCopy(event.target.value)} /></label>
        <p className="muted">{t("Guardar reemplaza el texto del borrador seleccionado y conserva su estado Borrador. Cualquier cambio posterior en el espacio obliga a generar otra respuesta.")}</p>
        <div className="record-actions"><button type="button" className="primary" disabled={!copy.trim()} onClick={() => void save()}>{t("Guardar como borrador editable")}</button><button type="button" onClick={resetResult}>{t("Descartar")}</button></div>
      </>}
    </fieldset>
    {busy && <p role="status">{t("Un momento…")}{cancellation.current && <button type="button" onClick={() => cancellation.current?.abort()}>{t("Cancelar simulación")}</button>}</p>}
    {error && <ErrorNotice message={t(error)} />}
    {message && <p role="status" className="success-message">{t(message)}</p>}
  </details>;
}
