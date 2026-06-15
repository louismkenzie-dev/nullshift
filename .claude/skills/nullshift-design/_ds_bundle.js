/* @ds-bundle: {"format":3,"namespace":"NullshiftDesignSystem_7b523b","components":[{"name":"LogoMark","sourcePath":"components/brand/Logo.jsx"},{"name":"Logo","sourcePath":"components/brand/Logo.jsx"},{"name":"Button","sourcePath":"components/buttons/Button.jsx"},{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Eyebrow","sourcePath":"components/core/Eyebrow.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"},{"name":"PricingCard","sourcePath":"components/data/PricingCard.jsx"},{"name":"StatCard","sourcePath":"components/data/StatCard.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"ToastViewport","sourcePath":"components/feedback/Toast.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"Textarea","sourcePath":"components/forms/Textarea.jsx"},{"name":"Dropdown","sourcePath":"components/navigation/Dropdown.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"}],"sourceHashes":{"components/brand/Logo.jsx":"126eec55b98e","components/buttons/Button.jsx":"62c70c809263","components/core/Avatar.jsx":"622eef09d497","components/core/Badge.jsx":"01162de6c795","components/core/Card.jsx":"199959dddba1","components/core/Eyebrow.jsx":"0d3cbde76ee8","components/core/Tag.jsx":"747d2ce3073d","components/data/PricingCard.jsx":"ee0541786723","components/data/StatCard.jsx":"13e76399d2a7","components/feedback/Toast.jsx":"1483c938f9dc","components/forms/Input.jsx":"f4360122c543","components/forms/Switch.jsx":"46b2f2d571c2","components/forms/Textarea.jsx":"744398a2f570","components/navigation/Dropdown.jsx":"08333a64d78b","components/navigation/Tabs.jsx":"260f8a34a314","ui_kits/admin/nav.jsx":"7c270774f738","ui_kits/admin/views.jsx":"16f9ed96ec94","ui_kits/marketing/brief.jsx":"09adccb1d5d2","ui_kits/marketing/sections.jsx":"e107340ea422"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.NullshiftDesignSystem_7b523b = window.NullshiftDesignSystem_7b523b || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/brand/Logo.jsx
try { (() => {
/**
 * Nullshift parallel-pill mark — two staggered rounded pills lifted from the
 * brand SVG (exact coordinates), so it renders identically everywhere. The left
 * pill colour is configurable for light-on-dark lockups.
 */
function LogoMark({
  size = 24,
  leftColor = "var(--pill-light)",
  className = "",
  style = {}
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: size * 44 / 56,
    height: size,
    viewBox: "0 0 44 56",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": "true",
    className: className,
    style: style
  }, /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "0",
    width: "17",
    height: "52",
    rx: "4.5",
    fill: leftColor
  }), /*#__PURE__*/React.createElement("rect", {
    x: "25",
    y: "6",
    width: "17",
    height: "50",
    rx: "4.5",
    fill: "var(--primary)"
  }));
}

/**
 * Full Nullshift lockup: pill mark + "NULLSHIFT" wordmark in Inter 600.
 * On dark backgrounds only. Use `compact` for the sentence-case "Nullshift"
 * lockup used in nav drawers and footers.
 */
function Logo({
  size = 24,
  compact = false,
  leftColor = "var(--pill-light)",
  className = "",
  style = {}
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: className,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: size * 0.42,
      ...style
    }
  }, /*#__PURE__*/React.createElement(LogoMark, {
    size: size,
    leftColor: leftColor
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: compact ? 600 : 800,
      fontSize: size * (compact ? 0.78 : 0.86),
      letterSpacing: compact ? "-0.01em" : "var(--tracking-wordmark)",
      lineHeight: 1,
      color: "var(--fg)"
    }
  }, compact ? "Nullshift" : "NULLSHIFT"));
}
Object.assign(__ds_scope, { LogoMark, Logo });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Logo.jsx", error: String((e && e.message) || e) }); }

// components/buttons/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Nullshift button. Primary is the one emerald fill with a top-light inset.
 * Secondary and ghost stay neutral; destructive is danger-tinted. Sentence
 * case, --font-sans (never mono), --radius-md, 40–48px tall.
 */
function Button({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  iconStart = null,
  iconEnd = null,
  as = "button",
  className = "",
  style = {},
  ...rest
}) {
  const heights = {
    sm: 32,
    md: 40,
    lg: 48
  };
  const pads = {
    sm: 12,
    md: 16,
    lg: 20
  };
  const fontSizes = {
    sm: "var(--text-xs)",
    md: "var(--text-sm)",
    lg: "var(--text-sm)"
  };
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: heights[size],
    paddingInline: pads[size],
    fontFamily: "var(--font-sans)",
    fontSize: fontSizes[size],
    fontWeight: 500,
    letterSpacing: "var(--tracking-body)",
    lineHeight: 1,
    whiteSpace: "nowrap",
    borderRadius: "var(--radius-md)",
    border: "1px solid transparent",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    textDecoration: "none",
    transition: "background var(--motion-base) var(--easing-standard), border-color var(--motion-base) var(--easing-standard), opacity var(--motion-base)"
  };
  const variants = {
    primary: {
      background: "var(--primary)",
      color: "var(--primary-fg)",
      boxShadow: "var(--inset-top-light)"
    },
    secondary: {
      background: "transparent",
      color: "var(--fg)",
      borderColor: "var(--border-strong)"
    },
    ghost: {
      background: "transparent",
      color: "var(--muted)"
    },
    destructive: {
      background: "transparent",
      color: "var(--danger)",
      borderColor: "color-mix(in oklab, var(--danger) 28%, transparent)"
    }
  };
  const hoverIn = e => {
    if (disabled) return;
    const el = e.currentTarget;
    if (variant === "primary") el.style.background = "var(--primary-hover)";else if (variant === "secondary") {
      el.style.background = "var(--elevated)";
    } else if (variant === "ghost") {
      el.style.background = "var(--elevated)";
      el.style.color = "var(--fg)";
    } else if (variant === "destructive") el.style.background = "var(--danger-soft)";
  };
  const hoverOut = e => {
    const el = e.currentTarget;
    el.style.background = variants[variant].background;
    if (variant === "ghost") el.style.color = "var(--muted)";
  };
  const Comp = as;
  return /*#__PURE__*/React.createElement(Comp, _extends({
    className: className,
    style: {
      ...base,
      ...variants[variant],
      ...style
    },
    disabled: as === "button" ? disabled : undefined,
    "aria-disabled": disabled || undefined,
    onMouseEnter: hoverIn,
    onMouseLeave: hoverOut
  }, rest), iconStart, children, iconEnd);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/buttons/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Avatar.jsx
try { (() => {
/**
 * Avatar — a circular identity chip. Pass `src` for an image, or `initials`
 * for a mono monogram on the surface tier. Optional `status` dot (a signal
 * tone) sits bottom-right. Sizes are pixel diameters.
 */
function Avatar({
  src = null,
  initials = "",
  alt = "",
  size = 36,
  status = null,
  className = "",
  style = {}
}) {
  const statusColors = {
    online: "var(--success)",
    busy: "var(--danger)",
    away: "var(--warning)",
    offline: "var(--faint)"
  };
  return /*#__PURE__*/React.createElement("span", {
    className: className,
    style: {
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
      ...style
    }
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: alt,
    style: {
      width: "100%",
      height: "100%",
      borderRadius: "var(--radius-full)",
      objectFit: "cover"
    }
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: size * 0.36,
      fontWeight: 500,
      letterSpacing: "0.02em",
      color: "var(--muted)",
      textTransform: "uppercase"
    }
  }, initials.slice(0, 2)), status && /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      right: -1,
      bottom: -1,
      width: Math.max(8, size * 0.26),
      height: Math.max(8, size * 0.26),
      borderRadius: "var(--radius-full)",
      background: statusColors[status] || statusColors.offline,
      border: "2px solid var(--bg)"
    }
  }));
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
/**
 * Status badge. Signal-coloured, soft-filled, for STATUS only (new, accepted,
 * pending, lost) — never decoration. Includes a leading dot by default.
 */
