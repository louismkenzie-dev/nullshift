import React from "react";

/**
 * Avatar — a circular identity chip. Pass `src` for an image, or `initials`
 * for a mono monogram on the surface tier. Optional `status` dot (a signal
 * tone) sits bottom-right. Sizes are pixel diameters.
 */
export function Avatar({
  src = null,
  initials = "",
  alt = "",
  size = 36,
  status = null,
  className = "",
  style = {},
}) {
  const statusColors = {
    online: "var(--success)",
    busy: "var(--danger)",
    away: "var(--warning)",
    offline: "var(--faint)",
  };
  return (
    <span
      className={className}
      style={{
        position: "relative",
        display: "inline-grid",
        placeItems: "center",
        width: size,
        height: size,
        borderRadius: "var(--radius-full)",
        background: "var(--surface)",
        border: "1px solid var(--border-strong)",
        overflow: "visible",
        flexShrink: 0,
        ...style,
      }}
    >
      {src ? (
        <img src={src} alt={alt} style={{ width: "100%", height: "100%", borderRadius: "var(--radius-full)", objectFit: "cover" }} />
      ) : (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: size * 0.36, fontWeight: 500, letterSpacing: "0.02em", color: "var(--muted)", textTransform: "uppercase" }}>
          {initials.slice(0, 2)}
        </span>
      )}
      {status && (
        <span
          style={{
            position: "absolute",
            right: -1,
            bottom: -1,
            width: Math.max(8, size * 0.26),
            height: Math.max(8, size * 0.26),
            borderRadius: "var(--radius-full)",
            background: statusColors[status] || statusColors.offline,
            border: "2px solid var(--bg)",
          }}
        />
      )}
    </span>
  );
}
