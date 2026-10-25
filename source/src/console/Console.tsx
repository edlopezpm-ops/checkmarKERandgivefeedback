import {
  useEffect,
  useRef,
  useState,
  lazy,
  Suspense,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ErrorNotice } from "./ErrorNotice";
import {
  platforms,
  sourceInUse,
  type Account,
  type Campaign,
  type Command,
  type Post,
  type Product,
  type Source,
  type Workspace,
} from "../core/domain";
import {
  exportText,
  loadWorkspace,
  request,
  sendCommand,
} from "../core/client";

import { useLanguage } from "../i18n";
import { Help } from "./Help";
import type { StudioAgentContext, AgentStudioUpdate } from "./agent-context";
import "./agents.css";
import { AuthenticationSettings, ProviderSignIn, type AuthSession, type OAuthProvider } from "./Authentication";
import { Turnstile } from "./Turnstile";
import type { ProfileResponse } from "./Profile";
import { captureMcpResume, resumeMcpLogin } from "./mcp-resume";

const TextSimulation = import.meta.env.DEV ? lazy(() => import("./TextSimulation")) : null;
const Studio = lazy(() => import("./Studio"));
const Settings = lazy(() => import("./Settings"));
const Agents = lazy(() => import("./Agents"));
const Profile = lazy(() => import("./Profile"));
const DeletionProgress = lazy(() => import("./Profile").then(module => ({ default: module.DeletionProgress })));

type Tab =
  "overview" | "products" | "accounts" | "space" | "campaigns" | "queue" | "settings" | "profile";
type Editor =
  | { kind: "product"; item?: Product }
  | { kind: "account"; item?: Account }
  | { kind: "source"; item?: Source }
  | { kind: "campaign" }
  | { kind: "post"; item: Post };
const navigation: [Tab, string][] = [
  ["overview", "Resumen"],
  ["products", "Productos"],
  ["accounts", "Cuentas"],
  ["space", "Space"],
  ["campaigns", "Campañas"],
  ["queue", "Drafting"],
  ["settings", "Ajustes"],
];
function sectionFromHash(): Tab {
  const value = location.hash.slice(1);
  return value === "profile" || navigation.some(([id]) => id === value) ? value as Tab : "overview";
}
const statusLabels: Record<string, string> = {
  preparation: "En preparación",
  available: "Disponible",
  paused: "Pausada",
  draft: "Borrador",
  ready: "Lista",
  scheduled: "Programada externamente",
  published: "Publicación confirmada",
};
const formatDate = (value: string, language: string, timezone?: string) =>
  value
    ? new Intl.DateTimeFormat(language, {
        dateStyle: "medium",
        timeStyle: "short",
        ...(timezone ? { timeZone: timezone } : {}),
      }).format(new Date(value))
    : "Sin fecha";
function Empty({ children }: { children: ReactNode }) {
  return <p className="empty-state">{children}</p>;
}
function Badge({ value }: { value: string }) {
  const { t } = useLanguage();
  return (
    <span className={`badge status-${value}`}>
      {t(statusLabels[value] ?? value)}
    </span>
  );
}
function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <label className={wide ? "form-field wide" : "form-field"}>
      <span>{t(label)}</span>
      {children}
    </label>
  );
}
function values(form: HTMLFormElement): Record<string, unknown> {
  return Object.fromEntries(new FormData(form));
}

