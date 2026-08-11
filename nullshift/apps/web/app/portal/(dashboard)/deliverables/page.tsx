import Link from "next/link";
import { createClient } from "@nullshift/db";
import { signDeliverableUrl } from "@nullshift/db/documents";
import { T } from "@nullshift/ui/tokens";
import { PageHeader } from "@/components/app/AppKit";
import { Reveal } from "@/components/Reveal";

/**
 * Client portal — deliverables. The client downloads their own tenant's
 * versioned files (Storage RLS + the documents index scope everything to their
 * tenant). Each download is a short-lived signed URL minted at render.
 */

export const dynamic = "force-dynamic";

type Doc = {
  id: string;
  project_id: string;
  kind: string;
  storage_path: string;
  version: number;
};
type Project = { id: string; name: string };

export default async function DeliverablesPage() {
  const supabase = await createClient();
  const [{ data: docs }, { data: projects }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, project_id, kind, storage_path, version")
      .order("created_at", { ascending: false }),
    supabase.from("projects").select("id, name, proposal_status, accepted_at"),
  ]);
  const docList = (docs ?? []) as Doc[];
  const projectList = (projects ?? []) as (Project & {
    proposal_status: string;
    accepted_at: string | null;
  })[];
  // Contracts live on the Agreement page — surface them here too, since
  // "Documents" is where people go looking for signed paperwork.
  const signed = projectList.find((p) => p.proposal_status === "accepted");
  const awaiting = projectList.find((p) => p.proposal_status === "sent");
  const nameOf = (id: string) => projectList.find((p) => p.id === id)?.name ?? "Project";

  // Mint a signed URL per document (RLS lets the client read only their tenant's).
  const withUrls = await Promise.all(
    docList.map(async (d) => ({
      ...d,
      url: await signDeliverableUrl(supabase, d.storage_path),
    }))
  );

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 16px 56px" }}>
      <PageHeader
        index="07"
        label="DELIVERABLES"
        title="Your files"
        lead="Every asset we ship lands here — versioned, and yours to download any time."
      />

      {/* Signed paperwork lives on the Agreement page — link it from here,
          because "Documents" is the first place people look for contracts. */}
      {(signed || awaiting) && (
        <Reveal>
          <div
            className="k-kard flex flex-wrap items-center justify-between gap-x-4 gap-y-3"
            style={{
              marginTop: 24,
              padding: "14px 16px",
              background: "var(--k-surface)",
            }}
          >
            <div className="flex flex-col min-w-0" style={{ gap: 2 }}>
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: "0.62rem",
                  fontWeight: 500,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--k-muted)",
                }}
              >
                {"// CONTRACTS"}
              </span>
              <span
                style={{
                  fontFamily: T.sans,
                  fontWeight: 600,
                  fontSize: "0.92rem",
                  color: "var(--k-fg)",
                }}
              >
                {signed
                  ? `Proposal & agreement — signed${
                      signed.accepted_at
                        ? " " +
                          new Date(signed.accepted_at).toLocaleDateString("en-GB")
                        : ""
                    }`
                  : "Proposal & agreement — awaiting your signature"}
              </span>
            </div>
            <Link
              href="/portal/proposal"
              className="kb kb-sm"
              style={{ flexShrink: 0 }}
            >
              {signed ? "View & download PDF" : "Review & sign"}
              <span className="k-arrow" aria-hidden>
                →
              </span>
            </Link>
          </div>
        </Reveal>
      )}

      <div
        className="k-kard"
        style={{
          background: "var(--k-surface)",
          marginTop: 24,
          overflow: "hidden",
        }}
      >
        {withUrls.length > 0 && (
          <div
            className="hidden sm:flex items-center gap-3"
            style={{
              padding: "10px 16px",
              borderBottom: "1px solid var(--k-border)",
              fontFamily: T.mono,
              fontSize: "0.62rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--k-faint)",
            }}
          >
            <span style={{ width: 36, flexShrink: 0 }}>Ver</span>
            <span style={{ flex: 1 }}>File</span>
            <span style={{ flexShrink: 0 }}>Action</span>
          </div>
        )}

        {withUrls.map((d, i) => (
          <Reveal key={d.id} delay={i * 0.05}>
            <div
              className="flex items-center justify-between gap-3"
              style={{
                padding: "12px 16px",
                borderBottom:
                  i < withUrls.length - 1 ? "1px solid var(--k-border)" : undefined,
              }}
            >
              <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.7rem",
                    letterSpacing: "0.06em",
                    color: "var(--k-accent)",
                    width: 36,
                    flexShrink: 0,
                  }}
                >
                  v{d.version}
                </span>
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.62rem",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--k-faint)",
                  }}
                >
                  {d.kind}
                </span>
                <span
                  style={{
                    fontFamily: T.sans,
                    fontSize: "0.88rem",
                    color: "var(--k-fg)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {d.storage_path.split("/").pop()}
                </span>
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.62rem",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--k-faint)",
                  }}
                >
                  · {nameOf(d.project_id)}
                </span>
              </div>
              {d.url ? (
                <a href={d.url} className="kb kb-primary kb-sm" style={{ flexShrink: 0 }}>
                  ↓ Download
                </a>
              ) : (
                <span
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.62rem",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--k-faint)",
                  }}
                >
                  unavailable
                </span>
              )}
            </div>
          </Reveal>
        ))}
        {withUrls.length === 0 && (
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.88rem",
              color: "var(--k-faint)",
              padding: 18,
            }}
          >
            No files yet — designs, exports and handover packs appear here as we
            ship them. Your proposal and signed agreement live under Agreement.
          </p>
        )}
      </div>
    </div>
  );
}
