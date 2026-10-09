"use client";

import { useMemo, useState } from "react";
import {
  PILLARS,
  PLATFORM_LIMITS,
  POST_KINDS,
  captionLength,
  countHashtags,
  countMentions,
  splitHashtagLine,
  type MediaItem,
  type PostKind,
} from "@/lib/social/rules";
import { removeMediaForm, savePost } from "./actions";
import s from "../shell.module.css";
import c from "./social.module.css";

export type ComposePost = {
  id: string | null;
  kind: PostKind;
  caption: string;
  first_comment: string | null;
  pillar: string | null;
  scheduled_local: string;
  media: MediaItem[];
  status: string;
};

const KIND_LABEL: Record<PostKind, string> = {
  feed: "Feed post (1 image or video)",
  reel: "Reel (1 video)",
  story: "Story (1 image or video, 24h)",
  carousel: "Carousel (2–10 items)",
};

export function ComposeForm({ post, handle }: { post: ComposePost; handle: string }) {
  const [kind, setKind] = useState<PostKind>(post.kind);
  const [caption, setCaption] = useState(post.caption);
  const [firstComment, setFirstComment] = useState(post.first_comment ?? "");
  const locked = post.status === "published" || post.status === "publishing";

  const len = captionLength(caption);
  const tags = countHashtags(caption);
  const mentions = countMentions(caption);
  const over =
    len > PLATFORM_LIMITS.captionMaxChars ||
    tags > PLATFORM_LIMITS.captionMaxHashtags ||
    mentions > PLATFORM_LIMITS.captionMaxMentions;
  const preview = useMemo(() => splitHashtagLine(caption), [caption]);

  return (
    <div className={c.compose}>
      <form action={savePost} encType="multipart/form-data">
        {post.id ? <input type="hidden" name="id" value={post.id} /> : null}
        <input type="hidden" name="media_json" value={JSON.stringify(post.media)} />

        <div className={s.field}>
          <label className={`${s.fieldLabel} ${s.mono}`} htmlFor="kind">
            Kind
          </label>
          <select
            id="kind"
            name="kind"
            className={c.select}
            value={kind}
            onChange={(e) => setKind(e.target.value as PostKind)}
            disabled={locked}
          >
            {POST_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </div>

        <div className={s.field}>
          <label className={`${s.fieldLabel} ${s.mono}`} htmlFor="caption">
            Caption {kind === "story" ? "(stories carry no caption on Instagram)" : ""}
          </label>
          <textarea
            id="caption"
            name="caption"
            className={c.textarea}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={"Body of the post.\n\n#hashtags #on #their #own #line"}
            disabled={locked}
          />
          <div className={`${c.counter} ${over ? c.counterOver : ""}`}>
            <span>
              {len.toLocaleString("en-GB")} /{" "}
              {PLATFORM_LIMITS.captionMaxChars.toLocaleString("en-GB")} characters
            </span>
            <span>
              {tags} / {PLATFORM_LIMITS.captionMaxHashtags} hashtags · {mentions} /{" "}
              {PLATFORM_LIMITS.captionMaxMentions} mentions
            </span>
          </div>
        </div>

        <div className={s.field}>
          <label className={`${s.fieldLabel} ${s.mono}`} htmlFor="first_comment">
            First comment (optional — posted right after publishing)
          </label>
          <textarea
            id="first_comment"
            name="first_comment"
            className={`${c.textarea} ${c.textareaSmall}`}
            value={firstComment}
            onChange={(e) => setFirstComment(e.target.value)}
            disabled={locked}
          />
        </div>

        <div className={s.grid12}>
          <div className={`${s.field} ${s.span6}`}>
            <label className={`${s.fieldLabel} ${s.mono}`} htmlFor="scheduled_local">
              Scheduled (Europe/London)
            </label>
            <input
              id="scheduled_local"
              name="scheduled_local"
              type="datetime-local"
              className={c.input}
              defaultValue={post.scheduled_local}
              disabled={locked}
            />
          </div>
          <div className={`${s.field} ${s.span6}`}>
            <label className={`${s.fieldLabel} ${s.mono}`} htmlFor="pillar">
              Content pillar
            </label>
            <select
              id="pillar"
              name="pillar"
              className={c.select}
              defaultValue={post.pillar ?? ""}
              disabled={locked}
            >
              <option value="">—</option>
              {PILLARS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={s.field}>
          <span className={`${s.fieldLabel} ${s.mono}`}>Media</span>
          {post.media.length ? (
            <ul className={c.mediaList}>
              {post.media.map((m, i) => (
                <li key={`${m.url}-${i}`} className={c.mediaItem}>
                  {m.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt={m.alt ?? ""} />
                  ) : (
                    <video src={m.url} muted preload="metadata" />
                  )}
                  <div className={c.mediaItemFoot}>
                    <span>
                      {i + 1}. {m.type}
                    </span>
                    {post.id && !locked ? (
                      <button
                        type="submit"
                        className={c.linkBtn}
                        formAction={removeMediaForm}
                        name="index"
                        value={String(i)}
                        formNoValidate
                      >
                        remove
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.muted} style={{ margin: "0 0 8px" }}>
              No media yet. Upload files (JPEG for images; MP4/MOV for video) or paste
              public https URLs.
            </p>
          )}
          {!locked ? (
            <>
              <input
                type="file"
                name="files"
                multiple
                accept="image/jpeg,image/png,video/mp4,video/quicktime"
                className={c.input}
              />
              <textarea
                name="media_urls"
                className={`${c.textarea} ${c.textareaSmall}`}
                style={{ marginTop: 8 }}
                placeholder={
                  "Or paste URLs, one per line:\nhttps://…/image.jpg | alt text"
                }
              />
            </>
          ) : null}
        </div>

        {!locked ? (
          <div className={c.actions}>
            <button type="submit" className={s.btnPrimary}>
              {post.id ? "Save" : "Save draft"}
            </button>
            {post.status !== "draft" && post.id ? (
              <span className={s.muted} style={{ fontSize: 12 }}>
                Editing the caption, kind or media sends this back to draft.
              </span>
            ) : null}
          </div>
        ) : (
          <p className={s.muted}>
            This post has gone out and is kept as the record of what was published.
          </p>
        )}
      </form>

      <aside>
        <div className={c.preview} aria-label="Preview">
          <p className={c.previewHandle}>@{handle}</p>
          {post.media[0]?.type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.media[0].url} alt="" className={c.thumb} />
          ) : (
            <div className={c.thumbEmpty}>{post.media[0] ? "video" : kind}</div>
          )}
          <p className={c.previewCaption}>
            {preview.body || <span className={s.faint}>(caption)</span>}
            {preview.tags.length ? (
              <>
                {"\n\n"}
                <span className={c.previewTags}>{preview.tags.join(" ")}</span>
              </>
            ) : null}
          </p>
          {firstComment.trim() ? (
            <p
              className={c.previewCaption}
              style={{ borderTop: "1px solid var(--ns-border)", paddingTop: 8 }}
            >
              <span className={s.faint}>first comment · </span>
              {firstComment}
            </p>
          ) : null}
        </div>
        <p className={s.metricNote} style={{ marginTop: 12 }}>
          Studio voice: write as &ldquo;we&rdquo;. Proof only from the client stories. No
          &ldquo;AI agency&rdquo;, no retainer-bashing. Plans from £40 / £80 / £120 a
          month.
        </p>
      </aside>
    </div>
  );
}
