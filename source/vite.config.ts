import { defineConfig, type Plugin } from "vite";
import { resolve, dirname } from "node:path";
import { Readable } from "node:stream";
import { editorialApi, json, readJson } from "./server/api.ts";
import { DomainError } from "./src/core/domain.ts";
import { LocalRepository } from "./server/local.ts";
import { createStudioApi } from "./server/studio-local.ts";
import { existsSync } from "node:fs";
import type { StudioState } from "./src/core/studio.ts";
import type { IncomingMessage } from "node:http";
import { createAgentsApi } from "./server/agents.ts";
import { createLocalAgentStore } from "./server/agents-local.ts";
import { createLocalProfileApi } from "./server/profile-local.ts";
import { createLocalMcpApi } from "./server/mcp-local.ts";
import { isMcpRequest } from "./server/mcp.ts";

// Rejecting a bounded body must leave the HTTP socket usable for its error response.
function incomingBody(req: IncomingMessage): ReadableStream<Uint8Array> {
  let cancelled = false;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      req.pause();
      req.on("data", chunk => { if (!cancelled) { controller.enqueue(new Uint8Array(chunk)); req.pause(); } });
      req.once("end", () => { if (!cancelled) controller.close(); });
      req.once("error", error => { if (!cancelled) controller.error(error); });
    },
    pull() { req.resume(); },
    cancel() { cancelled = true; req.resume(); },
  });
}

