import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@nullshift/db";
import {
  isoToLondonLocal,
  parseMediaList,
  type PostKind,
  type PostStatus,
} from "@/lib/social/rules";
import { Notice, first, stateTone } from "../../sales/ops-ui";
import s from "../../shell.module.css";
import c from "../social.module.css";
import { ComposeForm } from "../ComposeForm";
import {
  approvePostForm,
  backToDraftForm,
  deletePostForm,
  markPublishedForm,
  schedulePostForm,
  unschedulePostForm,
} from "../actions";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  kind: PostKind;
  caption: string;
  media: unknown;
  first_comment: string | null;
  scheduled_at: string | null;
  status: PostStatus;
  pillar: string | null;
  error: string | null;
  approved_at: string | null;
  published_at: string | null;
  published_external_id: string | null;
  created_at: string;
  updated_at: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/London",
      })
    : "—";

function noticeFor(raw: string | undefined) {
  if (!raw) return null;
  if (raw.startsWith("ok:")) return { tone: "info" as const, text: raw.slice(3) };
  if (raw.startsWith("warn:")) return { tone: "warning" as const, text: raw.slice(5) };
  if (raw.startsWith("err:")) return { tone: "danger" as const, text: raw.slice(4) };
  return null;
}

export default async function SocialPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase
    .from("social_posts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const post = data as Row;
  const media = parseMediaList(post.media);
  const n = noticeFor(first(sp.notice));
  const askMark =
    first(sp.mark) === "published" &&
    (post.status === "needs_manual" || post.status === "failed");

  const hidden = <input type="hidden" name="id" value={post.id} />;

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <p className={s.mono}>
            <Link href="/admin/social" className={s.rowLink}>
              Social
            </Link>{" "}
            · {post.kind} · {post.id.slice(0, 8)}
          </p>
          <h1 className={s.h1} style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {post.kind === "story"
              ? "Story"
              : post.kind === "reel"
                ? "Reel"
                : post.kind === "carousel"
                  ? "Carousel"
                  : "Feed post"}
            <span className={`${s.chip} ${stateTone(post.status.replace("_", " "))}`}>
              {post.status.replace("_", " ")}
            </span>
          </h1>
          <p className={s.lead}>
            Scheduled {when(post.scheduled_at)}
            {post.approved_at ? ` · approved ${when(post.approved_at)}` : ""}
            {post.published_at ? ` · published ${when(post.published_at)}` : ""}
          </p>
        </div>
        <div className={c.actions}>
          {post.status === "draft" ? (
            <form action={approvePostForm}>
              {hidden}
              <button type="submit" className={s.btnPrimary}>
                Approve
              </button>
            </form>
          ) : null}
          {post.status === "approved" ? (
            <>
              <form action={schedulePostForm}>
                {hidden}
                <button type="submit" className={s.btnPrimary}>
                  Schedule
                </button>
              </form>
              <form action={backToDraftForm}>
                {hidden}
                <button type="submit" className={s.btn}>
                  Back to draft
                </button>
              </form>
            </>
          ) : null}
          {post.status === "scheduled" ? (
            <form action={unschedulePostForm}>
              {hidden}
              <button type="submit" className={s.btn}>
                Unschedule
              </button>
            </form>
          ) : null}
          {post.status === "failed" || post.status === "needs_manual" ? (
            <>
              <form action={markPublishedForm}>
                {hidden}
                <button type="submit" className={s.btnPrimary}>
                  Mark as published
                </button>
              </form>
              <form action={schedulePostForm}>
                {hidden}
                <button type="submit" className={s.btn}>
                  Retry (re-schedule)
                </button>
              </form>
              <form action={backToDraftForm}>
                {hidden}
                <button type="submit" className={s.btn}>
                  Back to draft
                </button>
              </form>
            </>
          ) : null}
          {post.status !== "published" && post.status !== "publishing" ? (
            <form action={deletePostForm}>
              {hidden}
              <button type="submit" className={s.btn}>
                Delete
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {n ? <Notice tone={n.tone}>{n.text}</Notice> : null}
      {askMark ? (
        <Notice tone="info">
          You came from the manual-mode email. Once this is posted from the @nullshift.dev
          app, use &ldquo;Mark as published&rdquo; above so the queue stays honest.
        </Notice>
      ) : null}
      {post.error && post.status !== "published" ? (
        <Notice tone="danger">{post.error}</Notice>
      ) : null}
      {post.status === "published" ? (
        <Notice tone="info">
          Published {when(post.published_at)}
          {post.published_external_id
            ? ` · Instagram media id ${post.published_external_id}`
            : " · by hand"}
          .
        </Notice>
      ) : null}

      <ComposeForm
        handle="nullshift.dev"
        post={{
          id: post.id,
          kind: post.kind,
          caption: post.caption,
          first_comment: post.first_comment,
          pillar: post.pillar,
          scheduled_local: isoToLondonLocal(post.scheduled_at),
          media,
          status: post.status,
        }}
      />
    </>
  );
}