function Badge({
  children,
  tone = "neutral",
  dot = true,
  className = "",
  style = {}
}) {
  const tones = {
    neutral: {
      color: "var(--muted)",
      bg: "var(--elevated)",
      border: "var(--border)"
    },
    primary: {
      color: "var(--primary)",
      bg: "var(--primary-soft)",
      border: "color-mix(in oklab, var(--primary) 35%, transparent)"
    },
    success: {
      color: "var(--success)",
      bg: "var(--success-soft)",
      border: "color-mix(in oklab, var(--success) 35%, transparent)"
    },
    warning: {
      color: "var(--warning)",
      bg: "var(--warning-soft)",
      border: "color-mix(in oklab, var(--warning) 35%, transparent)"
    },
    info: {
      color: "var(--info)",
      bg: "var(--info-soft)",
      border: "color-mix(in oklab, var(--info) 35%, transparent)"
    },
    danger: {
      color: "var(--danger)",
      bg: "var(--danger-soft)",
      border: "color-mix(in oklab, var(--danger) 35%, transparent)"
    }
  };
  const t = tones[tone] || tones.neutral;
  return /*#__PURE__*/React.createElement("span", {
    className: className,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      height: 22,
      paddingInline: 9,
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-mono-sm)",
      fontWeight: 500,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      color: t.color,
      background: t.bg,
      border: `1px solid ${t.border}`,
      borderRadius: "var(--radius-sm)",
      ...style
    }
  }, dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 5,
      height: 5,
      borderRadius: "var(--radius-full)",
      background: t.color,
      flexShrink: 0
    }
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Surface card — the default container at the `surface` tier. Hairline border
 * defines geometry; no drop shadow (only modals earn that). `interactive` adds
 * a hover lift to --elevated. `highlighted` adds an emerald edge for the
 * featured card in a set.
 */
function Card({
  children,
  interactive = false,
  highlighted = false,
  padding = 24,
  radius = "var(--radius-lg)",
  className = "",
  style = {},
  ...rest
}) {
  const base = {
    background: "var(--surface)",
    border: `1px solid ${highlighted ? "color-mix(in oklab, var(--primary) 38%, var(--border))" : "var(--border)"}`,
    borderRadius: radius,
    padding,
    boxShadow: highlighted ? "0 0 0 1px var(--primary-soft)" : "none",
    transition: "background var(--motion-base) var(--easing-standard), border-color var(--motion-base) var(--easing-standard)"
  };
  const hoverIn = e => {
    if (!interactive) return;
    e.currentTarget.style.background = "var(--elevated)";
    e.currentTarget.style.borderColor = "var(--border-strong)";
  };
  const hoverOut = e => {
    if (!interactive) return;
    e.currentTarget.style.background = "var(--surface)";
    e.currentTarget.style.borderColor = highlighted ? "color-mix(in oklab, var(--primary) 38%, var(--border))" : "var(--border)";
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    className: className,
    style: {
      ...base,
      ...style
    },
    onMouseEnter: hoverIn,
    onMouseLeave: hoverOut
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Eyebrow.jsx
try { (() => {
/**
 * Eyebrow — the section label. Emerald dot + soft ring, uppercase sans,
 * 0.08em tracking. Used once per section to name the topic. Set `mono` for the
 * "// 01 — SECTION" code-marker variant.
 */
function Eyebrow({
  children,
  mono = false,
  className = "",
  style = {}
}) {
  if (mono) {
    return /*#__PURE__*/React.createElement("span", {
      className: className,
      style: {
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-mono)",
        fontWeight: 500,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--primary)",
        ...style
      }
    }, children);
  }
  return /*#__PURE__*/React.createElement("span", {
    className: className,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-mono)",
      fontWeight: 500,
      letterSpacing: "var(--tracking-eyebrow)",
      textTransform: "uppercase",
      color: "var(--muted)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: "var(--radius-full)",
      background: "var(--primary)",
      boxShadow: "0 0 0 4px var(--primary-soft)",
      flexShrink: 0
    }
  }), children);
}
Object.assign(__ds_scope, { Eyebrow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Eyebrow.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Tag / chip — a full-radius pill for categories and filters (industries,
 * services). Emerald-tinted by default; `interactive` brightens on hover.
 */
function Tag({
  children,
  interactive = false,
  className = "",
  style = {},
  ...rest
}) {
  const hoverIn = e => {
    if (!interactive) return;
    e.currentTarget.style.background = "color-mix(in oklab, var(--primary) 14%, transparent)";
    e.currentTarget.style.borderColor = "color-mix(in oklab, var(--primary) 55%, transparent)";
  };
  const hoverOut = e => {
    if (!interactive) return;
    e.currentTarget.style.background = "color-mix(in oklab, var(--primary) 8%, transparent)";
    e.currentTarget.style.borderColor = "color-mix(in oklab, var(--primary) 30%, transparent)";
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    className: className,
    onMouseEnter: hoverIn,
    onMouseLeave: hoverOut,
    style: {
      display: "inline-flex",
      alignItems: "center",
      height: 28,
      paddingInline: 12,
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-mono)",
      fontWeight: 500,
      color: "var(--primary)",
      background: "color-mix(in oklab, var(--primary) 8%, transparent)",
      border: "1px solid color-mix(in oklab, var(--primary) 30%, transparent)",
      borderRadius: "var(--radius-full)",
      cursor: interactive ? "pointer" : "default",
      transition: "background var(--motion-base), border-color var(--motion-base)",
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// components/data/PricingCard.jsx
try { (() => {
/**
 * Pricing card — a plan tier with mono tier name, large display price,
 * benefit checklist, and a CTA. `highlighted` promotes the featured plan with
 * an emerald edge, top accent line, and a "Most popular" badge.
 */
function PricingCard({
  tier,
  price,
  bestFor,
  benefits = [],
  cta = "Book a call",
  href = "#",
  highlighted = false,
  className = "",
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: className,
    style: {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      borderRadius: "var(--radius-lg)",
      border: `1px solid ${highlighted ? "color-mix(in oklab, var(--primary) 60%, transparent)" : "var(--border)"}`,
      background: highlighted ? "linear-gradient(145deg, color-mix(in oklab, var(--primary) 7%, var(--surface)), var(--surface))" : "linear-gradient(145deg, var(--surface), var(--bg))",
      boxShadow: highlighted ? "0 0 0 1px var(--primary-soft), var(--shadow-md)" : "var(--shadow-md)",
      padding: 28,
      ...style
    }
  }, highlighted && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 2,
      background: "var(--primary)",
      boxShadow: "0 0 12px var(--primary)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      paddingBottom: 24,
      marginBottom: 24,
      borderBottom: `1px solid ${highlighted ? "color-mix(in oklab, var(--primary) 25%, transparent)" : "var(--border)"}`
    }
  }, highlighted && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 12px",
      borderRadius: "var(--radius-full)",
      marginBottom: 16,
      fontFamily: "var(--font-mono)",
      fontSize: "10px",
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: "var(--primary)",
      background: "color-mix(in oklab, var(--primary) 15%, transparent)",
      border: "1px solid color-mix(in oklab, var(--primary) 35%, transparent)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: "var(--radius-full)",
      background: "var(--primary)",
      boxShadow: "0 0 4px var(--primary)"
    }
  }), "Most popular"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontWeight: 600,
      fontSize: "0.7rem",
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      color: highlighted ? "var(--primary)" : "var(--muted)",
      marginBottom: 14
    }
  }, tier), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 700,
      fontSize: "2.5rem",
      lineHeight: 1,
      letterSpacing: "var(--tracking-display)",
      color: highlighted ? "var(--primary)" : "var(--fg)",
      marginBottom: 10
    }
  }, price), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-xs)",
      lineHeight: 1.55,
      color: "var(--muted)",
      textAlign: "center"
    }
  }, bestFor)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 14,
      flex: 1,
      marginBottom: 28
    }
  }, benefits.map((b, i) => {
    const checked = typeof b === "string" ? true : b.checked;
    const text = typeof b === "string" ? b : b.text;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "grid",
        placeContent: "center",
        width: 16,
        height: 16,
        borderRadius: "var(--radius-full)",
        flexShrink: 0,
        background: checked ? "color-mix(in oklab, var(--primary) 22%, transparent)" : "var(--elevated)",
        border: `1px solid ${checked ? "color-mix(in oklab, var(--primary) 55%, transparent)" : "var(--border)"}`,
        color: checked ? "var(--primary)" : "var(--muted)",
        fontSize: 9,
        fontFamily: "var(--font-mono)"
      }
    }, checked ? "✓" : "✕"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-xs)",
        color: checked ? "var(--fg)" : "var(--muted)"
      }
    }, text));
  })), /*#__PURE__*/React.createElement("a", {
    href: href,
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 20px",
      height: 44,
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-mono)",
      fontWeight: 600,
      letterSpacing: "0.06em",
      borderRadius: "var(--radius-md)",
      background: highlighted ? "var(--primary)" : "transparent",
      color: highlighted ? "var(--primary-fg)" : "var(--fg)",
      border: highlighted ? "none" : "1px solid var(--border)",
      boxShadow: highlighted ? "var(--glow-primary)" : "none",
      textDecoration: "none"
    }
  }, /*#__PURE__*/React.createElement("span", null, cta), /*#__PURE__*/React.createElement("span", null, "\u2192")));
}
Object.assign(__ds_scope, { PricingCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/PricingCard.jsx", error: String((e && e.message) || e) }); }

// components/data/StatCard.jsx
try { (() => {
/**
 * Stat / metric card — the admin dashboard KPI block. Mono label, large
 * display value (accent-coloured), mono sublabel. Surface tier, hairline
 * border, no shadow.
 */
function StatCard({
  label,
  value,
  sublabel = null,
  accent = "var(--primary)",
  className = "",
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: className,
    style: {
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)",
      padding: 20,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-mono-sm)",
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: "var(--muted)",
      marginBottom: 8
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 600,
      fontSize: "1.9rem",
      lineHeight: 1,
      letterSpacing: "var(--tracking-display)",
      color: accent,
      marginBottom: sublabel ? 6 : 0
    }
  }, value), sublabel && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-mono-sm)",
      color: "var(--muted)"
    }
  }, sublabel));
}
Object.assign(__ds_scope, { StatCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/StatCard.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
/**
 * Toast — a transient notification on the elevated tier with a signal-coloured
 * accent rail and status dot. Render one directly, or stack several inside a
 * `ToastViewport`. Presentational: drive visibility / timing from your app.
 */
function Toast({
  tone = "neutral",
  title,
  message = null,
  onClose = null,
  action = null,
  className = "",
  style = {}
}) {
  const tones = {
    neutral: "var(--muted)",
    primary: "var(--primary)",
    success: "var(--success)",
    warning: "var(--warning)",
    info: "var(--info)",
    danger: "var(--danger)"
  };
  const accent = tones[tone] || tones.neutral;
  return /*#__PURE__*/React.createElement("div", {
    role: "status",
    className: className,
    style: {
      position: "relative",
      display: "flex",
      alignItems: "flex-start",
      gap: 12,
      width: "min(380px, 100%)",
      padding: "14px 16px",
      paddingLeft: 18,
      background: "var(--elevated)",
      border: "1px solid var(--border-strong)",
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--shadow-lg)",
      overflow: "hidden",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 3,
      background: accent
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      marginTop: 5,
      borderRadius: "var(--radius-full)",
      background: accent,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: 600,
      fontSize: "var(--text-sm)",
      color: "var(--fg)"
    }
  }, title), message && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-xs)",
      color: "var(--muted)",
      marginTop: 3,
      lineHeight: 1.5
    }
  }, message), action && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, action)), onClose && /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    "aria-label": "Dismiss",
    style: {
      background: "none",
      border: "none",
      color: "var(--muted)",
      fontFamily: "var(--font-mono)",
      fontSize: 16,
      lineHeight: 1,
      cursor: "pointer",
      flexShrink: 0,
      marginTop: -1
    }
  }, "\xD7"));
}

