import React from "react";
import { legalConfig, statutoryDisclosure } from "@nullshift/content/legal/config";
import Link from "next/link";
import { T } from "@nullshift/ui/tokens";
import { Logo } from "@nullshift/ui/components/Logo";
import { Parallax } from "@/components/Parallax";

/* Kyma-style footer — dark, mono link columns, giant wordmark, status
   bar. Themed via the .k-dark CSS vars. Server-safe. */

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "What we build", href: "/#capabilities" },
      { label: "Agent Consultation", href: "/start" },
      { label: "Client stories", href: "/client-stories" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "FAQ", href: "/faq" },
      { label: "Brand", href: "/brand" },
      { label: "Book a call", href: "/book" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Legal Centre", href: "/legal" },
      { label: "Privacy", href: "/legal/privacy" },
      { label: "Cookies", href: "/legal/cookies" },
      { label: "Website terms", href: "/legal/website-terms" },
      { label: "Subprocessors", href: "/legal/subprocessors" },
      { label: "Data complaint", href: "/legal/data-complaint" },
      // Persistent withdrawal route (spec §10): consent must be as easy to
      // take back as it was to give, from every page, without signing in.
      { label: "Cookie settings", href: legalConfig.routes.cookieSettings },
    ],
  },
];

const monoLink: React.CSSProperties = {
  fontFamily: T.mono,
  fontSize: "0.78rem",
  letterSpacing: "0.02em",
  color: "var(--k-muted)",
  textDecoration: "none",
};

export function Footer() {
  return (
    <footer
      className="k-dark relative overflow-hidden"
      style={{
        background: "var(--k-bg)",
        color: "var(--k-fg)",
        borderTop: "1px solid var(--k-border)",
      }}
    >
      <div
        className="relative"
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          paddingInline: "clamp(20px,4vw,40px)",
          paddingTop: "clamp(56px,7vw,88px)",
          paddingBottom: 24,
          zIndex: 1,
        }}
      >
        {/* Top row */}
        <div className="grid grid-cols-1 gap-12 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          {/* Brand */}
          <div>
            <Link
              href="/"
              className="inline-flex items-center"
              style={{ textDecoration: "none" }}
            >
              <Logo markSize={26} />
            </Link>
            <p
              className="mt-5"
              style={{
                fontFamily: T.sans,
                fontSize: "0.95rem",
                lineHeight: 1.5,
                color: "var(--k-muted)",
                maxWidth: "34ch",
              }}
            >
              Agentic AI systems that automate the operational work draining your business
              — built fast, run by us, owned by you.
            </p>
            <Link
              href="/start"
              className="kb kb-primary mt-7"
              style={{ display: "inline-flex" }}
            >
              Get my free plan
              <span className="k-arrow" aria-hidden>
                →
              </span>
            </Link>
          </div>

          {/* Columns */}
          {COLUMNS.map((col) => (
            <nav key={col.title}>
              <p
                style={{
                  fontFamily: T.mono,
                  fontSize: "0.66rem",
                  fontWeight: 500,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--k-accent)",
                  marginBottom: 18,
                }}
              >
                [ {col.title} ]
              </p>
              <ul
                className="flex flex-col gap-3.5"
                style={{ listStyle: "none", margin: 0, padding: 0 }}
              >
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="k-flink" style={monoLink}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Giant wordmark */}
        <div className="mt-14 overflow-hidden" aria-hidden>
          <Parallax distance={36}>
            <div
              style={{
                fontFamily: T.sans,
                fontWeight: 800,
                fontSize: "clamp(3.5rem,17vw,15rem)",
                lineHeight: 0.82,
                letterSpacing: "-0.04em",
                textTransform: "uppercase",
                color: "var(--k-fg)",
                opacity: 0.06,
                whiteSpace: "nowrap",
              }}
            >
              Nullshift
            </div>
          </Parallax>
        </div>

        {/* Bottom bar */}
        {/* Statutory company disclosure — generated from the central legal
            config so it can never drift from the legal pages. */}
        <p
          className="mt-8"
          style={{
            fontFamily: T.mono,
            fontSize: "0.66rem",
            lineHeight: 1.7,
            color: "var(--k-faint)",
            borderTop: "1px solid var(--k-border)",
            paddingTop: 20,
            maxWidth: "90ch",
          }}
        >
          {statutoryDisclosure()}
        </p>

        <div
          className="mt-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center"
          style={{ borderTop: "1px solid var(--k-border)", paddingTop: 22 }}
        >
          <span
            style={{
              fontFamily: T.mono,
              fontSize: "0.7rem",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--k-faint)",
            }}
          >
            © 2026 Nullshift · London, UK
          </span>
          <div className="flex items-center gap-5">
            <Link href="/portal" className="k-flink" style={monoLink}>
              Client login
            </Link>
            <Link
              href="/admin/login"
              aria-label="Admin login"
              className="inline-flex items-center"
              style={{
                fontFamily: T.mono,
                fontSize: "0.68rem",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--k-muted)",
                border: "1px solid var(--k-border)",
                borderRadius: 0,
                padding: "5px 12px",
                textDecoration: "none",
              }}
            >
              Admin
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
