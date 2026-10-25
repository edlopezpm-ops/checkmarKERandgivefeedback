import {
  applyCommand,
  DomainError,
  object,
  type Workspace,
} from "../src/core/domain.ts";
export interface Repository {
  read(): Promise<Workspace>;
  save(state: Workspace, expectedRevision: number): Promise<void>;
}
const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
export function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers });
}
export async function readJson(
  request: Request,
  limit = 300_000,
): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new DomainError("Se requiere JSON.", 415);
  if (!request.body || Number(request.headers.get("content-length")) > limit)
    throw new DomainError("Solicitud demasiado grande o vacía.", 413);
  const reader = request.body.getReader(),
    chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) {
        await reader.cancel();
        throw new DomainError("Solicitud demasiado grande.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const data = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(data));
  } catch {
    throw new DomainError("JSON/UTF-8 inválido.");
  }
}
export async function editorialApi(
  request: Request,
  repository: Repository,
): Promise<Response> {
  try {
    const path = new URL(request.url).pathname;
    if (path === "/api/workspace" && request.method === "GET")
      return json(await repository.read());
    if (path !== "/api/commands" || request.method !== "POST")
      return json({ error: "Ruta no disponible." }, 404);
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      throw new DomainError("Origen no permitido.", 403);
    const body = object(await readJson(request));
    if (!Number.isInteger(body.revision) || typeof body.type !== "string")
      throw new DomainError("Comando inválido.");
    const previous = await repository.read();
    if (body.revision !== previous.revision)
      throw new DomainError(
        "El espacio cambió en otra pestaña. Recarga antes de guardar.",
        409,
      );
    const next = applyCommand(previous, {
      type: body.type,
      data: object(body.data),
    });
    await repository.save(next, previous.revision);
    return json(next);
  } catch (error) {
    if (error instanceof DomainError)
      return json({ error: error.message }, error.status);
    // Do not log private content or expose upstream/OS details.
    return json(
      {
        error:
          "No se pudo guardar o cargar. El trabajo anterior se conserva; revisa la conexión.",
      },
      503,
    );
  }
}
