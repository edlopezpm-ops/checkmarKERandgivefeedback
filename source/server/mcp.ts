import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { CfWorkerJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/cfworker';
import { json } from './api.ts';
import { createMcpAuthorization } from './mcp-auth.ts';
import { MCP_TOOLS, createMcpTools, type McpPrincipal, type McpToolResult } from './mcp-tools.ts';

export type McpOptions = {
  db: D1Database;
  origin: string;
  ownerSession(request: Request): Promise<{ userId: string; tenantId: string; email: string } | null>;
  assertActive(): Promise<void>;
  backend(request: Request): Promise<Response>;
};
const instructions = 'Use marKER tools to find exact products, materials and campaigns before writing. Ask when matches or rights are unclear. Preserve user text and native planning. Read fresh revisions, use a unique request_id per intended write, and reuse that ID only for the identical request. Never retry an uncertain write automatically. Plans are proposals; saved drafts are editable. A queued render is not a completed file. Human review and approval happen in marKER before export. Export never publishes to social media.';
const validator = new CfWorkerJsonSchemaValidator();
const toolValidators = new Map(MCP_TOOLS.map(tool => [tool.name, validator.getValidator(tool.inputSchema)]));
function failure(code: string, status: number, message: string): McpToolResult {
  const data = { code, status, message };
  return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data, isError: true };
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => JSON.stringify(key) + ':' + canonical(item)).join(',') + '}';
  return JSON.stringify(value);
}
async function digest(value: unknown) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Durable intent receipts guard retries across Worker instances. The domain CAS
 * remains authoritative. A crash between domain commit and receipt commit is
 * deliberately uncertain; it never authorizes a blind second execution. */
export async function executeMcpTool(options: Pick<McpOptions, 'db' | 'origin' | 'backend'>, principal: McpPrincipal, name: string, args: Record<string, unknown>): Promise<McpToolResult> {
  const definition = MCP_TOOLS.find(tool => tool.name === name);
  if (!definition) return failure('UNKNOWN_TOOL', 404, 'Herramienta no disponible.');
  if (!definition.scopes.every(scope => principal.scopes.includes(scope))) return failure('INSUFFICIENT_SCOPE', 403, 'La conexión no tiene este permiso.');
  if (!toolValidators.get(name)!(args).valid) return failure('INVALID_ARGUMENTS', 400, 'Revisa los campos de la herramienta.');
  const tools = createMcpTools({ origin: options.origin, backend: options.backend, principal });
  if (definition.annotations.readOnlyHint) return tools.call(name, args);
  const requestId = args.request_id as string;
  const fingerprint = await digest({ name, args });
  const inserted = await options.db.prepare(`INSERT INTO marker_mcp_effects(grant_id,request_id,digest,status,result_json,created_at)
    SELECT ?,?,?,'pending',NULL,? WHERE (SELECT COUNT(*) FROM marker_mcp_effects WHERE grant_id=?)<5000
    ON CONFLICT(grant_id,request_id) DO NOTHING`).bind(principal.grantId, requestId, fingerprint, Math.floor(Date.now() / 1000), principal.grantId).run();
  if (!inserted.success) throw new Error('MCP receipt unavailable');
  if (inserted.meta.changes !== 1) {
    const old = await options.db.prepare('SELECT digest,status,result_json FROM marker_mcp_effects WHERE grant_id=? AND request_id=?').bind(principal.grantId, requestId).first<{ digest: string; status: string; result_json: string | null }>();
    if (!old) return failure('RECEIPT_LIMIT', 429, 'La conexión necesita mantenimiento de su historial.');
    if (old.digest !== fingerprint) return failure('REQUEST_ID_CONFLICT', 409, 'Este request_id corresponde a otra operación.');
    if (old.status === 'completed' && old.result_json) return JSON.parse(old.result_json) as McpToolResult;
    return failure('EFFECT_UNCERTAIN', 409, 'La operación sigue pendiente o necesita conciliación. Consulta el producto antes de crear otra solicitud.');
  }
  let result: McpToolResult;
  try { result = await tools.call(name, args); }
  catch { result = failure('EFFECT_UNCERTAIN', 503, 'No se puede confirmar el resultado. Consulta el producto antes de repetir la operación.'); }
  const uncertain = result.isError && Number(result.structuredContent.status) >= 500;
  const serialized = JSON.stringify(result);
  if (new TextEncoder().encode(serialized).byteLength > 900_000) throw new Error('MCP receipt too large');
  const saved = await options.db.prepare("UPDATE marker_mcp_effects SET status=?,result_json=? WHERE grant_id=? AND request_id=? AND digest=? AND status='pending'").bind(uncertain ? 'uncertain' : 'completed', serialized, principal.grantId, requestId, fingerprint).run();
  if (!saved.success || saved.meta.changes !== 1) return failure('EFFECT_UNCERTAIN', 503, 'El resultado necesita conciliación. Consulta el producto antes de repetir.');
  return result;
}

