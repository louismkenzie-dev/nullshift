import { T } from "@nullshift/ui/tokens";
import { exitClientPreview } from "@/lib/clientPreviewActions";
import type { PortalPreview } from "@/lib/clientPreview";

/**
 * The staff view-as-client banner — pinned above the portal while a preview is
 * active. Says whose portal this is, that it's read-only, and offers the one
 * exit. The style tag renders every portal form inert so a stray click can't
 * fire an action (the actions themselves also hard-bail via isClientPreview —
 * this is the visible half of that guarantee).
 */
export function PreviewBanner({
  preview,
  gateNote,
}: {
  preview: PortalPreview;
  gateNote?: string | null;
}) {
  const who = preview.contactName
    ? `${preview.contactName} — ${preview.tenantName}`
    : preview.tenantName;
  return (
    <>
      {/* Forms inert during preview; the exit form opts itself back in. */}
      <style>{`
        .ns-preview-inert main form { pointer-events: none; opacity: 0.55; }
        form.ns-preview-exit { pointer-events: auto !important; opacity: 1 !important; }
      `}</style>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 60,
          background: "#231a04",
          borderBottom: `1px solid ${T.warning}55`,
        }}
      >
        <div
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 sm:px-6"
          style={{ maxWidth: 880, margin: "0 auto", padding: "9px 16px" }}
        >
          <span
            style={{
              fontFamily: T.mono,
              fontSize: "0.64rem",
              fontWeight: 500,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: T.warning,
            }}
          >
            View-only preview · seeing the portal as {who}
          </span>
          <form action={exitClientPreview} className="ns-preview-exit">
            <button
              type="submit"
              style={{
                fontFamily: T.mono,
                fontSize: "0.64rem",
                fontWeight: 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: T.warning,
                background: "transparent",
                border: `1px solid ${T.warning}66`,
                padding: "4px 12px",
                cursor: "pointer",
              }}
            >
              Exit preview →
            </button>
          </form>
        </div>
        {gateNote && (
          <div
            className="px-4 sm:px-6"
            style={{
              maxWidth: 880,
              margin: "0 auto",
              padding: "0 16px 9px",
            }}
          >
            <span
              style={{
                fontFamily: T.sans,
                fontSize: "0.78rem",
                lineHeight: 1.5,
                color: "#d8c9a0",
              }}
            >
              {gateNote}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
