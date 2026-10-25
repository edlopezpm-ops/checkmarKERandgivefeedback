import { spawn } from "node:child_process";
import { copyFile, link, mkdir, mkdtemp, open, rm, stat, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

export interface MediaTools { ffmpeg: string; ffprobe: string; font?: string }
export interface RenderSpec {
  variantId: string;
  recipeRevision: number;
  template: "overlay" | "demo" | "tips" | "motivation" | "text";
  duration: number;
  hook: string;
  body: string;
  cta: string;
  fit: "contain" | "cover";
  focusX: number;
  focusY: number;
  audio: "mute" | "keep";
  clips: Array<{ assetId: string; kind: "video" | "image" | "audio"; start: number; end: number }>;
  narrationAssetId?: string;
}
export interface MediaMetadata {
  kind: "video" | "image" | "audio";
  mime: string;
  duration: number | null;
  width: number | null;
  height: number | null;
  audioTrack: "present" | "absent" | "unknown";
  processing: "ready" | "unsupported";
}
export class StudioMediaError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, diagnostics?: string) {
    super(message, diagnostics ? { cause: diagnostics } : undefined);
    this.name = "StudioMediaError"; this.code = code;
    this.status = code === "MEDIA_TOOL_MISSING" ? 503 : code === "MEDIA_TIMEOUT" ? 504 : code === "OUTPUT_EXISTS" ? 409 : 422;
  }
}

const WIDTH = 1080, HEIGHT = 1920, MAX_FILE = 250 * 1024 * 1024;
export const INPUT_FORMATS = "mov,mp4,m4a,3gp,3g2,mj2,matroska,webm,avi,mp3,wav,ogg,flac,aac,image2,png_pipe,jpeg_pipe,webp_pipe,bmp_pipe,tiff_pipe";
const IMAGE_FORMATS = new Set(["image2", "png_pipe", "jpeg_pipe", "webp_pipe", "bmp_pipe", "tiff_pipe"]);
type TemplatePreset = { x: number; y: number; width: number; height: number; fonts: [number, number, number]; hookEnd: number; ctaStart: number };
// Fixed visual recipes only: templates never write copy, invent bullets or infer meaning.
const TEMPLATE_PRESETS: Record<RenderSpec["template"], TemplatePreset> = {
  overlay: { x: 60, y: 1180, width: 960, height: 640, fonts: [72, 56, 64], hookEnd: 0.22, ctaStart: 0.78 },
  demo: { x: 60, y: 1370, width: 960, height: 470, fonts: [56, 46, 52], hookEnd: 0.18, ctaStart: 0.82 },
  tips: { x: 60, y: 980, width: 960, height: 840, fonts: [64, 52, 56], hookEnd: 0.14, ctaStart: 0.88 },
  motivation: { x: 60, y: 650, width: 960, height: 680, fonts: [80, 64, 72], hookEnd: 0.25, ctaStart: 0.85 },
  text: { x: 60, y: 420, width: 960, height: 1080, fonts: [72, 56, 64], hookEnd: 0.2, ctaStart: 0.85 },
};
interface ProbeStream {
  codec_type?: string; codec_name?: string; width?: number; height?: number; duration?: string;
  color_transfer?: string;
  disposition?: { attached_pic?: number }; tags?: { rotate?: string };
  side_data_list?: Array<{ rotation?: number }>;
}
interface ProbeResult { streams?: ProbeStream[]; format?: { format_name?: string; duration?: string; tags?: { major_brand?: string } } }

function fail(code: string, message: string): never { throw new StudioMediaError(code, message); }
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function number(value: unknown): number | null {
  const result = Number(value);
  return value !== undefined && value !== null && value !== "" && Number.isFinite(result) && result >= 0 ? result : null;
}
export async function localFile(path: string, maximum = MAX_FILE): Promise<void> {
  if (typeof path !== "string" || !isAbsolute(path) || path.includes("\0") || /^[\\/]{2}/.test(path)) fail("INVALID_MEDIA", "A local absolute file is required.");
  let info;
  try { info = await stat(path); } catch { fail("INVALID_MEDIA", "The media file is unavailable."); }
  if (!info.isFile() || info.size === 0 || info.size > maximum) fail("INVALID_MEDIA", "The file is empty, oversized or not a regular file.");
}

