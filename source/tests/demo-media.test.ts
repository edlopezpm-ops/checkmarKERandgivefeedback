import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isDemoMediaRequest, serveDemoMedia } from "../server/demo-media.ts";

const path = "/demo/marKER_demo_55s_ES_v1_1080p.mp4";
const bytes = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
const request = (headers = {}, method = "GET", target = path) => new Request("https://marker.aekr.io" + target, { method, headers });
function fixture() {
  const requests: Request[] = [];
  const assets = { async fetch(input: Request) {
    requests.push(input);
    return new Response(bytes, { headers: { "Content-Length": String(bytes.length), "Content-Type": "video/mp4", ETag: '"film-v1"', "Last-Modified": "Sat, 24 Oct 2026 12:00:00 GMT" } });
  } };
  return { assets, requests };
}

test("only the two immutable public movies and GET/HEAD select the media handler", () => {
  for (const target of [path, "/demo/marKER_demo_55s_ES_v1_4K.mp4"]) {
    assert.equal(isDemoMediaRequest(request({}, "GET", target)), true);
    assert.equal(isDemoMediaRequest(request({}, "HEAD", target)), true);
    assert.equal(isDemoMediaRequest(request({}, "POST", target)), false);
  }
  for (const target of ["/demo/", "/demo/index.html", path + "/extra", "/api/studio/assets/film", "/demo/unknown.mp4"]) assert.equal(isDemoMediaRequest(request({}, "GET", target)), false);
});

test("complete GET preserves the movie bytes and advertises byte ranges", async () => {
  const f = fixture(), result = await serveDemoMedia(request(), f.assets);
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("Accept-Ranges"), "bytes");
  assert.equal(result.headers.get("Content-Type"), "video/mp4");
  assert.deepEqual(new Uint8Array(await result.arrayBuffer()), bytes);
});

test("single, suffix and open-ended ranges return exact bytes and HTTP metadata", async () => {
  for (const [range, start, end] of [["bytes=2-5", 2, 5], ["bytes=-3", 7, 9], ["bytes=6-", 6, 9], ["bytes=8-99", 8, 9], ["bytes=-99", 0, 9]] as const) {
    const f = fixture(), result = await serveDemoMedia(request({ Range: range }), f.assets);
    assert.equal(result.status, 206, range);
    assert.equal(result.headers.get("Content-Range"), `bytes ${start}-${end}/10`);
    assert.equal(result.headers.get("Content-Length"), String(end - start + 1));
    assert.deepEqual(new Uint8Array(await result.arrayBuffer()), bytes.slice(start, end + 1));
    assert.equal(f.requests[0].headers.has("Range"), false);
    assert.equal(f.requests[0].headers.get("Accept-Encoding"), "identity");
  }
});

test("HEAD ignores Range, returns no body and cancels any upstream body", async () => {
  let cancelled = false;
  const result = await serveDemoMedia(request({ Range: "bytes=2-5" }, "HEAD"), { async fetch() { return new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { "Content-Length": "10" } }); } });
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("Content-Length"), "10");
  assert.equal(result.headers.has("Content-Range"), false);
  assert.equal((await result.arrayBuffer()).byteLength, 0);
  assert.equal(cancelled, true);
});

test("malformed or multipart ranges return the complete movie", async () => {
  for (const range of ["garbage", "bytes=-", "bytes=one-two", "items=1-2", "bytes=0-1,4-5"]) {
    const result = await serveDemoMedia(request({ Range: range }), fixture().assets);
    assert.equal(result.status, 200, range);
    assert.deepEqual(new Uint8Array(await result.arrayBuffer()), bytes);
  }
});

