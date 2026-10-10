import { describe, expect, it } from "vitest";
import {
  PLATFORM_LIMITS,
  bucketByDay,
  canTransition,
  captionLength,
  countHashtags,
  countMentions,
  isDue,
  isoToLondonLocal,
  londonLocalToIso,
  parseImportPlan,
  parseMediaList,
  splitHashtagLine,
  validateCaption,
  validateMedia,
  validateSchedule,
  validateUpload,
  weekDays,
  weekStartKey,
} from "@/lib/social/rules";
import { containerParamsFor } from "@/lib/social/instagram";
import { mintSocialState, readSocialState } from "@/lib/social/state";
import {
  decryptSocialToken,
  encryptSocialToken,
  parseSocialKey,
} from "@/lib/social/crypto";

describe("captions", () => {
  it("counts code points, hashtags and mentions", () => {
    expect(captionLength("héllo 👋")).toBe(7);
    expect(countHashtags("one #two three #four\n#five")).toBe(3);
    expect(countHashtags("email#notatag")).toBe(0);
    expect(countMentions("hi @nullshift.dev and @louis")).toBe(2);
  });

  it("rejects over-limit captions and empty feed captions", () => {
    const tooLong = "x".repeat(PLATFORM_LIMITS.captionMaxChars + 1);
    expect(validateCaption(tooLong, "feed").some((p) => p.detail.includes("2200"))).toBe(
      true
    );
    const tooManyTags = Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" ");
    expect(
      validateCaption(`hi ${tooManyTags}`, "feed").some((p) =>
        p.detail.includes("hashtags")
      )
    ).toBe(true);
    expect(validateCaption("", "feed")).toHaveLength(1);
    expect(validateCaption("", "story")).toHaveLength(0);
    expect(validateCaption("We build booking systems.", "feed")).toHaveLength(0);
  });

  it("splits the trailing hashtag line from the body", () => {
    const r = splitHashtagLine("Body line one\nline two\n\n#a #b_c #d");
    expect(r.body).toBe("Body line one\nline two");
    expect(r.tags).toEqual(["#a", "#b_c", "#d"]);
    expect(splitHashtagLine("no tags here").tags).toEqual([]);
  });
});

describe("media", () => {
  it("parses and validates media per kind", () => {
    const img = { url: "https://cdn.example/a.jpg", type: "image" as const };
    const vid = { url: "https://cdn.example/a.mp4", type: "video" as const };
    expect(
      parseMediaList([img, { url: "", type: "image" }, { url: "x", type: "gif" }])
    ).toEqual([img]);
    expect(validateMedia([img], "feed")).toHaveLength(0);
    expect(validateMedia([], "feed")).toHaveLength(1);
    expect(validateMedia([img], "reel")).toHaveLength(1);
    expect(validateMedia([vid], "reel")).toHaveLength(0);
    expect(validateMedia([img], "carousel")).toHaveLength(1);
    expect(validateMedia([img, vid], "carousel")).toHaveLength(0);
    expect(validateMedia(Array(11).fill(img), "carousel")).toHaveLength(1);
    expect(
      validateMedia([{ url: "http://insecure/a.jpg", type: "image" }], "feed")
    ).toHaveLength(1);
  });

  it("validates uploads by type and size", () => {
    expect(
      validateUpload({ name: "a.jpg", size: 1000, contentType: "image/jpeg" })
    ).toHaveLength(0);
    expect(
      validateUpload({ name: "a.pdf", size: 1000, contentType: "application/pdf" })
    ).toHaveLength(1);
    expect(
      validateUpload({ name: "big.jpg", size: PLATFORM_LIMITS.imageMaxBytes + 1 })
    ).toHaveLength(1);
    expect(
      validateUpload({ name: "a.mp4", size: 50 * 1024 * 1024, contentType: "video/mp4" })
    ).toHaveLength(0);
    expect(validateUpload({ name: "empty.jpg", size: 0 })).toHaveLength(1);
  });

  it("builds Graph container params per kind", () => {
    const img = { url: "https://cdn.example/a.jpg", type: "image" as const, alt: "alt" };
    const vid = { url: "https://cdn.example/a.mp4", type: "video" as const };
    expect(containerParamsFor("feed", img, "cap")).toEqual({
      image_url: img.url,
      alt_text: "alt",
      caption: "cap",
    });
    expect(containerParamsFor("reel", vid, "cap")).toMatchObject({
      video_url: vid.url,
      media_type: "REELS",
      caption: "cap",
    });
    expect(containerParamsFor("story", img, "cap")).toEqual({
      image_url: img.url,
      media_type: "STORIES",
    });
    expect(containerParamsFor("carousel", vid, "", { carouselChild: true })).toEqual({
      video_url: vid.url,
      is_carousel_item: "true",
      media_type: "VIDEO",
    });
  });
});

