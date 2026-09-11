"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@nullshift/db";
import { requireStaff } from "@nullshift/auth/guards";
import { logAudit } from "@nullshift/db/audit";
import { hintFor, validateRecord } from "@/lib/vault/records";

/**
 * Business vault — Null Shift's own sensitive references.
 *
 * The value only ever travels: form → server action → Supabase Vault. It is
 * never written to a public table, never returned by the list query, and
 * never logged (the audit trail records that a value was set or read, never
 * what it was). Reading one back goes through reveal_business_record, which
 * demands a two-factor session.
 */

const PAGE = "/admin/vault";
const back = (q?: string) => `${PAGE}${q ? `?${q}` : ""}`;
// A function declaration, not a const arrow: only this form lets the type
// checker treat a call as the end of the road and narrow what follows.
function fail(msg: string): never {
  redirect(back(`err=${encodeURIComponent(msg)}`));
}

export async function saveRecord(formData: FormData) {
  const guard = await requireStaff();
  if (!guard.ok) return;
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const note = String(formData.get("note") || "").trim() || null;
  const value = String(formData.get("value") || "");

  const problem = validateRecord({ name, value, isNew: !id });
  if (problem) fail(problem);

  const service = createServiceClient();

  // Editing an existing record: name/note always, value only when a new one
  // was typed (a blank box means "leave the value alone").
  if (id) {
    const { data: existing } = await service
      .from("business_records")
      .select("id, secret_id, name")
      .eq("id", id)
      .maybeSingle();
    if (!existing) fail("That record no longer exists.");

    const patch: Record<string, unknown> = { name, note, updated_by: guard.email };
    if (value) {
      if (existing.secret_id) {
        const { error } = await service.rpc("update_vault_secret", {
          secret_id: existing.secret_id,
          new_secret: value,
        });
        if (error) {
          console.error("[vault] update_secret failed:", error.message);
          fail("Could not store the new value securely. Nothing was changed.");
        }
      } else {
        // A record whose Vault write failed last time — give it one now.
        const fresh = await createSecret(service, name, value);
        if (!fresh) fail("Could not store the value securely. Nothing was changed.");
        patch.secret_id = fresh;
      }
      patch.hint = hintFor(value);
    }

    const { error } = await service.from("business_records").update(patch).eq("id", id);
    if (error) fail(errorText(error.message));
    await logAudit({
      action: "business_record.updated",
      target: `business_record:${id}`,
      metadata: { name, value_changed: !!value, by: guard.email },
    });
    redirect(back("saved=1"));
  }

  // New record: the Vault write comes first — a row with no value is worse
  // than no row at all.
  const secretId = await createSecret(service, name, value);
  if (!secretId) fail("Could not store the value securely. Nothing was saved.");

  const { data: created, error } = await service
    .from("business_records")
    .insert({
      name,
      note,
      secret_id: secretId,
      hint: hintFor(value),
      created_by: guard.email,
      updated_by: guard.email,
    })
    .select("id")
    .single();
  if (error || !created) fail(errorText(error?.message ?? "Could not save the record."));

  await logAudit({
    action: "business_record.created",
    target: `business_record:${created.id}`,
    metadata: { name, by: guard.email },
  });
  redirect(back("saved=1"));
}

export async function deleteRecord(formData: FormData) {
  const guard = await requireStaff();
  if (!guard.ok) return;
  const id = String(formData.get("id") || "");
  if (!id) return;

  const service = createServiceClient();
  const { data: row } = await service
    .from("business_records")
    .select("id, name, secret_id")
    .eq("id", id)
    .maybeSingle();
  if (!row) fail("That record no longer exists.");

  const { error } = await service.from("business_records").delete().eq("id", id);
  if (error) fail(errorText(error.message));
  // Take the encrypted value with it — a record deleted from the hub should
  // not leave its secret behind in Vault.
  if (row.secret_id) {
    const { error: vaultErr } = await service.rpc("delete_vault_secret", {
      secret_id: row.secret_id,
    });
    if (vaultErr) {
      console.warn(
        "[vault] orphaned secret left in Vault:",
        row.secret_id,
        vaultErr.message
      );
    }
  }
  await logAudit({
    action: "business_record.deleted",
    target: `business_record:${id}`,
    metadata: { name: row.name, by: guard.email },
  });
  redirect(back("deleted=1"));
}

/**
 * Reveal one value. Goes through the caller's OWN session (not the service
 * role) so the database can check their two-factor level, and is always
 * audit-logged — the value itself never reaches the log.
 */
export async function revealRecord(formData: FormData) {
  const guard = await requireStaff();
  if (!guard.ok) return;
  const id = String(formData.get("id") || "");
  if (!id) return;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reveal_business_record", { record_id: id });
  if (error) {
    const twoFactor = error.message.includes("two-factor");
    await logAudit({
      action: "business_record.reveal_denied",
      target: `business_record:${id}`,
      metadata: { by: guard.email, reason: twoFactor ? "aal1" : "forbidden" },
    });
    fail(
      twoFactor
        ? "Turn on two-factor authentication under Security before revealing a value."
        : "You are not allowed to reveal that value."
    );
  }

  const service = createServiceClient();
  await service
    .from("business_records")
    .update({ last_revealed_at: new Date().toISOString(), last_revealed_by: guard.email })
    .eq("id", id);
  await logAudit({
    action: "business_record.revealed",
    target: `business_record:${id}`,
    metadata: { by: guard.email },
  });

  // Handed back through the URL so it is never cached in a server component
  // payload; the page shows it once and the link back clears it.
  redirect(back(`shown=${id}&value=${encodeURIComponent(String(data ?? ""))}`));
}

/** Vault holds the value; this table only ever holds a reference to it. */
async function createSecret(
  service: ReturnType<typeof createServiceClient>,
  name: string,
  value: string
): Promise<string | null> {
  const { data, error } = await service.rpc("create_vault_secret", {
    new_secret: value,
    new_name: `business_record:${name}:${Date.now()}`,
    new_description: "Null Shift business record",
  });
  if (error) {
    console.error("[vault] create_secret failed:", error.message);
    return null;
  }
  return (data as string) ?? null;
}

const errorText = (msg: string) =>
  msg.includes("business_records_name_key")
    ? "There is already a record with that name."
    : msg;
