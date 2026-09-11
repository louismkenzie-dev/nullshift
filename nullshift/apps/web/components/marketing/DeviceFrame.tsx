import React from "react";
import { T } from "@nullshift/ui/tokens";

/** Browser / phone chrome around a product screenshot. Brand-neutral (kyma
 *  tokens), with an optional client-brand `tint` used only for the hairline
 *  under the chrome and the "preview coming" wash. The whole frame links to
 *  the live product when `url` is set. When `src` is null it renders the
 *  "Product preview coming" panel — the slot until a screenshot lands at
 *  `/clients/<slug>-site.png`. */
export function DeviceFrame({
  variant = "browser",
  src,
  alt,
  url,
  caption,
  tint,
  aspect,
}: {
  variant?: "browser" | "phone";
  src: string | null;
  alt: string;
  url?: string | null;
  /** Text in the address bar, e.g. "app.thedanceexclusive.co.uk". */
  caption: string;
  /** Client brand colour — hairline + wash only. */
  tint?: string;
  /** CSS aspect-ratio of the screen area. Defaults per variant. */
  aspect?: string;
}) {
  const phone = variant === "phone";
  const ratio = aspect ?? (phone ? "9 / 19" : "16 / 10");
  const line = tint ?? "var(--k-accent)";

  const body = (
    <>
      {/* Chrome */}
      <div
        className="flex items-center gap-2 px-3"
        style={{
          height: phone ? 26 : 34,
          borderBottom: "1px solid var(--k-border)",
          background: "var(--k-surface)",
          justifyContent: phone ? "center" : "flex-start",
        }}
      >
        {phone ? (
          <span
            aria-hidden
            style={{
              width: 56,
              height: 6,
              borderRadius: 999,
              background: "var(--k-border-strong)",
            }}
          />
        ) : (
          <>
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
            {url && (
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
                Visit ↗
              </span>
            )}
          </>
        )}
      </div>
      <div aria-hidden style={{ height: 2, background: line }} />

      {/* Screen */}
      <div
        style={{
          position: "relative",
          aspectRatio: ratio,
          overflow: "hidden",
          background: "var(--k-surface)",
        }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            loading="lazy"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "top",
              display: "block",
            }}
          />
        ) : (
          <div
            role="img"
            aria-label={`${alt} — product preview coming`}
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              background: `linear-gradient(135deg, color-mix(in srgb, ${line} 14%, var(--k-surface)), var(--k-surface) 70%)`,
            }}
          >
            {/* Wireframe hint — three faint rows */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: "12% 10%",
                display: "grid",
                gridTemplateRows: "22% 1fr 1fr",
                gap: "6%",
                opacity: 0.35,
              }}
            >
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ border: "1px dashed var(--k-border-strong)" }} />
              ))}
            </div>
            <span
              style={{
                position: "relative",
                fontFamily: T.mono,
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--k-muted)",
                background: "var(--k-bg)",
                border: "1px solid var(--k-border)",
                padding: "10px 14px",
              }}
            >
              Product preview coming
            </span>
            {url && (
              <span
                style={{
                  position: "relative",
                  fontFamily: T.mono,
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--k-accent)",
                }}
              >
                Open the live product ↗
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );

  const frameStyle: React.CSSProperties = {
    display: "block",
    border: "1px solid var(--k-border-strong)",
    background: "var(--k-bg)",
    textDecoration: "none",
    color: "inherit",
    width: "100%",
    maxWidth: phone ? 300 : undefined,
    marginInline: phone ? "auto" : undefined,
    overflow: "hidden",
  };

  return url ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Visit ${caption} — opens in a new tab`}
      className="group"
      style={frameStyle}
    >
      {body}
    </a>
  ) : (
    <div style={frameStyle}>{body}</div>
  );
}
