-- 0039_build_cockpit.sql
-- The build cockpit: batches stop being fix-only and become the single vehicle
-- for handing ANY compiled work to Claude Code — client-reported issues, cached
-- module prompts from a reusable library, and SOC 2 exception remediations —
-- plus AI-drafted build plans that turn a human-written build goal into a
-- structured, chronological work order.
-- Apply AFTER 0038. Paste into the Supabase SQL editor or apply via MCP.

-- ============================================================
-- 1) MODULE LIBRARY — pre-planned build prompts, written once,
--    compiled into any batch. Global rows (project_id null) are
--    the house library; pinned rows belong to one system.
-- ============================================================

create table if not exists public.build_modules (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,           -- stable slug, e.g. 'stripe-billing'
  title       text not null,
  summary     text not null,                  -- one-liner shown in pickers + fed to the planner
  prompt      text not null,                  -- the cached build prompt body
  category    text,                           -- loose grouping: foundation / billing / portal / ...
  project_id  uuid references public.projects(id) on delete cascade, -- null = global library
  active      boolean not null default true,  -- retired modules stay for provenance, hidden from pickers
  sort        int not null default 100,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists build_modules_project_idx on public.build_modules (project_id);
create index if not exists build_modules_active_idx on public.build_modules (active);

alter table public.build_modules enable row level security;
drop policy if exists build_modules_staff_all on public.build_modules;
create policy build_modules_staff_all on public.build_modules
  for all to authenticated
  using (public.is_internal_staff()) with check (public.is_internal_staff());

drop trigger if exists trg_build_modules_updated on public.build_modules;
create trigger trg_build_modules_updated
  before update on public.build_modules
  for each row execute function public.set_updated_at();

-- ============================================================
-- 2) BATCH PROVENANCE JOINS — what went into a batch, beyond
--    issues (which already carry batch_id). Both tables snapshot
--    the human-readable identity so history survives edits.
-- ============================================================

create table if not exists public.fix_batch_modules (
  batch_id    uuid not null references public.fix_batches(id) on delete cascade,
  module_id   uuid references public.build_modules(id) on delete set null,
  module_key  text not null,                  -- snapshot: survives module deletion
  title       text not null,                  -- snapshot: survives module renames
  position    int not null default 0,
  created_at  timestamptz not null default now(),
  primary key (batch_id, module_key)
);

create index if not exists fix_batch_modules_module_idx on public.fix_batch_modules (module_id);

alter table public.fix_batch_modules enable row level security;
drop policy if exists fix_batch_modules_staff_all on public.fix_batch_modules;
create policy fix_batch_modules_staff_all on public.fix_batch_modules
  for all to authenticated
  using (public.is_internal_staff()) with check (public.is_internal_staff());

create table if not exists public.fix_batch_exceptions (
  batch_id      uuid not null references public.fix_batches(id) on delete cascade,
  exception_id  uuid not null references public.soc2_exceptions(id) on delete restrict,
  exception_ref text not null,                -- snapshot, e.g. 'EXC-2026-0007'
  created_at    timestamptz not null default now(),
  primary key (batch_id, exception_id)
);

create index if not exists fix_batch_exceptions_exception_idx on public.fix_batch_exceptions (exception_id);

alter table public.fix_batch_exceptions enable row level security;
-- Reads: any internal staff. Writes: queueing an exception is a PROGRAMME act,
-- so the DB itself demands a live soc2_programme_roles row and an internal-
-- tenant batch — the app-layer requireSoc2 gate is mirrored, not trusted.
drop policy if exists fix_batch_exceptions_staff_all on public.fix_batch_exceptions;
drop policy if exists fix_batch_exceptions_select on public.fix_batch_exceptions;
drop policy if exists fix_batch_exceptions_insert on public.fix_batch_exceptions;
create policy fix_batch_exceptions_select on public.fix_batch_exceptions
  for select to authenticated
  using (public.is_internal_staff());
