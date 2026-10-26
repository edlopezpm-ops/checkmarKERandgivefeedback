# Reproduce the review package

Use Python 3 stdlib, Git, Node and the already installed product TypeScript parser. These tools read public product files, never runtime databases/credentials/private governance. Capture requires an explicit frozen source HEAD; source writes remain outside this workflow.

```powershell
python tools/snapshot-source.py ../marKER --expected-head <reviewed-frozen-commit>
python tools/extract-catalogs.py ../marKER .
node tools/extract-structure.mjs ../marKER .
python tools/render-catalog-references.py ../marKER .
python tools/assemble.py
python tools/verify-package.py --source ../marKER --seal
python tools/verify-package.py --source ../marKER
```

Update curated chapters/current-state evidence deliberately before assembly/sealing. `snapshot-source.py` admits only explicit product roots/files, includes eligible untracked product changes with a dirty inventory, rejects unreviewed tracked paths, compares source before/after and preserves exact bytes. Large public demo media can be listed with hosted URL/hash if it exceeds 100 MiB; no such omission exists in this snapshot. It never deletes stale projection files automatically.

Catalog extraction binds to captured hashes, reconstructs D1 migrations and local Studio static SQL in empty memory, replays DDL and checks integrity/foreign keys. AST extraction records syntax without importing product code; route occurrences are not reachable-route counts. The generator does not execute tests, media processing, model calls, providers or deployment.

`verify-package.py` checks source path/hash completeness, forbidden payload names, high-confidence credential patterns, local dossier links and manifest roots. `--index` additionally compares every staged source blob with its original captured bytes. Before publication this checkout uses private Git attributes `source/** -text` so Git stores original bytes; those attributes are not part of product configuration. In a later clone, only a text line-ending equivalent whose committed blob still matches can satisfy source identity. Binary bytes remain exact. Pattern checks are not exhaustive secret detection.

Package manifests exclude their three self-referential seal/receipt files and ignored `.review-work`. Source checks are not human UAT, product-wide acceptance or deployment authority.

Historical update after publication `80fc3db` used a bounded four-path source increment: three canonical `integrations/chatgpt/marker/` files plus the connector document. The snapshot records the prior proof, exact changed paths, unchanged tracked Git identities and rehashed dirty demo paths. Structural catalogs remain byte-identical to their initial verification; only path/count/provenance outputs were updated. This avoids representing unchanged AST/schema or product tests as new executions.

The historical seamless-connection refresh captured all 345 eligible source files and regenerated structural catalogs for 27 changed paths (including nine new files). At that checkpoint the twelve prior demo paths remained byte-identical and explicitly dirty. Public CTA configuration is retained; private `.app.json` binding files are rejected by capture and verification. Product tests remain coordinator-reported.

The subsequent consent/callback publication captured three changed paths, including one new test, for 346 source files. It preserved unchanged tracked Git identities and the twelve then-dirty demo hashes. AST/routes/test navigation was refreshed; unchanged schema/dependency verification was retained without reexecution.

The current clean-source closure commits all twelve former demo paths unchanged, updates README/PROJECT_MAP and adds the public current-status handoff. All 347 selected files are tracked. Full eligible-path/hash, staged-byte, link and boundary checks run again; AST/schema/dependency/product execution is not repeated. The generator now describes clean versus dirty source accurately and includes the prioritized pending report in both reading copies.

## Documentary overlay — 26 October 2026

This update preserves the 24-October source projection and combined dossiers byte-for-byte; it does not run `snapshot-source.py`, extraction or assembly. `CURRENT-STATE-2026-10-24.json` preserves the previous state bytes; `CURRENT-STATE.json` v3 identifies canonical source/receipts and later unprojected changes. Regenerate only the package seal with `python tools/verify-package.py --seal`, then verify with `python tools/verify-package.py --index` after staging. Omit `--source ../marKER`: the current product has deliberately advanced beyond this frozen public archive. A successful archive/index check does not establish equality to today's canonical source or current runtime behavior.

## Full source and functional-audit publication — 26 October 2026

The explicit later owner request replaces the preceding minimal documentary overlay for this publication. Current source is the complete clean 77bbedac checkout with 368 paths. Source/catalog extraction and current dossier assembly are rerun; the dated 24-October reading copy remains byte-preserved and refers to the old Git snapshot.

`project-functional-audit.py --audit-root AUDIT_INPUT_DIR --source SOURCE_DIR --date 2026-10-26 --method METHOD_FILE` admits only named technical receipts, selected evidence and portable drivers. It strips local paths, authority/auth metadata and the entire ignored-file inventory, including real credential-file digests. It never copies sandbox stores, CLI profiles, dependency installations or build bundles. The original audit remains local. The public MANIFEST binds derivative bytes; original log hashes are labeled separately when normalized logs differ.

`assemble.py` derives the current date from the source manifest and writes the alias plus the current dated dossier. `verify-package.py` compares those current copies, checks all tracked payload names and scans audit trees without hiding forbidden directories behind PRIVATE filtering. Before sealing, rebuild the audit MANIFEST if a portable driver was adjusted. Run score replay and source/package/index checks, then inspect the exact staged path set before push. This does not rerun the original product suite or grant deployment authority.