test("unsatisfiable ranges return 416, empty body and complete length", async () => {
  for (const range of ["bytes=10-", "bytes=9-2", "bytes=-0", "bytes=999999999999999999999-"]) {
    const result = await serveDemoMedia(request({ Range: range }), fixture().assets);
    assert.equal(result.status, 416, range);
    assert.equal(result.headers.get("Content-Range"), "bytes */10");
    assert.equal(result.headers.get("Content-Length"), "0");
    assert.equal((await result.arrayBuffer()).byteLength, 0);
  }
});

test("If-Range permits matching strong validators and falls back for changed/weak validators", async () => {
  for (const [validator, status] of [['"film-v1"', 206], ["Sat, 24 Oct 2026 12:00:00 GMT", 206], ['"other"', 200], ['W/"film-v1"', 200], ["Fri, 23 Oct 2026 12:00:00 GMT", 200]] as const) {
    const f = fixture(), result = await serveDemoMedia(request({ Range: "bytes=2-5", "If-Range": validator }), f.assets);
    assert.equal(result.status, status);
    assert.deepEqual(new Uint8Array(await result.arrayBuffer()), status === 206 ? bytes.slice(2, 6) : bytes);
    assert.equal(f.requests[0].headers.has("If-Range"), false);
  }
});

test("missing asset Content-Length uses the frozen film lengths and original bytes", async () => {
  for (const [target, length] of [[path, 6137380], ["/demo/marKER_demo_55s_ES_v1_4K.mp4", 14495058]] as const) {
    const original = readFileSync(new URL("../public" + target, import.meta.url));
    assert.equal(original.length, length);
    const result = await serveDemoMedia(request({ Range: "bytes=0-31" }, "GET", target), { async fetch() { return new Response(original); } });
    assert.equal(result.headers.get("Content-Range"), `bytes 0-31/${length}`);
    assert.deepEqual(new Uint8Array(await result.arrayBuffer()), new Uint8Array(original.subarray(0, 32)));
  }
});

test("non-200 asset responses pass through without manufacturing a range", async () => {
  for (const status of [304, 404, 503]) {
    const upstream = new Response(status === 304 ? null : "asset unavailable", { status, headers: { ETag: '"unchanged"' } });
    const result = await serveDemoMedia(request({ Range: "bytes=0-1" }), { async fetch() { return upstream; } });
    assert.equal(result, upstream);
    assert.equal(result.headers.has("Content-Range"), false);
  }
});

test("a small range cancels the remaining upstream movie instead of reading it all", async () => {
  let reads = 0, cancelled = false;
  const source = new ReadableStream<Uint8Array>({ pull(controller) { reads++; controller.enqueue(new Uint8Array(1024).fill(7)); }, cancel() { cancelled = true; } }, { highWaterMark: 0 });
  const result = await serveDemoMedia(request({ Range: "bytes=4-7" }), { async fetch() { return new Response(source, { headers: { "Content-Length": "1000000" } }); } });
  assert.deepEqual([...new Uint8Array(await result.arrayBuffer())], [7, 7, 7, 7]);
  assert.equal(reads, 1);
  assert.equal(cancelled, true);
});

test("downstream cancellation propagates to the upstream movie", async () => {
  let cancelled: unknown;
  const source = new ReadableStream<Uint8Array>({ pull(controller) { controller.enqueue(new Uint8Array([1, 2])); }, cancel(reason) { cancelled = reason; } }, { highWaterMark: 0 });
  const result = await serveDemoMedia(request({ Range: "bytes=0-99" }), { async fetch() { return new Response(source, { headers: { "Content-Length": "1000" } }); } });
  const reader = result.body!.getReader();
  await reader.read();
  await reader.cancel("player stopped");
  assert.equal(cancelled, "player stopped");
});

test("an interrupted upstream range rejects instead of silently returning truncated bytes", async () => {
  const result = await serveDemoMedia(request({ Range: "bytes=0-9" }), { async fetch() { return new Response(new Uint8Array([1, 2]), { headers: { "Content-Length": "10" } }); } });
  await assert.rejects(result.arrayBuffer(), /ended before/);
});
