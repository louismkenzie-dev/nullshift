# AI Workspace — Current-State Audit & Feature-Gap Matrix

**Date:** 2026-08-18 · **Scope:** extend Null Shift Ops with an administrator-only AI Workspace
(visual "AI office": agents, hierarchy, tasks, approvals, policies, runs, cost — humans accountable).

## 1. What already exists (and must not be rebuilt)

### AI that is already running in production

| Existing capability                                                                                                                                                                                   | Where                                                                | Workspace significance                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Client Consultation Agent** — researches a prospect online (web search/fetch), drafts a tailored plan + bespoke mockup, enriches the CRM                                                            | `packages/agents/*`, `/api/consult/[token]`                          | A real, active agent with logged runs (`agent_runs`). Becomes the first _real_ directory entry.                   |
| **Issue Classifier** — AI triage of new issues (kind/severity/billing)                                                                                                                                | `apps/web/lib/ops/classify.ts` via `lib/ops/claude.ts`               | Real agent; ran with **zero run logging** until this build (fixed in Phase 1).                                    |
| **Inbox Parser** — splits WhatsApp/Zoom/email text into draft issues, flags promises                                                                                                                  | `apps/web/lib/ops/ingest.ts`                                         | Real agent; same logging gap (fixed).                                                                             |
| **Fix Batch Runner** — Managed Agents session working a compiled fix batch in the client repo                                                                                                         | `apps/web/lib/ops/managedAgents.ts`, batch detail page               | Real remote-runtime agent. Its dispatch code is the seed of the runtime-adapter layer.                            |
| Three dispatch transports (GitHub issue → claude-code-action, Routine fire URL, Managed Agents session)                                                                                               | `lib/ops/{githubDispatch,routineDispatch,managedAgents}.ts`          | These _are_ provider adapters in embryo. The Workspace adapter boundary should wrap — not replace — them.         |
| `agent_runs` table + `logAgentRun()` writer                                                                                                                                                           | `supabase/019_agent_consultation.sql`, `packages/agents/src/runs.ts` | The runs/cost substrate already exists (written by consultation only; read by nothing). Reused as THE runs table. |
| `audit_log` (append-only, actor-stamped by DB trigger) + `logAudit()`                                                                                                                                 | migrations/0001, `packages/db/src/audit.ts`                          | The Workspace's config-change audit rides this unchanged.                                                         |
| Atomic claim pattern for dispatch (`status` compare-and-set before slow external call)                                                                                                                | batch actions                                                        | Same pattern reused for task/run claims.                                                                          |
| Admin shell: auth (proxy → layout `is_internal_staff` + MFA step-up → `requireStaff()` per action), AppKit (`PageHeader/Panel/StatCard/StatusChip`), board pattern, `SubmitButton`, audit conventions | see inventory                                                        | All Workspace pages follow these conventions; nothing new invented.                                               |
| `ops_settings` (service-role-only KV)                                                                                                                                                                 | migrations/0015                                                      | Holds Managed Agents ids today; future home for workspace budgets/settings.                                       |

### Relevant structural facts

- **No realtime plumbing exists** (no SSE/websocket/poller; managed-agent status is fetched at page render, 15s timeout, degrades to "unavailable"). One cron only (`weekly-pulse`).
- **No per-staff role model.** `memberships.role` is effectively boolean staff; `profiles` has no role/title. `ADMIN_EMAILS` is the transitional allowlist.
- **No graph/feed/chart component** anywhere; the office map is greenfield UI.
- **Migration numbering hazard:** two parallel series (`supabase/0NN_*.sql` legacy: 002–020 · `supabase/migrations/0NNN_*.sql`: 0001–0018). Workspace tables go in the `migrations/` series as `0019_ai_workspace.sql` — numeric near-collision with legacy `019_agent_consultation.sql` is noted and tolerated; the series are distinct.
- `/admin/tasks` (human Kanban) is orphaned from the nav; **`agent_tasks` is a separate concept** (work delegated to agents) and does not touch it.

## 2. Feature-gap matrix (brief requirement → status)

