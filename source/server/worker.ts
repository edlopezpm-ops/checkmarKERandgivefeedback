import { editorialApi, json, readJson } from "./api.ts";
import {
  ownerIdentity,
  responseToRequest,
  SupabaseRepository,
  type SupabaseConfig,
} from "./supabase.ts";
import { object } from "../src/core/domain.ts";
import { ownerSession, describeOwnerAuth, handleOwnerAuth, purgeOwnerAuth } from './native-auth.js';
import { authCaptchaConfiguration } from './captcha.js';
import { D1Repository } from './d1.ts';
import { hostedStudioApi } from './studio-hosted.ts';
import { createAgentsApi } from './agents.ts';
import { createD1AgentStore } from './agents-store.ts';
import { readAccountLifecycle, profileApi, advanceAccountDeletion } from './profile.ts';
import { createMcpApi, isMcpRequest } from './mcp.ts';

const cookieName = "__Host-marker";
const cookie = (token = "", seconds = 0) =>
  `${cookieName}=${token}; Path=/; Max-Age=${seconds}; Secure; HttpOnly; SameSite=Strict`;
export async function hostedApi(
  request: Request,
  config: SupabaseConfig,
): Promise<Response> {
  const path = new URL(request.url).pathname;
  const configured = !!(config.url && config.key && config.ownerId);
  if (
    request.method !== "GET" &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return json({ error: "Origen no permitido." }, 403);
  if (path === "/api/session" && !configured)
    return json({ mode: "hosted", configured: false, authenticated: false });
  if (!configured)
    return json({ error: "Acceso privado pendiente de configuración." }, 503);
  if (!/^https:\/\/[a-z0-9.-]+\/?$/i.test(config.url))
    return json({ error: "Configuración de acceso inválida." }, 503);
  try {
    if (path === "/api/logout" && request.method === "POST") {
      const response = json({ ok: true });
      response.headers.set("Set-Cookie", cookie());
      return response;
    }
    if (path === "/api/login" && request.method === "POST") {
      const data = object(await readJson(request, 10_000));
      if (
        typeof data.email !== "string" ||
        typeof data.password !== "string" ||
        data.email.length > 320 ||
        data.password.length > 1000
      )
        return json({ error: "Credenciales inválidas." }, 400);
      const result = await fetch(
        `${config.url}/auth/v1/token?grant_type=password`,
        {
          method: "POST",
          headers: { apikey: config.key, "Content-Type": "application/json" },
          body: JSON.stringify({ email: data.email, password: data.password }),
          signal: AbortSignal.timeout(12_000),
        },
      );
      if (!result.ok)
        return json({ error: "No se pudo autorizar el acceso." }, 401);
      const session = (await readJson(responseToRequest(result), 30_000)) as {
        access_token?: string;
        expires_in?: number;
        user?: { id?: string };
      };
      if (
        session.user?.id !== config.ownerId ||
        !session.access_token ||
        !/^[a-zA-Z0-9._-]+$/.test(session.access_token)
      )
        return json({ error: "No se pudo autorizar el acceso." }, 403);
      const response = json({ ok: true });
      response.headers.set(
        "Set-Cookie",
        cookie(
          session.access_token,
          Math.min(3600, Number(session.expires_in) || 3600),
        ),
      );
      return response;
    }
    const token =
      request.headers
        .get("cookie")
        ?.split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith(`${cookieName}=`))
        ?.slice(cookieName.length + 1) ?? "";
    const authenticated = await ownerIdentity(config, token);
    if (path === "/api/session")
      return json({ mode: "hosted", configured: true, authenticated });
    if (!authenticated)
      return json(
        {
          error:
            "Acceso exclusivo del propietario. Inicia sesión de nuevo si ha caducado.",
        },
        401,
      );
    return editorialApi(request, new SupabaseRepository(config, token));
  } catch {
    return json(
      { error: "Servicio de acceso no disponible. No se modificaron datos." },
      503,
    );
  }
}
export default {
  scheduled(_event, env, ctx) { ctx.waitUntil(maintainAccount(env)); },
  async fetch(request, env, ctx) {
    if (!new URL(request.url).pathname.startsWith("/api/") && !isMcpRequest(new URL(request.url).pathname))
      return env.ASSETS.fetch(request);
    return nativeApi(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;

export async function nativeApi(request: Request, env: Env, ctx: Pick<ExecutionContext, 'waitUntil'>): Promise<Response> {
  const path = new URL(request.url).pathname;
  try {
    // The durable account tombstone precedes every owner, provider and bridge
    // route. Only same-browser cleanup recovery remains available after freeze.
    const account = await readAccountLifecycle(env);
    if (path === '/api/profile' || path.startsWith('/api/profile/')) return profileApi(request, env);
    if (account.status !== 'active') {
      if (path === '/api/session' && request.method === 'GET') return json({ mode: 'hosted', configured: true, authenticated: false, account: { status: account.status } });
      return json({ error: account.status === 'deleted' ? 'ACCOUNT_DELETED' : 'ACCOUNT_DELETING' }, account.status === 'deleted' ? 410 : 423);
    }
  } catch { return json({ error: 'ACCOUNT_UNAVAILABLE' }, 503); }
  if (isMcpRequest(path)) {
    const repository = new D1Repository(env.DB, !!(env.MEDIA && env.STUDIO_PROCESSOR));
    return await createMcpApi({
      db: env.DB, origin: env.MARKER_ORIGIN,
      ownerSession: request => ownerSession(request, env),
      async assertActive() { if ((await readAccountLifecycle(env)).status !== 'active') throw new Error('Account closed'); },
      async backend(internal) {
        if ((await readAccountLifecycle(env)).status !== 'active') return json({ error: 'ACCOUNT_CLOSED' }, 423);
        if (new URL(internal.url).pathname.startsWith('/api/studio')) {
          if (!(env.MEDIA && env.STUDIO_PROCESSOR)) return json({ error: 'STUDIO_UNAVAILABLE' }, 503);
          return await hostedStudioApi(internal, env, await repository.read()) ?? json({ error: 'NOT_FOUND' }, 404);
        }
        return editorialApi(internal, repository);
      },
    }).handle(request) ?? json({ error: 'NOT_FOUND' }, 404);
  }
  if (path.startsWith('/api/auth/')) return handleOwnerAuth(request, env, ctx);
  // A bridge has its own revocable, narrowly scoped bearer. It never receives an
  // owner session and can only claim work and report events for its connection.
  if (path.startsWith('/api/agents/bridge/')) return agentApi(request, env);
  const principal = await ownerSession(request, env);
  if (path === '/api/session' && request.method === 'GET') {
    try {
      const descriptor = await describeOwnerAuth(request, env);
      return json({ mode: 'hosted', configured: descriptor.methods.email.configured, authenticated: !!principal, authFlow: descriptor.authFlow, methods: descriptor.methods, turnstile: authCaptchaConfiguration(env), ...(principal ? { auth_method: principal.method, tenant_id: principal.tenantId, user: { id: principal.userId, email: principal.email, tenant_id: principal.tenantId } } : {}) });
    } catch { return json({ error: 'El acceso no está disponible en este momento.' }, 503); }
  }
  if (!principal) return json({ error: 'Acceso exclusivo del propietario. Solicita un código para entrar.' }, 401);
  // This deployment owns one persisted tenant. Caller input never selects its
  // workspace, media keys, processor, budgets or agent ledger.
  const requestedTenant = request.headers.get('X-Tenant-ID') ?? new URL(request.url).searchParams.get('tenant_id');
  if (requestedTenant !== null && requestedTenant !== principal.tenantId) return json({ error: 'Acceso no permitido.' }, 403);
  const studioEnabled = !!(env.MEDIA && env.STUDIO_PROCESSOR);
  const repository = new D1Repository(env.DB, studioEnabled);
  if (path === '/api/agents' || path.startsWith('/api/agents/')) return agentApi(request, env);
  if (path === '/api/studio' || path.startsWith('/api/studio/')) {
    if (!studioEnabled) return json({ error: 'El estudio no está disponible en este momento.' }, 503);
    return await hostedStudioApi(request, env, await repository.read()) ?? json({ error: 'Ruta no disponible.' }, 404);
  }
  return editorialApi(request, repository);
}

async function maintainAccount(env: Env): Promise<void> {
  let account = await readAccountLifecycle(env);
  if (account.status === 'active') { await purgeOwnerAuth(env); return; }
  // Only an owner-started deletion is resumed. Bound each scheduled execution;
  // pending leases or dependency failure remain durable for the next retry.
  for (let count = 0; count < 20 && account.status === 'deleting'; count++) {
    const previous = account;
    const next = await advanceAccountDeletion(env);
    account = { status: next.status, phase: next.phase, deletedObjects: next.deleted_objects, needsRetry: next.needs_retry === 1 };
    if (account.phase === previous.phase && account.deletedObjects === previous.deletedObjects) break;
  }
}

async function agentApi(request: Request, env: Env): Promise<Response> {
  try {
    const repository = new D1Repository(env.DB, !!(env.MEDIA && env.STUDIO_PROCESSOR));
    const api = createAgentsApi({
      store: createD1AgentStore(env.DB),
      readWorkspace: () => repository.read(),
      studioRequest: async (studioRequest, trusted) => {
        if (!(env.MEDIA && env.STUDIO_PROCESSOR)) return json({ error: 'Studio no disponible.' }, 503);
        return hostedStudioApi(studioRequest, env, await repository.read(), trusted);
      },
    });
    return await api.handle(request) ?? json({ error: 'Ruta no disponible.' }, 404);
  } catch {
    return json({ error: 'Agentes no disponibles. Revisa la migración y la conexión.' }, 503);
  }
}
