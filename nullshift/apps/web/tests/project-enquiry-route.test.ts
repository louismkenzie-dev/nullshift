import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  config: vi.fn(),
  rpc: vi.fn(),
  save: vi.fn(),
  send: vi.fn(),
}));
vi.mock("@nullshift/db", () => ({ createServiceClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@nullshift/db/env", () => ({ hasSupabaseServerConfig: mocks.config }));
vi.mock("@nullshift/db/leads", () => ({ recordLead: mocks.save }));
vi.mock("@nullshift/db/rateLimit", () => ({ requestIp: () => "192.0.2.1" }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mocks.send };
  },
}));
import { POST } from "@/app/api/project-enquiry/route";
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
const request = (data: unknown, headers: Record<string, string> = {}) =>
  new Request("https://nullshift.test/api/project-enquiry", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://nullshift.test",
      ...headers,
    },
    body: JSON.stringify(data),
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.config.mockReturnValue(true);
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.save.mockResolvedValue({ ok: true });
  mocks.send.mockResolvedValue({ data: { id: "test" }, error: null });
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("NODE_ENV", "production");
});
afterEach(() => vi.unstubAllEnvs());
describe("public project enquiry endpoint", () => {
  it("captures a lead without creating an account or a booking", async () => {
    const response = await POST(request(valid));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      preview: false,
      receiptEmailSent: false,
    });
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: "new", quizAnswers: { projectEnquiry: valid } })
    );
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });
  it("does not silently succeed when persistence fails", async () => {
    mocks.save.mockResolvedValue({ ok: false });
    expect((await POST(request(valid))).status).toBe(503);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("fails closed if rate limiting fails", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "offline" } });
    expect((await POST(request(valid))).status).toBe(503);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("reports rate limiting", async () => {
    mocks.rpc.mockResolvedValue({ data: false });
    expect((await POST(request(valid))).status).toBe(429);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("rejects cross-origin submissions", async () => {
    expect((await POST(request(valid, { origin: "https://evil.test" }))).status).toBe(
      403
    );
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("accepts the public host when Next exposes an internal request URL", async () => {
    expect(
      (
        await POST(
          request(valid, { host: "127.0.0.1:3112", origin: "http://127.0.0.1:3112" })
        )
      ).status
    ).toBe(200);
  });
  it("rejects malformed origins", async () => {
    expect((await POST(request(valid, { origin: "null" }))).status).toBe(403);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON", async () => {
    const req = new Request("https://nullshift.test/api/project-enquiry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    expect((await POST(req)).status).toBe(400);
  });
  it("rejects oversized streamed bodies", async () => {
    expect((await POST(request({ ...valid, challenge: "a".repeat(17000) }))).status).toBe(
      413
    );
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("rejects a honeypot without sending", async () => {
    expect((await POST(request({ ...valid, website: "spam" }))).status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("returns field-level validation errors", async () => {
    const response = await POST(request({ ...valid, email: "no" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toHaveProperty("errors.email");
  });
  it("refuses production preview bypass", async () => {
    expect((await POST(request({ ...valid, preview: true }))).status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("labels local previews and performs no external work", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.config.mockReturnValue(false);
    const response = await POST(request({ ...valid, preview: true }));
    expect(await response.json()).toMatchObject({ preview: true });
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not claim success when unconfigured", async () => {
    mocks.config.mockReturnValue(false);
    expect((await POST(request(valid))).status).toBe(503);
  });
  it("uses stable idempotency keys and checks provider errors", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("ENQUIRY_FROM_EMAIL", "Nullshift <test@example.com>");
    vi.stubEnv("ENQUIRY_NOTIFY_EMAIL", "owner@example.com");
    const first = await POST(request(valid));
    expect(await first.json()).toHaveProperty("receiptEmailSent", true);
    const key = mocks.send.mock.calls[0][1];
    await POST(request(valid));
    expect(mocks.send.mock.calls[2][1]).toEqual(key);
    mocks.send.mockResolvedValue({ error: { message: "rejected" } });
    const response = await POST(request(valid));
    expect(await response.json()).toMatchObject({ ok: true, receiptEmailSent: false });
  });
});