/**
 * Fixed stack container for toasts. `position` controls the corner.
 */
function ToastViewport({
  children,
  position = "bottom-right",
  style = {}
}) {
  const pos = {
    "bottom-right": {
      bottom: 20,
      right: 20,
      alignItems: "flex-end"
    },
    "bottom-left": {
      bottom: 20,
      left: 20,
      alignItems: "flex-start"
    },
    "top-right": {
      top: 20,
      right: 20,
      alignItems: "flex-end"
    },
    "top-left": {
      top: 20,
      left: 20,
      alignItems: "flex-start"
    }
  }[position];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      zIndex: 120,
      display: "flex",
      flexDirection: "column",
      gap: 10,
      ...pos,
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Toast, ToastViewport });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Text input — surface fill, hairline border, emerald focus ring. Matches the
 * `.brief-input` pattern from the live intake forms. Supports an optional
 * label, helper/error text, and an error state.
 */
function Input({
  label = null,
  helper = null,
  error = null,
  id,
  className = "",
  style = {},
  ...rest
}) {
  const [focused, setFocused] = React.useState(false);
  const invalid = !!error;
  const borderColor = invalid ? "var(--danger)" : focused ? "var(--primary)" : "var(--border)";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 7,
      width: "100%"
    },
    className: className
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: id,
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-xs)",
      fontWeight: 500,
      color: "var(--muted)"
    }
  }, label), /*#__PURE__*/React.createElement("input", _extends({
    id: id,
    onFocus: e => {
      setFocused(true);
      rest.onFocus?.(e);
    },
    onBlur: e => {
      setFocused(false);
      rest.onBlur?.(e);
    },
    style: {
      width: "100%",
      background: "var(--surface)",
      color: "var(--fg)",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-base)",
      letterSpacing: "var(--tracking-body)",
      border: `1px solid ${borderColor}`,
      borderRadius: "var(--radius-md)",
      padding: "10px 14px",
      outline: "none",
      boxShadow: focused && !invalid ? "var(--focus-ring)" : "none",
      transition: "border-color var(--motion-base) var(--easing-standard), box-shadow var(--motion-base) var(--easing-standard)",
      boxSizing: "border-box",
      ...style
    }
  }, rest)), (error || helper) && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-xs)",
      color: invalid ? "var(--danger)" : "var(--faint)"
    }
  }, error || helper));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
/**
 * Toggle switch. Emerald track when on; surface track with a strong border when
 * off. Works controlled (`checked` + `onChange`) or uncontrolled
 * (`defaultChecked`). Optional inline label.
 */
function Switch({
  checked,
  defaultChecked = false,
  onChange,
  disabled = false,
  label = null,
  id,
  className = "",
  style = {}
}) {
  const isControlled = checked !== undefined;
  const [internal, setInternal] = React.useState(defaultChecked);
  const on = isControlled ? checked : internal;
  const toggle = () => {
    if (disabled) return;
    const next = !on;
    if (!isControlled) setInternal(next);
    onChange && onChange(next);
  };
  const sw = /*#__PURE__*/React.createElement("button", {
    type: "button",
    role: "switch",
    "aria-checked": on,
    "aria-labelledby": label && id ? id + "-label" : undefined,
    disabled: disabled,
    onClick: toggle,
    style: {
      position: "relative",
      width: 40,
      height: 24,
      flexShrink: 0,
      borderRadius: "var(--radius-full)",
      border: `1px solid ${on ? "var(--primary)" : "var(--border-strong)"}`,
      background: on ? "var(--primary)" : "var(--surface)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      padding: 0,
      transition: "background var(--motion-base) var(--easing-standard), border-color var(--motion-base) var(--easing-standard)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 2,
      left: on ? 18 : 2,
      width: 18,
      height: 18,
      borderRadius: "var(--radius-full)",
      background: on ? "var(--primary-fg)" : "var(--muted)",
      boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
      transition: "left var(--motion-base) var(--easing-standard), background var(--motion-base)"
    }
  }));
  if (!label) return /*#__PURE__*/React.createElement("span", {
    className: className,
    style: style
  }, sw);
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: id,
    className: className,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      cursor: disabled ? "not-allowed" : "pointer",
      ...style
    }
  }, sw, /*#__PURE__*/React.createElement("span", {
    id: id ? id + "-label" : undefined,
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-sm)",
      color: "var(--fg)"
    }
  }, label));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/forms/Textarea.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Multi-line text input — same surface/border/focus treatment as Input.
 * Used for project briefs and message bodies.
 */
