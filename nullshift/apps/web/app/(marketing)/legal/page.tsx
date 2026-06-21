"use client";

import { useState } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { T } from "@nullshift/ui/tokens";
import { Container, Eyebrow, Display, Lead } from "@/components/kyma";
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
      {/* Whole page is dark — long-form legal reads best dark and
          LegalDocs renders with dark tokens. */}
      <main
        className="k-dark"
        style={{ background: "var(--k-bg)", color: "var(--k-fg)" }}
      >
        {/* ═══════════════ HERO (dark) ═══════════════ */}
        <section
          className="k-dark"
          style={{ background: "var(--k-bg)", borderBottom: "1px solid var(--k-border)" }}
        >
          <Container
            style={{
              paddingTop: "clamp(120px,16vh,168px)",
              paddingBottom: "clamp(32px,4vw,52px)",
            }}
          >
            <Eyebrow index="00" label="Legal" />
            <Display as="h1" size="lg" className="mt-6">
              Legal <span style={{ color: "var(--k-accent)" }}>documents.</span>
            </Display>
            <Lead className="mt-6" style={{ maxWidth: "60ch" }}>
              How we handle your data and the terms that apply when you use our site and
              services. Governed by the laws of England and Wales.
            </Lead>

            {/* Tab switcher — pill tabs */}
            <div
              className="flex flex-wrap gap-1 mt-9 p-1 w-fit"
              style={{
                background: "var(--k-surface)",
                border: "1px solid var(--k-border)",
                borderRadius: T.r.full,
              }}
            >
              {LEGAL_DOCS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.72rem",
                    fontWeight: 500,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    height: 34,
                    paddingInline: 16,
                    background: tab === key ? "var(--k-bg)" : "transparent",
                    color: tab === key ? "var(--k-fg)" : "var(--k-muted)",
                    border: `1px solid ${tab === key ? "var(--k-accent)" : "transparent"}`,
                    borderRadius: T.r.full,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: `background ${T.duration.base} ${T.ease}, color ${T.duration.base} ${T.ease}, border-color ${T.duration.base} ${T.ease}`,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </Container>
        </section>

        {/* Content */}
        <Container style={{ paddingBlock: "clamp(40px,6vw,72px)" }}>
          <div style={{ maxWidth: "56rem" }}>
            <ActiveDoc />
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
