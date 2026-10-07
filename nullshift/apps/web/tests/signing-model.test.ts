import { describe, expect, it } from "vitest";
import { parseDocumentSource } from "@/lib/signing/blocks";
import {
  agreementClauses,
  allConsentsGiven,
  buildSigningSnapshot,
  canCountersign,
  canDecline,
  canIssue,
  canResend,
  canSign,
  canVoid,
  commercialFromText,
  commercialToText,
  formatMinor,
  generateSigningToken,
  hashFingerprint,
  hashSigningToken,
  isTokenShaped,
  linkExpired,
  linkExpiresAt,
  parseCommercial,
  parseMoneyToMinor,
  signingContentFrom,
  signingRecord,
  SIGNING_CONSENTS,
  type SigningContent,
  type SignatureEventRow,
} from "@/lib/signing/model";
import { SIGNING_TEMPLATES, templateById } from "@/lib/signing/templates";

const NOW = new Date("2026-10-07T12:00:00Z");

describe("money", () => {
  it("parses the ways staff type amounts", () => {
    expect(parseMoneyToMinor("£1,195.00")).toBe(119500);
    expect(parseMoneyToMinor("1195")).toBe(119500);
    expect(parseMoneyToMinor("−£328.75")).toBe(-32875);
    expect(parseMoneyToMinor("-328.75")).toBe(-32875);
    expect(parseMoneyToMinor("£0.5")).toBe(50);
    expect(parseMoneyToMinor("")).toBeNull();
    expect(parseMoneyToMinor("free")).toBeNull();
    expect(parseMoneyToMinor("1.234")).toBeNull();
  });

  it("formats minor units with pence and a sign", () => {
    expect(formatMinor(119500)).toBe("£1,195.00");
    expect(formatMinor(-32875)).toBe("−£328.75");
    expect(formatMinor(98625)).toBe("£986.25");
  });

  it("totals the Suffolk costing exactly as the email did", () => {
    const { commercial, problems } = commercialFromText(
      [
        "Rising Stars Talent ID build, as proposed (stages 1 to 4) | £1,195.00",
        "Flexibility additions | £120.00",
        "Max plan discount (25%) | −£328.75",
      ].join("\n")
    );
    expect(problems).toEqual([]);
    expect(commercial.totalMinor).toBe(98625);
    expect(formatMinor(commercial.totalMinor as number)).toBe("£986.25");
    // and back into the editor without loss
    expect(commercialFromText(commercialToText(commercial)).commercial).toEqual(commercial);
  });

  it("reports lines that are not money instead of guessing", () => {
    const { commercial, problems } = commercialFromText("Build | TBC\nNo pipe here\n | £5");
    expect(commercial.lines).toEqual([]);
    expect(problems).toHaveLength(3);
  });

  it("reads a stored commercial defensively", () => {
    expect(parseCommercial(null).totalMinor).toBeNull();
    expect(parseCommercial({ lines: [{ label: "a", amountMinor: 100 }, { label: 3 }] })).toEqual({
      lines: [{ label: "a", amountMinor: 100 }],
      totalMinor: 100,
      currency: "GBP",
      note: null,
    });
  });
});

describe("signing link", () => {
  it("mints a 43-character base64url token and stores only its hash", () => {
    const t = generateSigningToken();
    expect(isTokenShaped(t)).toBe(true);
    expect(hashSigningToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSigningToken(t)).not.toContain(t);
    expect(isTokenShaped("short")).toBe(false);
    expect(isTokenShaped(t + "x")).toBe(false);
  });

  it("expires 30 days after issue", () => {
    const exp = linkExpiresAt(NOW);
    expect(exp).toBe("2026-11-06T12:00:00.000Z");
    expect(linkExpired(exp, NOW)).toBe(false);
    expect(linkExpired(exp, new Date("2026-11-06T12:00:00.001Z"))).toBe(true);
    expect(linkExpired(null, NOW)).toBe(true);
    expect(linkExpired("garbage", NOW)).toBe(true);
  });
});

