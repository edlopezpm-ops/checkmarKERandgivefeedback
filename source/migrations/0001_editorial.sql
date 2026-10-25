-- Prepared migration only. Apply after environment/owner approval; no owner is seeded.
begin;
create schema if not exists marker_private;
revoke all on schema marker_private from public, anon, authenticated;
create table marker_private.owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id)
);
-- Operator must configure exactly one existing Auth user explicitly, outside source control.
create function public.marker_is_owner() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from marker_private.owner where user_id = (select auth.uid())); $$;
revoke all on function public.marker_is_owner() from public, anon;
grant execute on function public.marker_is_owner() to authenticated;

create table public.marker_workspace (
  singleton boolean primary key default true check (singleton),
  revision bigint not null check (revision >= 1),
  document jsonb not null check (jsonb_typeof(document) = 'object' and octet_length(document::text) <= 4500000)
);
alter table public.marker_workspace enable row level security;
revoke all on public.marker_workspace from public, anon, authenticated;
grant select on public.marker_workspace to authenticated;
create policy owner_read on public.marker_workspace for select to authenticated using ((select public.marker_is_owner()));

create function public.marker_save(expected_revision bigint, next_document jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare saved_revision bigint;
begin
  if not public.marker_is_owner() then raise insufficient_privilege; end if;
  if expected_revision is null or expected_revision < 0
    or (next_document->>'version')::int is distinct from 1
    or (next_document->>'revision')::bigint is distinct from expected_revision + 1
    or jsonb_typeof(next_document->'products') is distinct from 'array'
    or jsonb_typeof(next_document->'accounts') is distinct from 'array'
    or jsonb_typeof(next_document->'sources') is distinct from 'array'
    or jsonb_typeof(next_document->'campaigns') is distinct from 'array'
    or jsonb_typeof(next_document->'posts') is distinct from 'array'
    then raise check_violation; end if;
  if expected_revision = 0 then
    insert into public.marker_workspace(singleton, revision, document)
      values (true, 1, next_document) on conflict do nothing returning revision into saved_revision;
  else
    update public.marker_workspace set document = next_document, revision = expected_revision + 1
      where singleton = true and revision = expected_revision returning revision into saved_revision;
  end if;
  if saved_revision is null then raise sqlstate '23505' using message = 'Revision conflict'; end if;
end; $$;
revoke all on function public.marker_save(bigint, jsonb) from public, anon;
grant execute on function public.marker_save(bigint, jsonb) to authenticated;
commit;
