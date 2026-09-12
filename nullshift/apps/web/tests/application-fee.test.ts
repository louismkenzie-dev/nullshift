import { describe, expect, it } from "vitest";
import {
  APPLICATION_FEE_DISCLAIMER,
  applicationFeeClause,
  applicationFeePenceFor,
  connectFeeFlag,
  connectFeeGate,
  formatPercent,
  parseApplicationFee,
} from "@/lib/legal/applicationFee";

describe("parseApplicationFee", () => {
  it("unticked means no fee, whatever is in the box", () => {
    expect(parseApplicationFee({ enabled: false, percent: "7" })).toEqual({
      ok: true,
      fee: { enabled: false, percent: null },
    });
  });
  it("ticked needs a number — never a silent default", () => {
    expect(parseApplicationFee({ enabled: true, percent: "" })).toMatchObject({
      ok: false,
    });
    expect(parseApplicationFee({ enabled: true, percent: "two" })).toMatchObject({
      ok: false,
    });
  });
  it("accepts 2, 2.5 and 2%, rounds to two decimals, bounds 0.01–100", () => {
    expect(parseApplicationFee({ enabled: true, percent: "2" })).toEqual({
      ok: true,
      fee: { enabled: true, percent: 2 },
    });
    expect(parseApplicationFee({ enabled: true, percent: "2.5%" })).toEqual({
      ok: true,
      fee: { enabled: true, percent: 2.5 },
    });
    expect(parseApplicationFee({ enabled: true, percent: "1.999" })).toEqual({
      ok: true,
      fee: { enabled: true, percent: 2 },
    });
    expect(parseApplicationFee({ enabled: true, percent: "0" })).toMatchObject({
      ok: false,
    });
    expect(parseApplicationFee({ enabled: true, percent: "101" })).toMatchObject({
      ok: false,
    });
  });
});

describe("clause and maths", () => {
  it("formats percentages the way a person writes them", () => {
    expect(formatPercent(2)).toBe("2%");
    expect(formatPercent(2.5)).toBe("2.5%");
    expect(formatPercent(2.25)).toBe("2.25%");
  });
  it("the clause names the percentage and carries the Stripe-fees disclaimer verbatim", () => {
    const c = applicationFeeClause({ enabled: true, percent: 2.5 })!;
    expect(c.startsWith("Application fee: 2.5% of each payment")).toBe(true);
    expect(c).toContain(APPLICATION_FEE_DISCLAIMER);
    expect(APPLICATION_FEE_DISCLAIMER).toMatch(
      /separate from, and in addition to, Stripe's own processing fees/
    );
  });
  it("no clause when no fee", () => {
    expect(applicationFeeClause({ enabled: false, percent: null })).toBeNull();
  });
  it("fee pence rounds to the penny and never goes negative", () => {
    expect(applicationFeePenceFor(10000, 2)).toBe(200);
    expect(applicationFeePenceFor(3333, 2.5)).toBe(83);
    expect(applicationFeePenceFor(-5, 2)).toBe(0);
    expect(applicationFeePenceFor(1000, 0)).toBe(0);
  });
});

describe("connectFeeGate — no money before the signature", () => {
  const signedWithFee = {
    status: "accepted",
    application_fee_enabled: true,
    application_fee_percent: "2.00",
  };
  it("charges only when connected AND the accepted Order Form carries the fee", () => {
    expect(
      connectFeeGate({ connectStatus: "connected", acceptedOrder: signedWithFee })
    ).toEqual({
      canCharge: true,
      percent: 2,
      reason: "ok",
    });
  });
  it("refuses when Stripe is not connected", () => {
    expect(
      connectFeeGate({ connectStatus: null, acceptedOrder: signedWithFee }).reason
    ).toBe("not_connected");
    expect(
      connectFeeGate({ connectStatus: "revoked", acceptedOrder: signedWithFee }).canCharge
    ).toBe(false);
  });
  it("refuses an unsigned or missing Order Form", () => {
    expect(
      connectFeeGate({ connectStatus: "connected", acceptedOrder: null }).reason
    ).toBe("no_signed_order");
    expect(
      connectFeeGate({
        connectStatus: "connected",
        acceptedOrder: { ...signedWithFee, status: "client_review" },
      }).reason
    ).toBe("no_signed_order");
  });
  it("refuses a signed Order Form that has no fee on it", () => {
    expect(
      connectFeeGate({
        connectStatus: "connected",
        acceptedOrder: {
          status: "accepted",
          application_fee_enabled: false,
          application_fee_percent: null,
        },
      }).reason
    ).toBe("fee_not_agreed");
  });
});

describe("connectFeeFlag — what the hub shows", () => {
  it("is red when Stripe is connected and nothing signed says a fee may be taken", () => {
    expect(connectFeeFlag({ connectStatus: "connected", order: null })?.tone).toBe(
      "danger"
    );
    expect(
      connectFeeFlag({
        connectStatus: "connected",
        order: {
          status: "accepted",
          application_fee_enabled: false,
          application_fee_percent: null,
        },
      })?.tone
    ).toBe("danger");
  });
  it("says 'awaiting signature' when the fee is on a sent form", () => {
    const f = connectFeeFlag({
      connectStatus: "connected",
      order: {
        status: "client_review",
        application_fee_enabled: true,
        application_fee_percent: 2,
      },
    });
    expect(f?.tone).toBe("danger");
    expect(f?.sub).toMatch(/awaiting the client's signature/);
  });
  it("is amber when the fee is signed but Stripe is not connected yet", () => {
    expect(
      connectFeeFlag({
        connectStatus: null,
        order: {
          status: "accepted",
          application_fee_enabled: true,
          application_fee_percent: 2,
        },
      })?.tone
    ).toBe("warning");
  });
  it("is silent when everything is in place, or when no fee is involved", () => {
    expect(
      connectFeeFlag({
        connectStatus: "connected",
        order: {
          status: "accepted",
          application_fee_enabled: true,
          application_fee_percent: 2,
        },
      })
    ).toBeNull();
    expect(connectFeeFlag({ connectStatus: null, order: null })).toBeNull();
  });
});
