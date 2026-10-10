import { describe, expect, it } from "vitest";
import { extractLinks, normaliseUrl, uptimePercent } from "@/lib/watch/checks";
import { plainEnglishVerdict } from "@/lib/watch/emails";

describe("watch helpers", () => {
  it("normalises URLs and rejects private hosts", () => {
    expect(normaliseUrl("example.co.uk")).toBe("https://example.co.uk/");
    expect(normaliseUrl("http://Example.com/page#x")).toBe("http://example.com/page");
    expect(normaliseUrl("localhost:3000")).toBeNull();
    expect(normaliseUrl("192.168.1.1")).toBeNull();
    expect(normaliseUrl("ftp://x.com")).toBeNull();
    expect(normaliseUrl("")).toBeNull();
  });

  it("extracts absolute, deduplicated http links", () => {
    const html = `<a href="/about">a</a><a href='https://other.com/x#frag'>b</a><a href=/about>c</a><a href="mailto:x@y.z">d</a><a href="#top">e</a><a href="tel:1">f</a>`;
    expect(extractLinks(html, "https://site.com/")).toEqual([
      "https://site.com/about",
      "https://other.com/x",
    ]);
  });

  it("caps the number of links", () => {
    const html = Array.from({ length: 100 }, (_, i) => `<a href="/p${i}">x</a>`).join("");
    expect(extractLinks(html, "https://s.com", 10)).toHaveLength(10);
  });

  it("computes uptime percentage to one decimal", () => {
    expect(uptimePercent([])).toBeNull();
    expect(uptimePercent([true, true, true, false])).toBe(75);
    expect(uptimePercent(Array(999).fill(true).concat([false]))).toBe(99.9);
  });

  it("writes a plain-English verdict", () => {
    const base = {
      label: "x",
      url: "https://x",
      from: "1 Sep",
      to: "30 Sep",
      uptimePct: 100,
      incidents: 0,
      avgMs: 400,
      speedMobile: 95,
      speedDesktop: 99,
      sslDaysLeft: 60,
      brokenLinks: [],
      linksChecked: 20,
      senderName: "Agency",
    };
    expect(plainEnglishVerdict(base)).toContain("stayed online all month");
    expect(plainEnglishVerdict(base)).toContain("No broken links");
    expect(
      plainEnglishVerdict({
        ...base,
        uptimePct: 97.2,
        incidents: 3,
        speedMobile: 40,
        sslDaysLeft: 10,
        brokenLinks: [{ href: "a", status: 404 }],
      })
    ).toMatch(/3 outages.*poor.*1 broken link needs fixing.*expires in 10 days/);
  });
});
