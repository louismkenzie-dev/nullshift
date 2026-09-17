import { describe, expect, it } from "vitest";
import {
  londonToday,
  projectCalendarUrl,
  projectEnquiryLead,
  readProjectEnquiry,
  validateProjectEnquiry,
} from "@/lib/projectEnquiry";
import { projectEnquiryEmails } from "@/lib/projectEnquiryEmail";

const now = new Date("2026-09-17T10:00:00Z");
const valid = {
  name: "Jordan Example",
  email: "jordan@example.com",
  business: "Example Operations",
  challenge: "Connect our booking and finance tools.",
  budget: "",
  timing: "",
  preferredDate: "",
  preferredTime: "",
};
describe("project enquiries", () => {
  it("accepts a short enquiry without a budget, password or time", () =>
    expect(validateProjectEnquiry(valid, now)).toEqual({ ok: true, data: valid }));
  it("normalises contact details", () =>
    expect(
      validateProjectEnquiry(
        { ...valid, email: " JORDAN@EXAMPLE.COM ", business: " Example Operations " },
        now
      )
    ).toMatchObject({ ok: true, data: valid }));
  it.each([
    null,
    [],
    {},
    "invalid",
    { ...valid, name: 12 },
    { ...valid, challenge: "short" },
    { ...valid, business: "" },
    { ...valid, email: "not-mail" },
    { ...valid, budget: "made-up" },
    { ...valid, timing: "made-up" },
    { ...valid, challenge: "x".repeat(4001) },
  ])("rejects malformed or incomplete input %#", (input) =>
    expect(validateProjectEnquiry(input, now).ok).toBe(false)
  );
  it.each(["2026-09-16", "2026-02-30", "not-a-date", "2030-01-01"])(
    "rejects bad preferred date %s",
    (preferredDate) =>
      expect(validateProjectEnquiry({ ...valid, preferredDate }, now).ok).toBe(false)
  );
  it("accepts a future date and morning preference", () =>
    expect(
      validateProjectEnquiry(
        { ...valid, preferredDate: "2026-09-25", preferredTime: "morning" },
        now
      ).ok
    ).toBe(true));
  it("requires a date for a time preference", () =>
    expect(
      validateProjectEnquiry({ ...valid, preferredTime: "afternoon" }, now)
    ).toMatchObject({ ok: false, errors: { preferredDate: expect.any(String) } }));
  it("uses the London date around midnight BST", () =>
    expect(londonToday(new Date("2026-09-17T23:30:00Z"))).toBe("2026-09-18"));
  it("does not overwrite legacy plans or score a lead as qualified/booked", () => {
    const input = projectEnquiryLead(valid);
    expect(input).toEqual({
      name: valid.name,
      email: valid.email,
      source: "project_enquiry",
      status: "new",
      quizAnswers: { projectEnquiry: valid },
    });
    expect(input).not.toHaveProperty("plan");
    expect(input).not.toHaveProperty("planToken");
    expect(input.quizAnswers).not.toHaveProperty("answers");
  });
  it("reads new payloads while leaving legacy data alone", () => {
    expect(
      readProjectEnquiry({ answers: { describe: "old" }, projectEnquiry: valid })
    ).toEqual(valid);
    expect(readProjectEnquiry({ answers: { describe: "old" } })).toBeNull();
    expect(readProjectEnquiry({ projectEnquiry: { business: {} } })).toBeNull();
  });
  it.each([
    undefined,
    "",
    "javascript:alert(1)",
    "https://evil.example/a/b",
    "//evil.example/a",
    "team/event?redirect=bad",
  ])("rejects unsafe calendar links %s", (value) =>
    expect(projectCalendarUrl(value)).toBeNull()
  );
  it("accepts configured Cal.com event paths", () => {
    expect(projectCalendarUrl("team/event")).toBe("https://cal.com/team/event");
    expect(projectCalendarUrl("https://cal.com/team/event/")).toBe(
      "https://cal.com/team/event"
    );
  });
  it("escapes owner email content and never promises a booking", () => {
    const result = projectEnquiryEmails({
      ...valid,
      challenge: '<script>alert("x")</script>',
    });
    expect(result.owner.html).not.toContain("<script>");
    expect(result.owner.html).toContain("&lt;script&gt;");
    expect(result.receipt.text).toContain("preference only");
    expect(result.receipt.text).toContain("not been subscribed");
  });
});
