import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { registerHooks } from "node:module";
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import { ANALYSIS_LOCAL_TESTED_TOOL_VERSION } from "../src/core/studio-analysis.ts";

const tools = {
  ffmpeg: process.env.MARKER_FFMPEG ?? resolve(".local/tools/ffmpeg/bin/ffmpeg.exe"),
  ffprobe: process.env.MARKER_FFPROBE ?? resolve(".local/tools/ffmpeg/bin/ffprobe.exe"),
  font: process.env.MARKER_FONT ?? resolve("public/fonts/Montserrat-Medium.ttf"),
};
async function child(executable: string, argv: string[], input?: string | Buffer, env?: NodeJS.ProcessEnv): Promise<{ code: number | null; stdout: Buffer; stderr: string }> {
  return new Promise((resolveResult, reject) => {
    const process = spawn(executable, argv, { shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"], env });
    const chunks: Buffer[] = [], errors: Buffer[] = [];
    const timer = setTimeout(() => process.kill("SIGKILL"), 120_000);
    process.stdout.on("data", chunk => chunks.push(chunk)); process.stderr.on("data", chunk => errors.push(chunk));
    process.once("error", error => { clearTimeout(timer); reject(error); });
    process.once("close", code => { clearTimeout(timer); resolveResult({ code, stdout: Buffer.concat(chunks), stderr: Buffer.concat(errors).toString("utf8") }); });
    process.stdin.end(input);
  });
}
test("hosted runner probes originals, renders and streams the actual reusable FFmpeg output", { timeout: 150_000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), "marker-processor-"));
  const env = { ...process.env, MARKER_PROCESSOR_ROOT: root, MARKER_FFMPEG: tools.ffmpeg, MARKER_FFPROBE: tools.ffprobe, MARKER_FONT: tools.font };
  const runner = async (action: string, payload: unknown) => child(process.execPath, ["--experimental-strip-types", "processor/runner.mjs", action], JSON.stringify(payload), env);
  try {
    await copyFile(resolve("server/studio-render.ts"), join(root, "studio-render.ts"));
    await mkdir(join(root,"server"),{recursive:true}); await mkdir(join(root,"src","core"),{recursive:true});
    await copyFile(resolve("server/studio-render.ts"),join(root,"server","studio-render.ts"));
    await copyFile(resolve("server/studio-analysis.ts"),join(root,"server","studio-analysis.ts"));
    await copyFile(resolve("src/core/studio-analysis.ts"),join(root,"src","core","studio-analysis.ts"));
    const generated = await child(tools.ffmpeg, ["-v", "error", "-f", "lavfi", "-i", "color=c=green:s=180x320:d=5:r=30", "-c:v", "libx264", "-pix_fmt", "yuv420p", join(root, "fixture.mp4")]);
    assert.equal(generated.code, 0, generated.stderr);
    const synthetic = await readFile(join(root, "fixture.mp4"));
    const written = await child(process.execPath, ["processor/runner.mjs", "write", "inputs/0"], synthetic, env);
    assert.equal(written.code, 0, written.stderr);
    const probe = await runner("probe", { index: 0, mimeHint: "video/mp4" });
    assert.equal(probe.code, 0, probe.stderr);
    const metadata = JSON.parse(probe.stdout.toString());
    assert.equal(metadata.kind, "video"); assert.equal(metadata.width, 180); assert.equal(metadata.height, 320);
    assert.equal(metadata.sha256, createHash("sha256").update(synthetic).digest("hex"));
    assert.equal(Object.hasOwn(metadata, "speech"), false);
    const analyzed=await runner("analysis",{index:0,range:{start:0,end:5},expectedToolVersion:ANALYSIS_LOCAL_TESTED_TOOL_VERSION});
    assert.equal(analyzed.code,0,analyzed.stderr); const analysisResult=JSON.parse(analyzed.stdout.toString());
    assert.ok(analysisResult.thumbnails.length>0); assert.equal(analysisResult.analysis.toolVersion,ANALYSIS_LOCAL_TESTED_TOOL_VERSION);
    const jpeg=await child(process.execPath,["processor/runner.mjs","read",analysisResult.thumbnails[0].name],undefined,env);
    assert.equal(jpeg.code,0,jpeg.stderr); assert.equal(jpeg.stdout.subarray(0,2).toString("hex"),"ffd8"); assert.equal(jpeg.stdout.length,analysisResult.thumbnails[0].size);
    const rendered = await runner("render", { assets: [{ assetId: "synthetic", index: 0 }], spec: {
      variantId: "example", recipeRevision: 1, template: "overlay", duration: 5, hook: "Synthetic hook", body: "Editable manual copy", cta: "Review",
      fit: "contain", focusX: 0.5, focusY: 0.5, audio: "mute", clips: [{ assetId: "synthetic", kind: "video", start: 0, end: 5 }],
    } });
    assert.equal(rendered.code, 0, rendered.stderr);
    const result = JSON.parse(rendered.stdout.toString());
    assert.equal(result.width, 1080); assert.equal(result.height, 1920); assert.ok(Math.abs(result.duration - 5) < 0.1);
    const streamed = await child(process.execPath, ["processor/runner.mjs", "read", "result.mp4"], undefined, env);
    assert.equal(streamed.code, 0, streamed.stderr); assert.equal(streamed.stdout.length, result.videoSize);
    assert.deepEqual(streamed.stdout, await readFile(join(root, "output", "result.mp4")));
    const decoded = await child(tools.ffmpeg, ["-v", "error", "-i", join(root, "output", "result.mp4"), "-f", "null", "-"]);
    assert.equal(decoded.code, 0, decoded.stderr);
    const traversal = await child(process.execPath, ["processor/runner.mjs", "read", "../studio-render.ts"], undefined, env);
    assert.equal(traversal.code, 1); assert.equal(traversal.stdout.length, 0); assert.match(traversal.stderr, /INVALID_INPUT/);
    const duplicate = await child(process.execPath, ["processor/runner.mjs", "write", "inputs/0"], "overwrite", env);
    assert.equal(duplicate.code, 1); assert.deepEqual(await readFile(join(root, "inputs", "0")), synthetic);
    const invalid = await runner("probe", { index: 50 }); assert.equal(invalid.code, 1);
    const unknown = await child(process.execPath, ["processor/runner.mjs", "write", "inputs/1"], "unsupported-original", env);
    assert.equal(unknown.code, 0);
    const unsupported = await runner("probe", { index: 1, mimeHint: "video/mp4" });
    assert.equal(unsupported.code, 0, unsupported.stderr);
    const preserved = JSON.parse(unsupported.stdout.toString());
    assert.equal(preserved.processing, "unsupported"); assert.equal(preserved.audioTrack, "unknown"); assert.equal(preserved.width, null);
    assert.equal(preserved.sha256, createHash("sha256").update("unsupported-original").digest("hex"));
  } finally { await rm(root, { recursive: true, force: true }); }
});

