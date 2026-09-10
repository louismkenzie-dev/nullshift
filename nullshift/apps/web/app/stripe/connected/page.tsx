import type { Metadata } from "next";
import { createServiceClient } from "@nullshift/db";
import { T } from "@nullshift/ui/tokens";
import {
  TENANT_ID_RE,
  connectOutcomeMessage,
  connectSigningSecret,
  verifyTenantLink,
} from "@/lib/billing/stripeConnect";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stripe connection",
  robots: { index: false, follow: false },
};

/**
 * Where a client lands after authorising their Stripe account.
 *
 * It reports what is actually stored against their account rather than what
 * the URL claims: the link is signed, so the page can look the tenant up and
 * read the real connection state. A hand-typed URL therefore cannot make this
 * page say "connected" — the worst it can do is say "not connected yet".
 */
export default async function StripeConnectedPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; sig?: string; outcome?: string }>;
}) {
  const { tenant = "", sig, outcome } = await searchParams;
  const secret = connectSigningSecret();

  const verified =
    !!secret && TENANT_ID_RE.test(tenant) && verifyTenantLink(tenant, sig, secret);

  const row = verified
    ? (
        await createServiceClient()
          .from("tenants")
          .select(
            "name, stripe_connect_account_id, stripe_connect_status, stripe_connected_at, stripe_connect_livemode"
          )
          .eq("id", tenant)
          .maybeSingle()
      ).data
    : null;

  const connection = row as {
    name?: string | null;
    stripe_connect_account_id?: string | null;
    stripe_connect_status?: string | null;
    stripe_connected_at?: string | null;
    stripe_connect_livemode?: boolean | null;
  } | null;

  const failure =
    outcome && outcome !== "connected" ? connectOutcomeMessage(outcome) : null;
  const connected =
    !failure &&
    connection?.stripe_connect_status === "connected" &&
    !!connection?.stripe_connect_account_id;

  const heading = !verified
    ? ["LINK NOT", "RECOGNISED"]
    : failure
      ? ["STRIPE NOT", "CONNECTED"]
      : connected
        ? ["STRIPE", "CONNECTED"]
        : ["NOT CONNECTED", "YET"];

  const body = !verified
    ? "This link could not be verified. Ask Nullshift to send you a fresh Stripe connection link."
    : (failure ??
      (connected
        ? `${connection?.name ?? "Your"} Stripe account is now authorised for Nullshift. Nothing else is needed from you — you keep full ownership of the account, your dashboard and your payouts.`
        : "Your Stripe account has not been connected yet. Use the button below to authorise it — you will sign into your existing Stripe account, not create a new one."));

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6 py-16"
      style={{ background: T.bg }}
    >
      <div style={{ width: "100%", maxWidth: 520 }}>
        <p
          style={{
            fontFamily: T.mono,
            fontSize: 11,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: connected ? T.success : failure || !verified ? T.warning : T.muted,
            margin: "0 0 22px",
          }}
        >
          Nullshift / Stripe
        </p>
        <h1
          style={{
            fontFamily: T.display,
            fontWeight: 600,
            fontSize: "2.2rem",
            lineHeight: 1.04,
            letterSpacing: "-0.03em",
            color: T.fg,
            margin: 0,
          }}
        >
          {heading[0]}
          <br />
          <span style={{ color: connected ? T.success : T.primary }}>{heading[1]}</span>
        </h1>
        <p
          style={{
            fontFamily: T.sans,
            fontSize: "0.95rem",
            lineHeight: 1.7,
            color: T.muted,
            margin: "18px 0 0",
          }}
        >
          {body}
        </p>

        {connected && (
          <dl
            style={{
              marginTop: 28,
              border: `1px solid ${T.border}`,
              background: T.surface,
              padding: "16px 18px",
              display: "grid",
              gap: 12,
            }}
          >
            {[
              ["Connected account", connection?.stripe_connect_account_id ?? "—"],
              [
                "Connected on",
                connection?.stripe_connected_at
                  ? new Date(connection.stripe_connected_at).toLocaleString("en-GB", {
                      dateStyle: "long",
                      timeStyle: "short",
                    })
                  : "—",
              ],
              ["Mode", connection?.stripe_connect_livemode ? "Live" : "Test"],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-1">
                <dt
                  style={{
                    fontFamily: T.mono,
                    fontSize: 9,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: T.faint,
                  }}
                >
                  {label}
                </dt>
                <dd
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.9rem",
                    color: T.fg,
                    margin: 0,
                    overflowWrap: "anywhere",
                  }}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {verified && !connected && (
          <a
            href={`/api/stripe/connect?tenant=${encodeURIComponent(tenant)}&sig=${encodeURIComponent(sig ?? "")}`}
            className="inline-flex items-center justify-center px-5 h-11"
            style={{
              fontFamily: T.mono,
              fontSize: "0.78rem",
              fontWeight: 600,
              letterSpacing: "0.06em",
              background: T.primary,
              color: T.primaryFg,
              borderRadius: T.r.md,
              textDecoration: "none",
              marginTop: 28,
            }}
          >
            {failure ? "Try again" : "Connect Stripe"}
          </a>
        )}
      </div>
    </main>
  );
}