describe("state machine", () => {
  const blocks = parseDocumentSource("# T\n\nSome terms.");

  it("will not issue an empty or unaddressed draft", () => {
    const base = {
      status: "draft" as const,
      title: "T",
      blocks,
      signerName: "Ollie Sutton",
      signerEmail: "enquiries@suffolktennis.online",
    };
    expect(canIssue(base)).toEqual({ ok: true });
    expect(canIssue({ ...base, blocks: parseDocumentSource("# Title only") })).toMatchObject({
      ok: false,
      problems: [{ code: "body_required" }],
    });
    expect(canIssue({ ...base, signerEmail: "ollie" })).toMatchObject({
      ok: false,
      problems: [{ code: "signer_email_invalid" }],
    });
    expect(canIssue({ ...base, status: "issued" })).toMatchObject({
      ok: false,
      problems: [{ code: "not_draft" }],
    });
  });

  it("signing needs an open link, a verified document, a name and all four consents", () => {
    const consents = { authority: true, read: true, esign: true, bound: true };
    const ok = { status: "issued" as const, expiresAt: linkExpiresAt(NOW), snapshotVerified: true };
    expect(canSign(ok, { name: "Ollie Sutton", consents }, NOW)).toEqual({ ok: true });
    expect(
      canSign(ok, { name: "Ollie Sutton", consents: { ...consents, bound: false } }, NOW)
    ).toMatchObject({ ok: false, problems: [{ code: "consent_required" }] });
    expect(canSign({ ...ok, status: "signed" }, { name: "O", consents }, NOW)).toMatchObject({
      ok: false,
      problems: [{ code: "not_issued", detail: "This document has already been signed." }],
    });
    expect(
      canSign({ ...ok, expiresAt: "2026-01-01T00:00:00Z" }, { name: "O", consents }, NOW)
    ).toMatchObject({ ok: false, problems: [{ code: "expired" }] });
    expect(
      canSign({ ...ok, snapshotVerified: false }, { name: "O", consents }, NOW)
    ).toMatchObject({ ok: false, problems: [{ code: "snapshot_invalid" }] });
  });

  it("countersign only after the client, void only before completion", () => {
    expect(canCountersign({ status: "signed", snapshotVerified: true })).toEqual({ ok: true });
    expect(canCountersign({ status: "issued", snapshotVerified: true }).ok).toBe(false);
    expect(canCountersign({ status: "completed", snapshotVerified: true }).ok).toBe(false);
    expect(canVoid({ status: "issued" }).ok).toBe(true);
    expect(canVoid({ status: "signed" }).ok).toBe(true);
    expect(canVoid({ status: "completed" }).ok).toBe(false);
    expect(canDecline({ status: "issued" }).ok).toBe(true);
    expect(canDecline({ status: "signed" }).ok).toBe(false);
    expect(canResend({ status: "issued" }).ok).toBe(true);
    expect(canResend({ status: "draft" }).ok).toBe(false);
  });

  it("all four consents are required and start unchecked", () => {
    expect(SIGNING_CONSENTS).toHaveLength(4);
    expect(allConsentsGiven({})).toBe(false);
    expect(allConsentsGiven({ authority: true, read: true, esign: true, bound: true })).toBe(true);
  });
});