/** Fixed argv, no shell. These bounds limit work; they are not an OS sandbox. */
export async function runTool(executable: string, args: string[], cwd: string | undefined, timeout: number, captureLimit = 1024 * 1024): Promise<string> {
  if (!executable || !isAbsolute(executable)) fail("MEDIA_TOOL_MISSING", "Configure the absolute path to the local media tool.");
  try { await localFile(executable, 400 * 1024 * 1024); } catch { fail("MEDIA_TOOL_MISSING", "The configured media tool is unavailable."); }
  return new Promise((resolveResult, reject) => {
    const child = spawn(executable, args, { cwd, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = Buffer.alloc(0), errors = 0, diagnostics = "", failure: StudioMediaError | undefined;
    const stop = (error: StudioMediaError) => { failure ??= error; child.kill("SIGKILL"); };
    const timer = setTimeout(() => stop(new StudioMediaError("MEDIA_TIMEOUT", "Media processing exceeded its time limit.")), timeout);
    child.stdout.on("data", (chunk: Buffer) => {
      if (output.length + chunk.length > captureLimit) stop(new StudioMediaError("MEDIA_OUTPUT_LIMIT", "Media tool output exceeded its limit."));
      else output = Buffer.concat([output, chunk]);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      errors += chunk.length;
      diagnostics = (diagnostics + chunk.toString("utf8")).slice(-16_384);
      if (errors > 256 * 1024) stop(new StudioMediaError("MEDIA_OUTPUT_LIMIT", "Media diagnostics exceeded their limit."));
    });
    child.once("error", () => { clearTimeout(timer); reject(new StudioMediaError("MEDIA_TOOL_MISSING", "The media tool could not be started.")); });
    child.once("close", code => {
      clearTimeout(timer);
      if (failure) reject(failure);
      else if (code !== 0) reject(new StudioMediaError("MEDIA_PROCESSING_FAILED", "The media tool could not process this file or recipe.", diagnostics));
      else resolveResult(output.toString("utf8"));
    });
  });
}

async function rawProbe(path: string, tools: MediaTools): Promise<ProbeResult> {
  await localFile(path);
  const output = await runTool(tools.ffprobe, ["-v", "error", "-protocol_whitelist", "file", "-format_whitelist", INPUT_FORMATS, "-probesize", "5000000", "-analyzeduration", "5000000", "-show_streams", "-show_format", "-of", "json", path], undefined, 10_000);
  try { return JSON.parse(output) as ProbeResult; } catch { fail("INVALID_MEDIA", "The media metadata is invalid."); }
}

function metadata(probe: ProbeResult, webm: boolean): MediaMetadata {
  const streams = Array.isArray(probe.streams) ? probe.streams : [];
  const visual = streams.find(stream => stream.codec_type === "video" && stream.disposition?.attached_pic !== 1);
  const audio = streams.find(stream => stream.codec_type === "audio");
  const formats = (probe.format?.format_name ?? "").split(",");
  const image = formats.some(format => IMAGE_FORMATS.has(format));
  if (!visual && !audio) fail("UNSUPPORTED_MEDIA", "No supported audio or visual track was found.");
  const kind = visual ? image ? "image" : "video" : "audio";
  const taggedRotation = Number(visual?.tags?.rotate);
  const rotation = visual?.side_data_list?.find(item => finite(item.rotation))?.rotation ?? (Number.isFinite(taggedRotation) ? taggedRotation : 0);
  const rotated = Math.abs(rotation % 180) === 90;
  const sourceWidth = finite(visual?.width) ? visual.width : null;
  const sourceHeight = finite(visual?.height) ? visual.height : null;
  const width = rotated ? sourceHeight : sourceWidth, height = rotated ? sourceWidth : sourceHeight;
  const duration = kind === "image" ? null : number(probe.format?.duration) ?? number(visual?.duration) ?? number(audio?.duration);
  const codec = visual?.codec_name ?? audio?.codec_name ?? "";
  const mime = kind === "image" ? ({ png: "image/png", mjpeg: "image/jpeg", webp: "image/webp", bmp: "image/bmp", tiff: "image/tiff" }[codec] ?? "application/octet-stream")
    : formats.includes("mov") ? kind === "audio" ? "audio/mp4" : probe.format?.tags?.major_brand?.trim() === "qt" ? "video/quicktime" : "video/mp4"
    : formats.includes("matroska") || formats.includes("webm") ? webm ? kind === "audio" ? "audio/webm" : "video/webm" : kind === "audio" ? "audio/x-matroska" : "video/x-matroska"
    : formats.includes("ogg") ? kind === "audio" ? "audio/ogg" : "video/ogg"
    : ({ mp3: "audio/mpeg", wav: "audio/wav", flac: "audio/flac", aac: "audio/aac", avi: "video/x-msvideo" }[formats[0]] ?? "application/octet-stream");
  // HDR requires an explicit, verified colour-conversion pipeline before this SDR renderer can use it.
  const hdr = visual?.color_transfer === "smpte2084" || visual?.color_transfer === "arib-std-b67";
  const supported = kind === "audio" ? duration !== null && duration > 0
    : !hdr && width !== null && height !== null && width > 0 && height > 0 && width * height <= 40_000_000 && (kind === "image" || duration !== null && duration > 0);
  return { kind, mime, duration, width, height, audioTrack: audio ? "present" : "absent", processing: supported ? "ready" : "unsupported" };
}

/** Technical tracks and dimensions only. It does not infer speech or editorial categories. */
export async function probeMedia(path: string, tools: MediaTools): Promise<MediaMetadata> {
  const probe = await rawProbe(path, tools);
  // FFprobe shares a demuxer name for Matroska and WebM; the bounded EBML header identifies WebM's DocType.
  let webm = false;
  if (probe.format?.format_name?.split(",").includes("matroska")) {
    const file = await open(path, "r");
    try {
      const header = Buffer.alloc(4096), { bytesRead } = await file.read(header, 0, header.length, 0);
      webm = header.subarray(0, bytesRead).includes(Buffer.from([0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d]));
    } finally { await file.close(); }
  }
  return metadata(probe, webm);
}

function validateSpec(spec: RenderSpec): void {
  if (!spec || !["overlay", "demo", "tips", "motivation", "text"].includes(spec.template) || !finite(spec.duration) || spec.duration < 5 || spec.duration > 60
    || !["contain", "cover"].includes(spec.fit) || !["keep", "mute"].includes(spec.audio)
    || !finite(spec.focusX) || !finite(spec.focusY) || spec.focusX < 0 || spec.focusX > 1 || spec.focusY < 0 || spec.focusY > 1
    || !Array.isArray(spec.clips) || spec.clips.length > 3 || !Number.isSafeInteger(spec.recipeRevision) || spec.recipeRevision < 0) fail("INVALID_RENDER", "The render recipe is invalid.");
  if (![spec.hook, spec.body, spec.cta].every(text => typeof text === "string" && text.length <= 4000 && !text.includes("\0"))) fail("INVALID_RENDER", "The render text is invalid.");
  if (![spec.hook, spec.body, spec.cta].some(text => text.trim())) fail("INVALID_RENDER", "Add text before rendering.");
  for (const clip of spec.clips) {
    if (!clip || !["video", "image"].includes(clip.kind) || !clip.assetId || !finite(clip.start) || !finite(clip.end) || clip.start < 0 || clip.end <= clip.start || clip.end - clip.start > 120 || clip.kind === "image" && clip.start !== 0) fail("INVALID_RENDER", "A selected clip range is invalid.");
  }
  const duration = spec.clips.reduce((sum, clip) => sum + clip.end - clip.start, 0);
  if (spec.clips.length === 0 ? spec.template !== "text" : Math.abs(duration - spec.duration) > 0.05) fail("INVALID_RENDER", "The selected clip durations must equal the export duration.");
}

function wrapText(text: string, columns: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r\n?/g, "\n").split("\n")) {
    let current = "";
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      const letters = Array.from(word);
      while (letters.length > columns) {
        if (current) { lines.push(current); current = ""; }
        lines.push(letters.splice(0, columns).join(""));
      }
      const rest = letters.join("");
      if (current && Array.from(current).length + letters.length + 1 > columns) { lines.push(current); current = ""; }
      current += `${current ? " " : ""}${rest}`;
    }
    lines.push(current);
  }
  return lines;
}

