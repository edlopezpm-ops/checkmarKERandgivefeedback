import { useEffect, useState } from 'react';
import { request } from '../core/client';
import { analyticsCategories, analyticsPurposes, isCurrentAnalyticsGrant, type AnalyticsAudience, type AnalyticsOverview, type AnalyticsPreference, type AnalyticsPurpose } from '../core/analytics';
import { useLanguage } from '../i18n';
import { ErrorNotice } from './ErrorNotice';

const purposeNames: Record<AnalyticsPurpose, [string, string]> = {
  optional_analytics: ['Analítica opcional', 'Optional analytics'],
  aekr_marketing: ['Marketing de AEKR', 'AEKR marketing'],
  onsite_personalized_ads: ['Ofertas personalizadas en AEKR', 'Personalized offers on AEKR'],
  external_ad_audiences: ['Audiencias publicitarias externas', 'External advertising audiences'],
  partner_intro: ['Contacto con un proveedor elegido', 'Contact with a selected provider'],
  audience_licensing: ['Licencia de audiencias', 'Audience licensing'],
};

export default function AnalyticsSettings() {
  const { language } = useLanguage();
  const l = (es: string, en: string) => language === 'es' ? es : en;
  const [overview, setOverview] = useState<AnalyticsOverview>();
  const [preferences, setPreferences] = useState<AnalyticsPreference[]>([]);
  const [audiences, setAudiences] = useState<AnalyticsAudience[]>([]);
  const [purpose, setPurpose] = useState<AnalyticsPurpose>('optional_analytics');
  const [category, setCategory] = useState<typeof analyticsCategories[number]>('marketing');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const gpc = Reflect.get(navigator, 'globalPrivacyControl') === true;
  const connected = !!overview?.configuration;
  const active = overview?.status === 'active';
  const current = preferences.find(item => item.purpose === purpose);
  const validGrant = isCurrentAnalyticsGrant(current);
  const namedRecipient = ['partner_intro', 'external_ad_audiences', 'audience_licensing'].includes(purpose);
  const gpcBlocked = gpc && ['onsite_personalized_ads', 'external_ad_audiences', 'audience_licensing'].includes(purpose);
  async function load() {
    setBusy(true); setError('');
    try {
      // Some browsers expose GPC through navigator without a Sec-GPC header.
      // Forward that exclusion through the existing central choice endpoint.
      let gpcUnconfirmed = false;
      if (gpc) try { await request('/api/analytics/preferences', { purpose: 'onsite_personalized_ads', status: 'withdrawn', categories: [], recipients: [], gpc: true }); }
      catch { gpcUnconfirmed = true; }
      const next = await request<AnalyticsOverview>('/api/analytics'); setOverview(next); setRecipients([]);
      if (gpcUnconfirmed && next.status !== 'not_configured') setError(l('No se confirmó la exclusión GPC en Analytics. La recolección publicitaria local sigue bloqueada.', 'Analytics did not confirm the GPC exclusion. Local advertising collection remains blocked.'));
      if (next.configuration) {
        const results = await Promise.allSettled([request<{ preferences: AnalyticsPreference[] }>('/api/analytics/preferences'), request<{ audiences: AnalyticsAudience[] }>('/api/analytics/audiences')]);
        if (results[0].status === 'fulfilled') setPreferences(results[0].value.preferences); else { setPreferences([]); setError(l('No se pudieron consultar las preferencias.', 'Preferences could not be read.')); }
        if (results[1].status === 'fulfilled') setAudiences(results[1].value.audiences); else { setAudiences([]); setError(l('No se pudo consultar el inventario autorizado.', 'The authorized inventory could not be read.')); }
      } else { setPreferences([]); setAudiences([]); }
    } catch { setError(l('Analytics no está disponible. Tus campañas siguen operativas.', 'Analytics is unavailable. Your campaigns remain available.')); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);
  async function save(status: 'granted' | 'denied' | 'withdrawn') {
    setBusy(true); setError(''); setNotice('');
    try {
      await request('/api/analytics/preferences', { purpose, status, categories: status === 'granted' ? [category] : [], recipients: status === 'granted' ? recipients : [], gpc });
      await load(); setNotice(l('Preferencia guardada en Analytics para este producto y propósito.', 'Preference saved in Analytics for this product and purpose.'));
    } catch { setError(l('No se guardó la preferencia. Reintenta; no se amplió ningún permiso.', 'The preference was not saved. Retry; no permission was expanded.')); }
    finally { setBusy(false); }
  }
  async function recordInterest() {
    if (!current || !overview?.configuration) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const receipt = await request<{ accepted: boolean; duplicate: boolean }>('/api/analytics/events', { event_id: crypto.randomUUID(), event: 'commercial_interest_selected', purpose: 'onsite_personalized_ads', permission_ref: current.permission_ref, source_configuration_version: overview.configuration.version, category });
      setNotice(receipt.accepted || receipt.duplicate ? l('Interés declarado registrado. No representa una venta ni un cobro.', 'Declared interest recorded. It does not represent a sale or payment.') : l('Analytics no confirmó el registro.', 'Analytics did not confirm the record.'));
    } catch { setError(l('El evento no se confirmó. Consulta el estado de la fuente.', 'The event was not confirmed. Check the source status.')); }
    finally { setBusy(false); }
  }
  const statuses = {
    not_configured: l('Sin conexión configurada; recolección opcional desactivada.', 'Connection not configured; optional collection is off.'),
    unavailable: l('Sin configuración vigente; recolección opcional desactivada.', 'No current configuration; optional collection is off.'),
    paused: l('Fuente pausada desde Analytics.', 'Source paused from Analytics.'),
    active: l('Configuración vigente confirmada.', 'Current configuration confirmed.'),
    confirmation_pending: l('Configuración recibida; confirmación pendiente.', 'Configuration received; confirmation pending.'),
  };
  return <section className="surface">
    <h2>Analytics</h2>
    <p>{l('AEKR Analytics administra recolección, permisos y audiencias. marKER conserva la creación y ejecución de campañas.', 'AEKR Analytics manages collection, permissions and audiences. marKER retains campaign creation and execution.')}</p>
    <p>{l('Esta fuente corresponde al propietario de la consola privada. No representa a visitantes públicos ni a una base de usuarios SaaS.', 'This source represents the private console owner. It does not represent public visitors or a SaaS user base.')}</p>
    {error && <ErrorNotice message={error} />}{notice && <p role="status">{notice}</p>}
    <p role="status">{overview ? statuses[overview.status] : l('Consultando conexión…', 'Checking connection…')}</p>
    {overview?.configuration && <p>{l('Versión deseada', 'Desired version')}: {overview.desired_version} · {l('Confirmada', 'Confirmed')}: {overview.applied_version ?? l('pendiente', 'pending')} · {l('Vigente hasta', 'Valid until')}: {new Date(overview.configuration.expires_at).toLocaleString(language)} · {overview.configuration.restriction_reason}</p>}
    <div className="record-actions"><button type="button" disabled={busy} onClick={() => void load()}>{l('Actualizar conexión', 'Refresh connection')}</button><a href="https://aekr.io/analytics" target="_blank" rel="noopener noreferrer">{l('Abrir consola central', 'Open central console')}</a></div>
    <p>{l('No se copian Space, campañas, mensajes, listas, resultados de herramientas ni contenido de APIs. Usar campañas no requiere permisos opcionales.', 'Space, campaigns, messages, lists, tool results and API content are not copied. Campaign use does not require optional permissions.')}</p>
    {connected && <>
      <h3>{l('Preferencias por propósito', 'Preferences by purpose')}</h3>
      <label className="form-field"><span>{l('Propósito', 'Purpose')}</span><select value={purpose} disabled={busy} onChange={event => { setPurpose(event.target.value as AnalyticsPurpose); setRecipients([]); setNotice(''); }}>{analyticsPurposes.map(value => <option key={value} value={value}>{purposeNames[value][language === 'es' ? 0 : 1]}</option>)}</select></label>
      <p>{l('Estado registrado', 'Recorded status')}: {current ? current.status === 'expired' || current.status === 'granted' && !validGrant ? l('vencido', 'expired') : current.status === 'granted' ? l('aceptado', 'granted') : current.status === 'withdrawn' ? l('retirado', 'withdrawn') : l('rechazado', 'denied') : l('sin permiso', 'no permission')}. {l('Aviso', 'Notice')}: 2026-10-25.</p>
      <label className="form-field"><span>{l('Categoría declarada', 'Declared category')}</span><select value={category} disabled={busy} onChange={event => setCategory(event.target.value as typeof category)}>{analyticsCategories.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      {namedRecipient && <fieldset disabled={busy}><legend>{l('Destinatarios identificados', 'Identified recipients')}</legend>{overview.configuration?.destinations.length ? overview.configuration.destinations.map(recipient => <label key={recipient}><input type="checkbox" checked={recipients.includes(recipient)} onChange={event => setRecipients(current => event.target.checked ? [...current, recipient] : current.filter(value => value !== recipient))} />{recipient}</label>) : <p>{l('No hay un destinatario habilitado; no se puede conceder este uso.', 'No recipient is enabled; this use cannot be granted.')}</p>}</fieldset>}
      {gpc && <p>{l('GPC está presente: bloquea los usos publicitarios de venta/compartición cubiertos; no desactiva las funciones esenciales.', 'GPC is present: covered advertising sale/sharing uses are blocked; essential features remain available.')}</p>}
      <div className="record-actions"><button type="button" disabled={busy || !active || !overview.configuration?.purposes.includes(purpose) || gpcBlocked || namedRecipient && recipients.length === 0} onClick={() => void save('granted')}>{l('Aceptar este propósito', 'Accept this purpose')}</button><button type="button" disabled={busy} onClick={() => void save('denied')}>{l('Rechazar este propósito', 'Reject this purpose')}</button><button type="button" disabled={busy} onClick={() => void save('withdrawn')}>{l('Retirar este propósito', 'Withdraw this purpose')}</button></div>
      {purpose === 'onsite_personalized_ads' && <button type="button" disabled={busy || !active || !validGrant || !current?.categories.includes(category) || gpcBlocked} onClick={() => void recordInterest()}>{l('Registrar este interés declarado', 'Record this declared interest')}</button>}
      <h3>{l('Audiencias autorizadas para campañas', 'Authorized campaign audiences')}</h3>
      <p>{l('Se consultan únicamente referencias y recuentos. La activación y los destinatarios se administran en Analytics.', 'Only references and counts are read. Activation and recipients are managed in Analytics.')}</p>
      {audiences.length ? <ul>{audiences.map(audience => <li key={audience.audience_id}>{audience.audience_id} · v{audience.version} · {audience.eligible_count} {l('elegibles', 'eligible')} · {audience.mode === 'demo' ? l('Demostración sintética', 'Synthetic demonstration') : l('Producción', 'Production')} · {new Date(audience.as_of).toLocaleString(language)}</li>)}</ul> : <p>{l('No hay audiencias disponibles para esta fuente.', 'No audiences are available for this source.')}</p>}
    </>}
  </section>;
}
