import { mkdir, open, rm, stat } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { INPUT_FORMATS, localFile, probeMedia, runTool, StudioMediaError } from "./studio-render.ts";
import type { MediaTools } from "./studio-render.ts";
import {
  ANALYSIS_LOCAL_TESTED_TOOL_VERSION, ANALYSIS_MAX_INTERVALS, ANALYSIS_MAX_THUMB_BYTES,
  ANALYSIS_MAX_THUMBNAILS, ANALYSIS_PROFILE, validateAnalysisRange, validateAnalysisResult,
} from "../src/core/studio-analysis.ts";
import type { StudioAnalysisInterval, StudioAnalysisRange, StudioAnalysisResult } from "../src/core/studio-analysis.ts";

export type AnalyzedMedia = {
  analysis: StudioAnalysisResult;
  thumbnails: Array<{ name: string; path: string; size: number; mime: "image/jpeg" }>;
};

/** Read FFmpeg metadata, not diagnostic prose, with positions relative to the scanned input. */
export function parseTechnicalSignals(text: string, range: StudioAnalysisRange): { intervals: StudioAnalysisInterval[]; truncated: boolean } {
  const intervals: StudioAnalysisInterval[] = [], pending: Partial<Record<"silence" | "black" | "freeze", number>> = {};
  const point = (relative: number) => Math.round(Math.max(range.start, Math.min(range.end, range.start + relative)) * 1000) / 1000;
  let truncated = false;
  const add = (kind: StudioAnalysisInterval["kind"], start: number, end: number) => {
    const entry = { kind, start: point(start), end: point(end) };
    if (entry.end < entry.start || (kind !== "scene" && entry.end === entry.start)) return;
    if (intervals.length >= ANALYSIS_MAX_INTERVALS) { truncated = true; return; }
    intervals.push(entry);
  };
  for (const line of text.split(/\r?\n/)) {
    const scene = /^lavfi\.scd\.time=(-?\d+(?:\.\d+)?)/.exec(line);
    if (scene) { const time = Number(scene[1]); if (Number.isFinite(time)) add("scene", time, time); continue; }
    const signal = /^lavfi\.(silence|black|freeze)_(start|end)=(-?\d+(?:\.\d+)?)/.exec(line);
    if (!signal) continue;
    const kind = signal[1] as "silence" | "black" | "freeze", time = Number(signal[3]);
    if (!Number.isFinite(time)) continue;
    if (signal[2] === "start") pending[kind] = time;
    else if (pending[kind] !== undefined) { add(kind, pending[kind]!, time); delete pending[kind]; }
  }
  for (const kind of ["silence", "black", "freeze"] as const)
    if (pending[kind] !== undefined) add(kind, pending[kind]!, range.end - range.start);
  return { intervals: intervals.sort((a, b) => a.start - b.start || a.kind.localeCompare(b.kind)), truncated };
}

