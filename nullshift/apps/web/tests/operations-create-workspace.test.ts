import { beforeEach, describe, expect, it, vi } from "vitest";
import { draftNotes, type NewClientInput } from "@/lib/next/live-model";

const mocks = vi.hoisted(() => ({
  enabled: vi.fn(),
  session: vi.fn(),
  audit: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/lib/next/live-data", () => ({
  clientCreationEnabled: mocks.enabled,
  operationsSession: mocks.session,
}));
vi.mock("@nullshift/db/audit", () => ({ logAudit: mocks.audit }));
vi.mock("@nullshift/db/leads", () => ({
  escapeLike: (s: string) => s.replace(/[\\%_]/g, (c) => "\\" + c),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { createWorkspace } from "@/app/admin/(dashboard)/next/clients/new/actions";

const input: NewClientInput = {
  draftId: "11111111-1111-4111-8111-111111111111",
  projectId: "22222222-2222-4222-8222-222222222222",
  businessName: " Example Studio ",
  contactName: "Alex",
  email: "ALEX@EXAMPLE.COM",
  phone: "",
  projectName: "Platform",
  brief: "Original brief",
  owner: "Staff",
  serviceRoute: "managed",
};
const ok = (data: unknown = null) => ({ data, error: null });
type Response = { data?: unknown; error: null | { code?: string; message?: string } };
function database(responses: Response[]) {
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  const db = {
    from: vi.fn((table: string) => {
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq", "ilike", "limit", "maybeSingle", "insert"]) {
        chain[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          return chain;
        };
      }
      chain.then = (resolve: (r: Response) => unknown) => {
        const next = responses.shift();
        if (!next) throw new Error("Unexpected database operation");
        return Promise.resolve(next).then(resolve);
      };
      return chain;
    }),
  };
  mocks.session.mockResolvedValue({
    db,
    staff: { userId: "staff-1", email: "staff@example.com" },
  });
  return { db, calls };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.enabled.mockReturnValue(true);
  mocks.audit.mockResolvedValue(undefined);
});

describe("createWorkspace safety boundaries", () => {
  it("does nothing while creation is disabled", async () => {
    mocks.enabled.mockReturnValue(false);
    expect((await createWorkspace(input)).ok).toBe(false);
    expect(mocks.session).not.toHaveBeenCalled();
  });
  it("requires the staff and MFA session before reads or writes", async () => {
    mocks.session.mockRejectedValue(new Error("unauthorised"));
    await expect(createWorkspace(input)).rejects.toThrow("unauthorised");
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("rejects malformed runtime payloads before database use", async () => {
    const { db } = database([]);
    expect((await createWorkspace({} as NewClientInput)).ok).toBe(false);
    expect(db.from).not.toHaveBeenCalled();
  });
  it("creates only a client and discovery project, never billing or invitations", async () => {
    const { calls } = database([ok(), ok([]), ok(), ok(), ok()]);
    expect(await createWorkspace(input)).toEqual({ ok: true, clientId: input.draftId });
    const inserts = calls.filter((c) => c.method === "insert");
    expect(inserts.map((c) => c.table)).toEqual(["tenants", "projects"]);
    expect(inserts[0].args[0]).toMatchObject({
      name: "Example Studio",
      contact_email: "alex@example.com",
      type: "client",
    });
    expect(inserts[1].args[0]).toMatchObject({
      stage: "discovery",
      next_action: "Confirm the brief and prepare a scoped quote",
    });
    expect(Object.keys(inserts[1].args[0] as object)).not.toContain("build_fee");
    expect(mocks.audit).toHaveBeenCalledTimes(2);
  });
  it("blocks matching emails instead of overwriting or duplicating a client", async () => {
    const { calls } = database([ok(), ok([{ id: "existing-client" }])]);
    expect(await createWorkspace(input)).toMatchObject({
      ok: false,
      duplicateId: "existing-client",
    });
    expect(calls.some((c) => c.method === "insert")).toBe(false);
  });
  it("fails closed when the duplicate lookup fails", async () => {
    const { calls } = database([ok(), { error: { message: "offline" } }]);
    expect((await createWorkspace(input)).ok).toBe(false);
    expect(calls.some((c) => c.method === "insert")).toBe(false);
  });
  it("returns the existing workspace on a repeated save without inserts", async () => {
    const { calls } = database([
      ok({ id: input.draftId, notes: draftNotes(input, "staff-1") }),
      ok({ id: input.projectId, tenant_id: input.draftId }),
    ]);
    expect(await createWorkspace(input)).toEqual({ ok: true, clientId: input.draftId });
    expect(calls.some((c) => c.method === "insert")).toBe(false);
  });
  it("never hijacks a legacy record or another staff member’s draft", async () => {
    const { calls } = database([
      ok({ id: input.draftId, notes: draftNotes(input, "other-staff") }),
    ]);
    expect((await createWorkspace(input)).ok).toBe(false);
    expect(calls.some((c) => c.method === "insert")).toBe(false);
  });
  it("reports partial creation honestly when a project insert fails", async () => {
    database([ok(), ok([]), ok(), ok(), { error: { code: "500" } }]);
    expect(await createWorkspace(input)).toEqual({
      ok: true,
      clientId: input.draftId,
      projectPending: true,
    });
  });
  it("recovers a partial save using the original brief, not a changed retry payload", async () => {
    const { calls } = database([
      ok({ id: input.draftId, notes: draftNotes(input, "staff-1") }),
      ok(),
      ok(),
    ]);
    await createWorkspace({ ...input, brief: "Changed retry", projectName: "Changed" });
    expect(
      calls.find((c) => c.table === "projects" && c.method === "insert")?.args[0]
    ).toMatchObject({ name: "Platform", overview: "Original brief" });
  });
  it("does not claim an unrelated colliding project was created", async () => {
    database([
      ok(),
      ok([]),
      ok(),
      ok(),
      { error: { code: "23505" } },
      ok({ tenant_id: "someone-else" }),
    ]);
    expect(await createWorkspace(input)).toMatchObject({
      ok: true,
      projectPending: true,
    });
  });
  it("accepts a concurrent project save only after verifying its tenant", async () => {
    database([
      ok(),
      ok([]),
      ok(),
      ok(),
      { error: { code: "23505" } },
      ok({ tenant_id: input.draftId }),
    ]);
    expect(await createWorkspace(input)).toEqual({ ok: true, clientId: input.draftId });
  });
});
