import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@nullshift/db";
import { legalConfig } from "@nullshift/content/legal/config";
import { T } from "@nullshift/ui/tokens";
import { getPortalClient } from "@/lib/clientPreview";
import { PageHeader, StatusChip } from "@/components/app/AppKit";
import { SignatureDocument } from "@/components/signing/SignatureDocument";
import { SignForm } from "@/components/signing/SignForm";
import {
  linkExpired,
  STATUS_LABEL_CLIENT,
  statusTone,
  type SignatureRequestRow,
} from "@/lib/signing/model";
import { contentOf, dateTimeGB, loadSignatureEvents, requestEvidence, signaturesOf } from "@/lib/signing/data";
import { recordOpened } from "@/lib/signing/engine";
import { REQUEST_COLUMNS } from "@/lib/signing/data";
import { declineInPortal, signInPortal } from "./actions";

/**
 * The same document, inside the portal. Read through RLS (a member sees their
 * own tenant's non-draft requests), signed with the session as the credential.
 */
export const dynamic = "force-dynamic";

export default async function PortalSignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, preview } = await getPortalClient();
  const { data } = await supabase.from("signature_requests").select(REQUEST_COLUMNS).eq("id", id).maybeSingle();
  const row = (data as unknown as SignatureRequestRow | null) ?? null;
  if (!row || row.status === "draft") notFound();

  const content = contentOf(row);
  const service = createServiceClient();
  const events = await loadSignatureEvents(service, row.id);
  const signatures = signaturesOf(events);
  const nullshiftName = legalConfig.entity.legalName;
  const open = row.status === "issued" && !linkExpired(row.expires_at);

  if (open && user && !preview)
    await recordOpened(service, row, { userId: user.id, email: user.email ?? null, ...(await requestEvidence()) });

  return (
    <div className="flex flex-col gap-6" style={{ maxWidth: 900 }}>
      <Link
        href="/portal/legal"
        style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--k-muted)", textDecoration: "none" }}
      >
        ← Your agreement
      </Link>
      <PageHeader
        index="/08"
        label={row.reference}
        title={row.title}
        lead={
          open
            ? "Read the whole document, then sign at the bottom. Nothing is agreed until you do."
            : row.status === "completed"
              ? `Signed ${dateTimeGB(row.signed_at)}, countersigned ${dateTimeGB(row.countersigned_at)}.`
              : row.status === "signed"
                ? `Signed ${dateTimeGB(row.signed_at)} — Nullshift will countersign and send you the completed copy.`
                : STATUS_LABEL_CLIENT[row.status]
        }
        actions={
          <>
            <StatusChip tone={statusTone(row.status) === "accent" ? "accent" : statusTone(row.status)}>
              {STATUS_LABEL_CLIENT[row.status]}
            </StatusChip>
            {(row.status === "signed" || row.status === "completed") && (
              <a href={`/api/sign/${row.id}/certificate`} className="kb kb-outline kb-sm">
                PDF ↓
              </a>
            )}
          </>
        }
      />

      {content ? (
        <SignatureDocument content={content} hash={row.document_hash} signatures={signatures} nullshiftName={nullshiftName} />
      ) : (
        <p style={{ fontFamily: T.sans, color: T.danger }}>
          This document&apos;s stored content does not match its record. Please contact {legalConfig.contact.legal}.
        </p>
      )}

      {open && content && (
        <SignForm
          signAction={signInPortal}
          declineAction={declineInPortal}
          credential={{ requestId: row.id }}
          signerName={content.signer.name}
          signerRole={content.signer.role}
          clientName={content.client.name}
          disabled={!!preview}
        />
      )}
    </div>
  );
}