function localEditorial(): Plugin {
  return {
    name: "marker-local-editorial",
    apply: "serve",
    configureServer(server) {
      const repository = new LocalRepository(
        resolve(
          server.config.root,
          process.env.MARKER_LOCAL_DATA ?? ".local/workspace.json",
        ),
      );
      const profile = createLocalProfileApi(resolve(dirname(resolve(server.config.root,process.env.MARKER_LOCAL_DATA ?? '.local/workspace.json')),'profile.json'));
      const font = resolve(server.config.root, "Font/Montserrat_Complete/Fonts/WEB/fonts/Montserrat-Medium.ttf");
      const studio = createStudioApi({
        directory: resolve(server.config.root, process.env.MARKER_STUDIO_DIR ?? ".local/studio"),
        tools: {
          ffmpeg: process.env.MARKER_FFMPEG ?? resolve(server.config.root, ".local/tools/ffmpeg/bin/ffmpeg.exe"),
          ffprobe: process.env.MARKER_FFPROBE ?? resolve(server.config.root, ".local/tools/ffmpeg/bin/ffprobe.exe"),
          font: process.env.MARKER_FONT ?? (existsSync(font) ? font : undefined),
        },
      });
      const agentStore = createLocalAgentStore(resolve(server.config.root, process.env.MARKER_AGENTS_DIR ?? ".local/agents"));
      const agents = createAgentsApi({
        store: agentStore,
        readWorkspace: () => repository.read(),
        studioRequest: async (request, trusted) => studio.handle(request, await repository.read(), trusted),
      });
      const mcp = createLocalMcpApi({
        directory: resolve(server.config.root, process.env.MARKER_MCP_DIR ?? ".local/mcp"),
        async backend(request) {
          if (new URL(request.url).pathname.startsWith('/api/studio')) return await studio.handle(request, await repository.read()) ?? json({ error: 'NOT_FOUND' }, 404);
          if (new URL(request.url).pathname === '/api/commands') {
            const body = await readJson(request.clone() as Request) as { type?: string; data?: { id?: string } };
            if (body.type === 'product.delete') {
              const snapshot = await studio.handle(new Request(new URL('/api/studio', request.url)), await repository.read());
              const current = await snapshot?.json() as { state?: StudioState } | undefined;
              if (!current?.state || current.state.materials.some(m => m.productIds.includes(body.data?.id ?? '')) || current.state.campaigns.some(c => c.productId === body.data?.id)) return json({ error: 'El producto tiene materiales o campañas vinculados.' }, 409);
            }
          }
          return editorialApi(request, repository);
        },
      });
      server.httpServer?.once("close", () => { void studio.close(); agentStore.close?.(); mcp.close(); });
      let localRequests = Promise.resolve();
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/") && !isMcpRequest((req.url ?? '').split('?')[0])) return next();
        const allowedHost = /^127\.0\.0\.1:\d+$/.test(req.headers.host ?? "");
        const origin = `http://${req.headers.host}`;
        const remote = req.socket.remoteAddress;
        if (
          !allowedHost ||
          !["127.0.0.1", "::ffff:127.0.0.1"].includes(remote ?? "") ||
          (req.headers.origin && req.headers.origin !== origin) ||
          req.headers["sec-fetch-site"] === "cross-site" && !(req.method === 'GET' && req.url?.startsWith('/api/mcp/oauth/authorize?'))
        ) {
          res.writeHead(403, {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          });
          res.end('{"error":"Acceso local requerido."}');
          return;
        }
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers))
          if (typeof value === "string") headers.set(key, value);
        const preceding = localRequests;
        let release!: () => void;
        localRequests = new Promise<void>(done => { release = done; });
        await preceding;
        let inputBody: ReadableStream<Uint8Array> | undefined;
        try {
          req.setTimeout(35_000, () => req.destroy());
          if (!["GET", "HEAD"].includes(req.method ?? "GET")) inputBody = incomingBody(req);
          let request = new Request(new URL(req.url ?? '/', origin), {
            method: req.method,
            headers,
            ...(!["GET", "HEAD"].includes(req.method ?? "GET")
              ? {
                  body: inputBody,
                  duplex: "half",
                }
              : {}),
          });
          if (new URL(request.url).pathname === "/api/commands" && request.method === "POST") {
            const body = await readJson(request) as { type?: string; data?: { id?: string } };
            request = new Request(request.url, { method: "POST", headers: request.headers, body: JSON.stringify(body) });
            if (body.type === "product.delete") {
              const productId = body.data?.id ?? "";
              const snapshot = await studio.handle(new Request(`${origin}/api/studio`), await repository.read());
              const library = await snapshot?.json() as { state?: StudioState } | undefined;
              if (!library?.state || library.state.materials.some(m => m.productIds.includes(productId)) || library.state.campaigns.some(c => c.productId === productId)) {
                const denied = json({ error: "El producto tiene materiales o campañas en el estudio local." }, 409);
                res.writeHead(denied.status, Object.fromEntries(denied.headers)); res.end(await denied.text()); return;
              }
            }
          }
          const response =
            req.url === "/api/session"
              ? json({ mode: "local", authenticated: true })
              : (isMcpRequest(new URL(request.url).pathname) ? await mcp.handle(request) : null) ?? await profile.handle(request) ?? await agents.handle(request) ?? await studio.handle(request, await repository.read()) ?? await editorialApi(request, repository);
          res.writeHead(response.status, Object.fromEntries(response.headers));
          if (response.body) Readable.fromWeb(response.body as import("node:stream/web").ReadableStream).pipe(res);
          else res.end();
        } catch (error) {
          const status = error instanceof DomainError ? error.status : 503;
          res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
          res.end(JSON.stringify({ error: error instanceof DomainError ? error.message : "Servicio local no disponible." }));
        } finally {
          if (inputBody && !inputBody.locked) await inputBody.cancel().catch(() => undefined);
          release();
        }
      });
    },
  };
}
export default defineConfig({
  plugins: [localEditorial()],
  server: {
    host: "127.0.0.1",
    strictPort: true,
    // Generated media/fonts can be renamed or locked by FFmpeg on Windows.
    // fs.deny restricts serving; source watching needs its own exclusion.
    watch: { ignored: ["**/.local/**", "**/.aekr/**", "**/.git/**"] },
    fs: {
      deny: [
        "**/.aekr/**",
        "**/.local/**",
        "**/.git/**",
        "**/.env",
        "**/.env.*",
        "**/.dev.vars",
        "**/.dev.vars.*",
        "**/*.pem",
        "**/*.key",
      ],
    },
  },
});
