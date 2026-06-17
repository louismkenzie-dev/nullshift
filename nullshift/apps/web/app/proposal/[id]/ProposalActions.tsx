"use client";

import { useState, useEffect } from "react";
import { T } from "@nullshift/ui/tokens";

export function ProposalActions({
  accepted,
  proposalRef,
}: {
  accepted: boolean;
  proposalRef: string;
}) {
  const [busy, setBusy] = useState(false);
  const [atTop, setAtTop] = useState(true);

  useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY < 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function download() {
    if (!accepted || busy) return;
    setBusy(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);

      const el = document.getElementById("proposal-document");
      if (!el) return;

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#0A0B0F",
        // Skip the floating download button itself
        ignoreElements: (node) =>
          node instanceof HTMLElement && node.dataset.html2canvasIgnore === "true",
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
      });

      const imgData = canvas.toDataURL("image/png");

      // A4 portrait — scale canvas width to fit, tile vertically across pages
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW  = pageW;
      const imgH  = (canvas.height / canvas.width) * pageW;

      let y = 0;
      let remaining = imgH;

      while (remaining > 0) {
        // For pages after the first, shift the image up so the next slice shows
        pdf.addImage(imgData, "PNG", 0, y === 0 ? 0 : -(imgH - remaining), imgW, imgH);
        remaining -= pageH;
        if (remaining > 0) {
          pdf.addPage();
          y -= pageH;
        }
      }

      pdf.save(`nullshift-proposal-${proposalRef}.pdf`);
    } finally {
      setBusy(false);
    }
  }

  return (
    // data-html2canvas-ignore tells the capture to skip this element entirely
    <div
      data-html2canvas-ignore="true"
      style={{
        position: "fixed",
        top: atTop ? 6 : 20,
        right: 24,
        transition: "top 0.2s ease",
        zIndex: 100,
      }}
    >
      <button
        onClick={download}
        disabled={!accepted || busy}
        title={accepted ? "Download proposal as PDF" : "Available once proposal is signed"}
        style={{
          fontFamily: T.mono,
          fontSize: "0.72rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          padding: "9px 18px",
          borderRadius: T.r.sm,
          border: `1px solid ${accepted ? T.primary : T.border}`,
          background: accepted ? `${T.primary}18` : T.surface,
          color: accepted ? T.primary : T.faint,
          cursor: accepted ? (busy ? "wait" : "pointer") : "not-allowed",
          display: "flex",
          alignItems: "center",
          gap: 8,
          transition: "all 0.15s",
          boxShadow: accepted ? `0 0 0 1px ${T.primary}40, 0 4px 16px rgba(0,0,0,0.4)` : "0 4px 16px rgba(0,0,0,0.4)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        {busy ? (
          <>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden
              style={{ animation: "spin 1s linear infinite" }}>
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="20" strokeDashoffset="10" strokeLinecap="round" />
            </svg>
            Generating…
          </>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Download PDF
            {!accepted && (
              <span style={{
                fontSize: "0.62rem",
                background: T.border,
                color: T.muted,
                borderRadius: 4,
                padding: "1px 6px",
                marginLeft: 2,
              }}>
                Pending signature
              </span>
            )}
          </>
        )}
      </button>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
