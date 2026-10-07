import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { legalConfig } from "@nullshift/content/legal/config";
import { T } from "@nullshift/ui/tokens";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { StatusChip } from "@/components/app/AppKit";
import { SignatureDocument } from "@/components/signing/SignatureDocument";
import { parseDocumentSource } from "@/lib/signing/blocks";
import {
  agreementClauses,
  commercialToText,
  EVENT_LABEL,
  hashFingerprint,
  KIND_LABEL,
  linkExpired,
  parseCommercial,
  SIGNATURE_KINDS,
  STATUS_LABEL,
  statusTone,
  type SigningContent,
} from "@/lib/signing/model";
import {
  certificateUrl,
  contentOf,
  dateTimeGB,
  loadSignatureEvents,
  loadSignatureRequest,
  signaturesOf,
} from "@/lib/signing/data";
import { staffLabels } from "@/lib/legalReview";
import {
  countersignSignatureRequest,
  deleteSignatureDraft,
  issueSignatureRequest,
  resendSignatureLink,
  saveSignatureDraft,
  voidSignatureRequest,
} from "../actions";
import { Badge, btn, card, h2, inp, loadTenantAndProjects, monoLink } from "../../_shared";

/**
 * One signature request. While it is a draft this is the editor, with a live
 * preview of exactly what the signer will see. Once issued it is read-only:
 * the frozen document, the signer, the link, the evidence trail and the
 * actions that remain (re-send, void, countersign, download).
 */
export const dynamic = "force-dynamic";

const label: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--k-faint)",
  display: "block",
  marginBottom: 4,
};
const textarea: React.CSSProperties = {
  ...inp,
  height: "auto",
  width: "100%",
  padding: "10px 12px",
  lineHeight: 1.55,
  resize: "vertical",
};
const help: React.CSSProperties = {
  fontFamily: T.sans,
  fontSize: "0.8rem",
  color: "var(--k-faint)",
  lineHeight: 1.6,
};

