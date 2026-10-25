const storageKey = "marker-mcp-login-resume";
const queryKey = "mcp_resume";
const lifetime = 10 * 60 * 1000;
const handlePattern = /^[A-Za-z0-9_-]{43}$/;
const isHandle = (value: unknown): value is string => typeof value === "string" && value.length === 43 && handlePattern.test(value);

type ResumeBrowser = {
  readonly location: { readonly href: string; replace(url: string): void };
  readonly history: { readonly state: unknown; replaceState(data: unknown, unused: string, url: string | URL): void };
  readonly sessionStorage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
};

/** Keep only a short-lived correlation handle; the server owns and validates
 * the pending OAuth transaction. Unrelated query values and history survive. */
export function captureMcpResume(browser: ResumeBrowser, now = Date.now()): void {
  const url = new URL(browser.location.href);
  const values = url.searchParams.getAll(queryKey);
  if (!values.length) return;
  try {
    // A new attempt must not fall back to an older handle if storing it fails.
    browser.sessionStorage.removeItem(storageKey);
    if (values.length === 1 && isHandle(values[0]) && Number.isSafeInteger(now) && now >= 0) {
      browser.sessionStorage.setItem(storageKey, JSON.stringify({ request: values[0], capturedAt: now }));
    }
  } catch { /* Unavailable browser storage cannot authorize a continuation. */ }
  // Remove only this parameter, without re-encoding other query values.
  url.search = url.search.slice(1).split("&").filter(part => !new URLSearchParams(part).has(queryKey)).join("&");
  browser.history.replaceState(browser.history.state, "", url.href);
}

/** Call only with the authenticated value returned by /api/session. Consume
 * before navigation so reloads and duplicate session responses cannot loop. */
export function resumeMcpLogin(browser: ResumeBrowser, authenticated: unknown, now = Date.now()): boolean {
  if (authenticated !== true) return false;
  let saved: unknown;
  try {
    const raw = browser.sessionStorage.getItem(storageKey);
    if (!raw) return false;
    // A failed removal must not be followed by a redirect.
    browser.sessionStorage.removeItem(storageKey);
    saved = JSON.parse(raw);
  } catch { return false; }
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return false;
  const value = saved as Record<string, unknown>;
  if (Object.keys(value).length !== 2 || !isHandle(value.request)
    || typeof value.capturedAt !== "number" || !Number.isSafeInteger(value.capturedAt) || value.capturedAt < 0
    || !Number.isSafeInteger(now) || now < value.capturedAt || now - value.capturedAt >= lifetime) return false;
  browser.location.replace(`/api/mcp/oauth/resume?request=${encodeURIComponent(value.request)}`);
  return true;
}
