import { describe, expect, it } from "vitest";
import {
  OUTREACH_SEQUENCE,
  PARK_DAYS,
  addDays,
  afterTouch,
  applicationAgencyType,
  applicationTag,
  applicationToProspect,
  normaliseAgencyType,
  normaliseEmail,
  normaliseHandle,
  normaliseWebsite,
  parseProspectCsv,
  planNextTouch,
  sequencePosition,
  splitCsvLine,
} from "@/lib/ops/outreachSequence";

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date("2026-10-09T09:00:00.000Z");

describe("outreach sequence", () => {
  it("is 4 touches over 14 days: email, linkedin, email, email", () => {
    expect(OUTREACH_SEQUENCE.map((s) => [s.day, s.channel])).toEqual([
      [0, "email"],
      [3, "linkedin"],
      [7, "email"],
      [14, "email"],
    ]);
  });

  it("step 1 is due now when nothing has been sent", () => {
    const plan = planNextTouch({ outboundCount: 0, firstOutboundAt: null, now: T0 });
    expect(plan.kind).toBe("touch");
    if (plan.kind === "touch") {
      expect(plan.step.step).toBe(1);
      expect(plan.dueAt.getTime()).toBe(T0.getTime());
    }
  });

  it("schedules later steps from the first outbound touch", () => {
    const first = T0;
    const now = addDays(T0, 1);
    const plan = planNextTouch({ outboundCount: 1, firstOutboundAt: first, now });
    expect(plan.kind).toBe("touch");
    if (plan.kind === "touch") {
      expect(plan.step.channel).toBe("linkedin");
      expect(plan.dueAt.getTime()).toBe(first.getTime() + 3 * DAY);
    }
    const plan3 = planNextTouch({ outboundCount: 2, firstOutboundAt: first, now });
    if (plan3.kind === "touch")
      expect(plan3.dueAt.getTime()).toBe(first.getTime() + 7 * DAY);
    const plan4 = planNextTouch({ outboundCount: 3, firstOutboundAt: first, now });
    if (plan4.kind === "touch")
      expect(plan4.dueAt.getTime()).toBe(first.getTime() + 14 * DAY);
  });

  it("never schedules in the past: a late step is due now", () => {
    const first = T0;
    const now = addDays(T0, 10);
    const plan = planNextTouch({ outboundCount: 1, firstOutboundAt: first, now });
    if (plan.kind === "touch") expect(plan.dueAt.getTime()).toBe(now.getTime());
  });

  it("parks for 90 days once four outbound touches are sent", () => {
    const plan = planNextTouch({ outboundCount: 4, firstOutboundAt: T0, now: T0 });
    expect(plan.kind).toBe("park");
    if (plan.kind === "park")
      expect(plan.parkedUntil.getTime()).toBe(T0.getTime() + PARK_DAYS * DAY);
  });

  it("describes the position", () => {
    expect(sequencePosition(0)).toBe("step 1 of 4");
    expect(sequencePosition(3)).toBe("step 4 of 4");
    expect(sequencePosition(4)).toBe("sequence complete (4/4)");
  });
});

