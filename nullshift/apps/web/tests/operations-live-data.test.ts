import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  client: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error("redirect:" + url);
  }),
}));
vi.mock("server-only", () => ({}));
vi.mock("@nullshift/db", () => ({ createClient: mocks.client }));
vi.mock("@nullshift/auth/guards", () => ({ requireStaff: mocks.guard }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import {
  operationsSession,
  loadOperations,
  clientCreationEnabled,
} from "@/lib/next/live-data";

function dbWith(
  rows: Record<string, { data: unknown[] | null; error: unknown; count?: number }>,
  mfa = { data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null } as {
    data: null | { currentLevel: string; nextLevel: string };
    error: unknown;
  }
) {
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  const db = {
    auth: { mfa: { getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue(mfa) } },
    from: vi.fn((table: string) => {
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq", "neq", "in", "order", "limit"])
        chain[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          return chain;
        };
      chain.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve(rows[table] ?? { data: [], error: null, count: 0 }).then(resolve);
      return chain;
    }),
  };
  mocks.client.mockResolvedValue(db);
  return { db, calls };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPS_REAL_DATA", "true");
  vi.stubEnv("OPS_CLIENT_CREATE", "true");
  mocks.guard.mockResolvedValue({
    ok: true,
    userId: "staff",
    email: "staff@example.com",
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("Operations read and write access", () => {
  it("requires both explicit flags for client creation", () => {
    expect(clientCreationEnabled()).toBe(true);
    vi.stubEnv("OPS_REAL_DATA", "");
    expect(clientCreationEnabled()).toBe(false);
    vi.stubEnv("OPS_REAL_DATA", "true");
    vi.stubEnv("OPS_CLIENT_CREATE", "");
    expect(clientCreationEnabled()).toBe(false);
  });
  it.each(["unauthenticated", "forbidden"])(
    "blocks %s callers before loading records",
    async (reason) => {
      const { db } = dbWith({});
      mocks.guard.mockResolvedValue({ ok: false, reason });
      await expect(loadOperations()).rejects.toThrow("redirect:/admin/login");
      expect(db.from).not.toHaveBeenCalled();
    }
  );
  it("requires MFA step-up when the account has a verified factor", async () => {
    const { db } = dbWith(
      {},
      { data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null }
    );
    await expect(operationsSession()).rejects.toThrow("redirect:/admin/security");
    expect(db.from).not.toHaveBeenCalled();
  });
  it("fails closed when assurance cannot be verified", async () => {
    dbWith({}, { data: null, error: { message: "network failure" } });
    await expect(operationsSession()).rejects.toThrow("Could not verify");
  });
  it("does not accept an empty assurance response as a verified session", async () => {
    dbWith({}, { data: null, error: null });
    await expect(operationsSession()).rejects.toThrow("Could not verify");
  });
  it("uses the caller's cookie-scoped database client after MFA", async () => {
    const { db } = dbWith(
      {},
      { data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null }
    );
    expect((await operationsSession()).db).toBe(db);
  });
  it("never replaces failed client reads with fixtures", async () => {
    dbWith({ tenants: { data: null, error: { message: "offline" } } });
    await expect(loadOperations()).rejects.toThrow("No demo data");
  });
  it("reports partial failures and truncation instead of fake completeness", async () => {
    const { calls } = dbWith({
      tenants: { data: [{ id: "client-1", name: "Example" }], error: null, count: 1 },
      projects: { data: [], error: null, count: 1001 },
      invoices: { data: null, error: { message: "unavailable" } },
    });
    const result = await loadOperations();
    expect(result.unavailable).toEqual(["Invoices"]);
    expect(result.limited).toEqual(["Projects"]);
    expect(
      calls
        .filter((c) => c.method === "in")
        .every(
          (c) => JSON.stringify(c.args) === JSON.stringify(["tenant_id", ["client-1"]])
        )
    ).toBe(true);
    expect(calls.find((c) => c.table === "tenants" && c.method === "eq")?.args).toEqual([
      "type",
      "client",
    ]);
    expect(calls.every((c) => !["insert", "update", "delete"].includes(c.method))).toBe(
      true
    );
  });
  it("does not query unscoped related records when there are no clients", async () => {
    const { calls } = dbWith({});
    await loadOperations();
    expect(new Set(calls.map((c) => c.table))).toEqual(new Set(["tenants", "leads"]));
  });
});
