-- Link a Supabase auth user to a client record so the client can log in
-- to the portal with their own account while retaining all their existing
-- ticket/proposal/call data. The column is nullable — clients without a
-- portal account simply have NULL here.

alter table clients
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

-- Index for fast lookup of a client record by their auth user id
-- (used when the client logs in to the portal to fetch their own data).
create index if not exists clients_auth_user_id_idx on clients(auth_user_id);
