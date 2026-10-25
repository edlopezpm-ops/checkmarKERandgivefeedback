import { useEffect, useState, type ReactNode } from "react";
import { ErrorNotice } from "./ErrorNotice";
import { platforms, type Workspace } from "../core/domain";
import type { StudioCampaign, StudioState, StudioVariant } from "../core/studio";
import { prepareStudioPlan, type StudioPlanInput, type StudioPlanResult } from "../core/studio-planner";
import { useLanguage } from "../i18n";

type Props = {
  state: StudioState; workspace: Workspace; campaign: StudioCampaign; variant?: StudioVariant;
  initialCandidateIds: string[]; recipeDirty: boolean; busy: boolean;
  analysisChoice?: { analysisId: string; assetId: string; start: number; end: number };
  onAnalysisChoiceUsed: () => void;
  defaultDurationSeconds?: number;
  initialRequest?: Partial<StudioPlanInput>;
  selectionIntent?: string[];
  onSelectionIntentUsed?: () => void;
  draftNamespace?: string;
  onSelectionChange?: (ids: string[]) => void;
  onPropose: (request: StudioPlanInput) => Promise<StudioPlanResult>;
  onApply: (request: StudioPlanInput, fingerprint: string, alternative: number, revision: number) => Promise<void>;
};
type Proposal = { result: StudioPlanResult; request: StudioPlanInput; revision: number };
const labels = ["B-roll", "Hablando a cámara", "Demo", "Foto", "Voz", "Idea", "Texto listo", "Testimonio"];
const categories = ["broll", "talking", "demo", "photo", "voice", "idea", "ready-text", "testimonial"];

