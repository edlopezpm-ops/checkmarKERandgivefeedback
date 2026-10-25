export type CaptchaEnvironment = {MARKER_ORIGIN?: unknown; MARKER_AUTH_SECRET?:unknown;DB?:Pick<D1Database,'prepare'|'batch'>; TURNSTILE_SITE_KEY?: unknown; TURNSTILE_SECRET?: unknown; TURNSTILE_REQUIRED?: unknown; TURNSTILE_HOSTNAMES?: unknown};
export function authCaptchaConfiguration(env: CaptchaEnvironment): {required: boolean; sitekey: string | null};
export function verifyAuthCaptcha(request: Request, env: CaptchaEnvironment, token: unknown): Promise<boolean>;
