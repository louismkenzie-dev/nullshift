import { describe, expect, it, vi } from "vitest";
import { scopedReadOnlyDb } from "@/lib/clientPreview";
import type { createServiceClient } from "@nullshift/db";
import type { User } from "@supabase/supabase-js";

/**
 * The staff view-as-client preview hands portal pages a tenant-scoped
 * read-only client. These pins are load-bearing: a missing tenant filter
 * leaks OTHER clients' invoices/projects into the preview (staff-wide RLS
 * would return everything), and an unblocked write would let a "view-only"
 * preview mutate real client data.
 */

const TENANT = "2e458eb1-2217-40d2-a52e-9bdfc32c797e";
const STAFF = { id: "u1", email: "staff@nullshift.co.uk" } as unknown as User;

function fakeService() {
  const eq = vi.fn();
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const service = {
    from,
    storage: { marker: "storage" },
    rpc: vi.fn(() => "rpc-result"),
  } as unknown as ReturnType<typeof createServiceClient>;
  return { service, from, select, eq };
}

describe("scopedReadOnlyDb", () => {
  it("pins every select to the previewed tenant via tenant_id", () => {
    const { service, from, select, eq } = fakeService();
    const db = scopedReadOnlyDb(service, TENANT, STAFF);
    db.from("invoices").select("id, amount");
    expect(from).toHaveBeenCalledWith("invoices");
    expect(select).toHaveBeenCalledWith("id, amount");
    expect(eq).toHaveBeenCalledWith("tenant_id", TENANT);
  });

  it("scopes the tenants table by id, not tenant_id", () => {
    const { service, eq } = fakeService();
    const db = scopedReadOnlyDb(service, TENANT, STAFF);
    db.from("tenants").select("id, name");
    expect(eq).toHaveBeenCalledWith("id", TENANT);
  });

  it("blocks every write through the page client", () => {
    const { service } = fakeService();
    const db = scopedReadOnlyDb(service, TENANT, STAFF);
    const t = db.from("projects") as unknown as Record<string, (v?: unknown) => void>;
    for (const method of ["insert", "update", "upsert", "delete"]) {
      expect(() => t[method]({})).toThrowError(/read-only/);
    }
  });

  it("hands back the real authed user so layout auth still holds", async () => {
    const { service } = fakeService();
    const db = scopedReadOnlyDb(service, TENANT, STAFF);
    const {
      data: { user },
    } = await db.auth.getUser();
    expect(user).toBe(STAFF);
  });
});
