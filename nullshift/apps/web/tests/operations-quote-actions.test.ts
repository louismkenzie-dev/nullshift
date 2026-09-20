import { beforeEach, describe, it, expect, vi } from "vitest";
import { emptyQuote } from "@/lib/next/quote-builder";
const m = vi.hoisted(() => ({
  enabled: vi.fn(),
  session: vi.fn(),
  preview: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/lib/next/quote-data", () => ({ quoteBuilderEnabled: m.enabled }));
vi.mock("@/lib/next/live-data", () => ({ operationsSession: m.session }));
vi.mock("@/lib/clientPreview", () => ({ isClientPreview: m.preview }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
import { saveBuilderQuote } from "@/app/admin/(dashboard)/quotes/builder-actions";
const id = "c42e9f59-49a8-4dc7-8731-8476a5445ed7";
function input() {
  const draft = emptyQuote();
  Object.assign(draft.document, {
    business: "Example",
    title: "Platform",
    included: "Booking tool",
    acceptance: "Demo booking succeeds",
    lines: [{ name: "Build", quantity: 1, unitMinor: 500000 }],
  });
  return { id, updatedAt: null, draft };
}
beforeEach(() => {
  vi.clearAllMocks();
  m.enabled.mockReturnValue(true);
  m.preview.mockResolvedValue(false);
  m.session.mockResolvedValue({ db: { rpc: m.rpc, from: m.from } });
  m.rpc.mockResolvedValue({ data: { updated_at: "2026-09-17T19:00:00Z" }, error: null });
});
describe("quote saving boundaries", () => {
  it("refuses disabled saving before accessing the database", async () => {
    m.enabled.mockReturnValue(false);
    expect((await saveBuilderQuote(input())).ok).toBe(false);
    expect(m.session).not.toHaveBeenCalled();
  });
  it("requires staff and MFA checks", async () => {
    m.session.mockRejectedValue(new Error("Not authorised"));
    await expect(saveBuilderQuote(input())).rejects.toThrow("Not authorised");
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("refuses client-preview mutation", async () => {
    m.preview.mockResolvedValue(true);
    expect((await saveBuilderQuote(input())).ok).toBe(false);
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("validates inputs before writing", async () => {
    const request = input();
    request.draft.document.included = "";
    expect((await saveBuilderQuote(request)).ok).toBe(false);
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("saves atomically with server-calculated totals and no financial provider calls", async () => {
    expect(await saveBuilderQuote(input())).toMatchObject({ ok: true, id });
    expect(m.rpc).toHaveBeenCalledTimes(1);
    const [name, payload] = m.rpc.mock.calls[0];
    expect(name).toBe("ops_save_quote_draft");
    expect(payload.p_commercial.build_price_minor).toBe(500000);
    expect(payload.p_internal.approved_price_minor).toBe(0);
    expect(payload).not.toHaveProperty("status");
    expect(payload.p_commercial).not.toHaveProperty("builderCosts");
    expect(m.from).not.toHaveBeenCalled();
  });
  it("preserves stale-edit errors without retrying as an overwrite", async () => {
    m.rpc.mockResolvedValue({ data: null, error: { message: "Stale quote draft" } });
    const result = await saveBuilderQuote(input());
    expect(result).toMatchObject({ ok: false });
    expect(m.rpc).toHaveBeenCalledTimes(1);
    expect(m.revalidate).not.toHaveBeenCalled();
  });
  it("does not expose database details", async () => {
    m.rpc.mockResolvedValue({ error: { message: "private table data" } });
    const result = await saveBuilderQuote(input());
    expect(JSON.stringify(result)).not.toContain("private table");
  });
});
