-- 0021: brute-force cap for email verification codes. A 6-digit code with a
-- 15-minute TTL was guessable with unlimited attempts; verify-code now counts
-- failures and invalidates the code after 5.
-- (email_verifications itself is created by legacy supabase/008 — see
-- supabase/README.md for the two-series apply order.)

alter table public.email_verifications
  add column if not exists attempts integer not null default 0;
