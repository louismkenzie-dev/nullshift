-- Email verification codes (replaces magic-link flow)
-- Codes are 6 digits, expire after 15 minutes, single-use.

create table if not exists email_verifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  code        text not null,
  expires_at  timestamptz not null,
  used        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Index for fast lookup by user
create index if not exists email_verifications_user_idx on email_verifications(user_id);

-- RLS: only service role can read/write (all access via API routes using service client)
alter table email_verifications enable row level security;