export function isMcpRequest(path: string): boolean {
  return path === '/api/mcp' || path.startsWith('/api/mcp/') || path === '/.well-known/oauth-authorization-server' || path === '/.well-known/oauth-protected-resource/api/mcp';
}
export function createMcpApi(options: McpOptions) {
  const authorization = createMcpAuthorization(options);
  return {
    async handle(request: Request): Promise<Response | null> {
      const url = new URL(request.url);
      if (!isMcpRequest(url.pathname)) return null;
      try {
        await options.assertActive();
        if (url.origin !== options.origin) return json({ error: 'ORIGIN_NOT_ALLOWED' }, 403);
        const authorized = await authorization.handle(request);
        if (authorized) return authorized;
        const artifact = /^\/api\/mcp\/artifacts\/([A-Za-z0-9_-]{1,100})$/.exec(url.pathname);
        if (url.pathname !== '/api/mcp' && !artifact) return json({ error: 'NOT_FOUND' }, 404);
        const origin = request.headers.get('Origin');
        if (origin && origin !== options.origin) return json({ error: 'ORIGIN_NOT_ALLOWED' }, 403);
        const principal = await authorization.authenticate(request);
        async function exportArtifact() {
          const revision = Number(url.searchParams.get('recipe_revision'));
          if (!Number.isSafeInteger(revision) || revision < 1) return json({ error: 'RECIPE_REVISION_REQUIRED' }, 400);
          const current = async () => {
            const result = await options.backend(new Request(`${options.origin}/api/studio`, { headers: { Origin: options.origin } }));
            if (!result.ok) throw new Error('Studio unavailable');
            const data = await result.json() as { state: { variants: Array<{ id: string; recipeRevision: number }> } };
            return data.state.variants.find(variant => variant.id === artifact![1])?.recipeRevision;
          };
          if (await current() !== revision) return json({ error: 'RECIPE_CHANGED' }, 409);
          const response = await options.backend(new Request(`${options.origin}/api/studio/variants/${artifact![1]}/export`, { headers: { Origin: options.origin, ...(request.headers.has('Range') ? { Range: request.headers.get('Range')! } : {}) } }));
          if (response.ok && await current() !== revision) { await response.body?.cancel(); return json({ error: 'RECIPE_CHANGED' }, 409); }
          return response;
        }
        // The normal signed-in browser can download its own already-approved
        // export. Assistant transport always requires its delegated bearer.
        if (artifact && request.method === 'GET' && !principal && !request.headers.has('Authorization') && await options.ownerSession(request)) {
          return exportArtifact();
        }
        if (!principal) {
          const response = json({ error: 'AUTHORIZATION_REQUIRED' }, 401);
          response.headers.set('WWW-Authenticate', `Bearer resource_metadata="${options.origin}/.well-known/oauth-protected-resource/api/mcp"`);
          return response;
        }
        const tenant = request.headers.get('X-Tenant-ID') ?? url.searchParams.get('tenant_id');
        if (tenant !== null && tenant !== principal.tenantId) return json({ error: 'ACCESS_DENIED' }, 403);
        if (artifact) {
          if (request.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
          if (!principal.scopes.includes('marker:produce')) return json({ error: 'INSUFFICIENT_SCOPE' }, 403);
          return exportArtifact();
        }
        if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
        const server = new Server({ name: 'marKER', version: '0.1.0' }, { capabilities: { tools: {} }, instructions, jsonSchemaValidator: validator });
        server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: MCP_TOOLS.filter(tool => tool.scopes.every(scope => principal.scopes.includes(scope))).map(({ scopes, ...tool }) => ({ ...tool, securitySchemes: [{ type: 'oauth2', scopes }], ...(tool.name === 'marker_get_profile' ? { outputSchema: { type: 'object' as const, properties: { id: { type: 'string', minLength: 1, pattern: '\\S' } }, required: ['id'], additionalProperties: false } } : {}), _meta: { securitySchemes: [{ type: 'oauth2', scopes }], ...(tool.name === 'marker_get_profile' ? { 'openai/profile': true } : {}) } })) }));
        server.setRequestHandler(CallToolRequestSchema, async request => executeMcpTool(options, principal, request.params.name, request.params.arguments ?? {}));
        const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true, maxRequestBodySize: 300_000 });
        await server.connect(transport);
        try {
          const response = await transport.handleRequest(request);
          response.headers.set('Cache-Control', 'no-store, private');
          response.headers.set('X-Content-Type-Options', 'nosniff');
          return response;
        } finally { await server.close(); }
      } catch {
        return json({ error: 'MCP_UNAVAILABLE', message: 'La conexión no está disponible. No repitas una escritura sin comprobar su resultado.' }, 503);
      }
    },
  };
}