/** Fixed, bounded measurements. No arbitrary argv, filter strings, URLs, ASR or classification. */
export async function analyzeMedia(path: string, suppliedRange: StudioAnalysisRange, outputDir: string, tools: MediaTools,
  options: { expectedToolVersion?: string } = {}): Promise<AnalyzedMedia> {
  const range = validateAnalysisRange(suppliedRange), deadline = Date.now() + 120_000;
  const remaining = (maximum: number) => {
    const time = Math.min(maximum, deadline - Date.now());
    if (time <= 0) throw new StudioMediaError("MEDIA_TIMEOUT", "Technical analysis exceeded its time limit.");
    return time;
  };
  await localFile(path);
  if (!isAbsolute(outputDir) || /^[\\/]{2}/.test(outputDir) || outputDir.includes("\0"))
    throw new StudioMediaError("INVALID_MEDIA", "A local analysis directory is required.");
  const version = (await runTool(tools.ffmpeg, ["-hide_banner", "-version"], undefined, remaining(5000), 32 * 1024)).split(/\r?\n/)[0].trim();
  const result: StudioAnalysisResult = {
    profile: ANALYSIS_PROFILE, toolVersion: version, range, status: "complete", intervals: [], thumbnails: [], warnings: [],
  };
  const unavailable = (message: string): AnalyzedMedia => ({
    analysis: validateAnalysisResult({ ...result, status: "unavailable", warnings: [message] }, range), thumbnails: [],
  });
  if (version !== (options.expectedToolVersion ?? ANALYSIS_LOCAL_TESTED_TOOL_VERSION))
    return unavailable("The installed media tool version has not been verified for this analysis profile. Manual selection remains available.");
  const filters = await runTool(tools.ffmpeg, ["-hide_banner", "-filters"], undefined, remaining(5000), 256 * 1024);
  if (!["silencedetect", "scdet", "blackdetect", "freezedetect"].every(filter => new RegExp(`\\b${filter}\\b`).test(filters)))
    return unavailable("This media-tool build does not provide the verified technical filters. Manual selection remains available.");
  const metadata = await probeMedia(path, tools);
  if (metadata.processing !== "ready") throw new StudioMediaError("UNSUPPORTED_MEDIA", "Keep this original and select a compatible file for analysis.");
  if (metadata.duration !== null && range.end > metadata.duration + 0.001)
    throw new StudioMediaError("INVALID_MEDIA", "The analysis range extends beyond the original.");
  if (metadata.kind === "image" && range.start !== 0)
    throw new StudioMediaError("INVALID_MEDIA", "Photo analysis starts at zero.");
  await mkdir(outputDir, { recursive: true });
  const thumbnails: AnalyzedMedia["thumbnails"] = [];
  let succeeded = 0, failures = 0;
  const addSignals = (output: string) => {
    const parsed = parseTechnicalSignals(output, range);
    if (parsed.truncated || result.intervals.length + parsed.intervals.length > ANALYSIS_MAX_INTERVALS) {
      result.warnings.push("Technical markers reached their limit; not every candidate marker is shown."); result.status = "partial";
    }
    result.intervals.push(...parsed.intervals.slice(0, ANALYSIS_MAX_INTERVALS - result.intervals.length));
  };
  const sourceArgs = ["-hide_banner", "-v", "error", "-nostdin", "-protocol_whitelist", "file", "-format_whitelist", INPUT_FORMATS,
    "-ss", String(range.start), "-t", String(range.end - range.start), "-i", path];
  if (metadata.kind === "video") {
    try {
      const output = await runTool(tools.ffmpeg, [...sourceArgs, "-an", "-vf",
        "setpts=PTS-STARTPTS,scale=320:-2,fps=5,scdet=threshold=10,blackdetect=d=0.4:pix_th=0.1,freezedetect=n=-50dB:d=1,metadata=mode=print:file=-",
        "-f", "null", "-"], undefined, remaining(75_000), 512 * 1024);
      addSignals(output); succeeded++;
    } catch { failures++; result.warnings.push("Visual measurements were not completed. Keep or select the range manually."); }
  }
  if (metadata.audioTrack === "present") {
    try {
      const output = await runTool(tools.ffmpeg, [...sourceArgs, "-vn", "-af",
        "asetpts=PTS-STARTPTS,silencedetect=n=-40dB:d=0.4,ametadata=mode=print:file=-", "-f", "null", "-"], undefined, remaining(25_000), 512 * 1024);
      addSignals(output); succeeded++;
    } catch { failures++; result.warnings.push("Low-volume measurements were not completed. Speech presence remains a human field."); }
  }
  if (metadata.kind !== "audio") {
    let totalBytes = 0;
    const count = metadata.kind === "image" ? 1 : ANALYSIS_MAX_THUMBNAILS;
    for (let index = 0; index < count; index++) {
      const name = `thumb-${index}.jpg`, target = join(outputDir, name);
      const time = metadata.kind === "image" ? 0 : Math.round((range.start + (range.end - range.start) * (index + 0.5) / count) * 1000) / 1000;
      // Never overwrite an existing derivative, even after an interrupted attempt.
      try { await stat(target); throw new StudioMediaError("OUTPUT_EXISTS", "Analysis thumbnails already exist."); }
      catch (error) { if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error; }
      try {
        await runTool(tools.ffmpeg, ["-hide_banner", "-v", "error", "-nostdin", "-n", "-protocol_whitelist", "file", "-format_whitelist", INPUT_FORMATS,
          ...(metadata.kind === "image" ? [] : ["-ss", String(time)]), "-i", path, "-an", "-frames:v", "1", "-vf", "scale=320:-2", "-q:v", "6", "-update", "1", target],
        undefined, remaining(10_000), 16 * 1024);
        await localFile(target, ANALYSIS_MAX_THUMB_BYTES);
        const size = (await stat(target)).size;
        const file = await open(target, "r");
        try {
          const header = Buffer.alloc(3); await file.read(header, 0, 3, 0);
          if (!header.equals(Buffer.from([0xff, 0xd8, 0xff]))) throw new StudioMediaError("MEDIA_PROCESSING_FAILED", "Invalid analysis thumbnail.");
        } finally { await file.close(); }
        if (totalBytes + size > ANALYSIS_MAX_THUMB_BYTES) throw new StudioMediaError("MEDIA_OUTPUT_LIMIT", "Analysis thumbnail storage limit reached.");
        totalBytes += size; thumbnails.push({ name, path: target, size, mime: "image/jpeg" }); result.thumbnails.push({ name, time }); succeeded++;
      } catch {
        await rm(target, { force: true }); failures++;
        result.warnings.push("Not every preview frame is available. Inspect the original before choosing a range.");
        break;
      }
    }
  }
  result.intervals.sort((a, b) => a.start - b.start || a.kind.localeCompare(b.kind));
  if (failures) result.status = succeeded ? "partial" : "unavailable";
  if (result.status === "unavailable") { result.intervals = []; result.thumbnails = []; }
  result.warnings.push("Technical markers are navigation aids, not scene meaning, speech recognition or safe editing decisions.");
  return { analysis: validateAnalysisResult(result, range), thumbnails };
}
