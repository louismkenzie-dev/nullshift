import { SubmitButton } from "@/components/admin/SubmitButton";
import { T } from "@nullshift/ui/tokens";
import { gocardlessDashboardUrl } from "@nullshift/billing/gocardless";
import {
  classifyCollection,
  gbpPence,
  isCancellable,
  isCollected,
  isDead,
  type Finding,
} from "@/lib/billing/directDebit";
import type { DirectDebitCheck } from "@/lib/billing/directDebitRun";
import { cancelOffPlanCollection, checkDirectDebitNow, markCollectionHandled } from "./actions";
import { btn, dateGB, inp, monoLink } from "../_shared";

/**
 * The live Direct Debit, straight from GoCardless, next to the plan we hold:
 * what it collects, when it collects next, the mandate, and every recent
 * payment labelled plan / off plan. Findings (an amended amount, a one-off
 * someone created, a collection that was not the plan) sit at the top with
 * the one action each allows — cancel while it can still be cancelled, mark
 * handled once it has been refunded or invoiced.
 */

const mono11: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: 11,
  letterSpacing: "0.04em",
  color: "var(--k-muted)",
};

const box: React.CSSProperties = {
  border: "1px solid var(--k-border)",
  background: "var(--k-bg)",
  padding: "10px 12px",
  minWidth: 0,
};

function Fact({ label, value, tone, sub }: { label: string; value: string; tone?: "ok" | "warn" | "bad"; sub?: string | null }) {
  const color = tone === "bad" ? T.danger : tone === "warn" ? T.warning : tone === "ok" ? T.success : "var(--k-fg)";
  return (
    <div style={box}>
      <p style={{ ...mono11, margin: 0, textTransform: "uppercase", fontSize: 10 }}>{label}</p>
      <p style={{ margin: "4px 0 0", fontFamily: T.sans, fontSize: "0.95rem", fontWeight: 600, color }}>{value}</p>
      {sub ? <p style={{ ...mono11, margin: "2px 0 0", fontSize: 10 }}>{sub}</p> : null}
    </div>
  );
}

function FindingCard({ f, tenantId }: { f: Finding; tenantId: string }) {
  const tone = f.severity === "urgent" ? T.danger : T.warning;
  return (
    <div
      style={{
        border: `1px solid color-mix(in oklab, ${tone} 45%, transparent)`,
        background: `color-mix(in oklab, ${tone} 8%, transparent)`,
        padding: "12px 14px",
        marginTop: 8,
      }}
    >
      <p style={{ margin: 0, fontFamily: T.sans, fontSize: "0.9rem", fontWeight: 600, color: "var(--k-fg)" }}>{f.title}</p>
      <p style={{ margin: "6px 0 0", fontFamily: T.sans, fontSize: "0.82rem", lineHeight: 1.6, color: "var(--k-muted)" }}>{f.detail}</p>
      <div className="flex flex-wrap items-center gap-2" style={{ marginTop: 10 }}>
        {f.paymentId ? (
          <a href={gocardlessDashboardUrl(f.paymentId)} target="_blank" rel="noreferrer" style={monoLink}>
            Open in GoCardless ↗
          </a>
        ) : null}
        {f.code === "off_plan_pending" && f.paymentId ? (
          <form action={cancelOffPlanCollection}>
            <input type="hidden" name="tenant_id" value={tenantId} />
            <input type="hidden" name="payment_id" value={f.paymentId} />
            <SubmitButton style={btn(T.danger, "#fff")} pendingLabel="Cancelling…" title="Cancel this payment in GoCardless before it is submitted to the bank">
              Cancel this collection
            </SubmitButton>
          </form>
        ) : null}
        {(f.code === "off_plan_collected" || f.code === "off_plan_in_flight") && f.paymentId ? (
          <form action={markCollectionHandled} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="tenant_id" value={tenantId} />
            <input type="hidden" name="payment_id" value={f.paymentId} />
            <input name="note" placeholder="How it was resolved (refunded, invoiced…)" style={{ ...inp, width: 260, maxWidth: "100%" }} />
            <SubmitButton style={btn("var(--k-surface)", "var(--k-fg)")} pendingLabel="Saving…">
              Mark as handled
            </SubmitButton>
          </form>
        ) : null}
      </div>
    </div>
  );
}

