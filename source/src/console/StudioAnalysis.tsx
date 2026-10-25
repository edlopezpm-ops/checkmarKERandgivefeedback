import { useEffect, useRef, useState, type ReactNode } from "react";
import { ErrorNotice } from "./ErrorNotice";
import type { StudioState } from "../core/studio";
import type { StudioAnalysisRange, StudioAnalysisResult } from "../core/studio-analysis";
import { useLanguage } from "../i18n";

type Analysis = {
  id: string; assetId: string; range: StudioAnalysisRange; profile: string; toolVersion: string;
  status: "queued" | "running" | "completed" | "failed"; error?: string;
  result?: StudioAnalysisResult; thumbnails?: Array<{ name: string; time: number; url: string }>;
};
type Scan = StudioAnalysisRange & { assetId: string };
type Props = {
  state: StudioState; available: boolean; local: boolean; busy: boolean; cents: number;
  onRequest: (range: Scan) => Promise<{ analysis: Analysis; cached: boolean; chargedCents: number }>;
  onRead: (id: string) => Promise<{ analysis: Analysis }>;
  onList: (assetId: string) => Promise<{ analyses: Analysis[] }>;
  onUsageRefresh: () => Promise<unknown>;
  onActiveChange: (active: boolean) => void;
  onUseRange: (choice: { analysisId: string; assetId: string; start: number; end: number }) => void;
};

