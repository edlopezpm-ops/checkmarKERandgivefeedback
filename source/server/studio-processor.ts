import { DurableObject } from "cloudflare:workers";
import rendererSource from "../processor/studio-render.generated.txt";
import analysisSource from "../processor/studio-analysis.generated.txt";
import analysisCoreSource from "../processor/studio-analysis-core.generated.txt";
import runnerSource from "../processor/runner.mjs";
import type { MediaMetadata, RenderSpec } from "./studio-render.ts";
import { executeHostedRender } from "./studio-hosted.ts";
import { assertAccountActive } from "./profile.ts";
import { ANALYSIS_MAX_THUMB_BYTES, validateAnalysisResult, type StudioAnalysisRange, type StudioAnalysisResult } from "../src/core/studio-analysis.ts";

const ROOT = "/tmp/marker";
const MAX_FILE = 250 * 1024 * 1024;
const MAX_COVER = 20 * 1024 * 1024;
const WALL_MS = 240_000;
const WRITE_FILE = "import{mkdir,createWriteStream}from'node:fs';import{dirname}from'node:path';import{pipeline}from'node:stream/promises';import{promisify}from'node:util';await promisify(mkdir)(dirname(process.argv[1]),{recursive:true});await pipeline(process.stdin,createWriteStream(process.argv[1],{flags:'wx'}));";

type Operation = { container: Container; deadline: number; stage: string; exitCode?: number; diagnostic?: string; live(): void };
type RenderResult = { duration: number; width: number; height: number; videoSize: number; coverSize: number };

function failure(code: string): Error { return new Error(code); }
function key(value: string): void {
  if (typeof value !== "string" || !/^(originals\/[a-zA-Z0-9_-]{1,100}|renders\/[a-zA-Z0-9_-]{1,100}\/(video\.mp4|cover\.png)|analysis\/[a-zA-Z0-9_-]{1,100}\/thumb-[0-5]\.jpg)$/.test(value)) throw failure("INVALID_OBJECT_KEY");
}
function job(value: string): void { if (typeof value !== "string" || !/^[a-zA-Z0-9-]{1,100}$/.test(value)) throw failure("INVALID_JOB_ID"); }
function stream(text: string): ReadableStream { return new Response(text).body!; }

/** One processor per private sole-owner workspace; no public container port or execution route. */
export class StudioProcessor extends DurableObject<Env> {
  private operations: Promise<unknown> = Promise.resolve();
  private alarmRunning = false;
  private accountStopping = false;
  private writes = new Set<Promise<unknown>>();

  private async assertAvailable(): Promise<void> {
    if (this.accountStopping || await this.ctx.storage.get<boolean>("accountDeleted")) throw failure("PROCESSOR_ACCOUNT_CLOSED");
    await assertAccountActive(this.env);
  }

  async stopForAccountDeletion(): Promise<void> {
    this.accountStopping = true;
    await this.ctx.storage.put("accountDeleted", true);
    await this.ctx.storage.deleteAlarm();
    if (this.ctx.container) await this.ctx.container.destroy();
    await this.operations;
    await Promise.allSettled([...this.writes]);
    await this.ctx.storage.transaction(async txn => {
      await txn.delete(["pending", "recoveries"]);
      await txn.deleteAlarm();
    });
  }

  async enqueue(jobId: string): Promise<void> {
    job(jobId);
    await this.assertAvailable();
    await this.ctx.storage.transaction(async txn => {
      if (this.accountStopping || await txn.get<boolean>("accountDeleted")) throw failure("PROCESSOR_ACCOUNT_CLOSED");
      const pending = await txn.get<string[]>("pending") ?? [];
      const recoveries = await txn.get<Record<string, number>>("recoveries") ?? {};
      if (!pending.includes(jobId)) {
        if (pending.length >= 50) throw failure("PROCESSOR_QUEUE_FULL");
        pending.push(jobId);
        await txn.put("pending", pending);
      }
      // A parked infrastructure failure resumes only through another explicit owner request.
      if ((recoveries[jobId] ?? 0) >= 2) { delete recoveries[jobId]; await txn.put("recoveries", recoveries); }
      if (await txn.getAlarm() === null) await txn.setAlarm(Date.now() + 100);
    });
  }