export default async function SignatureRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; requestId: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { id: tenantId, requestId } = await params;
  const { notice, error } = await searchParams;
  const staff = await requireStaff();
  if (!staff.ok) notFound();
  const { tenant: t } = await loadTenantAndProjects(tenantId);

  const service = createServiceClient();
  const row = await loadSignatureRequest(service, requestId);
  if (!row || row.tenant_id !== tenantId) notFound();
  const events = await loadSignatureEvents(service, row.id);
  const labels = await staffLabels(events.map((e) => e.actor_user).filter((x): x is string => !!x));
  const nullshiftName = legalConfig.entity.legalName;

  const isDraft = row.status === "draft";
  // A draft previews from the live source; everything else from the snapshot.
  const content: SigningContent | null = isDraft
    ? {
        reference: row.reference,
        title: row.title,
        kind: row.kind,
        client: { name: t.name },
        signer: { name: row.signer_name, email: row.signer_email, role: row.signer_role },
        blocks: parseDocumentSource(row.body_source),
        commercial: parseCommercial(row.commercial),
        agreement: agreementClauses({
          kind: row.kind,
          clientName: t.name,
          nullshiftName,
          msaVersion: legalConfig.legal.clientAgreementVersion,
          hasCommercial: parseCommercial(row.commercial).lines.length > 0,
        }),
        issuedAt: new Date().toISOString(),
      }
    : contentOf(row);
  const signatures = signaturesOf(events);
  const commercial = parseCommercial(row.commercial);
  const expired = row.status === "issued" && linkExpired(row.expires_at);

  const hid = (
    <>
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="tenant_id" value={tenantId} />
    </>
  );

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto" }}>
      <Link href={`/admin/clients/${tenantId}/sign`} style={{ ...monoLink, color: "var(--k-muted)" }}>
        ← {t.name} · E-signatures
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3" style={{ marginTop: 12, marginBottom: 18 }}>
        <div>
          <span style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--k-accent)" }}>
            {row.reference} · {KIND_LABEL[row.kind]}
          </span>
          <h1 style={{ fontFamily: T.sans, fontWeight: 700, fontSize: "1.6rem", letterSpacing: "-0.02em", color: "var(--k-fg)", margin: "4px 0 0" }}>
            {row.title || "Untitled document"}
          </h1>
          <p style={{ ...help, marginTop: 6 }}>
            To {row.signer_name} &lt;{row.signer_email}&gt;{row.signer_role ? `, ${row.signer_role}` : ""}
            {row.issued_at ? ` · issued ${dateTimeGB(row.issued_at)}` : ` · drafted ${dateTimeGB(row.created_at)}`}
            {row.document_hash ? ` · SHA-256 ${hashFingerprint(row.document_hash)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusChip tone={statusTone(row.status) === "accent" ? "accent" : statusTone(row.status)}>
            {expired ? "Link expired" : STATUS_LABEL[row.status]}
          </StatusChip>
          {!isDraft && (
            <a href={certificateUrl(row.id).replace(/^https?:\/\/[^/]+/, "")} style={{ ...btn("transparent", "var(--k-fg)"), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
              PDF ↓
            </a>
          )}
        </div>
      </div>

      {(notice || error) && (
        <p
          style={{
            fontFamily: T.mono,
            fontSize: 12,
            color: error ? T.danger : "var(--k-accent)",
            border: `1px solid color-mix(in oklab, ${error ? T.danger : "var(--k-accent)"} 35%, transparent)`,
            padding: "10px 14px",
            marginBottom: 16,
          }}
        >
          {error ?? notice}
        </p>
      )}

      {/* ── Draft editor ─────────────────────────────────────────── */}
      {isDraft && (
        <section style={card}>
          <h2 style={h2}>Edit the document</h2>
          <form action={saveSignatureDraft} className="flex flex-col gap-4">
            {hid}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_200px]">
              <label>
                <span style={label}>Title</span>
                <input name="title" defaultValue={row.title} required style={{ ...inp, width: "100%" }} />
              </label>
              <label>
                <span style={label}>Kind</span>
                <select name="kind" defaultValue={row.kind} style={{ ...inp, width: "100%" }}>
                  {SIGNATURE_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label>
                <span style={label}>Signer name</span>
                <input name="signer_name" defaultValue={row.signer_name} required style={{ ...inp, width: "100%" }} />
              </label>
              <label>
                <span style={label}>Signer email</span>
                <input name="signer_email" type="email" defaultValue={row.signer_email} required style={{ ...inp, width: "100%" }} />
              </label>
              <label>
                <span style={label}>Signer role (optional)</span>
                <input name="signer_role" defaultValue={row.signer_role ?? ""} style={{ ...inp, width: "100%" }} />
              </label>
            </div>
            <label>
              <span style={label}>Document</span>
              <textarea
                name="body_source"
                defaultValue={row.body_source}
                rows={Math.min(40, Math.max(14, row.body_source.split("\n").length + 2))}
                spellCheck
                style={{ ...textarea, fontFamily: T.mono, fontSize: "0.8rem" }}
              />
              <p style={{ ...help, marginTop: 6 }}>
                Plain text. <code># Heading</code>, <code>## Sub-heading</code>, <code>- bullet</code>,{" "}
                <code>| table | cells |</code> (first row is the header), <code>&gt; callout</code>. A blank line
                starts a new paragraph. No bold or links — this is a contract, not a brochure.
              </p>
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr]">
              <label>
                <span style={label}>Costing — one line each: Label | £0.00</span>
                <textarea
                  name="commercial_lines"
                  defaultValue={commercialToText(commercial)}
                  rows={5}
                  style={{ ...textarea, fontFamily: T.mono, fontSize: "0.8rem" }}
                />
                <p style={{ ...help, marginTop: 6 }}>
                  Negative lines are discounts (−£328.75). The total is worked out and shown to the signer.
                  Leave empty for a document with no money in it.
                </p>
              </label>
              <label>
                <span style={label}>Costing note (shown under the total)</span>
                <textarea name="commercial_note" defaultValue={commercial.note ?? ""} rows={5} style={textarea} />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SubmitButton style={btn("var(--k-surface)", "var(--k-fg)")} pendingLabel="Saving…">
                Save draft
              </SubmitButton>
              <span style={help}>Saving updates the preview below. Nothing is sent until you issue it.</span>
            </div>
          </form>
        </section>
      )}

      {/* ── The document ─────────────────────────────────────────── */}
      <section style={{ marginBottom: 16 }}>
        <div className="flex items-center justify-between flex-wrap gap-2" style={{ marginBottom: 8 }}>
          <span style={{ ...label, marginBottom: 0 }}>
            {isDraft ? "Preview — exactly what the signer will see" : "The issued document, from its frozen snapshot"}
          </span>
          {!isDraft && !content && (
            <StatusChip tone="danger">Snapshot does not verify</StatusChip>
          )}
        </div>
        {content ? (
          <SignatureDocument content={content} hash={row.document_hash} signatures={signatures} nullshiftName={nullshiftName} />
        ) : (
          <p style={{ ...help, color: T.danger }}>
            The stored document does not match its hash. It must not be relied on; void it and issue a new one.
          </p>
        )}
      </section>

      {/* ── Actions ──────────────────────────────────────────────── */}
      {isDraft && (
        <section style={card}>
          <h2 style={h2}>Issue for signature</h2>
          <p style={{ ...help, marginBottom: 12 }}>
            Issuing freezes the document and its costing, records a SHA-256 of exactly this content, and emails{" "}
            {row.signer_name} a single-use link valid for 30 days. After this the wording cannot change — a
            correction is a new document.
          </p>
          <form action={issueSignatureRequest} className="flex flex-col gap-3">
            {hid}
            <label>
              <span style={label}>Message in the email (optional)</span>
              <textarea name="message" rows={2} placeholder="e.g. As discussed on the call — shout if anything needs changing before you sign." style={textarea} />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <SubmitButton style={btn("var(--k-accent)", "var(--k-on-accent)")} pendingLabel="Issuing…">
                Issue &amp; email for signature →
              </SubmitButton>
            </div>
          </form>
          <form action={deleteSignatureDraft} style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--k-border)" }}>
            {hid}
            <SubmitButton style={btn("transparent", "var(--k-faint)")} pendingLabel="Deleting…">
              Delete draft
            </SubmitButton>
          </form>
        </section>
      )}

      {row.status === "signed" && (
        <section style={card}>
          <h2 style={h2}>Countersign for {nullshiftName}</h2>
          <p style={{ ...help, marginBottom: 12 }}>
            {row.signer_name} signed {dateTimeGB(row.signed_at)}. Your typed name below is Nullshift&apos;s
            signature; countersigning completes the document and emails the completed copy to both parties.
          </p>
          <form action={countersignSignatureRequest} className="flex flex-col gap-3">
            {hid}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label>
                <span style={label}>Your full name</span>
                <input name="name" required defaultValue={labels[staff.userId] ?? ""} style={{ ...inp, width: "100%" }} />
              </label>
              <label>
                <span style={label}>Your role</span>
                <input name="role" required defaultValue="Director" style={{ ...inp, width: "100%" }} />
              </label>
            </div>
            <label className="flex items-start gap-3" style={{ cursor: "pointer" }}>
              <input type="checkbox" name="confirm" style={{ marginTop: 3 }} />
              <span style={{ fontFamily: T.sans, fontSize: "0.88rem", color: "var(--k-fg)", lineHeight: 1.6 }}>
                I am authorised to sign for {nullshiftName}, I have checked the document above is what we agreed,
                and I intend this typed signature to be binding.
              </span>
            </label>
            <div>
              <SubmitButton style={btn("var(--k-accent)", "var(--k-on-accent)")} pendingLabel="Countersigning…">
                Countersign &amp; complete →
              </SubmitButton>
            </div>
          </form>
        </section>
      )}

      {row.status === "issued" && (
        <section style={card}>
          <h2 style={h2}>Awaiting {row.signer_name}</h2>
          <p style={{ ...help, marginBottom: 12 }}>
            Link {expired ? "expired" : "expires"} {dateTimeGB(row.expires_at)}. Re-sending mints a fresh link
            and kills the old one — use it if the email went astray or the link has run out.
          </p>
          <form action={resendSignatureLink} className="flex flex-col gap-3">
            {hid}
            <label>
              <span style={label}>Message in the email (optional)</span>
              <textarea name="message" rows={2} style={textarea} />
            </label>
            <div>
              <SubmitButton style={btn("var(--k-surface)", "var(--k-fg)")} pendingLabel="Sending…">
                Re-send signing link
              </SubmitButton>
            </div>
          </form>
        </section>
      )}

      {(row.status === "issued" || row.status === "signed") && (
        <section style={card}>
          <h2 style={h2}>Void</h2>
          <p style={{ ...help, marginBottom: 12 }}>
            Withdraws the document. The link stops working, the signer is emailed, and nothing is agreed under
            it. {row.status === "signed" ? "The client's signature stays on record as evidence that they signed a document Nullshift then withdrew." : ""}
          </p>
          <form action={voidSignatureRequest} className="flex flex-wrap items-end gap-3">
            {hid}
            <label style={{ flex: 1, minWidth: 240 }}>
              <span style={label}>Reason (optional, included in the email)</span>
              <input name="reason" style={{ ...inp, width: "100%" }} />
            </label>
            <SubmitButton style={btn("transparent", T.danger)} pendingLabel="Voiding…">
              Void this document
            </SubmitButton>
          </form>
        </section>
      )}

      {/* ── Evidence ─────────────────────────────────────────────── */}
      {events.length > 0 && (
        <section style={card}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 style={{ ...h2, marginBottom: 0 }}>Signing record</h2>
            <Badge s={row.status} />
          </div>
          <div className="flex flex-col" style={{ marginTop: 10 }}>
            {events.map((e) => (
              <div key={e.id} className="flex flex-wrap gap-x-4 gap-y-1" style={{ padding: "8px 0", borderTop: "1px solid var(--k-border)" }}>
                <span style={{ fontFamily: T.mono, fontSize: 11, color: "var(--k-muted)", minWidth: 190 }}>{dateTimeGB(e.at)}</span>
                <span style={{ fontFamily: T.sans, fontSize: "0.88rem", color: "var(--k-fg)", fontWeight: 600, minWidth: 180 }}>
                  {EVENT_LABEL[e.kind]}
                </span>
                <span style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-muted)", flex: 1, minWidth: 220 }}>
                  {e.actor_kind === "staff"
                    ? (e.actor_user && labels[e.actor_user]) || e.actor_name || e.actor_email || "Nullshift"
                    : e.actor_name || e.actor_email || "Signer"}
                  {e.actor_role ? `, ${e.actor_role}` : ""}
                  {e.signature_text ? ` · signed as “${e.signature_text}”` : ""}
                  {e.ip_address ? ` · IP ${e.ip_address}` : ""}
                  {e.kind === "declined" && (e.meta as { reason?: string } | null)?.reason
                    ? ` · “${(e.meta as { reason: string }).reason}”`
                    : ""}
                  {e.document_hash ? ` · ${hashFingerprint(e.document_hash)}` : ""}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
