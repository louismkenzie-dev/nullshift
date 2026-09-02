import Link from "next/link";
import { T } from "@nullshift/ui/tokens";
import { LogoMark } from "@nullshift/ui/components/Logo";
import { Eyebrow, Display } from "@/components/kyma";
import { Reveal } from "@/components/Reveal";
import { safePortalNext } from "@/lib/portalLinks";
import { ResetForm } from "./ResetForm";
import { ResetFallback } from "./ResetFallback";

/**
 * Choose-your-password page. Every set-your-password link we email lands here:
 * the INVITE a new client gets, the RECOVERY link from "Forgot your password?"
 * or the client hub, and the plan invite from the Direct Debits board.
 *
 * The link carries `token_hash` + `type`; the form renders straight away and the
 * token is verified SERVER-SIDE when they submit (see actions.ts). Nothing here
 * waits on the browser to pick a session out of the URL — that is the wait that
 * never ended under the old flow.
 *
 * The copy deliberately says "choose", not "reset" — for an invited client
 * there is no old password to reset.
 */
export const dynamic = "force-dynamic";

const LINK_TYPES = new Set(["invite", "recovery", "magiclink", "email"]);

export default async function PortalResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const tokenHash = (sp.token_hash ?? "").trim();
  const type = (sp.type ?? "").trim();
  const next = safePortalNext(sp.next);
  const hasToken = tokenHash.length > 0 && LINK_TYPES.has(type);

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "var(--k-bg)" }}
    >
      <Reveal className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <LogoMark size={26} />
          <span
            style={{
              fontFamily: T.display,
              fontWeight: 700,
              fontSize: "1.1rem",
              letterSpacing: "-0.01em",
              textTransform: "uppercase",
              color: "var(--k-fg)",
            }}
          >
            Nullshift
          </span>
        </div>

        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <Eyebrow index="01" label="Client Portal" align="center" />
          <Display as="h1" size="md">
            Choose your password
          </Display>
          <p
            style={{
              fontFamily: T.sans,
              fontSize: "0.86rem",
              lineHeight: 1.6,
              color: "var(--k-muted)",
              maxWidth: 340,
            }}
          >
            This is your Nullshift client portal — a separate login from any system we
            built for you, even if it uses the same email address.
          </p>
        </div>

        {hasToken ? (
          <ResetForm tokenHash={tokenHash} type={type} next={next} />
        ) : (
          <ResetFallback next={next} />
        )}

        <div className="mt-6 text-center">
          <Link
            href="/portal/login"
            style={{
              fontFamily: T.mono,
              fontSize: "0.66rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--k-muted)",
              textDecoration: "none",
            }}
          >
            ← Back to sign in
          </Link>
        </div>
      </Reveal>
    </main>
  );
}
