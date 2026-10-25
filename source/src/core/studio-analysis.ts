/** Technical measurements only; no source label, speech claim or editorial decision. */
export const ANALYSIS_PROFILE = "technical-v1" as const;
export const ANALYSIS_MAX_JSON = 64 * 1024;
export const ANALYSIS_MAX_THUMBNAILS = 6;
export const ANALYSIS_MAX_THUMB_BYTES = 1024 * 1024;
export const ANALYSIS_MAX_INTERVALS = 100;
export const ANALYSIS_LOCAL_TESTED_TOOL_VERSION = "ffmpeg version 9.0.2-essentials_build-www.gyan.dev Copyright (c) 2000-2026 the FFmpeg developers";
// No hosted binary/filter run was authorized in this implementation increment.
// Populate only after the native release verification, never from a browser value.
export const ANALYSIS_HOSTED_TOOL_VERSION: string | null = null;

export type StudioAnalysisRange = { start: number; end: number };
export type StudioAnalysisInterval = {
  kind: "scene" | "silence" | "black" | "freeze";
  start: number; end: number;
};
export type StudioAnalysisResult = {
  profile: typeof ANALYSIS_PROFILE;
  toolVersion: string;
  range: StudioAnalysisRange;
  status: "complete" | "partial" | "unavailable";
  intervals: StudioAnalysisInterval[];
  thumbnails: Array<{ name: string; time: number }>;
  warnings: string[];
};

/** Millisecond precision bounds work and makes keys stable across adapters. */
export function validateAnalysisRange(supplied: unknown): StudioAnalysisRange {
  if (!supplied || typeof supplied !== "object") throw new RangeError("Selecciona un tramo válido.");
  const value = supplied as Record<string, unknown>;
  if (typeof value.start !== "number" || typeof value.end !== "number"
    || !Number.isFinite(value.start) || !Number.isFinite(value.end)
    || value.start < 0 || value.end <= value.start || value.end - value.start > 120
    || value.end > 86_400 * 30
    || Math.abs(value.start * 1000 - Math.round(value.start * 1000)) > 0.00001
    || Math.abs(value.end * 1000 - Math.round(value.end * 1000)) > 0.00001)
    throw new RangeError("Selecciona un tramo positivo de hasta 120 segundos, con precisión de milisegundos.");
  return { start: value.start, end: value.end };
}

/** Validate subprocess/storage results without accepting arbitrary derivative names. */
export function validateAnalysisResult(supplied: unknown, expectedRange?: StudioAnalysisRange): StudioAnalysisResult {
  if (!supplied || typeof supplied !== "object" || new TextEncoder().encode(JSON.stringify(supplied)).byteLength > ANALYSIS_MAX_JSON)
    throw new RangeError("El análisis técnico supera sus límites.");
  const value = supplied as StudioAnalysisResult, range = validateAnalysisRange(value.range);
  if (value.profile !== ANALYSIS_PROFILE || !["complete", "partial", "unavailable"].includes(value.status)
    || typeof value.toolVersion !== "string" || value.toolVersion.length > 240 || /[\x00-\x1f]/.test(value.toolVersion)
    || (value.status !== "unavailable" && !value.toolVersion)
    || (expectedRange && (range.start !== expectedRange.start || range.end !== expectedRange.end))
    || !Array.isArray(value.intervals) || value.intervals.length > ANALYSIS_MAX_INTERVALS
    || !Array.isArray(value.thumbnails) || value.thumbnails.length > ANALYSIS_MAX_THUMBNAILS
    || !Array.isArray(value.warnings) || value.warnings.length > 20
    || value.warnings.some(warning => typeof warning !== "string" || warning.length > 240 || warning.includes("\0")))
    throw new RangeError("Resultado de análisis técnico inválido.");
  const intervals = value.intervals.map(interval => {
    if (!interval || !["scene", "silence", "black", "freeze"].includes(interval.kind)
      || !Number.isFinite(interval.start) || !Number.isFinite(interval.end)
      || interval.start < range.start || interval.end > range.end || interval.end < interval.start)
      throw new RangeError("El intervalo técnico está fuera del tramo analizado.");
    return { kind: interval.kind, start: interval.start, end: interval.end };
  });
  const names = new Set<string>();
  const thumbnails = value.thumbnails.map(thumbnail => {
    if (!thumbnail || !/^thumb-[0-5]\.jpg$/.test(thumbnail.name) || names.has(thumbnail.name)
      || !Number.isFinite(thumbnail.time) || thumbnail.time < range.start || thumbnail.time > range.end)
      throw new RangeError("Miniatura de análisis inválida.");
    names.add(thumbnail.name);
    return { name: thumbnail.name, time: thumbnail.time };
  });
  if (value.status === "unavailable" && (intervals.length || thumbnails.length))
    throw new RangeError("Un análisis no disponible no puede publicar mediciones.");
  return { profile: value.profile, toolVersion: value.toolVersion, range, status: value.status, intervals, thumbnails, warnings: [...value.warnings] };
}