describe("snapshot", () => {
  const content: SigningContent = {
    reference: "SR-2026-0001",
    title: "Rising Stars Talent ID — proposal follow-up",
    kind: "proposal_addendum",
    client: { name: "Suffolk Tennis LTA" },
    signer: { name: "Ollie Sutton", email: "enquiries@suffolktennis.online", role: null },
    blocks: parseDocumentSource("# T\n\nSome terms.\n\n| a | b |\n| 1 | 2 |"),
    commercial: commercialFromText("Build | £986.25").commercial,
    agreement: agreementClauses({
      kind: "proposal_addendum",
      clientName: "Suffolk Tennis LTA",
      nullshiftName: "Nullshift Development Ltd",
      msaVersion: "MSA_2026_08_v1",
      hasCommercial: true,
    }),
    issuedAt: NOW.toISOString(),
  };

  it("freezes the content and reads it back only while the hash holds", () => {
    const frozen = buildSigningSnapshot(content, { msaVersion: "MSA_2026_08_v1" });
    expect(frozen.hash).toMatch(/^[0-9a-f]{64}$/);
    const back = signingContentFrom(frozen.snapshot, frozen.hash);
    expect(back).toEqual(content);

    // Tamper with one cell of the table and the document no longer reads.
    const tampered = JSON.parse(JSON.stringify(frozen.snapshot));
    tampered.content.blocks[2].rows[0][1] = "3";
    expect(signingContentFrom(tampered, frozen.hash)).toBeNull();
    expect(signingContentFrom(frozen.snapshot, "00".repeat(32))).toBeNull();
  });

  it("the agreement clauses are part of what is hashed", () => {
    const a = buildSigningSnapshot(content).hash;
    const b = buildSigningSnapshot({ ...content, agreement: [] }).hash;
    expect(a).not.toBe(b);
  });

  it("the clauses name the client, the MSA and the Act", () => {
    const text = content.agreement.join(" ");
    expect(text).toContain("Suffolk Tennis LTA agrees to the work described in this document at the price stated");
    expect(text).toContain("MSA_2026_08_v1");
    expect(text).toContain("Electronic Communications Act 2000");
    expect(
      agreementClauses({
        kind: "letter",
        clientName: "X",
        nullshiftName: "N",
        msaVersion: null,
        hasCommercial: false,
      })
    ).toHaveLength(2);
  });

  it("prints a fingerprint people can read out over the phone", () => {
    expect(hashFingerprint("abcdef0123456789" + "0".repeat(48))).toBe("ABCD EF01 2345 6789");
    expect(hashFingerprint(null)).toBe("—");
  });
});

describe("signing record", () => {
  it("orders events and summarises the signature evidence", () => {
    const ev = (over: Partial<SignatureEventRow>): SignatureEventRow => ({
      id: "e",
      request_id: "r",
      kind: "issued",
      actor_kind: "staff",
      actor_user: null,
      actor_name: null,
      actor_email: null,
      actor_role: null,
      signature_text: null,
      consent: null,
      document_hash: null,
      ip_address: null,
      user_agent: null,
      at: "2026-10-07T10:00:00Z",
      meta: {},
      ...over,
    });
    const lines = signingRecord([
      ev({
        kind: "signed",
        actor_kind: "client",
        actor_name: "Ollie Sutton",
        actor_email: "enquiries@suffolktennis.online",
        actor_role: "Head of Performance",
        signature_text: "Ollie Sutton",
        document_hash: "abcdef0123456789" + "0".repeat(48),
        ip_address: "81.2.69.142",
        at: "2026-10-08T09:30:00Z",
      }),
      ev({ kind: "issued", actor_name: "Louis McKenzie", actor_email: "louis@nullshift.co.uk" }),
    ]);
    expect(lines.map((l) => l.label)).toEqual(["Sent for signature", "Signed"]);
    expect(lines[1].who).toBe("Ollie Sutton <enquiries@suffolktennis.online>");
    expect(lines[1].detail).toBe(
      'Head of Performance · signed as "Ollie Sutton" · document ABCD EF01 2345 6789 · IP 81.2.69.142'
    );
  });
});

describe("templates", () => {
  it("the Rising Stars template parses to the fourteen-row table and the £986.25 total", () => {
    const t = templateById("rising_stars_talent_id");
    expect(t).not.toBeNull();
    const ctx = {
      clientName: "Suffolk Tennis LTA",
      contactFirstName: "Ollie",
      projectName: "Suffolk Tennis LTA — build",
    };
    const blocks = parseDocumentSource(t!.source(ctx));
    const table = blocks.find((b) => b.type === "table");
    expect(table && table.type === "table" ? table.rows.length : 0).toBe(14);
    expect(blocks[1]).toEqual({ type: "paragraph", text: "Hi Ollie," });
    const { commercial, problems } = commercialFromText(t!.commercialLines);
    expect(problems).toEqual([]);
    expect(commercial.totalMinor).toBe(98625);
  });

  it("every template produces a parseable, non-empty source", () => {
    for (const t of SIGNING_TEMPLATES) {
      const src = t.source({ clientName: "C", contactFirstName: "P", projectName: null });
      expect(parseDocumentSource(src).length).toBeGreaterThan(0);
      expect(t.title({ clientName: "C", contactFirstName: "P", projectName: null })).toBeTruthy();
    }
  });
});