// Replace only platform bindings at the loader boundary; execute the real DO implementation and methods.
type Run = (env: unknown, id: string, processor: unknown) => Promise<void>;
let execute: Run = async () => {};
(globalThis as typeof globalThis & { __markerProcessorExecute: Run }).__markerProcessorExecute = (...args) => execute(...args);
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "cloudflare:workers") return { url: "marker-test:workers", shortCircuit: true };
    if (specifier === "./studio-hosted.ts" && context.parentURL?.endsWith("/server/studio-processor.ts")) return { url: "marker-test:hosted", shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === "marker-test:workers") return { format: "module", source: "export class DurableObject {constructor(ctx,env){this.ctx=ctx;this.env=env;}}", shortCircuit: true };
    if (url === "marker-test:hosted") return { format: "module", source: "export const executeHostedRender=(...args)=>globalThis.__markerProcessorExecute(...args);", shortCircuit: true };
    if (url.endsWith("/processor/runner.mjs") || /\/processor\/studio-(?:render|analysis|analysis-core)\.generated\.txt$/.test(url)) return { format: "module", source: "export default 'trusted staged source';", shortCircuit: true };
    return next(url, context);
  },
});
const { StudioProcessor } = await import("../server/studio-processor.ts");
class Storage {
  values = new Map<string, unknown>(); alarm: number | null = null; tail: Promise<unknown> = Promise.resolve();
  async get<T>(name: string): Promise<T | undefined> { return this.values.get(name) as T | undefined; }
  async put(name: string, value: unknown) { this.values.set(name, structuredClone(value)); }
  async delete(names:string|string[]) { for(const name of Array.isArray(names)?names:[names])this.values.delete(name); }
  async getAlarm() { return this.alarm; } async setAlarm(value: number) { this.alarm = value; } async deleteAlarm() { this.alarm = null; }
  async transaction<T>(fn: (txn: Storage) => Promise<T>): Promise<T> { const next = this.tail.then(() => fn(this)); this.tail = next.catch(() => {}); return next; }
}
function fakeContext() {
  const sql=new DatabaseSync(':memory:');for(const name of readdirSync('migrations-d1').filter(value=>value.endsWith('.sql')).sort())sql.exec(readFileSync('migrations-d1/'+name,'utf8'));
  const storage = new Storage(); let active = 0, maximum = 0, starts = 0, destroys = 0;
  const metadata = { kind: "video", mime: "video/mp4", duration: 5, width: 180, height: 320, audioTrack: "absent", processing: "ready", sha256: "a".repeat(64) };
  const container = {
    running: false,
    start(options: { image: string; entrypoint: string[] }) { assert.equal(options.image, "cloudflare/debian-trixie"); assert.deepEqual(options.entrypoint, ["sleep", "infinity"]); this.running = true; starts++; active++; maximum = Math.max(maximum, active); },
    async destroy() { if (this.running) { destroys++; active--; } this.running = false; },
    async setInactivityTimeout(value: number) { assert.equal(value, 240_000); },
    async exec(argv: string[], options: { stdin?: ReadableStream } = {}) {
      if (options.stdin) await new Response(options.stdin).arrayBuffer();
      await new Promise(resolveWait => setTimeout(resolveWait, 1));
      const stdout = argv.at(-1) === "probe" ? new Response(JSON.stringify(metadata)).body : null;
      return { stdout, stderr: null, exitCode: Promise.resolve(0) };
    },
  };
  const puts: Array<{ key: string; bytes: Uint8Array }> = [];
  const env = { DB:{prepare(query:string){return {async first(){return sql.prepare(query).get()??null;}};}}, MEDIA: {
    async get() { return { size: 6, body: new Response("source").body }; },
    async put(key: string, body: ReadableStream) { puts.push({ key, bytes: new Uint8Array(await new Response(body).arrayBuffer()) }); return { key }; },
    async delete(key:string){const index=puts.findIndex(value=>value.key===key);if(index>=0)puts.splice(index,1);},
  }, ASSETS: { async fetch() { return new Response(new Uint8Array([0, 1, 0, 0, 77, 65, 82, 75]), { headers: { "Content-Type": "font/ttf" } }); } }, MARKER_ORIGIN: "https://marker.aekr.io" };
  const processor = new StudioProcessor({ storage, container } as never, env as never);
  return { processor, storage, container, puts, env, sql, counts: () => ({ maximum, starts, destroys }) };
}