| Brief requirement                                           | Status                                                             | Disposition                                                                                                                              |
| ----------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| AI Workspace nav + staff-only access                        | **Missing**                                                        | Phase 1 — new nav group; gate = existing staff check (see role note)                                                                     |
| Agent directory / profile / departments / hierarchy         | **Missing**                                                        | Phase 1 — new tables `agent_departments`, `agents`, `agent_versions`                                                                     |
| Office overview (statuses, tasks, feed, health, spend)      | **Missing**                                                        | Phase 1 — reads new tables + existing `agent_runs`                                                                                       |
| Live office map (org graph, status nodes, side detail)      | **Missing**                                                        | Phase 1 — server-rendered tree (no graph dep); list alternative = directory                                                              |
| Task board + task detail (13 states)                        | **Missing**                                                        | Phase 1 (record + manual delegation as _records_); execution wiring Phase 4                                                              |
| Append-only activity ledger                                 | **Partial** (`audit_log` for config; nothing for agent activity)   | Phase 1 — `agent_events` append-only + overview feed                                                                                     |
| Run/cost records                                            | **Partial** (`agent_runs` written by consultation only)            | Phase 1 — extend with `agent_id`/`task_id`; wire classifier + inbox parser logging; backfill consultation rows                           |
| Roles (Workspace Admin / Supervisor / Operator / Observer)  | **Missing** (no role substrate at all)                             | Phase 1 ships staff-gated; role tiers land with the org-wide role split (pre-existing Phase 4.5 backlog item). Decision needed — see §5. |
| Approval inbox, risk tiers enforced, escalations            | **Missing**                                                        | Phase 2 (`agent_approvals`, `agent_escalations`, policy checks in server actions)                                                        |
| Rules/policy engine (structured, pre-execution)             | **Missing** (prompts only)                                         | Phase 2 — `agent_rulesets`/`agent_policy_bindings`; risk-tier columns land in Phase 1 schema so records carry tiers from day one         |
| Agent Studio (proposal → review → test → staged activation) | **Missing**                                                        | Phase 3                                                                                                                                  |
| Claude Code runtime adapter + normalised events + heartbeat | **Partial** (three transports exist, un-normalised, no heartbeat)  | Phase 4 — adapter interface wraps existing transports; `agent_events` is the normalised stream from day one                              |
| Routines page (schedules/triggers, idempotent)              | **Partial** (weekly-pulse cron; routine transport per batch)       | Phase 4 — `agent_routines` + cron ticker + idempotency keys                                                                              |
| Ops automations (CR triage, invoice watch, update drafts…)  | **Missing**                                                        | Phase 5                                                                                                                                  |
| Cost/usage/quality report + budgets                         | **Partial** (costs logged for consultation; no reader, no budgets) | Phase 1 ships spend read-out; budgets/alerts Phase 2/4                                                                                   |

## 3. Smallest safe migration path

1. **One additive migration** (`migrations/0019_ai_workspace.sql`): five new tables + two nullable FK columns on the existing `agent_runs`. No existing table altered destructively; no data rewritten; RLS staff-read everywhere, writes via staff policies (config) or service role (runtime).
2. **Backfill by UPDATE, not move:** existing `agent_runs` rows gain `agent_id` links via their `agent` text key (`consultation.*` → Client Consultation Agent). Zero rows deleted.
3. **Logging wire-in is additive:** `lib/ops/claude.ts` gains an optional `logAs` param; classifier/ingest pass it. No behaviour change on failure (best-effort, as today).
4. **UI is purely new routes** under `/admin/(dashboard)/ai/*` + one nav group. No existing page modified except `AdminNav.tsx` (one group added).
5. Real agents enter the directory as `active` **describing what already runs today** — no new autonomy is enabled by this phase. Brief-catalogue agents are seeded as `draft` (cannot run, per lifecycle).

## 4. Reconciliation decisions

- **`agent_runs` naming collision** (brief proposes a table of that name with different semantics): resolved by _extending_ the existing table — it already holds exactly the right columns (model, tokens, cost, duration, status, error). New nullable `agent_id`, `task_id` make it the brief's runs table without breaking the consultation writer.
- **"Employee" framing:** data model uses `agents` with `runtime`, `owner` (human), `manager_agent_id` — explicitly software agents; friendly naming lives only in UI copy.
- **Risk tiers** are stored per agent (`max_risk_tier`) and per task (`risk_tier`) from Phase 1 so history is tiered even before enforcement (Phase 2).

## 5. Configuration decisions needed from Null Shift (running list)

1. **Role split**: who is Workspace Administrator vs Supervisor vs Operator? Requires the org-wide role model (currently everyone is `staff`). Until then the Workspace is all-staff and _approval-type actions are deferred_ (Phase 2 blocks on this).
2. **Accountable owners** per agent (currently null on seeds; consultation/ops agents default to the founder).
3. **Budgets**: daily/monthly spend ceilings per agent and org-wide (Phase 2 enforcement; Phase 1 displays spend only).
4. **Approved runtimes** beyond the current three transports; whether Routines (research preview) remains approved.
5. **Test datasets** for Agent Studio test mode (Phase 3).
6. **`ANTHROPIC_WORKSPACE_SLUG`** should be added to `.env.example` + config schema (used by Managed Agents console links).
