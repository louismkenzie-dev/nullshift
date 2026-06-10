import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * PATCH /api/admin/project-updates/[updateId]
 * Partial update — accepts any subset of: { action_resolved, client_choice, title, body }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ updateId: string }> }
) {
  const { updateId } = await params;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const supabase = (() => { try { return createServiceClient(); } catch { return null; } })();
  if (!supabase) return NextResponse.json({ error: "Backend not configured." }, { status: 500 });

  const allowed = ["action_resolved", "client_choice", "title", "body", "requires_action"];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) if (key in body) patch[key] = body[key];

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { error } = await supabase
    .from("project_updates")
    .update(patch)
    .eq("id", updateId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/admin/project-updates/[updateId]
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ updateId: string }> }
) {
  const { updateId } = await params;

  const supabase = (() => { try { return createServiceClient(); } catch { return null; } })();
  if (!supabase) return NextResponse.json({ error: "Backend not configured." }, { status: 500 });

  const { error } = await supabase
    .from("project_updates")
    .delete()
    .eq("id", updateId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
