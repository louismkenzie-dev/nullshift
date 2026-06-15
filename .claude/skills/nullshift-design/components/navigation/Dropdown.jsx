import React from "react";

/**
 * Dropdown menu — a trigger button that opens an elevated-tier menu. Closes on
 * outside click or Escape. Items are [{ label, onSelect, danger, icon }].
 * Use `align="end"` to right-align the panel under the trigger.
 */
export function Dropdown({
  label = "Options",
  trigger = null,
  items = [],
  align = "start",
  className = "",
  style = {},
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref} className={className} style={{ position: "relative", display: "inline-block", ...style }}>
      {trigger ? (
        <span onClick={() => setOpen((v) => !v)} style={{ cursor: "pointer" }}>{trigger}</span>
      ) : (
        <button onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8, height: 36, paddingInline: 14,
            fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", fontWeight: 500,
            color: "var(--fg)", background: "transparent",
            border: "1px solid var(--border-strong)", borderRadius: "var(--radius-md)", cursor: "pointer",
            transition: "background var(--motion-base)",
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = "var(--elevated)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
          {label}
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", transform: open ? "rotate(180deg)" : "none", transition: "transform var(--motion-base)" }}>▾</span>
        </button>
      )}
      {open && (
        <div role="menu"
          style={{
            position: "absolute", top: "calc(100% + 6px)", [align === "end" ? "right" : "left"]: 0,
            minWidth: 184, zIndex: 80,
            background: "var(--elevated)", border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-lg)",
            padding: 6,
          }}>
          {items.map((it, i) => (
            it.divider ? (
              <div key={"d" + i} style={{ height: 1, background: "var(--border)", margin: "6px 4px" }} />
            ) : (
              <button key={it.label} role="menuitem"
                onClick={() => { setOpen(false); it.onSelect && it.onSelect(); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 10px",
                  fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", fontWeight: 500, textAlign: "left",
                  color: it.danger ? "var(--danger)" : "var(--fg)",
                  background: "transparent", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer",
                  transition: "background var(--motion-base)",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = it.danger ? "var(--danger-soft)" : "var(--surface)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                {it.icon && <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: it.danger ? "var(--danger)" : "var(--muted)", width: 14, textAlign: "center" }}>{it.icon}</span>}
                {it.label}
              </button>
            )
          ))}
        </div>
      )}
    </div>
  );
}
