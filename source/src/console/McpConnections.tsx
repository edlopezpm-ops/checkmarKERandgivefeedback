import { useEffect, useState } from 'react';
import { useLanguage } from '../i18n';
import { ErrorNotice } from './ErrorNotice';

export const MARKER_ASSISTANT_CONNECT_URL = 'https://chatgpt.com/plugins/plugin_asdk_app_6add5fc8a2f88191bc7b84402dc6d820';

type Connection = { id: string; clientName: string; scopes: string[] };
export function McpConnections({ active = true }: { active?: boolean }) {
  const { language } = useLanguage();
  const es = language === 'es';
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const endpoint = window.location.origin + '/api/mcp';
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const onFocus = () => setRefresh(value => value + 1);
    window.addEventListener('focus', onFocus);
    setLoading(true); setError('');
    fetch('/api/mcp/connections', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); return response.json() as Promise<{ connections: Connection[] }>; })
      .then(value => { if (!controller.signal.aborted) setConnections(value.connections); })
      .catch(() => { if (!controller.signal.aborted) setError(es ? 'No se pudieron cargar las conexiones.' : 'Could not load connections.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); window.removeEventListener('focus', onFocus); };
  }, [es, active, refresh]);
  useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(false), 2500); return () => clearTimeout(timer); }, [copied]);
  async function revoke(id: string) {
    setBusy(id); setError('');
    try {
      const response = await fetch('/api/mcp/connections', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Marker-MCP': '1' }, body: JSON.stringify({ grantId: id }) });
      if (!response.ok) throw new Error();
      setConnections(previous => previous?.filter(item => item.id !== id) ?? []); setConfirm(''); setRefresh(value => value + 1);
    } catch { setError(es ? 'No se pudo desconectar el asistente.' : 'Could not disconnect the assistant.'); }
    finally { setBusy(''); }
  }
  const permission = (scope: string) => ({ 'marker:read': es ? 'Leer' : 'Read', 'marker:write': es ? 'Editar' : 'Edit', 'marker:produce': es ? 'Preparar archivos' : 'Produce files', 'marker:delete': es ? 'Eliminar' : 'Delete' })[scope] ?? scope;
  return <section aria-label={es ? 'Asistentes conectados' : 'Connected assistants'}>
    <h3>{es ? 'Conecta tu asistente' : 'Connect your assistant'}</h3>
    <ol className="workflow-list">
      <li><a className="button-link" href={MARKER_ASSISTANT_CONNECT_URL} target="_blank" rel="noopener noreferrer">{es ? 'Abrir marKER en ChatGPT' : 'Open marKER in ChatGPT'}<span className="sr-only">{es ? ' (se abre en otra pestaña)' : ' (opens in a new tab)'}</span></a></li>
      <li>{es ? 'Selecciona Conectar, entra a marKER y revisa los permisos antes de autorizar.' : 'Select Connect, sign in to marKER and review the permissions before authorizing.'}</li>
      <li>{es ? 'Continúa la conversación en tu asistente. Revisa y aprueba los resultados en marKER.' : 'Continue the conversation in your assistant. Review and approve the results in marKER.'}</li>
    </ol>
    <details><summary>{es ? 'Otro asistente compatible' : 'Another compatible assistant'}</summary>
      <p>{es ? 'Añade este enlace en las conexiones de tu asistente y sigue su inicio de sesión.' : 'Add this link in your assistant’s connections and follow its sign-in flow.'}</p>
      <div className="review-actions" style={{ alignItems: 'end', flexWrap: 'wrap' }}>
        <label style={{ flex: '1 1 220px', minWidth: 0 }}>{es ? 'Enlace de conexión' : 'Connection link'}<input aria-label={es ? 'Enlace de conexión MCP' : 'MCP connection link'} readOnly value={endpoint} style={{ width: '100%', boxSizing: 'border-box' }} onFocus={event => event.target.select()} /></label>
        <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(endpoint); setCopied(true); } catch { setError(es ? 'Selecciona y copia el enlace.' : 'Select and copy the link.'); } }}>{copied ? (es ? 'Copiado' : 'Copied') : (es ? 'Copiar enlace' : 'Copy link')}</button>
      </div>
    </details>
    <div className="review-actions"><h3>{es ? 'Asistentes conectados' : 'Connected assistants'}</h3><button type="button" disabled={loading || !!busy} onClick={() => setRefresh(value => value + 1)}>{es ? 'Actualizar estado' : 'Refresh status'}</button></div>
    {loading && <p className="setting-note" role="status">{es ? 'Comprobando conexiones…' : 'Checking connections…'}</p>}
    <ErrorNotice message={error} />
    {!loading && !error && connections?.length === 0 && <p className="setting-note">{es ? 'Sin asistentes conectados. Completa la autorización y actualiza el estado.' : 'No assistants connected. Complete authorization and refresh the status.'}</p>}
    {connections?.map(connection => <div className="setting" key={connection.id} style={{ flexWrap: 'wrap' }}>
      <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}><strong>{connection.clientName}</strong><small>{connection.scopes.map(permission).join(' · ')}</small></span>
      <div className="review-actions">
        {confirm === connection.id ? <><button type="button" disabled={loading || !!busy} onClick={() => revoke(connection.id)}>{es ? 'Confirmar' : 'Confirm'}</button><button type="button" disabled={!!busy} onClick={() => setConfirm('')}>{es ? 'Cancelar' : 'Cancel'}</button></> : <button type="button" disabled={loading || !!busy} onClick={() => setConfirm(connection.id)}>{es ? 'Desconectar' : 'Disconnect'}</button>}
      </div>
    </div>)}
  </section>;
}
