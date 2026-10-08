import type { Client } from "@/lib/ops/clientsData";
import type { TodayData } from "@/lib/ops/todayData";
import type { QuickClient } from "@/app/admin/(dashboard)/Rail";

/**
 * Fictional data for the admin design preview (/admin-preview, env-gated).
 * Nothing here is a real client; the point is to put every state the shell
 * can show on one screen without a database.
 */

export const CLIENTS: QuickClient[] = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Example Tennis Club", status: "active" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Harbour Dance Studio", status: "active" },
  { id: "33333333-3333-4333-8333-333333333333", name: "Northfield Counselling", status: "active" },
  { id: "44444444-4444-4444-8444-444444444444", name: "Oakridge Garden Centre", status: "prospect" },
  { id: "55555555-5555-4555-8555-555555555555", name: "Pennine Climbing", status: "prospect" },
];

export const TODAY: TodayData = {
  asOf: "Wed 8 Oct 2026 · 09:12",
  freshness: "live rows · folded at 09:12",
  clientCount: 5,
  truncated: false,
  metrics: {
    contractedMonthlyGbp: 580,
    contractedLegacyGbp: 340,
    contractedNewGbp: 240,
    outstandingGbp: 2150,
    overdueGbp: 850,
    scheduledNext30Gbp: 580,
    awaitingMandateGbp: 160,
    projectsNeedingAction: 3,
  },
  attention: [
    {
      clientId: CLIENTS[0].id,
      client: "Example Tennis Club",
      problem: "Direct Debit link sent, mandate not authorised",
      consequence: "£160/mo plan is not collecting",
      owner: "Louis",
      due: "today",
      dueAt: "2026-10-08",
      action: "Re-send link",
      href: `/admin/clients/${CLIENTS[0].id}/care-plan`,
      kind: "finance",
      priority: 1,
    },
    {
      clientId: CLIENTS[1].id,
      client: "Harbour Dance Studio",
      problem: "Invoice INV-0042 is 12 days overdue",
      consequence: "£850 outstanding; build milestone two blocked",
      owner: "Chris",
      due: "overdue",
      dueAt: "2026-09-26",
      action: "Chase",
      href: `/admin/clients/${CLIENTS[1].id}/billing`,
      kind: "overdue",
      priority: 2,
    },
    {
      clientId: CLIENTS[2].id,
      client: "Northfield Counselling",
      problem: "Proposal follow-up awaiting signature",
      consequence: "Add-on build cannot start",
      owner: "Louis",
      due: "Fri 10 Oct",
      dueAt: "2026-10-10",
      action: "Open",
      href: `/admin/clients/${CLIENTS[2].id}/sign`,
      kind: "contract",
      priority: 3,
    },
    {
      clientId: CLIENTS[3].id,
      client: "Oakridge Garden Centre",
      problem: "Discovery call booked, brief not written",
      consequence: "No quote can be built",
      owner: "Louis",
      due: "Mon 13 Oct",
      dueAt: "2026-10-13",
      action: "Write brief",
      href: `/admin/clients/${CLIENTS[3].id}`,
      kind: "deadline",
      priority: 4,
    },
  ],
  week: [
    { when: "Thu", at: "2026-10-09", what: "Harbour Dance — collection £180", kind: "collection", href: "/admin/finance" },
    { when: "Fri", at: "2026-10-10", what: "Northfield — signature due", kind: "contract", href: "/admin/agreements" },
    { when: "Mon", at: "2026-10-13", what: "Oakridge — discovery call 13:00", kind: "deadline", href: "/admin/calendar" },
  ],
  exceptions: [
    { text: "Proposal draft awaiting second-person approval", tone: "approval", href: "/admin/agreements" },
    { text: "GoCardless webhook not seen for 3 days", tone: "exception", href: "/admin/finance/exceptions" },
  ],
};

export const CLIENT: Client = {
  id: CLIENTS[0].id,
  legalName: "Example Tennis Club",
  tradingName: "Example Tennis",
  ref: "NS-0007",
  owner: "Louis",
  model: "new",
  facets: {
    relationship: "active",
    agreement: { state: "accepted", evidence: "Order Form OF-2026-0004 accepted 19 Aug" },
    billing: { state: "setup pending", evidence: "Direct Debit link sent, mandate not authorised" },
    delivery: { state: "live", evidence: "Live since 19 Aug · app.exampletennis.test" },
    route: { state: "managed", evidence: "Max plan, £160/mo, package pending" },
    health: { state: "healthy", evidence: "No open incident", freshness: "checked 08:50" },
  },
  nextAction: {
    text: "Re-send the Direct Debit link",
    owner: "Louis",
    due: "today",
    consequence: "Plan agreed 3 Sep is not collecting",
  },
  build: {
    priceGbp: 2000,
    milestones: [
      { label: "Build — deposit", amountGbp: 1000, paidGbp: 1000, state: "paid", due: "19 Aug" },
      { label: "Build — completion", amountGbp: 1000, paidGbp: 1000, state: "paid", due: "2 Sep" },
      { label: "Rising Stars add-on", amountGbp: 986, paidGbp: 0, state: "scheduled", due: "on signature" },
    ],
  },
  run: {
    state: "setup pending",
    packageName: "Max",
    monthlyGbp: 160,
    contractualStart: "1 Oct 2026",
    mandate: "pending",
    provider: "GoCardless",
    termsVersion: "CARE_TERMS_2026_09_v1",
    note: "Nothing is collected until the mandate is authorised.",
  },
  systems: [
    { name: "Parent hub + coach app", arrangement: "Managed · Max" },
    { name: "Public site", arrangement: "Independent · client-hosted" },
  ],
  checklist: [
    { label: "Mandate authorised", owner: "Client", state: "awaiting client", source: "subscriptions.status", due: "today" },
    { label: "Care plan terms accepted", owner: "Client", state: "complete", source: "tenants.care_plan_terms_accepted_at", evidence: "3 Sep" },
    { label: "System passport filled", owner: "Nullshift", state: "in progress", source: "system_profiles", evidence: "repo + hosting set, runbook missing" },
    { label: "Add-on signed", owner: "Client", state: "not started", source: "signature_requests", due: "10 Oct" },
  ],
  contacts: [
    { name: "Olivia Sutton", role: "Head of Performance", email: "olivia@exampletennis.test" },
    { name: "Sam Reid", role: "Treasurer", email: "sam@exampletennis.test" },
  ],
  history: [
    { at: "07 Oct 21:14", text: "E-signature SR-2026-0001 drafted" },
    { at: "03 Sep 08:34", text: "Care plan terms accepted · Max" },
    { at: "02 Sep 09:10", text: "Build completion invoice paid" },
    { at: "19 Aug 12:18", text: "Project went live" },
  ],
  flags: ["Direct Debit not authorised"],
};
