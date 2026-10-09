-- STATUS: APPLIED to Nullshift Ops (cweftpoaojwzllzficgt) on 2026-10-09 as social_scheduler.
--
-- 0071 — Social post scheduler (Instagram first) for Nullshift's own marketing.
--
-- Admin redesign, marketing follow-on. Additive only: nothing here touches
-- client tables, billing or delivery. The scheduler lives at /admin/social.
--
--   1. `social_accounts` — one row per connected social account
--      (@nullshift.dev on Instagram to begin with). Holds NO token material.
--   2. `social_account_secrets` — the encrypted long-lived access token for
--      an account. RLS enabled with NO policies: only the service role can
--      read or write it. The application encrypts with AES-256-GCM
--      (SOCIAL_TOKEN_ENCRYPTION_KEY, see apps/web/lib/social/crypto.ts)
--      before the row is written, so even the service role sees ciphertext.
--   3. `social_posts` — the content calendar. Status runs
--        draft → approved → scheduled → publishing → published
--                                              ↘ failed | needs_manual
--      The cron publisher only ever picks up `scheduled` rows whose
--      scheduled_at has passed, and a row can only become `scheduled` from
--      `approved` (the application enforces it; the trigger below refuses a
--      `scheduled` row that was never approved). When no connected account
--      with a usable token exists the publisher parks the post as
--      `needs_manual` and emails Louis the caption + media links so it can
--      be posted by hand and then marked published.
--   4. Storage bucket `social-media` (public read): the media a post links
--      to. Instagram's content-publishing API fetches media from a public
--      URL, so the bucket must be public; uploads go through the service
--      role after the staff guard.
--
-- RLS: staff-only (is_internal_staff()) on social_accounts and social_posts;
-- service role for the cron publisher, the OAuth callback and uploads.
--
-- Rollback:
--   drop table if exists public.social_posts;
--   drop table if exists public.social_account_secrets;
--   drop table if exists public.social_accounts;
--   drop policy if exists social_media_public_read on storage.objects;
--   delete from storage.buckets where id = 'social-media';

-- ============================================================================
-- social_accounts
-- ============================================================================

create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('instagram', 'facebook', 'linkedin')),
  -- e.g. 'nullshift.dev' (no @)
  handle text not null,
  -- Instagram: the IG User id used in /{ig-user-id}/media.
  external_user_id text not null,
  -- Instagram: the Facebook Page the professional account is linked to.
  page_id text,
  display_name text,
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz not null default now(),
  -- Long-lived token expiry (kept here, not the token, so the page can say
  -- "expires in N days" without touching the secrets table).
  expires_at timestamptz,
  status text not null default 'connected'
    check (status in ('connected', 'expired', 'revoked', 'error')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.social_accounts is
  'Connected social accounts for Nullshift marketing (0071). Token material lives in social_account_secrets, never here.';

-- One CONNECTED row per platform + external user; revoked rows keep history.
create unique index if not exists social_accounts_one_connected
  on public.social_accounts (platform, external_user_id)
  where status = 'connected';

drop trigger if exists trg_social_accounts_updated on public.social_accounts;
create trigger trg_social_accounts_updated
  before update on public.social_accounts
  for each row execute function public.set_updated_at();

alter table public.social_accounts enable row level security;

drop policy if exists social_accounts_staff on public.social_accounts;
create policy social_accounts_staff on public.social_accounts
  for all to authenticated
  using (public.is_internal_staff())
  with check (public.is_internal_staff());

-- ============================================================================
-- social_account_secrets — service role only
-- ============================================================================

create table if not exists public.social_account_secrets (
  account_id uuid primary key references public.social_accounts(id) on delete cascade,
  -- AES-256-GCM, base64url. The auth tag covers the ciphertext and the
  -- associated data (the account id), so a ciphertext copied from one
  -- account row to another fails to decrypt.
  access_token_ciphertext text not null,
  iv text not null,
  tag text not null,
  updated_at timestamptz not null default now()
);

comment on table public.social_account_secrets is
  'Encrypted social access tokens (0071). RLS on, NO policies: service role only. Ciphertext at rest.';

alter table public.social_account_secrets enable row level security;

revoke all on public.social_account_secrets from anon, authenticated;

-- ============================================================================
-- social_posts
-- ============================================================================

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.social_accounts(id) on delete set null,
  kind text not null check (kind in ('feed', 'reel', 'story', 'carousel')),
  caption text not null default '',
  -- [{url, type: 'image' | 'video', alt?}]
  media jsonb not null default '[]'::jsonb,
  first_comment text,
  scheduled_at timestamptz,
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'scheduled', 'publishing', 'published', 'failed', 'needs_manual')),
  published_external_id text,
  published_at timestamptz,
  error text,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  -- Content pillar tag (e.g. 'proof', 'process', 'offer', 'founder').
  pillar text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint social_posts_media_is_array check (jsonb_typeof(media) = 'array'),
  constraint social_posts_scheduled_needs_time
    check (status not in ('scheduled', 'publishing') or scheduled_at is not null),
  constraint social_posts_scheduled_was_approved
    check (status not in ('scheduled', 'publishing', 'published') or approved_at is not null)
);

comment on table public.social_posts is
  'Social content calendar (0071). Only approved → scheduled rows are ever published; the cron never touches a draft.';

create index if not exists social_posts_status_scheduled_idx
  on public.social_posts (status, scheduled_at);
create index if not exists social_posts_scheduled_idx
  on public.social_posts (scheduled_at desc);

drop trigger if exists trg_social_posts_updated on public.social_posts;
create trigger trg_social_posts_updated
  before update on public.social_posts
  for each row execute function public.set_updated_at();

alter table public.social_posts enable row level security;

drop policy if exists social_posts_staff on public.social_posts;
create policy social_posts_staff on public.social_posts
  for all to authenticated
  using (public.is_internal_staff())
  with check (public.is_internal_staff());

-- ============================================================================
-- Storage: social-media (public read)
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('social-media', 'social-media', true)
on conflict (id) do nothing;

-- Anyone may read (Instagram fetches media from the public URL). Writes go
-- through the service role after the staff guard; no insert/update/delete
-- policies for authenticated or anon.
drop policy if exists social_media_public_read on storage.objects;
create policy social_media_public_read on storage.objects for select
  using (bucket_id = 'social-media');
