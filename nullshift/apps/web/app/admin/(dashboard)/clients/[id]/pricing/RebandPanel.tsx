import { createServiceClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import { Panel, StatusChip } from "@/components/app/AppKit";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { SCALE_BAND_LABEL, type ScaleBand } from "@/lib/pricing/nsi";
import {
  DOWNWARD_CONSECUTIVE,
  UPWARD_CONSECUTIVE,
  rebandDecision,
  type Snapshot,
} from "@/lib/pricing/reband";
import {
  applyPriceChange,
  approvePriceChange,
  proposePriceChange,
  recordNoticeSent,
  recordSnapshot,
  withdrawPriceChange,
} from "./reband-actions";

/**
 * Shadow scores and re-band notices (spec §7).
 *
 * The screen is built to make one thing obvious: the monthly score column and
 * the billed figure are different things, and nothing moves from one to the
 * other without a person, an approval and thirty days.
 */

const gbp = (n: number | string | null | undefined) =>
  n === null || n === undefined
    ? "—"
    : "£" + Number(n).toLocaleString("en-GB", { maximumFractionDigits: 0 });
const monthGB = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { month: "short", year: "numeric" });

const label: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "0.62rem",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--k-muted)",
};
const body: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: "0.88rem",
  lineHeight: 1.65,
  color: "var(--k-muted)",
};
const inp: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: "0.88rem",
  color: "var(--k-fg)",
  background: "var(--k-bg)",
  border: "1px solid var(--k-border)",
  borderRadius: 0,
  padding: "8px 10px",
  width: "100%",
};

const NOTICE_TONE: Record<string, "muted" | "accent" | "success" | "warning"> = {
  proposed: "muted",
  approved: "warning",
  notice_sent: "accent",
  effective: "success",
  withdrawn: "muted",
};

/** Months between two dates, floored — the six-month review clock. */
function monthsSince(iso: string | null): number {
  if (!iso) return 999;
  const then = new Date(iso);
  const now = new Date();
  return (
    (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth())
  );
}

