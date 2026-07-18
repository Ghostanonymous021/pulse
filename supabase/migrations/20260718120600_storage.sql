-- Pulse: storage buckets + path-scoped policies
-- Aligns with sections 11, 12.3, 12.4

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'avatars',
    'avatars',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'post-media',
    'post-media',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'project-images',
    'project-images',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do nothing;

-- Avatars: public read; write only under own folder
create policy "avatars_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'avatars');

create policy "avatars_owner_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_owner_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_owner_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Post media: authenticated read if post visible is enforced at app/query layer;
-- storage path must start with author user id for ownership.
create policy "post_media_authenticated_read"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'post-media');

create policy "post_media_owner_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "post_media_owner_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "project_images_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'project-images');

create policy "project_images_owner_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'project-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "project_images_owner_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'project-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
