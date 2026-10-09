import Link from "next/link";
import { PILLARS } from "@/lib/social/rules";
import { Notice, first } from "../../sales/ops-ui";
import s from "../../shell.module.css";
import c from "../social.module.css";
import { importPlanForm } from "../actions";

export const dynamic = "force-dynamic";

const EXAMPLE = `[
  {
    "kind": "feed",
    "caption": "How The Dance Exclusive took bookings off WhatsApp.\\n\\n#smallbusiness #bookings #webdesign",
    "scheduled_at": "2026-10-13T10:00",
    "pillar": "proof",
    "first_comment": "Full story: nullshift.co.uk/client-stories",
    "media": [{ "url": "https://…/dance-exclusive.jpg", "type": "image", "alt": "Booking page" }]
  },
  {
    "kind": "reel",
    "caption": "Three things we check before we quote a build.",
    "scheduled_at": "2026-10-15T12:30",
    "pillar": "process",
    "media": [{ "url": "https://…/checks.mp4", "type": "video" }]
  }
]`;

export default async function ImportPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const raw = first(sp.notice);
  const n = raw?.startsWith("err:")
    ? { tone: "danger" as const, text: raw.slice(4) }
    : null;

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <p className={s.mono}>
            <Link href="/admin/social" className={s.rowLink}>
              Social
            </Link>{" "}
            · Import plan
          </p>
          <h1 className={s.h1}>Import a content plan</h1>
          <p className={s.lead}>
            Paste a JSON array and every row lands as a draft. Nothing is approved or
            scheduled by an import; review each one, then use Approve week and Schedule
            week on the queue.
          </p>
        </div>
      </div>

      {n ? <Notice tone={n.tone}>{n.text}</Notice> : null}

      <div className={s.grid12}>
        <section className={`${s.card} ${s.span8}`}>
          <form action={importPlanForm}>
            <div className={s.field}>
              <label className={`${s.fieldLabel} ${s.mono}`} htmlFor="plan">
                JSON
              </label>
              <textarea
                id="plan"
                name="plan"
                className={c.textarea}
                style={{ minHeight: 360 }}
                required
                placeholder={EXAMPLE}
              />
            </div>
            <button type="submit" className={s.btnPrimary}>
              Import as drafts
            </button>
          </form>
        </section>
        <section className={`${s.card} ${s.span4}`}>
          <div className={s.cardTitle}>
            <h2 className={s.h2} style={{ margin: 0 }}>
              Shape
            </h2>
          </div>
          <dl className={s.kv}>
            <dt>kind</dt>
            <dd>feed · reel · story · carousel</dd>
            <dt>caption</dt>
            <dd>≤ 2,200 chars, ≤ 30 hashtags</dd>
            <dt>scheduled_at</dt>
            <dd>ISO, or London wall-clock YYYY-MM-DDTHH:mm</dd>
            <dt>pillar</dt>
            <dd>{PILLARS.map((p) => p.id).join(" · ")}</dd>
            <dt>first_comment</dt>
            <dd>optional</dd>
            <dt>media</dt>
            <dd>[{"{url, type: image|video, alt?}"}] — public https URLs</dd>
          </dl>
          <p className={s.metricNote}>
            Media can also be uploaded per post afterwards; an import with no media still
            creates the draft. Up to 200 rows per import; one bad row fails the whole
            import so nothing half-loads.
          </p>
          <code className={c.code}>{EXAMPLE}</code>
        </section>
      </div>
    </>
  );
}