describe("schedule window", () => {
  const now = new Date("2026-10-09T12:00:00Z");
  const base = { approved_at: "2026-10-08T00:00:00Z" };

  it("only publishes approved, scheduled posts whose time has passed", () => {
    expect(
      isDue({ ...base, status: "scheduled", scheduled_at: "2026-10-09T11:59:00Z" }, now)
        .due
    ).toBe(true);
    expect(
      isDue({ ...base, status: "scheduled", scheduled_at: "2026-10-09T12:01:00Z" }, now)
        .due
    ).toBe(false);
    expect(
      isDue({ ...base, status: "approved", scheduled_at: "2026-10-09T11:00:00Z" }, now)
        .due
    ).toBe(false);
    expect(
      isDue({ ...base, status: "draft", scheduled_at: "2026-10-09T11:00:00Z" }, now).due
    ).toBe(false);
    expect(
      isDue(
        { status: "scheduled", scheduled_at: "2026-10-09T11:00:00Z", approved_at: null },
        now
      ).due
    ).toBe(false);
    expect(isDue({ ...base, status: "scheduled", scheduled_at: null }, now).due).toBe(
      false
    );
  });

  it("flags very late posts but still publishes them", () => {
    const r = isDue(
      { ...base, status: "scheduled", scheduled_at: "2026-10-09T01:00:00Z" },
      now
    );
    expect(r).toEqual({ due: true, isLate: true });
  });

  it("requires a lead time when scheduling", () => {
    expect(validateSchedule(null, now)).toHaveLength(1);
    expect(validateSchedule("2026-10-09T12:02:00Z", now)).toHaveLength(1);
    expect(validateSchedule("2026-10-09T12:30:00Z", now)).toHaveLength(0);
    expect(validateSchedule("nope", now)).toHaveLength(1);
  });

  it("enforces the status machine", () => {
    expect(canTransition("draft", "approved")).toBe(true);
    expect(canTransition("draft", "scheduled")).toBe(false);
    expect(canTransition("approved", "scheduled")).toBe(true);
    expect(canTransition("scheduled", "approved")).toBe(true);
    expect(canTransition("published", "draft")).toBe(false);
    expect(canTransition("needs_manual", "published")).toBe(true);
    expect(canTransition("publishing", "draft")).toBe(false);
  });
});

describe("London time", () => {
  it("converts wall-clock to UTC across BST and GMT", () => {
    expect(londonLocalToIso("2026-07-01T10:00")).toBe("2026-07-01T09:00:00.000Z");
    expect(londonLocalToIso("2026-12-01T10:00")).toBe("2026-12-01T10:00:00.000Z");
    expect(londonLocalToIso("garbage")).toBeNull();
    expect(isoToLondonLocal("2026-07-01T09:00:00.000Z")).toBe("2026-07-01T10:00");
    expect(isoToLondonLocal(null)).toBe("");
  });

  it("buckets a week Mon–Sun by London date", () => {
    const monday = weekStartKey(new Date("2026-10-09T12:00:00Z")); // Friday
    expect(monday).toBe("2026-10-05");
    expect(weekDays(monday)).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
    ]);
    const posts = [
      { id: "a", scheduled_at: "2026-10-10T23:30:00Z" }, // Sun 00:30 London
      { id: "b", scheduled_at: "2026-10-05T08:00:00Z" },
      { id: "c", scheduled_at: null },
    ];
    const b = bucketByDay(posts, monday);
    expect(b.get("2026-10-11")?.map((p) => p.id)).toEqual(["a"]);
    expect(b.get("2026-10-05")?.map((p) => p.id)).toEqual(["b"]);
    expect(b.get("")?.map((p) => p.id)).toEqual(["c"]);
  });
});

describe("import plan", () => {
  it("parses a valid plan and normalises times", () => {
    const r = parseImportPlan(
      JSON.stringify([
        {
          kind: "feed",
          caption: "hi",
          scheduled_at: "2026-10-13T10:00",
          pillar: "proof",
          media: [{ url: "https://x/a.jpg", type: "image" }],
        },
        { kind: "story", scheduled_at: "2026-10-14T09:00:00Z" },
      ])
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.posts[0].scheduled_at).toBe("2026-10-13T09:00:00.000Z");
    expect(r.posts[1].scheduled_at).toBe("2026-10-14T09:00:00.000Z");
    expect(r.posts[1].caption).toBe("");
  });

  it("fails the whole import on any bad row", () => {
    expect(parseImportPlan("not json").ok).toBe(false);
    expect(parseImportPlan("{}").ok).toBe(false);
    expect(parseImportPlan("[]").ok).toBe(false);
    const r = parseImportPlan(
      JSON.stringify([
        { kind: "feed", caption: "ok" },
        { kind: "tweet", caption: "x" },
      ])
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.problems[0].field).toBe("row 2");
    const bad = parseImportPlan(
      JSON.stringify([{ kind: "feed", caption: "", scheduled_at: "soon" }])
    );
    expect(bad.ok).toBe(false);
  });
});

describe("oauth state and token crypto", () => {
  it("round-trips a signed state and refuses tampering/expiry", () => {
    const secret = "s".repeat(32);
    const t = mintSocialState("user-12345678", secret, 1000);
    expect(readSocialState(t, secret, 2000)?.u).toBe("user-12345678");
    expect(readSocialState(t, "other-secret-xxxxxxxxxxxxxxxxxxxx", 2000)).toBeNull();
    expect(readSocialState(t, secret, 1000 + 16 * 60 * 1000)).toBeNull();
    expect(readSocialState(`${t}x`, secret, 2000)).toBeNull();
  });

  it("encrypts tokens bound to the account id", () => {
    const key = parseSocialKey("ab".repeat(32));
    const enc = encryptSocialToken("EAAtoken", key, "acct-1");
    expect(decryptSocialToken(enc, key, "acct-1")).toBe("EAAtoken");
    expect(() => decryptSocialToken(enc, key, "acct-2")).toThrow();
    expect(() => parseSocialKey("short")).toThrow();
  });
});
