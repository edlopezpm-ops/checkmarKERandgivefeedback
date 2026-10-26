# Terms UI correction — 25 October 2026

The Terms dialog follows the existing page language choice in Environment. It presents all 20 clauses in the selected language, declares that language to assistive technology and displays only `Version 2026-10-25.1` beneath its title. No additional language control was introduced. The existing modal, focus restoration, reopening and direct `?policy=terms` route remain in place.

The redundant publication/version sentence at the beginning of clause 20 was removed in both languages. Its remaining provisions about material changes, required notice or agreement, separate privacy choices and language equivalence remain. The other 19 clauses, all 20 headings, AI video/AI slop restrictions and deletion clauses are unchanged. Privacy and Cookies retain their exact text and version `2026-10-24.1`.

## Source and publication

- Baseline main: `86a517f8062a7f7473c861994f3b2bb675adb82c`.
- Initial header/language correction: `9fd5d369c45367c02ac5bcb13a800d6e9b0b6a22`.
- Final deployed source, including clause 20 metadata cleanup: `33848fc5216b598112a35b62a946821681ed4dfd`.
- Final Worker: `792eea2e-8ac7-45db-9bdd-d3da4e7e73e5`, observed at 100% on 25 October 2026.
- Public entry: [Terms of Service](https://marker.aekr.io/?policy=terms).

Both source commits were pushed directly to main with `[skip ci]`. No pull request or GitHub Actions run was used. Manual publication used the installed Wrangler 4.152.0 with `deploy --keep-vars --containers-rollout none`. The previous dated Terms release receipt remains unchanged.

## Verification and limits

Focused checks confirmed all 20 clauses in each language; exact baseline policy content except the two specified clause 20 metadata sentences; no extra language controls or hash/checksum explanation in Terms; global-language context updates without remounting the modal; and retained focus restoration. The existing language persistence and direct-query routing source is unchanged. Both presentation requirements fail against the baseline fixture.

The final build passed client/server TypeScript checks, Vite and the original-logo integrity check. The 12 existing profile UI tests passed. A Worker dry run passed before initial publication. Final hosted HTTP readback at `2026-10-25T16:50:05Z` matched all 185 build assets, including the original logo and demo; three private APIs denied anonymous access with 401, and both demo movies retained 206 byte-range responses. The server script ETag, bindings and runtime options exactly match the pre-correction Worker.

Hosted app-browser language/layout checks and the requested reviewer disposition are recorded separately by the coordinating review. These technical checks establish neither human UAT nor legal approval or security certification. No algorithm, classifier, detector, suspension mechanism, acceptance receipt/gate, schema, data migration, provider execution, credential, DNS or billing change was introduced.

Rollback is confined to reverting these presentation changes and redeploying the prior verified source with the retained Worker configuration. No data rollback is required.
