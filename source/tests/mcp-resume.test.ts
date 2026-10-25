import test from "node:test";
import assert from "node:assert/strict";
import { captureMcpResume, resumeMcpLogin } from "../src/console/mcp-resume.ts";

const handle = "a".repeat(41) + "-_";
const key = "marker-mcp-login-resume";
const start = 1_700_000_000_000;

function fixture(href = "https://marker.example.invalid/", initial: Record<string, string> = {}) {
  const stored = new Map(Object.entries(initial));
  const events: string[] = [], redirects: string[] = [];
  const state = { existing: "history state" };
  const browser = {
    location: { href, replace(url: string) { events.push("navigate"); redirects.push(url); } },
    history: { state, replaceState(next: unknown, unused: string, url: string | URL) {
      assert.equal(next, state); assert.equal(unused, ""); events.push("clean-url"); browser.location.href = String(url);
    } },
    sessionStorage: {
      getItem(name: string) { return stored.get(name) ?? null; },
      setItem(name: string, value: string) { events.push("store"); stored.set(name, value); },
      removeItem(name: string) { events.push("remove"); stored.delete(name); },
    },
  };
  return { browser, stored, events, redirects };
}

test("capture stores only the opaque correlation handle before cleaning its query key", () => {
  const f = fixture(`https://marker.example.invalid/?auth=signed-in&label=a%20b&mcp_resume=${handle}&label=c%2Bd#campaigns`);
  captureMcpResume(f.browser, start);
  assert.deepEqual(JSON.parse(f.stored.get(key)!), { request: handle, capturedAt: start });
  assert.equal(f.browser.location.href, "https://marker.example.invalid/?auth=signed-in&label=a%20b&label=c%2Bd#campaigns");
  assert.deepEqual(f.events, ["remove", "store", "clean-url"]);
  assert.deepEqual(f.redirects, []);
});

test("malformed, URL-shaped and duplicate handles are discarded without retaining an older flow", () => {
  for (const value of ["", "a".repeat(42), "a".repeat(44), "https://evil.invalid/return", "//evil.invalid/return", "javascript:alert(1)", "a".repeat(43) + "\n", "é".repeat(43)]) {
    const f = fixture(`https://marker.example.invalid/?mcp_resume=${encodeURIComponent(value)}&auth=failed#settings`, { [key]: JSON.stringify({ request: handle, capturedAt: start }) });
    captureMcpResume(f.browser, start);
    assert.equal(f.stored.has(key), false, value);
    assert.equal(f.browser.location.href, "https://marker.example.invalid/?auth=failed#settings");
    assert.equal(resumeMcpLogin(f.browser, true, start), false);
  }
  const duplicate = fixture(`https://marker.example.invalid/?mcp_resume=${handle}&%6dcp_resume=${handle}#campaigns`);
  captureMcpResume(duplicate.browser, start);
  assert.equal(duplicate.stored.has(key), false);
  assert.equal(duplicate.browser.location.href, "https://marker.example.invalid/#campaigns");
});

test("provider navigation preserves the pending handle and resumes once after real authentication", () => {
  const f = fixture(`https://marker.example.invalid/?mcp_resume=${handle}#campaigns`);
  captureMcpResume(f.browser, start);
  const original = f.stored.get(key);
  for (const authenticated of [undefined, null, false, "true", 1, { authenticated: true }]) {
    assert.equal(resumeMcpLogin(f.browser, authenticated, start + 100), false);
    assert.equal(f.stored.get(key), original);
  }
  f.browser.location.href = "https://marker.example.invalid/?auth=signed-in#campaigns";
  captureMcpResume(f.browser, start + 60_000);
  assert.equal(f.stored.get(key), original);
  assert.equal(f.browser.location.href, "https://marker.example.invalid/?auth=signed-in#campaigns");
  assert.equal(resumeMcpLogin(f.browser, true, start + 60_000), true);
  assert.equal(f.stored.has(key), false);
  assert.deepEqual(f.redirects, [`/api/mcp/oauth/resume?request=${handle}`]);
  assert.deepEqual(f.events.slice(-2), ["remove", "navigate"]);
  assert.equal(resumeMcpLogin(f.browser, true, start + 60_001), false);
  assert.equal(f.redirects.length, 1);
});

test("ten-minute expiry is enforced and provider returns do not extend it", () => {
  for (const elapsed of [599_999, 600_000, 600_001]) {
    const f = fixture(`https://marker.example.invalid/?mcp_resume=${handle}`);
    captureMcpResume(f.browser, start);
    f.browser.location.href = "https://marker.example.invalid/?auth=signed-in";
    captureMcpResume(f.browser, start + elapsed);
    assert.equal(resumeMcpLogin(f.browser, true, start + elapsed), elapsed < 600_000);
    assert.equal(f.stored.has(key), false);
  }
});

test("invalid stored data and future timestamps never become redirect targets", () => {
  for (const raw of ["{", "null", "[]", JSON.stringify({ request: "https://evil.invalid", capturedAt: start }), JSON.stringify({ request: handle, capturedAt: start + 1 }), JSON.stringify({ request: handle, capturedAt: "1700000000000" }), JSON.stringify({ request: handle, capturedAt: start, returnTo: "https://evil.invalid" })]) {
    const f = fixture("https://marker.example.invalid/?returnTo=https%3A%2F%2Fevil.invalid", { [key]: raw });
    assert.equal(resumeMcpLogin(f.browser, true, start), false);
    assert.equal(f.stored.has(key), false);
    assert.deepEqual(f.redirects, []);
  }
  const f = fixture("https://marker.example.invalid/?returnTo=https%3A%2F%2Fevil.invalid#settings");
  captureMcpResume(f.browser, start);
  assert.equal(resumeMcpLogin(f.browser, true, start), false);
  assert.deepEqual(f.events, []);
});

test("storage failures preserve login usability and cannot cause repeat redirects", () => {
  const unavailable = fixture(`https://marker.example.invalid/?mcp_resume=${handle}&auth=signed-in#campaigns`);
  Object.defineProperty(unavailable.browser, "sessionStorage", { get() { throw new Error("Storage denied"); } });
  assert.doesNotThrow(() => captureMcpResume(unavailable.browser, start));
  assert.equal(unavailable.browser.location.href, "https://marker.example.invalid/?auth=signed-in#campaigns");
  assert.equal(resumeMcpLogin(unavailable.browser, true, start), false);
  assert.deepEqual(unavailable.redirects, []);

  const quota = fixture(`https://marker.example.invalid/?mcp_resume=${"b".repeat(43)}`, { [key]: JSON.stringify({ request: handle, capturedAt: start }) });
  quota.browser.sessionStorage.setItem = () => { throw new Error("Quota exceeded"); };
  captureMcpResume(quota.browser, start);
  assert.equal(resumeMcpLogin(quota.browser, true, start), false);
  assert.deepEqual(quota.redirects, []);

  const cannotConsume = fixture(undefined, { [key]: JSON.stringify({ request: handle, capturedAt: start }) });
  cannotConsume.browser.sessionStorage.removeItem = () => { throw new Error("Storage write denied"); };
  assert.equal(resumeMcpLogin(cannotConsume.browser, true, start), false);
  assert.deepEqual(cannotConsume.redirects, []);
});
