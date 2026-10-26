# Terms display version addendum — 25 October 2026

The Terms dialog now displays exactly `Version 20261025` in both page languages. This supersedes the displayed label recorded in the earlier UI correction receipt. No internal identifier or explanation was added to the public Terms UI.

The internal Terms version remains `2026-10-25.1`; Privacy and Cookies remain `2026-10-24.1`. All 20 clause bodies and headings, the global language selection, modal/focus behavior and direct Terms route are unchanged from source `a2356a98b6814aa4526c5a5ead2f5aeb0803bce8`.

Deployed source: `fadb771a6baf77d47115e9b1fa3b82fb3a9033a4`, pushed directly to main with `[skip ci]`. Worker: `132eb1d9-3de5-4b96-ad3c-72fb8ab86301`, observed at 100%. Manual Wrangler publication retained `--keep-vars --containers-rollout none`; no pull request or GitHub Actions run was used.

Focused EN/ES rendering checks passed for the exact visible label, retained internal versions, all 20 unchanged clauses, unchanged Privacy/Cookies output and the single literal source replacement. The baseline fails the new visible-label requirement. Client/server TypeScript, Vite and original-logo checks passed. Hosted readback matched all 185 build assets; the server script ETag, bindings and runtime options remain exact. Three private APIs still return 401 to anonymous requests; both demo movies still support 206 byte ranges.

The coordinating review records final in-app browser and requested reviewer observations separately. No human UAT, legal approval or security certification is asserted. This correction adds no algorithm, acceptance gate, provider execution, migration, data, DNS, credential or billing change. Earlier dated receipts remain unchanged.
