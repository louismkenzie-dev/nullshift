import Link from "next/link";
import { notFound } from "next/navigation";
import { reviewState } from "@/lib/legal/review";
import {
  FIXTURE_TODAY,
  PRE_ISSUE_STATUSES,
  REVIEW_REQUIREMENT_LABEL,
  agreementById,
  canIssue,
  expiryState,
  issueBlockers,
  money,
  type AuditKind,
} from "@/lib/next/fixtures-agreements";
import s from "../../next.module.css";
import a from "../agreements.module.css";
import { statusTone } from "../statusTone";

const auditTone = (kind: AuditKind): string => {
  switch (kind) {
    case "acceptance":
      return s.chipSuccess;
    case "evidence":
      return s.chipInfo;
    case "issue":
      return s.chipWarning;
    default:
      return "";
  }
};

const auditLabel: Record<AuditKind, string> = {
  acceptance: "acceptance",
  evidence: "evidence only",
  issue: "issued",
  internal: "internal",
  system: "system",
};

export default async function AgreementWorkspace({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const d = agreementById(id);
  if (!d) notFound();

  const review = reviewState(d.review);
  const blockers = issueBlockers(d);
  const preIssue = PRE_ISSUE_STATUSES.includes(d.status);
  const issue = canIssue(d, review);
  const exp = expiryState(d, FIXTURE_TODAY);
  const readOnly = d.legacy || !preIssue;

  return (
    <>
      <p className={s.mono}>
        <Link href="/admin/next/agreements">Agreements</Link> /{" "}
        <Link href={`/admin/next/clients/${d.clientId}`}>{d.client}</Link> / {d.type}{" "}
        {d.version}
      </p>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.h1}>
            {d.type} · {d.version}
          </h1>
          <p className={s.lead}>
            {d.project} · template {d.templateVersion} ·{" "}
            <span className={`${s.chip} ${statusTone(d.status)}`}>{d.status}</span>
            {exp.state === "none"
              ? ""
              : exp.state === "expired"
                ? ` · expired ${d.expiresOn}`
                : ` · valid until ${d.expiresOn} (${exp.days} days)`}
            {d.supersedes ? (
              <>
                {" "}
                · supersedes{" "}
                <Link
                  href={`/admin/next/agreements/${d.supersedes}`}
                  className={s.rowLink}
                >
                  {d.supersedes}
                </Link>
              </>
            ) : null}
            {d.supersededBy ? (
              <>
                {" "}
                · superseded by{" "}
                <Link
                  href={`/admin/next/agreements/${d.supersededBy}`}
                  className={s.rowLink}
                >
                  {d.supersededBy}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <div className={s.chips}>
          <button
            className={s.btn}
            type="button"
            disabled
            title={readOnly ? "Read-only: this version is frozen" : "Not in this slice"}
          >
            Request review
          </button>
          <button
            className={s.btn}
            type="button"
            disabled
            title={
              preIssue
                ? "Not in this slice"
                : "Withdraw applies only to issued documents awaiting the client"
            }
          >
            Withdraw
          </button>
          <button
            className={s.btn}
            type="button"
            disabled
            title={
              d.legacy
                ? "Legacy record: a new version must be a fresh agreement, never a regeneration"
                : "Not in this slice — creates a new version and preserves this one"
            }
          >
            New version
          </button>
          <button
            className={s.btnPrimary}
            type="button"
            disabled
            title={
              issue.ok
                ? "Requires issue permission (not in this slice)"
                : issue.reasons.join(" · ")
            }
          >
            Issue
          </button>
        </div>
      </div>

      {d.legacy ? (
        <div className={a.legacyNote} role="note">
          <strong>Protected legacy agreement — read-only</strong>
          <span>
            Signed terms as of February 2026. This record is never regenerated from
            today&apos;s catalogue and is never edited in place. Catalogue or price
            changes do not touch it.
          </span>
        </div>
      ) : null}

      {!d.legacy && !preIssue ? (
        <div className={s.strip}>
          <span className={s.mono}>Snapshot</span>
          <strong>
            {d.status === "Accepted"
              ? "Accepted version — the rendered snapshot and hash are frozen"
              : `${d.status} version — preserved unchanged`}
          </strong>
          <span className={s.muted}>
            Changes require a new version or an amendment that says what changed.
          </span>
        </div>
      ) : null}

      <div className={a.workspace}>
        <div className={s.stack}>
          <section className={s.card} aria-labelledby="facts">
            <div className={s.cardTitle}>
              <h2 className={s.h2} id="facts" style={{ margin: 0 }}>
                Structured facts
              </h2>
              <span className={s.mono}>stored alongside the rendered snapshot</span>
            </div>
            <dl className={s.kv}>
              <dt>Legal entity</dt>
              <dd>{d.facts.legalEntity ?? <Missing />}</dd>
              <dt>Authorised signatory</dt>
              <dd>{d.facts.signatory ?? <Missing />}</dd>
              <dt>Service route</dt>
              <dd style={{ textTransform: "capitalize" }}>
                {d.facts.serviceRoute === "unresolved" ? (
                  <Missing text="Not elected" />
                ) : (
                  d.facts.serviceRoute
                )}
              </dd>
              <dt>Billing-start arrangement</dt>
              <dd>
                {d.facts.billingStart ? (
                  <>
                    {d.facts.billingStart.arrangement}
                    {d.facts.billingStart.exactDate
                      ? ` · exact date ${d.facts.billingStart.exactDate}`
                      : " · no exact date yet (conditional wording)"}
                    {d.facts.billingStart.approvedWording
                      ? ""
                      : " · wording not approved"}
                  </>
                ) : d.facts.serviceRoute === "managed" ? (
                  <Missing text="Not recorded" />
                ) : (
                  "Not applicable"
                )}
              </dd>
              <dt>Quote reference</dt>
              <dd>
                {d.facts.quoteRef
                  ? `${d.facts.quoteRef.id} ${d.facts.quoteRef.version}${d.facts.quoteRef.stale ? " (stale)" : ""}`
                  : "—"}
              </dd>
              <dt>Governing document</dt>
              <dd>
                {d.facts.governing ? (
                  <Link
                    href={`/admin/next/agreements/${d.facts.governing}`}
                    className={s.rowLink}
                  >
                    {d.facts.governing}
                  </Link>
                ) : d.type === "Master framework" ? (
                  "This document governs"
                ) : (
                  "—"
                )}
              </dd>
              {d.facts.noticePeriod ? (
                <>
                  <dt>Notice</dt>
                  <dd>{d.facts.noticePeriod}</dd>
                </>
              ) : null}
              {d.facts.warranty ? (
                <>
                  <dt>Warranty</dt>
                  <dd>{d.facts.warranty}</dd>
                </>
              ) : null}
              <dt>Template version</dt>
              <dd>{d.templateVersion}</dd>
              <dt>Review requirement</dt>
              <dd>{REVIEW_REQUIREMENT_LABEL[d.reviewRequirement]}</dd>
            </dl>
          </section>

          <section className={s.card} aria-labelledby="scope">
            <h2 className={s.h2} id="scope">
              Scope schedule
            </h2>
            <ScopeList label="Included" items={d.scope.included} empty="Nothing listed" />
            <ScopeList
              label="Excluded"
              items={d.scope.excluded}
              empty="No exclusions listed"
            />
            <ScopeList
              label="Acceptance criteria"
              items={d.scope.acceptance}
              empty="No acceptance criteria — not a build document"
            />
          </section>

          <section className={s.card} aria-labelledby="pricing">
            <div className={s.cardTitle}>
              <h2 className={s.h2} id="pricing" style={{ margin: 0 }}>
                Pricing schedule
              </h2>
              <span className={s.mono}>fixture amounts · not an approved price list</span>
            </div>
            {d.pricing.length === 0 ? (
              <p className={s.muted}>No charges on this document.</p>
            ) : (
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Line</th>
                    <th className={s.num}>Amount</th>
                    <th>Cadence</th>
                    <th>Tax basis</th>
                    <th>Basis</th>
                  </tr>
                </thead>
                <tbody>
                  {d.pricing.map((p) => (
                    <tr key={p.label}>
                      <td>{p.label}</td>
                      <td className={s.num}>
                        {p.cadence === "n/a"
                          ? "No amount"
                          : `${money(p.amount)} ${p.amount.currency}`}
                        {p.quoteAmount && p.quoteAmount.minor !== p.amount.minor ? (
                          <div className={s.mono} style={{ color: "var(--ns-danger)" }}>
                            quote {money(p.quoteAmount)}
                          </div>
                        ) : null}
                      </td>
                      <td className={s.muted}>{p.cadence}</td>
                      <td>
                        <span
                          className={`${s.chip} ${p.taxBasis === "pending decision" ? s.chipWarning : ""}`}
                        >
                          {p.taxBasis}
                        </span>
                      </td>
                      <td className={s.muted}>{p.basis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className={s.card} aria-labelledby="risk">
            <h2 className={s.h2} id="risk">
              Risk flags
            </h2>
            {d.riskFlags.length === 0 ? (
              <p className={s.muted}>No risk flags recorded.</p>
            ) : (
              <div>
                {d.riskFlags.map((r) => (
                  <div key={r.label} className={a.riskRow}>
                    <span
                      className={`${s.chip} ${r.resolved ? s.chipSuccess : r.severity === "high" ? s.chipDanger : s.chipWarning}`}
                    >
                      {r.resolved ? "resolved" : `${r.severity} · open`}
                    </span>
                    <div>
                      <div>{r.label}</div>
                      <div className={a.auditNote}>{r.note}</div>
                    </div>
                    <span className={s.mono}>
                      {r.requiresReview ? "review required" : "informational"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={`${s.card} ${s.internal}`} aria-labelledby="review">
            <div className={s.cardTitle}>
              <h2 className={s.h2} id="review" style={{ margin: 0 }}>
                Internal review
              </h2>
              <span className={s.mono} style={{ color: "var(--ns-warning)" }}>
                internal — never in client preview
              </span>
            </div>
            {d.reviewRequirement === "none" ? (
              <p className={s.muted}>
                Historical record; no review workflow applies. Nothing here can be edited.
              </p>
            ) : (
              <dl className={s.kv}>
                <dt>Author</dt>
                <dd>{review.author ?? "—"}</dd>
                <dt>Reviewed by (must differ from author)</dt>
                <dd>{review.reviewedBy ?? "—"}</dd>
                <dt>Reviewed at</dt>
                <dd>{review.reviewedAt ?? "—"}</dd>
                <dt>Second-person gate</dt>
                <dd>
                  <span
                    className={`${s.chip} ${review.canSend ? s.chipSuccess : s.chipWarning}`}
                  >
                    {review.canSend ? "passes" : "blocks issue"}
                  </span>
                </dd>
              </dl>
            )}
            <p className={s.muted} style={{ marginTop: 12, fontSize: 13 }}>
              {review.reason}
            </p>
            {d.internalNotes.length ? (
              <>
                <span className={s.mono}>Internal notes</span>
                <ul className={a.bullets} style={{ marginTop: 6 }}>
                  {d.internalNotes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>

          <section aria-labelledby="preview">
            <h2 className={s.h2} id="preview">
              Client preview
            </h2>
            <div className={a.preview}>
              <div className={a.previewBar}>
                <span>Read-only · exactly what the client sees</span>
                <span>no internal notes, risk flags, costs or margins</span>
              </div>
              <div className={a.previewBody}>
                <p className={a.previewTitle}>
                  {d.type} · {d.version}
                </p>
                <p className={s.muted} style={{ margin: 0 }}>
                  Prepared for {d.facts.legalEntity ?? "[legal entity to be confirmed]"} ·{" "}
                  {d.project}
                  {d.expiresOn ? ` · valid until ${d.expiresOn}` : ""}
                </p>
                <div className={a.previewSection}>
                  <h4>Summary</h4>
                  <ul className={a.bullets}>
                    {d.clientSummary.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
                {d.scope.included.length ? (
                  <div className={a.previewSection}>
                    <h4>Scope</h4>
                    <ul className={a.bullets}>
                      {d.scope.included.map((i) => (
                        <li key={i}>{i}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {d.scope.excluded.length ? (
                  <div className={a.previewSection}>
                    <h4>Not included</h4>
                    <ul className={a.bullets}>
                      {d.scope.excluded.map((i) => (
                        <li key={i}>{i}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {d.pricing.length ? (
                  <div className={a.previewSection}>
                    <h4>Charges</h4>
                    <ul className={a.bullets}>
                      {d.pricing.map((p) => (
                        <li key={p.label}>
                          {p.label}:{" "}
                          {p.cadence === "n/a"
                            ? "no amount until a service schedule is accepted"
                            : `${money(p.amount)} ${p.cadence === "monthly" ? "per month" : p.cadence} · ${p.taxBasis === "pending decision" ? "tax treatment to be confirmed" : p.taxBasis}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {d.approvedWordingPlaceholder ? (
                  <div className={a.previewSection}>
                    <h4>Ongoing service</h4>
                    <div className={a.wording}>{d.approvedWordingPlaceholder}</div>
                  </div>
                ) : null}
                <p className={s.mono} style={{ marginTop: 16 }}>
                  Preview cannot accept, sign or pay. Acceptance happens in the client
                  portal by an authorised signatory.
                </p>
              </div>
            </div>
          </section>

          <section className={s.card} aria-labelledby="audit">
            <div className={s.cardTitle}>
              <h2 className={s.h2} id="audit" style={{ margin: 0 }}>
                Audit trail
              </h2>
              <span className={s.mono}>sent and viewed are evidence, not acceptance</span>
            </div>
            <ul className={a.audit}>
              {d.audit.map((e) => (
                <li key={e.at + e.event} className={a.auditRow}>
                  <span className={s.mono}>{e.at}</span>
                  <div>
                    <div>
                      {e.event} <span className={s.faint}>· {e.actor}</span>
                    </div>
                    {e.note ? <div className={a.auditNote}>{e.note}</div> : null}
                  </div>
                  <span className={`${s.chip} ${auditTone(e.kind)}`}>
                    {auditLabel[e.kind]}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className={a.aside}>
          <section className={s.card} aria-labelledby="blockers">
            <div className={s.cardTitle}>
              <h2 className={s.h2} id="blockers" style={{ margin: 0 }}>
                {preIssue ? "Issue blockers" : "Open items"}
              </h2>
              <span className={s.mono}>{preIssue ? "must be clear" : "post-issue"}</span>
            </div>
            {d.legacy ? (
              <p className={s.muted}>Not applicable to a protected legacy record.</p>
            ) : blockers.length === 0 ? (
              <div className={a.blockerClear}>
                <span className={`${s.chip} ${s.chipSuccess}`}>clear</span>
                <span className={s.muted}>No structural blockers.</span>
              </div>
            ) : (
              <div>
                {blockers.map((b) => (
                  <div key={b.code} className={a.blocker}>
                    <span
                      className={`${a.blockerDot} ${preIssue ? "" : a.blockerDotOpen}`}
                      aria-hidden="true"
                    />
                    <div>
                      <div style={{ fontWeight: 600 }}>{b.label}</div>
                      <div className={a.auditNote}>{b.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!d.legacy ? (
              <p className={s.muted} style={{ marginTop: 12, fontSize: 13 }}>
                {preIssue
                  ? issue.ok
                    ? "All gates pass; issuing freezes a rendered snapshot and hash."
                    : `Cannot issue: ${issue.reasons.join("; ")}`
                  : "This version is frozen. Open items are resolved by an amendment or a new version, never by editing the snapshot."}
              </p>
            ) : null}
          </section>

          <section className={s.card} aria-labelledby="status-meaning">
            <h2 className={s.h2} id="status-meaning">
              Status
            </h2>
            <div style={{ marginBottom: 8 }}>
              <span className={`${s.chip} ${statusTone(d.status)}`}>{d.status}</span>
            </div>
            <p className={s.muted} style={{ fontSize: 13, margin: 0 }}>
              {statusMeaning(d.status)}
            </p>
          </section>

          <section className={s.card} aria-labelledby="links">
            <h2 className={s.h2} id="links">
              Related
            </h2>
            <ul className={s.list}>
              <li className={s.listItem}>
                <span>Client workspace</span>
                <Link href={`/admin/next/clients/${d.clientId}`} className={s.rowLink}>
                  {d.client}
                </Link>
              </li>
              {d.facts.quoteRef ? (
                <li className={s.listItem}>
                  <span>Quote</span>
                  <span className={s.muted}>
                    {d.facts.quoteRef.id} {d.facts.quoteRef.version}
                  </span>
                </li>
              ) : null}
              <li className={s.listItem}>
                <span>All documents for this client</span>
                <Link
                  href={`/admin/next/agreements?client=${d.clientId}`}
                  className={s.rowLink}
                >
                  Library
                </Link>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}

function statusMeaning(status: string): string {
  switch (status) {
    case "Draft":
      return "Editable. Nothing has been issued; no client can see it.";
    case "Needs internal review":
      return "Waiting for a staff member other than the author to review it.";
    case "Ready to issue":
      return "Reviewed and unblocked; issuing freezes the rendered snapshot.";
    case "Awaiting client":
      return "Issued and sent. Sent and viewed are evidence only; the status changes on the client's explicit acceptance or rejection.";
    case "Accepted":
      return "Accepted by an authorised signatory. Snapshot, hash, actor and method are recorded.";
    case "Rejected":
      return "Declined by the client with a reason. A new version may follow.";
    case "Superseded":
      return "Replaced by a later version. Preserved unchanged for the record.";
    case "Withdrawn":
      return "Withdrawn by Nullshift before acceptance, with a reason.";
    default:
      return "";
  }
}

function Missing({ text = "Missing" }: { text?: string }) {
  return (
    <span className={`${s.chip} ${s.chipDanger}`} style={{ textTransform: "none" }}>
      {text}
    </span>
  );
}

function ScopeList({
  label,
  items,
  empty,
}: {
  label: string;
  items: string[];
  empty: string;
}) {
  return (
    <div className={s.field}>
      <span className={`${s.mono} ${s.fieldLabel}`}>{label}</span>
      <div className={s.fieldValue}>
        {items.length ? (
          <ul className={a.bullets}>
            {items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        ) : (
          <span className={s.muted}>{empty}</span>
        )}
      </div>
    </div>
  );
}