create policy fix_batch_exceptions_insert on public.fix_batch_exceptions
  for insert to authenticated
  with check (
    public.is_internal_staff()
    and exists (
      select 1 from public.soc2_programme_roles r
      where r.user_email ilike coalesce(auth.jwt() ->> 'email', '')
        and (r.expires_at is null or r.expires_at > now())
        and r.role <> 'auditor'
    )
    and exists (
      select 1 from public.fix_batches b
      join public.tenants t on t.id = b.tenant_id
      where b.id = batch_id and t.type = 'internal'
    )
  );

-- ============================================================
-- 3) BUILD GOAL — the human-written blurb of what a system is
--    actually FOR. The AI build planner refuses to run without
--    one: a plan needs an intent, and intent comes from people.
-- ============================================================

alter table public.system_profiles
  add column if not exists build_goal text;

-- ============================================================
-- 4) BUILD PLANS — AI-drafted, human-reviewed, chronological
--    build programmes. A plan is a draft until a person hands
--    it off, at which point it becomes a compiled batch and
--    rides the existing dispatch transports.
-- ============================================================

create table if not exists public.build_plans (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  project_id  uuid not null references public.projects(id) on delete cascade,
  status      text not null default 'draft'
              check (status in ('draft','handed_off','archived')),
  goal        text not null,                  -- snapshot of the build goal the plan was drawn from
  guidance    text,                           -- optional human steering notes given to the planner
  model       text not null,                  -- which model drafted it
  plan        jsonb not null,                 -- structured: overview + chronological phases
  prompt      text not null,                  -- the compiled Claude Code work order
  module_keys text[] not null default '{}',   -- modules the planner was given
  batch_id    uuid references public.fix_batches(id) on delete set null,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists build_plans_project_idx on public.build_plans (project_id);
create index if not exists build_plans_tenant_idx on public.build_plans (tenant_id);
create index if not exists build_plans_batch_idx on public.build_plans (batch_id);
create index if not exists build_plans_status_idx on public.build_plans (status);

alter table public.build_plans enable row level security;
drop policy if exists build_plans_staff_all on public.build_plans;
create policy build_plans_staff_all on public.build_plans
  for all to authenticated
  using (public.is_internal_staff()) with check (public.is_internal_staff());

drop trigger if exists trg_build_plans_updated on public.build_plans;
create trigger trg_build_plans_updated
  before update on public.build_plans
  for each row execute function public.set_updated_at();

-- ============================================================
-- 5) THE PLATFORM IS A SYSTEM — Null Shift Ops itself becomes a
--    first-class project + passport under the internal tenant.
--    This is what lets SOC 2 exception remediations compile into
--    a batch (they target THIS repo), and puts the platform on
--    the same cockpit as every client system.
-- ============================================================

insert into public.projects (tenant_id, name, stage, live_url)
select t.id, 'Null Shift Ops', 'care', 'https://nullshift.co.uk'
from public.tenants t
where t.type = 'internal'
  and not exists (
    select 1 from public.projects p
    where p.tenant_id = t.id and p.name = 'Null Shift Ops'
  );

insert into public.system_profiles
  (project_id, tenant_id, repo_full_name, default_branch, vercel_project,
   supabase_ref, stack, health, build_goal)
select p.id, p.tenant_id, 'louismkenzie-dev/nullshift', 'main', 'nullshift',
  'cweftpoaojwzllzficgt',
  '{"framework":"nextjs","db":"supabase","ai":"anthropic"}'::jsonb, 'ok',
  'The operations platform Null Shift itself runs on: client systems fleet, '
  || 'issue bank, fix batches dispatched to Claude Code, billing, legal spine, '
  || 'AI workspace, and the SOC 2 readiness programme. Production deployments '
  || 'are mirrored into the change register by the deploy mirror. (Human: refine this goal.)'
from public.projects p
join public.tenants t on t.id = p.tenant_id
where t.type = 'internal' and p.name = 'Null Shift Ops'
  and not exists (
    select 1 from public.system_profiles sp where sp.project_id = p.id
  );

