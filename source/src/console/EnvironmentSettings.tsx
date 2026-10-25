import { scenes } from "../decoration/registry";
import { useLanguage } from "../i18n";
import { McpConnections } from './McpConnections';

export type EnvironmentPreferences = {
  dark: boolean; onDark: (dark: boolean) => void;
  enabled: boolean; paused: boolean; cache: boolean; cacheMessage: string;
  stateLabel: string; playing: boolean; scene?: string; reduced: boolean; selection: string;
  onEnabled: (enabled: boolean) => void; onPaused: (paused: boolean) => void;
  onCache: (accepted: boolean) => void; onSelection: (selection: string) => void; onPreview: () => void;
};

export function EnvironmentSettings({ preferences: p, idPrefix, showCache }: { preferences: EnvironmentPreferences; idPrefix: string; showCache: boolean }) {
  const { language, setLanguage, t } = useLanguage();
  return <>
    <p className="setting-note"><a className="environment-demo-link" href="/demo/" target="_blank" rel="noopener noreferrer">{language === "es" ? "Ver demo de marKER" : "Watch the marKER demo"}<span className="sr-only">{language === "es" ? " (se abre en otra pestaña)" : " (opens in a new tab)"}</span></a></p>
    <label className="setting" data-setting="theme"><span><strong>{t("Modo oscuro")}</strong><small>{t("Carbón suave y acentos naranja.")}</small></span><input type="checkbox" role="switch" aria-label={t("Modo oscuro")} checked={p.dark} onChange={e => p.onDark(e.target.checked)} /></label>
    <label className="setting" data-setting="language"><span><strong>English / Español</strong><small lang={language}>{language === "en" ? "English" : "Español"}</small></span><input type="checkbox" role="switch" aria-label={language === "en" ? "Use English" : "Usar inglés"} checked={language === "en"} onChange={e => setLanguage(e.target.checked ? "en" : "es")} /></label>
    <label className="setting" data-setting="companions"><span><strong>{t("Compañeros de fondo")}</strong><small>{t("Claude y Codex animados")}</small></span><input type="checkbox" role="switch" checked={p.enabled} onChange={e => p.onEnabled(e.target.checked)} /></label>
    <label className="setting" data-setting="pause"><span><strong>{t("Pausar animación")}</strong><small>{t("Reanuda desde el mismo punto.")}</small></span><input type="checkbox" role="switch" checked={p.paused} disabled={!p.enabled} onChange={e => p.onPaused(e.target.checked)} /></label>
    {p.stateLabel && <p className="setting-note" role="status">{p.playing && p.enabled ? `${t(p.scene ?? "")} · ${t("en movimiento")}` : t(p.stateLabel)}</p>}
    <div className="review-actions"><label className="sr-only" htmlFor={`${idPrefix}-scene-choice`}>{t("Escena")}</label><select id={`${idPrefix}-scene-choice`} value={p.selection} onChange={e => p.onSelection(e.target.value)}>{scenes.map(scene => <option key={scene.id} value={scene.id}>{t(scene.label)}</option>)}</select><button disabled={!p.enabled || p.paused || p.reduced} onClick={p.onPreview}>{t("Reproducir")}</button></div>
    {showCache && <><label className="setting" data-setting="cache"><span><strong>{t("Copia local de recursos")}</strong><small>{t("Opcional · hasta 5 MB")}</small></span><input type="checkbox" role="switch" checked={p.cache} onChange={e => p.onCache(e.target.checked)} /></label>{p.cacheMessage && <p className="setting-note" role="status">{t(p.cacheMessage)}</p>}</>}
    <p className="setting-note">{language === "es" ? "El idioma y el modo de color se guardan en este navegador. Animación y copia opcional se aplican a esta visita. Se respeta el movimiento reducido del sistema." : "Language and color mode are saved in this browser. Animation and optional copy apply to this visit. The system's reduced-motion setting is respected."}</p>
    <McpConnections />
  </>;
}
