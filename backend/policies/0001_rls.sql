-- Atlas Van — « Partage » : droits et règles d'accès ligne par ligne (Row Level Security).
-- À appliquer après backend/migrations/0001_community.sql.
--
-- Défense en profondeur :
--   1. privilèges : tout est retiré aux rôles anon et authenticated, puis rendu colonne par colonne ou fonction par fonction ;
--   2. RLS activée ET forcée sur chaque table : une requête ne voit et ne touche que les lignes que la règle autorise ;
--   3. déclencheurs (fichier de migration) : propriétaire, statuts, champs protégés, débit.
-- Rappel : la clé « service_role » contourne la RLS. Elle ne doit exister que côté serveur (jamais dans le site).

begin;

-- ───────────── Privilèges ─────────────
revoke all on public.profiles, public.community_items, public.community_route_stops, public.community_bookmarks, public.community_reactions,
  public.community_reports, public.moderation_log, public.community_media from anon, authenticated, public;

-- Lecture publique : profils sans niveau de confiance ni suspension ; contributions entières (RLS : publiées, ou les siennes).
grant select (id, pseudo, bio, avatar_path, created_at) on public.profiles to anon, authenticated;
grant select on public.community_items, public.community_route_stops, public.community_media to anon, authenticated;

-- Écriture : seulement les champs qu'un auteur peut fixer ; le reste est calculé par la base.
grant insert (id, pseudo, bio) on public.profiles to authenticated;
grant update (pseudo, bio, avatar_path) on public.profiles to authenticated;
grant insert (owner_id, type, status, title, summary, body, country, region, category, seasons, difficulty, distance_km, days_done, days_suggested, vehicle, hard_parts, roads_avoid,
  lat, lon, spot_kind, night_spot, last_verified, source_url) on public.community_items to authenticated;
grant update (status, title, summary, body, country, region, category, seasons, difficulty, distance_km, days_done, days_suggested, vehicle, hard_parts, roads_avoid,
  lat, lon, spot_kind, night_spot, last_verified, source_url) on public.community_items to authenticated;
grant delete on public.community_items to authenticated;
grant insert, update, delete on public.community_route_stops to authenticated;
grant select, insert, delete on public.community_bookmarks to authenticated;
grant select, insert, delete on public.community_reactions to authenticated;
grant select (id, item_id, reporter_id, reason, details, status, created_at) on public.community_reports to authenticated;
grant insert (item_id, reporter_id, reason, details) on public.community_reports to authenticated;
grant insert (item_id, owner_id, path, alt, width, height, position) on public.community_media to authenticated;
grant update (alt, position) on public.community_media to authenticated;
grant delete on public.community_media to authenticated;
-- moderation_log : aucun privilège direct ; lu et écrit par les fonctions de modération seulement.

-- Fonctions : Supabase donne EXECUTE à tous par défaut. On retire, puis on rend ce qui sert.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.list_items(text, text, text, text, text, text, text, text, numeric, numeric, integer, integer), public.get_item(text), public.public_profile(uuid), public.my_marks(uuid),
  public.item_json(public.community_items), public.is_moderator(), public.plain_text(text), public.slugify(text), public.coarse_position(numeric, numeric) to anon, authenticated;
grant execute on function public.save_item(jsonb), public.my_items(), public.my_bookmarks(), public.set_bookmark(uuid, boolean), public.set_useful(uuid, boolean),
  public.report_item(uuid, text, text), public.delete_item(uuid), public.save_profile(text, text), public.my_profile(), public.export_my_data(), public.delete_my_account(),
  public.require_moderator(), public.moderation_queue(text), public.moderate_item(uuid, text, text), public.suspend_user(uuid, boolean, text), public.set_trust(uuid, smallint),
  public.moderation_history(integer), public.own_profile_row() to authenticated;
-- Fonctions de déclencheur : jamais appelables directement.
revoke execute on function public.community_items_guard(), public.community_stops_guard(), public.community_reaction_count(), public.community_report_guard(),
  public.community_report_count(), public.community_media_guard() from public, anon, authenticated;

