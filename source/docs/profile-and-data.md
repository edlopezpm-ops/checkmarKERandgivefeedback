# Profile, policies and account deletion

Profile is available in the account menu. The optional name and country persist
separately from editorial content. Initials are derived automatically from the
first and last name, or from the access email when a name is absent. The email
is displayed readonly and is persisted from the verified server principal when
the profile is saved. A client cannot change the authorized email, provider
binding, user or tenant through this form. Revision checks protect stale drafts.

Local development keeps a separate profile beside its local workspace. That
profile is not an authentication principal. Account deletion is available on
the authenticated hosted deployment; the local adapter cannot erase a workspace.

## Policies

The dated provisional Terms, Privacy and Cookies notices are linked beside the
AEKR signature before sign-in and inside Environment after sign-in, in English
and Spanish. Permalinks use
`?policy=terms`, `?policy=privacy` and `?policy=cookies`. They describe the current
personal AEKR project, its providers and its actual storage. No company,
jurisdiction, commercial service or retention period is invented. Displaying a
notice does not manufacture a consent or acceptance receipt. Optional decoration
storage remains separate, off by default, and revocable through Environment.

## Explicit deletion

The first action opens the confirmation. The user then types exactly `DELETE`
and confirms the checkbox covering all workspace data. The server independently
requires both values, canonical origin/header, the retained tenant and a native
email proof younger than five minutes. A Google/GitHub session alone cannot
authorize deletion. Preparing or testing this feature does not delete the owner.

`DELETE /api/profile` starts a resumable process. A durable lifecycle marker
blocks access, OAuth callbacks, bridge work and further app writes. SQLite
triggers also stop already-admitted operations from recreating records. The
processor permanently stops, destroys its container, clears queued work and
waits for outstanding writes. Known multipart uploads are aborted; private R2
objects are removed in bounded batches. The workflow waits for existing leases,
checks the bucket again and transactionally purges all app data tables. Only a
minimal marker without identity or content remains, preventing automatic
recreation of the deleted private account.

A same-browser Secure/HttpOnly/Strict cookie allows status and resume after the
normal session is revoked. GET is readonly. A failure preserves progress and
shows Retry rather than completion. Concurrent resumes use a durable lease.
The scheduled maintenance path only resumes an already owner-confirmed deletion.
Lost responses do not repeat the destructive start operation.

## Erasure boundaries

The app removes the active account, profile, identity links, sessions, editorial
records, Studio files/renders/analyses and agent data in its own D1/R2/processor.
Downloaded exports, independent local workspaces, provider accounts/grants,
provider-managed logs/backups and operator recovery copies are separate. The
operator must handle recovery copies and must not restore deleted account data.

The live bucket's Default Multipart Abort Rule was read back on 2026-10-24:
enabled, all prefixes, abort incomplete uploads seven days after initiation.
The R2 binding cannot enumerate orphan multipart uploads lacking a recoverable
reference. Those parts follow that rule; the UI and Terms disclose that an
active-data deletion result does not assert their immediate erasure. A changed
bucket rule requires updating this notice. Configuration readback is not proof
that any actual owner data was erased.

References: [R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/),
[Cloudflare Privacy](https://www.cloudflare.com/privacypolicy/),
[Google Privacy](https://policies.google.com/privacy), and
[GitHub Privacy](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).
