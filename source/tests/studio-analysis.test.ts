import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { analyzeMedia, parseTechnicalSignals } from "../server/studio-analysis.ts";
import { ANALYSIS_LOCAL_TESTED_TOOL_VERSION, ANALYSIS_MAX_THUMB_BYTES, ANALYSIS_PROFILE, validateAnalysisRange, validateAnalysisResult } from "../src/core/studio-analysis.ts";
import type { MediaTools } from "../server/studio-render.ts";

const tools: MediaTools = {
  ffmpeg: process.env.MARKER_FFMPEG ?? resolve(".local/tools/ffmpeg/bin/ffmpeg.exe"),
  ffprobe: process.env.MARKER_FFPROBE ?? resolve(".local/tools/ffmpeg/bin/ffprobe.exe"),
};
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
async function fixture(args: string[]): Promise<void> {
  await new Promise<void>((done, reject) => {
    const child = spawn(tools.ffmpeg, ["-hide_banner", "-v", "error", "-nostdin", "-n", ...args], { shell: false, windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    let error = ""; const timer = setTimeout(() => child.kill("SIGKILL"), 30_000);
    child.stderr.on("data", chunk => { error = (error + chunk.toString()).slice(-8000); });
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("close", code => { clearTimeout(timer); code === 0 ? done() : reject(new Error(error || `fixture exit ${code}`)); });
  });
}

test("analysis contract rejects unbounded work and untrusted derivative paths", () => {
  for (const range of [null, {}, { start: -1, end: 1 }, { start: 0, end: 121 }, { start: 1, end: 1 }, { start: 0, end: NaN }, { start: 0.0001, end: 1 }])
    assert.throws(() => validateAnalysisRange(range));
  assert.deepEqual(validateAnalysisRange({ start: 3.125, end: 7.5 }), { start: 3.125, end: 7.5 });
  const result = { profile: ANALYSIS_PROFILE, toolVersion: ANALYSIS_LOCAL_TESTED_TOOL_VERSION, status: "complete", range: { start: 0, end: 5 }, intervals: [], thumbnails: [], warnings: [] };
  assert.throws(() => validateAnalysisResult({ ...result, thumbnails: [{ name: "../../source.jpg", time: 1 }] }));
  assert.throws(() => validateAnalysisResult({ ...result, intervals: [{ kind: "silence", start: 0, end: 8 }] }));
  assert.throws(() => validateAnalysisResult({ ...result, warnings: ["a".repeat(65 * 1024)] }));
  assert.throws(() => validateAnalysisResult({ ...result, thumbnails: [{ name: "thumb-0.jpg", time: 1 }, { name: "thumb-0.jpg", time: 2 }] }));
  assert.throws(() => validateAnalysisResult({ ...result, status: "unavailable", intervals: [{ kind: "scene", start: 2, end: 2 }] }));
  const clean = validateAnalysisResult({ ...result, speech: "absent", categories: ["broll"] });
  assert.equal("speech" in clean, false); assert.equal("categories" in clean, false);
});

test("technical marker times are bounded to declared coverage, including trailing low-volume intervals", () => {
  const result = parseTechnicalSignals("lavfi.silence_start=-0.01\nlavfi.silence_end=1.5\nlavfi.scd.time=2\nlavfi.freeze_start=3\n", { start: 5, end: 9 });
  assert.deepEqual(result.intervals, [
    { kind: "silence", start: 5, end: 6.5 }, { kind: "scene", start: 7, end: 7 }, { kind: "freeze", start: 8, end: 9 },
  ]);
  const many = parseTechnicalSignals(Array.from({ length: 200 }, (_, i) => `lavfi.scd.time=${i / 100}`).join("\n"), { start: 0, end: 4 });
  assert.equal(many.intervals.length, 100); assert.equal(many.truncated, true);
});

test("real FFmpeg analysis preserves originals and reports technical aids without semantic labels", { timeout: 120_000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), "marker-analysis-"));
  try {
    const source = join(root, "source.mp4");
    await fixture(["-f", "lavfi", "-i", "testsrc2=s=320x180:r=30:d=4", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=4",
      "-vf", "drawbox=x=0:y=0:w=iw:h=ih:color=black:t=fill:enable='lt(t,2)'", "-af", "volume=0:enable='lt(t,2)'", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", source]);
    const before = sha(await readFile(source));
    await t.test("actual black, scene and low-volume measurements plus bounded JPEG thumbnails", async () => {
      const output = await analyzeMedia(source, { start: 0, end: 4 }, join(root, "measurements"), tools);
      assert.equal(output.analysis.status, "complete", JSON.stringify(output.analysis.warnings));
      assert.equal(output.analysis.profile, ANALYSIS_PROFILE);
      assert.equal(output.analysis.toolVersion, ANALYSIS_LOCAL_TESTED_TOOL_VERSION);
      assert.equal(output.thumbnails.length, 6);
      assert.ok(output.thumbnails.reduce((sum, thumbnail) => sum + thumbnail.size, 0) <= ANALYSIS_MAX_THUMB_BYTES);
      assert.ok(output.analysis.intervals.some(interval => interval.kind === "black" && interval.start < 0.1 && interval.end >= 1.8));
      assert.ok(output.analysis.intervals.some(interval => interval.kind === "silence" && interval.start < 0.1 && interval.end >= 1.8));
      assert.ok(output.analysis.intervals.some(interval => interval.kind === "scene" && interval.start >= 1.8 && interval.start <= 2.3));
      assert.equal("speech" in output.analysis, false); assert.equal("categories" in output.analysis, false);
      for (const thumbnail of output.thumbnails) assert.ok((await readFile(thumbnail.path)).subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])));
      await assert.rejects(analyzeMedia(source, { start: 0, end: 4 }, join(root, "measurements"), tools), /already exist/);
    });
    await t.test("unreviewed toolchain returns unavailable without pretending that analysis succeeded", async () => {
      const out = join(root, "mismatch"), result = await analyzeMedia(source, { start: 0, end: 4 }, out, tools, { expectedToolVersion: "unverified-other-build" });
      assert.equal(result.analysis.status, "unavailable"); assert.deepEqual(result.analysis.intervals, []); assert.deepEqual(result.thumbnails, []);
      await assert.rejects(readdir(out), { code: "ENOENT" });
    });
    await t.test("range outside original is rejected before publishing any derivative", async () => {
      await assert.rejects(analyzeMedia(source, { start: 0, end: 5 }, join(root, "invalid"), tools), /beyond the original/);
    });
    await t.test("audio-only measurement generates no invented video or voice classification", async () => {
      const audio = join(root, "quiet.wav");
      await fixture(["-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", "2", "-c:a", "pcm_s16le", audio]);
      const result = await analyzeMedia(audio, { start: 0, end: 2 }, join(root, "audio"), tools);
      assert.equal(result.analysis.status, "complete"); assert.deepEqual(result.thumbnails, []);
      assert.ok(result.analysis.intervals.some(interval => interval.kind === "silence"));
      assert.equal("speech" in result.analysis, false);
    });
    assert.equal(sha(await readFile(source)), before);
  } finally {
    assert.ok(resolve(root).startsWith(resolve(join(tmpdir(), "marker-analysis-"))));
    await rm(root, { recursive: true, force: true });
  }
});
