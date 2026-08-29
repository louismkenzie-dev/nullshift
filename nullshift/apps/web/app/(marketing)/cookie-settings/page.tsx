import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/LegalShell";
import { ConsentPreferences } from "@/components/legal/ConsentManager";
import { T } from "@nullshift/ui/tokens";
import { legalConfig } from "@nullshift/content/legal/config";
import { optionalCategories } from "@nullshift/content/legal/cookies";

export const metadata: Metadata = {
  title: "Cookie settings — Nullshift",
  description:
    "Review and change your cookie choices. Nothing optional is set unless you turn it on, and you can withdraw consent at any time.",
  alternates: { canonical: legalConfig.routes.cookieSettings },
};

/**
 * The persistent withdrawal route (spec §10). Linked from the footer on every
 * page and reachable without signing in — withdrawing consent must never be
 * harder than giving it, and must not require an account.
 */
export default function Page() {
  const optional = optionalCategories();

  return (
    <LegalShell
      title="Cookie settings"
      eyebrow="Your choices"
      active={legalConfig.routes.cookies}
    >
      <p
        style={{
          fontFamily: T.sans,
          fontSize: "1rem",
          lineHeight: 1.7,
          color: "var(--k-fg)",
          margin: 0,
          paddingLeft: 16,
          borderLeft: "2px solid var(--k-accent)",
        }}
      >
        Change what we&apos;re allowed to store on your device. Optional categories are
        off until you switch them on, and you can come back and switch them off again
        at any time — no account needed.
      </p>

      {optional.length === 0 && (
        <p
          style={{
            fontFamily: T.sans,
            fontSize: "0.9rem",
            lineHeight: 1.75,
            color: "var(--k-muted)",
            marginTop: 20,
          }}
        >
          At the moment this site sets nothing optional at all — only the strictly
          necessary cookies listed below, which keep you signed in and remember this
          choice. That is why you have not been shown a consent banner: we do not ask
          for permission we do not need. If we ever add analytics or marketing
          technology, it will appear here first, switched off, and you&apos;ll be asked
          before anything loads.
        </p>
      )}

      <div style={{ marginTop: 28 }}>
        <ConsentPreferences source="settings" />
      </div>
    </LegalShell>
  );
}