test('DO account deletion waits for work, clears queue and permanently blocks new work after eviction',async()=>{
  const {processor,storage,container,env,counts,sql}=fakeContext();
  await processor.enqueue('pending-private-job');
  let release!:()=>void,entered!:()=>void;const working=new Promise<void>(resolve=>{entered=resolve;}),held=new Promise<void>(resolve=>{release=resolve;});const original=container.exec;
  container.exec=async(argv,options)=>{if(argv.at(-1)==='probe'){entered();await held;}return original(argv,options);};
  const operation=processor.probe('originals/private-input');await working;
  sql.prepare("UPDATE marker_account_lifecycle SET status='deleting',phase='processor' WHERE id=1").run();
  let stopped=false;const stop=processor.stopForAccountDeletion().then(()=>{stopped=true;});
  await Promise.resolve();assert.equal(stopped,false);release();
  await assert.rejects(operation,/PROCESSOR_ACCOUNT_CLOSED/);await stop;
  assert.equal(storage.alarm,null);assert.equal(await storage.get('pending'),undefined);assert.equal(await storage.get('recoveries'),undefined);assert.equal(await storage.get('accountDeleted'),true);
  const restarted=new StudioProcessor({storage,container} as never,env as never);
  await assert.rejects(restarted.enqueue('late-job'),/PROCESSOR_ACCOUNT_CLOSED/);await assert.rejects(restarted.probe('originals/late'),/PROCESSOR_ACCOUNT_CLOSED/);await restarted.alarm();assert.equal(storage.alarm,null);assert.equal(counts().starts,1);sql.close();
});

