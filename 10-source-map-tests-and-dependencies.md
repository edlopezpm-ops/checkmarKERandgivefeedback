# 10 — Source map, tests and dependencies

The source projection contains **346 files** totaling **35,798,911 bytes**, including full source, tests, migrations, build/configuration, the reproducible ChatGPT plugin package, maintained docs, original brand/font assets, illustrated Help and the five public demo files. All public demo files are below the GitHub 100 MiB per-file limit; no product code or demo binary is omitted.

- [Every source path and hash](inventories/source-paths.md).
- [Machine snapshot, source commit and dirty qualifications](source-snapshot-manifest.json).
- [Module/symbol/import/call navigation](code-flow/05-module-symbol-index.md).
- [Full AST metadata](inventories/ast-index.json).
- [Server route occurrences](inventories/routes.md).
- [All static test declarations](inventories/test-index.md).
- [Locked dependencies and commands](inventories/dependencies.md).
- [Public demo hashes/URLs](inventories/public-media.json).

The TypeScript parser indexed **116 modules**. The static test index contains **308 declarations across 42 files**, including subtests. These numbers are source navigation metrics, not pass counts, statement coverage or runtime reachability. Generated Worker declarations dominate symbols. Parse success does not replace typechecking, tests or security review.

Source files were copied byte-for-byte from the frozen checkout. Local Git publication uses `source/** -text` in this checkout's private Git attributes to preserve those bytes in Git objects while leaving the projected original `.gitattributes` intact. A later clone can translate text endings according to those original attributes; the verifier permits only a line-ending-equivalent checkout whose committed source blob still matches the captured raw hash. Binary assets must match exactly.

For local review, enter `source/`, install the exact lockfile with `npm ci`, then use the documented type/build/test commands with synthetic local data. Native media tests require the declared local FFmpeg toolchain. These setup steps are optional reviewer actions; this documentary refresh did not repeat the root product suite. The product does not need private governance files to build.

Excluded paths are explicitly listed in the manifest. Dependency installations, build/generated output, private inputs/governance/evidence, actual environment/secret files, account/credential stores and runtime owner data are not missing implementation. The safe blank `.dev.vars.example` and public Wrangler/site identifiers remain available for configuration review.
