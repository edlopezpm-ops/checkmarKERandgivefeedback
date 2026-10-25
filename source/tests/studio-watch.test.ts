import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { createServer } from "vite";

test("actual Vite watcher observes source changes but excludes transient private media", { timeout: 30_000 }, async () => {
  const temporary = await mkdtemp(join(tmpdir(), "marker-watch-test-")), token = crypto.randomUUID();
  const privateRoot = resolve(".local", `watch-regression-${token}`), control = resolve(`marker-watch-regression-${token}.txt`);
  const priorData = process.env.MARKER_LOCAL_DATA, priorStudio = process.env.MARKER_STUDIO_DIR;
  process.env.MARKER_LOCAL_DATA = join(temporary, "workspace.json");
  process.env.MARKER_STUDIO_DIR = join(temporary, "studio");
  let server: Awaited<ReturnType<typeof createServer>> | undefined;
  const events: string[] = [];
  try {
    server = await createServer({ configFile: resolve("vite.config.ts"), logLevel: "silent", server: { port: 0, strictPort: false } });
    server.watcher.on("all", (_event, path) => { events.push(resolve(path)); });
    await server.listen();
    await writeFile(control, "ordinary source watcher control");
    const deadline = Date.now() + 6000;
    // ignoreInitial suppresses files discovered during startup; wait until the
    // control is indexed, then make an actual source change.
    const indexed = () => Object.entries(server!.watcher.getWatched()).some(([directory, files]) => resolve(directory) === dirname(control) && files.includes(basename(control)));
    while (!indexed() && Date.now() < deadline) await new Promise(done => setTimeout(done, 50));
    assert.ok(indexed(), "The ordinary control must enter the watched source tree.");
    await writeFile(control, "ordinary source watcher control, changed after startup");
    while (!events.includes(control) && Date.now() < deadline) await new Promise(done => setTimeout(done, 50));
    assert.ok(events.includes(control), "The ordinary control must be observed, proving the actual watcher is live.");
    await mkdir(join(privateRoot, "renders", "job", ".render-transient"), { recursive: true });
    await writeFile(join(privateRoot, "renders", "job", ".render-transient", "font.ttf"), "synthetic locked-font candidate");
    await new Promise(done => setTimeout(done, 300));
    await writeFile(control, "ordinary source watcher control changed");
    await new Promise(done => setTimeout(done, 100));
    assert.ok(!events.some(path => path.startsWith(privateRoot)), "Generated media must never enter source-watch events.");
    const watched = Object.entries(server.watcher.getWatched()).flatMap(([directory, files]) => [resolve(directory), ...files.map(file => resolve(directory, file))]);
    assert.ok(!watched.some(path => path.startsWith(privateRoot)), "The private render/font directory must not be watched.");
  } finally {
    await server?.close();
    if (priorData === undefined) delete process.env.MARKER_LOCAL_DATA; else process.env.MARKER_LOCAL_DATA = priorData;
    if (priorStudio === undefined) delete process.env.MARKER_STUDIO_DIR; else process.env.MARKER_STUDIO_DIR = priorStudio;
    assert.ok(privateRoot.startsWith(resolve(".local") + "/") || privateRoot.startsWith(resolve(".local") + "\\"));
    assert.ok(resolve(temporary).startsWith(resolve(join(tmpdir(), "marker-watch-test-"))));
    await rm(control, { force: true });
    await rm(privateRoot, { recursive: true, force: true });
    await rm(temporary, { recursive: true, force: true });
  }
});