test('DO fails closed when the lifecycle store is unavailable before starting any container',async()=>{
  const {processor,sql,counts}=fakeContext();sql.exec('DROP TABLE marker_account_lifecycle');
  await assert.rejects(processor.probe('originals/one'),/ACCOUNT_UNAVAILABLE/);assert.equal(counts().starts,0);sql.close();
});

test('DO never starts an R2 write when a delayed container read resolves after timeout and account stop',async()=>{
  const {processor,container,env,sql}=fakeContext(),original=container.exec,previousTimer=globalThis.setTimeout;
  const platform=globalThis as typeof globalThis & {FixedLengthStream?:unknown},previousStream=platform.FixedLengthStream;
  platform.FixedLengthStream=class{readable:ReadableStream;writable:WritableStream;constructor(){const stream=new TransformStream();this.readable=stream.readable;this.writable=stream.writable;}};
  let expire!:()=>void,release!:()=>void,entered!:()=>void,writes=0;
  const reading=new Promise<void>(resolve=>{entered=resolve;}),held=new Promise<void>(resolve=>{release=resolve;});
  globalThis.setTimeout=((callback:(...args:unknown[])=>void,delay?:number,...args:unknown[])=>delay===240_000?(expire=()=>callback(...args),previousTimer(()=>{},60_000)):previousTimer(callback,delay,...args)) as typeof setTimeout;
  const save=env.MEDIA.put;env.MEDIA.put=async(key,body)=>{writes++;return save(key,body);};
  container.exec=async(argv,options)=>{
    if(argv.at(-1)==='render'){if(options?.stdin)await new Response(options.stdin).arrayBuffer();return {stdout:new Response(JSON.stringify({duration:5,width:1080,height:1920,videoSize:5,coverSize:4})).body,stderr:null,exitCode:Promise.resolve(0)};}
    if(argv.at(-2)==='read'){entered();await held;return {stdout:new Response('video').body,stderr:null,exitCode:Promise.resolve(0)};}
    return original(argv,options);
  };
  try{
    const failed=assert.rejects(processor.render('late',{} as never,[{assetId:'one',key:'originals/one'}],{videoKey:'renders/late/video.mp4',coverKey:'renders/late/cover.png'}),/PROCESSOR_TIMEOUT/);
    await reading;expire();await failed;
    sql.prepare("UPDATE marker_account_lifecycle SET status='deleting',phase='processor' WHERE id=1").run();await processor.stopForAccountDeletion();
    release();await new Promise(resolve=>previousTimer(resolve,20));assert.equal(writes,0);
  }finally{release?.();globalThis.setTimeout=previousTimer;platform.FixedLengthStream=previousStream;sql.close();}
});
test("DO durably deduplicates jobs, retains queue during work and does not repeat failed work", async () => {
  const { processor, storage } = fakeContext(); const seen: string[] = [];
  execute = async (_, id) => { seen.push(id); assert.ok((await storage.get<string[]>("pending"))?.includes(id)); };
  await Promise.all([processor.enqueue("one"), processor.enqueue("one"), processor.enqueue("two")]);
  assert.deepEqual(await storage.get("pending"), ["one", "two"]);
  await processor.alarm(); assert.deepEqual(await storage.get("pending"), ["two"]); assert.ok(storage.alarm !== null);
  await processor.alarm(); await processor.alarm();
  assert.deepEqual(seen, ["one", "two"]); assert.deepEqual(await storage.get("pending"), []); assert.equal(storage.alarm, null);
});
test("DO preserves infrastructure failures through one watchdog and parks until an explicit same-ID request", async () => {
  const { processor, storage } = fakeContext(); let attempts = 0;
  execute = async () => { attempts++; throw new Error("synthetic D1 unavailable"); };
  await processor.enqueue("one");
  await processor.alarm(); assert.deepEqual(await storage.get("pending"), ["one"]); assert.ok(storage.alarm! > Date.now() + 600_000);
  await processor.alarm(); assert.deepEqual(await storage.get("pending"), ["one"]); assert.equal(storage.alarm, null);
  await processor.alarm(); assert.equal(attempts, 2);
  execute = async () => { attempts++; };
  await processor.enqueue("one"); assert.ok(storage.alarm !== null);
  await processor.alarm(); assert.equal(attempts, 3); assert.deepEqual(await storage.get("pending"), []); assert.equal(storage.alarm, null);
});
test("DO serializes native operations, destroys scratch after each and rejects arbitrary object keys", async () => {
  const { processor, counts } = fakeContext();
  const results = await Promise.all([processor.probe("originals/one"), processor.probe("originals/two")]);
  assert.equal(results[0].width, 180); assert.equal(results[1].sha256, "a".repeat(64));
  assert.deepEqual(counts(), { maximum: 1, starts: 2, destroys: 2 });
  await assert.rejects(processor.probe("https://example.com/media"), /INVALID_OBJECT_KEY/);
  await assert.rejects(processor.probe("originals/../secret"), /INVALID_OBJECT_KEY/);
  await assert.rejects(processor.render("one", {} as never, [], { videoKey: "renders/other/video.mp4", coverKey: "renders/one/cover.png" }), /INVALID_RENDER_OUTPUTS/);
  assert.equal(counts().starts, 2);
});
test("DO stops failed container work and leaves the next explicit operation usable", async () => {
  const { processor, container, counts } = fakeContext();
  const original = container.exec; let fail = true;
  container.exec = async (...args) => { if (fail) { fail = false; throw new Error("synthetic boot failure"); } return original(...args); };
  await assert.rejects(processor.probe("originals/one"), /synthetic boot failure/);
  assert.equal(counts().destroys, 1);
  assert.equal((await processor.probe("originals/one")).processing, "ready");
  assert.deepEqual(counts(), { maximum: 1, starts: 2, destroys: 2 });
});
test("DO streams exact bounded MP4 and cover bytes into private R2 without a media buffer", async () => {
  const platform = globalThis as typeof globalThis & { FixedLengthStream?: unknown };
  const previous = platform.FixedLengthStream;
  platform.FixedLengthStream = class {
    readable: ReadableStream; writable: WritableStream;
    constructor(expected: number) {
      let size = 0;
      const stream = new TransformStream({ transform(bytes, controller) { size += bytes.byteLength; if (size > expected) throw new Error("length overflow"); controller.enqueue(bytes); }, flush() { assert.equal(size, expected); } });
      this.readable = stream.readable; this.writable = stream.writable;
    }
  };
  try {
    const { processor, container, puts } = fakeContext(), original = container.exec;
    container.exec = async (argv, options) => {
      if (argv.at(-1) === "render") {
        if (options?.stdin) await new Response(options.stdin).arrayBuffer();
        return { stdout: new Response(JSON.stringify({ duration: 5, width: 1080, height: 1920, videoSize: 5, coverSize: 4 })).body, stderr: null, exitCode: Promise.resolve(0) };
      }
      if (argv.at(-2) === "read") return { stdout: new Response(argv.at(-1) === "result.mp4" ? "video" : "png!").body, stderr: null, exitCode: Promise.resolve(0) };
      return original(argv, options);
    };
    const result = await processor.render("job-one", {} as never, [{ assetId: "one", key: "originals/one" }], { videoKey: "renders/job-one/video.mp4", coverKey: "renders/job-one/cover.png" });
    assert.deepEqual(result, { duration: 5, width: 1080, height: 1920 });
    assert.deepEqual(puts.map(value => [value.key, new TextDecoder().decode(value.bytes)]), [["renders/job-one/video.mp4", "video"], ["renders/job-one/cover.png", "png!"]]);
  } finally { platform.FixedLengthStream = previous; }
});
test("DO aggregate deadline includes startup and destroys the entire container", async () => {
  const previous = globalThis.setTimeout;
  const { processor, container, counts } = fakeContext();
  container.setInactivityTimeout = async () => new Promise(() => {});
  globalThis.setTimeout = ((callback: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) => previous(callback, delay === 240_000 ? 15 : delay, ...args)) as typeof setTimeout;
  try {
    await assert.rejects(processor.probe("originals/one"), /PROCESSOR_TIMEOUT/);
    assert.deepEqual(counts(), { maximum: 1, starts: 1, destroys: 1 });
  } finally { globalThis.setTimeout = previous; }
});
test("DO diagnostic logs identify fixed failing stage and exit code without exposing process output", async () => {
  const { processor, container } = fakeContext(), original = container.exec;
  const previous = console.error, logs: string[] = [];
  console.error = value => { logs.push(String(value)); };
  container.exec = async (argv, options) => {
    if (argv[0] === "/usr/bin/apt-get" && argv[1] === "install") return {
      stdout: null, stderr: new Response("Failed to fetch https://private.invalid/owner-name secret-key /original/private-path").body, exitCode: Promise.resolve(100),
    };
    return original(argv, options);
  };
  try {
    await assert.rejects(processor.probe("originals/private-original"), /PROCESSOR_COMMAND_FAILED/);
    assert.equal(logs.length, 1);
    assert.deepEqual(JSON.parse(logs[0]), { event: "studio_processor_failure", phase: "probe", stage: "apt-install", code: "PROCESSOR_COMMAND_FAILED", name: "Error", exitCode: 100, diagnostic: "package_fetch" });
    assert.doesNotMatch(logs[0], /private|owner-name|secret-key|https/);
  } finally { console.error = previous; }
});
test("DO accepts font bytes without Content-Length and preserves them while rejecting oversized or HTML assets", async () => {
  const { processor, container, env } = fakeContext(), original = container.exec;
  const font = new Uint8Array([0, 1, 0, 0, 10, 20, 30, 40]); let written: Uint8Array | undefined;
  env.ASSETS.fetch = async () => new Response(font, { headers: { "Content-Type": "font/ttf" } });
  container.exec = async (argv, options) => {
    if (argv.at(-1) === "/tmp/marker/font.ttf" && options?.stdin) {
      written = new Uint8Array(await new Response(options.stdin).arrayBuffer());
      return { stdout: null, stderr: null, exitCode: Promise.resolve(0) };
    }
    return original(argv, options);
  };
  assert.equal((await processor.probe("originals/one")).processing, "ready"); assert.deepEqual(written, font);
  env.ASSETS.fetch = async () => new Response("<!doctype html><html>SPA fallback</html>", { headers: { "Content-Type": "text/html" } });
  await assert.rejects(processor.probe("originals/one"), /PROCESSOR_FONT_UNAVAILABLE/);
  env.ASSETS.fetch = async () => new Response("<!doctype html>", { headers: { "Content-Type": "font/ttf" } });
  await assert.rejects(processor.probe("originals/one"), /PROCESSOR_FONT_UNAVAILABLE/);
  env.ASSETS.fetch = async () => new Response(new Uint8Array(2 * 1024 * 1024 + 1), { headers: { "Content-Type": "font/ttf" } });
  await assert.rejects(processor.probe("originals/one"), /PROCESSOR_FONT_UNAVAILABLE/);
});
