-- 0043 (was 0031 on the local ops branch): close the project-updates bucket hole (audit HIGH-adjacent finding).
-- Legacy 009 let ANY authenticated user — i.e. any self-signed-up portal
-- client — upload to and delete from the bucket that hosts progress
-- screenshots. Writes and deletes are now staff-only. Public READ stays:
-- existing project_updates rows embed public URLs, and the images are
-- progress screenshots deliberately shared with clients.

drop policy if exists "admin_upload_update_images" on storage.objects;
create policy "admin_upload_update_images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'project-updates' and public.is_internal_staff());

drop policy if exists "admin_delete_update_images" on storage.objects;
create policy "admin_delete_update_images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'project-updates' and public.is_internal_staff());
