import Link from "next/link";
import { isoToLondonLocal } from "@/lib/social/rules";
import { first } from "../../sales/ops-ui";
import s from "../../shell.module.css";
import { ComposeForm } from "../ComposeForm";

export const dynamic = "force-dynamic";

export default async function NewSocialPost({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  // ?at=YYYY-MM-DD pre-fills 10:00 London on that day.
  const at = first(sp.at);
  const scheduled_local =
    at && /^\d{4}-\d{2}-\d{2}$/.test(at) ? `${at}T10:00` : isoToLondonLocal(null);

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <p className={s.mono}>
            <Link href="/admin/social" className={s.rowLink}>
              Social
            </Link>{" "}
            · New post
          </p>
          <h1 className={s.h1}>Compose</h1>
          <p className={s.lead}>
            Saves as a draft. Approve it from the queue or the post page once it reads
            right.
          </p>
        </div>
      </div>
      <ComposeForm
        handle="nullshift.dev"
        post={{
          id: null,
          kind: "feed",
          caption: "",
          first_comment: null,
          pillar: null,
          scheduled_local,
          media: [],
          status: "draft",
        }}
      />
    </>
  );
}