describe("afterTouch", () => {
  it("first outbound email → contacted, LinkedIn due on day 3", () => {
    const r = afterTouch({
      status: "queued",
      direction: "outbound",
      channel: "email",
      priorOutboundCount: 0,
      firstOutboundAt: null,
      now: T0,
    });
    expect(r.status).toBe("contacted");
    expect(r.nextTouchAt?.getTime()).toBe(T0.getTime() + 3 * DAY);
    expect(r.parkedUntil).toBeNull();
  });

  it("fourth outbound with no reply → parked for 90 days", () => {
    const now = addDays(T0, 14);
    const r = afterTouch({
      status: "contacted",
      direction: "outbound",
      channel: "email",
      priorOutboundCount: 3,
      firstOutboundAt: T0,
      now,
    });
    expect(r.status).toBe("parked");
    expect(r.parkedUntil?.getTime()).toBe(now.getTime() + PARK_DAYS * DAY);
    expect(r.nextTouchAt?.getTime()).toBe(r.parkedUntil?.getTime());
  });

  it("inbound reply → replied, follow up within a day", () => {
    const r = afterTouch({
      status: "contacted",
      direction: "inbound",
      channel: "email",
      priorOutboundCount: 2,
      firstOutboundAt: T0,
      now: T0,
    });
    expect(r.status).toBe("replied");
    expect(r.nextTouchAt?.getTime()).toBe(T0.getTime() + DAY);
  });

  it("outbound after a reply stays in conversation (no sequence, no park)", () => {
    const r = afterTouch({
      status: "replied",
      direction: "outbound",
      channel: "email",
      priorOutboundCount: 4,
      firstOutboundAt: T0,
      now: T0,
    });
    expect(r.status).toBe("replied");
    expect(r.parkedUntil).toBeNull();
    expect(r.nextTouchAt?.getTime()).toBe(T0.getTime() + 3 * DAY);
  });

  it("notes never change status or schedule; terminal statuses stay put", () => {
    const note = afterTouch({
      status: "contacted",
      direction: "outbound",
      channel: "note",
      priorOutboundCount: 1,
      firstOutboundAt: T0,
      now: T0,
    });
    expect(note).toEqual({ status: "contacted", nextTouchAt: null, parkedUntil: null });
    const done = afterTouch({
      status: "agreed",
      direction: "inbound",
      channel: "email",
      priorOutboundCount: 1,
      firstOutboundAt: T0,
      now: T0,
    });
    expect(done.status).toBe("agreed");
    expect(done.nextTouchAt).toBeNull();
  });

  it("a meeting books the call", () => {
    const r = afterTouch({
      status: "replied",
      direction: "outbound",
      channel: "meeting",
      priorOutboundCount: 2,
      firstOutboundAt: T0,
      now: T0,
    });
    expect(r.status).toBe("call_booked");
  });
});

describe("CSV parser", () => {
  it("splits quoted fields with commas and doubled quotes", () => {
    expect(splitCsvLine('a,"b, c","say ""hi""",d')).toEqual([
      "a",
      "b, c",
      'say "hi"',
      "d",
    ]);
  });

  it("parses the documented columns in any order and normalises values", () => {
    const csv = [
      "email,Company,agency_type,website,instagram_handle,notes",
      "Jane@Example.com,Acme Growth,SEO,acme.io,@acme,Looks promising",
      ",No Email Ltd,growth,https://noemail.co,,",
    ].join("\n");
    const r = parseProspectCsv(csv);
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({
      line: 2,
      company: "Acme Growth",
      email: "jane@example.com",
      agency_type: "seo_ppc",
      website: "https://acme.io",
      instagram_handle: "acme",
      fit_notes: "Looks promising",
      country: null,
    });
    expect(r.rows[1]).toMatchObject({
      company: "No Email Ltd",
      email: null,
      agency_type: "growth_consultant",
      website: "https://noemail.co",
    });
  });

  it("accepts tab-separated pastes and CRLF line endings", () => {
    const r = parseProspectCsv("company\tcountry\r\nTabbed Co\tUK\r\n");
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ company: "Tabbed Co", country: "UK" });
  });

  it("rejects a paste without a company column", () => {
    const r = parseProspectCsv("email,website\na@b.co,x.com");
    expect(r.rows).toEqual([]);
    expect(r.errors[0]).toMatch(/company/);
  });

  it("drops rows with a missing company or invalid email and reports them", () => {
    const r = parseProspectCsv(
      ["company,email", ",a@b.co", "Bad Email,not-an-email", "Good,good@b.co"].join("\n")
    );
    expect(r.rows.map((x) => x.company)).toEqual(["Good"]);
    expect(r.errors).toHaveLength(2);
    expect(r.errors[0]).toMatch(/Row 2/);
    expect(r.errors[1]).toMatch(/not-an-email/);
  });

  it("keeps the first of duplicate emails within the paste", () => {
    const r = parseProspectCsv(
      ["company,email", "One,dup@x.co", "Two,DUP@x.co", "Three,other@x.co"].join("\n")
    );
    expect(r.rows.map((x) => x.company)).toEqual(["One", "Three"]);
    expect(r.errors[0]).toMatch(/duplicate email dup@x.co/);
  });

  it("maps unknown agency types to other with a warning", () => {
    const r = parseProspectCsv("company,agency_type\nX,plumbing");
    expect(r.rows[0].agency_type).toBe("other");
    expect(r.errors[0]).toMatch(/unknown agency_type "plumbing"/);
  });

  it("empty paste is an error", () => {
    expect(parseProspectCsv("  \n ").errors[0]).toMatch(/empty/);
  });
});