function Textarea({
  label = null,
  helper = null,
  error = null,
  id,
  rows = 4,
  className = "",
  style = {},
  ...rest
}) {
  const [focused, setFocused] = React.useState(false);
  const invalid = !!error;
  const borderColor = invalid ? "var(--danger)" : focused ? "var(--primary)" : "var(--border)";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 7,
      width: "100%"
    },
    className: className
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: id,
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-xs)",
      fontWeight: 500,
      color: "var(--muted)"
    }
  }, label), /*#__PURE__*/React.createElement("textarea", _extends({
    id: id,
    rows: rows,
    onFocus: e => {
      setFocused(true);
      rest.onFocus?.(e);
    },
    onBlur: e => {
      setFocused(false);
      rest.onBlur?.(e);
    },
    style: {
      width: "100%",
      background: "var(--surface)",
      color: "var(--fg)",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-base)",
      lineHeight: "var(--leading-body)",
      letterSpacing: "var(--tracking-body)",
      border: `1px solid ${borderColor}`,
      borderRadius: "var(--radius-md)",
      padding: "10px 14px",
      outline: "none",
      resize: "vertical",
      boxShadow: focused && !invalid ? "var(--focus-ring)" : "none",
      transition: "border-color var(--motion-base) var(--easing-standard), box-shadow var(--motion-base) var(--easing-standard)",
      boxSizing: "border-box",
      ...style
    }
  }, rest)), (error || helper) && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-xs)",
      color: invalid ? "var(--danger)" : "var(--faint)"
    }
  }, error || helper));
}
Object.assign(__ds_scope, { Textarea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Textarea.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Dropdown.jsx
try { (() => {
/**
 * Dropdown menu — a trigger button that opens an elevated-tier menu. Closes on
 * outside click or Escape. Items are [{ label, onSelect, danger, icon }].
 * Use `align="end"` to right-align the panel under the trigger.
 */
function Dropdown({
  label = "Options",
  trigger = null,
  items = [],
  align = "start",
  className = "",
  style = {}
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const onDoc = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = e => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    className: className,
    style: {
      position: "relative",
      display: "inline-block",
      ...style
    }
  }, trigger ? /*#__PURE__*/React.createElement("span", {
    onClick: () => setOpen(v => !v),
    style: {
      cursor: "pointer"
    }
  }, trigger) : /*#__PURE__*/React.createElement("button", {
    onClick: () => setOpen(v => !v),
    "aria-haspopup": "menu",
    "aria-expanded": open,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      height: 36,
      paddingInline: 14,
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-sm)",
      fontWeight: 500,
      color: "var(--fg)",
      background: "transparent",
      border: "1px solid var(--border-strong)",
      borderRadius: "var(--radius-md)",
      cursor: "pointer",
      transition: "background var(--motion-base)"
    },
    onMouseEnter: e => e.currentTarget.style.background = "var(--elevated)",
    onMouseLeave: e => e.currentTarget.style.background = "transparent"
  }, label, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 10,
      color: "var(--muted)",
      transform: open ? "rotate(180deg)" : "none",
      transition: "transform var(--motion-base)"
    }
  }, "\u25BE")), open && /*#__PURE__*/React.createElement("div", {
    role: "menu",
    style: {
      position: "absolute",
      top: "calc(100% + 6px)",
      [align === "end" ? "right" : "left"]: 0,
      minWidth: 184,
      zIndex: 80,
      background: "var(--elevated)",
      border: "1px solid var(--border-strong)",
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--shadow-lg)",
      padding: 6
    }
  }, items.map((it, i) => it.divider ? /*#__PURE__*/React.createElement("div", {
    key: "d" + i,
    style: {
      height: 1,
      background: "var(--border)",
      margin: "6px 4px"
    }
  }) : /*#__PURE__*/React.createElement("button", {
    key: it.label,
    role: "menuitem",
    onClick: () => {
      setOpen(false);
      it.onSelect && it.onSelect();
    },
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      width: "100%",
      padding: "9px 10px",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-sm)",
      fontWeight: 500,
      textAlign: "left",
      color: it.danger ? "var(--danger)" : "var(--fg)",
      background: "transparent",
      border: "none",
      borderRadius: "var(--radius-sm)",
      cursor: "pointer",
      transition: "background var(--motion-base)"
    },
    onMouseEnter: e => e.currentTarget.style.background = it.danger ? "var(--danger-soft)" : "var(--surface)",
    onMouseLeave: e => e.currentTarget.style.background = "transparent"
  }, it.icon && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: 12,
      color: it.danger ? "var(--danger)" : "var(--muted)",
      width: 14,
      textAlign: "center"
    }
  }, it.icon), it.label))));
}
Object.assign(__ds_scope, { Dropdown });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Dropdown.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
/**
 * Tabs — a horizontal segmented selector with an emerald active indicator.
 * Provide `items` as [{ value, label, content? }]. Controlled via `value` +
 * `onChange`, or uncontrolled via `defaultValue`. Renders the active item's
 * `content` below the tab strip when present. `variant="underline"` (default)
 * draws an emerald baseline; `variant="pill"` fills the active tab.
 */
function Tabs({
  items = [],
  value,
  defaultValue,
  onChange,
  variant = "underline",
  className = "",
  style = {}
}) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState(defaultValue ?? (items[0] && items[0].value));
  const active = isControlled ? value : internal;
  const select = v => {
    if (!isControlled) setInternal(v);
    onChange && onChange(v);
  };
  const current = items.find(i => i.value === active);
  return /*#__PURE__*/React.createElement("div", {
    className: className,
    style: style
  }, /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    style: {
      display: "inline-flex",
      gap: variant === "pill" ? 4 : 4,
      padding: variant === "pill" ? 4 : 0,
      background: variant === "pill" ? "var(--surface)" : "transparent",
      border: variant === "pill" ? "1px solid var(--border)" : "none",
      borderBottom: variant === "underline" ? "1px solid var(--border)" : undefined,
      borderRadius: variant === "pill" ? "var(--radius-md)" : 0,
      width: variant === "underline" ? "100%" : "auto"
    }
  }, items.map(it => {
    const on = it.value === active;
    if (variant === "pill") {
      return /*#__PURE__*/React.createElement("button", {
        key: it.value,
        role: "tab",
        "aria-selected": on,
        onClick: () => select(it.value),
        style: {
          padding: "7px 14px",
          border: "none",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-sm)",
          fontWeight: 500,
          borderRadius: "var(--radius-sm)",
          color: on ? "var(--primary)" : "var(--muted)",
          background: on ? "var(--primary-soft)" : "transparent",
          transition: "background var(--motion-base), color var(--motion-base)"
        },
        onMouseEnter: e => {
          if (!on) e.currentTarget.style.color = "var(--fg)";
        },
        onMouseLeave: e => {
          if (!on) e.currentTarget.style.color = "var(--muted)";
        }
      }, it.label);
    }
    return /*#__PURE__*/React.createElement("button", {
      key: it.value,
      role: "tab",
      "aria-selected": on,
      onClick: () => select(it.value),
      style: {
        position: "relative",
        padding: "10px 14px 12px",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-sm)",
        fontWeight: on ? 600 : 500,
        color: on ? "var(--fg)" : "var(--muted)",
        transition: "color var(--motion-base)"
      },
      onMouseEnter: e => {
        if (!on) e.currentTarget.style.color = "var(--fg)";
      },
      onMouseLeave: e => {
        if (!on) e.currentTarget.style.color = "var(--muted)";
      }
    }, it.label, /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: -1,
        height: 2,
        background: on ? "var(--primary)" : "transparent",
        borderRadius: 2,
        transition: "background var(--motion-base)"
      }
    }));
  })), current && current.content !== undefined && /*#__PURE__*/React.createElement("div", {
    role: "tabpanel",
    style: {
      paddingTop: 18
    }
  }, current.content));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin/nav.jsx
