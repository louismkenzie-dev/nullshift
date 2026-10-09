import Link from "next/link";
import { createClient } from "@nullshift/db";
import { INSTAGRAM_SCOPES, readMetaEnv } from "@/lib/social/instagram";
import { Notice, first } from "../../sales/ops-ui";
import s from "../../shell.module.css";
import c from "../social.module.css";
import { disconnectAccountForm } from "../actions";

export const dynamic = "force-dynamic";

type Account = {
  id: string;
  platform: string;
  handle: string;
  external_user_id: string;
  page_id: string | null;
  display_name: string | null;
  connected_at: string;
  expires_at: string | null;
  status: "connected" | "expired" | "revoked" | "error";
  last_error: string | null;
};

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/London",
      })
    : "—";

const NOTICES: Record<string, { tone: "info" | "warning" | "danger"; text: string }> = {
  connected: {
    tone: "info",
    text: "Instagram connected. Due posts now publish through the API.",
  },
  disconnected: { tone: "info", text: "Disconnected. Posts fall back to manual mode." },
  bad_state: {
    tone: "danger",
    text: "The login round trip could not be verified (state expired or did not match). Start again.",
  },
  denied: {
    tone: "warning",
    text: "Facebook Login was cancelled or a permission was declined.",
  },
  no_code: { tone: "danger", text: "Facebook returned without an authorisation code." },
  no_ig_account: {
    tone: "danger",
    text: "None of your Facebook Pages has a linked Instagram professional account. Link @nullshift.dev to the Page first (Instagram → Settings → Linked accounts), then try again.",
  },
  exchange_failed: {
    tone: "danger",
    text: "The code could not be exchanged. Check META_APP_ID / META_APP_SECRET and the redirect URI on the Meta app.",
  },
  not_configured: {
    tone: "warning",
    text: "Instagram publishing is not configured on this deployment.",
  },
  forbidden: { tone: "danger", text: "Staff only." },
  bad_id: { tone: "danger", text: "Bad account id." },
};

export default async function SocialAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const notice = first(sp.notice);
  const missing = first(sp.missing);
  const env = readMetaEnv();
  const configured =
    env.ok &&
    !!(process.env.SOCIAL_OAUTH_STATE_SECRET || process.env.SOCIAL_TOKEN_ENCRYPTION_KEY);

  const nowMs = new Date().getTime();
  const supabase = await createClient();
  const { data } = await supabase
    .from("social_accounts")
    .select("*")
    .order("connected_at", { ascending: false })
    .limit(10);
  const accounts = (data ?? []) as Account[];
  const live = accounts.find((a) => a.status === "connected") ?? null;
  const daysLeft = live?.expires_at
    ? Math.round((new Date(live.expires_at).getTime() - nowMs) / 86_400_000)
    : null;
  const n = notice ? NOTICES[notice] : null;

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <p className={s.mono}>
            <Link href="/admin/social" className={s.rowLink}>
              Social
            </Link>{" "}
            · Accounts
          </p>
          <h1 className={s.h1}>Connected accounts</h1>
          <p className={s.lead}>
            Instagram publishing uses Facebook Login on the Page that @nullshift.dev is
            linked to. The access token is stored encrypted and never shown here.
            Long-lived tokens last about 60 days; reconnect before expiry.
          </p>
        </div>
        <div className={c.actions}>
          {live ? (
            <form action={disconnectAccountForm}>
              <input type="hidden" name="id" value={live.id} />
              <button type="submit" className={s.btn}>
                Disconnect
              </button>
            </form>
          ) : null}
          <a
            className={configured ? s.btnPrimary : s.btn}
            href="/api/social/instagram/connect"
            aria-disabled={!configured}
          >
            {live ? "Reconnect Instagram" : "Connect Instagram"}
          </a>
        </div>
      </div>

      {n ? (
        <Notice tone={n.tone}>
          {n.text}
          {notice === "not_configured" && missing ? ` Missing: ${missing}.` : ""}
        </Notice>
      ) : null}
      {!configured ? (
        <Notice tone="warning">
          Manual mode. Set META_APP_ID, META_APP_SECRET, SOCIAL_TOKEN_ENCRYPTION_KEY and
          SOCIAL_OAUTH_STATE_SECRET on Vercel, then use Connect Instagram. Until then, due
          posts are emailed to louis@nullshift.co.uk to post by hand. Setup steps:
          docs/instagram/SCHEDULER-SETUP.md.
        </Notice>
      ) : null}

      <div className={s.grid12}>
        <section className={`${s.card} ${s.span6}`} aria-labelledby="ig">
          <div className={s.cardTitle}>
            <h2 className={s.h2} id="ig" style={{ margin: 0 }}>
              Instagram
            </h2>
            <span
              className={`${s.chip} ${
                live
                  ? daysLeft !== null && daysLeft < 7
                    ? s.chipWarning
                    : s.chipSuccess
                  : s.chipWarning
              }`}
            >
              {live
                ? daysLeft !== null && daysLeft < 7
                  ? `expires in ${daysLeft}d`
                  : "connected"
                : "manual mode"}
            </span>
          </div>
          {live ? (
            <dl className={s.kv}>
              <dt>Handle</dt>
              <dd>@{live.handle}</dd>
              <dt>Name</dt>
              <dd>{live.display_name ?? "—"}</dd>
              <dt>IG user id</dt>
              <dd className={s.mono}>{live.external_user_id}</dd>
              <dt>Facebook Page</dt>
              <dd className={s.mono}>{live.page_id ?? "—"}</dd>
              <dt>Connected</dt>
              <dd>{when(live.connected_at)}</dd>
              <dt>Token expires</dt>
              <dd>{when(live.expires_at)}</dd>
            </dl>
          ) : (
            <p className={s.muted} style={{ margin: 0 }}>
              Not connected. The queue still works: due posts are emailed with caption and
              media links, and you mark them published once they are up.
            </p>
          )}
        </section>

        <section className={`${s.card} ${s.span6}`} aria-labelledby="scopes">
          <div className={s.cardTitle}>
            <h2 className={s.h2} id="scopes" style={{ margin: 0 }}>
              What the connection asks for
            </h2>
          </div>
          <ul className={s.list}>
            {INSTAGRAM_SCOPES.map((sc) => (
              <li key={sc} className={s.mono}>
                {sc}
              </li>
            ))}
          </ul>
          <p className={s.metricNote}>
            Redirect URI registered on the Meta app:{" "}
            <code>https://nullshift.co.uk/api/social/instagram/callback</code>
          </p>
        </section>

        {accounts.length > (live ? 1 : 0) ? (
          <section className={`${s.card} ${s.span12}`} aria-labelledby="hist">
            <div className={s.cardTitle}>
              <h2 className={s.h2} id="hist" style={{ margin: 0 }}>
                History
              </h2>
            </div>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>Handle</th>
                  <th>Status</th>
                  <th>Connected</th>
                  <th>Expires</th>
                  <th>Last error</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td>{a.platform}</td>
                    <td>@{a.handle}</td>
                    <td>
                      <span
                        className={`${s.chip} ${a.status === "connected" ? s.chipSuccess : a.status === "revoked" ? "" : s.chipDanger}`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td>{when(a.connected_at)}</td>
                    <td>{when(a.expires_at)}</td>
                    <td className={s.muted}>{a.last_error ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}
      </div>
    </>
  );
}
