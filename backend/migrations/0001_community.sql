-- Atlas Van — espace communautaire « Partage » : schéma, contraintes, déclencheurs, fonctions.
-- Cible : PostgreSQL 15+ tel que fourni par Supabase (schéma auth, rôles anon / authenticated / service_role).
-- Les règles d'accès (RLS) sont dans backend/policies/0001_rls.sql, à appliquer juste après ce fichier.
--
-- Principes :
--   - le contenu du blog du propriétaire n'est PAS ici (il vit dans content/, dans Git) : cette base ne peut pas le modifier ;
--   - tout ce qu'un visiteur envoie est vérifié par la base elle-même (types, longueurs, balises, coordonnées, statuts),
--     quoi que fasse le navigateur ;
--   - un utilisateur ne peut écrire que ses propres lignes ; le rôle de modérateur vient de app_metadata (posé côté serveur,
--     jamais par l'utilisateur), jamais d'une adresse e-mail ;
--   - aucune adresse e-mail n'est stockée dans les tables publiques.

begin;

-- ───────────── Outils ─────────────

-- Rôle de modérateur : lu dans le jeton signé par le serveur d'authentification, champ app_metadata (non modifiable par l'utilisateur).
create or replace function public.is_moderator() returns boolean
language sql stable set search_path = public, pg_temp as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'moderator'
$$;

-- Texte simple : ni balise HTML, ni caractère de contrôle. Le texte est de toute façon affiché comme du texte (textContent).
create or replace function public.plain_text(t text) returns boolean
language sql immutable set search_path = public, pg_temp as $$
  select t is null or (t !~ '<[[:space:]]*[A-Za-z/!?]' and t !~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]')
$$;

