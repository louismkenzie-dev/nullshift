-- 0010_rls_user_metadata_fix
-- Security fix (Supabase advisor, CRITICAL): the legacy project_updates RLS
-- policies resolved the caller's email from `auth.jwt() -> 'user_metadata'`,
-- which is end-user-editable via the client SDK — a privilege-escalation hole
-- (a signed-in client could set user_metadata.email to another client's address
-- and read/update their rows). Rewrite both policies to trust ONLY the verified
-- top-level JWT email claim via auth.email(). No behavioural change for honest
-- users; the editable metadata branch is removed entirely.
-- Idempotent: safe to re-run; no-op if the table/policies are absent.

do $$
begin
  if to_regclass('public.project_updates') is null then
    return;
  end if;

  alter policy client_read_own_updates on public.project_updates
    using (
      client_id in (
        select id from public.clients
        where lower(email) = lower((select auth.email()))
      )
    );

  alter policy client_update_choice on public.project_updates
    using (
      client_id in (
        select id from public.clients
        where lower(email) = lower((select auth.email()))
      )
    )
    with check (
      client_id in (
        select id from public.clients
        where lower(email) = lower((select auth.email()))
      )
    );
end $$;
