# Documentary reproduction tools

These tools read tracked product files and create structural documentation only. They do not import application modules, invoke product tests, open existing runtime databases, read ignored/private files, call providers or deploy resources. Run them against a clean checkout of product commit `1f9415ee19e1e6ed175df6ef8aac8edc7182c9e9` in an authorized local environment.

Requirements: Python 3 with stdlib `sqlite3`, Git, Node.js and the product's already installed TypeScript package. The public dossier does not include or grant access to that source checkout or its dependencies. Relative paths below are examples; choose the actual authorized source path on your machine.

```powershell
python tools/extract-catalogs.py ../marKER .
node tools/extract-structure.mjs ../marKER .
python tools/render-catalog-references.py ../marKER .
```

`extract-catalogs.py` refuses source HEAD/status drift, inventories every tracked path using committed Git blobs plus separate checkout hashes, extracts exact lockfile dependency metadata, reconstructs all D1 migrations in memory and derives the local Studio static SQL schema. Each exported schema is replayed in another empty database and compared structurally. Implicit SQLite indexes may have no standalone DDL; this is represented as null. Source SQL-input digests are distinct from source-file digests in the manifest.

`extract-structure.mjs` uses the installed TypeScript parser without loading product code. It records declarations/signatures/declared fields/types, imports/re-exports, unresolved syntactic call targets, API literal/regex occurrences and test declarations. Executable bodies, variable values and call argument values are excluded. Email addresses, Windows drive prefixes and UUID-like values encountered in declarative text are omitted. Computed/complex call targets are placeholders. It performs no semantic type resolution or runtime graph inference.

`render-catalog-references.py` renders the generated JSON as navigable Markdown and expands known route guards into a curated method/path reference. Curated routing assumptions are frozen to the pinned source and deliberately fail if their expected static markers disappear. Test counts include subtests. Generated platform type declarations dominate raw symbol totals. Hashes and line counts are identity/descriptive metadata, not proof that a behavior works.

Package assembly and documentary verification are separate integration steps. Never treat successful script execution as authority to publish source, enable a service, alter a database, accept product UAT or change shared history.