create or replace function public.slugify(t text) returns text
language sql immutable set search_path = public, pg_temp as $$
  select coalesce(nullif(left(trim(both '-' from regexp_replace(translate(lower(t), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿœæ', 'aaaaaaceeeeiiiinooooouuuuyyoa'), '[^a-z0-9]+', '-', 'g')), 60), ''), 'contribution')
$$;

-- Position publiable : en Europe et arrondie au centième de degré (environ 1 km) au plus fin.
create or replace function public.coarse_position(lat numeric, lon numeric) returns boolean
language sql immutable set search_path = public, pg_temp as $$
  select (lat is null and lon is null) or (lat between 34 and 72 and lon between -25 and 45 and lat = round(lat, 2) and lon = round(lon, 2))
$$;

-- ───────────── Profils ─────────────
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  pseudo      text not null check (char_length(pseudo) between 3 and 30 and pseudo = btrim(pseudo) and pseudo ~ '^[[:alnum:]][[:alnum:] _.''-]*$' and public.plain_text(pseudo)),
  bio         text check (char_length(bio) <= 300 and public.plain_text(bio)),
  avatar_path text check (avatar_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  created_at  timestamptz not null default now(),
  -- 0 : nouveau compte, ses contributions attendent une validation ; 1 : contributions publiées directement ; 2 : réservé
  trust_level smallint not null default 0 check (trust_level between 0 and 2),
  suspended_at timestamptz,
  suspended_reason text check (char_length(suspended_reason) <= 300)
);
create unique index profiles_pseudo_unique on public.profiles (lower(pseudo));

-- ───────────── Contributions ─────────────
create table public.community_items (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  author_pseudo text not null default '',
  type          text not null check (type in ('circuit', 'spot', 'astuce', 'technique', 'retour')),
  status        text not null default 'pending' check (status in ('draft', 'pending', 'published', 'hidden', 'rejected')),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  title         text not null check (char_length(btrim(title)) between 5 and 120 and public.plain_text(title)),
  summary       text not null check (char_length(btrim(summary)) between 10 and 400 and public.plain_text(summary)),
  body          text not null default '' check (char_length(body) <= 20000 and public.plain_text(body)),
  country       text check (char_length(country) <= 60 and public.plain_text(country)),
  region        text check (char_length(region) <= 80 and public.plain_text(region)),
  category      text check (category in ('itineraire', 'bivouac', 'aire', 'camping', 'eau-vidange', 'point-de-vue', 'nature', 'patrimoine', 'ville', 'cuisine', 'energie', 'mecanique', 'amenagement', 'administratif', 'budget', 'securite', 'autre')),
  seasons       text[] not null default '{}' check (seasons <@ array['printemps', 'ete', 'automne', 'hiver']::text[] and cardinality(seasons) <= 4),
  difficulty    text check (difficulty in ('facile', 'moyen', 'difficile')),
  -- Circuit
  distance_km   integer check (distance_km between 0 and 20000),
  days_done     smallint check (days_done between 1 and 365),       -- durée réellement effectuée
  days_suggested smallint check (days_suggested between 1 and 365), -- durée conseillée
  vehicle       text check (char_length(vehicle) <= 120 and public.plain_text(vehicle)),
  hard_parts    text check (char_length(hard_parts) <= 2000 and public.plain_text(hard_parts)),   -- difficultés
  roads_avoid   text check (char_length(roads_avoid) <= 2000 and public.plain_text(roads_avoid)), -- routes déconseillées
  -- Spot (position approximative) ; pour un circuit : point de départ, pour le tri par distance
  lat           numeric(6, 2),
  lon           numeric(6, 2),
  spot_kind     text check (spot_kind in ('bivouac', 'aire', 'camping', 'parking', 'point-de-vue', 'eau', 'vidange', 'autre')),
  night_spot    boolean not null default false,
  last_verified date check (last_verified between date '2000-01-01' and current_date + 1),
  source_url    text check (char_length(source_url) between 12 and 300 and source_url ~ '^https://[^[:space:]<>"''\\]+$' and source_url !~* 'javascript:'),
  useful_count  integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  published_at  timestamptz,
  constraint position_coarse check (public.coarse_position(lat, lon)),
  constraint spot_has_position check (type <> 'spot' or (lat is not null and lon is not null)),
  constraint night_only_spot check (not night_spot or type = 'spot')
);
create index community_items_list on public.community_items (status, published_at desc);
create index community_items_owner on public.community_items (owner_id, created_at desc);

create table public.community_route_stops (
  item_id   uuid not null references public.community_items (id) on delete cascade,
  position  smallint not null check (position between 1 and 60),
  name      text not null check (char_length(btrim(name)) between 1 and 120 and public.plain_text(name)),
  place_id  integer check (place_id >= 0),             -- lieu de l'Atlas, s'il y en a un
  lat       numeric(6, 2),
  lon       numeric(6, 2),
  nights    smallint check (nights between 0 and 60),
  note      text check (char_length(note) <= 500 and public.plain_text(note)),
  primary key (item_id, position),
  constraint stop_position_coarse check (public.coarse_position(lat, lon))
);

create table public.community_bookmarks (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  item_id    uuid not null references public.community_items (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create table public.community_reactions (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  item_id    uuid not null references public.community_items (id) on delete cascade,
  kind       text not null default 'useful' check (kind in ('useful')),
  created_at timestamptz not null default now(),
  primary key (user_id, item_id, kind)
);

create table public.community_reports (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.community_items (id) on delete cascade,
  reporter_id uuid references public.profiles (id) on delete set null,
  reason      text not null check (reason in ('spam', 'dangereux', 'illegal', 'vie-privee', 'faux', 'offensant', 'autre')),
  details     text check (char_length(details) <= 500 and public.plain_text(details)),
  status      text not null default 'open' check (status in ('open', 'closed')),
  created_at  timestamptz not null default now(),
  unique (item_id, reporter_id)
);

-- Journal de modération : qui a fait quoi, quand, pourquoi. Écrit seulement par les fonctions de modération.
create table public.moderation_log (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),
  actor_id  uuid,            -- modérateur (null : action automatique)
  item_id   uuid,            -- pas de clé étrangère : le journal survit à la suppression d'une contribution
  user_id   uuid,
  action    text not null check (action in ('publish', 'hide', 'reject', 'pending', 'auto_pending', 'suspend', 'unsuspend', 'trust', 'close_report')),
  reason    text check (char_length(reason) <= 300)
);

-- Médias (photos) d'une contribution : fichiers du compartiment privé « community-media », chemin « <uid>/<uuid>.<ext> ».
create table public.community_media (
  id        uuid primary key default gen_random_uuid(),
  item_id   uuid not null references public.community_items (id) on delete cascade,
  owner_id  uuid not null references public.profiles (id) on delete cascade,
  path      text not null unique check (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  alt       text not null default '' check (char_length(alt) <= 300 and public.plain_text(alt)),
  width     smallint check (width between 1 and 4000),
  height    smallint check (height between 1 and 4000),
  position  smallint not null default 1 check (position between 1 and 8),
  created_at timestamptz not null default now()
);

-- ───────────── Déclencheurs ─────────────

-- Son propre profil complet (niveau de confiance, suspension), pour les déclencheurs qui s'exécutent avec les droits du visiteur.
create or replace function public.own_profile_row() returns setof public.profiles
language sql stable security definer set search_path = public, pg_temp as $$
  select * from public.profiles where id = auth.uid()
$$;

-- Garde des contributions : champs calculés, propriétaire, statuts autorisés, limites de débit.
-- Les contrôles d'autorisation ne s'appliquent qu'aux rôles des visiteurs (anon, authenticated) ; les fonctions de
-- modération (SECURITY DEFINER) et le rôle de service passent outre, après leurs propres contrôles.
create or replace function public.community_items_guard() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare
  me uuid := auth.uid();
  p public.profiles%rowtype;
  wanted text := new.status;
begin
  -- Un visiteur ne lit que son propre profil (niveau de confiance, suspension) ; les fonctions de modération lisent celui de l'auteur.
  if current_user in ('anon', 'authenticated') then
    if me is null or new.owner_id is distinct from me then raise exception 'not_owner' using errcode = '42501'; end if;
    select * into p from public.own_profile_row();
  else
    select * into p from public.profiles where id = new.owner_id;
  end if;
  if p.id is null then raise exception 'profile_required' using errcode = '23503'; end if;
  new.author_pseudo := p.pseudo;
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.id := coalesce(new.id, gen_random_uuid());
    new.slug := public.slugify(new.title) || '-' || left(replace(new.id::text, '-', ''), 8);
    new.created_at := now(); new.useful_count := 0; new.published_at := null;
  else
    new.id := old.id; new.slug := old.slug; new.created_at := old.created_at; new.published_at := old.published_at;
    -- Le compteur « utile » n'est écrit que par la base (déclencheur des réactions).
    if current_user in ('anon', 'authenticated') then new.useful_count := old.useful_count; end if;
  end if;

  if current_user in ('anon', 'authenticated') then
    if me is null or new.owner_id is distinct from me then raise exception 'not_owner' using errcode = '42501'; end if;
    if p.suspended_at is not null then raise exception 'suspended' using errcode = '42501'; end if;
    if tg_op = 'UPDATE' then
      if old.owner_id <> new.owner_id or old.type <> new.type then raise exception 'protected_field' using errcode = '42501'; end if;
      if old.status in ('hidden', 'rejected') then raise exception 'moderated' using errcode = '42501'; end if;
    else
      -- Limites de débit : 5 contributions par heure, 20 par jour.
      if (select count(*) from public.community_items where owner_id = me and created_at > now() - interval '1 hour') >= 5
        or (select count(*) from public.community_items where owner_id = me and created_at > now() - interval '1 day') >= 20 then
        raise exception 'rate_limit' using errcode = '54000';
      end if;
    end if;
    -- Statut : l'auteur peut garder un brouillon, soumettre, ou retirer (« draft »). Publier, masquer, refuser : modération.
    if wanted = 'draft' then
      new.status := 'draft';
    elsif wanted = 'pending' or (wanted = 'published' and tg_op = 'UPDATE' and old.status = 'published') then
      -- Nouveau compte : validation avant publication ; compte de confiance : publication directe.
      new.status := case when p.trust_level >= 1 then 'published' else 'pending' end;
    else
      raise exception 'status_forbidden' using errcode = '42501';
    end if;
  end if;
  if new.status = 'published' and new.published_at is null then new.published_at := now(); end if;
  return new;
end $$;
create trigger community_items_guard before insert or update on public.community_items for each row execute function public.community_items_guard();

-- Étapes d'un circuit : un nouveau compte ne peut pas changer celles d'un circuit déjà publié sans repasser par la validation.
create or replace function public.community_stops_guard() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare v_owner uuid; v_type text; v_status text; trust smallint;
begin
  if current_user in ('anon', 'authenticated') then
    select owner_id, type, status into v_owner, v_type, v_status from public.community_items where id = coalesce(new.item_id, old.item_id);
    if v_owner is null or v_owner is distinct from auth.uid() then raise exception 'not_owner' using errcode = '42501'; end if;
    if v_type <> 'circuit' then raise exception 'not_a_circuit' using errcode = '22023'; end if;
    select trust_level into trust from public.own_profile_row();
    if v_status = 'published' and trust < 1 then raise exception 'resubmit_required' using errcode = '42501'; end if;
    if v_status in ('hidden', 'rejected') then raise exception 'moderated' using errcode = '42501'; end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger community_stops_guard before insert or update or delete on public.community_route_stops for each row execute function public.community_stops_guard();

-- Compteurs (« utile », signalements) : tenus par la base, jamais écrits par le visiteur.
create or replace function public.community_reaction_count() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.community_items set useful_count = (select count(*) from public.community_reactions r where r.item_id = coalesce(new.item_id, old.item_id) and r.kind = 'useful')
   where id = coalesce(new.item_id, old.item_id);
  return null;
end $$;
create trigger community_reaction_count after insert or delete on public.community_reactions for each row execute function public.community_reaction_count();

create or replace function public.community_report_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer;
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.community_reports where reporter_id = new.reporter_id and created_at > now() - interval '1 day') >= 20 then
      raise exception 'rate_limit' using errcode = '54000';
    end if;
  end if;
  return new;
end $$;
create trigger community_report_guard before insert on public.community_reports for each row execute function public.community_report_guard();

-- Trois signalements ouverts : la contribution est retirée de l'affichage public en attendant un modérateur.
create or replace function public.community_report_count() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer;
begin
  select count(*) into n from public.community_reports where item_id = new.item_id and status = 'open';
  if n >= 3 and (select status from public.community_items where id = new.item_id) = 'published' then
    update public.community_items set status = 'pending' where id = new.item_id;
    insert into public.moderation_log (item_id, action, reason) values (new.item_id, 'auto_pending', n || ' signalements');
  end if;
  return null;
end $$;
create trigger community_report_count after insert on public.community_reports for each row execute function public.community_report_count();

-- Garde des médias : chemin dans le dossier de l'auteur, contribution de l'auteur.
create or replace function public.community_media_guard() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.owner_id is distinct from auth.uid() or split_part(new.path, '/', 1) <> auth.uid()::text
      or not exists (select 1 from public.community_items where id = new.item_id and owner_id = auth.uid() and status not in ('hidden', 'rejected')) then
      raise exception 'not_owner' using errcode = '42501';
    end if;
    if (select count(*) from public.community_media where item_id = new.item_id) >= 8 then raise exception 'too_many_media' using errcode = '54000'; end if;
  end if;
  return new;
end $$;
create trigger community_media_guard before insert or update on public.community_media for each row execute function public.community_media_guard();

-- ───────────── Fonctions appelées par le site (API) ─────────────
-- SECURITY INVOKER (par défaut) : la fonction s'exécute avec les droits de l'appelant, RLS comprise.

-- Colonnes publiques d'une contribution (sans compteur de signalements).
create or replace function public.item_json(i public.community_items) returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select jsonb_build_object('id', i.id, 'slug', i.slug, 'type', i.type, 'status', i.status, 'title', i.title, 'summary', i.summary, 'body', i.body,
    'country', i.country, 'region', i.region, 'category', i.category, 'seasons', to_jsonb(i.seasons), 'difficulty', i.difficulty,
    'distance_km', i.distance_km, 'days_done', i.days_done, 'days_suggested', i.days_suggested, 'vehicle', i.vehicle, 'hard_parts', i.hard_parts, 'roads_avoid', i.roads_avoid,
    'lat', i.lat, 'lon', i.lon, 'spot_kind', i.spot_kind, 'night_spot', i.night_spot, 'last_verified', i.last_verified, 'source_url', i.source_url,
    'useful_count', i.useful_count, 'author', jsonb_build_object('id', i.owner_id, 'pseudo', i.author_pseudo),
    'created_at', i.created_at, 'updated_at', i.updated_at, 'published_at', i.published_at)
$$;

-- Liste publique : contributions publiées seulement, filtres, tri, pagination (50 au plus par page).
create or replace function public.list_items(q text default null, p_type text default null, p_country text default null, p_region text default null,
  p_season text default null, p_category text default null, p_difficulty text default null, p_sort text default 'recent',
  p_near_lat numeric default null, p_near_lon numeric default null, p_limit integer default 20, p_offset integer default 0)
returns jsonb language sql stable set search_path = public, pg_temp as $$
  with f as (
    select i as it, i.useful_count as useful, i.published_at as at, i.id as iid,
      case when p_near_lat is not null and p_near_lon is not null and i.lat is not null
        then sqrt(power((i.lat - p_near_lat) * 111.2, 2) + power((i.lon - p_near_lon) * 111.2 * cos(radians(p_near_lat)), 2)) end as km
    from public.community_items i, lateral (select nullif(replace(replace(left(btrim(q), 80), '%', ''), '_', ''), '') as needle) n
    where i.status = 'published'
      and (n.needle is null or i.title ilike '%' || n.needle || '%' or i.summary ilike '%' || n.needle || '%' or i.country ilike '%' || n.needle || '%' or i.region ilike '%' || n.needle || '%')
      and (p_type is null or i.type = p_type) and (p_country is null or i.country = p_country) and (p_region is null or i.region ilike p_region)
      and (p_season is null or p_season = any (i.seasons)) and (p_category is null or i.category = p_category) and (p_difficulty is null or i.difficulty = p_difficulty)
  ), page as (
    select f.*, row_number() over (order by case when p_sort = 'useful' then f.useful end desc nulls last, case when p_sort = 'distance' then f.km end asc nulls last, f.at desc, f.iid) as ord
    from f order by ord limit least(greatest(coalesce(p_limit, 20), 1), 50) offset greatest(coalesce(p_offset, 0), 0)
  )
  select jsonb_build_object('total', (select count(*) from f),
    'items', coalesce((select jsonb_agg(public.item_json(page.it) || jsonb_build_object('km', round(page.km)) order by page.ord) from page), '[]'::jsonb))
$$;

-- Favori et « utile » posés par l'appelant sur une contribution (faux pour un visiteur anonyme). Ne lit que ses propres lignes.
create or replace function public.my_marks(p_item uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('bookmarked', exists (select 1 from public.community_bookmarks b where b.item_id = p_item and b.user_id = auth.uid()),
                            'useful', exists (select 1 from public.community_reactions r where r.item_id = p_item and r.user_id = auth.uid()))
$$;

-- Une contribution (publiée, ou à soi, ou pour un modérateur), avec ses étapes et ses photos.
create or replace function public.get_item(p_slug text) returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select public.item_json(i) || jsonb_build_object(
    'stops', coalesce((select jsonb_agg(jsonb_build_object('position', s.position, 'name', s.name, 'place_id', s.place_id, 'lat', s.lat, 'lon', s.lon, 'nights', s.nights, 'note', s.note) order by s.position)
                       from public.community_route_stops s where s.item_id = i.id), '[]'::jsonb),
    'media', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'path', m.path, 'alt', m.alt, 'width', m.width, 'height', m.height) order by m.position) from public.community_media m where m.item_id = i.id), '[]'::jsonb),
    'mine', coalesce(i.owner_id = auth.uid(), false)) || public.my_marks(i.id)
  from public.community_items i where i.slug = p_slug
$$;

-- Créer ou modifier sa contribution, étapes comprises, en une seule transaction. Seuls les champs listés sont lus.
create or replace function public.save_item(p jsonb) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare
  me uuid := auth.uid();
  r record;
  s jsonb; n integer := 0;
  v_seasons text[];
begin
  if me is null then raise exception 'auth_required' using errcode = '42501'; end if;
  if jsonb_typeof(p) <> 'object' then raise exception 'invalid' using errcode = '22023'; end if;
  select coalesce(array_agg(x), '{}') into v_seasons from jsonb_array_elements_text(coalesce(p -> 'seasons', '[]'::jsonb)) x;
  if p ? 'id' and p ->> 'id' is not null then
    update public.community_items set
      status = coalesce(p ->> 'status', 'pending'), title = p ->> 'title', summary = p ->> 'summary', body = coalesce(p ->> 'body', ''),
      country = p ->> 'country', region = p ->> 'region', category = p ->> 'category', seasons = v_seasons, difficulty = p ->> 'difficulty',
      distance_km = (p ->> 'distance_km')::integer, days_done = (p ->> 'days_done')::smallint, days_suggested = (p ->> 'days_suggested')::smallint,
      vehicle = p ->> 'vehicle', hard_parts = p ->> 'hard_parts', roads_avoid = p ->> 'roads_avoid',
      lat = round((p ->> 'lat')::numeric, 2), lon = round((p ->> 'lon')::numeric, 2), spot_kind = p ->> 'spot_kind', night_spot = coalesce((p ->> 'night_spot')::boolean, false),
      last_verified = (p ->> 'last_verified')::date, source_url = nullif(p ->> 'source_url', '')
    where id = (p ->> 'id')::uuid and owner_id = me
    returning id, slug, status, type into r;
    if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  else
    insert into public.community_items (owner_id, type, status, title, summary, body, country, region, category, seasons, difficulty, distance_km, days_done, days_suggested,
      vehicle, hard_parts, roads_avoid, lat, lon, spot_kind, night_spot, last_verified, source_url)
    values (me, p ->> 'type', coalesce(p ->> 'status', 'pending'), p ->> 'title', p ->> 'summary', coalesce(p ->> 'body', ''), p ->> 'country', p ->> 'region', p ->> 'category', v_seasons, p ->> 'difficulty',
      (p ->> 'distance_km')::integer, (p ->> 'days_done')::smallint, (p ->> 'days_suggested')::smallint, p ->> 'vehicle', p ->> 'hard_parts', p ->> 'roads_avoid',
      round((p ->> 'lat')::numeric, 2), round((p ->> 'lon')::numeric, 2), p ->> 'spot_kind', coalesce((p ->> 'night_spot')::boolean, false), (p ->> 'last_verified')::date, nullif(p ->> 'source_url', ''))
    returning id, slug, status, type into r;
  end if;
  if r.type = 'circuit' and p ? 'stops' then
    if jsonb_typeof(p -> 'stops') <> 'array' or jsonb_array_length(p -> 'stops') > 60 then raise exception 'too_many_stops' using errcode = '22023'; end if;
    delete from public.community_route_stops where item_id = r.id;
    for s in select * from jsonb_array_elements(p -> 'stops') loop
      n := n + 1;
      insert into public.community_route_stops (item_id, position, name, place_id, lat, lon, nights, note)
      values (r.id, n, s ->> 'name', (s ->> 'place_id')::integer, round((s ->> 'lat')::numeric, 2), round((s ->> 'lon')::numeric, 2), (s ->> 'nights')::smallint, s ->> 'note');
    end loop;
    if r.status <> 'draft' and n < 2 then raise exception 'circuit_needs_two_stops' using errcode = '22023'; end if;
  end if;
  return jsonb_build_object('id', r.id, 'slug', r.slug, 'status', r.status);
end $$;

create or replace function public.my_items() returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(public.item_json(i) order by i.updated_at desc), '[]'::jsonb) from public.community_items i where i.owner_id = auth.uid()
$$;

create or replace function public.my_bookmarks() returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(public.item_json(i) order by b.created_at desc), '[]'::jsonb)
  from public.community_bookmarks b join public.community_items i on i.id = b.item_id where b.user_id = auth.uid()
$$;

create or replace function public.set_bookmark(p_item uuid, p_on boolean) returns boolean
language plpgsql set search_path = public, pg_temp as $$
begin
  if p_on then insert into public.community_bookmarks (user_id, item_id) values (auth.uid(), p_item) on conflict do nothing;
  else delete from public.community_bookmarks where user_id = auth.uid() and item_id = p_item; end if;
  return p_on;
end $$;

create or replace function public.set_useful(p_item uuid, p_on boolean) returns integer
language plpgsql set search_path = public, pg_temp as $$
begin
  if p_on then insert into public.community_reactions (user_id, item_id, kind) values (auth.uid(), p_item, 'useful') on conflict do nothing;
  else delete from public.community_reactions where user_id = auth.uid() and item_id = p_item and kind = 'useful'; end if;
  return (select useful_count from public.community_items where id = p_item);
end $$;

create or replace function public.report_item(p_item uuid, p_reason text, p_details text default null) returns boolean
language plpgsql set search_path = public, pg_temp as $$
begin
  insert into public.community_reports (item_id, reporter_id, reason, details) values (p_item, auth.uid(), p_reason, nullif(p_details, ''));
  return true;
exception when unique_violation then return false;   -- déjà signalé par cette personne
end $$;

create or replace function public.delete_item(p_item uuid) returns boolean
language plpgsql set search_path = public, pg_temp as $$
begin
  delete from public.community_items where id = p_item and owner_id = auth.uid();
  return found;
end $$;

-- Profil : pseudo et présentation seulement ; jamais l'e-mail.
create or replace function public.save_profile(p_pseudo text, p_bio text default null) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'auth_required' using errcode = '42501'; end if;
  insert into public.profiles (id, pseudo, bio) values (auth.uid(), btrim(p_pseudo), nullif(btrim(p_bio), ''))
  on conflict (id) do update set pseudo = excluded.pseudo, bio = excluded.bio;
  return public.my_profile();
end $$;

-- Son propre profil, état de modération compris (lisible par soi seul).
create or replace function public.my_profile() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('id', p.id, 'pseudo', p.pseudo, 'bio', p.bio, 'created_at', p.created_at, 'trust_level', p.trust_level, 'suspended', p.suspended_at is not null,
    'moderator', public.is_moderator(),
    'contributions', (select count(*) from public.community_items i where i.owner_id = p.id and i.status = 'published'))
  from public.profiles p where p.id = auth.uid()
$$;

-- Profil public d'un auteur : pseudo, date d'inscription, contributions publiées.
create or replace function public.public_profile(p_id uuid) returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select jsonb_build_object('id', p.id, 'pseudo', p.pseudo, 'bio', p.bio, 'created_at', p.created_at,
    'items', coalesce((select jsonb_agg(public.item_json(i) order by i.published_at desc) from public.community_items i where i.owner_id = p.id and i.status = 'published'), '[]'::jsonb))
  from public.profiles p where p.id = p_id
$$;

-- RGPD : toutes ses données, en une fois.
create or replace function public.export_my_data() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('exported_at', now(), 'account', (select jsonb_build_object('id', u.id, 'email', u.email, 'created_at', u.created_at) from auth.users u where u.id = auth.uid()),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'items', coalesce((select jsonb_agg(public.item_json(i) || jsonb_build_object('stops', (select coalesce(jsonb_agg(to_jsonb(s) order by s.position), '[]'::jsonb) from public.community_route_stops s where s.item_id = i.id)))
                       from public.community_items i where i.owner_id = auth.uid()), '[]'::jsonb),
    'media', coalesce((select jsonb_agg(to_jsonb(m)) from public.community_media m where m.owner_id = auth.uid()), '[]'::jsonb),
    'bookmarks', coalesce((select jsonb_agg(to_jsonb(b)) from public.community_bookmarks b where b.user_id = auth.uid()), '[]'::jsonb),
    'reactions', coalesce((select jsonb_agg(to_jsonb(r)) from public.community_reactions r where r.user_id = auth.uid()), '[]'::jsonb),
    'reports', coalesce((select jsonb_agg(jsonb_build_object('item_id', r.item_id, 'reason', r.reason, 'details', r.details, 'created_at', r.created_at)) from public.community_reports r where r.reporter_id = auth.uid()), '[]'::jsonb))
  where auth.uid() is not null
$$;

-- RGPD : suppression du compte. Profil, contributions, étapes, favoris, réactions et médias (lignes) partent avec lui ;
-- ses signalements restent, anonymisés. Les fichiers de photos sont à retirer du stockage (voir backend/README.md).
create or replace function public.delete_my_account() returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'auth_required' using errcode = '42501'; end if;
  delete from auth.users where id = me;
  return true;
end $$;

-- ───────────── Modération (modérateurs seulement, contrôle dans chaque fonction) ─────────────
create or replace function public.require_moderator() returns void
language plpgsql stable set search_path = public, pg_temp as $$
begin
  if not public.is_moderator() then raise exception 'moderator_only' using errcode = '42501'; end if;
end $$;

create or replace function public.moderation_queue(p_status text default 'pending') returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.require_moderator();
  return coalesce((select jsonb_agg(public.item_json(i) || jsonb_build_object('report_count', (select count(*) from public.community_reports r where r.item_id = i.id and r.status = 'open'),
      'reports', (select coalesce(jsonb_agg(jsonb_build_object('reason', r.reason, 'details', r.details, 'created_at', r.created_at, 'status', r.status) order by r.created_at), '[]'::jsonb) from public.community_reports r where r.item_id = i.id),
      'author_trust', (select trust_level from public.profiles where id = i.owner_id), 'author_suspended', (select suspended_at is not null from public.profiles where id = i.owner_id)) order by i.updated_at)
    from public.community_items i where (p_status = 'reported' and exists (select 1 from public.community_reports r where r.item_id = i.id and r.status = 'open')) or i.status = p_status), '[]'::jsonb);
end $$;

create or replace function public.moderate_item(p_item uuid, p_status text, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare owner uuid; published integer;
begin
  perform public.require_moderator();
  if p_status not in ('published', 'hidden', 'rejected', 'pending') then raise exception 'invalid_status' using errcode = '22023'; end if;
  update public.community_items set status = p_status where id = p_item returning owner_id into owner;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_status in ('published', 'hidden', 'rejected') then update public.community_reports set status = 'closed' where item_id = p_item and status = 'open'; end if;
  insert into public.moderation_log (actor_id, item_id, user_id, action, reason)
  values (auth.uid(), p_item, owner, case p_status when 'published' then 'publish' when 'hidden' then 'hide' when 'rejected' then 'reject' else 'pending' end, left(p_reason, 300));
  -- Trois contributions validées : le compte passe en confiance (ses contributions suivantes paraissent directement).
  if p_status = 'published' then
    select count(*) into published from public.community_items where owner_id = owner and status = 'published';
    if published >= 3 then
      update public.profiles set trust_level = 1 where id = owner and trust_level = 0;
      if found then insert into public.moderation_log (actor_id, user_id, action, reason) values (auth.uid(), owner, 'trust', 'automatique : 3 contributions validées'); end if;
    end if;
  end if;
  return jsonb_build_object('id', p_item, 'status', p_status);
end $$;

create or replace function public.suspend_user(p_user uuid, p_on boolean, p_reason text default null) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.require_moderator();
  update public.profiles set suspended_at = case when p_on then now() end, suspended_reason = case when p_on then left(p_reason, 300) end,
    trust_level = case when p_on then 0 else trust_level end where id = p_user;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  -- Compte suspendu : ses contributions publiées sont retirées de l'affichage, en attente.
  if p_on then update public.community_items set status = 'pending' where owner_id = p_user and status = 'published'; end if;
  insert into public.moderation_log (actor_id, user_id, action, reason) values (auth.uid(), p_user, case when p_on then 'suspend' else 'unsuspend' end, left(p_reason, 300));
  return p_on;
end $$;

create or replace function public.set_trust(p_user uuid, p_level smallint) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.require_moderator();
  update public.profiles set trust_level = p_level where id = p_user;
  insert into public.moderation_log (actor_id, user_id, action, reason) values (auth.uid(), p_user, 'trust', 'niveau ' || p_level);
  return found;
end $$;

create or replace function public.moderation_history(p_limit integer default 100) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.require_moderator();
  return coalesce((select jsonb_agg(to_jsonb(l) order by l.at desc) from (select * from public.moderation_log order by at desc limit least(p_limit, 500)) l), '[]'::jsonb);
end $$;

commit;
