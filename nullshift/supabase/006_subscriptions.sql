-- Subscription tiers matching the pricing page
create type subscription_tier as enum ('core', 'grow', 'pro', 'partner');
create type subscription_status as enum ('active', 'cancelled', 'past_due', 'trialing');

create table if not exists subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  tier          subscription_tier not null,
  status        subscription_status not null default 'active',
  started_at    timestamptz not null default now(),
  ends_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- One active subscription per user
create unique index subscriptions_active_user_idx
  on subscriptions(user_id)
  where status = 'active';

-- RLS: users can only read their own subscription
alter table subscriptions enable row level security;

create policy "Users read own subscription"
  on subscriptions for select
  using (auth.uid() = user_id);

-- Admins can manage all subscriptions via service role (bypasses RLS)
