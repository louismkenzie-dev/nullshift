"use client";

import { useState } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { T } from "@/lib/tokens";

type Tab = "privacy" | "terms";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-10" style={{ borderBottom: `1px solid ${T.border}` }}>
      <h2 className="mb-5" style={{ fontFamily: T.display, fontWeight: 600, fontSize: "1.125rem", letterSpacing: "-0.01em", lineHeight: 1.3, color: T.fg }}>{title}</h2>
      <div style={{ fontFamily: T.sans, fontSize: "0.9rem", lineHeight: 1.85, color: T.muted }}>{children}</div>
    </div>
  );
}

function Privacy() {
  return (
    <div>
      <Section title="WHAT INFORMATION WE COLLECT">
        <p>Nullshift collects information you provide directly to us when you fill out our contact or booking forms. This includes your name, business name, email address, phone number (if provided), and any project details you share.</p>
        <p className="mt-4">We do not collect any information about you unless you voluntarily provide it. We do not use cookies for tracking, advertising, or analytics beyond basic site performance.</p>
      </Section>
      <Section title="HOW WE USE YOUR INFORMATION">
        <p>Information you submit is used solely to respond to your enquiry, schedule calls, and deliver the services you&apos;ve requested. We do not use your information for any other purpose.</p>
        <p className="mt-4">We will not sell, rent, trade, or otherwise transfer your personal information to third parties without your consent, except where required by law.</p>
      </Section>
      <Section title="DATA STORAGE & SECURITY">
        <p>Your submitted data is stored securely. We take reasonable precautions to protect your information from unauthorised access, disclosure, or misuse. However, no transmission over the internet is 100% secure.</p>
        <p className="mt-4">We retain your data only as long as necessary to fulfil the purposes for which it was collected, or as required by applicable law.</p>
      </Section>
      <Section title="YOUR RIGHTS">
        <p>You have the right to request access to the personal information we hold about you, request correction of inaccurate data, or request deletion of your data. To exercise any of these rights, contact us at <span style={{ color: T.primary }}>hello@nullshift.com</span> (placeholder — update before going live).</p>
      </Section>
      <Section title="CHANGES TO THIS POLICY">
        <p>We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated effective date. Continued use of our website after changes constitutes your acceptance of the revised policy.</p>
      </Section>
      <div className="pt-6">
        <p style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: `${T.muted}88` }}>
          EFFECTIVE_DATE / 2025 — LAST_UPDATED / 2025-06-01 — ⚠ PLACEHOLDER: REPLACE_WITH_LEGALLY_REVIEWED_COPY
        </p>
      </div>
    </div>
  );
}

