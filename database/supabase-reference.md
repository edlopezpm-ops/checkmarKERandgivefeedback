# Inactive Supabase / PostgreSQL preparation

Source: `migrations/0001_editorial.sql:L1-L52`, with repository adapter `server/supabase.ts` and callable compatibility helper `server/worker.ts:L16-L105`. This migration was inspected as tracked static text; no PostgreSQL database or Supabase service was accessed. The default exported Worker selects native owner auth and D1 instead (`server/worker.ts:L106-L128`).

The migration defines two tables, two security-definer functions and one read policy. It does not seed an owner and is a separate alternative to D1. The complete function bodies are intentionally not republished.

| Object | Declared structure / behavior |
| --- | --- |
| `marker_private` schema | Privileges revoked from `public`, `anon` and `authenticated`. |
| `marker_private.owner` | `singleton boolean` primary key, default true with CHECK singleton; `user_id uuid` NOT NULL UNIQUE references `auth.users(id)`. Requires a separately configured existing auth user. |
| `public.marker_is_owner(): boolean` | Stable SQL SECURITY DEFINER, empty search path; checks current authenticated user against the private singleton owner. Public/anon execution revoked, authenticated execution granted. |
| `public.marker_workspace` | `singleton boolean` primary key default true/CHECK singleton; `revision bigint` NOT NULL with revision >= 1; `document jsonb` NOT NULL with object type and serialized text size <= 4,500,000 bytes. |
| `owner_read` policy | Row-level security enabled; authenticated SELECT is granted and conditioned on the owner helper. Broad direct table privileges are revoked. |
| `public.marker_save(expected_revision bigint, next_document jsonb): void` | PL/pgSQL SECURITY DEFINER with empty search path; owner check, document version/revision/required-array checks, compare-and-swap insert or update, conflict error when no row is saved. Public/anon execution revoked, authenticated execution granted. |

The schema therefore does not create the D1 authentication tables, native one-time-code flow, Studio catalog, object storage or processing admission system. It has no Studio tables. Its document size constraint differs from D1's 1 MiB aggregate cap. These alternatives must not be treated as equivalent deployed backends.

No claim is made that this preparation was applied, that RLS was exercised against a live service, or that it can be enabled by changing only one environment variable. A change proposal that replaces native D1/auth must address session identity, owner configuration, persistence, migration/custody, frontend auth contracts and Studio integration explicitly.