export function DirectDebitPanel({ tenantId, check }: { tenantId: string; check: DirectDebitCheck | null }) {
  const sub = check?.sub ?? null;
  const live = check?.live ?? null;
  const findings = check?.findings ?? [];
  const expected = sub ? Math.round(sub.mrr * 100) : 0;
  const next = live?.subscription?.upcomingPayments[0] ?? null;
  const lastPlan = live?.payments.find((p) => isCollected(p.status) && sub && classifyCollection(p, sub).kind === "plan") ?? null;
  const drift = !!live?.subscription && live.subscription.amountPence !== expected;

  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--k-border)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p style={{ ...mono11, margin: 0, textTransform: "uppercase" }}>
          Direct Debit · live from GoCardless
          {sub?.gcSubscriptionId ? (
            <>
              {" · "}
              <a href={gocardlessDashboardUrl(sub.gcSubscriptionId)} target="_blank" rel="noreferrer" style={monoLink}>
                open ↗
              </a>
            </>
          ) : null}
        </p>
        <form action={checkDirectDebitNow}>
          <input type="hidden" name="tenant_id" value={tenantId} />
          <SubmitButton style={btn("var(--k-surface)", "var(--k-fg)")} pendingLabel="Checking…" title="Re-read the subscription, mandate and recent payments from GoCardless and compare them with the plan">
            Check GoCardless now
          </SubmitButton>
        </form>
      </div>

      {!check || !live ? (
        <p style={{ fontFamily: T.sans, fontSize: "0.82rem", color: "var(--k-faint)", margin: "10px 0 0" }}>
          {check === null
            ? "GoCardless did not answer in time — press Check GoCardless now."
            : "GoCardless is not configured on this deployment, so the live Direct Debit cannot be shown."}
        </p>
      ) : (
        <>
          {findings.length === 0 ? (
            <p style={{ fontFamily: T.sans, fontSize: "0.82rem", color: T.success, margin: "10px 0 0" }}>
              GoCardless agrees with the plan: it collects {gbpPence(expected)} a month, the mandate is live, and every recent payment is the plan.
            </p>
          ) : (
            findings.map((f) => <FindingCard key={`${f.code}:${f.paymentId ?? ""}`} f={f} tenantId={tenantId} />)
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2" style={{ marginTop: 12 }}>
            <Fact
              label="Collects"
              value={live.subscription ? `${gbpPence(live.subscription.amountPence)}/mo` : "—"}
              tone={live.subscription ? (drift ? "bad" : "ok") : undefined}
              sub={drift ? `plan is ${gbpPence(expected)}` : live.subscription ? `subscription ${live.subscription.status.replace(/_/g, " ")}` : "no subscription read"}
            />
            <Fact
              label="Next charge"
              value={next ? (dateGB(next.chargeDate) ?? next.chargeDate) : "—"}
              tone={next && next.amountPence !== expected ? "bad" : undefined}
              sub={next ? gbpPence(next.amountPence) : live.subscription ? "nothing scheduled" : null}
            />
            <Fact
              label="Mandate"
              value={live.mandate ? live.mandate.status.replace(/_/g, " ") : "—"}
              tone={live.mandate ? (live.mandate.status === "active" ? "ok" : "warn") : undefined}
              sub={sub?.gcMandateId ?? null}
            />
            <Fact
              label="Last plan payment"
              value={lastPlan ? gbpPence(lastPlan.amountPence) : "—"}
              sub={lastPlan ? `${dateGB(lastPlan.chargeDate) ?? "—"} · ${lastPlan.status.replace(/_/g, " ")}` : "none collected yet"}
            />
          </div>

          {live.payments.length > 0 ? (
            <details style={{ marginTop: 10 }}>
              <summary style={{ ...mono11, cursor: "pointer", textTransform: "uppercase" }}>
                Recent payments on this mandate ({live.payments.length})
              </summary>
              <table style={{ width: "100%", marginTop: 8, borderCollapse: "collapse", fontFamily: T.sans, fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ ...mono11, textTransform: "uppercase", fontSize: 10 }}>
                    <th style={{ textAlign: "left", padding: "6px 0", fontWeight: 500 }}>Charge date</th>
                    <th style={{ textAlign: "right", padding: "6px 0", fontWeight: 500 }}>Amount</th>
                    <th style={{ textAlign: "left", padding: "6px 0 6px 16px", fontWeight: 500 }}>Status</th>
                    <th style={{ textAlign: "left", padding: "6px 0 6px 16px", fontWeight: 500 }}>Plan?</th>
                    <th style={{ textAlign: "left", padding: "6px 0 6px 16px", fontWeight: 500 }}>Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {live.payments.map((p) => {
                    const v = sub ? classifyCollection(p, sub) : null;
                    const dead = isDead(p.status);
                    const planTone = dead ? "var(--k-faint)" : v?.kind === "plan" ? T.success : T.danger;
                    return (
                      <tr key={p.id} style={{ borderTop: "1px solid var(--k-border)", color: dead ? "var(--k-faint)" : "var(--k-fg)" }}>
                        <td style={{ padding: "7px 0" }}>{dateGB(p.chargeDate)}</td>
                        <td style={{ padding: "7px 0", textAlign: "right" }}>{gbpPence(p.amountPence)}</td>
                        <td style={{ padding: "7px 0 7px 16px" }}>
                          <span style={{ ...mono11, textTransform: "uppercase", color: isCollected(p.status) ? T.success : isCancellable(p.status) ? T.warning : dead ? "var(--k-faint)" : "var(--k-muted)" }}>
                            {p.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td style={{ padding: "7px 0 7px 16px" }}>
                          <span style={{ ...mono11, textTransform: "uppercase", color: planTone }}>
                            {dead ? "—" : v?.kind === "plan" ? "Plan" : `Off plan · ${v?.kind === "off_plan" ? v.reason : ""}`}
                          </span>
                        </td>
                        <td style={{ padding: "7px 0 7px 16px" }}>
                          <a href={gocardlessDashboardUrl(p.id)} target="_blank" rel="noreferrer" style={monoLink} title={p.description ?? undefined}>
                            {p.id.slice(0, 10)}… ↗
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </details>
          ) : null}
        </>
      )}
    </div>
  );
}
