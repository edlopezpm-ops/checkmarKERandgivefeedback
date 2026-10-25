import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { probeMedia, renderMedia, StudioMediaError } from "../server/studio-render.ts";
import type { MediaTools, RenderSpec } from "../server/studio-render.ts";

const tools: MediaTools = {
  ffmpeg: process.env.MARKER_FFMPEG ?? resolve(".local/tools/ffmpeg/bin/ffmpeg.exe"),
  ffprobe: process.env.MARKER_FFPROBE ?? resolve(".local/tools/ffmpeg/bin/ffprobe.exe"),
  font: process.env.MARKER_FONT ?? resolve("Font/Montserrat_Complete/Fonts/WEB/fonts/Montserrat-Medium.ttf"),
};
async function ffmpeg(args: string[]): Promise<Buffer> {
  return new Promise((resolveResult, reject) => {
    const child = spawn(tools.ffmpeg, ["-hide_banner", "-v", "error", "-nostdin", ...args], { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    const output: Buffer[] = [], errors: Buffer[] = [];
    const timer = setTimeout(() => child.kill("SIGKILL"), 30_000);
    child.stdout.on("data", data => output.push(data)); child.stderr.on("data", data => errors.push(data));
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("close", code => { clearTimeout(timer); code === 0 ? resolveResult(Buffer.concat(output)) : reject(new Error(Buffer.concat(errors).toString("utf8"))); });
  });
}
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const spec = (overrides: Partial<RenderSpec> = {}): RenderSpec => ({
  variantId: "synthetic-variant", recipeRevision: 1, template: "overlay", duration: 5,
  hook: "A clear hook", body: "A synthetic editable message.", cta: "Review this example",
  fit: "contain", focusX: 0.5, focusY: 0.5, audio: "mute",
  clips: [{ assetId: "video", kind: "video", start: 0, end: 5 }], ...overrides,
});
const code = (expected: string) => (error: unknown) => error instanceof StudioMediaError && error.code === expected;

test("native FFprobe and FFmpeg process bounded synthetic sources and deterministic editable recipes", { timeout: 240_000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), "marker-media-test-"));
  const paths = { video: join(root, "original.mp4"), image: join(root, "original.png"), narration: join(root, "narration.wav") };
  try {
    await ffmpeg(["-f", "lavfi", "-i", "color=c=red:s=320x180:r=30:d=6", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=6", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", paths.video]);
    await ffmpeg(["-f", "lavfi", "-i", "color=c=blue:s=240x320", "-frames:v", "1", "-update", "1", paths.image]);
    await ffmpeg(["-f", "lavfi", "-i", "sine=frequency=700:sample_rate=48000:duration=6", "-c:a", "pcm_s16le", paths.narration]);
    const originals = await Promise.all(Object.values(paths).map(async path => digest(await readFile(path))));

    await t.test("metadata describes actual tracks, dimensions and duration without a semantic classification", async () => {
      const video = await probeMedia(paths.video, tools), image = await probeMedia(paths.image, tools), audio = await probeMedia(paths.narration, tools);
      assert.equal(video.kind, "video"); assert.equal(video.mime, "video/mp4");
      assert.equal(video.width, 320); assert.equal(video.height, 180); assert.equal(video.audioTrack, "present");
      assert.ok(video.duration !== null && Math.abs(video.duration - 6) < 0.1); assert.equal(video.processing, "ready");
      assert.equal(image.kind, "image"); assert.equal(image.mime, "image/png"); assert.equal(image.duration, null);
      assert.equal(image.width, 240); assert.equal(image.height, 320); assert.equal(image.audioTrack, "absent");
      assert.equal(audio.kind, "audio"); assert.equal(audio.mime, "audio/wav"); assert.equal(audio.width, null); assert.equal(audio.audioTrack, "present");
      assert.equal(Object.hasOwn(video, "speech"), false); assert.equal(Object.hasOwn(video, "category"), false);
      const rotatedPath = join(root, "rotated.mp4");
      await ffmpeg(["-display_rotation", "90", "-i", paths.video, "-c", "copy", rotatedPath]);
      const rotated = await probeMedia(rotatedPath, tools);
      assert.equal(rotated.width, 180); assert.equal(rotated.height, 320);
      const quicktimePath = join(root, "container.mov"), matroskaPath = join(root, "container.mkv"), webmPath = join(root, "container.webm");
      await ffmpeg(["-i", paths.video, "-c", "copy", quicktimePath]);
      await ffmpeg(["-i", paths.video, "-c", "copy", matroskaPath]);
      await ffmpeg(["-i", paths.video, "-t", "1", "-c:v", "libvpx-vp9", "-cpu-used", "8", "-deadline", "realtime", "-c:a", "libopus", webmPath]);
      assert.equal((await probeMedia(quicktimePath, tools)).mime, "video/quicktime");
      assert.equal((await probeMedia(matroskaPath, tools)).mime, "video/x-matroska");
      assert.equal((await probeMedia(webmPath, tools)).mime, "video/webm");
      const hdrPath = join(root, "needs-colour-conversion.mp4");
      await ffmpeg(["-i", paths.video, "-vf", "setparams=color_trc=smpte2084:color_primaries=bt2020:colorspace=bt2020nc", "-c:v", "libx264", "-c:a", "copy", hdrPath]);
      assert.equal((await probeMedia(hdrPath, tools)).processing, "unsupported");
      await assert.rejects(renderMedia(spec(), { video: hdrPath }, join(root, "hdr-output"), tools), code("UNSUPPORTED_MEDIA"));
    });

    await t.test("mixed video/image montage has exact duration, real cover, original custody and source audio control", async () => {
      const recipe = spec({ clips: [{ assetId: "video", kind: "video", start: 1, end: 3.5 }, { assetId: "image", kind: "image", start: 0, end: 2.5 }], audio: "keep" });
      const result = await renderMedia(recipe, paths, join(root, "mixed"), tools);
      assert.equal(result.width, 1080); assert.equal(result.height, 1920); assert.ok(Math.abs(result.duration - 5) < 0.1);
      const output = await probeMedia(result.videoPath, tools), cover = await probeMedia(result.coverPath, tools);
      assert.equal(output.audioTrack, "present"); assert.equal(cover.kind, "image"); assert.equal(cover.width, 1080); assert.equal(cover.height, 1920);
      // These points are above the text backplate and within each image's visual area.
      const firstPixel = await ffmpeg(["-ss", "0.5", "-i", result.videoPath, "-frames:v", "1", "-vf", "crop=2:2:540:600,scale=1:1", "-pix_fmt", "rgb24", "-f", "rawvideo", "pipe:1"]);
      const secondPixel = await ffmpeg(["-ss", "3.5", "-i", result.videoPath, "-frames:v", "1", "-vf", "crop=2:2:540:600,scale=1:1", "-pix_fmt", "rgb24", "-f", "rawvideo", "pipe:1"]);
      // The landscape first clip has letterboxing at this point; the portrait photo is blue.
      assert.ok(firstPixel[0] < 70 && firstPixel[1] < 70 && firstPixel[2] < 70);
      assert.ok(secondPixel[2] > 180 && secondPixel[0] < 70);
      assert.deepEqual(await Promise.all(Object.values(paths).map(async path => digest(await readFile(path)))), originals);
      await assert.rejects(renderMedia(recipe, paths, join(root, "mixed"), tools), code("OUTPUT_EXISTS"));
    });

    await t.test("all five template types produce decodable output; mute and selected narration remain distinct", async () => {
      const visualCovers = new Set<string>();
      for (const template of ["overlay", "tips", "motivation", "demo", "text"] as const) {
        const recipe = spec({ template, fit: "cover", focusX: 0, focusY: 1,
          ...(template === "demo" ? { narrationAssetId: "narration" } : {}),
          ...(template === "text" ? { clips: [] } : {}),
          hook: "Literal %{not_a_function} : ' ; [0:v]", body: "Line one\nLine two with accents: motivación.",
        });
        const result = await renderMedia(recipe, paths, join(root, template), tools);
        const output = await probeMedia(result.videoPath, tools);
        assert.equal(output.processing, "ready"); assert.equal(output.width, 1080); assert.equal(output.height, 1920);
        assert.equal(output.audioTrack, template === "demo" ? "present" : "absent");
        await ffmpeg(["-i", result.videoPath, "-f", "null", "-"]);
        // The visual templates share identical copy, source, framing and first-frame pixels.
        // Different covers therefore prove that the selected preset changes the actual layout.
        if (template !== "text") visualCovers.add(digest(await readFile(result.coverPath)));
      }
      assert.equal(visualCovers.size, 4, "The four visual templates must produce distinct layouts for identical material and copy.");
      assert.deepEqual(await Promise.all(Object.values(paths).map(async path => digest(await readFile(path)))), originals);
      assert.equal((await readdir(root)).some(name => name.includes("not_a_function")), false);
    });

    await t.test("reject invalid ranges, unreadable text, remote input, unsupported content and missing tools before success", async () => {
      await assert.rejects(renderMedia(spec({ duration: 61 }), paths, join(root, "too-long"), tools), code("INVALID_RENDER"));
      await assert.rejects(renderMedia(spec({ duration: 6 }), paths, join(root, "wrong-sum"), tools), code("INVALID_RENDER"));
      await assert.rejects(renderMedia(spec({ clips: [{ assetId: "video", kind: "video", start: 3, end: 8 }] }), paths, join(root, "past-end"), tools), code("INVALID_RENDER"));
      await assert.rejects(renderMedia(spec({ body: "word ".repeat(700) }), paths, join(root, "too-much-text"), tools), code("TEXT_OVERFLOW"));
      assert.deepEqual(await readdir(join(root, "too-much-text")), []);
      await assert.rejects(probeMedia("https://example.invalid/video.mp4", tools), code("INVALID_MEDIA"));
      await assert.rejects(probeMedia(paths.video, { ...tools, ffprobe: join(root, "missing.exe") }), code("MEDIA_TOOL_MISSING"));
      const invalid = join(root, "not-media.mp4"); await writeFile(invalid, "not a video");
      await assert.rejects(probeMedia(invalid, tools), code("MEDIA_PROCESSING_FAILED"));
      const playlist = join(root, "remote.m3u8"); await writeFile(playlist, "#EXTM3U\n#EXT-X-TARGETDURATION:10\n#EXTINF:10,\nhttps://example.invalid/leak\n#EXT-X-ENDLIST\n");
      await assert.rejects(probeMedia(playlist, tools), code("MEDIA_PROCESSING_FAILED"));
      assert.deepEqual(await Promise.all(Object.values(paths).map(async path => digest(await readFile(path)))), originals);
    });
  } finally { await rm(root, { recursive: true, force: true }); }
});
