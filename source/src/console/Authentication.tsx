import { useState } from "react";
import { useLanguage } from "../i18n";
import { Turnstile, type TurnstileDescriptor } from "./Turnstile";
import "./authentication.css";

export type OAuthProvider = "google" | "github";
export type OAuthMethod = { configured: boolean; bound: boolean; canLink: boolean; linkRequiresEmailVerification?: boolean };
export type AuthSession = {
  mode: "local" | "hosted";
  authenticated: boolean;
  policy?: { required: boolean };
  configured?: boolean;
  authFlow?: "code";
  auth_method?: "email" | OAuthProvider;
  account?: { status: "deleting" | "deleted" };
  tenant_id?: string;
  user?: { id?: string; email: string; tenant_id?: string };
  turnstile?: TurnstileDescriptor;
  methods?: { email: { configured: boolean }; google: OAuthMethod; github?: OAuthMethod };
};
type OAuthStart = (provider: OAuthProvider, intent: "login" | "link", captchaToken: string) => Promise<void>;
const providers: OAuthProvider[] = ["google", "github"];
const providerName = (provider: OAuthProvider) => provider === "google" ? "Google" : "GitHub";

function ProviderButton({ provider, intent, session, busy, onOAuth }: { provider: OAuthProvider; intent: "login" | "link"; session: AuthSession; busy: boolean; onOAuth: OAuthStart }) {
  const { language } = useLanguage(), l = (es: string, en: string) => language === "es" ? es : en;
  const [armed, setArmed] = useState(false), [token, setToken] = useState(""), [reset, setReset] = useState(0);
  const method = session.methods?.[provider], descriptor = session.mode === "hosted" ? session.turnstile : undefined;
  const required = descriptor?.required === true;
  const name = providerName(provider);
  async function start() {
    if (busy || !method?.configured || intent === "login" && !method.bound || intent === "link" && !method.canLink) return;
    if (required && !token) { setArmed(true); return; }
    try { await onOAuth(provider, intent, token); }
    finally { setToken(""); setReset(value => value + 1); }
  }
  return <div className="auth-provider-choice">
    <button type="button" className="auth-provider-button" disabled={busy || !method?.configured || intent === "login" && !method.bound || intent === "link" && !method.canLink || armed && required && !token} onClick={() => void start()}>
      <span className="auth-provider-mark" aria-hidden="true">{provider === "google" ? "G" : "GH"}</span>{intent === "link" ? l(`Vincular mi cuenta de ${name}`, `Link my ${name} account`) : l(`Continuar con ${name}`, `Continue with ${name}`)}
    </button>
    {armed && <Turnstile descriptor={descriptor} action={provider === "google" ? "auth_google" : "auth_github"} reset={reset} onToken={setToken} />}
  </div>;
}

export function ProviderSignIn({ session, busy, onOAuth }: { session: AuthSession; busy: boolean; onOAuth: OAuthStart }) {
  const { language } = useLanguage(), l = (es: string, en: string) => language === "es" ? es : en;
  return <div className="auth-google-choice">{providers.map(provider => {
    const method = session.methods?.[provider], name = providerName(provider);
    return <div key={provider}><ProviderButton provider={provider} intent="login" session={session} busy={busy} onOAuth={onOAuth} />
      {!method?.configured && <p className="setting-note">{l(`${name} está pendiente de configuración. Puedes entrar con tu correo autorizado.`, `${name} setup is pending. You can sign in with your authorized email.`)}</p>}
    </div>;
  })}<p className="auth-method-divider">{l("o continúa con tu correo", "or continue with email")}</p></div>;
}

export function AuthenticationSettings({ session, busy, onOAuth, onEmailProof }: { session?: AuthSession; busy: boolean; onOAuth: OAuthStart; onEmailProof: () => void }) {
  const { language } = useLanguage(), l = (es: string, en: string) => language === "es" ? es : en;
  if (!session) return null;
  return <section className="surface authentication-settings" aria-labelledby="authentication-heading">
    <h2 id="authentication-heading">{l("Acceso", "Access")}</h2>
    {session.mode === "local" ? <p>{l("Este espacio se guarda en este equipo. El acceso con correo, Google o GitHub se gestiona en la versión alojada de marKER.", "This workspace is saved on this computer. Email, Google and GitHub sign-in are managed in the hosted version of marKER.")}</p> : <>
      <p>{l("Un espacio personal con una sola cuenta.", "One personal workspace with a single account.")}</p><p className="account-email">{session.user?.email}</p>
      <div className="auth-method-status"><strong>{l("Correo", "Email")}</strong><span>{l("Disponible para entrar y recuperar el acceso", "Available for sign-in and access recovery")}</span></div>
      {providers.map(provider => { const method = session.methods?.[provider], name = providerName(provider); return <div key={provider}>
        <div className="auth-method-status"><strong>{name}</strong><span>{method?.bound ? l("Vinculado", "Linked") : method?.configured ? l("Listo para vincular", "Ready to link") : l("Pendiente de configuración", "Setup pending")}</span></div>
        {!method?.configured && <p className="setting-note">{l(`La conexión de ${name} aún no está activada para marKER. Tu acceso por correo sigue disponible.`, `The ${name} connection has not been activated for marKER yet. Email access remains available.`)}</p>}
        {method?.configured && !method.bound && <><p className="setting-note">{l(`Para vincular tu cuenta, entra con un código de correo de los últimos cinco minutos y después confirma la cuenta en ${name}.`, `To link your account, sign in using an email code within the last five minutes, then confirm the account with ${name}.`)}</p>
          {method.canLink ? <ProviderButton provider={provider} intent="link" session={session} busy={busy} onOAuth={onOAuth} /> : <button type="button" disabled={busy} onClick={onEmailProof}>{l("Verificar mi acceso por correo", "Verify my email access")}</button>}
        </>}
        {method?.bound && <p className="setting-note">{l(`Puedes usar ${name} o tu correo para volver a entrar a este mismo espacio.`, `You can use ${name} or email to return to this same workspace.`)}</p>}
      </div>; })}
    </>}
  </section>;
}
