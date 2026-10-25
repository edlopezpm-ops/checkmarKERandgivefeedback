import {
  emptyWorkspace,
  DomainError,
  type Workspace,
} from "../src/core/domain.ts";
import type { Repository } from "./api.ts";
import { readJson } from "./api.ts";

export type SupabaseConfig = { url: string; key: string; ownerId: string };
async function upstream(
  config: SupabaseConfig,
  path: string,
  token: string,
  body?: unknown,
): Promise<Response> {
  return fetch(`${config.url}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
  });
}
export async function ownerIdentity(
  config: SupabaseConfig,
  token: string,
): Promise<boolean> {
  if (!token) return false;
  const response = await upstream(config, "/auth/v1/user", token);
  if (!response.ok) return false;
  const user = (await readJson(responseToRequest(response), 30_000)) as {
    id?: string;
  };
  return user.id === config.ownerId;
}
// Apply the same bounded JSON reader to upstream responses.
export function responseToRequest(response: Response): Request {
  return new Request("https://bounded.invalid/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(response.headers.has("content-length")
        ? { "Content-Length": response.headers.get("content-length")! }
        : {}),
    },
    body: response.body,
    duplex: "half",
  } as RequestInit);
}
export class SupabaseRepository implements Repository {
  private config: SupabaseConfig;
  private token: string;
  constructor(config: SupabaseConfig, token: string) {
    this.config = config;
    this.token = token;
  }
  async read(): Promise<Workspace> {
    const response = await upstream(
      this.config,
      "/rest/v1/marker_workspace?select=revision,document&singleton=eq.true",
      this.token,
    );
    if (!response.ok) throw new Error("Database unavailable");
    const rows = (await readJson(responseToRequest(response), 4_300_000)) as {
      revision: number;
      document: Workspace;
    }[];
    return rows[0]
      ? { ...rows[0].document, revision: rows[0].revision }
      : emptyWorkspace();
  }
  async save(state: Workspace, expectedRevision: number): Promise<void> {
    const response = await upstream(
      this.config,
      "/rest/v1/rpc/marker_save",
      this.token,
      { expected_revision: expectedRevision, next_document: state },
    );
    if (response.status === 409)
      throw new DomainError(
        "Conflicto de edición. Recarga antes de guardar.",
        409,
      );
    if (!response.ok) throw new Error("Database unavailable");
    await response.body?.cancel();
  }
}
