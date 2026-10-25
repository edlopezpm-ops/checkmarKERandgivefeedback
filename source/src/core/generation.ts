import { DomainError, applyCommand, type Command, type Workspace } from "./domain.ts";

// Local simulation ceilings only. They do not describe any OpenAI entitlement,
// model, quota, timeout or provider retention policy; those remain unconfirmed.
export const TEXT_SIMULATION_LIMITS = Object.freeze({
  maxRequests: 16,
  ttlMs: 5 * 60_000,
  maxInputBytes: 1_048_576,
  maxOutputChars: 20_000,
  latencyMs: 200,
  timeoutMs: 2_000,
});
export type TextSimulationRequest = {
  requestId: string;
  revision: number;
  campaignId: string;
  postId: string;
  sourceIds: string[];
};
export type SimulatedTextResult = {
  readonly simulated: true;
  readonly request: Readonly<Omit<TextSimulationRequest, "sourceIds"> & { sourceIds: readonly string[] }>;
  readonly productId: string;
  readonly accountId: string;
  readonly sourceIds: readonly string[];
  readonly text: string;
  readonly createdAt: number;
  readonly expiresAt: number;
};
type SimulationMode = "success" | "error" | "timeout" | "malformed-text" | "malformed-destination";
type Entry = {
  fingerprint: string;
  snapshot: string;
  expiresAt: number;
  promise: Promise<SimulatedTextResult>;
  result?: SimulatedTextResult;
  savePrepared?: boolean;
  cancel: () => void;
  expiryTimer: ReturnType<typeof setTimeout>;
};

function snapshot(state: Workspace): string {
  const serialized = JSON.stringify(state);
  if (new TextEncoder().encode(serialized).byteLength > TEXT_SIMULATION_LIMITS.maxInputBytes)
    throw new DomainError("El tamaño supera el límite de la simulación local.");
  return serialized;
}
function selection(state: Workspace, request: Readonly<Omit<TextSimulationRequest, "sourceIds"> & { sourceIds: readonly string[] }>) {
  if (!Number.isSafeInteger(request.revision) || state.revision !== request.revision)
    throw new DomainError("El espacio cambió. Recarga y genera otra solicitud.", 409);
  const campaign = state.campaigns.find(item => item.id === request.campaignId);
  const post = state.posts.find(item => item.id === request.postId);
  if (!campaign || !post || post.campaignId !== campaign.id)
    throw new DomainError("La campaña o el borrador ya no existe.", 409);
  if (post.status !== "draft")
    throw new DomainError("La simulación requiere un borrador editable.", 409);
  const product = state.products.find(item => item.id === campaign.productId);
  const account = state.accounts.find(item => item.id === post.accountId);
  if (!product || !account || !account.productIds.includes(product.id))
    throw new DomainError("La cuenta no admite este producto.", 409);
  if (!Array.isArray(request.sourceIds) || !request.sourceIds.length || request.sourceIds.length > 100 ||
      new Set(request.sourceIds).size !== request.sourceIds.length)
    throw new DomainError("Selecciona material de la campaña.");
  const sources = request.sourceIds.map(id => {
    const source = state.sources.find(item => item.id === id);
    if (!source || !campaign.sourceIds.includes(id)) throw new DomainError("El material no pertenece a la campaña.");
    if (source.productId !== product.id) throw new DomainError("El material pertenece a otro producto.");
    return source;
  });
  return { campaign, post, product, account, sources };
}
function validText(value: unknown): value is string {
  return typeof value === "string" && !!value.trim() && !value.includes("\0") && value.length <= TEXT_SIMULATION_LIMITS.maxOutputChars;
}