function Terms() {
  return (
    <div>
      <Section title="SCOPE OF SERVICES">
        <p>Nullshift provides web design, web development, and brand identity services as agreed in individual project proposals. The scope, deliverables, and timeline of each engagement are defined in a written proposal accepted by the client prior to commencement.</p>
        <p className="mt-4">Any work outside the agreed scope will be quoted separately and requires written approval before proceeding.</p>
      </Section>
      <Section title="PAYMENT TERMS">
        <p>Standard payment terms require a 50% deposit before project commencement, with the remaining 50% due upon project completion and before final handover. Alternative payment schedules may be agreed in writing for larger projects.</p>
        <p className="mt-4">Invoices are payable within 14 days of issue. Late payments may result in work being paused until outstanding amounts are settled.</p>
      </Section>
      <Section title="INTELLECTUAL PROPERTY & OWNERSHIP">
        <p>Upon receipt of full payment, the client receives full ownership of all custom code, design assets, and deliverables created specifically for their project. Nullshift retains no ongoing rights to the work.</p>
        <p className="mt-4">Third-party assets (fonts, stock images, plugins) remain subject to their respective licences, which will be disclosed at the time of use.</p>
        <p className="mt-4">Nullshift reserves the right to display completed work in its portfolio unless the client requests otherwise in writing.</p>
      </Section>
      <Section title="REVISIONS & CHANGES">
        <p>Each project tier includes a defined number of revision rounds as specified in the proposal. Revisions beyond the included allowance will be charged at an agreed hourly rate. Significant scope changes post-commencement may require a revised proposal.</p>
      </Section>
      <Section title="LIABILITY">
        <p>Nullshift is not liable for any indirect, incidental, or consequential damages arising from the use or inability to use the delivered work. Our total liability is limited to the amount paid for the project in question.</p>
        <p className="mt-4">The client is responsible for providing accurate information, obtaining any necessary permissions for content provided, and ensuring compliance with applicable laws for their business.</p>
      </Section>
      <Section title="TERMINATION">
        <p>Either party may terminate the engagement with written notice. In the event of termination, the client is liable for payment for all work completed up to the termination date. The deposit is non-refundable.</p>
      </Section>
      <div className="pt-6">
        <p style={{ fontFamily: T.mono, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: `${T.muted}88` }}>
          EFFECTIVE_DATE / 2025 — GOVERNING_LAW / AUSTRALIA — ⚠ PLACEHOLDER: REPLACE_WITH_LEGALLY_REVIEWED_COPY
        </p>
      </div>
    </div>
  );
}

export default function LegalPage() {
  const [tab, setTab] = useState<Tab>("privacy");

  return (
    <>
      <Nav />
      <main>
        {/* Hero */}
        <section className="pt-28 pb-14 px-8 md:px-16" style={{ borderBottom: `1px solid ${T.border}` }}>
          <div className="mb-7">
            <span className="inline-flex items-center gap-2" style={{ fontFamily: T.sans, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.primary, display: "inline-block" }} />
              Legal
            </span>
          </div>
          <h1 style={{ fontFamily: T.display, fontWeight: 600, fontSize: "clamp(3rem, 7vw, 6rem)", lineHeight: 1.04, letterSpacing: "-0.03em", color: T.fg }}>
            Legal <span style={{ color: T.muted }}>documents.</span>
          </h1>

          {/* Warning banner */}
          <div className="mt-8 flex items-start gap-3 px-5 py-4 max-w-2xl" style={{ border: `1px solid ${T.danger}`, background: T.dangerSoft, borderRadius: T.r.md }}>
            <span style={{ color: T.danger, flexShrink: 0 }}>⚠</span>
            <p style={{ fontFamily: T.sans, fontSize: "0.8125rem", lineHeight: 1.65, letterSpacing: "-0.003em", color: T.danger }}>
              Placeholder content — these documents are skeleton drafts for structural reference only. Replace with legally reviewed copies before going live. Consult a qualified solicitor for UK GDPR and Data Protection Act 2018 compliance.
            </p>
          </div>

          {/* Tab switcher — Halo pill tabs */}
          <div className="flex gap-1 mt-10 p-1 w-fit" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r.full }}>
            {(["privacy", "terms"] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{
                  fontFamily: T.sans, fontSize: "0.8125rem", fontWeight: 500, letterSpacing: "-0.003em",
                  height: 32, paddingInline: 16,
                  background: tab === t ? T.elevated : "transparent",
                  color: tab === t ? T.fg : T.muted,
                  border: `1px solid ${tab === t ? T.primary : "transparent"}`,
                  borderRadius: T.r.full,
                  cursor: "pointer",
                  transition: `background ${T.duration.base} ${T.ease}, color ${T.duration.base} ${T.ease}`,
                }}>
                {t === "privacy" ? "Privacy Policy" : "Terms of Service"}
              </button>
            ))}
          </div>
        </section>

        {/* Content */}
        <section className="px-8 md:px-16 py-12 max-w-4xl">
          {tab === "privacy" ? <Privacy /> : <Terms />}
        </section>
      </main>
      <Footer />
    </>
  );
}
