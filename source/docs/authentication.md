# Private operator authentication

marKER keeps one operator and one retained workspace identity. There is no public
registration, invitation, team membership, subscription gate or tenant selector.
The existing editorial, Studio, originals, render and agent records stay in their
current storage and retain their identifiers.

Email sign-in remains the available access and recovery method: the configured
operator requests the existing eight-digit code and verifies it in the same
browser within five minutes. Opaque sessions retain their six-hour absolute and
thirty-minute idle limits. Provider credentials and tokens never reach the UI.

The authentication design follows the private timeKER baseline: direct Google
OpenID Connect and an immutable provider identity, adapted to marKER's Worker and
D1. It does not import timeKER's registration, managed-email provider, billing or
tenant allocation machinery.

## Retained identity

Migration `0007_single_tenant_auth.sql` creates one singleton with random,
persisted `tenant_id` and `user_id` values. The first verified existing email
session binds the configured operator's HMAC fingerprint to that singleton.
Existing valid sessions receive the same identity on the server; their original
authentication time is retained. A configuration change to another operator
fails closed and does not reassign the workspace.

Requests cannot supply or select a tenant. `/api/session` returns the identity
resolved from the authenticated server session. Business records do not receive
new tenant columns in this increment.

## Link Google, then use it to sign in

Google is optional. The application only offers an operational Google action
when a dedicated marKER OAuth web client is configured. An existing provider
session, an email match or a client ID from another product cannot create a
binding.

1. Sign in through marKER's existing email code.
2. Within five minutes of verification, open **Settings → Access → Link my Google
   account** (**Ajustes → Acceso → Vincular mi cuenta de Google**) and complete
   Google's account selection.
3. marKER validates the Google proof and binds its issuer and immutable subject
   to the retained operator. A different existing Google subject cannot replace
   that binding through sign-in or another link attempt.
4. On a later visit, **Continue with Google** signs into that same operator and
   workspace. Email remains available for access and recovery.

Google linking checks the original email session at both the start and callback,
including after provider latency. A Google-authenticated session cannot count as
fresh independent email proof. Use a new email code when that proof expires.

## API contract

`POST /api/auth/google/start` accepts exactly `{ "intent": "link" }` or
`{ "intent": "login" }` and returns `{ "url": "https://accounts.google.com/..." }`.
The request requires the canonical same origin and `X-Marker-Auth: 1` header.
An unavailable client, unbound identity or stale email proof produces an explicit
error. There is no fallback provider.

`GET /api/auth/google/callback` is the fixed callback. Its result redirects to
the app root with one closed result: `auth=google-linked`, `auth=signed-in` or
`auth=failed`. Provider error descriptions and tokens are not reflected.

The metadata exposes `methods.email.configured` and
`methods.google.{configured,bound,canLink,linkRequiresEmailVerification}`.
`canLink` requires configured credentials and a native email proof younger than
five minutes; configuration alone does not establish a linked identity or a
successful personal provider login.

## Provider activation

This implementation does not create an OAuth client, copy credentials, register
callbacks, apply the hosted migration or deploy a Worker. Those external actions
remain separate from the verified source implementation.

Provide a dedicated Google OAuth **Web application** client for marKER with this
exact authorized redirect URI:

```text
https://marker.aekr.io/api/auth/google/callback
```

Configure `MARKER_GOOGLE_CLIENT_ID` and the secret
`MARKER_GOOGLE_CLIENT_SECRET` through the deployment's own configuration and
secret storage. Preserve the existing `MARKER_AUTH_SECRET`, operator address,
email binding and business storage. Apply migration `0007_single_tenant_auth.sql`
as a reviewed deployment step. Never copy timeKER or accreatio credentials.

Client configuration and personal provider login must be verified separately
from source and synthetic tests. Local Vite development retains its explicit
loopback development access boundary.

## Security and verification

