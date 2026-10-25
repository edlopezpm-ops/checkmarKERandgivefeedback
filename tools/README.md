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

The preceding seamless-connection refresh captured all 345 eligible source files and regenerates structural catalogs for 27 changed paths (including nine new files). The twelve prior demo paths remain byte-identical and explicitly dirty. Public CTA configuration is retained; private `.app.json` binding files are rejected by capture and verification. Product tests remain coordinator-reported.

The final combined consent/callback increment captures three changed paths since the last public snapshot, including one new test, for 346 source files. Unchanged tracked Git identities and the twelve dirty demo hashes are preserved. AST/routes/test navigation is refreshed; unchanged schema/dependency verification is retained without reexecution.