  async alarm(): Promise<void> {
    if (this.alarmRunning) return;
    try { await this.assertAvailable(); } catch { await this.ctx.storage.deleteAlarm(); return; }
    this.alarmRunning = true;
    try {
      const pending = await this.ctx.storage.get<string[]>("pending") ?? [];
      const recoveries = await this.ctx.storage.get<Record<string, number>>("recoveries") ?? {};
      const jobId = pending.find(id => (recoveries[id] ?? 0) < 2);
      if (!jobId) return;
      // Retain the ID across eviction. An expired D1 lease is terminal, never a fresh paid attempt.
      await this.ctx.storage.setAlarm(Date.now() + 610_000);
      let infrastructureFailure = false;
      try { await executeHostedRender(this.env, jobId, this); }
      catch { infrastructureFailure = true; if (!this.accountStopping) console.error(JSON.stringify({ event: "studio_processor_job_failed", jobId })); }
      await this.ctx.storage.transaction(async txn => {
        if (this.accountStopping || await txn.get<boolean>("accountDeleted")) { await txn.delete(["pending", "recoveries"]); await txn.deleteAlarm(); return; }
        const queued = await txn.get<string[]>("pending") ?? [];
        const attempts = await txn.get<Record<string, number>>("recoveries") ?? {};
        if (infrastructureFailure) attempts[jobId] = (attempts[jobId] ?? 0) + 1;
        else delete attempts[jobId];
        const remaining = infrastructureFailure ? queued : queued.filter(id => id !== jobId);
        await txn.put("pending", remaining);
        await txn.put("recoveries", attempts);
        const runnable = remaining.find(id => (attempts[id] ?? 0) < 2);
        if (runnable) await txn.setAlarm(Date.now() + (infrastructureFailure && runnable === jobId ? 610_000 : 100));
        else await txn.deleteAlarm();
      });
    } finally { this.alarmRunning = false; }
  }

  async probe(objectKey: string, mimeHint?: string): Promise<MediaMetadata & { sha256: string }> {
    key(objectKey);
    return this.exclusive("probe", async operation => {
      await this.bootstrap(operation);
      await this.input(operation, objectKey, 0);
      return await this.action(operation, "probe", { index: 0, mimeHint }) as MediaMetadata & { sha256: string };
    });
  }

