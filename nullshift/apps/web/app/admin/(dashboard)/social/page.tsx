import Link from "next/link";
import { createClient } from "@nullshift/db";
import { isMetaConfigured } from "@/lib/social/instagram";
import {
  POST_KINDS,
  POST_STATUSES,
  addDaysKey,
  bucketByDay,
  londonDateKey,
  parseMediaList,
  weekDays,
  weekStartKey,
  type PostKind,
  type PostStatus,
} from "@/lib/social/rules";
import { Notice, first, stateTone } from "../sales/ops-ui";
import s from "../shell.module.css";
import c from "./social.module.css";
import {
  approveWeekForm,
  approvePostForm,
  schedulePostForm,
  scheduleWeekForm,
} from "./actions";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  kind: PostKind;
  caption: string;
  media: unknown;
  scheduled_at: string | null;
  status: PostStatus;
  pillar: string | null;
  error: string | null;
};

type Account = { id: string; handle: string; status: string; expires_at: string | null };

const DAY_LABEL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });

const dayLabel = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
};

function noticeFor(raw: string | undefined) {
  if (!raw) return null;
  if (raw.startsWith("ok:")) return { tone: "info" as const, text: raw.slice(3) };
  if (raw.startsWith("warn:")) return { tone: "warning" as const, text: raw.slice(5) };
  if (raw.startsWith("err:")) {
    const r = raw.slice(4);
    const text: Record<string, string> = {
      unauthenticated: "Sign in again to continue.",
      forbidden: "Staff only.",
      not_found: "That post no longer exists.",
    };
    return { tone: "danger" as const, text: text[r] ?? r };
  }
  return null;
}

