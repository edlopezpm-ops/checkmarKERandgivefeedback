import { useEffect, useState } from 'react';
import { useLanguage } from '../i18n';
import { ErrorNotice } from './ErrorNotice';

type Connection = { id: string; clientName: string; scopes: string[] };
export function McpConnections() {
  const { language } = useLanguage();
  const es = language === 'es';
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState('');
  const [copied, setCopied] = useState(false);
  const endpoint = window.location.origin + '/api/mcp';
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/mcp/connections', { credentials: 'same-origin', signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); return response.json() as Promise<{ connections: Connection[] }>; })
      .then(value => setConnections(value.connections))
      .catch(() => { if (!controller.signal.aborted) setError(es ? 'No se pudieron cargar las conexiones.' : 'Could not load connections.'); });
    return () => controller.abort();
  }, [es]);
  useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(false), 2500); return () => clearTimeout(timer); }, [copied]);
  async function revoke(id: string) {
    setBusy(id); setError('');
    try {
      const response = await fetch('/api/mcp/connections', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Marker-MCP': '1' }, body: JSON.stringify({ grantId: id }) });
      if (!response.ok) throw new Error();
      setConnections(previous => previous?.filter(item => item.id !== id) ?? []); setConfirm('');
    } catch { setError(es ? 'No se pudo desconectar el asistente.' : 'Could not disconnect the assistant.'); }
    finally { setBusy(''); }
  }
  const permission = (scope: string) => ({ 'marker:read': es ? 'Leer' : 'Read', 'marker:write': es ? 'Editar' : 'Edit', 'marker:produce': es ? 'Preparar archivos' : 'Produce files', 'marker:delete': es ? 'Eliminar' : 'Delete' })[scope] ?? scope;
  return <section aria-label={es ? 'Asistentes conectados' : 'Connected assistants'}>
    <h3>{es ? 'Asistentes conectados' : 'Connected assistants'}</h3>
    <div className="review-actions" style={{ alignItems: 'end', flexWrap: 'wrap' }}>
      <label style={{ flex: '1 1 220px', minWidth: 0 }}>{es ? 'Enlace de conexión' : 'Connection link'}<input aria-label={es ? 'Enlace de conexión MCP' : 'MCP connection link'} readOnly value={endpoint} style={{ width: '100%', boxSizing: 'border-box' }} onFocus={event => event.target.select()} /></label>
      <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(endpoint); setCopied(true); } catch { setError(es ? 'Selecciona y copia el enlace.' : 'Select and copy the link.'); } }}>{copied ? (es ? 'Copiado' : 'Copied') : (es ? 'Copiar enlace' : 'Copy link')}</button>
    </div>
    <ErrorNotice message={error} />
    {connections?.length === 0 && <p className="setting-note">{es ? 'Sin asistentes conectados.' : 'No assistants connected.'}</p>}
    {connections?.map(connection => <div className="setting" key={connection.id} style={{ flexWrap: 'wrap' }}>
      <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}><strong>{connection.clientName}</strong><small>{connection.scopes.map(permission).join(' · ')}</small></span>
      <div className="review-actions">
        {confirm === connection.id ? <><button type="button" disabled={!!busy} onClick={() => revoke(connection.id)}>{es ? 'Confirmar' : 'Confirm'}</button><button type="button" disabled={!!busy} onClick={() => setConfirm('')}>{es ? 'Cancelar' : 'Cancel'}</button></> : <button type="button" disabled={!!busy} onClick={() => setConfirm(connection.id)}>{es ? 'Desconectar' : 'Disconnect'}</button>}
      </div>
    </div>)}
  </section>;
}