/** In-memory simulation session. No fetch, provider, login or persistence path. */
export function createTextSimulation(options: { latencyMs?: number; timeoutMs?: number; now?: () => number } = {}) {
  const latencyMs = options.latencyMs ?? TEXT_SIMULATION_LIMITS.latencyMs;
  const timeoutMs = options.timeoutMs ?? TEXT_SIMULATION_LIMITS.timeoutMs;
  if (!Number.isFinite(latencyMs) || latencyMs < 0 || latencyMs > 10_000 ||
      !Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000)
    throw new DomainError("Tiempos de simulación inválidos.");
  const now = options.now ?? Date.now;
  const cache = new Map<string, Entry>();
  const results = new WeakMap<SimulatedTextResult, Entry>();
  function discard(requestId: string, entry: Entry) {
    clearTimeout(entry.expiryTimer);
    entry.cancel();
    if (entry.result) results.delete(entry.result);
    entry.snapshot = "";
    entry.fingerprint = "";
    cache.delete(requestId);
  }
  function prune() {
    for (const [id, entry] of cache) if (entry.expiresAt <= now()) discard(id, entry);
  }
  function generate(state: Workspace, input: TextSimulationRequest, run: { mode?: SimulationMode; signal?: AbortSignal } = {}): Promise<SimulatedTextResult> {
    try {
      prune();
      if (!input || ![input.requestId, input.campaignId, input.postId].every(id => typeof id === "string" && !!id.trim() && id.length <= 100 && !id.includes("\0")))
        throw new DomainError("Solicitud de simulación inválida.");
      const mode = run.mode ?? "success";
      if (!["success", "error", "timeout", "malformed-text", "malformed-destination"].includes(mode))
        throw new DomainError("Modo de simulación inválido.");
      if (!Array.isArray(input.sourceIds)) throw new DomainError("Selecciona material de la campaña.");
      const request = Object.freeze({ requestId: input.requestId, revision: input.revision, campaignId: input.campaignId, postId: input.postId, sourceIds: Object.freeze([...input.sourceIds]) });
      const requestId = input.requestId;
      const stateSnapshot = snapshot(state);
      const fingerprint = JSON.stringify([request, mode, stateSnapshot]);
      const existing = cache.get(input.requestId);
      if (existing) {
        if (existing.fingerprint !== fingerprint)
          throw new DomainError("El identificador ya está asociado a otra solicitud o versión del espacio.", 409);
        // Duplicates share the original logical operation and cancellation.
        return existing.promise;
      }
      const selected = selection(state, request);
      if (cache.size >= TEXT_SIMULATION_LIMITS.maxRequests)
        throw new DomainError("La sesión alcanzó el límite de simulaciones. Espera su vencimiento.", 429);
      const createdAt = now(), expiresAt = createdAt + TEXT_SIMULATION_LIMITS.ttlMs;
      let entry: Entry;
      let cancel = () => {};
      const promise = new Promise<SimulatedTextResult>((resolve, reject) => {
        let settled = false;
        let responseTimer: ReturnType<typeof setTimeout> | undefined;
        let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
        const finish = (error?: Error, result?: SimulatedTextResult) => {
          if (settled) return;
          settled = true;
          clearTimeout(responseTimer); clearTimeout(timeoutTimer);
          run.signal?.removeEventListener("abort", cancel);
          if (error) reject(error); else resolve(result!);
        };
        cancel = () => finish(new DomainError("La simulación fue cancelada.", 409));
        run.signal?.addEventListener("abort", cancel, { once: true });
        if (run.signal?.aborted) { cancel(); return; }
        timeoutTimer = setTimeout(() => finish(new DomainError("Tiempo de espera simulado agotado.", 408)), timeoutMs);
        if (mode === "timeout") return;
        responseTimer = setTimeout(() => {
          try {
            if (snapshot(state) !== stateSnapshot) throw new DomainError("El espacio cambió durante la simulación.", 409);
            if (mode === "error") throw new DomainError("Error simulado. No se generó un borrador.", 503);
            const candidate = {
              text: mode === "malformed-text" ? "" : `SIMULACIÓN LOCAL · ${selected.product.name} · ${selected.account.platform}\n\n${selected.sources.map(source => source.text).join("\n\n")}\n\n${selected.product.cta}`,
              accountId: mode === "malformed-destination" ? "unknown-destination" : selected.account.id,
            };
            if (!validText(candidate.text) || candidate.accountId !== selected.post.accountId)
              throw new DomainError("La respuesta simulada no es válida para este borrador.");
            const result: SimulatedTextResult = Object.freeze({ simulated: true, request, productId: selected.product.id, accountId: candidate.accountId, sourceIds: request.sourceIds, text: candidate.text, createdAt, expiresAt });
            entry.result = result;
            results.set(result, entry);
            finish(undefined, result);
          } catch (error) { finish(error instanceof Error ? error : new DomainError("Respuesta simulada inválida.")); }
        }, latencyMs);
      });
      const expiryTimer = setTimeout(() => { if (cache.get(requestId) === entry) discard(requestId, entry); }, TEXT_SIMULATION_LIMITS.ttlMs);
      // Node tests must not keep their process alive for an idle browser-session TTL.
      (expiryTimer as unknown as { unref?: () => void }).unref?.();
      entry = { fingerprint, snapshot: stateSnapshot, expiresAt, promise, cancel, expiryTimer };
      cache.set(input.requestId, entry);
      return promise;
    } catch (error) { return Promise.reject(error); }
  }
  function prepareSave(state: Workspace, result: SimulatedTextResult, editedText: string): { revision: number; command: Command } {
    if (result.expiresAt <= now()) {
      prune();
      throw new DomainError("La respuesta simulada venció. Genera otra solicitud.", 409);
    }
    const entry = results.get(result);
    if (!entry) throw new DomainError("La respuesta no pertenece a esta sesión de simulación.", 409);
    if (snapshot(state) !== entry.snapshot) throw new DomainError("El espacio cambió. Conserva tus cambios y genera otra solicitud.", 409);
    if (entry.savePrepared) throw new DomainError("La respuesta simulada ya se preparó para guardar. Recarga y genera otra solicitud.", 409);
    const { post } = selection(state, result.request);
    if (!validText(editedText)) throw new DomainError("Revisa el texto del borrador simulado.");
    const command: Command = { type: "post.save", data: { id: post.id, text: editedText, status: "draft", formatConfirmed: false, scheduledAt: post.scheduledAt } };
    // Reuse every existing domain invariant; the caller persists with this revision's CAS.
    applyCommand(state, command);
    // An uncertain dispatch requires reload and regeneration; never replay this result.
    entry.savePrepared = true;
    return { revision: result.request.revision, command };
  }
  function clear() { for (const [id, entry] of cache) discard(id, entry); }
  return { generate, prepareSave, clear };
}
