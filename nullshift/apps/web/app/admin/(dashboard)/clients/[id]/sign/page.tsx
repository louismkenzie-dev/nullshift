import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { T } from "@nullshift/ui/tokens";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { StatusChip } from "@/components/app/AppKit";
import { Reveal } from "@/components/kyma";
import { KIND_LABEL, STATUS_LABEL, type SignatureRequestRow } from "@/lib/signing/model";
import { SIGNING_TEMPLATES } from "@/lib/signing/templates";
import { createSignatureDraft } from "./actions";
import {
  Badge,
  TilePage,
  btn,
  card,
  dateTimeGB,
  h2,
  inp,
  loadTenantAndProjects,
  monoLink,
} from "../_shared";

/**
 * E-signatures for one client: every document sent for signature, where it
 * is, and a form to start a new one from a template. The document itself is
 * drafted and issued on the detail page.
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

export default async function ClientSignaturesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { id: tenantId } = await params;
  const { notice, error } = await searchParams;
  const staff = await requireStaff();
  if (!staff.ok) notFound();
  const { tenant: t } = await loadTenantAndProjects(tenantId);

  const service = createServiceClient();
  const { data } = await service
    .from("signature_requests")
    .select("id, reference, kind, title, status, signer_name, signer_email, issued_at, signed_at, completed_at, expires_at, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as SignatureRequestRow[];
  const awaiting = rows.filter((r) => r.status === "issued").length;
  const toCountersign = rows.filter((r) => r.status === "signed").length;

  return (
    <TilePage
      tenantId={tenantId}
      tenantName={t.name}
      index="08"
      label="E-signatures"
      title={t.name}
      lead="Documents sent for formal signature — frozen and hashed when issued, signed through a single-use link, countersigned by Nullshift, with the full record kept."
      actions={
        <>
          {toCountersign > 0 && <StatusChip tone="accent">{toCountersign} to countersign</StatusChip>}
          {awaiting > 0 && <StatusChip tone="warning">{awaiting} awaiting signature</StatusChip>}
          {rows.length === 0 && <StatusChip tone="muted">Nothing sent yet</StatusChip>}
        </>
      }
      maxWidth={960}
    >
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

      <Reveal>
        <section style={card}>
          <h2 style={{ ...h2, marginBottom: 0 }}>Documents</h2>
          {rows.length === 0 ? (
            <p style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-faint)", marginTop: 10 }}>
              No documents yet. Start one below.
            </p>
          ) : (
            <div className="flex flex-col" style={{ marginTop: 10 }}>
              {rows.map((r) => (
                <Link
                  key={r.id}
                  href={`/admin/clients/${tenantId}/sign/${r.id}`}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"
                  style={{ padding: "10px 0", borderTop: "1px solid var(--k-border)", textDecoration: "none" }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span style={{ fontFamily: T.mono, fontSize: 11, color: "var(--k-accent)" }}>{r.reference}</span>
                    <span style={{ fontFamily: T.sans, fontSize: "0.92rem", color: "var(--k-fg)", marginLeft: 10 }}>
                      {r.title}
                    </span>
                    <span style={{ display: "block", fontFamily: T.mono, fontSize: 10, color: "var(--k-faint)", marginTop: 2 }}>
                      {KIND_LABEL[r.kind]} · to {r.signer_name} &lt;{r.signer_email}&gt;
                      {r.completed_at
                        ? ` · completed ${dateTimeGB(r.completed_at)}`
                        : r.signed_at
                          ? ` · signed ${dateTimeGB(r.signed_at)}`
                          : r.issued_at
                            ? ` · sent ${dateTimeGB(r.issued_at)}`
                            : ` · drafted ${dateTimeGB(r.created_at)}`}
                    </span>
                  </span>
                  <span title={STATUS_LABEL[r.status]}>
                    <Badge s={r.status} />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </Reveal>

      <Reveal>
        <section style={card}>
          <h2 style={h2}>New document for signature</h2>
          <p style={{ fontFamily: T.sans, fontSize: "0.85rem", color: "var(--k-muted)", lineHeight: 1.6, marginTop: -6, marginBottom: 14 }}>
            Pick a starting point and who signs. You will edit the wording and costing on the next
            screen before anything is sent — nothing goes to the client until you press Issue.
          </p>
          <form action={createSignatureDraft} className="flex flex-col gap-3">
            <input type="hidden" name="tenant_id" value={tenantId} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label>
                <span style={label}>Start from</span>
                <select name="template_id" defaultValue={SIGNING_TEMPLATES[0]?.id} style={{ ...inp, width: "100%" }}>
                  {SIGNING_TEMPLATES.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span style={label}>Title (optional — the template names it otherwise)</span>
                <input name="title" style={{ ...inp, width: "100%" }} />
              </label>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label>
                <span style={label}>Signer name</span>
                <input name="signer_name" defaultValue={t.contact_name ?? ""} required style={{ ...inp, width: "100%" }} />
              </label>
              <label>
                <span style={label}>Signer email</span>
                <input name="signer_email" type="email" defaultValue={t.contact_email ?? ""} required style={{ ...inp, width: "100%" }} />
              </label>
              <label>
                <span style={label}>Signer role (optional)</span>
                <input name="signer_role" placeholder="e.g. Head of Performance" style={{ ...inp, width: "100%" }} />
              </label>
            </div>
            <div>
              <SubmitButton style={btn("var(--k-accent)", "var(--k-on-accent)")} pendingLabel="Creating…">
                Create draft →
              </SubmitButton>
            </div>
          </form>
          <p style={{ fontFamily: T.mono, fontSize: 10, color: "var(--k-faint)", marginTop: 14, lineHeight: 1.6 }}>
            Order Forms and structured Change Orders keep their own flow on the{" "}
            <Link href={`/admin/clients/${tenantId}/agreement`} style={monoLink}>
              agreement page →
            </Link>
          </p>
        </section>
      </Reveal>
    </TilePage>
  );
}