-- ───────────── RLS ─────────────
-- Activée sur chaque table. Pas de FORCE : le propriétaire des tables (postgres) est celui des fonctions de modération
-- SECURITY DEFINER, qui font leurs propres contrôles (require_moderator) avant d'écrire.
alter table public.profiles enable row level security;
alter table public.community_items enable row level security;
alter table public.community_route_stops enable row level security;
alter table public.community_bookmarks enable row level security;
alter table public.community_reactions enable row level security;
alter table public.community_reports enable row level security;
alter table public.moderation_log enable row level security;
alter table public.community_media enable row level security;

-- Profils : lisibles par tous (colonnes publiques) ; chacun crée et modifie le sien.
create policy profiles_read on public.profiles for select to anon, authenticated using (true);
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Contributions : publiées pour tous ; les siennes quel que soit leur statut ; tout pour un modérateur (lecture).
create policy items_read on public.community_items for select to anon, authenticated
  using (status = 'published' or owner_id = auth.uid() or public.is_moderator());
create policy items_insert on public.community_items for insert to authenticated
  with check (owner_id = auth.uid());
create policy items_update on public.community_items for update to authenticated
  using (owner_id = auth.uid() and status not in ('hidden', 'rejected')) with check (owner_id = auth.uid());
create policy items_delete on public.community_items for delete to authenticated using (owner_id = auth.uid());

-- Étapes et médias : suivent leur contribution.
create policy stops_read on public.community_route_stops for select to anon, authenticated
  using (exists (select 1 from public.community_items i where i.id = item_id and (i.status = 'published' or i.owner_id = auth.uid() or public.is_moderator())));
create policy stops_write on public.community_route_stops for all to authenticated
  using (exists (select 1 from public.community_items i where i.id = item_id and i.owner_id = auth.uid()))
  with check (exists (select 1 from public.community_items i where i.id = item_id and i.owner_id = auth.uid()));
create policy media_read on public.community_media for select to anon, authenticated
  using (exists (select 1 from public.community_items i where i.id = item_id and (i.status = 'published' or i.owner_id = auth.uid() or public.is_moderator())));
create policy media_write on public.community_media for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Favoris et « utile » : chacun les siens, seulement sur ce qu'il peut voir ; pas de « utile » sur sa propre contribution.
create policy bookmarks_own on public.community_bookmarks for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.community_items i where i.id = item_id and (i.status = 'published' or i.owner_id = auth.uid())));
create policy reactions_own on public.community_reactions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.community_items i where i.id = item_id and i.status = 'published' and i.owner_id <> auth.uid()));

-- Signalements : sur une contribution publiée, au nom de soi ; lisibles par leur auteur et les modérateurs.
create policy reports_insert on public.community_reports for insert to authenticated
  with check (reporter_id = auth.uid() and exists (select 1 from public.community_items i where i.id = item_id and i.status = 'published'));
create policy reports_read on public.community_reports for select to authenticated using (reporter_id = auth.uid() or public.is_moderator());

-- Journal de modération : aucune règle pour les visiteurs (aucune ligne visible) ; les fonctions SECURITY DEFINER y écrivent.

commit;

-- ───────────── Stockage des photos (Supabase Storage) ─────────────
-- Compartiment privé « community-media » : 5 Mo par fichier, JPEG / PNG / WebP seulement (réglages du compartiment,
-- à créer dans la console ou par l'API : public = false, file_size_limit = 5242880, allowed_mime_types = image/jpeg, image/png, image/webp).
-- Chaque utilisateur écrit dans son dossier « <uid>/ » ; la lecture passe par une URL signée tant que la contribution n'est pas publiée.
-- Ces règles portent sur storage.objects (schéma fourni par Supabase) : à appliquer dans un projet Supabase, pas dans les tests locaux.
--
-- create policy media_upload on storage.objects for insert to authenticated
--   with check (bucket_id = 'community-media' and (storage.foldername(name))[1] = auth.uid()::text and lower(storage.extension(name)) in ('jpg', 'png', 'webp'));
-- create policy media_delete on storage.objects for delete to authenticated
--   using (bucket_id = 'community-media' and (storage.foldername(name))[1] = auth.uid()::text);
-- create policy media_read on storage.objects for select to anon, authenticated
--   using (bucket_id = 'community-media' and exists (select 1 from public.community_media m join public.community_items i on i.id = m.item_id
--          where m.path = name and (i.status = 'published' or i.owner_id = auth.uid() or public.is_moderator())));