try { (() => {
/* Nullshift admin — internal CRM dashboard.
   Faithful recreation of the live /admin surface. */
const NSA = window.NullshiftDesignSystem_7b523b;
const {
  LogoMark,
  Button,
  Badge,
  StatCard,
  Eyebrow
} = NSA;
const NAV = [{
  label: "Dashboard",
  icon: "○"
}, {
  label: "Users",
  icon: "◫"
}, {
  label: "Enquiries",
  icon: "◈"
}, {
  label: "Clients",
  icon: "◇"
}, {
  label: "Calendar",
  icon: "◻"
}, {
  label: "Quotes",
  icon: "◈"
}, {
  label: "Proposals",
  icon: "◈"
}];

/* ── Topbar + drawer ──────────────────────────────────────── */
function AdminTopbar({
  active,
  onNavigate
}) {
  const [open, setOpen] = React.useState(false);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("nav", {
    style: {
      position: "sticky",
      top: 0,
      zIndex: 50,
      height: 56,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      paddingInline: 20,
      background: "color-mix(in oklab, var(--bg) 94%, transparent)",
      borderBottom: "1px solid var(--border)",
      backdropFilter: "var(--blur-nav)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(LogoMark, {
    size: 20
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: 600,
      fontSize: "1rem",
      color: "var(--fg)"
    }
  }, "Nullshift"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-mono-sm)",
      letterSpacing: "0.1em",
      color: "var(--primary)",
      textTransform: "uppercase"
    }
  }, "/ admin")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setOpen(v => !v),
    "aria-label": "Menu",
    style: {
      width: 36,
      height: 36,
      borderRadius: "var(--radius-md)",
      background: open ? "var(--elevated)" : "transparent",
      border: "none",
      cursor: "pointer",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      gap: 5
    }
  }, [0, 1, 2].map(i => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      width: 20,
      height: 1.5,
      background: "var(--fg)",
      borderRadius: 2
    }
  })))), /*#__PURE__*/React.createElement("div", {
    onClick: () => setOpen(false),
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 60,
      background: "rgba(0,0,0,0.6)",
      backdropFilter: "blur(4px)",
      opacity: open ? 1 : 0,
      pointerEvents: open ? "auto" : "none",
      transition: "opacity var(--motion-slow)"
    }
  }), /*#__PURE__*/React.createElement("aside", {
    style: {
      position: "fixed",
      top: 0,
      right: 0,
      bottom: 0,
      zIndex: 70,
      width: "min(320px, 85vw)",
      background: "var(--surface)",
      borderLeft: "1px solid var(--border)",
      boxShadow: "var(--shadow-lg)",
      transform: open ? "translateX(0)" : "translateX(100%)",
      transition: "transform var(--motion-slow) var(--easing-standard)",
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 56,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      paddingInline: 24,
      borderBottom: "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(LogoMark, {
    size: 18
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: 600,
      fontSize: "0.95rem",
      color: "var(--fg)"
    }
  }, "Nullshift"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-mono-xs)",
      letterSpacing: "0.1em",
      color: "var(--primary)",
      textTransform: "uppercase"
    }
  }, "/ admin")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setOpen(false),
    style: {
      background: "none",
      border: "none",
      color: "var(--muted)",
      fontFamily: "var(--font-mono)",
      fontSize: 20,
      cursor: "pointer"
    }
  }, "\xD7")), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 2,
      padding: "24px 16px",
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-mono-xs)",
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      color: "var(--muted)",
      paddingLeft: 12,
      marginBottom: 8
    }
  }, "Navigation"), NAV.map(l => {
    const on = l.label === active;
    return /*#__PURE__*/React.createElement("button", {
      key: l.label,
      onClick: () => {
        onNavigate(l.label);
        setOpen(false);
      },
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px",
        borderRadius: "var(--radius-md)",
        border: "none",
        textAlign: "left",
        cursor: "pointer",
        background: on ? "color-mix(in oklab, var(--primary) 12%, transparent)" : "transparent",
        borderLeft: `2px solid ${on ? "var(--primary)" : "transparent"}`
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-mono)",
        fontSize: "11px",
        width: 16,
        textAlign: "center",
        color: on ? "var(--primary)" : "var(--muted)"
      }
    }, l.icon), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-sans)",
        fontWeight: 600,
        fontSize: "1rem",
        color: on ? "var(--primary)" : "var(--fg)"
      }
    }, l.label), on && /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: "auto",
        width: 6,
        height: 6,
        borderRadius: 999,
        background: "var(--primary)"
      }
    }));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "20px 24px",
      borderTop: "1px solid var(--border)",
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-mono-sm)",
      color: "var(--muted)"
    }
  }, "louis@nullshift.dev"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "sm"
  }, "\u2190 View website"))));
}
window.NSAdminNav = {
  AdminTopbar,
  NAV
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin/nav.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin/views.jsx
try { (() => {
/* Nullshift admin — Dashboard + Enquiries views. */
const NSD = window.NullshiftDesignSystem_7b523b;
const {
  StatCard,
  Badge,
  Button
} = NSD;
const ENQUIRIES = [{
  name: "Priya Nair",
  business: "Bloom Florals",
  date: "12 Jun",
  status: "new"
}, {
  name: "Marcus Hale",
  business: "Hale Joinery",
  date: "11 Jun",
  status: "new"
}, {
  name: "Dervla O'Brien",
  business: "Coast Physio",
  date: "10 Jun",
  status: "new"
}, {
  name: "Sam Whitfield",
  business: "Whitfield & Co",
  date: "9 Jun",
  status: "contacted"
}, {
  name: "Aisha Khan",
  business: "Lantern Café",
  date: "7 Jun",
  status: "contacted"
}];
const BRIEF_NEEDED = [{
  name: "Marcus Hale",
  business: "Hale Joinery"
}, {
  name: "Tom Bridges",
  business: "Bridges Electrical"
}];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CALL_DAYS = [4, 11, 18, 26];
const TODAY = 14;

/* ── Reusable panel ───────────────────────────────────────── */
function Panel({
  marker,
  title,
  action,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "16px 20px",
      borderBottom: "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "9px",
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      color: "var(--primary)",
      marginBottom: 2
    }
  }, marker), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: 600,
      fontSize: "1rem",
      color: "var(--fg)"
    }
  }, title)), action && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-mono-sm)",
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: "var(--muted)",
      cursor: "pointer"
    }
  }, action, " \u2192")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "8px 10px"
    }
  }, children));
}
function Row({
  name,
  business,
  right
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "12px",
      borderRadius: "var(--radius-md)"
    },
    onMouseEnter: e => e.currentTarget.style.background = "var(--elevated)",
    onMouseLeave: e => e.currentTarget.style.background = "transparent"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: 600,
      fontSize: "0.95rem",
      color: "var(--fg)"
    }
  }, name), business && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-xs)",
      color: "var(--muted)"
    }
  }, business)), /*#__PURE__*/React.createElement("div", {
    style: {
      flexShrink: 0,
      marginLeft: 16
    }
  }, right));
}

