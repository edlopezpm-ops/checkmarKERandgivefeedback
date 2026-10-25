# Hosted MCP deployment status

Updated 2026-10-24 America/New_York; deployment timestamp is in UTC.
This is a bounded operational update after source snapshot publication
`80fc3db665fcad787f4033cafd70e8af4b3ec2a1`. The initial 333-file source projection is preserved at that commit. The current
336-file projection uses source base `a675f8dfccf32986530205cb1636dac7624afc21`
plus the same 12 byte-preserved working-tree demo paths. Its later four-path delta
contains three canonical plugin-package files and one connector-document update.
The deployed runtime remains source `de0a4a65d6d37642e5f7efda66151c4270ec2a02`
plus those demo bytes; the package-only increment changes no runtime or deployment.
Structural catalogs and product test evidence retain their original scope.

| Item | Verified/reporting boundary |
| --- | --- |
| Authority | Direct owner authorization for private D1 backup, additive migration 0010 and hosted deployment. |
| Active Worker | `99baf771-ac51-40d9-a76f-7652aaeb4e51`, 100% deployment allocation. |
| Deployment | `208f8770-cb9e-42f2-a169-21e802660b52`, created `2026-10-25T00:49:26.283236Z`. |
| Previous Worker | Fresh predeployment inspection: `c525b283-3ba7-453d-a429-d76c73e81924`. The earlier dossier's 5998 reference came from an older receipt. |
| D1 | Migration `0010_mcp.sql` applied; all seven MCP tables confirmed by readonly inspection (`rows_written=0`, `changed_db=false`). |
| Hosted checks | Independent implementation-team readback: **18/18 PASS**. |
| Public assets | **182/182** dist assets matched exact bytes and SHA-256, totaling **32,761,835 bytes**; approved original logo matched. |
| Public demo | Both MP4s passed range, suffix-range and HEAD checks. `/index.html` and `/demo/index.html` returned canonical 307 redirects whose targets returned matching 200 content. |

The hosted metadata identifies the exact resource, issuer and OAuth endpoints.
Anonymous and invalid-bearer MCP requests return 401 with the authentication
challenge; foreign-Origin requests return 403. Private application APIs and
private artifacts deny unauthorized access. Public endpoint:
[https://marker.aekr.io/api/mcp](https://marker.aekr.io/api/mcp).

These observations were supplied by the implementation coordinator from the
bounded hosted readback. This documentary worker did not rerun product tests,
query D1, deploy, read/copy the private backup, inspect owner records or invoke a
model/provider. The earlier 75 focused local tests, later 12-test subset and real
local SDK/FFmpeg flow retain their original scope; they are not represented as
new hosted authenticated end-to-end tests.

A private user-level plugin package was created and its manifest read back. It
uses the hosted endpoint and public-client dynamic registration, with read,
write and produce permissions requested by default. Delete is not a default
permission. Private account IDs and installation links are not published here.

**Actual host installation, owner OAuth consent and Dot conversation remain
pending.** The host page required CAPTCHA and owner handoff. Creating the plugin
package and deploying the server do not establish a connected or conversational
experience. Human UAT, physical-device/creative pilot and backup restoration
remain separate. A successful backup or retained previous Worker reference is
not proof of a completed restoration.
