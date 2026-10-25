// Immutable public demo films. ASSETS can omit Content-Length and ignore Range.
const filmBytes = new Map([
  ["/demo/marKER_demo_55s_ES_v1_1080p.mp4", 6137380],
  ["/demo/marKER_demo_55s_ES_v1_4K.mp4", 14495058],
]);

export function isDemoMediaRequest(request: Request): boolean {
  return filmBytes.has(new URL(request.url).pathname) && ["GET", "HEAD"].includes(request.method);
}

// Read only the chunks needed for one range; cancel the remaining asset stream.
function rangeBody(body: ReadableStream<Uint8Array>, start: number, end: number): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  let offset = 0;
  return new ReadableStream({
    async pull(controller) {
      while (offset <= end) {
        const { done, value } = await reader.read();
        if (done) throw new Error("Demo asset ended before the requested range.");
        const chunkStart = offset;
        offset += value.byteLength;
        if (offset <= start) continue;
        controller.enqueue(value.subarray(Math.max(0, start - chunkStart), Math.min(value.byteLength, end - chunkStart + 1)));
        if (offset > end) {
          controller.close();
          await reader.cancel();
        }
        return;
      }
    },
    cancel(reason) { return reader.cancel(reason); },
  }, { highWaterMark: 0 });
}

export async function serveDemoMedia(request: Request, assets: Pick<Fetcher, "fetch">): Promise<Response> {
  const range = request.headers.get("Range");
  const ifRange = request.headers.get("If-Range");
  const headers = new Headers(request.headers);
  headers.delete("Range");
  headers.delete("If-Range");
  headers.set("Accept-Encoding", "identity");
  const response = await assets.fetch(new Request(request, { headers }));
  if (response.status !== 200) return response;
  const output = new Headers(response.headers);
  const declaredLength = Number(output.get("Content-Length"));
  const length = Number.isSafeInteger(declaredLength) && declaredLength > 0
    ? declaredLength : filmBytes.get(new URL(request.url).pathname);
  if (length === undefined) return response;
  output.set("Accept-Ranges", "bytes");
  output.set("Content-Length", String(length));
  if (request.method === "HEAD") {
    await response.body?.cancel();
    return new Response(null, { status: 200, headers: output });
  }
  const full = () => new Response(response.body, { status: 200, headers: output });
  if (!range || !response.body) return full();
  if (ifRange && (ifRange.startsWith("W/") || (ifRange !== output.get("ETag") && ifRange !== output.get("Last-Modified")))) return full();
  const match = range.trim().match(/^bytes=(\d*)-(\d*)$/);
  // Malformed and multipart ranges are ignored, returning the complete film.
  if (!match || (!match[1] && !match[2])) return full();
  const first = match[1] ? Number(match[1]) : null;
  const last = match[2] ? Number(match[2]) : null;
  const start = first === null ? Math.max(0, length - last!) : first;
  const end = first === null || last === null ? length - 1 : Math.min(last, length - 1);
  if ((first !== null && !Number.isSafeInteger(first)) || (last !== null && !Number.isSafeInteger(last)) || start >= length || start > end || (first === null && last === 0)) {
    await response.body.cancel();
    output.set("Content-Range", `bytes */${length}`);
    output.set("Content-Length", "0");
    return new Response(null, { status: 416, headers: output });
  }
  const selectedLength = end - start + 1;
  output.set("Content-Range", `bytes ${start}-${end}/${length}`);
  output.set("Content-Length", String(selectedLength));
  const selection = rangeBody(response.body, start, end);
  // The native Workers marker preserves the selected Content-Length on the wire.
  const body = typeof FixedLengthStream === "undefined"
    ? selection : selection.pipeThrough(new FixedLengthStream(selectedLength));
  return new Response(body, { status: 206, headers: output });
}
