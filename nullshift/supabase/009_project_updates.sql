-- ============================================================
--  Migration 009: Project Updates + Project Phase
--  Run in Supabase SQL Editor
-- ============================================================

-- 1. Add project_phase to clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS project_phase text
  CHECK (project_phase IN ('discovery','design','development','review','live'));

-- 2. Project updates table
CREATE TABLE IF NOT EXISTS public.project_updates (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  type             text        NOT NULL DEFAULT 'update'
                               CHECK (type IN ('update','decision','branding')),
  title            text        NOT NULL,
  body             text,
  image_urls       text[]      NOT NULL DEFAULT '{}',
  requires_action  boolean     NOT NULL DEFAULT false,
  action_resolved  boolean     NOT NULL DEFAULT false,
  options          jsonb       NOT NULL DEFAULT '[]',  -- [{id,label,description?,image_url?}]
  client_choice    text                                -- chosen option id
);

CREATE INDEX IF NOT EXISTS idx_project_updates_client_id
  ON public.project_updates(client_id);
CREATE INDEX IF NOT EXISTS idx_project_updates_created_at
  ON public.project_updates(created_at DESC);

-- 3. RLS
ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;

-- Authenticated users (admin) can do everything via service role — existing pattern.
DROP POLICY IF EXISTS "auth all project_updates" ON public.project_updates;
CREATE POLICY "auth all project_updates"
  ON public.project_updates FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Portal clients can read their own updates.
-- The portal uses the service role key server-side, so this is belt-and-suspenders.
DROP POLICY IF EXISTS "client_read_own_updates" ON public.project_updates;
CREATE POLICY "client_read_own_updates"
  ON public.project_updates FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE lower(email) = lower(
        coalesce(
          auth.jwt() -> 'user_metadata' ->> 'email',
          auth.jwt() ->> 'email'
        )
      )
    )
  );

-- Portal clients can record their choice.
DROP POLICY IF EXISTS "client_update_choice" ON public.project_updates;
CREATE POLICY "client_update_choice"
  ON public.project_updates FOR UPDATE
  USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE lower(email) = lower(
        coalesce(
          auth.jwt() -> 'user_metadata' ->> 'email',
          auth.jwt() ->> 'email'
        )
      )
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients
      WHERE lower(email) = lower(
        coalesce(
          auth.jwt() -> 'user_metadata' ->> 'email',
          auth.jwt() ->> 'email'
        )
      )
    )
  );

-- 4. Storage bucket for update images
INSERT INTO storage.buckets (id, name, public)
  VALUES ('project-updates', 'project-updates', true)
  ON CONFLICT (id) DO NOTHING;

-- Authenticated users (admin) can upload
DROP POLICY IF EXISTS "admin_upload_update_images"  ON storage.objects;
CREATE POLICY "admin_upload_update_images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-updates');

-- Public can read images
DROP POLICY IF EXISTS "public_read_update_images" ON storage.objects;
CREATE POLICY "public_read_update_images"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'project-updates');

-- Authenticated users can delete their uploads
DROP POLICY IF EXISTS "admin_delete_update_images" ON storage.objects;
CREATE POLICY "admin_delete_update_images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'project-updates');
