import { T } from "@nullshift/ui/tokens";
import { Panel, StatusChip } from "@/components/app/AppKit";
import { CopyButton } from "@/components/app/CopyButton";
import { isConnectOAuthConfigured } from "@nullshift/billing/connect";
import {
  buildConnectStartUrl,
  connectOutcomeMessage,
  connectRedirectUri,
  connectSigningSecret,
} from "@/lib/billing/stripeConnect";
import { btn, dateTimeGB } from "../_shared";

export type StripeConnection = {
  stripe_connect_account_id: string | null;
  stripe_connect_status: string | null;
  stripe_connected_at: string | null;
  stripe_connect_livemode: boolean | null;
};

/**
 * The client's OWN Stripe account, authorised to Nullshift over Connect OAuth
 * — the rail the 2% application fee rides on.
 *
 * Two ways in, because the person who runs a client's Stripe account is
 * usually not the person logged into anything of ours: staff can start the
 * handshake here, or copy the signed link and email it to whoever holds the
 * Stripe login. Both land on the same callback.
 *
 * Nothing on this panel creates a Stripe account. The client signs into the
 * account they already have; we record which one came back.
 */
export function StripeConnectPanel({
  tenantId,
  connection,
  outcome,
  returnedAccount,
  expectedMatch,
}: {
  tenantId: string;
  connection: StripeConnection | null;
  /** ?stripe_connect= from the callback redirect. */
  outcome?: string;
  /** ?account= — what Stripe just handed back, even when persisting it failed. */
  returnedAccount?: string;
  /** ?expected= — match | mismatch | unset, against the account the link named. */
  expectedMatch?: string;
}) {
  const configured = isConnectOAuthConfigured();
  const secret = connectSigningSecret();
  const accountId = connection?.stripe_connect_account_id ?? null;
  const connected = connection?.stripe_connect_status === "connected" && !!accountId;
  const revoked = connection?.stripe_connect_status === "revoked";

  const startUrl =
    secret && configured ? buildConnectStartUrl({ tenantId, secret }) : null;

  const failed = !!outcome && outcome !== "connected";
  const banner = failed
    ? { tone: T.danger, text: connectOutcomeMessage(outcome) ?? "" }
    : outcome === "connected"
      ? expectedMatch === "mismatch"
        ? {
            tone: T.warning,
            text: `Stripe connected ${returnedAccount ?? "an account"}, but that is NOT the account this link expected. Check with the client before taking any payment through it.`,
          }
        : {
            tone: T.success,
            text: `Stripe connected${returnedAccount ? ` — ${returnedAccount}` : ""}${
              expectedMatch === "match" ? ", matching the expected account." : "."
            }`,
          }
      : null;

  const rows: [string, string][] = [
    ["Connected account", accountId ?? "—"],
    ["Status", connection?.stripe_connect_status ?? "not connected"],
    ["Connected", dateTimeGB(connection?.stripe_connected_at) ?? "—"],
    ["Mode", accountId ? (connection?.stripe_connect_livemode ? "Live" : "Test") : "—"],
  ];

  return (
    <Panel
      label="// STRIPE CONNECT"
      title="Client's Stripe account"
      style={{ marginBottom: 16 }}
      actions={
        <StatusChip tone={connected ? "success" : revoked ? "danger" : "muted"}>
          {connected ? "connected" : revoked ? "revoked" : "not connected"}
        </StatusChip>
      }
    >
      {banner && (
        <p
          style={{
            fontFamily: T.sans,
            fontSize: "0.85rem",
            lineHeight: 1.6,
            color: banner.tone,
            border: `1px solid color-mix(in oklab, ${banner.tone} 40%, transparent)`,
            background: `color-mix(in oklab, ${banner.tone} 8%, transparent)`,
            padding: "10px 12px",
            margin: "0 0 14px",
          }}
        >
          {banner.text}
        </p>
      )}

      <p
        style={{
          fontFamily: T.sans,
          fontSize: "0.85rem",
          lineHeight: 1.65,
          color: "var(--k-muted)",
          margin: "0 0 14px",
          maxWidth: "70ch",
        }}
      >
        The client authorises their existing Stripe account — they keep the account, the
        dashboard and the payouts; Nullshift gains permission to charge on it and take the
        platform fee. This never creates a Stripe account for them.
      </p>

      {!configured ? (
        <p
          style={{ fontFamily: T.sans, fontSize: "0.85rem", color: T.warning, margin: 0 }}
        >
          Not configured on this deployment — set <code>STRIPE_CONNECT_CLIENT_ID</code>{" "}
          and <code>STRIPE_SECRET_KEY</code>, and register{" "}
          <code>{connectRedirectUri()}</code> as a redirect URI in the Stripe Connect
          settings.
        </p>
      ) : (
        <>
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "10px 18px",
              marginBottom: 14,
            }}
          >
            {rows.map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <dt
                  style={{
                    fontFamily: T.mono,
                    fontSize: 9,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--k-faint)",
                  }}
                >
                  {label}
                </dt>
                <dd
                  style={{
                    fontFamily: T.mono,
                    fontSize: "0.85rem",
                    color: "var(--k-fg)",
                    margin: 0,
                    overflowWrap: "anywhere",
                  }}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          {startUrl && (
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={startUrl}
                style={{
                  ...btn("var(--k-surface)", "var(--k-fg)"),
                  textDecoration: "none",
                }}
              >
                {connected ? "Reconnect Stripe" : "Connect Stripe"}
              </a>
              {/* The emailable version: same route, authorised by the signature
                  rather than by a staff session, so the client can open it
                  without a Nullshift login. */}
              <CopyButton text={startUrl} label="Copy link for the client" />
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