export default function StudioAnalysis({ state, available, local, busy, cents, onRequest, onRead, onList, onUsageRefresh, onActiveChange, onUseRange }: Props) {
  const { language } = useLanguage();
  const l = (es: string, en: string) => language === "es" ? es : en;
  const assets = state.assets.filter(a => ["video", "audio"].includes(a.kind) && a.processing === "ready" && !!a.duration);
  const [assetId, setAssetId] = useState("");
  const [start, setStart] = useState(0), [end, setEnd] = useState(10);
  const [ranges, setRanges] = useState<Scan[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [charged, setCharged] = useState(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { onActiveChange(pending); return () => onActiveChange(false); }, [pending, onActiveChange]);
  const field = (label: string, child: ReactNode) => <label className="form-field"><span>{label}</span>{child}</label>;
  const name = (id: string) => state.assets.find(a => a.id === id)?.name ?? id;
  const signal = (kind: string) => ({ scene: l("Posible cambio de escena", "Possible scene change"), silence: l("Baja energía de audio", "Low audio energy"), black: l("Imagen oscura", "Dark image"), freeze: l("Poca variación visual", "Low visual variation") })[kind] ?? kind;
  function remember(analysis: Analysis) { if (mounted.current) setAnalyses(items => [analysis, ...items.filter(item => item.id !== analysis.id)]); }
  async function load() {
    if (!assetId || pending) return;
    setError("");
    try { const result = await onList(assetId); setAnalyses(result.analyses); } catch (e) { setError((e as Error).message); }
  }
  async function execute() {
    if (!ranges.length || ranges.length > 3 || !confirmed || pending || busy || !available) return;
    setPending(true); setError(""); setNotice(""); setCharged(0);
    let chargedTotal = 0;
    try {
      for (const [index, range] of ranges.entries()) {
        if (!mounted.current) return;
        setNotice(`${l("Analizando tramo", "Analyzing range")} ${index + 1}/${ranges.length}`);
        const response = await onRequest(range);
        chargedTotal += response.chargedCents; setCharged(chargedTotal);
        let value = response.analysis; remember(value);
        const deadline = Date.now() + 270_000;
        while (["queued", "running"].includes(value.status)) {
          if (!mounted.current) return;
          if (Date.now() > deadline) throw new Error(l("La espera terminó. El trabajo guardado puede consultarse; no se inició otro análisis.", "Waiting ended. The saved job can be checked; no further analysis was started."));
          await new Promise(resolve => setTimeout(resolve, 1600));
          if (!mounted.current) return;
          value = (await onRead(value.id)).analysis; remember(value);
        }
        if (value.status === "failed") throw new Error(value.error ?? l("El análisis falló. El flujo manual sigue disponible.", "Analysis failed. The manual flow remains available."));
      }
      if (mounted.current) { setNotice(l("Análisis consultado. Revisa cobertura y señales; tus etiquetas y voz no cambiaron.", "Analysis ready for review. Check coverage and signals; your labels and speech fields have not changed.")); setRanges([]); setConfirmed(false); }
    } catch (e) { if (mounted.current) setError(`${(e as Error).message} ${l("No se reintentará automáticamente. Consulta el historial antes de volver a solicitarlo.", "No automatic retry will occur. Check history before requesting again.")}`); }
    finally {
      if (mounted.current) { setPending(false); void onUsageRefresh().catch(() => undefined); }
    }
  }
  return <details className="studio-analysis">
    <summary>{l("Ayudas técnicas de los originales (opcional)", "Technical aids for originals (optional)")}</summary>
    <div className="studio-planner-content">
      <p className="studio-hint">{l("Miniaturas y señales de imagen o sonido. No comprende contenido ni detecta B-roll, temas o presencia de voz. Silencio no significa ausencia de voz. Nada se reclasifica ni recorta automáticamente.", "Thumbnails and visual or sound signals. Does not understand content or detect B-roll, topics or speech presence. Silence does not mean speech is absent. Nothing is automatically relabeled or trimmed.")}</p>
      {!available && <p role="status">{l("El análisis remoto espera la verificación de sus herramientas. Puedes proponer y montar con etiquetas y tramos manuales.", "Remote analysis awaits tool verification. You can propose and assemble using manual labels and ranges.")}</p>}
      {error && <ErrorNotice message={error} />}
      {notice && <p role="status">{notice}</p>}
      <div className="editor-fields">
        {field(l("Original", "Original"), <select value={assetId} disabled={pending} onChange={e => { const asset = assets.find(a => a.id === e.target.value); setAssetId(e.target.value); setStart(0); setEnd(Math.min(asset?.duration ?? 10, 120)); setConfirmed(false); }}><option value="">{l("Video o audio compatible", "Compatible video or audio")}</option>{assets.map(a => <option key={a.id} value={a.id}>{a.name} · {a.duration?.toFixed(1)} s</option>)}</select>)}
        {field(l("Desde (s)", "From (s)"), <input type="number" value={start} min="0" step="0.001" disabled={pending} onChange={e => { setStart(Number(e.target.value)); setConfirmed(false); }} />)}
        {field(l("Hasta (s), hasta 120 s por tramo", "To (s), up to 120 s per range"), <input type="number" value={end} min="0.001" step="0.001" disabled={pending} onChange={e => { setEnd(Number(e.target.value)); setConfirmed(false); }} />)}
      </div>
      <div className="record-actions"><button type="button" disabled={!assetId || pending || ranges.length >= 3 || !available} onClick={() => {
        const asset = assets.find(a => a.id === assetId);
        if (!asset || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end - start > 120 || end > (asset.duration ?? 0)) { setError(l("Elige un tramo válido de hasta 120 segundos dentro del original.", "Choose a valid range of up to 120 seconds within the original.")); return; }
        if (ranges.some(r => r.assetId === assetId && r.start === start && r.end === end)) return;
        setRanges(items => [...items, { assetId, start, end }]); setConfirmed(false); setError("");
      }}>{l("Añadir tramo (máximo 3)", "Add range (up to 3)")}</button><button type="button" disabled={!assetId || pending} onClick={() => void load()}>{l("Consultar análisis guardados", "Check saved analyses")}</button></div>
      {ranges.length > 0 && <><ol>{ranges.map((range, i) => <li key={`${range.assetId}:${range.start}:${range.end}`}><span>{name(range.assetId)} · {range.start}–{range.end} s </span><button type="button" disabled={pending} onClick={() => { setRanges(items => items.filter((_, n) => n !== i)); setConfirmed(false); }}>{l("Quitar", "Remove")}</button></li>)}</ol><p>{l("Reserva máxima", "Maximum reservation")}: US${((local ? 0 : ranges.length * cents) / 100).toFixed(2)} · {l("crédito interno, no factura del proveedor. Un resultado en caché no consume otro crédito. Los fallos de cómputo consumen crédito.", "internal credit, not a provider invoice. A cached result consumes no additional credit. Compute failures consume credit.")}</p><label className="studio-confirm"><input type="checkbox" disabled={pending} checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />{l("Confirmo analizar sólo estos tramos, en secuencia, con esta reserva máxima.", "I confirm analyzing only these ranges, sequentially, with this maximum reservation.")}</label><button type="button" className="primary" disabled={!confirmed || pending || busy || !available} onClick={() => void execute()}>{pending ? l("Analizando…", "Analyzing…") : l("Analizar tramos confirmados", "Analyze confirmed ranges")}</button></>}
      {charged > 0 && <p className="studio-hint">{l("Crédito reservado en esta solicitud", "Credit reserved for this request")}: US${(charged / 100).toFixed(2)}</p>}
      {analyses.map(analysis => <article className="studio-analysis-result" key={analysis.id}>
        <h4>{name(analysis.assetId)}</h4><p>{analysis.range.start}–{analysis.range.end} s · {analysis.status} {analysis.result && `· ${analysis.result.status}`}</p>
        {analysis.error && <p role="alert">{analysis.error}</p>}
        <button type="button" disabled={pending} onClick={() => void onRead(analysis.id).then(r => remember(r.analysis)).catch(e => setError(e.message))}>{l("Consultar resultado / actualizar", "Read result / refresh")}</button>
        {analysis.result && <><p className="studio-hint">{l("Cobertura", "Coverage")}: {analysis.result.range.start}–{analysis.result.range.end} s · {analysis.result.profile}<br />{analysis.result.toolVersion}</p>
          {analysis.result.status !== "complete" && <p role="status">{l("Cobertura parcial o no disponible. Mantén la selección manual fuera de lo analizado.", "Coverage is partial or unavailable. Keep manual selection outside the analyzed range.")}</p>}
          <div className="studio-analysis-thumbnails">{analysis.thumbnails?.map(thumb => <figure key={thumb.name}><img src={thumb.url} alt={`${l("Fotograma técnico a", "Technical frame at")} ${thumb.time.toFixed(2)} s`} loading="lazy" /><figcaption>{thumb.time.toFixed(2)} s</figcaption></figure>)}</div>
          {analysis.result.status !== "unavailable" && state.assets.find(a => a.id === analysis.assetId)?.kind === "video" && <button type="button" onClick={() => onUseRange({ analysisId: analysis.id, assetId: analysis.assetId, ...analysis.result!.range })}>{l("Elegir cobertura como rango manual para una campaña", "Choose coverage as a manual campaign range")}</button>}
          {analysis.result.intervals.length ? <details><summary>{l("Señales corregibles; no son cortes elegidos", "Correctable signals; not selected cuts")} ({analysis.result.intervals.length})</summary><ul>{analysis.result.intervals.map((interval, i) => <li key={i}>{signal(interval.kind)}: {interval.start.toFixed(3)}–{interval.end.toFixed(3)} s {interval.end > interval.start && state.assets.find(a => a.id === analysis.assetId)?.kind === "video" && <button type="button" onClick={() => onUseRange({ analysisId: analysis.id, assetId: analysis.assetId, start: Math.round(interval.start * 1000) / 1000, end: Math.round(interval.end * 1000) / 1000 })}>{l("Elegir como rango manual", "Choose as a manual range")}</button>}</li>)}</ul></details> : <p className="studio-hint">{l("Sin señales para estos umbrales; no prueba ausencia de voz, movimiento o contenido útil.", "No signals at these thresholds; this does not prove the absence of speech, motion or useful content.")}</p>}
          {analysis.result.warnings.length > 0 && <ul>{analysis.result.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>}
        </>}
      </article>)}
      {!assets.length && <p className="empty-state">{l("Sube un video o audio compatible para consultar estas ayudas.", "Upload a compatible video or audio to use these aids.")}</p>}
    </div>
  </details>;
}
