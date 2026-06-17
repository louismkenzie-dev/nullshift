import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Deliverables document store (brief §5/§6). Files live in the private
 * `deliverables` Storage bucket at `<tenant_id>/<project_id>/v<n>-<name>` (so
 * Storage RLS scopes them per tenant); the `documents` table is the
 * version-controlled index. Staff upload; clients download their own tenant's
 * files via short-lived signed URLs.
 */
const BUCKET = "deliverables";

function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "file";
}

export async function uploadDeliverable(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    projectId: string;
    kind: string;
    fileName: string;
    body: ArrayBuffer | Uint8Array;
    contentType?: string;
  }
): Promise<{ ok: boolean; error?: string; version?: number; path?: string }> {
  const base = safeName(params.fileName);

  // Next version = how many prior docs in this project share the same base name.
  const { data: prior } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("project_id", params.projectId);
  const priorCount = (prior ?? []).filter((d: { storage_path: string }) =>
    d.storage_path.endsWith(`-${base}`)
  ).length;
  const version = priorCount + 1;

  const path = `${params.tenantId}/${params.projectId}/v${version}-${base}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, params.body, {
    contentType: params.contentType,
    upsert: false,
  });
  if (upErr) return { ok: false, error: upErr.message };

  const { error } = await supabase.from("documents").insert({
    tenant_id: params.tenantId,
    project_id: params.projectId,
    kind: params.kind as never,
    storage_path: path,
    version,
  });
  if (error) return { ok: false, error: error.message };

  return { ok: true, version, path };
}

/** Short-lived signed URL for downloading a deliverable (default 5 min). */
export async function signDeliverableUrl(
  supabase: SupabaseClient,
  path: string,
  expiresIn = 300
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data) return null;
  return data.signedUrl;
}