async function textFilter(text: string, name: string, start: number, end: number, stage: string, preferredSize: number, preset: TemplatePreset): Promise<string> {
  if (!text.trim()) return "";
  for (let size = preferredSize; size >= 36; size -= 2) {
    const lines = wrapText(text, Math.floor((preset.width - 80) / (size * 0.75)));
    if (lines.length * (size + 12) > preset.height - 80) continue;
    await writeFile(join(stage, `${name}.txt`), lines.join("\n"), "utf8");
    const enable = `between(t,${start.toFixed(3)},${end.toFixed(3)})`;
    return `drawbox=x=${preset.x}:y=${preset.y}:w=${preset.width}:h=${preset.height}:color=black@0.8:t=fill:enable='${enable}',drawtext=fontfile=font.ttf:textfile=${name}.txt:expansion=none:fontcolor=white:fontsize=${size}:line_spacing=12:x=${preset.x + 40}:y=${preset.y + 40}:enable='${enable}'`;
  }
  fail("TEXT_OVERFLOW", "The text does not fit at a readable size. Shorten it or use a text export.");
}

function visualFilter(spec: RenderSpec): string {
  const fit = spec.fit === "contain"
    ? `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=0x17191e`
    : `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase:force_divisible_by=2,crop=${WIDTH}:${HEIGHT}:(iw-ow)*${spec.focusX.toFixed(6)}:(ih-oh)*${spec.focusY.toFixed(6)}`;
  return `setpts=PTS-STARTPTS,${fit},setsar=1,fps=30,format=yuv420p`;
}