export default function StudioPlanner({ state, workspace, campaign, variant, initialCandidateIds, recipeDirty, busy, defaultDurationSeconds, initialRequest, selectionIntent, onSelectionIntentUsed, draftNamespace, onSelectionChange, analysisChoice, onAnalysisChoiceUsed, onPropose, onApply }: Props) {
  const { language } = useLanguage();
  const l = (es: string, en: string) => language === "es" ? es : en;
  const key = `marker-plan:${draftNamespace ? `${draftNamespace}:` : ""}${campaign.id}:${variant?.id ?? "new"}`;
  const initial: StudioPlanInput = {
    campaignId: campaign.id, variantId: variant?.id,
    candidateIds: variant?.sourceIds ?? initialCandidateIds.slice(0, 50),
    includeShared: false, platform: variant?.platform ?? "Instagram", template: variant?.template ?? "overlay",
    hook: variant?.hook ?? "", body: variant?.body ?? "", cta: variant?.cta ?? "", duration: variant?.duration ?? defaultDurationSeconds ?? 20,
    lockedSelections: [], reviewedMaterialIds: [], allowReuse: false, muteBackground: false,
    audio: variant?.audio ?? "mute", narrationId: variant?.narrationId, textSourceId: variant?.planner?.textSourceId,
    fit: variant?.fit ?? "contain", focusX: variant?.focusX ?? .5, focusY: variant?.focusY ?? .5,
    ...initialRequest,
  };
  const [restored] = useState(() => {
    const withSelection = (request: StudioPlanInput): StudioPlanInput => !variant && selectionIntent ? {
      ...request, candidateIds: selectionIntent.slice(0, 50),
      lockedSelections: request.lockedSelections.filter(item => selectionIntent.includes(item.materialId)),
      textSourceId: request.textSourceId && selectionIntent.includes(request.textSourceId) ? request.textSourceId : undefined,
      narrationId: request.narrationId && selectionIntent.includes(request.narrationId) ? request.narrationId : undefined,
    } : request;
    try {
      const value = JSON.parse(sessionStorage.getItem(key) ?? "null") as { request: StudioPlanInput; revision: number } | null;
      if (value?.request.campaignId === campaign.id && value.request.variantId === variant?.id) return { ...value, request: withSelection(value.request) };
    } catch { /* Keep the visible draft usable when storage is unavailable. */ }
    return { request: withSelection(initial), revision: state.revision };
  });
  const [request, setRequest] = useState<StudioPlanInput>(restored.request);
  useEffect(() => { if (!variant && selectionIntent) onSelectionIntentUsed?.(); }, [selectionIntent, variant, onSelectionIntentUsed]);
  useEffect(() => { onSelectionChange?.(request.candidateIds); }, [request.candidateIds, onSelectionChange]);
  const [proposal, setProposal] = useState<Proposal>();
  const [alternative, setAlternative] = useState(0);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [replace, setReplace] = useState(false);
  const [replaceRecipe, setReplaceRecipe] = useState(false);
  const [message, setMessage] = useState("");
  const [analysisMaterial, setAnalysisMaterial] = useState("");
  const [open, setOpen] = useState(true);
  useEffect(() => { setAnalysisMaterial(""); }, [analysisChoice]);
  useEffect(() => { if (analysisChoice) setOpen(true); }, [analysisChoice]);
  const changed = !!proposal && JSON.stringify(request) !== JSON.stringify(proposal.request);
  const stale = !!proposal && proposal.revision !== state.revision;
  useEffect(() => {
    try { sessionStorage.setItem(key, JSON.stringify({ request, revision: restored.revision })); } catch { /* No server write on draft changes. */ }
  }, [key, request, restored.revision]);
  function update(values: Partial<StudioPlanInput>) {
    setRequest(current => ({ ...current, ...values })); setReplace(false); setReplaceRecipe(false); setMessage("");
  }
  const eligible = state.materials.filter(m => m.productIds.includes(campaign.productId) || (request.includeShared && !m.productIds.length));
  const visible = eligible.filter(m => (!search || `${m.title} ${m.description} ${m.topics.join(" ")}`.toLowerCase().includes(search.toLowerCase())) && (!category || m.categories.includes(category as never)));
  const selected = proposal?.result.proposals.find(p => p.alternative === alternative);
  const field = (label: string, child: ReactNode, wide = false) => <label className={`form-field${wide ? " wide" : ""}`}><span>{label}</span>{child}</label>;
  const title = (id: string) => state.materials.find(m => m.id === id)?.title ?? id;
  function toggle(id: string, checked: boolean) {
    if (checked && request.candidateIds.length >= 50) { setError(l("Selecciona hasta 50 materiales.", "Choose up to 50 materials.")); return; }
    update({ candidateIds: checked ? [...request.candidateIds, id] : request.candidateIds.filter(x => x !== id), lockedSelections: checked ? request.lockedSelections : request.lockedSelections.filter(s => s.materialId !== id) });
  }
  function chooseSource(id: string, kind: "text" | "narration") {
    const material = state.materials.find(m => m.id === id);
    if (material && !request.candidateIds.includes(id) && request.candidateIds.length >= 50) { setError(l("Libera un lugar entre los 50 materiales antes de añadir esta fuente.", "Remove one of the 50 materials before adding this source.")); return; }
    const candidateIds = material && !request.candidateIds.includes(id) ? [...request.candidateIds, id] : request.candidateIds;
    update(kind === "text" ? { candidateIds, textSourceId: material?.id, body: material?.text ?? request.body } : { candidateIds, narrationId: material?.id });
  }
  async function propose(fromLibrary = false) {
    if (pending || busy || (fromLibrary && (variant || recipeDirty || (!!proposal && !replace)))) return;
    setPending(true); setError(""); setMessage("");
    const revision = state.revision;
    try {
      const snapshot = fromLibrary ? prepareStudioPlan(state, workspace, request) : structuredClone(request);
      if (fromLibrary) setRequest(snapshot);
      const result = await onPropose(snapshot);
      setProposal({ result, request: snapshot, revision: result.proposals[0]?.provenance.studioRevision ?? revision }); setAlternative(result.proposals[0]?.alternative ?? 0); setReplace(false); setReplaceRecipe(false);
      if (!result.proposals.length) setMessage(l("No hay un montaje válido. Revisa las exclusiones y ajusta materiales, tramos o duración.", "No valid assembly is available. Review exclusions and adjust materials, ranges or duration."));
    } catch (e) { setError((e as Error).message); } finally { setPending(false); }
  }
  async function apply() {
    if (!proposal || !selected || changed || stale || pending || busy || (recipeDirty && !replaceRecipe)) return;
    setPending(true); setError("");
    try {
      await onApply(proposal.request, proposal.result.fingerprint, selected.alternative, proposal.revision);
      sessionStorage.removeItem(key); setMessage(l("Receta guardada. Revisa el borrador y genera el MP4 cuando quieras.", "Recipe saved. Review the draft and generate the MP4 when ready."));
      setProposal(undefined);
    } catch (e) { setError((e as Error).message); } finally { setPending(false); }
  }
  return <details className="studio-planner" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{l("Proponer montaje con mis materiales", "Propose an assembly from my materials")}</summary>
    <div className="studio-planner-content">
      <p>{l("Elige material y escribe el mensaje. Obtendrás una estructura editable antes de generar el video.", "Choose material and write the message. Get an editable structure before generating video.")}</p>
      <p className="studio-hint">{workspace.products.find(p => p.id === campaign.productId)?.name} · {campaign.objective}</p>
      <p className="studio-hint">{l("Proponer no renderiza video ni reserva crédito de procesamiento. Las ideas necesitan un texto desarrollado.", "Proposing does not render video or reserve processing credit. Ideas need developed text.")}</p>
      {restored.revision !== state.revision && !proposal && <p role="status">{l("Recuperamos tu propuesta local. Revisa sus campos y vuelve a proponer con las fuentes actuales.", "Your local proposal draft was recovered. Review its fields and propose again with current sources.")}</p>}
      {error && <ErrorNotice message={error} />}
      {message && <p role="status">{message}</p>}
      {!variant && <div className="record-actions"><button type="button" className="primary" disabled={pending || busy || recipeDirty || (!!proposal && !replace)} onClick={() => void propose(true)}>{l("Preparar con mi biblioteca", "Prepare from my library")}</button></div>}
      <div className="editor-fields">
        {field(l("Plataforma", "Platform"), <select value={request.platform} onChange={e => update({ platform: e.target.value as StudioPlanInput["platform"] })}>{platforms.map(p => <option key={p}>{p}</option>)}</select>)}
        {field(l("Plantilla", "Template"), <select value={request.template} onChange={e => update({ template: e.target.value as StudioPlanInput["template"] })}>{["overlay", "demo", "tips", "motivation", "text"].map((p, i) => <option key={p} value={p}>{[l("Reel con texto", "Text overlay reel"), l("Demo narrada", "Narrated demo"), l("Consejos", "Tips"), l("Motivación", "Motivation"), l("Publicación de texto", "Text post")][i]}</option>)}</select>)}
        {field(l("Duración (5–60 s)", "Duration (5–60 s)"), <input type="number" min="5" max="60" step="0.001" value={request.duration} onChange={e => update({ duration: Number(e.target.value) })} />)}
        {field(l("Encuadre", "Framing"), <select value={request.fit} onChange={e => update({ fit: e.target.value as "contain" | "cover" })}><option value="contain">{l("Completo, con márgenes", "Whole image, with margins")}</option><option value="cover">{l("Llenar y recortar; revisar después", "Fill and crop; review afterwards")}</option></select>)}
      </div>
      <h3>{l("Material disponible para esta propuesta", "Available material for this proposal")}</h3>
      <label className="studio-confirm"><input type="checkbox" checked={request.includeShared} onChange={e => update({ includeShared: e.target.checked })} />{l("Incluir fondos y materiales compartidos / sin producto", "Include shared / unassigned backgrounds and materials")}</label>
      {analysisChoice && <fieldset className="studio-options"><legend>{l("Rango técnico elegido por ti", "Technical range chosen by you")}</legend><p>{analysisChoice.start}–{analysisChoice.end} s · {l("Esto fija un rango humano. No interpreta el contenido ni cambia etiquetas o voz.", "This fixes a human range. It does not interpret content or change labels or speech.")}</p>{field(l("Ficha de material para este original", "Material entry for this original"), <select value={analysisMaterial || (eligible.filter(m => m.assetId === analysisChoice.assetId).length === 1 ? eligible.find(m => m.assetId === analysisChoice.assetId)!.id : "")} onChange={e => setAnalysisMaterial(e.target.value)}><option value="">{l("Elegir ficha; incluye compartidos si corresponde", "Choose entry; include shared materials if needed")}</option>{eligible.filter(m => m.assetId === analysisChoice.assetId).map(m => <option value={m.id} key={m.id}>{m.title}</option>)}</select>)}<button type="button" onClick={() => {
        const matches = eligible.filter(m => m.assetId === analysisChoice.assetId), material = matches.find(m => m.id === analysisMaterial) ?? (matches.length === 1 ? matches[0] : undefined);
        if (!material) { setError(l("Elige la ficha de este original para el producto o autoriza materiales compartidos.", "Choose this original's entry for the product or allow shared materials.")); return; }
        if (request.lockedSelections.length >= 3 || (!request.candidateIds.includes(material.id) && request.candidateIds.length >= 50) || (!request.analysisIds?.includes(analysisChoice.analysisId) && (request.analysisIds?.length ?? 0) >= 3)) { setError(l("Libera un tramo, fuente o análisis antes de añadir este rango.", "Remove a range, source or analysis before adding this range.")); return; }
        update({ candidateIds: [...new Set([...request.candidateIds, material.id])], lockedSelections: [...request.lockedSelections, { materialId: material.id, start: analysisChoice.start, end: analysisChoice.end }], analysisIds: [...new Set([...(request.analysisIds ?? []), analysisChoice.analysisId])] }); onAnalysisChoiceUsed();
      }}>{l("Confirmar este rango y adjuntar su análisis", "Confirm this range and attach its analysis")}</button><button type="button" onClick={onAnalysisChoiceUsed}>{l("Descartar elección", "Discard choice")}</button></fieldset>}
      {!!request.analysisIds?.length && <div><p className="studio-hint">{request.analysisIds.length} {l("análisis técnicos adjuntos. Los tramos siguen siendo tu selección manual y deben caber en la cobertura analizada.", "technical analyses attached. Ranges remain your manual selection and must fit within analyzed coverage.")}</p><button type="button" onClick={() => update({ analysisIds: [] })}>{l("Desvincular ayudas técnicas; conservar mis tramos", "Detach technical aids; keep my ranges")}</button></div>}
      <div className="editor-fields">
        {field(l("Buscar título o tema", "Find title or topic"), <input value={search} onChange={e => setSearch(e.target.value)} />)}
        {field(l("Clasificación", "Classification"), <select value={category} onChange={e => setCategory(e.target.value)}><option value="">{l("Todas", "All")}</option>{categories.map((c, i) => <option key={c} value={c}>{language === "es" ? labels[i] : ["B-roll", "Talking to camera", "Demo", "Photo", "Voice", "Idea", "Ready text", "Testimonial"][i]}</option>)}</select>)}
      </div>
      <p className="studio-hint">{request.candidateIds.length}/50 {l("materiales seleccionados. La autoelección exige estado listo y derechos válidos.", "materials selected. Automatic selection requires ready status and valid rights.")}</p>
      <div className="record-actions"><button type="button" disabled={pending || busy} onClick={() => update({ candidateIds: [...new Set([...request.candidateIds, ...visible.filter(m => m.review === "ready").map(m => m.id)])].slice(0, 50) })}>{l("Añadir visibles listos (hasta 50)", "Add visible ready materials (up to 50)")}</button><button type="button" onClick={() => update({ candidateIds: [], lockedSelections: [] })}>{l("Vaciar selección", "Clear selection")}</button></div>
      <div className="studio-source-list studio-plan-pool">{visible.map(m => <div className="studio-source" key={m.id}>
        <label><input type="checkbox" checked={request.candidateIds.includes(m.id)} onChange={e => toggle(m.id, e.target.checked)} />{m.title} <small>· {m.kind} · {m.review}</small></label>
        {m.restrictions && <p className="studio-hint">{l("Restricciones", "Restrictions")}: {m.restrictions}</p>}
        {(m.rights === "unknown" || m.rights === "restricted") && <p className="studio-hint">{l("Derechos sin permiso suficiente para proponer: revisa esta ficha en Space.", "Rights are insufficient for proposing: review this entry in Space.")}</p>}
        {(m.rights === "licensed" || m.rights === "owned" && !!m.restrictions) && request.candidateIds.includes(m.id) && <label className="studio-confirm"><input type="checkbox" checked={request.reviewedMaterialIds.includes(m.id)} onChange={e => update({ reviewedMaterialIds: e.target.checked ? [...request.reviewedMaterialIds, m.id] : request.reviewedMaterialIds.filter(id => id !== m.id) })} />{l("Revisé los derechos y restricciones para esta pieza", "I reviewed rights and restrictions for this piece")}</label>}
        {request.candidateIds.includes(m.id) && ["video", "image"].includes(m.kind) && <button type="button" disabled={request.lockedSelections.length >= 3} onClick={() => { const asset = state.assets.find(a => a.id === m.assetId); const start = m.kind === "image" ? 0 : m.usefulStart ?? 0; update({ lockedSelections: [...request.lockedSelections, { materialId: m.id, start, end: m.usefulEnd ?? Math.min(asset?.duration ?? start + 10, start + 10) }] }); }}>{l("Fijar un tramo", "Fix a range")}</button>}
      </div>)}</div>
      {!visible.length && <p className="empty-state">{l("Sin materiales con estos filtros. Puedes incluir compartidos o clasificar material en Space.", "No materials match these filters. Include shared materials or classify material in Space.")}</p>}
      {request.candidateIds.some(id => !eligible.some(m => m.id === id)) && <p role="status">{l("Hay selecciones fuera del producto o sin permiso de compartidos. Se excluirán; revisa el conjunto.", "Some selections are outside the product or shared permission. They will be excluded; review the pool.")}</p>}
      {request.lockedSelections.length > 0 && <fieldset className="studio-options"><legend>{l("Tramos fijados, en este orden", "Fixed ranges, in this order")}</legend><p className="studio-hint">{l("Conservan fuente, tramo y orden relativo. No fijan una posición absoluta. Voz y demos necesitan tramos revisados por ti.", "Preserves source, range and relative order. Does not fix absolute timeline positions. Voice and demos need ranges reviewed by you.")}</p>{request.lockedSelections.map((s, i) => <div className="studio-plan-lock" key={`${s.materialId}:${i}`}><strong>{i + 1}. {title(s.materialId)}</strong><div className="studio-range">{field(l("Desde (s)", "From (s)"), <input type="number" min="0" step="0.001" value={s.start} onChange={e => update({ lockedSelections: request.lockedSelections.map((item, n) => n === i ? { ...item, start: Number(e.target.value) } : item) })} />)}{field(l("Hasta (s)", "To (s)"), <input type="number" min="0.001" step="0.001" value={s.end} onChange={e => update({ lockedSelections: request.lockedSelections.map((item, n) => n === i ? { ...item, end: Number(e.target.value) } : item) })} />)}</div><div className="record-actions"><button type="button" disabled={i === 0} onClick={() => { const locks = [...request.lockedSelections]; [locks[i - 1], locks[i]] = [locks[i]!, locks[i - 1]!]; update({ lockedSelections: locks }); }}>{l("Subir", "Move up")}</button><button type="button" onClick={() => update({ lockedSelections: request.lockedSelections.filter((_, n) => n !== i) })}>{l("Soltar tramo", "Release range")}</button></div></div>)}</fieldset>}
      <h3>{l("Mensaje desarrollado", "Developed message")}</h3>
      {field(l("Usar texto listo guardado", "Use saved ready text"), <select value={request.textSourceId ?? ""} onChange={e => chooseSource(e.target.value, "text")}><option value="">{l("Texto manual", "Manual text")}</option>{eligible.filter(m => m.kind === "text" && m.categories.includes("ready-text")).map(m => <option key={m.id} value={m.id}>{m.title}</option>)}</select>)}
      <div className="editor-fields">{field(l("Gancho", "Hook"), <input maxLength={140} value={request.hook} onChange={e => update({ hook: e.target.value })} />, true)}{field(l("Mensaje", "Message"), <textarea rows={4} maxLength={3000} value={request.body} onChange={e => update({ body: e.target.value, textSourceId: undefined })} />, true)}{field(l("Cierre / llamada a la acción", "Closing / call to action"), <input maxLength={180} value={request.cta} onChange={e => update({ cta: e.target.value })} />, true)}</div>
      <div className="editor-fields">{field(l("Sonido original", "Original sound"), <select value={request.audio} onChange={e => update({ audio: e.target.value as "mute" | "keep" })}><option value="mute">{l("Silenciar", "Mute")}</option><option value="keep">{l("Conservar; sólo tramos humanos para voz", "Keep; human ranges required for speech")}</option></select>)}{field(l("Narración (reemplaza sonido original)", "Narration (replaces original sound)"), <select value={request.narrationId ?? ""} onChange={e => chooseSource(e.target.value, "narration")}><option value="">{l("Sin narración adicional", "No additional narration")}</option>{eligible.filter(m => m.kind === "audio").map(m => <option key={m.id} value={m.id}>{m.title}</option>)}</select>)}</div>
      <label className="studio-confirm"><input type="checkbox" checked={request.muteBackground} onChange={e => update({ muteBackground: e.target.checked })} />{l("Autorizo usar los fondos seleccionados silenciados. Esto no declara que carezcan de voz o audio.", "I allow selected backgrounds to be muted. This does not declare that they lack speech or audio.")}</label>
      <label className="studio-confirm"><input type="checkbox" checked={request.allowReuse} onChange={e => update({ allowReuse: e.target.checked })} />{l("Permitir reutilizar intencionalmente tramos ya usados", "Allow intentional reuse of previously used ranges")}</label>
      {proposal && <label className="studio-confirm"><input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} />{l("Reemplazar la propuesta visible al volver a proponer; conservar mis campos actuales", "Replace the visible proposal when proposing again; keep my current fields")}</label>}
      <button type="button" className="primary" disabled={busy || pending || (!!proposal && !replace)} onClick={() => void propose()}>{pending ? l("Preparando…", "Preparing…") : proposal ? l("Volver a proponer", "Propose again") : l("Proponer montaje", "Propose assembly")}</button>
      {proposal && <section className="studio-plan-result" aria-label={l("Propuestas de montaje", "Assembly proposals")}>
        <h3>{l("Estructura propuesta", "Proposed structure")}</h3><p className="studio-hint">{l("Es una estructura y texto. La vista previa fiel aparece después de guardar y generar el MP4.", "This is structure and text. The actual preview appears after saving and generating MP4.")}</p>
        <div className="record-actions">{proposal.result.proposals.map((p, i) => <button type="button" key={p.alternative} aria-pressed={alternative === p.alternative} onClick={() => setAlternative(p.alternative)}>{i === 0 ? l("Principal", "Main") : `${l("Alternativa", "Alternative")} ${i}`}</button>)}</div>
        {(changed || stale) && <p role="alert">{stale ? l("La biblioteca cambió. Tu propuesta sigue visible; vuelve a proponer antes de guardarla.", "The library changed. Your proposal remains visible; propose again before saving.") : l("Cambiaste los campos. Vuelve a proponer para validar y guardar la nueva estructura.", "Fields have changed. Propose again to validate and save the new structure.")}</p>}
        {selected && <><ol className="studio-plan-segments">{selected.recipe.selections.map((s, i) => <li key={`${s.materialId}:${i}`}><strong>{title(s.materialId)}</strong><span>{s.start.toFixed(3)}–{s.end.toFixed(3)} s · {(s.end - s.start).toFixed(3)} s</span></li>)}</ol><article className="studio-text-preview"><h4>{selected.recipe.hook}</h4><p>{selected.recipe.body}</p><strong>{selected.recipe.cta}</strong></article><p>{selected.recipe.duration} s · {selected.recipe.fit === "cover" ? l("Encuadre recortado", "Cropped framing") : l("Imagen completa", "Whole image")} · {selected.recipe.audio === "mute" ? l("Sonido silenciado", "Muted sound") : l("Sonido conservado", "Original sound")}</p>
          <ul>{selected.reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul>{selected.warnings.length > 0 && <div role="status"><strong>{l("Revisa antes de generar", "Review before generating")}</strong><ul>{selected.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></div>}
          <button type="button" onClick={() => update({ lockedSelections: structuredClone(selected.recipe.selections), duration: selected.recipe.duration })}>{l("Ajustar estos tramos antes de volver a proponer", "Adjust these ranges before proposing again")}</button>
          {recipeDirty && <label className="studio-confirm"><input type="checkbox" checked={replaceRecipe} onChange={e => setReplaceRecipe(e.target.checked)} />{l("Revisé mis cambios sin guardar y confirmo sustituirlos por esta propuesta. Mi borrador local se conserva hasta guardar.", "I reviewed my unsaved changes and confirm replacing them with this proposal. My local draft is kept until saving.")}</label>}
          <button type="button" className="primary" disabled={busy || pending || changed || stale || (recipeDirty && !replaceRecipe)} onClick={() => void apply()}>{l("Guardar esta propuesta como borrador editable", "Save this proposal as an editable draft")}</button>
        </>}
        {proposal.result.exclusions.length > 0 && <details><summary>{l("Material no utilizado y motivos", "Unused material and reasons")} ({proposal.result.exclusions.length})</summary><ul>{proposal.result.exclusions.map((e, i) => <li key={`${e.materialId}:${i}`}><strong>{title(e.materialId)}:</strong> {e.reason}</li>)}</ul></details>}
      </section>}
    </div>
  </details>;
}
