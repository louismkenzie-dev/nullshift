"use client";

import { useState } from "react";
import { T } from "@nullshift/ui/tokens";

/**
 * Captures a rendered document element (by id) to a multi-page A4 PDF using the
 * same html2canvas-pro + jsPDF pipeline as the legacy proposal download. Used on
 * the client portal (proposal + DPA, once signed) and the admin documents view.
 * The target element must be visible in the DOM when pressed (not inside a
 * collapsed <details>), otherwise there's nothing to capture.
 */
export function DownloadDocButton({
  targetId,
  filename,
  label,
}: {
  targetId: string;
  filename: string;
  label: string;
}) {
  const [busy, setBusy] = useState(false);

  async function download() {
    if (busy) return;
    setBusy(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);
      const el = document.getElementById(targetId);
      if (!el) return;

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#0A0B0F",
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
      });
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height / canvas.width) * pageW;

      // One tall bitmap tiled across A4 pages (shift the image up one page each
      // time). Known limitation: a fixed-height slice can bisect a line at a
      // page break — fine for the short proposal/DPA we generate here.
      let printed = 0;
      let first = true;
      while (printed < imgH - 0.5) {
        if (!first) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, -printed, imgW, imgH);
        printed += pageH;
        first = false;
      }
      pdf.save(filename);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={download}
      disabled={busy}
      style={{
        fontFamily: T.mono,
        fontSize: "0.72rem",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        padding: "9px 16px",
        borderRadius: T.r.sm,
        border: `1px solid ${T.primary}`,
        background: `${T.primary}18`,
        color: T.primary,
        cursor: busy ? "wait" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
        {busy ? (
          <circle
            cx="7"
            cy="7"
            r="5.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeDasharray="20"
            strokeDashoffset="10"
            strokeLinecap="round"
            style={{ animation: "ns-dl-spin 1s linear infinite" }}
          />
        ) : (
          <path
            d="M7 1v8M4 6l3 3 3-3M2 11h10"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      {busy ? "Generating…" : label}
      <style>{`@keyframes ns-dl-spin { to { transform: rotate(360deg); } }`}</style>
    </button>
  );
}
