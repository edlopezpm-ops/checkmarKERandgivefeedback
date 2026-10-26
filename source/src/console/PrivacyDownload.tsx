import { useState } from 'react';
import { useLanguage } from '../i18n';
type Page = { format: string; subject: { userId: string; tenantId: string }; category: string; data: unknown; categories: string[]; next: string | null; excluded: string[]; consistency: string };
export function PrivacyDownload() {
  const { language } = useLanguage(), es = language === 'es';
  const [busy, setBusy] = useState(false), [status, setStatus] = useState('');
  async function download() {
    if (busy) return;
    setBusy(true); setStatus('');
    try {
      let total = 0, pages = 0, core: Page | undefined;
      const records: Record<string, unknown> = {};
      async function page(category: string, after = ''): Promise<Page> {
        if (++pages > 200) throw new Error('EXPORT_LIMIT');
        const query = new URLSearchParams({ category, ...(after ? { after } : {}) });
        const response = await fetch(`/api/privacy/data?${query}`, { cache: 'no-store', credentials: 'same-origin', headers: { 'X-Marker-Auth': '1' } });
        if (!response.ok) { const value = await response.json(); throw new Error(value.error ?? 'EXPORT_UNAVAILABLE'); }
        const text = await response.text(); total += new TextEncoder().encode(text).byteLength;
        if (total > 16 * 1024 * 1024) throw new Error('EXPORT_LIMIT');
        const value = JSON.parse(text) as Page;
        if (value.category !== category || core && JSON.stringify(value.subject) !== JSON.stringify(core.subject)) throw new Error('EXPORT_CHANGED');
        return value;
      }
      core = await page('core'); records.core = core.data;
      for (const category of core.categories.filter(value => value !== 'core')) {
        const values: unknown[] = [], seen = new Set<string>(); let after = '';
        do {
          const result = await page(category, after);
          if (!Array.isArray(result.data) || result.next !== null && (seen.has(result.next) || result.next <= after)) throw new Error('EXPORT_CHANGED');
          values.push(...result.data); after = result.next ?? ''; if (after) seen.add(after);
        } while (after);
        records[category] = values;
      }
      const contents = JSON.stringify({ format: core.format, generatedAt: new Date().toISOString(), subject: core.subject, completeForDeclaredCategories: true, excluded: core.excluded, consistency: core.consistency, records }, null, 2);
      const url = URL.createObjectURL(new Blob([contents], { type: 'application/json;charset=utf-8' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'marker-my-data.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus(es ? 'Descarga preparada. Incluye un manifiesto de alcance y exclusiones.' : 'Download prepared. Its manifest states the scope and exclusions.');
    } catch (failure) {
      const code = (failure as Error).message;
      setStatus(['FRESH_PROOF_REQUIRED', 'AUTH_REQUIRED'].includes(code) ? es ? 'Inicia sesión o verifica de nuevo tu acceso. La verificación debe tener menos de cinco minutos; no se requiere aceptar ToS nuevos.' : 'Sign in or verify your access again. Verification must be less than five minutes old; accepting new ToS is not required.' : es ? 'La descarga no se completó. No se guardó una copia parcial. Reintenta o solicita una exportación coordinada a marker@aekr.io.' : 'Download did not complete. No partial file was saved. Retry or request a coordinated export at marker@aekr.io.');
    } finally { setBusy(false); }
  }
  return <section><h3>{es ? 'Descargar mis datos' : 'Download my data'}</h3><p>{es ? 'Descarga perfil, registros de texto del espacio, metadatos de materiales, conversaciones y recibos. Los archivos originales, videos, miniaturas y las copias de proveedores se solicitan aparte. Requiere verificación reciente de tu cuenta; ninguna cookie opcional ni aceptación nueva de ToS.' : 'Download your profile, workspace text records, material metadata, conversations and receipts. Original files, videos, thumbnails and provider copies require a separate request. Recent account verification is required; optional cookies and new ToS acceptance are not.'}</p><button type="button" disabled={busy} onClick={() => void download()}>{busy ? es ? 'Preparando…' : 'Preparing…' : es ? 'Descargar mis datos' : 'Download my data'}</button>{status && <p role="status">{status}</p>}</section>;
}
