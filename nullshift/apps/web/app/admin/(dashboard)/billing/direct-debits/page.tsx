import Link from "next/link";
import { createServiceClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { isGoCardlessConfigured } from "@nullshift/billing/gocardless";
import { T } from "@nullshift/ui/tokens";
import { PageHeader, Panel, StatCard, StatusChip } from "@/components/app/AppKit";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Reveal } from "@/components/kyma";
import { carePlan } from "@/lib/carePlans";
import { pricesFromAssessment } from "@/lib/pricing/contracted";
import type { AssessmentRow } from "@/lib/pricing/contractedPrice";
import { SCALE_BAND_LABEL } from "@/lib/pricing/nsi";
import { sendDirectDebitLink, sendPlanInvite, sendPortalLink } from "./actions";
import { planChoiceOpen } from "@/lib/planGate";

/**
 * Direct Debits — the board the owner runs recurring billing from.
 *
 * One row per client: the bracket (scale band) you set, the three prices that
 * bracket produces, whether the client can get into the portal, and where
 * their Direct Debit is. Three buttons cover the whole journey: get them in,
 * send them their options, or send the GoCardless link for a plan directly.
 * Everything routes through the same helpers as the client hub and the portal,
 * so the price on this screen is the price the client sees and is charged.
 */
export const dynamic = "force-dynamic";

const gbp = (n: number) => "£" + Math.round(n).toLocaleString("en-GB");
const dateGB = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

type Tenant = {
  id: string;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  care_plan_choice: string | null;
  care_plan_terms_accepted_at: string | null;
};
type Sub = {
  id: string;
  tenant_id: string;
  plan: string | null;
  mrr: number;
  status: string;
  provider: string | null;
  gc_mandate_id: string | null;
  gc_subscription_id: string | null;
  created_at: string;
};
type Membership = { tenant_id: string; user_id: string };
type Audit = { tenant_id: string | null; action: string; created_at: string };

const mono: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "0.68rem",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--k-muted)",
};
const cell: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: "0.84rem",
  color: "var(--k-fg)",
};
const inp: React.CSSProperties = {
  height: 30,
  background: "var(--k-bg)",
  border: "1px solid var(--k-border)",
  borderRadius: 0,
  padding: "0 8px",
  color: "var(--k-fg)",
  fontFamily: T.sans,
  fontSize: "0.8rem",
};
const btn = (bg: string, fg: string): React.CSSProperties => ({
  height: 30,
  padding: "0 12px",
  background: bg,
  color: fg,
  border: "1px solid var(--k-border)",
  borderRadius: 0,
  fontFamily: T.mono,
  fontSize: "0.66rem",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  cursor: "pointer",
  whiteSpace: "nowrap",
});

function railStatus() {
  const token = isGoCardlessConfigured();
  const secret = !!process.env.GOCARDLESS_WEBHOOK_SECRET;
  const live = process.env.GOCARDLESS_ENVIRONMENT === "live";
  if (!token || !secret)
    return { tone: "danger" as const, label: "Not configured", token, secret, live };
  return live
    ? { tone: "success" as const, label: "Live", token, secret, live }
    : { tone: "warning" as const, label: "Sandbox", token, secret, live };
}

