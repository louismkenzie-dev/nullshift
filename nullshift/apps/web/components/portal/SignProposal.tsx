"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { T } from "@nullshift/ui/tokens";
import { SignatureField } from "./SignatureField";

/**
 * The sign step of the portal proposal. Captures the typed signature, calls the
 * acceptProposal server action, then plays a celebratory tick screen ("We are
 * starting your build") before refreshing to reveal the signed document. The
 * accept action also promotes the lead to Won and notifies the team. Signing is
 * final — there's no undo — so the copy says so.
 */
export function SignProposal({
  acceptAction,
  declineAction,
  projectId,
  limited,
  carePlanLabel,
}: {
  acceptAction: (fd: FormData) => Promise<{ ok: boolean }>;
  declineAction: (fd: FormData) => Promise<void> | void;
  projectId: string;
  limited: boolean;
  carePlanLabel: string | null;
}) {
  const router = useRouter();
  const [signed, setSigned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onAccept(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("project_id", projectId);
    const name = String(formData.get("signature") || "").trim();
    if (!name) {
      setError("Please type your full name to sign.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await acceptAction(formData);
        if (res && res.ok) {
          setSigned(true);
          // Let the celebration play, then reveal the signed document underneath.
          setTimeout(() => router.refresh(), 3200);
        } else {
          // The write didn't take (e.g. already signed in another tab, or the
          // proposal moved on) — don't fake a celebration; show the real state.
          setError("This proposal can't be signed right now — refreshing…");
          setTimeout(() => router.refresh(), 1500);
        }
      } catch {
        setError("Something went wrong — please try again.");
      }
    });
  }

  function onDecline(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("project_id", projectId);
    startTransition(async () => {
      try {
        await declineAction(formData);
        router.refresh();
      } catch {
        setError("Something went wrong — please try again.");
      }
    });
  }

  if (signed) {
    return (
      <div
        role="status"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: T.bg,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          padding: 28,
          textAlign: "center",
        }}
      >
        <style>{`
          @keyframes ns-tick-pop { 0%{transform:scale(0.4);opacity:0} 60%{transform:scale(1.06)} 100%{transform:scale(1);opacity:1} }
          @keyframes ns-tick-draw { to { stroke-dashoffset: 0; } }
          @keyframes ns-tick-ring { 0%{transform:scale(0.7);opacity:0.55} 100%{transform:scale(1.7);opacity:0} }
          @keyframes ns-tick-fade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        `}</style>
        <div style={{ position: "relative", width: 104, height: 104 }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: `2px solid ${T.primary}`,
              animation: "ns-tick-ring 1.8s ease-out infinite",
            }}
          />
          <div
            style={{
              width: 104,
              height: 104,
              borderRadius: "50%",
              background: `${T.primary}1a`,
              border: `2px solid ${T.primary}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: "ns-tick-pop 0.5s cubic-bezier(0.16,1,0.3,1) both",
            }}
          >
            <svg width="48" height="48" viewBox="0 0 52 52" fill="none" aria-hidden>
              <path
                d="M14 27l8 8 16-18"
                stroke={T.primary}
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="48"
                strokeDashoffset="48"
                style={{ animation: "ns-tick-draw 0.5s 0.35s ease-out forwards" }}
              />
            </svg>
          </div>
        </div>
        <h2
          style={{
            fontFamily: T.display,
            fontWeight: 600,
            fontSize: "1.9rem",
            color: T.fg,
            margin: 0,
            animation: "ns-tick-fade 0.5s 0.5s both",
          }}
        >
          We are starting your build
        </h2>
        <p
          style={{
            fontFamily: T.sans,
            fontSize: "0.98rem",
            color: T.muted,
            maxWidth: "42ch",
            lineHeight: 1.6,
            margin: 0,
            animation: "ns-tick-fade 0.5s 0.7s both",
          }}
        >
          Your proposal{limited ? " and DPA are" : " is"} signed
          {carePlanLabel ? ` and your ${carePlanLabel} care plan is active` : ""}. Your
          invoice is on its way, and we&apos;ll be in touch to get the build moving.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 14,
        background: T.surface,
        border: `1px solid ${T.primary}55`,
        borderRadius: T.r.lg,
        padding: "20px 22px",
      }}
    >
      <p
        style={{
          fontFamily: T.sans,
          fontSize: "0.9rem",
          color: T.muted,
          lineHeight: 1.6,
          marginBottom: 16,
        }}
      >
        Please review the {limited ? "proposal and DPA" : "proposal"} above. Signing
        accepts the scope and price
        {carePlanLabel ? ` and the ${carePlanLabel} care plan` : ""}
        {limited ? ", and the Data Processing Agreement," : ""} so we can begin — this is
        final and can&apos;t be undone. We&apos;ll email your invoice straight away.
      </p>
      <form onSubmit={onAccept}>
        <SignatureField />
        {error && (
          <p style={{ fontFamily: T.mono, fontSize: 11, color: T.danger, marginTop: 10 }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          style={{
            marginTop: 16,
            fontFamily: T.sans,
            fontWeight: 600,
            fontSize: "0.95rem",
            height: 46,
            paddingInline: 24,
            background: T.primary,
            color: T.primaryFg,
            border: "none",
            borderRadius: T.r.md,
            cursor: pending ? "wait" : "pointer",
            opacity: pending ? 0.75 : 1,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18)`,
          }}
        >
          {pending ? "Signing…" : "Accept & sign →"}
        </button>
      </form>
      <form onSubmit={onDecline} style={{ marginTop: 10 }}>
        <button
          type="submit"
          disabled={pending}
          style={{
            fontFamily: T.sans,
            fontWeight: 600,
            fontSize: "0.85rem",
            height: 40,
            paddingInline: 18,
            background: "transparent",
            color: T.muted,
            border: `1px solid ${T.border}`,
            borderRadius: T.r.md,
            cursor: pending ? "wait" : "pointer",
          }}
        >
          Decline
        </button>
      </form>
    </div>
  );
}
