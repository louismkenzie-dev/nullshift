-- 0022: explicit ownership on every project (audit Phase 1.2). The brief's
-- rule: one person can hold several roles, but ownership must be named — a
-- partner should never have to ask WhatsApp "whose is this and what's next?".
-- Free-text names (the team is small; a role split arrives with Phase 4.5).

alter table public.projects
  add column if not exists account_owner text,
  add column if not exists delivery_owner text,
  add column if not exists technical_owner text,
  add column if not exists finance_owner text,
  add column if not exists next_action text,
  add column if not exists next_action_owner text;