export function Console({ onAccessChange, environment }: { onAccessChange?: (authenticated: boolean) => void; environment?: ReactNode }) {
  const { language, t } = useLanguage();
  const l = (es: string, en: string) => language === "es" ? es : en;
  const date = (value: string, timezone?: string) => value ? formatDate(value, language, timezone) : t("Sin fecha");
  const [codeRequested, setCodeRequested] = useState(false);
  const [authReturn, setAuthReturn] = useState(() => {
    const url = new URL(location.href), value = url.searchParams.get("auth");
    if (!value || !["google-linked", "github-linked", "signed-in", "failed"].includes(value)) return "";
    url.searchParams.delete("auth");
    if (value === "google-linked" || value === "github-linked") url.hash = "settings";
    history.replaceState(null, "", url);
    return value;
  });
  const [loginFailed, setLoginFailed] = useState(false);
  const [accessHelpOpen, setAccessHelpOpen] = useState(false);
  const [accessHelpBusy, setAccessHelpBusy] = useState(false);
  const [accessHelpError, setAccessHelpError] = useState("");
  const [accessHelpMessage, setAccessHelpMessage] = useState("");
  const [emailCaptcha, setEmailCaptcha] = useState(""), [emailCaptchaReset, setEmailCaptchaReset] = useState(0);
  const [helpCaptcha, setHelpCaptcha] = useState(""), [helpCaptchaReset, setHelpCaptchaReset] = useState(0);
  const [state, setState] = useState<Workspace>();
  const [studioRecording, setStudioRecording] = useState(false);
  const [agentsOpen, setAgentsOpen] = useState(false);
  const [agentsLoaded, setAgentsLoaded] = useState(false);
  const [studioView, setStudioView] = useState<"space" | "campaigns">("space");
  const [studioMounted, setStudioMounted] = useState(false);
  const [agentContext, setAgentContext] = useState<StudioAgentContext>({ materialIds: [], materials: [] });
  const [agentUpdate, setAgentUpdate] = useState<AgentStudioUpdate>();
  const agentsTrigger = useRef<HTMLButtonElement>(null);
  const [studioSummary, setStudioSummary] = useState<{ materials: number; campaigns: number; drafts: number; render: boolean }>();
  const [session, setSession] = useState<AuthSession>();
  const [accountProfile, setAccountProfile] = useState<ProfileResponse>();
  const [profileError, setProfileError] = useState("");
  const [profileMounted, setProfileMounted] = useState(false);
  const accountMenuRef = useRef<HTMLDetailsElement>(null);
  const accountSummaryRef = useRef<HTMLElement>(null);
  const [tab, setTab] = useState<Tab>(sectionFromHash),
    [editor, setEditor] = useState<Editor>();
  const [filter, setFilter] = useState(""),
    [productFilter, setProductFilter] = useState(""),
    [accountFilter, setAccountFilter] = useState(""),
    [week, setWeek] = useState("");
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const captchaDescriptor = session?.mode === "hosted" ? session.turnstile : undefined;
  const emailCaptchaReady = !captchaDescriptor?.required || !!emailCaptcha;
  const helpCaptchaReady = !captchaDescriptor?.required || !!helpCaptcha;
  const authNotice = authReturn === "google-linked" && session?.methods?.google.bound ? l("Tu cuenta de Google quedó vinculada a este espacio.", "Your Google account is now linked to this workspace.") : authReturn === "github-linked" && session?.methods?.github?.bound ? l("Tu cuenta de GitHub quedó vinculada a este espacio.", "Your GitHub account is now linked to this workspace.") : authReturn === "signed-in" && session?.auth_method === "google" ? l("Entraste con Google.", "You signed in with Google.") : authReturn === "signed-in" && session?.auth_method === "github" ? l("Entraste con GitHub.", "You signed in with GitHub.") : authReturn === "failed" ? l("No se pudo completar el acceso con el proveedor. Puedes volver a intentarlo o entrar por correo.", "Provider sign-in could not be completed. Try again or sign in with email.") : "";
  useEffect(() => {
    const navigate = () => {
      if (studioRecording) { history.replaceState(null, "", `#${tab}`); return; }
      setTab(sectionFromHash());
    };
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, [studioRecording, tab]);
  useEffect(() => {
    if (tab === "space" || tab === "campaigns") { setStudioView(tab); setStudioMounted(true); }
    if (tab === "profile") setProfileMounted(true);
  }, [tab]);
  useEffect(() => { if (location.hash !== `#${tab}`) history.replaceState(null, "", `#${tab}`); }, [tab]);
  async function refresh() {
    setError("");
    try {
      const result = await request<NonNullable<typeof session>>("/api/session");
      if (resumeMcpLogin(window, result.authenticated)) return;
      setSession(result);
      if (result.authenticated) setState(await loadWorkspace());
      else setState(undefined);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    captureMcpResume(window);
    void refresh();
  }, []);
  useEffect(() => { onAccessChange?.(!!session?.authenticated); }, [session?.authenticated, onAccessChange]);
  useEffect(() => {
    if (!session?.authenticated) { setAccountProfile(undefined); setProfileError(""); return; }
    let active = true;
    setProfileError("");
    void request<ProfileResponse>("/api/profile").then(value => { if (active) setAccountProfile(value); }).catch(e => { if (active) setProfileError((e as Error).message); });
    return () => { active = false; };
  }, [session?.authenticated, session?.mode, session?.user?.id]);
  async function reloadProfile() {
    const value = await request<ProfileResponse>("/api/profile");
    setAccountProfile(value); setProfileError(""); return value;
  }
  function accountDeleted() {
    setState(undefined); setEditor(undefined); setAccountProfile(undefined); setProfileMounted(false);
    setSession(current => current && { ...current, authenticated: false, user: undefined, account: { status: "deleted" } });
    setMessage(""); setError("");
    void refresh();
  }
  function accountDeleting() {
    setState(undefined); setEditor(undefined); setAccountProfile(undefined); setProfileMounted(false);
    setSession(current => current && { ...current, authenticated: false, user: undefined, account: { status: "deleting" } });
    setMessage(""); setError("");
  }
  useEffect(() => {
    if (tab !== "overview" || !session?.authenticated) return;
    let current = true;
    setStudioSummary(undefined);
    void request<{ state: { materials: unknown[]; campaigns: unknown[]; variants: Array<{ status: string }> }; capabilities: { render: boolean } }>("/api/studio")
      .then(result => { if (current) setStudioSummary({ materials: result.state.materials.length, campaigns: result.state.campaigns.length, drafts: result.state.variants.filter(variant => variant.status !== "approved").length, render: result.capabilities.render }); })
      .catch(() => { /* Module reports its error; unknown counts stay visibly unknown. */ });
    return () => { current = false; };
  }, [tab, session?.authenticated, state?.revision]);
  async function command(command: Command): Promise<boolean> {
    if (!state || busy) return false;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      setState(await sendCommand(state.revision, command));
      setMessage("Guardado.");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!emailCaptchaReady) { setError(l("Completa la verificación de seguridad para continuar.", "Complete security verification to continue.")); return; }
    const data = values(event.currentTarget);
    setBusy(true);
    setError("");
    setLoginFailed(false);
    setAuthReturn("");
    setAccessHelpOpen(false);
    setAccessHelpError("");
    setAccessHelpMessage("");
    try {
      if (session?.authFlow === 'code' && !codeRequested) {
        await request('/api/auth/request', { email: data.email, captchaToken: emailCaptcha });
        setCodeRequested(true);
      } else {
        await request(session?.authFlow === 'code' ? '/api/auth/verify' : '/api/login', { ...data, captchaToken: emailCaptcha });
        setCodeRequested(false);
        await refresh();
      }
    } catch (e) {
      setError((e as Error).message);
      setLoginFailed(session?.mode === "hosted");
    } finally {
      setEmailCaptcha(""); setEmailCaptchaReset(value => value + 1);
      setBusy(false);
    }
  }
  async function oauthAuth(provider: OAuthProvider, intent: "login" | "link", captchaToken: string) {
    if (busy) return;
    if (captchaDescriptor?.required && !captchaToken) { setError(l("Completa la verificación de seguridad para continuar.", "Complete security verification to continue.")); return; }
    setBusy(true); setError(""); setAuthReturn("");
    try {
      const result = await request<{ url: string }>(`/api/auth/${provider}/start`, { intent, captchaToken });
      const target = new URL(result.url);
      const allowed = provider === "google" ? target.origin === "https://accounts.google.com" && target.pathname === "/o/oauth2/v2/auth" : target.origin === "https://github.com" && target.pathname === "/login/oauth/authorize";
      if (!allowed || target.username || target.password) throw new Error("AUTH_UNAVAILABLE");
      window.location.assign(target.href);
    } catch (error) {
      const messages: Record<string, string> = {
        GOOGLE_NOT_CONFIGURED: l("La conexión de Google está pendiente de configuración. Puedes entrar por correo.", "Google setup is pending. You can sign in with email."),
        GOOGLE_NOT_LINKED: l("Entra por correo y vincula Google desde Ajustes → Acceso.", "Sign in with email and link Google in Settings → Access."),
        GITHUB_NOT_CONFIGURED: l("La conexión de GitHub está pendiente de configuración. Puedes entrar por correo.", "GitHub setup is pending. You can sign in with email."),
        GITHUB_NOT_LINKED: l("Entra por correo y vincula GitHub desde Ajustes → Acceso.", "Sign in with email and link GitHub in Settings → Access."),
        FRESH_EMAIL_PROOF_REQUIRED: l("Vuelve a entrar con un código de correo para vincular esta cuenta.", "Sign in again using an email code to link this account."),
      };
      setError(messages[(error as Error).message] ?? (error as Error).message);
    } finally { setBusy(false); }
  }
  async function sendAccessHelp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (accessHelpBusy) return;
    if (!helpCaptchaReady) { setAccessHelpError(l("Completa la verificación de seguridad para continuar.", "Complete security verification to continue.")); return; }
    const email = new FormData(event.currentTarget).get("email");
    setAccessHelpBusy(true);
    setAccessHelpError("");
    setAccessHelpMessage("");
    try {
      await request("/api/auth/help", { email, language, captchaToken: helpCaptcha });
      setAccessHelpMessage("Solicitud procesada. Las instrucciones de acceso sólo se envían al correo autorizado.");
    } catch (e) {
      setAccessHelpError((e as Error).message);
    } finally {
      setHelpCaptcha(""); setHelpCaptchaReset(value => value + 1);
      setAccessHelpBusy(false);
    }
  }
  function remove(type: string, id: string, description: string) {
    if (
      confirm(
        `${description}\n${t("Se borrará el registro activo de marKER. ¿Continuar?")}`,
      )
    )
      void command({ type, data: { id, confirmed: true } });
  }
  async function copy(post: Post) {
    try {
      await navigator.clipboard.writeText(post.text);
      setMessage("Texto copiado. La entrega sigue pendiente.");
    } catch {
      setError("No se pudo copiar. Puedes exportar el texto.");
    }
  }
  function closeAccountMenu() {
    if (accountMenuRef.current) accountMenuRef.current.open = false;
  }
  async function reload() {
    if (busy) return;
    closeAccountMenu();
    setBusy(true);
    try {
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    if (busy) return;
    closeAccountMenu();
    setBusy(true);
    setError("");
    try {
      await request("/api/auth/logout", {});
      setState(undefined);
      setEditor(undefined);
      setSession(current => current && { ...current, authenticated: false, user: undefined });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const accountEmail = accountProfile?.profile.email ?? session?.user?.email;
  const localPart = accountEmail?.split("@")[0] ?? "";
  const sessionName = accountProfile?.profile.name;
  const nameParts = sessionName?.trim().split(/\s+/).filter(Boolean) ?? [];
  const emailParts = localPart.split(/[._+-]+/).filter(Boolean);
  const initialParts = nameParts.length > 1 ? nameParts : emailParts;
  const initials = accountProfile?.profile.initials || (initialParts.length > 1
    ? [initialParts[0], initialParts[initialParts.length - 1]].map(part => part[0]).join("").toUpperCase()
    : localPart ? localPart.slice(0, 2).toUpperCase() : language === "es" ? "SL" : "LS");
  const accountTarget = document.getElementById("account-controls");
  const accountMenu = session?.authenticated && accountTarget ? createPortal(
    <><details className="account-menu" name="toolbar-menu" ref={accountMenuRef} onKeyDown={event => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAccountMenu();
        accountSummaryRef.current?.focus();
      }
    }}>
      <summary className="account-summary" ref={accountSummaryRef} aria-label={`${t("Menú de usuario")} (${initials})`}>
        <span className="account-initials" aria-hidden="true">{initials}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
      </summary>
      <div className="account-panel">
        {sessionName && <p className="account-name">{sessionName}</p>}
        <p className="account-email">{accountEmail ?? (session.mode === "local" ? t("Sesión local") : t("Cuenta"))}</p>
        <button type="button" onClick={() => { if (!studioRecording) { closeAccountMenu(); setTab("profile"); } }} disabled={busy || studioRecording}>{l("Perfil", "Profile")}</button>
        <button type="button" onClick={() => { if (!studioRecording) { closeAccountMenu(); setTab("settings"); } }} disabled={busy || studioRecording}>{t("Ajustes")}</button>
        <button type="button" onClick={() => void reload()} disabled={busy}>{t("Recargar")}</button>
      </div>
    </details>
      {session.mode === "hosted" && <button type="button" className="account-signout" onClick={() => void logout()} disabled={busy}>{t("Cerrar sesión")}</button>}
    </>, accountTarget,
  ) : null;
  if (!state)
    return (
      <section className={`console app-content${agentsOpen ? " with-agents" : ""}`} aria-label={t("Consola de marKER")}>
        {accountMenu}
        {authNotice && (authReturn === "failed" ? <ErrorNotice message={authNotice} /> : <p role="status" className="success-message">{authNotice}</p>)}
        {error && (
          <ErrorNotice message={t(error)} />
        )}
        {session?.account?.status === "deleting" ? <Suspense fallback={<p role="status">{l("Comprobando el borrado…", "Checking deletion…")}</p>}><DeletionProgress onDeleted={accountDeleted} /></Suspense> : session?.account?.status === "deleted" ? <div className="login-form"><h1>{l("Cuenta cerrada", "Account closed")}</h1><p role="status">{l("La cuenta, los registros y los archivos activos de este espacio fueron eliminados.", "The account, workspace records and active files have been deleted.")}</p><p>{l("Las partes de subidas incompletas sin registro caducan en hasta siete días. Consulta Privacidad para los límites y las copias externas.", "Unregistered incomplete upload parts expire within seven days. See Privacy for limits and external copies.")}</p></div> : !session ? (
          <div className="login-form">
            <p>{t("Cargando el espacio…")}</p>
            {error && <button type="button" className="text-button" disabled={busy} onClick={() => void reload()}>{t("Recargar")}</button>}
          </div>
        ) : session.configured === false ? (
          <Empty>
            {t("El acceso privado todavía no está configurado en este entorno. ")}</Empty>
        ) : session.authenticated ? (
          <p>{t("Cargando el espacio…")}</p>
        ) : (
          <form onSubmit={login} className="login-form">
            <h1>{t("Tu espacio de marketing")}</h1>
            <p>{l("Un espacio personal, una cuenta.", "One personal workspace, one account.")}</p>
            <ProviderSignIn session={session} busy={busy} onOAuth={oauthAuth} />
            {!codeRequested && <Field label="Correo">
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
              />
            </Field>}
            {session.authFlow !== 'code' && <Field label="Contraseña">
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>}
            {codeRequested && <><p className="muted" role="status">{t("Si el correo está autorizado, recibirás un código de ocho dígitos. Caduca en cinco minutos y sólo funciona en este navegador.")}</p><Field label="Código de ocho dígitos"><input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{8}" minLength={8} maxLength={8} required autoFocus /></Field></>}
            <Turnstile descriptor={captchaDescriptor} action={codeRequested || session.authFlow !== "code" ? "auth_email_verify" : "auth_email_request"} reset={emailCaptchaReset} onToken={setEmailCaptcha} />
            <button className="primary" disabled={busy || !emailCaptchaReady}>
              {busy ? t("Un momento…") : session.authFlow === 'code' && !codeRequested ? l("Continuar con correo", "Continue with email") : t("Entrar")}
            </button>
            {codeRequested && <button type="button" disabled={busy} className="text-button" onClick={() => { setEmailCaptcha(""); setEmailCaptchaReset(value => value + 1); setCodeRequested(false); }}>{t("Usar otro correo o solicitar otro código")}</button>}
          </form>
        )}
        {loginFailed && session?.mode === "hosted" && !session.authenticated && !session.account && (
          <div className="login-form module-help access-help">
            <p>
              {t("¿Tienes problemas para acceder?")}{" "}
              <button type="button" className="help-link" aria-expanded={accessHelpOpen} aria-controls="access-help-form" onClick={() => setAccessHelpOpen(true)}>
                {t("Obtener ayuda")}
              </button>
            </p>
            {accessHelpOpen && (
              <form id="access-help-form" className="login-form access-help-form" onSubmit={sendAccessHelp} aria-label={t("Ayuda de acceso")}>
                <Field label="Dirección de correo para las instrucciones">
                  <input name="email" type="email" autoComplete="email" required autoFocus disabled={accessHelpBusy} />
                </Field>
                <Turnstile descriptor={captchaDescriptor} action="auth_help" reset={helpCaptchaReset} onToken={setHelpCaptcha} />
                <div className="record-actions">
                  <button type="submit" className="primary" disabled={accessHelpBusy || !helpCaptchaReady}>{accessHelpBusy ? t("Enviando…") : t("Enviar ayuda")}</button>
                  <button type="button" disabled={accessHelpBusy} onClick={() => setAccessHelpOpen(false)}>{t("Cancelar")}</button>
                </div>
                {accessHelpError && <ErrorNotice message={t(accessHelpError)} />}
                {accessHelpMessage && <p className="success-message" role="status">{t(accessHelpMessage)}</p>}
              </form>
            )}
          </div>
        )}
      </section>
    );
  const productName = (id: string) =>
    state.products.find((p) => p.id === id)?.name ?? t("Producto");
  const accountName = (id: string) =>
    state.accounts.find((a) => a.id === id)?.name ?? t("Cuenta");
  const matches = (value: string) =>
    value.toLocaleLowerCase().includes(filter.toLocaleLowerCase());
  const activeProduct = (id: string) => !productFilter || productFilter === id;
  const posts = state.posts
    .filter((post) => {
      const campaign = state.campaigns.find((c) => c.id === post.campaignId)!;
      const timezone = state.accounts.find(
        (a) => a.id === post.accountId,
      )?.timezone;
      return (
        activeProduct(campaign.productId) &&
        (!accountFilter || accountFilter === post.accountId) &&
        matches(
          `${post.text} ${campaign.title} ${accountName(post.accountId)} ${state.accounts.find((a) => a.id === post.accountId)?.platform}`,
        ) &&
        (!week ||
          (post.scheduledAt &&
            (() => {
              const local = new Date(
                new Date(post.scheduledAt).toLocaleString("en-US", {
                  timeZone: timezone,
                }),
              );
              const start = new Date(`${week}T00:00:00`),
                end = new Date(start);
              end.setDate(end.getDate() + 7);
              return local >= start && local < end;
            })()))
      );
    })
    .sort((a, b) =>
      (a.scheduledAt || "9999").localeCompare(b.scheduledAt || "9999"),
    );
  return (
    <section className={`console app-content${agentsOpen ? " with-agents" : ""}`} aria-label={t("Consola de marKER")}>
      {accountMenu}
      {authNotice && (authReturn === "failed" ? <ErrorNotice message={authNotice} /> : <p role="status" className="success-message">{authNotice}</p>)}
      <div className="console-notice">
        {session?.mode === "local" && <span>{t("Espacio local · guardado en este equipo")}</span>}
        <p className="eyebrow workspace-label">{t("TU MESA DE TRABAJO")}</p>
      </div>
      <nav className="console-nav" aria-label={t("Módulos")}>
        {navigation.map(([id, name]) => (
          <button
            key={id}
            disabled={studioRecording && tab !== id}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => {
              setTab(id);
              setFilter("");
              setProductFilter("");
            }}
          >
            {t(name)}
          </button>
        ))}
      </nav>
      <div className="agents-launcher"><button ref={agentsTrigger} type="button" aria-controls="marker-agents" aria-expanded={agentsOpen} onClick={() => { setAgentsLoaded(true); setAgentsOpen(value => !value); }}>{language === "es" ? "Agentes" : "Agents"} <span aria-hidden="true">↗</span></button></div>
      <div className="console-heading">
        <div>
          <p className="eyebrow workspace-divider" aria-hidden="true">–––</p>
          <h1>{tab === "profile" ? l("Perfil", "Profile") : t(navigation.find(([id]) => tab === id)![1])}</h1>
        </div>
        {(tab === "products" || tab === "accounts") && (
          <button
            className="primary"
            disabled={busy || (tab === "accounts" && !state.products.length)}
            onClick={() =>
              setEditor(
                tab === "products" ? { kind: "product" } : { kind: "account" },
              )
            }
          >
            {tab === "products" ? t("Nuevo producto") : t("Nueva cuenta")}
          </button>
        )}
      </div>
      {error && (
        <ErrorNotice message={t(error)} />
      )}
      {message && (
        <p role="status" className="success-message">
          {t(message)}
        </p>
      )}
      {(tab === "products" || tab === "accounts" || tab === "queue") && (
        <div className="filters">
          <Field label="Buscar">
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t("Buscar en esta vista")}
            />
          </Field>
          {tab !== "products" && (
            <Field label="Producto">
              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
              >
                <option value="">{t("Todos los productos")}</option>
                {state.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {tab === "queue" && (
            <>
              <Field label="Cuenta">
                <select
                  value={accountFilter}
                  onChange={(e) => setAccountFilter(e.target.value)}
                >
                  <option value="">{t("Todas las cuentas")}</option>
                  {state.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.platform} {" · "}{a.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Semana desde (zona de cada cuenta)">
                <input
                  type="date"
                  value={week}
                  onChange={(e) => setWeek(e.target.value)}
                />
              </Field>
            </>
          )}
        </div>
      )}
      {tab === "overview" && (
        <>
          <div className="stats">
            {[
              [t("Productos"), state.products.length, "products"],
              [
                t("Material disponible"),
                studioSummary ? state.sources.length + studioSummary.materials : "—",
                "space",
              ],
              [t("Campañas"), studioSummary ? state.campaigns.length + studioSummary.campaigns : "—", "campaigns"],
              [
                t("Por revisar"),
                state.posts.filter((p) => p.status === "draft").length,
                "queue",
              ],
            ].map(([label, count, target]) => (
              <button
                className="stat"

                onClick={() => setTab(target as Tab)}
               key={label}>
                <span>{t(String(label))}</span>
                <strong>{count}</strong>
              </button>
            ))}
          </div>
          <div className="overview-grid">
            <article className="surface">
              <h2>{t("Del material a la publicación")}</h2>
              <ol className="workflow-list">
                <li>{t("Registra tu producto y sus hechos aprobados.")}</li>
                <li>{t("Captura videos, fotos, audio o ideas en Space.")}</li>
                <li>{t("Clasifica ahora o después; conserva los originales.")}</li>
                <li>{t("Combina material y texto con una plantilla en Campañas.")}</li>
                <li>{t("Previsualiza, aprueba y exporta la pieza. Publícala tú en la red.")}</li>
              </ol>
              <button
                className="text-button"
                onClick={() => {
                  setTab("products");
                  if (!state.products.length) setEditor({ kind: "product" });
                }}
              >
                {t("Abrir productos → ")}</button>
            </article>
            <article className="surface">
              <h2>{t("Conexiones y capacidades")}</h2>
              <ul className="capability-list">
                <li>
                  <span>{t("Entrega social")}</span>
                  <Badge value="Manual" />
                </li>
                <li>
                  <span>{language === "es" ? "Asistente" : "Assistant"}</span>
                  <button type="button" onClick={() => { setAgentsLoaded(true); setAgentsOpen(true); }}>{language === "es" ? "Ver estado en Agentes" : "Check Agents status"}</button>
                </li>
                <li>
                  <span>{t("Video y audio")}</span>
                  <Badge value={studioSummary?.render ? "Montaje disponible" : "Pendiente de validación"} />
                </li>
                <li>
                  <span>{t("Campañas pagas")}</span>
                  <Badge value="Preparación pausada" />
                </li>
              </ul>
              <p className="muted">
                {language === "es" ? "Conecta tu asistente desde Agentes y continúa la conversación allí. Revisa y aprueba sus resultados en marKER; la publicación sigue siendo manual." : "Connect your assistant from Agents and continue the conversation there. Review and approve its results in marKER; publishing remains manual."}</p>
            </article>
          </div>
        </>
      )}
      {tab === "products" && (
        <div className="record-grid">
          {state.products
            .filter((p) => matches(`${p.name} ${p.description}`))
            .map((p) => (
              <article className="surface"  key={p.id}>
                <div className="record-top">
                  <h2>{p.name}</h2>
                  <Badge value={p.status} />
                </div>
                <p className="preserve">
                  {p.description || t("Sin descripción aprobada.")}
                </p>
                <p className="muted">
                  {p.audience || t("Audiencia pendiente")} {" ·"}{" "}
                  {p.language || t("Idioma pendiente")}
                </p>
                {p.url && (
                  <a href={p.url} target="_blank" rel="noopener noreferrer">
                    {t("Sitio del producto ↗ ")}</a>
                )}
                <div className="record-actions">
                  <button
                    onClick={() => setEditor({ kind: "product", item: p })}
                  >
                    {t("Editar ")}</button>
                  <button
                    className="text-button"
                    onClick={() =>
                      remove("product.delete", p.id, `${t("Eliminar")} ${p.name}.`)
                    }
                  >
                    {t("Eliminar ")}</button>
                </div>
              </article>
            ))}
          {!state.products.length && (
            <Empty>
              {t("Empieza por un producto. Añade únicamente información que hayas aprobado. ")}</Empty>
          )}
        </div>
      )}
      {tab === "accounts" && (
        <div className="record-grid">
          {state.accounts
            .filter(
              (a) =>
                (!productFilter || a.productIds.includes(productFilter)) &&
                matches(`${a.name} ${a.platform}`),
            )
            .map((a) => (
              <article className="surface"  key={a.id}>
                <div className="record-top">
                  <h2>{a.name}</h2>
                  <Badge value={a.platform} />
                </div>
                <p>{a.productIds.map(productName).join(" · ")}</p>
                <p className="muted">{t("Entrega manual · ")}{a.timezone}</p>
                <a href={a.url} target="_blank" rel="noopener noreferrer">
                  {t("Abrir cuenta ↗ ")}</a>
                <div className="record-actions">
                  <button
                    onClick={() => setEditor({ kind: "account", item: a })}
                  >
                    {t("Editar ")}</button>
                  <button
                    className="text-button"
                    onClick={() =>
                      remove(
                        "account.delete",
                        a.id,
                        `${t("Eliminar la cuenta")} ${a.name}.`,
                      )
                    }
                  >
                    {t("Eliminar ")}</button>
                </div>
              </article>
            ))}
          {!state.accounts.length && (
            <Empty>
              {t("Registra una cuenta y los productos que admite. Registrar una cuenta no conecta su API. ")}</Empty>
          )}
        </div>
      )}
      {(studioMounted || tab === "space" || tab === "campaigns") && <div hidden={tab !== "space" && tab !== "campaigns"}><Suspense fallback={<p>{t("Cargando…")}</p>}><Studio view={tab === "space" || tab === "campaigns" ? tab : studioView} workspace={state} onRecordingChange={setStudioRecording} onOpenCampaigns={() => setTab("campaigns")} onContext={setAgentContext} agentUpdate={agentUpdate} /></Suspense></div>}
      {tab === "settings" && <><AuthenticationSettings session={session} busy={busy} onOAuth={oauthAuth} onEmailProof={() => void logout()} /><Suspense fallback={<p>{t("Cargando…")}</p>}><Settings environment={environment} /></Suspense></>}
      {(profileMounted || tab === "profile") && <div hidden={tab !== "profile"}><Suspense fallback={<p>{t("Cargando…")}</p>}><Profile value={accountProfile} loadError={profileError} local={session?.mode === "local"} onReload={reloadProfile} onChange={setAccountProfile} onEmailProof={() => void logout()} onDeleting={accountDeleting} onDeleted={accountDeleted} /></Suspense></div>}
      {tab === "space" && state.sources.length > 0 && (
        <details className="surface">
          <summary>{t("Fuentes de texto anteriores")}</summary>
          <div className="record-grid">
            {state.sources
              .filter(
                (s) =>
                  activeProduct(s.productId) && matches(`${s.title} ${s.text}`),
              )
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((s) => (
                <article className="surface"  key={s.id}>
                  <div className="record-top">
                    <h2>{s.title}</h2>
                    <Badge
                      value={
                        sourceInUse(state, s.id) ? t("En campaña") : t("Disponible")
                      }
                    />
                  </div>
                  <p className="muted">
                    {productName(s.productId)} {t(" · Ingreso ")}{date(s.createdAt)}
                    {s.declaredDate && ` · ${t("Material")} ${s.declaredDate}`}
                  </p>
                  <details>
                    <summary>{t("Leer material")}</summary>
                    <p className="source-content">{s.text}</p>
                  </details>
                  <div className="record-actions">
                    <button
                      disabled={sourceInUse(state, s.id)}
                      onClick={() => setEditor({ kind: "source", item: s })}
                    >
                      {t("Editar ")}</button>
                    <button
                      className="text-button"
                      disabled={sourceInUse(state, s.id)}
                      onClick={() =>
                        remove(
                          "source.delete",
                          s.id,
                          `${t("Eliminar el texto original de")} ${s.title}.`,
                        )
                      }
                    >
                      {t("Eliminar ")}</button>
                  </div>
                </article>
              ))}
            {!state.sources.length && (
              <Empty>
                {t("Guarda material en el Space de un producto. Las fuentes se conservan mientras una campaña las necesita. ")}</Empty>
            )}
          </div>
        </details>
      )}
      {tab === "campaigns" && state.campaigns.length > 0 && (
        <details className="surface"><summary>{t("Campañas editoriales anteriores")}</summary>
        <div className="record-grid">
          {state.campaigns
            .filter(
              (c) =>
                activeProduct(c.productId) &&
                matches(`${c.title} ${c.objective}`),
            )
            .map((c) => (
              <article className="surface"  key={c.id}>
                <div className="record-top">
                  <h2>{c.title}</h2>
                  <Badge value={c.status} />
                </div>
                <p className="muted">
                  {productName(c.productId)} {" ·"}{" "}
                  {c.kind === "paid"
                    ? `${t("Propuesta paga")} · ${c.currency} ${c.budget} · ${t("sin gasto autorizado")}`
                    : t("Orgánica")}
                </p>
                <p className="preserve">{c.objective}</p>
                <p className="muted">
                  {c.sourceIds.length} {t(" fuentes ·")}{" "}
                  {state.posts.filter((p) => p.campaignId === c.id).length}{" "}
                  {t("publicaciones ")}</p>
                <div className="record-actions">
                  <button
                    onClick={() => {
                      setTab("queue");
                      setFilter(c.title);
                    }}
                  >
                    {t("Revisar borradores ")}</button>
                  <button
                    className="text-button"
                    onClick={() =>
                      remove(
                        "campaign.delete",
                        c.id,
                        `${t("Eliminar la campaña")} ${c.title} ${t("y liberar sus referencias al material.")}`,
                      )
                    }
                  >
                    {t("Eliminar ")}</button>
                </div>
              </article>
            ))}
          {!state.campaigns.length && (
            <Empty>
              {t("Para crear una campaña necesitas un producto, material y una cuenta compatible. ")}</Empty>
          )}
        </div>
        </details>
      )}
      {tab === "queue" && (
        <div className="queue-list">
          {TextSimulation && session?.mode === "local" && <Suspense fallback={null}>
            <TextSimulation workspace={state} disabled={busy} onSaved={saved => { setState(saved); setMessage("Guardado."); }} />
          </Suspense>}
          {posts.map((p) => {
            const campaign = state.campaigns.find(
                (c) => c.id === p.campaignId,
              )!,
              account = state.accounts.find((a) => a.id === p.accountId)!;
            return (
              <article className="surface queue-card"  key={p.id}>
                <div>
                  <div className="record-top">
                    <h2>
                      {account.platform} {" · "}{account.name}
                    </h2>
                    <Badge value={p.status} />
                  </div>
                  <p className="muted">
                    {campaign.title} {" · "}{productName(campaign.productId)} {" ·"}{" "}
                    {date(p.scheduledAt, account.timezone)}
                    {p.scheduledAt && ` (${account.timezone})`}
                  </p>
                  <p className="post-copy">
                    {p.text ||
                      t("Borrador vacío. Redacta la variante con sus fuentes.")}
                  </p>
                  {p.externalUrl && (
                    <a
                      target="_blank"
                      rel="noopener noreferrer"
                      href={p.externalUrl}
                    >
                      {t("Evidencia externa ↗ ")}</a>
                  )}
                </div>
                <div className="record-actions">
                  <button
                    disabled={
                      p.status === "published" || p.status === "scheduled"
                    }
                    onClick={() => setEditor({ kind: "post", item: p })}
                  >
                    {t("Revisar ")}</button>
                  <button disabled={!p.text} onClick={() => void copy(p)}>
                    {t("Copiar ")}</button>
                  <button
                    disabled={!p.text}
                    onClick={() => {
                      exportText(`marKER-${p.id}.txt`, p.text);
                      setMessage(
                        "Texto exportado. La entrega sigue pendiente.",
                      );
                    }}
                  >
                    {t("Exportar ")}</button>
                  <a
                    className="button-link"
                    href={account.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("Abrir red ↗ ")}</a>
                  <button
                    className="text-button"
                    onClick={() =>
                      remove(
                        "post.delete",
                        p.id,
                        t("Retirar esta publicación y borrar su texto y registro. Sus fuentes siguen protegidas por la campaña."),
                      )
                    }
                  >
                    {t("Retirar y borrar ")}</button>
                </div>
              </article>
            );
          })}
          {!posts.length && (
            <Empty>
              {t("No hay publicaciones para estos filtros. Los borradores aparecerán al crear una campaña. ")}</Empty>
          )}
        </div>
      )}
      {agentsLoaded && <Suspense fallback={agentsOpen ? <p role="status">{t("Cargando…")}</p> : null}><Agents open={agentsOpen} context={agentContext} workspace={state} onClose={() => { setAgentsOpen(false); agentsTrigger.current?.focus(); }} onStudioChange={update => { setAgentUpdate({ ...update, nonce: Date.now() }); if (update.variantId) setTab("campaigns"); }} onOpenStudio={() => { setTab("campaigns"); setAgentsOpen(false); }} /></Suspense>}
      <Help topic={tab} />
      {editor && (
        <EditorDialog
          editor={editor}
          state={state}
          busy={busy}
          error={error}
          close={() => setEditor(undefined)}
          save={command}
        />
      )}
    </section>
  );
}

function EditorDialog({
  editor,
  state,
  busy,
  error,
  close,
  save,
}: {
  editor: Editor;
  state: Workspace;
  busy: boolean;
  error: string;
  close(): void;
  save(command: Command): Promise<boolean>;
}) {
  const { t } = useLanguage();
  const item = "item" in editor ? editor.item : undefined;
  const [productId, setProductId] = useState(
    (item && "productId" in item ? item.productId : undefined) ??
      state.products[0]?.id ??
      "",
  );
  const [kind, setKind] = useState("organic");
  const [sourceText, setSourceText] = useState(
    editor.kind === "source" ? (editor.item?.text ?? "") : "",
  );
  const [fileError, setFileError] = useState("");
  const [confirmMode, setConfirmMode] = useState(false);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const title =
    editor.kind === "product"
      ? t("Producto")
      : editor.kind === "account"
        ? t("Cuenta social")
        : editor.kind === "source"
          ? t("Material del Space")
          : editor.kind === "campaign"
            ? t("Nueva campaña")
            : t("Revisar publicación");
  useEffect(() => {
    const original = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLDialogElement>(".editor-dialog")!;
    dialog.showModal();
    const listener = (e: Event) => {
      e.preventDefault();
      if (!busyRef.current) close();
    };
    dialog.addEventListener("cancel", listener);
    return () => {
      dialog.removeEventListener("cancel", listener);
      dialog.close();
      original?.focus();
    };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      data = values(form),
      fd = new FormData(form);
    if (item) data.id = item.id;
    if (editor.kind === "account") data.productIds = fd.getAll("productIds");
    if (editor.kind === "source") data.text = sourceText;
    if (editor.kind === "campaign") {
      data.sourceIds = fd.getAll("sourceIds");
      data.accountIds = fd.getAll("accountIds");
    }
    if (editor.kind === "post") {
      data.formatConfirmed = fd.has("formatConfirmed");
      data.confirmed = fd.has("confirmed");
    }
    const type =
      editor.kind === "campaign"
        ? "campaign.create"
        : editor.kind === "post" && confirmMode
          ? "post.confirm"
          : `${editor.kind}.save`;
    if (await save({ type, data })) close();
  }
  const productSelect = (
    <Field label="Producto">
      <select
        required
        name="productId"
        value={productId}
        onChange={(e) => setProductId(e.target.value)}
      >
        {state.products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </Field>
  );
  return (
    <dialog className="editor-dialog" aria-labelledby="editor-title">
      <form onSubmit={submit}>
        <div className="dialog-heading">
          <h2 id="editor-title">{title}</h2>
          <button
            type="button"
            className="text-button"
            aria-label={t("Cerrar editor")}
            disabled={busy}
            onClick={close}
          >
            {t("Cerrar × ")}</button>
        </div>
        <div className="editor-fields">
          {editor.kind === "product" && (
            <>
              <Field label="Nombre">
                <input
                  name="name"
                  required
                  maxLength={120}
                  defaultValue={editor.item?.name}
                  autoFocus
                />
              </Field>
              <Field label="Estado comercial">
                <select
                  name="status"
                  defaultValue={editor.item?.status ?? "preparation"}
                >
                  <option value="preparation">{t("En preparación")}</option>
                  <option value="available">{t("Disponible")}</option>
                  <option value="paused">{t("Pausado")}</option>
                </select>
              </Field>
              <Field label="Descripción y hechos aprobados" wide>
                <textarea
                  name="description"
                  maxLength={5000}
                  rows={4}
                  defaultValue={editor.item?.description}
                />
              </Field>
              <Field label="Audiencia">
                <input
                  name="audience"
                  maxLength={1000}
                  defaultValue={editor.item?.audience}
                />
              </Field>
              <Field label="Idioma">
                <input
                  name="language"
                  maxLength={80}
                  defaultValue={editor.item?.language}
                  placeholder={t("Por definir")}
                />
              </Field>
              <Field label="Tono">
                <input
                  name="tone"
                  maxLength={1000}
                  defaultValue={editor.item?.tone}
                />
              </Field>
              <Field label="Llamada a la acción">
                <input
                  name="cta"
                  maxLength={1000}
                  defaultValue={editor.item?.cta}
                />
              </Field>
              <Field label="Sitio web" wide>
                <input
                  name="url"
                  type="url"
                  maxLength={2000}
                  defaultValue={editor.item?.url}
                />
              </Field>
            </>
          )}
          {editor.kind === "account" && (
            <>
              <Field label="Nombre de la cuenta">
                <input
                  name="name"
                  required
                  maxLength={120}
                  defaultValue={editor.item?.name}
                  autoFocus
                />
              </Field>
              <Field label="Red">
                <select
                  name="platform"
                  defaultValue={editor.item?.platform ?? "LinkedIn"}
                >
                  {platforms.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Field>
              <Field label="URL de la cuenta" wide>
                <input
                  name="url"
                  type="url"
                  required
                  maxLength={2000}
                  defaultValue={editor.item?.url}
                />
              </Field>
              <Field label="Zona horaria IANA">
                <input
                  name="timezone"
                  required
                  defaultValue={
                    editor.item?.timezone ??
                    Intl.DateTimeFormat().resolvedOptions().timeZone
                  }
                />
              </Field>
              <Field label="Idioma">
                <input
                  name="language"
                  maxLength={80}
                  defaultValue={editor.item?.language}
                />
              </Field>
              <fieldset className="wide">
                <legend>{t("Productos admitidos")}</legend>
                {state.products.map((p) => (
                  <label className="check-field" key={p.id}>
                    <input
                      type="checkbox" role="switch"
                      name="productIds"
                      value={p.id}
                      defaultChecked={editor.item?.productIds.includes(p.id)}
                    />
                    {p.name}
                  </label>
                ))}
              </fieldset>
              <p className="muted wide">
                {t("Entrega manual. No solicita credenciales ni conecta esta red. ")}</p>
            </>
          )}
          {editor.kind === "source" && (
            <>
              {productSelect}
              <Field label="Título">
                <input
                  name="title"
                  required
                  maxLength={160}
                  defaultValue={editor.item?.title}
                  autoFocus
                />
              </Field>
              <Field label="Fecha declarada del material">
                <input
                  type="date"
                  name="declaredDate"
                  defaultValue={editor.item?.declaredDate}
                />
              </Field>
              <Field label="Importar TXT o MD UTF-8">
                <input
                  type="file"
                  accept=".txt,.md,text/plain,text/markdown"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setFileError("");
                    try {
                      if (
                        !/\.(txt|md)$/i.test(file.name) ||
                        file.size > 256_000
                      )
                        throw new Error(
                          "Admite TXT/MD UTF-8 de hasta 64.000 caracteres.",
                        );
                      const content = new TextDecoder("utf-8", {
                        fatal: true,
                      }).decode(await file.arrayBuffer());
                      if (content.length > 64_000 || /\x00/.test(content))
                        throw new Error("Texto demasiado largo o binario.");
                      setSourceText(content);
                    } catch (e) {
                      setFileError((e as Error).message);
                    }
                  }}
                />
              </Field>
              <Field
                label="Texto / Markdown (se muestra como texto seguro)"
                wide
              >
                <textarea
                  name="text"
                  rows={9}
                  required
                  maxLength={64_000}
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                />
              </Field>
              {fileError && (
                <ErrorNotice message={t(fileError)} className="wide" />
              )}
            </>
          )}
          {editor.kind === "campaign" && (
            <>
              {productSelect}
              <Field label="Nombre de campaña">
                <input name="title" required maxLength={160} autoFocus />
              </Field>
              <Field label="Objetivo" wide>
                <textarea name="objective" required maxLength={2000} rows={3} />
              </Field>
              <Field label="Audiencia">
                <input name="audience" maxLength={1000} />
              </Field>
              <Field label="Tipo">
                <select
                  name="kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                >
                  <option value="organic">{t("Orgánica")}</option>
                  <option value="paid">{t("Propuesta paga · pausada")}</option>
                </select>
              </Field>
              {kind === "paid" && (
                <>
                  <Field label="Moneda ISO (p. ej. USD)">
                    <input
                      name="currency"
                      required
                      pattern="[A-Z]{3}"
                      maxLength={3}
                    />
                  </Field>
                  <Field label="Presupuesto propuesto">
                    <input
                      name="budget"
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                    />
                  </Field>
                  <p className="muted wide">
                    {t("Sólo planificación. La campaña queda pausada; no autoriza ni activa gasto. ")}</p>
                </>
              )}
              <fieldset key={`sources-${productId}`} className="wide">
                <legend>{t("Material de referencia")}</legend>
                {state.sources
                  .filter((s) => s.productId === productId)
                  .map((s) => (
                    <label className="check-field" key={s.id}>
                      <input type="checkbox" role="switch" name="sourceIds" value={s.id} />
                      {s.title}
                      {sourceInUse(state, s.id) ? t(" · compartido") : ""}
                    </label>
                  ))}
                {!state.sources.some((s) => s.productId === productId) && (
                  <p className="muted">{t("Añade material a este producto.")}</p>
                )}
              </fieldset>
              <fieldset key={`accounts-${productId}`} className="wide">
                <legend>{t("Destinos")}</legend>
                {state.accounts
                  .filter((a) => a.productIds.includes(productId))
                  .map((a) => (
                    <label className="check-field" key={a.id}>
                      <input type="checkbox" role="switch" name="accountIds" value={a.id} />
                      {a.platform} {" · "}{a.name}
                    </label>
                  ))}
              </fieldset>
              <p className="muted wide">
                {t("Se crearán borradores vacíos para redactar y revisar por destino. Las fuentes no se borran. ")}</p>
            </>
          )}
          {editor.kind === "post" &&
            (() => {
              const post = editor.item,
                campaign = state.campaigns.find(
                  (c) => c.id === post.campaignId,
                )!;
              return (
                <>
                  <div className="wide source-references">
                    <h3>{t("Fuentes de ")}{campaign.title}</h3>
                    {campaign.sourceIds.map((id) => {
                      const source = state.sources.find((s) => s.id === id)!;
                      return (
                        <details key={id}>
                          <summary>{source.title}</summary>
                          <p className="source-content">{source.text}</p>
                        </details>
                      );
                    })}
                  </div>
                  {!confirmMode ? (
                    <>
                      <Field label="Texto para este destino" wide>
                        <textarea
                          name="text"
                          rows={8}
                          maxLength={20_000}
                          defaultValue={post.text}
                          autoFocus
                        />
                      </Field>
                      <Field label="Horario propuesto (zona de este equipo)">
                        <input
                          type="datetime-local"
                          name="localTime"
                          defaultValue={
                            post.scheduledAt
                              ? new Date(
                                  new Date(post.scheduledAt).getTime() -
                                    new Date(
                                      post.scheduledAt,
                                    ).getTimezoneOffset() *
                                      60_000,
                                )
                                  .toISOString()
                                  .slice(0, 16)
                              : ""
                          }
                          onChange={(e) => {
                            const hidden =
                              e.currentTarget.form?.elements.namedItem(
                                "scheduledAt",
                              ) as HTMLInputElement;
                            hidden.value = e.target.value
                              ? new Date(e.target.value).toISOString()
                              : "";
                          }}
                        />
                        <input
                          name="scheduledAt"
                          type="hidden"
                          defaultValue={post.scheduledAt}
                        />
                      </Field>
                      <Field label="Estado editorial">
                        <select name="status" defaultValue={post.status}>
                          <option value="draft">{t("Borrador")}</option>
                          <option value="ready">
                            {t("Lista para entrega manual ")}</option>
                        </select>
                      </Field>
                      <label className="check-field wide">
                        <input
                          type="checkbox" role="switch"
                          name="formatConfirmed"
                          defaultChecked={post.formatConfirmed}
                        />
                        {t("He revisado hechos, formato, longitud y permisos en el destino. ")}</label>
                      <p className="muted wide">
                        {t("Instagram y TikTok requieren multimedia; sus borradores de texto no pueden marcarse listos en este incremento. ")}</p>
                      {post.status === "ready" &&
                        campaign.kind === "organic" && (
                          <button
                            className="text-button wide"
                            type="button"
                            onClick={() => setConfirmMode(true)}
                          >
                            {t("Confirmar una entrega ya realizada → ")}</button>
                        )}
                    </>
                  ) : (
                    <>
                      <Field label="Resultado comprobado">
                        <select name="status">
                          <option value="scheduled">
                            {t("Programado externamente ")}</option>
                          <option value="published">{t("Publicado")}</option>
                        </select>
                      </Field>
                      <Field label="Enlace externo de evidencia" wide>
                        <input
                          name="externalUrl"
                          type="url"
                          required
                          maxLength={2000}
                        />
                      </Field>
                      <label className="check-field wide">
                        <input name="confirmed" type="checkbox" role="switch" required />
                        {t("He comprobado este resultado en la red. Copiar o descargar no basta. ")}</label>
                      <p className="muted wide">
                        {t("Confirmar la salida conserva el contenido. Su borrado requiere la acción separada Retirar y borrar. ")}</p>
                    </>
                  )}
                </>
              );
            })()}
        </div>
        {error && (
          <ErrorNotice message={t(error)} />
        )}
        <div className="dialog-actions">
          <button type="button" disabled={busy} onClick={close}>
            {t("Cancelar ")}</button>
          <button className="primary" disabled={busy || !!fileError}>
            {busy
              ? t("Guardando…")
              : confirmMode
                ? t("Confirmar resultado")
                : t("Guardar")}
          </button>
        </div>
        <Help topic={editor.kind} />
      </form>
    </dialog>
  );
}
