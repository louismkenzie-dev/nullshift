import { createServiceClient } from "@nullshift/db";
import { escapeLike } from "@nullshift/db/leads";

type LeadPlan = { businessName?: string | null };
type LeadAnswers = { business_name?: string | null };
type Service = ReturnType<typeof createServiceClient>;

/**
 * Make sure a logged-in portal user has a client workspace: a tenant, a project,
 * and a client_admin membership. Booking a call only records a `leads` row, so a
 * client who comes straight to the portal otherwise has no project for the DPA
 * gate to attach to. This provisions one on first landing (idempotent — reuses an
 * existing tenant by email, e.g. if an admin already opened them). Internal staff
 * (already a member of an internal tenant) are left untouched.
 */
export async function ensureClientWorkspace(opts: {
  userId: string;
  email: string | null;
}): Promise<void> {
  const { userId, email } = opts;
  const service = createServiceClient();

  const { data: memberships } = await service
    .from("memberships")
    .select("tenant_id, role")
    .eq("user_id", userId);

  if (memberships && memberships.length > 0) {
    // Already a member (client or staff). If a client with no project yet, add one.
    const clientMember = memberships.find((m) => m.role === "client_admin");
    if (clientMember) await ensureProject(service, clientMember.tenant_id);
    return;
  }

  // No membership → provision a fresh client workspace from their lead context.
  let tenantId: string | null = null;
  let name = "Client";
  let contactName: string | null = null;
  let vertical: string | null = null;

  if (email) {
    const { data: existing } = await service
      .from("tenants")
      .select("id")
      .eq("type", "client")
      .ilike("contact_email", escapeLike(email))
      .limit(1);
    tenantId = existing?.[0]?.id ?? null;

    const { data: lead } = await service
      .from("leads")
      .select("name, vertical, quiz_answers, plan")
      .ilike("email", escapeLike(email))
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lead) {
      contactName = lead.name ?? null;
      vertical = lead.vertical ?? null;
      const business =
        (lead.plan as LeadPlan | null)?.businessName ??
        (lead.quiz_answers as LeadAnswers | null)?.business_name ??
        null;
      name = business || lead.name || "Client";
    }
  }

  let createdHere = false;
  if (!tenantId) {
    const { data: created } = await service
      .from("tenants")
      .insert({
        name,
        type: "client",
        vertical,
        contact_name: contactName,
        contact_email: email,
      })
      .select("id")
      .single();
    tenantId = created?.id ?? null;
    createdHere = true;
  }
  if (!tenantId) return;

  await service
    .from("memberships")
    .insert({ tenant_id: tenantId, user_id: userId, role: "client_admin" });

  // A first sign-in fires several portal requests at once (layout + page +
  // prefetches), and each of them saw "no membership" a moment ago. Without a
  // lock they would each create a workspace — six "Client" tenants for one
  // person. Settle it after the fact: the EARLIEST membership wins, and a
  // tenant this call created that lost the race is removed again (cascade
  // takes its project and membership with it).
  const { data: all } = await service
    .from("memberships")
    .select("tenant_id, created_at")
    .eq("user_id", userId)
    .eq("role", "client_admin")
    .order("created_at", { ascending: true });
  const winner = all?.[0]?.tenant_id as string | undefined;
  if (winner && winner !== tenantId) {
    if (createdHere) await service.from("tenants").delete().eq("id", tenantId);
    else
      await service
        .from("memberships")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("user_id", userId);
    await ensureProject(service, winner, name);
    return;
  }

  await ensureProject(service, tenantId, name);
}

async function ensureProject(
  service: Service,
  tenantId: string,
  name = "Client"
): Promise<void> {
  const { data: proj } = await service
    .from("projects")
    .select("id")
    .eq("tenant_id", tenantId)
    .limit(1);
  if (!proj?.length) {
    await service
      .from("projects")
      .insert({ tenant_id: tenantId, name: `${name} — build`, stage: "discovery" });
  }
}