/* ── Dashboard view ───────────────────────────────────────── */
function Dashboard() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "10px",
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      color: "var(--primary)",
      marginBottom: 8
    }
  }, "// OVERVIEW"), /*#__PURE__*/React.createElement("h1", {
    className: "ns-h1",
    style: {
      fontSize: "2.2rem",
      margin: 0
    }
  }, "Dashboard")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-mono-sm)",
      color: "var(--muted)"
    }
  }, "Saturday, 14 June 2025")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "Expected income",
    value: "\xA38,400",
    sublabel: "Jun 2025 \xB7 signed proposals"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "New enquiries",
    value: "3",
    sublabel: "Awaiting action",
    accent: "var(--warning)"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Missing brief link",
    value: "2",
    sublabel: "Active clients",
    accent: "var(--info)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) 300px",
      gap: 24
    },
    className: "ns-admin-grid"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 24
    }
  }, /*#__PURE__*/React.createElement(Panel, {
    marker: "// INBOX",
    title: "New enquiries",
    action: "View all"
  }, ENQUIRIES.filter(e => e.status === "new").map(e => /*#__PURE__*/React.createElement(Row, {
    key: e.name,
    name: e.name,
    business: e.business,
    right: /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "right"
      }
    }, /*#__PURE__*/React.createElement(Badge, {
      tone: "warning"
    }, "new"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-mono-xs)",
        color: "var(--muted)",
        marginTop: 4
      }
    }, e.date))
  }))), /*#__PURE__*/React.createElement(Panel, {
    marker: "// ACTION NEEDED",
    title: "Brief link not sent",
    action: "Clients"
  }, BRIEF_NEEDED.map(c => /*#__PURE__*/React.createElement(Row, {
    key: c.name,
    name: c.name,
    business: c.business,
    right: /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-mono-sm)",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--info)"
      }
    }, "Send brief \u2192")
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface)",
      border: "1px solid var(--primary)",
      borderRadius: "var(--radius-lg)",
      padding: 20,
      boxShadow: "0 0 30px -8px color-mix(in oklab, var(--primary) 50%, transparent)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "10px",
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      color: "var(--primary)",
      marginBottom: 12
    }
  }, "// NEXT CALL"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: 600,
      fontSize: "1.3rem",
      color: "var(--fg)"
    }
  }, "Bloom Florals"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-xs)",
      color: "var(--muted)",
      marginBottom: 12
    }
  }, "Priya Nair"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: "var(--radius-md)",
      background: "var(--primary-soft)",
      border: "1px solid color-mix(in oklab, var(--primary) 30%, transparent)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 999,
      background: "var(--primary)"
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "0.88rem",
      fontWeight: 600,
      color: "var(--fg)"
    }
  }, "Today"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-mono-sm)",
      color: "var(--primary)"
    }
  }, "14:30 \xB7 30 min")))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 16px",
      borderBottom: "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: 600,
      fontSize: "1rem",
      color: "var(--fg)"
    }
  }, "June ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--muted)"
    }
  }, "2025")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-mono-xs)",
      textTransform: "uppercase",
      color: "var(--muted)"
    }
  }, "Full \u2192")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(7, 1fr)",
      marginBottom: 4
    }
  }, WEEKDAYS.map((w, i) => /*#__PURE__*/React.createElement("div", {
    key: w,
    style: {
      textAlign: "center",
      padding: "4px 0",
      fontFamily: "var(--font-mono)",
      fontSize: 8,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: i >= 5 ? "color-mix(in oklab, var(--muted) 55%, transparent)" : "var(--muted)"
    }
  }, w))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(7, 1fr)",
      gap: 2
    }
  }, Array.from({
    length: 6
  }).map((_, i) => /*#__PURE__*/React.createElement("div", {
    key: "pre" + i
  })), Array.from({
    length: 30
  }).map((_, idx) => {
    const day = idx + 1;
    const isToday = day === TODAY;
    const hasCall = CALL_DAYS.includes(day);
    return /*#__PURE__*/React.createElement("div", {
      key: day,
      style: {
        aspectRatio: "1",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-sm)",
        position: "relative",
        background: isToday ? "var(--primary)" : hasCall ? "var(--primary-soft)" : "transparent"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        fontWeight: isToday ? 700 : 400,
        color: isToday ? "var(--primary-fg)" : "var(--fg)"
      }
    }, day), hasCall && !isToday && /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        bottom: 3,
        width: 3,
        height: 3,
        borderRadius: 999,
        background: "var(--primary)"
      }
    }));
  })))))));
}

/* ── Enquiries view ───────────────────────────────────────── */
function Enquiries() {
  const tone = {
    new: "warning",
    contacted: "info"
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "10px",
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      color: "var(--primary)",
      marginBottom: 8
    }
  }, "// INBOX"), /*#__PURE__*/React.createElement("h1", {
    className: "ns-h1",
    style: {
      fontSize: "2.2rem",
      margin: 0
    }
  }, "Enquiries")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1.4fr 1.4fr 0.8fr 0.8fr",
      padding: "12px 20px",
      borderBottom: "1px solid var(--border)",
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-mono-xs)",
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: "var(--muted)"
    }
  }, /*#__PURE__*/React.createElement("span", null, "Name"), /*#__PURE__*/React.createElement("span", null, "Business"), /*#__PURE__*/React.createElement("span", null, "Received"), /*#__PURE__*/React.createElement("span", null, "Status")), ENQUIRIES.map((e, i) => /*#__PURE__*/React.createElement("div", {
    key: e.name,
    style: {
      display: "grid",
      gridTemplateColumns: "1.4fr 1.4fr 0.8fr 0.8fr",
      alignItems: "center",
      padding: "16px 20px",
      borderBottom: i < ENQUIRIES.length - 1 ? "1px solid var(--border)" : "none"
    },
    onMouseEnter: ev => ev.currentTarget.style.background = "var(--elevated)",
    onMouseLeave: ev => ev.currentTarget.style.background = "transparent"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: 600,
      fontSize: "0.95rem",
      color: "var(--fg)"
    }
  }, e.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-sm)",
      color: "var(--muted)"
    }
  }, e.business), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-mono-sm)",
      color: "var(--muted)"
    }
  }, e.date), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(Badge, {
    tone: tone[e.status]
  }, e.status))))));
}
window.NSAdmin = {
  Dashboard,
  Enquiries
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin/views.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketing/brief.jsx
try { (() => {
/* Nullshift marketing — contact section, footer, and the interactive
   "brief" modal flow. */
const NS2 = window.NullshiftDesignSystem_7b523b;
const {
  Logo,
  Button,
  Eyebrow,
  Input,
  Textarea
} = NS2;

/* ── Contact ──────────────────────────────────────────────── */
function Contact({
  onBook
}) {
  return /*#__PURE__*/React.createElement("section", {
    id: "contact",
    style: {
      borderTop: "1px solid var(--border)",
      background: "var(--surface)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1180,
      margin: "0 auto",
      padding: "80px 24px",
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
      gap: 48,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, null, "06 \u2014 Get in touch"), /*#__PURE__*/React.createElement("h2", {
    className: "ns-h2",
    style: {
      marginTop: 18,
      marginBottom: 16
    }
  }, "Ready to", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    className: "ns-hero-glow",
    style: {
      color: "var(--primary)"
    }
  }, "go online?")), /*#__PURE__*/React.createElement("p", {
    style: {
      maxWidth: "40ch",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-base)",
      lineHeight: 1.6,
      color: "var(--muted)"
    }
  }, "Tell us about your business and we'll be in touch within 24 hours. No commitment required."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 40,
      paddingTop: 28,
      borderTop: "1px solid var(--border)",
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-mono)",
      color: "var(--muted)",
      letterSpacing: "0.04em"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ns-pulse-dot",
    style: {
      width: 6,
      height: 6,
      borderRadius: 999,
      background: "var(--primary)"
    }
  }), " Response within 24 hours"), /*#__PURE__*/React.createElement("span", {
    style: {
      paddingLeft: 16,
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-mono)",
      color: "color-mix(in oklab, var(--muted) 70%, transparent)",
      letterSpacing: "0.04em"
    }
  }, "UK-based \u2014 global reach"))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--bg)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-xl)",
      padding: 36
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "5-step brief"), /*#__PURE__*/React.createElement("h3", {
    className: "ns-h3",
    style: {
      marginTop: 16,
      marginBottom: 10,
      fontSize: "1.6rem"
    }
  }, "Tell us about your project."), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 0,
      marginBottom: 24,
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-sm)",
      color: "var(--muted)",
      lineHeight: 1.55
    }
  }, "A quick 2-minute brief \u2014 pages, style, budget, timeline. We'll send back a clear proposal."), /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    onClick: onBook,
    iconEnd: /*#__PURE__*/React.createElement("span", null, "\u2192"),
    style: {
      width: "100%",
      justifyContent: "space-between"
    }
  }, "Tell us more"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-mono)",
      color: "color-mix(in oklab, var(--muted) 70%, transparent)",
      letterSpacing: "0.04em"
    }
  }, "~2 min \xB7 no commitment"))));
}

/* ── Footer ───────────────────────────────────────────────── */
function MarketingFooter() {
  const links = ["About", "FAQ", "Brand", "Legal"];
  return /*#__PURE__*/React.createElement("footer", {
    style: {
      borderTop: "1px solid var(--border)",
      background: "var(--surface)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1180,
      margin: "0 auto",
      padding: "22px 24px",
      display: "flex",
      flexWrap: "wrap",
      gap: 16,
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement(Logo, {
    size: 20,
    compact: true
  }), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "flex",
      gap: 24
    }
  }, links.map(l => /*#__PURE__*/React.createElement("a", {
    key: l,
    href: "#",
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-xs)",
      color: "var(--muted)",
      textDecoration: "none"
    },
    onMouseEnter: e => e.currentTarget.style.color = "var(--fg)",
    onMouseLeave: e => e.currentTarget.style.color = "var(--muted)"
  }, l))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-mono-sm)",
      color: "var(--faint)"
    }
  }, "\xA9 2025 Nullshift.")));
}

