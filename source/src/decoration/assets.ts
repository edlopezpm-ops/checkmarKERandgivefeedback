export const CACHE_PREFIX = 'marker-decoration-';
export const CACHE_NAME = `${CACHE_PREFIX}v2`;
export const MAX_BYTES = 5 * 1024 * 1024;
export const SPRITES_URL = '/decoration/characters-v2.svg';

export async function boundedBlob(response: Response, maximum = MAX_BYTES): Promise<Blob> {
  if (!response.ok || !response.body) throw new Error('Asset unavailable');
  if (Number(response.headers.get('content-length') ?? 0) > maximum) throw new Error('Asset too large');
  const reader = response.body.getReader(); const chunks: Uint8Array<ArrayBuffer>[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > maximum) { await reader.cancel(); throw new Error('Asset too large'); }
      chunks.push(new Uint8Array(value));
    }
  } finally { reader.releaseLock(); }
  return new Blob(chunks, { type: 'image/svg+xml' });
}

/** Only one shared sprite resource. Consent revocation is serialized after in-flight writes. */
export class DecorativeAssets {
  private accepted = false;
  private generation = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private memory?: Promise<Blob>;
  private storage: () => CacheStorage | undefined;
  private fetcher: typeof fetch;
  constructor(storage: () => CacheStorage | undefined = () => globalThis.caches, fetcher: typeof fetch = globalThis.fetch.bind(globalThis)) {
    this.storage = storage; this.fetcher = fetcher;
  }
  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation, operation); this.queue = result.catch(() => {}); return result;
  }
  private async purge(storage: CacheStorage, keep?: string) {
    for (const name of await storage.keys()) if (name.startsWith(CACHE_PREFIX) && name !== keep) await storage.delete(name);
  }
  async setConsent(accepted: boolean): Promise<string> {
    this.accepted = accepted; const generation = ++this.generation;
    return this.serialize(async () => {
      if (generation !== this.generation) return this.accepted ? 'Copia opcional solicitada.' : 'Copia opcional desactivada.';
      try {
        const storage = this.storage(); if (!storage) throw new Error('Unavailable');
        if (!accepted) { await this.purge(storage); return 'Copia opcional eliminada. Carga desde el host.'; }
        await this.purge(storage, CACHE_NAME);
        const blob = await this.load();
        if (generation !== this.generation || !this.accepted) return 'Copia opcional desactivada.';
        const cache = await storage.open(CACHE_NAME);
        await cache.put(SPRITES_URL, new Response(blob, { headers: { 'Content-Type': 'image/svg+xml' } }));
        // Revocation queued during put will run purge after this operation.
        return 'Copia opcional disponible. El navegador puede liberarla cuando lo necesite.';
      } catch {
        return accepted ? 'Caché no disponible. Se continúa desde el host.' : 'Copia desactivada; no se pudo confirmar su borrado. Reintenta cuando la caché esté disponible.';
      }
    });
  }
  load(): Promise<Blob> {
    if (!this.memory) this.memory = this.fetchBlob().catch(error => { this.memory = undefined; throw error; });
    return this.memory;
  }
  private async fetchBlob(): Promise<Blob> {
    if (this.accepted) {
      try { const stored = await (await this.storage()?.open(CACHE_NAME))?.match(SPRITES_URL); if (stored) return await boundedBlob(stored); } catch { /* Optional cache cannot block rendering. */ }
    }
    // No Cache Storage writes unless setConsent(true) is explicitly invoked.
    return boundedBlob(await this.fetcher(SPRITES_URL, { credentials: 'omit', signal: AbortSignal.timeout(8000) }));
  }
}
