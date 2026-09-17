import Link from "next/link";
import { quoteBuilderEnabled } from "@/lib/next/quote-data";
import { LiveQuotes } from "./LiveQuotes";
import { flagOn } from "@/lib/flags";
import { FIXTURE_STUDIO_IDS } from "@/lib/commercial/fixtures";
import { loadQuoteVersionListing } from "@/lib/commercial/quotes";
import {
  STATUS_LABEL,
  canCreateNextVersion,
  isBelowFloor,
  isContentEditable,
} from "@/lib/commercial/stateMachine";
import { formatDateUk, formatTimeUk } from "@/lib/commercial/studio";
import type { QuoteVersionListItem, QuoteVersionStatus } from "@/lib/commercial/types";
import s from "../next.module.css";
import o from "../ops.module.css";
import { Empty, Notice, first } from "../sales/ops-ui";
import {
  approveFromForm,
  createDraftFromForm,
  issueFromForm,
  nextVersionFromForm,
  requestApprovalFromForm,
  returnToDraftFromForm,
} from "./actions";

/**
 * Quote versions (brief §5.2). Fixtures while `commercialV2` is off; 0057
 * rows through the staff RLS client when on. Every button is a server action
 * that re-checks the flag, staff, preview and the state machine — the UI
 * hides nothing that the server does not also refuse.
 */

const money = (minor: number | undefined, currency: string) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format((minor ?? 0) / 100);

const chipFor = (status: QuoteVersionStatus): string => {
  switch (status) {
    case "issued":
      return s.chipInfo;
    case "accepted":
      return s.chipSuccess;
    case "internal_review":
    case "approved_to_issue":
      return s.chipWarning;
    case "declined":
    case "expired":
    case "withdrawn":
      return s.chipDanger;
    default:
      return "";
  }
};

function noticeFor(
  raw: string | undefined
): { tone: "info" | "danger"; text: string } | null {
  if (!raw) return null;
  if (raw.startsWith("ok:")) return { tone: "info", text: raw.slice(3) };
  if (raw.startsWith("err:")) {
    const [reason, ...rest] = raw.slice(4).split(":");
    const detail = rest.join(":");
    const text: Record<string, string> = {
      flag_off: "commercialV2 is off — nothing was written.",
      unauthenticated: "Sign in again to continue.",
      forbidden: "Staff only.",
      preview: "Client preview sessions cannot change quotes.",
      not_found: "That record no longer exists.",
      stale:
        "This tab was out of date — the version changed elsewhere. Reload and try again.",
      invalid: "Check the form: " + (detail || "invalid input"),
      invalid_transition: "That change is not allowed from the version's current state.",
      not_editable:
        "Content is frozen once a version is approved or issued; create a new version.",
      approver_is_author:
        "The author cannot approve their own version; a second person must.",
      reason_required:
        "The price is below the cost-derived floor — a written reason is required.",
      approval_missing: "No approval decision is recorded for this version.",
      db_error: "Database error: " + (detail || "unknown"),
    };
    return { tone: "danger", text: text[reason] ?? `Failed: ${raw.slice(4)}` };
  }
  return null;
}

