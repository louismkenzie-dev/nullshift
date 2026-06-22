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
    supabase.from("projects").select("id, name"),
  ]);
  const docList = (docs ?? []) as Doc[];
  const projectList = (projects ?? []) as Project[];
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
        index="01"
        label="DELIVERABLES"
        title="Your files"
        lead="Every asset we ship lands here — versioned, and yours to download any time."
      />

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
            No deliverables yet — they&apos;ll appear here as we ship them.
          </p>
        )}
      </div>
    </div>
  );
}