/* ── Brief modal — multi-step intake ──────────────────────── */
function BriefModal({
  open,
  onClose
}) {
  const STEPS = ["Contact", "Project", "Details", "Done"];
  const [step, setStep] = React.useState(0);
  const [data, setData] = React.useState({
    name: "",
    business: "",
    email: "",
    type: "Website",
    budget: "£2,400 — Pro",
    notes: ""
  });
  React.useEffect(() => {
    if (open) {
      setStep(0);
    }
  }, [open]);
  if (!open) return null;
  const set = k => e => setData(d => ({
    ...d,
    [k]: e.target.value
  }));
  const types = ["Website", "Brand", "System"];
  const budgets = ["£1,200 — Starter", "£2,400 — Pro", "Let's talk — Custom"];
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 100,
      background: "var(--overlay)",
      backdropFilter: "var(--blur-overlay)",
      display: "grid",
      placeItems: "center",
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: "min(520px, 100%)",
      background: "var(--elevated)",
      border: "1px solid var(--border-strong)",
      borderRadius: "var(--radius-xl)",
      boxShadow: "var(--shadow-lg)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "20px 24px",
      borderBottom: "1px solid var(--border)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    mono: true
  }, "// PROJECT BRIEF"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    "aria-label": "Close",
    style: {
      background: "none",
      border: "none",
      color: "var(--muted)",
      fontFamily: "var(--font-mono)",
      fontSize: 20,
      cursor: "pointer",
      lineHeight: 1
    }
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      padding: "16px 24px 0"
    }
  }, STEPS.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: s,
    style: {
      flex: 1,
      height: 3,
      borderRadius: 999,
      background: i <= step ? "var(--primary)" : "var(--border)",
      transition: "background var(--motion-base)"
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 24,
      minHeight: 220
    }
  }, step === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Your name",
    placeholder: "Jordan Lee",
    value: data.name,
    onChange: set("name")
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Business name",
    placeholder: "Acme Ltd",
    value: data.business,
    onChange: set("business")
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Email",
    type: "email",
    placeholder: "jordan@acme.co.uk",
    value: data.email,
    onChange: set("email")
  })), step === 1 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 18
    }
  }, /*#__PURE__*/React.createElement(Field, {
    label: "What do you need?"
  }, /*#__PURE__*/React.createElement(Segmented, {
    options: types,
    value: data.type,
    onChange: v => setData(d => ({
      ...d,
      type: v
    }))
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Rough budget"
  }, /*#__PURE__*/React.createElement(Segmented, {
    options: budgets,
    value: data.budget,
    onChange: v => setData(d => ({
      ...d,
      budget: v
    })),
    vertical: true
  }))), step === 2 && /*#__PURE__*/React.createElement(Textarea, {
    label: "Anything else we should know?",
    rows: 6,
    placeholder: "Pages, references, timeline, must-haves\u2026",
    value: data.notes,
    onChange: set("notes")
  }), step === 3 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "20px 0",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 56,
      height: 56,
      borderRadius: 999,
      background: "var(--primary-soft)",
      border: "1px solid color-mix(in oklab, var(--primary) 50%, transparent)",
      display: "grid",
      placeItems: "center",
      color: "var(--primary)",
      fontSize: 26
    }
  }, "\u2713"), /*#__PURE__*/React.createElement("h3", {
    className: "ns-h3",
    style: {
      fontSize: "1.4rem"
    }
  }, "Brief received."), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      maxWidth: "34ch",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-sm)",
      color: "var(--muted)",
      lineHeight: 1.55
    }
  }, "Thanks", data.name ? `, ${data.name.split(" ")[0]}` : "", ". We'll review and send a clear proposal within 24 hours."))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "16px 24px",
      borderTop: "1px solid var(--border)",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-mono-sm)",
      color: "var(--faint)"
    }
  }, step < 3 ? `Step ${step + 1} of 3` : "Complete"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, step > 0 && step < 3 && /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: () => setStep(s => s - 1)
  }, "Back"), step < 2 && /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: () => setStep(s => s + 1)
  }, "Continue"), step === 2 && /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: () => setStep(3)
  }, "Submit brief"), step === 3 && /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: onClose
  }, "Done")))));
}
function Field({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-xs)",
      fontWeight: 500,
      color: "var(--muted)"
    }
  }, label), children);
}
function Segmented({
  options,
  value,
  onChange,
  vertical = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: vertical ? "column" : "row",
      gap: 8
    }
  }, options.map(o => {
    const active = o === value;
    return /*#__PURE__*/React.createElement("button", {
      key: o,
      onClick: () => onChange(o),
      style: {
        flex: 1,
        padding: "10px 14px",
        textAlign: "left",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-sm)",
        fontWeight: 500,
        color: active ? "var(--primary)" : "var(--fg)",
        background: active ? "var(--primary-soft)" : "var(--surface)",
        border: `1px solid ${active ? "color-mix(in oklab, var(--primary) 55%, transparent)" : "var(--border)"}`,
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
        transition: "all var(--motion-base)"
      }
    }, o);
  }));
}
window.NSMarketing2 = {
  Contact,
  MarketingFooter,
  BriefModal
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing/brief.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketing/sections.jsx
try { (() => {
/* Nullshift marketing site — section components.
   Composes the design-system primitives from the bundle namespace. */
const NS = window.NullshiftDesignSystem_7b523b;
const {
  Logo,
  Button,
  Eyebrow,
  Tag,
  PricingCard,
  Input,
  Textarea,
  Card
} = NS;

/* ── Top nav ──────────────────────────────────────────────── */
function MarketingNav({
  onBook
}) {
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const root = document.querySelector("[data-scroll-root]");
    if (!root) return;
    const onScroll = () => setScrolled(root.scrollTop > 40);
    root.addEventListener("scroll", onScroll, {
      passive: true
    });
    return () => root.removeEventListener("scroll", onScroll);
  }, []);
  const links = ["Services", "Process", "Pricing"];
  return /*#__PURE__*/React.createElement("header", {
    style: {
      position: "sticky",
      top: 0,
      zIndex: 50,
      padding: "8px 12px"
    }
  }, /*#__PURE__*/React.createElement("nav", {
    style: {
      maxWidth: scrolled ? 900 : 1180,
      margin: "0 auto",
      height: 60,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      paddingInline: 20,
      background: scrolled ? "color-mix(in oklab, var(--bg) 85%, transparent)" : "transparent",
      border: `1px solid ${scrolled ? "var(--border)" : "transparent"}`,
      borderRadius: "var(--radius-lg)",
      backdropFilter: scrolled ? "var(--blur-nav)" : "none",
      transition: "all var(--motion-slow) var(--easing-standard)"
    }
  }, /*#__PURE__*/React.createElement(Logo, {
    size: 22
  }), /*#__PURE__*/React.createElement("ul", {
    style: {
      display: "flex",
      gap: 30,
      listStyle: "none",
      margin: 0,
      padding: 0
    },
    className: "ns-hide-sm"
  }, links.map(l => /*#__PURE__*/React.createElement("li", {
    key: l
  }, /*#__PURE__*/React.createElement("a", {
    href: "#" + l.toLowerCase(),
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-sm)",
      fontWeight: 500,
      color: "var(--muted)",
      textDecoration: "none"
    },
    onMouseEnter: e => e.currentTarget.style.color = "var(--fg)",
    onMouseLeave: e => e.currentTarget.style.color = "var(--muted)"
  }, l)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "sm",
    className: "ns-hide-sm"
  }, "Client login"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: onBook
  }, "Book a call"))));
}

