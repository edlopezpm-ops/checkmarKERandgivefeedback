import { useState } from 'react';
import { useLanguage } from '../i18n';
import { servicePolicyAcknowledgement } from '../core/policy';
import { request } from '../core/client';

export function openPolicy(section: 'terms' | 'privacy' | 'cookies') {
  window.dispatchEvent(new CustomEvent('marker:open-policy', { detail: section }));
}
export function PolicyGate({ onComplete, onVerify }: { onComplete: () => Promise<void>; onVerify: () => void }) {
  const { language } = useLanguage(), es = language === 'es';
  const [terms, setTerms] = useState(false), [privacy, setPrivacy] = useState(false), [cookies, setCookies] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function continueAccess() {
    if (busy || !terms || !privacy || !cookies) return;
    setBusy(true); setError('');
    try { await request('/api/policy', servicePolicyAcknowledgement()); await onComplete(); }
    catch (failure) { setError((failure as Error).message === 'FRESH_PROOF_REQUIRED' ? es ? 'Vuelve a verificar tu acceso antes de continuar.' : 'Verify your access again before continuing.' : es ? 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.' : 'Could not save. Check your connection and retry.'); }
    finally { setBusy(false); }
  }
  return <section className="console app-content"><div className="login-form policy-gate">
    <h1>{es ? 'Revisa los avisos del servicio' : 'Review the service notices'}</h1>
    <p>{es ? 'Tu cuenta aún no tiene un recibo de estas versiones. Revisa los avisos y elige expresamente antes de usar el espacio. Visitar o iniciar sesión no registra aceptación.' : 'Your account has no receipt for these versions yet. Review the notices and choose explicitly before using the workspace. Visiting or signing in does not record acceptance.'}</p>
    <label><input type="checkbox" checked={terms} onChange={event => setTerms(event.target.checked)} disabled={busy} />{es ? 'Acepto los ' : 'I accept the '}<button type="button" className="text-button" onClick={() => openPolicy('terms')}>ToS</button></label>
    <label><input type="checkbox" checked={privacy} onChange={event => setPrivacy(event.target.checked)} disabled={busy} />{es ? 'Reconozco el aviso ' : 'I acknowledge the '}<button type="button" className="text-button" onClick={() => openPolicy('privacy')}>Privacy</button></label>
    <label><input type="checkbox" checked={cookies} onChange={event => setCookies(event.target.checked)} disabled={busy} />{es ? 'Reconozco el aviso ' : 'I acknowledge the '}<button type="button" className="text-button" onClick={() => openPolicy('cookies')}>Cookies</button></label>
    <p>{es ? 'Reconocer Cookies no activa la caché opcional ni otras finalidades. Tus derechos de datos siguen disponibles dentro de Privacy sin aceptar estas versiones.' : 'Acknowledging Cookies does not enable optional caching or other purposes. Your data rights remain available inside Privacy without accepting these versions.'}</p>
    {error && <p role="alert">{error}</p>}
    <button type="button" disabled={busy || !terms || !privacy || !cookies} onClick={() => void continueAccess()}>{busy ? es ? 'Guardando…' : 'Saving…' : es ? 'Guardar y continuar' : 'Save and continue'}</button>
    <button type="button" className="text-button" disabled={busy} onClick={onVerify}>{es ? 'Verificar acceso de nuevo' : 'Verify access again'}</button>
  </div></section>;
}