export default async function DirectDebitsPage() {
  if (!(await requireStaff()).ok) return null;
  const service = createServiceClient();
  const rail = railStatus();

  const [
    { data: tenantsRaw },
    { data: subsRaw },
    { data: assessmentsRaw },
    { data: membershipsRaw },
    { data: projectsRaw },
    { data: paidRaw },
    { data: auditRaw },
    users,
    { data: evidenceRaw },
  ] = await Promise.all([
    service
      .from("tenants")
      .select(
        "id, name, contact_name, contact_email, care_plan_choice, care_plan_terms_accepted_at"
      )
      .eq("type", "client")
      .neq("status", "prospect")
      .order("name"),
    service
      .from("subscriptions")
      .select(
        "id, tenant_id, plan, mrr, status, provider, gc_mandate_id, gc_subscription_id, created_at"
      )
      .order("created_at", { ascending: false }),
    service
      .from("scale_assessments")
      .select(
        "id, tenant_id, plan, scale_band, multiplier, direct_cost_floor, recommended_mrr, override_mrr, agreed_mrr, enterprise_review_required, pricing_version, plan_prices, created_at"
      )
      .order("created_at", { ascending: false }),
    service.from("memberships").select("tenant_id, user_id").eq("role", "client_admin"),
    service.from("projects").select("tenant_id, proposal_status, stage"),
    service.from("invoices").select("tenant_id, amount").eq("status", "paid"),
    service
      .from("audit_log")
      .select("tenant_id, action, created_at")
      .in("action", [
        "portal.account_created",
        "portal.password_reset_sent",
        "care_plan.plan_invite_sent",
        "care_plan.dd_setup_sent",
        "care_plan.dd_started",
        "care_plan.dd_activated",
      ])
      .order("created_at", { ascending: false })
      .limit(500),
    service.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    service
      .from("scale_evidence")
      .select("tenant_id, provisional_nsi, provisional_band, field_states, collected_at")
      .order("collected_at", { ascending: false }),
  ]);
  // The newest auto-score per client — shown where there is no saved
  // assessment yet, so an unscored row says how close it is to scored.
  const latestScan = new Map<
    string,
    { nsi: number | null; band: string | null; pending: number; at: string }
  >();
  for (const e of (evidenceRaw ?? []) as {
    tenant_id: string;
    provisional_nsi: number | null;
    provisional_band: string | null;
    field_states: Record<string, string> | null;
    collected_at: string;
  }[]) {
    if (latestScan.has(e.tenant_id)) continue;
    const pending = Object.values(e.field_states ?? {}).filter(
      (v) => v !== "auto"
    ).length;
    latestScan.set(e.tenant_id, {
      nsi: e.provisional_nsi,
      band: e.provisional_band,
      pending,
      at: e.collected_at,
    });
  }

  const tenants = (tenantsRaw ?? []) as Tenant[];
  const subs = (subsRaw ?? []) as Sub[];
  const assessments = (assessmentsRaw ?? []) as (AssessmentRow & { tenant_id: string })[];
  const memberships = (membershipsRaw ?? []) as Membership[];
  const projects = (projectsRaw ?? []) as {
    tenant_id: string;
    proposal_status: string | null;
    stage: string | null;
  }[];
  // The plan is chosen after the build: options and Direct Debit links only
  // once a project of theirs is live.
  const builtTenants = new Set(
    projects.filter((p) => planChoiceOpen(p.stage)).map((p) => p.tenant_id)
  );
  const paid = (paidRaw ?? []) as { tenant_id: string; amount: number }[];
  const audit = (auditRaw ?? []) as Audit[];
  const userById = new Map(
    (users.data?.users ?? []).map((u) => [
      u.id,
      { email: u.email ?? null, lastSignIn: u.last_sign_in_at ?? null },
    ])
  );

  const latestAssessment = new Map<string, AssessmentRow>();
  for (const a of assessments)
    if (!latestAssessment.has(a.tenant_id)) latestAssessment.set(a.tenant_id, a);
  const latestSub = new Map<string, Sub>();
  for (const s of subs) if (!latestSub.has(s.tenant_id)) latestSub.set(s.tenant_id, s);
  const lastEvent = new Map<string, Audit>();
  for (const a of audit) {
    if (!a.tenant_id) continue;
    const key = `${a.tenant_id}:${a.action}`;
    if (!lastEvent.has(key)) lastEvent.set(key, a);
  }
  const accepted = new Set(
    projects.filter((p) => p.proposal_status === "accepted").map((p) => p.tenant_id)
  );
  const paidTotal = new Map<string, number>();
  for (const i of paid)
    paidTotal.set(i.tenant_id, (paidTotal.get(i.tenant_id) ?? 0) + Number(i.amount));

  const rows = tenants.map((t) => {
    const pricing = pricesFromAssessment(latestAssessment.get(t.id) ?? null);
    const sub = latestSub.get(t.id) ?? null;
    const live = !!sub && ["active", "trialing", "past_due"].includes(sub.status);
    const pendingDd =
      !!sub && sub.provider === "gocardless" && sub.status === "incomplete";
    const member = memberships.find((m) => m.tenant_id === t.id) ?? null;
    const user = member ? userById.get(member.user_id) : undefined;
    const portal: "none" | "invited" | "active" = !member
      ? "none"
      : user?.lastSignIn
        ? "active"
        : "invited";
    const portalEmail = user?.email ?? t.contact_email ?? null;
    const billingAgreed = accepted.has(t.id) || (paidTotal.get(t.id) ?? 0) > 0;
    const built = builtTenants.has(t.id);
    const chosen =
      t.care_plan_choice && t.care_plan_choice !== "none"
        ? carePlan(t.care_plan_choice)
        : null;
    const ev = (action: string) => lastEvent.get(`${t.id}:${action}`) ?? null;
    return {
      t,
      pricing,
      sub,
      live,
      pendingDd,
      portal,
      portalEmail,
      billingAgreed,
      built,
      chosen,
      ev,
    };
  });

  const awaiting = rows.filter((r) => r.pendingDd).length;
  const activeDd = rows.filter((r) => r.live && r.sub?.provider === "gocardless").length;
  const unscored = rows.filter((r) => !r.pricing.scored).length;

  return (
    <div>
      <PageHeader
        index="06"
        label="Billing"
        title="Direct Debits"
        lead="Set each client's bracket, get them into the portal, and start their monthly plan by Direct Debit — from one row."
      />

      {/* Tab strip */}
      <div
        className="flex items-center gap-4 mt-6"
        style={{ borderBottom: "1px solid var(--k-border)" }}
      >
        <Link
          href="/admin/billing"
          style={{ ...mono, padding: "8px 0", textDecoration: "none" }}
        >
          Money cockpit
        </Link>
        <span
          style={{
            ...mono,
            padding: "8px 0",
            color: "var(--k-accent)",
            borderBottom: "2px solid var(--k-accent)",
            marginBottom: -1,
          }}
        >
          Direct Debits
        </span>
      </div>

      {/* Rail status — never a silent no-op */}
      <Reveal className="block" delay={0.03}>
        <div
          className="k-kard mt-5 flex flex-wrap items-center justify-between gap-3"
          style={{
            padding: "12px 18px",
            background: "var(--k-surface)",
            borderColor:
              rail.tone === "danger"
                ? T.danger
                : rail.tone === "warning"
                  ? T.warning
                  : "var(--k-border)",
          }}
        >
          <div className="flex items-center gap-3 flex-wrap">
            <span style={mono}>{"// GOCARDLESS RAIL"}</span>
            <StatusChip tone={rail.tone}>{rail.label}</StatusChip>
            <span style={{ ...cell, fontSize: "0.8rem", color: "var(--k-muted)" }}>
              {rail.tone === "danger"
                ? `Direct Debit buttons are disabled: ${[
                    !rail.token && "GOCARDLESS_ACCESS_TOKEN",
                    !rail.secret && "GOCARDLESS_WEBHOOK_SECRET",
                  ]
                    .filter(Boolean)
                    .join(
                      " and "
                    )} not set on this deployment. See docs/OPERATIONS.md → GoCardless.`
                : rail.tone === "warning"
                  ? "Sandbox API — mandates and payments are simulated. Set GOCARDLESS_ENVIRONMENT=live with live credentials to collect real money."
                  : "Live API — mandates authorised here collect real money."}
            </span>
          </div>
        </div>
      </Reveal>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mt-3">
        <Reveal delay={0.05}>
          <StatCard
            value={String(activeDd)}
            label="Active Direct Debits"
            sub="Collecting monthly"
            accent
          />
        </Reveal>
        <Reveal delay={0.1}>
          <StatCard
            value={String(awaiting)}
            label="Awaiting mandate"
            sub="Link sent, not yet authorised"
          />
        </Reveal>
        <Reveal delay={0.15}>
          <StatCard
            value={String(unscored)}
            label="Not scored"
            sub="No bracket set yet — clients see no options"
          />
        </Reveal>
        <Reveal delay={0.2}>
          <StatCard
            value={String(rows.filter((r) => r.portal !== "active").length)}
            label="Not signed in"
            sub="Never used the portal"
          />
        </Reveal>
      </div>

      <Reveal className="block" delay={0.1}>
        <Panel label="// CLIENTS" title="One row per client" pad={false} className="mt-7">
          {rows.length === 0 ? (
            <p style={{ ...cell, padding: 18, color: "var(--k-muted)" }}>
              No client tenants yet.
            </p>
          ) : (
            rows.map(
              (
                {
                  t,
                  pricing,
                  sub,
                  live,
                  pendingDd,
                  portal,
                  portalEmail,
                  billingAgreed,
                  built,
                  chosen,
                  ev,
                },
                i
              ) => {
                const band = pricing.assessment?.scale_band
                  ? SCALE_BAND_LABEL[pricing.assessment.scale_band]
                  : null;
                const plan = sub ? carePlan(sub.plan) : null;
                // Staff only ever RE-SEND the plan the client chose (and agreed
                // the terms for) in the portal — never pick one for them.
                const ddDisabled =
                  rail.tone === "danger" ||
                  !pricing.anyPriced ||
                  !portalEmail ||
                  !billingAgreed ||
                  !chosen ||
                  live;
                const sentDd =
                  ev("care_plan.dd_setup_sent") ?? ev("care_plan.dd_started");
                const sentInvite = ev("care_plan.plan_invite_sent");
                const sentPortal =
                  ev("portal.account_created") ?? ev("portal.password_reset_sent");
                return (
                  <div
                    key={t.id}
                    style={{
                      padding: "14px 18px",
                      borderTop: i ? "1px solid var(--k-border)" : "none",
                    }}
                  >
                    <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1.4fr_1fr_1.2fr] items-start">
                      {/* Client */}
                      <div>
                        <Link
                          href={`/admin/clients/${t.id}`}
                          style={{ ...cell, fontWeight: 600, textDecoration: "none" }}
                        >
                          {t.name}
                        </Link>
                        <div
                          style={{
                            ...mono,
                            fontSize: "0.62rem",
                            marginTop: 4,
                            textTransform: "none",
                            letterSpacing: 0,
                          }}
                        >
                          {portalEmail ?? "no email on file"}
                        </div>
                      </div>

                      {/* Band */}
                      <div className="flex flex-col gap-1">
                        <span style={mono}>Bracket</span>
                        {pricing.scored ? (
                          pricing.assessment?.enterprise_review_required ? (
                            <StatusChip tone="warning">
                              Enterprise — quote manually
                            </StatusChip>
                          ) : (
                            <StatusChip tone="accent">
                              {band ?? "—"}
                              {pricing.assessment?.multiplier
                                ? ` ×${Number(pricing.assessment.multiplier)}`
                                : ""}
                            </StatusChip>
                          )
                        ) : latestScan.get(t.id) ? (
                          <StatusChip tone="warning">
                            Auto NSI {latestScan.get(t.id)!.nsi ?? "—"} ·{" "}
                            {latestScan.get(t.id)!.band === "enterprise"
                              ? "Enterprise"
                              : (SCALE_BAND_LABEL[
                                  latestScan.get(t.id)!
                                    .band as keyof typeof SCALE_BAND_LABEL
                                ] ?? "—")}{" "}
                            · {latestScan.get(t.id)!.pending} to confirm
                          </StatusChip>
                        ) : (
                          <StatusChip tone="warning">Not scored</StatusChip>
                        )}
                        <Link
                          href={`/admin/clients/${t.id}/pricing`}
                          style={{
                            ...mono,
                            color: "var(--k-accent)",
                            textDecoration: "underline",
                          }}
                        >
                          {pricing.scored ? "Re-score →" : "Score →"}
                        </Link>
                      </div>

                      {/* Prices */}
                      <div className="flex flex-col gap-1">
                        <span style={mono}>Their three options</span>
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          {pricing.sellable.map((pp) => (
                            <span
                              key={pp.planId}
                              style={{
                                ...cell,
                                fontSize: "0.8rem",
                                color: pp.priced ? "var(--k-fg)" : "var(--k-faint)",
                              }}
                            >
                              {pp.label}{" "}
                              <span style={{ fontFamily: T.mono, fontSize: "0.72rem" }}>
                                {pp.priced && pp.mrr !== null ? gbp(pp.mrr) : "—"}
                              </span>
                            </span>
                          ))}
                        </div>
                        {pricing.prices.build_10?.priced && (
                          <span
                            style={{
                              ...cell,
                              fontSize: "0.78rem",
                              color: "var(--k-muted)",
                            }}
                          >
                            Enterprise agreed at {gbp(pricing.prices.build_10.mrr!)}
                          </span>
                        )}
                      </div>

                      {/* Portal */}
                      <div className="flex flex-col gap-1">
                        <span style={mono}>Portal</span>
                        <StatusChip
                          tone={
                            portal === "active"
                              ? "success"
                              : portal === "invited"
                                ? "warning"
                                : "muted"
                          }
                        >
                          {portal === "active"
                            ? "Signed in"
                            : portal === "invited"
                              ? "Never signed in"
                              : "No account"}
                        </StatusChip>
                        {sentPortal && (
                          <span
                            style={{
                              ...mono,
                              fontSize: "0.6rem",
                              textTransform: "none",
                              letterSpacing: 0,
                            }}
                          >
                            link sent {dateGB(sentPortal.created_at)}
                          </span>
                        )}
                      </div>

                      {/* Direct Debit */}
                      <div className="flex flex-col gap-1">
                        <span style={mono}>Direct Debit</span>
                        {live && sub ? (
                          <StatusChip
                            tone={sub.status === "past_due" ? "danger" : "success"}
                          >
                            {sub.status === "past_due" ? "Past due" : "Active"} ·{" "}
                            {plan?.label ?? sub.plan} {gbp(Number(sub.mrr))}/mo
                            {sub.provider !== "gocardless"
                              ? ` (${sub.provider === "manual" ? "standing order" : "card"})`
                              : ""}
                          </StatusChip>
                        ) : pendingDd && sub ? (
                          <StatusChip tone="warning">
                            Awaiting mandate · {plan?.label ?? sub.plan}{" "}
                            {gbp(Number(sub.mrr))}/mo
                          </StatusChip>
                        ) : (
                          <StatusChip tone="muted">Not started</StatusChip>
                        )}
                        {sentDd && (
                          <span
                            style={{
                              ...mono,
                              fontSize: "0.6rem",
                              textTransform: "none",
                              letterSpacing: 0,
                            }}
                          >
                            link sent {dateGB(sentDd.created_at)}
                          </span>
                        )}
                        {sentInvite && (
                          <span
                            style={{
                              ...mono,
                              fontSize: "0.6rem",
                              textTransform: "none",
                              letterSpacing: 0,
                            }}
                          >
                            options sent {dateGB(sentInvite.created_at)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    {!live && (
                      <div className="flex flex-wrap items-end gap-2 mt-3">
                        <form action={sendPortalLink} className="flex items-center gap-2">
                          <input type="hidden" name="tenant_id" value={t.id} />
                          <input
                            name="email"
                            type="email"
                            defaultValue={portalEmail ?? ""}
                            placeholder="client@email.com"
                            style={{ ...inp, width: 220 }}
                            title="Recipient — change it if the client reads a different inbox"
                          />
                          <SubmitButton
                            style={btn("var(--k-surface)", "var(--k-fg)")}
                            disabled={!portalEmail && false}
                          >
                            {portal === "none"
                              ? "Send portal invite"
                              : portal === "invited"
                                ? "Send sign-in link"
                                : "Send password reset"}
                          </SubmitButton>
                        </form>
                        <form action={sendPlanInvite} className="flex items-center gap-2">
                          <input type="hidden" name="tenant_id" value={t.id} />
                          <input type="hidden" name="email" value={portalEmail ?? ""} />
                          <SubmitButton
                            style={{
                              ...btn(
                                pricing.anyPriced
                                  ? "var(--k-accent)"
                                  : "var(--k-surface)",
                                pricing.anyPriced
                                  ? "var(--k-on-accent)"
                                  : "var(--k-faint)"
                              ),
                              cursor: pricing.anyPriced ? "pointer" : "not-allowed",
                            }}
                            disabled={!pricing.anyPriced || !portalEmail || !built}
                            title={
                              !built
                                ? "The client chooses after the build — opens once a project is live"
                                : pricing.anyPriced
                                  ? "Email their three priced options with a link into the portal"
                                  : "Score the client first"
                            }
                          >
                            {built ? "Send plan options" : "Options open at go-live"}
                          </SubmitButton>
                        </form>
                        <form
                          action={sendDirectDebitLink}
                          className="flex items-center gap-2"
                        >
                          <input type="hidden" name="tenant_id" value={t.id} />
                          <input type="hidden" name="email" value={portalEmail ?? ""} />
                          <span
                            style={{
                              ...cell,
                              fontSize: "0.78rem",
                              color: chosen ? "var(--k-fg)" : "var(--k-faint)",
                            }}
                          >
                            {chosen
                              ? `Client chose ${chosen.label}${t.care_plan_terms_accepted_at ? ` · terms agreed ${dateGB(t.care_plan_terms_accepted_at)}` : ""}`
                              : t.care_plan_choice === "none"
                                ? "Client chose no plan for now"
                                : "Client hasn't chosen yet"}
                          </span>
                          <SubmitButton
                            style={{
                              ...btn(
                                "var(--k-surface)",
                                ddDisabled ? "var(--k-faint)" : "var(--k-fg)"
                              ),
                              cursor: ddDisabled ? "not-allowed" : "pointer",
                            }}
                            disabled={ddDisabled}
                            title={
                              rail.tone === "danger"
                                ? "GoCardless is not configured on this deployment"
                                : !pricing.anyPriced
                                  ? "Score the client first"
                                  : !billingAgreed
                                    ? "Available once the client has signed the proposal or paid an invoice"
                                    : !chosen
                                      ? "The client picks their plan and agrees the terms in the portal"
                                      : "Re-send the GoCardless authorisation link for the plan the client chose"
                            }
                          >
                            {pendingDd
                              ? "Send new Direct Debit link"
                              : "Re-send Direct Debit link"}
                          </SubmitButton>
                        </form>
                      </div>
                    )}
                  </div>
                );
              }
            )
          )}
        </Panel>
      </Reveal>
    </div>
  );
}