/* ── Hero ─────────────────────────────────────────────────── */
function Hero({
  onBook
}) {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      position: "relative",
      padding: "120px 24px 96px",
      overflow: "hidden",
      backgroundImage: "radial-gradient(ellipse 50% 55% at 72% 28%, color-mix(in oklab, var(--primary) 7%, transparent) 0%, transparent 70%)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1180,
      margin: "0 auto"
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "UK-based web & brand studio"), /*#__PURE__*/React.createElement("h1", {
    className: "ns-display",
    style: {
      fontSize: "clamp(3rem, 8vw, 6.5rem)",
      marginTop: 24,
      marginBottom: 0
    }
  }, "Websites that convert,", /*#__PURE__*/React.createElement("br", null), "built with", " ", /*#__PURE__*/React.createElement("span", {
    className: "ns-hero-glow",
    style: {
      color: "var(--primary)"
    }
  }, "intention.")), /*#__PURE__*/React.createElement("p", {
    style: {
      maxWidth: "52ch",
      marginTop: 28,
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-lg)",
      lineHeight: "var(--leading-relaxed)",
      color: "var(--muted)"
    }
  }, "We design and build fast, beautiful websites and brand systems for businesses doing the work. No templates, no bloat \u2014 every pixel considered, every line of code clean."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12,
      marginTop: 36,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    onClick: onBook,
    iconEnd: /*#__PURE__*/React.createElement("span", null, "\u2192")
  }, "Start your project"), /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    variant: "secondary"
  }, "See our work")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginTop: 40,
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-mono)",
      color: "var(--muted)",
      letterSpacing: "0.04em"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ns-pulse-dot",
    style: {
      width: 6,
      height: 6,
      borderRadius: 999,
      background: "var(--primary)"
    }
  }), "Response within 24 hours \xB7 2\u20134 week turnaround")));
}

/* ── Services ─────────────────────────────────────────────── */
function Services() {
  const cards = [{
    num: "01",
    title: "Web design & development",
    desc: "From strategy to launch — fast, beautiful websites that turn visitors into customers. Custom build, no templates.",
    tag: "CUSTOM_BUILD / NO_TEMPLATES"
  }, {
    num: "02",
    title: "Branding & identity",
    desc: "Logos, colour systems, and visual identity for businesses ready to show up professionally online.",
    tag: "IDENTITY_SYSTEMS / SCALABLE"
  }, {
    num: "03",
    title: "Systems & automation",
    desc: "Booking systems, CRMs, client portals and automated workflows — bespoke tools that save you time.",
    tag: "WORKFLOWS / INTEGRATIONS"
  }];
  return /*#__PURE__*/React.createElement("section", {
    id: "services",
    style: {
      borderTop: "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1180,
      margin: "0 auto",
      padding: "72px 24px"
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "02 \u2014 Services"), /*#__PURE__*/React.createElement("h2", {
    className: "ns-h2",
    style: {
      marginTop: 18,
      marginBottom: 40
    }
  }, "What we do."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
      gap: 16
    }
  }, cards.map(c => /*#__PURE__*/React.createElement(Card, {
    key: c.num,
    interactive: true,
    padding: 28,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontWeight: 600,
      fontSize: "1.5rem",
      color: "color-mix(in oklab, var(--primary) 40%, transparent)"
    }
  }, c.num), /*#__PURE__*/React.createElement("h3", {
    className: "ns-h3",
    style: {
      fontSize: "1.3rem"
    }
  }, c.title), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-base)",
      lineHeight: 1.55,
      color: "var(--muted)"
    }
  }, c.desc), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginTop: 4,
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-mono)",
      fontWeight: 500,
      letterSpacing: "0.06em",
      color: "var(--primary)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 12,
      height: 1,
      background: "color-mix(in oklab, var(--primary) 70%, transparent)"
    }
  }), c.tag)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 32
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-sm)",
      color: "var(--faint)",
      marginRight: 6,
      alignSelf: "center"
    }
  }, "Built for \u2014"), ["Retail", "Hospitality", "Trades", "Professional Services", "Health & Wellness"].map(t => /*#__PURE__*/React.createElement(Tag, {
    key: t,
    interactive: true
  }, t)))));
}

/* ── Process ──────────────────────────────────────────────── */
function Process() {
  const steps = [{
    num: "001",
    title: "Discovery",
    desc: "We learn your business, goals, and customers. No assumptions — just honest conversation."
  }, {
    num: "002",
    title: "Design",
    desc: "A bespoke visual direction built around your brand. We present, you refine."
  }, {
    num: "003",
    title: "Build",
    desc: "Fast, clean, mobile-first code. No templates, no page builders — crafted for you."
  }, {
    num: "004",
    title: "Launch",
    desc: "We handle hosting, domain, deployment. You go live — with ongoing support."
  }];
  return /*#__PURE__*/React.createElement("section", {
    id: "process",
    style: {
      borderTop: "1px solid var(--border)",
      background: "var(--surface)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1180,
      margin: "0 auto",
      padding: "72px 24px"
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "03 \u2014 How it works"), /*#__PURE__*/React.createElement("h2", {
    className: "ns-h2",
    style: {
      marginTop: 18,
      marginBottom: 40
    }
  }, "The process."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      borderTop: "1px solid var(--border)",
      borderLeft: "1px solid var(--border)"
    }
  }, steps.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.num,
    style: {
      padding: 28,
      borderRight: "1px solid var(--border)",
      borderBottom: "1px solid var(--border)",
      display: "flex",
      flexDirection: "column",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontWeight: 600,
      fontSize: "2rem",
      color: "color-mix(in oklab, var(--primary) 25%, transparent)"
    }
  }, s.num), /*#__PURE__*/React.createElement("h3", {
    className: "ns-h3",
    style: {
      fontSize: "1.25rem"
    }
  }, s.title), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 20,
      height: 1,
      background: "var(--border-strong)"
    }
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-sm)",
      lineHeight: 1.55,
      color: "var(--muted)"
    }
  }, s.desc))))));
}

/* ── Pricing ──────────────────────────────────────────────── */
function Pricing({
  onBook
}) {
  return /*#__PURE__*/React.createElement("section", {
    id: "pricing",
    style: {
      borderTop: "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1180,
      margin: "0 auto",
      padding: "72px 24px"
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "04 \u2014 Pricing"), /*#__PURE__*/React.createElement("h2", {
    className: "ns-h2",
    style: {
      marginTop: 18,
      marginBottom: 12
    }
  }, "Fixed pricing, no surprises."), /*#__PURE__*/React.createElement("p", {
    style: {
      maxWidth: "48ch",
      marginTop: 0,
      marginBottom: 40,
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-base)",
      color: "var(--muted)",
      lineHeight: 1.6
    }
  }, "You'll know exactly what you're paying before we start. No hidden fees. No surprise invoices."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
      gap: 16,
      alignItems: "stretch"
    }
  }, /*#__PURE__*/React.createElement(PricingCard, {
    tier: "Starter",
    price: "\xA31,200",
    bestFor: "A clean, professional one-page launch",
    benefits: ["Single-page site", "Bespoke design", "Mobile-first build", {
      text: "CMS / blog",
      checked: false
    }, {
      text: "Custom systems",
      checked: false
    }],
    cta: "Get started"
  }), /*#__PURE__*/React.createElement(PricingCard, {
    tier: "Pro",
    price: "\xA32,400",
    bestFor: "Growing businesses ready to scale",
    highlighted: true,
    benefits: ["Up to 8 pages", "Bespoke design", "Mobile-first build", "CMS + blog", {
      text: "Custom systems",
      checked: false
    }],
    cta: "Start your build"
  }), /*#__PURE__*/React.createElement(PricingCard, {
    tier: "Custom",
    price: "Let's talk",
    bestFor: "Bespoke systems & integrations",
    benefits: ["Unlimited pages", "Bespoke design", "Booking / CRM systems", "Automated workflows", "Priority support"],
    cta: "Book a call"
  }))));
}
window.NSMarketing = {
  MarketingNav,
  Hero,
  Services,
  Process,
  Pricing
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing/sections.jsx", error: String((e && e.message) || e) }); }

__ds_ns.LogoMark = __ds_scope.LogoMark;

__ds_ns.Logo = __ds_scope.Logo;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Eyebrow = __ds_scope.Eyebrow;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.PricingCard = __ds_scope.PricingCard;

__ds_ns.StatCard = __ds_scope.StatCard;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.ToastViewport = __ds_scope.ToastViewport;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Textarea = __ds_scope.Textarea;

__ds_ns.Dropdown = __ds_scope.Dropdown;

__ds_ns.Tabs = __ds_scope.Tabs;

})();
