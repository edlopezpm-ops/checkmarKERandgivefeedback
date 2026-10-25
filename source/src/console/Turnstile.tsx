import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../i18n";
import { ErrorNotice } from "./ErrorNotice";
import "./turnstile.css";

export type TurnstileDescriptor = { sitekey: string | null; required: boolean };
export type TurnstileAction = "auth_email_request" | "auth_email_verify" | "auth_help" | "auth_google" | "auth_github";
type TurnstileApi = {
  render(container: HTMLElement, options: { sitekey: string; action: TurnstileAction; theme: "light" | "dark"; language: string; size: "flexible"; "response-field": boolean; callback: (token: string) => void; "expired-callback": () => void; "error-callback": () => void; "timeout-callback": () => void }): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};
declare global { interface Window { turnstile?: TurnstileApi } }
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptLoad: Promise<TurnstileApi> | undefined;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptLoad) {
    scriptLoad = new Promise<TurnstileApi>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_URL; script.async = true; script.defer = true;
      const timeout = setTimeout(() => finish(false), 15000);
      function finish(loaded: boolean) {
        clearTimeout(timeout); script.onload = null; script.onerror = null;
        if (loaded && window.turnstile) resolve(window.turnstile);
        else { script.remove(); reject(new Error("TURNSTILE_UNAVAILABLE")); }
      }
      script.onload = () => finish(true); script.onerror = () => finish(false);
      document.head.appendChild(script);
    }).catch(error => { scriptLoad = undefined; throw error; });
  }
  return scriptLoad;
}

/** Each protected surface owns its own widget and single-use callback token. */
export function Turnstile({ descriptor, action, reset, onToken }: { descriptor?: TurnstileDescriptor; action: TurnstileAction; reset: number; onToken: (token: string) => void }) {
  const { language } = useLanguage();
  const l = (es: string, en: string) => language === "es" ? es : en;
  const container = useRef<HTMLDivElement>(null);
  const tokenCallback = useRef(onToken); tokenCallback.current = onToken;
  const widget = useRef<{ api: TurnstileApi; id: string } | undefined>(undefined);
  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "verified" | "expired" | "failed">("loading");
  const [theme, setTheme] = useState<"light" | "dark">(() => document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light"));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    tokenCallback.current("");
    if (!descriptor?.required || !descriptor.sitekey || !container.current) return;
    let active = true; setStatus("loading");
    void loadTurnstile().then(api => {
      if (!active || !container.current) return;
      const invalidate = (next: "expired" | "failed") => { if (active) { tokenCallback.current(""); setStatus(next); } };
      setStatus("ready");
      const id = api.render(container.current, {
        sitekey: descriptor.sitekey!, action, theme, language, size: "flexible", "response-field": false,
        callback: token => { if (active) { tokenCallback.current(token); setStatus("verified"); } },
        "expired-callback": () => invalidate("expired"), "error-callback": () => invalidate("failed"), "timeout-callback": () => invalidate("expired"),
      });
      widget.current = { api, id };
    }).catch(() => { if (active) { tokenCallback.current(""); setStatus("failed"); } });
    return () => { active = false; tokenCallback.current(""); const current = widget.current; widget.current = undefined; if (current) { try { current.api.remove(current.id); } catch { /* The protected action remains blocked without a token. */ } } };
  }, [descriptor?.required, descriptor?.sitekey, action, language, theme, retry]);
  useEffect(() => {
    tokenCallback.current("");
    const current = widget.current;
    if (current) { try { current.api.reset(current.id); setStatus("ready"); } catch { setStatus("failed"); } }
  }, [reset]);
  if (!descriptor?.required) return null;
  return <div className="auth-turnstile" data-turnstile-action={action}>
    <div ref={container} />
    {!descriptor.sitekey ? <ErrorNotice message={l("La verificación de seguridad no está disponible. No se enviará la solicitud.", "Security verification is unavailable. The request will not be sent.")} /> : status === "failed" ? <><ErrorNotice message={l("No se pudo cargar la verificación de seguridad. Inténtalo de nuevo para continuar.", "Security verification could not load. Retry to continue.")} /><button type="button" onClick={() => setRetry(value => value + 1)}>{l("Reintentar verificación", "Retry verification")}</button></> : <small role="status">{status === "verified" ? l("Verificación completada.", "Verification complete.") : status === "expired" ? l("La verificación caducó. Completa una nueva para continuar.", "Verification expired. Complete a new one to continue.") : l("Completa la verificación de seguridad para continuar.", "Complete security verification to continue.")}</small>}
    {status === "expired" && <button type="button" onClick={() => setRetry(value => value + 1)}>{l("Renovar verificación", "Renew verification")}</button>}
  </div>;
}