  async render(jobId: string, spec: RenderSpec, inputs: Array<{ assetId: string; key: string }>, outputs: { videoKey: string; coverKey: string }): Promise<{ duration: number; width: number; height: number }> {
    job(jobId); key(outputs.videoKey); key(outputs.coverKey);
    if (!Array.isArray(inputs) || inputs.length > 4 || new Set(inputs.map(input => input.assetId)).size !== inputs.length) throw failure("INVALID_RENDER_INPUTS");
    for (const input of inputs) { key(input.key); if (!input.key.startsWith("originals/")) throw failure("INVALID_RENDER_INPUTS"); }
    if (outputs.videoKey !== `renders/${jobId}/video.mp4` || outputs.coverKey !== `renders/${jobId}/cover.png`) throw failure("INVALID_RENDER_OUTPUTS");
    return this.exclusive("render", async operation => {
      await this.bootstrap(operation);
      for (const [index, input] of inputs.entries()) await this.input(operation, input.key, index);
      const result = await this.action(operation, "render", { spec, assets: inputs.map((input, index) => ({ assetId: input.assetId, index })) }) as RenderResult;
      if (![result.videoSize, result.coverSize].every(value => Number.isSafeInteger(value) && value > 0) || result.videoSize > MAX_FILE || result.coverSize > MAX_COVER) throw failure("OUTPUT_SIZE_LIMIT");
      await this.output(operation, "result.mp4", outputs.videoKey, result.videoSize, "video/mp4");
      await this.output(operation, "cover.png", outputs.coverKey, result.coverSize, "image/png");
      return { duration: result.duration, width: result.width, height: result.height };
    });
  }
  async analyze(analysisId: string, objectKey: string, range: StudioAnalysisRange, expectedToolVersion: string): Promise<{analysis:StudioAnalysisResult;thumbnails:Array<{name:string;size:number}>}> {
    job(analysisId); key(objectKey);
    if (!objectKey.startsWith("originals/") || typeof expectedToolVersion !== "string" || !expectedToolVersion || expectedToolVersion.length > 240) throw failure("INVALID_ANALYSIS_INPUT");
    return this.exclusive("analysis", async operation => {
      await this.bootstrap(operation); await this.input(operation, objectKey, 0);
      const returned = await this.action(operation, "analysis", { index: 0, range, expectedToolVersion }) as {analysis:StudioAnalysisResult;thumbnails:Array<{name:string;size:number}>};
      const analysis = validateAnalysisResult(returned.analysis, range);
      if (analysis.toolVersion !== expectedToolVersion || !Array.isArray(returned.thumbnails) || returned.thumbnails.length > 6) throw failure("INVALID_ANALYSIS_RESULT");
      let bytes = 0;
      for (const thumbnail of returned.thumbnails) {
        if (!/^thumb-[0-5]\.jpg$/.test(thumbnail.name) || !Number.isSafeInteger(thumbnail.size) || thumbnail.size <= 0 || !analysis.thumbnails.some(item => item.name === thumbnail.name)) throw failure("INVALID_ANALYSIS_RESULT");
        bytes += thumbnail.size;
      }
      if (bytes > ANALYSIS_MAX_THUMB_BYTES || new Set(returned.thumbnails.map(item => item.name)).size !== returned.thumbnails.length || returned.thumbnails.length !== analysis.thumbnails.length) throw failure("INVALID_ANALYSIS_RESULT");
      for (const thumbnail of returned.thumbnails) await this.output(operation, thumbnail.name, `analysis/${analysisId}/${thumbnail.name}`, thumbnail.size, "image/jpeg");
      return { analysis, thumbnails: returned.thumbnails };
    });
  }