function Card({ p }: { p: Row }) {
  const media = parseMediaList(p.media);
  const thumb = media[0];
  return (
    <Link href={`/admin/social/${p.id}`} className={c.card}>
      {thumb?.type === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb.url} alt="" className={c.thumb} loading="lazy" />
      ) : (
        <div className={c.thumbEmpty}>{thumb ? "video" : "no media"}</div>
      )}
      <div className={c.cardBody}>
        <div className={c.cardMeta}>
          <span className={`${s.chip} ${stateTone(p.status.replace("_", " "))}`}>
            {p.status.replace("_", " ")}
          </span>
          <span className={s.mono}>
            {p.kind}
            {p.scheduled_at ? ` · ${timeOf(p.scheduled_at)}` : ""}
          </span>
        </div>
        <p className={c.cardCaption}>
          {p.caption || <span className={s.faint}>(no caption)</span>}
        </p>
        {p.pillar ? (
          <div className={s.faint} style={{ fontSize: 11, marginTop: 4 }}>
            {p.pillar}
          </div>
        ) : null}
        {p.error ? (
          <div className={s.danger} style={{ fontSize: 11, marginTop: 4 }}>
            {p.error}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

export default async function SocialPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const weekParam = first(sp.week);
  const week =
    weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)
      ? weekStartKey(new Date(`${weekParam}T12:00:00Z`))
      : weekStartKey(now);
  const statusFilter = first(sp.status);
  const kindFilter = first(sp.kind);
  const status = (POST_STATUSES as readonly string[]).includes(statusFilter ?? "")
    ? (statusFilter as PostStatus)
    : null;
  const kind = (POST_KINDS as readonly string[]).includes(kindFilter ?? "")
    ? (kindFilter as PostKind)
    : null;
  const todayKey = londonDateKey(now);

  const supabase = await createClient();
  const from = `${week}T00:00:00Z`;
  const to = `${addDaysKey(week, 7)}T00:00:00Z`;

  let q = supabase
    .from("social_posts")
    .select("id, kind, caption, media, scheduled_at, status, pillar, error")
    .or(`and(scheduled_at.gte.${from},scheduled_at.lt.${to}),scheduled_at.is.null`)
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .limit(200);
  if (status) q = q.eq("status", status);
  if (kind) q = q.eq("kind", kind);
  const { data } = await q;
  const posts = (data ?? []) as Row[];
  const buckets = bucketByDay(posts, week);
  const days = weekDays(week);

  const { data: acctRow } = await supabase
    .from("social_accounts")
    .select("id, handle, status, expires_at")
    .eq("platform", "instagram")
    .in("status", ["connected", "expired", "error"])
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const account = (acctRow as Account | null) ?? null;
  const apiMode = !!account && account.status === "connected" && isMetaConfigured();

  const counts = {
    draft: posts.filter(
      (p) =>
        p.status === "draft" &&
        p.scheduled_at &&
        p.scheduled_at >= from &&
        p.scheduled_at < to
    ).length,
    approved: posts.filter(
      (p) =>
        p.status === "approved" &&
        p.scheduled_at &&
        p.scheduled_at >= from &&
        p.scheduled_at < to
    ).length,
    attention: posts.filter((p) => p.status === "failed" || p.status === "needs_manual")
      .length,
  };
  const n = noticeFor(first(sp.notice));
  const keep = `${status ? `&status=${status}` : ""}${kind ? `&kind=${kind}` : ""}`;

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <p className={s.mono}>
            Marketing · Social · Instagram @{account?.handle ?? "nullshift.dev"}
          </p>
          <h1 className={s.h1}>Social queue</h1>
          <p className={s.lead}>
            Draft → approve → schedule. The publisher runs every 15 minutes and only ever
            sends an approved, scheduled post.{" "}
            {apiMode
              ? "Instagram is connected: due posts go out through the API."
              : "Manual mode: due posts are emailed to Louis to post by hand, then marked published here."}
          </p>
        </div>
        <div className={c.actions}>
          <Link className={s.btn} href="/admin/social/accounts">
            Accounts
          </Link>
          <Link className={s.btn} href="/admin/social/import">
            Import plan
          </Link>
          <Link className={s.btnPrimary} href="/admin/social/new">
            New post
          </Link>
        </div>
      </div>

      {n ? <Notice tone={n.tone}>{n.text}</Notice> : null}
      {!apiMode ? (
        <Notice tone="warning">
          {account?.status === "expired"
            ? "The Instagram connection has expired. Reconnect under Accounts; until then posts fall back to manual mode."
            : "No Instagram account connected. Posts will be emailed to louis@nullshift.co.uk when due. Connect @nullshift.dev under Accounts once the Meta app is approved."}
        </Notice>
      ) : null}
      {counts.attention ? (
        <Notice tone="danger">
          {counts.attention} post{counts.attention === 1 ? "" : "s"} need attention
          (failed or waiting to be posted by hand).
        </Notice>
      ) : null}

      <section className={s.card} aria-labelledby="week">
        <div className={c.weekNav}>
          <div className={c.actions}>
            <Link
              className={`${s.btn} ${s.btnSmall}`}
              href={`/admin/social?week=${addDaysKey(week, -7)}${keep}`}
            >
              ← Previous
            </Link>
            <h2 className={s.h2} id="week" style={{ margin: "0 8px" }}>
              Week of {dayLabel(week)}
            </h2>
            <Link
              className={`${s.btn} ${s.btnSmall}`}
              href={`/admin/social?week=${addDaysKey(week, 7)}${keep}`}
            >
              Next →
            </Link>
            {week !== weekStartKey(now) ? (
              <Link
                className={`${s.btn} ${s.btnSmall}`}
                href={`/admin/social?${keep.slice(1)}`}
              >
                This week
              </Link>
            ) : null}
          </div>
          <div className={c.actions}>
            <form action={approveWeekForm}>
              <input type="hidden" name="week" value={week} />
              <button
                type="submit"
                className={`${s.btn} ${s.btnSmall}`}
                disabled={!counts.draft}
              >
                Approve week ({counts.draft})
              </button>
            </form>
            <form action={scheduleWeekForm}>
              <input type="hidden" name="week" value={week} />
              <button
                type="submit"
                className={`${s.btnPrimary} ${s.btnSmall}`}
                disabled={!counts.approved}
              >
                Schedule week ({counts.approved})
              </button>
            </form>
          </div>
        </div>

        <nav className={s.chips} aria-label="Filters" style={{ marginBottom: 12 }}>
          <Link
            href={`/admin/social?week=${week}${kind ? `&kind=${kind}` : ""}`}
            className={`${s.chip} ${!status ? s.chipInfo : ""}`}
          >
            all statuses
          </Link>
          {POST_STATUSES.map((st) => (
            <Link
              key={st}
              href={`/admin/social?week=${week}&status=${st}${kind ? `&kind=${kind}` : ""}`}
              className={`${s.chip} ${status === st ? s.chipInfo : ""}`}
            >
              {st.replace("_", " ")}
            </Link>
          ))}
          <span className={s.faint}>·</span>
          {POST_KINDS.map((k) => (
            <Link
              key={k}
              href={`/admin/social?week=${week}${status ? `&status=${status}` : ""}${kind === k ? "" : `&kind=${k}`}`}
              className={`${s.chip} ${kind === k ? s.chipInfo : ""}`}
            >
              {k}
            </Link>
          ))}
        </nav>

        <div className={c.board}>
          {days.map((key, i) => {
            const list = buckets.get(key) ?? [];
            return (
              <div key={key} className={`${c.day} ${key === todayKey ? c.dayToday : ""}`}>
                <div className={c.dayHead}>
                  <span>
                    <strong>{DAY_LABEL[i]}</strong>{" "}
                    <span className={s.muted}>{dayLabel(key)}</span>
                  </span>
                  <span className={s.faint}>{list.length || ""}</span>
                </div>
                <div className={c.dayBody}>
                  {list.map((p) => (
                    <div key={p.id}>
                      <Card p={p} />
                      {p.status === "draft" ? (
                        <form action={approvePostForm} style={{ marginTop: 4 }}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="back" value="list" />
                          <input type="hidden" name="week" value={week} />
                          <button
                            type="submit"
                            className={`${s.btn} ${s.btnSmall}`}
                            style={{ width: "100%" }}
                          >
                            Approve
                          </button>
                        </form>
                      ) : p.status === "approved" ? (
                        <form action={schedulePostForm} style={{ marginTop: 4 }}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="back" value="list" />
                          <input type="hidden" name="week" value={week} />
                          <button
                            type="submit"
                            className={`${s.btnPrimary} ${s.btnSmall}`}
                            style={{ width: "100%" }}
                          >
                            Schedule
                          </button>
                        </form>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {(buckets.get("") ?? []).length ? (
        <section className={`${s.card} ${c.unscheduled}`} aria-labelledby="unsched">
          <div className={s.cardTitle}>
            <h2 className={s.h2} id="unsched" style={{ margin: 0 }}>
              Unscheduled
            </h2>
            <span className={s.mono}>
              {(buckets.get("") ?? []).length} without a time
            </span>
          </div>
          <div className={c.unscheduledGrid}>
            {(buckets.get("") ?? []).map((p) => (
              <Card key={p.id} p={p} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
