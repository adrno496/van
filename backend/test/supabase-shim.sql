-- TESTS SEULEMENT — ne jamais appliquer à un projet Supabase (qui fournit déjà tout ceci).
-- Reproduit le strict nécessaire de l'environnement Supabase pour exécuter les migrations et éprouver la RLS sur un
-- PostgreSQL local (PGlite) : rôles anon / authenticated / service_role, schéma auth (users, uid(), jwt(), role()).
-- Comme PostgREST, une requête « d'utilisateur » s'exécute après SET ROLE authenticated (ou anon) et
-- set_config('request.jwt.claims', '<jeton décodé>', true).

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
end $$;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  encrypted_password text,
  raw_app_meta_data jsonb not null default '{}'::jsonb,   -- posé par le serveur seulement (rôle de modérateur)
  raw_user_meta_data jsonb not null default '{}'::jsonb,  -- modifiable par l'utilisateur : jamais utilisé pour un droit
  created_at timestamptz not null default now()
);
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', 'anon')
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.jwt(), auth.uid(), auth.role() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
-- Comme Supabase : privilèges larges par défaut sur le schéma public (la migration les reprend table par table).
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
