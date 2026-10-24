# Database reference

This directory publishes structure and constraints only. It contains no application records, sessions, challenges, identities, media, production exports or existing database files.

- [D1 reference](d1-reference.md): all 15 tables, 82 columns, foreign keys, implicit/explicit indexes and CHECK constraints reconstructed from all five tracked D1 migrations.
- [D1 schema-only SQL](d1-schema.sql) and [JSON catalog](d1-catalog.json).
- [Local Studio SQLite reference](local-studio-reference.md): 10 tables and 33 columns from the static initialization SQL in `server/studio-local.ts`.
- [Local Studio schema-only SQL](local-studio-schema.sql) and [JSON catalog](local-studio-catalog.json).
- [Inactive Supabase preparation](supabase-reference.md): distinct Postgres alternative, not the current native Worker storage path.

Reconstruction used fresh in-memory SQLite databases. The five migration inputs contain structural seed statements for singleton metadata/settings/limits; those seeds execute only in memory and are excluded from the exported schema-only SQL. Replaying each exported SQL file in another fresh database reproduced the complete non-internal sqlite_schema object set. Integrity and foreign-key checks passed. No hosted or ordinary local database was opened.

The SQL files are documentation, not a migration/recovery bundle: source migration history and seed records are deliberately not recreated by replaying schema-only DDL. Applying them to any service is outside this dossier.

See [chapter 11](../11-database-and-catalog-reference.md) for storage ownership, JSON contracts and navigation.
