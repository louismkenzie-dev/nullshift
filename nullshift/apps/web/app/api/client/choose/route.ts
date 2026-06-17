import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@nullshift/db";
import { hasSupabaseBrowserConfig } from "@nullshift/db/env";

/**
 * POST /api/client/choose
 * Body: { updateId: string; choice: string }
 *
 * Validates that the authenticated user owns the project_update they're
 * responding to, then records their choice.
 */
export async function POST(request: Request) {
  if (!hasSupabaseBrowserConfig()) {
    return NextResponse.json({ error: "Backend not configured." }, { status: 500 });
  }

  let body: { updateId: string; choice: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { updateId, choice } = body;
  if (!updateId?.trim() || !choice?.trim()) {
    return NextResponse.json({ error: "updateId and choice are required." }, { status: 400 });
  }

  // Verify the session
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });

  const service = createServiceClient();

  // Look up this client by email
  const { data: client } = await service
    .from("clients")
    .select("id")
    .ilike("email", user.email)
    .maybeSingle();

  if (!client) return NextResponse.json({ error: "Client record not found." }, { status: 404 });

  // Verify the update belongs to this client
  const { data: update } = await service
    .from("project_updates")
    .select("id, client_id, options")
    .eq("id", updateId)
    .maybeSingle();

  if (!update) return NextResponse.json({ error: "Update not found." }, { status: 404 });
  if (update.client_id !== client.id) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  // Validate the choice is one of the defined options
  const options = (update.options as Array<{ id: string }>) ?? [];
  if (options.length > 0 && !options.find(o => o.id === choice)) {
    return NextResponse.json({ error: "Invalid choice." }, { status: 400 });
  }

  const { error } = await service
    .from("project_updates")
    .update({ client_choice: choice, action_resolved: true })
    .eq("id", updateId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