  private async exclusive<T>(phase: "probe" | "render" | "analysis", work: (operation: Operation) => Promise<T>): Promise<T> {
    await this.assertAvailable();
    const run = this.operations.then(async () => {
      await this.assertAvailable();
      const container = this.ctx.container;
      if (!container) throw failure("PROCESSOR_NOT_CONFIGURED");
      let expired = false;
      const isStopping = () => this.accountStopping;
      const operation: Operation = { container, deadline: Date.now() + WALL_MS, stage: "start", live() { if (isStopping()) throw failure("PROCESSOR_ACCOUNT_CLOSED"); if (expired || Date.now() >= this.deadline) throw failure("PROCESSOR_TIMEOUT"); } };
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          expired = true;
          // Destroy reaches FFmpeg descendants too; a process-only signal would not.
          void container.destroy().catch(() => {});
          reject(failure("PROCESSOR_TIMEOUT"));
        }, WALL_MS);
      });
      try {
        return await Promise.race([(async () => {
          if (container.running) await container.destroy();
          operation.live();
          container.start({ image: "cloudflare/debian-trixie", instance: "standard-2", enableInternet: true, entrypoint: ["sleep", "infinity"] });
          operation.stage = "inactivity-timeout";
          await container.setInactivityTimeout(WALL_MS);
          operation.live();
          return await work(operation);
        })(), timeout]);
      } catch (error) {
        const code = error instanceof Error && /^PROCESSOR_[A-Z_]+$/.test(error.message) ? error.message : "PROCESSOR_NATIVE_ERROR";
        const name = error instanceof Error && ["Error", "TypeError", "RangeError", "AbortError"].includes(error.name) ? error.name : "Error";
        console.error(JSON.stringify({ event: "studio_processor_failure", phase, stage: operation.stage, code, name,
          ...(operation.exitCode === undefined ? {} : { exitCode: operation.exitCode }), ...(operation.diagnostic ? { diagnostic: operation.diagnostic } : {}) }));
        throw error;
      } finally {
        expired = true;
        if (timer !== undefined) clearTimeout(timer);
        try { await container.destroy(); }
        catch (error) {
          console.error(JSON.stringify({ event: "studio_processor_failure", phase, stage: "destroy", code: "PROCESSOR_NATIVE_ERROR",
            name: error instanceof Error && ["Error", "TypeError", "RangeError", "AbortError"].includes(error.name) ? error.name : "Error" }));
          throw error;
        }
      }
    });
    this.operations = run.catch(() => {});
    return run;
  }

  private async command(operation: Operation, argv: string[], stdin?: ReadableStream, capture = false): Promise<string> {
    operation.live();
    const process = await operation.container.exec(argv, { stdin, stdout: capture ? "pipe" : "ignore", stderr: "pipe", env: { DEBIAN_FRONTEND: "noninteractive", LC_ALL: "C" } });
    const reading = capture && process.stdout ? this.smallOutput(process.stdout, operation.stage === "analysis" ? 80 * 1024 : 64 * 1024) : Promise.resolve("");
    const diagnostics = process.stderr ? this.diagnosticOutput(process.stderr) : Promise.resolve(undefined);
    const [text, code, diagnostic] = await Promise.all([reading, process.exitCode, diagnostics]);
    operation.live();
    if (code !== 0) { operation.exitCode = code; operation.diagnostic = diagnostic; throw failure("PROCESSOR_COMMAND_FAILED"); }
    return text;
  }

  private async diagnosticOutput(source: ReadableStream): Promise<string | undefined> {
    const reader = source.getReader(); let tail = "", size = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        size += (value as Uint8Array).byteLength;
        if (size > 256 * 1024) { await reader.cancel(); throw failure("PROCESSOR_DIAGNOSTIC_LIMIT"); }
        tail = (tail + new TextDecoder().decode(value as Uint8Array)).slice(-8192);
      }
    } finally { reader.releaseLock(); }
    // Classifications only. Never log diagnostics, caller text, original names, keys or command argv.
    if (/Temporary failure resolving|Could not resolve|Name or service not known/i.test(tail)) return "dns";
    if (/Unable to locate package/i.test(tail)) return "package_missing";
    if (/Failed to fetch|Unable to fetch/i.test(tail)) return "package_fetch";
    if (/ERR_MODULE_NOT_FOUND|Cannot find module/i.test(tail)) return "module_missing";
    if (/SyntaxError/i.test(tail)) return "syntax";
    if (/Permission denied/i.test(tail)) return "permission";
    const code = /\{"code":"([A-Z_]{1,80})"\}/.exec(tail)?.[1];
    return code ? `runner_${code}` : undefined;
  }

  private async smallOutput(source: ReadableStream, maximum = 64 * 1024): Promise<string> {
    const reader = source.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        const bytes = value as Uint8Array; size += bytes.byteLength;
        if (size > maximum) { await reader.cancel(); throw failure("PROCESSOR_METADATA_LIMIT"); }
        chunks.push(bytes);
      }
    } finally { reader.releaseLock(); }
    const combined = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder().decode(combined);
  }

  private async write(operation: Operation, name: string, body: ReadableStream): Promise<void> {
    operation.stage = name === "studio-render.ts" ? "stage-renderer" : name === "runner.mjs" ? "stage-runner" : name === "font.ttf" ? "stage-font" : "stage-input";
    await this.command(operation, ["node", "--input-type=module", "-e", WRITE_FILE, `${ROOT}/${name}`], body);
  }

  private async bootstrap(operation: Operation): Promise<void> {
    operation.stage = "apt-update";
    await this.command(operation, ["/usr/bin/apt-get", "update", "-qq"]);
    operation.stage = "apt-install";
    await this.command(operation, ["/usr/bin/apt-get", "install", "-y", "-qq", "--no-install-recommends", "ffmpeg", "fonts-dejavu-core"]);
    await this.write(operation, "studio-render.ts", stream(rendererSource));
    await this.write(operation, "server/studio-render.ts", stream(rendererSource));
    await this.write(operation, "server/studio-analysis.ts", stream(analysisSource));
    await this.write(operation, "src/core/studio-analysis.ts", stream(analysisCoreSource));
    await this.write(operation, "runner.mjs", stream(runnerSource));
    operation.stage = "fetch-font";
    const font = await this.env.ASSETS.fetch(new URL("/fonts/Montserrat-Medium.ttf", this.env.MARKER_ORIGIN));
    const bytes = await this.fontBytes(font);
    await this.write(operation, "font.ttf", new Response(bytes).body!);
  }

  private async fontBytes(response: Response): Promise<Uint8Array<ArrayBuffer>> {
    const maximum = 2 * 1024 * 1024, declared = response.headers.get("Content-Length");
    const mime = response.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase();
    if (!response.ok || !response.body || !mime || !/^(?:font\/(?:ttf|sfnt)|application\/(?:x-font-ttf|font-sfnt|octet-stream))$/.test(mime)
      || declared !== null && (!/^\d+$/.test(declared) || Number(declared) <= 0 || Number(declared) > maximum)) throw failure("PROCESSOR_FONT_UNAVAILABLE");
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        const bytes = value as Uint8Array; size += bytes.byteLength;
        if (size > maximum) { await reader.cancel(); throw failure("PROCESSOR_FONT_UNAVAILABLE"); }
        chunks.push(bytes);
      }
    } finally { reader.releaseLock(); }
    // Validate actual TTF/SFNT bytes; a SPA fallback must never become a font.
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    if (bytes.length < 4 || bytes[0] !== 0 || bytes[1] !== 1 || bytes[2] !== 0 || bytes[3] !== 0) throw failure("PROCESSOR_FONT_UNAVAILABLE");
    return bytes;
  }

  private async input(operation: Operation, objectKey: string, index: number): Promise<void> {
    operation.stage = "fetch-input";
    operation.live();
    const object = await this.env.MEDIA.get(objectKey);
    if (!object || object.size <= 0 || object.size > MAX_FILE) throw failure("PROCESSOR_INPUT_UNAVAILABLE");
    await this.write(operation, `inputs/${index}`, object.body);
  }

  private async action(operation: Operation, action: "probe" | "render" | "analysis", payload: unknown): Promise<unknown> {
    operation.stage = action;
    const body = JSON.stringify(payload);
    if (new TextEncoder().encode(body).byteLength > 64 * 1024) throw failure("PROCESSOR_RECIPE_LIMIT");
    const result = await this.command(operation, ["node", "--experimental-strip-types", `${ROOT}/runner.mjs`, action], stream(body), true);
    try { return JSON.parse(result); } catch { throw failure("PROCESSOR_INVALID_METADATA"); }
  }

  private async output(operation: Operation, name: string, objectKey: string, size: number, mime: string): Promise<void> {
    operation.stage = name === "result.mp4" ? "store-video" : "store-cover";
    operation.live();
    await this.assertAvailable();
    const process = await operation.container.exec(["node", `${ROOT}/runner.mjs`, "read", name], { stdout: "pipe", stderr: "ignore" });
    operation.live();
    await this.assertAvailable();
    operation.live();
    if (!process.stdout) throw failure("PROCESSOR_OUTPUT_UNAVAILABLE");
    const fixed = new FixedLengthStream(size);
    const saving = this.env.MEDIA.put(objectKey, fixed.readable, { httpMetadata: { contentType: mime }, onlyIf: { etagDoesNotMatch: "*" } });
    this.writes.add(saving);
    const results = await Promise.allSettled([
      process.stdout.pipeTo(fixed.writable),
      saving,
      process.exitCode,
    ]);
    this.writes.delete(saving);
    try { await this.assertAvailable(); } catch (error) { await this.env.MEDIA.delete(objectKey); throw error; }
    operation.live();
    if (results[0].status !== 'fulfilled' || results[1].status !== 'fulfilled' || !results[1].value || results[2].status !== 'fulfilled' || results[2].value !== 0) throw failure("PROCESSOR_OUTPUT_FAILED");
  }
}