-- ============================================================
-- 6) STARTER MODULES — a small house library to make the picker
--    real on day one. Prompts are living documents: edit them in
--    /admin/modules; the batch snapshots whatever was current.
-- ============================================================

insert into public.build_modules (key, title, summary, prompt, category, sort)
select v.key, v.title, v.summary, v.prompt, v.category, v.sort
from (values
  ('auth-accounts', 'Auth & accounts', 'Supabase auth with sign-in, sign-up, password reset, and an RLS-backed profile row per user.',
$$Build the authentication and accounts foundation.

Requirements:
- Supabase auth (email + password): sign-in, sign-up, password reset request + recovery flows. Every response identical whether or not the email has an account (no enumeration).
- A `profiles` row per user (trigger on auth.users insert), RLS: owner read/write own row only.
- Auth middleware/guards for protected routes; signed-in users bounced away from auth pages.
- Sensible session handling per the framework's Supabase SSR guidance.

Done when: a new user can sign up, confirm, sign in, reset a forgotten password, and reach a protected page; RLS provably blocks reading another user's profile.$$,
   'foundation', 10),
  ('stripe-billing', 'Stripe billing', 'Stripe Checkout + customer portal + webhook-driven subscription state, with the DB as the source of truth.',
$$Build Stripe billing.

Requirements:
- Stripe Checkout for the defined plans; success/cancel routes that never trust the redirect alone.
- Webhook endpoint (signature-verified) handling checkout.session.completed, customer.subscription.updated/deleted, invoice.paid/payment_failed — idempotent on event id.
- A `subscriptions` table mirroring Stripe state (customer id, subscription id, plan, status, current_period_end); the app reads the DB, never live Stripe, on page loads.
- Customer portal link for self-serve management.
- No secret keys client-side; webhook secret + API key via env.

Done when: a test-mode subscription round-trips (subscribe → webhook → DB → UI shows active → cancel → UI shows cancelled) with webhook signature verification proven.$$,
   'billing', 20),
  ('client-portal', 'Client portal', 'An auth-gated portal where a client sees their own project status, updates, and requests — tenant-scoped by RLS.',
$$Build the client portal shell.

Requirements:
- Auth-gated /portal area: dashboard with project status, recent updates feed, and a request/issue submission form.
- Tenant scoping enforced by RLS (client sees only their tenant's rows) — prove it with a cross-tenant test.
- Submission form writes a request row (status 'new') visible to staff; client sees their own submissions and statuses.
- Empty states designed, not accidental.

Done when: two seeded clients each see exactly their own data; a submitted request appears for staff; direct URL access to another tenant's resource 404s.$$,
   'portal', 30),
  ('admin-dashboard', 'Admin dashboard', 'A staff-only admin area: overview stats, the core records list/detail, and guarded mutations with an audit trail.',
$$Build the staff admin area.

Requirements:
- /admin gated to staff (allowlist or role flag — server-side, not just UI).
- Overview page with the 3-5 numbers that matter for this system, plus list + detail pages for the core records.
- Mutations via server actions: guard first, then write; every mutation appends an audit_log row (actor, action, entity, metadata).
- Search/filter on the main list.

Done when: a non-staff session cannot reach /admin (server-enforced); each mutation shows up in the audit trail with the acting user.$$,
   'admin', 40),
  ('transactional-email', 'Transactional email', 'A single email layer (Resend or SMTP) with templated sends, per-purpose logging, and safe no-op when unconfigured.',
$$Build the transactional email layer.

Requirements:
- One `sendEmail({to, purpose, subject, html})` helper; provider (Resend preferred) behind an env key; unconfigured = logged no-op, never a crash.
- Templates for the system's core notifications; plain-text alternative part included.
- Every send logged (purpose, recipient, outcome) for audit; failures logged, never thrown into user flows.
- From-address + reply-to via env.

Done when: each notification renders correctly, sends in a configured environment, no-ops loudly in an unconfigured one, and appears in the send log.$$,
   'comms', 50)
) as v(key, title, summary, prompt, category, sort)
where not exists (select 1 from public.build_modules m where m.key = v.key);
