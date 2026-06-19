import { createClient } from "@nullshift/db";
import { signDeliverableUrl } from "@nullshift/db/documents";
import { T } from "@nullshift/ui/tokens";

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
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px" }}>
      <div
        style={{
          fontFamily: T.mono,
          fontSize: "10px",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: T.primary,
          marginBottom: 8,
        }}
      >
        {"// Deliverables"}
      </div>
      <h1
        style={{
          fontFamily: T.display,
          fontWeight: 600,
          fontSize: "1.8rem",
          color: T.fg,
          marginBottom: 6,
        }}
      >
        Your files
      </h1>
      <p
        style={{
          fontFamily: T.sans,
          fontSize: "0.9rem",
          color: T.muted,
          marginBottom: 28,
        }}
      >
        Every asset we ship lands here — versioned, and yours to download any time.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {withUrls.map((d) => (
          <div
            key={d.id}
            className="flex items-center justify-between gap-3"
            style={{
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: T.r.md,
              padding: "12px 16px",
            }}
          >
            <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
              <span style={{ fontFamily: T.mono, fontSize: "11px", color: T.primary }}>
                v{d.version}
              </span>
              <span style={{ fontFamily: T.mono, fontSize: "10px", color: T.faint }}>
                {d.kind}
              </span>
              <span
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.88rem",
                  color: T.fg,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {d.storage_path.split("/").pop()}
              </span>
              <span style={{ fontFamily: T.mono, fontSize: "10px", color: T.faint }}>
                · {nameOf(d.project_id)}
              </span>
            </div>
            {d.url ? (
              <a
                href={d.url}
                style={{
                  fontFamily: T.mono,
                  fontSize: "10px",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  height: 28,
                  display: "inline-flex",
                  alignItems: "center",
                  paddingInline: 12,
                  background: T.primary,
                  color: T.primaryFg,
                  borderRadius: 5,
                  textDecoration: "none",
                  flexShrink: 0,
                }}
              >
                ↓ Download
              </a>
            ) : (
              <span style={{ fontFamily: T.mono, fontSize: "10px", color: T.faint }}>
                unavailable
              </span>
            )}
          </div>
        ))}
        {withUrls.length === 0 && (
          <p style={{ fontFamily: T.sans, fontSize: "0.88rem", color: T.faint }}>
            No deliverables yet — they&apos;ll appear here as we ship them.
          </p>
        )}
      </div>
    </div>
  );
}