The server stores hashed state, nonce and browser binding, an encrypted PKCE
verifier and the pinned native session hash. A dedicated Secure, HttpOnly,
SameSite=Lax cookie carries the OAuth browser binding so the callback can work
without exposing or weakening the existing SameSite=Strict owner cookie. Flows
expire, consume once and have bounded IP/global admission.

Google token exchange uses only fixed provider URLs and refuses redirects. JWKS
and token responses have byte and timeout bounds. Web Crypto verifies RS256,
issuer, signature, audience, authorized party, nonce, issuance/expiry and
verified identity. Only the subject's HMAC and internal identity are retained;
access tokens, refresh tokens, raw subjects and Google email addresses are not
persisted. The Google email is never the authorization key.

Focused tests use real SQLite, real synthetic RSA signatures and mocked provider
transport. They cover email preservation, exact singleton identity, native-session
upgrade, cross-browser/replay denial, origin/header checks, stale/revoked native
proof, provider failure, proof expiry during exchange, subject binding and JWT
claim/signature failures. They do not establish actual Google client activation,
personal login, hosted migration, deployment or human acceptance.

References: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)
and [Cloudflare Workers practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/).

## GitHub access

GitHub follows the same first-link rule: sign in with a fresh email code, then
open Settings → Access → Link my GitHub account. Later, Continue with GitHub
opens the same retained workspace. A matching email or mutable GitHub login
name never grants access. The server binds the authenticated numeric GitHub
user ID under the fixed `https://github.com` issuer.

Register a dedicated OAuth application with homepage `https://marker.aekr.io`
and the exact redirect URI `https://marker.aekr.io/api/auth/github/callback`.
Configure `MARKER_GITHUB_CLIENT_ID` and `MARKER_GITHUB_CLIENT_SECRET` in the
existing deployment's secret store. The app requests no additional OAuth scopes:
public identity is sufficient; repository access and email permissions are not
requested. Device flow is unused. Provider access/refresh tokens are discarded
after the fixed authenticated profile request.

Migration `0008_github_auth.sql` preserves the existing Google identity and all
email/Google session principals while extending the auth-only constraints for
GitHub. It tags OAuth flows by provider. Tenant/user IDs and business records
stay in place. Review the migration as part of the deployment.

## CAPTCHA on authentication requests

The existing backend calls Cloudflare Turnstile Siteverify before email code
requests, code verification, access-help email and Google/GitHub flow admission.
The browser sends `captchaToken`; each surface uses its own widget and resets it
after every attempt. Expired tokens, script failures and incomplete configuration
block the protected action. Dismissing a red notice does not bypass validation.

Configure the public `TURNSTILE_SITE_KEY`, private `TURNSTILE_SECRET` and
`TURNSTILE_HOSTNAMES=marker.aekr.io`. Production accepts exactly that hostname,
even if the widget also allows local development hostnames. Siteverify must
return boolean success, the exact action for the existing route and the expected
hostname. After provider validation, an atomic insert consumes a keyed digest
of the proof in the existing authentication limiter store. This prevents reuse
across routes and concurrent requests even if the provider repeats success.
The store retains no raw token, has a bounded capacity and fails closed on
storage errors. Raw tokens are never logged or persisted.

| Existing endpoint | Turnstile action |
| --- | --- |
| `/api/auth/request` | `auth_email_request` |
| `/api/auth/verify` | `auth_email_verify` |
| `/api/auth/help` | `auth_help` |
| `/api/auth/google/start` | `auth_google` |
| `/api/auth/github/start` | `auth_github` |

Completely absent Turnstile configuration preserves the existing auth baseline
during setup. Any partial configuration fails closed. Explicit local Vite mode
continues to use its trusted loopback development boundary.

Both OAuth token/JWKS requests and Siteverify use Workers-compatible manual
redirect handling and reject non-success responses rather than following them.
See [Turnstile server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/),
[GitHub OAuth authorization](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
and [Workers Request modes](https://developers.cloudflare.com/workers/runtime-apis/request/).
