import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLanguage } from "../i18n";
import { ErrorNotice } from "./ErrorNotice";
import "./profile.css";

export type ProfileResponse = {
  profile: { name: string; country: string; email: string | null; initials: string; revision?: number };
  canDeleteAccount: boolean;
  requiresFreshProof: boolean;
};
type Draft = Pick<ProfileResponse["profile"], "name" | "country">;
type Deletion = { status: "deleting" | "deleted"; phase: "processor" | "waiting" | "uploads" | "media" | "database" | "done"; deletedObjects?: number; needsRetry?: boolean };
type DeletionResponse = { deletion: Deletion; resumeAfterMs?: number };
const asDraft = (value: ProfileResponse): Draft => ({ name: value.profile.name, country: value.profile.country });

async function mutate<T>(method: "PATCH" | "DELETE" | "POST", body: unknown, url = "/api/profile"): Promise<T> {
  const response = await fetch(url, { method, credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json", "X-Marker-Auth": "1" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "PROFILE_UNAVAILABLE");
  return result as T;
}

async function completedDeletion(): Promise<DeletionResponse | null> {
  try {
    const response = await fetch("/api/session", { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) return null;
    const session = await response.json();
    return session.account?.status === "deleted" ? { deletion: { status: "deleted", phase: "done" } } : null;
  } catch { return null; }
}

async function readDeletion(): Promise<DeletionResponse | null> {
  try {
    const response = await fetch("/api/profile/deletion", { credentials: "same-origin", cache: "no-store" });
    if (response.status === 404) return completedDeletion();
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "DELETION_UNAVAILABLE");
    return result as DeletionResponse;
  } catch (error) {
    const final = await completedDeletion();
    if (final) return final;
    throw error;
  }
}

/** Resumes only a previously confirmed deletion, authorized by the HttpOnly capability. */
export function DeletionProgress({ initial, onDeleted }: { initial?: Deletion; onDeleted: () => void }) {
  const { language } = useLanguage(), l = (es: string, en: string) => language === "es" ? es : en;
  const [deletion, setDeletion] = useState(initial), [error, setError] = useState(""), [retry, setRetry] = useState(0);
  const completed = useRef(onDeleted); completed.current = onDeleted;
  useEffect(() => {
    let active = true, timer: ReturnType<typeof setTimeout> | undefined;
    async function advance(resume: boolean) {
      try {
        const result = resume ? await mutate<DeletionResponse>("POST", {}, "/api/profile/deletion/resume") : await readDeletion();
        if (!active) return;
        if (!result) { setError(l("No se encontró el progreso de borrado en este navegador. Recarga para comprobar el estado de la cuenta.", "Deletion progress was not found in this browser. Reload to check the account state.")); return; }
        setDeletion(result.deletion);
        if (result.deletion.status === "deleted") { completed.current(); return; }
        if (result.deletion.needsRetry) { setError(l("El borrado se detuvo. Reintenta para continuar desde el progreso guardado.", "Deletion stopped. Retry to continue from saved progress.")); return; }
        timer = setTimeout(() => void advance(true), Math.max(1000, Math.min(result.resumeAfterMs ?? 1000, 10000)));
      } catch {
        // The terminal transaction removes the capability. A lost final response
        // is resolved from the public tombstone, never by repeating DELETE.
        const final = resume ? await completedDeletion() : null;
        if (!active) return;
        if (final) { setDeletion(final.deletion); completed.current(); }
        else setError(l("No se pudo completar el borrado. El progreso se conserva; reintenta para continuar.", "Deletion could not finish. Progress is retained; retry to continue."));
      }
    }
    setError(""); void advance(retry > 0);
    return () => { active = false; clearTimeout(timer); };
  }, [retry, language]);
  const phase = { processor: l("Deteniendo el procesamiento", "Stopping processing"), waiting: l("Esperando a que termine el procesamiento activo", "Waiting for active processing to stop"), uploads: l("Eliminando subidas", "Deleting uploads"), media: l("Eliminando archivos", "Deleting files"), database: l("Eliminando registros y accesos", "Deleting records and sign-in links"), done: l("Borrado completado", "Deletion complete") };
  return <section className="surface profile-deletion-progress" aria-labelledby="deletion-progress-heading"><h2 id="deletion-progress-heading">{l("Borrado del espacio", "Workspace deletion")}</h2>
    <p role="status">{deletion ? phase[deletion.phase] : l("Comprobando el progreso…", "Checking progress…")}{deletion?.deletedObjects !== undefined && <> · {deletion.deletedObjects} {l("archivos eliminados", "files deleted")}</>}</p>
    <p>{l("Tu cuenta está cerrada mientras se completa el borrado. Puedes volver a esta página desde este mismo navegador para continuar.", "Your account is closed while deletion finishes. You can return to this page in the same browser to continue.")}</p>
    {error && <><ErrorNotice message={error} /><button type="button" onClick={() => setRetry(value => value + 1)}>{l("Reintentar borrado pendiente", "Retry pending deletion")}</button></>}
  </section>;
}

export default function Profile({ value, loadError, local, onReload, onChange, onEmailProof, onDeleting, onDeleted }: {
  value?: ProfileResponse; loadError: string; local: boolean; onReload: () => Promise<ProfileResponse>; onChange: (value: ProfileResponse) => void; onEmailProof: () => void; onDeleting: () => void; onDeleted: () => void;
}) {
  const { language } = useLanguage(), l = (es: string, en: string) => language === "es" ? es : en;
  const [draft, setDraft] = useState<Draft | undefined>(() => value && asDraft(value));
  const [editing, setEditing] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [editRevision, setEditRevision] = useState<number>();
  const [confirming, setConfirming] = useState(false), [confirmation, setConfirmation] = useState(""), [allData, setAllData] = useState(false);
  const [deletion, setDeletion] = useState<Deletion>();
  useEffect(() => { if (value && !editing) setDraft(asDraft(value)); }, [value, editing]);
  const dirty = !!draft && !!value && JSON.stringify(draft) !== JSON.stringify(asDraft(value));
  const message = (code: string) => ({
    FRESH_EMAIL_PROOF_REQUIRED: l("Vuelve a entrar con un código de correo reciente antes de borrar tu cuenta.", "Sign in again using a fresh email code before deleting your account."),
    CONFIRMATION_REQUIRED: l("Escribe DELETE y confirma que se eliminarán todos los datos.", "Type DELETE and confirm that all data will be deleted."),
    REVISION_CONFLICT: l("El perfil cambió. Actualiza los datos guardados antes de continuar.", "The profile changed. Refresh saved data before continuing."),
    PROFILE_INVALID: l("Revisa el nombre y el país antes de guardar.", "Check your name and country before saving."),
    ACCOUNT_UNAVAILABLE: l("La cuenta no está disponible para esta acción. Recarga la página para consultar su estado.", "The account is unavailable for this action. Reload the page to check its state."),
    AUTH_REQUIRED: l("Vuelve a entrar para continuar.", "Sign in again to continue."),
    ACCESS_DENIED: l("Esta sesión no permite cambiar este perfil.", "This session cannot change this profile."),
    DELETION_RETRY: l("El borrado no ha terminado. Puedes reintentarlo para continuar desde el progreso guardado.", "Deletion has not finished. Retry to continue from saved progress."),
    PROFILE_UNAVAILABLE: l("No se pudo cargar o guardar el perfil. Inténtalo de nuevo.", "The profile could not be loaded or saved. Try again."),
  }[code] ?? l("No se pudo completar la operación. Inténtalo de nuevo.", "The operation could not be completed. Try again."));
  function reportError(code: string) {
    if (code === "ACCOUNT_DELETING") { onDeleting(); return; }
    if (code === "ACCOUNT_DELETED") { onDeleted(); return; }
    if (code === "FRESH_EMAIL_PROOF_REQUIRED" && value) onChange({ ...value, requiresFreshProof: true });
    setError(message(code));
  }
  async function reload() {
    if (busy) return; setBusy(true); setError("");
    try { const next = await onReload(); if (!editing) setDraft(asDraft(next)); }
    catch (e) { reportError((e as Error).message); } finally { setBusy(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy || !draft || !editing || !dirty) return;
    setError(""); setNotice("");
    const next = { name: draft.name.trim(), country: draft.country.trim() };
    if (next.name.length > 120 || next.country.length > 80) { setError(l("Usa hasta 120 caracteres para el nombre y 80 para el país.", "Use up to 120 characters for your name and 80 for your country.")); return; }
    setBusy(true);
    try { const saved = await mutate<ProfileResponse>("PATCH", { ...next, ...(editRevision !== undefined ? { expectedRevision: editRevision } : {}) }); onChange(saved); setDraft(asDraft(saved)); setEditing(false); setNotice(l("Perfil guardado.", "Profile saved.")); }
    catch (e) { reportError((e as Error).message); } finally { setBusy(false); }
  }
  async function removeAccount(event: FormEvent) {
    event.preventDefault(); if (busy || !value?.canDeleteAccount || value.requiresFreshProof || !confirming || confirmation !== "DELETE" || !allData) return;
    setBusy(true); setError(""); setNotice("");
    try { const result = await mutate<DeletionResponse>("DELETE", { confirmation, confirmAllData: true }); setDeletion(result.deletion); if (result.deletion.status === "deleted") onDeleted(); else onDeleting(); }
    catch (e) {
      // A lost response can follow an accepted DELETE. Read capability status
      // before presenting a retry so the initial destructive request is not repeated.
      try { const accepted = await readDeletion(); if (accepted) { setDeletion(accepted.deletion); if (accepted.deletion.status === "deleted") onDeleted(); else onDeleting(); } else reportError((e as Error).message); }
      catch { reportError((e as Error).message); }
    } finally { setBusy(false); }
  }
  const change = (key: keyof Draft, next: string) => { setDraft(current => current && { ...current, [key]: next }); setNotice(""); };
  return <div className="profile-page">
    <section className="surface" aria-labelledby="profile-heading">
      <h2 id="profile-heading">{l("Tus datos", "Your details")}</h2>
      {(error || loadError) && <ErrorNotice message={error || message(loadError)} />}
      {notice && <p role="status" className="success-message">{notice}</p>}
      {!value || !draft ? <><p role="status">{loadError ? l("No se pudo cargar el perfil.", "The profile could not load.") : l("Cargando perfil…", "Loading profile…")}</p>{loadError && <button type="button" disabled={busy} onClick={() => void reload()}>{l("Reintentar", "Retry")}</button>}</> : <form onSubmit={event => void save(event)}>
        <div className="profile-fields">
          <label className="form-field"><span>{l("Correo", "Email")}</span><input type="email" autoComplete="email" readOnly value={value.profile.email ?? ""} /></label>
          <label className="form-field"><span>{l("Nombre", "Name")}</span><input name="name" autoComplete="name" maxLength={120} readOnly={!editing} disabled={busy} value={draft.name} onChange={event => change("name", event.target.value)} /></label>
          <label className="form-field"><span>{l("País", "Country")}</span><input name="country" autoComplete="country-name" maxLength={80} readOnly={!editing} disabled={busy} value={draft.country} onChange={event => change("country", event.target.value)} /></label>
          <div className="form-field"><span>{l("Iniciales", "Initials")}</span><output>{value.profile.initials || "—"}</output></div>
        </div>
        <div className="record-actions">{editing ? <><button className="primary" disabled={busy || !dirty}>{busy ? l("Guardando…", "Saving…") : l("Guardar perfil", "Save profile")}</button><button type="button" disabled={busy} onClick={() => { setDraft(asDraft(value)); setEditing(false); setError(""); }}>{l("Cancelar edición", "Cancel editing")}</button>{error && <button type="button" disabled={busy} onClick={() => { setEditing(false); void reload(); }}>{l("Descartar mis cambios y recargar", "Discard my changes and reload")}</button>}</> : <button type="button" disabled={busy} onClick={() => { setEditRevision(value.profile.revision); setEditing(true); setNotice(""); }}>{l("Editar perfil", "Edit profile")}</button>}</div>
      </form>}
    </section>
    {!local && value && <section className="surface profile-deletion" aria-labelledby="delete-account-heading">
      <h2 id="delete-account-heading">{l("Borrar cuenta y espacio", "Delete account and workspace")}</h2>
      <p>{l("Se borrará tu cuenta, todos los registros de este espacio y sus archivos activos: perfil, vínculos de acceso, productos, material, campañas y conversaciones. Esta acción es irreversible.", "Your account, every workspace record and its active files will be deleted: profile, sign-in links, products, materials, campaigns and conversations. This action is irreversible.")}</p>
      <p className="setting-note">{l("Las partes de subidas incompletas sin registro pueden tardar hasta siete días en caducar. Las copias descargadas o guardadas fuera de marKER no se eliminan.", "Unregistered incomplete upload parts can take up to seven days to expire. Copies downloaded or stored outside marKER are not deleted.")}</p>
      {deletion ? <DeletionProgress initial={deletion} onDeleted={onDeleted} /> : <>
        {!value.canDeleteAccount && <p className="setting-note">{l("El borrado no está disponible para esta sesión.", "Deletion is unavailable for this session.")}</p>}
        {!confirming ? <button type="button" disabled={busy || !value.canDeleteAccount} onClick={() => { setConfirming(true); setConfirmation(""); setAllData(false); }}>{l("Borrar mi cuenta…", "Delete my account…")}</button> : <form onSubmit={event => void removeAccount(event)} className="profile-delete-confirm">
          <p role="alert">{l("Confirma de nuevo: se eliminará la cuenta junto con todos los registros y archivos activos del espacio.", "Confirm again: your account and every workspace record and active file will be deleted.")}</p>
          {value.requiresFreshProof && <div><p>{l("Antes de confirmar, vuelve a entrar con un código de correo de los últimos cinco minutos.", "Before confirming, sign in using an email code from the last five minutes.")}</p><button type="button" disabled={busy} onClick={onEmailProof}>{l("Verificar mi acceso por correo", "Verify my email access")}</button></div>}
          <label className="form-field"><span>{l("Escribe DELETE para confirmar", "Type DELETE to confirm")}</span><input name="delete-confirmation" autoComplete="off" spellCheck={false} value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} /></label>
          <label className="profile-delete-check"><input type="checkbox" checked={allData} onChange={event => setAllData(event.target.checked)} disabled={busy} /><span>{l("Entiendo que se borrará mi cuenta y todo el espacio de forma irreversible.", "I understand that my account and entire workspace will be irreversibly deleted.")}</span></label>
          <div className="record-actions"><button type="submit" className="profile-delete-final" disabled={busy || value.requiresFreshProof || !value.canDeleteAccount || confirmation !== "DELETE" || !allData}>{busy ? l("Borrando…", "Deleting…") : l("Borrar cuenta y todos sus datos", "Delete account and all its data")}</button><button type="button" disabled={busy} onClick={() => { setConfirming(false); setConfirmation(""); setAllData(false); }}>{l("Cancelar", "Cancel")}</button></div>
        </form>}
      </>}
    </section>}
  </div>;
}
