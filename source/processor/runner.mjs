import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = "/tmp/marker";
const MAX_FILE = 250 * 1024 * 1024;

function fail(code) { const error = new Error(code); error.code = code; throw error; }
function inputPath(root, index) {
  if (!Number.isSafeInteger(index) || index < 0 || index > 3) fail("INVALID_INPUT");
  return join(root, "inputs", String(index));
}
async function fileInfo(path, maximum) {
  const info = await stat(path);
  if (!info.isFile() || info.size <= 0 || info.size > maximum) fail("FILE_LIMIT");
  return { size: info.size };
}

/** Trusted fixed operations only. Original names, URLs and user executable code are never accepted. */
export async function runAction(action, payload, options = {}) {
  const root = options.root ?? ROOT;
  const tools = options.tools ?? { ffmpeg: "/usr/bin/ffmpeg", ffprobe: "/usr/bin/ffprobe", font: join(root, "font.ttf") };
  const renderer = await import(pathToFileURL(join(root, "studio-render.ts")).href);
  if (action === "probe") {
    const path = inputPath(root, payload.index);
    await fileInfo(path, MAX_FILE);
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(path)) hash.update(chunk);
    let info;
    try { info = await renderer.probeMedia(path, tools); }
    catch (error) {
      if (!["UNSUPPORTED_MEDIA", "INVALID_MEDIA", "MEDIA_PROCESSING_FAILED"].includes(error?.code)) throw error;
      const hint = payload.mimeHint;
      if (typeof hint !== "string" || !/^(video|image|audio)\//.test(hint)) throw error;
      info = { kind: hint.split("/")[0], mime: "application/octet-stream", duration: null, width: null, height: null, audioTrack: "unknown", processing: "unsupported" };
    }
    return { ...info, sha256: hash.digest("hex") };
  }
  if (action === "render") {
    if (!Array.isArray(payload.assets) || payload.assets.length > 4) fail("INVALID_INPUT");
    const paths = Object.create(null);
    for (const asset of payload.assets) {
      if (!asset || typeof asset.assetId !== "string" || !asset.assetId || asset.assetId.length > 200 || Object.hasOwn(paths, asset.assetId)) fail("INVALID_INPUT");
      paths[asset.assetId] = inputPath(root, asset.index);
      await fileInfo(paths[asset.assetId], MAX_FILE);
    }
    const result = await renderer.renderMedia(payload.spec, paths, join(root, "output"), tools);
    const video = await fileInfo(result.videoPath, MAX_FILE), cover = await fileInfo(result.coverPath, 20 * 1024 * 1024);
    return { duration: result.duration, width: result.width, height: result.height, videoSize: video.size, coverSize: cover.size };
  }
  if (action === "analysis") {
    const path = inputPath(root, payload.index);
    await fileInfo(path, MAX_FILE);
    if (typeof payload.expectedToolVersion !== "string" || !payload.expectedToolVersion || payload.expectedToolVersion.length > 240) fail("INVALID_INPUT");
    const analyzer = await import(pathToFileURL(join(root, "server", "studio-analysis.ts")).href);
    const result = await analyzer.analyzeMedia(path, payload.range, join(root, "analysis"), tools, { expectedToolVersion: payload.expectedToolVersion });
    return { analysis: result.analysis, thumbnails: result.thumbnails.map(({ name, size }) => ({ name, size })) };
  }
  fail("INVALID_OPERATION");
}

async function main() {
  const action = process.argv[2];
  // Test runner overrides are explicit process environment; hosted process supplies neither override.
  const root = process.env.MARKER_PROCESSOR_ROOT ? resolve(process.env.MARKER_PROCESSOR_ROOT) : ROOT;
  if (action === "write") {
    const target = process.argv[3];
    const allowed = ["runner.mjs", "studio-render.ts", "server/studio-render.ts", "server/studio-analysis.ts", "src/core/studio-analysis.ts", "font.ttf", "inputs/0", "inputs/1", "inputs/2", "inputs/3"];
    if (!allowed.includes(target)) fail("INVALID_INPUT");
    const path = join(root, target);
    await mkdir(dirname(path), { recursive: true });
    await pipeline(process.stdin, createWriteStream(path, { flags: "wx" }));
    return;
  }
  if (action === "read") {
    const target = process.argv[3];
    if (!["result.mp4", "cover.png"].includes(target) && !/^thumb-[0-5]\.jpg$/.test(target)) fail("INVALID_INPUT");
    const path = join(root, target.startsWith("thumb-") ? "analysis" : "output", target);
    await fileInfo(path, target.startsWith("thumb-") ? 1024 * 1024 : target === "result.mp4" ? MAX_FILE : 20 * 1024 * 1024);
    await pipeline(createReadStream(path), process.stdout);
    return;
  }
  const chunks = []; let bytes = 0;
  for await (const chunk of process.stdin) {
    bytes += chunk.length;
    if (bytes > 64 * 1024) fail("INPUT_LIMIT");
    chunks.push(chunk);
  }
  const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  const tools = process.env.MARKER_FFMPEG && process.env.MARKER_FFPROBE
    ? { ffmpeg: process.env.MARKER_FFMPEG, ffprobe: process.env.MARKER_FFPROBE, font: process.env.MARKER_FONT }
    : undefined;
  const result = await runAction(action, payload, { root, tools });
  process.stdout.write(JSON.stringify(result));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    const code = typeof error?.code === "string" && /^[A-Z_]{1,80}$/.test(error.code) ? error.code : "PROCESSING_FAILED";
    process.stderr.write(JSON.stringify({ code }));
    process.exitCode = 1;
  });
}