export async function RebandPanel({
  tenantId,
  contractedBand,
  currentMrr,
}: {
  tenantId: string;
  contractedBand: ScaleBand | null;
  currentMrr: number | null;
}) {
  const db = createServiceClient();
  const [{ data: snapRows }, { data: noticeRows }] = await Promise.all([
    db
      .from("pricing_snapshots")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("period", { ascending: false })
      .limit(12),
    db
      .from("price_change_notices")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const snapshots: Snapshot[] = (snapRows ?? []).map((s) => ({
    id: s.id,
    period: s.period,
    scaleBand: s.scale_band as ScaleBand | null,
    recommendedMrr: s.recommended_mrr === null ? null : Number(s.recommended_mrr),
    enterpriseReviewRequired: s.enterprise_review_required,
  }));

  const notices = noticeRows ?? [];
  const lastEffective = notices.find((n) => n.status === "effective");
  const decision = rebandDecision(snapshots, {
    contractedBand,
    currentMrr: currentMrr ?? 0,
    monthsSinceLastChange: monthsSince(lastEffective?.effective_date ?? null),
  });

  const openNotice = notices.find(
    (n) => !["effective", "withdrawn"].includes(n.status)
  );

  return (
    <div style={{ marginTop: 20 }}>
      <Panel
        label="// §7 RE-BAND"
        title="Shadow scores and notices"
        actions={
          <form action={recordSnapshot}>
            <input type="hidden" name="tenant_id" value={tenantId} />
            <SubmitButton className="kb kb-outline kb-sm" pendingLabel="Scoring…">
              Record this month
            </SubmitButton>
          </form>
        }
      >
        <p style={body}>
          A monthly score records what the formula would say today. It changes nothing on
          its own. Going up needs {UPWARD_CONSECUTIVE} consecutive months above the
          contracted band; coming down needs {DOWNWARD_CONSECUTIVE} and a six-month review
          point. Either way a person approves it and the client gets 30 days.
        </p>

        {/* ── the decision ─────────────────────────────────── */}
        <div
          style={{
            border: "1px solid var(--k-border)",
            padding: "14px 16px",
            marginTop: 16,
          }}
        >
          <div className="flex flex-wrap items-center gap-3">
            <StatusChip
              tone={
                decision.action === "propose"
                  ? "accent"
                  : decision.action === "manual_review"
                    ? "warning"
                    : "muted"
              }
            >
              {decision.action === "propose"
                ? `Proposed ${decision.direction}`
                : decision.action === "manual_review"
                  ? "Manual review"
                  : "No change"}
            </StatusChip>
            <span style={{ ...body, color: "var(--k-fg)" }}>{decision.reason}</span>
          </div>

          {decision.action === "propose" && !openNotice && (
            <form action={proposePriceChange} className="mt-4 flex flex-wrap items-end gap-3">
              <input type="hidden" name="tenant_id" value={tenantId} />
              <input type="hidden" name="direction" value={decision.direction} />
              <input type="hidden" name="old_mrr" value={String(currentMrr ?? 0)} />
              <input type="hidden" name="new_mrr" value={String(decision.newMrr)} />
              <input type="hidden" name="old_band" value={decision.fromBand} />
              <input type="hidden" name="new_band" value={decision.toBand} />
              <input type="hidden" name="evidence" value={decision.evidence.join(",")} />
              <label style={{ flex: "1 1 320px" }}>
                <span style={{ ...label, display: "block", marginBottom: 6 }}>
                  Reason the client will read
                </span>
                <input name="reason" defaultValue={decision.reason} required style={inp} />
              </label>
              <SubmitButton className="kb kb-primary kb-sm" pendingLabel="Creating…">
                {gbp(currentMrr)} → {gbp(decision.newMrr)}
              </SubmitButton>
            </form>
          )}
          {decision.action === "propose" && openNotice && (
            <p style={{ ...body, marginTop: 10, color: "var(--k-faint)" }}>
              There is already an open notice ({openNotice.reference}). Finish or withdraw
              it before proposing another.
            </p>
          )}
        </div>

        {/* ── snapshots ────────────────────────────────────── */}
        {snapshots.length > 0 && (
          <div className="mt-6">
            <span style={label}>Monthly shadow scores</span>
            <div className="mt-3 flex flex-col">
              {(snapRows ?? []).map((s, i) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"
                  style={{
                    padding: "9px 0",
                    borderTop: i ? "1px solid var(--k-border)" : "none",
                  }}
                >
                  <span style={{ fontFamily: T.mono, fontSize: "0.68rem", color: "var(--k-muted)" }}>
                    {monthGB(s.period)} · NSI {s.nsi} ·{" "}
                    {s.enterprise_review_required
                      ? "Enterprise"
                      : (SCALE_BAND_LABEL[s.scale_band as ScaleBand] ?? "—")}
                  </span>
                  <span style={{ fontFamily: T.mono, fontSize: "0.68rem", color: "var(--k-faint)" }}>
                    would be {gbp(s.recommended_mrr)} · billed {gbp(s.current_mrr)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── notices ──────────────────────────────────────── */}
        {notices.length > 0 && (
          <div className="mt-6 flex flex-col gap-3">
            <span style={label}>Price change notices</span>
            {notices.map((n) => {
              const dueYet =
                n.effective_date && new Date(n.effective_date) <= new Date();
              return (
                <div
                  key={n.id}
                  style={{ border: "1px solid var(--k-border)", padding: "14px 16px" }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span style={{ ...label, color: "var(--k-accent)" }}>{n.reference}</span>
                    <StatusChip tone={NOTICE_TONE[n.status] ?? "muted"}>
                      {n.status.replace(/_/g, " ")}
                    </StatusChip>
                  </div>
                  <p style={{ ...body, marginTop: 8, color: "var(--k-fg)" }}>
                    {gbp(n.old_mrr)} → {gbp(n.new_mrr)} per month. {n.reason}
                  </p>
                  <p style={{ ...body, fontSize: "0.8rem", marginTop: 6 }}>
                    {n.approved_at ? `Approved ${new Date(n.approved_at).toLocaleDateString("en-GB")}. ` : "Not yet approved. "}
                    {n.notice_sent_at
                      ? `Notice sent ${new Date(n.notice_sent_at).toLocaleDateString("en-GB")} to ${n.notice_sent_to} by ${n.notice_channel}. Effective ${n.effective_date}.`
                      : "No notice sent."}
                  </p>

                  <div className="mt-4 flex flex-wrap items-end gap-3">
                    {n.status === "proposed" && (
                      <form action={approvePriceChange}>
                        <input type="hidden" name="tenant_id" value={tenantId} />
                        <input type="hidden" name="id" value={n.id} />
                        <SubmitButton className="kb kb-primary kb-sm" pendingLabel="…">
                          Approve
                        </SubmitButton>
                      </form>
                    )}
                    {n.status === "approved" && (
                      <form action={recordNoticeSent} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="tenant_id" value={tenantId} />
                        <input type="hidden" name="id" value={n.id} />
                        <label style={{ minWidth: 220 }}>
                          <span style={{ ...label, display: "block", marginBottom: 6 }}>
                            Sent to
                          </span>
                          <input name="notice_sent_to" type="email" required style={inp} />
                        </label>
                        <label style={{ minWidth: 120 }}>
                          <span style={{ ...label, display: "block", marginBottom: 6 }}>
                            Channel
                          </span>
                          <select name="notice_channel" defaultValue="email" style={{ ...inp, height: 36 }}>
                            {["email", "portal", "post", "other"].map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </label>
                        <SubmitButton className="kb kb-outline kb-sm" pendingLabel="…">
                          Record notice sent
                        </SubmitButton>
                      </form>
                    )}
                    {n.status === "notice_sent" && (
                      <form action={applyPriceChange}>
                        <input type="hidden" name="tenant_id" value={tenantId} />
                        <input type="hidden" name="id" value={n.id} />
                        <SubmitButton
                          className="kb kb-primary kb-sm"
                          disabled={!dueYet}
                          pendingLabel="…"
                        >
                          {dueYet ? "Adopt new figure" : `Effective ${n.effective_date}`}
                        </SubmitButton>
                      </form>
                    )}
                    {!["effective", "withdrawn"].includes(n.status) && (
                      <form action={withdrawPriceChange}>
                        <input type="hidden" name="tenant_id" value={tenantId} />
                        <input type="hidden" name="id" value={n.id} />
                        <SubmitButton className="kb kb-outline kb-sm" pendingLabel="…">
                          Withdraw
                        </SubmitButton>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