async function fontFile(tools: MediaTools): Promise<string> {
  const path = tools.font ?? (process.platform === "win32" ? "C:\\Windows\\Fonts\\arial.ttf" : "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf");
  await localFile(path, 20 * 1024 * 1024);
  return path;
}

/** Deterministic local montage. Narration replaces source sound; no subtitles or voice synthesis. */
export async function renderMedia(spec: RenderSpec, assetPaths: Record<string, string>, outputDir: string, tools: MediaTools): Promise<{ videoPath: string; coverPath: string; width: number; height: number; duration: number }> {
  validateSpec(spec);
  if (!isAbsolute(outputDir) || outputDir.includes("\0") || /^[\\/]{2}/.test(outputDir)) fail("INVALID_RENDER", "A server-owned absolute output directory is required.");
  outputDir = resolve(outputDir);
  await mkdir(outputDir, { recursive: true });
  const videoPath = join(outputDir, "result.mp4"), coverPath = join(outputDir, "cover.png");
  for (const path of [videoPath, coverPath]) {
    try { await stat(path); } catch { continue; }
    fail("OUTPUT_EXISTS", "This render destination already contains an output.");
  }
  const clips: Array<{ path: string; info: MediaMetadata; duration: number }> = [];
  for (const clip of spec.clips) {
    const path = Object.hasOwn(assetPaths, clip.assetId) ? assetPaths[clip.assetId] : "";
    const info = await probeMedia(path, tools);
    if (info.processing !== "ready" || info.kind !== clip.kind) fail("UNSUPPORTED_MEDIA", "A selected source requires conversion or has the wrong media type.");
    if (info.duration !== null && clip.end > info.duration + 0.05) fail("INVALID_RENDER", "A selected range extends beyond its original.");
    clips.push({ path, info, duration: clip.end - clip.start });
  }
  let narration: { path: string; info: MediaMetadata } | undefined;
  if (spec.narrationAssetId) {
    const path = Object.hasOwn(assetPaths, spec.narrationAssetId) ? assetPaths[spec.narrationAssetId] : "";
    const info = await probeMedia(path, tools);
    if (info.processing !== "ready" || info.kind !== "audio" || info.duration === null || info.duration + 0.05 < spec.duration) fail("INVALID_RENDER", "Narration must be a supported audio file covering the export duration.");
    narration = { path, info };
  }
  const stage = await mkdtemp(join(outputDir, ".render-"));
  try {
    await copyFile(await fontFile(tools), join(stage, "font.ttf"));
    const args = ["-hide_banner", "-v", "error", "-nostdin", "-n", "-threads", "2", "-filter_complex_threads", "1"];
    for (const [i, clip] of clips.entries()) {
      args.push("-protocol_whitelist", "file", "-format_whitelist", INPUT_FORMATS);
      if (clip.info.kind === "image") args.push("-loop", "1", "-framerate", "30");
      else args.push("-ss", String(spec.clips[i].start));
      args.push("-t", String(clip.duration), "-i", clip.path);
    }
    if (narration) args.push("-protocol_whitelist", "file", "-format_whitelist", INPUT_FORMATS, "-t", String(spec.duration), "-i", narration.path);
    const filters: string[] = [];
    const sourceSound = !narration && spec.audio === "keep" && clips.some(clip => clip.info.audioTrack === "present");
    if (clips.length === 0) filters.push(`color=c=0x17191e:s=${WIDTH}x${HEIGHT}:r=30:d=${spec.duration},format=yuv420p[basev]`);
    else {
      for (const [i, clip] of clips.entries()) {
        filters.push(`[${i}:v:0]${visualFilter(spec)},trim=duration=${clip.duration}[v${i}]`);
        if (sourceSound) filters.push(clip.info.audioTrack === "present"
          ? `[${i}:a:0]atrim=duration=${clip.duration},asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad=whole_dur=${clip.duration},atrim=duration=${clip.duration}[a${i}]`
          : `anullsrc=r=48000:cl=stereo,atrim=duration=${clip.duration}[a${i}]`);
      }
      filters.push(`${clips.map((_, i) => `[v${i}]${sourceSound ? `[a${i}]` : ""}`).join("")}concat=n=${clips.length}:v=1:a=${sourceSound ? 1 : 0}[basev]${sourceSound ? "[basea]" : ""}`);
    }
    if (narration) filters.push(`[${clips.length}:a:0]atrim=duration=${spec.duration},asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[basea]`);
    const preset = TEMPLATE_PRESETS[spec.template];
    const firstEnd = spec.duration * preset.hookEnd, lastStart = spec.duration * preset.ctaStart;
    const overlays = (await Promise.all([
      textFilter(spec.hook, "hook", 0, firstEnd, stage, preset.fonts[0], preset),
      textFilter(spec.body, "body", firstEnd, lastStart, stage, preset.fonts[1], preset),
      textFilter(spec.cta, "cta", lastStart, spec.duration, stage, preset.fonts[2], preset),
    ])).filter(Boolean);
    filters.push(`[basev]${overlays.join(",")}[outv]`);
    args.push("-filter_complex", filters.join(";"), "-map", "[outv]");
    if (sourceSound || narration) args.push("-map", "[basea]", "-c:a", "aac", "-b:a", "128k");
    else args.push("-an");
    args.push("-map_metadata", "-1", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-r", "30", "-t", String(spec.duration), "-movflags", "+faststart", "-fs", String(MAX_FILE), "result.mp4");
    await runTool(tools.ffmpeg, args, stage, 120_000);
    await localFile(join(stage, "result.mp4"));
    const rendered = await probeMedia(join(stage, "result.mp4"), tools);
    if (rendered.width !== WIDTH || rendered.height !== HEIGHT || rendered.duration === null || Math.abs(rendered.duration - spec.duration) > 0.15) fail("MEDIA_PROCESSING_FAILED", "The rendered output failed its technical checks.");
    await runTool(tools.ffmpeg, ["-hide_banner", "-v", "error", "-nostdin", "-n", "-protocol_whitelist", "file", "-i", "result.mp4", "-frames:v", "1", "-update", "1", "cover.png"], stage, 15_000);
    await localFile(join(stage, "cover.png"), 20 * 1024 * 1024);
    // Exclusive hard links publish already-complete files without overwriting a concurrent result.
    try { await link(join(stage, "cover.png"), coverPath); } catch { fail("OUTPUT_EXISTS", "The cover destination is unavailable or already exists."); }
    try { await link(join(stage, "result.mp4"), videoPath); }
    catch { await rm(coverPath, { force: true }); fail("OUTPUT_EXISTS", "The video destination is unavailable or already exists."); }
    return { videoPath, coverPath, width: WIDTH, height: HEIGHT, duration: rendered.duration };
  } finally { await rm(stage, { recursive: true, force: true }); }
}
