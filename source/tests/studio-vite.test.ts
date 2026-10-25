import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { once } from "node:events";
import { applyCommand, emptyWorkspace, type Workspace } from "../src/core/domain.ts";
import type { StudioState } from "../src/core/studio.ts";

async function availablePort(): Promise<number> {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const port = address.port;
  await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
  return port;
}
const pause = (ms: number) => new Promise<void>(done => setTimeout(done, ms));

test("isolated real Vite HTTP boundary assembles three fictional campaigns, exports, and serializes product protection", { timeout: 120_000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), "marker-studio-vite-"));
  const port = await availablePort(), origin = `http://127.0.0.1:${port}`;
  let initial = emptyWorkspace();
  for (const name of ["Taller Nube", "Biblioteca Brisa", "Estudio Faro"])
    initial = applyCommand(initial, { type: "product.save", data: { name, status: "available" } });
  const dataPath = join(directory, "workspace.json");
  await writeFile(dataPath, JSON.stringify(initial), { mode: 0o600 });
  const child = spawn(process.execPath, [resolve("node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", String(port)], {
    cwd: resolve("."), windowsHide: true, shell: false, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, MARKER_LOCAL_DATA: dataPath, MARKER_STUDIO_DIR: join(directory, "studio"), NO_COLOR: "1" },
  });
  let diagnostic = "";
  for (const stream of [child.stdout, child.stderr]) stream?.on("data", chunk => { diagnostic = (diagnostic + chunk.toString()).slice(-4000); });
  const exited = once(child, "exit");
  const request = (path: string, method = "GET", body?: unknown, headers: Record<string, string> = {}) => fetch(`${origin}${path}`, {
    method, headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30_000),
  }).catch(error => { throw new Error(`HTTP ${method} ${path} failed`, { cause: error }); });
  const workspace = async () => await (await request("/api/workspace")).json() as Workspace;
  const studio = async () => (await (await request("/api/studio")).json()).state as StudioState;
  async function command(type: string, data: Record<string, unknown>): Promise<StudioState> {
    const response = await request("/api/studio/commands", "POST", { expectedRevision: (await studio()).revision, command: { type, data } });
    const result = await response.json();
    assert.equal(response.status, 200, result.error);
    return result.state;
  }
  try {
    const startupDeadline = Date.now() + 20_000;
    let ready = false;
    while (Date.now() < startupDeadline && child.exitCode === null) {
      try { ready = (await request("/api/session")).ok; if (ready) break; } catch { /* Startup has not bound the port. */ }
      await pause(100);
    }
    assert.ok(ready, `Vite did not start: ${diagnostic}`);
    assert.deepEqual((await workspace()).products.map(product => product.name), ["Taller Nube", "Biblioteca Brisa", "Estudio Faro"]);
    assert.equal((await workspace()).accounts.length, 0);

    await t.test("real multipart route bridge uploads a photo and prepares all three account-free examples", async () => {
      const bitmap = Buffer.alloc(70);
      bitmap.write("BM"); bitmap.writeUInt32LE(70, 2); bitmap.writeUInt32LE(54, 10); bitmap.writeUInt32LE(40, 14);
      bitmap.writeInt32LE(2, 18); bitmap.writeInt32LE(2, 22); bitmap.writeUInt16LE(1, 26); bitmap.writeUInt16LE(24, 28); bitmap.writeUInt32LE(16, 34);
      for (const at of [54, 57, 62, 65]) bitmap[at + 2] = 255;
      const created = await request("/api/studio/uploads", "POST", { name: "fictional-background.bmp", mime: "image/bmp", size: bitmap.length });
      assert.equal(created.status, 201);
      const upload = (await created.json()).upload;
      const chunk = await fetch(`${origin}/api/studio/uploads/${upload.id}`, { method: "PUT", headers: { "content-type": "application/octet-stream", "upload-offset": "0" }, body: bitmap });
      assert.equal(chunk.status, 200);
      const complete = await request(`/api/studio/uploads/${upload.id}/complete`, "POST", {});
      assert.equal(complete.status, 200);
      const asset = (await complete.json()).asset;
      assert.equal(asset.processing, "ready");
      const visualState = await command("material.save", { kind: "image", assetId: asset.id, title: "Synthetic shared personal background", rights: "owned", categories: ["broll"], speech: "absent" });
      const visualId = visualState.materials[0].id;
      for (const [index, product] of initial.products.entries()) {
        let state = await command("material.save", { kind: "text", title: `Manual copy ${product.name}`, text: `Fictional preparation for ${product.name}.`, productIds: [product.id], categories: ["ready-text"], rights: "owned" });
        const textId = state.materials.at(-1)!.id;
        state = await command("campaign.save", { productId: product.id, title: `DEMO ${product.name}`, objective: "Prepare a reviewable draft", kind: index === 1 ? "paid" : "organic" });
        const campaign = state.campaigns.at(-1)!;
        assert.equal(campaign.status, index === 1 ? "paused" : "draft");
        state = await command("variant.save", { campaignId: campaign.id, platform: index === 0 ? "Instagram" : index === 1 ? "LinkedIn" : "X", template: index === 0 ? "overlay" : "text", duration: 5,
          body: `Fictional preparation for ${product.name}.`, sourceIds: index === 0 ? [visualId, textId] : [textId], selections: index === 0 ? [{ materialId: visualId, start: 0, end: 5 }] : [] });
        const variant = state.variants.at(-1)!;
        let jobId: string | undefined;
        if (index === 0) {
          const render = await request(`/api/studio/variants/${variant.id}/render`, "POST", { recipeRevision: variant.recipeRevision });
          assert.equal(render.status, 202);
          jobId = (await render.json()).job.id;
          const deadline = Date.now() + 60_000;
          let rendered;
          do {
            rendered = (await (await request(`/api/studio/jobs/${jobId}`)).json()).job;
            if (["completed", "failed"].includes(rendered.status)) break;
            await pause(50);
          } while (Date.now() < deadline);
          assert.equal(rendered.status, "completed", rendered.error);
          assert.equal(rendered.width, 1080); assert.equal(rendered.height, 1920);
        }
        assert.equal((await request(`/api/studio/variants/${variant.id}/export`)).status, 409);
        const approved = await request(`/api/studio/variants/${variant.id}/approve`, "POST", { recipeRevision: variant.recipeRevision, jobId, confirmed: true });
        assert.equal(approved.status, 200);
        const exported = await request(`/api/studio/variants/${variant.id}/export`);
        assert.equal(exported.status, 200);
        assert.match(exported.headers.get("content-disposition")!, /attachment/);
        if (index === 0) {
          assert.equal(exported.headers.get("content-type"), "video/mp4");
          assert.match(Buffer.from(await exported.arrayBuffer()).subarray(0, 32).toString("latin1"), /ftyp/);
        } else assert.equal(await exported.text(), `Fictional preparation for ${product.name}.`);
      }
      const saved = await studio();
      assert.equal(saved.campaigns.length, 3); assert.equal(saved.variants.length, 3);
      assert.ok(saved.variants.every(variant => variant.status === "approved"));
      assert.equal(saved.campaigns[1].status, "paused");
      const current = await workspace();
      const denied = await request("/api/commands", "POST", { revision: current.revision, type: "product.delete", data: { id: current.products[0].id } });
      assert.equal(denied.status, 409);
      assert.match((await denied.json()).error, /estudio local/);
    });

    await t.test("serialized legacy deletion and studio creation cannot leave an orphan product", async () => {
      const before = await workspace();
      const created = await request("/api/commands", "POST", { revision: before.revision, type: "product.save", data: { name: "Race fixture", status: "preparation" } });
      assert.equal(created.status, 200);
      const current = await created.json() as Workspace;
      const productId = current.products.at(-1)!.id;
      const snapshot = await studio();
      const [deletion, creation] = await Promise.all([
        request("/api/commands", "POST", { revision: current.revision, type: "product.delete", data: { id: productId } }),
        request("/api/studio/commands", "POST", { expectedRevision: snapshot.revision, command: { type: "campaign.save", data: { productId, title: "Race fixture" } } }),
      ]);
      assert.ok((deletion.status === 200 && creation.status === 404) || (deletion.status === 409 && creation.status === 200), `${deletion.status}/${creation.status}`);
      const products = new Set((await workspace()).products.map(product => product.id));
      assert.ok((await studio()).campaigns.every(campaign => products.has(campaign.productId)));
    });

    await t.test("HTTP parsing, origin and private-file denials keep prior state intact", async () => {
      const revision = (await workspace()).revision;
      const malformed = await fetch(`${origin}/api/commands`, { method: "POST", headers: { "content-type": "application/json" }, body: "{" }).catch(error => { throw new Error("Malformed JSON HTTP response failed", { cause: error }); });
      assert.equal(malformed.status, 400);
      await malformed.text();
      const oversized = await request("/api/commands", "POST", { padding: "x".repeat(300_001) }).catch(error => { throw new Error("Oversized JSON HTTP response failed", { cause: error }); });
      assert.equal(oversized.status, 413);
      await oversized.text();
      const foreign = await request("/api/studio", "GET", undefined, { origin: "https://foreign.example" });
      assert.equal(foreign.status, 403); await foreign.text();
      const crossSite = await request("/api/workspace", "GET", undefined, { "sec-fetch-site": "cross-site" });
      assert.equal(crossSite.status, 403); await crossSite.text();
      for (const path of ["/.aekr/AGENTS.md", `/@fs/${resolve(".aekr/AGENTS.md").replaceAll("\\", "/")}`]) {
        const denied = await request(path);
        assert.ok([403, 404].includes(denied.status), `${path}: ${denied.status}`);
        assert.ok(!(await denied.text()).includes("# Private Agent Entry"));
      }
      assert.equal((await workspace()).revision, revision);
    });
  } finally {
    child.kill("SIGTERM");
    let forceTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([exited, new Promise<void>(done => { forceTimer = setTimeout(() => { child.kill("SIGKILL"); done(); }, 5000); })]);
    } finally { clearTimeout(forceTimer); }
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
