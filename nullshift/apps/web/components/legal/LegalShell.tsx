import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { T } from "@nullshift/ui/tokens";
import { Container, Eyebrow, Display } from "@/components/kyma";
import { legalConfig } from "@nullshift/content/legal/config";

/**
 * Shared chrome for every Legal Centre page: the same header, the same
 * side navigation across all documents, and one back-link home. Keeping the
 * nav in one place means adding a policy adds it everywhere at once.
 */

export const LEGAL_NAV = [
  { href: legalConfig.routes.centre, label: "Legal Centre" },
  { href: legalConfig.routes.websiteTerms, label: "Website Terms" },
  { href: legalConfig.routes.privacy, label: "Privacy Notice" },
  { href: legalConfig.routes.cookies, label: "Cookie Policy" },
  { href: legalConfig.routes.subprocessors, label: "Subprocessors" },
  { href: legalConfig.routes.acceptableUse, label: "Acceptable Use" },
  { href: legalConfig.routes.ai, label: "AI Services" },
  { href: legalConfig.routes.clientServices, label: "Client Services" },
  { href: legalConfig.routes.dataComplaint, label: "Data Complaint" },
];

export function LegalShell({
  title,
  eyebrow,
  active,
  children,
}: {
  title: string;
  eyebrow: string;
  active: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Nav />
      <main
        className="k-dark"
        style={{ background: "var(--k-bg)", color: "var(--k-fg)", minHeight: "100vh" }}
      >
        <Container style={{ paddingTop: "clamp(104px,13vh,150px)", paddingBottom: 88 }}>
          <Eyebrow index="00" label={eyebrow} />
          <Display as="h1" size="lg" className="mt-6">
            {title}
          </Display>

          <div
            className="mt-12 flex flex-col lg:flex-row"
            style={{ gap: "clamp(28px,4vw,56px)" }}
          >
            <nav
              aria-label="Legal documents"
              style={{ flex: "0 0 auto", minWidth: 200 }}
              className="lg:sticky lg:top-24 lg:self-start"
            >
              <ul
                className="flex flex-row lg:flex-col flex-wrap gap-x-5 gap-y-2"
                style={{ listStyle: "none", margin: 0, padding: 0 }}
              >
                {LEGAL_NAV.map((l) => {
                  const on = l.href === active;
                  return (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        style={{
                          fontFamily: T.mono,
                          fontSize: "0.7rem",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: on ? "var(--k-accent)" : "var(--k-muted)",
                          textDecoration: "none",
                          borderLeft: on
                            ? "2px solid var(--k-accent)"
                            : "2px solid transparent",
                          paddingLeft: 10,
                          display: "inline-block",
                          paddingBlock: 3,
                        }}
                      >
                        {l.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div style={{ flex: "1 1 auto", maxWidth: "76ch", minWidth: 0 }}>
              {children}
            </div>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