describe("normalisers", () => {
  it("email", () => {
    expect(normaliseEmail(" Jane@X.Co ")).toBe("jane@x.co");
    expect(normaliseEmail("nope")).toBeNull();
    expect(normaliseEmail("")).toBeNull();
  });
  it("agency type aliases", () => {
    expect(normaliseAgencyType("Growth Consultant")).toBe("growth_consultant");
    expect(normaliseAgencyType("seo/ppc")).toBe("seo_ppc");
    expect(normaliseAgencyType("Bookkeeper")).toBe("accountant");
    expect(normaliseAgencyType("design_studio")).toBe("design_studio");
    expect(normaliseAgencyType("nonsense")).toBeNull();
    expect(normaliseAgencyType(null)).toBeNull();
  });
  it("instagram handle and website", () => {
    expect(normaliseHandle("@studio")).toBe("studio");
    expect(normaliseHandle("https://www.instagram.com/studio/")).toBe("studio");
    expect(normaliseWebsite("acme.io")).toBe("https://acme.io");
    expect(normaliseWebsite("http://acme.io")).toBe("http://acme.io");
    expect(normaliseWebsite("")).toBeNull();
  });
});

describe("application → prospect", () => {
  it("maps /partners agency types onto the outreach vocabulary", () => {
    expect(applicationAgencyType("growth_consultancy")).toBe("growth_consultant");
    expect(applicationAgencyType("marketing_seo_ppc")).toBe("marketing_agency");
    expect(applicationAgencyType("design_brand")).toBe("design_studio");
    expect(applicationAgencyType("social")).toBe("social_media");
    expect(applicationAgencyType("accountancy")).toBe("accountant");
    expect(applicationAgencyType("other")).toBe("other");
    expect(applicationAgencyType(null)).toBeNull();
  });

  it("builds a replied prospect, a follow-up tomorrow, the link tag and an inbound note", () => {
    const r = applicationToProspect(
      {
        id: "11111111-2222-3333-4444-555555555555",
        agency_name: "Sunday Commerce",
        website: "sundaycommerce.co",
        country: "United Kingdom",
        contact_name: "Jane",
        role: "Founder",
        email: "Jane@SundayCommerce.co",
        agency_type: "growth_consultancy",
        team_size: "2-5",
        model_interest: "white_label",
        client_types: "DTC brands",
        message: "Keen to talk",
      },
      T0
    );
    expect(r.prospect).toMatchObject({
      company: "Sunday Commerce",
      website: "https://sundaycommerce.co",
      agency_type: "growth_consultant",
      staff_band: "2-5",
      contact_role: "Founder",
      email: "jane@sundaycommerce.co",
      source: "partners form",
      status: "replied",
      next_touch_at: new Date(T0.getTime() + DAY).toISOString(),
    });
    expect(r.prospect.tags).toContain(
      applicationTag("11111111-2222-3333-4444-555555555555")
    );
    expect(r.prospect.tags).toContain("white_label");
    expect(r.prospect.fit_notes).toContain("Model interest: White-label");
    expect(r.prospect.fit_notes).toContain("Client types: DTC brands");
    expect(r.touch).toMatchObject({ channel: "note", direction: "inbound" });
    expect(r.touch.body).toContain("Keen to talk");
  });
});
