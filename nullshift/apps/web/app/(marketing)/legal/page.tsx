"use client";

import { useState } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { T } from "@nullshift/ui/tokens";
import {
  LEGAL_DOCS,
  type DocKey,
  PrivacyDoc,
  CookiesDoc,
  TermsDoc,
  DpaDoc,
} from "./LegalDocs";

const DOC_COMPONENTS: Record<DocKey, () => React.ReactElement> = {
  privacy: PrivacyDoc,
  cookies: CookiesDoc,
  terms: TermsDoc,
  dpa: DpaDoc,
};

export default function LegalPage() {
  const [tab, setTab] = useState<DocKey>("privacy");
  const ActiveDoc = DOC_COMPONENTS[tab];

  return (
    <>
      <Nav />
      <main>
        {/* Hero */}
        <section
          className="pt-28 pb-12 px-8 md:px-16"
          style={{ borderBottom: `1px solid ${T.border}` }}
        >
          <div className="mb-7">
            <span
              className="inline-flex items-center gap-2"
              style={{
                fontFamily: T.sans,
                fontSize: "0.75rem",
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: T.muted,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: T.primary,
                  display: "inline-block",
                }}
              />
              Legal
            </span>
          </div>
          <h1
            style={{
              fontFamily: T.display,
              fontWeight: 600,
              fontSize: "clamp(3rem, 7vw, 6rem)",
              lineHeight: 1.04,
              letterSpacing: "-0.03em",
              color: T.fg,
            }}
          >
            Legal <span style={{ color: T.muted }}>documents.</span>
          </h1>
          <p
            className="mt-6 max-w-2xl"
            style={{
              fontFamily: T.sans,
              fontSize: "0.9375rem",
              lineHeight: 1.65,
              letterSpacing: "-0.005em",
              color: T.muted,
            }}
          >
            How we handle your data and the terms that apply when you use our site and
            services. Governed by the laws of England and Wales.
          </p>

          {/* Tab switcher — Halo pill tabs */}
          <div
            className="flex flex-wrap gap-1 mt-10 p-1 w-fit"
            style={{
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: T.r.full,
            }}
          >
            {LEGAL_DOCS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  fontFamily: T.sans,
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  letterSpacing: "-0.003em",
                  height: 32,
                  paddingInline: 16,
                  background: tab === key ? T.elevated : "transparent",
                  color: tab === key ? T.fg : T.muted,
                  border: `1px solid ${tab === key ? T.primary : "transparent"}`,
                  borderRadius: T.r.full,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: `background ${T.duration.base} ${T.ease}, color ${T.duration.base} ${T.ease}`,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Content */}
        <section className="px-8 md:px-16 py-14 max-w-4xl">
          <ActiveDoc />
        </section>
      </main>
      <Footer />
    </>
  );
}
