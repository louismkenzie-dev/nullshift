-- ============================================================================
-- Phase 7 — Deliverables document/asset store (brief §5/§6). A private Supabase
-- Storage bucket whose objects are tenant-scoped by RLS: object paths are
-- `<tenant_id>/<...>`, so a client only ever reaches their own tenant's files;
-- staff reach all. Uploads are staff-only; the `documents` table (0001) is the
-- version-controlled index over these objects.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('deliverables', 'deliverables', false)
on conflict (id) do nothing;

-- A client reads objects whose first path segment is a tenant they belong to;
-- staff read everything in the bucket.
drop policy if exists deliverables_select on storage.objects;
create policy deliverables_select on storage.objects for select to authenticated
  using (
    bucket_id = 'deliverables'
    and (
      is_internal_staff()
      or is_member_of(((storage.foldername(name))[1])::uuid)
    )
  );

-- Only staff upload / manage deliverables.
drop policy if exists deliverables_write_staff on storage.objects;
create policy deliverables_write_staff on storage.objects for all to authenticated
  using (bucket_id = 'deliverables' and is_internal_staff())
  with check (bucket_id = 'deliverables' and is_internal_staff());
