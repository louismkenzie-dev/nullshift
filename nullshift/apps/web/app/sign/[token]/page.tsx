import type { Metadata } from "next";
import Link from "next/link";
import { createClient, createServiceClient } from "@nullshift/db";
import { legalConfig, statutoryDisclosure } from "@nullshift/content/legal/config";
import { T } from "@nullshift/ui/tokens";
import { SignatureDocument } from "@/components/signing/SignatureDocument";
import { SignForm } from "@/components/signing/SignForm";
import { linkExpired, STATUS_LABEL_CLIENT } from "@/lib/signing/model";
import {
  certificateUrl,
  contentOf,
  dateTimeGB,
  loadSignatureEvents,
  loadSignatureRequestByToken,
  requestEvidence,
  signaturesOf,
} from "@/lib/signing/data";
import { recordOpened } from "@/lib/signing/engine";
import { declineByToken, signByToken } from "./actions";

/**
 * The signing page a client reaches from their email — no login, the link is
 * the credential. Renders the frozen document, records the first open, and
 * offers the signature block while the document is open for signing; after
 * that it shows the signed document and the download.
 *
 * Lives outside /portal on purpose: the signer may have no portal account
 * (a county officer countersigning for a client, say), and the portal
 * layout's DPA gate and staff bounce have no business here.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Sign a document",
  robots: { index: false, follow: false },
};

const mono: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "0.66rem",
  fontWeight: 500,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--k-muted)",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="k-dark" style={{ minHeight: "100vh", background: "var(--k-bg)", color: "var(--k-fg)" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px clamp(16px, 4vw, 40px)",
          borderBottom: "1px solid var(--k-border)",
        }}
      >
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <span aria-hidden style={{ display: "inline-block", width: 7, height: 18, background: "var(--k-fg)" }} />
          <span aria-hidden style={{ display: "inline-block", width: 7, height: 18, background: "var(--k-accent)" }} />
          <span style={{ fontFamily: T.sans, fontWeight: 800, fontSize: "0.95rem", letterSpacing: "0.06em", color: "var(--k-fg)" }}>
            NULLSHIFT
          </span>
        </Link>
        <span style={mono}>Secure signing</span>
      </header>
      <main style={{ maxWidth: 860, margin: "0 auto", padding: "clamp(20px, 4vw, 40px) 16px 60px" }}>{children}</main>
      <footer style={{ padding: "18px clamp(16px, 4vw, 40px) 30px", borderTop: "1px solid var(--k-border)" }}>
        <p style={{ fontFamily: T.sans, fontSize: "0.76rem", color: "var(--k-faint)", lineHeight: 1.6, margin: 0 }}>
          {statutoryDisclosure()}. Questions about this document: {legalConfig.contact.legal}.
        </p>
      </footer>
    </div>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--k-border)", background: "var(--k-surface)", padding: "26px 28px" }}>
      <span style={mono}>{title}</span>
      <p style={{ fontFamily: T.sans, fontSize: "1rem", lineHeight: 1.7, color: "var(--k-fg)", marginTop: 10 }}>{children}</p>
    </div>
  );
}

export default async function PublicSigningPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const service = createServiceClient();
  const row = await loadSignatureRequestByToken(service, token);

  if (!row || row.status === "draft") {
    return (
      <Shell>
        <Notice title="Link not recognised">
          This signing link isn&apos;t valid. It may have been replaced by a newer one — check for a later
          email from Nullshift, or reply to the one you have and we&apos;ll send a fresh link.
        </Notice>
      </Shell>
    );
  }

  const content = contentOf(row);
  if (!content) {
    return (
      <Shell>
        <Notice title="Document unavailable">
          This document&apos;s stored content does not match its record, so it cannot be shown or signed.
          Nullshift has been made aware. Please contact {legalConfig.contact.legal}.
        </Notice>
      </Shell>
    );
  }

  const events = await loadSignatureEvents(service, row.id);
  const signatures = signaturesOf(events);
  const nullshiftName = legalConfig.entity.legalName;
  const open = row.status === "issued" && !linkExpired(row.expires_at);

  // Who is looking, for the evidence row: the link's addressee, plus the
  // portal session if there happens to be one.
  let actorUser: string | null = null;
  let actorEmail: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    actorUser = user?.id ?? null;
    actorEmail = user?.email ?? null;
  } catch {
    /* no session — expected */
  }
  if (open) await recordOpened(service, row, { userId: actorUser, email: actorEmail, ...(await requestEvidence()) });

  return (
    <Shell>
      <div style={{ marginBottom: 18 }}>
        <span style={{ ...mono, color: "var(--k-accent)" }}>{STATUS_LABEL_CLIENT[row.status]}</span>
        <h1 style={{ fontFamily: T.sans, fontWeight: 700, fontSize: "clamp(1.3rem, 3vw, 1.7rem)", letterSpacing: "-0.02em", color: "var(--k-fg)", margin: "6px 0 0" }}>
          {open
            ? `${content.signer.name.split(" ")[0] || "Hello"} — please read and sign`
            : row.status === "completed"
              ? "This document is signed by both parties"
              : row.status === "signed"
                ? "Thank you — your signature is recorded"
                : row.status === "declined"
                  ? "You declined this document"
                  : row.status === "voided"
                    ? "Nullshift has withdrawn this document"
                    : "This signing link has expired"}
        </h1>
        <p style={{ fontFamily: T.sans, fontSize: "0.92rem", lineHeight: 1.65, color: "var(--k-muted)", marginTop: 8 }}>
          {open
            ? `Sent to ${content.signer.email} by ${nullshiftName}. Read the whole document; the signature block is at the bottom. If anything is wrong, decline it and tell us why — nothing is agreed until you sign.`
            : row.status === "completed"
              ? `Signed ${dateTimeGB(row.signed_at)} and countersigned ${dateTimeGB(row.countersigned_at)}. Download the completed copy for your records.`
              : row.status === "signed"
                ? `Signed ${dateTimeGB(row.signed_at)}. Nullshift will countersign and send you the completed copy.`
                : row.status === "expired" || (row.status === "issued" && !open)
                  ? "The link was valid for 30 days. Reply to the email you were sent and we will issue a fresh one."
                  : "Nothing is agreed under this document."}
        </p>
        {(row.status === "signed" || row.status === "completed") && (
          <a href={certificateUrl(row.id, token)} className="kb kb-outline kb-sm" style={{ display: "inline-flex", marginTop: 12 }}>
            Download the {row.status === "completed" ? "completed" : "signed"} copy (PDF) ↓
          </a>
        )}
      </div>

      <SignatureDocument content={content} hash={row.document_hash} signatures={signatures} nullshiftName={nullshiftName} />

      {open && (
        <div style={{ marginTop: 18 }}>
          <SignForm
            signAction={signByToken}
            declineAction={declineByToken}
            credential={{ token }}
            signerName={content.signer.name}
            signerRole={content.signer.role}
            clientName={content.client.name}
          />
          <p style={{ fontFamily: T.sans, fontSize: "0.78rem", color: "var(--k-faint)", lineHeight: 1.6, marginTop: 14 }}>
            When you sign, we record your typed name, the confirmations you ticked, the time, your IP address
            and browser, and the SHA-256 fingerprint of this exact document. That record and a PDF copy are
            sent to you. We keep them as evidence of the agreement, under our{" "}
            <Link href={legalConfig.routes.privacy} style={{ color: "var(--k-accent)" }}>
              privacy notice
            </Link>
            .
          </p>
        </div>
      )}
    </Shell>
  );
}
