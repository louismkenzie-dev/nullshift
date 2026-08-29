-- 0026: durable rate limiting (audit Phase 2.5). The only limiter was an
-- in-memory Map that reset on every serverless instance; public endpoints
-- (funnel, signup, verify-code) and the Opus-backed consult path were
-- unmetered. One atomic upsert per hit — no read-modify-write races.

create table if not exists public.rate_limits (
  key text primary key,
  count integer not null default 0,
  window_start timestamptz not null default now()
);

-- Service-role only: RLS on with no policies denies anon/authenticated.
alter table public.rate_limits enable row level security;

create or replace function public.rate_limit_hit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean;
begin
  insert into rate_limits as rl (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update
    set count = case
          when rl.window_start < now() - make_interval(secs => p_window_seconds)
            then 1
          else rl.count + 1
        end,
        window_start = case
          when rl.window_start < now() - make_interval(secs => p_window_seconds)
            then now()
          else rl.window_start
        end
  returning count <= p_limit into allowed;
  return allowed;
end;
$$;

revoke all on function public.rate_limit_hit(text, integer, integer) from public;
revoke all on function public.rate_limit_hit(text, integer, integer) from anon;
revoke all on function public.rate_limit_hit(text, integer, integer) from authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
