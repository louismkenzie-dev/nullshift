import React from "react";
import { T } from "@nullshift/ui/tokens";

/** Browser chrome around a live product demo. Brand-neutral (kyma tokens),
 *  with the client's brand colour used only for the hairline under the
 *  address bar. The address bar links to the live product in a new tab;
 *  the stage itself stays interactive. */
export function DeviceFrame({
  url,
  caption,
  tint,
  children,
}: {
  url?: string | null;
  /** Text in the address bar, e.g. "app.thedanceexclusive.co.uk". */
  caption: string;
  /** Client brand colour — hairline only. */
  tint?: string;
  children: React.ReactNode;
}) {
  const line = tint ?? "var(--k-accent)";
  const address = (
    <span
      style={{
        fontFamily: T.mono,
        fontSize: 10.5,
        letterSpacing: "0.04em",
        color: "var(--k-muted)",
        marginLeft: 6,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {caption}
    </span>
  );

  return (
    <div
      style={{
        border: "1px solid var(--k-border-strong)",
        background: "var(--k-bg)",
        overflow: "hidden",
      }}
    >
      <div
        className="flex items-center gap-2 px-3"
        style={{
          height: 34,
          borderBottom: "1px solid var(--k-border)",
          background: "var(--k-surface)",
        }}
      >
        <span className="flex gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: "var(--k-border-strong)",
              }}
            />
          ))}
        </span>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="group ml-1 flex min-w-0 flex-1 items-center gap-3"
            style={{ textDecoration: "none" }}
            aria-label={`Visit ${caption} — opens in a new tab`}
          >
            {address}
            <span
              className="ml-auto opacity-70 group-hover:opacity-100"
              style={{
                fontFamily: T.mono,
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--k-accent)",
                transition: "opacity 200ms ease",
                whiteSpace: "nowrap",
              }}
            >
              Open site ↗
            </span>
          </a>
        ) : (
          address
        )}
      </div>
      <div aria-hidden style={{ height: 2, background: line }} />
      {children}
    </div>
  );
}