function RowActions({ item }: { item: QuoteVersionListItem }) {
  const v = item.version;
  const hidden = (
    <>
      <input type="hidden" name="version_id" value={v.id} />
      <input type="hidden" name="expected_updated_at" value={v.updated_at} />
    </>
  );
  const below = isBelowFloor(v.commercial, v.internal);

  if (v.status === "draft") {
    return (
      <form action={requestApprovalFromForm}>
        {hidden}
        <button type="submit" className={s.btnSmall}>
          Request approval
        </button>
      </form>
    );
  }
  if (v.status === "internal_review") {
    return (
      <div className={s.stack} style={{ gap: 6 }}>
        <form action={approveFromForm} className={s.chips}>
          {hidden}
          <input
            className={s.search}
            style={{ maxWidth: 220 }}
            name="reason"
            placeholder={below ? "Reason (required: below floor)" : "Reason (optional)"}
            aria-label="Approval reason"
            required={below}
          />
          <button type="submit" className={s.btnSmall}>
            Approve to issue
          </button>
        </form>
        <form action={returnToDraftFromForm}>
          {hidden}
          <button type="submit" className={s.btnSmall}>
            Return to draft
          </button>
        </form>
      </div>
    );
  }
  if (v.status === "approved_to_issue") {
    return (
      <form action={issueFromForm} className={s.chips}>
        {hidden}
        <input
          className={s.search}
          style={{ maxWidth: 160 }}
          type="date"
          name="expires_at"
          aria-label="Expiry date (defaults to 30 days)"
        />
        <button type="submit" className={s.btnPrimary}>
          Issue
        </button>
      </form>
    );
  }
  if (canCreateNextVersion(v.status)) {
    return (
      <form action={nextVersionFromForm}>
        <input type="hidden" name="version_id" value={v.id} />
        <button type="submit" className={s.btnSmall}>
          New version
        </button>
      </form>
    );
  }
  return <span className={s.faint}>—</span>;
}

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (quoteBuilderEnabled()) return <LiveQuotes />;
  const sp = await searchParams;
  const notice = noticeFor(first(sp.notice));
  const live = flagOn("commercialV2");
  const listing = await loadQuoteVersionListing();

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <p className={s.mono}>
            Sales &amp; Quotes / Quote versions · source:{" "}
            {listing.source === "database"
              ? "database (commercialV2 on, migration 0057)"
              : "fixtures (commercialV2 off)"}
          </p>
          <h1 className={s.h1}>Quote versions</h1>
          <p className={s.lead}>
            Draft → Internal review → Approved to issue → Issued → Accepted / Declined /
            Expired / Superseded / Withdrawn. Content freezes once a version leaves
            review; a change after issue is a new version. Prices come from a draft
            policy, not an approved price list.
          </p>
        </div>
        <Link href="/admin/next/sales?tab=quotes" className={s.btn}>
          Back to Sales
        </Link>
      </div>

      {notice ? (
        <div style={{ marginBottom: 16 }}>
          <Notice tone={notice.tone}>{notice.text}</Notice>
        </div>
      ) : null}

      {live ? (
        <section className={o.section} style={{ marginBottom: 20 }}>
          <p className={o.sectionTitle}>New opportunity and draft quote</p>
          <form action={createDraftFromForm} className={s.chips}>
            <input
              className={s.search}
              name="legal_name"
              placeholder="Client legal name"
              aria-label="Client legal name"
              required
            />
            <input
              className={s.search}
              name="project_label"
              placeholder="Project label"
              aria-label="Project label"
              required
            />
            <input
              className={s.search}
              name="contact_email"
              type="email"
              placeholder="Contact email (optional)"
              aria-label="Contact email"
            />
            <input
              className={s.search}
              name="owner"
              placeholder="Owner (optional)"
              aria-label="Owner"
            />
            <button type="submit" className={s.btnPrimary}>
              Create draft v1
            </button>
          </form>
          <p className={s.faint} style={{ marginTop: 8 }}>
            Creates an opportunity at Scope ready and an empty v1 draft authored by you.
            Approval needs a second staff member.
          </p>
        </section>
      ) : null}

      {listing.items.length === 0 ? (
        <Empty
          title="No quote versions yet"
          body={
            live
              ? "Create a draft above. Nothing is issued until a second person approves it."
              : "Fixtures are empty for this view."
          }
        />
      ) : (
        <div className={s.card} style={{ padding: 0, overflowX: "auto" }}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Client / project</th>
                <th>Version</th>
                <th>Status</th>
                <th className={s.num}>Build price</th>
                <th>Expires</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {listing.items.map((item) => {
                const v = item.version;
                const name = item.opportunity.trading_name || item.opportunity.legal_name;
                const studioHref =
                  listing.source === "fixtures" && FIXTURE_STUDIO_IDS.has(v.id)
                    ? `/admin/next/quotes/${v.id}`
                    : null;
                const below = isBelowFloor(v.commercial, v.internal);
                return (
                  <tr key={v.id}>
                    <td>
                      {studioHref ? (
                        <Link href={studioHref} className={s.rowLink}>
                          {name}
                        </Link>
                      ) : (
                        <strong>{name}</strong>
                      )}
                      <div className={s.muted}>{item.quote.project_label}</div>
                      <div className={s.faint}>
                        <span className={s.mono}>{v.id}</span>
                      </div>
                    </td>
                    <td className={s.mono}>
                      v{v.version_no}
                      {item.quote.current_version_id === v.id ? (
                        <div className={s.faint}>current</div>
                      ) : null}
                      {v.superseded_by ? (
                        <div className={s.faint}>
                          superseded by {v.superseded_by.slice(0, 8)}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <span className={`${s.chip} ${chipFor(v.status)}`}>
                        {STATUS_LABEL[v.status]}
                      </span>
                      {isContentEditable(v.status) ? null : (
                        <div className={s.faint}>content frozen</div>
                      )}
                      {below ? (
                        <div>
                          <span className={`${s.chip} ${s.chipWarning}`}>
                            below floor
                          </span>
                        </div>
                      ) : null}
                    </td>
                    <td className={s.num}>
                      {v.commercial.build_price_minor
                        ? money(v.commercial.build_price_minor, v.currency)
                        : "—"}
                      <div className={s.faint}>{v.policy_version ?? "no policy"}</div>
                    </td>
                    <td>{formatDateUk(v.expires_at)}</td>
                    <td>
                      {formatDateUk(v.updated_at)}
                      <div className={s.faint}>{formatTimeUk(v.updated_at)}</div>
                    </td>
                    <td>
                      {live ? (
                        <RowActions item={item} />
                      ) : (
                        <span className={s.faint}>fixture</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
